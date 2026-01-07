from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, cast
from sqlalchemy.dialects.postgresql import JSONB
from typing import List
from database import get_db
from models import TaskRating, User, Task, Activity, Project
from schemas import RatingCreate, RatingResponse
from routes.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/ratings", tags=["Ratings"])

@router.get("/", response_model=List[RatingResponse])
def get_ratings(
    task_id: int = None,
    ratee_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TaskRating)
    
    if task_id:
        query = query.filter(TaskRating.task_id == task_id)
    if ratee_id:
        query = query.filter(TaskRating.ratee_id == ratee_id)
    
    # Filter based on role
    if current_user.role == "Employee":
        query = query.filter(TaskRating.ratee_id == current_user.id)
    elif current_user.role == "Manager":
        team_ids = [u.id for u in db.query(User).filter(User.report_to_id == current_user.empid).all()]
        team_ids.append(current_user.id)
        query = query.filter(TaskRating.ratee_id.in_(team_ids))
    
    return query.order_by(TaskRating.rated_at.desc()).all()

@router.get("/stats")
def get_rating_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get overall rating statistics"""
    query = db.query(TaskRating)
    
    if current_user.role == "Employee":
        query = query.filter(TaskRating.ratee_id == current_user.id)
    elif current_user.role == "Manager":
        team_ids = [u.id for u in db.query(User).filter(User.report_to_id == current_user.empid).all()]
        team_ids.append(current_user.id)
        query = query.filter(TaskRating.ratee_id.in_(team_ids))
    
    ratings = query.all()
    
    if not ratings:
        return {
            "total_ratings": 0,
            "average_score": 0,
            "score_distribution": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
        }
    
    total = len(ratings)
    avg_score = sum(r.score for r in ratings) / total
    
    distribution = {str(i): sum(1 for r in ratings if r.score == i) for i in range(1, 6)}
    
    return {
        "total_ratings": total,
        "average_score": round(avg_score, 2),
        "score_distribution": distribution
    }

@router.get("/by-employee")
def get_ratings_by_employee(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get rating statistics grouped by employee"""
    if current_user.role == "Employee":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get employees based on role
    if current_user.role == "Manager":
        employees = db.query(User).filter(User.report_to_id == current_user.empid, User.is_active == True).all()
    else:
        employees = db.query(User).filter(User.role == "Employee", User.is_active == True).all()
    
    result = []
    
    for emp in employees:
        ratings = db.query(TaskRating).filter(TaskRating.ratee_id == emp.id).all()
        
        total = len(ratings)
        avg_score = sum(r.score for r in ratings) / total if total > 0 else 0
        
        result.append({
            "id": emp.id,
            "empid": emp.empid,
            "name": emp.name,
            "email": emp.email,
            "image_base64": emp.image_base64,
            "total_ratings": total,
            "average_score": round(avg_score, 2)
        })
    
    return result

@router.get("/by-manager")
def get_ratings_by_manager(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get rating and task/project statistics grouped by manager - Admin only"""
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Access denied - Admin only")
    
    # Get all managers
    managers = db.query(User).filter(User.role == "Manager", User.is_active == True).all()
    
    result = []
    today = datetime.now().date()
    
    for manager in managers:
        # Get ratings received by manager (as ratee)
        ratings = db.query(TaskRating).filter(TaskRating.ratee_id == manager.id).all()
        total_ratings = len(ratings)
        avg_score = sum(r.score for r in ratings) / total_ratings if total_ratings > 0 else 0
        
        # Get tasks assigned to manager or their team
        team_ids = [u.id for u in db.query(User).filter(User.report_to_id == manager.empid).all()]
        team_ids.append(manager.id)
        
        tasks = db.query(Task).filter(
            or_(
                Task.assigned_by_id == manager.id,
                Task.assigned_to_id.in_(team_ids) if team_ids else False
            )
        ).all()
        
        task_total = len(tasks)
        task_pending = sum(1 for t in tasks if t.status in ["todo", "in-progress"])
        task_completed = sum(1 for t in tasks if t.status == "done")
        
        # Delayed tasks (past due date and not completed)
        task_delayed = 0
        for t in tasks:
            if t.due_date and t.status != "done":
                due_date = t.due_date
                if isinstance(due_date, datetime):
                    due_date = due_date.date()
                if due_date < today:
                    task_delayed += 1
        
        # Get projects where manager is project head
        projects = db.query(Project).filter(Project.project_head_id == manager.id).all()
        
        project_total = len(projects)
        project_pending = sum(1 for p in projects if p.status == "planning")
        project_completed = sum(1 for p in projects if p.status == "completed")
        
        # Delayed projects (past end_date and not completed)
        project_delayed = 0
        for p in projects:
            if p.end_date and p.status != "completed":
                end_date = p.end_date
                if isinstance(end_date, datetime):
                    end_date = end_date.date()
                elif isinstance(end_date, str):
                    try:
                        from datetime import datetime as dt
                        end_date = dt.fromisoformat(end_date).date()
                    except:
                        continue
                if end_date < today:
                    project_delayed += 1
        
        result.append({
            "id": manager.id,
            "empid": manager.empid,
            "name": manager.name,
            "email": manager.email,
            "image_base64": manager.image_base64,
            "total_ratings": total_ratings,
            "average_score": round(avg_score, 2),
            # Task stats
            "task_total": task_total,
            "task_pending": task_pending,
            "task_completed": task_completed,
            "task_delayed": task_delayed,
            # Project stats
            "project_total": project_total,
            "project_pending": project_pending,
            "project_completed": project_completed,
            "project_delayed": project_delayed
        })
    
    return result

@router.get("/unrated-tasks")
def get_unrated_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get completed tasks that haven't been rated by the current user"""
    if current_user.role == "Employee":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get all completed tasks
    completed_tasks = db.query(Task).filter(
        Task.status == "done",
        Task.percent_complete == 100
    ).all()
    
    # Get tasks already rated by current user
    rated_task_ids = db.query(TaskRating.task_id).filter(
        TaskRating.rater_id == current_user.id
    ).distinct().all()
    rated_task_ids = [t[0] for t in rated_task_ids]
    
    # Filter out already rated tasks
    unrated_tasks = [t for t in completed_tasks if t.id not in rated_task_ids]
    
    # Format response
    result = []
    for task in unrated_tasks:
        result.append({
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "assigned_to_id": task.assigned_to_id,
            "assigned_to_name": task.assigned_to_name,
            "assigned_to_ids": task.assigned_to_ids or [],
            "completed_at": task.updated_at.isoformat() if task.updated_at else None
        })
    
    return result

@router.get("/task/{task_id}", response_model=List[RatingResponse])
def get_task_ratings(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all ratings for a specific task"""
    return db.query(TaskRating).filter(TaskRating.task_id == task_id).order_by(TaskRating.rated_at.desc()).all()

@router.get("/{rating_id}", response_model=RatingResponse)
def get_rating(
    rating_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rating = db.query(TaskRating).filter(TaskRating.id == rating_id).first()
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    return rating

@router.post("/", response_model=RatingResponse, status_code=status.HTTP_201_CREATED)
def create_rating(
    rating_data: RatingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "Employee":
        raise HTTPException(status_code=403, detail="Employees cannot create ratings")
    
    # Validate score
    if rating_data.score < 1 or rating_data.score > 5:
        raise HTTPException(status_code=400, detail="Score must be between 1 and 5")
    
    # Check if task exists
    task = db.query(Task).filter(Task.id == rating_data.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Get ratee name
    ratee = db.query(User).filter(User.id == rating_data.ratee_id).first()
    if not ratee:
        raise HTTPException(status_code=404, detail="Ratee not found")
    
    # Check if already rated
    existing = db.query(TaskRating).filter(
        TaskRating.task_id == rating_data.task_id,
        TaskRating.rater_id == current_user.id,
        TaskRating.ratee_id == rating_data.ratee_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="You have already rated this task for this employee")
    
    rating = TaskRating(
        task_id=rating_data.task_id,
        rater_id=current_user.id,
        rater_name=current_user.name,
        ratee_id=rating_data.ratee_id,
        ratee_name=ratee.name,
        score=rating_data.score,
        comments=rating_data.comments
    )
    
    db.add(rating)
    db.commit()
    db.refresh(rating)
    
    # Log activity
    activity = Activity(
        user_id=current_user.id,
        user_name=current_user.name,
        action="rated",
        entity_type="task",
        entity_id=rating_data.task_id,
        entity_name=task.title,
        details=f"Rated {ratee.name} for task: {task.title} - Score: {rating_data.score}/5"
    )
    db.add(activity)
    db.commit()
    
    return rating

@router.put("/{rating_id}", response_model=RatingResponse)
def update_rating(
    rating_id: int,
    score: int,
    comments: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rating = db.query(TaskRating).filter(TaskRating.id == rating_id).first()
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    
    # Only the rater can update
    if rating.rater_id != current_user.id and current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    if score < 1 or score > 5:
        raise HTTPException(status_code=400, detail="Score must be between 1 and 5")
    
    rating.score = score
    if comments:
        rating.comments = comments
    rating.rated_at = get_ist_now()
    
    db.commit()
    db.refresh(rating)
    
    return rating

@router.delete("/{rating_id}")
def delete_rating(
    rating_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Only Admin can delete ratings")
    
    rating = db.query(TaskRating).filter(TaskRating.id == rating_id).first()
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    
    db.delete(rating)
    db.commit()
    
    return {"message": "Rating deleted successfully"}







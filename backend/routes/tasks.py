from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, cast
from sqlalchemy.dialects.postgresql import JSONB
from typing import List
from database import get_db
from models import Task, User, Subtask, Comment, TaskTimer, Activity, Project, TaskRating
from schemas import (
    TaskCreate, TaskUpdate, TaskResponse,
    SubtaskBase, SubtaskCreate, SubtaskUpdate, SubtaskResponse,
    CommentCreate, CommentResponse,
    TimerStart, TimerStop, TimerResponse
)
from routes.auth import get_current_user
from datetime import datetime, date, timezone
from typing import Optional, List
from sqlalchemy import extract, func as sql_func


UTC = timezone.utc
router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.get("/calendar")
def get_calendar_tasks(
    month: int = None,
    year: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get tasks for calendar view grouped by due_date"""
    try:
        from datetime import date as date_type
        from sqlalchemy import extract
        
        if not month:
            month = datetime.now().month
        if not year:
            year = datetime.now().year
        
        # Build query based on role
        query = db.query(Task)
        
        if current_user.role == "Employee":
            query = query.filter(
                or_(
                    Task.assigned_to_id == current_user.id,
                    cast(Task.assigned_to_ids, JSONB).contains([{"empid": current_user.empid}])
                )
            )
        elif current_user.role == "Manager":
            team_ids = [u.id for u in db.query(User).filter(User.report_to_id == current_user.empid).all()]
            team_ids.append(current_user.id)
            query = query.filter(
                or_(
                    Task.assigned_by_id == current_user.id,
                    Task.assigned_to_id.in_(team_ids) if team_ids else False
                )
            )
        
        # Filter by month and year
        query = query.filter(
            extract('month', Task.due_date) == month,
            extract('year', Task.due_date) == year
        )
        
        tasks = query.filter(Task.due_date.isnot(None)).all()
        
        # Group tasks by date
        tasks_by_date = {}
        for task in tasks:
            if task.due_date:
                due_date = task.due_date
                if isinstance(due_date, datetime):
                    due_date = due_date.date()
                
                date_key = due_date.isoformat()
                if date_key not in tasks_by_date:
                    tasks_by_date[date_key] = []
                
                tasks_by_date[date_key].append({
                    "id": task.id,
                    "title": task.title,
                    "description": task.description,
                    "status": task.status,
                    "priority": task.priority,
                    "due_date": date_key,
                    "assigned_to_name": None
                })
        
        return tasks_by_date
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching calendar tasks: {str(e)}")

@router.get("/", response_model=List[TaskResponse])
def get_tasks(
    project_id: int = None,
    status: str = None,
    assigned_to_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        query = db.query(Task)
        
        if project_id:
            query = query.filter(Task.project_id == project_id)
        if status:
            query = query.filter(Task.status == status)
        if assigned_to_id:
            query = query.filter(Task.assigned_to_id == assigned_to_id)
        
        # Filter based on role
        if current_user.role == "Employee":
            query = query.filter(
                or_(
                    Task.assigned_to_id == current_user.id,
                    cast(Task.assigned_to_ids, JSONB).contains([{"empid": current_user.empid}])
                )
            )
        elif current_user.role == "Manager":
            # Manager can see tasks they created or assigned to their team
            # Limit team query for performance
            team_ids = [u.id for u in db.query(User).filter(User.report_to_id == current_user.empid).limit(100).all()]
            team_ids.append(current_user.id)
            query = query.filter(
                or_(
                    Task.assigned_by_id == current_user.id,
                    Task.assigned_to_id.in_(team_ids) if team_ids else False
                )
            )
        
        # Limit to 500 tasks for performance
        tasks = query.order_by(Task.created_at.desc()).limit(500).all()
        
        # Add delayed days to each task
        today = datetime.now().date()
        for task in tasks:
            if task.due_date:
                due_date = task.due_date
                if isinstance(due_date, datetime):
                    due_date = due_date.date()
                if due_date < today and task.status != "done":
                    task.is_delayed = True
                    task.delayed_days = (today - due_date).days
                else:
                    task.is_delayed = False
                    task.delayed_days = 0
            else:
                task.is_delayed = False
                task.delayed_days = 0
        
        return tasks
    except Exception as e:
        print(f"Error in get_tasks: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching tasks: {str(e)}")

@router.get("/stats")
def get_task_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        query = db.query(Task)
        
        if current_user.role == "Employee":
            query = query.filter(
                or_(
                    Task.assigned_to_id == current_user.id,
                    cast(Task.assigned_to_ids, JSONB).contains([{"empid": current_user.empid}])
                )
            )
        elif current_user.role == "Manager":
            team_ids = [u.id for u in db.query(User).filter(User.report_to_id == current_user.empid).all()]
            team_ids.append(current_user.id)
            query = query.filter(
                or_(
                    Task.assigned_by_id == current_user.id,
                    Task.assigned_to_id.in_(team_ids) if team_ids else False
                )
            )
        
        tasks = query.all()
        
        total = len(tasks)
        todo = sum(1 for t in tasks if t.status == "todo")
        in_progress = sum(1 for t in tasks if t.status == "in-progress")
        completed = sum(1 for t in tasks if t.status == "done")
        blocked = sum(1 for t in tasks if t.status == "blocked")
        
        # Delayed tasks (past due date and not completed)
        today = datetime.now().date()
        delayed = sum(1 for t in tasks if t.due_date and t.due_date < today and t.status != "done")
        
        return {
            "total": total,
            "todo": todo,
            "in_progress": in_progress,
            "completed": completed,
            "blocked": blocked,
            "delayed": delayed
        }
    except Exception as e:
        print(f"Error in get_task_stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching task stats: {str(e)}")

@router.get("/by-employee")
def get_tasks_by_employee(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get task statistics grouped by employee"""
    if current_user.role == "Employee":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get employees based on role
    if current_user.role == "Manager":
        employees = db.query(User).filter(User.report_to_id == current_user.empid, User.is_active == True).all()
    else:
        employees = db.query(User).filter(User.role == "Employee", User.is_active == True).all()
    
    result = []
    today = datetime.now().date()
    
    for emp in employees:
        tasks = db.query(Task).filter(
            or_(
                Task.assigned_to_id == emp.id,
                cast(Task.assigned_to_ids, JSONB).contains([{"empid": emp.empid}])
            )
        ).all()
        
        total = len(tasks)
        pending = sum(1 for t in tasks if t.status in ["todo", "in-progress"])
        completed = sum(1 for t in tasks if t.status == "done")
        delayed = sum(1 for t in tasks if t.due_date and t.due_date < today and t.status != "done")
        
        # Calculate performance percentage
        performance = (completed / total * 100) if total > 0 else 0
        
        result.append({
            "id": emp.id,
            "empid": emp.empid,
            "name": emp.name,
            "email": emp.email,
            "image_base64": emp.image_base64,
            "total_tasks": total,
            "pending": pending,
            "completed": completed,
            "delayed": delayed,
            "performance": round(performance, 1)
        })
    
    return result

@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.get("/{task_id}/durations")
def get_task_durations(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get assigned duration and working duration for a task"""
    from datetime import datetime, timezone
    from utils import get_ist_now
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    now = get_ist_now()
    
    # Assigned Duration: time since task was assigned
    # For newly created tasks, ALWAYS start from created_at to ensure timer starts at 00:00:00
    # Only use start_date if it's clearly in the future (scheduled tasks)
    # This ensures that even if start_date is set to today or past, timer starts from creation time
    assigned_start = task.created_at
    if assigned_start.tzinfo is None:
        assigned_start = assigned_start.replace(tzinfo=timezone.utc)
    
    # Only use start_date if it's clearly in the future (scheduled task)
    # We check if start_date is at least 1 hour in the future to avoid timezone/calculation issues
    if task.start_date:
        start_date_dt = None
        if isinstance(task.start_date, datetime):
            start_date_dt = task.start_date
        else:
            # Convert date to datetime at start of day
            from datetime import date as date_type
            if isinstance(task.start_date, date_type):
                start_date_dt = datetime.combine(task.start_date, datetime.min.time())
            else:
                # Try to parse string date
                try:
                    start_date_dt = datetime.fromisoformat(str(task.start_date).replace('Z', '+00:00'))
                except:
                    start_date_dt = datetime.combine(task.start_date, datetime.min.time())
            
            if start_date_dt.tzinfo is None:
                start_date_dt = start_date_dt.replace(tzinfo=timezone.utc)
        
        # Only use start_date if it's clearly in the future (at least 1 hour ahead)
        # This ensures newly created tasks always start from created_at (00:00:00)
        # and only scheduled tasks use their future start_date
        if start_date_dt:
            time_diff = (start_date_dt - now).total_seconds()
            # Only use start_date if it's at least 1 hour in the future
            if time_diff > 3600:  # 1 hour in seconds
                assigned_start = start_date_dt
    
    # Assigned Duration: time from assigned to completion (or now if not done)
    # If task is done, use updated_at as end time, otherwise use now
    assigned_end = None
    if task.status == "done" and task.percent_complete == 100:
        # Task is completed - use updated_at as end time
        assigned_end = task.updated_at
        if assigned_end.tzinfo is None:
            assigned_end = assigned_end.replace(tzinfo=timezone.utc)
    else:
        # Task is not done - use current time for continuous timer
        assigned_end = now
    
    # Ensure duration is never negative (handle future dates)
    assigned_duration_seconds = max(0, int((assigned_end - assigned_start).total_seconds()))
    
    # Working Duration: sum of all timer durations (only completed timers, not continuous)
    timers = db.query(TaskTimer).filter(TaskTimer.task_id == task_id).all()
    working_duration_seconds = 0
    for timer in timers:
        if timer.end_time:
            # Only count completed timer sessions
            working_duration_seconds += (timer.duration_seconds or 0)
        # Note: Active timers are not counted in working duration until stopped
    
    # Check if overdue (task not done and past due date)
    is_overdue = False
    if task.due_date and task.status != "done":
        due_date = task.due_date
        if isinstance(due_date, datetime):
            due_date = due_date.date()
        elif isinstance(due_date, str):
            from datetime import date as date_type
            try:
                due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00')).date()
            except:
                due_date = date_type.fromisoformat(due_date)
        if isinstance(due_date, date_type) and due_date < now.date():
            is_overdue = True
    
    return {
        "assigned_duration_seconds": assigned_duration_seconds,
        "working_duration_seconds": working_duration_seconds,
        "is_overdue": is_overdue
    }

@router.get("/{task_id}/details")
def get_task_details(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get complete task details including subtasks, comments, timers"""
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Check access permissions (Admin has full access)
        if current_user.role == "Employee":
            if task.assigned_to_id != current_user.id and not (task.assigned_to_ids and any(m.get("empid") == current_user.empid for m in (task.assigned_to_ids or []))):
                raise HTTPException(status_code=403, detail="Access denied")
        elif current_user.role == "Manager":
            team_ids = [u.id for u in db.query(User).filter(User.report_to_id == current_user.empid).all()]
            team_ids.append(current_user.id)
            if task.assigned_by_id != current_user.id and task.assigned_to_id not in team_ids:
                raise HTTPException(status_code=403, detail="Access denied")
        # Admin has full access, no check needed
        
        subtasks = db.query(Subtask).filter(Subtask.task_id == task_id).all()
        comments = db.query(Comment).filter(Comment.task_id == task_id).order_by(Comment.created_at.desc()).all()
        timers = db.query(TaskTimer).filter(TaskTimer.task_id == task_id).order_by(TaskTimer.start_time.desc()).all()
        
        # Calculate total time spent
        total_seconds = sum((t.duration_seconds or 0) for t in timers)
        
        # Calculate delayed days
        from datetime import date as date_type
        today = date_type.today()
        is_delayed = False
        delayed_days = 0
        if task.due_date:
            try:
                due_date = task.due_date
                if isinstance(due_date, datetime):
                    due_date = due_date.date()
                elif isinstance(due_date, str):
                    from datetime import datetime as dt
                    due_date = dt.fromisoformat(due_date.replace('Z', '+00:00')).date()
                if isinstance(due_date, date_type) and due_date < today and task.status != "done":
                    is_delayed = True
                    delayed_days = (today - due_date).days
            except Exception as e:
                print(f"Error calculating delayed days: {e}")
                is_delayed = False
                delayed_days = 0
        
        # Get task ratings
        ratings_data = []
        try:
            ratings = db.query(TaskRating).filter(TaskRating.task_id == task_id).order_by(TaskRating.rated_at.desc()).all()
            for rating in ratings:
                ratings_data.append({
                    "id": rating.id,
                    "task_id": rating.task_id,
                    "rater_id": rating.rater_id,
                    "rater_name": rating.rater_name or "",
                    "ratee_id": rating.ratee_id,
                    "ratee_name": rating.ratee_name or "",
                    "score": rating.score or 0,
                    "comments": rating.comments or "",
                    "rated_at": rating.rated_at.isoformat() if rating.rated_at and hasattr(rating.rated_at, 'isoformat') else (str(rating.rated_at) if rating.rated_at else None)
                })
        except Exception as e:
            print(f"Error fetching ratings: {e}")
            import traceback
            traceback.print_exc()
            ratings_data = []
        
        # Convert task to dict safely with proper date serialization
        # Use manual conversion to ensure all dates are properly serialized
        task_dict = {
            "id": task.id,
            "project_id": task.project_id,
            "title": task.title or "",
            "description": task.description or "",
            "status": task.status or "todo",
            "priority": task.priority or "medium",
            "assigned_by_id": task.assigned_by_id,
            "assigned_by_name": task.assigned_by_name or "",
            "assigned_to_id": task.assigned_to_id,
            "assigned_to_name": task.assigned_to_name or "",
            "assigned_to_ids": task.assigned_to_ids if task.assigned_to_ids is not None else [],
            "start_date": task.start_date.isoformat() if task.start_date and hasattr(task.start_date, 'isoformat') else (str(task.start_date) if task.start_date else None),
            "due_date": task.due_date.isoformat() if task.due_date and hasattr(task.due_date, 'isoformat') else (str(task.due_date) if task.due_date else None),
            "estimated_days": task.estimated_days,
            "actual_days": task.actual_days,
            "percent_complete": task.percent_complete or 0,
            "remarks": task.remarks if task.remarks is not None else [],
            "created_at": task.created_at.isoformat() if task.created_at and hasattr(task.created_at, 'isoformat') else (str(task.created_at) if task.created_at else None),
            "updated_at": task.updated_at.isoformat() if task.updated_at and hasattr(task.updated_at, 'isoformat') else (str(task.updated_at) if task.updated_at else None),
            "is_delayed": is_delayed,
            "delayed_days": delayed_days
        }
        
        # Convert subtasks, comments, timers to dict format safely
        subtasks_data = []
        for s in subtasks:
            subtasks_data.append({
                "id": s.id,
                "task_id": s.task_id,
                "title": s.title or "",
                "completed": getattr(s, 'is_completed', getattr(s, 'completed', False))
            })
        
        comments_data = []
        for c in comments:
            author_name = getattr(c, 'author_name', getattr(c, 'user_name', ''))
            comments_data.append({
                "id": c.id,
                "task_id": c.task_id,
                "user_id": getattr(c, 'author_id', getattr(c, 'user_id', None)),
                "author_name": author_name,
                "user_name": author_name,
                "content": getattr(c, 'content', getattr(c, 'message', '')),
                "created_at": c.created_at.isoformat() if c.created_at and hasattr(c.created_at, 'isoformat') else (str(c.created_at) if c.created_at else None)
            })
        
        timers_data = []
        for t in timers:
            timers_data.append({
                "id": t.id,
                "task_id": t.task_id,
                "user_id": getattr(t, 'user_id', None),
                "start_time": t.start_time.isoformat() if t.start_time and hasattr(t.start_time, 'isoformat') else (str(t.start_time) if t.start_time else None),
                "end_time": t.end_time.isoformat() if t.end_time and hasattr(t.end_time, 'isoformat') else (str(t.end_time) if t.end_time else None),
                "duration_seconds": t.duration_seconds or 0,
                "notes": getattr(t, 'notes', None),
                "created_at": getattr(t, 'created_at', t.start_time).isoformat() if (getattr(t, 'created_at', None) or t.start_time) and hasattr(getattr(t, 'created_at', t.start_time), 'isoformat') else (str(getattr(t, 'created_at', t.start_time)) if (getattr(t, 'created_at', None) or t.start_time) else None)
            })
        
        response_data = {
            "task": task_dict,
            "subtasks": subtasks_data,
            "comments": comments_data,
            "timers": timers_data,
            "ratings": ratings_data,
            "total_time_seconds": total_seconds
        }
        
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_task_details: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching task details: {str(e)}")

@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "Employee":
        raise HTTPException(status_code=403, detail="Employees cannot create tasks")
    
    # Check for duplicate title (case-insensitive)
    existing_task = db.query(Task).filter(
        func.lower(Task.title) == func.lower(task_data.title.strip())
    ).first()
    
    if existing_task:
        raise HTTPException(
            status_code=400, 
            detail="Task title already exists. Please use a different title."
        )
    
    # Get assigned to name
    assigned_to_name = None
    if task_data.assigned_to_id:
        assignee = db.query(User).filter(User.id == task_data.assigned_to_id).first()
        if assignee:
            assigned_to_name = assignee.name
    
    task = Task(
        project_id=task_data.project_id,
        title=task_data.title,
        description=task_data.description,
        priority=task_data.priority,
        status="todo",
        assigned_by_id=current_user.id,
        assigned_by_name=current_user.name,
        assigned_to_id=task_data.assigned_to_id,
        assigned_to_name=assigned_to_name,
        assigned_to_ids=task_data.assigned_to_ids or [],
        start_date=task_data.start_date,
        due_date=task_data.due_date,
        estimated_days=task_data.estimated_days
    )
    
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # Log activity
    activity = Activity(
        user_id=current_user.id,
        user_name=current_user.name,
        action="created",
        entity_type="task",
        entity_id=task.id,
        entity_name=task.title,
        details=f"Created task: {task.title}"
    )
    db.add(activity)
    db.commit()
    
    return task

@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check for duplicate title if title is being updated (case-insensitive)
    if task_data.title is not None:
        existing_task = db.query(Task).filter(
            func.lower(Task.title) == func.lower(task_data.title.strip()),
            Task.id != task_id
        ).first()
        
        if existing_task:
            raise HTTPException(
                status_code=400, 
                detail="Task title already exists. Please use a different title."
            )
    
    # Employees can only update status and percent_complete
    if current_user.role == "Employee":
        if task.status == "done" and task.percent_complete == 100:
            raise HTTPException(status_code=400, detail="Completed tasks cannot be edited")
        allowed_fields = ["status", "percent_complete", "remarks"]
        update_data = {k: v for k, v in task_data.model_dump(exclude_unset=True).items() if k in allowed_fields}
    else:
        # Managers and Admins can edit completed tasks
        update_data = task_data.model_dump(exclude_unset=True)
    
    # Update assigned to name if changed
    if "assigned_to_id" in update_data and update_data["assigned_to_id"]:
        assignee = db.query(User).filter(User.id == update_data["assigned_to_id"]).first()
        if assignee:
            update_data["assigned_to_name"] = assignee.name
    
    for key, value in update_data.items():
        if value is not None:
            setattr(task, key, value)
    
    # Get IST time - try utils first, then models
    try:
        from utils import get_ist_now
        task.updated_at = get_ist_now()
    except ImportError:
        try:
            from models import get_ist_now
            task.updated_at = get_ist_now()
        except ImportError:
            from datetime import timezone, timedelta
            IST = timezone(timedelta(hours=5, minutes=30))
            task.updated_at = datetime.now(IST)
    
    try:
        db.commit()
        db.refresh(task)
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error updating task: {str(e)}")
    
    # Update project progress if task belongs to a project (separate transaction - don't fail main update)
    if task.project_id:
        try:
            update_project_progress(db, task.project_id)
        except Exception as e:
            # Log but don't fail the update if project progress update fails
            print(f"Error updating project progress: {e}")
            import traceback
            traceback.print_exc()
    
    # Log activity (separate transaction - don't fail main update)
    try:
        activity = Activity(
            user_id=current_user.id,
            user_name=current_user.name,
            action="updated",
            entity_type="task",
            entity_id=task.id,
            entity_name=task.title or "Task",
            details=f"Updated task: {task.title or 'Task'}"
        )
        db.add(activity)
        db.commit()
    except Exception as e:
        # Log but don't fail the update if activity logging fails
        print(f"Error logging activity: {e}")
        import traceback
        traceback.print_exc()
        # Don't rollback - task update is already committed
        try:
            db.rollback()
        except:
            pass
    
    return task

def update_project_progress(db: Session, project_id: int):
    """Update project progress based on task completion"""
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    if not tasks:
        return
    
    total_percent = sum(t.percent_complete for t in tasks)
    avg_percent = total_percent // len(tasks)
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        project.progress_percent = avg_percent
        if avg_percent == 100:
            project.status = "completed"
        elif avg_percent > 0:
            project.status = "active"
        db.commit()

@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "Employee":
        raise HTTPException(status_code=403, detail="Employees cannot delete tasks")
    
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(task)
    db.commit()
    
    return {"message": "Task deleted successfully"}

# ============ Subtasks ============
@router.post("/{task_id}/subtasks", response_model=SubtaskResponse)
def create_subtask(
    task_id: int,
    subtask_data: SubtaskBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    assigned_to_name = None
    if subtask_data.assigned_to_id:
        assignee = db.query(User).filter(User.id == subtask_data.assigned_to_id).first()
        if assignee:
            assigned_to_name = assignee.name
    
    subtask = Subtask(
        task_id=task_id,
        title=subtask_data.title,
        assigned_to_id=subtask_data.assigned_to_id,
        assigned_to_name=assigned_to_name
    )
    
    db.add(subtask)
    db.commit()
    db.refresh(subtask)
    
    return subtask

@router.put("/subtasks/{subtask_id}", response_model=SubtaskResponse)
def update_subtask(
    subtask_id: int,
    subtask_data: SubtaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    subtask = db.query(Subtask).filter(Subtask.id == subtask_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
    
    update_data = subtask_data.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        if value is not None:
            setattr(subtask, key, value)
    
    db.commit()
    db.refresh(subtask)
    
    return subtask

# ============ Comments ============
@router.post("/{task_id}/comments", response_model=CommentResponse)
def create_comment(
    task_id: int,
    content: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    comment = Comment(
        task_id=task_id,
        author_id=current_user.id,
        author_name=current_user.name,
        content=content
    )
    
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    return comment

# ============ Timers ============
@router.post("/{task_id}/timer/start", response_model=TimerResponse)
def start_timer(
    task_id: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check active timer
    active_timer = db.query(TaskTimer).filter(
        TaskTimer.task_id == task_id,
        TaskTimer.user_id == current_user.id,
        TaskTimer.end_time.is_(None)
    ).first()
    
    if active_timer:
        raise HTTPException(status_code=400, detail="Timer already running")
    
    # FIXED: Use timezone-aware datetime
    now = datetime.now(UTC)
    
    timer = TaskTimer(
        task_id=task_id,
        user_id=current_user.id,
        start_time=now,
        created_at=now,
        notes=notes
    )
    
    db.add(timer)
    db.commit()
    db.refresh(timer)
    
    if task.status == "todo":
        task.status = "in-progress"
        db.commit()
    
    return timer


@router.post("/timer/{timer_id}/stop", response_model=TimerResponse)
def stop_timer(
    timer_id: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    timer = db.query(TaskTimer).filter(
        TaskTimer.id == timer_id,
        TaskTimer.user_id == current_user.id
    ).first()
    
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")
    
    if timer.end_time is not None:
        raise HTTPException(status_code=400, detail="Timer already stopped")
    
    # FIXED: Use timezone-aware UTC now
    now = datetime.now(UTC)
    
    timer.end_time = now
    timer.duration_seconds = int((now - timer.start_time).total_seconds())
    
    if notes and notes.strip():
        if timer.notes:
            timer.notes += f"\n\n[Stop note] {notes.strip()}"
        else:
            timer.notes = notes.strip()
    
    # Ensure created_at exists
    if timer.created_at is None:
        timer.created_at = timer.start_time

    db.commit()
    db.refresh(timer)

    return timer


@router.get("/{task_id}/timers", response_model=List[TimerResponse])
def get_task_timers(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(TaskTimer).filter(
        TaskTimer.task_id == task_id
    ).order_by(TaskTimer.start_time.desc()).all()
from schemas import SubtaskBase



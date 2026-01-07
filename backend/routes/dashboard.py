from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, cast, extract
from sqlalchemy.dialects.postgresql import JSONB
from database import get_db
from models import Project, Task, Issue, Meeting, User, Activity
from schemas import DashboardStats, ActivityResponse
from routes.auth import get_current_user
from datetime import datetime, timedelta, date
from typing import List

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Projects
        project_query = db.query(Project)
        if current_user.role == "Manager":
            project_query = project_query.filter(Project.project_head_id == current_user.id)
        elif current_user.role == "Employee":
            project_query = project_query.filter(
                Project.teams.contains([{"empid": current_user.empid}])
            )
        
        projects = project_query.all()
        total_projects = len(projects)
        pending_projects = sum(1 for p in projects if p.status == "planning")
        in_progress_projects = sum(1 for p in projects if p.status == "active")
        completed_projects = sum(1 for p in projects if p.status == "completed")
        
        # Tasks
        task_query = db.query(Task)
        if current_user.role == "Employee":
            task_query = task_query.filter(
                or_(
                    Task.assigned_to_id == current_user.id,
                    cast(Task.assigned_to_ids, JSONB).contains([{"empid": current_user.empid}])
                )
            )
        elif current_user.role == "Manager":
            team_ids = [u.id for u in db.query(User).filter(User.report_to_id == current_user.empid).all()]
            team_ids.append(current_user.id)
            task_query = task_query.filter(
                or_(
                    Task.assigned_by_id == current_user.id,
                    Task.assigned_to_id.in_(team_ids) if team_ids else False
                )
            )
        
        tasks = task_query.all()
        total_tasks = len(tasks)
        pending_tasks = sum(1 for t in tasks if t.status == "todo")
        in_progress_tasks = sum(1 for t in tasks if t.status == "in-progress")
        completed_tasks = sum(1 for t in tasks if t.status == "done")
        
        # Issues
        issue_query = db.query(Issue)
        if current_user.role == "Employee":
            issue_query = issue_query.filter(
                or_(
                    Issue.raised_by == current_user.id,
                    Issue.assigned_to == current_user.id
                )
            )
        elif current_user.role == "Manager":
            team_ids = [u.id for u in db.query(User).filter(User.report_to_id == current_user.empid).all()]
            team_ids.append(current_user.id)
            issue_query = issue_query.filter(
                or_(
                    Issue.raised_by.in_(team_ids) if team_ids else False,
                    Issue.assigned_to.in_(team_ids) if team_ids else False
                )
            )
        
        issues = issue_query.all()
        total_issues = len(issues)
        pending_issues = sum(1 for i in issues if i.status in ["open", "in-progress"])
        resolved_issues = sum(1 for i in issues if i.status in ["resolved", "closed"])
        
        # Teams count
        if current_user.role == "Admin":
            total_teams = db.query(User).filter(User.is_active == True, User.role == "Employee").count()
        elif current_user.role == "Manager":
            total_teams = db.query(User).filter(User.report_to_id == current_user.empid, User.is_active == True).count()
        else:
            total_teams = 0
        
        # Today's meetings
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        meeting_query = db.query(Meeting).filter(
            Meeting.meeting_datetime >= today_start,
            Meeting.meeting_datetime < today_end
        )
        
        if current_user.role != "Admin":
            meeting_query = meeting_query.filter(
                or_(
                    Meeting.created_by == current_user.id,
                    cast(Meeting.participants, JSONB).contains([{"empid": current_user.empid}])
                )
            )
        
        today_meetings = meeting_query.count()
        
        return DashboardStats(
            total_projects=total_projects,
            pending_projects=pending_projects,
            in_progress_projects=in_progress_projects,
            completed_projects=completed_projects,
            total_tasks=total_tasks,
            pending_tasks=pending_tasks,
            in_progress_tasks=in_progress_tasks,
            completed_tasks=completed_tasks,
            total_issues=total_issues,
            pending_issues=pending_issues,
            resolved_issues=resolved_issues,
            total_teams=total_teams,
            today_meetings=today_meetings
        )
    except Exception as e:
        print(f"Error in get_dashboard_stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching dashboard stats: {str(e)}")

@router.get("/activities", response_model=List[ActivityResponse])
def get_recent_activities(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Activity)
    
    if current_user.role == "Employee":
        query = query.filter(Activity.user_id == current_user.id)
    elif current_user.role == "Manager":
        team_ids = [u.id for u in db.query(User).filter(User.report_to_id == current_user.empid).all()]
        team_ids.append(current_user.id)
        query = query.filter(Activity.user_id.in_(team_ids))
    
    activities = query.order_by(Activity.created_at.desc()).limit(limit).all()
    
    # Enrich activities with user images
    for activity in activities:
        user = db.query(User).filter(User.id == activity.user_id).first()
        if user:
            activity.user_image = user.image_base64
        else:
            activity.user_image = None
    
    return activities

@router.get("/progress")
def get_progress_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get progress data for charts"""
    try:
        # Projects progress
        project_query = db.query(Project)
        if current_user.role == "Manager":
            project_query = project_query.filter(Project.project_head_id == current_user.id)
        elif current_user.role == "Employee":
            # Handle None teams
            project_query = project_query.filter(
                or_(
                    Project.teams.is_(None),
                    cast(Project.teams, JSONB).contains([{"empid": current_user.empid}])
                )
            )
        
        projects = project_query.all()
        
        # Tasks by status
        task_query = db.query(Task)
        if current_user.role == "Employee":
            task_query = task_query.filter(
                or_(
                    Task.assigned_to_id == current_user.id,
                    cast(Task.assigned_to_ids, JSONB).contains([{"empid": current_user.empid}])
                )
            )
        elif current_user.role == "Manager":
            team_ids = [u.id for u in db.query(User).filter(User.report_to_id == current_user.empid).all()]
            team_ids.append(current_user.id)
            task_query = task_query.filter(
                or_(
                    Task.assigned_by_id == current_user.id,
                    Task.assigned_to_id.in_(team_ids) if team_ids else False
                )
            )
        
        tasks = task_query.all()
        
        return {
            "projects": {
                "labels": ["Planning", "Active", "On Hold", "Completed"],
                "data": [
                    sum(1 for p in projects if p.status == "planning"),
                    sum(1 for p in projects if p.status == "active"),
                    sum(1 for p in projects if p.status == "on-hold"),
                    sum(1 for p in projects if p.status == "completed")
                ]
            },
            "tasks": {
                "labels": ["To Do", "In Progress", "Blocked", "Review", "Done"],
                "data": [
                    sum(1 for t in tasks if t.status == "todo"),
                    sum(1 for t in tasks if t.status == "in-progress"),
                    sum(1 for t in tasks if t.status == "blocked"),
                    sum(1 for t in tasks if t.status == "review"),
                    sum(1 for t in tasks if t.status == "done")
                ]
            },
            "avg_project_progress": sum(p.progress_percent or 0 for p in projects) / len(projects) if projects else 0
        }
    except Exception as e:
        print(f"Error in get_progress_data: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching progress data: {str(e)}")

@router.get("/birthdays")
def get_birthdays(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get employees with birthdays today"""
    today = date.today()
    current_month = today.month
    current_day = today.day
    
    users = db.query(User).filter(
        User.is_active == True,
        extract('month', User.dob) == current_month,
        extract('day', User.dob) == current_day,
        User.dob.isnot(None)
    ).all()
    
    return [
        {
            "id": user.id,
            "empid": user.empid,
            "name": user.name,
            "image_base64": user.image_base64,
            "dob": user.dob.isoformat() if user.dob else None,
            "designation": user.designation
        }
        for user in users
    ]

@router.get("/anniversaries")
def get_anniversaries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get employees with work anniversaries today"""
    today = date.today()
    current_month = today.month
    current_day = today.day
    
    users = db.query(User).filter(
        User.is_active == True,
        extract('month', User.doj) == current_month,
        extract('day', User.doj) == current_day,
        User.doj.isnot(None)
    ).all()
    
    result = []
    for user in users:
        if user.doj:
            years = today.year - user.doj.year
            result.append({
                "id": user.id,
                "empid": user.empid,
                "name": user.name,
                "image_base64": user.image_base64,
                "doj": user.doj.isoformat(),
                "years": years,
                "designation": user.designation
            })
    
    return result







from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import extract
from datetime import datetime, date
from database import get_db
from models import TaskTimer, User, Task
from routes.auth import get_current_user
from typing import Optional

router = APIRouter()

@router.get("/work-reports/self")
def get_self_work_report(
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get own work report"""
    # Get current month if not provided
    if not month:
        today = datetime.now()
        month = today.strftime("%Y-%m")
    
    try:
        year, month_num = map(int, month.split('-'))
    except:
        raise HTTPException(status_code=400, detail="Invalid month format")
    
    # Get task timers for the month
    timers = db.query(TaskTimer).filter(
        TaskTimer.user_id == current_user.id,
        extract('year', TaskTimer.start_time) == year,
        extract('month', TaskTimer.start_time) == month_num
    ).all()
    
    # Get completed tasks
    tasks = db.query(Task).filter(
        Task.assigned_to_id == current_user.id,
        extract('year', Task.updated_at) == year,
        extract('month', Task.updated_at) == month_num,
        Task.status == 'completed'
    ).all()
    
    # Group by date
    reports = {}
    for timer in timers:
        date_key = timer.start_time.date().isoformat()
        if date_key not in reports:
            reports[date_key] = {
                "date": date_key,
                "tasks_completed": 0,
                "hours_worked": 0,
                "status": "completed",
                "remarks": ""
            }
        reports[date_key]["hours_worked"] += timer.duration_seconds / 3600
    
    for task in tasks:
        date_key = task.updated_at.date().isoformat()
        if date_key not in reports:
            reports[date_key] = {
                "date": date_key,
                "tasks_completed": 0,
                "hours_worked": 0,
                "status": "completed",
                "remarks": ""
            }
        reports[date_key]["tasks_completed"] += 1
    
    return list(reports.values())


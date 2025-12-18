from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, date, timedelta
from database import get_db
from models import Leave, User
from routes.auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter()

class LeaveCreate(BaseModel):
    from_date: str
    to_date: str
    leave_type: str
    reason: str
    duration: Optional[int] = None

class LeaveStatusUpdate(BaseModel):
    status: str

@router.post("/leaves")
def create_leave(
    leave_data: LeaveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a leave request"""
    try:
        from_date = datetime.fromisoformat(leave_data.from_date).date()
        to_date = datetime.fromisoformat(leave_data.to_date).date()
    except:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Calculate duration if not provided
    duration = leave_data.duration
    if not duration:
        duration = (to_date - from_date).days + 1
    
    # Get report_to from user
    report_to = None
    if current_user.report_to_id:
        report_to = current_user.report_to_id
    
    new_leave = Leave(
        empid=current_user.empid,
        name=current_user.name,
        applied_date=datetime.utcnow(),
        from_date=from_date,
        to_date=to_date,
        duration=duration,
        leave_type=leave_data.leave_type,
        report_to=report_to,
        reason=leave_data.reason,
        status='pending'
    )
    
    db.add(new_leave)
    db.commit()
    db.refresh(new_leave)
    
    return {
        "message": "Leave request submitted successfully",
        "id": new_leave.id
    }

@router.get("/leaves/self")
def get_self_leaves(
    filter: Optional[str] = "all",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get own leave requests"""
    query = db.query(Leave).filter(Leave.empid == current_user.empid)
    
    if filter != "all":
        query = query.filter(Leave.status == filter)
    
    leaves = query.order_by(Leave.applied_date.desc()).all()
    
    return [
        {
            "id": leave.id,
            "empid": leave.empid,
            "name": leave.name,
            "applied_date": leave.applied_date.isoformat(),
            "from_date": leave.from_date.isoformat(),
            "to_date": leave.to_date.isoformat(),
            "duration": leave.duration,
            "leave_type": leave.leave_type,
            "report_to": leave.report_to,
            "reason": leave.reason,
            "status": leave.status,
            "approved_by": leave.approved_by,
            "approved_date": leave.approved_date.isoformat() if leave.approved_date else None
        }
        for leave in leaves
    ]

@router.get("/leaves")
def get_all_leaves(
    filter: Optional[str] = "all",
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all leave requests (for managers/HR/Admin)"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = db.query(Leave)
    
    if employee_id:
        query = query.filter(Leave.empid == employee_id)
    elif current_user.role == "Manager":
        # Managers can only see leaves of employees reporting to them
        query = query.filter(Leave.report_to == current_user.empid)
    
    if filter != "all":
        query = query.filter(Leave.status == filter)
    
    leaves = query.order_by(Leave.applied_date.desc()).all()
    
    return [
        {
            "id": leave.id,
            "empid": leave.empid,
            "name": leave.name,
            "applied_date": leave.applied_date.isoformat(),
            "from_date": leave.from_date.isoformat(),
            "to_date": leave.to_date.isoformat(),
            "duration": leave.duration,
            "leave_type": leave.leave_type,
            "report_to": leave.report_to,
            "reason": leave.reason,
            "status": leave.status,
            "approved_by": leave.approved_by,
            "approved_date": leave.approved_date.isoformat() if leave.approved_date else None
        }
        for leave in leaves
    ]

@router.put("/leaves/{leave_id}")
def update_leave_status(
    leave_id: int,
    status_data: LeaveStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve or reject leave request"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    if status_data.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    leave.status = status_data.status
    leave.approved_by = current_user.empid
    leave.approved_date = datetime.utcnow()
    
    db.commit()
    db.refresh(leave)
    
    return {
        "message": f"Leave request {status_data.status} successfully",
        "id": leave.id
    }

@router.get("/leaves/balance")
def get_leave_balance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get leave balance for current user"""
    # Get current year
    current_year = date.today().year
    
    # Get all approved leaves for current user in current year
    approved_leaves = db.query(Leave).filter(
        Leave.empid == current_user.empid,
        Leave.status == 'approved',
        extract('year', Leave.from_date) == current_year
    ).all()
    
    # Count by leave type
    casual_count = sum(1 for l in approved_leaves if l.leave_type == 'casual')
    sick_count = sum(1 for l in approved_leaves if l.leave_type == 'sick')
    comp_off_count = sum(1 for l in approved_leaves if l.leave_type == 'comp-off' or l.leave_type == 'comp_off')
    total_count = len(approved_leaves)
    
    return {
        "casual": casual_count,
        "sick": sick_count,
        "comp_off": comp_off_count,
        "total": total_count
    }
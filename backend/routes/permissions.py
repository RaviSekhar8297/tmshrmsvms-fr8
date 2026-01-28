from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import extract
from datetime import datetime
from utils import get_ist_now
from database import get_db
from models import Permission, User, PunchLog
from routes.auth import get_current_user
from typing import Optional
from pydantic import BaseModel
from utils.email_service import send_permission_email_to_manager

router = APIRouter()

class PermissionCreate(BaseModel):
    permission_type: str
    from_datetime: str
    to_datetime: str
    reason: Optional[str] = None

class PermissionStatusUpdate(BaseModel):
    status: str

@router.post("/permissions")
def create_permission(
    permission_data: PermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a permission request"""
    try:
        from_datetime = datetime.fromisoformat(permission_data.from_datetime.replace('Z', '+00:00'))
        to_datetime = datetime.fromisoformat(permission_data.to_datetime.replace('Z', '+00:00'))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid datetime format: {str(e)}")

    # Validate required fields
    if not permission_data.permission_type or permission_data.permission_type.strip() == "":
        raise HTTPException(status_code=400, detail="Permission Type is required")

    if not permission_data.reason or permission_data.reason.strip() == "":
        raise HTTPException(status_code=400, detail="Reason is required")
    
    # Validate that to_datetime is after from_datetime
    if to_datetime <= from_datetime:
        raise HTTPException(status_code=400, detail="To datetime must be after From datetime")

    # Validate From Time between 09:30 and 17:30 (same logic as frontend Permission.jsx)
    from_minutes = from_datetime.hour * 60 + from_datetime.minute
    min_minutes = 9 * 60 + 30   # 09:30
    max_minutes = 17 * 60 + 30  # 17:30
    if from_minutes < min_minutes or from_minutes > max_minutes:
        raise HTTPException(status_code=400, detail="From Time must be between 09:30 and 17:30")

    # Duration validation: typically 2 hours (frontend auto-adds 2 hours). Allow up to 2 hours.
    duration_seconds = (to_datetime - from_datetime).total_seconds()
    if duration_seconds > 2 * 3600:
        raise HTTPException(status_code=400, detail="Permission duration must be within 2 hours")

    # Monthly limit: max 2 permissions per month (excluding rejected) - same as frontend logic
    perm_month = from_datetime.month
    perm_year = from_datetime.year
    monthly_count = db.query(Permission).filter(
        Permission.empid == current_user.empid,
        Permission.status != "rejected",
        extract("year", Permission.from_datetime) == perm_year,
        extract("month", Permission.from_datetime) == perm_month
    ).count()
    if monthly_count >= 2:
        raise HTTPException(
            status_code=400,
            detail=f"You can apply only 2 permissions per month. You have already applied {monthly_count} permission(s) for {from_datetime.strftime('%B %Y')}."
        )
    
    # Check for overlapping time slots on the same date (excluding rejected permissions)
    # Example: If user applied 2026-01-22 09:20 to 11:20, they cannot apply 2026-01-22 09:50 to 11:50
    from_date = from_datetime.date()
    to_date = to_datetime.date()
    
    # Get all existing permissions for this user on the same date(s), excluding rejected
    existing_permissions = db.query(Permission).filter(
        Permission.empid == current_user.empid,
        Permission.status != 'rejected'  # Exclude rejected permissions
    ).all()
    
    # Check for overlapping time slots
    for existing_perm in existing_permissions:
        existing_from_date = existing_perm.from_datetime.date()
        existing_to_date = existing_perm.to_datetime.date()
        
        # Check if dates overlap
        if from_date == existing_from_date or to_date == existing_to_date or \
           (from_date <= existing_to_date and to_date >= existing_from_date):
            # Check if time ranges overlap
            existing_from_time = existing_perm.from_datetime
            existing_to_time = existing_perm.to_datetime
            
            # Time ranges overlap if: new_from < existing_to AND new_to > existing_from
            if from_datetime < existing_to_time and to_datetime > existing_from_time:
                existing_time_str = f"{existing_from_time.strftime('%Y-%m-%d %H:%M')} to {existing_to_time.strftime('%H:%M')}"
                new_time_str = f"{from_datetime.strftime('%Y-%m-%d %H:%M')} to {to_datetime.strftime('%H:%M')}"
                raise HTTPException(
                    status_code=400,
                    detail=f"Permission time slot overlaps with existing permission: {existing_time_str}. "
                           f"You cannot apply for {new_time_str} as the time slot is already applied (status: {existing_perm.status})."
                )
    
    new_permission = Permission(
        empid=current_user.empid,
        name=current_user.name,
        applied_date=get_ist_now(),
        from_datetime=from_datetime,
        to_datetime=to_datetime,
        type=permission_data.permission_type,
        reason=permission_data.reason,
        status='pending'
    )
    
    db.add(new_permission)
    db.commit()
    db.refresh(new_permission)
    
    # Send email to reporting manager if email_consent is true
    if current_user.report_to_id:
        manager = db.query(User).filter(User.empid == current_user.report_to_id).first()
        if manager and manager.email_consent and manager.email:
            try:
                send_permission_email_to_manager(
                    manager_email=manager.email,
                    manager_name=manager.name,
                    employee_name=current_user.name,
                    employee_empid=current_user.empid,
                    permission_type=permission_data.permission_type,
                    from_datetime=from_datetime.isoformat(),
                    to_datetime=to_datetime.isoformat(),
                    reason=permission_data.reason
                )
            except Exception as e:
                # Log error but don't fail the request
                print(f"Error sending permission email: {str(e)}")
    
    return {
        "message": "Permission request submitted successfully",
        "id": new_permission.id
    }

@router.get("/permissions/self")
def get_self_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get own permission requests"""
    # Limit to 500 records for performance
    permissions = db.query(Permission).filter(
        Permission.empid == current_user.empid
    ).order_by(Permission.applied_date.desc()).limit(500).all()
    
    # Batch load approvers to avoid N+1 queries
    approver_empids = {perm.approved_by for perm in permissions if perm.approved_by}
    approvers_map = {}
    if approver_empids:
        approvers = db.query(User).filter(User.empid.in_(approver_empids)).all()
        approvers_map = {approver.empid: approver.name for approver in approvers}
    
    result = []
    for perm in permissions:
        approved_by_name = None
        if perm.approved_by:
            approved_by_name = approvers_map.get(perm.approved_by, perm.approved_by)
        
        result.append({
            "id": perm.id,
            "empid": perm.empid,
            "name": perm.name,
            "applied_date": perm.applied_date.isoformat(),
            "from_datetime": perm.from_datetime.isoformat(),
            "to_datetime": perm.to_datetime.isoformat(),
            "type": perm.type,
            "reason": perm.reason,
            "status": perm.status,
            "approved_by": approved_by_name,
        })
    
    return result

@router.get("/permissions")
def get_all_permissions(
    filter: Optional[str] = "all",
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all permission requests"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = db.query(Permission)
    
    if employee_id:
        query = query.filter(Permission.empid == employee_id)
    
    if filter != "all":
        query = query.filter(Permission.status == filter)
    
    # Limit to 500 records for performance
    permissions = query.order_by(Permission.applied_date.desc()).limit(500).all()
    
    # Batch load approvers to avoid N+1 queries
    approver_empids = {perm.approved_by for perm in permissions if perm.approved_by}
    approvers_map = {}
    if approver_empids:
        approvers = db.query(User).filter(User.empid.in_(approver_empids)).all()
        approvers_map = {approver.empid: approver.name for approver in approvers}
    
    result = []
    for perm in permissions:
        approved_by_name = None
        if perm.approved_by:
            approved_by_name = approvers_map.get(perm.approved_by, perm.approved_by)
        
        result.append({
            "id": perm.id,
            "empid": perm.empid,
            "name": perm.name,
            "applied_date": perm.applied_date.isoformat(),
            "from_datetime": perm.from_datetime.isoformat(),
            "to_datetime": perm.to_datetime.isoformat(),
            "type": perm.type,
            "reason": perm.reason,
            "status": perm.status,
            "approved_by": approved_by_name,
        })
    
    return result

@router.put("/permissions/{permission_id}")
def update_permission_status(
    permission_id: int,
    status_data: PermissionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve or reject permission request"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    permission = db.query(Permission).filter(Permission.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission request not found")
    
    if status_data.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    permission.status = status_data.status
    permission.approved_by = current_user.empid
    
    # If approved, insert punch logs
    if status_data.status == "approved":
        # Extract date from from_datetime
        from_date = permission.from_datetime.date()
        to_date = permission.to_datetime.date()
        
        # Insert IN punch log for From Time
        punch_log_in = PunchLog(
            employee_id=permission.empid,
            employee_name=permission.name,
            date=from_date,
            punch_type='in',
            punch_time=permission.from_datetime,
            status='present'
        )
        db.add(punch_log_in)
        
        # Insert OUT punch log for To Time
        punch_log_out = PunchLog(
            employee_id=permission.empid,
            employee_name=permission.name,
            date=to_date,
            punch_type='out',
            punch_time=permission.to_datetime,
            status='present'
        )
        db.add(punch_log_out)
    
    db.commit()
    db.refresh(permission)
    
    return {
        "message": f"Permission request {status_data.status} successfully",
        "id": permission.id
    }


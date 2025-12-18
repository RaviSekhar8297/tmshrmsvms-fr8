from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db
from models import Permission, User
from routes.auth import get_current_user
from typing import Optional
from pydantic import BaseModel

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
    
    new_permission = Permission(
        empid=current_user.empid,
        name=current_user.name,
        applied_date=datetime.utcnow(),
        from_datetime=from_datetime,
        to_datetime=to_datetime,
        type=permission_data.permission_type,
        reason=permission_data.reason,
        status='pending'
    )
    
    db.add(new_permission)
    db.commit()
    db.refresh(new_permission)
    
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
    permissions = db.query(Permission).filter(
        Permission.empid == current_user.empid
    ).order_by(Permission.applied_date.desc()).all()
    
    return [
        {
            "id": perm.id,
            "empid": perm.empid,
            "name": perm.name,
            "applied_date": perm.applied_date.isoformat(),
            "from_datetime": perm.from_datetime.isoformat(),
            "to_datetime": perm.to_datetime.isoformat(),
            "type": perm.type,
            "reason": perm.reason,
            "status": perm.status,
            "approved_by": perm.approved_by,
        }
        for perm in permissions
    ]

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
    
    permissions = query.order_by(Permission.applied_date.desc()).all()
    
    return [
        {
            "id": perm.id,
            "empid": perm.empid,
            "name": perm.name,
            "applied_date": perm.applied_date.isoformat(),
            "from_datetime": perm.from_datetime.isoformat(),
            "to_datetime": perm.to_datetime.isoformat(),
            "type": perm.type,
            "reason": perm.reason,
            "status": perm.status,
            "approved_by": perm.approved_by,
        }
        for perm in permissions
    ]

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
    
    db.commit()
    db.refresh(permission)
    
    return {
        "message": f"Permission request {status_data.status} successfully",
        "id": permission.id
    }


from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract
from datetime import datetime, date
from database import get_db
from models import Holiday, User
from routes.auth import get_current_user
from typing import Optional, List, Dict
from pydantic import BaseModel
from utils import is_admin_or_hr
import json

router = APIRouter()

class HolidayPermission(BaseModel):
    branch_id: int
    branch_name: str

class HolidayPermissionUpdate(BaseModel):
    branch_id: int
    branch_name: str
    is_checked: bool

class HolidayCreate(BaseModel):
    name: str
    date: str
    description: Optional[str] = None
    holiday_permissions: Optional[List[Dict]] = None

@router.get("/holidays")
def get_holidays(
    year: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all holidays"""
    query = db.query(Holiday)
    
    if year:
        query = query.filter(extract('year', Holiday.date) == year)
    
    holidays = query.order_by(Holiday.date).all()
    
    return [
        {
            "id": holiday.id,
            "name": holiday.name,
            "date": holiday.date.isoformat(),
            "description": holiday.description,
            "holiday_permissions": holiday.holiday_permissions if holiday.holiday_permissions else []
        }
        for holiday in holidays
    ]

@router.post("/holidays")
def create_holiday(
    holiday_data: HolidayCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a holiday (Admin/HR only)"""
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        holiday_date = datetime.fromisoformat(holiday_data.date).date()
    except:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    new_holiday = Holiday(
        name=holiday_data.name,
        date=holiday_date,
        description=holiday_data.description,
        holiday_permissions=holiday_data.holiday_permissions if holiday_data.holiday_permissions else [],
        created_by=current_user.id
    )
    
    db.add(new_holiday)
    db.commit()
    db.refresh(new_holiday)
    
    return {
        "message": "Holiday created successfully",
        "id": new_holiday.id
    }

@router.put("/holidays/{holiday_id}")
def update_holiday(
    holiday_id: int,
    holiday_data: HolidayCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a holiday (Admin/HR only)"""
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    try:
        holiday_date = datetime.fromisoformat(holiday_data.date).date()
    except:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    holiday.name = holiday_data.name
    holiday.date = holiday_date
    holiday.description = holiday_data.description
    if holiday_data.holiday_permissions is not None:
        holiday.holiday_permissions = holiday_data.holiday_permissions
    
    db.commit()
    db.refresh(holiday)
    
    return {
        "message": "Holiday updated successfully",
        "id": holiday.id
    }

@router.delete("/holidays/{holiday_id}")
def delete_holiday(
    holiday_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a holiday (Admin/HR only)"""
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    db.delete(holiday)
    db.commit()
    
    return {"message": "Holiday deleted successfully"}

@router.put("/holidays/{holiday_id}/permissions")
def update_holiday_permissions(
    holiday_id: int,
    permission_data: HolidayPermissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update holiday permissions for a specific branch (Admin/HR only)"""
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Query the holiday - the frontend queue ensures sequential updates
    # but we still refresh to get latest state
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    # Get current permissions or initialize empty list
    # Make a copy to avoid mutating the original
    permissions = list(holiday.holiday_permissions) if holiday.holiday_permissions else []
    
    if permission_data.is_checked:
        # Add branch if not already present
        branch_exists = any(p.get('branch_id') == permission_data.branch_id for p in permissions)
        if not branch_exists:
            permissions.append({
                "branch_id": permission_data.branch_id,
                "branch_name": permission_data.branch_name
            })
    else:
        # Remove branch from permissions
        permissions = [p for p in permissions if p.get('branch_id') != permission_data.branch_id]
    
    holiday.holiday_permissions = permissions
    db.commit()
    db.refresh(holiday)
    
    return {
        "message": "Holiday permissions updated successfully",
        "holiday_permissions": holiday.holiday_permissions
    }


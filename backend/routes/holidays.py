from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import extract
from datetime import datetime, date
from database import get_db
from models import Holiday, User
from routes.auth import get_current_user
from typing import Optional
from pydantic import BaseModel
from utils import is_admin_or_hr

router = APIRouter()

class HolidayCreate(BaseModel):
    name: str
    date: str
    description: Optional[str] = None

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
            "description": holiday.description
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


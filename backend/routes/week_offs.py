from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, extract, or_
from datetime import datetime, date
from database import get_db
from models import User, WeekOffDate
from routes.auth import get_current_user
from utils import is_admin_or_hr
from typing import Optional
from pydantic import BaseModel

router = APIRouter()

class WeekOffCreate(BaseModel):
    employee_id: str
    day_of_week: str
    is_active: bool = True

@router.get("/week-offs")
def get_week_offs(
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get week-offs - returns date-based week offs as individual rows for table display"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # Get all week off dates - filter by current year only
        from datetime import date
        current_year = date.today().year
        
        query = db.query(WeekOffDate).filter(
            WeekOffDate.year == current_year
        )
        
        if employee_id:
            query = query.filter(
                or_(
                    WeekOffDate.employee_id == employee_id,
                    WeekOffDate.employee_id == "0"
                )
            )
        
        week_off_dates = query.order_by(WeekOffDate.date.desc(), WeekOffDate.employee_id).all()
        
        # Format each date as a row for the table
        result = []
        for wod in week_off_dates:
            weekday_display = wod.weekday.capitalize() if wod.weekday else "-"
            
            result.append({
                "id": wod.id,
                "employee_id": wod.employee_id,
                "employee_name": wod.employee_name,
                "day_of_week": weekday_display,
                "date": wod.date.isoformat(),
                "is_active": True,  # All date-based week offs are active
                "month": wod.month,
                "year": wod.year
            })
        
        return result
    except Exception as e:
        import traceback
        print(f"Error fetching week offs: {e}")
        traceback.print_exc()
        return []

@router.post("/week-offs")
def create_week_off(
    week_off_data: WeekOffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a week-off assignment (legacy - use /week-offs/dates instead)"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    raise HTTPException(status_code=410, detail="This endpoint is deprecated. Please use /week-offs/dates for date-based week offs")

# Date-based Week Offs
class WeekOffDateCreate(BaseModel):
    employee_id: str
    date: str

@router.get("/week-offs/dates")
def get_week_off_dates(
    employee_id: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get date-based week-offs"""
    try:
        query = db.query(WeekOffDate)
        
        if employee_id:
            # Include both specific employee and "All" (employee_id="0")
            query = query.filter(
                or_(
                    WeekOffDate.employee_id == employee_id,
                    WeekOffDate.employee_id == "0"
                )
            )
        
        if month and year:
            query = query.filter(
                and_(
                    WeekOffDate.month == month,
                    WeekOffDate.year == year
                )
            )
        
        week_off_dates = query.order_by(WeekOffDate.date).all()
        
        return [
            {
                "id": wod.id,
                "employee_id": wod.employee_id,
                "employee_name": wod.employee_name,
                "date": wod.date.isoformat(),
                "weekday": wod.weekday,
                "month": wod.month,
                "year": wod.year,
                "created_at": wod.created_at.isoformat() if wod.created_at else None
            }
            for wod in week_off_dates
        ]
    except Exception as e:
        # If table doesn't exist, return empty list
        import traceback
        print(f"Error fetching week off dates: {e}")
        traceback.print_exc()
        return []

@router.post("/week-offs/dates")
def create_week_off_date(
    week_off_data: WeekOffDateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a date-based week-off - Only HR can add"""
    if current_user.role != "HR":
        raise HTTPException(status_code=403, detail="Access denied - Only HR can add week-offs")
    
    try:
        # Parse date
        if 'T' in week_off_data.date:
            target_date = datetime.fromisoformat(week_off_data.date.split('T')[0]).date()
        else:
            target_date = datetime.fromisoformat(week_off_data.date).date()
    except Exception as e:
        print(f"Date parsing error: {e}, input: {week_off_data.date}")
        raise HTTPException(status_code=400, detail=f"Invalid date format: {week_off_data.date}")
    
    # Get weekday name (Python weekday: 0=Monday, 6=Sunday)
    weekday_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    weekday = weekday_names[target_date.weekday()]
    
    # Get employee info
    if week_off_data.employee_id == "0":
        employee_name = "All"
    else:
        employee = db.query(User).filter(User.empid == week_off_data.employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail=f"Employee not found: {week_off_data.employee_id}")
        employee_name = employee.name
    
    # Check if week-off date already exists
    try:
        existing = db.query(WeekOffDate).filter(
            and_(
                WeekOffDate.employee_id == week_off_data.employee_id,
                WeekOffDate.date == target_date
            )
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="Week off already exists for this date")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        # If table doesn't exist, we'll get an error here
        import traceback
        print(f"Error checking existing week off: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    # Create new
    try:
        week_off_date = WeekOffDate(
            employee_id=week_off_data.employee_id,
            employee_name=employee_name,
            date=target_date,
            weekday=weekday,
            month=target_date.month,
            year=target_date.year,
            created_by=current_user.id
        )
        db.add(week_off_date)
        db.commit()
        db.refresh(week_off_date)
        
        return {
            "id": week_off_date.id,
            "employee_id": week_off_date.employee_id,
            "employee_name": week_off_date.employee_name,
            "date": week_off_date.date.isoformat(),
            "weekday": week_off_date.weekday,
            "month": week_off_date.month,
            "year": week_off_date.year
        }
    except Exception as e:
        db.rollback()
        import traceback
        print(f"Error creating week off date: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create week off: {str(e)}")

@router.delete("/week-offs/dates")
def delete_week_off_date(
    employee_id: str,
    date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a date-based week-off - Only HR can delete"""
    if current_user.role != "HR":
        raise HTTPException(status_code=403, detail="Access denied - Only HR can delete week-offs")
    
    try:
        target_date = datetime.fromisoformat(date).date()
    except:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Find and delete
    week_off_date = db.query(WeekOffDate).filter(
        and_(
            WeekOffDate.employee_id == employee_id,
            WeekOffDate.date == target_date
        )
    ).first()
    
    if not week_off_date:
        raise HTTPException(status_code=404, detail="Week off date not found")
    
    db.delete(week_off_date)
    db.commit()
    
    return {"message": "Week off date deleted successfully"}


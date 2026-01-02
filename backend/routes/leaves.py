from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, extract
from datetime import datetime, date, timedelta
from database import get_db
from models import Leave, User, LeaveBalanceList, WeekOffDate, Holiday
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
    half_from: Optional[str] = None
    half_to: Optional[str] = None

class LeaveStatusUpdate(BaseModel):
    status: str

@router.get("/leaves/validate-dates")
def validate_leave_dates(
    from_date: str,
    to_date: str,
    leave_type: Optional[str] = None,
    half_from: Optional[str] = None,
    half_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validate leave dates: calculate actual working days and check for conflicts"""
    try:
        from_date_obj = datetime.fromisoformat(from_date).date()
        to_date_obj = datetime.fromisoformat(to_date).date()
    except:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Get week-off dates for this employee (including "All" employee_id="0")
    week_off_records = db.query(WeekOffDate).filter(
        and_(
            or_(
                WeekOffDate.employee_id == current_user.empid,
                WeekOffDate.employee_id == "0"
            ),
            WeekOffDate.date >= from_date_obj,
            WeekOffDate.date <= to_date_obj
        )
    ).all()
    week_off_dates = {wo.date for wo in week_off_records}
    
    # Get holidays in the date range
    holiday_records = db.query(Holiday).filter(
        and_(
            Holiday.date >= from_date_obj,
            Holiday.date <= to_date_obj
        )
    ).all()
    holiday_dates = {h.date for h in holiday_records}
    
    # Check for holidays and week-offs - only check from_date and to_date (not middle dates)
    invalid_dates = []
    
    # Only check if from_date is a week-off or holiday
    if from_date_obj in week_off_dates:
        invalid_dates.append({
            "date": from_date_obj.isoformat(),
            "reason": "week_off"
        })
    elif from_date_obj in holiday_dates:
        invalid_dates.append({
            "date": from_date_obj.isoformat(),
            "reason": "holiday"
        })
    
    # Only check if to_date is a week-off or holiday (and it's different from from_date)
    if to_date_obj != from_date_obj:
        if to_date_obj in week_off_dates:
            invalid_dates.append({
                "date": to_date_obj.isoformat(),
                "reason": "week_off"
            })
        elif to_date_obj in holiday_dates:
            invalid_dates.append({
                "date": to_date_obj.isoformat(),
                "reason": "holiday"
            })
    
    # Calculate actual working days (excluding week-offs and holidays)
    current_date = from_date_obj
    actual_days = 0.0
    excluded_dates = []
    
    # Check if it's same date
    is_same_date = (from_date_obj == to_date_obj)
    
    while current_date <= to_date_obj:
        if current_date not in week_off_dates and current_date not in holiday_dates:
            # Determine day count based on half day logic
            day_count = 1.0
            
            if is_same_date:
                # Same date logic
                if half_from and half_to:
                    if half_from == half_to:
                        # Same session (Morning-Morning or Evening-Evening) = 0.5
                        day_count = 0.5
                    else:
                        # Different session (Morning-Evening) = 1.0 (full day)
                        day_count = 1.0
            else:
                # Different dates logic
                if current_date == from_date_obj:
                    # First day
                    if half_from:
                        # Half day from specified = 0.5
                        day_count = 0.5
                    else:
                        # No half day from = 1.0
                        day_count = 1.0
                elif current_date == to_date_obj:
                    # Last day
                    if half_to:
                        # Half day to specified = 0.5
                        day_count = 0.5
                    else:
                        # No half day to = 1.0
                        day_count = 1.0
                else:
                    # Middle days = always 1.0
                    day_count = 1.0
            
            actual_days += day_count
        else:
            excluded_dates.append(current_date.isoformat())
        current_date += timedelta(days=1)
    
    # Check for existing leave applications
    # If leave_type is provided, check for same leave_type (excluding rejected)
    # If leave_type is not provided, check for any overlapping dates
    query_filter = [
            Leave.empid == current_user.empid,
            Leave.status != 'rejected',  # Allow re-application if rejected
            or_(
                and_(Leave.from_date <= to_date_obj, Leave.to_date >= from_date_obj)
            )
    ]
    
    # If leave_type is provided, also check for same leave_type
    if leave_type:
        query_filter.append(Leave.leave_type == leave_type)
    
    existing_leaves = db.query(Leave).filter(and_(*query_filter)).all()
    
    conflicting_dates = []
    for leave in existing_leaves:
        conflict_start = max(leave.from_date, from_date_obj)
        conflict_end = min(leave.to_date, to_date_obj)
        if conflict_start <= conflict_end:
            current_conflict = conflict_start
            while current_conflict <= conflict_end:
                conflicting_dates.append({
                    "date": current_conflict.isoformat(),
                    "leave_id": leave.id,
                    "status": leave.status,
                    "leave_type": leave.leave_type
                })
                current_conflict += timedelta(days=1)
    
    return {
        "actual_days": actual_days,
        "excluded_dates": excluded_dates,
        "conflicting_dates": conflicting_dates,
        "invalid_dates": invalid_dates,  # Week-offs and holidays
        "has_conflict": len(conflicting_dates) > 0,
        "has_invalid_dates": len(invalid_dates) > 0
    }

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
    
    # Get week-off dates and holidays
    week_off_records = db.query(WeekOffDate).filter(
        and_(
            or_(
                WeekOffDate.employee_id == current_user.empid,
                WeekOffDate.employee_id == "0"
            ),
            WeekOffDate.date >= from_date,
            WeekOffDate.date <= to_date
        )
    ).all()
    week_off_dates = {wo.date for wo in week_off_records}
    
    holiday_records = db.query(Holiday).filter(
        and_(
            Holiday.date >= from_date,
            Holiday.date <= to_date
        )
    ).all()
    holiday_dates = {h.date for h in holiday_records}
    
    # Check if from_date or to_date are week-offs or holidays (not middle dates)
    invalid_dates = []
    
    # Only check if from_date is a week-off or holiday
    if from_date in week_off_dates:
        invalid_dates.append(f"Week-off on {from_date.isoformat()}")
    elif from_date in holiday_dates:
        invalid_dates.append(f"Holiday on {from_date.isoformat()}")
    
    # Only check if to_date is a week-off or holiday (and it's different from from_date)
    if to_date != from_date:
        if to_date in week_off_dates:
            invalid_dates.append(f"Week-off on {to_date.isoformat()}")
        elif to_date in holiday_dates:
            invalid_dates.append(f"Holiday on {to_date.isoformat()}")
    
    if invalid_dates:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot apply leave on week-offs or holidays: {', '.join(invalid_dates)}"
        )
    
    # Calculate actual working days (excluding week-offs and holidays)
    current_date = from_date
    actual_days = 0
    while current_date <= to_date:
        if current_date not in week_off_dates and current_date not in holiday_dates:
            actual_days += 1
        current_date += timedelta(days=1)
    
    # Check for existing leave applications of the same leave_type (excluding rejected)
    # If there's a pending or approved leave for the same leave_type, don't allow
    existing_leaves = db.query(Leave).filter(
        and_(
            Leave.empid == current_user.empid,
            Leave.leave_type == leave_data.leave_type,  # Same leave type
            Leave.status != 'rejected',  # Allow re-application if rejected
            or_(
                and_(Leave.from_date <= to_date, Leave.to_date >= from_date)
            )
        )
    ).all()
    
    if existing_leaves:
        statuses = [leave.status for leave in existing_leaves]
        if 'pending' in statuses or 'approved' in statuses:
            raise HTTPException(
                status_code=400, 
                detail=f"You already have a {leave_data.leave_type} leave (pending or approved) for some of these dates. Please wait for approval/rejection or select different dates."
            )
    
    # Use calculated duration
    duration = leave_data.duration if leave_data.duration else actual_days
    
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
        # half_from and half_to will be added after migration
        # half_from=leave_data.half_from,
        # half_to=leave_data.half_to
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
    
    result = []
    for leave in leaves:
        try:
            result.append({
                "id": leave.id,
                "empid": leave.empid,
                "employee_id": leave.empid,
                "name": leave.name,
                "employee_name": leave.name,
                "applied_date": leave.applied_date.isoformat() if leave.applied_date else None,
                "from_date": leave.from_date.isoformat() if leave.from_date else None,
                "to_date": leave.to_date.isoformat() if leave.to_date else None,
                "duration": leave.duration,
                "leave_type": leave.leave_type,
                "report_to": leave.report_to,
                "reason": leave.reason,
                "status": leave.status,
                "approved_by": leave.approved_by,
                "approved_date": leave.approved_date.isoformat() if leave.approved_date else None,
                "half_from": None,  # Will be populated after migration
                "half_to": None  # Will be populated after migration
            })
        except Exception as e:
            print(f"Error processing leave {leave.id}: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    return result

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
    # HR and Admin can see all leaves (no additional filter)
    
    if filter != "all":
        query = query.filter(Leave.status == filter)
    
    leaves = query.order_by(Leave.applied_date.desc()).all()
    
    result = []
    for leave in leaves:
        try:
            result.append({
                "id": leave.id,
                "empid": leave.empid,
                "employee_id": leave.empid,
                "name": leave.name,
                "employee_name": leave.name,
                "applied_date": leave.applied_date.isoformat() if leave.applied_date else None,
                "from_date": leave.from_date.isoformat() if leave.from_date else None,
                "to_date": leave.to_date.isoformat() if leave.to_date else None,
                "duration": leave.duration,
                "leave_type": leave.leave_type,
                "report_to": leave.report_to,
                "reason": leave.reason,
                "status": leave.status,
                "approved_by": leave.approved_by,
                "approved_date": leave.approved_date.isoformat() if leave.approved_date else None,
                "half_from": None,  # Will be populated after migration
                "half_to": None  # Will be populated after migration
            })
        except Exception as e:
            print(f"Error processing leave {leave.id}: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    return result

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

@router.delete("/leaves/{leave_id}")
def delete_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a leave request - only if status is pending"""
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    # Only the owner can delete their own leave
    if str(leave.empid).strip() != str(current_user.empid).strip():
        raise HTTPException(status_code=403, detail="You can only delete your own leave requests")
    
    # Cannot delete approved or rejected leaves
    if leave.status in ["approved", "rejected"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete {leave.status} leave. Only pending leaves can be deleted."
        )
    
    db.delete(leave)
    db.commit()
    
    return {
        "message": "Leave request deleted successfully",
        "id": leave_id
    }

@router.get("/leaves/balance")
def get_leave_balance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get leave balance for current user from leave_balance_list table and calculate this month availability"""
    # Get current year and month
    current_year = date.today().year
    current_month = date.today().month
    
    # Convert empid to integer if it's numeric, otherwise use user.id
    try:
        empid_value = int(current_user.empid) if current_user.empid and str(current_user.empid).isdigit() else current_user.id
    except:
        empid_value = current_user.id
    
    # Get leave balance from leave_balance_list table
    leave_balance = db.query(LeaveBalanceList).filter(
        LeaveBalanceList.empid == empid_value,
        LeaveBalanceList.year == current_year
    ).first()
    
    # Calculate this month's availability
    # Casual and Comp-Off can be forwarded (use balance from leave_balance_list)
    # Sick cannot be forwarded (only current month's balance)
    
    if leave_balance:
        # Casual: use balance (can be forwarded from previous months)
        casual_this_month = float(leave_balance.balance_casual_leaves) if leave_balance.balance_casual_leaves else 0
        
        # Comp-Off: use balance (can be forwarded from previous months)
        comp_off_this_month = float(leave_balance.balance_comp_off_leaves) if leave_balance.balance_comp_off_leaves else 0
        
        # Sick: cannot be forwarded, so only current month
        # Get approved sick leaves for current month
        current_month_sick_leaves = db.query(Leave).filter(
            Leave.empid == current_user.empid,
            Leave.status == 'approved',
            extract('year', Leave.from_date) == current_year,
            extract('month', Leave.from_date) == current_month,
            Leave.leave_type == 'sick'
        ).all()
        
        # Count days used in current month for sick leaves
        sick_used_this_month = sum((leave.to_date - leave.from_date).days + 1 for leave in current_month_sick_leaves)
        
        # Sick: 1 per month, minus used this month
        sick_this_month = max(0, 1 - sick_used_this_month)
    else:
        casual_this_month = 0
        sick_this_month = 0
        comp_off_this_month = 0
    
    if leave_balance:
        return {
            "total_casual_leaves": float(leave_balance.total_casual_leaves) if leave_balance.total_casual_leaves else 0,
            "used_casual_leaves": float(leave_balance.used_casual_leaves) if leave_balance.used_casual_leaves else 0,
            "balance_casual_leaves": float(leave_balance.balance_casual_leaves) if leave_balance.balance_casual_leaves else 0,
            "total_sick_leaves": float(leave_balance.total_sick_leaves) if leave_balance.total_sick_leaves else 0,
            "used_sick_leaves": float(leave_balance.used_sick_leaves) if leave_balance.used_sick_leaves else 0,
            "balance_sick_leaves": float(leave_balance.balance_sick_leaves) if leave_balance.balance_sick_leaves else 0,
            "total_comp_off_leaves": float(leave_balance.total_comp_off_leaves) if leave_balance.total_comp_off_leaves else 0,
            "used_comp_off_leaves": float(leave_balance.used_comp_off_leaves) if leave_balance.used_comp_off_leaves else 0,
            "balance_comp_off_leaves": float(leave_balance.balance_comp_off_leaves) if leave_balance.balance_comp_off_leaves else 0,
            "this_month": {
                "casual": max(0, casual_this_month),
                "sick": max(0, sick_this_month),
                "comp_off": max(0, comp_off_this_month)
            }
        }
    else:
        # Return default values if no record found
        return {
            "total_casual_leaves": 0,
            "used_casual_leaves": 0,
            "balance_casual_leaves": 0,
            "total_sick_leaves": 0,
            "used_sick_leaves": 0,
            "balance_sick_leaves": 0,
            "total_comp_off_leaves": 0,
            "used_comp_off_leaves": 0,
            "balance_comp_off_leaves": 0,
            "this_month": {
                "casual": 0,
                "sick": 0,
                "comp_off": 0
            }
        }
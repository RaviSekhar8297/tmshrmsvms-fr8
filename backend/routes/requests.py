from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, date
from database import get_db
from models import Request, User, PunchLog, LeaveBalanceList, WeekOffDate, Holiday
from routes.auth import get_current_user
from typing import Optional
from pydantic import BaseModel
from decimal import Decimal
from utils.email_service import send_request_email_to_manager
from utils import get_ist_now

router = APIRouter()

class RequestCreate(BaseModel):
    type: str
    subject: str
    description: str
    intime: Optional[str] = None
    outtime: Optional[str] = None

class RequestStatusUpdate(BaseModel):
    status: str

@router.post("/requests")
def create_request(
    request_data: RequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a request"""
    intime = None
    outtime = None
    
    if request_data.intime:
        try:
            intime = datetime.fromisoformat(request_data.intime.replace('Z', '+00:00'))
        except:
            pass
    
    if request_data.outtime:
        try:
            outtime = datetime.fromisoformat(request_data.outtime.replace('Z', '+00:00'))
        except:
            pass

    allowed_types = {"full-day", "in-time", "out-time", "overtime-comp-off"}
    if request_data.type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid request type")

    if not request_data.subject or request_data.subject.strip() == "":
        raise HTTPException(status_code=400, detail="Subject is required")

    if not request_data.description or request_data.description.strip() == "":
        raise HTTPException(status_code=400, detail="Description is required")

    # Validate required datetime fields based on request type
    if request_data.type in {"full-day", "in-time", "overtime-comp-off"} and not intime:
        raise HTTPException(status_code=400, detail="In time is required for this request type")

    if request_data.type in {"full-day", "out-time", "overtime-comp-off"} and not outtime:
        raise HTTPException(status_code=400, detail="Out time is required for this request type")

    # Determine request date (used for duplicate and overtime validation)
    request_date: Optional[date] = (intime.date() if intime else (outtime.date() if outtime else None))
    if not request_date:
        raise HTTPException(status_code=400, detail="Request date could not be determined")

    # Basic ordering validation when both are present
    if intime and outtime and outtime <= intime:
        raise HTTPException(status_code=400, detail="Out time must be after In time")

    # For overtime-comp-off: allow only Week-Off or Holiday dates (same rule as Requests.jsx dropdown)
    if request_data.type == "overtime-comp-off":
        # Week off check (employee-specific or global employee_id="0")
        is_week_off = db.query(WeekOffDate).filter(
            WeekOffDate.date == request_date,
            WeekOffDate.employee_id.in_([str(current_user.empid), "0"])
        ).first() is not None

        # Holiday check - filter by branch_id via holiday_permissions
        user_branch_id = current_user.branch_id if current_user.branch_id else 1
        holiday_records = db.query(Holiday).filter(Holiday.date == request_date).all()
        is_holiday = False
        for holiday in holiday_records:
            if not holiday.holiday_permissions or len(holiday.holiday_permissions) == 0:
                continue
            if any(perm.get("branch_id") == user_branch_id for perm in holiday.holiday_permissions):
                is_holiday = True
                break

        if not (is_week_off or is_holiday):
            raise HTTPException(
                status_code=400,
                detail="Over-Time(Comp-off) request can be applied only on Week-Off or Holiday dates"
            )

    # Duplicate rule: only one pending/approved request per date (any type)
    existing_request = db.query(Request).filter(
        Request.empid == current_user.empid,
        Request.status.in_(["pending", "approved"]),
        func.date(func.coalesce(Request.intime, Request.outtime)) == request_date
    ).first()

    if existing_request:
        raise HTTPException(
            status_code=400,
            detail=(
                f"This date already applied for {existing_request.type} on {request_date.strftime('%Y-%m-%d')}. "
                f"Status: {existing_request.status}"
            )
        )
    
    new_request = Request(
        empid=current_user.empid,
        name=current_user.name,
        applied_date=get_ist_now(),
        type=request_data.type,
        subject=request_data.subject,
        description=request_data.description,
        intime=intime,
        outtime=outtime,
        status='pending'
    )
    
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    
    # Send email to reporting manager if email_consent is true
    if current_user.report_to_id:
        manager = db.query(User).filter(User.empid == current_user.report_to_id).first()
        if manager and manager.email_consent and manager.email:
            try:
                intime_str = intime.isoformat() if intime else None
                outtime_str = outtime.isoformat() if outtime else None
                send_request_email_to_manager(
                    manager_email=manager.email,
                    manager_name=manager.name,
                    employee_name=current_user.name,
                    employee_empid=current_user.empid,
                    request_type=request_data.type,
                    subject_text=request_data.subject,
                    description=request_data.description,
                    intime=intime_str,
                    outtime=outtime_str
                )
            except Exception as e:
                # Log error but don't fail the request
                print(f"Error sending request email: {str(e)}")
    
    return {
        "message": "Request submitted successfully",
        "id": new_request.id
    }

@router.get("/requests/self")
def get_self_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get own requests"""
    # Limit to 500 records for performance
    requests = db.query(Request).filter(
        Request.empid == current_user.empid
    ).order_by(Request.applied_date.desc()).limit(500).all()
    
    # Batch load approvers to avoid N+1 queries
    approver_empids = {req.approved_by for req in requests if req.approved_by}
    approvers_map = {}
    if approver_empids:
        approvers = db.query(User).filter(User.empid.in_(approver_empids)).all()
        approvers_map = {approver.empid: approver.name for approver in approvers}
    
    result = []
    for req in requests:
        approved_by_name = None
        if req.approved_by:
            approved_by_name = approvers_map.get(req.approved_by, req.approved_by)
        
        result.append({
            "id": req.id,
            "empid": req.empid,
            "name": req.name,
            "applied_date": req.applied_date.isoformat(),
            "type": req.type,
            "subject": req.subject,
            "description": req.description,
            "intime": req.intime.isoformat() if req.intime else None,
            "outtime": req.outtime.isoformat() if req.outtime else None,
            "status": req.status,
            "approved_by": approved_by_name,
        })
    
    return result

@router.get("/requests")
def get_all_requests(
    filter: Optional[str] = "all",
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all requests"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = db.query(Request)
    
    if employee_id:
        query = query.filter(Request.empid == employee_id)
    
    if filter != "all":
        query = query.filter(Request.status == filter)
    
    # Limit to 500 records for performance
    requests = query.order_by(Request.applied_date.desc()).limit(500).all()
    
    # Batch load approvers to avoid N+1 queries
    approver_empids = {req.approved_by for req in requests if req.approved_by}
    approvers_map = {}
    if approver_empids:
        approvers = db.query(User).filter(User.empid.in_(approver_empids)).all()
        approvers_map = {approver.empid: approver.name for approver in approvers}
    
    result = []
    for req in requests:
        approved_by_name = None
        if req.approved_by:
            approved_by_name = approvers_map.get(req.approved_by, req.approved_by)
        
        result.append({
            "id": req.id,
            "empid": req.empid,
            "name": req.name,
            "applied_date": req.applied_date.isoformat(),
            "type": req.type,
            "subject": req.subject,
            "description": req.description,
            "intime": req.intime.isoformat() if req.intime else None,
            "outtime": req.outtime.isoformat() if req.outtime else None,
            "status": req.status,
            "approved_by": approved_by_name,
        })
    
    return result

@router.put("/requests/{request_id}")
def update_request_status(
    request_id: int,
    status_data: RequestStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve or reject request"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if status_data.status not in ["approved", "rejected", "completed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    request.status = status_data.status
    request.approved_by = current_user.empid
    
    # If approved, insert punch logs and handle comp-off for overtime-comp-off
    if status_data.status == "approved":
        # Insert IN punch log for In Time (if exists)
        if request.intime:
            intime_date = request.intime.date()
            punch_log_in = PunchLog(
                employee_id=request.empid,
                employee_name=request.name,
                date=intime_date,
                punch_type='in',
                punch_time=request.intime,
                status='present',
                remarks='Request Entry'
            )
            db.add(punch_log_in)
        
        # Insert OUT punch log for Out Time (if exists)
        if request.outtime:
            outtime_date = request.outtime.date()
            punch_log_out = PunchLog(
                employee_id=request.empid,
                employee_name=request.name,
                date=outtime_date,
                punch_type='out',
                punch_time=request.outtime,
                status='present',
                remarks='Request Entry'
            )
            db.add(punch_log_out)
        
        # Handle comp-off calculation and leave balance update for overtime-comp-off
        if request.type == 'overtime-comp-off' and request.intime and request.outtime:
            # Calculate hours between outtime and intime
            time_diff = request.outtime - request.intime
            total_seconds = time_diff.total_seconds()
            hours = total_seconds / 3600.0
            
            # Determine comp-off value
            if hours >= 8.0:
                comp_off_value = Decimal('1.0')
            elif hours >= 4.0:
                comp_off_value = Decimal('0.5')
            else:
                comp_off_value = Decimal('0.0')
            
            # Update leave_balance_list if comp_off_value > 0
            if comp_off_value > 0:
                try:
                    # Get current year
                    current_year = get_ist_now().year
                    
                    # Try to find existing leave balance record
                    leave_balance = db.query(LeaveBalanceList).filter(
                        LeaveBalanceList.empid == int(request.empid),
                        LeaveBalanceList.year == current_year
                    ).first()
                    
                    if leave_balance:
                        # Update existing record
                        current_total = Decimal(str(leave_balance.total_comp_off_leaves)) if leave_balance.total_comp_off_leaves else Decimal('0')
                        current_balance = Decimal(str(leave_balance.balance_comp_off_leaves)) if leave_balance.balance_comp_off_leaves else Decimal('0')
                        
                        leave_balance.total_comp_off_leaves = current_total + comp_off_value
                        leave_balance.balance_comp_off_leaves = current_balance + comp_off_value
                        leave_balance.updated_by = current_user.empid
                        leave_balance.updated_date = get_ist_now()
                    else:
                        # Create new record if empid exists (check if user exists)
                        user = db.query(User).filter(User.empid == request.empid).first()
                        if user:
                            new_leave_balance = LeaveBalanceList(
                                empid=int(request.empid),
                                name=request.name,
                                year=current_year,
                                total_comp_off_leaves=comp_off_value,
                                used_comp_off_leaves=Decimal('0'),
                                balance_comp_off_leaves=comp_off_value,
                                updated_by=current_user.empid,
                                updated_date=get_ist_now()
                            )
                            db.add(new_leave_balance)
                except Exception as e:
                    # Log error but don't fail the request approval
                    print(f"Error updating comp-off leave balance: {e}")
                    pass
    
    db.commit()
    db.refresh(request)
    
    return {
        "message": f"Request {status_data.status} successfully",
        "id": request.id
    }


from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from database import get_db
from models import Request, User, PunchLog, LeaveBalanceList
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
    
    # Check for duplicate requests (same date, same type, not rejected)
    if intime:
        intime_date = intime.date()
        existing_request = db.query(Request).filter(
            Request.empid == current_user.empid,
            Request.type == request_data.type,
            Request.status.in_(['pending', 'approved']),
            func.date(Request.intime) == intime_date
        ).first()
        
        if existing_request:
            raise HTTPException(
                status_code=400, 
                detail=f"You have already applied for {request_data.type} on {intime_date.strftime('%Y-%m-%d')} with status: {existing_request.status}"
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
    requests = db.query(Request).filter(
        Request.empid == current_user.empid
    ).order_by(Request.applied_date.desc()).all()
    
    result = []
    for req in requests:
        approved_by_name = None
        if req.approved_by:
            approver = db.query(User).filter(User.empid == req.approved_by).first()
            approved_by_name = approver.name if approver else req.approved_by
        
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
    
    requests = query.order_by(Request.applied_date.desc()).all()
    
    result = []
    for req in requests:
        approved_by_name = None
        if req.approved_by:
            approver = db.query(User).filter(User.empid == req.approved_by).first()
            approved_by_name = approver.name if approver else req.approved_by
        
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


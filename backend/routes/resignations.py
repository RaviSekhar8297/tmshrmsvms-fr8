from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from datetime import datetime, date, timedelta
from database import get_db
from models import Resignation, User
from routes.auth import get_current_user
from typing import Optional, List
from schemas import ResignationCreate, ResignationResponse, ResignationApproval, NoticePeriodInfoResponse
from decimal import Decimal

router = APIRouter()

def calculate_notice_period(doj: Optional[date], applied_date: date) -> int:
    """Calculate notice period: 15 days if in probation (less than 6 months), else 60 days"""
    if not doj:
        return 60  # Default to 60 days if no DOJ
    
    # Calculate days since joining
    days_since_joining = (applied_date - doj).days
    
    # Probation period is typically 6 months (180 days)
    if days_since_joining < 180:
        return 15  # Probation period: 15 days notice
    else:
        return 60  # Regular: 60 days (2 months) notice

def get_next_approver(role: str, manager_status: str, hr_status: str, hod_status: str) -> Optional[str]:
    """Determine the next approver based on role and current status"""
    if role == 'Employee':
        if manager_status == 'Pending':
            return 'Manager'
        elif manager_status == 'Approved' and hr_status == 'Pending':
            return 'HR'
        elif hr_status == 'Approved' and hod_status == 'Pending':
            return 'HOD'
    elif role == 'Manager':
        if hr_status == 'Pending':
            return 'HR'
        elif hr_status == 'Approved' and hod_status == 'Pending':
            return 'HOD'
    elif role == 'HR':
        if hod_status == 'Pending':
            return 'HOD'
    
    return None

@router.post("/resignations")
def create_resignation(
    resignation_data: ResignationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a resignation application"""
    try:
        # Check if user already has a pending resignation
        existing = db.query(Resignation).filter(
            and_(
                Resignation.empid == current_user.empid,
                Resignation.withdrawal_date.is_(None),
                or_(
                    Resignation.manager_status == 'Pending',
                    Resignation.hr_status == 'Pending',
                    Resignation.hod_status == 'Pending',
                    Resignation.hr_status == 'Approved',
                    Resignation.hod_status == 'Approved'
                )
            )
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail="You already have a pending resignation. Please wait for approval or withdraw the existing one."
            )
        
        # Calculate notice period
        notice_period = calculate_notice_period(current_user.doj, date.today())
        
        # Use user-provided requested_date or calculate it (resign_date + notice_period)
        if resignation_data.requested_date:
            requested_date = resignation_data.requested_date
            # Validate that requested_date is after resign_date
            if requested_date <= resignation_data.resign_date:
                raise HTTPException(
                    status_code=400,
                    detail="Requested date (last working date) must be after the resignation date"
                )
        else:
            # Auto-calculate if not provided
            requested_date = resignation_data.resign_date + timedelta(days=notice_period)
        
        last_working_date = requested_date  # Initially same as requested_date
        
        # Determine initial status based on role
        # New workflow: Employee → Manager → HOD → HR
        manager_status = 'Pending'
        hod_status = 'Pending'
        hr_status = 'Pending'
        
        if current_user.role == 'Manager':
            manager_status = 'Approved'  # Skip manager approval
        elif current_user.role == 'HR':
            manager_status = 'Approved'
            hod_status = 'Approved'
            hr_status = 'Approved'  # Skip all approvals
        elif current_user.role == 'Admin':
            manager_status = 'Approved'
            hod_status = 'Approved'  # Skip manager and HOD approval
        
        resignation = Resignation(
            empid=current_user.empid,
            name=current_user.name,
            applied_date=date.today(),
            resign_date=resignation_data.resign_date,
            requested_date=requested_date,  # Set requested_date as last working date
            last_working_date=last_working_date,
            notice_period_days=notice_period,
            reason=resignation_data.reason,
            resignation_type=resignation_data.resignation_type,
            manager_status=manager_status,
            hod_status=hod_status,
            hr_status=hr_status,
            department=current_user.department_name,
            position=current_user.designation
        )
        
        db.add(resignation)
        db.commit()
        db.refresh(resignation)
        
        return {
            "message": "Resignation applied successfully",
            "resignation": {
                "id": resignation.id,
                "notice_period_days": notice_period,
                "requested_date": requested_date.isoformat(),
                "last_working_date": last_working_date.isoformat()
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating resignation: {str(e)}")

@router.get("/resignations/self")
def get_own_resignation(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get own resignation application"""
    try:
        resignation = db.query(Resignation).filter(
            and_(
                Resignation.empid == current_user.empid,
                Resignation.withdrawal_date.is_(None)
            )
        ).order_by(desc(Resignation.created_at)).first()
        
        if not resignation:
            return None
        
        return ResignationResponse.model_validate(resignation)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching resignation: {str(e)}")

@router.get("/resignations")
def get_all_resignations(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all resignations (for Manager, HR, and Admin)"""
    if current_user.role not in ['Manager', 'HR', 'Admin']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = db.query(Resignation).filter(
        Resignation.withdrawal_date.is_(None)
    )
    
    # For Managers: Only show resignations of employees who report to them
    if current_user.role == 'Manager':
        # Get all employee IDs who report to this manager
        direct_report_empids = db.query(User.empid).filter(
            User.report_to_id == current_user.empid
        ).all()
        empid_list = [emp.empid for emp in direct_report_empids]
        
        # Filter resignations to only those employees
        if empid_list:
            query = query.filter(Resignation.empid.in_(empid_list))
        else:
            # If no direct reports, return empty list
            return []
    
    # Filter by status if provided
    if status:
        if status == 'pending':
            query = query.filter(
                or_(
                    Resignation.manager_status == 'Pending',
                    Resignation.hr_status == 'Pending',
                    Resignation.hod_status == 'Pending'
                )
            )
        elif status == 'approved':
            query = query.filter(
                and_(
                    or_(
                        Resignation.manager_status == 'Approved',
                        Resignation.manager_status == 'Pending'  # Manager might not be needed
                    ),
                    Resignation.hr_status == 'Approved',
                    Resignation.hod_status == 'Approved'
                )
            )
        elif status == 'rejected':
            query = query.filter(
                or_(
                    Resignation.manager_status == 'Rejected',
                    Resignation.hr_status == 'Rejected',
                    Resignation.hod_status == 'Rejected'
                )
            )
    
    resignations = query.order_by(desc(Resignation.created_at)).all()
    
    return [ResignationResponse.from_orm(r) for r in resignations]

@router.get("/resignations/notice-period-info", status_code=200)
def get_notice_period_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get notice period information for current user"""
    try:
        # Calculate notice period (handles None doj)
        notice_period = calculate_notice_period(current_user.doj, date.today())
        
        # Initialize default values
        is_probation = False
        days_since_joining = None
        doj_str = None
        
        # Calculate days since joining if DOJ exists
        if current_user.doj:
            try:
                days_since_joining = (date.today() - current_user.doj).days
                is_probation = days_since_joining < 180
                doj_str = current_user.doj.isoformat()
            except Exception as e:
                # If date calculation fails, use defaults
                days_since_joining = None
                is_probation = False
                doj_str = None
        
        # Return plain dict - FastAPI will serialize it automatically
        result = {
            "notice_period_days": int(notice_period),
            "is_probation": bool(is_probation),
            "doj": doj_str if doj_str else None,
            "days_since_joining": int(days_since_joining) if days_since_joining is not None else None
        }
        
        return result
        
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        print(f"Error in get_notice_period_info: {e}")
        traceback.print_exc()
        # Return a safe default response
        return {
            "notice_period_days": 60,
            "is_probation": False,
            "doj": None,
            "days_since_joining": None
        }

@router.get("/resignations/{resignation_id}")
def get_resignation(
    resignation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific resignation"""
    resignation = db.query(Resignation).filter(Resignation.id == resignation_id).first()
    
    if not resignation:
        raise HTTPException(status_code=404, detail="Resignation not found")
    
    # Check access: own resignation or Manager/HR/Admin
    if resignation.empid != current_user.empid and current_user.role not in ['Manager', 'HR', 'Admin']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return ResignationResponse.model_validate(resignation)

@router.post("/resignations/{resignation_id}/approve-manager")
def approve_manager(
    resignation_id: int,
    approval_data: ResignationApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manager approval"""
    if current_user.role != 'Manager':
        raise HTTPException(status_code=403, detail="Only managers can approve")
    
    resignation = db.query(Resignation).filter(Resignation.id == resignation_id).first()
    
    if not resignation:
        raise HTTPException(status_code=404, detail="Resignation not found")
    
    # Check if employee reports to this manager
    employee = db.query(User).filter(User.empid == resignation.empid).first()
    if not employee or employee.report_to_id != current_user.empid:
        raise HTTPException(status_code=403, detail="You can only approve resignations of your direct reports")
    
    if resignation.manager_status != 'Pending':
        raise HTTPException(status_code=400, detail="Manager approval already processed")
    
    if approval_data.status not in ['Approved', 'Rejected']:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    resignation.manager_status = approval_data.status
    resignation.manager_approval_date = date.today() if approval_data.status in ['Approved', 'Rejected'] else None
    resignation.manager_comments = approval_data.comments
    
    db.commit()
    
    return {"message": f"Resignation {approval_data.status.lower()} by manager"}

@router.post("/resignations/{resignation_id}/approve-hod")
def approve_hod(
    resignation_id: int,
    approval_data: ResignationApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """HOD (Admin) approval - Step 2 after Manager"""
    if current_user.role != 'Admin':
        raise HTTPException(status_code=403, detail="Only Admin (HOD) can approve")
    
    resignation = db.query(Resignation).filter(Resignation.id == resignation_id).first()
    
    if not resignation:
        raise HTTPException(status_code=404, detail="Resignation not found")
    
    # Check if manager approved first (for employees/managers)
    employee = db.query(User).filter(User.empid == resignation.empid).first()
    if employee and employee.role in ['Employee', 'Manager']:
        if resignation.manager_status != 'Approved':
            raise HTTPException(status_code=400, detail="Manager approval required first")
    
    if resignation.hod_status != 'Pending':
        raise HTTPException(status_code=400, detail="HOD approval already processed")
    
    if approval_data.status not in ['Approved', 'Rejected']:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    resignation.hod_status = approval_data.status
    resignation.hod_approval_date = date.today() if approval_data.status in ['Approved', 'Rejected'] else None
    resignation.hod_comments = approval_data.comments
    
    db.commit()
    
    return {"message": f"Resignation {approval_data.status.lower()} by HOD"}

@router.post("/resignations/{resignation_id}/approve-hr")
def approve_hr(
    resignation_id: int,
    approval_data: ResignationApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """HR approval - Step 3 after HOD"""
    if current_user.role != 'HR':
        raise HTTPException(status_code=403, detail="Only HR can approve")
    
    resignation = db.query(Resignation).filter(Resignation.id == resignation_id).first()
    
    if not resignation:
        raise HTTPException(status_code=404, detail="Resignation not found")
    
    # Check if HOD approved first (new workflow: Manager → HOD → HR)
    employee = db.query(User).filter(User.empid == resignation.empid).first()
    if employee and employee.role in ['Employee', 'Manager']:
        if resignation.manager_status != 'Approved':
            raise HTTPException(status_code=400, detail="Manager approval required first")
        if resignation.hod_status != 'Approved':
            raise HTTPException(status_code=400, detail="HOD approval required first")
    
    if resignation.hr_status != 'Pending':
        raise HTTPException(status_code=400, detail="HR approval already processed")
    
    if approval_data.status not in ['Approved', 'Rejected', 'Processed']:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    resignation.hr_status = approval_data.status
    resignation.hr_approval_date = date.today() if approval_data.status in ['Approved', 'Rejected', 'Processed'] else None
    resignation.hr_comments = approval_data.comments
    
    db.commit()
    
    return {"message": f"Resignation {approval_data.status.lower()} by HR"}


@router.post("/resignations/{resignation_id}/withdraw")
def withdraw_resignation(
    resignation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Withdraw resignation (only if not fully approved)"""
    resignation = db.query(Resignation).filter(Resignation.id == resignation_id).first()
    
    if not resignation:
        raise HTTPException(status_code=404, detail="Resignation not found")
    
    if resignation.empid != current_user.empid:
        raise HTTPException(status_code=403, detail="You can only withdraw your own resignation")
    
    if resignation.withdrawal_date:
        raise HTTPException(status_code=400, detail="Resignation already withdrawn")
    
    # Check if fully approved (all approvals done)
    employee = db.query(User).filter(User.empid == resignation.empid).first()
    if employee:
        if employee.role == 'Employee':
            if (resignation.manager_status == 'Approved' and 
                resignation.hr_status == 'Approved' and 
                resignation.hod_status == 'Approved'):
                raise HTTPException(status_code=400, detail="Cannot withdraw fully approved resignation")
        elif employee.role == 'Manager':
            if (resignation.hr_status == 'Approved' and 
                resignation.hod_status == 'Approved'):
                raise HTTPException(status_code=400, detail="Cannot withdraw fully approved resignation")
        elif employee.role == 'HR':
            if resignation.hod_status == 'Approved':
                raise HTTPException(status_code=400, detail="Cannot withdraw fully approved resignation")
    
    resignation.withdrawal_date = date.today()
    db.commit()
    
    return {"message": "Resignation withdrawn successfully"}


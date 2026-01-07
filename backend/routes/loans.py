from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from datetime import datetime, date, timedelta
from utils import get_ist_now
from database import get_db
from models import EmployeeLoan, LoanInstallment, User, PayslipData
from routes.auth import get_current_user
from typing import Optional, List
from pydantic import BaseModel
from decimal import Decimal

router = APIRouter(prefix="/loans", tags=["Loans"])

# Request/Response Models
class LoanApplyRequest(BaseModel):
    loan_type: str
    loan_amount: float
    tenure_months: int
    approval_remarks: Optional[str] = None
    from_month: Optional[int] = None  # Optional: month to start deduction (1-12)
    from_year: Optional[int] = None   # Optional: year to start deduction

class LoanResponse(BaseModel):
    loan_id: int
    empid: str
    loan_type: Optional[str]
    loan_amount: Decimal
    tenure_months: int
    manager_status: dict
    hr_status: dict
    accounts_status: dict
    approval_remarks: Optional[str]
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class InstallmentResponse(BaseModel):
    installment_id: int
    loan_id: int
    empid: str
    installments: dict
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.post("/apply", response_model=LoanResponse)
def apply_for_loan(
    request: LoanApplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Apply for a new loan"""
    try:
        # Check if user has active loan
        active_loan = db.query(EmployeeLoan).filter(
            and_(
                EmployeeLoan.empid == current_user.empid,
                EmployeeLoan.status.in_(['APPLIED', 'APPROVED', 'ACTIVE'])
            )
        ).first()
        
        if active_loan:
            raise HTTPException(
                status_code=400,
                detail="You have an active loan. Please clear it before applying for a new one."
            )
        
        # Check if user cleared a loan within last 6 months
        six_months_ago = date.today() - timedelta(days=180)
        recent_cleared_loan = db.query(EmployeeLoan).filter(
            and_(
                EmployeeLoan.empid == current_user.empid,
                EmployeeLoan.status == 'CLEARED',
                func.date(EmployeeLoan.created_at) >= six_months_ago
            )
        ).first()
        
        if recent_cleared_loan:
            raise HTTPException(
                status_code=400,
                detail="You can apply for a new loan only after 6 months of clearing your previous loan."
            )
        
        # Check DOJ - must be at least 1 year old
        if not current_user.doj:
            raise HTTPException(
                status_code=400,
                detail="Date of joining not found. Please contact HR."
            )
        
        doj = current_user.doj
        one_year_from_doj = date(doj.year + 1, doj.month, doj.day)
        if date.today() < one_year_from_doj:
            days_remaining = (one_year_from_doj - date.today()).days
            raise HTTPException(
                status_code=400,
                detail=f"You must complete 1 year of service. Wait for {days_remaining} more days."
            )
        
        # Check loan amount against total of last 3 months earned_gross
        current_month = date.today().month
        current_year = date.today().year
        
        # Get last 3 months payslip data
        payslip_data = []
        try:
            emp_id_int = int(current_user.empid)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="Invalid employee ID format."
            )
        
        # Check for payslips in last 3 months (including current month)
        for i in range(3):
            month = current_month - i
            year = current_year
            if month <= 0:
                month += 12
                year -= 1
            
            payslip = db.query(PayslipData).filter(
                and_(
                    PayslipData.emp_id == emp_id_int,
                    PayslipData.month == month,
                    PayslipData.year == year,
                    PayslipData.freaze_status == True  # Only check frozen (finalized) payslips
                )
            ).first()
            
            if payslip and payslip.earned_gross:
                payslip_data.append(float(payslip.earned_gross))
        
        if len(payslip_data) < 3:
            # Provide more helpful error message
            months_checked = []
            for i in range(3):
                month = current_month - i
                year = current_year
                if month <= 0:
                    month += 12
                    year -= 1
                months_checked.append(f"{month}/{year}")
            
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient payslip data. Need 3 months of frozen (finalized) payslip data. Checked months: {', '.join(months_checked)}. Found: {len(payslip_data)} months. Please ensure payslips are generated and frozen for the last 3 months."
            )
        
        total_earned_gross = sum(payslip_data)
        if request.loan_amount > total_earned_gross:
            raise HTTPException(
                status_code=400,
                detail=f"Loan amount cannot exceed ₹{total_earned_gross:,.2f} (Total of last 3 months earned gross)."
            )
        
        # Validate tenure
        if request.tenure_months < 5 or request.tenure_months > 24:
            raise HTTPException(
                status_code=400,
                detail="Tenure must be between 5 and 24 months."
            )
        
        # Create loan application
        new_loan = EmployeeLoan(
            empid=current_user.empid,
            loan_type=request.loan_type,
            loan_amount=Decimal(str(request.loan_amount)),
            tenure_months=request.tenure_months,
            manager_status={"status": "PENDING", "approved_name": None, "approved_time": None},
            hr_status={"status": "PENDING", "approved_name": None, "approved_time": None},
            accounts_status={"status": "PENDING", "approved_name": None, "approved_time": None},
            approval_remarks=request.approval_remarks,
            status="APPLIED",
            created_at=get_ist_now()
        )
        
        db.add(new_loan)
        db.commit()
        db.refresh(new_loan)
        
        # Generate installments if from_month and from_year are provided
        if request.from_month and request.from_year:
            installments_list = []
            loan_amount_per_installment = Decimal(str(request.loan_amount)) / Decimal(str(request.tenure_months))
            
            # Calculate installments
            current_month = request.from_month
            current_year = request.from_year
            
            for installment_num in range(1, request.tenure_months + 1):
                # Calculate due date (first day of each month)
                due_date = date(current_year, current_month, 1)
                
                installments_list.append({
                    "installment_number": installment_num,
                    "due_date": due_date.isoformat(),
                    "amount": float(loan_amount_per_installment),
                    "status": "PENDING",
                    "paid_date": None
                })
                
                # Move to next month
                current_month += 1
                if current_month > 12:
                    current_month = 1
                    current_year += 1
            
            # Create loan installments record
            loan_installment = LoanInstallment(
                loan_id=new_loan.loan_id,
                empid=current_user.empid,
                installments=installments_list,
                created_at=get_ist_now()
            )
            
            db.add(loan_installment)
            db.commit()
        
        return new_loan
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error applying for loan: {str(e)}")

@router.get("/applied", response_model=List[LoanResponse])
def get_applied_loans(
    empid: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get applied loans for an employee"""
    try:
        # If empid is provided and user is Admin/HR/Manager, allow querying other employees
        query_empid = empid if empid and current_user.role in ['Admin', 'HR', 'Manager'] else current_user.empid
        
        loans = db.query(EmployeeLoan).filter(
            EmployeeLoan.empid == query_empid
        ).order_by(EmployeeLoan.created_at.desc()).all()
        
        return loans
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching applied loans: {str(e)}")

@router.get("/active")
def check_active_loan(
    empid: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if employee has an active loan"""
    try:
        query_empid = empid if empid and current_user.role in ['Admin', 'HR', 'Manager'] else current_user.empid
        
        active_loan = db.query(EmployeeLoan).filter(
            and_(
                EmployeeLoan.empid == query_empid,
                EmployeeLoan.status.in_(['APPLIED', 'APPROVED', 'ACTIVE'])
            )
        ).first()
        
        return {
            "has_active_loan": active_loan is not None,
            "loan": active_loan if active_loan else None
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking active loan: {str(e)}")

@router.get("/cleared-recent")
def get_recently_cleared_loan(
    empid: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get recently cleared loan (within last 6 months)"""
    try:
        query_empid = empid if empid and current_user.role in ['Admin', 'HR', 'Manager'] else current_user.empid
        
        six_months_ago = date.today() - timedelta(days=180)
        
        cleared_loan = db.query(EmployeeLoan).filter(
            and_(
                EmployeeLoan.empid == query_empid,
                EmployeeLoan.status == 'CLEARED',
                func.date(EmployeeLoan.created_at) >= six_months_ago
            )
        ).order_by(EmployeeLoan.created_at.desc()).first()
        
        return {
            "has_recent_cleared_loan": cleared_loan is not None,
            "loan": cleared_loan if cleared_loan else None
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking cleared loan: {str(e)}")

@router.get("/installments")
def get_loan_installments(
    empid: Optional[str] = None,
    loan_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get loan installments for an employee"""
    try:
        query_empid = empid if empid and current_user.role in ['Admin', 'HR', 'Manager'] else current_user.empid
        
        query = db.query(LoanInstallment).filter(
            LoanInstallment.empid == query_empid
        )
        
        if loan_id:
            query = query.filter(LoanInstallment.loan_id == loan_id)
        
        installments = query.order_by(LoanInstallment.created_at.desc()).all()
        
        # Convert to dict format to handle JSONB serialization properly
        result = []
        for inst in installments:
            # Get user info
            user = db.query(User).filter(User.empid == inst.empid).first()
            
            # Get loan info for loan amount
            loan = db.query(EmployeeLoan).filter(EmployeeLoan.loan_id == inst.loan_id).first()
            
            result.append({
                "installment_id": inst.installment_id,
                "loan_id": inst.loan_id,
                "empid": inst.empid,
                "installments": inst.installments if inst.installments else [],
                "created_at": inst.created_at.isoformat() if inst.created_at else None,
                "user_name": user.name if user else None,
                "user_image": user.image_base64 if user else None,
                "loan_amount": float(loan.loan_amount) if loan and loan.loan_amount else 0
            })
        
        return result
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching loan installments: {str(e)}")

@router.get("/eligibility")
def check_loan_eligibility(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check loan eligibility for current user"""
    try:
        eligibility = {
            "one_year_service": {"eligible": False, "message": ""},
            "average_salary": {"eligible": False, "message": "", "max_amount": 0},
            "no_active_loan": {"eligible": False, "message": ""},
            "six_months_after_clearance": {"eligible": False, "message": ""}
        }
        
        # Check DOJ
        if not current_user.doj:
            eligibility["one_year_service"]["message"] = "Date of joining not found"
        else:
            doj = current_user.doj
            one_year_from_doj = date(doj.year + 1, doj.month, doj.day)
            if date.today() >= one_year_from_doj:
                eligibility["one_year_service"]["eligible"] = True
                eligibility["one_year_service"]["message"] = "Completed 1 year of service"
            else:
                days_remaining = (one_year_from_doj - date.today()).days
                days_from_doj = (date.today() - doj).days
                eligibility["one_year_service"]["message"] = f"Wait for {days_remaining} days (Current date - DOJ date = {days_from_doj} days, need 365 days total)"
        
        # Check total salary (last 3 months)
        current_month = date.today().month
        current_year = date.today().year
        payslip_data = []
        
        for i in range(3):
            month = current_month - i
            year = current_year
            if month <= 0:
                month += 12
                year -= 1
            
            try:
                emp_id_int = int(current_user.empid)
            except (ValueError, TypeError):
                continue
            
            payslip = db.query(PayslipData).filter(
                and_(
                    PayslipData.emp_id == emp_id_int,
                    PayslipData.month == month,
                    PayslipData.year == year,
                    PayslipData.freaze_status == True  # Only check frozen (finalized) payslips
                )
            ).first()
            
            if payslip and payslip.earned_gross:
                payslip_data.append({
                    "month": month,
                    "year": year,
                    "earned_gross": float(payslip.earned_gross)
                })
        
        if len(payslip_data) >= 3:
            total = sum(p["earned_gross"] for p in payslip_data)
            eligibility["average_salary"]["eligible"] = True
            eligibility["average_salary"]["max_amount"] = total
            eligibility["average_salary"]["message"] = f"Eligible loan amount: ₹{total:,.2f} (Total of last 3 months earned gross)"
        else:
            eligibility["average_salary"]["message"] = f"Insufficient payslip data. Need 3 months of payslip data (Found: {len(payslip_data)} months)"
        
        # Check active loan
        active_loan = db.query(EmployeeLoan).filter(
            and_(
                EmployeeLoan.empid == current_user.empid,
                EmployeeLoan.status.in_(['APPLIED', 'APPROVED', 'ACTIVE'])
            )
        ).first()
        
        if active_loan:
            eligibility["no_active_loan"]["message"] = "You have an active loan. Please clear it before applying for a new one."
        else:
            eligibility["no_active_loan"]["eligible"] = True
            eligibility["no_active_loan"]["message"] = "No active loan found"
        
        # Check cleared loan within 6 months
        six_months_ago = date.today() - timedelta(days=180)
        cleared_loan = db.query(EmployeeLoan).filter(
            and_(
                EmployeeLoan.empid == current_user.empid,
                EmployeeLoan.status == 'CLEARED',
                func.date(EmployeeLoan.created_at) >= six_months_ago
            )
        ).order_by(EmployeeLoan.created_at.desc()).first()
        
        if cleared_loan:
            cleared_date = cleared_loan.created_at.date() if isinstance(cleared_loan.created_at, datetime) else cleared_loan.created_at
            six_months_after = date(cleared_date.year, cleared_date.month, cleared_date.day) + timedelta(days=180)
            if date.today() >= six_months_after:
                eligibility["six_months_after_clearance"]["eligible"] = True
                eligibility["six_months_after_clearance"]["message"] = "6 months have passed since last loan clearance"
            else:
                days_remaining = (six_months_after - date.today()).days
                days_since_clearance = (date.today() - cleared_date).days
                eligibility["six_months_after_clearance"]["message"] = f"Wait for {days_remaining} days (Days since clearance: {days_since_clearance} days, need 180 days total)"
        else:
            eligibility["six_months_after_clearance"]["eligible"] = True
            eligibility["six_months_after_clearance"]["message"] = "No recent loan clearance found"
        
        return eligibility
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking eligibility: {str(e)}")

class LoanApprovalRequest(BaseModel):
    status: str  # "APPROVED" or "REJECTED"
    remarks: Optional[str] = None

@router.put("/{loan_id}/manager-approve")
def approve_reject_loan_manager(
    loan_id: int,
    approval_data: LoanApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manager approve or reject loan"""
    if current_user.role not in ['Manager', 'Admin']:
        raise HTTPException(status_code=403, detail="Access denied. Manager role required.")
    
    loan = db.query(EmployeeLoan).filter(EmployeeLoan.loan_id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    # Check if employee reports to this manager
    employee = db.query(User).filter(User.empid == loan.empid).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    if current_user.role == 'Manager' and employee.report_to_id != current_user.empid:
        raise HTTPException(status_code=403, detail="You can only approve loans for employees under you")
    
    if approval_data.status not in ['APPROVED', 'REJECTED']:
        raise HTTPException(status_code=400, detail="Status must be APPROVED or REJECTED")
    
    # Update manager status
    loan.manager_status = {
        "status": approval_data.status,
        "approved_name": current_user.name,
        "approved_time": get_ist_now().isoformat()
    }
    
    if approval_data.remarks:
        loan.approval_remarks = approval_data.remarks
    
    db.commit()
    db.refresh(loan)
    
    return {
        "message": f"Loan {approval_data.status.lower()} by manager",
        "loan": loan
    }

@router.put("/{loan_id}/hr-approve")
def approve_reject_loan_hr(
    loan_id: int,
    approval_data: LoanApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """HR approve or reject loan (only after manager approval)"""
    if current_user.role not in ['HR', 'Admin']:
        raise HTTPException(status_code=403, detail="Access denied. HR role required.")
    
    loan = db.query(EmployeeLoan).filter(EmployeeLoan.loan_id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    # Check if manager has approved
    manager_status = loan.manager_status or {}
    if manager_status.get('status') != 'APPROVED':
        raise HTTPException(
            status_code=400, 
            detail="Manager approval is required before HR can approve/reject"
        )
    
    if approval_data.status not in ['APPROVED', 'REJECTED']:
        raise HTTPException(status_code=400, detail="Status must be APPROVED or REJECTED")
    
    # Update HR status
    loan.hr_status = {
        "status": approval_data.status,
        "approved_name": current_user.name,
        "approved_time": get_ist_now().isoformat()
    }
    
    if approval_data.remarks:
        loan.approval_remarks = approval_data.remarks
    
    # Update overall status if HR approves
    if approval_data.status == 'APPROVED':
        loan.status = 'APPROVED'
    
    db.commit()
    db.refresh(loan)
    
    return {
        "message": f"Loan {approval_data.status.lower()} by HR",
        "loan": loan
    }


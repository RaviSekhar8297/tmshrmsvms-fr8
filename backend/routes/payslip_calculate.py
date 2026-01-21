from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import and_, or_, cast, String
from datetime import datetime, date
from utils import get_ist_now
from decimal import Decimal, ROUND_HALF_UP
from database import get_db
from models import (
    User, SalaryStructure, AttendanceList, PayslipData, 
    Company, Branch, Department, LoanInstallment
)
from routes.auth import get_current_user
from typing import Optional
from pydantic import BaseModel
import json

router = APIRouter()

class PayslipCalculationRequest(BaseModel):
    company_id: Optional[int] = None
    branch_id: Optional[int] = None
    department_id: Optional[int] = None
    employee_id: Optional[str] = None
    month: int
    year: int

# Special employee groups (from C# code)
BALAJI_DINESH_GROUP = {1197, 1234}
ELEVEN_MEMBERS_GROUP = {1270, 1271, 1272, 1273, 1274, 1275, 1276, 1278, 1279, 1283, 1285}
DEVI_VENKANNA_GROUP = {1254, 1263}

def calculate_professional_tax(earned_gross: Decimal) -> Decimal:
    """Calculate Professional Tax based on earned gross"""
    if earned_gross <= 15000:
        return Decimal(0)
    elif earned_gross <= 20000:
        return Decimal(150)
    else:
        return Decimal(200)

def get_late_count(late_logs: int) -> Decimal:
    """Convert late logs count to decimal (1 late log = 1 day deduction)"""
    return Decimal(late_logs) if late_logs else Decimal(0)

def round_decimal(value: Decimal, places: int = 0) -> Decimal:
    """Round decimal with midpoint rounding away from zero"""
    if places == 0:
        return value.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    else:
        multiplier = Decimal(10) ** places
        return (value * multiplier).quantize(Decimal('1'), rounding=ROUND_HALF_UP) / multiplier

def calculate_salary_for_employee(
    db: Session,
    user: User,
    salary_structure: SalaryStructure,
    attendance_list: AttendanceList,
    month: int,
    year: int
) -> Optional[PayslipData]:
    """
    Calculate salary for a single employee based on C# logic
    """
    try:
        # Convert empid to int for group checking
        try:
            emp_id_int = int(user.empid) if user.empid else 0
        except:
            emp_id_int = 0
        
        # Check special groups
        is_balaji_dinesh = emp_id_int in BALAJI_DINESH_GROUP
        is_eleven_members = emp_id_int in ELEVEN_MEMBERS_GROUP
        is_devi_venkanna = emp_id_int in DEVI_VENKANNA_GROUP
        is_any_special = is_balaji_dinesh or is_eleven_members or is_devi_venkanna
        
        # Get values from attendance_list and salary_structure
        total_days = Decimal(str(attendance_list.total_days)) if attendance_list.total_days else Decimal(1)
        payable_days = Decimal(str(attendance_list.payble_days)) if attendance_list.payble_days else Decimal(0)
        monthly_gross_salary = Decimal(str(salary_structure.salary_per_month)) if salary_structure.salary_per_month else Decimal(0)
        basic_from_db = Decimal(str(salary_structure.basic)) if salary_structure.basic else Decimal(0)
        pf_check = salary_structure.pf_check if salary_structure.pf_check is not None else 1
        esi_check = salary_structure.esi_check if salary_structure.esi_check is not None else 1
        late_logs = attendance_list.late_logs if attendance_list.late_logs else 0
        lops = Decimal(str(attendance_list.lops)) if attendance_list.lops else Decimal(0)
        
        # Safety guards
        if total_days <= 0:
            total_days = Decimal(1)
        if payable_days < 0:
            payable_days = Decimal(0)
        
        # 1) Gross & EarnedGross
        per_day_gross_salary = round_decimal(monthly_gross_salary / total_days, 2) if total_days > 0 else Decimal(0)
        gross_salary = monthly_gross_salary
        earned_gross = round_decimal((gross_salary / total_days) * payable_days, 0)
        
        # 2) Monthly Basic Base (DB override if Basic > 0 else branch rules)
        monthly_basic_base = Decimal(0)
        if basic_from_db > 0:
            monthly_basic_base = basic_from_db
        else:
            if is_balaji_dinesh or is_eleven_members or is_devi_venkanna:
                monthly_basic_base = Decimal(15000)
            else:
                # Remaining people splits
                if gross_salary < 20000:
                    monthly_basic_base = Decimal(13500)
                elif gross_salary >= 20000 and gross_salary <= 30000:
                    monthly_basic_base = Decimal(15000)
                else:
                    monthly_basic_base = round_decimal(gross_salary * Decimal(0.50), 2)
        
        # 3) Final/prorated Basic
        final_basic = round_decimal((monthly_basic_base / total_days) * payable_days, 0)
        
        # 4) HRA selection and computation
        hra_percent = Decimal(0)
        
        if is_balaji_dinesh or is_eleven_members:
            # IF(Gross>30001,50%,IF(Gross<=21001,15%,10%))
            if gross_salary > 30001:
                hra_percent = Decimal(0.50)
            elif gross_salary <= 21001:
                hra_percent = Decimal(0.15)
            else:
                hra_percent = Decimal(0.10)
        elif is_devi_venkanna:
            # IF(Gross>30001,50%,ELSE 10%)
            if gross_salary > 30001:
                hra_percent = Decimal(0.50)
            else:
                hra_percent = Decimal(0.10)
        else:
            # REMAINING PEOPLE: updated HRA logic
            if gross_salary <= 20000:
                if gross_salary <= 21001:
                    hra_percent = Decimal(0.15)
                else:
                    hra_percent = Decimal(0.10)
            else:
                if gross_salary > 30001:
                    hra_percent = Decimal(0.50)
                elif gross_salary <= 21001:
                    hra_percent = Decimal(0.40)
                else:
                    hra_percent = Decimal(0.30)
        
        # Compute finalHRA - double-prorate on finalBasic
        final_hra = round_decimal(((final_basic * hra_percent) / total_days) * payable_days, 0)
        
        # 5) MA & CA
        monthly_ma = Decimal(1250) if gross_salary > 25001 else Decimal(0)
        monthly_ca = Decimal(1600) if gross_salary > 25001 else Decimal(0)
        final_ma = round_decimal((monthly_ma / total_days) * payable_days, 0)
        final_ca = round_decimal((monthly_ca / total_days) * payable_days, 0)
        
        # 6) SA
        final_sa = round_decimal(earned_gross - (final_basic + final_hra + final_ma + final_ca), 0)
        
        # 7) PF
        final_pf = Decimal(0)
        if pf_check == 1:
            if final_basic >= 15000:
                final_pf = Decimal(1800)
            else:
                final_pf = round_decimal(final_basic * Decimal(0.12), 0)
        
        # 8) ESI
        final_esi = Decimal(0)
        if esi_check == 1:
            if gross_salary > 21000:
                final_esi = Decimal(0)
            else:
                final_esi = round_decimal(earned_gross * Decimal(0.0075), 0)
        
        # 9) Professional Tax
        final_pt = calculate_professional_tax(earned_gross)
        
        # 10) Late & LOP
        late_days = Decimal(late_logs)
        late_deduction_total = round_decimal(late_days * per_day_gross_salary, 0)
        lop_deduction = round_decimal(lops * per_day_gross_salary, 0)
        
        # 11) Calculate LWF (Labor Welfare Fund): 2 rupees only for December month, 0 for other months
        lwf_amount = Decimal(2.0) if month == 12 else Decimal(0.0)
        
        # 12) Totals
        pf_esi_pt_ll_ld = round_decimal(final_pf + final_esi + final_pt + late_deduction_total + lop_deduction, 0)
        total_earnings = round_decimal(final_basic + final_hra + final_ma + final_ca + final_sa, 0)
        
        # 13) TDS & Loan
        tds_tax_amount = Decimal(0)
        monthly_tds_amount = round_decimal(tds_tax_amount / Decimal(12), 0) if tds_tax_amount > 0 else Decimal(0)
        loan_amount = Decimal(0)
        clear_amount = Decimal(0)
        pay_amount = Decimal(0)
        
        # Net Salary calculation - Match C# code exactly: NetSalary = totalEarnings - (finalpf + finalesi + finalpt + monthlyTDSAmount) - PayAmount
        # Note: LOP and Late deductions are stored in database but NOT deducted from net salary in C# code
        # LWF (2 rupees for December) is added to deductions and deducted from net salary
        net_salary = round_decimal(
            total_earnings - (final_pf + final_esi + final_pt + monthly_tds_amount + lwf_amount) - pay_amount, 
            0
        )
        
        # 13) Loan Installment Deduction
        # Check for loan installments matching the payroll month/year
        loan_installment_deduction = Decimal(0)
        try:
            print(f"  Checking loan installments for {user.empid}, month={month}, year={year}")
            
            # Query loan installments for this employee
            loan_installment_records = db.query(LoanInstallment).filter(
                LoanInstallment.empid == user.empid
            ).all()
            
            print(f"  Found {len(loan_installment_records)} loan installment record(s) for {user.empid}")
            
            # Process each loan installment record
            for loan_inst_record in loan_installment_records:
                if not loan_inst_record.installments:
                    print(f"  No installments found in record loan_id={loan_inst_record.loan_id}")
                    continue
                
                # Parse installments JSONB (should be a list)
                installments_list = loan_inst_record.installments
                if isinstance(installments_list, str):
                    installments_list = json.loads(installments_list)
                
                if not isinstance(installments_list, list):
                    print(f"  Installments is not a list for loan_id={loan_inst_record.loan_id}")
                    continue
                
                print(f"  Processing {len(installments_list)} installments for loan_id={loan_inst_record.loan_id}")
                
                # Find installments matching the payroll month/year
                updated_installments = []
                installment_updated = False
                
                for installment in installments_list:
                    if not isinstance(installment, dict):
                        updated_installments.append(installment)
                        continue
                    
                    due_date_str = installment.get('due_date')
                    installment_status = installment.get('status', '').upper()
                    installment_amount = Decimal(str(installment.get('amount', 0)))
                    installment_number = installment.get('installment_number', 'N/A')
                    
                    print(f"    Installment #{installment_number}: due_date={due_date_str}, status={installment_status}, amount={installment_amount}")
                    
                    # Skip if already paid (status is "Success")
                    if installment_status == 'SUCCESS':
                        print(f"    Installment #{installment_number} already paid, skipping")
                        updated_installments.append(installment)
                        continue
                    
                    # Check if due_date matches payroll month/year
                    if due_date_str:
                        try:
                            # Parse due_date (format: "2025-12-01" or "2025-12-01T00:00:00")
                            if 'T' in due_date_str:
                                due_date = datetime.fromisoformat(due_date_str.replace('Z', '+00:00')).date()
                            else:
                                due_date = datetime.strptime(due_date_str, '%Y-%m-%d').date()
                            
                            print(f"    Parsed due_date: {due_date} (month={due_date.month}, year={due_date.year})")
                            print(f"    Comparing with payroll: month={month}, year={year}")
                            
                            # Match month and year
                            if due_date.month == month and due_date.year == year:
                                print(f"    ✓ Date matches! Checking net salary: {net_salary} >= {installment_amount}")
                                
                                # Check if net salary is sufficient for deduction
                                if net_salary >= installment_amount:
                                    # Deduct from net salary
                                    loan_installment_deduction += installment_amount
                                    net_salary = round_decimal(net_salary - installment_amount, 0)
                                    
                                    # Update installment status and paid_date
                                    installment['status'] = 'Success'
                                    # Set paid_date to current date and time (ISO format)
                                    installment['paid_date'] = get_ist_now().isoformat()
                                    installment_updated = True
                                    
                                    print(f"    ✓✓✓ Updated installment #{installment_number}: status=Success, paid_date={installment['paid_date']}")
                                    print(f"    ✓✓✓ Loan installment deducted: Amount={installment_amount}, Net Salary After={net_salary}")
                                else:
                                    # Skip deduction if net salary is less than installment amount
                                    print(f"    ✗ Skipping deduction: Amount={installment_amount} > Net Salary={net_salary}")
                            else:
                                print(f"    ✗ Date does not match payroll month/year")
                        except Exception as e:
                            print(f"    ✗ Error parsing due_date '{due_date_str}': {str(e)}")
                            import traceback
                            traceback.print_exc()
                    else:
                        print(f"    ✗ No due_date found for installment #{installment_number}")
                    
                    updated_installments.append(installment)
                
                # Update the loan installment record if any installment was updated
                if installment_updated:
                    loan_inst_record.installments = updated_installments
                    # IMPORTANT: Flag the JSONB field as modified so SQLAlchemy detects the change
                    flag_modified(loan_inst_record, 'installments')
                    db.add(loan_inst_record)
                    
                    # Count how many installments were marked as Success
                    success_count = len([i for i in updated_installments if isinstance(i, dict) and i.get('status') == 'Success'])
                    print(f"  ✓✓✓ Updated loan installments for {user.empid}, loan_id={loan_inst_record.loan_id}")
                    print(f"  ✓✓✓ {success_count} installment(s) marked as Success with paid_date")
                else:
                    print(f"  No installments updated for loan_id={loan_inst_record.loan_id}")
        
        except Exception as e:
            print(f"  ✗✗✗ Error processing loan installments for {user.empid}: {str(e)}")
            import traceback
            traceback.print_exc()
        
        # Update loan_amount with total deduction
        loan_amount = loan_installment_deduction
        if loan_amount > 0:
            print(f"  Total loan deduction for {user.empid}: {loan_amount}")
        
        # Get bank details from user.bank_details JSONB
        bank_name = None
        bank_acc_no = None
        ifsc_code = None
        pan_no = None
        pf_no = None
        esi_no = None
        
        if user.bank_details:
            bank_data = user.bank_details if isinstance(user.bank_details, dict) else json.loads(user.bank_details) if isinstance(user.bank_details, str) else {}
            
            # Extract bank details, handle null/empty values
            bank_name = bank_data.get('bank_name') or None
            if bank_name and isinstance(bank_name, str) and bank_name.strip() == "":
                bank_name = None
                
            bank_acc_no = bank_data.get('account_number') or None
            if bank_acc_no and isinstance(bank_acc_no, str) and bank_acc_no.strip() == "":
                bank_acc_no = None
                
            ifsc_code = bank_data.get('ifsc') or None
            if ifsc_code and isinstance(ifsc_code, str) and ifsc_code.strip() == "":
                ifsc_code = None
                
            pan_no = bank_data.get('pan') or None
            if pan_no and isinstance(pan_no, str) and pan_no.strip() == "":
                pan_no = None
                
            pf_no = bank_data.get('pf_no') or None
            if pf_no and isinstance(pf_no, str) and pf_no.strip() == "":
                pf_no = None
                
            esi_no = bank_data.get('esi_no') or None
            if esi_no and isinstance(esi_no, str) and esi_no.strip() == "":
                esi_no = None
        
        # Prepare earnings JSONB
        earnings = {
            "GrossSalary": float(gross_salary),
            "Basic": float(final_basic),
            "HRA": float(final_hra),
            "CA": float(final_ca),
            "MA": float(final_ma),
            "SA": float(final_sa)
        }
        
        # Prepare deductions JSONB (LWF already calculated above)
        deductions = {
            "PF": float(final_pf),
            "ESI": float(final_esi),
            "LateLogins": float(late_deduction_total),
            "TDS": float(monthly_tds_amount),
            "LateLogDeduction": float(late_deduction_total),
            "PT": float(final_pt),
            "LOP": float(lop_deduction),
            "Loan": float(loan_amount),
            "LWF": float(lwf_amount) if month == 12 else 0.0
        }
        
        # Calculate salary_per_annum (monthly * 12)
        salary_per_annum = round_decimal(monthly_gross_salary * Decimal(12), 2)
        
        # Create payslip data
        payslip_data = PayslipData(
            full_name=user.name or "",
            emp_id=emp_id_int if emp_id_int > 0 else 0,
            doj=user.doj or salary_structure.doj,
            company_name=user.company_name or "",
            company_id=user.company_id,
            branch_name=user.branch_name or "",
            branch_id=user.branch_id,
            department_name=user.department_name or "",
            dept_id=user.department_id,
            designation=user.designation or "",
            bank_name=bank_name,
            bank_acc_no=bank_acc_no,
            ifsc_code=ifsc_code,
            pan_no=pan_no,
            salary_per_annum=salary_per_annum,
            salary_per_month=salary_structure.salary_per_month,
            salary_per_day=per_day_gross_salary,
            earnings=earnings,
            deductions=deductions,
            net_salary=net_salary,
            month=month,
            year=year,
            total_days=int(total_days),
            working_days=attendance_list.working_days,
            present=attendance_list.presents,
            absent=attendance_list.absents,
            half_days=attendance_list.half_days,
            holidays=attendance_list.holi_days,
            wo=attendance_list.week_offs,
            leaves=(attendance_list.cl or Decimal(0)) + (attendance_list.sl or Decimal(0)),
            payable_days=payable_days,
            retention_bonus=salary_structure.retension_bonus or Decimal(0),
            variable_pay=salary_structure.variable_pay or Decimal(0),
            lop_deduction=lop_deduction,
            arrear_salary=Decimal(0),
            advance_salary=Decimal(0),
            loan_amount=loan_amount,
            clear_amount=Decimal(0),
            pay_amount=Decimal(0),
            pf_no=pf_no,
            esi_no=esi_no,
            earned_gross=earned_gross,
            other_deduction=Decimal(0),
            freaze_status=False,
            created_date=date.today(),
            created_by=user.empid
        )
        
        return payslip_data
        
    except Exception as e:
        print(f"Error calculating salary for employee {user.empid}: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

@router.post("/payslip/generate")
def generate_payslips(
    request_data: PayslipCalculationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate payslips for employees based on filters:
    - company_id: All employees in company
    - branch_id: All employees in branch
    - department_id: All employees in department
    - employee_id: Single employee
    """
    if current_user.role not in ["Admin", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # Month and year should be integers at this point (parsed in /payroll/generate endpoint)
        month = request_data.month
        year = request_data.year
        
        # Build employee query - cascading filter logic:
        # Priority: employee_id > department_id > branch_id > company_id
        # Each filter includes context from parent filters for validation
        employee_query = db.query(User)
        
        # Apply the most specific filter available (cascading priority)
        if request_data.employee_id:
            # Single employee - highest priority
            employee_query = employee_query.filter(User.empid == request_data.employee_id)
            # Include parent context if provided (for validation)
            if request_data.branch_id:
                employee_query = employee_query.filter(User.branch_id == request_data.branch_id)
            elif request_data.company_id:
                employee_query = employee_query.filter(User.company_id == request_data.company_id)
        elif request_data.department_id:
            # Department filter - all employees in that department
            employee_query = employee_query.filter(User.department_id == request_data.department_id)
            # Include branch context if provided (department is within branch)
            if request_data.branch_id:
                employee_query = employee_query.filter(User.branch_id == request_data.branch_id)
            # Include company context if provided but branch not provided
            elif request_data.company_id:
                employee_query = employee_query.filter(User.company_id == request_data.company_id)
        elif request_data.branch_id:
            # Branch filter - all employees in that branch
            employee_query = employee_query.filter(User.branch_id == request_data.branch_id)
            # Include company context if provided (branch is within company)
            if request_data.company_id:
                employee_query = employee_query.filter(User.company_id == request_data.company_id)
        elif request_data.company_id:
            # Company filter - all employees in that company
            employee_query = employee_query.filter(User.company_id == request_data.company_id)
        else:
            # No filters provided - return empty (should not happen with required company field)
            return {"message": "Please select at least a company", "generated": 0, "skipped": 0}
        
        employees = employee_query.all()
        
        if not employees:
            return {"message": "No employees found", "generated": 0, "skipped": 0}
        
        generated = 0
        skipped = 0
        errors = []
        
        for employee in employees:
            try:
                # Get salary structure
                salary_structure = db.query(SalaryStructure).filter(
                    SalaryStructure.empid == employee.empid
                ).first()
                
                if not salary_structure or not salary_structure.salary_per_month:
                    skipped += 1
                    continue
                
                # Get attendance list - cast empid to int for comparison since attendance_list.empid is INTEGER
                try:
                    emp_id_int = int(employee.empid) if employee.empid else None
                    if emp_id_int is None:
                        skipped += 1
                        continue
                except (ValueError, TypeError):
                    skipped += 1
                    continue
                
                attendance_list = db.query(AttendanceList).filter(
                    and_(
                        AttendanceList.empid == emp_id_int,
                        AttendanceList.month == str(month),
                        AttendanceList.year == year
                    )
                ).first()
                
                if not attendance_list:
                    skipped += 1
                    continue
                
                # Check if payslip already exists (based on emp_id, month, year)
                # This ensures we update existing records instead of creating duplicates
                existing_payslip = db.query(PayslipData).filter(
                    and_(
                        PayslipData.emp_id == emp_id_int,
                        PayslipData.month == month,
                        PayslipData.year == year
                    )
                ).first()
                
                # Calculate salary
                payslip_data = calculate_salary_for_employee(
                    db, employee, salary_structure, attendance_list,
                    month, year
                )
                
                if payslip_data:
                    # Set emp_id correctly (must be integer)
                    payslip_data.emp_id = emp_id_int
                    
                    if existing_payslip:
                        # UPDATE: Payslip already exists for this employee, month, and year
                        # Update all fields with new calculated values
                        existing_payslip.full_name = payslip_data.full_name
                        existing_payslip.doj = payslip_data.doj
                        existing_payslip.company_name = payslip_data.company_name
                        existing_payslip.company_id = payslip_data.company_id
                        existing_payslip.branch_name = payslip_data.branch_name
                        existing_payslip.branch_id = payslip_data.branch_id
                        existing_payslip.department_name = payslip_data.department_name
                        existing_payslip.dept_id = payslip_data.dept_id
                        existing_payslip.designation = payslip_data.designation
                        existing_payslip.bank_name = payslip_data.bank_name
                        existing_payslip.bank_acc_no = payslip_data.bank_acc_no
                        existing_payslip.ifsc_code = payslip_data.ifsc_code
                        existing_payslip.pan_no = payslip_data.pan_no
                        existing_payslip.salary_per_annum = payslip_data.salary_per_annum
                        existing_payslip.salary_per_month = payslip_data.salary_per_month
                        existing_payslip.salary_per_day = payslip_data.salary_per_day
                        existing_payslip.earnings = payslip_data.earnings
                        existing_payslip.deductions = payslip_data.deductions
                        existing_payslip.net_salary = payslip_data.net_salary
                        existing_payslip.total_days = payslip_data.total_days
                        existing_payslip.working_days = payslip_data.working_days
                        existing_payslip.present = payslip_data.present
                        existing_payslip.absent = payslip_data.absent
                        existing_payslip.half_days = payslip_data.half_days
                        existing_payslip.holidays = payslip_data.holidays
                        existing_payslip.wo = payslip_data.wo
                        existing_payslip.leaves = payslip_data.leaves
                        existing_payslip.payable_days = payslip_data.payable_days
                        existing_payslip.retention_bonus = payslip_data.retention_bonus
                        existing_payslip.variable_pay = payslip_data.variable_pay
                        existing_payslip.lop_deduction = payslip_data.lop_deduction
                        existing_payslip.arrear_salary = payslip_data.arrear_salary
                        existing_payslip.advance_salary = payslip_data.advance_salary
                        existing_payslip.loan_amount = payslip_data.loan_amount
                        existing_payslip.clear_amount = payslip_data.clear_amount
                        existing_payslip.pay_amount = payslip_data.pay_amount
                        existing_payslip.pf_no = payslip_data.pf_no
                        existing_payslip.esi_no = payslip_data.esi_no
                        existing_payslip.earned_gross = payslip_data.earned_gross
                        existing_payslip.other_deduction = payslip_data.other_deduction
                        existing_payslip.updated_date = get_ist_now()
                        existing_payslip.updated_by = current_user.name or current_user.empid
                        # SQLAlchemy automatically tracks changes, no need to call db.add() for updates
                    else:
                        # INSERT: New payslip record - no existing payslip found for this employee, month, and year
                        db.add(payslip_data)
                    
                    generated += 1
                else:
                    skipped += 1
                    errors.append(f"Failed to calculate salary for {employee.empid}")
                    
            except Exception as e:
                skipped += 1
                error_msg = f"Error processing {employee.empid}: {str(e)}"
                errors.append(error_msg)
                print(error_msg)
        
        db.commit()
        
        return {
            "message": f"Payslip generation completed",
            "generated": generated,
            "skipped": skipped,
            "errors": errors[:10]  # Return first 10 errors
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error generating payslips: {str(e)}")


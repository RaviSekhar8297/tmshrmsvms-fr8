from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from decimal import Decimal
from database import get_db
from models import PayrollStructure, Payroll, User, SalaryStructure, PayslipData
from routes.auth import get_current_user
from typing import Optional
from pydantic import BaseModel
import io

router = APIRouter()

class PayrollStructureCreate(BaseModel):
    name: str
    basic_salary: float
    hra: float = 0
    da: float = 0
    allowances: float = 0
    deductions: float = 0
    tax_percentage: float = 0
    description: Optional[str] = None

class PayrollCreate(BaseModel):
    employee_id: str
    structure_id: int
    month: str
    year: str
    bonus: float = 0
    overtime_hours: float = 0
    deductions: float = 0
    remarks: Optional[str] = None

@router.get("/payroll/structures")
def get_structures(
    db: Session = Depends(get_db)
):
    """Get all payroll structures"""
    structures = db.query(PayrollStructure).all()
    return [
        {
            "id": struct.id,
            "name": struct.name,
            "basic_salary": float(struct.basic_salary),
            "hra": float(struct.hra),
            "da": float(struct.da),
            "allowances": float(struct.allowances),
            "deductions": float(struct.deductions),
            "tax_percentage": float(struct.tax_percentage),
            "description": struct.description,
            "created_at": struct.created_at.isoformat() if struct.created_at else None
        }
        for struct in structures
    ]

@router.post("/payroll/structures")
def create_structure(
    structure: PayrollStructureCreate,
    db: Session = Depends(get_db)
):
    """Create a new payroll structure"""
    # Check if structure name already exists
    existing = db.query(PayrollStructure).filter(PayrollStructure.name == structure.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Structure name already exists")
    
    new_structure = PayrollStructure(
        name=structure.name,
        basic_salary=Decimal(str(structure.basic_salary)),
        hra=Decimal(str(structure.hra)),
        da=Decimal(str(structure.da)),
        allowances=Decimal(str(structure.allowances)),
        deductions=Decimal(str(structure.deductions)),
        tax_percentage=Decimal(str(structure.tax_percentage)),
        description=structure.description
    )
    
    db.add(new_structure)
    db.commit()
    db.refresh(new_structure)
    
    return {
        "message": "Payroll structure created successfully",
        "id": new_structure.id
    }

@router.get("/payroll/list")
def get_payroll_list(
    db: Session = Depends(get_db)
):
    """Get all payroll records"""
    payrolls = db.query(Payroll).order_by(Payroll.year.desc(), Payroll.month.desc()).all()
    return [
        {
            "id": payroll.id,
            "employee_id": payroll.employee_id,
            "employee_name": payroll.employee_name,
            "structure_id": payroll.structure_id,
            "structure_name": payroll.structure_name,
            "month": payroll.month,
            "year": payroll.year,
            "gross_salary": float(payroll.gross_salary),
            "net_salary": float(payroll.net_salary),
            "status": payroll.status,
            "created_at": payroll.created_at.isoformat() if payroll.created_at else None
        }
        for payroll in payrolls
    ]

@router.post("/payroll/create")
def create_payroll(
    payroll_data: PayrollCreate,
    db: Session = Depends(get_db)
):
    """Create a new payroll record"""
    # Get employee
    employee = db.query(User).filter(User.empid == payroll_data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Get structure
    structure = db.query(PayrollStructure).filter(PayrollStructure.id == payroll_data.structure_id).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Payroll structure not found")
    
    # Parse month and year
    try:
        month = int(payroll_data.month.split('-')[1])
        year = int(payroll_data.year)
    except:
        raise HTTPException(status_code=400, detail="Invalid month or year format")
    
    # Check if payroll already exists for this employee and period
    existing = db.query(Payroll).filter(
        and_(
            Payroll.employee_id == payroll_data.employee_id,
            Payroll.month == month,
            Payroll.year == year
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Payroll already exists for this period")
    
    # Calculate salaries
    basic_salary = structure.basic_salary
    hra = structure.hra
    da = structure.da
    allowances = structure.allowances + Decimal(str(payroll_data.bonus))
    overtime_amount = Decimal(str(payroll_data.overtime_hours)) * (basic_salary / (30 * 8))  # Simple calculation
    gross_salary = basic_salary + hra + da + allowances + overtime_amount
    
    # Calculate tax
    tax = gross_salary * (structure.tax_percentage / 100)
    total_deductions = structure.deductions + Decimal(str(payroll_data.deductions)) + tax
    net_salary = gross_salary - total_deductions
    
    new_payroll = Payroll(
        employee_id=payroll_data.employee_id,
        employee_name=employee.name,
        structure_id=structure.id,
        structure_name=structure.name,
        month=month,
        year=year,
        basic_salary=basic_salary,
        hra=hra,
        da=da,
        allowances=allowances,
        bonus=Decimal(str(payroll_data.bonus)),
        overtime_hours=Decimal(str(payroll_data.overtime_hours)),
        overtime_amount=overtime_amount,
        gross_salary=gross_salary,
        tax=tax,
        deductions=total_deductions,
        net_salary=net_salary,
        status='pending',
        remarks=payroll_data.remarks
    )
    
    db.add(new_payroll)
    db.commit()
    db.refresh(new_payroll)
    
    return {
        "message": "Payroll created successfully",
        "id": new_payroll.id
    }

@router.get("/payroll/salary")
def get_salary(
    month: Optional[str] = None,
    year: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get salary records"""
    query = db.query(Payroll)
    
    if month and year:
        try:
            month_int = int(month.split('-')[1]) if '-' in month else int(month)
            year_int = int(year)
            query = query.filter(
                and_(
                    Payroll.month == month_int,
                    Payroll.year == year_int
                )
            )
        except:
            pass
    
    payrolls = query.all()
    
    return [
        {
            "id": payroll.id,
            "employee_id": payroll.employee_id,
            "employee_name": payroll.employee_name,
            "month": payroll.month,
            "year": payroll.year,
            "basic_salary": float(payroll.basic_salary),
            "hra": float(payroll.hra),
            "da": float(payroll.da),
            "allowances": float(payroll.allowances),
            "bonus": float(payroll.bonus),
            "gross_salary": float(payroll.gross_salary),
            "tax": float(payroll.tax),
            "deductions": float(payroll.deductions),
            "net_salary": float(payroll.net_salary),
            "status": payroll.status
        }
        for payroll in payrolls
    ]

@router.get("/payroll/payslips")
def get_payslips(
    month: Optional[str] = None,
    year: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get payslips for a specific month and year"""
    query = db.query(Payroll)
    
    if month and year:
        try:
            month_int = int(month.split('-')[1]) if '-' in month else int(month)
            year_int = int(year)
            query = query.filter(
                and_(
                    Payroll.month == month_int,
                    Payroll.year == year_int
                )
            )
        except:
            pass
    
    payrolls = query.all()
    
    return [
        {
            "id": payroll.id,
            "employee_id": payroll.employee_id,
            "employee_name": payroll.employee_name,
            "month": payroll.month,
            "year": payroll.year,
            "basic_salary": float(payroll.basic_salary),
            "hra": float(payroll.hra),
            "da": float(payroll.da),
            "allowances": float(payroll.allowances),
            "bonus": float(payroll.bonus),
            "gross_salary": float(payroll.gross_salary),
            "tax": float(payroll.tax),
            "deductions": float(payroll.deductions),
            "net_salary": float(payroll.net_salary),
            "status": payroll.status
        }
        for payroll in payrolls
    ]

@router.get("/payroll/salary-structure")
def get_salary_structure(
    db: Session = Depends(get_db)
):
    """Get all salary structure records with employee information"""
    try:
        # Get all salary structures - only select columns that exist in the table
        salary_structures = db.query(
            SalaryStructure.id,
            SalaryStructure.empid,
            SalaryStructure.name,
            SalaryStructure.doj,
            SalaryStructure.salary_per_annum,
            SalaryStructure.salary_per_month,
            SalaryStructure.basic,
            SalaryStructure.hra,
            SalaryStructure.ca,
            SalaryStructure.ma,
            SalaryStructure.sa,
            SalaryStructure.employee_pf,
            SalaryStructure.employee_esi,
            SalaryStructure.professional_tax,
            SalaryStructure.employer_pf,
            SalaryStructure.employer_esi,
            SalaryStructure.variable_pay,
            SalaryStructure.retension_bonus,
            SalaryStructure.net_salary,
            SalaryStructure.monthly_ctc,
            SalaryStructure.pf_check,
            SalaryStructure.esi_check
        ).all()
        
        result = []
        for salary in salary_structures:
            # Get user information using empid
            user = None
            if salary.empid:
                user = db.query(User).filter(User.empid == salary.empid).first()
            
            result.append({
                "id": salary.id,
                "empid": salary.empid,
                "employee_name": user.name if user else (salary.name or "N/A"),
                "employee_email": user.email if user else None,
                "employee_image": user.image_base64 if user else None,
                "doj": salary.doj.isoformat() if salary.doj else None,
                "salary_per_annum": float(salary.salary_per_annum) if salary.salary_per_annum else 0,
                "salary_per_month": float(salary.salary_per_month) if salary.salary_per_month else 0,
                "basic": float(salary.basic) if salary.basic else 0,
                "hra": float(salary.hra) if salary.hra else 0,
                "ca": float(salary.ca) if salary.ca else 0,
                "ma": float(salary.ma) if salary.ma else 0,
                "sa": float(salary.sa) if salary.sa else 0,
                "employee_pf": float(salary.employee_pf) if salary.employee_pf else 0,
                "employee_esi": float(salary.employee_esi) if salary.employee_esi else 0,
                "professional_tax": float(salary.professional_tax) if salary.professional_tax else 0,
                "employer_pf": float(salary.employer_pf) if salary.employer_pf else 0,
                "employer_esi": float(salary.employer_esi) if salary.employer_esi else 0,
                "variable_pay": float(salary.variable_pay) if salary.variable_pay else 0,
                "retension_bonus": float(salary.retension_bonus) if salary.retension_bonus else 0,
                "net_salary": float(salary.net_salary) if salary.net_salary else 0,
                "monthly_ctc": float(salary.monthly_ctc) if salary.monthly_ctc else 0,
                "pf_check": bool(salary.pf_check) if salary.pf_check is not None else False,
                "esi_check": bool(salary.esi_check) if salary.esi_check is not None else False
            })
        
        return result
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error fetching salary structure: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Error fetching salary structure: {str(e)}")

@router.get("/payroll/salary-structure/export-excel")
def export_salary_structure_excel(
    db: Session = Depends(get_db)
):
    """Export salary structure data to Excel"""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
        
        # Get all salary structures
        salary_structures = db.query(
            SalaryStructure.id,
            SalaryStructure.empid,
            SalaryStructure.name,
            SalaryStructure.doj,
            SalaryStructure.salary_per_annum,
            SalaryStructure.salary_per_month,
            SalaryStructure.basic,
            SalaryStructure.hra,
            SalaryStructure.ca,
            SalaryStructure.ma,
            SalaryStructure.sa,
            SalaryStructure.employee_pf,
            SalaryStructure.employee_esi,
            SalaryStructure.professional_tax,
            SalaryStructure.employer_pf,
            SalaryStructure.employer_esi,
            SalaryStructure.variable_pay,
            SalaryStructure.retension_bonus,
            SalaryStructure.net_salary,
            SalaryStructure.monthly_ctc,
            SalaryStructure.pf_check,
            SalaryStructure.esi_check
        ).all()
        
        # Create workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Salary Structure"
        
        # Header style
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF", size=11)
        border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # Headers
        headers = [
            "Emp ID", "Employee Name", "Email", "DOJ", "Salary Per Annum", "Salary Per Month",
            "Basic", "HRA", "CA", "MA", "SA", "Employee PF", "Employee ESI",
            "Professional Tax", "Employer PF", "Employer ESI", "Variable Pay",
            "Retention Bonus", "Net Salary", "Monthly CTC", "PF Check", "ESI Check"
        ]
        
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = border
        
        # Data rows
        for row_num, salary in enumerate(salary_structures, 2):
            user = None
            if salary.empid:
                user = db.query(User).filter(User.empid == salary.empid).first()
            
            row_data = [
                salary.empid or "",
                user.name if user else (salary.name or ""),
                user.email if user else "",
                salary.doj.strftime('%Y-%m-%d') if salary.doj else "",
                float(salary.salary_per_annum) if salary.salary_per_annum else 0,
                float(salary.salary_per_month) if salary.salary_per_month else 0,
                float(salary.basic) if salary.basic else 0,
                float(salary.hra) if salary.hra else 0,
                float(salary.ca) if salary.ca else 0,
                float(salary.ma) if salary.ma else 0,
                float(salary.sa) if salary.sa else 0,
                float(salary.employee_pf) if salary.employee_pf else 0,
                float(salary.employee_esi) if salary.employee_esi else 0,
                float(salary.professional_tax) if salary.professional_tax else 0,
                float(salary.employer_pf) if salary.employer_pf else 0,
                float(salary.employer_esi) if salary.employer_esi else 0,
                float(salary.variable_pay) if salary.variable_pay else 0,
                float(salary.retension_bonus) if salary.retension_bonus else 0,
                float(salary.net_salary) if salary.net_salary else 0,
                float(salary.monthly_ctc) if salary.monthly_ctc else 0,
                "Yes" if salary.pf_check else "No",
                "Yes" if salary.esi_check else "No"
            ]
            
            for col_num, value in enumerate(row_data, 1):
                cell = ws.cell(row=row_num, column=col_num, value=value)
                cell.border = border
                if isinstance(value, (int, float)) and col_num > 4:  # Numeric columns (after DOJ)
                    cell.number_format = '#,##0'
        
        # Auto-adjust column widths
        for column in ws.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
        
        # Save to BytesIO
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        filename = f"salary_structure_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        return StreamingResponse(
            io.BytesIO(output.read()),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error exporting Excel: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Error exporting Excel: {str(e)}")

@router.post("/payroll/salary-structure/upload-excel")
def upload_salary_structure_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload and update salary structure from Excel file"""
    try:
        from openpyxl import load_workbook
        
        # Read file content
        contents = file.file.read()
        wb = load_workbook(io.BytesIO(contents))
        ws = wb.active
        
        updated_count = 0
        created_count = 0
        errors = []
        
        # Skip header row, start from row 2
        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
            try:
                if not row[0]:  # Skip empty rows
                    continue
                
                empid = str(row[0]) if row[0] else None
                name = str(row[1]) if row[1] else None
                email = str(row[2]) if row[2] else None
                doj_str = str(row[3]) if row[3] else None
                
                # Parse date
                doj = None
                if doj_str:
                    try:
                        doj = datetime.strptime(doj_str, '%Y-%m-%d').date()
                    except:
                        try:
                            doj = datetime.strptime(doj_str, '%d-%m-%Y').date()
                        except:
                            pass
                
                # Get existing record or create new (using empid only)
                if empid:
                    salary = db.query(SalaryStructure).filter(SalaryStructure.empid == empid).first()
                    if not salary:
                        salary = SalaryStructure(empid=empid)
                        created_count += 1
                else:
                    errors.append(f"Row {row_num}: Emp ID is required for new records")
                    continue
                
                # Update fields
                salary.name = name
                salary.doj = doj
                salary.salary_per_annum = Decimal(str(row[4])) if row[4] else None
                salary.salary_per_month = Decimal(str(row[5])) if row[5] else None
                salary.basic = Decimal(str(row[6])) if row[6] else None
                salary.hra = Decimal(str(row[7])) if row[7] else None
                salary.ca = Decimal(str(row[8])) if row[8] else None
                salary.ma = Decimal(str(row[9])) if row[9] else None
                salary.sa = Decimal(str(row[10])) if row[10] else None
                salary.employee_pf = Decimal(str(row[11])) if row[11] else None
                salary.employee_esi = Decimal(str(row[12])) if row[12] else None
                salary.professional_tax = Decimal(str(row[13])) if row[13] else None
                salary.employer_pf = Decimal(str(row[14])) if row[14] else None
                salary.employer_esi = Decimal(str(row[15])) if row[15] else None
                salary.variable_pay = Decimal(str(row[16])) if row[16] else None
                salary.retension_bonus = Decimal(str(row[17])) if row[17] else None
                salary.net_salary = Decimal(str(row[18])) if row[18] else None
                salary.monthly_ctc = Decimal(str(row[19])) if row[19] else None
                salary.pf_check = 1 if str(row[20]).lower() in ['yes', '1', 'true'] else 0
                salary.esi_check = 1 if str(row[21]).lower() in ['yes', '1', 'true'] else 0
                
                if salary.id:
                    updated_count += 1
                else:
                    db.add(salary)
                    created_count += 1
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
        
        db.commit()
        
        return {
            "message": "Excel file processed successfully",
            "updated": updated_count,
            "created": created_count,
            "errors": errors
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error uploading Excel: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Error uploading Excel: {str(e)}")

@router.patch("/payroll/salary-structure/{structure_id}/toggle-pf")
def toggle_pf_check(
    structure_id: int,
    db: Session = Depends(get_db)
):
    """Toggle PF check for a salary structure"""
    try:
        from sqlalchemy import update
        
        # Check if record exists
        salary = db.query(SalaryStructure.id, SalaryStructure.pf_check).filter(
            SalaryStructure.id == structure_id
        ).first()
        
        if not salary:
            raise HTTPException(status_code=404, detail="Salary structure not found")
        
        # Toggle the value
        new_value = 1 if salary.pf_check == 0 else 0
        
        # Update using update statement to avoid loading all columns
        db.execute(
            update(SalaryStructure)
            .where(SalaryStructure.id == structure_id)
            .values(pf_check=new_value)
        )
        db.commit()
        
        return {
            "message": "PF check updated successfully",
            "pf_check": bool(new_value)
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error updating PF check: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Error updating PF check: {str(e)}")

@router.patch("/payroll/salary-structure/{structure_id}/toggle-esi")
def toggle_esi_check(
    structure_id: int,
    db: Session = Depends(get_db)
):
    """Toggle ESI check for a salary structure"""
    try:
        from sqlalchemy import update
        
        # Check if record exists
        salary = db.query(SalaryStructure.id, SalaryStructure.esi_check).filter(
            SalaryStructure.id == structure_id
        ).first()
        
        if not salary:
            raise HTTPException(status_code=404, detail="Salary structure not found")
        
        # Toggle the value
        new_value = 1 if salary.esi_check == 0 else 0
        
        # Update using update statement to avoid loading all columns
        db.execute(
            update(SalaryStructure)
            .where(SalaryStructure.id == structure_id)
            .values(esi_check=new_value)
        )
        db.commit()
        
        return {
            "message": "ESI check updated successfully",
            "esi_check": bool(new_value)
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error updating ESI check: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Error updating ESI check: {str(e)}")

# Payslip Data Routes
@router.get("/payslip/months")
def get_payslip_months(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of months with payslip data and freeze status"""
    from sqlalchemy import func, distinct
    
    # Get distinct month/year combinations with freeze status
    results = db.query(
        PayslipData.month,
        PayslipData.year,
        func.max(PayslipData.freaze_status).label('freaze_status')
    ).group_by(
        PayslipData.month,
        PayslipData.year
    ).all()
    
    months = []
    for result in results:
        months.append({
            "month": result.month,
            "year": result.year,
            "freaze_status": bool(result.freaze_status)
        })
    
    return months

@router.post("/payslip/toggle-freeze")
def toggle_payslip_freeze(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle freeze status for all payslips in a given month/year"""
    from utils import is_admin_or_hr
    
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Only Admin or HR can toggle freeze status")
    
    # Get all payslips for this month/year
    payslips = db.query(PayslipData).filter(
        PayslipData.month == month,
        PayslipData.year == year
    ).all()
    
    if not payslips:
        raise HTTPException(status_code=404, detail="No payslips found for this month/year")
    
    # Get current freeze status (all should have same status)
    current_status = payslips[0].freaze_status if payslips else False
    new_status = not current_status
    
    # Update all payslips
    for payslip in payslips:
        payslip.freaze_status = new_status
        payslip.updated_date = datetime.utcnow().date()
        payslip.updated_by = current_user.name or current_user.empid
    
    db.commit()
    
    return {
        "message": f"Freeze status updated to {new_status}",
        "month": month,
        "year": year,
        "freaze_status": new_status,
        "updated_count": len(payslips)
    }


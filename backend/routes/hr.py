from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, extract
from datetime import datetime, date, timedelta
from database import get_db
from models import Attendance, User, PunchLog, AttendanceList, WeekOffDate
from routes.auth import get_current_user
from typing import Optional, List
from pydantic import BaseModel
import io

router = APIRouter()

@router.get("/attendance/count")
def get_attendance_count(
    date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get attendance count statistics for a specific date"""
    if not date:
        date_str = datetime.now().date().isoformat()
    else:
        date_str = date
    
    try:
        target_date = datetime.fromisoformat(date_str).date()
    except:
        target_date = datetime.now().date()
    
    # Get total employees
    total_employees = db.query(User).filter(User.role.in_(['Employee', 'Manager'])).count()
    
    # Get attendance records for the date
    attendance_records = db.query(Attendance).filter(
        Attendance.date == target_date
    ).all()
    
    present_count = sum(1 for a in attendance_records if a.status == 'present')
    absent_count = total_employees - present_count
    leave_count = sum(1 for a in attendance_records if a.status == 'leave')
    late_count = sum(1 for a in attendance_records if a.status == 'late')
    
    return {
        "totalEmployees": total_employees,
        "presentToday": present_count,
        "absentToday": absent_count,
        "onLeave": leave_count,
        "lateArrivals": late_count
    }

@router.get("/attendance/count-details")
def get_attendance_count_details(
    month: int,
    year: int,
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed attendance count for all employees for a month"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        query = db.query(AttendanceList).filter(
            and_(
                AttendanceList.month == str(month),
                AttendanceList.year == year
            )
        )
        
        if employee_id:
            query = query.filter(AttendanceList.empid == employee_id)
        
        records = query.all()
        
        return [
            {
                "id": rec.id,
                "employee_id": rec.empid or getattr(rec, 'employee_id', None),
                "employee_name": rec.name,
                "total_days": float(rec.total_days) if rec.total_days else 0,
                "working_days": float(rec.working_days) if rec.working_days else 0,
                "week_offs": rec.week_offs or 0,
                "holidays": float(rec.holi_days) if rec.holi_days else 0,
                "presents": float(rec.presents) if rec.presents else 0,
                "absents": float(rec.absents) if rec.absents else 0,
                "half_days": float(rec.half_days) if rec.half_days else 0,
                "late_logs": rec.late_logs or 0,
                "lops": float(rec.lops) if rec.lops else 0,
                "cl": float(rec.cl) if rec.cl else 0,
                "sl": float(rec.sl) if rec.sl else 0,
                "comp_offs": float(rec.comp_offs) if rec.comp_offs else 0,
                "payble_days": float(rec.payble_days) if rec.payble_days else 0
            }
            for rec in records
        ]
    except Exception:
        # Return empty list on error to avoid 500 on UI
        return []

@router.get("/attendance/export-excel")
def export_attendance_excel(
    month: int,
    year: int,
    employee_id: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export attendance data to Excel in single row format"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    from openpyxl.utils import get_column_letter
    from calendar import monthrange
    
    # Get first and last date of the month
    first_date = date(year, month, 1)
    last_day = monthrange(year, month)[1]
    last_date = date(year, month, last_day)
    
    # Get all employees
    employees_query = db.query(User).filter(User.role.in_(['Employee', 'Manager']))
    
    # Filter by search query if provided
    if search and search.strip():
        search_term = search.strip().lower()
        employees_query = employees_query.filter(
            or_(
                func.lower(User.name).contains(search_term),
                func.lower(User.empid).contains(search_term)
            )
        )
    
    employees = employees_query.all()
    
    # Get all punch logs for the month
    punch_logs_all = db.query(PunchLog).filter(
        and_(
            PunchLog.date >= first_date,
            PunchLog.date <= last_date
        )
    ).order_by(PunchLog.employee_id, PunchLog.date, PunchLog.punch_time).all()
    
    # Group punch logs by employee_id (empid) and date
    punch_map = {}
    for log in punch_logs_all:
        key = f"{log.employee_id}_{log.date.isoformat()}"
        if key not in punch_map:
            punch_map[key] = {'punches': []}
        punch_map[key]['punches'].append(log.punch_time)
    
    # Build attendance map from punch_logs
    attendance_map = {}
    for emp in employees:
        current_date = first_date
        while current_date <= last_date:
            key = f"{emp.empid}_{current_date.isoformat()}"
            
            if key in punch_map and punch_map[key]['punches']:
                punches = sorted(punch_map[key]['punches'])
                check_in_time = punches[0]
                check_out_time = punches[-1]
                
                if check_in_time and check_out_time:
                    delta = check_out_time - check_in_time
                    hours = delta.total_seconds() / 3600
                else:
                    hours = 0
                
                status = None
                if hours >= 9:
                    status = 'P'
                elif hours >= 4.5:
                    status = 'H/D'
                elif hours > 0:
                    status = 'Abs'
                
                attendance_map[key] = {
                    "check_in": check_in_time.strftime("%H:%M") if check_in_time else "00:00",
                    "check_out": check_out_time.strftime("%H:%M") if check_out_time else "00:00",
                    "status": status,
                    "hours": round(hours, 2) if hours > 0 else 0
                }
            else:
                attendance_map[key] = {
                    "check_in": "00:00",
                    "check_out": "00:00",
                    "status": None,
                    "hours": 0
                }
            
            current_date += timedelta(days=1)
    
    # Create workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Attendance History"
    
    # Styles
    header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF", size=11)
    border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    center_align = Alignment(horizontal='center', vertical='center')
    
    # Generate date list
    date_list = []
    current_date = first_date
    while current_date <= last_date:
        date_list.append(current_date.strftime("%d-%m-%Y"))
        current_date += timedelta(days=1)
    
    # Title row
    month_name = datetime(year, month, 1).strftime("%B %Y")
    ws.merge_cells(f'A1:{get_column_letter(2 + len(date_list) * 4)}1')
    ws['A1'] = f"ATTENDANCE HISTORY - {month_name.upper()}"
    ws['A1'].font = Font(bold=True, size=14)
    ws['A1'].alignment = Alignment(horizontal='center')
    ws.row_dimensions[1].height = 25
    
    # Header row 1 - Date headers
    row_num = 3
    ws.cell(row=row_num, column=1, value="NAME").fill = header_fill
    ws.cell(row=row_num, column=1).font = header_font
    ws.cell(row=row_num, column=1).border = border
    ws.cell(row=row_num, column=1).alignment = center_align
    
    ws.cell(row=row_num, column=2, value="EmployeeId").fill = header_fill
    ws.cell(row=row_num, column=2).font = header_font
    ws.cell(row=row_num, column=2).border = border
    ws.cell(row=row_num, column=2).alignment = center_align
    
    col_num = 3
    for date_str in date_list:
        date_obj = datetime.strptime(date_str, "%d-%m-%Y")
        date_display = date_obj.strftime("%Y-%m-%d")
        ws.merge_cells(f'{get_column_letter(col_num)}{row_num}:{get_column_letter(col_num + 3)}{row_num}')
        cell = ws.cell(row=row_num, column=col_num, value=date_display)
        cell.fill = header_fill
        cell.font = header_font
        cell.border = border
        cell.alignment = center_align
        col_num += 4
    
    # Header row 2 - Column names
    row_num = 4
    ws.cell(row=row_num, column=1).fill = header_fill
    ws.cell(row=row_num, column=1).border = border
    ws.cell(row=row_num, column=2).fill = header_fill
    ws.cell(row=row_num, column=2).border = border
    
    col_num = 3
    for date_str in date_list:
        for col_name in ["IN-TIME", "OUT-TIME", "DURATION", "STATUS"]:
            cell = ws.cell(row=row_num, column=col_num, value=col_name)
            cell.fill = header_fill
            cell.font = header_font
            cell.border = border
            cell.alignment = center_align
            col_num += 1
    
    # Data rows
    row_num = 5
    for emp in employees:
        ws.cell(row=row_num, column=1, value=emp.name).border = border
        ws.cell(row=row_num, column=2, value=emp.empid).border = border
        ws.cell(row=row_num, column=2).alignment = center_align
        
        col_num = 3
        for date_str in date_list:
            date_obj = datetime.strptime(date_str, "%d-%m-%Y").date()
            key = f"{emp.empid}_{date_obj.isoformat()}"
            day_data = attendance_map.get(key, {
                "check_in": "00:00",
                "check_out": "00:00",
                "status": None,
                "hours": 0
            })
            
            # Format duration
            duration_str = "00:00"
            if day_data["hours"] > 0:
                h = int(day_data["hours"])
                m = int((day_data["hours"] - h) * 60)
                duration_str = f"{h:02d}:{m:02d}"
            
            # Write data
            ws.cell(row=row_num, column=col_num, value=day_data["check_in"]).border = border
            ws.cell(row=row_num, column=col_num).alignment = center_align
            col_num += 1
            
            ws.cell(row=row_num, column=col_num, value=day_data["check_out"]).border = border
            ws.cell(row=row_num, column=col_num).alignment = center_align
            col_num += 1
            
            ws.cell(row=row_num, column=col_num, value=duration_str).border = border
            ws.cell(row=row_num, column=col_num).alignment = center_align
            col_num += 1
            
            ws.cell(row=row_num, column=col_num, value=day_data["status"] or "").border = border
            ws.cell(row=row_num, column=col_num).alignment = center_align
            col_num += 1
        
        row_num += 1
    
    # Set column widths
    ws.column_dimensions['A'].width = 25
    ws.column_dimensions['B'].width = 15
    for col in range(3, col_num):
        ws.column_dimensions[get_column_letter(col)].width = 12
    
    # Save to bytes
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"attendance_history_{year}_{str(month).zfill(2)}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/attendance/generate")
def generate_attendance(
    month: int = Body(...),
    year: int = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate attendance records for a month"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # This would generate attendance records from punch logs
    # For now, return success
    return {"message": "Attendance generation initiated"}

@router.get("/attendance/history")
def get_attendance_history(
    date: Optional[str] = None,
    filter: Optional[str] = "all",
    db: Session = Depends(get_db)
):
    """Get attendance list for a specific date"""
    if not date:
        date_str = datetime.now().date().isoformat()
    else:
        date_str = date
    
    try:
        target_date = datetime.fromisoformat(date_str).date()
    except:
        target_date = datetime.now().date()
    
    query = db.query(Attendance).filter(Attendance.date == target_date)
    
    if filter != "all":
        query = query.filter(Attendance.status == filter)
    
    attendance_records = query.all()
    
    result = []
    for record in attendance_records:
        hours = 0
        if record.check_in and record.check_out:
            delta = record.check_out - record.check_in
            hours = delta.total_seconds() / 3600
        
        result.append({
            "id": record.id,
            "employee_id": record.employee_id,
            "employee_name": record.employee_name,
            "check_in": record.check_in.isoformat() if record.check_in else None,
            "check_out": record.check_out.isoformat() if record.check_out else None,
            "status": record.status,
            "hours": round(hours, 2) if hours > 0 else None
        })
    
    return result

@router.get("/attendance/history-month")
def get_attendance_history_month(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get attendance history for current month with all employees and dates from punch_logs"""
    from calendar import monthrange
    
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now()
    if not month:
        month = now.month
    if not year:
        year = now.year
    
    # Get first and last date of the month
    first_date = date(year, month, 1)
    last_day = monthrange(year, month)[1]
    last_date = date(year, month, last_day)
    
    # Get all employees
    employees = db.query(User).filter(User.role.in_(['Employee', 'Manager'])).all()
    
    # Get all punch logs for the month
    punch_logs_all = db.query(PunchLog).filter(
        and_(
            PunchLog.date >= first_date,
            PunchLog.date <= last_date
        )
    ).order_by(PunchLog.employee_id, PunchLog.date, PunchLog.punch_time).all()
    
    # Group punch logs by employee_id (empid) and date
    # For each employee and date, get first punch_time (check in) and last punch_time (check out)
    punch_map = {}
    for log in punch_logs_all:
        key = f"{log.employee_id}_{log.date.isoformat()}"
        if key not in punch_map:
            punch_map[key] = {'punches': []}
        punch_map[key]['punches'].append(log.punch_time)
    
    # Build attendance map from punch_logs
    # For each employee and date, get first punch_time (check in) and last punch_time (check out)
    attendance_map = {}
    for emp in employees:
        current_date = first_date
        while current_date <= last_date:
            key = f"{emp.empid}_{current_date.isoformat()}"
            
            if key in punch_map and punch_map[key]['punches']:
                punches = sorted(punch_map[key]['punches'])
                check_in_time = punches[0]  # First punch_time
                check_out_time = punches[-1]  # Last punch_time
                
                # Calculate duration
                if check_in_time and check_out_time:
                    delta = check_out_time - check_in_time
                    hours = delta.total_seconds() / 3600
                else:
                    hours = 0
                
                # Calculate status based on hours
                status = None
                if hours >= 9:
                    status = 'P'  # Present
                elif hours >= 4.5:  # 4:30 to 8:59
                    status = 'H/D'  # Half Day
                elif hours > 0:
                    status = 'Abs'  # Absent (less than 4:30)
                
                attendance_map[key] = {
                    "check_in": check_in_time.strftime("%H:%M") if check_in_time else "00:00",
                    "check_out": check_out_time.strftime("%H:%M") if check_out_time else "00:00",
                    "status": status,
                    "hours": round(hours, 2) if hours > 0 else 0
                }
            else:
                # No records - show 00:00
                attendance_map[key] = {
                    "check_in": "00:00",
                    "check_out": "00:00",
                    "status": None,
                    "hours": 0
                }
            
            current_date += timedelta(days=1)
    
    # Build result with all employees and all dates
    result = []
    for emp in employees:
        emp_data = {
            "employee_id": emp.empid,
            "employee_name": emp.name,
            "dates": {}
        }
        
        # Add data for each date in the month
        current_date = first_date
        while current_date <= last_date:
            date_str = current_date.strftime("%d-%m-%Y")
            key = f"{emp.empid}_{current_date.isoformat()}"
            
            # Get data from attendance_map (already calculated from punch_logs)
            # Format: check_in and check_out times
            if key in attendance_map:
                emp_data["dates"][date_str] = attendance_map[key]
            else:
                # No records - show 00:00
                emp_data["dates"][date_str] = {
                    "check_in": "00:00",
                    "check_out": "00:00",
                    "status": None,
                    "hours": 0
                }
            
            current_date += timedelta(days=1)
        
        result.append(emp_data)
    
    # Also return date list for frontend - format as dd-mm-yyyy
    date_list = []
    current_date = first_date
    while current_date <= last_date:
        date_list.append(current_date.strftime("%d-%m-%Y"))
        current_date += timedelta(days=1)
    
    return {
        "employees": result,
        "dates": date_list,
        "month": month,
        "year": year
    }

@router.get("/attendance/today")
def get_today_attendance(
    date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get today's attendance for current user"""
    if not date:
        date_str = datetime.now().date().isoformat()
    else:
        date_str = date
    
    try:
        target_date = datetime.fromisoformat(date_str).date()
    except:
        target_date = datetime.now().date()
    
    attendance = db.query(Attendance).filter(
        and_(
            Attendance.employee_id == current_user.empid,
            Attendance.date == target_date
        )
    ).first()
    
    if not attendance:
        return None
    
    hours = 0
    if attendance.check_in and attendance.check_out:
        delta = attendance.check_out - attendance.check_in
        hours = delta.total_seconds() / 3600
    
    return {
        "id": attendance.id,
        "employee_id": attendance.employee_id,
        "date": attendance.date.isoformat(),
        "check_in": attendance.check_in.isoformat() if attendance.check_in else None,
        "check_out": attendance.check_out.isoformat() if attendance.check_out else None,
        "status": attendance.status,
        "hours": round(hours, 2) if hours > 0 else None,
        "remarks": attendance.remarks
    }

@router.get("/attendance/punch-history")
def get_punch_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get punch history for current user"""
    attendance_records = db.query(Attendance).filter(
        Attendance.employee_id == current_user.empid
    ).order_by(Attendance.date.desc()).limit(30).all()
    
    result = []
    for record in attendance_records:
        hours = 0
        if record.check_in and record.check_out:
            delta = record.check_out - record.check_in
            hours = delta.total_seconds() / 3600
        
        result.append({
            "id": record.id,
            "date": record.date.isoformat(),
            "check_in": record.check_in.isoformat() if record.check_in else None,
            "check_out": record.check_out.isoformat() if record.check_out else None,
            "hours": round(hours, 2) if hours > 0 else None,
            "status": record.status
        })
    
    return result

class PunchRequest(BaseModel):
    image: Optional[str] = None

class ModifyAttendanceRequest(BaseModel):
    employee_id: str
    date: str
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    status: str = "present"
    remarks: Optional[str] = None

@router.post("/attendance/punch-in")
def punch_in(
    punch_data: PunchRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Punch in for today with image"""
    today = datetime.now().date()
    current_time = datetime.now()
    
    # Create punch log entry
    punch_log = PunchLog(
        employee_id=current_user.empid,
        employee_name=current_user.name,
        date=today,
        punch_type='in',
        punch_time=current_time,
        image=punch_data.image,
        status='present'
    )
    db.add(punch_log)
    
    # Update or create attendance record
    attendance = db.query(Attendance).filter(
        and_(
            Attendance.employee_id == current_user.empid,
            Attendance.date == today
        )
    ).first()
    
    if attendance:
        # If no check_in yet, set it
        if not attendance.check_in:
            attendance.check_in = current_time
            attendance.image = punch_data.image
        attendance.status = 'present'
    else:
        attendance = Attendance(
            employee_id=current_user.empid,
            employee_name=current_user.name,
            date=today,
            check_in=current_time,
            status='present',
            image=punch_data.image
        )
        db.add(attendance)
    
    db.commit()
    return {"message": "Punched in successfully"}

@router.post("/attendance/punch-out")
def punch_out(
    punch_data: PunchRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Punch out for today with image"""
    today = datetime.now().date()
    current_time = datetime.now()
    
    # Create punch log entry
    punch_log = PunchLog(
        employee_id=current_user.empid,
        employee_name=current_user.name,
        date=today,
        punch_type='out',
        punch_time=current_time,
        image=punch_data.image,
        status='present'
    )
    db.add(punch_log)
    
    # Update attendance record
    attendance = db.query(Attendance).filter(
        and_(
            Attendance.employee_id == current_user.empid,
            Attendance.date == today
        )
    ).first()
    
    if not attendance or not attendance.check_in:
        raise HTTPException(status_code=400, detail="Please punch in first")
    
    attendance.check_out = current_time
    
    # Calculate total hours from all punches today
    today_punches = db.query(PunchLog).filter(
        and_(
            PunchLog.employee_id == current_user.empid,
            PunchLog.date == today
        )
    ).order_by(PunchLog.punch_time).all()
    
    total_seconds = 0
    last_in = None
    for punch in today_punches:
        if punch.punch_type == 'in':
            last_in = punch.punch_time
        elif punch.punch_type == 'out' and last_in:
            total_seconds += (punch.punch_time - last_in).total_seconds()
            last_in = None
    
    attendance.hours = total_seconds / 3600
    
    db.commit()
    return {"message": "Punched out successfully"}

@router.get("/attendance/today-punches")
def get_today_punches(
    date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all punches for today"""
    if not date:
        today = datetime.now().date()
    else:
        try:
            today = datetime.fromisoformat(date).date()
        except:
            today = datetime.now().date()
    
    # Get all punch logs for today
    punch_logs = db.query(PunchLog).filter(
        and_(
            PunchLog.employee_id == current_user.empid,
            PunchLog.date == today
        )
    ).order_by(PunchLog.punch_time).all()
    
    # Group into punch pairs
    punches = []
    current_punch = {}
    
    for log in punch_logs:
        if log.punch_type == 'in':
            if current_punch.get('check_in'):
                # Save previous punch and start new
                punches.append(current_punch)
            current_punch = {
                'id': log.id,
                'check_in': log.punch_time,
                'check_in_image': log.image,
                'status': log.status
            }
        elif log.punch_type == 'out' and current_punch.get('check_in'):
            current_punch['check_out'] = log.punch_time
            current_punch['check_out_image'] = log.image
            # Calculate hours for this pair
            delta = log.punch_time - current_punch['check_in']
            current_punch['hours'] = delta.total_seconds() / 3600
            current_punch['image'] = log.image or current_punch.get('check_in_image')
            punches.append(current_punch)
            current_punch = {}
    
    # Add last punch if it's only in
    if current_punch.get('check_in'):
        punches.append(current_punch)
    
    return punches

@router.get("/attendance/punch-calendar")
def get_punch_calendar(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get punch calendar data for a month - calculates hours from punch logs (max - min time)"""
    # Get all punch logs for the month
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)
    
    punch_logs = db.query(PunchLog).filter(
        and_(
            PunchLog.employee_id == current_user.empid,
            PunchLog.date >= start_date,
            PunchLog.date < end_date
        )
    ).order_by(PunchLog.date, PunchLog.punch_time).all()
    
    # Get week off dates (for current user or all employees)
    wo_dates = set()
    try:
        week_off_dates = db.query(WeekOffDate).filter(
            and_(
                or_(
                    WeekOffDate.employee_id == current_user.empid,
                    WeekOffDate.employee_id == "0"
                ),
                WeekOffDate.date >= start_date,
                WeekOffDate.date < end_date
            )
        ).all()
        wo_dates = {wo.date.isoformat() for wo in week_off_dates}
    except Exception as e:
        # If table doesn't exist, continue without week offs
        print(f"Error fetching week off dates: {e}")
        wo_dates = set()
    
    # Group by date and calculate hours
    date_groups = {}
    for log in punch_logs:
        date_str = log.date.isoformat()
        if date_str not in date_groups:
            date_groups[date_str] = []
        date_groups[date_str].append(log.punch_time)
    
    calendar_data = []
    for date_str, times in date_groups.items():
        if len(times) >= 2:
            # Calculate hours: max(time) - min(time)
            min_time = min(times)
            max_time = max(times)
            delta = max_time - min_time
            hours = delta.total_seconds() / 3600
        else:
            hours = 0
        
        # Determine status
        if date_str in wo_dates:
            status = 'WO'
        elif hours >= 9:
            status = 'P'
        elif hours >= 4.5:
            status = 'H/D'
        else:
            status = 'Abs'
        
        calendar_data.append({
            'date': date_str,
            'hours': round(hours, 2),
            'status': status
        })
    
    # Add dates with no punches as Absent
    current_date = start_date
    while current_date < end_date:
        date_str = current_date.isoformat()
        if date_str not in date_groups:
            status = 'WO' if date_str in wo_dates else 'Abs'
            calendar_data.append({
                'date': date_str,
                'hours': 0,
                'status': status
            })
        current_date += timedelta(days=1)
    
    return calendar_data

@router.get("/attendance/previous")
def get_previous_attendance(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get previous attendance records for modify page"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        if not start_date:
            start = datetime.now().date() - timedelta(days=30)
        else:
            start = datetime.fromisoformat(start_date).date()
        
        if not end_date:
            end = datetime.now().date()
        else:
            end = datetime.fromisoformat(end_date).date()
        
        records = db.query(Attendance).filter(
            and_(
                Attendance.date >= start,
                Attendance.date <= end
            )
        ).order_by(Attendance.date.desc(), Attendance.employee_id).all()
        
        result = []
        for record in records:
            # Get min check_in and max check_out from punch logs
            check_in_time = None
            check_out_time = None
            hours = 0
            
            try:
                punch_logs = db.query(PunchLog).filter(
                    and_(
                        PunchLog.employee_id == record.employee_id,
                        PunchLog.date == record.date
                    )
                ).order_by(PunchLog.punch_time).all()
                
                if punch_logs:
                    in_times = [p.punch_time for p in punch_logs if p.punch_type == 'in']
                    out_times = [p.punch_time for p in punch_logs if p.punch_type == 'out']
                    if in_times:
                        check_in_time = min(in_times)
                    if out_times:
                        check_out_time = max(out_times)
            except:
                pass
            
            # Fallback to attendance record if no punch logs
            if not check_in_time and record.check_in:
                check_in_time = record.check_in
            if not check_out_time and record.check_out:
                check_out_time = record.check_out
            
            # Calculate hours
            if check_in_time and check_out_time:
                delta = check_out_time - check_in_time
                hours = delta.total_seconds() / 3600
            
            # Calculate status based on hours
            status = record.status
            if hours > 0:
                if hours >= 9:
                    status = 'present'
                elif hours >= 4.5:
                    status = 'half_day'
                else:
                    status = 'absent'
            elif not check_in_time and not check_out_time:
                status = 'absent'
            
            result.append({
                "id": record.id,
                "employee_id": record.employee_id,
                "employee_name": record.employee_name,
                "date": record.date.isoformat(),
                "check_in": check_in_time.isoformat() if check_in_time else None,
                "check_out": check_out_time.isoformat() if check_out_time else None,
                "status": status,
                "hours": round(hours, 2) if hours > 0 else None,
                "remarks": record.remarks
            })
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching previous records: {str(e)}")

@router.post("/attendance/modify")
def modify_attendance(
    modify_data: ModifyAttendanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create or modify attendance record"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        target_date = datetime.fromisoformat(modify_data.date).date()
    except:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Get employee
    employee = db.query(User).filter(User.empid == modify_data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check if attendance record exists
    attendance = db.query(Attendance).filter(
        and_(
            Attendance.employee_id == modify_data.employee_id,
            Attendance.date == target_date
        )
    ).first()
    
    check_in_time = None
    check_out_time = None
    
    if modify_data.check_in:
        try:
            check_in_time = datetime.fromisoformat(f"{modify_data.date}T{modify_data.check_in}")
        except:
            pass
    
    if modify_data.check_out:
        try:
            check_out_time = datetime.fromisoformat(f"{modify_data.date}T{modify_data.check_out}")
        except:
            pass
    
    # Calculate status based on hours if not provided
    calculated_status = modify_data.status
    hours = 0
    if check_in_time and check_out_time:
        delta = check_out_time - check_in_time
        hours = delta.total_seconds() / 3600
        # Auto-calculate status: >9h = P, 4.5-8.99h = H/D, <4.5h = Abs
        if hours >= 9:
            calculated_status = 'present'
        elif hours >= 4.5:
            calculated_status = 'half_day'
        else:
            calculated_status = 'absent'
    elif not check_in_time and not check_out_time:
        calculated_status = 'absent'
    
    if attendance:
        # Update existing record
        attendance.check_in = check_in_time
        attendance.check_out = check_out_time
        attendance.status = calculated_status
        attendance.remarks = modify_data.remarks
        attendance.updated_at = datetime.utcnow()
        attendance.hours = hours
    else:
        # Create new record
        attendance = Attendance(
            employee_id=modify_data.employee_id,
            employee_name=employee.name,
            date=target_date,
            check_in=check_in_time,
            check_out=check_out_time,
            status=calculated_status,
            hours=hours,
            remarks=modify_data.remarks
        )
        db.add(attendance)
    
    db.commit()
    db.refresh(attendance)
    
    return {
        "message": "Attendance modified successfully",
        "id": attendance.id
    }


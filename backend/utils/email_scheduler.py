"""
Email Scheduler Service for Automated Emails
- Birthday Emails
- Anniversary Emails
- Weekly Attendance Emails
"""
import schedule
import time
import threading
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal
from models import User, AttendanceCycle, PunchLog
from utils.email_service import (
    send_birthday_email,
    send_anniversary_email,
    send_weekly_attendance_email
)


def get_day_name(day_str: str) -> str:
    """Convert day string to standard format"""
    day_lower = day_str.lower().strip()
    day_mapping = {
        'sunday': 'Sunday',
        'monday': 'Monday',
        'tuesday': 'Tuesday',
        'wednesday': 'Wednesday',
        'thursday': 'Thursday',
        'friday': 'Friday',
        'saturday': 'Saturday',
        'everyday': 'Everyday',
        'none': None
    }
    return day_mapping.get(day_lower, day_str)


def should_send_today(config: dict) -> bool:
    """
    Check if email should be sent today based on configuration.
    
    Args:
        config: Dictionary with 'day' and 'time' keys from attendance_cycle table
    
    Returns:
        bool: True if email should be sent today, False otherwise
    """
    if not config:
        return False
    
    # Handle case where config might not be a dict (could be None or other type)
    if not isinstance(config, dict):
        return False
    
    day = config.get('day', '').strip().lower() if config.get('day') else ''
    time_str = config.get('time', '') if config.get('time') else ''
    
    # First check: If day is NULL, EMPTY, or "none" → DO NOT SEND
    if not day or day == '' or day == 'none':
        return False
    
    # Get current day name
    current_day = datetime.now().strftime('%A')  # Monday, Tuesday, etc.
    
    # Check if today matches configured day
    if day.lower() == 'everyday':
        # Everyday means send every day
        pass
    elif day.lower() != current_day.lower():
        # Day doesn't match
        return False
    
    # Check if current time matches configured time
    if time_str:
        try:
            # Parse configured time (HH:MM format)
            config_hour, config_minute = map(int, time_str.split(':'))
            current_time = datetime.now()
            
            # Check if current hour and minute match (exact match)
            if current_time.hour == config_hour and current_time.minute == config_minute:
                return True
        except Exception as e:
            print(f"Error parsing time {time_str}: {str(e)}")
            return False
    
    # If no time specified, don't send
    return False


def check_and_send_birthday_emails():
    """Check and send birthday emails"""
    db: Session = SessionLocal()
    try:
        # Get attendance cycle configuration
        cycle = db.query(AttendanceCycle).filter(AttendanceCycle.id == 1).first()
        if not cycle:
            return
        
        birthdays_config = cycle.birthdays_send
        
        # First check: day/time must not be NULL/EMPTY/"none"
        # Handle case where birthdays_send might be None
        if not birthdays_config or not should_send_today(birthdays_config):
            return
        
        # Get today's date
        today = date.today()
        
        # Get all employees whose DOB matches today
        employees = db.query(User).filter(
            User.dob.isnot(None),
            User.is_active == True
        ).all()
        
        for employee in employees:
            if not employee.dob:
                continue
            
            # Check if DOB month and day match today
            if employee.dob.month == today.month and employee.dob.day == today.day:
                # Second check: employee email_consent must be true
                if employee.email_consent and employee.email:
                    try:
                        send_birthday_email(
                            employee_email=employee.email,
                            employee_name=employee.name
                        )
                        print(f"Birthday email sent to {employee.name} ({employee.email})")
                    except Exception as e:
                        print(f"Error sending birthday email to {employee.email}: {str(e)}")
    
    except Exception as e:
        print(f"Error in check_and_send_birthday_emails: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


def check_and_send_anniversary_emails():
    """Check and send anniversary emails"""
    db: Session = SessionLocal()
    try:
        # Get attendance cycle configuration
        cycle = db.query(AttendanceCycle).filter(AttendanceCycle.id == 1).first()
        if not cycle:
            return
        
        anniversaries_config = cycle.anniversaries_send
        
        # First check: day/time must not be NULL/EMPTY/"none"
        # Handle case where anniversaries_send might be None
        if not anniversaries_config or not should_send_today(anniversaries_config):
            return
        
        # Get today's date
        today = date.today()
        
        # Get all employees whose DOJ month and day match today
        employees = db.query(User).filter(
            User.doj.isnot(None),
            User.is_active == True
        ).all()
        
        for employee in employees:
            if not employee.doj:
                continue
            
            # Check if DOJ month and day match today
            if employee.doj.month == today.month and employee.doj.day == today.day:
                # Calculate years of service
                years = today.year - employee.doj.year
                
                # Second check: employee email_consent must be true
                if employee.email_consent and employee.email:
                    try:
                        send_anniversary_email(
                            employee_email=employee.email,
                            employee_name=employee.name,
                            years=years
                        )
                        print(f"Anniversary email sent to {employee.name} ({employee.email}) - {years} years")
                    except Exception as e:
                        print(f"Error sending anniversary email to {employee.email}: {str(e)}")
    
    except Exception as e:
        print(f"Error in check_and_send_anniversary_emails: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


def check_and_send_weekly_attendance_emails():
    """Check and send weekly attendance reminder emails - sends only once per week"""
    from models import Leave, Holiday, WeekOffDate
    from sqlalchemy import and_, or_
    import os
    import json
    
    db: Session = SessionLocal()
    try:
        # Get attendance cycle configuration
        cycle = db.query(AttendanceCycle).filter(AttendanceCycle.id == 1).first()
        if not cycle:
            return
        
        weekly_attendance_config = cycle.weekly_attendance_send
        
        # First check: day/time must not be NULL/EMPTY/"none"
        # Handle case where weekly_attendance_send might be None
        if not weekly_attendance_config or not should_send_today(weekly_attendance_config):
            return
        
        # Check if email was already sent this week
        # Use a file to track last sent date (week number + year)
        tracking_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'weekly_email_tracking.json')
        today = date.today()
        current_week = today.isocalendar()[1]  # Week number (1-53)
        current_year = today.year
        
        # Check if already sent this week
        last_sent_week = None
        last_sent_year = None
        if os.path.exists(tracking_file):
            try:
                with open(tracking_file, 'r') as f:
                    data = json.load(f)
                    last_sent_week = data.get('week')
                    last_sent_year = data.get('year')
            except:
                pass
        
        # If already sent this week, skip
        if last_sent_week == current_week and last_sent_year == current_year:
            print(f"Weekly attendance email already sent this week (Week {current_week}, {current_year})")
            return
        
        # Mark as sent for this week
        try:
            with open(tracking_file, 'w') as f:
                json.dump({'week': current_week, 'year': current_year, 'date': today.isoformat()}, f)
        except Exception as e:
            print(f"Warning: Could not save weekly email tracking: {e}")
        
        # Get all active employees
        employees = db.query(User).filter(
            User.is_active == True
        ).all()
        
        # Calculate date range (previous 7 days, excluding today)
        # If today is 2026-01-06, previous 7 days are 2025-12-30 to 2026-01-05
        today = date.today()
        end_date = today - timedelta(days=1)  # Yesterday (last day of previous 7 days)
        start_date = end_date - timedelta(days=6)  # 7 days back from yesterday
        
        for employee in employees:
            # Second check: employee email_consent must be true
            if not employee.email_consent or not employee.email:
                continue
            
            # Get employee branch_id (default to 1 if None)
            emp_branch_id = employee.branch_id if employee.branch_id else 1
            
            # Get leaves for this employee in the date range
            leaves = db.query(Leave).filter(
                and_(
                    Leave.empid == employee.empid,
                    Leave.status == 'approved',
                    Leave.from_date <= end_date,
                    Leave.to_date >= start_date
                )
            ).all()
            
            # Build leave map: {date: leave_type}
            leave_map = {}
            for leave in leaves:
                current_leave_date = max(leave.from_date, start_date)
                leave_end = min(leave.to_date, end_date)
                while current_leave_date <= leave_end:
                    leave_map[current_leave_date.isoformat()] = leave.leave_type.upper()
                    current_leave_date += timedelta(days=1)
            
            # Get week-offs for this employee
            week_offs = db.query(WeekOffDate).filter(
                and_(
                    or_(
                        WeekOffDate.employee_id == "0",  # All employees
                        WeekOffDate.employee_id == employee.empid  # Specific employee
                    ),
                    WeekOffDate.date >= start_date,
                    WeekOffDate.date <= end_date
                )
            ).all()
            
            # Build week-off map
            week_off_dates = set()
            for wo in week_offs:
                if wo.employee_id == "0" or str(wo.employee_id).strip() == str(employee.empid).strip():
                    week_off_dates.add(wo.date.isoformat())
            
            # Get holidays with branch_id matching
            holidays = db.query(Holiday).filter(
                and_(
                    Holiday.date >= start_date,
                    Holiday.date <= end_date
                )
            ).all()
            
            # Build holiday map (check holiday_permissions JSON for branch_id)
            holiday_dates = set()
            for holiday in holidays:
                if holiday.holiday_permissions:
                    # Check if employee's branch_id is in holiday_permissions
                    if isinstance(holiday.holiday_permissions, list):
                        for perm in holiday.holiday_permissions:
                            if isinstance(perm, dict) and perm.get('branch_id') == emp_branch_id:
                                holiday_dates.add(holiday.date.isoformat())
                                break
                    elif isinstance(holiday.holiday_permissions, dict):
                        if holiday.holiday_permissions.get('branch_id') == emp_branch_id:
                            holiday_dates.add(holiday.date.isoformat())
                else:
                    # If no holiday_permissions, it applies to all
                    holiday_dates.add(holiday.date.isoformat())
            
            # Get punch logs for previous 7 days
            punch_logs = db.query(PunchLog).filter(
                and_(
                    PunchLog.employee_id == employee.empid,
                    PunchLog.date >= start_date,
                    PunchLog.date <= end_date
                )
            ).order_by(PunchLog.date, PunchLog.punch_time).all()
            
            # Organize punch logs by date
            punch_logs_by_date = {}
            for log in punch_logs:
                date_str = log.date.isoformat()
                if date_str not in punch_logs_by_date:
                    punch_logs_by_date[date_str] = []
                punch_logs_by_date[date_str].append(log)
            
            # Build attendance data for each date
            attendance_data = []
            current_date = start_date
            while current_date <= end_date:
                date_str = current_date.isoformat()
                status = "Abs"
                in_time = "00:00"
                out_time = "00:00"
                hours = 0.0
                
                # Priority: 1. Leaves > 2. Week-offs > 3. Holidays > 4. Punch logs
                if date_str in leave_map:
                    # Leave (highest priority)
                    status = leave_map[date_str]
                    in_time = "00:00"
                    out_time = "00:00"
                    hours = 0.0
                elif date_str in week_off_dates:
                    # Week-off
                    status = "WO"
                    in_time = "00:00"
                    out_time = "00:00"
                    hours = 0.0
                elif date_str in holiday_dates:
                    # Holiday
                    status = "Holiday"
                    in_time = "00:00"
                    out_time = "00:00"
                    hours = 0.0
                elif date_str in punch_logs_by_date:
                    # Calculate from punch logs
                    logs = punch_logs_by_date[date_str]
                    if logs:
                        # Get all punch times (ignore punch_type, use min/max)
                        punch_times = [log.punch_time for log in logs]
                        min_time = min(punch_times)
                        max_time = max(punch_times)
                        
                        # Calculate hours
                        delta = max_time - min_time
                        hours = delta.total_seconds() / 3600.0
                        
                        # Format times
                        in_time = min_time.strftime('%H:%M')
                        out_time = max_time.strftime('%H:%M')
                        
                        # Calculate status based on hours
                        if hours >= 9.0:
                            status = "P"
                        elif hours >= 4.5:  # 4:30 to 8:59
                            status = "H/D"
                        else:  # Below 4:29
                            status = "Abs"
                    else:
                        status = "Abs"
                        in_time = "00:00"
                        out_time = "00:00"
                        hours = 0.0
                else:
                    # No data - absent
                    status = "Abs"
                    in_time = "00:00"
                    out_time = "00:00"
                    hours = 0.0
                
                attendance_data.append({
                    'date': date_str,
                    'status': status,
                    'in_time': in_time,
                    'out_time': out_time,
                    'hours': round(hours, 2)
                })
                
                current_date += timedelta(days=1)
            
            # Send email
            try:
                send_weekly_attendance_email(
                    employee_email=employee.email,
                    employee_name=employee.name,
                    attendance_data=attendance_data
                )
                print(f"Weekly attendance email sent to {employee.name} ({employee.email})")
            except Exception as e:
                print(f"Error sending weekly attendance email to {employee.email}: {str(e)}")
    
    except Exception as e:
        print(f"Error in check_and_send_weekly_attendance_emails: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


def run_email_checks():
    """Run all email checks (called every minute)"""
    check_and_send_birthday_emails()
    check_and_send_anniversary_emails()
    check_and_send_weekly_attendance_emails()


def start_email_scheduler():
    """Start the email scheduler in a background thread"""
    try:
        # Schedule to run every minute
        schedule.every(1).minutes.do(run_email_checks)
        
        def scheduler_loop():
            while True:
                try:
                    schedule.run_pending()
                    time.sleep(1)
                except Exception as e:
                    print(f"Error in scheduler loop: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    time.sleep(60)  # Wait a minute before retrying
        
        # Start scheduler in a daemon thread
        scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True)
        scheduler_thread.start()
        print("Email scheduler started successfully")
    except Exception as e:
        print(f"Error starting email scheduler: {str(e)}")
        import traceback
        traceback.print_exc()


from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Date, Numeric, ForeignKey, CheckConstraint, Index, Sequence
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, date
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    empid = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    phone = Column(String(15))
    sms_consent = Column(Boolean, default=False)
    whatsapp_consent = Column(Boolean, default=False)
    email_consent = Column(Boolean, default=False)
    username = Column(String(50), unique=True, nullable=False)
    password = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(String(20), nullable=False)
    image_base64 = Column(Text)
    report_to_id = Column(String(20), ForeignKey('users.empid'), nullable=True)
    google_calendar_credentials = Column(JSONB, nullable=True)  # Store Google OAuth credentials
    dob = Column(Date, nullable=True)  # Date of Birth
    doj = Column(Date, nullable=True)  # Date of Joining
    bank_details = Column(JSONB, nullable=True)  # bank_name, account_number, ifsc, pan, aadhar
    family_details = Column(JSONB, nullable=True)  # name, relation, phone, aadhar
    nominee_details = Column(JSONB, nullable=True)  # name, relation, phone, aadhar
    education_details = Column(JSONB, nullable=True)  # education_name, pass_out_year, percentage
    experience_details = Column(JSONB, nullable=True)  # prev_company_name, year, designation, salary_per_annum
    documents = Column(JSONB, nullable=True)  # name, image
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    designation = Column(String(150), nullable=True)
    company_id = Column(Integer, ForeignKey('company.id'), nullable=True)
    branch_id = Column(Integer, ForeignKey('branch.id'), nullable=True)
    department_id = Column(Integer, ForeignKey('department.id'), nullable=True)
    company_name = Column(String(255), nullable=True)
    branch_name = Column(String(255), nullable=True)
    department_name = Column(String(255), nullable=True)
    
    __table_args__ = (
        CheckConstraint(role.in_(['Admin', 'Manager', 'Employee', 'HR']), name='check_role'),
    )

class AuthToken(Base):
    __tablename__ = "auth_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'))
    token = Column(Text, unique=True, nullable=False)
    device_info = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime, default=datetime.utcnow)

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(300), nullable=False)
    description = Column(Text)
    start_date = Column(Date)
    end_date = Column(Date)
    estimated_days = Column(Integer)
    progress_percent = Column(Integer, default=0)
    status = Column(String(20), default='planning')
    priority = Column(String(20), default='medium')
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    project_head_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    project_head_name = Column(String(100))
    teams = Column(JSONB, default=lambda: [])
    project_cost = Column(Numeric(20, 2), default=0)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.teams is None:
            self.teams = []
    
    __table_args__ = (
        CheckConstraint('progress_percent >= 0 AND progress_percent <= 100', name='check_progress'),
    )

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=True)
    title = Column(String(300), nullable=False)
    description = Column(Text)
    status = Column(String(20), default='todo')
    priority = Column(String(10), default='medium')
    assigned_by_id = Column(Integer, ForeignKey('users.id'))
    assigned_by_name = Column(String(100))
    assigned_to_id = Column(Integer, ForeignKey('users.id'))
    assigned_to_name = Column(String(100))
    assigned_to_ids = Column(JSONB, default=lambda: [])
    start_date = Column(Date)
    due_date = Column(Date)
    estimated_days = Column(Integer)
    actual_days = Column(Integer)
    percent_complete = Column(Integer, default=0)
    remarks = Column(JSONB, default=lambda: [])
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.assigned_to_ids is None:
            self.assigned_to_ids = []
        if self.remarks is None:
            self.remarks = []
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        CheckConstraint('percent_complete >= 0 AND percent_complete <= 100', name='check_task_progress'),
        Index('idx_tasks_status', 'status'),
        Index('idx_tasks_project', 'project_id'),
    )

class Subtask(Base):
    __tablename__ = "subtasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'))
    title = Column(String(300), nullable=False)
    is_completed = Column(Boolean, default=False)
    assigned_to_id = Column(Integer, ForeignKey('users.id'))
    assigned_to_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'))
    author_id = Column(Integer, ForeignKey('users.id'))
    author_name = Column(String(100))
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Attachment(Base):
    __tablename__ = "attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'))
    file_url = Column(Text, nullable=False)
    file_name = Column(String(300))
    uploaded_by = Column(Integer, ForeignKey('users.id'))
    uploaded_by_name = Column(String(100))
    uploaded_at = Column(DateTime, default=datetime.utcnow)

class TaskRating(Base):
    __tablename__ = "task_ratings"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'))
    rater_id = Column(Integer, ForeignKey('users.id'))
    rater_name = Column(String(100))
    ratee_id = Column(Integer, ForeignKey('users.id'))
    ratee_name = Column(String(100))
    score = Column(Integer)
    comments = Column(Text)
    rated_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        CheckConstraint('score >= 1 AND score <= 5', name='check_score'),
    )

class Meeting(Base):
    __tablename__ = "meetings"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text)
    meeting_datetime = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=60)
    participants = Column(JSONB, default=lambda: [])
    link = Column(Text)
    meeting_type = Column(String(20), default='online')  # online / offline
    location = Column(Text)
    status = Column(String(20), default='scheduled')
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.participants is None:
            self.participants = []

class MeetingNotes(Base):
    __tablename__ = "meeting_notes"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey('meetings.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_meeting_user', 'meeting_id', 'user_id', unique=True),
    )

class ProjectMessage(Base):
    __tablename__ = "project_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    user_name = Column(String(100))
    user_image_base64 = Column(Text)
    message = Column(Text, nullable=False)
    image_base64 = Column(Text, nullable=True)  # For image messages
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_project_created', 'project_id', 'created_at'),
    )

class Issue(Base):
    __tablename__ = "issues"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text)
    status = Column(String(20), default='open')
    priority = Column(String(20), default='medium')
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=True)
    task_id = Column(Integer, ForeignKey('tasks.id'), nullable=True)
    raised_by = Column(Integer, ForeignKey('users.id'))
    raised_by_name = Column(String(100))
    assigned_to = Column(Integer, ForeignKey('users.id'), nullable=True)
    assigned_to_name = Column(String(100))
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TaskTimer(Base):
    __tablename__ = "task_timers"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'))
    user_id = Column(Integer, ForeignKey('users.id'))
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class NotificationLog(Base):
    __tablename__ = "notifications_log"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    type = Column(String(30))
    title = Column(String(300))
    message = Column(Text)
    channel = Column(String(15))
    sent_at = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    action = Column(String(100), nullable=False)
    target_type = Column(String(30))
    target_id = Column(Integer)
    details = Column(JSONB)
    ip_address = Column(String(45))
    created_at = Column(DateTime, default=datetime.utcnow)

class Activity(Base):
    __tablename__ = "activities"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    user_name = Column(String(100))
    action = Column(String(100), nullable=False)
    entity_type = Column(String(30))
    entity_id = Column(Integer)
    entity_name = Column(String(300))
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

# HR Module Models
class Attendance(Base):
    __tablename__ = "attendance"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(20), ForeignKey('users.empid'), nullable=False)
    employee_name = Column(String(100))
    date = Column(Date, nullable=False)
    check_in = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)
    status = Column(String(20), default='absent')  # present, absent, leave, late
    hours = Column(Numeric(5, 2), default=0)
    image = Column(Text, nullable=True)  # Base64 encoded image for punch in/out
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_attendance_employee_date', 'employee_id', 'date', unique=True),
    )

class PunchLog(Base):
    __tablename__ = "punch_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(20), ForeignKey('users.empid'), nullable=False)
    employee_name = Column(String(100))
    date = Column(Date, nullable=False)
    punch_type = Column(String(10), nullable=False)  # 'in' or 'out'
    punch_time = Column(DateTime, nullable=False)
    image = Column(Text, nullable=True)  # Base64 encoded image
    status = Column(String(20), default='present')  # present, late, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_punch_log_employee_date', 'employee_id', 'date'),
    )

# VMS Module Models
class VMSItem(Base):
    __tablename__ = "vms_items"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(300), nullable=False)
    description = Column(Text)
    category = Column(String(50))  # vehicle, equipment, tool, material, other
    quantity = Column(Integer, default=1)
    unit = Column(String(20))  # pieces, kg, liters, etc.
    location = Column(String(200))
    status = Column(String(20), default='available')  # available, in-use, maintenance, reserved
    notes = Column(Text)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Visitor(Base):
    __tablename__ = "visitors"
    
    id = Column(Integer, primary_key=True, index=True)
    vtid = Column(Integer, Sequence('visitors_vtid_seq'), unique=True, nullable=False)
    fullname = Column(String(100), nullable=False)
    email = Column(String(100))
    phone = Column(String(15))
    address = Column(Text)
    purpose = Column(String(150))
    whometomeet = Column(String(100))
    selfie = Column(Text)  # image path or base64 string
    checkintime = Column(DateTime, default=datetime.utcnow)
    checkouttime = Column(DateTime, nullable=True)
    status = Column(String(20), default='IN')  # IN, OUT
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Payroll Module Models
class PayrollStructure(Base):
    __tablename__ = "payroll_structures"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True)
    basic_salary = Column(Numeric(20, 2), nullable=False)
    hra = Column(Numeric(20, 2), default=0)  # House Rent Allowance
    da = Column(Numeric(20, 2), default=0)  # Dearness Allowance
    allowances = Column(Numeric(20, 2), default=0)
    deductions = Column(Numeric(20, 2), default=0)
    tax_percentage = Column(Numeric(5, 2), default=0)
    description = Column(Text)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Payroll(Base):
    __tablename__ = "payroll"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(20), ForeignKey('users.empid'), nullable=False)
    employee_name = Column(String(100))
    structure_id = Column(Integer, ForeignKey('payroll_structures.id'), nullable=False)
    structure_name = Column(String(200))
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    basic_salary = Column(Numeric(20, 2), nullable=False)
    hra = Column(Numeric(20, 2), default=0)
    da = Column(Numeric(20, 2), default=0)
    allowances = Column(Numeric(20, 2), default=0)
    bonus = Column(Numeric(20, 2), default=0)
    overtime_hours = Column(Numeric(5, 2), default=0)
    overtime_amount = Column(Numeric(20, 2), default=0)
    gross_salary = Column(Numeric(20, 2), nullable=False)
    tax = Column(Numeric(20, 2), default=0)
    deductions = Column(Numeric(20, 2), default=0)
    net_salary = Column(Numeric(20, 2), nullable=False)
    status = Column(String(20), default='pending')  # pending, approved, paid, rejected
    remarks = Column(Text)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_payroll_employee_month_year', 'employee_id', 'month', 'year', unique=True),
    )

# Leaves Model
class Leave(Base):
    __tablename__ = "leaves"
    
    id = Column(Integer, primary_key=True, index=True)
    empid = Column(String(20), ForeignKey('users.empid'), nullable=False)
    name = Column(String(100), nullable=False)
    applied_date = Column(DateTime, default=datetime.utcnow)
    from_date = Column(Date, nullable=False)
    to_date = Column(Date, nullable=False)
    duration = Column(Integer, nullable=False)  # Number of days
    leave_type = Column(String(50), nullable=False)  # sick, casual, annual, emergency, other
    report_to = Column(String(20), ForeignKey('users.empid'), nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(String(20), default='pending')  # pending, approved, rejected
    approved_by = Column(String(20), ForeignKey('users.empid'), nullable=True)
    approved_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Permissions Model
class Permission(Base):
    __tablename__ = "permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    empid = Column(String(20), ForeignKey('users.empid'), nullable=False)
    name = Column(String(100), nullable=False)
    applied_date = Column(DateTime, default=datetime.utcnow)
    from_datetime = Column(DateTime, nullable=False)
    to_datetime = Column(DateTime, nullable=False)
    status = Column(String(20), default='pending')  # pending, approved, rejected
    approved_by = Column(String(20), ForeignKey('users.empid'), nullable=True)
    type = Column(String(50), nullable=False)  # late-arrival, early-departure, half-day, short-leave, other
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Requests Model
class Request(Base):
    __tablename__ = "requests"
    
    id = Column(Integer, primary_key=True, index=True)
    empid = Column(String(20), ForeignKey('users.empid'), nullable=False)
    name = Column(String(100), nullable=False)
    applied_date = Column(DateTime, default=datetime.utcnow)
    intime = Column(DateTime, nullable=True)
    outtime = Column(DateTime, nullable=True)
    status = Column(String(20), default='pending')  # pending, approved, rejected, completed
    approved_by = Column(String(20), ForeignKey('users.empid'), nullable=True)
    type = Column(String(50), nullable=False)  # equipment, access, training, other
    subject = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Holidays Model
class Holiday(Base):
    __tablename__ = "holidays"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_holiday_date', 'date'),
    )

# WeekOff Model
class WeekOff(Base):
    __tablename__ = "week_offs"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(20), ForeignKey('users.empid'), nullable=False)
    employee_name = Column(String(100))
    day_of_week = Column(String(20), nullable=False)  # monday, tuesday, etc.
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class WeekOffDate(Base):
    __tablename__ = "week_off_dates"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(20), nullable=False)  # "0" means All employees
    employee_name = Column(String(100))  # "All" if employee_id is "0"
    date = Column(Date, nullable=False)
    weekday = Column(String(20))  # sunday, monday, etc.
    month = Column(Integer)  # 1-12
    year = Column(Integer)  # 2024, 2025, etc.
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_employee_date', 'employee_id', 'date'),
    )

# Company Model
class Company(Base):
    __tablename__ = "company"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    address = Column(Text)
    phone = Column(String(20))
    email = Column(String(120))
    website = Column(String(200))
    logo_base64 = Column(Text)
    tax_id = Column(String(50))
    registration_number = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Branch(Base):
    __tablename__ = "branch"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    company_id = Column(Integer, ForeignKey('company.id', ondelete='CASCADE'), nullable=False)
    company_name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Department(Base):
    __tablename__ = "department"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    company_id = Column(Integer, ForeignKey('company.id', ondelete='CASCADE'), nullable=False)
    branch_id = Column(Integer, ForeignKey('branch.id', ondelete='CASCADE'), nullable=False)
    company_name = Column(String(255), nullable=False)
    branch_name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# AttendanceList Model
class AttendanceList(Base):
    __tablename__ = "attendance_list"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text)
    empid = Column(String(20), ForeignKey('users.empid'), nullable=True)  # Reference users.empid
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # Also reference users.id for joins
    doj = Column(Date, nullable=True)  # Date of Joining
    from_date = Column(Date, nullable=True)
    to_date = Column(Date, nullable=True)
    total_days = Column(Numeric(10, 1), nullable=True)
    working_days = Column(Numeric(10, 1), nullable=True)
    week_offs = Column(Integer, nullable=True)
    holi_days = Column(Numeric(10, 1), nullable=True)  # Holidays
    presents = Column(Numeric(10, 1), nullable=True)
    absents = Column(Numeric(10, 1), nullable=True)
    half_days = Column(Numeric(10, 1), nullable=True)
    late_logs = Column(Integer, nullable=True)
    cl = Column(Numeric(10, 1), nullable=True)  # Casual Leave
    sl = Column(Numeric(10, 1), nullable=True)  # Sick Leave
    comp_offs = Column(Numeric(10, 1), nullable=True)  # Compensatory Offs
    payble_days = Column(Numeric(10, 1), nullable=True)  # Payable Days
    lops = Column(Numeric(10, 1), nullable=True)  # Loss of Pay
    year = Column(Integer, nullable=True)
    month = Column(Text, nullable=True)
    status = Column(Integer, nullable=True, default=0)
    updated_by = Column(Text, nullable=True)
    updated_date = Column(DateTime, nullable=True)

# SalaryStructure Model
class SalaryStructure(Base):
    __tablename__ = "salary_structure"
    
    id = Column(Integer, primary_key=True, index=True)
    empid = Column(String(20), ForeignKey('users.empid'), nullable=True)  # Reference users.empid
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # Also reference users.id for joins
    name = Column(String(100), nullable=True)
    doj = Column(Date, nullable=True)  # Date of Joining
    salary_per_annum = Column(Numeric(18, 2), nullable=True)
    salary_per_month = Column(Numeric(18, 2), nullable=True)
    basic = Column(Numeric(18, 2), nullable=True)
    hra = Column(Numeric(18, 2), nullable=True)  # House Rent Allowance
    ca = Column(Numeric(18, 2), nullable=True)  # Conveyance Allowance
    ma = Column(Numeric(18, 2), nullable=True)  # Medical Allowance
    sa = Column(Numeric(18, 2), nullable=True)  # Special Allowance
    employee_pf = Column(Numeric(18, 2), nullable=True)
    employee_esi = Column(Numeric(18, 2), nullable=True)
    professional_tax = Column(Numeric(18, 2), nullable=True)
    employer_pf = Column(Numeric(18, 2), nullable=True)
    employer_esi = Column(Numeric(18, 2), nullable=True)
    variable_pay = Column(Numeric(18, 2), nullable=True)
    retension_bonus = Column(Numeric(18, 2), nullable=True)  # Retention Bonus
    net_salary = Column(Numeric(18, 2), nullable=True)
    monthly_ctc = Column(Numeric(18, 2), nullable=True)  # Monthly Cost to Company
    pf_check = Column(Integer, nullable=False, default=1)  # PF Check (1 = Yes, 0 = No)
    esi_check = Column(Integer, nullable=False, default=1)  # ESI Check (1 = Yes, 0 = No)

# PayslipData Model
class PayslipData(Base):
    __tablename__ = "payslip_data"
    
    payslip_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100))
    emp_id = Column(Integer)
    doj = Column(Date)
    company_name = Column(String(50))
    company_id = Column(Integer)
    branch_name = Column(String(50))
    branch_id = Column(Integer)
    department_name = Column(String(50))
    dept_id = Column(Integer)
    designation = Column(String(50))
    bank_name = Column(String(50))
    bank_acc_no = Column(String(50))
    ifsc_code = Column(String(50))
    pan_no = Column(String(50))
    salary_per_annum = Column(Numeric(18, 2))
    salary_per_month = Column(Numeric(18, 2))
    salary_per_day = Column(Numeric(18, 2))
    earnings = Column(JSONB)  # GrossSalary, Basic, HRA, CA, MA
    deductions = Column(JSONB)  # PF, ESI, LateLogins, TDS, LateLogDeduction, PT
    net_salary = Column(Numeric(18, 2))
    month = Column(Integer)
    year = Column(Integer)
    total_days = Column(Integer)
    working_days = Column(Numeric(18, 2))
    present = Column(Numeric(18, 2))
    absent = Column(Numeric(18, 2))
    half_days = Column(Numeric(18, 2))
    holidays = Column(Numeric(18, 2))
    wo = Column(Numeric(18, 2))
    leaves = Column(Numeric(18, 2))
    payable_days = Column(Numeric(18, 2))
    retention_bonus = Column(Numeric(18, 2))
    variable_pay = Column(Numeric(18, 2))
    lop_deduction = Column(Numeric(18, 2))
    arrear_salary = Column(Numeric(18, 2))
    advance_salary = Column(Numeric(18, 2))
    loan_amount = Column(Numeric(18, 2))
    clear_amount = Column(Numeric(18, 2))
    pay_amount = Column(Numeric(18, 2))
    pf_no = Column(String(50))
    esi_no = Column(String(50))
    earned_gross = Column(Numeric(18, 2))
    other_deduction = Column(Numeric(18, 2), default=0)
    freaze_status = Column(Boolean, nullable=False, default=False)
    created_date = Column(Date, default=date.today)
    created_by = Column(String(50))
    updated_date = Column(Date)
    updated_by = Column(String(50))
    
    __table_args__ = (
        Index('idx_payslip_month_year', 'month', 'year'),
        Index('idx_payslip_emp_id', 'emp_id'),
        Index('idx_payslip_freaze_status', 'freaze_status'),
    )


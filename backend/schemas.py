from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime, date
from decimal import Decimal

# ============ User Schemas ============
class UserBase(BaseModel):
    empid: str
    name: str
    email: str
    phone: Optional[str] = None
    username: str
    role: str
    sms_consent: bool = False
    whatsapp_consent: bool = False
    email_consent: bool = False
    report_to_id: Optional[str] = None
    image_base64: Optional[str] = None
    dob: Optional[date] = None
    doj: Optional[date] = None
    designation: Optional[str] = None
    company_id: Optional[int] = None
    branch_id: Optional[int] = None
    department_id: Optional[int] = None
    company_name: Optional[str] = None
    branch_name: Optional[str] = None
    department_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    sms_consent: Optional[bool] = None
    whatsapp_consent: Optional[bool] = None
    email_consent: Optional[bool] = None
    report_to_id: Optional[str] = None
    image_base64: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    dob: Optional[date] = None
    doj: Optional[date] = None
    emp_inactive_date: Optional[date] = None
    designation: Optional[str] = None
    company_id: Optional[int] = None
    branch_id: Optional[int] = None
    department_id: Optional[int] = None
    company_name: Optional[str] = None
    branch_name: Optional[str] = None
    department_name: Optional[str] = None
    is_late: Optional[bool] = None

class UserResponse(BaseModel):
    id: int
    empid: str
    name: str
    email: str
    phone: Optional[str]
    username: str
    role: str
    sms_consent: bool
    whatsapp_consent: bool
    email_consent: bool
    report_to_id: Optional[str]
    image_base64: Optional[str]
    is_active: bool
    dob: Optional[date]
    doj: Optional[date]
    emp_inactive_date: Optional[date] = None
    designation: Optional[str]
    company_id: Optional[int]
    branch_id: Optional[int]
    department_id: Optional[int]
    company_name: Optional[str]
    branch_name: Optional[str]
    department_name: Optional[str]
    salary_per_annum: Optional[Decimal] = None
    is_late: Optional[bool] = None
    bank_details: Optional[Dict[str, Any]] = None
    family_details: Optional[List[Dict[str, Any]]] = None
    nominee_details: Optional[Dict[str, Any]] = None
    education_details: Optional[List[Dict[str, Any]]] = None
    experience_details: Optional[List[Dict[str, Any]]] = None
    documents: Optional[List[Dict[str, Any]]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============ Auth Schemas ============
class LoginRequest(BaseModel):
    username: str
    password: str
    device_info: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    expires_at: datetime

# ============ Project Schemas ============
class TeamMember(BaseModel):
    empid: str
    name: str
    role: Optional[str] = None
    image_base64: Optional[str] = None

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    estimated_days: Optional[int] = None
    priority: str = "medium"
    project_head_id: Optional[int] = None
    project_cost: Optional[Decimal] = 0

class ProjectCreate(ProjectBase):
    teams: Optional[List[dict]] = []

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    estimated_days: Optional[int] = None
    progress_percent: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    project_head_id: Optional[int] = None
    project_head_name: Optional[str] = None
    teams: Optional[List[dict]] = None
    project_cost: Optional[Decimal] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    start_date: Optional[date]
    end_date: Optional[date]
    estimated_days: Optional[int]
    progress_percent: int
    status: str
    priority: str
    created_by: Optional[int]
    created_by_name: Optional[str]
    created_at: datetime
    project_head_id: Optional[int]
    project_head_name: Optional[str]
    teams: Optional[List[dict]]
    project_cost: Optional[Decimal]
    is_delayed: Optional[bool] = False
    delayed_days: Optional[int] = 0
    
    class Config:
        from_attributes = True

# ============ Task Schemas ============
class TaskBase(BaseModel):
    project_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    estimated_days: Optional[int] = None

class TaskCreate(TaskBase):
    assigned_to_id: Optional[int] = None
    assigned_to_ids: Optional[List[dict]] = []

class TaskUpdate(BaseModel):
    project_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    assigned_to_ids: Optional[List[dict]] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    estimated_days: Optional[int] = None
    actual_days: Optional[int] = None
    percent_complete: Optional[int] = None
    remarks: Optional[List[dict]] = None

class TaskResponse(BaseModel):
    id: int
    project_id: Optional[int]
    title: str
    description: Optional[str]
    status: str
    priority: str
    assigned_by_id: Optional[int]
    assigned_by_name: Optional[str]
    assigned_to_id: Optional[int]
    assigned_to_name: Optional[str]
    assigned_to_ids: Optional[List[dict]]
    start_date: Optional[date]
    due_date: Optional[date]
    estimated_days: Optional[int]
    actual_days: Optional[int]
    percent_complete: int
    remarks: Optional[List[dict]]
    created_at: datetime
    updated_at: datetime
    is_delayed: Optional[bool] = False
    delayed_days: Optional[int] = 0
    
    class Config:
        from_attributes = True

# ============ Subtask Schemas ============
class SubtaskBase(BaseModel):
    title: str
    assigned_to_id: Optional[int] = None

class SubtaskCreate(SubtaskBase):
    task_id: int

class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    is_completed: Optional[bool] = None
    assigned_to_id: Optional[int] = None

class SubtaskResponse(BaseModel):
    id: int
    task_id: int
    title: str
    is_completed: bool
    assigned_to_id: Optional[int]
    assigned_to_name: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============ Meeting Schemas ============
class MeetingBase(BaseModel):
    title: str
    description: Optional[str] = None
    meeting_datetime: datetime
    duration_minutes: int = 60
    meeting_type: str = "online"  # "online" or "offline"
    location: Optional[str] = None

class MeetingCreate(MeetingBase):
    participants: Optional[List[dict]] = []
    link: Optional[str] = None

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    meeting_datetime: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    meeting_type: Optional[str] = None
    location: Optional[str] = None
    participants: Optional[List[dict]] = None
    link: Optional[str] = None
    status: Optional[str] = None

class MeetingResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    meeting_datetime: datetime
    duration_minutes: int
    meeting_type: str
    location: Optional[str]
    participants: Optional[List[dict]]
    link: Optional[str]
    status: str
    created_by: Optional[int]
    created_by_name: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============ Meeting Notes Schemas ============
class MeetingNotesCreate(BaseModel):
    meeting_id: int
    notes: Optional[str] = None

class MeetingNotesUpdate(BaseModel):
    notes: Optional[str] = None

class MeetingNotesResponse(BaseModel):
    id: int
    meeting_id: int
    user_id: int
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# ============ Project Message Schemas ============
class ProjectMessageCreate(BaseModel):
    project_id: int
    message: str
    image_base64: Optional[str] = None

class ProjectMessageResponse(BaseModel):
    id: int
    project_id: int
    user_id: int
    user_name: str
    user_image_base64: Optional[str]
    message: str
    image_base64: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============ Issue Schemas ============
class IssueBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    project_id: Optional[int] = None
    task_id: Optional[int] = None

class IssueCreate(IssueBase):
    pass

class IssueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[int] = None
    resolution_notes: Optional[str] = None

class IssueResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str
    priority: str
    project_id: Optional[int]
    task_id: Optional[int]
    raised_by: Optional[int]
    raised_by_name: Optional[str]
    assigned_to: Optional[int]
    assigned_to_name: Optional[str]
    resolved_at: Optional[datetime]
    resolution_notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# ============ Comment Schemas ============
class CommentCreate(BaseModel):
    task_id: int
    content: str

class CommentResponse(BaseModel):
    id: int
    task_id: int
    author_id: Optional[int]
    author_name: Optional[str]
    content: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============ Rating Schemas ============
class RatingCreate(BaseModel):
    task_id: int
    ratee_id: int
    score: int
    comments: Optional[str] = None

class RatingResponse(BaseModel):
    id: int
    task_id: int
    rater_id: Optional[int]
    rater_name: Optional[str]
    ratee_id: Optional[int]
    ratee_name: Optional[str]
    score: int
    comments: Optional[str]
    rated_at: datetime
    
    class Config:
        from_attributes = True

# ============ Timer Schemas ============
class TimerStart(BaseModel):
    task_id: int
    notes: Optional[str] = None

class TimerStop(BaseModel):
    timer_id: int
    notes: Optional[str] = None

class TimerResponse(BaseModel):
    id: int
    task_id: int
    user_id: Optional[int]
    start_time: datetime
    end_time: Optional[datetime]
    duration_seconds: int
    notes: Optional[str]
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# ============ Dashboard Schemas ============
class DashboardStats(BaseModel):
    total_projects: int
    pending_projects: int
    in_progress_projects: int
    completed_projects: int
    total_tasks: int
    pending_tasks: int
    in_progress_tasks: int
    completed_tasks: int
    total_issues: int
    pending_issues: int
    resolved_issues: int
    total_teams: int
    today_meetings: int

class ActivityResponse(BaseModel):
    id: int
    user_id: Optional[int]
    user_name: Optional[str]
    user_image: Optional[str] = None
    action: str
    entity_type: Optional[str]
    entity_id: Optional[int]
    entity_name: Optional[str]
    details: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============ Report Schemas ============
class ReportFilter(BaseModel):
    project_id: Optional[int] = None
    employee_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

# ============ Policy Schemas ============
class PolicyData(BaseModel):
    name: str
    type: str
    pages: int
    file_url: Optional[str] = None

class ReadByEntry(BaseModel):
    empid: str
    name: str
    status: str
    viewed_at: Optional[datetime] = None

class PolicyCreate(BaseModel):
    policy: PolicyData

class PolicyUpdate(BaseModel):
    policy: Optional[PolicyData] = None

class PolicyResponse(BaseModel):
    id: int
    policy: Dict[str, Any]
    readby: List[Dict[str, Any]]
    likes: List[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True

class MarkAsReadRequest(BaseModel):
    empid: str
    name: str

# ============ Resignation Schemas ============
class ResignationCreate(BaseModel):
    resign_date: date
    requested_date: Optional[date] = None  # User can manually select requested date
    reason: Optional[str] = None
    resignation_type: str = 'Voluntary'

class ResignationUpdate(BaseModel):
    resign_date: Optional[date] = None
    reason: Optional[str] = None
    resignation_type: Optional[str] = None

class ResignationApproval(BaseModel):
    status: str  # 'Approved' or 'Rejected'
    comments: Optional[str] = None

class NoticePeriodInfoResponse(BaseModel):
    notice_period_days: int
    is_probation: bool
    doj: Optional[str] = None
    days_since_joining: Optional[int] = None

class ResignationResponse(BaseModel):
    id: int
    empid: str
    name: str
    applied_date: date
    resign_date: date
    requested_date: Optional[date] = None
    last_working_date: Optional[date] = None
    notice_period_days: Optional[int] = None
    reason: Optional[str] = None
    resignation_type: str
    manager_status: str
    manager_approval_date: Optional[date] = None
    manager_comments: Optional[str] = None
    hod_status: str
    hod_approval_date: Optional[date] = None
    hod_comments: Optional[str] = None
    hr_status: str
    hr_approval_date: Optional[date] = None
    hr_comments: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    withdrawal_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Task Management System (TMS) - System Flow

## Overview
A comprehensive Task Management System with role-based access control, employee management, HR functions, payroll, attendance tracking, and visitor management.

---

## User Roles & Access

### 1. **Admin**
- Full system access
- User management
- Company settings
- All modules access

### 2. **HR**
- Employee management
- Attendance management
- Payroll processing
- Policy management
- Leave approvals
- Employee data management

### 3. **Manager**
- Project & task management
- Team oversight
- Reports & analytics
- Leave/permission approvals
- Employee task assignments

### 4. **Employee**
- Self-service features
- Task management
- Leave/permission requests
- Attendance (punch in/out)
- Profile management

---

## Core Modules & Flow

### 📋 **1. Task Management System (TMS) Module**

#### **Projects**
- **Flow**: Admin/Manager/HR → Create Project → Assign Team → Track Progress
- **Features**:
  - Create, edit, delete projects
  - Project status tracking
  - Team assignment
  - Project timeline

#### **Tasks**
- **Flow**: Manager/HR → Create Task → Assign to Employee → Employee Updates Status → Manager Reviews
- **Features**:
  - Task creation with priority levels
  - Assignment to single/multiple employees
  - Status tracking (Todo, In Progress, Completed)
  - Task timers
  - Progress percentage
  - Task ratings
  - Due date management

#### **Meetings**
- **Flow**: Any User → Schedule Meeting → Add Participants → Google Calendar Integration
- **Features**:
  - Meeting scheduling
  - Google Calendar sync
  - Participant management
  - Meeting notes

#### **Calendar**
- **Flow**: View All Tasks/Meetings → Filter by Date → Manage Schedule
- **Features**:
  - Monthly/weekly view
  - Task and meeting display
  - Date-based filtering

#### **Issues**
- **Flow**: Employee Reports Issue → Manager/HR Reviews → Resolution Tracking
- **Features**:
  - Issue reporting
  - Priority assignment
  - Status tracking
  - Assignment to team members

#### **Ratings**
- **Flow**: Manager Rates Employee Task → Employee Views Rating → Feedback Loop
- **Features**:
  - Task performance ratings
  - Comments and feedback
  - Rating history

#### **Reports**
- **Flow**: Manager/HR/Admin → Generate Reports → View Analytics → Export Data
- **Features**:
  - Task completion reports
  - Employee performance metrics
  - Project progress reports
  - Custom date range filtering

---

### 👤 **2. Employee Self-Service Module**

#### **Punch In/Out**
- **Flow**: Employee → Punch In → Work → Punch Out → View History
- **Features**:
  - Location-based punch
  - Image capture
  - Attendance history
  - Monthly attendance view

#### **Leaves**
- **Flow**: Employee → Apply Leave → Manager/HR Approves → Leave Balance Updated
- **Features**:
  - Leave application
  - Leave balance tracking
  - Half-day leave support
  - Leave history

#### **Permissions**
- **Flow**: Employee → Request Permission → Manager Approves → Permission Granted
- **Features**:
  - Permission requests
  - Approval workflow
  - Permission history

#### **Requests**
- **Flow**: Employee → Submit Request → Manager/HR Reviews → Approval/Rejection
- **Features**:
  - General request submission
  - Request tracking
  - Status updates

#### **Holidays**
- **Flow**: View Company Holidays → Plan Leaves Accordingly
- **Features**:
  - Holiday calendar
  - Holiday list view

#### **Work Reports**
- **Flow**: Employee → Submit Daily Work Report → Manager Reviews
- **Features**:
  - Daily work reporting
  - Report submission
  - Manager review

#### **Loans**
- **Flow**: Employee → Apply for Loan → HR Approves → Loan Disbursement
- **Features**:
  - Loan application
  - Loan approval workflow
  - Loan tracking

#### **Resignation**
- **Flow**: Employee → Submit Resignation → Manager/HR Approves → Exit Process
- **Features**:
  - Resignation submission
  - Approval workflow
  - Exit management

#### **Hierarchy**
- **Flow**: View Organization Structure → See Reporting Manager → Team Members
- **Features**:
  - Organizational chart
  - Manager-employee relationships
  - Team structure

---

### 🏢 **3. HR Management Module**

#### **Attendance Management**
- **Flow**: HR → View Attendance → Modify if Needed → Generate Reports
- **Features**:
  - Attendance list view
  - Attendance cycle management
  - Attendance modification
  - Monthly attendance tracking
  - Salary calculation integration

#### **Leave Management**
- **Flow**: HR → View All Leaves → Approve/Reject → Manage Leave Balances
- **Features**:
  - Leave approval dashboard
  - Leave balance management
  - Leave history tracking
  - Leave reports

#### **Permission Management**
- **Flow**: HR → View Permissions → Approve/Reject → Track History
- **Features**:
  - Permission approval
  - Permission tracking
  - Reports

#### **Request Management**
- **Flow**: HR → View Requests → Process → Update Status
- **Features**:
  - Request processing
  - Request tracking
  - Status management

#### **Week Offs**
- **Flow**: HR → Set Week Offs → Assign to Employees → Manage Dates
- **Features**:
  - Week off configuration
  - Employee assignment
  - Date management

#### **Employee Data**
- **Flow**: HR → Manage Employee Information → Update Details → Generate Letters
- **Features**:
  - Employee data management
  - Document generation
  - Data export

#### **Resigned Employees**
- **Flow**: HR → View Resigned List → Process Exit → Archive Data
- **Features**:
  - Resigned employee list
  - Exit processing
  - Data archival

---

### 💰 **4. Payroll Module**

#### **Payroll Structure**
- **Flow**: HR → Define Salary Structure → Assign to Employees → Calculate Payroll
- **Features**:
  - Salary component definition
  - Employee assignment
  - Structure management

#### **Generate Payroll**
- **Flow**: HR → Select Month → Generate Payslips → View/Unview Status → Employee Access
- **Features**:
  - Monthly payroll generation
  - Payslip creation
  - View/unview control (green/red border)
  - Previous 7 months display

#### **Payslip**
- **Flow**: Employee → View Payslip → Download/Email → View History
- **Features**:
  - Payslip viewing
  - PDF download
  - Email functionality
  - Payslip history

#### **Salary Management**
- **Flow**: HR → Manage Salary → Update Components → Calculate
- **Features**:
  - Salary management
  - Component updates
  - Calculation tools

#### **Tax Management**
- **Flow**: HR → Configure Tax Settings → Apply to Payroll
- **Features**:
  - Tax configuration
  - Tax calculations
  - Tax reports

---

### 📄 **5. Policy Management**

#### **Policy Upload & Viewing**
- **Flow**: HR Uploads Policy → Employee/Manager Views → Acknowledge → Track Read Status
- **Features**:
  - Policy upload (PDF)
  - Policy viewing with page navigation
  - Acknowledgment system
  - Read status tracking
  - Auto-display on dashboard for unread policies

---

### 🚪 **6. Visitor Management System (VMS)**

#### **Visitor Management**
- **Flow**: Receptionist → Add Visitor → Capture Image → Notify Employee → Visitor Entry/Exit
- **Features**:
  - Visitor registration
  - Image capture
  - Employee notification (WhatsApp/Email)
  - Visitor tracking
  - Visitor history

#### **Stationery Management**
- **Flow**: Admin/HR → Add Items → Issue to Employees → Track Stock
- **Features**:
  - Item management
  - Stock tracking
  - Issue management
  - Stock reports

#### **Event Management**
- **Flow**: Admin/HR → Create Event → Add Items → Manage Event
- **Features**:
  - Event creation
  - Item management
  - Event tracking

---

### 🏛️ **7. Company Management**

#### **Company Settings**
- **Flow**: Admin/HR → Configure Company Details → Update Settings → Manage Departments
- **Features**:
  - Company information
  - Department management
  - Settings configuration

---

### 💬 **8. Communication & AI**

#### **Chatbot**
- **Flow**: User → Ask Question → AI Responds → Get Information
- **Features**:
  - Natural language queries
  - Employee information lookup
  - Leave balance queries
  - Task information
  - System feature help

#### **Conversations**
- **Flow**: Users → Chat → Real-time Messaging → Notifications
- **Features**:
  - Real-time messaging
  - User conversations
  - Notification system

#### **Notifications**
- **Flow**: System Events → Generate Notification → User Receives → Mark as Read
- **Features**:
  - Real-time notifications
  - Notification history
  - Read/unread status

---

### 📊 **9. Dashboard**

#### **Dashboard Overview**
- **Flow**: User Logs In → Dashboard Displays → View Stats → Quick Actions
- **Features**:
  - Role-based dashboard
  - Statistics cards
  - Recent activities
  - Quick access to modules
  - Policy popup (if unread)
  - Attendance calendar
  - Birthday/anniversary reminders

---

## Key Workflows

### **Task Assignment Workflow**
1. Manager creates task
2. Assigns to employee(s)
3. Employee receives notification
4. Employee updates task status
5. Manager tracks progress
6. Task completion → Rating

### **Leave Approval Workflow**
1. Employee applies for leave
2. Manager receives notification
3. Manager approves/rejects
4. HR processes if needed
5. Leave balance updated
6. Employee notified

### **Payroll Generation Workflow**
1. HR generates payroll for month
2. System calculates salaries
3. Payslips created
4. HR sets view/unview status
5. Employees can view when "viewed"
6. Employees download/email payslips

### **Policy Acknowledgment Workflow**
1. HR uploads policy PDF
2. System notifies employees
3. Policy modal appears on dashboard
4. Employee reads all pages
5. Employee acknowledges
6. System tracks acknowledgment

### **Attendance Workflow**
1. Employee punches in (with location/image)
2. System records attendance
3. HR reviews attendance
4. Monthly attendance cycle
5. Salary calculation integration
6. Attendance reports

---

## Technical Stack

### **Frontend**
- React.js
- React Router
- Context API (Authentication)
- React Icons
- Recharts (Charts)
- React Hot Toast (Notifications)
- Framer Motion (Animations)

### **Backend**
- FastAPI (Python)
- SQLAlchemy (ORM)
- PostgreSQL (Database)
- JWT Authentication
- Email Scheduler
- WhatsApp API Integration
- Google Calendar API

### **Security**
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- JWT token-based authentication
- Role-based access control (RBAC)
- CORS configuration

---

## Data Flow

1. **User Authentication** → JWT Token → Role Assignment
2. **API Requests** → Authentication Check → Role Validation → Data Access
3. **Real-time Updates** → WebSocket/Notifications → UI Updates
4. **File Uploads** → Backend Storage → URL Generation → Frontend Display
5. **Reports** → Data Aggregation → Formatting → Export/Display

---

## Integration Points

- **Google Calendar**: Meeting scheduling and sync
- **WhatsApp API**: Visitor notifications
- **Email Service**: Notifications and reports
- **PDF Generation**: Payslips and documents
- **Image Storage**: Visitor images, attendance images
- **Location Services**: GPS-based punch in/out

---

## System Features Summary

✅ Role-based access control  
✅ Task & project management  
✅ Employee self-service portal  
✅ HR management suite  
✅ Payroll processing  
✅ Attendance tracking  
✅ Visitor management  
✅ Policy management  
✅ AI-powered chatbot  
✅ Real-time notifications  
✅ Reporting & analytics  
✅ Document generation  
✅ Email & WhatsApp integration  
✅ Google Calendar sync  
✅ Mobile-responsive design  

---

*Last Updated: 2025*

# Task Management System (TMS)

A comprehensive Task Management System with role-based access control for Admin, Manager, and Employee roles.

## 🚀 Features

### Roles & Permissions

- **Admin**: Full access to all features including Dashboard, Projects, Tasks, Meetings, Calendar, Reports, Users, Profile, Issues, and Ratings
- **Manager**: Access to Dashboard, Projects, Tasks, Meetings, Calendar, Reports, Users, Profile, Issues, and Ratings (limited to their team)
- **Employee**: Access to Dashboard, Tasks, Calendar, Meetings, Profile, Issues, and Ratings (own data only)

### Core Features

1. **Dashboard** - Overview with project stats, task progress, issue tracking, team counts, and meeting schedules
2. **Projects** - Create and manage projects with team assignments, progress tracking, and cost management
3. **Tasks** - Task creation, assignment, timer tracking, subtasks, comments, and progress updates
4. **Meetings** - Schedule meetings with automatic meeting link generation and notification support
5. **Calendar** - View scheduled meetings in a calendar format with upcoming 7-day view
6. **Reports** - Generate and download reports in Excel or PDF format with project/employee filters
7. **Users** - Manage users with role assignment and reporting hierarchy
8. **Profile** - View and edit personal profile, change password
9. **Issues** - Raise and track issues with priority and status management
10. **Ratings** - Rate employee performance on completed tasks

## 🛠️ Tech Stack

- **Backend**: Python (FastAPI)
- **Frontend**: React.js with Vite
- **Database**: PostgreSQL
- **Authentication**: JWT tokens
- **Charts**: Recharts
- **Animations**: Framer Motion

## 📦 Installation

### Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL 14+

### Database Setup

1. Create a PostgreSQL database:
```sql
CREATE DATABASE tms_db;
```

2. Update the database connection in `backend/env.example` and rename to `.env`:
```
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/tms_db
SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=7
```

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

## 🔑 Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin1 | admin123 |
| Admin | admin2 | admin123 |
| Manager | manager1 | manager123 |
| Employee | employee1 | employee123 |

## 📁 Project Structure

```
tmsnew/
├── backend/
│   ├── routes/
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── projects.py
│   │   ├── tasks.py
│   │   ├── meetings.py
│   │   ├── issues.py
│   │   ├── ratings.py
│   │   ├── dashboard.py
│   │   ├── reports.py
│   │   └── notifications.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── utils.py
│   ├── main.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx
│   │   │   └── Modal.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Projects.jsx
│   │   │   ├── ProjectDetails.jsx
│   │   │   ├── Tasks.jsx
│   │   │   ├── TaskDetails.jsx
│   │   │   ├── Meetings.jsx
│   │   │   ├── Calendar.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── Users.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── Issues.jsx
│   │   │   └── Ratings.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── styles/
│   │   │   └── index.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Users
- `GET /api/users` - Get all users
- `GET /api/users/{id}` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Deactivate user

### Projects
- `GET /api/projects` - Get all projects
- `GET /api/projects/{id}` - Get project by ID
- `GET /api/projects/{id}/details` - Get project with team and tasks
- `POST /api/projects` - Create project
- `PUT /api/projects/{id}` - Update project
- `POST /api/projects/{id}/team` - Add team member
- `DELETE /api/projects/{id}/team/{empid}` - Remove team member

### Tasks
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/{id}` - Get task by ID
- `GET /api/tasks/{id}/details` - Get task with subtasks, comments, timers
- `POST /api/tasks` - Create task
- `PUT /api/tasks/{id}` - Update task
- `POST /api/tasks/{id}/timer/start` - Start timer
- `POST /api/tasks/timer/{id}/stop` - Stop timer

### Meetings
- `GET /api/meetings` - Get all meetings
- `GET /api/meetings/today` - Get today's meetings
- `GET /api/meetings/upcoming` - Get upcoming meetings
- `GET /api/meetings/calendar` - Get calendar data
- `POST /api/meetings` - Create meeting

### Issues
- `GET /api/issues` - Get all issues
- `POST /api/issues` - Create issue
- `PUT /api/issues/{id}` - Update issue

### Ratings
- `GET /api/ratings` - Get all ratings
- `POST /api/ratings` - Create rating

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/activities` - Get recent activities

### Reports
- `GET /api/reports/filters` - Get filter options
- `POST /api/reports/generate` - Generate report
- `POST /api/reports/download/excel` - Download Excel
- `POST /api/reports/download/pdf` - Download PDF

## 🎨 UI Theme

The application uses a modern **Midnight Ocean** theme with:
- Dark background (`#0f172a`)
- Card backgrounds (`#1e293b`)
- Primary color (`#6366f1`)
- Accent colors for status indicators
- Smooth animations and transitions
- Responsive design for all screen sizes

## 📝 License

MIT License







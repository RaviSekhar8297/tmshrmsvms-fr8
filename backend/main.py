from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import engine, Base
import os

# Import routes
from routes import auth, users, projects, tasks, meetings, issues, ratings, dashboard, reports, notifications, calendar_auth, conversations, hr, vms, payroll, leaves, permissions, requests, holidays, work_reports, week_offs, company, policies, payslip_calculate, employee_data, letters, chatbot, loans

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Task Management System API",
    description="A comprehensive task management system with role-based access control",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:5173", 
        "http://127.0.0.1:3000", 
        "http://127.0.0.1:5173",
        "http://172.21.7.183:3000",  # Local system IP for network access
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(meetings.router, prefix="/api")
app.include_router(issues.router, prefix="/api")
app.include_router(ratings.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(calendar_auth.router, prefix="/api")
app.include_router(conversations.router, prefix="/api")
app.include_router(hr.router, prefix="/api")
app.include_router(vms.router, prefix="/api")
app.include_router(payroll.router, prefix="/api")
app.include_router(leaves.router, prefix="/api")
app.include_router(permissions.router, prefix="/api")
app.include_router(requests.router, prefix="/api")
app.include_router(holidays.router, prefix="/api")
app.include_router(work_reports.router, prefix="/api")
app.include_router(week_offs.router, prefix="/api")
app.include_router(company.router, prefix="/api")
app.include_router(policies.router, prefix="/api")
app.include_router(payslip_calculate.router, prefix="/api")
app.include_router(employee_data.router, prefix="/api")
app.include_router(letters.router, prefix="/api")
app.include_router(chatbot.router, prefix="/api")
app.include_router(loans.router, prefix="/api")

# Mount static files for uploaded policies
uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
if os.path.exists(uploads_dir):
    app.mount("/api/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.get("/")
def root():
    return {
        "message": "Task Management System API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

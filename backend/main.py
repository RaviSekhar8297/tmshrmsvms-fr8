from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from database import engine, Base
import os

# Import routes
from routes import auth, users, projects, tasks, meetings, issues, ratings, dashboard, reports, notifications, calendar_auth, conversations, hr, vms, payroll, leaves, permissions, requests, holidays, work_reports, week_offs, company, policies, payslip_calculate, employee_data, letters, chatbot, loans, resignations

# Import email scheduler
from utils.email_scheduler import start_email_scheduler

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Task Management System API",
    description="A comprehensive task management system with role-based access control",
    version="1.0.0"
)

# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Check if this is a docs endpoint - use more permissive CSP
        # FastAPI docs endpoints: /docs, /redoc, /openapi.json
        is_docs_endpoint = (
            request.url.path.startswith("/docs") or 
            request.url.path.startswith("/redoc") or 
            request.url.path.startswith("/openapi.json")
        )
        
        # Add security headers to all responses
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        # Content-Security-Policy: More restrictive but allows necessary features
        # Note: 'unsafe-inline' and 'unsafe-eval' are required for React/Vite build
        # In production, consider using nonces for better security
        if is_docs_endpoint:
            # More permissive CSP for Swagger UI docs
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://cdn.jsdelivr.net https://unpkg.com; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com; "
                "img-src 'self' data: https: blob:; "
                "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; "
                "connect-src 'self' https: wss: ws:; "
                "frame-src 'self' https://maps.googleapis.com; "
                "frame-ancestors 'self'; "
                "base-uri 'self'; "
                "form-action 'self'; "
                "object-src 'none'; "
                "upgrade-insecure-requests"
            )
        else:
            # Standard CSP for application endpoints
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "img-src 'self' data: https: blob:; "
                "font-src 'self' data: https://fonts.gstatic.com; "
                "connect-src 'self' https: wss: ws:; "
                "frame-src 'self' https://maps.googleapis.com; "
                "frame-ancestors 'self'; "
                "base-uri 'self'; "
                "form-action 'self'; "
                "object-src 'none'; "
                "upgrade-insecure-requests"
            )
        
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer-Policy: Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions-Policy: Allow necessary features for the application
        # geolocation: Required for punch in/out location tracking
        # camera: Required for selfie capture in attendance
        # microphone: Not currently used but may be needed for future features
        response.headers["Permissions-Policy"] = (
            "geolocation=(self), "
            "camera=(self), "
            "microphone=(self), "
            "payment=(), "
            "usb=(), "
            "magnetometer=(), "
            "gyroscope=(), "
            "accelerometer=()"
        )
        
        return response

# Add security headers middleware (should be added before CORS)
app.add_middleware(SecurityHeadersMiddleware)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:5173", 
        "http://127.0.0.1:3000", 
        "http://127.0.0.1:5173",
        "http://172.21.7.183:3000",  # Local system IP for network access
        "https://tms.brihaspathi.com",  # Production frontend
        "https://tmsbackend.brihaspathi.com",  # Production backend (if needed)
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
app.include_router(resignations.router, prefix="/api")

# Mount static files for uploaded files (policies, vms images, etc.)
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

# Start email scheduler on application startup
@app.on_event("startup")
async def startup_event():
    start_email_scheduler()
    print("Application started - Email scheduler is running")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

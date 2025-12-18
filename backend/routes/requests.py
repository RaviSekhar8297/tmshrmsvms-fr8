from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db
from models import Request, User
from routes.auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter()

class RequestCreate(BaseModel):
    type: str
    subject: str
    description: str
    intime: Optional[str] = None
    outtime: Optional[str] = None

class RequestStatusUpdate(BaseModel):
    status: str

@router.post("/requests")
def create_request(
    request_data: RequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a request"""
    intime = None
    outtime = None
    
    if request_data.intime:
        try:
            intime = datetime.fromisoformat(request_data.intime.replace('Z', '+00:00'))
        except:
            pass
    
    if request_data.outtime:
        try:
            outtime = datetime.fromisoformat(request_data.outtime.replace('Z', '+00:00'))
        except:
            pass
    
    new_request = Request(
        empid=current_user.empid,
        name=current_user.name,
        applied_date=datetime.utcnow(),
        type=request_data.type,
        subject=request_data.subject,
        description=request_data.description,
        intime=intime,
        outtime=outtime,
        status='pending'
    )
    
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    
    return {
        "message": "Request submitted successfully",
        "id": new_request.id
    }

@router.get("/requests/self")
def get_self_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get own requests"""
    requests = db.query(Request).filter(
        Request.empid == current_user.empid
    ).order_by(Request.applied_date.desc()).all()
    
    return [
        {
            "id": req.id,
            "empid": req.empid,
            "name": req.name,
            "applied_date": req.applied_date.isoformat(),
            "type": req.type,
            "subject": req.subject,
            "description": req.description,
            "intime": req.intime.isoformat() if req.intime else None,
            "outtime": req.outtime.isoformat() if req.outtime else None,
            "status": req.status,
            "approved_by": req.approved_by,
        }
        for req in requests
    ]

@router.get("/requests")
def get_all_requests(
    filter: Optional[str] = "all",
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all requests"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = db.query(Request)
    
    if employee_id:
        query = query.filter(Request.empid == employee_id)
    
    if filter != "all":
        query = query.filter(Request.status == filter)
    
    requests = query.order_by(Request.applied_date.desc()).all()
    
    return [
        {
            "id": req.id,
            "empid": req.empid,
            "name": req.name,
            "applied_date": req.applied_date.isoformat(),
            "type": req.type,
            "subject": req.subject,
            "description": req.description,
            "intime": req.intime.isoformat() if req.intime else None,
            "outtime": req.outtime.isoformat() if req.outtime else None,
            "status": req.status,
            "approved_by": req.approved_by,
        }
        for req in requests
    ]

@router.put("/requests/{request_id}")
def update_request_status(
    request_id: int,
    status_data: RequestStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve or reject request"""
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if status_data.status not in ["approved", "rejected", "completed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    request.status = status_data.status
    request.approved_by = current_user.empid
    
    db.commit()
    db.refresh(request)
    
    return {
        "message": f"Request {status_data.status} successfully",
        "id": request.id
    }


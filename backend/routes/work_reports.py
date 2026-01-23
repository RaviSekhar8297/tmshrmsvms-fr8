from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, date
from database import get_db
from models import TodayWorkReport, User
from routes.auth import get_current_user
from typing import Optional, List, Dict, Any

router = APIRouter(prefix="/work-reports", tags=["Work Reports"])

@router.get("/self")
def get_self_work_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get own work reports"""
    try:
        # Convert empid to int - handle both string and int formats
        empid_str = str(current_user.empid).strip()
        # Remove BT- prefix if present
        if empid_str.startswith('BT-'):
            empid_str = empid_str[3:]
        
        try:
            empid_int = int(empid_str)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid employee ID")
        
        reports = db.query(TodayWorkReport).filter(
            TodayWorkReport.empid == empid_int
        ).order_by(TodayWorkReport.work_date.desc()).all()
        
        # Get all users for reported_to lookup
        all_users = db.query(User).all()
        users_map = {u.id: u for u in all_users}
        
        result = []
        for report in reports:
            # Get reported_to user info
            reported_to_user = None
            if report.reported_to:
                reported_to_user = users_map.get(report.reported_to)
            
            result.append({
                "report_id": report.report_id,
                "empid": report.empid,
                "work_date": report.work_date.isoformat() if report.work_date else None,
                "works": report.works if report.works else [],
                "status": report.status,
                "reported_to": report.reported_to,
                "reported_to_name": reported_to_user.name if reported_to_user else None,
                "reported_to_empid": reported_to_user.empid if reported_to_user else None,
                "employee_remarks": report.employee_remarks,
                "manager_remarks": report.manager_remarks,
                "created_at": report.created_at.isoformat() if report.created_at else None,
                "updated_at": report.updated_at.isoformat() if report.updated_at else None
            })
        
        return result
    except Exception as e:
        print(f"Error fetching work reports: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching work reports: {str(e)}")

@router.post("/")
def create_work_report(
    report_data: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new work report"""
    try:
        # Convert empid to int - handle both string and int formats
        empid_str = str(current_user.empid).strip()
        # Remove BT- prefix if present
        if empid_str.startswith('BT-'):
            empid_str = empid_str[3:]
        
        try:
            empid_int = int(empid_str)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid employee ID")
        
        # Validate required fields
        if not report_data.get("work_date"):
            raise HTTPException(status_code=400, detail="work_date is required")
        if not report_data.get("works") or not isinstance(report_data["works"], list):
            raise HTTPException(status_code=400, detail="works must be a non-empty array")
        
        # Parse work_date
        work_date = datetime.fromisoformat(report_data["work_date"]).date() if isinstance(report_data["work_date"], str) else report_data["work_date"]
        
        # Check if report already exists for this date
        existing = db.query(TodayWorkReport).filter(
            and_(
                TodayWorkReport.empid == empid_int,
                TodayWorkReport.work_date == work_date
            )
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="Work report already exists for this date")
        
        # Validate works array structure
        for work in report_data["works"]:
            if not work.get("work_name"):
                raise HTTPException(status_code=400, detail="Each work item must have work_name")
            hours_spent = work.get("hours_spent")
            if hours_spent is None or hours_spent < 0 or hours_spent > 16:
                raise HTTPException(status_code=400, detail="Each work item must have hours_spent between 0 and 16")
        
        # Get reported_to from user's report_to_id if not provided
        reported_to_id = report_data.get("reported_to")
        if not reported_to_id and current_user.report_to_id:
            # Find user by report_to_id (empid)
            report_to_user = db.query(User).filter(User.empid == current_user.report_to_id).first()
            if report_to_user:
                reported_to_id = report_to_user.id
        
        # Create new report
        new_report = TodayWorkReport(
            empid=empid_int,
            work_date=work_date,
            works=report_data["works"],
            status=report_data.get("status", "PENDING"),
            reported_to=reported_to_id,
            employee_remarks=report_data.get("employee_remarks")
        )
        
        db.add(new_report)
        db.commit()
        db.refresh(new_report)
        
        return {
            "message": "Work report created successfully",
            "report_id": new_report.report_id
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error creating work report: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error creating work report: {str(e)}")

@router.put("/{report_id}")
def update_work_report(
    report_id: int,
    report_data: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a work report"""
    try:
        # Convert empid to int - handle both string and int formats
        empid_str = str(current_user.empid).strip()
        # Remove BT- prefix if present
        if empid_str.startswith('BT-'):
            empid_str = empid_str[3:]
        
        try:
            empid_int = int(empid_str)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid employee ID")
        
        report = db.query(TodayWorkReport).filter(
            and_(
                TodayWorkReport.report_id == report_id,
                TodayWorkReport.empid == empid_int
            )
        ).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Work report not found")
        
        # Update fields
        if "works" in report_data:
            if not isinstance(report_data["works"], list) or len(report_data["works"]) == 0:
                raise HTTPException(status_code=400, detail="works must be a non-empty array")
            report.works = report_data["works"]
        
        if "status" in report_data:
            if report_data["status"] not in ["PENDING", "COMPLETED", "INPROGRESS"]:
                raise HTTPException(status_code=400, detail="Invalid status")
            report.status = report_data["status"]
        
        if "employee_remarks" in report_data:
            report.employee_remarks = report_data["employee_remarks"]
        
        # Handle reported_to - get from user's report_to_id if not provided
        if "reported_to" in report_data:
            reported_to_id = report_data["reported_to"]
            if not reported_to_id and current_user.report_to_id:
                # Find user by report_to_id (empid)
                report_to_user = db.query(User).filter(User.empid == current_user.report_to_id).first()
                if report_to_user:
                    reported_to_id = report_to_user.id
            report.reported_to = reported_to_id
        
        db.commit()
        db.refresh(report)
        
        return {
            "message": "Work report updated successfully",
            "report_id": report.report_id
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error updating work report: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error updating work report: {str(e)}")

@router.delete("/{report_id}")
def delete_work_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a work report"""
    try:
        # Convert empid to int - handle both string and int formats
        empid_str = str(current_user.empid).strip()
        # Remove BT- prefix if present
        if empid_str.startswith('BT-'):
            empid_str = empid_str[3:]
        
        try:
            empid_int = int(empid_str)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid employee ID")
        
        report = db.query(TodayWorkReport).filter(
            and_(
                TodayWorkReport.report_id == report_id,
                TodayWorkReport.empid == empid_int
            )
        ).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Work report not found")
        
        db.delete(report)
        db.commit()
        
        return {"message": "Work report deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error deleting work report: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error deleting work report: {str(e)}")

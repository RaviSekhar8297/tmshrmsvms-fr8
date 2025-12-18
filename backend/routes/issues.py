from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from database import get_db
from models import Issue, User, Activity
from schemas import IssueCreate, IssueUpdate, IssueResponse
from routes.auth import get_current_user
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/issues", tags=["Issues"])

@router.get("/", response_model=List[IssueResponse])
def get_issues(
    status: str = None,
    priority: str = None,
    project_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        query = db.query(Issue)
        
        if status:
            if status == "delayed":
                # Delayed issues are open or in-progress for more than 7 days
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=7)
                query = query.filter(
                    or_(Issue.status == "open", Issue.status == "in-progress"),
                    Issue.created_at < cutoff_date
                )
            else:
                query = query.filter(Issue.status == status)
        if priority:
            query = query.filter(Issue.priority == priority)
        if project_id:
            query = query.filter(Issue.project_id == project_id)
        
        # Filter based on role
        if current_user.role == "Employee":
            query = query.filter(
                or_(
                    Issue.raised_by == current_user.id,
                    Issue.assigned_to == current_user.id
                )
            )
        elif current_user.role == "Manager":
            team_ids = [u.id for u in db.query(User).filter(User.report_to_id == current_user.empid).all()]
            team_ids.append(current_user.id)
            query = query.filter(
                or_(
                    Issue.raised_by.in_(team_ids) if team_ids else False,
                    Issue.assigned_to.in_(team_ids) if team_ids else False
                )
            )
        
        issues = query.order_by(Issue.created_at.desc()).all()
        
        # Add delayed flag to issues for frontend
        now = datetime.now(timezone.utc)
        for issue in issues:
            if issue.status in ["open", "in-progress"] and issue.created_at:
                # Ensure both datetimes are timezone-aware for comparison
                issue_created = issue.created_at
                if issue_created.tzinfo is None:
                    # If naive, assume UTC
                    issue_created = issue_created.replace(tzinfo=timezone.utc)
                elif issue_created.tzinfo != timezone.utc:
                    # Convert to UTC if different timezone
                    issue_created = issue_created.astimezone(timezone.utc)
                
                days_old = (now - issue_created).days
                issue.is_delayed = days_old > 7
                issue.days_old = days_old
            else:
                issue.is_delayed = False
                issue.days_old = 0
        
        return issues
    except Exception as e:
        print(f"Error in get_issues: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching issues: {str(e)}")

@router.get("/stats")
def get_issue_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        query = db.query(Issue)
        
        if current_user.role == "Employee":
            query = query.filter(
                or_(
                    Issue.raised_by == current_user.id,
                    Issue.assigned_to == current_user.id
                )
            )
        elif current_user.role == "Manager":
            team_ids = [u.id for u in db.query(User).filter(User.report_to_id == current_user.empid).all()]
            team_ids.append(current_user.id)
            query = query.filter(
                or_(
                    Issue.raised_by.in_(team_ids) if team_ids else False,
                    Issue.assigned_to.in_(team_ids) if team_ids else False
                )
            )
        
        issues = query.all()
        
        total = len(issues)
        open_issues = sum(1 for i in issues if i.status == "open")
        in_progress = sum(1 for i in issues if i.status == "in-progress")
        resolved = sum(1 for i in issues if i.status == "resolved")
        closed = sum(1 for i in issues if i.status == "closed")
        
        # Calculate delayed issues (open or in-progress for more than 7 days)
        now = datetime.now(timezone.utc)
        delayed_issues = 0
        for i in issues:
            if i.status in ["open", "in-progress"] and i.created_at:
                # Ensure both datetimes are timezone-aware for comparison
                issue_created = i.created_at
                if issue_created.tzinfo is None:
                    # If naive, assume UTC
                    issue_created = issue_created.replace(tzinfo=timezone.utc)
                elif issue_created.tzinfo != timezone.utc:
                    # Convert to UTC if different timezone
                    issue_created = issue_created.astimezone(timezone.utc)
                
                if (now - issue_created).days > 7:
                    delayed_issues += 1
        
        return {
            "total": total,
            "open": open_issues,
            "in_progress": in_progress,
            "resolved": resolved,
            "closed": closed,
            "delayed": delayed_issues,
            "pending": open_issues + in_progress
        }
    except Exception as e:
        print(f"Error in get_issue_stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching issue stats: {str(e)}")

@router.get("/{issue_id}", response_model=IssueResponse)
def get_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue

@router.post("/", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
def create_issue(
    issue_data: IssueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    issue = Issue(
        title=issue_data.title,
        description=issue_data.description,
        priority=issue_data.priority,
        status="open",
        project_id=issue_data.project_id,
        task_id=issue_data.task_id,
        raised_by=current_user.id,
        raised_by_name=current_user.name
    )
    
    db.add(issue)
    db.commit()
    db.refresh(issue)
    
    # Log activity
    activity = Activity(
        user_id=current_user.id,
        user_name=current_user.name,
        action="raised",
        entity_type="issue",
        entity_id=issue.id,
        entity_name=issue.title,
        details=f"Raised issue: {issue.title}"
    )
    db.add(activity)
    db.commit()
    
    return issue

@router.put("/{issue_id}", response_model=IssueResponse)
def update_issue(
    issue_id: int,
    issue_data: IssueUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    update_data = issue_data.model_dump(exclude_unset=True)
    
    # Update assigned_to_name if assigned_to changed
    if "assigned_to" in update_data and update_data["assigned_to"]:
        assignee = db.query(User).filter(User.id == update_data["assigned_to"]).first()
        if assignee:
            update_data["assigned_to_name"] = assignee.name
    
    # Set resolved_at if status changed to resolved
    if "status" in update_data and update_data["status"] == "resolved":
        update_data["resolved_at"] = datetime.now(timezone.utc)
    
    for key, value in update_data.items():
        if value is not None:
            setattr(issue, key, value)
    
    issue.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(issue)
    
    # Log activity
    activity = Activity(
        user_id=current_user.id,
        user_name=current_user.name,
        action="updated",
        entity_type="issue",
        entity_id=issue.id,
        entity_name=issue.title,
        details=f"Updated issue: {issue.title}"
    )
    db.add(activity)
    db.commit()
    
    return issue

@router.delete("/{issue_id}")
def delete_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "Employee":
        raise HTTPException(status_code=403, detail="Employees cannot delete issues")
    
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    db.delete(issue)
    db.commit()
    
    return {"message": "Issue deleted successfully"}



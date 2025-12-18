from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, cast
from sqlalchemy.dialects.postgresql import JSONB
from typing import List
from database import get_db
from models import Project, User, Task, Activity
from schemas import ProjectCreate, ProjectUpdate, ProjectResponse
from routes.auth import get_current_user
from utils import is_admin_or_hr
from datetime import datetime

router = APIRouter(prefix="/projects", tags=["Projects"])

def check_admin_or_manager(current_user: User):
    if current_user.role not in ["Admin", "Manager", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied")

@router.get("/", response_model=List[ProjectResponse])
def get_projects(
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        query = db.query(Project)
        
        if status:
            query = query.filter(Project.status == status)
        
        # Filter based on role
        if current_user.role == "Manager":
            query = query.filter(Project.project_head_id == current_user.id)
        elif current_user.role == "Employee":
            # Employee can see projects where they are in the team
            # Handle None or empty teams
            query = query.filter(
                or_(
                    Project.teams.is_(None),
                    cast(Project.teams, JSONB).contains([{"empid": current_user.empid}])
                )
            )
        
        projects = query.order_by(Project.created_at.desc()).all()
        
        # Enrich teams with latest user images and calculate delayed days
        today = datetime.now().date()
        for project in projects:
            if project.teams:
                enriched_teams = []
                for member in project.teams:
                    if isinstance(member, dict) and member.get("empid"):
                        user = db.query(User).filter(User.empid == member.get("empid")).first()
                        if user:
                            enriched_teams.append({
                                "empid": user.empid,
                                "name": user.name,
                                "role": user.role,
                                "image_base64": user.image_base64
                            })
                        else:
                            enriched_teams.append(member)
                    else:
                        enriched_teams.append(member)
                project.teams = enriched_teams
            else:
                project.teams = []
            
            # Calculate delayed days
            if project.end_date and project.status != "completed":
                end_date = project.end_date
                if isinstance(end_date, datetime):
                    end_date = end_date.date()
                elif isinstance(end_date, str):
                    from datetime import datetime as dt
                    end_date = dt.fromisoformat(end_date).date()
                if end_date < today:
                    project.is_delayed = True
                    project.delayed_days = (today - end_date).days
                else:
                    project.is_delayed = False
                    project.delayed_days = 0
            else:
                project.is_delayed = False
                project.delayed_days = 0
        
        return projects
    except Exception as e:
        print(f"Error in get_projects: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching projects: {str(e)}")

@router.get("/stats")
def get_project_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        query = db.query(Project)
        
        if current_user.role == "Manager":
            query = query.filter(Project.project_head_id == current_user.id)
        elif current_user.role == "Employee":
            query = query.filter(
                or_(
                    Project.teams.is_(None),
                    cast(Project.teams, JSONB).contains([{"empid": current_user.empid}])
                )
            )
        
        projects = query.all()
        
        total = len(projects)
        planning = sum(1 for p in projects if p.status == "planning")
        active = sum(1 for p in projects if p.status == "active")
        on_hold = sum(1 for p in projects if p.status == "on-hold")
        completed = sum(1 for p in projects if p.status == "completed")
        
        return {
            "total": total,
            "planning": planning,
            "active": active,
            "on_hold": on_hold,
            "completed": completed
        }
    except Exception as e:
        print(f"Error in get_project_stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching project stats: {str(e)}")

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return project

@router.get("/{project_id}/details")
def get_project_details(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get complete project details including tasks, team members"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get tasks
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    
    # Get team members details
    team_members = []
    if project.teams:
        for member in project.teams:
            user = db.query(User).filter(User.empid == member.get("empid")).first()
            if user:
                team_members.append({
                    "id": user.id,
                    "empid": user.empid,
                    "name": user.name,
                    "email": user.email,
                    "role": user.role,
                    "image_base64": user.image_base64
                })
    
    # Task stats
    task_stats = {
        "total": len(tasks),
        "todo": sum(1 for t in tasks if t.status == "todo"),
        "in_progress": sum(1 for t in tasks if t.status == "in-progress"),
        "completed": sum(1 for t in tasks if t.status == "done"),
        "blocked": sum(1 for t in tasks if t.status == "blocked")
    }
    
    return {
        "project": ProjectResponse.model_validate(project),
        "tasks": tasks,
        "team_members": team_members,
        "task_stats": task_stats
    }

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_or_manager(current_user)
    
    # Get project head name
    project_head_name = None
    if project_data.project_head_id:
        head = db.query(User).filter(User.id == project_data.project_head_id).first()
        if head:
            project_head_name = head.name
    
    project = Project(
        name=project_data.name,
        description=project_data.description,
        start_date=project_data.start_date,
        end_date=project_data.end_date,
        estimated_days=project_data.estimated_days,
        priority=project_data.priority,
        status="planning",
        created_by=current_user.id,
        created_by_name=current_user.name,
        project_head_id=project_data.project_head_id,
        project_head_name=project_head_name,
        teams=project_data.teams or [],
        project_cost=project_data.project_cost
    )
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # Log activity
    activity = Activity(
        user_id=current_user.id,
        user_name=current_user.name,
        action="created",
        entity_type="project",
        entity_id=project.id,
        entity_name=project.name,
        details=f"Created new project: {project.name}"
    )
    db.add(activity)
    db.commit()
    
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_or_manager(current_user)
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Manager can only update their projects
    if current_user.role == "Manager" and project.project_head_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = project_data.model_dump(exclude_unset=True)
    
    # Update project head name if changed
    if "project_head_id" in update_data and update_data["project_head_id"]:
        head = db.query(User).filter(User.id == update_data["project_head_id"]).first()
        if head:
            update_data["project_head_name"] = head.name
    
    for key, value in update_data.items():
        if value is not None:
            setattr(project, key, value)
    
    db.commit()
    db.refresh(project)
    
    # Log activity
    activity = Activity(
        user_id=current_user.id,
        user_name=current_user.name,
        action="updated",
        entity_type="project",
        entity_id=project.id,
        entity_name=project.name,
        details=f"Updated project: {project.name}"
    )
    db.add(activity)
    db.commit()
    
    return project

@router.post("/{project_id}/team")
def add_team_member(
    project_id: int,
    empid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_or_manager(current_user)
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    user = db.query(User).filter(User.empid == empid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    teams = list(project.teams) if project.teams else []
    
    # Check if already in team
    if any(m.get("empid") == empid for m in teams):
        raise HTTPException(status_code=400, detail="User already in team")
    
    teams.append({
        "empid": user.empid,
        "name": user.name,
        "role": user.role,
        "image_base64": user.image_base64
    })
    
    project.teams = teams
    db.commit()
    
    return {"message": "Team member added", "teams": teams}

@router.delete("/{project_id}/team/{empid}")
def remove_team_member(
    project_id: int,
    empid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_or_manager(current_user)
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    teams = [m for m in project.teams if m.get("empid") != empid]
    project.teams = teams
    db.commit()
    
    return {"message": "Team member removed", "teams": teams}

@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Only Admin or HR can delete projects")
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(project)
    db.commit()
    
    return {"message": "Project deleted successfully"}



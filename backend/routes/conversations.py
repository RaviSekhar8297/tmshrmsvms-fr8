from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import cast, or_
from typing import List
import json
from database import get_db
from models import ProjectMessage, Project, User
from schemas import ProjectMessageCreate, ProjectMessageResponse
from routes.auth import get_current_user

router = APIRouter(prefix="/conversations", tags=["Conversations"])


def _normalize_teams(raw_teams):
    """
    Ensure teams is returned as a list of dicts even if stored as a JSON string or dict.
    """
    if not raw_teams:
        return []

    # If it's a string, try to json.loads it
    if isinstance(raw_teams, str):
        try:
            parsed = json.loads(raw_teams)
            raw_teams = parsed
        except Exception:
            return []

    # If it's a dict (rare), take values
    if isinstance(raw_teams, dict):
        return [v for v in raw_teams.values() if isinstance(v, dict)]

    # If it's a list, filter to dict entries
    if isinstance(raw_teams, list):
        return [m for m in raw_teams if isinstance(m, dict)]

    return []

@router.get("/projects", response_model=List[dict])
def get_user_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all projects where the user is a team member"""
    try:
        if current_user.role == "Admin":
            # Admin: include all projects (even completed) so conversations remain visible
            projects = db.query(Project).order_by(Project.created_at.desc()).all()
        elif current_user.role == "Manager":
            # Manager: created, project head, or in teams (teams may be JSON string)
            user_empid_raw = str(current_user.empid).strip()
            user_empid_normalized = user_empid_raw.lower()

            projects = []
            project_ids = set()

            # First: DB-level filter on created/project_head
            base_projects = db.query(Project).filter(
                or_(
                    Project.created_by == current_user.id,
                    Project.project_head_id == current_user.id
                )
            ).order_by(Project.created_at.desc()).all()
            for p in base_projects:
                project_ids.add(p.id)
                projects.append(p)

            # Second: DB-level JSONB contains (may fail if teams stored as string)
            try:
                team_projects = db.query(Project).filter(
                    cast(Project.teams, JSONB).contains([{"empid": user_empid_raw}])
                ).order_by(Project.created_at.desc()).all()
                for p in team_projects:
                    if p.id not in project_ids:
                        project_ids.add(p.id)
                        projects.append(p)
            except Exception as e:
                print(f"Manager JSONB contains failed, will fallback: {e}")

            # Manual fallback scan to catch string-encoded teams
            all_projects = db.query(Project).order_by(Project.created_at.desc()).all()
            for p in all_projects:
                if p.id in project_ids:
                    continue
                teams = _normalize_teams(p.teams)
                for member in teams:
                    member_empid = member.get("empid")
                    if member_empid and str(member_empid).strip().lower() == user_empid_normalized:
                        project_ids.add(p.id)
                        projects.append(p)
                        break
        else:
            # Employee - manual, tolerant filtering to avoid JSONB edge cases and string-encoded teams
            user_empid_raw = str(current_user.empid).strip()
            user_empid_normalized = user_empid_raw.lower()

            all_projects = db.query(Project).order_by(Project.created_at.desc()).all()
            projects = []

            for project in all_projects:
                project_teams = _normalize_teams(project.teams)

                # Project head
                if project.project_head_id == current_user.id:
                    projects.append(project)
                    continue

                # Teams as list
                if project_teams:
                    for member in project_teams:
                        member_empid = member.get("empid")
                        if member_empid and str(member_empid).strip().lower() == user_empid_normalized:
                            projects.append(project)
                            break
        
        result = []
        print(f"\n=== BUILDING RESPONSE ===")
        print(f"Processing {len(projects)} projects for response...")
        
        for project in projects:
            try:
                # Get last message
                last_message = db.query(ProjectMessage).filter(
                    ProjectMessage.project_id == project.id
                ).order_by(ProjectMessage.created_at.desc()).first()
                
                # Get team members
                normalized_teams = _normalize_teams(project.teams)
                team_members = []
                for member in normalized_teams:
                    member_empid = member.get("empid")
                    if not member_empid:
                        continue
                    try:
                        # Query by empid (exact match, case-sensitive for database)
                        user = db.query(User).filter(User.empid == str(member_empid).strip()).first()
                        if user:
                            team_members.append({
                                "empid": user.empid,
                                "id": user.id,
                                "name": user.name,
                                "image_base64": user.image_base64,
                                "role": user.role
                            })
                        else:
                            # Fallback to minimal data from teams entry
                            team_members.append({
                                "empid": str(member_empid).strip(),
                                "id": None,
                                "name": member.get("name") or "",
                                "image_base64": member.get("image_base64"),
                                "role": member.get("role")
                            })
                    except Exception as e:
                        print(f"Error fetching user {member_empid}: {e}")
                        continue
                
                project_data = {
                    "id": project.id,
                    "name": project.name,
                    "description": project.description or "",
                    "status": project.status,
                    "created_at": project.created_at.isoformat() if project.created_at else None,
                    "created_by": project.created_by,
                    "created_by_name": project.created_by_name,
                    "project_head_id": project.project_head_id,
                    "project_head_name": project.project_head_name,
                    "teams": normalized_teams,
                    "team_members": team_members,
                    "last_message": {
                        "message": last_message.message if last_message else None,
                        "created_at": last_message.created_at.isoformat() if last_message and last_message.created_at else None,
                        "user_name": last_message.user_name if last_message else None
                    } if last_message else None
                }
                result.append(project_data)
                print(f"  Added project {project.id}: {project.name} (status: {project.status}, team_members: {len(team_members)})")
            except Exception as e:
                print(f"ERROR processing project {project.id}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"\n=== FINAL RESULT ===")
        print(f"Returning {len(result)} projects to frontend")
        if len(result) == 0:
            print("⚠️ WARNING: No projects returned! Check if user empid is correctly in project teams.")
        else:
            print(f"Projects being returned: {[p['name'] for p in result]}")
        print(f"=== END RESPONSE BUILDING ===\n")
        
        return result
    except Exception as e:
        print(f"ERROR in get_user_projects: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching projects: {str(e)}")

@router.get("/projects/{project_id}/messages", response_model=List[ProjectMessageResponse])
def get_project_messages(
    project_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get messages for a specific project"""
    # Check if user has access to this project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check access - all team members should have access
    has_access = False
    if current_user.role == "Admin":
        has_access = True
    elif current_user.role == "Manager":
        has_access = (project.created_by == current_user.id or project.project_head_id == current_user.id)
        # Also check if manager is in team
        user_empid = str(current_user.empid).strip()
        if not has_access and project.teams and isinstance(project.teams, list):
            for member in project.teams:
                if isinstance(member, dict):
                    member_empid = member.get("empid")
                    if member_empid and str(member_empid).strip() == user_empid:
                        has_access = True
                        break
    else:
        # Employee - check if:
        # 1. User is project head (project_head_id == user.id), OR
        # 2. User's empid is in teams array
        has_access = (project.project_head_id == current_user.id)
        if not has_access:
            user_empid = str(current_user.empid).strip()
            if project.teams and isinstance(project.teams, list):
                for member in project.teams:
                    if isinstance(member, dict):
                        member_empid = member.get("empid")
                        if member_empid and str(member_empid).strip() == user_empid:
                            has_access = True
                            break
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    messages = db.query(ProjectMessage).filter(
        ProjectMessage.project_id == project_id
    ).order_by(ProjectMessage.created_at.asc()).limit(limit).all()
    
    return messages

@router.post("/projects/{project_id}/messages", response_model=ProjectMessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    project_id: int,
    message_data: ProjectMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a message to a project conversation"""
    # Verify project exists and user has access
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check access - all team members should have access
    has_access = False
    if current_user.role == "Admin":
        has_access = True
    elif current_user.role == "Manager":
        has_access = (project.created_by == current_user.id or project.project_head_id == current_user.id)
        # Also check if manager is in team
        user_empid = str(current_user.empid).strip()
        if not has_access and project.teams and isinstance(project.teams, list):
            for member in project.teams:
                if isinstance(member, dict):
                    member_empid = member.get("empid")
                    if member_empid and str(member_empid).strip() == user_empid:
                        has_access = True
                        break
    else:
        # Employee - check if:
        # 1. User is project head (project_head_id == user.id), OR
        # 2. User's empid is in teams array
        has_access = (project.project_head_id == current_user.id)
        if not has_access:
            user_empid = str(current_user.empid).strip()
            if project.teams and isinstance(project.teams, list):
                for member in project.teams:
                    if isinstance(member, dict):
                        member_empid = member.get("empid")
                        if member_empid and str(member_empid).strip() == user_empid:
                            has_access = True
                            break
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    # Create message (text only, no images)
    message = ProjectMessage(
        project_id=project_id,
        user_id=current_user.id,
        user_name=current_user.name,
        user_image_base64=current_user.image_base64,
        message=message_data.message,
        image_base64=None  # No images, text onlyl
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    return message


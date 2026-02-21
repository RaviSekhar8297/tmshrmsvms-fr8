from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import and_, or_
from typing import List, Dict, Any
from database import get_db
from models import User, Activity, Company, Branch, Department
from schemas import UserCreate, UserUpdate, UserResponse
from utils import hash_password, generate_empid, is_admin_or_hr
from routes.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/users", tags=["Users"])

def check_admin_or_manager(current_user: User):
    if current_user.role not in ["Admin", "Manager", "HR", "Front Desk"]:
        raise HTTPException(status_code=403, detail="Access denied")

@router.get("/contacts", response_model=List[UserResponse])
def get_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get contact details - accessible to all authenticated users"""
    # Limit to 500 users for performance
    users = db.query(User).filter(User.is_active == True).order_by(User.name).limit(500).all()
    return users

@router.get("/", response_model=List[UserResponse])
def get_users(
    role: str = None,
    is_active: bool = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_or_manager(current_user)
    
    query = db.query(User)
    
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    # Front Desk can see all active users (for "Whom to Meet" dropdown)
    if current_user.role == "Front Desk":
        query = query.filter(User.is_active == True)
    # Manager can only see employees reporting to them, HR and Admin can see all
    elif current_user.role == "Manager" and not is_admin_or_hr(current_user):
        query = query.filter(
            (User.report_to_id == current_user.empid) | (User.id == current_user.id)
        )
    
    # Limit to 500 users for performance
    return query.order_by(User.created_at.desc()).limit(500).all()

def _get_all_subordinate_users(db: Session, manager_empid: str, _visited: set = None) -> List[User]:
    """Returns all direct and indirect subordinate User rows for a manager (under of under)."""
    if not manager_empid:
        return []
    if _visited is None:
        _visited = set()
    empid_str = str(manager_empid).strip()
    if empid_str in _visited:
        return []
    _visited.add(empid_str)
    result = []
    direct_reports = db.query(User).filter(
        User.report_to_id == empid_str,
        User.is_active == True
    ).all()
    for r in direct_reports:
        result.append(r)
        for sub in _get_all_subordinate_users(db, r.empid, _visited):
            if sub not in result:
                result.append(sub)
    return result


@router.get("/subordinates", response_model=List[UserResponse])
def get_subordinates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all subordinate users (direct + indirect, e.g. 1027 and 1460 under 1541). For Manager only."""
    if current_user.role != "Manager":
        return []
    subs = _get_all_subordinate_users(db, current_user.empid)
    return subs


@router.get("/employees", response_model=List[UserResponse])
def get_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all employees for assignment"""
    query = db.query(User).filter(User.is_active == True)
    
    if current_user.role == "Manager":
        query = query.filter(User.report_to_id == current_user.empid)
    elif current_user.role == "Employee":
        return [current_user]
    
    # Limit employees query to 500 for performance
    return query.order_by(User.name).limit(500).all()

@router.get("/managers", response_model=List[UserResponse])
def get_managers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all managers for project assignment"""
    check_admin_or_manager(current_user)
    return db.query(User).filter(
        User.role == "Manager",
        User.is_active == True
    ).order_by(User.name).all()

@router.get("/hierarchy", response_model=List[UserResponse])
def get_hierarchy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all users for hierarchy display - accessible to all roles"""
    try:
        query = db.query(User).filter(User.is_active == True)
        
        # All roles can see hierarchy, but filter based on role
        if current_user.role == "Manager":
            # Manager can see their team and up the chain
            filter_conditions = [
                User.report_to_id == current_user.empid,
                User.id == current_user.id,
                User.empid == '101'  # Always show root
            ]
            # Only add report_to_id condition if it exists
            if current_user.report_to_id:
                filter_conditions.append(User.empid == current_user.report_to_id)
            query = query.filter(or_(*filter_conditions))
        elif current_user.role == "Employee":
            # Employee can see their manager chain and colleagues
            # Get their manager and up
            manager_chain = []
            current = current_user
            visited = set()
            # Limit manager chain depth to prevent infinite loops and improve performance
            max_depth = 10
            depth = 0
            while current and current.report_to_id and current.report_to_id not in visited and depth < max_depth:
                visited.add(current.report_to_id)
                manager = db.query(User).filter(User.empid == current.report_to_id).first()
                if manager:
                    manager_chain.append(manager.empid)
                    current = manager
                    depth += 1
                else:
                    break
            
            # Include root, manager chain, and employees under same manager
            empids_to_show = ['101'] + manager_chain + [current_user.empid]
            if current_user.report_to_id:
                # Get colleagues (same manager) - limit to 200 for performance
                colleagues = db.query(User).filter(
                    and_(
                        User.report_to_id == current_user.report_to_id,
                        User.is_active == True
                    )
                ).limit(200).all()
                empids_to_show.extend([c.empid for c in colleagues if c.empid])
            
            # Remove duplicates, filter out None/empty values, and ensure all are strings
            empids_to_show = [str(eid) for eid in set(empids_to_show) if eid]
            
            if empids_to_show:
                query = query.filter(User.empid.in_(empids_to_show))
            else:
                # If no empids to show, return empty list
                return []
        # Admin and HR can see all
        
        # Limit to 500 users for hierarchy display
        return query.order_by(User.name).limit(500).all()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching hierarchy: {str(e)}")

@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Employees can only view their own profile
    if current_user.role == "Employee" and user.id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return user

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Only Admin or HR can create users")
    
    # Check existing
    existing = db.query(User).filter(
        (User.email == user_data.email) | 
        (User.username == user_data.username) |
        (User.empid == user_data.empid)
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="User with this email, username or empid already exists")

    company = None
    branch = None
    department = None

    if user_data.company_id:
        company = db.query(Company).filter(Company.id == user_data.company_id).first()
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

    if user_data.branch_id:
        branch = db.query(Branch).filter(Branch.id == user_data.branch_id).first()
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        if user_data.company_id and branch.company_id != user_data.company_id:
            raise HTTPException(status_code=400, detail="Branch does not belong to selected company")
        if not company:
            company = db.query(Company).filter(Company.id == branch.company_id).first()

    if user_data.department_id:
        department = db.query(Department).filter(Department.id == user_data.department_id).first()
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")
        if user_data.branch_id and department.branch_id != user_data.branch_id:
            raise HTTPException(status_code=400, detail="Department does not belong to selected branch")
        if user_data.company_id and department.company_id != user_data.company_id:
            raise HTTPException(status_code=400, detail="Department does not belong to selected company")
        if not branch:
            branch = db.query(Branch).filter(Branch.id == department.branch_id).first()
        if not company and department:
            company = db.query(Company).filter(Company.id == department.company_id).first()
    
    user = User(
        empid=user_data.empid,
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        username=user_data.username,
        password=hash_password(user_data.password),
        role=user_data.role,
        sms_consent=user_data.sms_consent,
        whatsapp_consent=user_data.whatsapp_consent,
        email_consent=user_data.email_consent,
        report_to_id=user_data.report_to_id,
        image_base64=user_data.image_base64,
        dob=user_data.dob,
        doj=user_data.doj,
        designation=user_data.designation,
        company_id=user_data.company_id if user_data.company_id else (company.id if company else None),
        branch_id=user_data.branch_id if user_data.branch_id else (branch.id if branch else None),
        department_id=user_data.department_id if user_data.department_id else (department.id if department else None),
        company_name=company.name if company else None,
        branch_name=branch.name if branch else None,
        department_name=department.name if department else None,
        created_by=current_user.id
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Log activity
    activity = Activity(
        user_id=current_user.id,
        user_name=current_user.name,
        action="created",
        entity_type="user",
        entity_id=user.id,
        entity_name=user.name,
        details=f"Created new {user.role}: {user.name}"
    )
    db.add(activity)
    db.commit()
    
    return user

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Only Admin/HR can update others, employees can only update themselves
    if not is_admin_or_hr(current_user) and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Employees cannot change their role
    if current_user.role == "Employee" and user_data.role:
        raise HTTPException(status_code=403, detail="Cannot change role")
    
    update_data = user_data.model_dump(exclude_unset=True)

    company = None
    branch = None
    department = None

    if "company_id" in update_data:
        if update_data["company_id"] is not None:
            company = db.query(Company).filter(Company.id == update_data["company_id"]).first()
            if not company:
                raise HTTPException(status_code=404, detail="Company not found")
        else:
            update_data["company_name"] = None

    if "branch_id" in update_data:
        if update_data["branch_id"] is not None:
            branch = db.query(Branch).filter(Branch.id == update_data["branch_id"]).first()
            if not branch:
                raise HTTPException(status_code=404, detail="Branch not found")
        else:
            update_data["branch_name"] = None

    if "department_id" in update_data:
        if update_data["department_id"] is not None:
            department = db.query(Department).filter(Department.id == update_data["department_id"]).first()
            if not department:
                raise HTTPException(status_code=404, detail="Department not found")
        else:
            update_data["department_name"] = None

    # Validate relationships
    target_company_id = update_data.get("company_id", user.company_id)
    target_branch_id = update_data.get("branch_id", user.branch_id)
    target_department_id = update_data.get("department_id", user.department_id)

    if target_branch_id:
        branch_lookup = branch if branch and branch.id == target_branch_id else db.query(Branch).filter(Branch.id == target_branch_id).first()
        if not branch_lookup:
            raise HTTPException(status_code=404, detail="Branch not found")
        if target_company_id and branch_lookup.company_id != target_company_id:
            raise HTTPException(status_code=400, detail="Branch does not belong to selected company")
        branch = branch_lookup
        if not company and target_company_id:
            company = db.query(Company).filter(Company.id == target_company_id).first()

    if target_department_id:
        dept_lookup = department if department and department.id == target_department_id else db.query(Department).filter(Department.id == target_department_id).first()
        if not dept_lookup:
            raise HTTPException(status_code=404, detail="Department not found")
        if target_branch_id and dept_lookup.branch_id != target_branch_id:
            raise HTTPException(status_code=400, detail="Department does not belong to selected branch")
        if target_company_id and dept_lookup.company_id != target_company_id:
            raise HTTPException(status_code=400, detail="Department does not belong to selected company")
        department = dept_lookup
        if not branch and target_branch_id:
            branch = db.query(Branch).filter(Branch.id == target_branch_id).first()
        if not company and target_company_id:
            company = db.query(Company).filter(Company.id == target_company_id).first()
    
    if "password" in update_data:
        if update_data["password"]:
            update_data["password"] = hash_password(update_data["password"])
        else:
            update_data.pop("password", None)

    if company:
        update_data["company_name"] = company.name
    if branch:
        update_data["branch_name"] = branch.name
    if department:
        update_data["department_name"] = department.name
    
    for key, value in update_data.items():
        setattr(user, key, value)
    
    db.commit()
    db.refresh(user)
    
    return user

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Only Admin or HR can delete users")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Soft delete - update is_active and emp_inactive_date
    from datetime import date
    user.is_active = False
    user.emp_inactive_date = date.today()  # Set current date
    db.commit()
    
    return {"message": "User deactivated successfully"}

@router.get("/{user_id}/team", response_model=List[UserResponse])
def get_user_team(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all users reporting to a specific user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return []
    return db.query(User).filter(
        User.report_to_id == user.empid,
        User.is_active == True
    ).order_by(User.name).all()

@router.put("/{user_id}/details/{detail_type}", response_model=UserResponse)
def update_user_detail(
    user_id: int,
    detail_type: str,
    detail_data: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update specific user detail (bank_details, family_details, etc.)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Only Admin/HR can update others, employees can only update themselves
    if not is_admin_or_hr(current_user) and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    valid_types = ['bank_details', 'family_details', 'nominee_details', 'education_details', 'experience_details', 'documents']
    if detail_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid detail type. Must be one of: {', '.join(valid_types)}")
    
    # Handle array types (family, education, experience, documents)
    if detail_type in ['family_details', 'education_details', 'experience_details', 'documents']:
        if not isinstance(detail_data, dict) or 'action' not in detail_data:
            raise HTTPException(status_code=400, detail="For array types, provide 'action' (add/edit/delete) and data")
        
        action = detail_data.get('action')
        # Get current data - handle both list and None cases
        current_data = getattr(user, detail_type)
        if current_data is None:
            current_data = []
        # Ensure it's a list (JSONB might return dict in some cases)
        if not isinstance(current_data, list):
            # If it's a dict, convert to list
            if isinstance(current_data, dict):
                current_data = [current_data]
            else:
                current_data = []
        
        # Convert to list to ensure proper JSONB handling
        current_data = list(current_data)
        
        if action == 'add':
            new_item = detail_data.get('data', {})
            if not isinstance(new_item, dict):
                raise HTTPException(status_code=400, detail="Data must be a dictionary")
            current_data.append(new_item)
        elif action == 'edit':
            index = detail_data.get('index')
            if index is None:
                raise HTTPException(status_code=400, detail="Index is required for edit action")
            try:
                index = int(index)
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="Index must be a valid integer")
            if index < 0 or index >= len(current_data):
                raise HTTPException(status_code=400, detail=f"Invalid index: {index}. Array has {len(current_data)} items")
            edit_data = detail_data.get('data', {})
            if not isinstance(edit_data, dict):
                raise HTTPException(status_code=400, detail="Data must be a dictionary")
            # Merge existing data with new data
            current_data[index] = {**current_data[index], **edit_data}
        elif action == 'delete':
            index = detail_data.get('index')
            if index is None:
                raise HTTPException(status_code=400, detail="Index is required for delete action")
            try:
                index = int(index)
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="Index must be a valid integer")
            if index < 0 or index >= len(current_data):
                raise HTTPException(status_code=400, detail=f"Invalid index: {index}. Array has {len(current_data)} items")
            current_data.pop(index)
        else:
            raise HTTPException(status_code=400, detail="Action must be 'add', 'edit', or 'delete'")
        
        # Update the attribute - SQLAlchemy will handle JSONB serialization
        setattr(user, detail_type, current_data)
        # Flag the JSONB field as modified so SQLAlchemy knows to update it
        flag_modified(user, detail_type)
    else:
        # Single object types (bank_details, nominee_details)
        setattr(user, detail_type, detail_data)
        # Flag the JSONB field as modified
        flag_modified(user, detail_type)
    
    db.commit()
    db.refresh(user)
    
    return user



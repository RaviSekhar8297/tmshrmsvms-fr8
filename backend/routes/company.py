from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from utils import get_ist_now
from database import get_db
from models import User, Company, Branch, Department
from routes.auth import get_current_user
from utils import is_admin_or_hr
from typing import Optional, List
from pydantic import BaseModel
import requests
import base64

router = APIRouter()

# Company Schemas
class CompanyCreate(BaseModel):
    name: str  # Only name is required
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None

# Branch Schemas
class BranchCreate(BaseModel):
    name: str
    company_id: int

class BranchUpdate(BaseModel):
    name: str

# Department Schemas
class DepartmentCreate(BaseModel):
    name: str
    company_id: int
    branch_id: int

class DepartmentUpdate(BaseModel):
    name: str

# Company Routes
@router.get("/company/list")
def get_companies(
    db: Session = Depends(get_db)
):
    """Get all companies"""
    companies = db.query(Company).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "phone": c.phone,
            "website": c.website,
            "logo_base64": c.logo_base64
        }
        for c in companies
    ]

@router.get("/company/logo")
def get_company_logo(
    db: Session = Depends(get_db)
):
    """Get company logo (base64)"""
    company = db.query(Company).first()
    if company and company.logo_base64:
        return {"logo_base64": company.logo_base64}
    
    # Try to fetch default logo and convert to base64 to avoid CORS
    try:
        logo_url = "https://www.brihaspathi.com/highbtlogo%20tm%20(1).png"
        response = requests.get(logo_url, timeout=10)
        if response.status_code == 200:
            logo_base64 = base64.b64encode(response.content).decode('utf-8')
            return {"logo_base64": f"data:image/png;base64,{logo_base64}"}
    except Exception as e:
        print(f"Error fetching logo: {e}")
    
    # If all fails, return empty
    return {"logo_base64": None}

@router.post("/company")
def create_company(
    company_data: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new company"""
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    new_company = Company(
        name=company_data.name,
        email=company_data.email,
        phone=company_data.phone,
        website=company_data.website
    )
    
    db.add(new_company)
    db.commit()
    db.refresh(new_company)
    
    return {
        "message": "Company created successfully",
        "id": new_company.id
    }

@router.put("/company/{company_id}")
def update_company(
    company_id: int,
    company_data: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update company information"""
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    update_data = company_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(company, key, value)
    
    company.updated_at = get_ist_now()
    
    db.commit()
    db.refresh(company)
    
    return {
        "message": "Company updated successfully",
        "id": company.id
    }

@router.delete("/company/{company_id}")
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a company"""
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    db.delete(company)
    db.commit()
    
    return {"message": "Company deleted successfully"}

# Branch Routes
@router.get("/branch/list")
def get_branches(
    db: Session = Depends(get_db)
):
    """Get all branches"""
    branches = db.query(Branch).all()
    return [
        {
            "id": b.id,
            "name": b.name,
            "company_id": b.company_id,
            "company_name": b.company_name
        }
        for b in branches
    ]

@router.post("/branch")
def create_branch(
    branch_data: BranchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new branch"""
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get company name
    company = db.query(Company).filter(Company.id == branch_data.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    new_branch = Branch(
        name=branch_data.name,
        company_id=branch_data.company_id,
        company_name=company.name
    )
    
    db.add(new_branch)
    db.commit()
    db.refresh(new_branch)
    
    return {
        "message": "Branch created successfully",
        "id": new_branch.id
    }

@router.put("/branch/{branch_id}")
def update_branch(
    branch_id: int,
    branch_data: BranchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update branch name"""
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    branch.name = branch_data.name
    branch.updated_at = get_ist_now()
    
    db.commit()
    db.refresh(branch)
    
    return {
        "message": "Branch updated successfully",
        "id": branch.id
    }

@router.delete("/branch/{branch_id}")
def delete_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a branch"""
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    db.delete(branch)
    db.commit()
    
    return {"message": "Branch deleted successfully"}

# Department Routes
@router.get("/department/list")
def get_departments(
    db: Session = Depends(get_db)
):
    """Get all departments"""
    departments = db.query(Department).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "company_id": d.company_id,
            "branch_id": d.branch_id,
            "company_name": d.company_name,
            "branch_name": d.branch_name
        }
        for d in departments
    ]

@router.get("/department/branches/{company_id}")
def get_branches_by_company(
    company_id: int,
    db: Session = Depends(get_db)
):
    """Get branches for a specific company"""
    branches = db.query(Branch).filter(Branch.company_id == company_id).all()
    return [
        {
            "id": b.id,
            "name": b.name,
            "company_id": b.company_id,
            "company_name": b.company_name
        }
        for b in branches
    ]

@router.post("/department")
def create_department(
    department_data: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new department"""
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get company and branch names
    company = db.query(Company).filter(Company.id == department_data.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    branch = db.query(Branch).filter(Branch.id == department_data.branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    if branch.company_id != department_data.company_id:
        raise HTTPException(status_code=400, detail="Branch does not belong to the selected company")
    
    new_department = Department(
        name=department_data.name,
        company_id=department_data.company_id,
        branch_id=department_data.branch_id,
        company_name=company.name,
        branch_name=branch.name
    )
    
    db.add(new_department)
    db.commit()
    db.refresh(new_department)
    
    return {
        "message": "Department created successfully",
        "id": new_department.id
    }

@router.put("/department/{department_id}")
def update_department(
    department_id: int,
    department_data: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update department name"""
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    department.name = department_data.name
    department.updated_at = get_ist_now()
    
    db.commit()
    db.refresh(department)
    
    return {
        "message": "Department updated successfully",
        "id": department.id
    }

@router.delete("/department/{department_id}")
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a department"""
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    db.delete(department)
    db.commit()
    
    return {"message": "Department deleted successfully"}

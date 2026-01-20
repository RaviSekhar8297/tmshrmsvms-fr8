from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional
from datetime import datetime
from utils import get_ist_now
from database import get_db
from models import Policy, User
from schemas import PolicyCreate, PolicyUpdate, PolicyResponse, MarkAsReadRequest
from routes.auth import get_current_user
import json
import os
from pathlib import Path
import PyPDF2

router = APIRouter(prefix="/policies", tags=["Policies"])

# Create uploads directory if it doesn't exist
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads" / "policies"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@router.get("/", response_model=List[PolicyResponse])
def get_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all policies - accessible by all roles"""
    try:
        # Limit to 500 policies for performance
        policies = db.query(Policy).order_by(Policy.created_at.desc()).limit(500).all()
        
        # Normalize likes field - ensure it's always a list
        for policy in policies:
            if policy.likes is None:
                policy.likes = []
            elif isinstance(policy.likes, dict):
                # Convert object to empty list if it's an object
                policy.likes = []
            elif not isinstance(policy.likes, list):
                policy.likes = []
            
            # Normalize readby field - ensure it's always a list
            if policy.readby is None:
                policy.readby = []
            elif isinstance(policy.readby, dict):
                policy.readby = []
            elif not isinstance(policy.readby, list):
                policy.readby = []
        
        return policies
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching policies: {str(e)}")

@router.get("/unread", response_model=List[PolicyResponse])
def get_unread_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all policies that the current user has not read yet"""
    try:
        # Limit to 500 policies for performance
        policies = db.query(Policy).order_by(Policy.created_at.desc()).limit(500).all()
        unread_policies = []
        
        for policy in policies:
            # Normalize readby field - handle both JSONB and string formats
            readby_list = policy.readby if policy.readby else []
            if isinstance(readby_list, dict):
                readby_list = []
            elif isinstance(readby_list, str):
                # If stored as JSON string, parse it
                try:
                    import json
                    readby_list = json.loads(readby_list)
                    if not isinstance(readby_list, list):
                        readby_list = []
                except:
                    readby_list = []
            elif not isinstance(readby_list, list):
                readby_list = []
            
            # Normalize likes field
            likes_list = policy.likes if policy.likes else []
            if isinstance(likes_list, dict):
                likes_list = []
            elif not isinstance(likes_list, list):
                likes_list = []
            
            # Normalize policy field
            policy_dict = policy.policy if policy.policy else {}
            if not isinstance(policy_dict, dict):
                policy_dict = {}
            
            # Check if current user has read this policy
            user_read = False
            current_empid = str(current_user.empid).strip()  # Ensure string comparison
            for entry in readby_list:
                if isinstance(entry, dict):
                    # Handle dict entries
                    entry_empid = str(entry.get("empid", "")).strip() if entry.get("empid") else ""
                    if entry_empid == current_empid:
                        user_read = True
                        break
                elif isinstance(entry, str):
                    # Handle string entries (if stored as JSON string)
                    try:
                        import json
                        entry_dict = json.loads(entry) if isinstance(entry, str) else entry
                        if isinstance(entry_dict, dict):
                            entry_empid = str(entry_dict.get("empid", "")).strip() if entry_dict.get("empid") else ""
                            if entry_empid == current_empid:
                                user_read = True
                                break
                    except:
                        pass
            
            if not user_read:
                # Ensure all fields are properly normalized
                policy.readby = readby_list
                policy.likes = likes_list
                policy.policy = policy_dict
                unread_policies.append(policy)
        
        return unread_policies
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching unread policies: {str(e)}")

@router.get("/{policy_id}", response_model=PolicyResponse)
def get_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific policy by ID"""
    try:
        policy = db.query(Policy).filter(Policy.id == policy_id).first()
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")
        return policy
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching policy: {str(e)}")

@router.post("/", response_model=PolicyResponse)
def create_policy(
    policy_data: PolicyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new policy - only HR and Admin"""
    if current_user.role not in ["HR", "Admin"]:
        raise HTTPException(status_code=403, detail="Only HR and Admin can create policies")
    
    try:
        # Convert policy data to dict
        policy_dict = {
            "name": policy_data.policy.name,
            "type": policy_data.policy.type,
            "pages": policy_data.policy.pages
        }
        if policy_data.policy.file_url:
            policy_dict["file_url"] = policy_data.policy.file_url
        
        new_policy = Policy(
            policy=policy_dict,
            readby=[]
        )
        db.add(new_policy)
        db.commit()
        db.refresh(new_policy)
        return new_policy
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating policy: {str(e)}")

@router.post("/upload", response_model=PolicyResponse)
async def upload_policy(
    file: UploadFile = File(...),
    name: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a policy file - only HR and Admin. Automatically extracts page count from PDF."""
    if current_user.role not in ["HR", "Admin"]:
        raise HTTPException(status_code=403, detail="Only HR and Admin can upload policies")
    
    try:
        # Get file extension
        file_ext = Path(file.filename).suffix.lower()
        
        # Only allow PDF files
        if file_ext != '.pdf':
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{timestamp}_{file.filename}"
        file_path = UPLOAD_DIR / safe_filename
        
        # Save file
        content = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        # Extract page count from PDF
        page_count = 1
        try:
            with open(file_path, "rb") as pdf_file:
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                page_count = len(pdf_reader.pages)
        except Exception as e:
            print(f"Warning: Could not extract page count from PDF: {e}")
            # Default to 1 if extraction fails
        
        # Use provided name or extract from filename
        policy_name = name or Path(file.filename).stem
        
        # Create policy record
        policy_dict = {
            "name": policy_name,
            "type": "PDF",
            "pages": page_count,
            "file_url": f"/api/uploads/policies/{safe_filename}"
        }
        
        # Automatically add uploader to readby
        readby_entry = {
            "empid": current_user.empid,
            "name": current_user.name,
            "viewed": True,
            "viewed_at": get_ist_now().isoformat()
        }
        
        new_policy = Policy(
            policy=policy_dict,
            readby=[readby_entry],
            likes=[]
        )
        db.add(new_policy)
        db.commit()
        db.refresh(new_policy)
        return new_policy
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error uploading policy: {str(e)}")

@router.put("/{policy_id}", response_model=PolicyResponse)
def update_policy(
    policy_id: int,
    policy_data: PolicyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a policy - only HR and Admin"""
    if current_user.role not in ["HR", "Admin"]:
        raise HTTPException(status_code=403, detail="Only HR and Admin can update policies")
    
    try:
        policy = db.query(Policy).filter(Policy.id == policy_id).first()
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")
        
        if policy_data.policy:
            policy.policy = {
                "name": policy_data.policy.name,
                "type": policy_data.policy.type,
                "pages": policy_data.policy.pages
            }
            if policy_data.policy.file_url:
                policy.policy["file_url"] = policy_data.policy.file_url
        
        db.commit()
        db.refresh(policy)
        return policy
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating policy: {str(e)}")

@router.delete("/{policy_id}")
def delete_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a policy - only HR and Admin"""
    if current_user.role not in ["HR", "Admin"]:
        raise HTTPException(status_code=403, detail="Only HR and Admin can delete policies")
    
    try:
        policy = db.query(Policy).filter(Policy.id == policy_id).first()
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")
        
        # Delete associated file if exists
        if policy.policy.get("file_url"):
            # Extract filename from URL (e.g., /api/uploads/policies/filename.pdf -> filename.pdf)
            file_url = policy.policy["file_url"]
            filename = file_url.split("/")[-1]
            file_path = UPLOAD_DIR / filename
            if file_path.exists():
                file_path.unlink()
        
        db.delete(policy)
        db.commit()
        return {"message": "Policy deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting policy: {str(e)}")

@router.post("/{policy_id}/mark-read")
def mark_policy_as_read(
    policy_id: int,
    read_data: MarkAsReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a policy as read by a user - accessible by all roles"""
    try:
        policy = db.query(Policy).filter(Policy.id == policy_id).first()
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")
        
        # Get current readby list
        readby_list = policy.readby if policy.readby else []
        
        # Check if user already marked as read
        existing_index = None
        for i, entry in enumerate(readby_list):
            if entry.get("empid") == read_data.empid:
                existing_index = i
                break
        
        # Update or add read entry
        read_entry = {
            "empid": read_data.empid,
            "name": read_data.name,
            "viewed": True,
            "viewed_at": get_ist_now().isoformat()
        }
        
        if existing_index is not None:
            readby_list[existing_index] = read_entry
        else:
            readby_list.append(read_entry)
        
        # Ensure readby_list is a proper list
        if not isinstance(readby_list, list):
            readby_list = [read_entry]
        
        policy.readby = readby_list
        flag_modified(policy, "readby")
        db.commit()
        db.refresh(policy)
        return {"message": "Policy marked as read", "policy": policy}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error marking policy as read: {str(e)}")

@router.get("/{policy_id}/read-status")
def get_read_status(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get read status for a policy - check if current user has read it"""
    try:
        policy = db.query(Policy).filter(Policy.id == policy_id).first()
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")
        
        readby_list = policy.readby if policy.readby else []
        user_read = False
        current_empid = str(current_user.empid).strip()
        
        for entry in readby_list:
            if isinstance(entry, dict):
                entry_empid = str(entry.get("empid", "")).strip() if entry.get("empid") else ""
                if entry_empid == current_empid:
                    user_read = True
                    break
            elif isinstance(entry, str):
                try:
                    import json
                    entry_dict = json.loads(entry) if isinstance(entry, str) else entry
                    if isinstance(entry_dict, dict):
                        entry_empid = str(entry_dict.get("empid", "")).strip() if entry_dict.get("empid") else ""
                        if entry_empid == current_empid:
                            user_read = True
                            break
                except:
                    pass
        
        return {
            "policy_id": policy_id,
            "user_read": user_read,
            "total_read_by": len(readby_list),
            "read_by": readby_list
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting read status: {str(e)}")

@router.post("/{policy_id}/like/{page}")
def toggle_like(
    policy_id: int,
    page: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle like for a specific page - add if not exists, remove if exists"""
    try:
        policy = db.query(Policy).filter(Policy.id == policy_id).first()
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")
        
        # Normalize likes field
        likes_list = policy.likes if policy.likes else []
        if isinstance(likes_list, dict):
            likes_list = []
        elif not isinstance(likes_list, list):
            likes_list = []
        
        # Validate page number
        if page < 1 or page > policy.policy.get("pages", 1):
            raise HTTPException(status_code=400, detail="Invalid page number")
        
        # Check if user already liked this page
        existing_index = None
        page_int = int(page)  # Ensure page is integer for comparison
        
        for i, like in enumerate(likes_list):
            # Compare both empid and page (handle type conversion for page)
            like_empid = like.get("empid")
            like_page = like.get("page")
            
            # Handle type conversion for page number
            if isinstance(like_page, str):
                try:
                    like_page = int(like_page)
                except (ValueError, TypeError):
                    continue
            elif like_page is None:
                continue
            else:
                # Ensure it's an integer
                like_page = int(like_page)
            
            # Check if this like matches current user and page
            if like_empid == current_user.empid and like_page == page_int:
                existing_index = i
                break
        
        if existing_index is not None:
            # Remove like
            likes_list.pop(existing_index)
            action = "unliked"
        else:
            # Add like
            like_entry = {
                "empid": current_user.empid,
                "name": current_user.name,
                "page": int(page),  # Ensure page is stored as integer
                "liked_at": get_ist_now().isoformat()
            }
            likes_list.append(like_entry)
            action = "liked"
        
        policy.likes = likes_list
        db.commit()
        db.refresh(policy)
        
        # Get like count for this page
        page_likes = [l for l in likes_list if l.get("page") == page]
        
        return {
            "message": f"Page {page} {action}",
            "liked": action == "liked",
            "like_count": len(page_likes),
            "page_likes": page_likes
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error toggling like: {str(e)}")

@router.get("/{policy_id}/likes/{page}")
def get_page_likes(
    policy_id: int,
    page: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get likes for a specific page"""
    try:
        policy = db.query(Policy).filter(Policy.id == policy_id).first()
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")
        
        # Normalize likes field
        likes_list = policy.likes if policy.likes else []
        if isinstance(likes_list, dict):
            likes_list = []
        elif not isinstance(likes_list, list):
            likes_list = []
        
        # Filter page likes (handle type conversion)
        page_likes = []
        for l in likes_list:
            like_page = l.get("page")
            if isinstance(like_page, str):
                like_page = int(like_page)
            if like_page == page:
                page_likes.append(l)
        
        # Check if current user liked this page
        user_liked = False
        for l in likes_list:
            like_page = l.get("page")
            if isinstance(like_page, str):
                like_page = int(like_page)
            if l.get("empid") == current_user.empid and like_page == page:
                user_liked = True
                break
        
        return {
            "policy_id": policy_id,
            "page": page,
            "like_count": len(page_likes),
            "user_liked": user_liked,
            "likes": page_likes
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error getting likes: {str(e)}")

@router.post("/{policy_id}/acknowledge")
def acknowledge_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Acknowledge a policy - mark as read with viewed status"""
    try:
        policy = db.query(Policy).filter(Policy.id == policy_id).first()
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")
        
        # Get current readby list - handle both JSONB and string formats
        readby_list = policy.readby if policy.readby else []
        if isinstance(readby_list, dict):
            readby_list = []
        elif isinstance(readby_list, str):
            # If stored as JSON string, parse it
            try:
                import json
                readby_list = json.loads(readby_list)
                if not isinstance(readby_list, list):
                    readby_list = []
            except:
                readby_list = []
        elif not isinstance(readby_list, list):
            readby_list = []
        
        # Check if user already marked as read
        existing_index = None
        current_empid = str(current_user.empid).strip()  # Ensure string comparison
        for i, entry in enumerate(readby_list):
            if isinstance(entry, dict):
                entry_empid = str(entry.get("empid", "")).strip() if entry.get("empid") else ""
                if entry_empid == current_empid:
                    existing_index = i
                    break
            elif isinstance(entry, str):
                # Handle string entries (if stored as JSON string)
                try:
                    import json
                    entry_dict = json.loads(entry) if isinstance(entry, str) else entry
                    if isinstance(entry_dict, dict):
                        entry_empid = str(entry_dict.get("empid", "")).strip() if entry_dict.get("empid") else ""
                        if entry_empid == current_empid:
                            existing_index = i
                            break
                except:
                    pass
        
        # Update or add read entry
        read_entry = {
            "empid": str(current_user.empid),  # Ensure empid is string
            "name": str(current_user.name),
            "viewed": True,
            "viewed_at": get_ist_now().isoformat()
        }
        
        if existing_index is not None:
            readby_list[existing_index] = read_entry
        else:
            readby_list.append(read_entry)
        
        # Ensure readby_list is a proper list
        if not isinstance(readby_list, list):
            readby_list = [read_entry]
        
        # Set the readby field explicitly
        policy.readby = readby_list
        
        # Mark the JSONB field as modified so SQLAlchemy detects the change
        flag_modified(policy, "readby")
        
        # Debug logging
        print(f"DEBUG: Saving readby data for policy {policy_id}: {readby_list}")
        print(f"DEBUG: Current user empid: {current_user.empid}, name: {current_user.name}")
        
        db.commit()
        db.refresh(policy)
        
        # Verify the data was saved
        print(f"DEBUG: After commit, policy.readby: {policy.readby}")
        
        return {"message": "Policy acknowledged successfully", "policy": policy}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = traceback.format_exc()
        print(f"ERROR acknowledging policy: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Error acknowledging policy: {str(e)}")


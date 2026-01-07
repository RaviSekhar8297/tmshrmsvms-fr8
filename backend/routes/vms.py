from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, text
from datetime import datetime
from utils import get_ist_now
from database import get_db
from models import VMSItem, Visitor, User
from routes.auth import get_current_user
from typing import Optional, List
from pydantic import BaseModel
import requests
import smtplib
import re
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from urllib.parse import urlparse
# Import notification functions
try:
    import sys
    import os
    # Add parent directory to path
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from utils.notifications import send_whatsapp_notification, send_email_notification
except ImportError:
    # Fallback: define functions inline if module doesn't exist
    pass

# WhatsApp and Email configuration
WHATSAPP_API_URL = "https://backend.api-wa.co/campaign/smartping/api/v2"
WHATSAPP_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY0OWMxMDI0YTMzMGUyMGJkYTcwMzMwMyIsIm5hbWUiOiJCUklIQVNQQVRISSBURUNITk9MT0dJRVMgUFJJVkFURSBMSU1JVEVEIiwiYXBwTmFtZSI6IkFpU2Vuc3kiLCJjbGllbnRJZCI6IjY0OWMxMDIzY2FkODQ1MGI0Nzg1YzA1YyIsImFjdGl2ZVBsYW4iOiJOT05FIiwiaWF0IjoxNjg3OTQ5MzQ4fQ.oDl73wKoFu9jj-nKdzsOqaY8InWdw3RIaYy4EUZaEto"
WHATSAPP_CAMPAIGN = "vms_image"
DEFAULT_IMAGE_URL = "https://t4.ftcdn.net/jpg/16/44/48/57/360_F_1644485767_kRMUtdpCWAt69j40x7mOkB2peeVkDgsM.jpg"
EMAIL_FROM = "hrms@brihaspathi.com"
EMAIL_PASSWORD = "aakbcohigtogpyrl"
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
FRONTEND_URL = "https://tms.brihaspathi.com/"

def is_valid_email(email: str) -> bool:
    """Validate email format"""
    if not email:
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def is_valid_phone(phone: str) -> bool:
    """Validate phone number (basic validation)"""
    if not phone:
        return False
    # Remove common characters and check if it's numeric
    phone_clean = phone.replace("+", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    return phone_clean.isdigit() and len(phone_clean) >= 10

def get_image_data(image_data: str) -> tuple:
    """Get image data from base64 string or URL, return (image_data, is_url)"""
    if not image_data:
        return None, False
    
    # Check if it's a base64 data URL
    if image_data.startswith('data:image'):
        try:
            # Extract base64 data
            header, encoded = image_data.split(',', 1)
            decoded = base64.b64decode(encoded)
            return decoded, False
        except:
            return None, False
    
    # Check if it's a URL
    if image_data.startswith('http://') or image_data.startswith('https://'):
        return image_data, True
    
    # Try to decode as base64
    try:
        decoded = base64.b64decode(image_data)
        return decoded, False
    except:
        return None, False

def send_whatsapp_notification(employee_name: str, visitor_name: str, visit_purpose: str, address: str, date_of_visit: str, phone: str, image_data: str = None):
    """Send WhatsApp notification with image"""
    try:
        if not is_valid_phone(phone):
            print(f"Invalid phone number: {phone}")
            return False
        
        phone_clean = phone.replace("+", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        
        # Use default image if provided image is invalid
        image_to_use = image_data
        if not image_data:
            image_to_use = DEFAULT_IMAGE_URL
        
        # Get image data
        img_data, is_url = get_image_data(image_to_use)
        if not img_data and not is_url:
            image_to_use = DEFAULT_IMAGE_URL
            is_url = True
        
        # Build payload according to API specification
        payload = {
            "campaignName": WHATSAPP_CAMPAIGN,
            "destination": phone_clean,
            "userName": "BRIHASPATHI TECHNOLOGIES PRIVATE LIMITED",
            "templateParams": [employee_name, visitor_name, visit_purpose, address, date_of_visit],
            "source": "new-landing-page form"
        }
        
        # If image is a URL, add it to payload
        if is_url:
            payload["imageUrl"] = image_to_use
        
        # Try multiple authentication methods
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # Method 1: Bearer token in header
        headers["Authorization"] = f"Bearer {WHATSAPP_API_KEY}"
        
        print(f"WhatsApp API Request:")
        print(f"  URL: {WHATSAPP_API_URL}")
        print(f"  Campaign: {WHATSAPP_CAMPAIGN}")
        print(f"  Phone: {phone_clean}")
        print(f"  Payload: {payload}")
        
        # Try with Bearer token
        response = requests.post(WHATSAPP_API_URL, json=payload, headers=headers, timeout=30)
        
        # If 401, try with API key as query parameter
        if response.status_code == 401:
            print("Bearer token failed (401), trying with API key as query parameter...")
            url_with_key = f"{WHATSAPP_API_URL}?apiKey={WHATSAPP_API_KEY}"
            headers_no_auth = {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            response = requests.post(url_with_key, json=payload, headers=headers_no_auth, timeout=30)
        
        # If still 401, try with API key in payload
        if response.status_code == 401:
            print("Query parameter failed, trying with API key in payload...")
            payload_with_key = payload.copy()
            payload_with_key["apiKey"] = WHATSAPP_API_KEY
            headers_no_auth = {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            response = requests.post(WHATSAPP_API_URL, json=payload_with_key, headers=headers_no_auth, timeout=30)
        if response.status_code == 200:
            print(f"WhatsApp notification sent to {phone}")
            return True
        else:
            print(f"WhatsApp API error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"WhatsApp error: {str(e)}")
        return False

def send_email_notification(employee_name: str, employee_email: str, visitor_name: str, visit_purpose: str, address: str, date_of_visit: str, visitor_phone: str, visitor_email: str, image_data: str = None):
    """Send email notification with image attachment"""
    try:
        if not is_valid_email(employee_email):
            print(f"Invalid employee email: {employee_email}")
            return False
        
        msg = MIMEMultipart()
        msg['From'] = EMAIL_FROM
        msg['To'] = employee_email
        msg['Subject'] = f"Visitor Alert: {visitor_name} is here to meet you"
        
        body = f"""Dear {employee_name},

You have a visitor at the reception:

Visitor Details:
- Name: {visitor_name}
- Purpose: {visit_purpose}
- Address: {address}
- Phone: {visitor_phone or 'Not provided'}
- Email: {visitor_email or 'Not provided'}
- Date of Visit: {date_of_visit}

Please proceed to the reception to meet your visitor.

Best regards,
HRMS System
BRIHASPATHI TECHNOLOGIES PRIVATE LIMITED"""
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Attach image
        image_to_use = image_data
        if not image_data:
            image_to_use = DEFAULT_IMAGE_URL
        
        img_data, is_url = get_image_data(image_to_use)
        
        if is_url:
            # Download image from URL
            try:
                img_response = requests.get(image_to_use, timeout=10)
                if img_response.status_code == 200:
                    img_data = img_response.content
                else:
                    # Use default image
                    img_response = requests.get(DEFAULT_IMAGE_URL, timeout=10)
                    if img_response.status_code == 200:
                        img_data = img_response.content
                    else:
                        img_data = None
            except:
                # Try default image
                try:
                    img_response = requests.get(DEFAULT_IMAGE_URL, timeout=10)
                    if img_response.status_code == 200:
                        img_data = img_response.content
                    else:
                        img_data = None
                except:
                    img_data = None
        
        if img_data:
            try:
                image_part = MIMEImage(img_data)
                image_part.add_header('Content-Disposition', 'attachment', filename='visitor_image.jpg')
                msg.attach(image_part)
            except Exception as img_error:
                print(f"Error attaching image to email: {str(img_error)}")
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_FROM, EMAIL_PASSWORD)
        server.sendmail(EMAIL_FROM, employee_email, msg.as_string())
        server.quit()
        print(f"Email sent to {employee_email}")
        return True
    except Exception as e:
        print(f"Email error: {str(e)}")
        return False

router = APIRouter()

class VMSItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    quantity: int = 1
    unit: Optional[str] = None
    location: Optional[str] = None
    status: str = "available"
    notes: Optional[str] = None

class VisitorCreate(BaseModel):
    fullname: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    purpose: Optional[str] = None
    whometomeet: Optional[str] = None
    whometomeet_id: Optional[str] = None
    selfie: Optional[str] = None

class VisitorUpdate(BaseModel):
    checkouttime: Optional[datetime] = None
    status: Optional[str] = None

# Visitor Management Endpoints
@router.post("/vms/visitors/add")
def add_visitor(
    visitor_data: VisitorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a new visitor"""
    try:
        # Get the next vtid - use sequence or manual increment
        try:
            # Try to get next value from sequence
            result = db.execute("SELECT nextval('visitors_vtid_seq')")
            next_vtid = result.scalar()
        except:
            # If sequence doesn't exist, manually increment
            max_vtid = db.query(func.max(Visitor.vtid)).scalar()
            next_vtid = (max_vtid or 0) + 1
        
        new_visitor = Visitor(
            vtid=next_vtid,
            fullname=visitor_data.fullname,
            email=visitor_data.email,
            phone=visitor_data.phone,
            address=visitor_data.address,
            purpose=visitor_data.purpose,
            whometomeet=visitor_data.whometomeet,
            selfie=visitor_data.selfie,
            status='IN'
        )
        
        db.add(new_visitor)
        db.commit()
        db.refresh(new_visitor)
        
        # Send notifications to the person to meet
        if visitor_data.whometomeet:
            try:
                # Find the user to meet - check both name and empid
                user_to_meet = None
                # First try by empid if whometomeet_id is provided
                if hasattr(visitor_data, 'whometomeet_id') and visitor_data.whometomeet_id:
                    user_to_meet = db.query(User).filter(User.empid == visitor_data.whometomeet_id).first()
                # If not found, try by name
                if not user_to_meet:
                    user_to_meet = db.query(User).filter(
                        or_(
                            User.name == visitor_data.whometomeet,
                            User.empid == visitor_data.whometomeet
                        )
                    ).first()
                
                if user_to_meet:
                    # Get current date and time in IST
                    from utils import get_ist_now
                    date_of_visit = get_ist_now().strftime("%d/%m/%Y %H:%M:%S")
                    
                    # Send WhatsApp notification if consent is given and phone is valid
                    if user_to_meet.whatsapp_consent and user_to_meet.phone:
                        try:
                            send_whatsapp_notification(
                                employee_name=user_to_meet.name,
                                visitor_name=visitor_data.fullname,
                                visit_purpose=visitor_data.purpose or 'Not specified',
                                address=visitor_data.address or 'Not provided',
                                date_of_visit=date_of_visit,
                                phone=user_to_meet.phone,
                                image_data=visitor_data.selfie
                            )
                        except Exception as wa_error:
                            print(f"WhatsApp notification error: {str(wa_error)}")
                    
                    # Send Email notification if consent is given and email is valid
                    if user_to_meet.email_consent and user_to_meet.email:
                        try:
                            send_email_notification(
                                employee_name=user_to_meet.name,
                                employee_email=user_to_meet.email,
                                visitor_name=visitor_data.fullname,
                                visit_purpose=visitor_data.purpose or 'Not specified',
                                address=visitor_data.address or 'Not provided',
                                date_of_visit=date_of_visit,
                                visitor_phone=visitor_data.phone or 'Not provided',
                                visitor_email=visitor_data.email or 'Not provided',
                                image_data=visitor_data.selfie
                            )
                        except Exception as email_error:
                            print(f"Email notification error: {str(email_error)}")
            except Exception as e:
                # Log error but don't fail the visitor creation
                print(f"Error sending notifications: {str(e)}")
                import traceback
                traceback.print_exc()
        
        return {
            "message": "Visitor added successfully",
            "id": new_visitor.id,
            "vtid": new_visitor.vtid,
            "visitor": {
                "id": new_visitor.id,
                "vtid": new_visitor.vtid,
                "fullname": new_visitor.fullname,
                "email": new_visitor.email,
                "phone": new_visitor.phone,
                "address": new_visitor.address,
                "purpose": new_visitor.purpose,
                "whometomeet": new_visitor.whometomeet,
                "checkintime": new_visitor.checkintime.isoformat() if new_visitor.checkintime else None,
                "status": new_visitor.status
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error adding visitor: {str(e)}")

@router.get("/vms/visitors")
def get_all_visitors(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all visitors - Employee role sees only visitors who came to meet them"""
    try:
        query = db.query(Visitor)
        
        # For Employee role, filter visitors who came to meet them
        if current_user.role == "Employee":
            query = query.filter(
                or_(
                    Visitor.whometomeet == current_user.name,
                    Visitor.whometomeet == str(current_user.empid)
                )
            )
        
        if status:
            query = query.filter(Visitor.status == status)
        
        visitors = query.order_by(Visitor.checkintime.desc()).all()
        
        return [
            {
                "id": v.id,
                "vtid": v.vtid,
                "fullname": v.fullname,
                "email": v.email,
                "phone": v.phone,
                "address": v.address,
                "purpose": v.purpose,
                "whometomeet": v.whometomeet,
                "selfie": v.selfie,
                "checkintime": v.checkintime.isoformat() if v.checkintime else None,
                "checkouttime": v.checkouttime.isoformat() if v.checkouttime else None,
                "status": v.status,
                "created_at": v.created_at.isoformat() if v.created_at else None
            }
            for v in visitors
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching visitors: {str(e)}")

@router.get("/vms/visitors/{visitor_id}")
def get_visitor(
    visitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific visitor by ID"""
    visitor = db.query(Visitor).filter(Visitor.id == visitor_id).first()
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")
    
    return {
        "id": visitor.id,
        "vtid": visitor.vtid,
        "fullname": visitor.fullname,
        "email": visitor.email,
        "phone": visitor.phone,
        "address": visitor.address,
        "purpose": visitor.purpose,
        "whometomeet": visitor.whometomeet,
        "selfie": visitor.selfie,
        "checkintime": visitor.checkintime.isoformat() if visitor.checkintime else None,
        "checkouttime": visitor.checkouttime.isoformat() if visitor.checkouttime else None,
        "status": visitor.status,
        "created_at": visitor.created_at.isoformat() if visitor.created_at else None
    }

@router.put("/vms/visitors/{visitor_id}/checkout")
def checkout_visitor(
    visitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check out a visitor"""
    visitor = db.query(Visitor).filter(Visitor.id == visitor_id).first()
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")
    
    if visitor.status == 'OUT':
        raise HTTPException(status_code=400, detail="Visitor already checked out")
    
    visitor.checkouttime = get_ist_now()
    visitor.status = 'OUT'
    
    db.commit()
    db.refresh(visitor)
    
    return {
        "message": "Visitor checked out successfully",
        "visitor": {
            "id": visitor.id,
            "vtid": visitor.vtid,
            "checkouttime": visitor.checkouttime.isoformat() if visitor.checkouttime else None,
            "status": visitor.status
        }
    }

# Legacy VMS Item endpoints (keeping for backward compatibility)
@router.get("/vms/items")
def get_all_items(
    db: Session = Depends(get_db)
):
    """Get all VMS items"""
    items = db.query(VMSItem).all()
    return [
        {
            "id": item.id,
            "name": item.name,
            "description": item.description,
            "category": item.category,
            "quantity": item.quantity,
            "unit": item.unit,
            "location": item.location,
            "status": item.status,
            "notes": item.notes,
            "created_at": item.created_at.isoformat() if item.created_at else None
        }
        for item in items
    ]

@router.get("/vms/items/list")
def get_items_list(
    filter: Optional[str] = "all",
    db: Session = Depends(get_db)
):
    """Get VMS items list with optional filter"""
    query = db.query(VMSItem)
    
    if filter != "all":
        query = query.filter(VMSItem.status == filter)
    
    items = query.all()
    return [
        {
            "id": item.id,
            "name": item.name,
            "description": item.description,
            "category": item.category,
            "quantity": item.quantity,
            "unit": item.unit,
            "location": item.location,
            "status": item.status,
            "notes": item.notes
        }
        for item in items
    ]

@router.post("/vms/items/add")
def add_item(
    item: VMSItemCreate,
    db: Session = Depends(get_db)
):
    """Add a new VMS item"""
    new_item = VMSItem(
        name=item.name,
        description=item.description,
        category=item.category,
        quantity=item.quantity,
        unit=item.unit,
        location=item.location,
        status=item.status,
        notes=item.notes
    )
    
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    
    return {
        "message": "Item added successfully",
        "id": new_item.id,
        "item": {
            "id": new_item.id,
            "name": new_item.name,
            "description": new_item.description,
            "category": new_item.category,
            "quantity": new_item.quantity,
            "unit": new_item.unit,
            "location": new_item.location,
            "status": new_item.status,
            "notes": new_item.notes
        }
    }

@router.get("/vms/items/{item_id}")
def get_item(
    item_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific VMS item by ID"""
    item = db.query(VMSItem).filter(VMSItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "category": item.category,
        "quantity": item.quantity,
        "unit": item.unit,
        "location": item.location,
        "status": item.status,
        "notes": item.notes,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None
    }

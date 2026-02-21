from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, text, extract
from datetime import datetime, date, timedelta
from utils import get_ist_now
from database import get_db
from models import VMSItem, Visitor, User, StationeryItem, StockTransaction, ItemIssue, Event, EventItem
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
import os
from pathlib import Path
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

# Create uploads directory for visitor images
BASE_DIR = Path(__file__).resolve().parent.parent
VMS_IMAGE_DIR = BASE_DIR / "uploads" / "vms_image"
VMS_IMAGE_DIR.mkdir(parents=True, exist_ok=True)

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
    """Send WhatsApp notification with image - Based on reference API structure"""
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
        
        # Format date of visit (convert to yyyy-MM-dd format if needed)
        try:
            # Try to parse and format the date
            if '/' in date_of_visit:
                # Format: dd/mm/yyyy HH:MM:SS
                date_part = date_of_visit.split()[0]
                day, month, year = date_part.split('/')
                formatted_date = f"{year}-{month}-{day}"
            else:
                formatted_date = date_of_visit.split()[0] if ' ' in date_of_visit else date_of_visit
        except:
            formatted_date = date_of_visit
        
        # Build payload according to reference API specification
        payload = {
            "apiKey": WHATSAPP_API_KEY,
            "campaignName": WHATSAPP_CAMPAIGN,
            "destination": phone_clean,
            "userName": "BRIHASPATHI TECHNOLOGIES PRIVATE LIMITED",
            "templateParams": [employee_name, visitor_name, visit_purpose, address, formatted_date],
            "source": "new-landing-page form"
        }
        
        # Add media object if image is available
        if is_url and image_to_use:
            payload["media"] = {
                "url": image_to_use,
                "filename": "visitor_photo"
            }
        
        # Add interactive buttons (Approve/Reject/Wait)
        payload["interactive"] = {
            "type": "button",
            "body": {
                "text": "Please select an option:"
            },
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {
                            "id": "approve",
                            "title": "✅ Approve"
                        }
                    },
                    {
                        "type": "reply",
                        "reply": {
                            "id": "reject",
                            "title": "❌ Reject"
                        }
                    },
                    {
                        "type": "reply",
                        "reply": {
                            "id": "wait",
                            "title": "⏳ Wait"
                        }
                    }
                ]
            }
        }
        
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {WHATSAPP_API_KEY}"
        }
        
        print(f"WhatsApp API Request:")
        print(f"  URL: {WHATSAPP_API_URL}")
        print(f"  Campaign: {WHATSAPP_CAMPAIGN}")
        print(f"  Phone: {phone_clean}")
        print(f"  Payload keys: {list(payload.keys())}")
        
        response = requests.post(WHATSAPP_API_URL, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            print(f"WhatsApp notification sent successfully to {phone}")
            return True
        else:
            print(f"WhatsApp API error: {response.status_code} - {response.text}")
            # Try without Authorization header if it fails
            if response.status_code == 401:
                print("Trying without Authorization header...")
                headers_no_auth = {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
                response = requests.post(WHATSAPP_API_URL, json=payload, headers=headers_no_auth, timeout=30)
                if response.status_code == 200:
                    print(f"WhatsApp notification sent successfully to {phone} (without auth header)")
                    return True
                else:
                    print(f"WhatsApp API error (retry): {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"WhatsApp error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def send_email_notification(employee_name: str, employee_email: str, visitor_name: str, visit_purpose: str, address: str, date_of_visit: str, visitor_phone: str, visitor_email: str, image_data: str = None):
    """Send email notification with image embedded in HTML"""
    try:
        if not is_valid_email(employee_email):
            print(f"Invalid employee email: {employee_email}")
            return False
        
        msg = MIMEMultipart('alternative')
        msg['From'] = EMAIL_FROM
        msg['To'] = employee_email
        msg['Subject'] = f"Visitor Alert: {visitor_name} is here to meet you"
        
        # Get image data
        image_to_use = image_data
        if not image_data:
            image_to_use = DEFAULT_IMAGE_URL
        
        img_data, is_url = get_image_data(image_to_use)
        image_cid = None
        
        # Download image if URL, or use base64
        if is_url:
            try:
                img_response = requests.get(image_to_use, timeout=10)
                if img_response.status_code == 200:
                    img_data = img_response.content
                else:
                    img_response = requests.get(DEFAULT_IMAGE_URL, timeout=10)
                    if img_response.status_code == 200:
                        img_data = img_response.content
                    else:
                        img_data = None
            except:
                try:
                    img_response = requests.get(DEFAULT_IMAGE_URL, timeout=10)
                    if img_response.status_code == 200:
                        img_data = img_response.content
                    else:
                        img_data = None
                except:
                    img_data = None
        
        # Create HTML email body
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
            padding: 20px;
        }}
        .email-wrapper {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .email-header {{
            background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .email-header h2 {{
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }}
        .email-body {{
            padding: 30px;
        }}
        .visitor-image {{
            width: 100%;
            max-width: 300px;
            height: auto;
            border-radius: 12px;
            margin: 0 auto 30px;
            display: block;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }}
        .visitor-details {{
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }}
        .detail-row {{
            display: flex;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
        }}
        .detail-row:last-child {{
            border-bottom: none;
        }}
        .detail-label {{
            font-weight: 600;
            color: #6366f1;
            min-width: 140px;
            margin-right: 20px;
        }}
        .detail-value {{
            color: #333;
            flex: 1;
        }}
        .greeting {{
            font-size: 16px;
            color: #333;
            margin-bottom: 20px;
        }}
        .footer {{
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            color: #666;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <h2>Visitor Alert</h2>
        </div>
        <div class="email-body">
            <p class="greeting">Dear {employee_name},</p>
            <p style="margin-bottom: 20px;">You have a visitor at the reception:</p>
"""
        
        # Add image if available
        if img_data:
            image_cid = "visitor_image"
            image_part = MIMEImage(img_data)
            image_part.add_header('Content-ID', f'<{image_cid}>')
            image_part.add_header('Content-Disposition', 'inline', filename='visitor_image.jpg')
            msg.attach(image_part)
            html_body += f'            <img src="cid:{image_cid}" alt="Visitor Photo" class="visitor-image" />\n'
        
        html_body += f"""
            <div class="visitor-details">
                <div class="detail-row">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value">{visitor_name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Phone:</span>
                    <span class="detail-value">{visitor_phone or 'Not provided'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Email:</span>
                    <span class="detail-value">{visitor_email or 'Not provided'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Purpose:</span>
                    <span class="detail-value">{visit_purpose or 'Not specified'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Whom to Meet:</span>
                    <span class="detail-value">{employee_name}</span>
                </div>
            </div>
            <p style="margin-top: 20px;">Please proceed to the reception to meet your visitor.</p>
        </div>
        <div class="footer">
            <p><strong>Best regards,</strong></p>
            <p>HRMS System</p>
            <p>BRIHASPATHI TECHNOLOGIES PRIVATE LIMITED</p>
        </div>
    </div>
</body>
</html>
"""
        
        # Create plain text version
        text_body = f"""Dear {employee_name},

You have a visitor at the reception:

Visitor Details:
- Name: {visitor_name}
- Phone: {visitor_phone or 'Not provided'}
- Email: {visitor_email or 'Not provided'}
- Purpose: {visit_purpose or 'Not specified'}
- Whom to Meet: {employee_name}
- Date of Visit: {date_of_visit}

Please proceed to the reception to meet your visitor.

Best regards,
HRMS System
BRIHASPATHI TECHNOLOGIES PRIVATE LIMITED"""
        
        # Attach both plain text and HTML
        part1 = MIMEText(text_body, 'plain')
        part2 = MIMEText(html_body, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
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

def send_visitor_email_notification(visitor_name: str, visitor_email: str, visit_purpose: str, address: str, date_of_visit: str, employee_name: str, image_data: str = None):
    """Send email notification to visitor with their captured image"""
    try:
        if not is_valid_email(visitor_email):
            print(f"Invalid visitor email: {visitor_email}")
            return False
        
        msg = MIMEMultipart('alternative')
        msg['From'] = EMAIL_FROM
        msg['To'] = visitor_email
        msg['Subject'] = f"Your Visitor Pass - {visitor_name}"
        
        # Get image data
        image_to_use = image_data
        if not image_data:
            image_to_use = DEFAULT_IMAGE_URL
        
        img_data, is_url = get_image_data(image_to_use)
        image_cid = None
        
        # Download image if URL, or use base64
        if is_url:
            try:
                img_response = requests.get(image_to_use, timeout=10)
                if img_response.status_code == 200:
                    img_data = img_response.content
                else:
                    img_response = requests.get(DEFAULT_IMAGE_URL, timeout=10)
                    if img_response.status_code == 200:
                        img_data = img_response.content
                    else:
                        img_data = None
            except:
                try:
                    img_response = requests.get(DEFAULT_IMAGE_URL, timeout=10)
                    if img_response.status_code == 200:
                        img_data = img_response.content
                    else:
                        img_data = None
                except:
                    img_data = None
        
        # Create HTML email body
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
            padding: 20px;
        }}
        .email-wrapper {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .email-header {{
            background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .email-header h2 {{
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }}
        .email-body {{
            padding: 30px;
        }}
        .visitor-image {{
            width: 100%;
            max-width: 300px;
            height: auto;
            border-radius: 12px;
            margin: 0 auto 30px;
            display: block;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }}
        .visitor-details {{
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }}
        .detail-row {{
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
        }}
        .detail-row:last-child {{
            border-bottom: none;
        }}
        .detail-label {{
            font-weight: 600;
            color: #666;
        }}
        .detail-value {{
            color: #333;
        }}
        .footer {{
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <h2>Your Visitor Pass</h2>
        </div>
        <div class="email-body">
            <p class="greeting">Dear {visitor_name},</p>
            <p style="margin-bottom: 20px;">Thank you for visiting us! Here is your visitor pass:</p>
"""
        
        # Add image if available
        if img_data:
            image_cid = "visitor_image"
            image_part = MIMEImage(img_data)
            image_part.add_header('Content-ID', f'<{image_cid}>')
            image_part.add_header('Content-Disposition', 'inline', filename='visitor_image.jpg')
            msg.attach(image_part)
            html_body += f'            <img src="cid:{image_cid}" alt="Your Visitor Photo" class="visitor-image" />\n'
        
        html_body += f"""
            <div class="visitor-details">
                <div class="detail-row">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value">{visitor_name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Purpose:</span>
                    <span class="detail-value">{visit_purpose or 'Not specified'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Meeting With:</span>
                    <span class="detail-value">{employee_name or 'Not specified'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date of Visit:</span>
                    <span class="detail-value">{date_of_visit}</span>
                </div>
            </div>
            <p style="margin-top: 20px;">Please keep this email for your records.</p>
        </div>
        <div class="footer">
            <p><strong>Best regards,</strong></p>
            <p>HRMS System</p>
            <p>BRIHASPATHI TECHNOLOGIES PRIVATE LIMITED</p>
        </div>
    </div>
</body>
</html>
"""
        
        # Create plain text version
        text_body = f"""Dear {visitor_name},

Thank you for visiting us! Here is your visitor pass:

Visitor Details:
- Name: {visitor_name}
- Purpose: {visit_purpose or 'Not specified'}
- Meeting With: {employee_name or 'Not specified'}
- Date of Visit: {date_of_visit}

Please keep this email for your records.

Best regards,
HRMS System
BRIHASPATHI TECHNOLOGIES PRIVATE LIMITED"""
        
        # Attach both plain text and HTML
        part1 = MIMEText(text_body, 'plain')
        part2 = MIMEText(html_body, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_FROM, EMAIL_PASSWORD)
        server.sendmail(EMAIL_FROM, visitor_email, msg.as_string())
        server.quit()
        print(f"Visitor email sent to {visitor_email}")
        return True
    except Exception as e:
        print(f"Visitor email error: {str(e)}")
        return False

def send_visitor_checkout_thankyou_email(visitor_name: str, visitor_email: str):
    """Send thank-you and feedback email to visitor after checkout"""
    try:
        if not is_valid_email(visitor_email):
            print(f"Invalid visitor email: {visitor_email}")
            return False
        
        msg = MIMEMultipart('alternative')
        msg['From'] = EMAIL_FROM
        msg['To'] = visitor_email
        msg['Subject'] = "Thank You for Visiting Brihaspathi Technologies Limited"
        
        # Create HTML email body with enhanced UI
        html_body = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.8;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            min-height: 100vh;
        }}
        .email-wrapper {{
            max-width: 650px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            overflow: hidden;
        }}
        .email-header {{
            background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
            position: relative;
        }}
        .email-header::before {{
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="2" fill="rgba(255,255,255,0.1)"/></svg>');
            opacity: 0.3;
        }}
        .email-header h2 {{
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            position: relative;
            z-index: 1;
            letter-spacing: 1px;
        }}
        .email-header .icon {{
            font-size: 48px;
            margin-bottom: 15px;
            position: relative;
            z-index: 1;
        }}
        .email-body {{
            padding: 40px 35px;
        }}
        .greeting {{
            font-size: 18px;
            margin-bottom: 25px;
            color: #1e40af;
            font-weight: 600;
        }}
        .content {{
            margin-bottom: 20px;
            color: #4b5563;
            font-size: 16px;
            line-height: 1.8;
        }}
        .highlight-box {{
            background: linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%);
            border-left: 4px solid #6366f1;
            padding: 20px;
            margin: 25px 0;
            border-radius: 8px;
        }}
        .social-links {{
            margin: 35px 0;
            padding: 25px;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-radius: 12px;
            border: 2px solid #e2e8f0;
        }}
        .social-links h3 {{
            margin-bottom: 20px;
            color: #1e293b;
            font-size: 20px;
            font-weight: 600;
            text-align: center;
        }}
        .social-link {{
            display: flex;
            align-items: center;
            margin: 15px 0;
            padding: 15px 20px;
            background: white;
            border-radius: 10px;
            text-decoration: none;
            color: #6366f1;
            font-weight: 500;
            transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
        }}
        .social-link:hover {{
            background: linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%);
            transform: translateX(5px);
            box-shadow: 0 4px 8px rgba(99, 102, 241, 0.2);
        }}
        .social-link::before {{
            content: '🔗';
            margin-right: 12px;
            font-size: 20px;
        }}
        .social-link.facebook::before {{
            content: '📘';
        }}
        .social-link.instagram::before {{
            content: '📷';
        }}
        .social-link.linkedin::before {{
            content: '💼';
        }}
        .footer {{
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .footer p {{
            margin: 8px 0;
            font-size: 15px;
        }}
        .footer strong {{
            font-size: 18px;
            color: #fbbf24;
        }}
        .divider {{
            height: 2px;
            background: linear-gradient(90deg, transparent, #6366f1, transparent);
            margin: 30px 0;
        }}
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <div class="icon">🙏</div>
            <h2>Thank You for Visiting</h2>
        </div>
        <div class="email-body">
            <p class="content">Thank you for visiting <strong>Brihaspathi Technologies Limited</strong>.</p>
            <p class="content">We would appreciate your valuable feedback at your convenience. Thank you in advance for your time and support.</p>
        </div>
        <div class="footer">
            <p><strong>Best Regards,</strong></p>
            <p>Brihaspathi Technologies Limited</p>
        </div>
    </div>
</body>
</html>
"""
        
        # Create plain text version
        text_body = """Thank you for visiting Brihaspathi Technologies Limited.

We would appreciate your valuable feedback at your convenience. Thank you in advance for your time and support.


Best regards,
Brihaspathi Technologies Limited"""
        
        # Attach both plain text and HTML
        part1 = MIMEText(text_body, 'plain')
        part2 = MIMEText(html_body, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_FROM, EMAIL_PASSWORD)
        server.sendmail(EMAIL_FROM, visitor_email, msg.as_string())
        server.quit()
        print(f"Visitor checkout thank-you email sent to {visitor_email}")
        return True
    except Exception as e:
        print(f"Visitor checkout email error: {str(e)}")
        return False

def send_visitor_whatsapp_notification(visitor_name: str, visit_purpose: str, date_of_visit: str, employee_name: str, phone: str, image_data: str = None):
    """Send WhatsApp notification to visitor with their captured image"""
    try:
        if not is_valid_phone(phone):
            print(f"Invalid visitor phone number: {phone}")
            return False
        
        phone_clean = phone.replace("+", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        
        # Use provided image or default
        image_to_use = image_data
        if not image_data:
            image_to_use = DEFAULT_IMAGE_URL
        
        # Get image data
        img_data, is_url = get_image_data(image_to_use)
        if not img_data and not is_url:
            image_to_use = DEFAULT_IMAGE_URL
            is_url = True
        
        # Build payload for visitor notification
        payload = {
            "campaignName": WHATSAPP_CAMPAIGN,
            "destination": phone_clean,
            "userName": "BRIHASPATHI TECHNOLOGIES PRIVATE LIMITED",
            "templateParams": [visitor_name, visit_purpose or 'Not specified', employee_name or 'Not specified', date_of_visit],
            "source": "visitor-pass"
        }
        
        # If image is a URL, add it to payload
        if is_url:
            payload["imageUrl"] = image_to_use
        
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {WHATSAPP_API_KEY}"
        }
        
        print(f"Visitor WhatsApp API Request:")
        print(f"  URL: {WHATSAPP_API_URL}")
        print(f"  Phone: {phone_clean}")
        print(f"  Payload: {payload}")
        
        response = requests.post(WHATSAPP_API_URL, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            print(f"Visitor WhatsApp notification sent to {phone}")
            return True
        else:
            print(f"Visitor WhatsApp API error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"Visitor WhatsApp error: {str(e)}")
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

# Image upload endpoint for visitor images
@router.post("/vms/visitors/upload-image")
async def upload_visitor_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload visitor image and return public URL"""
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Only image files are allowed")
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        file_ext = Path(file.filename).suffix.lower() if file.filename else '.jpg'
        safe_filename = f"{timestamp}{file_ext}"
        file_path = VMS_IMAGE_DIR / safe_filename
        
        # Save file
        content = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        # Return public URL
        image_url = f"{FRONTEND_URL}api/uploads/vms_image/{safe_filename}"
        return {"image_url": image_url, "filename": safe_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading image: {str(e)}")

# Visitor Management Endpoints
@router.post("/vms/visitors/add")
def add_visitor(
    visitor_data: VisitorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a new visitor"""
    try:
        # Handle image upload if it's base64
        image_url = visitor_data.selfie
        if visitor_data.selfie and visitor_data.selfie.startswith('data:image'):
            try:
                # Extract base64 data
                header, encoded = visitor_data.selfie.split(',', 1)
                decoded = base64.b64decode(encoded)
                
                # Determine file extension from header
                if 'jpeg' in header or 'jpg' in header:
                    file_ext = '.jpg'
                elif 'png' in header:
                    file_ext = '.png'
                else:
                    file_ext = '.jpg'
                
                # Generate unique filename
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                safe_filename = f"{timestamp}{file_ext}"
                file_path = VMS_IMAGE_DIR / safe_filename
                
                # Save file
                with open(file_path, "wb") as buffer:
                    buffer.write(decoded)
                
                # Create public URL
                image_url = f"{FRONTEND_URL}api/uploads/vms_image/{safe_filename}"
            except Exception as img_error:
                print(f"Error saving visitor image: {str(img_error)}")
                # Continue with original selfie data if save fails
                image_url = visitor_data.selfie
        
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
            selfie=image_url,
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
                    # For users 99 and 123123, send WhatsApp regardless of consent if phone exists
                    whatsapp_consent = getattr(user_to_meet, 'whatsapp_consent', False)
                    current_user_empid = getattr(current_user, 'empid', None)
                    should_send_whatsapp = False
                    
                    # Check if we should send WhatsApp
                    if user_to_meet.phone:
                        # For users 99 and 123123, send regardless of consent
                        if current_user_empid in ['99', '123123']:
                            should_send_whatsapp = True
                        # For other users, check consent
                        elif whatsapp_consent is True:
                            should_send_whatsapp = True
                    
                    if should_send_whatsapp:
                        print(f"Attempting to send WhatsApp to {user_to_meet.name} (Phone: {user_to_meet.phone}, Consent: {whatsapp_consent}, User: {current_user_empid})")
                        try:
                            result = send_whatsapp_notification(
                                employee_name=user_to_meet.name,
                                visitor_name=visitor_data.fullname,
                                visit_purpose=visitor_data.purpose or 'Not specified',
                                address=visitor_data.address or 'Not provided',
                                date_of_visit=date_of_visit,
                                phone=user_to_meet.phone,
                                image_data=image_url
                            )
                            if result:
                                print(f"WhatsApp notification sent successfully to {user_to_meet.name}")
                            else:
                                print(f"WhatsApp notification failed for {user_to_meet.name}")
                        except Exception as wa_error:
                            print(f"WhatsApp notification error for {user_to_meet.name}: {str(wa_error)}")
                            import traceback
                            traceback.print_exc()
                    else:
                        print(f"WhatsApp not sent to {user_to_meet.name} - Consent: {whatsapp_consent}, Phone: {user_to_meet.phone if user_to_meet.phone else 'Not provided'}, Current User: {current_user_empid}")
                    
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
                                image_data=image_url
                            )
                        except Exception as email_error:
                            print(f"Email notification error: {str(email_error)}")
            except Exception as e:
                # Log error but don't fail the visitor creation
                print(f"Error sending notifications: {str(e)}")
                import traceback
                traceback.print_exc()
        
        # Note: Visitor email/WhatsApp notifications are NOT sent when visitor is added
        # They will be sent only when visitor is checked out (see checkout_visitor endpoint)
        
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
    purpose: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all visitors - Employee and Manager roles see only visitors who came to meet them"""
    try:
        query = db.query(Visitor)
        
        # For Employee and Manager roles, filter visitors who came to meet them
        if current_user.role in ["Employee", "Manager"]:
            query = query.filter(
                or_(
                    Visitor.whometomeet == current_user.name,
                    Visitor.whometomeet == str(current_user.empid)
                )
            )
        
        if status:
            query = query.filter(Visitor.status == status)
        
        # Filter by purpose
        if purpose:
            query = query.filter(Visitor.purpose == purpose)
        
        # Filter by date range
        if from_date:
            try:
                from_date_obj = datetime.strptime(from_date, "%Y-%m-%d").date()
                query = query.filter(func.date(Visitor.checkintime) >= from_date_obj)
            except ValueError:
                pass  # Invalid date format, ignore
        
        if to_date:
            try:
                to_date_obj = datetime.strptime(to_date, "%Y-%m-%d").date()
                query = query.filter(func.date(Visitor.checkintime) <= to_date_obj)
            except ValueError:
                pass  # Invalid date format, ignore
        
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

@router.get("/vms/dashboard")
def get_vms_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get VMS dashboard statistics"""
    try:
        # Base query - filter by role
        query = db.query(Visitor)
        
        # For Employee and Manager roles, filter visitors who came to meet them
        if current_user.role in ["Employee", "Manager"]:
            query = query.filter(
                or_(
                    Visitor.whometomeet == current_user.name,
                    Visitor.whometomeet == str(current_user.empid)
                )
            )
        
        # Get all visitors for calculations
        all_visitors = query.all()
        
        # Date calculations
        today = date.today()
        start_of_week = today - timedelta(days=today.weekday())
        start_of_month = date(today.year, today.month, 1)
        start_of_year = date(today.year, 1, 1)
        
        # Filter visitors by date ranges
        today_visitors = [v for v in all_visitors if v.checkintime and v.checkintime.date() == today]
        week_visitors = [v for v in all_visitors if v.checkintime and v.checkintime.date() >= start_of_week]
        month_visitors = [v for v in all_visitors if v.checkintime and v.checkintime.date() >= start_of_month]
        year_visitors = [v for v in all_visitors if v.checkintime and v.checkintime.date() >= start_of_year]
        
        # All possible purposes
        all_purposes = ['Business', 'Vendor', 'Client', 'Interview', 'Family', 'Friend']
        
        # Count by purpose for each period
        def count_by_purpose(visitors_list, include_all_purposes=False):
            purpose_counts = {}
            
            # Initialize all purposes with 0 if include_all_purposes is True
            if include_all_purposes:
                for purpose in all_purposes:
                    purpose_counts[purpose] = 0
            
            for visitor in visitors_list:
                purpose = visitor.purpose or 'Other'
                purpose_counts[purpose] = purpose_counts.get(purpose, 0) + 1
            return purpose_counts
        
        return {
            "counts": {
                "today": len(today_visitors),
                "this_week": len(week_visitors),
                "this_month": len(month_visitors),
                "this_year": len(year_visitors)
            },
            "purpose_counts": {
                "today": count_by_purpose(today_visitors, include_all_purposes=True),  # Show all purposes for today
                "this_week": count_by_purpose(week_visitors, include_all_purposes=True),  # Show all purposes for this week
                "this_month": count_by_purpose(month_visitors, include_all_purposes=True),  # Show all purposes for this month
                "this_year": count_by_purpose(year_visitors, include_all_purposes=True)  # Show all purposes for this year
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching dashboard data: {str(e)}")

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
    
    # Send thank-you and feedback email to visitor after checkout
    if visitor.email and is_valid_email(visitor.email):
        try:
            send_visitor_checkout_thankyou_email(
                visitor_name=visitor.fullname,
                visitor_email=visitor.email
            )
        except Exception as email_error:
            # Log error but don't fail the checkout
            print(f"Error sending checkout thank-you email: {str(email_error)}")
    
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

# Stationery Items Endpoints
class StationeryItemCreate(BaseModel):
    item_name: str
    available_quantity: int = 0
    description: Optional[str] = None

class StationeryItemUpdate(BaseModel):
    item_name: Optional[str] = None
    available_quantity: Optional[int] = None
    description: Optional[str] = None

class StockAddRequest(BaseModel):
    item_id: int
    quantity: int
    remarks: Optional[str] = None

class ItemIssueRequest(BaseModel):
    item_id: int
    quantity: int
    issued_to_empid: str
    issued_by_name: Optional[str] = 'FrontOffice'

class EventCreate(BaseModel):
    event_name: str
    event_date: date
    total_quantity: int = 0

class EventItemCreate(BaseModel):
    event_id: int
    employees: Optional[List[dict]] = None
    clients: Optional[List[dict]] = None

@router.get("/stationery/items")
def get_stationery_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all stationery items"""
    items = db.query(StationeryItem).all()
    return [
        {
            "item_id": item.item_id,
            "item_name": item.item_name,
            "available_quantity": item.available_quantity,
            "description": item.description
        }
        for item in items
    ]

@router.post("/stationery/items")
def create_stationery_item(
    item_data: StationeryItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new stationery item"""
    new_item = StationeryItem(
        item_name=item_data.item_name,
        available_quantity=item_data.available_quantity,
        description=item_data.description
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    
    # Create stock transaction for initial stock
    if item_data.available_quantity > 0:
        transaction = StockTransaction(
            item_id=new_item.item_id,
            quantity_change=item_data.available_quantity,
            transaction_type='ADD',
            remarks='Initial stock'
        )
        db.add(transaction)
        db.commit()
    
    return {
        "message": "Item created successfully",
        "item": {
            "item_id": new_item.item_id,
            "item_name": new_item.item_name,
            "available_quantity": new_item.available_quantity,
            "description": new_item.description
        }
    }

@router.put("/stationery/items/{item_id}")
def update_stationery_item(
    item_id: int,
    item_data: StationeryItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a stationery item"""
    item = db.query(StationeryItem).filter(StationeryItem.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item_data.item_name is not None:
        item.item_name = item_data.item_name
    if item_data.description is not None:
        item.description = item_data.description
    if item_data.available_quantity is not None:
        # Create transaction for quantity change
        quantity_diff = item_data.available_quantity - item.available_quantity
        if quantity_diff != 0:
            transaction = StockTransaction(
                item_id=item.item_id,
                quantity_change=quantity_diff,
                transaction_type='ADD' if quantity_diff > 0 else 'ISSUE',
                remarks=f'Manual quantity update'
            )
            db.add(transaction)
        item.available_quantity = item_data.available_quantity
    
    db.commit()
    db.refresh(item)
    
    return {
        "message": "Item updated successfully",
        "item": {
            "item_id": item.item_id,
            "item_name": item.item_name,
            "available_quantity": item.available_quantity,
            "description": item.description
        }
    }

@router.delete("/stationery/items/{item_id}")
def delete_stationery_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a stationery item"""
    item = db.query(StationeryItem).filter(StationeryItem.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    db.delete(item)
    db.commit()
    
    return {"message": "Item deleted successfully"}

@router.post("/stationery/stock/add")
def add_stock(
    stock_data: StockAddRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add stock to an item"""
    item = db.query(StationeryItem).filter(StationeryItem.item_id == stock_data.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item.available_quantity += stock_data.quantity
    
    transaction = StockTransaction(
        item_id=stock_data.item_id,
        quantity_change=stock_data.quantity,
        transaction_type='ADD',
        remarks=stock_data.remarks
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(item)
    
    return {
        "message": "Stock added successfully",
        "item": {
            "item_id": item.item_id,
            "item_name": item.item_name,
            "available_quantity": item.available_quantity
        }
    }

@router.post("/stationery/issues")
def issue_item(
    issue_data: ItemIssueRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Issue item to an employee"""
    item = db.query(StationeryItem).filter(StationeryItem.item_id == issue_data.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item.available_quantity < issue_data.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    # Check if employee exists
    employee = db.query(User).filter(User.empid == issue_data.issued_to_empid).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    item.available_quantity -= issue_data.quantity
    
    issue = ItemIssue(
        item_id=issue_data.item_id,
        quantity=issue_data.quantity,
        issued_to_empid=issue_data.issued_to_empid,
        issued_by_name=issue_data.issued_by_name or current_user.name
    )
    
    transaction = StockTransaction(
        item_id=issue_data.item_id,
        quantity_change=-issue_data.quantity,
        transaction_type='ISSUE',
        remarks=f'Issued to {employee.name}'
    )
    
    db.add(issue)
    db.add(transaction)
    db.commit()
    db.refresh(item)
    
    return {
        "message": "Item issued successfully",
        "issue": {
            "issue_id": issue.issue_id,
            "item_name": item.item_name,
            "quantity": issue.quantity,
            "issued_to": employee.name,
            "issue_date": issue.issue_date.isoformat()
        }
    }

@router.get("/stationery/issues")
def get_item_issues(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all item issues"""
    issues = db.query(ItemIssue).order_by(ItemIssue.issue_date.desc()).all()
    result = []
    for issue in issues:
        item = db.query(StationeryItem).filter(StationeryItem.item_id == issue.item_id).first()
        employee = db.query(User).filter(User.empid == issue.issued_to_empid).first()
        result.append({
            "issue_id": issue.issue_id,
            "item_id": issue.item_id,
            "item_name": item.item_name if item else "Unknown",
            "quantity": issue.quantity,
            "issued_to_empid": issue.issued_to_empid,
            "issued_to_name": employee.name if employee else "Unknown",
            "issued_by_name": issue.issued_by_name,
            "issue_date": issue.issue_date.isoformat() if issue.issue_date else None
        })
    return result

@router.get("/stationery/issues/matrix")
def get_issues_matrix(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get issues matrix - employees vs items
    - HR: Shows all employees
    - Manager/Employee: Shows only their own data
    """
    items = db.query(StationeryItem).all()
    
    # Filter employees based on role
    if current_user.role in ["Manager", "Employee"]:
        # Manager/Employee can only see their own data
        employees = [current_user] if current_user.empid else []
        issues = db.query(ItemIssue).filter(ItemIssue.issued_to_empid == current_user.empid).all()
    else:
        # HR and other roles see all employees
        employees = db.query(User).filter(User.is_active == True).all()
        issues = db.query(ItemIssue).all()
    
    # Build matrix
    matrix = {}
    for employee in employees:
        if employee.empid:
            matrix[employee.empid] = {
                "name": employee.name,
                "items": {}
            }
            for item in items:
                matrix[employee.empid]["items"][item.item_id] = 0
    
    # Fill matrix with issue quantities
    for issue in issues:
        if issue.issued_to_empid in matrix:
            if issue.item_id in matrix[issue.issued_to_empid]["items"]:
                matrix[issue.issued_to_empid]["items"][issue.item_id] += issue.quantity
    
    return {
        "employees": [{"empid": emp.empid, "name": emp.name} for emp in employees if emp.empid],
        "items": [{"item_id": item.item_id, "item_name": item.item_name} for item in items],
        "matrix": matrix
    }

# Events Endpoints
@router.get("/stationery/events")
def get_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all events"""
    events = db.query(Event).order_by(Event.event_date.desc()).all()
    result = []
    for event in events:
        event_items = db.query(EventItem).filter(EventItem.event_id == event.event_id).all()
        total_items = len(event_items)
        total_assigned = sum(ei.quantity for ei in event_items)
        total_employees = 0
        total_clients = 0
        for ei in event_items:
            if ei.employees:
                total_employees += len(ei.employees) if isinstance(ei.employees, list) else 0
            if ei.clients:
                total_clients += len(ei.clients) if isinstance(ei.clients, list) else 0
        
        result.append({
            "event_id": event.event_id,
            "event_name": event.event_name,
            "event_date": event.event_date.isoformat() if event.event_date else None,
            "total_quantity": event.total_quantity,
            "total_assigned": total_assigned,
            "remaining_quantity": event.total_quantity - total_assigned,
            "total_items": total_items,
            "total_employees": total_employees,
            "total_clients": total_clients
        })
    return result

@router.post("/stationery/events")
def create_event(
    event_data: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new event"""
    new_event = Event(
        event_name=event_data.event_name,
        event_date=event_data.event_date,
        total_quantity=event_data.total_quantity
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    
    return {
        "message": "Event created successfully",
        "event": {
            "event_id": new_event.event_id,
            "event_name": new_event.event_name,
            "event_date": new_event.event_date.isoformat() if new_event.event_date else None,
            "total_quantity": new_event.total_quantity
        }
    }

@router.post("/stationery/events/{event_id}/items")
def add_event_item(
    event_id: int,
    item_data: EventItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add item to an event - quantity is auto-calculated from employees and clients"""
    event = db.query(Event).filter(Event.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Calculate quantity from employees and clients
    employees = item_data.employees or []
    clients = item_data.clients or []
    
    # Calculate total quantity from employees (each has quantity field, default 1)
    employee_quantity = sum(emp.get('quantity', 1) for emp in employees if isinstance(emp, dict))
    
    # Calculate total quantity from clients (each has quantity field, default 1)
    client_quantity = sum(client.get('quantity', 1) for client in clients if isinstance(client, dict))
    
    calculated_quantity = employee_quantity + client_quantity
    
    if calculated_quantity <= 0:
        raise HTTPException(status_code=400, detail="At least one employee or client must be selected")
    
    # Check if adding this quantity would exceed event's total_quantity
    existing_items = db.query(EventItem).filter(EventItem.event_id == event_id).all()
    total_assigned = sum(ei.quantity for ei in existing_items)
    
    if total_assigned + calculated_quantity > event.total_quantity:
        raise HTTPException(
            status_code=400, 
            detail=f"Adding {calculated_quantity} items would exceed event's total quantity ({event.total_quantity}). Currently assigned: {total_assigned}, Remaining: {event.total_quantity - total_assigned}"
        )
    
    new_event_item = EventItem(
        event_id=event_id,
        quantity=calculated_quantity,  # Auto-calculated
        employees=employees,
        clients=clients
    )
    db.add(new_event_item)
    db.commit()
    db.refresh(new_event_item)
    
    return {
        "message": "Event item added successfully",
        "event_item": {
            "event_item_id": new_event_item.event_item_id,
            "event_id": new_event_item.event_id,
            "quantity": new_event_item.quantity,
            "employees": new_event_item.employees,
            "clients": new_event_item.clients
        }
    }

@router.get("/stationery/events/{event_id}")
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get event details"""
    event = db.query(Event).filter(Event.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    event_items = db.query(EventItem).filter(EventItem.event_id == event_id).all()
    
    # Calculate total assigned quantity
    total_assigned = sum(ei.quantity for ei in event_items)
    remaining_quantity = event.total_quantity - total_assigned
    
    return {
        "event_id": event.event_id,
        "event_name": event.event_name,
        "event_date": event.event_date.isoformat() if event.event_date else None,
        "total_quantity": event.total_quantity,
        "total_assigned": total_assigned,
        "remaining_quantity": remaining_quantity,
        "items": [
            {
                "event_item_id": ei.event_item_id,
                "quantity": ei.quantity,
                "employees": ei.employees,
                "clients": ei.clients
            }
            for ei in event_items
        ]
    }

@router.delete("/stationery/events/{event_id}")
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an event"""
    event = db.query(Event).filter(Event.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # EventItems will be deleted automatically due to CASCADE
    db.delete(event)
    db.commit()
    
    return {"message": "Event deleted successfully"}

@router.get("/stationery/dashboard")
def get_stationery_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get stationery dashboard data"""
    items = db.query(StationeryItem).all()
    
    # Calculate used quantities from issues
    item_usage = {}
    issues = db.query(ItemIssue).all()
    for issue in issues:
        if issue.item_id not in item_usage:
            item_usage[issue.item_id] = 0
        item_usage[issue.item_id] += issue.quantity
    
    items_data = []
    for item in items:
        used = item_usage.get(item.item_id, 0)
        items_data.append({
            "item_id": item.item_id,
            "item_name": item.item_name,
            "balance": item.available_quantity,
            "used": used
        })
    
    # Get events data
    events = db.query(Event).all()
    events_data = []
    for event in events:
        event_items = db.query(EventItem).filter(EventItem.event_id == event.event_id).all()
        total_items = len(event_items)
        total_employees = 0
        total_clients = 0
        for ei in event_items:
            if ei.employees:
                total_employees += len(ei.employees) if isinstance(ei.employees, list) else 0
            if ei.clients:
                total_clients += len(ei.clients) if isinstance(ei.clients, list) else 0
        
        events_data.append({
            "event_id": event.event_id,
            "event_name": event.event_name,
            "total_items": total_items,
            "total_employees": total_employees,
            "total_clients": total_clients
        })
    
    return {
        "items": items_data,
        "events": events_data
    }

@router.get("/stationery/employees")
def get_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all employees for events"""
    employees = db.query(User).filter(User.is_active == True).all()
    return [
        {
            "empid": emp.empid,
            "name": emp.name,
            "email": emp.email,
            "phone": emp.phone
        }
        for emp in employees
    ]

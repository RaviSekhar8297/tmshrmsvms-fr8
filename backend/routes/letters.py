from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from database import get_db
from models import User
from routes.auth import get_current_user
from pydantic import BaseModel
from typing import Optional, List
import smtplib
import re
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage

router = APIRouter(prefix="/letters", tags=["Letters"])

# Email Configuration
EMAIL_FROM = "hrms@brihaspathi.com"
EMAIL_FROM_NAME = "Brihaspathi Technologies Limited"
EMAIL_PASSWORD = "aakbcohigtogpyrl"
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
BTL_LOGO_URL = "https://www.brihaspathi.com/highbtlogo%20tm%20(1).png"

class OfferLetterRequest(BaseModel):
    to_email: str
    companyName: str
    companyAddress: str
    phone: Optional[str] = None
    email: Optional[str] = None
    date: str
    employeeName: str
    designation: str
    location: str
    dateOfJoining: str
    ctc: str

class AppointmentLetterRequest(BaseModel):
    to_email: str
    companyName: str
    companyAddress: str
    date: str
    employeeName: str
    designation: str
    effectiveDate: str
    employmentType: str = "Permanent"
    ctc: str
    placeOfPosting: str
    noticePeriod: str

def format_offer_letter(data: OfferLetterRequest) -> str:
    contact_info = []
    if data.phone:
        contact_info.append(f"Phone: {data.phone}")
    if data.email:
        contact_info.append(f"Email: {data.email}")
    contact_line = " | ".join(contact_info) if contact_info else ""
    
    return f"""OFFER LETTER – FORMAT (Simple & Professional)

{data.companyName}
{data.companyAddress}
{contact_line}

Date: {data.date}

To,
Mr./Ms. {data.employeeName}

Subject: Offer of Employment

Dear Mr./Ms. {data.employeeName},

We are pleased to offer you employment with {data.companyName} for the position of {data.designation}, based at {data.location} location.

Your employment terms are as follows:

Designation: {data.designation}

Department: __________

Date of Joining: {data.dateOfJoining}

CTC: ₹ {data.ctc} per annum

Working Hours: As per company policy

This offer is subject to:

Submission of required documents

Background verification

Medical fitness (if applicable)

You are requested to sign and return a copy of this letter as a token of acceptance.

We welcome you to our organization and look forward to a mutually beneficial association.

Warm regards,

For {data.companyName}
BTL"""

def format_appointment_letter(data: AppointmentLetterRequest) -> str:
    return f"""APPOINTMENT LETTER – FORMAT (Permanent Employee)

{data.companyName}
{data.companyAddress}

Date: {data.date}

To,
Mr./Ms. {data.employeeName}

Subject: Appointment Letter

Dear Mr./Ms. {data.employeeName},

With reference to your acceptance of our offer letter, we are pleased to appoint you as {data.designation} with effect from {data.effectiveDate}.

Your terms of appointment are as under:

Employment Type: {data.employmentType}

CTC: ₹ {data.ctc} per annum

Place of Posting: {data.placeOfPosting}

Working Hours: As per company rules

Leave & Benefits: As per company policy

Termination: Either party may terminate with {data.noticePeriod} days' notice

You shall abide by all rules, regulations, and policies of the company as amended from time to time.

We wish you a successful career with us.

Sincerely,

For {data.companyName}
BTL"""

def validate_email(email: str) -> bool:
    """Simple email validation"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def send_email(to_email: str, subject: str, body: str, images: List[bytes] = None, image_names: List[str] = None) -> bool:
    """Send email using SMTP with BTL logo and optional images"""
    try:
        msg = MIMEMultipart()
        msg['From'] = f"{EMAIL_FROM_NAME} <{EMAIL_FROM}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Convert plain text to HTML for better formatting with BTL logo
        # Escape HTML special characters in body
        body_html = body.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        # Convert line breaks to HTML
        body_html = body_html.replace('\n', '<br>')
        
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
            line-height: 1.8;
            color: #1f2937;
            background-color: #f3f4f6;
            padding: 20px;
        }}
        .email-wrapper {{
            max-width: 800px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .email-header {{
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            padding: 30px 40px;
            text-align: center;
        }}
        .logo-container {{
            margin-bottom: 20px;
        }}
        .logo-container img {{
            max-width: 250px;
            height: auto;
            filter: brightness(0) invert(1);
        }}
        .email-body {{
            padding: 40px;
        }}
        .letter-content {{
            font-family: 'Georgia', 'Times New Roman', serif;
            font-size: 15px;
            line-height: 1.9;
            color: #1f2937;
            white-space: pre-wrap;
            word-wrap: break-word;
        }}
        .letter-content br {{
            line-height: 1.9;
        }}
        .email-footer {{
            background-color: #f9fafb;
            padding: 25px 40px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 13px;
            color: #6b7280;
        }}
        .footer-text {{
            margin-bottom: 8px;
        }}
        .footer-company {{
            font-weight: 600;
            color: #3b82f6;
        }}
        .attached-images {{
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px solid #e5e7eb;
        }}
        .attached-images h3 {{
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 20px;
            font-weight: 600;
            padding-bottom: 10px;
            border-bottom: 1px solid #e5e7eb;
        }}
        .images-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }}
        .image-container {{
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            background: #f9fafb;
            text-align: center;
        }}
        .image-container img {{
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }}
        @media only screen and (max-width: 600px) {{
            .email-body {{
                padding: 25px 20px;
            }}
            .email-header {{
                padding: 20px;
            }}
            .email-footer {{
                padding: 20px;
            }}
            .images-grid {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <div class="logo-container">
                <img src="{BTL_LOGO_URL}" alt="Brihaspathi Technologies Limited" />
            </div>
        </div>
        <div class="email-body">
            <div class="letter-content">{body_html}</div>
"""
        
        # Add attached images section if images provided
        if images and len(images) > 0:
            html_body += """
            <div class="attached-images">
                <h3>📎 Attached Images</h3>
                <div class="images-grid">
"""
            for i, img_data in enumerate(images):
                img_name = image_names[i] if image_names and i < len(image_names) else f"image_{i+1}"
                # Encode image as base64
                img_base64 = base64.b64encode(img_data).decode('utf-8')
                # Determine content type from file extension
                content_type = "image/jpeg"
                if img_name.lower().endswith('.png'):
                    content_type = "image/png"
                elif img_name.lower().endswith('.gif'):
                    content_type = "image/gif"
                
                html_body += f"""
                    <div class="image-container">
                        <img src="data:{content_type};base64,{img_base64}" alt="{img_name}" />
                    </div>
"""
            html_body += """
                </div>
            </div>
"""
        
        html_body += """
        </div>
        <div class="email-footer">
            <div class="footer-text">This is an automated email from</div>
            <div class="footer-company">Brihaspathi Technologies Limited</div>
            <div class="footer-text" style="margin-top: 8px;">Please do not reply to this email</div>
        </div>
    </div>
</body>
</html>
"""
        
        msg.attach(MIMEText(html_body, 'html'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_FROM, EMAIL_PASSWORD)
        server.sendmail(EMAIL_FROM, to_email, msg.as_string())
        server.quit()
        
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False

@router.post("/send-offer-letter")
def send_offer_letter(
    letter_data: OfferLetterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send offer letter via email"""
    if current_user.role not in ["Admin", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied. Only Admin and HR can send letters.")
    
    if not validate_email(letter_data.to_email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    
    letter_content = format_offer_letter(letter_data)
    subject = f"Offer Letter - {letter_data.companyName}"
    
    success = send_email(letter_data.to_email, subject, letter_content)
    
    if success:
        return {"message": "Offer letter sent successfully", "status": "success"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send email")

@router.post("/send-appointment-letter")
async def send_appointment_letter(
    to_email: str = Form(...),
    companyName: str = Form(...),
    companyAddress: str = Form(...),
    date: str = Form(...),
    employeeName: str = Form(...),
    designation: str = Form(...),
    effectiveDate: str = Form(...),
    employmentType: str = Form("Permanent"),
    ctc: str = Form(...),
    placeOfPosting: str = Form(...),
    noticePeriod: str = Form(...),
    images: List[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send appointment letter via email with optional images"""
    if current_user.role not in ["Admin", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied. Only Admin and HR can send letters.")
    
    if not validate_email(to_email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    
    # Create letter data object
    letter_data = AppointmentLetterRequest(
        to_email=to_email,
        companyName=companyName,
        companyAddress=companyAddress,
        date=date,
        employeeName=employeeName,
        designation=designation,
        effectiveDate=effectiveDate,
        employmentType=employmentType,
        ctc=ctc,
        placeOfPosting=placeOfPosting,
        noticePeriod=noticePeriod
    )
    
    letter_content = format_appointment_letter(letter_data)
    subject = f"Appointment Letter - {letter_data.companyName}"
    
    # Process images if provided
    image_data_list = []
    image_names_list = []
    if images:
        for img in images:
            if img.content_type and img.content_type.startswith('image/'):
                img_bytes = await img.read()
                image_data_list.append(img_bytes)
                image_names_list.append(img.filename)
    
    success = send_email(letter_data.to_email, subject, letter_content, image_data_list, image_names_list)
    
    if success:
        return {"message": "Appointment letter sent successfully", "status": "success"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send email")


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, cast, text
from sqlalchemy.dialects.postgresql import JSONB
from typing import List
from database import get_db
from models import Meeting, User, Activity, NotificationLog, MeetingNotes
from schemas import MeetingCreate, MeetingUpdate, MeetingResponse, MeetingNotesCreate, MeetingNotesUpdate, MeetingNotesResponse
from routes.auth import get_current_user
from utils import generate_meeting_link
from datetime import datetime, timedelta
from utils import get_ist_now
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
import json
from google_calendar import (
    create_calendar_event, 
    create_calendar_event_with_service_account,
    get_authorization_url, 
    get_credentials_from_code, 
    credentials_to_dict
)

router = APIRouter(prefix="/meetings", tags=["Meetings"])

@router.get("/", response_model=List[MeetingResponse])
def get_meetings(
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Meeting)
    
    if status:
        query = query.filter(Meeting.status == status)
    
    # Filter based on role
    if current_user.role == "Employee":
        # Employee can see meetings they are part of
        # Use text search for participants to avoid JSONB type issues
        query = query.filter(
            or_(
                Meeting.created_by == current_user.id,
                cast(Meeting.participants, JSONB).contains([{"empid": current_user.empid}])
            )
        )
    elif current_user.role == "Manager":
        # Manager can see meetings they created or are part of
        query = query.filter(
            or_(
                Meeting.created_by == current_user.id,
                cast(Meeting.participants, JSONB).contains([{"empid": current_user.empid}])
            )
        )
    
    # Limit to 500 meetings for performance
    return query.order_by(Meeting.meeting_datetime.desc()).limit(500).all()

@router.get("/today")
def get_today_meetings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get meetings scheduled for today"""
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    query = db.query(Meeting).filter(
        Meeting.meeting_datetime >= today_start,
        Meeting.meeting_datetime < today_end
    )
    
    if current_user.role != "Admin":
        query = query.filter(
            or_(
                Meeting.created_by == current_user.id,
                cast(Meeting.participants, JSONB).contains([{"empid": current_user.empid}])
            )
        )
    
    return query.order_by(Meeting.meeting_datetime).all()

@router.get("/upcoming")
def get_upcoming_meetings(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get meetings for the next n days"""
    try:
        now = datetime.now()
        end_date = now + timedelta(days=days)
        
        query = db.query(Meeting).filter(
            Meeting.meeting_datetime >= now,
            Meeting.meeting_datetime <= end_date
        )
        
        if current_user.role != "Admin":
            query = query.filter(
                or_(
                    Meeting.created_by == current_user.id,
                    cast(Meeting.participants, JSONB).contains([{"empid": current_user.empid}])
                )
            )
        
        # Limit to 200 upcoming meetings for performance
        return query.order_by(Meeting.meeting_datetime).limit(200).all()
    except Exception as e:
        print(f"Error in get_upcoming_meetings: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching upcoming meetings: {str(e)}")

@router.get("/calendar")
def get_calendar_meetings(
    month: int = None,
    year: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get meetings for calendar view"""
    try:
        if not month:
            month = datetime.now().month
        if not year:
            year = datetime.now().year
        
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        query = db.query(Meeting).filter(
            Meeting.meeting_datetime >= start_date,
            Meeting.meeting_datetime < end_date
        )
        
        if current_user.role != "Admin":
            query = query.filter(
                or_(
                    Meeting.created_by == current_user.id,
                    cast(Meeting.participants, JSONB).contains([{"empid": current_user.empid}])
                )
            )
        
        meetings = query.order_by(Meeting.meeting_datetime).all()
        
        # Group by date
        calendar_data = {}
        for meeting in meetings:
            date_key = meeting.meeting_datetime.strftime("%Y-%m-%d")
            if date_key not in calendar_data:
                calendar_data[date_key] = []
            calendar_data[date_key].append(MeetingResponse.model_validate(meeting))
        
        return calendar_data
    except Exception as e:
        print(f"Error in get_calendar_meetings: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching calendar meetings: {str(e)}")

@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting

@router.post("/", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
def create_meeting(
    meeting_data: MeetingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "Employee":
        raise HTTPException(status_code=403, detail="Employees cannot create meetings")
    
    # Auto-add logged-in user to participants if not already included
    participants = list(meeting_data.participants or [])
    current_user_participant = {
        "empid": current_user.empid,
        "name": current_user.name,
        "role": current_user.role,
        "image_base64": current_user.image_base64
    }
    # Check if current user is already in participants
    if not any(p.get("empid") == current_user.empid for p in participants):
        participants.append(current_user_participant)
    
    meeting_type = getattr(meeting_data, "meeting_type", "online")
    location = getattr(meeting_data, "location", None)

    # Try to create Google Calendar event with Meet link (unless custom link provided or offline)
    meeting_link = meeting_data.link
    calendar_event_id = None
    
    if meeting_type == "offline":
        meeting_link = None
    elif meeting_link:
        # User provided a custom link, use it as-is
        pass
    elif not meeting_link:
        # Get attendee emails - include the logged-in user's email
        attendee_emails = []
        # Add current user's email first (required for Meet link)
        if current_user.email:
            attendee_emails.append(current_user.email)
        
        for participant in participants:
            user = db.query(User).filter(User.empid == participant.get("empid")).first()
            if user and user.email and user.email != current_user.email:
                attendee_emails.append(user.email)

        # NOTE: Service accounts cannot invite attendees unless Domain-Wide Delegation (DWD) is configured.
        # To avoid 403 errors, we do NOT send attendees when using the service account.
        service_account_attendees = []
        
        # Priority 1: Try user OAuth credentials first (most reliable, supports attendees)
        if current_user.google_calendar_credentials:
            try:
                calendar_result = create_calendar_event(
                    credentials_dict=current_user.google_calendar_credentials,
                    title=meeting_data.title,
                    description=meeting_data.description or "",
                    start_datetime=meeting_data.meeting_datetime,
                    duration_minutes=meeting_data.duration_minutes,
                    attendees_emails=attendee_emails
                )
                meeting_link = calendar_result.get('meeting_link')
                calendar_event_id = calendar_result.get('calendar_event_id')
                print(f"Successfully created Google Meet link using user OAuth: {meeting_link}")
            except Exception as e2:
                print(f"Error creating Google Calendar event with user OAuth: {e2}")
                import traceback
                traceback.print_exc()
                # Try service account as fallback
                try:
                    calendar_result = create_calendar_event_with_service_account(
                        title=meeting_data.title,
                        description=meeting_data.description or "",
                        start_datetime=meeting_data.meeting_datetime,
                        duration_minutes=meeting_data.duration_minutes,
                        attendees_emails=service_account_attendees  # keep empty to avoid DWD requirement
                    )
                    meeting_link = calendar_result.get('meeting_link')
                    calendar_event_id = calendar_result.get('calendar_event_id')
                    print(f"Successfully created Google Meet link using service account: {meeting_link}")
                except FileNotFoundError:
                    # Service account file not found - allow meeting creation without link
                    print("Service account file not found. Creating meeting without Google Meet link.")
                    meeting_link = None
                except Exception as e3:
                    print(f"Service account also failed: {e3}")
                    import traceback
                    traceback.print_exc()
                    # Allow meeting creation without link instead of raising error
                    print("Creating meeting without Google Meet link. User can add link manually later.")
                    meeting_link = None
        else:
            # No user OAuth credentials - try service account if available, otherwise allow meeting without link
            try:
                calendar_result = create_calendar_event_with_service_account(
                    title=meeting_data.title,
                    description=meeting_data.description or "",
                    start_datetime=meeting_data.meeting_datetime,
                    duration_minutes=meeting_data.duration_minutes,
                    attendees_emails=service_account_attendees  # keep empty to avoid DWD requirement
                )
                meeting_link = calendar_result.get('meeting_link')
                calendar_event_id = calendar_result.get('calendar_event_id')
                print(f"Successfully created Google Meet link using service account: {meeting_link}")
            except FileNotFoundError:
                # Service account file not found - allow meeting creation without link
                print("Service account file not found. Creating meeting without Google Meet link.")
                print("User can connect Google Calendar or provide a manual link.")
                meeting_link = None  # Allow meeting to be created without link
            except Exception as e:
                print(f"Service account failed: {e}")
                import traceback
                traceback.print_exc()
                # If it's a credentials/permission error, allow meeting without link
                error_str = str(e).lower()
                if 'credentials' in error_str or 'permission' in error_str or 'not found' in error_str:
                    print("Google Calendar credentials not available. Creating meeting without Google Meet link.")
                    meeting_link = None  # Allow meeting to be created without link
                else:
                    # For other errors, still allow meeting creation but warn user
                    print(f"Warning: Could not create Google Meet link: {e}")
                    print("Creating meeting without automatic link. User can add link manually.")
                    meeting_link = None
    
    meeting = Meeting(
        title=meeting_data.title,
        description=meeting_data.description,
        meeting_datetime=meeting_data.meeting_datetime,
        duration_minutes=meeting_data.duration_minutes,
        participants=participants,
        link=meeting_link,
        meeting_type=meeting_type,
        location=location,
        status="scheduled",
        created_by=current_user.id,
        created_by_name=current_user.name
    )
    
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    
    # Send notifications to participants based on consent
    send_meeting_notifications(db, meeting, current_user)
    
    # Log activity
    activity = Activity(
        user_id=current_user.id,
        user_name=current_user.name,
        action="created",
        entity_type="meeting",
        entity_id=meeting.id,
        entity_name=meeting.title,
        details=f"Created meeting: {meeting.title}"
    )
    db.add(activity)
    db.commit()
    
    return meeting

def send_email_notification(
    to_email: str,
    participant_name: str,
    meeting_title: str,
    meeting_datetime: str,
    meeting_link: str,
    description: str = "",
    meeting_type: str = "online",
    location: str = None,
    month_year: str = ""
):
    """Send email notification using SMTP with beautiful HTML template"""
    try:
        from_email = "hrms@brihaspathi.com"
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        smtp_password = "aakbcohigtogpyrl"
        
        msg = MIMEMultipart('alternative')
        msg['From'] = from_email
        msg['To'] = to_email
        msg['Subject'] = f"Meeting Invitation: {meeting_title}"
        
        # Plain text version
        location_text = f"- Location: {location}\n" if meeting_type == "offline" and location else ""
        link_text = f"- Meeting Link: {meeting_link}\n" if meeting_link else ""

        text_body = f"""
Dear {participant_name},

You are invited to a meeting!

Meeting Details:
- Title: {meeting_title}
- Date & Time: {meeting_datetime}
 - Type: {meeting_type.capitalize()}
{location_text if location_text else link_text}
{'- Description: ' + description if description else ''}

Please join the meeting at the scheduled time.

Best regards,
Brihaspathi Technologies
        """
        
        # HTML version with beautiful design
        header_label = month_year if month_year else "Meeting"
        show_link = bool(meeting_link and meeting_type != "offline")
        show_location = bool(meeting_type == "offline" and location)

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }}
        .header .sub {{
            margin-top: 6px;
            font-size: 14px;
            opacity: 0.9;
        }}
        .content {{
            padding: 30px;
        }}
        .greeting {{
            font-size: 16px;
            color: #333;
            margin-bottom: 20px;
        }}
        .meeting-details {{
            background: #f8f9fa;
            border-left: 4px solid #6366f1;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        .detail-row {{
            margin: 12px 0;
            display: flex;
            align-items: flex-start;
        }}
        .detail-label {{
            font-weight: 600;
            color: #6366f1;
            min-width: 120px;
            margin-right: 10px;
        }}
        .detail-value {{
            color: #333;
            flex: 1;
        }}
        .meeting-link-container {{
            text-align: center;
            margin: 30px 0;
        }}
        .meeting-link-btn {{
            display: inline-block;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
            transition: transform 0.2s;
        }}
        .meeting-link-btn:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(16, 185, 129, 0.4);
        }}
        .footer {{
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
        }}
        .description-box {{
            background: #fff;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 15px;
            margin-top: 15px;
            color: #555;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{header_label} Meeting Invitation</h1>
            <div class="sub">{meeting_type.capitalize()} meeting</div>
        </div>
        <div class="content">
            <div class="greeting">
                <p>Dear <strong>{participant_name}</strong>,</p>
                <p>You have been invited to attend a meeting. Please find the details below:</p>
            </div>
            
            <div class="meeting-details">
                <div class="detail-row">
                    <span class="detail-label">📋 Title:</span>
                    <span class="detail-value"><strong>{meeting_title}</strong></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">🕐 Date & Time:</span>
                    <span class="detail-value">{meeting_datetime}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">🌐 Type:</span>
                    <span class="detail-value">{meeting_type.capitalize()}</span>
                </div>
                {f'<div class="detail-row"><span class="detail-label">📍 Location:</span><span class="detail-value">{location}</span></div>' if show_location else ''}
                {f'<div class="detail-row"><span class="detail-label">📝 Description:</span><div class="description-box">{description}</div></div>' if description else ''}
            </div>
            
            {f'''
            <div class="meeting-link-container">
                <a href="{meeting_link}" class="meeting-link-btn" target="_blank">
                    🎥 Join Meeting
                </a>
            </div>
            
            <p style="color: #666; font-size: 14px; text-align: center; margin-top: 20px;">
                Click the button above or copy this link: <br>
                <a href="{meeting_link}" style="color: #6366f1; word-break: break-all;">{meeting_link}</a>
            </p>
            ''' if show_link else ''}
            
            {f'''
            <p style="color: #666; font-size: 14px; margin-top: 10px;">
                <strong>Location:</strong> {location}
            </p>
            ''' if show_location else ''}
        </div>
        <div class="footer">
            <p><strong>Brihaspathi Technologies Limited</strong></p>
            <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
        """
        
        # Attach both plain text and HTML
        part1 = MIMEText(text_body, 'plain')
        part2 = MIMEText(html_body, 'html')
        
        msg.attach(part1)
        msg.attach(part2)
        
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(from_email, smtp_password)
        server.send_message(msg)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False

def send_whatsapp_notification(phone: str, participant_name: str, meeting_title: str, meeting_datetime: str, meeting_link: str):
    """Send WhatsApp notification using API"""
    try:
        api_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY0OWMxMDI0YTMzMGUyMGJkYTcwMzMwMyIsIm5hbWUiOiJCUklIQVNQQVRISSBURUNITk9MT0dJRVMgUFJJVkFURSBMSU1JVEVEIiwiYXBwTmFtZSI6IkFpU2Vuc3kiLCJjbGllbnRJZCI6IjY0OWMxMDIzY2FkODQ1MGI0Nzg1YzA1YyIsImFjdGl2ZVBsYW4iOiJOT05FIiwiaWF0IjoxNjg3OTQ5MzQ4fQ.oDl73wKoFu9jj-nKdzsOqaY8InWdw3RIaYy4EUZaEto"
        api_url = "https://backend.api-wa.co/campaign/smartping/api/v2"
        
        # Format phone number (remove + and ensure it starts with country code)
        destination = phone.replace("+", "").replace(" ", "").replace("-", "")
        if not destination.startswith("91"):
            destination = "91" + destination
        
        payload = {
            "apiKey": api_key,
            "campaignName": "tms",
            "destination": destination,
            "userName": "BRIHASPATHI TECHNOLOGIES PRIVATE LIMITED",
            "templateParams": [
                participant_name,  # First param: Selected Name
                meeting_title,     # Second param: Meeting Title
                meeting_datetime,  # Third param: Selected Date & Time
                meeting_link       # Fourth param: Automatically created link
            ],
            "source": "new-landing-page form",
            "media": {},
            "buttons": [],
            "carouselCards": [],
            "location": {},
            "attributes": {},
            "paramsFallbackValue": {
                "FirstName": participant_name
            }
        }
        
        headers = {
            "Content-Type": "application/json"
        }
        
        response = requests.post(api_url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        
        return True
    except Exception as e:
        print(f"Error sending WhatsApp: {str(e)}")
        return False

def send_meeting_notifications(db: Session, meeting: Meeting, creator: User):
    """Send notifications to meeting participants based on their consent preferences"""
    if not meeting.participants:
        return
    
    meeting_time = meeting.meeting_datetime.strftime("%B %d, %Y at %I:%M %p")
    meeting_month_year = meeting.meeting_datetime.strftime("%b %Y")
    message = f"""
You are invited to a meeting!

Title: {meeting.title}
Date & Time: {meeting_time}
Duration: {meeting.duration_minutes} minutes
Organized by: {creator.name}
Type: {meeting.meeting_type}
Location: {meeting.location or 'N/A'}
{'Meeting Link: ' + meeting.link if meeting.link else ''}

Description: {meeting.description or 'No description provided'}
    """
    
    for participant in meeting.participants:
        user = db.query(User).filter(User.empid == participant.get("empid")).first()
        if not user:
            continue
        
        participant_name = participant.get("name", user.name)
        
        # Send email if consent is given
        if user.email_consent and user.email:
            email_sent = send_email_notification(
                to_email=user.email,
                participant_name=participant_name,
                meeting_title=meeting.title,
                meeting_datetime=meeting_time,
                meeting_link=meeting.link,
                description=meeting.description or "",
                meeting_type=meeting.meeting_type,
                location=meeting.location,
                month_year=meeting_month_year
            )
            notification = NotificationLog(
                user_id=user.id,
                type="meeting",
                title=f"Meeting Invitation: {meeting.title}",
                message=message,
                channel="email"
            )
            db.add(notification)
        
        # For offline meetings, do not send WhatsApp/SMS
        is_offline = meeting.meeting_type == "offline"

        # Send WhatsApp if consent is given and meeting is online
        if not is_offline and user.whatsapp_consent and user.phone:
            whatsapp_sent = send_whatsapp_notification(
                phone=user.phone,
                participant_name=participant_name,
                meeting_title=meeting.title,
                meeting_datetime=meeting_time,
                meeting_link=meeting.link
            )
            notification = NotificationLog(
                user_id=user.id,
                type="meeting",
                title=f"Meeting Invitation: {meeting.title}",
                message=message,
                channel="whatsapp"
            )
            db.add(notification)
        
        if not is_offline and user.sms_consent:
            sms_message = f"Meeting: {meeting.title} on {meeting_time}. Link: {meeting.link}"
            notification = NotificationLog(
                user_id=user.id,
                type="meeting",
                title=f"Meeting: {meeting.title}",
                message=sms_message,
                channel="sms"
            )
            db.add(notification)
        
        # Always create in-app notification
        notification = NotificationLog(
            user_id=user.id,
            type="meeting",
            title=f"Meeting Invitation: {meeting.title}",
            message=message,
            channel="in-app"
        )
        db.add(notification)
    
    db.commit()

@router.put("/{meeting_id}", response_model=MeetingResponse)
def update_meeting(
    meeting_id: int,
    meeting_data: MeetingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Only creator or admin can update
    if current_user.role != "Admin" and meeting.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = meeting_data.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        if value is not None:
            setattr(meeting, key, value)
    
    db.commit()
    db.refresh(meeting)
    
    return meeting

@router.post("/{meeting_id}/participants")
def add_participant(
    meeting_id: int,
    empid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    user = db.query(User).filter(User.empid == empid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    participants = list(meeting.participants) if meeting.participants else []
    
    # Check if already participant
    if any(p.get("empid") == empid for p in participants):
        raise HTTPException(status_code=400, detail="User already a participant")
    
    participants.append({
        "empid": user.empid,
        "name": user.name,
        "image_base64": user.image_base64
    })
    
    meeting.participants = participants
    db.commit()
    
    return {"message": "Participant added", "participants": participants}

@router.delete("/{meeting_id}/participants/{empid}")
def remove_participant(
    meeting_id: int,
    empid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    participants = [p for p in meeting.participants if p.get("empid") != empid]
    meeting.participants = participants
    db.commit()
    
    return {"message": "Participant removed", "participants": participants}

@router.delete("/{meeting_id}")
def delete_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Only creator or admin can delete
    if current_user.role != "Admin" and meeting.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(meeting)
    db.commit()
    
    return {"message": "Meeting deleted successfully"}

# ============ Meeting Notes Endpoints ============
@router.get("/{meeting_id}/notes", response_model=MeetingNotesResponse)
def get_meeting_notes(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get meeting notes for the current user"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    notes = db.query(MeetingNotes).filter(
        MeetingNotes.meeting_id == meeting_id,
        MeetingNotes.user_id == current_user.id
    ).first()
    
    if not notes:
        # Return empty notes if not found
        return MeetingNotesResponse(
            id=0,
            meeting_id=meeting_id,
            user_id=current_user.id,
            notes=None,
            created_at=get_ist_now(),
            updated_at=get_ist_now()
        )
    
    return notes

@router.post("/{meeting_id}/notes", response_model=MeetingNotesResponse, status_code=status.HTTP_201_CREATED)
def create_meeting_notes(
    meeting_id: int,
    notes_data: MeetingNotesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create or update meeting notes for the current user"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check if notes already exist
    existing_notes = db.query(MeetingNotes).filter(
        MeetingNotes.meeting_id == meeting_id,
        MeetingNotes.user_id == current_user.id
    ).first()
    
    if existing_notes:
        # Update existing notes
        existing_notes.notes = notes_data.notes
        existing_notes.updated_at = get_ist_now()
        db.commit()
        db.refresh(existing_notes)
        return existing_notes
    else:
        # Create new notes
        notes = MeetingNotes(
            meeting_id=meeting_id,
            user_id=current_user.id,
            notes=notes_data.notes
        )
        db.add(notes)
        db.commit()
        db.refresh(notes)
        return notes

@router.put("/{meeting_id}/notes", response_model=MeetingNotesResponse)
def update_meeting_notes(
    meeting_id: int,
    notes_data: MeetingNotesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update meeting notes for the current user"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    notes = db.query(MeetingNotes).filter(
        MeetingNotes.meeting_id == meeting_id,
        MeetingNotes.user_id == current_user.id
    ).first()
    
    if not notes:
        # Create if doesn't exist
        notes = MeetingNotes(
            meeting_id=meeting_id,
            user_id=current_user.id,
            notes=notes_data.notes
        )
        db.add(notes)
    else:
        notes.notes = notes_data.notes
        notes.updated_at = get_ist_now()
    
    db.commit()
    db.refresh(notes)
    return notes



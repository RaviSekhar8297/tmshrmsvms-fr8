"""Google Calendar API integration for creating meetings with Meet links"""
from google.oauth2.credentials import Credentials
from google.oauth2 import service_account
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.auth.transport.requests import Request
from datetime import datetime, timedelta
import json
import os
import requests
import time
from config import settings

# Google OAuth2 credentials - Load from environment variables only
# DO NOT hardcode secrets here - use environment variables
GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID or ""
GOOGLE_CLIENT_SECRET = settings.GOOGLE_CLIENT_SECRET or ""
GOOGLE_REDIRECT_URI = settings.GOOGLE_REDIRECT_URI or "http://localhost:8000/api/auth/google/callback"
GOOGLE_CALENDAR_ID = settings.GOOGLE_CALENDAR_ID or "primary"

def _validate_google_credentials():
    """Validate that Google credentials are set. Called when Google Calendar functions are used."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        error_msg = (
            "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables. "
            "Please update backend/.env file with your Google OAuth credentials:\n"
            "GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com\n"
            "GOOGLE_CLIENT_SECRET=your-client-secret\n"
            "Then restart the backend server."
        )
        raise ValueError(error_msg)

# Scopes required for Calendar API
# Request all scopes that Google might grant to avoid scope mismatch errors
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly'
]

def get_authorization_url(user_email=None):
    """Get Google OAuth2 authorization URL
    
    Args:
        user_email: Optional email address to pre-fill in OAuth (hint parameter)
    """
    _validate_google_credentials()
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_REDIRECT_URI]
            }
        },
        scopes=SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI
    )
    # Build authorization URL with login hint if email provided
    auth_params = {
        'access_type': 'offline',
        'include_granted_scopes': 'true',
        'prompt': 'consent'
    }
    
    # Add login hint to suggest the user's email
    if user_email:
        auth_params['login_hint'] = user_email
    
    authorization_url, state = flow.authorization_url(**auth_params)
    return authorization_url, state

def get_user_email_from_credentials(credentials_dict):
    """Get user email from Google credentials"""
    try:
        from google.oauth2.credentials import Credentials
        credentials = Credentials.from_authorized_user_info(credentials_dict)
        
        # Use tokeninfo endpoint to get user email
        import requests
        token_info_url = f"https://www.googleapis.com/oauth2/v1/tokeninfo?access_token={credentials.token}"
        response = requests.get(token_info_url)
        
        if response.status_code == 200:
            token_info = response.json()
            return token_info.get('email')
        else:
            # Fallback: try to refresh and get userinfo
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())
                credentials_dict = credentials_to_dict(credentials)
            
            # Try userinfo endpoint
            userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            headers = {'Authorization': f'Bearer {credentials.token}'}
            response = requests.get(userinfo_url, headers=headers)
            if response.status_code == 200:
                user_info = response.json()
                return user_info.get('email')
        
        return None
    except Exception as e:
        print(f"Error getting user email from credentials: {e}")
        return None

def get_credentials_from_code(code: str):
    """Exchange authorization code for credentials"""
    _validate_google_credentials()
    try:
        print(f"Exchanging code, redirect URI: {GOOGLE_REDIRECT_URI}")
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [GOOGLE_REDIRECT_URI]
                }
            },
            scopes=SCOPES,
            redirect_uri=GOOGLE_REDIRECT_URI
        )
        print("Flow created, fetching token...")
        try:
            flow.fetch_token(code=code)
            print("Token fetched successfully")
            print(f"Granted scopes: {flow.credentials.scopes}")
            return flow.credentials
        except Exception as scope_error:
            error_str = str(scope_error)
            # Handle scope change error - Google may grant additional scopes
            if "Scope has changed" in error_str:
                print(f"Scope change detected, attempting workaround: {error_str}")
                # Extract granted scopes from error message or use all possible scopes
                # Create a new flow that accepts any scope combination
                # Manual token exchange to bypass scope validation
                token_url = "https://oauth2.googleapis.com/token"
                token_data = {
                    'code': code,
                    'client_id': GOOGLE_CLIENT_ID,
                    'client_secret': GOOGLE_CLIENT_SECRET,
                    'redirect_uri': GOOGLE_REDIRECT_URI,
                    'grant_type': 'authorization_code'
                }
                
                response = requests.post(token_url, data=token_data)
                if response.status_code == 200:
                    token_info = response.json()
                    # Create credentials from token response
                    credentials = Credentials(
                        token=token_info.get('access_token'),
                        refresh_token=token_info.get('refresh_token'),
                        token_uri=token_url,
                        client_id=GOOGLE_CLIENT_ID,
                        client_secret=GOOGLE_CLIENT_SECRET,
                        scopes=token_info.get('scope', '').split() if token_info.get('scope') else SCOPES
                    )
                    print("Token fetched successfully via manual exchange")
                    print(f"Granted scopes: {credentials.scopes}")
                    return credentials
                else:
                    print(f"Manual token exchange failed: {response.text}")
                    raise Exception(f"Token exchange failed: {response.text}")
            else:
                # Re-raise if it's not a scope change error
                raise
    except Exception as e:
        print(f"Error in get_credentials_from_code: {e}")
        import traceback
        traceback.print_exc()
        raise

def credentials_to_dict(credentials):
    """Convert credentials object to dictionary for storage"""
    return {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': credentials.scopes
    }

def dict_to_credentials(creds_dict):
    """Convert dictionary back to credentials object"""
    return Credentials(
        token=creds_dict.get('token'),
        refresh_token=creds_dict.get('refresh_token'),
        token_uri=creds_dict.get('token_uri', 'https://oauth2.googleapis.com/token'),
        client_id=creds_dict.get('client_id', GOOGLE_CLIENT_ID),
        client_secret=creds_dict.get('client_secret', GOOGLE_CLIENT_SECRET),
        scopes=creds_dict.get('scopes', SCOPES)
    )

def create_calendar_event(credentials_dict, title, description, start_datetime, duration_minutes, attendees_emails=None):
    """
    Create a Google Calendar event with Google Meet link
    
    Args:
        credentials_dict: User's Google OAuth credentials as dictionary
        title: Meeting title
        description: Meeting description
        start_datetime: datetime object for meeting start
        duration_minutes: Duration in minutes
        attendees_emails: List of attendee email addresses
    
    Returns:
        dict with 'meeting_link' (Google Meet link) and 'calendar_event_id'
    """
    _validate_google_credentials()
    try:
        # Convert credentials dict to Credentials object
        credentials = dict_to_credentials(credentials_dict)
        
        # Refresh token if needed
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())
        
        # Build Calendar API service
        service = build('calendar', 'v3', credentials=credentials)
        
        # Calculate end time
        end_datetime = start_datetime + timedelta(minutes=duration_minutes)
        
        # Prepare attendees list
        attendees = []
        if attendees_emails:
            attendees = [{'email': email} for email in attendees_emails]
        
        # Create event
        event = {
            'summary': title,
            'description': description or '',
            'start': {
                'dateTime': start_datetime.isoformat(),
                'timeZone': 'UTC',
            },
            'end': {
                'dateTime': end_datetime.isoformat(),
                'timeZone': 'UTC',
            },
            'attendees': attendees,
            'conferenceData': {
                'createRequest': {
                    'requestId': f"meet-{datetime.now().timestamp()}",
                    'conferenceSolutionKey': {
                        'type': 'hangoutsMeet'
                    }
                }
            },
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60},  # 1 day before
                    {'method': 'popup', 'minutes': 15},  # 15 minutes before
                ],
            },
        }
        
        # Insert event
        created_event = service.events().insert(
            calendarId=GOOGLE_CALENDAR_ID,
            body=event,
            conferenceDataVersion=1,
            sendUpdates='none'  # do not send invites; avoids DWD requirement
        ).execute()
        
        # Extract Google Meet link - check multiple possible locations
        meet_link = None
        
        # Method 1: Check hangoutLink (legacy)
        if 'hangoutLink' in created_event:
            meet_link = created_event['hangoutLink']
            print(f"Found Meet link in hangoutLink: {meet_link}")
        
        # Method 2: Check conferenceData.entryPoints
        if not meet_link and 'conferenceData' in created_event:
            conference_data = created_event['conferenceData']
            print(f"Conference data: {json.dumps(conference_data, indent=2, default=str)}")
            
            if 'entryPoints' in conference_data:
                for entry in conference_data['entryPoints']:
                    entry_type = entry.get('entryPointType')
                    uri = entry.get('uri')
                    print(f"Entry point - Type: {entry_type}, URI: {uri}")
                    
                    if entry_type == 'video' and uri:
                        meet_link = uri
                        print(f"Found Meet link in entryPoints: {meet_link}")
                        break
        
        # Method 3: Check conferenceData.hangoutLink
        if not meet_link and 'conferenceData' in created_event:
            conference_data = created_event['conferenceData']
            if 'hangoutLink' in conference_data:
                meet_link = conference_data['hangoutLink']
                print(f"Found Meet link in conferenceData.hangoutLink: {meet_link}")
        
        # Validate Meet link format
        if meet_link:
            # Ensure it's a proper Meet URL
            if not meet_link.startswith('https://meet.google.com/'):
                # If it's just a meeting code, construct full URL
                if meet_link.startswith('meet.google.com/'):
                    meet_link = 'https://' + meet_link
                elif '/' not in meet_link and '-' in meet_link:
                    # If it's just the code like "abc-defg-hij", construct URL
                    meet_link = f'https://meet.google.com/{meet_link}'
            
            print(f"Final Meet link: {meet_link}")
        else:
            print("WARNING: No Meet link found in created event!")
            print(f"Event data: {json.dumps(created_event, indent=2, default=str)}")
            # Raise error if no Meet link found
            raise Exception("Failed to extract Google Meet link from created calendar event. Please check your Google Calendar API permissions.")
        
        return {
            'meeting_link': meet_link,
            'calendar_event_id': created_event.get('id'),
            'event_link': created_event.get('htmlLink', '')
        }
        
    except HttpError as error:
        print(f'An error occurred creating calendar event: {error}')
        raise Exception(f"Failed to create calendar event: {str(error)}")
    except Exception as e:
        print(f'Error in create_calendar_event: {e}')
        raise Exception(f"Failed to create calendar event: {str(e)}")

def delete_calendar_event(credentials_dict, event_id):
    """Delete a Google Calendar event"""
    _validate_google_credentials()
    try:
        credentials = dict_to_credentials(credentials_dict)
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())
        
        service = build('calendar', 'v3', credentials=credentials)
        service.events().delete(calendarId=GOOGLE_CALENDAR_ID, eventId=event_id).execute()
        return True
    except Exception as e:
        print(f'Error deleting calendar event: {e}')
        return False

def get_service_account_credentials():
    """Get service account credentials from JSON file"""
    try:
        service_account_path = settings.GOOGLE_SERVICE_ACCOUNT_PATH
        if not os.path.exists(service_account_path):
            print(f"Service account file not found at: {service_account_path}")
            raise Exception(f"Service account file not found at: {service_account_path}")
        
        credentials = service_account.Credentials.from_service_account_file(
            service_account_path,
            scopes=SCOPES
        )
        return credentials
    except Exception as e:
        print(f'Error loading service account credentials: {e}')
        import traceback
        traceback.print_exc()
        raise Exception(f"Service account credentials not available: {str(e)}")

def create_calendar_event_with_service_account(title, description, start_datetime, duration_minutes, attendees_emails=None):
    """
    Create a Google Calendar event with Google Meet link using service account
    
    Args:
        title: Meeting title
        description: Meeting description
        start_datetime: datetime object for meeting start
        duration_minutes: Duration in minutes
        attendees_emails: List of attendee email addresses
    
    Returns:
        dict with 'meeting_link' (Google Meet link) and 'calendar_event_id'
    """
    # Service account doesn't need OAuth credentials, but check if service account file exists
    try:
        # Get service account credentials
        credentials = get_service_account_credentials()
        if not credentials:
            raise Exception("Service account credentials not available. Please ensure service_account.json exists in backend directory.")
        
        # Build Calendar API service
        service = build('calendar', 'v3', credentials=credentials)
        
        # Calculate end time
        end_datetime = start_datetime + timedelta(minutes=duration_minutes)
        
        # Prepare attendees list
        # IMPORTANT: Service accounts cannot invite attendees without Domain-Wide Delegation.
        # We deliberately ignore any attendees passed in to avoid 403 errors.
        attendees = []
        
        # Generate unique request ID for conference
        request_id = f"meet-{int(time.time() * 1000)}"
        
        # Create event with Google Meet conference
        event = {
            'summary': title,
            'description': description or '',
            'start': {
                'dateTime': start_datetime.isoformat(),
                'timeZone': 'UTC',
            },
            'end': {
                'dateTime': end_datetime.isoformat(),
                'timeZone': 'UTC',
            },
            'attendees': attendees,
            'conferenceData': {
                'createRequest': {
                    'requestId': request_id,
                    'conferenceSolutionKey': {
                        'type': 'hangoutsMeet'
                    }
                }
            },
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60},  # 1 day before
                    {'method': 'popup', 'minutes': 15},  # 15 minutes before
                ],
            },
        }
        
        print(f"Creating calendar event with service account...")
        print(f"Event details: {title}, Start: {start_datetime}, Duration: {duration_minutes} minutes")
        
        # Insert event with conference data
        created_event = service.events().insert(
            calendarId=GOOGLE_CALENDAR_ID,
            body=event,
            conferenceDataVersion=1,
            sendUpdates='all' if attendees else 'none'
        ).execute()
        
        print(f"Calendar event created successfully. Event ID: {created_event.get('id')}")
        
        # Extract Google Meet link - check multiple possible locations
        meet_link = None
        
        # Method 1: Check hangoutLink (legacy)
        if 'hangoutLink' in created_event:
            meet_link = created_event['hangoutLink']
            print(f"Found Meet link in hangoutLink: {meet_link}")
        
        # Method 2: Check conferenceData.entryPoints
        if not meet_link and 'conferenceData' in created_event:
            conference_data = created_event['conferenceData']
            print(f"Conference data: {json.dumps(conference_data, indent=2)}")
            
            if 'entryPoints' in conference_data:
                for entry in conference_data['entryPoints']:
                    entry_type = entry.get('entryPointType')
                    uri = entry.get('uri')
                    print(f"Entry point - Type: {entry_type}, URI: {uri}")
                    
                    if entry_type == 'video' and uri:
                        meet_link = uri
                        print(f"Found Meet link in entryPoints: {meet_link}")
                        break
        
        # Method 3: Check conferenceData.hangoutLink
        if not meet_link and 'conferenceData' in created_event:
            conference_data = created_event['conferenceData']
            if 'hangoutLink' in conference_data:
                meet_link = conference_data['hangoutLink']
                print(f"Found Meet link in conferenceData.hangoutLink: {meet_link}")
        
        # Validate Meet link format
        if meet_link:
            # Ensure it's a proper Meet URL
            if not meet_link.startswith('https://meet.google.com/'):
                # If it's just a meeting code, construct full URL
                if meet_link.startswith('meet.google.com/'):
                    meet_link = 'https://' + meet_link
                elif '/' not in meet_link and '-' in meet_link:
                    # If it's just the code like "abc-defg-hij", construct URL
                    meet_link = f'https://meet.google.com/{meet_link}'
            
            print(f"Final Meet link: {meet_link}")
        else:
            print("WARNING: No Meet link found in created event!")
            print(f"Event data: {json.dumps(created_event, indent=2, default=str)}")
            raise Exception("Failed to extract Google Meet link from created event")
        
        return {
            'meeting_link': meet_link,
            'calendar_event_id': created_event.get('id'),
            'event_link': created_event.get('htmlLink', '')
        }
        
    except HttpError as error:
        print(f'HTTP Error creating calendar event with service account: {error}')
        try:
            if hasattr(error, 'content') and error.content:
                error_details = json.loads(error.content.decode('utf-8'))
                error_message = error_details.get('error', {}).get('message', str(error))
                error_code = error_details.get('error', {}).get('code', '')
                print(f"Error code: {error_code}, Message: {error_message}")
            else:
                error_message = str(error)
        except Exception as parse_error:
            print(f"Error parsing error response: {parse_error}")
            error_message = str(error)
        raise Exception(f"Failed to create calendar event: {error_message}")
    except Exception as e:
        print(f'Error in create_calendar_event_with_service_account: {e}')
        import traceback
        traceback.print_exc()
        raise Exception(f"Failed to create calendar event: {str(e)}")


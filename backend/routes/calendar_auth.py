"""Google Calendar OAuth2 authentication routes"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import User
from routes.auth import get_current_user
from google_calendar import get_authorization_url, get_credentials_from_code, credentials_to_dict

router = APIRouter(prefix="/auth/google", tags=["Google Calendar Auth"])

class CallbackRequest(BaseModel):
    code: str
    state: str = None

@router.get("/authorize")
def authorize_google_calendar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Google Calendar authorization URL - automatically uses logged-in user's email"""
    try:
        from google_calendar import GOOGLE_REDIRECT_URI
        # Use the logged-in user's email for OAuth (Google will suggest this email)
        user_email = current_user.email if current_user else None
        authorization_url, state = get_authorization_url(user_email=user_email)
        # Store state in user session or return it to frontend
        return {
            "authorization_url": authorization_url,
            "state": state,
            "redirect_uri": GOOGLE_REDIRECT_URI,  # For debugging
            "user_email": user_email  # Return email for confirmation
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get authorization URL: {str(e)}")

@router.get("/callback")
def google_calendar_callback_get(
    code: str = Query(...),
    state: str = Query(None),
    db: Session = Depends(get_db)
):
    """Handle Google OAuth2 callback via GET (redirect from Google)"""
    from fastapi.responses import RedirectResponse
    
    # Redirect to frontend callback handler with code
    frontend_url = "http://localhost:3000"  # Frontend runs on port 3000
    redirect_url = f"{frontend_url}/auth/google/callback?code={code}&state={state or ''}"
    return RedirectResponse(url=redirect_url)

@router.post("/callback")
def google_calendar_callback_post(
    callback_data: CallbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Handle Google OAuth2 callback via POST (from frontend)"""
    try:
        # Exchange code for credentials
        credentials = get_credentials_from_code(callback_data.code)
        
        # Convert to dict for storage
        credentials_dict = credentials_to_dict(credentials)
        
        # Store in user's record
        current_user.google_calendar_credentials = credentials_dict
        db.commit()
        
        return {
            "status": "success",
            "message": "Google Calendar connected successfully"
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to connect Google Calendar: {str(e)}"
        )

@router.get("/status")
def get_calendar_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if user has Google Calendar connected and return connected email.
    Auto-connects if logged-in email matches connected email."""
    try:
        if not current_user.google_calendar_credentials:
            return {
                "connected": False,
                "email": None,
                "auto_connected": False
            }
        
        # Get email from credentials
        try:
            from google_calendar import get_user_email_from_credentials
            connected_email = get_user_email_from_credentials(current_user.google_calendar_credentials)
            
            # If credentials are invalid, clear them
            if connected_email is None:
                # Check if it's an invalid credentials error
                try:
                    # Try again to see if we get the invalid credentials error
                    get_user_email_from_credentials(current_user.google_calendar_credentials)
                except ValueError as ve:
                    if "INVALID_CREDENTIALS" in str(ve):
                        # Clear invalid credentials
                        current_user.google_calendar_credentials = None
                        db.commit()
                        return {
                            "connected": False,
                            "email": None,
                            "auto_connected": False
                        }
            
            # Auto-connect if logged-in email matches connected email
            user_email = current_user.email
            auto_connected = False
            if user_email and connected_email:
                if user_email.lower() == connected_email.lower():
                    auto_connected = True
            
            return {
                "connected": True,
                "email": connected_email,
                "auto_connected": auto_connected,
                "user_email": user_email
            }
        except ValueError as ve:
            # Invalid credentials error - clear them
            if "INVALID_CREDENTIALS" in str(ve):
                current_user.google_calendar_credentials = None
                db.commit()
                return {
                    "connected": False,
                    "email": None
                }
            raise
        except ImportError:
            # Function not available - return connected status without email
            return {
                "connected": True,
                "email": None
            }
        except Exception as e:
            # If we can't get email, still return connected status
            error_str = str(e).lower()
            if 'invalid_grant' in error_str or 'account has been deleted' in error_str or 'deleted' in error_str:
                # Clear invalid credentials
                current_user.google_calendar_credentials = None
                db.commit()
                return {
                    "connected": False,
                    "email": None,
                    "auto_connected": False
                }
            return {
                "connected": True,
                "email": None,
                "auto_connected": False
            }
    except Exception as e:
        return {
            "connected": False,
            "email": None,
            "auto_connected": False
        }

@router.delete("/disconnect")
def disconnect_google_calendar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect Google Calendar"""
    current_user.google_calendar_credentials = None
    db.commit()
    return {"message": "Google Calendar disconnected successfully"}


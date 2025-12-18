from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from database import get_db
from models import User, AuthToken
from schemas import LoginRequest, TokenResponse, UserResponse
from utils import verify_password, create_access_token, decode_token
from config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.split(" ")[1]
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    
    return user

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(
            (User.username == request.username) | (User.empid == request.username)
        ).first()
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        if not verify_password(request.password, user.password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        if not user.is_active:
            raise HTTPException(status_code=401, detail="Account is deactivated")
        
        # Create token
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.ACCESS_TOKEN_EXPIRE_DAYS)
        token = create_access_token({"user_id": user.id, "role": user.role})
        
        # Save token (optional - for tracking)
        try:
            auth_token = AuthToken(
                user_id=user.id,
                token=token,
                device_info=request.device_info,
                expires_at=expires_at
            )
            db.add(auth_token)
            db.commit()
        except Exception as e:
            # Token tracking is optional, log but don't fail
            # Rollback the transaction to avoid issues
            db.rollback()
            print(f"Warning: Could not save auth token: {e}")
        
        # Validate user response
        user_response = UserResponse.model_validate(user)
        
        # Check Google Calendar connection status
        calendar_connected = user.google_calendar_credentials is not None
        
        response = TokenResponse(
            access_token=token,
            user=user_response,
            expires_at=expires_at
        )
        
        # Add calendar connection status to response (as dict to include extra field)
        response_dict = response.model_dump()
        response_dict['calendar_connected'] = calendar_connected
        
        return response_dict
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    auth_header = request.headers.get("Authorization")
    if auth_header:
        token = auth_header.split(" ")[1]
        auth_token = db.query(AuthToken).filter(AuthToken.token == token).first()
        if auth_token:
            auth_token.is_active = False
            db.commit()
    
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/change-password")
def change_password(
    old_password: str,
    new_password: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from utils import hash_password
    
    if not verify_password(old_password, current_user.password):
        raise HTTPException(status_code=400, detail="Invalid old password")
    
    current_user.password = hash_password(new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}

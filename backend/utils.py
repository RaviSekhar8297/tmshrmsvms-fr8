from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from config import settings
import uuid
import secrets
import string

# IST (Indian Standard Time) is UTC+5:30
IST = timezone(timedelta(hours=5, minutes=30))

def get_ist_now():
    """Get current datetime in IST timezone"""
    return datetime.now(IST)

def get_ist_date():
    """Get current date in IST timezone"""
    return datetime.now(IST).date()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = get_ist_now() + expires_delta
    else:
        expire = get_ist_now() + timedelta(days=settings.ACCESS_TOKEN_EXPIRE_DAYS)
    # JWT expects timestamp (seconds since epoch) for 'exp'
    to_encode.update({"exp": int(expire.timestamp())})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

def generate_meeting_link() -> str:
    """Generate a working Google Meet-like meeting link"""
    chars = string.ascii_lowercase + string.digits
    part1 = ''.join(secrets.choice(chars) for _ in range(3))
    part2 = ''.join(secrets.choice(chars) for _ in range(4))
    part3 = ''.join(secrets.choice(chars) for _ in range(3))
    # Generate a unique meeting ID that works when opened
    return f"https://meet.google.com/{part1}-{part2}-{part3}"

def generate_empid(role: str, count: int) -> str:
    """Generate employee ID based on role"""
    prefix = {
        "Admin": "ADM",
        "Manager": "MGR",
        "Employee": "EMP",
        "HR": "HR"
    }.get(role, "USR")
    return f"{prefix}{str(count + 1).zfill(4)}"

def is_admin_or_hr(user) -> bool:
    """Check if user is Admin or HR"""
    return user.role in ["Admin", "HR"]







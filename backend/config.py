from pydantic_settings import BaseSettings
from functools import lru_cache
import os

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:Ravi%408297@localhost:5432/tms_db"
    SECRET_KEY: str = "your-super-secret-key-change-in-production-12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 7
    GOOGLE_SERVICE_ACCOUNT_PATH: str = os.path.join(os.path.dirname(__file__), "service_account.json")
    
    # Google OAuth2 Credentials
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"
    
    # Google Calendar Configuration
    GOOGLE_CALENDAR_ID: str = "primary"
    
    # Google Maps API Key
    GOOGLE_MAPS_API_KEY: str = ""
    
    class Config:
        env_file = ".env"
        extra = "allow"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()

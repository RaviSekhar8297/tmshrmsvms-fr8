"""Quick test to verify login endpoint works"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import User
from utils import verify_password

db = SessionLocal()

try:
    # Test user lookup
    user = db.query(User).filter(User.username == "101").first()
    
    if user:
        print(f"✓ User found: {user.name} ({user.empid})")
        print(f"  Role: {user.role}")
        print(f"  Active: {user.is_active}")
        
        # Test password
        if verify_password("admin123", user.password):
            print("✓ Password verification successful")
        else:
            print("✗ Password verification failed")
    else:
        print("✗ User not found")
        
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()


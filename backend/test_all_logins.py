"""Comprehensive login test for all users"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import User
from utils import verify_password, create_access_token
from datetime import datetime, timedelta, timezone
from config import settings

db = SessionLocal()

# Test credentials
test_users = [
    {"username": "101", "password": "admin123", "expected_role": "Admin", "name": "Raja Sekhar"},
    {"username": "1027", "password": "manager123", "expected_role": "Manager", "name": "ravi"},
    {"username": "1460", "password": "employee123", "expected_role": "Employee", "name": "shiva"}
]

print("=" * 70)
print("COMPREHENSIVE LOGIN TEST")
print("=" * 70)

all_passed = True

for test_user in test_users:
    print(f"\n{'='*70}")
    print(f"Testing: {test_user['name']} ({test_user['username']})")
    print(f"{'='*70}")
    
    try:
        # Step 1: Find user by username or empid
        user = db.query(User).filter(
            (User.username == test_user["username"]) | (User.empid == test_user["username"])
        ).first()
        
        if not user:
            print(f"✗ FAILED: User not found")
            all_passed = False
            continue
        
        print(f"✓ User found: {user.name} (ID: {user.id}, EmpID: {user.empid})")
        
        # Step 2: Check role
        if user.role != test_user["expected_role"]:
            print(f"✗ FAILED: Role mismatch. Expected {test_user['expected_role']}, got {user.role}")
            all_passed = False
        else:
            print(f"✓ Role correct: {user.role}")
        
        # Step 3: Check if active
        if not user.is_active:
            print(f"✗ FAILED: User is inactive")
            all_passed = False
        else:
            print(f"✓ User is active")
        
        # Step 4: Verify password
        if not verify_password(test_user["password"], user.password):
            print(f"✗ FAILED: Password verification failed")
            all_passed = False
        else:
            print(f"✓ Password verified")
        
        # Step 5: Test token creation
        try:
            expires_at = datetime.now(timezone.utc) + timedelta(days=settings.ACCESS_TOKEN_EXPIRE_DAYS)
            token = create_access_token({"user_id": user.id, "role": user.role})
            if token:
                print(f"✓ Token created successfully")
                print(f"  Token preview: {token[:50]}...")
            else:
                print(f"✗ FAILED: Token creation returned None")
                all_passed = False
        except Exception as e:
            print(f"✗ FAILED: Token creation error: {e}")
            all_passed = False
        
        # Step 6: Check user data completeness
        required_fields = ['id', 'empid', 'name', 'email', 'username', 'role', 'is_active']
        missing_fields = []
        for field in required_fields:
            if not hasattr(user, field) or getattr(user, field) is None:
                missing_fields.append(field)
        
        if missing_fields:
            print(f"✗ FAILED: Missing required fields: {', '.join(missing_fields)}")
            all_passed = False
        else:
            print(f"✓ All required fields present")
        
        # Step 7: Check report_to_id
        if user.report_to_id:
            report_to_user = db.query(User).filter(User.empid == user.report_to_id).first()
            if report_to_user:
                print(f"✓ Reports to: {report_to_user.name} ({user.report_to_id})")
            else:
                print(f"⚠ Warning: report_to_id {user.report_to_id} not found")
        else:
            print(f"✓ No report_to_id (expected for Admin)")
        
        print(f"✓ LOGIN TEST PASSED for {test_user['name']}")
        
    except Exception as e:
        print(f"✗ FAILED: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False

print(f"\n{'='*70}")
if all_passed:
    print("✓ ALL LOGIN TESTS PASSED!")
else:
    print("✗ SOME LOGIN TESTS FAILED")
print(f"{'='*70}")

# Summary
print(f"\nSUMMARY:")
print(f"  Total users tested: {len(test_users)}")
print(f"  All tests passed: {all_passed}")

db.close()


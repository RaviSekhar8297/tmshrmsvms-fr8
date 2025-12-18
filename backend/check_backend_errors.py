"""Check for backend errors and test API endpoints"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 70)
print("BACKEND ERROR CHECK")
print("=" * 70)

errors_found = []
warnings = []

# Test 1: Import all modules
print("\n1. Testing imports...")
try:
    from database import engine, Base, get_db, SessionLocal
    print("  ✓ database module imported")
except Exception as e:
    errors_found.append(f"database import: {e}")
    print(f"  ✗ database import failed: {e}")

try:
    from models import User, Task, Project, Issue, TaskRating, Meeting, NotificationLog
    print("  ✓ models module imported")
except Exception as e:
    errors_found.append(f"models import: {e}")
    print(f"  ✗ models import failed: {e}")

try:
    from schemas import UserResponse, LoginRequest, TokenResponse
    print("  ✓ schemas module imported")
except Exception as e:
    errors_found.append(f"schemas import: {e}")
    print(f"  ✗ schemas import failed: {e}")

try:
    from utils import hash_password, verify_password, create_access_token, decode_token
    print("  ✓ utils module imported")
except Exception as e:
    errors_found.append(f"utils import: {e}")
    print(f"  ✗ utils import failed: {e}")

try:
    from config import settings
    print("  ✓ config module imported")
except Exception as e:
    errors_found.append(f"config import: {e}")
    print(f"  ✗ config import failed: {e}")

# Test 2: Import all routes
print("\n2. Testing route imports...")
routes_to_test = [
    'routes.auth',
    'routes.users',
    'routes.projects',
    'routes.tasks',
    'routes.meetings',
    'routes.issues',
    'routes.ratings',
    'routes.dashboard',
    'routes.reports',
    'routes.notifications'
]

for route_name in routes_to_test:
    try:
        __import__(route_name)
        print(f"  ✓ {route_name} imported")
    except Exception as e:
        errors_found.append(f"{route_name} import: {e}")
        print(f"  ✗ {route_name} import failed: {e}")

# Test 3: Database connection
print("\n3. Testing database connection...")
try:
    db = SessionLocal()
    user_count = db.query(User).count()
    print(f"  ✓ Database connected (found {user_count} users)")
    db.close()
except Exception as e:
    errors_found.append(f"database connection: {e}")
    print(f"  ✗ Database connection failed: {e}")

# Test 4: Test main app
print("\n4. Testing FastAPI app creation...")
try:
    from main import app
    print("  ✓ FastAPI app created successfully")
    print(f"  ✓ App title: {app.title}")
    print(f"  ✓ App version: {app.version}")
except Exception as e:
    errors_found.append(f"main app: {e}")
    print(f"  ✗ FastAPI app creation failed: {e}")

# Test 5: Check route registration
print("\n5. Checking route registration...")
if 'app' in locals():
    routes = [r.path for r in app.routes]
    print(f"  ✓ Found {len(routes)} registered routes")
    if len(routes) < 10:
        warnings.append(f"Expected more routes, found only {len(routes)}")
    
    # Check key routes
    key_routes = ['/api/auth/login', '/api/auth/me', '/api/users/', '/api/tasks/']
    for route in key_routes:
        if any(route in r for r in routes):
            print(f"  ✓ Route found: {route}")
        else:
            warnings.append(f"Route not found: {route}")

# Test 6: Test User model fields
print("\n6. Testing User model...")
try:
    db = SessionLocal()
    user = db.query(User).first()
    if user:
        required_fields = ['id', 'empid', 'name', 'email', 'username', 'password', 'role', 'is_active', 'report_to_id', 'created_at']
        missing = []
        for field in required_fields:
            if not hasattr(user, field):
                missing.append(field)
        
        if missing:
            errors_found.append(f"User model missing fields: {', '.join(missing)}")
            print(f"  ✗ Missing fields: {', '.join(missing)}")
        else:
            print(f"  ✓ All required fields present")
        
        # Test report_to_id
        if hasattr(user, 'report_to_id'):
            print(f"  ✓ report_to_id field exists (value: {user.report_to_id})")
        else:
            errors_found.append("User model missing report_to_id field")
            print(f"  ✗ report_to_id field missing")
    else:
        warnings.append("No users found in database")
        print(f"  ⚠ No users found")
    db.close()
except Exception as e:
    errors_found.append(f"User model test: {e}")
    print(f"  ✗ User model test failed: {e}")

# Summary
print(f"\n{'='*70}")
print("SUMMARY")
print(f"{'='*70}")

if errors_found:
    print(f"\n✗ ERRORS FOUND ({len(errors_found)}):")
    for i, error in enumerate(errors_found, 1):
        print(f"  {i}. {error}")
else:
    print("\n✓ NO ERRORS FOUND!")

if warnings:
    print(f"\n⚠ WARNINGS ({len(warnings)}):")
    for i, warning in enumerate(warnings, 1):
        print(f"  {i}. {warning}")

if not errors_found and not warnings:
    print("\n✓ Backend is healthy and ready!")
else:
    print(f"\n⚠ Backend has {len(errors_found)} errors and {len(warnings)} warnings")

print(f"{'='*70}")


import psycopg
from utils import verify_password, create_access_token
from datetime import datetime, timedelta
from config import settings

# Test database connection and user lookup
conn = psycopg.connect("postgresql://postgres:Ravi%408297@localhost:5432/tms_db")
cur = conn.cursor()

print("Testing login functionality...\n")

# Test user credentials
test_user = {
    "username": "101",
    "password": "admin123"
}

# Query user
cur.execute(
    "SELECT id, empid, name, email, username, password, role, is_active, report_to_id FROM users WHERE username = %s OR empid = %s",
    (test_user["username"], test_user["username"])
)
user_data = cur.fetchone()

if not user_data:
    print("✗ User not found in database")
else:
    user_id, empid, name, email, username, hashed_password, role, is_active, report_to_id = user_data
    
    print(f"✓ User found: {name} ({empid})")
    print(f"  Username: {username}")
    print(f"  Role: {role}")
    print(f"  Active: {is_active}")
    print(f"  Report To: {report_to_id or 'None'}")
    
    # Test password verification
    password_valid = verify_password(test_user["password"], hashed_password)
    print(f"  Password Valid: {password_valid}")
    
    if password_valid and is_active:
        # Test token creation
        expires_at = datetime.utcnow() + timedelta(days=settings.ACCESS_TOKEN_EXPIRE_DAYS)
        token = create_access_token({"user_id": user_id, "role": role})
        print(f"  Token Created: {token[:50]}...")
        print(f"  Expires At: {expires_at}")
        print("\n✓ Login should work!")
    else:
        print("\n✗ Login will fail:")
        if not password_valid:
            print("  - Password verification failed")
        if not is_active:
            print("  - User is inactive")

print("\n" + "="*60)
print("Checking all users...")
cur.execute("SELECT empid, username, role, is_active FROM users ORDER BY role, empid")
all_users = cur.fetchall()
for u in all_users:
    print(f"  {u[1]} ({u[0]}) - {u[2]} - Active: {u[3]}")


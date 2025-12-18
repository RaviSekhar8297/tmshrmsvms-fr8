import psycopg
from utils import verify_password

conn = psycopg.connect("postgresql://postgres:Ravi%408297@localhost:5432/tms_db")
cur = conn.cursor()

# Get all users
cur.execute("SELECT empid, name, email, username, role, report_to_id, password FROM users ORDER BY role, empid;")
users = cur.fetchall()

print("=" * 60)
print("VERIFIED USERS IN DATABASE")
print("=" * 60)

test_passwords = {
    "101": "admin123",
    "1027": "manager123",
    "1460": "employee123"
}

for user in users:
    empid, name, email, username, role, report_to_id, hashed_password = user
    test_password = test_passwords.get(empid, "")
    
    password_valid = verify_password(test_password, hashed_password) if test_password else False
    
    print(f"\n✓ {role}: {name}")
    print(f"  EmpID: {empid}")
    print(f"  Username: {username}")
    print(f"  Email: {email}")
    print(f"  Report To: {report_to_id or 'None'}")
    print(f"  Password Test: {'✓ Valid' if password_valid else '✗ Invalid/Missing'}")

print("\n" + "=" * 60)
print("LOGIN CREDENTIALS:")
print("=" * 60)
print("Admin:   username=101,   password=admin123")
print("Manager: username=1027,  password=manager123")
print("Employee: username=1460, password=employee123")
print("=" * 60)


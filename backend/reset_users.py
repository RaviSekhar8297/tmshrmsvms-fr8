import psycopg
import sys
import os

# Add parent directory to path to import utils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from utils import hash_password

conn = psycopg.connect("postgresql://postgres:Ravi%408297@localhost:5432/tms_db")
cur = conn.cursor()

# Ensure columns exist
cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS report_to_id VARCHAR(20);")
cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by INTEGER;")

# Drop FK constraints temporarily to allow deletion
cur.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_report_to_empid;")
cur.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_created_by_fkey;")
cur.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_created_by;")

# Delete all existing users
print("Deleting all existing users...")
cur.execute("DELETE FROM users;")

# Hash passwords
admin_password = hash_password("admin123")
manager_password = hash_password("manager123")
employee_password = hash_password("employee123")

# Insert default users
print("Creating default users...")
cur.execute(
    """
    INSERT INTO users (empid, name, email, phone, username, password, role, report_to_id, is_active)
    VALUES
      ('101', 'Raja Sekhar', 'md@brihaspathi.com', '9999999999', '101', %s, 'Admin', NULL, true),
      ('1027', 'ravi', 'ravi@brihaspathi.com', '8297297247', '1027', %s, 'Manager', '101', true),
      ('1460', 'shiva', 'shiva@brihaspathi.com', '9876543210', '1460', %s, 'Employee', '1027', true);
    """,
    (admin_password, manager_password, employee_password)
)

# Recreate FK constraints
cur.execute("ALTER TABLE users ADD CONSTRAINT fk_users_report_to_empid FOREIGN KEY (report_to_id) REFERENCES users(empid);")
# created_by FK will be created automatically by SQLAlchemy if needed

conn.commit()
print("✓ Default users created successfully!")
print("\nLogin credentials:")
print("Admin: username=101, password=admin123")
print("Manager: username=1027, password=manager123")
print("Employee: username=1460, password=employee123")


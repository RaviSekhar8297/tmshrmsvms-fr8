import psycopg

conn = psycopg.connect("postgresql://postgres:Ravi%408297@localhost:5432/tms_db")
cur = conn.cursor()

print("Adding missing columns to database tables...")

# Add missing columns to users table
try:
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by INTEGER;")
    print("✓ Added users.created_by column")
except Exception as e:
    print(f"Note: {e}")

try:
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS report_to_id VARCHAR(20);")
    print("✓ Added users.report_to_id column")
except Exception as e:
    print(f"Note: {e}")

# Add FK constraint for report_to_id if it doesn't exist
try:
    cur.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_report_to_empid;")
    cur.execute("ALTER TABLE users ADD CONSTRAINT fk_users_report_to_empid FOREIGN KEY (report_to_id) REFERENCES users(empid);")
    print("✓ Added report_to_id foreign key constraint")
except Exception as e:
    print(f"Note: {e}")

# Add missing columns to auth_tokens table
try:
    cur.execute("ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP;")
    print("✓ Added auth_tokens.last_used_at column")
except Exception as e:
    print(f"Note: {e}")

# Fix NULL consent fields in users table
try:
    cur.execute("UPDATE users SET sms_consent = false WHERE sms_consent IS NULL;")
    cur.execute("UPDATE users SET whatsapp_consent = false WHERE whatsapp_consent IS NULL;")
    cur.execute("UPDATE users SET email_consent = false WHERE email_consent IS NULL;")
    print("✓ Fixed NULL consent fields in users table")
except Exception as e:
    print(f"Note: {e}")

conn.commit()
print("\n✓ Database schema updated successfully!")


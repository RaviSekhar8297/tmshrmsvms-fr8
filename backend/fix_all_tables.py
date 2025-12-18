"""Comprehensive database schema fix for all tables"""
import psycopg

conn = psycopg.connect("postgresql://postgres:Ravi%408297@localhost:5432/tms_db")
cur = conn.cursor()

print("=" * 70)
print("COMPREHENSIVE DATABASE SCHEMA FIX")
print("=" * 70)

errors = []
success = []

# 1. Users table
print("\n1. Fixing users table...")
try:
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by INTEGER;")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS report_to_id VARCHAR(20);")
    cur.execute("UPDATE users SET sms_consent = false WHERE sms_consent IS NULL;")
    cur.execute("UPDATE users SET whatsapp_consent = false WHERE whatsapp_consent IS NULL;")
    cur.execute("UPDATE users SET email_consent = false WHERE email_consent IS NULL;")
    cur.execute("UPDATE users SET is_active = true WHERE is_active IS NULL;")
    success.append("users table")
except Exception as e:
    errors.append(f"users: {e}")

# 2. Auth tokens table
print("2. Fixing auth_tokens table...")
try:
    cur.execute("ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP;")
    cur.execute("UPDATE auth_tokens SET is_active = true WHERE is_active IS NULL;")
    success.append("auth_tokens table")
except Exception as e:
    errors.append(f"auth_tokens: {e}")

# 3. Projects table
print("3. Fixing projects table...")
try:
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(100);")
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_head_id INTEGER;")
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_head_name VARCHAR(100);")
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS teams JSONB DEFAULT '[]'::jsonb;")
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_cost NUMERIC(20,2) DEFAULT 0;")
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';")
    cur.execute("UPDATE projects SET progress_percent = 0 WHERE progress_percent IS NULL;")
    cur.execute("UPDATE projects SET status = 'planning' WHERE status IS NULL;")
    cur.execute("UPDATE projects SET priority = 'medium' WHERE priority IS NULL;")
    success.append("projects table")
except Exception as e:
    conn.rollback()
    errors.append(f"projects: {e}")

# 4. Tasks table
print("4. Fixing tasks table...")
try:
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_by_id INTEGER;")
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_by_name VARCHAR(100);")
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(100);")
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_ids JSONB DEFAULT '[]'::jsonb;")
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_days INTEGER;")
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS percent_complete INTEGER DEFAULT 0;")
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS remarks JSONB DEFAULT '[]'::jsonb;")
    cur.execute("UPDATE tasks SET status = 'todo' WHERE status IS NULL;")
    cur.execute("UPDATE tasks SET priority = 'medium' WHERE priority IS NULL;")
    cur.execute("UPDATE tasks SET percent_complete = 0 WHERE percent_complete IS NULL;")
    success.append("tasks table")
except Exception as e:
    conn.rollback()
    errors.append(f"tasks: {e}")

# 5. Issues table
print("5. Fixing issues table...")
try:
    cur.execute("ALTER TABLE issues ADD COLUMN IF NOT EXISTS raised_by_name VARCHAR(100);")
    cur.execute("ALTER TABLE issues ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(100);")
    cur.execute("ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;")
    cur.execute("ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolution_notes TEXT;")
    cur.execute("ALTER TABLE issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
    cur.execute("UPDATE issues SET status = 'open' WHERE status IS NULL;")
    cur.execute("UPDATE issues SET priority = 'medium' WHERE priority IS NULL;")
    success.append("issues table")
except Exception as e:
    conn.rollback()
    errors.append(f"issues: {e}")

# 6. Meetings table
print("6. Fixing meetings table...")
try:
    cur.execute("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(100);")
    cur.execute("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]'::jsonb;")
    cur.execute("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS link TEXT;")
    cur.execute("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'scheduled';")
    cur.execute("UPDATE meetings SET duration_minutes = 60 WHERE duration_minutes IS NULL;")
    cur.execute("UPDATE meetings SET status = 'scheduled' WHERE status IS NULL;")
    success.append("meetings table")
except Exception as e:
    conn.rollback()
    errors.append(f"meetings: {e}")

# 7. Task ratings table
print("7. Fixing task_ratings table...")
try:
    cur.execute("ALTER TABLE task_ratings ADD COLUMN IF NOT EXISTS rater_name VARCHAR(100);")
    cur.execute("ALTER TABLE task_ratings ADD COLUMN IF NOT EXISTS ratee_name VARCHAR(100);")
    cur.execute("ALTER TABLE task_ratings ADD COLUMN IF NOT EXISTS comments TEXT;")
    cur.execute("ALTER TABLE task_ratings ADD COLUMN IF NOT EXISTS rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
    success.append("task_ratings table")
except Exception as e:
    conn.rollback()
    errors.append(f"task_ratings: {e}")

# 8. Subtasks table
print("8. Fixing subtasks table...")
try:
    cur.execute("ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(100);")
    cur.execute("UPDATE subtasks SET is_completed = false WHERE is_completed IS NULL;")
    success.append("subtasks table")
except Exception as e:
    conn.rollback()
    errors.append(f"subtasks: {e}")

# 9. Comments table
print("9. Fixing comments table...")
try:
    cur.execute("ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_name VARCHAR(100);")
    success.append("comments table")
except Exception as e:
    conn.rollback()
    errors.append(f"comments: {e}")

# 10. Task timers table
print("10. Fixing task_timers table...")
try:
    cur.execute("ALTER TABLE task_timers ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;")
    cur.execute("ALTER TABLE task_timers ADD COLUMN IF NOT EXISTS notes TEXT;")
    cur.execute("UPDATE task_timers SET duration_seconds = 0 WHERE duration_seconds IS NULL;")
    success.append("task_timers table")
except Exception as e:
    conn.rollback()
    errors.append(f"task_timers: {e}")

# 11. Notifications table
print("11. Fixing notifications_log table...")
try:
    cur.execute("ALTER TABLE notifications_log ADD COLUMN IF NOT EXISTS type VARCHAR(30);")
    cur.execute("ALTER TABLE notifications_log ADD COLUMN IF NOT EXISTS title VARCHAR(300);")
    cur.execute("ALTER TABLE notifications_log ADD COLUMN IF NOT EXISTS message TEXT;")
    cur.execute("ALTER TABLE notifications_log ADD COLUMN IF NOT EXISTS channel VARCHAR(15);")
    cur.execute("ALTER TABLE notifications_log ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
    cur.execute("ALTER TABLE notifications_log ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;")
    cur.execute("UPDATE notifications_log SET is_read = false WHERE is_read IS NULL;")
    success.append("notifications_log table")
except Exception as e:
    conn.rollback()
    errors.append(f"notifications_log: {e}")

# 12. Activities table
print("12. Fixing activities table...")
try:
    cur.execute("ALTER TABLE activities ADD COLUMN IF NOT EXISTS user_name VARCHAR(100);")
    cur.execute("ALTER TABLE activities ADD COLUMN IF NOT EXISTS entity_type VARCHAR(30);")
    cur.execute("ALTER TABLE activities ADD COLUMN IF NOT EXISTS entity_id INTEGER;")
    cur.execute("ALTER TABLE activities ADD COLUMN IF NOT EXISTS entity_name VARCHAR(300);")
    cur.execute("ALTER TABLE activities ADD COLUMN IF NOT EXISTS details TEXT;")
    success.append("activities table")
except Exception as e:
    conn.rollback()
    errors.append(f"activities: {e}")

# Add foreign key constraints
print("\n13. Adding foreign key constraints...")
try:
    cur.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_report_to_empid;")
    cur.execute("ALTER TABLE users ADD CONSTRAINT fk_users_report_to_empid FOREIGN KEY (report_to_id) REFERENCES users(empid);")
    success.append("foreign key constraints")
except Exception as e:
    conn.rollback()
    errors.append(f"FK constraints: {e}")

try:
    conn.commit()
except Exception as e:
    conn.rollback()
    errors.append(f"Commit failed: {e}")

print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)

if success:
    print(f"\n✓ Successfully fixed {len(success)} items:")
    for item in success:
        print(f"  - {item}")

if errors:
    print(f"\n✗ Errors ({len(errors)}):")
    for error in errors:
        print(f"  - {error}")
else:
    print("\n✓ All database tables fixed successfully!")

print("=" * 70)


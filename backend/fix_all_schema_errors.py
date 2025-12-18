"""Comprehensive database schema fix based on actual table definitions"""
import psycopg

conn = psycopg.connect("postgresql://postgres:Ravi%408297@localhost:5432/tms_db")
cur = conn.cursor()

print("=" * 70)
print("COMPREHENSIVE DATABASE SCHEMA FIX")
print("=" * 70)

errors = []
success = []

try:
    # 1. Fix users table
    print("\n1. Fixing users table...")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by INTEGER;")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS report_to_id VARCHAR(20);")
    cur.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_report_to_empid;")
    cur.execute("ALTER TABLE users ADD CONSTRAINT fk_users_report_to_empid FOREIGN KEY (report_to_id) REFERENCES users(empid);")
    cur.execute("UPDATE users SET sms_consent = false WHERE sms_consent IS NULL;")
    cur.execute("UPDATE users SET whatsapp_consent = false WHERE whatsapp_consent IS NULL;")
    cur.execute("UPDATE users SET email_consent = false WHERE email_consent IS NULL;")
    cur.execute("UPDATE users SET is_active = true WHERE is_active IS NULL;")
    success.append("users table")
except Exception as e:
    conn.rollback()
    errors.append(f"users: {e}")

# 2. Fix projects table
print("2. Fixing projects table...")
try:
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by INTEGER;")
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(100);")
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_head_id INTEGER;")
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_head_name VARCHAR(100);")
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS teams JSONB DEFAULT '[]'::jsonb;")
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_cost NUMERIC(20,2) DEFAULT 0;")
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';")
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS estimated_days INTEGER;")
    cur.execute("UPDATE projects SET progress_percent = 0 WHERE progress_percent IS NULL;")
    cur.execute("UPDATE projects SET status = 'planning' WHERE status IS NULL;")
    cur.execute("UPDATE projects SET priority = 'medium' WHERE priority IS NULL;")
    cur.execute("UPDATE projects SET teams = '[]'::jsonb WHERE teams IS NULL;")
    cur.execute("UPDATE projects SET project_cost = 0 WHERE project_cost IS NULL;")
    success.append("projects table")
except Exception as e:
    conn.rollback()
    errors.append(f"projects: {e}")

# 3. Fix tasks table
print("3. Fixing tasks table...")
try:
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_by_id INTEGER;")
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_by_name VARCHAR(100);")
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_id INTEGER;")
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(100);")
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_ids JSONB DEFAULT '[]'::jsonb;")
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_days INTEGER;")
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS percent_complete INTEGER DEFAULT 0;")
    cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS remarks JSONB DEFAULT '[]'::jsonb;")
    cur.execute("UPDATE tasks SET status = 'todo' WHERE status IS NULL;")
    cur.execute("UPDATE tasks SET priority = 'medium' WHERE priority IS NULL;")
    cur.execute("UPDATE tasks SET percent_complete = 0 WHERE percent_complete IS NULL;")
    cur.execute("UPDATE tasks SET assigned_to_ids = '[]'::jsonb WHERE assigned_to_ids IS NULL;")
    cur.execute("UPDATE tasks SET remarks = '[]'::jsonb WHERE remarks IS NULL;")
    success.append("tasks table")
except Exception as e:
    conn.rollback()
    errors.append(f"tasks: {e}")

# 4. Fix issues table
print("4. Fixing issues table...")
try:
    # Check if raised_by exists, if not add raised_by_id
    cur.execute("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='raised_by') THEN
                ALTER TABLE issues ADD COLUMN raised_by INTEGER;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='raised_by_id') THEN
                ALTER TABLE issues ADD COLUMN raised_by_id INTEGER;
            END IF;
        END $$;
    """)
    # If both exist, rename raised_by_id to raised_by if needed
    cur.execute("""
        DO $$ 
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='raised_by_id') 
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='raised_by') THEN
                ALTER TABLE issues RENAME COLUMN raised_by_id TO raised_by;
            END IF;
        END $$;
    """)
    cur.execute("ALTER TABLE issues ADD COLUMN IF NOT EXISTS raised_by_name VARCHAR(100);")
    cur.execute("ALTER TABLE issues ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(100);")
    cur.execute("ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;")
    cur.execute("ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolution_notes TEXT;")
    cur.execute("ALTER TABLE issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
    cur.execute("ALTER TABLE issues ADD COLUMN IF NOT EXISTS task_id INTEGER;")
    cur.execute("UPDATE issues SET status = 'open' WHERE status IS NULL;")
    cur.execute("UPDATE issues SET priority = 'medium' WHERE priority IS NULL;")
    success.append("issues table")
except Exception as e:
    conn.rollback()
    errors.append(f"issues: {e}")

# 5. Fix meetings table
print("5. Fixing meetings table...")
try:
    cur.execute("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(100);")
    cur.execute("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]'::jsonb;")
    cur.execute("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS link TEXT;")
    cur.execute("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'scheduled';")
    cur.execute("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;")
    cur.execute("UPDATE meetings SET duration_minutes = 60 WHERE duration_minutes IS NULL;")
    cur.execute("UPDATE meetings SET status = 'scheduled' WHERE status IS NULL;")
    cur.execute("UPDATE meetings SET participants = '[]'::jsonb WHERE participants IS NULL;")
    success.append("meetings table")
except Exception as e:
    conn.rollback()
    errors.append(f"meetings: {e}")

# 6. Fix task_ratings table
print("6. Fixing task_ratings table...")
try:
    cur.execute("ALTER TABLE task_ratings ADD COLUMN IF NOT EXISTS rater_id INTEGER;")
    cur.execute("ALTER TABLE task_ratings ADD COLUMN IF NOT EXISTS rater_name VARCHAR(100);")
    cur.execute("ALTER TABLE task_ratings ADD COLUMN IF NOT EXISTS ratee_id INTEGER;")
    cur.execute("ALTER TABLE task_ratings ADD COLUMN IF NOT EXISTS ratee_name VARCHAR(100);")
    cur.execute("ALTER TABLE task_ratings ADD COLUMN IF NOT EXISTS comments TEXT;")
    cur.execute("ALTER TABLE task_ratings ADD COLUMN IF NOT EXISTS rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
    success.append("task_ratings table")
except Exception as e:
    conn.rollback()
    errors.append(f"task_ratings: {e}")

# 7. Fix other tables
print("7. Fixing other tables...")
try:
    # Subtasks
    cur.execute("ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(100);")
    cur.execute("UPDATE subtasks SET is_completed = false WHERE is_completed IS NULL;")
    
    # Comments
    cur.execute("ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_name VARCHAR(100);")
    
    # Task timers
    cur.execute("ALTER TABLE task_timers ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;")
    cur.execute("ALTER TABLE task_timers ADD COLUMN IF NOT EXISTS notes TEXT;")
    cur.execute("UPDATE task_timers SET duration_seconds = 0 WHERE duration_seconds IS NULL;")
    
    # Notifications
    cur.execute("ALTER TABLE notifications_log ADD COLUMN IF NOT EXISTS type VARCHAR(30);")
    cur.execute("ALTER TABLE notifications_log ADD COLUMN IF NOT EXISTS title VARCHAR(300);")
    cur.execute("ALTER TABLE notifications_log ADD COLUMN IF NOT EXISTS message TEXT;")
    cur.execute("ALTER TABLE notifications_log ADD COLUMN IF NOT EXISTS channel VARCHAR(15);")
    cur.execute("ALTER TABLE notifications_log ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
    cur.execute("ALTER TABLE notifications_log ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;")
    cur.execute("UPDATE notifications_log SET is_read = false WHERE is_read IS NULL;")
    
    # Activities
    cur.execute("ALTER TABLE activities ADD COLUMN IF NOT EXISTS user_name VARCHAR(100);")
    cur.execute("ALTER TABLE activities ADD COLUMN IF NOT EXISTS entity_type VARCHAR(30);")
    cur.execute("ALTER TABLE activities ADD COLUMN IF NOT EXISTS entity_id INTEGER;")
    cur.execute("ALTER TABLE activities ADD COLUMN IF NOT EXISTS entity_name VARCHAR(300);")
    cur.execute("ALTER TABLE activities ADD COLUMN IF NOT EXISTS details TEXT;")
    
    success.append("other tables")
except Exception as e:
    conn.rollback()
    errors.append(f"other tables: {e}")

# 8. Fix auth_tokens
print("8. Fixing auth_tokens table...")
try:
    cur.execute("ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
    cur.execute("UPDATE auth_tokens SET is_active = true WHERE is_active IS NULL;")
    success.append("auth_tokens table")
except Exception as e:
    conn.rollback()
    errors.append(f"auth_tokens: {e}")

try:
    conn.commit()
    print("\n✓ All changes committed successfully!")
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

cur.close()
conn.close()


"""
Migration script to add created_at column to task_timers table
Run: python fix_task_timers_created_at.py
"""
import psycopg
from config import settings

# Get database URL from settings
db_url = settings.DATABASE_URL.replace("%40", "@")  # Decode URL encoding

try:
    conn = psycopg.connect(db_url)
    cur = conn.cursor()
    
    # Check if column exists
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='task_timers' AND column_name='created_at';
    """)
    
    column_exists = cur.fetchone()
    
    if not column_exists:
        # Add created_at column with default value
        print("Adding created_at column to task_timers table...")
        cur.execute("""
            ALTER TABLE task_timers 
            ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        """)
        
        # Update existing records to have created_at = start_time if start_time exists
        cur.execute("""
            UPDATE task_timers 
            SET created_at = start_time 
            WHERE created_at IS NULL AND start_time IS NOT NULL;
        """)
        
        # For records without start_time, set to current timestamp
        cur.execute("""
            UPDATE task_timers 
            SET created_at = CURRENT_TIMESTAMP 
            WHERE created_at IS NULL;
        """)
        
        conn.commit()
        print("✅ Successfully added created_at column to task_timers table!")
    else:
        print("✅ created_at column already exists in task_timers table")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()


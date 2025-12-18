"""Fix issues table column names to match model"""
import psycopg

conn = psycopg.connect("postgresql://postgres:Ravi%408297@localhost:5432/tms_db")
cur = conn.cursor()

print("Fixing issues table column names...")

try:
    # Check if raised_by_id exists and rename to raised_by
    cur.execute("""
        DO $$ 
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='raised_by_id') 
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='raised_by') THEN
                ALTER TABLE issues RENAME COLUMN raised_by_id TO raised_by;
                RAISE NOTICE 'Renamed raised_by_id to raised_by';
            END IF;
        END $$;
    """)
    
    # Check if assigned_to_id exists and rename to assigned_to
    cur.execute("""
        DO $$ 
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='assigned_to_id') 
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='assigned_to') THEN
                ALTER TABLE issues RENAME COLUMN assigned_to_id TO assigned_to;
                RAISE NOTICE 'Renamed assigned_to_id to assigned_to';
            END IF;
        END $$;
    """)
    
    # Ensure raised_by exists
    cur.execute("ALTER TABLE issues ADD COLUMN IF NOT EXISTS raised_by INTEGER;")
    
    # Ensure assigned_to exists
    cur.execute("ALTER TABLE issues ADD COLUMN IF NOT EXISTS assigned_to INTEGER;")
    
    conn.commit()
    print("✓ Issues table columns fixed!")
    
except Exception as e:
    conn.rollback()
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()

cur.close()
conn.close()


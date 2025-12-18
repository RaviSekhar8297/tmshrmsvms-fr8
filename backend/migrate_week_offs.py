"""
Migration script to remove week_offs table and create week_off_dates table
Run this script once to migrate the database
"""
from sqlalchemy import text, inspect
from database import engine

def migrate_week_offs():
    """Remove week_offs table and create week_off_dates table"""
    inspector = inspect(engine)
    
    with engine.connect() as conn:
        # Check if week_offs table exists
        if 'week_offs' in inspector.get_table_names():
            print("Dropping week_offs table...")
            conn.execute(text("DROP TABLE IF EXISTS week_offs CASCADE"))
            conn.commit()
            print("✓ week_offs table dropped")
        else:
            print("✓ week_offs table does not exist")
        
        # Check if week_off_dates table exists
        if 'week_off_dates' in inspector.get_table_names():
            print("✓ week_off_dates table already exists")
        else:
            print("Creating week_off_dates table...")
            conn.execute(text("""
                CREATE TABLE week_off_dates (
                    id SERIAL PRIMARY KEY,
                    employee_id VARCHAR(20) NOT NULL,
                    employee_name VARCHAR(100),
                    date DATE NOT NULL,
                    weekday VARCHAR(20),
                    month INTEGER,
                    year INTEGER,
                    created_by INTEGER REFERENCES users(id),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            
            # Create indexes
            conn.execute(text("CREATE INDEX idx_employee_date ON week_off_dates(employee_id, date)"))
            conn.execute(text("CREATE INDEX idx_month_year ON week_off_dates(month, year)"))
            conn.execute(text("CREATE INDEX idx_date ON week_off_dates(date)"))
            
            conn.commit()
            print("✓ week_off_dates table created successfully!")
            print("✓ Indexes created")

if __name__ == "__main__":
    try:
        migrate_week_offs()
        print("\n✅ Migration completed successfully!")
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()


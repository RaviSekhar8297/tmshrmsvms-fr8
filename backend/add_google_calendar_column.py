"""Script to add google_calendar_credentials column to users table"""
from database import engine, Base
from sqlalchemy import text

def add_google_calendar_column():
    """Add google_calendar_credentials column if it doesn't exist"""
    try:
        with engine.connect() as conn:
            # Check if column exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='google_calendar_credentials'
            """))
            
            if result.fetchone() is None:
                # Add column
                conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN google_calendar_credentials JSONB
                """))
                conn.commit()
                print("✓ Added google_calendar_credentials column to users table")
            else:
                print("✓ google_calendar_credentials column already exists")
    except Exception as e:
        print(f"Error adding column: {e}")

if __name__ == "__main__":
    add_google_calendar_column()


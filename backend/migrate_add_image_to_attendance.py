"""
Migration script to add image column to attendance table
"""
import sys
from sqlalchemy import text
from database import engine

def run_migration():
    """Run the migration SQL"""
    try:
        with engine.connect() as connection:
            # Check if image column exists
            result = connection.execute(text("""
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'attendance' AND column_name = 'image'
            """))
            
            if not result.fetchone():
                # Add image column
                connection.execute(text("ALTER TABLE attendance ADD COLUMN image TEXT"))
                connection.commit()
                print("✓ Added image column to attendance table")
            else:
                print("✓ Image column already exists in attendance table")
            
            print("\nMigration completed successfully!")
            
    except Exception as e:
        print(f"Error running migration: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    print("Running migration to add image column to attendance table...")
    run_migration()


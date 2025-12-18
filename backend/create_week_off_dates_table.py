"""
Script to create week_off_dates table if it doesn't exist
Run this script once to set up the table
"""
from database import engine, Base
from models import WeekOffDate
from sqlalchemy import inspect

def create_week_off_dates_table():
    """Create week_off_dates table if it doesn't exist"""
    inspector = inspect(engine)
    
    # Check if table exists
    if 'week_off_dates' not in inspector.get_table_names():
        print("Creating week_off_dates table...")
        WeekOffDate.__table__.create(engine)
        print("✓ week_off_dates table created successfully!")
    else:
        print("✓ week_off_dates table already exists")

if __name__ == "__main__":
    try:
        create_week_off_dates_table()
    except Exception as e:
        print(f"Error creating table: {e}")
        import traceback
        traceback.print_exc()


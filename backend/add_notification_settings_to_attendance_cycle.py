"""
Migration script to add notification settings columns to attendance_cycle table
Run: python add_notification_settings_to_attendance_cycle.py
"""
from sqlalchemy import text
from database import engine

def add_notification_settings_columns():
    """Add notification settings columns to attendance_cycle table"""
    print("Adding notification settings columns to attendance_cycle table...")
    try:
        with engine.connect() as connection:
            # Read and execute the SQL migration
            with open('migrations/add_notification_settings_to_attendance_cycle.sql', 'r', encoding='utf-8') as f:
                sql = f.read()
            
            connection.execute(text(sql))
            connection.commit()
            print("✅ Notification settings columns added successfully!")
            print("   - birthdays_send (JSONB: {day, time})")
            print("   - anniversaries_send (JSONB: {day, time})")
            print("   - weekly_attendance_send (JSONB: {day, time})")
    except Exception as e:
        print(f"❌ Error adding notification settings columns: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    add_notification_settings_columns()


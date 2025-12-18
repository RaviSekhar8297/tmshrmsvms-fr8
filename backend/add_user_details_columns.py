from sqlalchemy import text
from database import engine

def add_user_details_columns():
    """Add JSONB columns for user details to the users table"""
    print("Adding user details columns to users table...")
    try:
        with engine.connect() as connection:
            # Read and execute the SQL migration
            with open('migrations/add_user_details_columns.sql', 'r') as f:
                sql = f.read()
            
            connection.execute(text(sql))
            connection.commit()
            print("User details columns added successfully!")
    except Exception as e:
        print(f"Error adding user details columns: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    add_user_details_columns()


"""Fix likes column in policies table - convert {} to []"""
import sys
import os
sys.path.append(os.path.dirname(__file__))

from sqlalchemy import text
from database import engine

def fix_likes_column():
    """Update all policies to have likes as [] instead of {}"""
    try:
        with engine.connect() as connection:
            # Update all policies where likes is {} or NULL to []
            result = connection.execute(text("""
                UPDATE policies 
                SET likes = '[]'::jsonb 
                WHERE likes = '{}'::jsonb OR likes IS NULL
            """))
            connection.commit()
            print(f"Updated {result.rowcount} policies")
            print("Likes column fixed successfully!")
    except Exception as e:
        print(f"Error fixing likes column: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    fix_likes_column()


"""
Migration script to add half_from and half_to fields to leaves table
Run this script once to update the database schema
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from dotenv import load_dotenv

load_dotenv()

def add_halfday_fields():
    # Get database connection details from environment
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '5432')
    db_name = os.getenv('DB_NAME', 'tms')
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD', 'postgres')
    
    try:
        # Connect to database
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            database=db_name,
            user=db_user,
            password=db_password
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        
        # Add half_from column if it doesn't exist
        cur.execute("""
            ALTER TABLE leaves 
            ADD COLUMN IF NOT EXISTS half_from VARCHAR(20);
        """)
        print("✓ Added half_from column to leaves table")
        
        # Add half_to column if it doesn't exist
        cur.execute("""
            ALTER TABLE leaves 
            ADD COLUMN IF NOT EXISTS half_to VARCHAR(20);
        """)
        print("✓ Added half_to column to leaves table")
        
        cur.close()
        conn.close()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        raise

if __name__ == "__main__":
    add_halfday_fields()


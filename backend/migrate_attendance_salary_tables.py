"""
Migration script to add AttendanceList and SalaryStructure tables
and ensure DOB/DOJ columns exist in users table
"""
import sys
from sqlalchemy import text
from database import engine

def run_migration():
    """Run the migration SQL"""
    try:
        with engine.connect() as connection:
            # Check and add DOB column
            result = connection.execute(text("""
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'dob'
            """))
            if not result.fetchone():
                connection.execute(text("ALTER TABLE users ADD COLUMN dob DATE"))
                connection.commit()
                print("✓ Added DOB column to users table")
            else:
                print("✓ DOB column already exists")
            
            # Check and add DOJ column
            result = connection.execute(text("""
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'doj'
            """))
            if not result.fetchone():
                connection.execute(text("ALTER TABLE users ADD COLUMN doj DATE"))
                connection.commit()
                print("✓ Added DOJ column to users table")
            else:
                print("✓ DOJ column already exists")
            
            # Create AttendanceList table
            attendance_list_sql = """
            CREATE TABLE IF NOT EXISTS attendance_list (
                id SERIAL PRIMARY KEY,
                name TEXT,
                empid VARCHAR(20) REFERENCES users(empid),
                user_id INTEGER REFERENCES users(id),
                doj DATE,
                from_date DATE,
                to_date DATE,
                total_days NUMERIC(10, 1),
                working_days NUMERIC(10, 1),
                week_offs INTEGER,
                holi_days NUMERIC(10, 1),
                presents NUMERIC(10, 1),
                absents NUMERIC(10, 1),
                half_days NUMERIC(10, 1),
                late_logs INTEGER,
                cl NUMERIC(10, 1),
                sl NUMERIC(10, 1),
                comp_offs NUMERIC(10, 1),
                payble_days NUMERIC(10, 1),
                lops NUMERIC(10, 1),
                year INTEGER,
                month TEXT,
                status INTEGER DEFAULT 0,
                updated_by TEXT,
                updated_date TIMESTAMP
            )
            """
            connection.execute(text(attendance_list_sql))
            connection.commit()
            print("✓ AttendanceList table created")
            
            # Create indexes for AttendanceList
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_attendance_list_empid ON attendance_list(empid)",
                "CREATE INDEX IF NOT EXISTS idx_attendance_list_user_id ON attendance_list(user_id)",
                "CREATE INDEX IF NOT EXISTS idx_attendance_list_year_month ON attendance_list(year, month)"
            ]
            for index_sql in indexes:
                try:
                    connection.execute(text(index_sql))
                    connection.commit()
                except Exception as e:
                    if 'already exists' not in str(e).lower():
                        print(f"Warning creating index: {e}")
            
            # Create SalaryStructure table
            salary_structure_sql = """
            CREATE TABLE IF NOT EXISTS salary_structure (
                id SERIAL PRIMARY KEY,
                empid VARCHAR(20) REFERENCES users(empid),
                user_id INTEGER REFERENCES users(id),
                name VARCHAR(100),
                doj DATE,
                salary_per_annum NUMERIC(18, 2),
                salary_per_month NUMERIC(18, 2),
                basic NUMERIC(18, 2),
                hra NUMERIC(18, 2),
                ca NUMERIC(18, 2),
                ma NUMERIC(18, 2),
                sa NUMERIC(18, 2),
                employee_pf NUMERIC(18, 2),
                employee_esi NUMERIC(18, 2),
                professional_tax NUMERIC(18, 2),
                employer_pf NUMERIC(18, 2),
                employer_esi NUMERIC(18, 2),
                variable_pay NUMERIC(18, 2),
                retension_bonus NUMERIC(18, 2),
                net_salary NUMERIC(18, 2),
                monthly_ctc NUMERIC(18, 2),
                pf_check INTEGER NOT NULL DEFAULT 1,
                esi_check INTEGER NOT NULL DEFAULT 1
            )
            """
            connection.execute(text(salary_structure_sql))
            connection.commit()
            print("✓ SalaryStructure table created")
            
            # Create indexes for SalaryStructure
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_salary_structure_empid ON salary_structure(empid)",
                "CREATE INDEX IF NOT EXISTS idx_salary_structure_user_id ON salary_structure(user_id)"
            ]
            for index_sql in indexes:
                try:
                    connection.execute(text(index_sql))
                    connection.commit()
                except Exception as e:
                    if 'already exists' not in str(e).lower():
                        print(f"Warning creating index: {e}")
            
            print("\nMigration completed successfully!")
            print("✓ All tables and indexes created")
            
    except Exception as e:
        print(f"Error running migration: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    print("Running migration for AttendanceList and SalaryStructure tables...")
    run_migration()


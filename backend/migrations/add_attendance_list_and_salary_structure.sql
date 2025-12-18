-- Migration: Add AttendanceList and SalaryStructure tables
-- Also ensure DOB and DOJ columns exist in users table

-- Add DOB and DOJ columns to users table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'dob'
    ) THEN
        ALTER TABLE users ADD COLUMN dob DATE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'doj'
    ) THEN
        ALTER TABLE users ADD COLUMN doj DATE;
    END IF;
END $$;

-- Create AttendanceList table
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
);

-- Create indexes for AttendanceList
CREATE INDEX IF NOT EXISTS idx_attendance_list_empid ON attendance_list(empid);
CREATE INDEX IF NOT EXISTS idx_attendance_list_user_id ON attendance_list(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_list_year_month ON attendance_list(year, month);

-- Create SalaryStructure table
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
);

-- Create indexes for SalaryStructure
CREATE INDEX IF NOT EXISTS idx_salary_structure_empid ON salary_structure(empid);
CREATE INDEX IF NOT EXISTS idx_salary_structure_user_id ON salary_structure(user_id);


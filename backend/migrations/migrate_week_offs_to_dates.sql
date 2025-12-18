-- Migration: Remove week_offs table and create week_off_dates table
-- WARNING: This will delete all existing week_offs data!

-- Drop the old week_offs table if it exists
DROP TABLE IF EXISTS week_offs CASCADE;

-- Create the new week_off_dates table
CREATE TABLE week_off_dates (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(20) NOT NULL,  -- "0" means All employees
    employee_name VARCHAR(100),  -- "All" if employee_id is "0"
    date DATE NOT NULL,
    weekday VARCHAR(20),  -- sunday, monday, etc.
    month INTEGER,  -- 1-12
    year INTEGER,  -- 2024, 2025, etc.
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX idx_employee_date ON week_off_dates(employee_id, date);
CREATE INDEX idx_month_year ON week_off_dates(month, year);
CREATE INDEX idx_date ON week_off_dates(date);


-- Simple SQL to fix resignations table
-- Copy and paste this into your PostgreSQL database

-- Step 1: Add missing approver columns (run each separately if IF NOT EXISTS doesn't work)
ALTER TABLE resignations ADD COLUMN manager_approved_by VARCHAR(20);
ALTER TABLE resignations ADD COLUMN manager_approved_by_name VARCHAR(100);
ALTER TABLE resignations ADD COLUMN hr_approved_by VARCHAR(20);
ALTER TABLE resignations ADD COLUMN hr_approved_by_name VARCHAR(100);
ALTER TABLE resignations ADD COLUMN hod_approved_by VARCHAR(20);
ALTER TABLE resignations ADD COLUMN hod_approved_by_name VARCHAR(100);

-- Step 2: Convert empid from INTEGER to VARCHAR(20) (if not already done)
ALTER TABLE resignations ALTER COLUMN empid TYPE VARCHAR(20) USING empid::VARCHAR;

-- Step 3: Add foreign key constraints
ALTER TABLE resignations 
ADD CONSTRAINT fk_manager_approved_by 
FOREIGN KEY (manager_approved_by) REFERENCES users(empid);

ALTER TABLE resignations 
ADD CONSTRAINT fk_hr_approved_by 
FOREIGN KEY (hr_approved_by) REFERENCES users(empid);

ALTER TABLE resignations 
ADD CONSTRAINT fk_hod_approved_by 
FOREIGN KEY (hod_approved_by) REFERENCES users(empid);


-- Simple SQL - Add missing approver columns
-- Copy and paste this entire block into your PostgreSQL database

-- Step 1: Add columns (run these one by one if you get errors)
ALTER TABLE resignations ADD COLUMN manager_approved_by VARCHAR(20);
ALTER TABLE resignations ADD COLUMN manager_approved_by_name VARCHAR(100);
ALTER TABLE resignations ADD COLUMN hr_approved_by VARCHAR(20);
ALTER TABLE resignations ADD COLUMN hr_approved_by_name VARCHAR(100);
ALTER TABLE resignations ADD COLUMN hod_approved_by VARCHAR(20);
ALTER TABLE resignations ADD COLUMN hod_approved_by_name VARCHAR(100);

-- Step 2: Add foreign keys (run these one by one if you get errors)
ALTER TABLE resignations 
ADD CONSTRAINT fk_manager_approved_by 
FOREIGN KEY (manager_approved_by) REFERENCES users(empid);

ALTER TABLE resignations 
ADD CONSTRAINT fk_hr_approved_by 
FOREIGN KEY (hr_approved_by) REFERENCES users(empid);

ALTER TABLE resignations 
ADD CONSTRAINT fk_hod_approved_by 
FOREIGN KEY (hod_approved_by) REFERENCES users(empid);


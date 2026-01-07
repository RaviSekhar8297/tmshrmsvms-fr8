-- ============================================
-- ADD MISSING APPROVER COLUMNS TO RESIGNATIONS TABLE
-- ============================================
-- Run this SQL in your PostgreSQL database to fix the 500 error
-- Copy and paste ALL lines below into your database client and execute

-- Step 1: Add the 6 missing approver columns
ALTER TABLE resignations ADD COLUMN manager_approved_by VARCHAR(20);
ALTER TABLE resignations ADD COLUMN manager_approved_by_name VARCHAR(100);
ALTER TABLE resignations ADD COLUMN hr_approved_by VARCHAR(20);
ALTER TABLE resignations ADD COLUMN hr_approved_by_name VARCHAR(100);
ALTER TABLE resignations ADD COLUMN hod_approved_by VARCHAR(20);
ALTER TABLE resignations ADD COLUMN hod_approved_by_name VARCHAR(100);

-- Step 2: Add foreign key constraints (optional, but recommended)
-- If you get "constraint already exists" errors, you can skip these lines
ALTER TABLE resignations 
ADD CONSTRAINT fk_manager_approved_by 
FOREIGN KEY (manager_approved_by) REFERENCES users(empid);

ALTER TABLE resignations 
ADD CONSTRAINT fk_hr_approved_by 
FOREIGN KEY (hr_approved_by) REFERENCES users(empid);

ALTER TABLE resignations 
ADD CONSTRAINT fk_hod_approved_by 
FOREIGN KEY (hod_approved_by) REFERENCES users(empid);

-- ============================================
-- After running this SQL:
-- 1. Restart your FastAPI server
-- 2. Try accessing the resignation page again
-- ============================================


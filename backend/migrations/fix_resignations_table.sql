-- Fix resignations table: Add missing columns and fix empid type
-- Run this SQL in your PostgreSQL database

-- Step 1: Add missing approver columns
ALTER TABLE resignations 
ADD COLUMN IF NOT EXISTS manager_approved_by VARCHAR(20),
ADD COLUMN IF NOT EXISTS manager_approved_by_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS hr_approved_by VARCHAR(20),
ADD COLUMN IF NOT EXISTS hr_approved_by_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS hod_approved_by VARCHAR(20),
ADD COLUMN IF NOT EXISTS hod_approved_by_name VARCHAR(100);

-- Step 2: Fix empid type from INTEGER to VARCHAR(20) if needed
-- First, check if empid is INTEGER and convert it
DO $$
BEGIN
    -- Check if empid is INTEGER type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'resignations' 
        AND column_name = 'empid' 
        AND data_type = 'integer'
    ) THEN
        -- Convert INTEGER to VARCHAR(20)
        ALTER TABLE resignations 
        ALTER COLUMN empid TYPE VARCHAR(20) USING empid::VARCHAR;
    END IF;
END $$;

-- Step 3: Add foreign key constraints for approver columns
DO $$
BEGIN
    -- Manager foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_manager_approved_by' 
        AND table_name = 'resignations'
    ) THEN
        ALTER TABLE resignations 
        ADD CONSTRAINT fk_manager_approved_by 
        FOREIGN KEY (manager_approved_by) REFERENCES users(empid);
    END IF;
    
    -- HR foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_hr_approved_by' 
        AND table_name = 'resignations'
    ) THEN
        ALTER TABLE resignations 
        ADD CONSTRAINT fk_hr_approved_by 
        FOREIGN KEY (hr_approved_by) REFERENCES users(empid);
    END IF;
    
    -- HOD foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_hod_approved_by' 
        AND table_name = 'resignations'
    ) THEN
        ALTER TABLE resignations 
        ADD CONSTRAINT fk_hod_approved_by 
        FOREIGN KEY (hod_approved_by) REFERENCES users(empid);
    END IF;
END $$;


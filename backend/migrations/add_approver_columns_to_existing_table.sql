-- Add approver tracking columns to existing resignations table
-- Run this SQL in your PostgreSQL database

-- Add manager approver columns
ALTER TABLE resignations 
ADD COLUMN IF NOT EXISTS manager_approved_by VARCHAR(20),
ADD COLUMN IF NOT EXISTS manager_approved_by_name VARCHAR(100);

-- Add HR approver columns
ALTER TABLE resignations 
ADD COLUMN IF NOT EXISTS hr_approved_by VARCHAR(20),
ADD COLUMN IF NOT EXISTS hr_approved_by_name VARCHAR(100);

-- Add HOD approver columns
ALTER TABLE resignations 
ADD COLUMN IF NOT EXISTS hod_approved_by VARCHAR(20),
ADD COLUMN IF NOT EXISTS hod_approved_by_name VARCHAR(100);

-- Add foreign key constraints (only if columns were added)
-- Note: These will fail if columns already exist with different constraints
DO $$
BEGIN
    -- Add manager foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_manager_approved_by' 
        AND table_name = 'resignations'
    ) THEN
        ALTER TABLE resignations 
        ADD CONSTRAINT fk_manager_approved_by 
        FOREIGN KEY (manager_approved_by) REFERENCES users(empid);
    END IF;
    
    -- Add HR foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_hr_approved_by' 
        AND table_name = 'resignations'
    ) THEN
        ALTER TABLE resignations 
        ADD CONSTRAINT fk_hr_approved_by 
        FOREIGN KEY (hr_approved_by) REFERENCES users(empid);
    END IF;
    
    -- Add HOD foreign key
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


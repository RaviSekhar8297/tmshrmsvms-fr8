-- Add approver tracking columns to resignations table
-- Run this SQL in your PostgreSQL database

DO $$ 
BEGIN
    -- Add manager approver columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resignations' AND column_name='manager_approved_by') THEN
        ALTER TABLE resignations ADD COLUMN manager_approved_by VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resignations' AND column_name='manager_approved_by_name') THEN
        ALTER TABLE resignations ADD COLUMN manager_approved_by_name VARCHAR(100);
    END IF;
    
    -- Add HR approver columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resignations' AND column_name='hr_approved_by') THEN
        ALTER TABLE resignations ADD COLUMN hr_approved_by VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resignations' AND column_name='hr_approved_by_name') THEN
        ALTER TABLE resignations ADD COLUMN hr_approved_by_name VARCHAR(100);
    END IF;
    
    -- Add HOD approver columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resignations' AND column_name='hod_approved_by') THEN
        ALTER TABLE resignations ADD COLUMN hod_approved_by VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resignations' AND column_name='hod_approved_by_name') THEN
        ALTER TABLE resignations ADD COLUMN hod_approved_by_name VARCHAR(100);
    END IF;
END $$;

-- Add foreign key constraints (drop first if exists to avoid errors)
DO $$
BEGIN
    -- Drop constraints if they exist
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_manager_approved_by' AND table_name='resignations') THEN
        ALTER TABLE resignations DROP CONSTRAINT fk_manager_approved_by;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_hr_approved_by' AND table_name='resignations') THEN
        ALTER TABLE resignations DROP CONSTRAINT fk_hr_approved_by;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_hod_approved_by' AND table_name='resignations') THEN
        ALTER TABLE resignations DROP CONSTRAINT fk_hod_approved_by;
    END IF;
    
    -- Add constraints
    ALTER TABLE resignations 
    ADD CONSTRAINT fk_manager_approved_by FOREIGN KEY (manager_approved_by) REFERENCES users(empid);
    
    ALTER TABLE resignations 
    ADD CONSTRAINT fk_hr_approved_by FOREIGN KEY (hr_approved_by) REFERENCES users(empid);
    
    ALTER TABLE resignations 
    ADD CONSTRAINT fk_hod_approved_by FOREIGN KEY (hod_approved_by) REFERENCES users(empid);
END $$;


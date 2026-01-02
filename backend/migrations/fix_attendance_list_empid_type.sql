-- Fix attendance_list.empid column type to match users.empid (VARCHAR instead of INTEGER)
-- This migration fixes the data type mismatch between tables

-- First, check if the column exists and what type it is
DO $$
BEGIN
    -- Check if empid column exists and is INTEGER type
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'attendance_list' 
        AND column_name = 'empid'
        AND data_type = 'integer'
    ) THEN
        -- Drop foreign key constraint if it exists
        ALTER TABLE attendance_list DROP CONSTRAINT IF EXISTS attendance_list_empid_fkey;
        
        -- Alter column type from INTEGER to VARCHAR(20)
        ALTER TABLE attendance_list 
        ALTER COLUMN empid TYPE VARCHAR(20) USING empid::text;
        
        -- Re-add foreign key constraint
        ALTER TABLE attendance_list 
        ADD CONSTRAINT attendance_list_empid_fkey 
        FOREIGN KEY (empid) REFERENCES users(empid);
        
        RAISE NOTICE 'Successfully converted attendance_list.empid from INTEGER to VARCHAR(20)';
    ELSE
        RAISE NOTICE 'attendance_list.empid is already VARCHAR or does not exist';
    END IF;
END $$;


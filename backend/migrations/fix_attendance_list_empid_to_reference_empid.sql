-- Fix attendance_list.empid to reference users.empid (VARCHAR) instead of users.id (INTEGER)
-- This migration changes the column type and foreign key constraint

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
        -- Drop existing foreign key constraint
        ALTER TABLE attendance_list DROP CONSTRAINT IF EXISTS attendance_list_empid_fkey;
        
        -- Alter column type from INTEGER to VARCHAR(20)
        -- Convert existing integer IDs to text (this will need manual data cleanup if needed)
        ALTER TABLE attendance_list 
        ALTER COLUMN empid TYPE VARCHAR(20) USING 
            CASE 
                WHEN empid IS NULL THEN NULL
                ELSE (SELECT empid FROM users WHERE users.id = attendance_list.empid LIMIT 1)
            END;
        
        -- Re-add foreign key constraint to reference users.empid
        ALTER TABLE attendance_list 
        ADD CONSTRAINT attendance_list_empid_fkey 
        FOREIGN KEY (empid) REFERENCES users(empid);
        
        RAISE NOTICE 'Successfully converted attendance_list.empid from INTEGER to VARCHAR(20) and updated foreign key to reference users.empid';
    ELSE
        RAISE NOTICE 'attendance_list.empid is already VARCHAR or does not exist';
    END IF;
END $$;


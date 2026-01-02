-- Final migration to change attendance_list.empid from INTEGER to VARCHAR(20)
-- This will store users.empid (string) instead of users.id (integer)

-- Step 1: Drop the foreign key constraint (if exists)
ALTER TABLE attendance_list DROP CONSTRAINT IF EXISTS attendance_list_empid_fkey;

-- Step 2: Convert existing integer empid values to corresponding empid strings from users table
-- This updates all existing records to use empid string instead of id integer
UPDATE attendance_list al
SET empid = u.empid
FROM users u
WHERE al.empid::text = u.id::text
AND u.empid IS NOT NULL;

-- Step 3: Alter the column type from INTEGER to VARCHAR(20)
-- This converts the column type and existing data
ALTER TABLE attendance_list 
ALTER COLUMN empid TYPE VARCHAR(20) USING empid::text;

-- Step 4: Re-add foreign key constraint to reference users.empid (VARCHAR)
ALTER TABLE attendance_list 
ADD CONSTRAINT attendance_list_empid_fkey 
FOREIGN KEY (empid) REFERENCES users(empid);

-- Verify the change
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'attendance_list' AND column_name = 'empid';


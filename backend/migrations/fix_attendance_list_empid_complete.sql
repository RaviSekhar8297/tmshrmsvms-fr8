-- Complete migration to fix attendance_list.empid column type
-- Step 1: Drop the foreign key constraint
ALTER TABLE attendance_list DROP CONSTRAINT IF EXISTS attendance_list_empid_fkey;

-- Step 2: Convert existing integer empid values to corresponding empid strings from users table
-- First, update existing records to convert integer IDs to empid strings
UPDATE attendance_list al
SET empid = u.empid
FROM users u
WHERE al.empid::text = u.id::text
AND u.empid IS NOT NULL;

-- Step 3: Alter the column type from INTEGER to VARCHAR(20)
ALTER TABLE attendance_list 
ALTER COLUMN empid TYPE VARCHAR(20) USING empid::text;

-- Step 4: Re-add foreign key constraint to reference users.empid
ALTER TABLE attendance_list 
ADD CONSTRAINT attendance_list_empid_fkey 
FOREIGN KEY (empid) REFERENCES users(empid);


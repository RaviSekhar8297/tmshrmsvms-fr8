-- Add requested_date column to resignations table
-- Run this SQL in your PostgreSQL database

ALTER TABLE resignations
ADD COLUMN IF NOT EXISTS requested_date DATE;

-- Update existing records: set requested_date = last_working_date if last_working_date exists
UPDATE resignations
SET requested_date = last_working_date
WHERE requested_date IS NULL AND last_working_date IS NOT NULL;


-- Add likes column to policies table
ALTER TABLE policies 
ADD COLUMN IF NOT EXISTS likes JSONB DEFAULT '[]'::jsonb;

-- Update existing rows that might have '{}' to '[]'
UPDATE policies 
SET likes = '[]'::jsonb 
WHERE likes = '{}'::jsonb OR likes IS NULL;


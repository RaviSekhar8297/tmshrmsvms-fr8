-- Migration: Add image column to attendance table

-- Add image column to attendance table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendance' AND column_name = 'image'
    ) THEN
        ALTER TABLE attendance ADD COLUMN image TEXT;
    END IF;
END $$;


-- Migration: Add created_at column to task_timers table
-- Run this SQL script directly in your PostgreSQL database

-- Check if column exists and add if not
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='task_timers' AND column_name='created_at'
    ) THEN
        -- Add created_at column with default value
        ALTER TABLE task_timers 
        ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        
        -- Update existing records to have created_at = start_time if start_time exists
        UPDATE task_timers 
        SET created_at = start_time 
        WHERE created_at IS NULL AND start_time IS NOT NULL;
        
        -- For records without start_time, set to current timestamp
        UPDATE task_timers 
        SET created_at = CURRENT_TIMESTAMP 
        WHERE created_at IS NULL;
        
        RAISE NOTICE 'Successfully added created_at column to task_timers table!';
    ELSE
        RAISE NOTICE 'created_at column already exists in task_timers table';
    END IF;
END $$;


-- Add google_calendar_credentials column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_calendar_credentials JSONB;


-- Add JSONB columns for user details
ALTER TABLE users
ADD COLUMN IF NOT EXISTS bank_details JSONB,
ADD COLUMN IF NOT EXISTS family_details JSONB,
ADD COLUMN IF NOT EXISTS nominee_details JSONB,
ADD COLUMN IF NOT EXISTS education_details JSONB,
ADD COLUMN IF NOT EXISTS experience_details JSONB,
ADD COLUMN IF NOT EXISTS documents JSONB;


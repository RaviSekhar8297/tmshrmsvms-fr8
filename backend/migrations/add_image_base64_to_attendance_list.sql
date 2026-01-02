-- Add image_base64 column to attendance_list table
ALTER TABLE attendance_list 
ADD COLUMN IF NOT EXISTS image_base64 TEXT;


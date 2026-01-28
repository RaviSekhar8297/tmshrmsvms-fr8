-- Migration: Add punch_description column to punch_logs table

ALTER TABLE punch_logs 
ADD COLUMN IF NOT EXISTS punch_description TEXT;

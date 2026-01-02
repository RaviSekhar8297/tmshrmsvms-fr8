-- Migration: Add location column to punch_logs table

ALTER TABLE punch_logs 
ADD COLUMN IF NOT EXISTS location TEXT;


-- Simple migration: Add notification settings columns to attendance_cycle table
-- Run this SQL directly in your PostgreSQL database

-- Add birthdays_send_day column
ALTER TABLE attendance_cycle ADD COLUMN IF NOT EXISTS birthdays_send_day VARCHAR(20);

-- Add birthdays_send_time column
ALTER TABLE attendance_cycle ADD COLUMN IF NOT EXISTS birthdays_send_time TIME;

-- Add anniversaries_send_day column
ALTER TABLE attendance_cycle ADD COLUMN IF NOT EXISTS anniversaries_send_day VARCHAR(20);

-- Add anniversaries_send_time column
ALTER TABLE attendance_cycle ADD COLUMN IF NOT EXISTS anniversaries_send_time TIME;

-- Add weekly_attendance_send_day column
ALTER TABLE attendance_cycle ADD COLUMN IF NOT EXISTS weekly_attendance_send_day VARCHAR(20);

-- Add weekly_attendance_send_time column
ALTER TABLE attendance_cycle ADD COLUMN IF NOT EXISTS weekly_attendance_send_time TIME;


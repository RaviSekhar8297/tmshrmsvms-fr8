-- Migration: Add notification settings columns to attendance_cycle table
-- Adds birthdays_send, anniversaries_send, weekly_attendance_send as JSONB columns
-- Each JSONB contains: {day: "Sunday|Monday|...|Everyday|None", time: "HH:MM"}
-- Run this SQL directly in your PostgreSQL database

-- Add birthdays_send JSONB column
ALTER TABLE attendance_cycle ADD COLUMN IF NOT EXISTS birthdays_send JSONB;

-- Add anniversaries_send JSONB column
ALTER TABLE attendance_cycle ADD COLUMN IF NOT EXISTS anniversaries_send JSONB;

-- Add weekly_attendance_send JSONB column
ALTER TABLE attendance_cycle ADD COLUMN IF NOT EXISTS weekly_attendance_send JSONB;


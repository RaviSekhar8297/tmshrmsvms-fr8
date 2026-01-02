-- Create attendance_cycle table
CREATE TABLE IF NOT EXISTS attendance_cycle (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    
    -- Shift timings
    shift_start_time TIME NOT NULL,
    shift_end_time   TIME NOT NULL,
    late_log_time    TIME NOT NULL,
    
    -- Durations (HH:MM)
    full_day_duration TIME NOT NULL,
    half_day_duration TIME NOT NULL,
    
    -- Attendance cycle days (1–31)
    attendance_cycle_start_date SMALLINT NOT NULL
        CHECK (attendance_cycle_start_date BETWEEN 1 AND 31),
    
    attendance_cycle_end_date SMALLINT NOT NULL
        CHECK (attendance_cycle_end_date BETWEEN 1 AND 31),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_cycle_id ON attendance_cycle(id);


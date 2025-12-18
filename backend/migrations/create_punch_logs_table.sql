-- Migration: Create punch_logs table

CREATE TABLE IF NOT EXISTS punch_logs (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(20) REFERENCES users(empid),
    employee_name VARCHAR(100),
    date DATE NOT NULL,
    punch_type VARCHAR(10) NOT NULL,
    punch_time TIMESTAMP NOT NULL,
    image TEXT,
    status VARCHAR(20) DEFAULT 'present',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_punch_log_employee_date ON punch_logs(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_punch_log_date ON punch_logs(date);
CREATE INDEX IF NOT EXISTS idx_punch_log_employee ON punch_logs(employee_id);


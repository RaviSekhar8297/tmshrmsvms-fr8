-- Performance Optimization Indexes
-- Run this migration to add indexes for better query performance

-- User table indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_report_to_id ON users(report_to_id);

-- Meeting table indexes
CREATE INDEX IF NOT EXISTS idx_meeting_datetime ON meetings(meeting_datetime);
CREATE INDEX IF NOT EXISTS idx_meeting_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meeting_created_by ON meetings(created_by);

-- Issue table indexes
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_raised_by ON issues(raised_by);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);

-- Leave table indexes
CREATE INDEX IF NOT EXISTS idx_leaves_empid ON leaves(empid);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);
CREATE INDEX IF NOT EXISTS idx_leaves_applied_date ON leaves(applied_date);
CREATE INDEX IF NOT EXISTS idx_leaves_report_to ON leaves(report_to);

-- Permission table indexes
CREATE INDEX IF NOT EXISTS idx_permissions_empid ON permissions(empid);
CREATE INDEX IF NOT EXISTS idx_permissions_status ON permissions(status);
CREATE INDEX IF NOT EXISTS idx_permissions_applied_date ON permissions(applied_date);

-- Request table indexes
CREATE INDEX IF NOT EXISTS idx_requests_empid ON requests(empid);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_applied_date ON requests(applied_date);

-- WeekOffDate table indexes
CREATE INDEX IF NOT EXISTS idx_weekoff_year ON week_off_dates(year);
CREATE INDEX IF NOT EXISTS idx_weekoff_month ON week_off_dates(month);

-- Task table indexes (already exist but ensure they're there)
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_id ON tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by_id ON tasks(assigned_by_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

-- Attendance table indexes (ensure they exist)
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

-- PunchLog table indexes (ensure they exist)
CREATE INDEX IF NOT EXISTS idx_punch_log_status ON punch_logs(status);
CREATE INDEX IF NOT EXISTS idx_punch_log_punch_time ON punch_logs(punch_time);

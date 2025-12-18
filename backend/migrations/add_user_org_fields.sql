-- Add organization and designation fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS designation VARCHAR(150),
ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES company(id),
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branch(id),
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES department(id),
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS branch_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS department_name VARCHAR(255);


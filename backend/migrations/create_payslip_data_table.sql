-- Create payslip_data table
CREATE TABLE IF NOT EXISTS payslip_data (
    payslip_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(100),
    emp_id INTEGER,
    doj DATE,
    company_name VARCHAR(50),
    company_id INTEGER,
    branch_name VARCHAR(50),
    branch_id INTEGER,
    department_name VARCHAR(50),
    dept_id INTEGER,
    designation VARCHAR(50),
    bank_name VARCHAR(50),
    bank_acc_no VARCHAR(50),
    ifsc_code VARCHAR(50),
    pan_no VARCHAR(50),
    salary_per_annum NUMERIC(18,2),
    salary_per_month NUMERIC(18,2),
    salary_per_day NUMERIC(18,2),
    earnings JSONB, -- GrossSalary, Basic, HRA, CA, MA
    deductions JSONB, -- PF, ESI, LateLogins, TDS, LateLogDeduction, PT
    net_salary NUMERIC(18,2),
    month INTEGER,
    year INTEGER,
    total_days INTEGER,
    working_days NUMERIC(18,2),
    present NUMERIC(18,2),
    absent NUMERIC(18,2),
    half_days NUMERIC(18,2),
    holidays NUMERIC(18,2),
    wo NUMERIC(18,2),
    leaves NUMERIC(18,2),
    payable_days NUMERIC(18,2),
    retention_bonus NUMERIC(18,2),
    variable_pay NUMERIC(18,2),
    lop_deduction NUMERIC(18,2),
    arrear_salary NUMERIC(18,2),
    advance_salary NUMERIC(18,2),
    loan_amount NUMERIC(18,2),
    clear_amount NUMERIC(18,2),
    pay_amount NUMERIC(18,2),
    pf_no VARCHAR(50),
    esi_no VARCHAR(50),
    earned_gross NUMERIC(18,2),
    other_deduction NUMERIC(18,2) DEFAULT 0,
    freaze_status BOOLEAN NOT NULL DEFAULT FALSE,
    created_date DATE DEFAULT CURRENT_DATE,
    created_by VARCHAR(50),
    updated_date DATE,
    updated_by VARCHAR(50)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payslip_month_year ON payslip_data(month, year);
CREATE INDEX IF NOT EXISTS idx_payslip_emp_id ON payslip_data(emp_id);
CREATE INDEX IF NOT EXISTS idx_payslip_freaze_status ON payslip_data(freaze_status);


import psycopg

conn = psycopg.connect("postgresql://postgres:Ravi%408297@localhost:5432/tms_db")
cur = conn.cursor()

# Ensure column exists
cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS report_to_id VARCHAR(20);")

# Optional FK (drop if exists then recreate)
cur.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_report_to_empid;")
cur.execute("ALTER TABLE users ADD CONSTRAINT fk_users_report_to_empid FOREIGN KEY (report_to_id) REFERENCES users(empid);")

# Seed managers (idempotent)
cur.execute(
    """
    INSERT INTO users (empid, name, email, phone, username, password, role, report_to_id)
    VALUES
      ('123', 'MADHU', 'kuppanimadhu@yahoo.in', '9849019800', '123',
       '$2b$12$ZnktYyGot8H8eb5Qtk3mMe34rVMbGCHHzzVDf0YMOzHhvnvwu51VK',
       'Manager', '101'),
      ('144', 'MURALI KRISHNA', 'muralis2121@gmail.com', '9989992229', '144',
       '$2b$12$ZnktYyGot8H8eb5Qtk3mMe34rVMbGCHHzzVDf0YMOzHhvnvwu51VK',
       'Manager', '101')
    ON CONFLICT (empid) DO NOTHING;
    """
)

conn.commit()
print("db updated")



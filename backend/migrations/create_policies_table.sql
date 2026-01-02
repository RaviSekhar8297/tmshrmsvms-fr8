-- Create policies table
CREATE TABLE IF NOT EXISTS policies (
    id SERIAL PRIMARY KEY,
    policy JSONB NOT NULL,  -- {name: string, type: string, pages: integer}
    readby JSONB DEFAULT '[]'::jsonb,  -- [{empid: string, name: string, status: "viewed"}]
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on policy name for faster searches
CREATE INDEX IF NOT EXISTS idx_policies_policy_name ON policies USING GIN ((policy->>'name'));

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_policies_created_at ON policies(created_at);


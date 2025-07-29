-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create submissions table (only if not exists)
CREATE TABLE IF NOT EXISTS submissions (
    submission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(320) NOT NULL,
    phone VARCHAR(20),
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance (only if not exists)
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email);
CREATE INDEX IF NOT EXISTS idx_submissions_phone ON submissions(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_name ON submissions USING gin(to_tsvector('russian', name));
CREATE INDEX IF NOT EXISTS idx_submissions_message ON submissions USING gin(to_tsvector('russian', message));

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_submissions_email_created_at ON submissions(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_status_created_at ON submissions(status, created_at DESC);

-- Add constraints (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_email_format'
    ) THEN
        ALTER TABLE submissions ADD CONSTRAINT check_email_format 
            CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_name_length'
    ) THEN
        ALTER TABLE submissions ADD CONSTRAINT check_name_length 
            CHECK (length(trim(name)) >= 1);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_message_length'
    ) THEN
        ALTER TABLE submissions ADD CONSTRAINT check_message_length 
            CHECK (length(trim(message)) >= 1);
    END IF;
END;
$$;
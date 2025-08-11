-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create admin table first (referenced by other tables)
CREATE TABLE IF NOT EXISTS admin (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index on username for admin table
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_username_unique ON admin(username);
CREATE INDEX IF NOT EXISTS idx_admin_created_at ON admin(created_at DESC);

-- Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
    submission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(320) NOT NULL,
    phone VARCHAR(20),
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    admin_id UUID REFERENCES admin(id) ON DELETE SET NULL,
    price BIGINT NOT NULL DEFAULT 0
);

-- Add constraints for submissions (only if not exists)
DO $$
BEGIN
    -- Email format validation
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_email_format'
    ) THEN
        ALTER TABLE submissions ADD CONSTRAINT check_email_format 
            CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
    END IF;
    
    -- Name validation
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_name_length'
    ) THEN
        ALTER TABLE submissions ADD CONSTRAINT check_name_length 
            CHECK (length(trim(name)) >= 1);
    END IF;
    
    -- Message validation
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_message_length'
    ) THEN
        ALTER TABLE submissions ADD CONSTRAINT check_message_length 
            CHECK (length(trim(message)) >= 1);
    END IF;
    
    -- Price validation
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_submissions_price_nonnegative'
    ) THEN
        ALTER TABLE submissions
            ADD CONSTRAINT check_submissions_price_nonnegative
            CHECK (price >= 0);
    END IF;
    
    -- Status validation
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_status_valid'
    ) THEN
        ALTER TABLE submissions
            ADD CONSTRAINT check_status_valid
            CHECK (status IN ('new', 'in_progress', 'completed', 'cancelled', 'rejected'));
    END IF;
END;
$$;

-- Create indexes for submissions
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email);
CREATE INDEX IF NOT EXISTS idx_submissions_phone ON submissions(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_admin_id ON submissions(admin_id) WHERE admin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_name ON submissions USING gin(to_tsvector('russian', name));
CREATE INDEX IF NOT EXISTS idx_submissions_message ON submissions USING gin(to_tsvector('russian', message));
CREATE INDEX IF NOT EXISTS idx_submissions_email_created_at ON submissions(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_status_created_at ON submissions(status, created_at DESC);

-- Create admin_panel_log table
CREATE TABLE IF NOT EXISTS admin_panel_log (
    admin_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255),
    ip INET,
    user_agent TEXT,
    action VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for admin_panel_log
CREATE INDEX IF NOT EXISTS idx_admin_panel_log_ip ON admin_panel_log(ip);
CREATE INDEX IF NOT EXISTS idx_admin_panel_log_created_at ON admin_panel_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_panel_log_username ON admin_panel_log(username);
CREATE INDEX IF NOT EXISTS idx_admin_panel_log_action ON admin_panel_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_panel_log_metadata_gin ON admin_panel_log USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_admin_panel_log_username_created_at ON admin_panel_log(username, created_at DESC);

-- Create admin_comments table
CREATE TABLE IF NOT EXISTS admin_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add constraints for admin_comments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_admin_comment_length'
    ) THEN
        ALTER TABLE admin_comments
            ADD CONSTRAINT check_admin_comment_length
            CHECK (length(trim(comment)) >= 1);
    END IF;
END;
$$;

-- Create indexes for admin_comments
CREATE INDEX IF NOT EXISTS idx_admin_comments_admin_id ON admin_comments(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_comments_submission_id ON admin_comments(submission_id);
CREATE INDEX IF NOT EXISTS idx_admin_comments_created_at ON admin_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_comments_submission_created ON admin_comments(submission_id, created_at DESC);
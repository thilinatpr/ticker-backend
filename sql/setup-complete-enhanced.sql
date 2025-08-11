-- Complete Enhanced Database Setup for Dividend Tracking System
-- Run this entire script in your Supabase SQL Editor

-- Drop existing tables if they exist to start fresh
DROP TABLE IF EXISTS api_call_logs CASCADE;
DROP TABLE IF EXISTS job_queue CASCADE;
DROP TABLE IF EXISTS rate_limits CASCADE;
DROP TABLE IF EXISTS api_jobs CASCADE;
DROP TABLE IF EXISTS tickers CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS increment_rate_limit_counters(TEXT);

-- 1. CREATE TABLES
-- =================

-- Tickers tracking table
CREATE TABLE tickers (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_dividend_update TIMESTAMP WITH TIME ZONE,
    last_polygon_call TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    update_frequency_hours INTEGER DEFAULT 24,
    
    CONSTRAINT valid_symbol CHECK (LENGTH(symbol) >= 1 AND LENGTH(symbol) <= 10)
);

-- API jobs tracking table
CREATE TABLE api_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    ticker_symbols TEXT[],
    total_tickers INTEGER DEFAULT 0,
    processed_tickers INTEGER DEFAULT 0,
    failed_tickers INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_completion TIMESTAMP WITH TIME ZONE,
    priority INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    CONSTRAINT valid_job_type CHECK (job_type IN ('dividend_update', 'ticker_sync', 'data_cleanup'))
);

-- Job processing queue
CREATE TABLE job_queue (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES api_jobs(id) ON DELETE CASCADE,
    ticker_symbol VARCHAR(10) NOT NULL,
    priority INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_retry_count CHECK (retry_count >= 0 AND retry_count <= max_retries)
);

-- Rate limiting tracking
CREATE TABLE rate_limits (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL UNIQUE,
    last_call_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    calls_this_minute INTEGER DEFAULT 0,
    calls_this_hour INTEGER DEFAULT 0,
    calls_today INTEGER DEFAULT 0,
    reset_minute TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reset_hour TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reset_day TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API call logs for monitoring
CREATE TABLE api_call_logs (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL,
    endpoint VARCHAR(200) NOT NULL,
    ticker_symbol VARCHAR(10),
    response_status INTEGER,
    response_time_ms INTEGER,
    rate_limit_remaining INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Add new columns to existing dividends table if they don't exist
DO $$ 
BEGIN
    -- Add polygon_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'dividends' AND column_name = 'polygon_id') THEN
        ALTER TABLE dividends ADD COLUMN polygon_id VARCHAR(50);
    END IF;
    
    -- Add data_source column if it doesn't exist  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'dividends' AND column_name = 'data_source') THEN
        ALTER TABLE dividends ADD COLUMN data_source VARCHAR(20) DEFAULT 'polygon';
    END IF;
    
    -- Add cash_amount_usd for consistent currency handling
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'dividends' AND column_name = 'cash_amount_usd') THEN
        ALTER TABLE dividends ADD COLUMN cash_amount_usd DECIMAL(10,6);
    END IF;
END $$;

-- 2. CREATE INDEXES
-- ==================

-- Indexes for performance
CREATE INDEX idx_tickers_symbol ON tickers(symbol);
CREATE INDEX idx_tickers_active ON tickers(is_active) WHERE is_active = true;
CREATE INDEX idx_tickers_last_update ON tickers(last_dividend_update);

CREATE INDEX idx_api_jobs_status ON api_jobs(status);
CREATE INDEX idx_api_jobs_type_status ON api_jobs(job_type, status);
CREATE INDEX idx_api_jobs_created ON api_jobs(created_at);

CREATE INDEX idx_job_queue_scheduled ON job_queue(scheduled_at);
CREATE INDEX idx_job_queue_locked ON job_queue(locked_at) WHERE locked_at IS NOT NULL;
CREATE INDEX idx_job_queue_priority ON job_queue(priority DESC, scheduled_at ASC);

CREATE INDEX idx_rate_limits_service ON rate_limits(service_name);
CREATE INDEX idx_api_call_logs_service_created ON api_call_logs(service_name, created_at);
CREATE INDEX idx_api_call_logs_ticker ON api_call_logs(ticker_symbol);

-- 3. SETUP ROW LEVEL SECURITY
-- =============================

-- Enable RLS on new tables
ALTER TABLE tickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_call_logs ENABLE ROW LEVEL SECURITY;

-- Create policies that allow all operations (since this is a backend service)
-- In production, you might want to restrict these based on roles

-- Policies for tickers
CREATE POLICY "Allow all access to tickers" ON tickers FOR ALL USING (true);

-- Policies for api_jobs
CREATE POLICY "Allow all access to api_jobs" ON api_jobs FOR ALL USING (true);

-- Policies for job_queue  
CREATE POLICY "Allow all access to job_queue" ON job_queue FOR ALL USING (true);

-- Policies for rate_limits
CREATE POLICY "Allow all access to rate_limits" ON rate_limits FOR ALL USING (true);

-- Policies for api_call_logs
CREATE POLICY "Allow all access to api_call_logs" ON api_call_logs FOR ALL USING (true);

-- 4. CREATE HELPER FUNCTIONS
-- ============================

-- Function to safely increment rate limit counters
CREATE OR REPLACE FUNCTION increment_rate_limit_counters(service_name TEXT)
RETURNS VOID AS $$
DECLARE
    current_minute TIMESTAMP WITH TIME ZONE;
    current_hour TIMESTAMP WITH TIME ZONE;
    current_day TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate current time boundaries
    current_minute := DATE_TRUNC('minute', NOW());
    current_hour := DATE_TRUNC('hour', NOW());
    current_day := DATE_TRUNC('day', NOW());
    
    -- Update the rate limit record
    UPDATE rate_limits 
    SET 
        calls_this_minute = CASE 
            WHEN reset_minute < current_minute THEN 1 
            ELSE calls_this_minute + 1 
        END,
        calls_this_hour = CASE 
            WHEN reset_hour < current_hour THEN 1 
            ELSE calls_this_hour + 1 
        END,
        calls_today = CASE 
            WHEN reset_day < current_day THEN 1 
            ELSE calls_today + 1 
        END,
        reset_minute = CASE 
            WHEN reset_minute < current_minute THEN current_minute 
            ELSE reset_minute 
        END,
        reset_hour = CASE 
            WHEN reset_hour < current_hour THEN current_hour 
            ELSE reset_hour 
        END,
        reset_day = CASE 
            WHEN reset_day < current_day THEN current_day 
            ELSE reset_day 
        END,
        last_call_time = NOW()
    WHERE rate_limits.service_name = increment_rate_limit_counters.service_name;
    
    -- If no record exists, create one
    IF NOT FOUND THEN
        INSERT INTO rate_limits (
            service_name, 
            calls_this_minute, 
            calls_this_hour, 
            calls_today,
            reset_minute,
            reset_hour,
            reset_day,
            last_call_time
        ) VALUES (
            increment_rate_limit_counters.service_name, 
            1, 
            1, 
            1,
            current_minute,
            current_hour,
            current_day,
            NOW()
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. INITIALIZE DATA
-- ===================

-- Initialize rate limits for Polygon API
INSERT INTO rate_limits (service_name, calls_this_minute, calls_this_hour, calls_today) 
VALUES ('polygon', 0, 0, 0)
ON CONFLICT (service_name) DO NOTHING;

-- Sample ticker data for testing
INSERT INTO tickers (symbol, is_active) VALUES 
('AAPL', true),
('MSFT', true),
('GOOGL', true),
('TSLA', true),
('NVDA', true)
ON CONFLICT (symbol) DO NOTHING;

-- 6. VERIFICATION QUERIES
-- =========================

-- Check that everything was created successfully
SELECT 'Tables created' as status, count(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tickers', 'api_jobs', 'job_queue', 'rate_limits', 'api_call_logs');

SELECT 'Indexes created' as status, count(*) as index_count 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';

SELECT 'Functions created' as status, count(*) as function_count 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'increment_rate_limit_counters';

SELECT 'Sample data inserted' as status, 
       (SELECT count(*) FROM tickers) as ticker_count,
       (SELECT count(*) FROM rate_limits) as rate_limit_count;

-- Success message
SELECT '🎉 Enhanced database setup completed successfully!' as message,
       'Run npm run test:core to test the system' as next_step;
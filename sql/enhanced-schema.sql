-- Enhanced database schema for comprehensive dividend tracking system
-- This extends the existing schema with ticker tracking and job processing capabilities

-- Tickers tracking table
CREATE TABLE IF NOT EXISTS tickers (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_dividend_update TIMESTAMP WITH TIME ZONE,
    last_polygon_call TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    update_frequency_hours INTEGER DEFAULT 24, -- How often to update dividend data
    
    CONSTRAINT valid_symbol CHECK (LENGTH(symbol) >= 1 AND LENGTH(symbol) <= 10)
);

-- Enhanced dividends table (extends existing schema)
-- Note: This assumes the existing dividends table will be kept
-- Add new columns to existing dividends table
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

-- API jobs tracking table for background processing
CREATE TABLE IF NOT EXISTS api_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
    ticker_symbols TEXT[], -- array of ticker symbols to process
    total_tickers INTEGER DEFAULT 0,
    processed_tickers INTEGER DEFAULT 0,
    failed_tickers INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_completion TIMESTAMP WITH TIME ZONE,
    priority INTEGER DEFAULT 0, -- Higher numbers = higher priority
    metadata JSONB DEFAULT '{}', -- Store job-specific data
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    CONSTRAINT valid_job_type CHECK (job_type IN ('dividend_update', 'ticker_sync', 'data_cleanup'))
);

-- Rate limiting tracking table
CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL, -- e.g., 'polygon', 'alpha_vantage'
    last_call_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    calls_this_minute INTEGER DEFAULT 0,
    calls_this_hour INTEGER DEFAULT 0,
    calls_today INTEGER DEFAULT 0,
    reset_minute TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reset_hour TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reset_day TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(service_name)
);

-- Job processing queue table (alternative to Redis for simple deployments)
CREATE TABLE IF NOT EXISTS job_queue (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES api_jobs(id) ON DELETE CASCADE,
    ticker_symbol VARCHAR(10) NOT NULL,
    priority INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by VARCHAR(100), -- Instance/worker ID
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_retry_count CHECK (retry_count >= 0 AND retry_count <= max_retries)
);

-- API call logs for monitoring and debugging
CREATE TABLE IF NOT EXISTS api_call_logs (
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickers_symbol ON tickers(symbol);
CREATE INDEX IF NOT EXISTS idx_tickers_active ON tickers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tickers_last_update ON tickers(last_dividend_update);

CREATE INDEX IF NOT EXISTS idx_api_jobs_status ON api_jobs(status);
CREATE INDEX IF NOT EXISTS idx_api_jobs_type_status ON api_jobs(job_type, status);
CREATE INDEX IF NOT EXISTS idx_api_jobs_created ON api_jobs(created_at);

CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled ON job_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_job_queue_locked ON job_queue(locked_at) WHERE locked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_queue_priority ON job_queue(priority DESC, scheduled_at ASC);

CREATE INDEX IF NOT EXISTS idx_rate_limits_service ON rate_limits(service_name);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_service_created ON api_call_logs(service_name, created_at);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_ticker ON api_call_logs(ticker_symbol);

-- Enable RLS on new tables
ALTER TABLE tickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_call_logs ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated access
CREATE POLICY "Allow read access to tickers" ON tickers
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow write access to tickers" ON tickers
    FOR ALL TO authenticated
    USING (true);

CREATE POLICY "Allow read access to api_jobs" ON api_jobs
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow write access to api_jobs" ON api_jobs
    FOR ALL TO authenticated
    USING (true);

CREATE POLICY "Allow read access to rate_limits" ON rate_limits
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow write access to rate_limits" ON rate_limits
    FOR ALL TO authenticated
    USING (true);

CREATE POLICY "Allow read access to job_queue" ON job_queue
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow write access to job_queue" ON job_queue
    FOR ALL TO authenticated
    USING (true);

CREATE POLICY "Allow read access to api_call_logs" ON api_call_logs
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow write access to api_call_logs" ON api_call_logs
    FOR ALL TO authenticated
    USING (true);

-- Initialize rate limits for Polygon API (5 calls per minute)
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
$$ LANGUAGE plpgsql;
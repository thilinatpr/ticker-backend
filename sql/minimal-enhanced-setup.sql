-- Minimal enhanced schema for job processing
-- Tables needed for background job processing

-- Tickers tracking table (simplified)
CREATE TABLE IF NOT EXISTS tickers (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_dividend_update TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- API jobs tracking table
CREATE TABLE IF NOT EXISTS api_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) DEFAULT 'dividend_update',
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
    metadata JSONB DEFAULT '{}'
);

-- Job processing queue table
CREATE TABLE IF NOT EXISTS job_queue (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limiting tracking table (simplified)
CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(50) UNIQUE NOT NULL,
    calls_this_minute INTEGER DEFAULT 0,
    calls_this_hour INTEGER DEFAULT 0,
    calls_today INTEGER DEFAULT 0,
    reset_minute TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reset_hour TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reset_day TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_call_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Basic indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickers_symbol ON tickers(symbol);
CREATE INDEX IF NOT EXISTS idx_api_jobs_status ON api_jobs(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled ON job_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_service ON rate_limits(service_name);

-- Initialize rate limits for Polygon API
INSERT INTO rate_limits (service_name, calls_this_minute, calls_this_hour, calls_today) 
VALUES ('polygon', 0, 0, 0)
ON CONFLICT (service_name) DO NOTHING;

-- Sample ticker data
INSERT INTO tickers (symbol, is_active) VALUES 
('AAPL', true),
('MSFT', true),
('GOOGL', true)
ON CONFLICT (symbol) DO NOTHING;
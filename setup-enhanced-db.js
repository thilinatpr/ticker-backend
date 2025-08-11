/**
 * Setup script for enhanced database schema
 * This handles RLS policies for service operations
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabase } from './lib/supabase.js';

console.log('🗄️ Setting up Enhanced Database Schema');
console.log('======================================');

/**
 * Execute SQL commands with error handling
 */
async function executeSQL(description, sql) {
  console.log(`\n📝 ${description}...`);
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.log(`❌ Failed: ${error.message}`);
      return false;
    }
    
    console.log('✅ Success');
    return true;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Create enhanced tables and functions
 */
async function createEnhancedSchema() {
  const schemaSQL = `
-- Tickers tracking table
CREATE TABLE IF NOT EXISTS tickers (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_dividend_update TIMESTAMP WITH TIME ZONE,
    last_polygon_call TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    update_frequency_hours INTEGER DEFAULT 24
);

-- API jobs tracking table
CREATE TABLE IF NOT EXISTS api_jobs (
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
    metadata JSONB DEFAULT '{}'
);

-- Job processing queue
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

-- Rate limiting tracking
CREATE TABLE IF NOT EXISTS rate_limits (
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

-- API call logs
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
`;

  return await executeSQL('Creating enhanced schema tables', schemaSQL);
}

/**
 * Create indexes for performance
 */
async function createIndexes() {
  const indexSQL = `
-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tickers_symbol ON tickers(symbol);
CREATE INDEX IF NOT EXISTS idx_tickers_active ON tickers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_jobs_status ON api_jobs(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled ON job_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_service ON rate_limits(service_name);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_service_created ON api_call_logs(service_name, created_at);
`;

  return await executeSQL('Creating performance indexes', indexSQL);
}

/**
 * Set up RLS policies that work with service operations
 */
async function setupRLSPolicies() {
  const policySQL = `
-- Enable RLS on tables
ALTER TABLE tickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_call_logs ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for service operations
-- These allow both authenticated users and service role operations

DROP POLICY IF EXISTS "Allow all access to tickers" ON tickers;
CREATE POLICY "Allow all access to tickers" ON tickers FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to api_jobs" ON api_jobs;
CREATE POLICY "Allow all access to api_jobs" ON api_jobs FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to job_queue" ON job_queue;
CREATE POLICY "Allow all access to job_queue" ON job_queue FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to rate_limits" ON rate_limits;
CREATE POLICY "Allow all access to rate_limits" ON rate_limits FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to api_call_logs" ON api_call_logs;
CREATE POLICY "Allow all access to api_call_logs" ON api_call_logs FOR ALL USING (true);
`;

  return await executeSQL('Setting up RLS policies', policySQL);
}

/**
 * Create helper functions
 */
async function createFunctions() {
  const functionSQL = `
-- Function to safely increment rate limit counters
CREATE OR REPLACE FUNCTION increment_rate_limit_counters(service_name TEXT)
RETURNS VOID AS $$
DECLARE
    current_minute TIMESTAMP WITH TIME ZONE;
    current_hour TIMESTAMP WITH TIME ZONE;
    current_day TIMESTAMP WITH TIME ZONE;
BEGIN
    current_minute := DATE_TRUNC('minute', NOW());
    current_hour := DATE_TRUNC('hour', NOW());
    current_day := DATE_TRUNC('day', NOW());
    
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
    
    IF NOT FOUND THEN
        INSERT INTO rate_limits (
            service_name, calls_this_minute, calls_this_hour, calls_today,
            reset_minute, reset_hour, reset_day, last_call_time
        ) VALUES (
            increment_rate_limit_counters.service_name, 1, 1, 1,
            current_minute, current_hour, current_day, NOW()
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to execute SQL (for setup scripts)
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS TEXT AS $$
BEGIN
    EXECUTE sql_query;
    RETURN 'OK';
EXCEPTION
    WHEN OTHERS THEN
        RETURN SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

  return await executeSQL('Creating helper functions', functionSQL);
}

/**
 * Initialize default data
 */
async function initializeData() {
  const initSQL = `
-- Initialize rate limits for Polygon API
INSERT INTO rate_limits (service_name, calls_this_minute, calls_this_hour, calls_today) 
VALUES ('polygon', 0, 0, 0)
ON CONFLICT (service_name) DO NOTHING;

-- Add sample tickers for testing
INSERT INTO tickers (symbol, is_active) VALUES 
('AAPL', true),
('MSFT', true),
('GOOGL', true)
ON CONFLICT (symbol) DO NOTHING;
`;

  return await executeSQL('Initializing default data', initSQL);
}

/**
 * Main setup function
 */
async function setupDatabase() {
  console.log('🚀 Starting database setup...\n');
  
  const results = {
    functions: await createFunctions(),
    schema: await createEnhancedSchema(),
    indexes: await createIndexes(),
    policies: await setupRLSPolicies(),
    data: await initializeData()
  };
  
  console.log('\n📊 Setup Results:');
  console.log('==================');
  console.log(`Helper Functions: ${results.functions ? '✅' : '❌'}`);
  console.log(`Enhanced Schema: ${results.schema ? '✅' : '❌'}`);
  console.log(`Performance Indexes: ${results.indexes ? '✅' : '❌'}`);
  console.log(`RLS Policies: ${results.policies ? '✅' : '❌'}`);
  console.log(`Default Data: ${results.data ? '✅' : '❌'}`);
  
  const allSuccess = Object.values(results).every(r => r === true);
  
  if (allSuccess) {
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Test core functions: npm run test:core');
    console.log('   2. Set POLYGON_API_KEY in environment');
    console.log('   3. Deploy to Vercel');
  } else {
    console.log('\n⚠️ Some setup steps failed. Please check the errors above.');
    console.log('\n💡 You may need to run this script with elevated database permissions.');
  }
}

// Run setup
setupDatabase().catch(error => {
  console.error('❌ Database setup failed:', error);
  process.exit(1);
});
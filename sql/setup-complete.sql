-- Complete Supabase setup for ticker-backend
-- Run this entire script in your Supabase SQL Editor

-- Step 1: Create the dividends table
CREATE TABLE IF NOT EXISTS dividends (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    declaration_date DATE NOT NULL,
    record_date DATE,
    ex_dividend_date DATE NOT NULL,
    pay_date DATE,
    amount DECIMAL(10,6) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    frequency INTEGER DEFAULT 4,
    type VARCHAR(20) DEFAULT 'Cash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure no duplicate dividends for same ticker and ex-dividend date
    UNIQUE(ticker, ex_dividend_date)
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dividends_ticker ON dividends(ticker);
CREATE INDEX IF NOT EXISTS idx_dividends_ex_date ON dividends(ex_dividend_date);
CREATE INDEX IF NOT EXISTS idx_dividends_ticker_date ON dividends(ticker, ex_dividend_date);

-- Step 3: Enable Row Level Security
ALTER TABLE dividends ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies
-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Allow read access to dividends" ON dividends;
DROP POLICY IF EXISTS "Allow anonymous read access to dividends" ON dividends;
DROP POLICY IF EXISTS "Allow write access to dividends" ON dividends;
DROP POLICY IF EXISTS "Allow anonymous write access to dividends" ON dividends;

-- Policy to allow read access for authenticated users
CREATE POLICY "Allow read access to dividends" ON dividends
    FOR SELECT TO authenticated
    USING (true);

-- Policy to allow anonymous read access (for API key authentication)
CREATE POLICY "Allow anonymous read access to dividends" ON dividends
    FOR SELECT TO anon
    USING (true);

-- Policy to allow write access for authenticated users
CREATE POLICY "Allow write access to dividends" ON dividends
    FOR ALL TO authenticated
    USING (true);

-- Policy to allow anonymous write access (for API key authentication)
CREATE POLICY "Allow anonymous write access to dividends" ON dividends
    FOR ALL TO anon
    USING (true);

-- Step 5: Insert sample data
INSERT INTO dividends (ticker, declaration_date, record_date, ex_dividend_date, pay_date, amount, currency, frequency, type) VALUES
('AAPL', '2024-05-02', '2024-05-13', '2024-05-10', '2024-05-16', 0.24, 'USD', 4, 'Cash'),
('AAPL', '2024-02-01', '2024-02-12', '2024-02-09', '2024-02-15', 0.24, 'USD', 4, 'Cash'),
('AAPL', '2023-11-02', '2023-11-13', '2023-11-10', '2023-11-16', 0.23, 'USD', 4, 'Cash'),
('AAPL', '2023-08-03', '2023-08-14', '2023-08-11', '2023-08-17', 0.23, 'USD', 4, 'Cash'),
('MSFT', '2024-06-18', '2024-08-22', '2024-08-21', '2024-09-12', 0.75, 'USD', 4, 'Cash'),
('MSFT', '2024-03-18', '2024-05-22', '2024-05-21', '2024-06-13', 0.75, 'USD', 4, 'Cash'),
('GOOGL', '2024-04-25', '2024-06-07', '2024-06-06', '2024-06-17', 0.20, 'USD', 4, 'Cash'),
('TSLA', '2024-01-15', '2024-02-28', '2024-02-29', '2024-03-15', 0.10, 'USD', 4, 'Cash')
ON CONFLICT (ticker, ex_dividend_date) DO NOTHING;

-- Step 6: Verify the setup
SELECT 
    'Setup Complete!' as status,
    COUNT(*) as total_records,
    COUNT(DISTINCT ticker) as unique_tickers
FROM dividends;
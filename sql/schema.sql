-- Dividend history table for stock ticker data
-- Run this SQL in your Supabase SQL editor

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

-- Index for efficient ticker lookups
CREATE INDEX IF NOT EXISTS idx_dividends_ticker ON dividends(ticker);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_dividends_ex_date ON dividends(ex_dividend_date);

-- Combined index for ticker and date queries
CREATE INDEX IF NOT EXISTS idx_dividends_ticker_date ON dividends(ticker, ex_dividend_date);

-- Enable Row Level Security (RLS)
ALTER TABLE dividends ENABLE ROW LEVEL SECURITY;

-- Policy to allow read access for authenticated users
CREATE POLICY "Allow read access to dividends" ON dividends
    FOR SELECT TO authenticated
    USING (true);

-- Policy to allow insert/update for authenticated users
CREATE POLICY "Allow write access to dividends" ON dividends
    FOR ALL TO authenticated
    USING (true);

-- Sample data (remove in production)
INSERT INTO dividends (ticker, declaration_date, record_date, ex_dividend_date, pay_date, amount, currency, frequency, type) VALUES
('AAPL', '2024-05-02', '2024-05-13', '2024-05-10', '2024-05-16', 0.24, 'USD', 4, 'Cash'),
('AAPL', '2024-02-01', '2024-02-12', '2024-02-09', '2024-02-15', 0.24, 'USD', 4, 'Cash'),
('MSFT', '2024-06-18', '2024-08-22', '2024-08-21', '2024-09-12', 0.75, 'USD', 4, 'Cash')
ON CONFLICT (ticker, ex_dividend_date) DO NOTHING;
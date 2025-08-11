-- Simple Supabase setup (run this in SQL Editor)

-- Create table
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
  UNIQUE(ticker, ex_dividend_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dividends_ticker ON dividends(ticker);
CREATE INDEX IF NOT EXISTS idx_dividends_ex_date ON dividends(ex_dividend_date);

-- Enable RLS
ALTER TABLE dividends ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe if they don't exist)
DROP POLICY IF EXISTS "Allow anonymous access" ON dividends;

-- Create policy for anonymous access (API key authentication)
CREATE POLICY "Allow anonymous access" ON dividends
  FOR ALL TO anon
  USING (true);

-- Insert sample data
INSERT INTO dividends (ticker, declaration_date, record_date, ex_dividend_date, pay_date, amount) VALUES
('AAPL', '2024-05-02', '2024-05-13', '2024-05-10', '2024-05-16', 0.24),
('AAPL', '2024-02-01', '2024-02-12', '2024-02-09', '2024-02-15', 0.24),
('MSFT', '2024-06-18', '2024-08-22', '2024-08-21', '2024-09-12', 0.75)
ON CONFLICT (ticker, ex_dividend_date) DO NOTHING;
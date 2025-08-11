/**
 * Manual table creation script using raw SQL
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
  console.log('🔧 Creating dividends table manually...\n');

  // Use the REST API to execute raw SQL
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sql: `
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
        
        CREATE INDEX IF NOT EXISTS idx_dividends_ticker ON dividends(ticker);
        CREATE INDEX IF NOT EXISTS idx_dividends_ex_date ON dividends(ex_dividend_date);
        CREATE INDEX IF NOT EXISTS idx_dividends_ticker_date ON dividends(ticker, ex_dividend_date);
        
        ALTER TABLE dividends ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY IF NOT EXISTS "Allow anonymous read access" ON dividends FOR SELECT TO anon USING (true);
        CREATE POLICY IF NOT EXISTS "Allow anonymous write access" ON dividends FOR ALL TO anon USING (true);
      `
    })
  });

  if (!response.ok) {
    console.log('⚠️  Direct SQL execution not available via REST API');
    console.log('\n📋 Please run this SQL manually in your Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/' + supabaseUrl.split('.')[0].split('//')[1] + '/sql/new');
    console.log('\n--- Copy this SQL ---');
    console.log(`
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

CREATE INDEX IF NOT EXISTS idx_dividends_ticker ON dividends(ticker);
CREATE INDEX IF NOT EXISTS idx_dividends_ex_date ON dividends(ex_dividend_date);
CREATE INDEX IF NOT EXISTS idx_dividends_ticker_date ON dividends(ticker, ex_dividend_date);

ALTER TABLE dividends ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow anonymous read access" ON dividends FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "Allow anonymous write access" ON dividends FOR ALL TO anon USING (true);

-- Sample data
INSERT INTO dividends (ticker, declaration_date, record_date, ex_dividend_date, pay_date, amount, currency, frequency, type) VALUES
('AAPL', '2024-05-02', '2024-05-13', '2024-05-10', '2024-05-16', 0.24, 'USD', 4, 'Cash'),
('AAPL', '2024-02-01', '2024-02-12', '2024-02-09', '2024-02-15', 0.24, 'USD', 4, 'Cash'),
('MSFT', '2024-06-18', '2024-08-22', '2024-08-21', '2024-09-12', 0.75, 'USD', 4, 'Cash')
ON CONFLICT (ticker, ex_dividend_date) DO NOTHING;
    `);
    console.log('\n--- End SQL ---');
    console.log('\nAfter running the SQL, test with: npm run test:db');
    return;
  }

  const result = await response.json();
  console.log('✅ Table created successfully:', result);
}

createTable();
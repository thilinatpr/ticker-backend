/**
 * Database setup script for Supabase
 * This script will create tables, indexes, and sample data
 * Run with: npm run setup:db
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.log('Please create a .env.local file with:');
  console.log('SUPABASE_URL=your-supabase-url');
  console.log('SUPABASE_ANON_KEY=your-supabase-anon-key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database...\n');

  try {
    // Step 1: Create the dividends table
    console.log('📊 Step 1: Creating dividends table...');
    const { error: tableError } = await supabase.rpc('exec_sql', {
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
          
          -- Ensure no duplicate dividends for same ticker and ex-dividend date
          UNIQUE(ticker, ex_dividend_date)
        );
      `
    });

    if (tableError) {
      console.log('ℹ️  Table creation via RPC not available, using direct table operations...');
      
      // Alternative: Try to query the table to see if it exists
      const { error: checkError } = await supabase.from('dividends').select('count', { count: 'exact', head: true });
      
      if (checkError && checkError.code === 'PGRST116') {
        console.log('❌ Dividends table does not exist. Please create it manually in Supabase SQL Editor.');
        console.log('📋 SQL to run:');
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dividends_ticker ON dividends(ticker);
CREATE INDEX IF NOT EXISTS idx_dividends_ex_date ON dividends(ex_dividend_date);
CREATE INDEX IF NOT EXISTS idx_dividends_ticker_date ON dividends(ticker, ex_dividend_date);

-- RLS Policies
ALTER TABLE dividends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to dividends" ON dividends FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access to dividends" ON dividends FOR ALL TO authenticated USING (true);
        `);
        console.log('\n🔧 Please run the above SQL in your Supabase SQL Editor, then run this script again.');
        return;
      }
    }

    console.log('✅ Dividends table ready');

    // Step 2: Insert sample data
    console.log('📊 Step 2: Inserting sample dividend data...');
    
    const sampleData = [
      {
        ticker: 'AAPL',
        declaration_date: '2024-05-02',
        record_date: '2024-05-13',
        ex_dividend_date: '2024-05-10',
        pay_date: '2024-05-16',
        amount: 0.24,
        currency: 'USD',
        frequency: 4,
        type: 'Cash'
      },
      {
        ticker: 'AAPL',
        declaration_date: '2024-02-01',
        record_date: '2024-02-12',
        ex_dividend_date: '2024-02-09',
        pay_date: '2024-02-15',
        amount: 0.24,
        currency: 'USD',
        frequency: 4,
        type: 'Cash'
      },
      {
        ticker: 'MSFT',
        declaration_date: '2024-06-18',
        record_date: '2024-08-22',
        ex_dividend_date: '2024-08-21',
        pay_date: '2024-09-12',
        amount: 0.75,
        currency: 'USD',
        frequency: 4,
        type: 'Cash'
      }
    ];

    const { data, error: insertError } = await supabase
      .from('dividends')
      .upsert(sampleData, {
        onConflict: 'ticker,ex_dividend_date'
      });

    if (insertError) {
      console.log('⚠️  Sample data insert failed:', insertError.message);
    } else {
      console.log(`✅ Sample data inserted (${sampleData.length} records)`);
    }

    // Step 3: Test the setup
    console.log('📊 Step 3: Testing database operations...');
    
    const { data: testData, error: testError } = await supabase
      .from('dividends')
      .select('*')
      .eq('ticker', 'AAPL');

    if (testError) {
      console.log('❌ Test query failed:', testError.message);
      return;
    }

    console.log(`✅ Test query successful: Found ${testData.length} AAPL dividend records`);

    // Step 4: Show summary
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`- Database URL: ${supabaseUrl}`);
    console.log(`- Sample data: ${sampleData.length} dividend records`);
    console.log(`- Test result: ${testData.length} AAPL records found`);
    
    console.log('\n🚀 Next steps:');
    console.log('1. Test the API: npm run test:db');
    console.log('2. Start development: npm run dev');
    console.log('3. Deploy to Vercel with environment variables');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('Full error:', error);
    
    if (error.message.includes('relation "dividends" does not exist')) {
      console.log('\n🔧 The dividends table needs to be created manually.');
      console.log('Please run the SQL from sql/schema.sql in your Supabase SQL Editor.');
    }
    
    process.exit(1);
  }
}

setupDatabase();
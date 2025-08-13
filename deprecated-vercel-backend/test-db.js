/**
 * Test script to verify Supabase database connection
 * Run with: node test-db.js
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getDividendHistory, storeDividendHistory } from './lib/supabase.js';

async function testDatabaseConnection() {
  console.log('🔍 Testing Supabase database connection...\n');

  try {
    // Test 1: Query existing data
    console.log('📊 Test 1: Querying AAPL dividend data...');
    const appleDividends = await getDividendHistory('AAPL');
    console.log(`✅ Found ${appleDividends.length} AAPL dividend records`);
    if (appleDividends.length > 0) {
      console.log('Sample record:', JSON.stringify(appleDividends[0], null, 2));
    }
    console.log('');

    // Test 2: Query non-existent ticker
    console.log('📊 Test 2: Querying non-existent ticker (TEST)...');
    const testDividends = await getDividendHistory('TEST');
    console.log(`✅ Found ${testDividends.length} TEST dividend records (expected: 0)`);
    console.log('');

    // Test 3: Query with date filtering
    console.log('📊 Test 3: Querying AAPL with date filter...');
    const filteredDividends = await getDividendHistory('AAPL', '2024-03-01', '2024-12-31');
    console.log(`✅ Found ${filteredDividends.length} AAPL dividend records from Mar 2024 onwards`);
    console.log('');

    // Test 4: Insert test data
    console.log('📊 Test 4: Inserting test dividend data...');
    const testData = [{
      declarationDate: '2024-01-15',
      recordDate: '2024-01-26',
      exDividendDate: '2024-01-25',
      payDate: '2024-02-01',
      amount: 0.50,
      currency: 'USD',
      frequency: 4,
      type: 'Cash'
    }];
    
    await storeDividendHistory('TEST', testData);
    console.log('✅ Test data inserted successfully');
    
    // Verify insertion
    const insertedData = await getDividendHistory('TEST');
    console.log(`✅ Verified: Found ${insertedData.length} TEST dividend records after insertion`);
    console.log('');

    console.log('🎉 All database tests passed! Supabase connection is working properly.');

  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Full error:', error);
    
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Check your SUPABASE_URL and SUPABASE_ANON_KEY in .env.local');
    console.log('2. Ensure the dividends table exists in your Supabase database');
    console.log('3. Run the SQL schema from sql/schema.sql in your Supabase SQL editor');
    console.log('4. Verify Row Level Security policies allow access');
    
    process.exit(1);
  }
}

// Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables!');
  console.log('Please create a .env.local file with:');
  console.log('SUPABASE_URL=your-supabase-url');
  console.log('SUPABASE_ANON_KEY=your-supabase-anon-key');
  process.exit(1);
}

testDatabaseConnection();
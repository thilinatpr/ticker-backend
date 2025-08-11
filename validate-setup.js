/**
 * Validate that the enhanced database setup is working
 * Run this after executing setup-complete-enhanced.sql
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabase } from './lib/supabase.js';

console.log('🔍 Validating Enhanced Database Setup');
console.log('====================================');

async function validateTable(tableName, requiredColumns = []) {
  console.log(`\n📋 Checking table: ${tableName}`);
  
  try {
    // Check if table exists and can be queried
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.log(`❌ Table query failed: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Table exists with ${count || 0} records`);
    
    // Check required columns if any data exists
    if (data && data.length > 0 && requiredColumns.length > 0) {
      const columns = Object.keys(data[0]);
      const missingColumns = requiredColumns.filter(col => !columns.includes(col));
      
      if (missingColumns.length > 0) {
        console.log(`⚠️ Missing columns: ${missingColumns.join(', ')}`);
      } else {
        console.log(`✅ All required columns present`);
      }
    }
    
    return true;
    
  } catch (error) {
    console.log(`❌ Error accessing table: ${error.message}`);
    return false;
  }
}

async function testBasicOperations() {
  console.log('\n⚙️ Testing Basic Operations');
  console.log('===========================');
  
  try {
    // Test ticker insertion
    console.log('\n🏷️ Testing ticker operations...');
    const { data: ticker, error: tickerError } = await supabase
      .from('tickers')
      .upsert([{ symbol: 'TEST', is_active: true }], { onConflict: 'symbol' })
      .select()
      .single();
    
    if (tickerError) {
      console.log(`❌ Ticker operation failed: ${tickerError.message}`);
      return false;
    }
    
    console.log(`✅ Ticker upserted: ${ticker.symbol}`);
    
    // Test job creation
    console.log('\n📋 Testing job operations...');
    const { data: job, error: jobError } = await supabase
      .from('api_jobs')
      .insert([{
        job_type: 'dividend_update',
        status: 'pending',
        ticker_symbols: ['TEST'],
        total_tickers: 1,
        priority: 0
      }])
      .select()
      .single();
    
    if (jobError) {
      console.log(`❌ Job operation failed: ${jobError.message}`);
      return false;
    }
    
    console.log(`✅ Job created: ID ${job.id}`);
    
    // Test rate limit initialization
    console.log('\n⏱️ Testing rate limit operations...');
    const { data: rateLimit, error: rateLimitError } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('service_name', 'polygon')
      .single();
    
    if (rateLimitError) {
      console.log(`❌ Rate limit query failed: ${rateLimitError.message}`);
      return false;
    }
    
    console.log(`✅ Rate limit found for: ${rateLimit.service_name}`);
    
    // Test function call
    console.log('\n🔧 Testing database functions...');
    const { error: functionError } = await supabase.rpc('increment_rate_limit_counters', {
      service_name: 'polygon'
    });
    
    if (functionError) {
      console.log(`❌ Function call failed: ${functionError.message}`);
      return false;
    }
    
    console.log(`✅ Database function working`);
    
    return true;
    
  } catch (error) {
    console.log(`❌ Operations test failed: ${error.message}`);
    return false;
  }
}

async function runValidation() {
  console.log('🚀 Starting validation...\n');
  
  const tableResults = {
    tickers: await validateTable('tickers', ['symbol', 'is_active']),
    api_jobs: await validateTable('api_jobs', ['job_type', 'status']),
    job_queue: await validateTable('job_queue', ['job_id', 'ticker_symbol']),
    rate_limits: await validateTable('rate_limits', ['service_name', 'calls_this_minute']),
    api_call_logs: await validateTable('api_call_logs', ['service_name', 'endpoint']),
    dividends: await validateTable('dividends', ['ticker', 'ex_dividend_date'])
  };
  
  const operationsResult = await testBasicOperations();
  
  console.log('\n📊 Validation Results');
  console.log('=====================');
  console.log(`Tickers Table: ${tableResults.tickers ? '✅' : '❌'}`);
  console.log(`API Jobs Table: ${tableResults.api_jobs ? '✅' : '❌'}`);
  console.log(`Job Queue Table: ${tableResults.job_queue ? '✅' : '❌'}`);
  console.log(`Rate Limits Table: ${tableResults.rate_limits ? '✅' : '❌'}`);
  console.log(`API Logs Table: ${tableResults.api_call_logs ? '✅' : '❌'}`);
  console.log(`Dividends Table: ${tableResults.dividends ? '✅' : '❌'}`);
  console.log(`Basic Operations: ${operationsResult ? '✅' : '❌'}`);
  
  const allValid = Object.values(tableResults).every(r => r === true) && operationsResult;
  
  if (allValid) {
    console.log('\n🎉 Database validation passed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Set POLYGON_API_KEY environment variable');
    console.log('   2. Run: npm run test:core');
    console.log('   3. Deploy to Vercel when ready');
    console.log('\n🔗 Available commands:');
    console.log('   • npm run test:core - Test core functions');
    console.log('   • npm run test:endpoints - Test API endpoints (requires server)');
  } else {
    console.log('\n⚠️ Validation failed!');
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure you ran setup-complete-enhanced.sql in Supabase');
    console.log('   2. Check that your SUPABASE_URL and SUPABASE_ANON_KEY are correct');
    console.log('   3. Verify database permissions and RLS policies');
  }
}

runValidation().catch(error => {
  console.error('❌ Validation failed with error:', error);
  process.exit(1);
});
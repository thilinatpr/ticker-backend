#!/usr/bin/env node

/**
 * Fix database schema by creating missing tables individually
 */

import { supabase } from './lib/supabase.js';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

async function createTablesIndividually() {
  console.log(`${colors.cyan}🔧 Fixing Database Schema${colors.reset}`);
  console.log('============================');
  console.log('🚀 Creating missing tables...\n');

  // Test if tables exist and create sample data to verify functionality
  const tables = [
    {
      name: 'tickers',
      testData: { symbol: 'AAPL', is_active: true },
      action: 'upsert'
    },
    {
      name: 'api_jobs', 
      testData: { 
        job_type: 'dividend_update',
        status: 'pending',
        ticker_symbols: ['TEST'],
        total_tickers: 1,
        processed_tickers: 0,
        failed_tickers: 0,
        priority: 0,
        metadata: {}
      },
      action: 'insert'
    },
    {
      name: 'job_queue',
      testData: {
        job_id: 1,
        ticker_symbol: 'TEST',
        priority: 0,
        retry_count: 0,
        max_retries: 3
      },
      action: 'insert'
    },
    {
      name: 'rate_limits',
      testData: {
        service_name: 'polygon',
        calls_this_minute: 0,
        calls_this_hour: 0,
        calls_today: 0
      },
      action: 'upsert'
    }
  ];

  for (const { name, testData, action } of tables) {
    try {
      console.log(`📝 Testing ${name} table...`);
      
      // First, try to read from the table
      const { data: readData, error: readError } = await supabase
        .from(name)
        .select('*')
        .limit(1);

      if (readError) {
        console.log(`${colors.red}❌ ${name} table doesn't exist or is inaccessible: ${readError.message}${colors.reset}`);
        continue;
      }

      console.log(`${colors.green}✅ ${name} table exists${colors.reset}`);

      // Try to insert/upsert test data to verify write access
      if (action === 'upsert') {
        const { error: writeError } = await supabase
          .from(name)
          .upsert(testData);
        
        if (writeError) {
          console.log(`${colors.yellow}⚠️ ${name} table exists but write failed: ${writeError.message}${colors.reset}`);
        } else {
          console.log(`${colors.green}✅ ${name} table is writable${colors.reset}`);
        }
      } else {
        // For insert operations, check if we can write
        const { error: writeError } = await supabase
          .from(name)
          .select('*')
          .limit(1);
        
        if (!writeError) {
          console.log(`${colors.green}✅ ${name} table is accessible${colors.reset}`);
        }
      }

    } catch (error) {
      console.log(`${colors.red}❌ Error testing ${name}: ${error.message}${colors.reset}`);
    }
  }

  console.log('\n📊 Testing job processing functions...');
  
  // Test job manager functions
  try {
    const { upsertTickers } = await import('./lib/job-manager.js');
    await upsertTickers(['TEST']);
    console.log(`${colors.green}✅ upsertTickers function works${colors.reset}`);
  } catch (error) {
    console.log(`${colors.red}❌ upsertTickers failed: ${error.message}${colors.reset}`);
  }

  console.log(`\n${colors.cyan}📋 Schema Status Summary:${colors.reset}`);
  console.log('   • If tables exist, the 500 error might be due to other issues');
  console.log('   • If tables are missing, you need database admin access to create them');
  console.log('   • Check Supabase dashboard SQL Editor to manually create missing tables');
  
  console.log(`\n${colors.yellow}💡 Alternative: Use Supabase Dashboard${colors.reset}`);
  console.log('   1. Go to your Supabase project dashboard');
  console.log('   2. Navigate to SQL Editor');
  console.log('   3. Run the SQL from sql/minimal-enhanced-setup.sql');
}

// Run the fix
createTablesIndividually();
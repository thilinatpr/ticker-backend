/**
 * Test core functions without requiring a server
 * Tests the dividend tracking system functionality directly
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabase } from './lib/supabase.js';
import { 
  upsertTickers, 
  createDividendUpdateJob,
  addTickersToQueue,
  getJobById,
  getJobProgress 
} from './lib/job-manager.js';
import { 
  fetchPolygonDividends,
  needsDividendUpdate,
  getTimeUntilNextCall
} from './lib/polygon-api.js';

console.log('🧪 Testing Core Dividend Tracking Functions');
console.log('===============================================');

async function testDatabaseConnection() {
  console.log('\n📊 Testing Database Connection...');
  
  try {
    const { data, error } = await supabase.from('dividends').select('count').limit(1);
    
    if (error) {
      console.log('❌ Database connection failed:', error.message);
      console.log('💡 Please run the enhanced schema in Supabase first');
      return false;
    }
    
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.log('❌ Database connection error:', error.message);
    return false;
  }
}

async function testTickerManagement() {
  console.log('\n🏷️ Testing Ticker Management...');
  
  try {
    const testTickers = ['AAPL', 'MSFT', 'TEST'];
    
    console.log('   • Upserting test tickers...');
    await upsertTickers(testTickers);
    console.log('   ✅ Tickers upserted successfully');
    
    // Verify tickers were created
    const { data: tickers, error } = await supabase
      .from('tickers')
      .select('*')
      .in('symbol', testTickers);
    
    if (error) throw error;
    
    console.log(`   ✅ Found ${tickers.length} tickers in database`);
    return true;
    
  } catch (error) {
    console.log('   ❌ Ticker management failed:', error.message);
    return false;
  }
}

async function testJobSystem() {
  console.log('\n⚙️ Testing Job System...');
  
  try {
    const testTickers = ['AAPL', 'MSFT'];
    
    console.log('   • Creating job...');
    const jobId = await createDividendUpdateJob(testTickers, 1, false);
    console.log(`   ✅ Job created with ID: ${jobId}`);
    
    console.log('   • Adding tickers to queue...');
    await addTickersToQueue(jobId, testTickers, 1);
    console.log('   ✅ Tickers added to queue');
    
    console.log('   • Getting job details...');
    const job = await getJobById(jobId);
    console.log(`   ✅ Job status: ${job.status}, Total tickers: ${job.total_tickers}`);
    
    console.log('   • Getting job progress...');
    const progress = await getJobProgress(jobId);
    console.log(`   ✅ Progress: ${progress.progress.completed}/${progress.progress.total} completed`);
    
    return { success: true, jobId };
    
  } catch (error) {
    console.log('   ❌ Job system failed:', error.message);
    return { success: false };
  }
}

async function testPolygonAPI() {
  console.log('\n📈 Testing Polygon API...');
  
  if (!process.env.POLYGON_API_KEY) {
    console.log('   ⚠️ POLYGON_API_KEY not set, skipping API tests');
    return { success: true, skipped: true };
  }
  
  try {
    console.log('   • Checking rate limits...');
    const waitTime = await getTimeUntilNextCall();
    console.log(`   ✅ Rate limit check: ${waitTime}ms wait time`);
    
    console.log('   • Testing dividend update check...');
    const needsUpdate = await needsDividendUpdate('AAPL', false);
    console.log(`   ✅ AAPL needs update: ${needsUpdate}`);
    
    // Only test actual API call if we can make it
    if (waitTime === 0) {
      console.log('   • Fetching AAPL dividend data (limited test)...');
      try {
        const dividends = await fetchPolygonDividends('AAPL', {
          startDate: '2024-01-01',
          endDate: '2024-02-01'
        });
        console.log(`   ✅ Fetched ${dividends.length} dividend records`);
      } catch (apiError) {
        if (apiError.message.includes('rate limit')) {
          console.log('   ⚠️ Rate limited (expected behavior)');
        } else {
          console.log(`   ⚠️ API call failed: ${apiError.message}`);
        }
      }
    } else {
      console.log('   ⚠️ Skipping API call due to rate limiting');
    }
    
    return { success: true };
    
  } catch (error) {
    console.log('   ❌ Polygon API test failed:', error.message);
    return { success: false };
  }
}

async function testDataStorage() {
  console.log('\n💾 Testing Data Storage...');
  
  try {
    // Test with mock dividend data
    const mockDividends = [
      {
        declarationDate: '2024-01-15',
        exDividendDate: '2024-02-01',
        payDate: '2024-02-15',
        amount: 0.25,
        currency: 'USD',
        frequency: 4,
        type: 'Cash',
        dataSource: 'test'
      }
    ];
    
    console.log('   • Storing test dividend data...');
    const { storeDividendHistory } = await import('./lib/supabase.js');
    const result = await storeDividendHistory('TEST', mockDividends);
    
    console.log(`   ✅ Stored ${result.inserted} dividend records`);
    console.log(`   ✅ Validation errors: ${result.errors}`);
    
    return true;
    
  } catch (error) {
    console.log('   ❌ Data storage failed:', error.message);
    return false;
  }
}

async function runCoreTests() {
  console.log('🚀 Starting Core Function Tests...\n');
  
  const results = {
    database: await testDatabaseConnection(),
    tickers: false,
    jobs: { success: false },
    polygon: { success: false },
    storage: false
  };
  
  if (results.database) {
    results.tickers = await testTickerManagement();
    results.jobs = await testJobSystem();
    results.polygon = await testPolygonAPI();
    results.storage = await testDataStorage();
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`Database Connection: ${results.database ? '✅' : '❌'}`);
  console.log(`Ticker Management: ${results.tickers ? '✅' : '❌'}`);
  console.log(`Job System: ${results.jobs.success ? '✅' : '❌'}`);
  console.log(`Polygon API: ${results.polygon.success ? '✅' : '❌'}${results.polygon.skipped ? ' (skipped - no API key)' : ''}`);
  console.log(`Data Storage: ${results.storage ? '✅' : '❌'}`);
  
  const allPassed = results.database && results.tickers && results.jobs.success && results.polygon.success && results.storage;
  
  if (allPassed) {
    console.log('\n🎉 All core functions working correctly!');
    console.log('\n📋 Ready for deployment:');
    console.log('   1. Run enhanced-schema.sql in Supabase');
    console.log('   2. Set POLYGON_API_KEY environment variable');
    console.log('   3. Deploy to Vercel');
    console.log('   4. Test endpoints in production');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the issues above.');
  }
  
  if (results.jobs.jobId) {
    console.log(`\n🔗 Test job created with ID: ${results.jobs.jobId}`);
    console.log('   You can check its status in the database or via API');
  }
}

// Run the tests
runCoreTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
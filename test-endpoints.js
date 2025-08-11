/**
 * Test script for dividend tracking system endpoints
 * Run with: node test-endpoints.js
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.TEST_API_KEY || 'tk_demo_key_12345';

console.log('🧪 Testing Dividend Tracking System');
console.log(`📡 Base URL: ${BASE_URL}`);
console.log(`🔑 API Key: ${API_KEY.substring(0, 10)}...`);
console.log('');

/**
 * Make HTTP request with error handling
 */
async function makeRequest(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  };

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    return {
      status: response.status,
      ok: response.ok,
      data
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

/**
 * Test individual endpoint
 */
async function testEndpoint(name, method, path, body = null, expectedStatus = 200) {
  console.log(`Testing ${name}...`);
  
  const result = await makeRequest(method, path, body);
  
  const statusIcon = result.status === expectedStatus ? '✅' : '❌';
  console.log(`${statusIcon} ${method} ${path} → ${result.status}`);
  
  if (!result.ok && result.error) {
    console.log(`   Error: ${result.error}`);
  } else if (result.data) {
    if (result.data.error) {
      console.log(`   API Error: ${result.data.error}`);
    } else {
      // Show key response data
      if (result.data.jobId) {
        console.log(`   Job ID: ${result.data.jobId}`);
      }
      if (result.data.message) {
        console.log(`   Message: ${result.data.message}`);
      }
      if (result.data.dividends) {
        console.log(`   Dividends: ${result.data.dividends.length} records`);
      }
      if (result.data.jobs) {
        console.log(`   Jobs: ${result.data.jobs.length} found`);
      }
    }
  }
  
  console.log('');
  return result;
}

/**
 * Wait for specified time
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main test flow
 */
async function runTests() {
  console.log('='.repeat(50));
  console.log('🚀 Starting endpoint tests...');
  console.log('='.repeat(50));

  // Test 1: Health check (existing endpoint)
  await testEndpoint(
    'Health Check', 
    'GET', 
    '/api/health'
  );

  // Test 2: Submit ticker update job
  const jobResult = await testEndpoint(
    'Submit Ticker Update Job',
    'POST',
    '/api/update-tickers',
    {
      tickers: ['AAPL', 'MSFT'],
      priority: 1,
      force: false
    },
    202
  );

  let jobId = null;
  if (jobResult.data && jobResult.data.jobId) {
    jobId = jobResult.data.jobId;
  }

  // Test 3: List all jobs
  await testEndpoint(
    'List All Jobs',
    'GET',
    '/api/jobs?limit=5'
  );

  // Test 4: Check job status (if we have a job ID)
  if (jobId) {
    await testEndpoint(
      'Check Job Status',
      'GET',
      `/api/job-status/${jobId}`
    );

    // Test 5: Cancel job (optional - uncomment to test)
    // await testEndpoint(
    //   'Cancel Job',
    //   'DELETE',
    //   `/api/jobs?jobId=${jobId}`
    // );
  }

  // Test 6: Manual queue processing (simulate cron)
  await testEndpoint(
    'Manual Queue Processing',
    'POST',
    '/api/process-queue'
  );

  // Test 7: Check existing dividend endpoint
  await testEndpoint(
    'Get Dividend Data (Legacy)',
    'GET',
    '/api/dividends/AAPL?fallback=true'
  );

  // Test 8: Test error handling
  await testEndpoint(
    'Invalid Ticker Format',
    'POST',
    '/api/update-tickers',
    {
      tickers: ['123', '']
    },
    400
  );

  // Test 9: Test rate limiting info
  console.log('📊 Testing complete! Check the following:');
  console.log('   1. Jobs should appear in /api/jobs');
  console.log('   2. Queue processing should handle rate limits');
  console.log('   3. Job status should update as processing occurs');
  console.log('   4. Dividend data should appear in database after processing');

  console.log('\n📋 Next steps:');
  console.log('   • Set up POLYGON_API_KEY for real dividend data');
  console.log('   • Run enhanced schema in Supabase');
  console.log('   • Deploy to Vercel with cron job enabled');
  console.log('   • Monitor rate limiting in production');
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
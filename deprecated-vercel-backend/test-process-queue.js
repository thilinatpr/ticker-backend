#!/usr/bin/env node

/**
 * Direct test of process-queue functionality
 */

import { getNextQueueItems } from './lib/job-manager.js';
import { getTimeUntilNextCall as polygonRateLimit } from './lib/polygon-api.js';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

async function testProcessQueueFunctions() {
  console.log(`${colors.cyan}🧪 Testing Process Queue Functions${colors.reset}`);
  console.log('====================================');
  console.log('🚀 Testing individual functions...\n');

  // Test 1: Rate limit check
  try {
    console.log('📝 Testing rate limit check...');
    const waitTime = await polygonRateLimit();
    console.log(`${colors.green}✅ Rate limit check works: ${waitTime}ms wait time${colors.reset}`);
  } catch (error) {
    console.log(`${colors.red}❌ Rate limit check failed: ${error.message}${colors.reset}`);
  }

  // Test 2: Get queue items
  try {
    console.log('📝 Testing queue items retrieval...');
    const queueItems = await getNextQueueItems(5, 'test-worker');
    console.log(`${colors.green}✅ Queue items retrieval works: Found ${queueItems.length} items${colors.reset}`);
    
    if (queueItems.length > 0) {
      console.log(`   Sample item: ${JSON.stringify(queueItems[0], null, 2)}`);
    }
  } catch (error) {
    console.log(`${colors.red}❌ Queue items retrieval failed: ${error.message}${colors.reset}`);
  }

  // Test 3: Environment variables
  try {
    console.log('📝 Testing environment variables...');
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'POLYGON_API_KEY'
    ];
    
    for (const envVar of requiredEnvVars) {
      const value = process.env[envVar];
      if (value) {
        console.log(`${colors.green}✅ ${envVar}: ${value.substring(0, 20)}...${colors.reset}`);
      } else {
        console.log(`${colors.red}❌ ${envVar}: Not set${colors.reset}`);
      }
    }
  } catch (error) {
    console.log(`${colors.red}❌ Environment check failed: ${error.message}${colors.reset}`);
  }

  // Test 4: Simulate process-queue handler logic
  try {
    console.log('📝 Testing process-queue handler logic...');
    
    // Simulate the main handler steps
    const WORKER_ID = `test-worker-${Date.now()}`;
    console.log(`   Worker ID: ${WORKER_ID}`);
    
    // Check rate limit
    const waitTime = await polygonRateLimit();
    if (waitTime > 0) {
      console.log(`${colors.yellow}⚠️ Would be rate limited, wait: ${Math.ceil(waitTime/1000)} seconds${colors.reset}`);
    } else {
      console.log(`${colors.green}✅ Rate limit OK, can proceed${colors.reset}`);
    }
    
    // Get queue items
    const queueItems = await getNextQueueItems(5, WORKER_ID);
    console.log(`${colors.green}✅ Would process ${queueItems.length} queue items${colors.reset}`);
    
    console.log(`${colors.green}✅ Process-queue handler logic simulation successful${colors.reset}`);
    
  } catch (error) {
    console.log(`${colors.red}❌ Process-queue handler simulation failed: ${error.message}${colors.reset}`);
    console.log(`   Stack trace: ${error.stack}`);
  }

  console.log(`\n${colors.cyan}📋 Test Complete${colors.reset}`);
  console.log('   • If all functions work, the 500 error might be in the handler wrapper');
  console.log('   • Check CORS headers or request/response handling');
  console.log('   • Try calling the endpoint with proper headers');
}

// Run the test
testProcessQueueFunctions();
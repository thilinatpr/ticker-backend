#!/usr/bin/env node

/**
 * Test database functions directly via Supabase REST API
 * This helps debug if functions are properly deployed
 */

const SUPABASE_URL = 'https://cdvskimffubkppnyipjc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkdnNraW1mZnVia3BwbnlpcGpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4OTAwNDksImV4cCI6MjA3MDQ2NjA0OX0.dEtTfbzDfFmP2wJH-TosngTj9useLGwKW3l_xTWDk7o';

async function testFunction(functionName, params = {}) {
  console.log(`\n🔍 Testing function: ${functionName}`);
  console.log(`📋 Parameters:`, JSON.stringify(params, null, 2));
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(params)
    });

    console.log(`📊 Status: ${response.status}`);
    
    const responseText = await response.text();
    if (response.ok) {
      try {
        const parsed = JSON.parse(responseText);
        console.log(`✅ Response:`, JSON.stringify(parsed, null, 2));
        return { success: true, data: parsed };
      } catch (e) {
        console.log(`✅ Response (text):`, responseText);
        return { success: true, data: responseText };
      }
    } else {
      console.log(`❌ Error: ${responseText}`);
      return { success: false, error: responseText };
    }
  } catch (error) {
    console.log(`❌ Exception: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testTableAccess() {
  console.log('\n📋 Testing table access...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/api_users?select=api_key,user_name,plan_type&limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      }
    });

    console.log(`📊 Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Users found: ${data.length}`);
      data.forEach(user => {
        console.log(`   - ${user.api_key}: ${user.user_name} (${user.plan_type})`);
      });
      return true;
    } else {
      const error = await response.text();
      console.log(`❌ Table access failed: ${error}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Table test exception: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing Database Functions and Tables');
  console.log('📍 Database:', SUPABASE_URL);
  console.log('=' * 60);

  // Test 1: Check table access
  const tableAccess = await testTableAccess();
  
  // Test 2: Test get_user_by_api_key function
  await testFunction('get_user_by_api_key', { p_api_key: 'tk_demo_key_12345' });
  
  // Test 3: Test get_user_subscriptions function  
  await testFunction('get_user_subscriptions', { p_api_key: 'tk_demo_key_12345' });
  
  // Test 4: Test subscribe_to_ticker function
  await testFunction('subscribe_to_ticker', { 
    p_api_key: 'tk_demo_key_12345', 
    p_ticker: 'AAPL',
    p_priority: 1
  });
  
  // Test 5: Test get_user_subscriptions again (should show AAPL)
  await testFunction('get_user_subscriptions', { p_api_key: 'tk_demo_key_12345' });
  
  // Test 6: Test unsubscribe function
  await testFunction('unsubscribe_from_ticker', { 
    p_api_key: 'tk_demo_key_12345', 
    p_ticker: 'AAPL'
  });

  console.log('\n' + '=' * 60);
  console.log('🎯 Database function tests completed!');
  
  if (tableAccess) {
    console.log('\n💡 Next step: Test the Cloudflare Worker endpoints');
    console.log('curl -H "X-API-Key: tk_demo_key_12345" https://ticker-backend-worker2.patprathnayaka.workers.dev/subscriptions');
  } else {
    console.log('\n⚠️  Tables not accessible - check RLS policies and permissions');
  }
}

// Run the tests
runTests().catch(console.error);
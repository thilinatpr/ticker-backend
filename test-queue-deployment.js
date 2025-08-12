/**
 * Test script to verify Cloudflare Queue deployment
 */

// Test new ticker submission (should route to queue)
const testNewTickerQueue = async () => {
  console.log('=== Testing New Ticker Queue Integration ===\n');
  
  const API_BASE_URL = 'https://ticker-backend-3a6tr24j5-thilinas-projects-f6f25033.vercel.app';
  const API_KEY = 'tk_demo_key_12345';
  
  try {
    // Test submitting a new ticker
    console.log('1. Submitting new ticker (should route to Cloudflare Queue)...');
    
    const response = await fetch(`${API_BASE_URL}/api/update-tickers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        tickers: ['TESTQUEUE123'] // New ticker that should go to queue
      })
    });
    
    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (result.queueResult) {
      console.log('✅ Success! Ticker routed to Cloudflare Queue');
      console.log(`Queue processing: ${result.processing.queueProcessing} tickers`);
    } else if (result.jobId) {
      console.log('⚠️  Fallback: Ticker routed to traditional queue');
      console.log('This might mean CF Queue is not deployed yet');
    }
    
    console.log('\n=== Test completed ===');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Test worker health
const testWorkerHealth = async () => {
  console.log('=== Testing Cloudflare Worker Health ===\n');
  
  const WORKER_URL = 'https://ticker-backend-worker2-deployed.thilinas-projects-f6f25033.workers.dev';
  
  try {
    const response = await fetch(`${WORKER_URL}/health`);
    const result = await response.json();
    
    console.log('Worker Health:', JSON.stringify(result, null, 2));
    
    if (result.status === 'ok') {
      console.log('✅ Cloudflare Worker is healthy!');
    }
    
  } catch (error) {
    console.error('❌ Worker health check failed:', error.message);
    console.log('This is expected if the worker is not deployed yet.');
  }
};

// Run tests
console.log('Testing Cloudflare Queue Integration Deployment...\n');

testWorkerHealth()
  .then(() => testNewTickerQueue())
  .then(() => {
    console.log('\n🎉 Queue integration testing completed!');
    console.log('\nNext steps:');
    console.log('1. Check GitHub Actions for deployment status');
    console.log('2. Monitor Cloudflare Dashboard for queue creation');
    console.log('3. Test with real new tickers once deployed');
  })
  .catch(console.error);
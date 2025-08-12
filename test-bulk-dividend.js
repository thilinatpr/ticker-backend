/**
 * Test script for bulk dividend update functionality
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { 
  fetchBulkRecentDividends, 
  filterDividendsForTrackedTickers 
} from './lib/polygon-api.js';

async function testBulkDividendUpdate() {
  console.log('=== Testing Bulk Dividend Update ===\n');
  
  try {
    console.log('Step 1: Fetching bulk recent dividends (last 2 days)...');
    const startTime = Date.now();
    
    const allDividends = await fetchBulkRecentDividends(2); // Last 2 days
    console.log(`✓ Fetched ${allDividends.length} total dividend records in ${Date.now() - startTime}ms\n`);
    
    if (allDividends.length > 0) {
      console.log('Sample dividend record:', JSON.stringify(allDividends[0], null, 2));
      console.log();
    }
    
    console.log('Step 2: Filtering for tracked tickers...');
    const filterResult = await filterDividendsForTrackedTickers(allDividends);
    const { dividendsByTicker, totalRecords, filteredRecords, trackedTickersWithDividends } = filterResult;
    
    console.log(`✓ Total dividend records: ${totalRecords}`);
    console.log(`✓ Filtered for tracked tickers: ${filteredRecords}`);
    console.log(`✓ Tracked tickers with dividends: ${trackedTickersWithDividends.length}`);
    
    if (trackedTickersWithDividends.length > 0) {
      console.log(`\nTickers with dividend updates:`);
      trackedTickersWithDividends.forEach(ticker => {
        console.log(`  - ${ticker}: ${dividendsByTicker[ticker].length} dividend records`);
      });
    }
    
    console.log(`\n=== Test completed successfully ===`);
    
    // Calculate efficiency
    const traditionalTime = trackedTickersWithDividends.length * 12; // 12 seconds per individual call
    const bulkTime = Math.ceil((Date.now() - startTime) / 1000);
    
    console.log(`\nEfficiency comparison:`);
    console.log(`  Traditional approach: ~${traditionalTime} seconds (${trackedTickersWithDividends.length} individual API calls)`);
    console.log(`  Bulk approach: ~${bulkTime} seconds (1-2 API calls with pagination)`);
    console.log(`  Time saved: ~${traditionalTime - bulkTime} seconds (${Math.round((1 - bulkTime/traditionalTime) * 100)}% faster)`);
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('Full error:', error);
    }
  }
}

// Run the test
testBulkDividendUpdate().then(() => {
  console.log('\nTest script completed.');
  process.exit(0);
}).catch(error => {
  console.error('Test script failed:', error);
  process.exit(1);
});
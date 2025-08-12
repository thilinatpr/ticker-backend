/**
 * API endpoint for bulk dividend updates
 * POST /api/bulk-dividend-update
 * Fetches recent dividend declarations and updates only tracked tickers
 */

import { setCorsHeaders } from '../middleware/cors.js';
import { 
  fetchBulkRecentDividends, 
  filterDividendsForTrackedTickers,
  getTimeUntilNextCall 
} from '../lib/polygon-api.js';
import { storeDividendHistory, supabase } from '../lib/supabase.js';

async function handler(req, res) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed. Use POST.'
    });
  }

  const startTime = Date.now();
  let processed = 0;
  let failed = 0;
  let newRecords = 0;
  const results = [];

  console.log('Starting bulk dividend update...');

  try {
    // Check if we can make API calls (rate limiting)
    const waitTime = await getTimeUntilNextCall();
    if (waitTime > 0) {
      return res.json({
        success: false,
        message: `Rate limited, next processing in ${Math.ceil(waitTime/1000)} seconds`,
        waitTime,
        processed: 0,
        failed: 0,
        newRecords: 0
      });
    }

    // Step 1: Fetch all recent dividend declarations (bulk approach)
    console.log('Fetching bulk recent dividends...');
    const allDividends = await fetchBulkRecentDividends(2); // Last 2 days
    
    if (allDividends.length === 0) {
      return res.json({
        success: true,
        message: 'No recent dividend declarations found',
        processed: 0,
        failed: 0,
        newRecords: 0,
        processingTime: Date.now() - startTime
      });
    }

    // Step 2: Filter to only tracked tickers
    console.log('Filtering for tracked tickers...');
    const filterResult = await filterDividendsForTrackedTickers(allDividends);
    const { dividendsByTicker, totalRecords, filteredRecords, trackedTickersWithDividends } = filterResult;

    console.log(`Found dividend updates for ${trackedTickersWithDividends.length} tracked tickers`);

    // Step 3: Process each ticker's new dividends
    for (const ticker of trackedTickersWithDividends) {
      const tickerStartTime = Date.now();
      
      try {
        const dividends = dividendsByTicker[ticker];
        console.log(`Processing ${dividends.length} dividend records for ${ticker}`);

        // Store dividend data (with upsert logic to avoid duplicates)
        await storeDividendHistory(ticker, dividends);

        // Update ticker timestamp
        await updateTickerBulkTimestamp(ticker);

        processed++;
        newRecords += dividends.length;
        results.push({
          ticker,
          status: 'success',
          dividendsProcessed: dividends.length,
          processingTime: Date.now() - tickerStartTime
        });

        console.log(`Successfully processed ${dividends.length} dividend records for ${ticker}`);

      } catch (error) {
        console.error(`Error processing ${ticker}:`, error.message);
        
        failed++;
        results.push({
          ticker,
          status: 'failed',
          error: error.message,
          processingTime: Date.now() - tickerStartTime
        });
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`Bulk dividend update completed: ${processed} tickers processed, ${failed} failed, ${newRecords} new records in ${totalTime}ms`);

    res.json({
      success: true,
      message: `Bulk dividend update completed`,
      totalDividendDeclarations: totalRecords,
      filteredForTrackedTickers: filteredRecords,
      tickersWithUpdates: trackedTickersWithDividends.length,
      processed,
      failed,
      newRecords,
      results,
      processingTime: totalTime,
      efficiency: `Processed ${trackedTickersWithDividends.length} tickers in ${Math.ceil(totalTime/1000)}s vs individual calls would take ${trackedTickersWithDividends.length * 12}s`
    });

  } catch (error) {
    console.error('Bulk dividend update error:', error);
    
    res.status(500).json({
      error: 'Bulk dividend update failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      processed,
      failed,
      newRecords,
      processingTime: Date.now() - startTime
    });
  }
}

/**
 * Update ticker's bulk update timestamp
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<void>}
 */
async function updateTickerBulkTimestamp(ticker) {
  const now = new Date().toISOString();
  
  const { error } = await supabase
    .from('tickers')
    .update({
      last_dividend_update: now,
      last_bulk_update: now
    })
    .eq('symbol', ticker.toUpperCase());

  if (error) {
    console.error(`Error updating bulk timestamp for ${ticker}:`, error);
  }
}

// Export without authentication for internal cron calls
export default handler;
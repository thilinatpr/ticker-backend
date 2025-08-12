/**
 * Direct ticker processing endpoint (no queue system)
 * POST /api/process-ticker
 * Requires: X-API-Key header
 * Body: { ticker: "AAPL", force?: boolean }
 * 
 * This bypasses the job queue and directly fetches and stores data
 */

import { requireApiKey } from '../lib/auth.js';
import { setCorsHeaders } from '../middleware/cors.js';
import { 
  fetchPolygonDividends, 
  needsDividendUpdate, 
  updateTickerTimestamp 
} from '../lib/polygon-api.js';
import { storeDividendHistory } from '../lib/supabase.js';

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

  const ticker = req.query.ticker || req.body?.ticker;
  const force = req.query.force === 'true' || req.body?.force === true;
  const fetchType = req.query.fetchType || req.body?.fetchType || 'historical';
  const requestId = req.headers['x-request-id'] || 'manual';

  if (!ticker) {
    return res.status(400).json({
      error: 'Ticker symbol is required',
      example: { ticker: 'AAPL', force: false, fetchType: 'historical' }
    });
  }

  const tickerUpper = ticker.toUpperCase();
  const startTime = Date.now();

  try {
    console.log(`Processing ${tickerUpper} (${fetchType}) directly (force: ${force}) [${requestId}]`);

    // For queue-triggered historical fetches, always process
    let shouldProcess = force || fetchType === 'historical';
    
    if (!shouldProcess) {
      // Check if ticker needs update for regular processing
      const updateCheck = await needsDividendUpdate(tickerUpper, force);
      shouldProcess = updateCheck.needsUpdate || updateCheck.needsUpdate === true;
    }
    
    if (!shouldProcess) {
      console.log(`${tickerUpper} doesn't need update, skipping`);
      return res.status(200).json({
        success: true,
        ticker: tickerUpper,
        action: 'skipped',
        reason: 'Recent data available',
        fetchType,
        requestId,
        processingTime: Date.now() - startTime
      });
    }

    // Fetch dividend data from Polygon API with appropriate fetch type
    console.log(`Fetching ${fetchType} dividend data for ${tickerUpper}...`);
    const dividends = await fetchPolygonDividends(tickerUpper, fetchType);

    console.log(`Found ${dividends.length} dividend records for ${tickerUpper}`);

    // Store dividend data in database
    let storeResult = { inserted: 0, errors: 0 };
    if (dividends.length > 0) {
      console.log(`Storing ${dividends.length} dividend records for ${tickerUpper}`);
      storeResult = await storeDividendHistory(tickerUpper, dividends);
    }

    // Update ticker timestamp with fetch type
    await updateTickerTimestamp(tickerUpper, fetchType);

    const processingTime = Date.now() - startTime;
    
    console.log(`✓ Successfully processed ${tickerUpper} (${fetchType}) in ${processingTime}ms`);

    res.status(200).json({
      success: true,
      ticker: tickerUpper,
      action: 'processed',
      fetchType,
      dividends: {
        found: dividends.length,
        stored: storeResult.inserted,
        errors: storeResult.errors
      },
      requestId,
      processingTime,
      apiKeyName: req.apiKeyData?.name || 'Unknown'
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`Error processing ${tickerUpper}:`, error);
    
    res.status(500).json({
      success: false,
      ticker: tickerUpper,
      action: 'failed',
      fetchType,
      error: error.message,
      requestId,
      processingTime,
      apiKeyName: req.apiKeyData?.name || 'Unknown'
    });
  }
}

export default requireApiKey(handler);
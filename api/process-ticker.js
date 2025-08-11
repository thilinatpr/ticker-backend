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

  const { ticker, force = false } = req.body;

  if (!ticker) {
    return res.status(400).json({
      error: 'Ticker symbol is required',
      example: { ticker: 'AAPL', force: false }
    });
  }

  const tickerUpper = ticker.toUpperCase();
  const startTime = Date.now();

  try {
    console.log(`Processing ${tickerUpper} directly (force: ${force})`);

    // Check if ticker needs update (unless forced)
    if (!force) {
      const needsUpdate = await needsDividendUpdate(tickerUpper, force);
      if (!needsUpdate) {
        console.log(`${tickerUpper} doesn't need update, skipping`);
        return res.status(200).json({
          success: true,
          ticker: tickerUpper,
          action: 'skipped',
          reason: 'Recent data available',
          processingTime: Date.now() - startTime
        });
      }
    }

    // Fetch dividend data from Polygon API
    console.log(`Fetching dividend data for ${tickerUpper}...`);
    const dividends = await fetchPolygonDividends(tickerUpper);

    console.log(`Found ${dividends.length} dividend records for ${tickerUpper}`);

    // Store dividend data in database
    let storeResult = { inserted: 0, errors: 0 };
    if (dividends.length > 0) {
      console.log(`Storing ${dividends.length} dividend records for ${tickerUpper}`);
      storeResult = await storeDividendHistory(tickerUpper, dividends);
    }

    // Update ticker timestamp
    await updateTickerTimestamp(tickerUpper);

    const processingTime = Date.now() - startTime;
    
    console.log(`Successfully processed ${tickerUpper} in ${processingTime}ms`);

    res.status(200).json({
      success: true,
      ticker: tickerUpper,
      action: 'processed',
      dividends: {
        found: dividends.length,
        stored: storeResult.inserted,
        errors: storeResult.errors
      },
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
      error: error.message,
      processingTime,
      apiKeyName: req.apiKeyData?.name || 'Unknown'
    });
  }
}

export default requireApiKey(handler);
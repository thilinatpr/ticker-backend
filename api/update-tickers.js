/**
 * API endpoint for updating ticker dividend data in background
 * POST /api/update-tickers
 * Requires: X-API-Key header
 * Body: { tickers: ["AAPL", "MSFT", ...], priority?: number, force?: boolean }
 */

import { requireApiKey } from '../lib/auth.js';
import { setCorsHeaders } from '../middleware/cors.js';
import { 
  upsertTickers, 
  createDividendUpdateJob, 
  addTickersToQueue,
  getJobById 
} from '../lib/job-manager.js';

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

  const { tickers, priority = 0, force = false } = req.body;

  if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
    return res.status(400).json({
      error: 'Invalid request. Provide an array of ticker symbols.',
      example: { tickers: ['AAPL', 'MSFT'] }
    });
  }

  // Validate ticker symbols
  const validTickers = tickers.filter(ticker => {
    if (typeof ticker !== 'string') return false;
    const cleanTicker = ticker.trim().toUpperCase();
    return cleanTicker.length >= 1 && cleanTicker.length <= 10 && /^[A-Z]+$/.test(cleanTicker);
  });

  if (validTickers.length === 0) {
    return res.status(400).json({
      error: 'No valid ticker symbols provided. Tickers must be 1-10 letter strings.',
      received: tickers
    });
  }

  if (validTickers.length > 100) {
    return res.status(400).json({
      error: 'Too many tickers. Maximum 100 tickers per request.',
      received: validTickers.length
    });
  }

  try {
    // 1. Upsert tickers to database
    console.log(`Upserting ${validTickers.length} tickers...`);
    await upsertTickers(validTickers);

    // 2. Create background job for dividend updates
    console.log('Creating dividend update job...');
    const jobId = await createDividendUpdateJob(validTickers, priority, force);

    // 3. Add tickers to processing queue
    console.log(`Adding ${validTickers.length} tickers to job queue...`);
    await addTickersToQueue(jobId, validTickers, priority);

    // 4. Get job details for response
    const job = await getJobById(jobId);

    console.log(`Ticker update job ${jobId} initiated successfully`);

    res.status(202).json({
      success: true,
      jobId: jobId,
      message: `Ticker update initiated for ${validTickers.length} symbols. Dividend data will be processed in background.`,
      job: {
        id: job.id,
        status: job.status,
        totalTickers: job.total_tickers,
        processedTickers: job.processed_tickers,
        createdAt: job.created_at,
        estimatedCompletion: job.estimated_completion
      },
      tickers: validTickers,
      queuePosition: `Processing will begin within 1-2 minutes`,
      statusUrl: `/api/job-status/${jobId}`,
      apiKeyName: req.apiKeyData?.name || 'Unknown'
    });
    
  } catch (error) {
    console.error('Error creating ticker update job:', error);
    
    res.status(500).json({
      error: 'Failed to initiate ticker update',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      jobId: null
    });
  }
}

export default requireApiKey(handler);
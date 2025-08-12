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
import { sendTickerToQueue, shouldUseQueue } from '../lib/cloudflare-queue.js';

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
    // 1. Intelligent routing: Check BEFORE modifying database
    const newTickers = [];
    const existingTickers = [];
    const queueDecisions = [];

    console.log(`Checking queue routing for ${validTickers.length} tickers...`);
    for (const ticker of validTickers) {
      const decision = await shouldUseQueue(ticker);
      queueDecisions.push({ ticker, ...decision });
      
      if (decision.useQueue) {
        newTickers.push(ticker);
      } else {
        existingTickers.push(ticker);
      }
    }

    // 2. Upsert tickers to database AFTER routing decisions
    console.log(`Upserting ${validTickers.length} tickers...`);
    await upsertTickers(validTickers);

    console.log(`Routing: ${newTickers.length} new tickers to CF Queue, ${existingTickers.length} existing to traditional queue`);

    let queueResult = null;
    let jobId = null;
    
    // 3a. Send new tickers to Cloudflare Queue for instant processing
    if (newTickers.length > 0) {
      console.log(`Sending ${newTickers.length} new tickers to Cloudflare Queue...`);
      const queueSuccess = await sendTickerToQueue(newTickers, 'high', force);
      
      if (!queueSuccess) {
        console.log('CF Queue failed, falling back to traditional processing for new tickers');
        existingTickers.push(...newTickers);
        newTickers.length = 0;
      } else {
        queueResult = {
          tickers: newTickers,
          status: 'sent_to_queue',
          message: 'New tickers sent to Cloudflare Queue for instant processing'
        };
      }
    }

    // 3b. Create traditional background job for existing tickers
    if (existingTickers.length > 0) {
      console.log('Creating traditional dividend update job...');
      jobId = await createDividendUpdateJob(existingTickers, priority, force);
      
      console.log(`Adding ${existingTickers.length} tickers to job queue...`);
      await addTickersToQueue(jobId, existingTickers, priority);
    }

    // 4. Prepare response
    const response = {
      success: true,
      message: `Ticker update initiated for ${validTickers.length} symbols`,
      processing: {
        newTickers: newTickers.length,
        existingTickers: existingTickers.length,
        queueProcessing: queueResult ? newTickers.length : 0,
        traditionalProcessing: existingTickers.length
      },
      tickers: validTickers,
      queueDecisions,
      apiKeyName: req.apiKeyData?.name || 'Unknown'
    };

    // Add job details if traditional processing is used
    if (jobId) {
      const job = await getJobById(jobId);
      response.job = {
        id: job.id,
        status: job.status,
        totalTickers: job.total_tickers,
        processedTickers: job.processed_tickers,
        createdAt: job.created_at,
        estimatedCompletion: job.estimated_completion
      };
      response.jobId = jobId;
      response.statusUrl = `/api/job-status/${jobId}`;
    }

    // Add queue details if CF Queue is used
    if (queueResult) {
      response.queueResult = queueResult;
      response.message += '. New tickers are being processed instantly via Cloudflare Queue.';
    }

    console.log(`Hybrid ticker update initiated: ${newTickers.length} via queue, ${existingTickers.length} via jobs`);

    res.status(202).json(response);
    
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
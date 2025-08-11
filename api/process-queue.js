/**
 * Background job processor for dividend data updates
 * Processes items from the job queue with rate limiting
 * Called by Vercel cron job every minute
 */

import { setCorsHeaders } from '../middleware/cors.js';
import { 
  getNextQueueItems, 
  completeQueueItem, 
  failQueueItem,
  updateJobStatus,
  getJobById
} from '../lib/job-manager.js';
import { 
  fetchPolygonDividends, 
  needsDividendUpdate, 
  updateTickerTimestamp,
  getTimeUntilNextCall 
} from '../lib/polygon-api.js';
import { storeDividendHistory, supabase } from '../lib/supabase.js';

// Generate unique worker ID for this instance
const WORKER_ID = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

async function handler(req, res) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed. Use POST or GET.'
    });
  }

  const startTime = Date.now();
  let processed = 0;
  let failed = 0;
  let skipped = 0;
  const results = [];

  console.log(`[${WORKER_ID}] Starting queue processing...`);

  try {
    // Check if we can make API calls (rate limiting)
    const waitTime = await getTimeUntilNextCall();
    if (waitTime > 0) {
      console.log(`[${WORKER_ID}] Rate limited, waiting ${Math.ceil(waitTime/1000)} seconds`);
      return res.json({
        success: true,
        message: `Rate limited, next processing in ${Math.ceil(waitTime/1000)} seconds`,
        waitTime,
        processed: 0,
        failed: 0,
        skipped: 0
      });
    }

    // Get items from queue (limit to 5 to respect rate limits)
    const queueItems = await getNextQueueItems(5, WORKER_ID);
    
    if (queueItems.length === 0) {
      console.log(`[${WORKER_ID}] No items in queue`);
      return res.json({
        success: true,
        message: 'No items in queue to process',
        processed: 0,
        failed: 0,
        skipped: 0,
        processingTime: Date.now() - startTime
      });
    }

    console.log(`[${WORKER_ID}] Processing ${queueItems.length} queue items`);

    // Process each item
    for (const item of queueItems) {
      const itemStartTime = Date.now();
      
      try {
        console.log(`[${WORKER_ID}] Processing ${item.ticker_symbol} (attempt ${item.retry_count + 1})`);
        
        // Check if this ticker's job is still active
        const job = await getJobById(item.job_id);
        if (job.status !== 'pending') {
          console.log(`[${WORKER_ID}] Job ${item.job_id} is ${job.status}, skipping ${item.ticker_symbol}`);
          await completeQueueItem(item.id);
          skipped++;
          continue;
        }

        // Update job status to processing if not already
        if (job.status === 'pending') {
          await updateJobStatus(item.job_id, 'processing');
        }

        // Check if ticker needs update (unless forced)
        const forceUpdate = job.metadata?.force_update || false;
        if (!forceUpdate && !await needsDividendUpdate(item.ticker_symbol, forceUpdate)) {
          console.log(`[${WORKER_ID}] ${item.ticker_symbol} doesn't need update, skipping`);
          await completeQueueItem(item.id);
          
          // Increment job progress
          await updateJobProgress(item.job_id, 1, 0);
          
          skipped++;
          results.push({
            ticker: item.ticker_symbol,
            status: 'skipped',
            message: 'Recent data available',
            processingTime: Date.now() - itemStartTime
          });
          continue;
        }

        // Fetch dividend data from Polygon API
        console.log(`[${WORKER_ID}] Fetching dividend data for ${item.ticker_symbol}...`);
        const dividends = await fetchPolygonDividends(item.ticker_symbol);

        // Store dividend data in database
        if (dividends.length > 0) {
          console.log(`[${WORKER_ID}] Storing ${dividends.length} dividend records for ${item.ticker_symbol}`);
          await storeDividendHistory(item.ticker_symbol, dividends);
        }

        // Update ticker timestamp
        await updateTickerTimestamp(item.ticker_symbol);

        // Mark queue item as completed
        await completeQueueItem(item.id);

        // Update job progress
        await updateJobProgress(item.job_id, 1, 0);

        processed++;
        results.push({
          ticker: item.ticker_symbol,
          status: 'success',
          dividendsFound: dividends.length,
          processingTime: Date.now() - itemStartTime
        });

        console.log(`[${WORKER_ID}] Successfully processed ${item.ticker_symbol} (${dividends.length} dividends)`);

        // Add small delay between API calls to be respectful
        if (queueItems.indexOf(item) < queueItems.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`[${WORKER_ID}] Error processing ${item.ticker_symbol}:`, error.message);
        
        // Mark item as failed (will retry if under max attempts)
        await failQueueItem(item.id, error.message);
        
        // Update job progress with failure
        await updateJobProgress(item.job_id, 0, 1);

        failed++;
        results.push({
          ticker: item.ticker_symbol,
          status: 'failed',
          error: error.message,
          retryCount: item.retry_count + 1,
          processingTime: Date.now() - itemStartTime
        });
      }
    }

    // Check if any jobs are now complete
    await checkAndCompleteJobs(queueItems.map(item => item.job_id));

    const totalTime = Date.now() - startTime;
    console.log(`[${WORKER_ID}] Queue processing completed: ${processed} processed, ${failed} failed, ${skipped} skipped in ${totalTime}ms`);

    res.json({
      success: true,
      message: `Processed ${processed + failed + skipped} items from queue`,
      processed,
      failed,
      skipped,
      results,
      workerId: WORKER_ID,
      processingTime: totalTime
    });

  } catch (error) {
    console.error(`[${WORKER_ID}] Queue processing error:`, error);
    
    res.status(500).json({
      error: 'Queue processing failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      processed,
      failed,
      skipped,
      workerId: WORKER_ID,
      processingTime: Date.now() - startTime
    });
  }
}

/**
 * Update job progress counters
 * @param {number} jobId - Job ID
 * @param {number} completedIncrement - Number of completed items to add
 * @param {number} failedIncrement - Number of failed items to add
 * @returns {Promise<void>}
 */
async function updateJobProgress(jobId, completedIncrement, failedIncrement) {
  const job = await getJobById(jobId);
  
  await updateJobStatus(jobId, job.status, {
    processed_tickers: job.processed_tickers + completedIncrement,
    failed_tickers: job.failed_tickers + failedIncrement
  });
}

/**
 * Check if jobs are complete and update their status
 * @param {number[]} jobIds - Array of job IDs to check
 * @returns {Promise<void>}
 */
async function checkAndCompleteJobs(jobIds) {
  const uniqueJobIds = [...new Set(jobIds)];
  
  for (const jobId of uniqueJobIds) {
    try {
      const { data: queueCount, error } = await supabase
        .from('job_queue')
        .select('id')
        .eq('job_id', jobId);

      if (error) {
        console.error(`Error checking job ${jobId} completion:`, error);
        continue;
      }

      // If no queue items remain, mark job as completed
      if (queueCount.length === 0) {
        const job = await getJobById(jobId);
        const finalStatus = job.failed_tickers > 0 && job.processed_tickers === 0 ? 'failed' : 'completed';
        
        await updateJobStatus(jobId, finalStatus, {
          completed_at: new Date().toISOString()
        });
        
        console.log(`[${WORKER_ID}] Job ${jobId} marked as ${finalStatus}`);
      }
    } catch (error) {
      console.error(`Error completing job ${jobId}:`, error);
    }
  }
}

export default handler;
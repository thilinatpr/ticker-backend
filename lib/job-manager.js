/**
 * Job management functions for background dividend processing
 */

import { supabase } from './supabase.js';

/**
 * Upsert ticker symbols to the database
 * @param {string[]} tickers - Array of ticker symbols
 * @returns {Promise<void>}
 */
export async function upsertTickers(tickers) {
  const tickerRecords = tickers.map(ticker => ({
    symbol: ticker.toUpperCase(),
    is_active: true
  }));

  const { error } = await supabase
    .from('tickers')
    .upsert(tickerRecords, {
      onConflict: 'symbol',
      ignoreDuplicates: false
    });

  if (error) {
    throw new Error(`Failed to upsert tickers: ${error.message}`);
  }
}

/**
 * Create a new dividend update job
 * @param {string[]} tickers - Array of ticker symbols
 * @param {number} priority - Job priority (higher = more important)
 * @param {boolean} force - Force update even if recently updated
 * @returns {Promise<number>} Job ID
 */
export async function createDividendUpdateJob(tickers, priority = 0, force = false) {
  const now = new Date();
  const estimatedMinutes = Math.ceil(tickers.length * 0.2); // ~12 seconds per ticker due to rate limits
  const estimatedCompletion = new Date(now.getTime() + estimatedMinutes * 60000);

  const jobData = {
    job_type: 'dividend_update',
    status: 'pending',
    ticker_symbols: tickers.map(t => t.toUpperCase()),
    total_tickers: tickers.length,
    processed_tickers: 0,
    failed_tickers: 0,
    priority: priority,
    estimated_completion: estimatedCompletion.toISOString(),
    metadata: {
      force_update: force,
      created_by: 'api',
      rate_limit_service: 'polygon'
    }
  };

  const { data, error } = await supabase
    .from('api_jobs')
    .insert(jobData)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create job: ${error.message}`);
  }

  return data.id;
}

/**
 * Add tickers to the processing queue
 * @param {number} jobId - Job ID
 * @param {string[]} tickers - Array of ticker symbols  
 * @param {number} priority - Queue priority
 * @returns {Promise<void>}
 */
export async function addTickersToQueue(jobId, tickers, priority = 0) {
  const queueItems = tickers.map((ticker, index) => ({
    job_id: jobId,
    ticker_symbol: ticker.toUpperCase(),
    priority: priority,
    retry_count: 0,
    max_retries: 3,
    scheduled_at: new Date().toISOString() // Process immediately
  }));

  const { error } = await supabase
    .from('job_queue')
    .insert(queueItems);

  if (error) {
    throw new Error(`Failed to add tickers to queue: ${error.message}`);
  }
}

/**
 * Get job details by ID
 * @param {number} jobId - Job ID
 * @returns {Promise<object>} Job details
 */
export async function getJobById(jobId) {
  const { data, error } = await supabase
    .from('api_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    throw new Error(`Failed to get job: ${error.message}`);
  }

  return data;
}

/**
 * Update job status and statistics
 * @param {number} jobId - Job ID
 * @param {string} status - New status
 * @param {object} updates - Additional fields to update
 * @returns {Promise<void>}
 */
export async function updateJobStatus(jobId, status, updates = {}) {
  const updateData = {
    status,
    ...updates
  };

  if (status === 'processing' && !updates.started_at) {
    updateData.started_at = new Date().toISOString();
  }

  if (status === 'completed' || status === 'failed') {
    updateData.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('api_jobs')
    .update(updateData)
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update job status: ${error.message}`);
  }
}

/**
 * Get next items from processing queue
 * @param {number} limit - Maximum items to retrieve
 * @param {string} workerId - Worker/instance identifier
 * @returns {Promise<object[]>} Queue items
 */
export async function getNextQueueItems(limit = 1, workerId = 'default') {
  const now = new Date().toISOString();
  const lockTimeout = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago

  // Get unlocked items or items with expired locks
  const { data, error } = await supabase
    .from('job_queue')
    .select(`
      *,
      api_jobs!inner(status, job_type)
    `)
    .or(`locked_at.is.null,locked_at.lt.${lockTimeout}`)
    .lte('scheduled_at', now)
    .eq('api_jobs.status', 'pending')
    .lt('retry_count', supabase.raw('max_retries'))
    .order('priority', { ascending: false })
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get queue items: ${error.message}`);
  }

  if (data.length === 0) {
    return [];
  }

  // Lock the items for processing
  const itemIds = data.map(item => item.id);
  const { error: lockError } = await supabase
    .from('job_queue')
    .update({
      locked_at: now,
      locked_by: workerId
    })
    .in('id', itemIds);

  if (lockError) {
    throw new Error(`Failed to lock queue items: ${lockError.message}`);
  }

  return data;
}

/**
 * Mark queue item as completed
 * @param {number} queueItemId - Queue item ID
 * @returns {Promise<void>}
 */
export async function completeQueueItem(queueItemId) {
  const { error } = await supabase
    .from('job_queue')
    .delete()
    .eq('id', queueItemId);

  if (error) {
    throw new Error(`Failed to complete queue item: ${error.message}`);
  }
}

/**
 * Mark queue item as failed and increment retry count
 * @param {number} queueItemId - Queue item ID
 * @param {string} errorMessage - Error description
 * @returns {Promise<void>}
 */
export async function failQueueItem(queueItemId, errorMessage) {
  // Get current item to check retry count
  const { data: item, error: getError } = await supabase
    .from('job_queue')
    .select('retry_count, max_retries')
    .eq('id', queueItemId)
    .single();

  if (getError) {
    throw new Error(`Failed to get queue item: ${getError.message}`);
  }

  if (item.retry_count >= item.max_retries - 1) {
    // Max retries reached, delete item
    const { error: deleteError } = await supabase
      .from('job_queue')
      .delete()
      .eq('id', queueItemId);

    if (deleteError) {
      throw new Error(`Failed to delete failed queue item: ${deleteError.message}`);
    }
  } else {
    // Increment retry count and reschedule
    const retryDelay = Math.pow(2, item.retry_count) * 60000; // Exponential backoff in minutes
    const nextScheduled = new Date(Date.now() + retryDelay).toISOString();

    const { error: updateError } = await supabase
      .from('job_queue')
      .update({
        retry_count: item.retry_count + 1,
        error_message: errorMessage,
        scheduled_at: nextScheduled,
        locked_at: null,
        locked_by: null
      })
      .eq('id', queueItemId);

    if (updateError) {
      throw new Error(`Failed to retry queue item: ${updateError.message}`);
    }
  }
}

/**
 * Get job progress and status
 * @param {number} jobId - Job ID
 * @returns {Promise<object>} Job progress details
 */
export async function getJobProgress(jobId) {
  const { data: job, error: jobError } = await supabase
    .from('api_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError) {
    throw new Error(`Failed to get job: ${jobError.message}`);
  }

  // Get queue status
  const { data: queueItems, error: queueError } = await supabase
    .from('job_queue')
    .select('ticker_symbol, retry_count, scheduled_at, locked_at, error_message')
    .eq('job_id', jobId);

  if (queueError) {
    throw new Error(`Failed to get queue status: ${queueError.message}`);
  }

  const remainingItems = queueItems.length;
  const processingItems = queueItems.filter(item => item.locked_at).length;
  const failedItems = queueItems.filter(item => item.retry_count > 0).length;

  return {
    job,
    progress: {
      total: job.total_tickers,
      completed: job.processed_tickers,
      failed: job.failed_tickers,
      remaining: remainingItems,
      processing: processingItems,
      percentComplete: job.total_tickers > 0 ? Math.round((job.processed_tickers / job.total_tickers) * 100) : 0
    },
    queueItems
  };
}
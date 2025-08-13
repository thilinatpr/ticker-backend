/**
 * API endpoint for checking job status and progress
 * GET /api/job-status/:jobId
 * Requires: X-API-Key header
 */

import { requireApiKey } from '../../lib/auth.js';
import { setCorsHeaders } from '../../middleware/cors.js';
import { getJobProgress, getJobById } from '../../lib/job-manager.js';

async function handler(req, res) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed. Use GET.'
    });
  }

  const { jobId } = req.query;

  if (!jobId) {
    return res.status(400).json({
      error: 'Job ID is required'
    });
  }

  const jobIdNumber = parseInt(jobId);
  if (isNaN(jobIdNumber)) {
    return res.status(400).json({
      error: 'Invalid job ID. Must be a number.'
    });
  }

  try {
    // Get detailed job progress
    const jobData = await getJobProgress(jobIdNumber);
    
    if (!jobData.job) {
      return res.status(404).json({
        error: `Job not found: ${jobIdNumber}`
      });
    }

    const { job, progress, queueItems } = jobData;
    
    // Calculate estimated completion time
    let estimatedCompletion = null;
    if (job.status === 'processing' && progress.remaining > 0) {
      // Estimate based on average processing time (12 seconds per ticker due to rate limits)
      const estimatedMinutes = Math.ceil(progress.remaining * 0.2);
      estimatedCompletion = new Date(Date.now() + estimatedMinutes * 60000).toISOString();
    }

    // Get some sample failed/processing items for debugging
    const failedItems = queueItems.filter(item => item.retry_count > 0).slice(0, 5);
    const processingItems = queueItems.filter(item => item.locked_at).slice(0, 5);

    const response = {
      jobId: job.id,
      status: job.status,
      jobType: job.job_type,
      progress: {
        total: progress.total,
        completed: progress.completed,
        failed: progress.failed,
        remaining: progress.remaining,
        processing: progress.processing,
        percentComplete: progress.percentComplete
      },
      timing: {
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        estimatedCompletion: estimatedCompletion || job.estimated_completion,
        elapsedTime: calculateElapsedTime(job.created_at, job.completed_at)
      },
      tickers: job.ticker_symbols,
      priority: job.priority,
      metadata: job.metadata || {},
      errorMessage: job.error_message,
      queue: {
        totalItems: queueItems.length,
        failedItems: failedItems.map(item => ({
          ticker: item.ticker_symbol,
          retryCount: item.retry_count,
          errorMessage: item.error_message,
          nextScheduled: item.scheduled_at
        })),
        processingItems: processingItems.map(item => ({
          ticker: item.ticker_symbol,
          lockedAt: item.locked_at
        }))
      },
      apiKeyName: req.apiKeyData?.name || 'Unknown'
    };

    // Add status-specific information
    if (job.status === 'completed') {
      response.summary = {
        message: `Successfully processed ${progress.completed} of ${progress.total} tickers`,
        successRate: progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0,
        failureRate: progress.total > 0 ? Math.round((progress.failed / progress.total) * 100) : 0
      };
    } else if (job.status === 'processing') {
      response.summary = {
        message: `Processing ${progress.total} tickers, ${progress.completed} completed, ${progress.remaining} remaining`,
        estimatedTimeRemaining: estimatedCompletion ? formatTimeRemaining(estimatedCompletion) : 'Calculating...'
      };
    } else if (job.status === 'failed') {
      response.summary = {
        message: `Job failed: ${job.error_message || 'Unknown error'}`,
        partialResults: progress.completed > 0 ? `${progress.completed} tickers were processed before failure` : null
      };
    } else if (job.status === 'pending') {
      response.summary = {
        message: `Job queued with ${progress.total} tickers, processing will begin shortly`
      };
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching job status:', error);
    
    res.status(500).json({
      error: 'Failed to get job status',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      jobId: jobIdNumber
    });
  }
}

/**
 * Calculate elapsed time in human-readable format
 * @param {string} startTime - ISO timestamp
 * @param {string} endTime - ISO timestamp (optional, defaults to now)
 * @returns {string} Human-readable duration
 */
function calculateElapsedTime(startTime, endTime = null) {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const diffMs = end - start;
  
  if (diffMs < 1000) {
    return `${diffMs}ms`;
  } else if (diffMs < 60000) {
    return `${Math.round(diffMs / 1000)}s`;
  } else if (diffMs < 3600000) {
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.round((diffMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  } else {
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.round((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Format time remaining until completion
 * @param {string} futureTime - ISO timestamp
 * @returns {string} Human-readable time remaining
 */
function formatTimeRemaining(futureTime) {
  const now = new Date();
  const future = new Date(futureTime);
  const diffMs = future - now;
  
  if (diffMs <= 0) {
    return 'Should complete soon';
  }
  
  if (diffMs < 60000) {
    return `~${Math.ceil(diffMs / 1000)} seconds`;
  } else if (diffMs < 3600000) {
    return `~${Math.ceil(diffMs / 60000)} minutes`;
  } else {
    return `~${Math.ceil(diffMs / 3600000)} hours`;
  }
}

export default requireApiKey(handler);
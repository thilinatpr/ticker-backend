/**
 * API endpoint for listing and managing jobs
 * GET /api/jobs - List all jobs with optional filtering
 * DELETE /api/jobs/:jobId - Cancel a job (if still pending)
 * Requires: X-API-Key header
 */

import { requireApiKey } from '../lib/auth.js';
import { setCorsHeaders } from '../middleware/cors.js';
import { supabase } from '../lib/supabase.js';
import { updateJobStatus } from '../lib/job-manager.js';

async function handler(req, res) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return handleGetJobs(req, res);
  } else if (req.method === 'DELETE') {
    return handleCancelJob(req, res);
  } else {
    return res.status(405).json({
      error: 'Method not allowed. Use GET or DELETE.'
    });
  }
}

/**
 * Handle GET /api/jobs - List jobs with filtering
 */
async function handleGetJobs(req, res) {
  const { 
    status, 
    job_type, 
    limit = 50, 
    offset = 0,
    sort = 'created_at',
    order = 'desc'
  } = req.query;

  try {
    // Build query
    let query = supabase
      .from('api_jobs')
      .select(`
        id,
        job_type,
        status,
        ticker_symbols,
        total_tickers,
        processed_tickers,
        failed_tickers,
        priority,
        created_at,
        started_at,
        completed_at,
        estimated_completion,
        error_message,
        metadata
      `)
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (job_type) {
      query = query.eq('job_type', job_type);
    }

    // Apply sorting
    const validSortFields = ['created_at', 'started_at', 'completed_at', 'priority', 'total_tickers'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc';
    
    query = query.order(sortField, { ascending: sortOrder });

    const { data: jobs, error } = await query;

    if (error) {
      throw error;
    }

    // Get summary statistics
    const { data: stats, error: statsError } = await supabase
      .from('api_jobs')
      .select('status, job_type')
      .not('status', 'eq', 'cancelled'); // Exclude cancelled jobs from stats

    if (statsError) {
      console.error('Error fetching job stats:', statsError);
    }

    const summary = stats ? {
      total: stats.length,
      byStatus: stats.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {}),
      byType: stats.reduce((acc, job) => {
        acc[job.job_type] = (acc[job.job_type] || 0) + 1;
        return acc;
      }, {})
    } : null;

    // Transform jobs data
    const transformedJobs = jobs.map(job => ({
      id: job.id,
      type: job.job_type,
      status: job.status,
      progress: {
        total: job.total_tickers,
        completed: job.processed_tickers,
        failed: job.failed_tickers,
        percentComplete: job.total_tickers > 0 ? Math.round((job.processed_tickers / job.total_tickers) * 100) : 0
      },
      tickerCount: job.ticker_symbols?.length || 0,
      priority: job.priority,
      timing: {
        created: job.created_at,
        started: job.started_at,
        completed: job.completed_at,
        estimated: job.estimated_completion
      },
      error: job.error_message,
      canCancel: job.status === 'pending',
      metadata: job.metadata
    }));

    res.status(200).json({
      jobs: transformedJobs,
      pagination: {
        offset: parseInt(offset),
        limit: parseInt(limit),
        total: jobs.length
      },
      summary,
      filters: {
        status,
        job_type,
        sort,
        order
      },
      apiKeyName: req.apiKeyData?.name || 'Unknown'
    });

  } catch (error) {
    console.error('Error fetching jobs:', error);
    
    res.status(500).json({
      error: 'Failed to fetch jobs',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Handle DELETE /api/jobs?jobId=123 - Cancel a job
 */
async function handleCancelJob(req, res) {
  const { jobId } = req.query;

  if (!jobId) {
    return res.status(400).json({
      error: 'Job ID is required as query parameter'
    });
  }

  const jobIdNumber = parseInt(jobId);
  if (isNaN(jobIdNumber)) {
    return res.status(400).json({
      error: 'Invalid job ID. Must be a number.'
    });
  }

  try {
    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('api_jobs')
      .select('*')
      .eq('id', jobIdNumber)
      .single();

    if (jobError || !job) {
      return res.status(404).json({
        error: `Job not found: ${jobIdNumber}`
      });
    }

    if (job.status !== 'pending') {
      return res.status(400).json({
        error: `Cannot cancel job with status: ${job.status}. Only pending jobs can be cancelled.`,
        currentStatus: job.status
      });
    }

    // Cancel the job
    await updateJobStatus(jobIdNumber, 'cancelled', {
      error_message: 'Job cancelled by user',
      completed_at: new Date().toISOString()
    });

    // Remove associated queue items
    const { error: queueError } = await supabase
      .from('job_queue')
      .delete()
      .eq('job_id', jobIdNumber);

    if (queueError) {
      console.error('Error removing queue items:', queueError);
      // Don't fail the request, job is already cancelled
    }

    console.log(`Job ${jobIdNumber} cancelled successfully`);

    res.status(200).json({
      success: true,
      message: `Job ${jobIdNumber} has been cancelled`,
      jobId: jobIdNumber,
      previousStatus: job.status,
      currentStatus: 'cancelled',
      apiKeyName: req.apiKeyData?.name || 'Unknown'
    });

  } catch (error) {
    console.error('Error cancelling job:', error);
    
    res.status(500).json({
      error: 'Failed to cancel job',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      jobId: jobIdNumber
    });
  }
}

export default requireApiKey(handler);
# Dividend Tracking System Implementation Guide

This guide covers the comprehensive dividend tracking system with background processing and rate limiting.

## Architecture Overview

The system implements a queue-based architecture for processing dividend data with Polygon API integration:

1. **Frontend API** → Accepts ticker update requests
2. **Job Manager** → Creates jobs and manages queue
3. **Background Processor** → Processes queue items with rate limiting
4. **Database** → Stores jobs, queue, rate limits, and dividend data
5. **Monitoring** → Job status and progress tracking

## Database Setup

### 1. Run the Enhanced Schema

Execute the enhanced schema to set up all required tables:

```bash
# Run this in your Supabase SQL editor
psql -f sql/enhanced-schema.sql
```

This creates:
- `tickers` - Tracks managed ticker symbols
- `api_jobs` - Background job tracking 
- `job_queue` - Processing queue with retry logic
- `rate_limits` - API rate limiting
- `api_call_logs` - API call monitoring

### 2. Environment Variables

Add these to your `.env.local` and Vercel environment:

```env
# Existing variables
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# New required variable
POLYGON_API_KEY=your_polygon_api_key
```

## API Endpoints

### Primary Endpoints

1. **POST /api/update-tickers** - Submit tickers for background processing
2. **GET /api/job-status/[jobId]** - Check job progress and status
3. **GET /api/jobs** - List all jobs with filtering
4. **DELETE /api/jobs?jobId=123** - Cancel pending jobs
5. **POST /api/process-queue** - Background processor (called by cron)

### Legacy Endpoint (Enhanced)

- **GET /api/dividends/[ticker]** - Get dividend data (now from database)

## Usage Examples

### 1. Submit Tickers for Processing

```bash
curl -X POST https://your-domain/api/update-tickers \
  -H "X-API-Key: tk_demo_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "tickers": ["AAPL", "MSFT", "GOOGL"],
    "priority": 1,
    "force": false
  }'
```

Response:
```json
{
  "success": true,
  "jobId": 123,
  "message": "Ticker update initiated for 3 symbols",
  "job": {
    "id": 123,
    "status": "pending", 
    "totalTickers": 3,
    "processedTickers": 0,
    "createdAt": "2024-01-15T10:30:00Z",
    "estimatedCompletion": "2024-01-15T10:31:00Z"
  },
  "statusUrl": "/api/job-status/123"
}
```

### 2. Check Job Status

```bash
curl -H "X-API-Key: tk_demo_key_12345" \
  https://your-domain/api/job-status/123
```

Response:
```json
{
  "jobId": 123,
  "status": "processing",
  "progress": {
    "total": 3,
    "completed": 1,
    "failed": 0,
    "remaining": 2,
    "percentComplete": 33
  },
  "timing": {
    "createdAt": "2024-01-15T10:30:00Z",
    "startedAt": "2024-01-15T10:30:15Z",
    "estimatedCompletion": "2024-01-15T10:31:30Z"
  },
  "summary": {
    "message": "Processing 3 tickers, 1 completed, 2 remaining",
    "estimatedTimeRemaining": "~1 minutes"
  }
}
```

### 3. List All Jobs

```bash
curl -H "X-API-Key: tk_demo_key_12345" \
  "https://your-domain/api/jobs?status=completed&limit=10"
```

## Background Processing

### How It Works

1. **Cron Trigger**: Vercel cron runs every minute
2. **Queue Processing**: Gets up to 5 items from queue
3. **Rate Limiting**: Respects 5 calls/minute Polygon API limit
4. **Error Handling**: Retries failed items with exponential backoff
5. **Job Completion**: Updates job status when queue is empty

### Rate Limiting Strategy

- **Polygon API**: 5 calls per minute maximum
- **Queue Batching**: Process 5 tickers per minute
- **Smart Scheduling**: Skip recently updated tickers
- **Retry Logic**: Failed items retry with backoff

### Monitoring

Check processing status via:
- Job status endpoints
- Database queries on `api_call_logs`
- Vercel function logs

## Testing

### 1. Test the Full Flow

```bash
# 1. Submit job
job_response=$(curl -s -X POST https://your-domain/api/update-tickers \
  -H "X-API-Key: tk_demo_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["AAPL"]}')

job_id=$(echo $job_response | jq -r '.jobId')

# 2. Check status
curl -H "X-API-Key: tk_demo_key_12345" \
  https://your-domain/api/job-status/$job_id

# 3. Wait for completion (or trigger processing manually)
curl -X POST https://your-domain/api/process-queue

# 4. Check dividend data
curl -H "X-API-Key: tk_demo_key_12345" \
  https://your-domain/api/dividends/AAPL
```

### 2. Database Testing

```sql
-- Check job status
SELECT * FROM api_jobs ORDER BY created_at DESC LIMIT 5;

-- Check queue items
SELECT jq.*, aj.status as job_status 
FROM job_queue jq 
JOIN api_jobs aj ON jq.job_id = aj.id 
ORDER BY jq.scheduled_at;

-- Check rate limits
SELECT * FROM rate_limits;

-- Check recent API calls
SELECT * FROM api_call_logs 
ORDER BY created_at DESC LIMIT 10;
```

## Deployment Checklist

### Before Deploying

- [ ] Set `POLYGON_API_KEY` in Vercel environment
- [ ] Run enhanced schema in Supabase
- [ ] Test with demo API key locally
- [ ] Verify cron job configuration

### After Deploying

- [ ] Test ticker submission endpoint
- [ ] Verify cron job triggers every minute
- [ ] Check rate limiting works correctly
- [ ] Monitor first few dividend fetches
- [ ] Test job cancellation

### Production Considerations

1. **API Key Management**: Use production Polygon API key
2. **Rate Monitoring**: Monitor API usage to stay under limits
3. **Error Alerting**: Set up alerts for failed jobs
4. **Database Performance**: Monitor query performance on large datasets
5. **Cost Management**: Track Polygon API costs

## Troubleshooting

### Common Issues

1. **Rate Limit Errors**: Check `rate_limits` table, ensure only 5 calls/minute
2. **Job Stuck Pending**: Manually trigger `/api/process-queue`
3. **Authentication Errors**: Verify Polygon API key is valid
4. **Queue Not Processing**: Check Vercel cron job logs
5. **Database Errors**: Verify Supabase connection and permissions

### Debug Commands

```bash
# Check queue status
curl -H "X-API-Key: tk_demo_key_12345" \
  https://your-domain/api/jobs?status=processing

# Manually trigger processing
curl -X POST https://your-domain/api/process-queue

# Cancel problematic job
curl -X DELETE https://your-domain/api/jobs?jobId=123 \
  -H "X-API-Key: tk_demo_key_12345"
```

## Performance Optimization

### Database Indexes

The enhanced schema includes optimized indexes for:
- Ticker symbol lookups
- Date range queries  
- Job status filtering
- Queue processing

### Caching Strategy

- Recent dividend data is cached in database
- Tickers are only updated if data is stale (24 hours default)
- Rate limit counters prevent unnecessary API calls

### Scaling Considerations

- Current system handles ~300 tickers/hour (5/minute * 60 minutes)
- For more throughput, consider upgrading Polygon plan
- Queue can handle thousands of tickers with proper batching

## Integration with Google Apps Script

The existing Apps Script client will work seamlessly - it continues to call `/api/dividends/[ticker]` which now returns database-stored data instead of mock data.

No changes needed to existing Google Sheets integrations.
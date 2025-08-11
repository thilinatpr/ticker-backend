# 🚀 Deployment Guide - Dividend Tracking System

This guide covers complete deployment of the dividend tracking system to Vercel with all environment variables and database setup.

## Pre-Deployment Checklist

### 1. Database Setup
- [ ] Run `sql/setup-complete-enhanced.sql` in Supabase SQL Editor
- [ ] Verify setup with `npm run validate`
- [ ] Confirm all tables and functions are created

### 2. Environment Variables
- [ ] `SUPABASE_URL` - Your Supabase project URL
- [ ] `SUPABASE_ANON_KEY` - Your Supabase anonymous key  
- [ ] `POLYGON_API_KEY` - Your Polygon.io API key (required for dividend data)

### 3. Local Testing
- [ ] Test core functions: `npm run test:core`
- [ ] Validate database: `npm run validate`

---

## Environment Setup

### Option 1: Copy from .env.example
```bash
# Copy and edit environment file
cp .env.example .env.local

# Edit .env.local with your actual values:
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_ANON_KEY=your_anon_key
# POLYGON_API_KEY=your_polygon_key
```

### Option 2: Manual .env.local Creation
```bash
# Create .env.local with these variables:
cat > .env.local << 'EOF'
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# Polygon API Configuration (Required)
POLYGON_API_KEY=your_polygon_api_key

# Environment
NODE_ENV=development

# Testing (Optional)
TEST_BASE_URL=http://localhost:3000
TEST_API_KEY=tk_demo_key_12345
EOF
```

---

## Database Setup Instructions

### 1. Access Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Navigate to "SQL Editor" 
3. Create a new query

### 2. Run Complete Setup SQL
```sql
-- Copy and paste the entire contents of:
-- sql/setup-complete-enhanced.sql
-- into the SQL editor and run it
```

### 3. Verify Setup
Run locally to confirm database is ready:
```bash
npm run validate
```

You should see all ✅ marks for validation.

---

## Vercel Deployment

### 1. Install Vercel CLI (if not already installed)
```bash
npm i -g vercel
```

### 2. Link Project to Vercel
```bash
# In project root
vercel link
```

### 3. Set Environment Variables in Vercel
```bash
# Set all required environment variables
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY  
vercel env add POLYGON_API_KEY
vercel env add NODE_ENV

# When prompted:
# - SUPABASE_URL: Enter your Supabase project URL
# - SUPABASE_ANON_KEY: Enter your Supabase anonymous key
# - POLYGON_API_KEY: Enter your Polygon.io API key
# - NODE_ENV: Enter "production"
```

### 4. Deploy to Vercel
```bash
vercel --prod
```

### Alternative: Auto-Deploy via Vercel Dashboard
1. Import your GitHub repository to Vercel
2. In Project Settings → Environment Variables, add:
   - `SUPABASE_URL` = `https://your-project.supabase.co`
   - `SUPABASE_ANON_KEY` = `your_supabase_anon_key`
   - `POLYGON_API_KEY` = `your_polygon_api_key`
   - `NODE_ENV` = `production`
3. Deploy from dashboard

---

## Post-Deployment Testing

### 1. Test Health Endpoint
```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "service": "ticker-backend",
  "version": "1.0.0",
  "features": [
    "dividend-tracking",
    "background-processing", 
    "rate-limiting",
    "job-management"
  ]
}
```

### 2. Test Dividend Data (Legacy Endpoint)
```bash
curl -H "X-API-Key: tk_demo_key_12345" \
  "https://your-app.vercel.app/api/dividends/AAPL?fallback=true"
```

### 3. Submit Test Job
```bash
curl -X POST https://your-app.vercel.app/api/update-tickers \
  -H "X-API-Key: tk_demo_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["AAPL"], "priority": 1}'
```

Expected response:
```json
{
  "success": true,
  "jobId": 123,
  "message": "Ticker update initiated for 1 symbols",
  "statusUrl": "/api/job-status/123"
}
```

### 4. Check Job Status
```bash
curl -H "X-API-Key: tk_demo_key_12345" \
  https://your-app.vercel.app/api/job-status/123
```

### 5. Monitor Background Processing
The cron job runs automatically every minute. Check logs in Vercel dashboard or query the database:

```sql
-- Check recent jobs
SELECT * FROM api_jobs ORDER BY created_at DESC LIMIT 5;

-- Check queue status  
SELECT * FROM job_queue ORDER BY created_at DESC LIMIT 5;

-- Check API call logs
SELECT * FROM api_call_logs ORDER BY created_at DESC LIMIT 5;
```

---

## Monitoring & Maintenance

### 1. Vercel Dashboard Monitoring
- Functions tab: Monitor cron job execution
- Analytics: Track API usage and performance  
- Logs: Debug issues in real-time

### 2. Database Monitoring
```sql
-- Monitor rate limiting
SELECT service_name, calls_this_minute, calls_this_hour, calls_today 
FROM rate_limits;

-- Check job success rates
SELECT 
    status,
    COUNT(*) as count,
    AVG(processed_tickers::float / NULLIF(total_tickers, 0)) * 100 as avg_success_rate
FROM api_jobs 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Recent dividend updates
SELECT ticker, COUNT(*) as dividend_count, MAX(created_at) as last_updated
FROM dividends 
WHERE data_source = 'polygon'
GROUP BY ticker
ORDER BY last_updated DESC;
```

### 3. Key Metrics to Monitor
- **API Call Rate**: Should not exceed 5/minute for Polygon
- **Job Success Rate**: Should be >90% under normal conditions
- **Queue Length**: Should stay low (under 100 items)
- **Error Rate**: Monitor failed jobs and API errors

---

## Troubleshooting

### Common Issues

#### 1. "Row Level Security Policy Violation"
- **Cause**: Database policies not set correctly
- **Fix**: Re-run `sql/setup-complete-enhanced.sql`

#### 2. "Cannot find function increment_rate_limit_counters"  
- **Cause**: Database functions not created
- **Fix**: Run the complete SQL setup script

#### 3. "Rate limit exceeded" 
- **Cause**: Making too many API calls to Polygon
- **Fix**: This is expected behavior, system will auto-throttle

#### 4. "Job stuck in pending status"
- **Cause**: Cron job not running
- **Fix**: Check Vercel cron configuration in dashboard

#### 5. "No dividend data found"
- **Cause**: No data in database yet, or invalid ticker
- **Fix**: Submit tickers via `/api/update-tickers` first

### Debug Commands

```bash
# Check all jobs status
curl -H "X-API-Key: tk_demo_key_12345" \
  "https://your-app.vercel.app/api/jobs?limit=10"

# Manually trigger processing  
curl -X POST https://your-app.vercel.app/api/process-queue

# Cancel stuck job
curl -X DELETE "https://your-app.vercel.app/api/jobs?jobId=123" \
  -H "X-API-Key: tk_demo_key_12345"
```

---

## Production Optimization

### 1. API Key Management
- Use production Polygon API key with higher limits
- Consider multiple API keys for redundancy
- Monitor usage to avoid overages

### 2. Database Performance
- Monitor query performance in Supabase
- Consider archiving old job records
- Optimize indexes as data grows

### 3. Cost Management
- Monitor Polygon API usage and costs
- Set up alerts for high usage periods
- Consider caching strategies for frequently requested data

### 4. Scaling Considerations
- Current system handles ~300 tickers/hour
- For more throughput, consider:
  - Upgrading Polygon plan
  - Multiple processing workers
  - Regional deployment

---

## Success Criteria

✅ **Deployment is successful when:**
- Health endpoint returns 200 OK
- Test job completes successfully  
- Cron job processes queue every minute
- Dividend data appears in database
- No RLS or permission errors in logs

✅ **System is production-ready when:**
- All monitoring metrics are healthy
- Error rate < 5%
- Jobs complete within estimated time
- API rate limits are respected
- Google Sheets integration works seamlessly

---

## Support

If you encounter issues:
1. Check Vercel function logs
2. Query database for error patterns  
3. Review this troubleshooting guide
4. Test with smaller ticker sets first

The system is designed to be self-healing with retries and graceful error handling.
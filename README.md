# Stock Ticker Dividend History API

A production-ready Express.js API deployed on Vercel that provides stock dividend history data with background job processing, database persistence, and Google Apps Script integration.

🚀 **Live API:** https://ticker-backend-cs2vqvtkl-thilinas-projects-f6f25033.vercel.app

## Features

- **🔐 API Key Authentication** - Secure access with rate limiting and usage tracking
- **📈 Dividend History** - Real-time dividend data from Polygon API with Supabase persistence
- **⚙️ Background Job Processing** - Asynchronous ticker updates with queue management
- **📊 Job Monitoring** - Real-time job status, progress tracking, and error handling
- **🔄 Automated Updates** - Daily cron job processing for data freshness
- **📋 Google Sheets Integration** - Ready-to-use Apps Script client
- **🗄️ Database Backend** - PostgreSQL via Supabase with comprehensive schema
- **⚡ Rate Limiting** - Respects external API limits and implements client throttling

## Authentication

All endpoints (except health check) require an API key. Include it in your requests:

**Header Method:**
```bash
X-API-Key: your_api_key_here
```

**Bearer Token Method:**
```bash
Authorization: Bearer your_api_key_here
```

### Demo API Keys

For testing purposes, you can use these demo keys:

- **Demo Key**: `tk_demo_key_12345` (100 requests/hour)
- **Test Key**: `tk_test_67890` (50 requests/hour)

## API Endpoints

### Core Endpoints

#### Health Check (No Auth Required)
```bash
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-08-11T07:34:25.413Z",
  "service": "ticker-backend",
  "version": "1.0.0"
}
```

#### Get Dividend History (Auth Required)
```bash
# Basic request
curl -H "X-API-Key: tk_demo_key_12345" \
  "https://ticker-backend-cs2vqvtkl-thilinas-projects-f6f25033.vercel.app/api/dividends/AAPL"

# With date filtering and fallback data
curl -H "X-API-Key: tk_demo_key_12345" \
  "https://ticker-backend-cs2vqvtkl-thilinas-projects-f6f25033.vercel.app/api/dividends/AAPL?startDate=2024-01-01&fallback=true"
```

Response:
```json
{
  "ticker": "AAPL",
  "dividends": [
    {
      "declarationDate": "2024-05-02",
      "recordDate": "2024-05-13",
      "exDividendDate": "2024-05-10",
      "payDate": "2024-05-16",
      "amount": 0.24,
      "currency": "USD",
      "frequency": 4,
      "type": "Cash"
    }
  ],
  "totalRecords": 2,
  "dataSource": "database",
  "apiKeyName": "Demo Key"
}
```

### Background Job Endpoints

#### Submit Background Job
```bash
curl -X POST \
  -H "X-API-Key: tk_demo_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["AAPL", "MSFT"], "priority": 1}' \
  "https://ticker-backend-cs2vqvtkl-thilinas-projects-f6f25033.vercel.app/api/update-tickers"
```

Response:
```json
{
  "success": true,
  "jobId": 4,
  "message": "Ticker update initiated for 2 symbols. Dividend data will be processed in background.",
  "job": {
    "id": 4,
    "status": "pending",
    "totalTickers": 2,
    "processedTickers": 0,
    "createdAt": "2025-08-11T07:34:56.489014+00:00",
    "estimatedCompletion": "2025-08-11T07:35:56.401+00:00"
  },
  "statusUrl": "/api/job-status/4"
}
```

#### Check Job Status
```bash
curl -H "X-API-Key: tk_demo_key_12345" \
  "https://ticker-backend-cs2vqvtkl-thilinas-projects-f6f25033.vercel.app/api/job-status/4"
```

Response:
```json
{
  "jobId": 4,
  "status": "pending",
  "progress": {
    "total": 2,
    "completed": 0,
    "failed": 0,
    "percentComplete": 0
  },
  "timing": {
    "createdAt": "2025-08-11T07:34:56.489014+00:00",
    "estimatedCompletion": "2025-08-11T07:35:56.401+00:00"
  },
  "tickers": ["AAPL", "MSFT"],
  "apiKeyName": "Demo Key"
}
```

#### List Jobs
```bash
curl -H "X-API-Key: tk_demo_key_12345" \
  "https://ticker-backend-cs2vqvtkl-thilinas-projects-f6f25033.vercel.app/api/jobs?limit=5&status=pending"
```

#### Cancel Job
```bash
curl -X DELETE \
  -H "X-API-Key: tk_demo_key_12345" \
  "https://ticker-backend-cs2vqvtkl-thilinas-projects-f6f25033.vercel.app/api/jobs?jobId=4"
```

### API Key Management

#### List API Keys (Admin)
```bash
curl -H "X-Master-Key: master_dev_key_12345" \
  "https://ticker-backend-cs2vqvtkl-thilinas-projects-f6f25033.vercel.app/api/keys"
```

#### Create New API Key (Admin)
```bash
curl -X POST \
  -H "X-Master-Key: master_dev_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"name": "My App", "rateLimit": 1000}' \
  "https://ticker-backend-cs2vqvtkl-thilinas-projects-f6f25033.vercel.app/api/keys"
```

## Google Apps Script Integration

The `/appscript` folder contains ready-to-use Google Apps Script files for easy integration:

### Quick Start
1. **Copy files** to Google Apps Script project (script.google.com)
2. **Update API URL** in `Config.gs` (already configured for current deployment)
3. **Run tests** with `runAllSimpleTests()`
4. **Add data to sheets** with `addDividendsToSheet()`

### Test Functions
```javascript
// Run complete API test suite
runAllSimpleTests()

// Quick connectivity test
testConnection()

// Add dividend data to current spreadsheet
addDividendsToSheet()

// Validate configuration
validateConfig()
```

## Database Backend

### Technology Stack
- **Database:** PostgreSQL (Supabase)
- **Tables:** `tickers`, `dividend_history`, `api_jobs`, `job_queue`, `api_keys`
- **Real-time:** WebSocket support for job status updates
- **Backup:** Automatic daily backups via Supabase

### Data Sources
- **Primary:** Polygon API (real-time dividend data)
- **Fallback:** Mock data for testing and development
- **Caching:** Database persistence reduces API calls

## Background Processing

### Job System
- **Asynchronous Processing:** Submit large ticker lists for background updates
- **Queue Management:** Automatic retry with exponential backoff
- **Progress Tracking:** Real-time status updates with completion estimates
- **Error Handling:** Detailed error reporting and partial success tracking

### Rate Limiting & Performance
- **External API:** 5 requests/minute (Polygon free tier)
- **Processing Speed:** ~12 seconds per ticker (including delays)
- **Concurrent Jobs:** Single worker instance with queue management
- **Cron Schedule:** Daily processing at 9 AM UTC

## Rate Limiting

### Client Rate Limits
- **Demo Key:** 100 requests/hour
- **Custom Keys:** 1-10,000 requests/hour (configurable)
- **Headers:** Rate limit status included in all responses

### External API Limits
- **Polygon API:** 5 calls/minute (free tier)
- **Backoff Strategy:** Automatic retry with increasing delays
- **Queue Management:** Respects rate limits across all jobs

## Error Handling

### HTTP Status Codes
- `200` Success
- `202` Job accepted for background processing
- `400` Invalid request parameters
- `401` Invalid or missing API key
- `404` Resource not found
- `429` Rate limit exceeded
- `500` Internal server error

### Error Response Format
```json
{
  "error": "Rate limit exceeded",
  "message": "API key has exceeded hourly limit",
  "limit": 100,
  "resetTime": "2025-08-11T08:00:00.000Z",
  "apiKeyName": "Demo Key"
}
```

## Development & Testing

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev
# or
vercel dev

# Test database connectivity
npm run test:db

# Validate complete setup
npm run validate
```

### Testing Commands
```bash
# Test specific endpoints
npm run test:endpoints

# Test core functionality
npm run test:core

# Database setup
npm run setup:db
npm run setup:enhanced
```

### Environment Setup
```bash
# Required environment variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
POLYGON_API_KEY=your-polygon-key
NODE_ENV=production

# Add to Vercel production
vercel env add VARIABLE_NAME production
```

## Deployment

### Current Status
- ✅ **Production URL:** https://ticker-backend-cs2vqvtkl-thilinas-projects-f6f25033.vercel.app
- ✅ **Database:** Supabase PostgreSQL with full schema
- ✅ **Environment Variables:** Configured for production
- ✅ **Cron Jobs:** Daily processing scheduled
- ✅ **API Testing:** All endpoints functional

### Deployment Process
```bash
# Deploy to production
vercel --prod

# Monitor deployment
vercel logs

# Check environment variables
vercel env ls
```

## Monitoring & Analytics

### Available Metrics
- API key usage and rate limiting
- Job processing times and success rates
- Database performance and connection health
- External API rate limit status
- Error rates and failure patterns

### Health Monitoring
- `/api/health` endpoint for service status
- Database connectivity checks
- External API availability monitoring
- Background job queue health

## Next Steps & Roadmap

### Immediate Improvements
- [ ] Webhook notifications for job completion
- [ ] Real-time WebSocket updates for job progress
- [ ] Enhanced error reporting and alerting
- [ ] Data export formats (CSV, Excel)

### Future Features
- [ ] Multiple data source integration (Alpha Vantage, IEX Cloud)
- [ ] Historical data analysis and insights
- [ ] Portfolio tracking and management
- [ ] Advanced filtering and search capabilities
- [ ] Enterprise features (custom rate limits, dedicated instances)
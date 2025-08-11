# CLAUDE.md — Stock Ticker Dividend History API

## Project Overview

This is a production-ready serverless API deployed on Vercel that provides RESTful endpoints for stock ticker dividend history data with comprehensive background job processing capabilities.

- **Purpose:** Serve clean, reliable dividend history data via API with automated background updates
- **Hosting:** Vercel serverless functions with Supabase PostgreSQL database backend
- **Language:** JavaScript (Node.js 18+) with ES modules
- **Framework:** Serverless function architecture optimized for Vercel deployment
- **Data sources:** Polygon API for real-time dividend data, Supabase for data persistence
- **Response format:** JSON with comprehensive error handling, CSV support, and HTTP status codes
- **Current deployment:** Production-ready with enhanced job processing system

---

## Project Structure

- `/api` — Vercel serverless function endpoints
  - `health.js` — Health check endpoint (no auth required)
  - `dividends/[ticker].js` — Dividend history retrieval with advanced filtering
  - `update-tickers.js` — Background job submission for bulk ticker updates
  - `jobs.js` — Job listing and management with filtering/pagination
  - `job-status/[jobId].js` — Real-time job status monitoring
  - `process-queue.js` — Background job processor with rate limiting
  - `process-ticker.js` — Individual ticker processing
  - `keys.js` — API key management with master key authentication
  - `debug-env.js` — Environment debugging utilities
  - `fix-schema.js` — Database schema repair utilities
- `/lib` — Core business logic
  - `supabase.js` — Database operations
  - `polygon-api.js` — External API integration
  - `job-manager.js` — Background job orchestration
  - `auth.js` — API authentication middleware
- `/middleware` — Express middleware (CORS, error handling)
- `/appscript` — Google Apps Script client integration
- `/public` — Client-side dashboard and web interfaces
- `/config` — Configuration files for multi-user support
- `/sql` — Database schema and setup scripts

---

## API Endpoints

### Core Endpoints

#### GET `/api/health`
- **Description:** Service health check
- **Authentication:** None required
- **Response:** `{"status": "ok", "timestamp": "...", "service": "ticker-backend"}`

#### GET `/api/dividends/:ticker`
- **Description:** Returns dividend history for a stock ticker
- **Query params:**
  - `startDate` (optional) — Filter dividends from this date
  - `endDate` (optional) — Filter dividends until this date
  - `fallback=true` (optional) — Use mock data if database is unavailable
  - `format=csv` (optional) — Return data in CSV format
  - `checkOnly=true` (optional) — Return update status instead of dividend data
  - `lastUpdated` (optional) — Compare against this timestamp for checkOnly
- **Authentication:** Required (`X-API-Key` header)
- **Response:**
```json
{
  "ticker": "AAPL",
  "dividends": [
    {
      "declarationDate": "2024-06-01",
      "recordDate": "2024-06-13", 
      "exDividendDate": "2024-06-15",
      "payDate": "2024-07-01",
      "amount": 0.22,
      "currency": "USD",
      "frequency": 4,
      "type": "Cash"
    }
  ],
  "totalRecords": 1,
  "dataSource": "database",
  "apiKeyName": "Demo Key"
}
```

### Background Job Endpoints

#### POST `/api/update-tickers`
- **Description:** Submit tickers for background dividend data updates
- **Authentication:** Required (`X-API-Key` header)
- **Body:**
```json
{
  "tickers": ["AAPL", "MSFT"],
  "priority": 1,
  "force": false
}
```
- **Response:** Job creation confirmation with job ID and status URL

#### GET `/api/job-status/:jobId`
- **Description:** Get detailed status of a background job
- **Authentication:** Required
- **Response:** Job progress, timing, error details, and queue information

#### GET `/api/jobs`
- **Description:** List and filter background jobs
- **Query params:**
  - `status` — Filter by job status (pending, processing, completed, failed)
  - `limit` — Number of results (default: 50)
  - `offset` — Pagination offset
- **Authentication:** Required
- **Response:** Paginated job list with summary statistics

#### DELETE `/api/jobs?jobId=123`
- **Description:** Cancel a pending job
- **Authentication:** Required
- **Response:** Cancellation confirmation

---

## Authentication

All endpoints (except health) require API key authentication via `X-API-Key` header:

- **Demo key:** `tk_demo_key_12345` (rate limited, for testing)
- **Production keys:** Managed via `/api/keys` endpoint with usage tracking

---

## Background Job System

The API includes a sophisticated job processing system:

- **Job Creation:** Submit ticker lists for processing
- **Queue Management:** Automatic retry logic with exponential backoff
- **Rate Limiting:** Respects external API limits (Polygon: 5 requests/minute)
- **Progress Tracking:** Real-time job status and completion estimates
- **Error Handling:** Detailed error reporting and partial success handling
- **Cron Processing:** Daily automated job processing (9 AM UTC) via Cloudflare Worker

---

## Cloudflare Worker Integration

The system includes a **Cloudflare Worker** (`ticker-backend-worker2-deployed/`) that provides reliable cron job functionality for scheduled dividend data updates.

### Worker Features:
- **Daily Cron Jobs:** Scheduled execution at 9:00 AM UTC
- **Health Monitoring:** API health checks before processing
- **Queue Processing:** Triggers main API job processing endpoint (`POST /api/process-queue`)
- **Job Statistics:** Monitors job queue status via `GET /api/jobs`
- **Error Handling:** Comprehensive logging and retry logic
- **Cost Effective:** ~90 requests/month (well within Cloudflare's free tier)

### Worker Architecture:
```
ticker-backend-worker2-deployed/ (Separate Git Repository)
├── src/
│   ├── index.js           # Main worker entry point with cron trigger
│   └── job-processor.js   # Job processing utilities class
├── wrangler.toml          # Cloudflare configuration with environment variables
├── package.json           # Worker dependencies and scripts
├── deploy.sh              # Deployment automation script
└── .git/                  # Independent git repository
```

**Note:** The Cloudflare Worker is maintained as a separate git repository within the `ticker-backend-worker2-deployed/` directory and is excluded from the main project's git tracking to avoid nested repository conflicts.

### Deployment Options:
1. **Dashboard Deployment:** Copy `src/index.js` to Cloudflare Workers dashboard
2. **CLI Deployment:** Use `wrangler deploy` with proper authentication
3. **GitHub Actions:** Automated deployment on push to main branch

### Environment Variables:
- `TICKER_API_BASE_URL`: Base URL of the ticker backend API
- `TICKER_API_KEY`: API key for authentication (currently uses demo key)

### Cron Workflow:
1. **Health Check:** Verifies main API accessibility (`GET /api/health`)
2. **Process Queue:** Triggers job processing (`POST /api/process-queue`)
3. **Monitor Stats:** Collects job statistics (`GET /api/jobs`)
4. **Cleanup:** Monitors old job records for maintenance
5. **Error Handling:** Logs and handles failures gracefully

---

## Google Apps Script Integration

The `/appscript` folder contains a comprehensive Google Apps Script client with multiple test suites:

### Files:
- **`DividendDashboard.gs`** — Complete Google Apps Script integration with dashboard trigger functionality
- **`README.md`** — Setup and configuration instructions
- **`appsscript.json`** — Apps Script project configuration

### Key Features:
- **Dashboard Integration:** Automatic trigger when "UPDATE_DIVIDENDS" is entered in Google Sheets
- **Bulk Processing:** Handle hundreds of tickers with smart update detection
- **Error Handling:** Comprehensive retry logic and progress tracking
- **Real-time Updates:** Live progress monitoring with detailed status reporting

### Setup:
1. Copy `DividendDashboard.gs` to Google Apps Script project
2. Configure API base URL and authentication
3. Set up sheet triggers for automatic dashboard launching
4. Use demo key `tk_demo_key_12345` for testing

---

## Client-Side Dashboard Integration

The system includes a sophisticated client-side update dashboard that bypasses serverless execution limits and provides real-time progress tracking for bulk dividend updates.

### Dashboard Features:
- **Bulk Processing:** Handle 500+ tickers in ~1 hour 40 minutes
- **Smart Strategy:** Automatic full vs incremental update detection
- **Rate Limiting:** Built-in 5 requests/minute compliance with Polygon API
- **Multi-User Support:** API key management for multiple tenants
- **Real-Time Progress:** Visual progress bars, ETA calculations, and detailed logs
- **Error Handling:** Comprehensive retry logic and error reporting

### Integration Workflow:

#### 1. Google Sheets Setup
```javascript
// In Google Apps Script (DashboardTrigger.gs)
// User enters "UPDATE_DIVIDENDS" in cell A1
// Script reads tickers from column A
// Opens dashboard with parameters
```

#### 2. Dashboard URLs
- **Update Dashboard:** `/update-dashboard.html` — Main processing interface
- **Test Integration:** `/test-integration.html` — Integration testing and examples

#### 3. Update Strategies
- **Full Historical:** New users get 12 months historical + 3 months future
- **Incremental:** Existing users get updates since last sync
- **Smart Detection:** Uses `checkOnly=true` parameter to determine requirements

### Dashboard Parameters:
```
?tickers=["AAPL","MSFT","GOOGL"]
&apiKey=tk_demo_key_12345
&lastUpdated=2025-08-01T00:00:00Z
&user=dGVzdEBleGFtcGxlLmNvbQ==
&session=1754903025384
```

### API Key Management:
- **Demo Key:** `tk_demo_key_12345` (100 requests/hour, testing only)
- **Test Key:** `tk_test_67890` (50 requests/hour, development)
- **Dynamic Keys:** Generate new keys via `/api/keys` endpoint with master key authentication
- **In-Memory Store:** API keys stored in memory (upgrade to database for production scale)
- **Rate Limiting:** Per-key rate limiting with sliding window algorithm

### Client-Side Advantages:
- **No Execution Limits:** Browser can run for hours
- **Visual Progress:** Real-time updates and ETA calculations
- **Manual Control:** Start/pause/stop functionality
- **Error Recovery:** Individual ticker retry logic
- **Cost Effective:** No serverless function execution costs

---

## Environment Configuration

### Required Environment Variables:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
POLYGON_API_KEY=your-polygon-key
NODE_ENV=production
```

### Local Development:
- Copy variables to `.env.local`
- Use `vercel env add` for production deployment

---

## Development Commands

```bash
# Local development
npm run dev                    # Start Vercel development server
npm run build                  # Build for production deployment
npm start                      # Start production server locally

# Testing and validation
npm run test:db               # Test database connectivity
npm run test:endpoints        # Test API endpoints
npm run test:core             # Test core functions
npm run validate              # Validate complete setup

# Database setup
npm run setup:db              # Initialize basic database schema
npm run setup:enhanced        # Setup enhanced schema with jobs, queues, and rate limiting

# Deployment
vercel --prod                 # Deploy to production
vercel env add VAR_NAME       # Add environment variable
vercel env pull               # Pull environment variables locally
```

---

## Database Schema

### Core Tables:
- **`tickers`** — Stock ticker symbols with metadata and update tracking
- **`dividends`** — Historical dividend records with enhanced fields (polygon_id, data_source, cash_amount_usd)
- **`api_jobs`** — Background job tracking with status, progress, and timing
- **`job_queue`** — Job processing queue with retry logic and locking
- **`rate_limits`** — Rate limiting tracking for external API services
- **`api_call_logs`** — Detailed logging of all API calls for monitoring

### Enhanced Features:
- **Upsert Support:** Automatic handling of duplicate records
- **Rate Limit Tracking:** Built-in rate limiting with automatic reset
- **Job Retry Logic:** Exponential backoff for failed job items
- **Row Level Security:** Enabled on all tables with authenticated access policies
- **Performance Indexes:** Optimized queries with strategic database indexes

### Data Flow:
1. Client submits ticker update request
2. Job created in `api_jobs` table
3. Tickers added to `job_queue` for processing
4. Cron job processes queue, fetches data from Polygon API
5. Dividend data stored in `dividend_history` table

---

## Error Handling and Monitoring

### HTTP Status Codes:
- `200` — Success
- `202` — Job accepted (background processing)
- `400` — Invalid request parameters
- `401` — Invalid or missing API key
- `404` — Resource not found
- `429` — Rate limit exceeded
- `500` — Internal server error

### Logging:
- All requests logged with API key usage
- Background job processing tracked
- Error details captured for debugging
- Rate limiting events monitored

---

## Production Deployment

### Current Status:
- **Live URL:** Deployed on Vercel with production configuration
- **Database:** Supabase (PostgreSQL)
- **Cron Jobs:** Daily processing at 9 AM UTC via Cloudflare Worker
- **Rate Limits:** 5 API calls/minute (Polygon), 100 requests/hour (demo key)

### Deployment Checklist:
1. ✅ Environment variables configured
2. ✅ Database schema deployed with enhanced tables
3. ✅ API endpoints tested and functional
4. ✅ Cloudflare Worker cron job deployed (daily at 9 AM UTC)
5. ✅ Google Apps Script integration verified
6. ✅ Rate limiting and job processing system operational

---

## Known Limitations

- **Rate Limiting:** Polygon API allows 5 calls/minute (free tier)
- **Data Freshness:** Daily updates via Cloudflare Worker cron schedule
- **Concurrent Processing:** Single worker instance for job processing
- **API Key Storage:** In-memory storage (should upgrade to database for production scale)
- **Worker Dependencies:** Relies on Cloudflare Worker for automated cron execution

---

## Coding Guidelines

### Code Standards:
- **ES Modules:** Use `import`/`export` consistently across all files
- **Async/Await:** All database and API operations use async/await pattern
- **JSDoc Comments:** Document all public functions with comprehensive JSDoc
- **Environment Variables:** Store all secrets and configuration in environment variables
- **Error Handling:** Comprehensive error handling with meaningful messages and proper HTTP status codes

### Security & Performance:
- **Rate Limiting:** Respect external API limits (Polygon: 5 requests/minute)
- **Database Transactions:** Use transactions for data consistency when needed
- **Input Validation:** Validate all input parameters with proper sanitization
- **CORS Headers:** Proper CORS configuration for cross-origin requests
- **API Key Authentication:** Secure authentication for all endpoints except health checks

### Architecture Patterns:
- **Serverless Functions:** Each API endpoint is a separate serverless function
- **Database Abstraction:** Database operations abstracted in `/lib/supabase.js`
- **Job Processing:** Background job processing with queue management and retry logic
- **Middleware Pattern:** Reusable middleware for CORS, authentication, and error handling


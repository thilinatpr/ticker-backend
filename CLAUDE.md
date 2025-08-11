# CLAUDE.md — Stock Ticker Dividend History API

## Project Overview

This is a production-ready Express.js API server deployed on Vercel that provides RESTful endpoints for stock ticker dividend history data with background job processing capabilities.

- **Purpose:** Serve clean, reliable dividend history data via API with automated background updates
- **Hosting:** Vercel serverless functions with Supabase database backend
- **Language:** JavaScript (Node.js 18+) with ES modules
- **Framework:** Express.js with middleware optimized for serverless
- **Data sources:** Polygon API for real-time dividend data, Supabase for persistence
- **Response format:** JSON with comprehensive error handling and status codes
- **Current deployment:** https://ticker-backend-fw3jr13tb-thilinas-projects-f6f25033.vercel.app

---

## Project Structure

- `/api` — Vercel serverless function endpoints
  - `health.js` — Health check endpoint
  - `dividends/[ticker].js` — Dividend history retrieval
  - `update-tickers.js` — Background job submission
  - `jobs.js` — Job listing and management
  - `job-status/[jobId].js` — Job status monitoring
  - `process-queue.js` — Background job processor (cron job)
  - `keys.js` — API key management
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
- **Cron Processing:** Daily automated job processing (9 AM UTC)

---

## Google Apps Script Integration

The `/appscript` folder contains a comprehensive Google Apps Script client with multiple test suites:

### Files:
- **`Config.gs`** — Shared configuration and utilities
- **`SimpleTests.gs`** — Basic test suite for API validation
- **`QuickStart.gs`** — Quick demonstration functions
- **`Code.gs`** — Main dividend data functions
- **`Tests.gs`** — Comprehensive test suite

### Key Functions:
- `runAllSimpleTests()` — Complete API test suite (health, dividends, jobs)
- `addDividendsToSheet()` — Add dividend data directly to Google Sheets
- `testConnection()` — Quick API connectivity test
- `getDividendHistory(ticker)` — Fetch dividend data programmatically

### Setup:
1. Copy all `.gs` files to Google Apps Script project
2. Update `API_BASE_URL` in `Config.gs` if using custom deployment
3. Run `validateConfig()` to verify setup
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

### Multi-User API Keys:
- **Demo:** `tk_demo_key_12345` (rate limited, testing)
- **User 1:** `tk_user1_api_key_67890` (production)
- **User 2:** `tk_user2_api_key_abcde` (production)

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
npm run dev                    # Start development server
vercel dev                     # Start Vercel development environment

# Testing and validation
npm run test:db               # Test database connectivity
npm run test:endpoints        # Test API endpoints
npm run validate              # Validate complete setup

# Database setup
npm run setup:db              # Initialize database schema
npm run setup:enhanced        # Setup enhanced schema with jobs

# Deployment
vercel --prod                 # Deploy to production
vercel env add VAR_NAME       # Add environment variable
```

---

## Database Schema

### Core Tables:
- `tickers` — Stock ticker symbols with metadata
- `dividend_history` — Historical dividend records
- `api_jobs` — Background job tracking
- `job_queue` — Job processing queue
- `api_keys` — API key management and usage tracking

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
- **Live URL:** https://ticker-backend-cs2vqvtkl-thilinas-projects-f6f25033.vercel.app
- **Database:** Supabase (PostgreSQL)
- **Cron Jobs:** Daily processing at 9 AM UTC
- **Rate Limits:** 5 API calls/minute (Polygon), 100 requests/hour (demo key)

### Deployment Checklist:
1. ✅ Environment variables configured
2. ✅ Database schema deployed
3. ✅ API endpoints tested and functional
4. ✅ Cron job scheduled (daily)
5. ✅ Google Apps Script integration verified

---

## Known Limitations

- **Hobby Plan Restrictions:** Cron jobs limited to daily frequency
- **Rate Limiting:** Polygon API allows 5 calls/minute (free tier)
- **Data Freshness:** Daily updates only (due to cron limitations)
- **Concurrent Processing:** Single worker instance for job processing

---

## Coding Guidelines

- Use ES modules (`import`/`export`) consistently
- Async/await for all database and API operations
- JSDoc comments for public functions
- Environment variables for all secrets
- Comprehensive error handling with meaningful messages
- Rate limiting respect for external APIs
- Database transactions for data consistency


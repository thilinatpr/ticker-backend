# CLAUDE.md — Stock Ticker Dividend History API

## Project Overview

This is a production-ready **Cloudflare Worker API** that provides RESTful endpoints for stock ticker dividend history data with user subscription management and comprehensive background job processing capabilities.

- **Purpose:** Serve clean, reliable dividend history data via API with automated background updates
- **Hosting:** Cloudflare Workers with Supabase PostgreSQL database backend
- **Language:** JavaScript (ES modules) optimized for Cloudflare Workers runtime
- **Framework:** Single Cloudflare Worker architecture with native queue integration
- **Data sources:** Polygon API for real-time dividend data, Supabase for data persistence
- **Response format:** JSON with comprehensive error handling, CSV support, and HTTP status codes
- **Current deployment:** Production-ready Stage 4 CF-Native system with user subscriptions

---

## Project Structure

- `ticker-backend-worker2-deployed/` — **Cloudflare Worker implementation** (gitignored)
  - `src/stage4-index.js` — Complete CF-Native worker with all functionality
  - `wrangler.toml` — Cloudflare configuration with environment variables
  - `package.json` — Worker dependencies and scripts
  - `public/api-keys-management.html` — API keys management interface
- `/appscript` — Google Apps Script client integration
- `/sql` — Database schema and setup scripts
- `/test-*.js` — Testing utilities for database functions

---

## Cloudflare Worker Architecture

### Current Implementation: Stage 4 - Full CF-Native System
- **Single Worker Entry Point:** All functionality consolidated in one worker
- **Native Authentication:** Built-in API key validation with rate limiting
- **User Subscriptions:** Per-user ticker subscription management
- **Background Processing:** Native CF Queue integration for bulk operations
- **Edge Performance:** Global distribution with sub-100ms response times
- **Cost Effective:** Predictable pricing with generous free tier limits

### Key Classes:
- **`CFNativeAuth`** — API key authentication and rate limiting
- **`CFNativeDatabaseManager`** — Direct Supabase REST API operations
- **`CFNativePolygonManager`** — Polygon API integration with rate limiting
- **`CFNativeSubscriptionManager`** — User subscription management
- **`CFNativeProcessor`** — Dividend data processing and storage

---

## API Endpoints

### Core Endpoints

#### GET `/health`
- **Description:** Service health check with system status
- **Authentication:** None required
- **Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-13T...",
  "service": "ticker-backend-cf-native",
  "stage": "Stage 4 - Full CF-Native System with Subscriptions",
  "environment": {
    "hasSupabaseUrl": true,
    "hasSupabaseKey": true,
    "hasPolygonKey": true,
    "hasQueue": true
  }
}
```

#### GET `/dividends/{ticker}`
- **Description:** Returns dividend history for a specific stock ticker
- **Authentication:** Required (`X-API-Key` header)
- **Query params:**
  - `startDate` (optional) — Filter dividends from this date
  - `endDate` (optional) — Filter dividends until this date
  - `format=csv` (optional) — Return data in CSV format
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
  "dataSource": "cf_native",
  "stage": "Stage 4 - Full CF-Native"
}
```

#### GET `/dividends/all`
- **Description:** Returns dividend history for all tickers
- **Authentication:** Required
- **Query params:** Same as single ticker endpoint plus `limit` and `offset`

### User Subscription Endpoints

#### GET `/subscriptions`
- **Description:** Get user's ticker subscriptions
- **Authentication:** Required
- **Response:**
```json
{
  "success": true,
  "subscriptions": [
    {
      "ticker": "AAPL",
      "priority": 1,
      "subscribed_at": "2025-01-13T..."
    }
  ],
  "total": 1
}
```

#### POST `/subscriptions`
- **Description:** Subscribe to a ticker
- **Authentication:** Required
- **Body:**
```json
{
  "ticker": "AAPL",
  "priority": 1
}
```

#### DELETE `/subscriptions`
- **Description:** Unsubscribe from a ticker
- **Authentication:** Required
- **Body:**
```json
{
  "ticker": "AAPL"
}
```

#### POST `/subscriptions/bulk`
- **Description:** Bulk subscribe/unsubscribe operations
- **Authentication:** Required
- **Body:**
```json
{
  "action": "subscribe",
  "tickers": ["AAPL", "MSFT", "GOOGL"],
  "priority": 1
}
```

#### GET `/my-dividends`
- **Description:** Get dividends only for user's subscribed tickers
- **Authentication:** Required
- **Query params:** `startDate`, `endDate`, `limit`, `offset`, `format=csv`

### Background Processing Endpoints

#### POST `/update-tickers`
- **Description:** Submit tickers for background dividend data updates
- **Authentication:** Required
- **Body:**
```json
{
  "tickers": ["AAPL", "MSFT"],
  "force": false
}
```

#### POST `/process`
- **Description:** Process a single ticker immediately
- **Authentication:** Required
- **Body:**
```json
{
  "ticker": "AAPL",
  "force": false
}
```

---

## Authentication

All endpoints (except `/health`) require API key authentication via `X-API-Key` header:

### Available API Keys:
- **`tk_demo_key_12345`** — Demo key for testing and development
- **`tk_test_67890`** — Test key for development
- **Environment key** — From `TICKER_API_KEY` environment variable (if set)

### Rate Limiting:
- **In-memory tracking** with sliding window algorithm
- **100 requests/hour** default limit per API key
- **Rate limit headers** included in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset` (on limit exceeded)

---

## User Subscription System

The API includes a sophisticated user subscription system that allows users to:

### Core Features:
- **Subscribe to specific tickers** for personalized dividend tracking
- **Bulk subscription management** for efficient portfolio setup
- **Priority-based processing** for high-importance tickers
- **Personal dividend feed** showing only subscribed tickers
- **Subscription analytics** and management

### Database Schema:
- **`user_subscriptions`** — API key to ticker mappings with priority
- **`user_dividends_view`** — Materialized view joining subscriptions with dividend data
- **Database functions** for subscription management (`subscribe_to_ticker`, `unsubscribe_from_ticker`, etc.)

---

## Background Job Processing

### Native CF Queue Integration:
- **Queue Consumer** — `queue()` handler for batch processing
- **Scheduled Tasks** — `scheduled()` handler for daily updates
- **Rate Limited Processing** — 5 API calls/minute to respect Polygon limits
- **Automatic Retry Logic** — Built-in retry for failed operations

### Processing Workflow:
1. User submits ticker update request
2. Single ticker: immediate processing
3. Multiple tickers: queued for background processing
4. Queue consumer processes with rate limiting
5. Results stored in database with timestamp tracking

---

## Environment Configuration

### Required Environment Variables:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
POLYGON_API_KEY=your-polygon-key
TICKER_API_KEY=your-custom-api-key  # optional additional key
TICKER_QUEUE=your-queue-binding      # CF Queue binding
```

### Cloudflare Worker Setup:
```bash
# Install dependencies
npm install

# Configure environment
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put POLYGON_API_KEY

# Deploy worker
wrangler deploy
```

---

## Database Schema

### Enhanced Tables:
- **`tickers`** — Stock ticker symbols with metadata and update tracking
- **`dividends`** — Historical dividend records with enhanced fields
- **`user_subscriptions`** — Per-user ticker subscription management
- **`user_dividends_view`** — Optimized view joining subscriptions with dividend data

### Key Features:
- **Row Level Security (RLS)** — Enabled on all tables
- **Upsert Support** — Automatic handling of duplicate records
- **Performance Indexes** — Optimized for common query patterns
- **Database Functions** — Stored procedures for complex subscription operations

---

## API Keys Management

A comprehensive management interface is available:

**Location:** `ticker-backend-worker2-deployed/public/api-keys-management.html`

### Features:
- **Worker Connection Testing** — Configure and test CF Worker URL
- **API Key Validation** — Test all available API keys
- **Interactive Testing Suite** — Real-time endpoint testing
- **Response Logging** — Monitor API calls with full response data
- **Usage Guide** — Complete curl examples and integration instructions

---

## Migration from Vercel (Historical)

This project was **migrated from a Vercel serverless implementation** to Cloudflare Workers in January 2025.

### Migration Benefits:
- **Simplified Architecture** — Single worker vs multiple serverless functions
- **No Execution Limits** — No 10-second timeout constraints
- **Better Performance** — Edge computing with global distribution
- **Cost Effective** — More predictable pricing model
- **Native Queues** — Built-in background job processing

### Deprecated Implementation:
The original Vercel implementation has been **archived in a separate repository** for historical reference but is **no longer maintained**.

---

## Development and Testing

### Local Development:
```bash
# Start worker locally
wrangler dev

# Test database connectivity
node test-db-functions.js

# Run integration tests
# (Configure worker URL in test files)
```

### Production Deployment:
```bash
# Deploy to Cloudflare
wrangler deploy --compatibility-date 2024-01-01

# Verify deployment
curl -H "X-API-Key: tk_demo_key_12345" https://your-worker.workers.dev/health
```

---

## Error Handling and Monitoring

### HTTP Status Codes:
- `200` — Success
- `202` — Accepted (background processing)
- `400` — Invalid request parameters
- `401` — Invalid or missing API key
- `404` — Resource not found
- `429` — Rate limit exceeded
- `500` — Internal server error

### Response Format:
All responses include consistent error formatting:
```json
{
  "error": "Rate limit exceeded",
  "message": "API key has exceeded 100 requests per hour",
  "stage": "Stage 4 - Full CF-Native"
}
```

---

## Production Status

### Current Deployment:
- **Status:** ✅ Production-ready
- **Architecture:** Stage 4 - Full CF-Native System with User Subscriptions
- **Performance:** Edge-optimized with global distribution
- **Reliability:** Native CF platform reliability and scaling
- **Cost:** Optimized for CF Workers free tier and predictable scaling

### Monitoring:
- **Health Checks:** Available via `/health` endpoint
- **Rate Limiting:** Per-key tracking with automatic reset
- **Error Logging:** Comprehensive error tracking in CF dashboard
- **Performance:** Sub-100ms response times globally

---

## API Usage Examples

### Basic Dividend Lookup:
```bash
curl -H "X-API-Key: tk_demo_key_12345" \
     https://your-worker.workers.dev/dividends/AAPL
```

### Subscribe to Tickers:
```bash
curl -X POST -H "X-API-Key: tk_demo_key_12345" \
     -H "Content-Type: application/json" \
     -d '{"ticker":"AAPL","priority":1}' \
     https://your-worker.workers.dev/subscriptions
```

### Get Personal Dividend Feed:
```bash
curl -H "X-API-Key: tk_demo_key_12345" \
     https://your-worker.workers.dev/my-dividends
```

### Bulk Operations:
```bash
curl -X POST -H "X-API-Key: tk_demo_key_12345" \
     -H "Content-Type: application/json" \
     -d '{"action":"subscribe","tickers":["AAPL","MSFT","GOOGL"],"priority":1}' \
     https://your-worker.workers.dev/subscriptions/bulk
```

---

## Security Best Practices

### Implementation:
- **API Key Authentication** on all endpoints except health checks
- **Rate Limiting** with sliding window algorithm
- **Input Validation** for all request parameters
- **CORS Headers** properly configured for cross-origin requests
- **Environment Variables** for all secrets and configuration
- **Database RLS** enabled for data security

### Recommendations:
- **Rotate API keys** regularly in production
- **Monitor rate limits** to detect abuse
- **Use HTTPS only** for all API calls
- **Validate input** on client side before API calls
- **Store API keys securely** in client applications

---

## Coding Guidelines

### Architecture Patterns:
- **Single Entry Point** — All logic in one CF Worker `fetch()` handler
- **Class-based Organization** — Logical separation with ES6 classes
- **Direct Database Access** — Supabase REST API calls vs abstraction layers
- **Native Platform Features** — CF Queues, scheduled tasks, and edge computing
- **Simplified Authentication** — Hardcoded keys with environment variable extension

### Performance Optimization:
- **Minimal Dependencies** — Leveraging CF runtime capabilities
- **Efficient Database Queries** — Optimized Supabase REST API usage
- **Edge Caching** — Utilizing CF's global edge network
- **Rate Limiting Compliance** — Respecting external API limits (Polygon: 5/minute)

---

## Support and Documentation

### Current Implementation:
- **Active Development** — Ongoing maintenance and feature development
- **Issue Resolution** — GitHub issues for bug reports and feature requests
- **Documentation** — Up-to-date guides and API references

### Community:
- **Open Source** — Available for community contributions
- **Examples** — Working code samples and integration patterns
- **Best Practices** — Production-tested implementation patterns

---

**Last Updated:** January 2025  
**Current Version:** Stage 4 - Full CF-Native System with User Subscriptions  
**Status:** ✅ Production Ready
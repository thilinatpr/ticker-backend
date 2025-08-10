# CLAUDE.md — Express Backend for Stock Ticker Dividend History API

## Project Overview

This project is a backend Express.js API server deployed on Vercel. It provides RESTful endpoints to fetch dividend history data for stock tickers.

**Key Details:**
- **Purpose:** Serve clean, reliable dividend history data via API for client apps or dashboards
- **Hosting:** Vercel serverless functions (Edge or Serverless Runtime)
- **Language:** JavaScript (Node.js 18+)
- **Framework:** Express.js (minimal middleware, optimized for serverless)
- **Data source:** External stock data APIs (e.g., Alpha Vantage, Tiingo, IEX Cloud) or internal DB cache
- **Response format:** JSON, with clear error handling and standard HTTP status codes

---

## Project Structure

```
ticker-backend/
├── api/              # Vercel API routes implemented as Express endpoints
├── lib/              # Utility functions for fetching and processing dividend data
├── middleware/       # Express middleware (logging, error handling, etc.)
├── config/           # Environment-based configuration (API keys, cache TTL, etc.)
├── tests/            # Unit and integration tests for API endpoints and logic
├── package.json      # Dependencies and scripts
├── vercel.json       # Vercel deployment configuration
└── CLAUDE.md         # This file - project context for AI assistants
```

---

## API Endpoints

### GET `/api/dividends/:ticker`

**Description:** Returns the dividend history for a given stock ticker symbol (e.g., AAPL, MSFT)

**Query Parameters:**
- `startDate` (optional, ISO date string) — filter dividends from this date
- `endDate` (optional, ISO date string) — filter dividends until this date

**Response:**
```json
{
  "ticker": "AAPL",
  "dividends": [
    {
      "declarationDate": "2024-06-01",
      "exDividendDate": "2024-06-15",
      "payDate": "2024-07-01",
      "amount": 0.22,
      "currency": "USD",
      "frequency": 4,
      "type": "Cash"
    }
  ]
}
```

**Error Responses:**
- `404` - Ticker not found
- `400` - Invalid query parameters
- `500` - Internal server error

---

## Coding Guidelines

- **ES Modules:** Use import/export for consistency
- **Async/Await:** Write clean, readable async/await code for API calls
- **Documentation:** Include JSDoc comments for all public functions and endpoints
- **Error Handling:** Handle errors explicitly and return meaningful messages
- **REST Conventions:** Follow REST conventions for HTTP methods and status codes
- **Pure Functions:** Avoid side effects in utility functions; keep them pure where possible
- **Security:** Use environment variables for secrets and keys; do NOT hardcode
- **Testing:** Write unit tests with Jest or preferred testing framework
- **Code Style:** Follow consistent formatting and naming conventions

---

## Deployment Notes

- **Environment Variables:** Ensure all API keys and secrets are set in Vercel dashboard
- **Function Limits:** Use Vercel's recommended serverless function limits (max 10s runtime, memory limits)
- **Performance:** Optimize API responses for minimal payload size
- **Caching:** Cache dividend data where possible to reduce external API calls and latency
- **Monitoring:** Set up logging and error tracking for production issues

---

## Development Commands

```bash
npm run dev          # Start local development server with hot reload
npm run build        # Build for production (if applicable)
npm test             # Run test suite
npm run lint         # Run linter
npm run type-check   # Run TypeScript type checking (if using TS)
vercel dev           # Run Vercel development environment locally
vercel deploy        # Deploy latest version to Vercel
```

---

## Known Limitations & TODOs

- **Rate Limiting:** External stock APIs may require retries or backoff strategies
- **Pagination:** Support for dividend lists pagination not yet implemented
- **Caching:** Consider adding internal caching or DB layer for improved performance
- **Error Recovery:** Implement more robust error recovery and fallback mechanisms
- **Data Validation:** Add comprehensive input validation for all endpoints

---

## Environment Variables

Required environment variables for the application:

```bash
# External API Configuration
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
TIINGO_API_KEY=your_tiingo_key
IEX_CLOUD_API_KEY=your_iex_cloud_key

# Application Configuration
NODE_ENV=production
LOG_LEVEL=info
CACHE_TTL=3600

# Optional: Database/Redis for caching
DATABASE_URL=your_database_url
REDIS_URL=your_redis_url
```

---

## AI Assistant Guidelines

When working on this project:
1. **Always check existing code patterns** before implementing new features
2. **Follow the project structure** outlined above
3. **Test API endpoints** after making changes
4. **Update this CLAUDE.md** if you add new endpoints or change the architecture
5. **Use environment variables** for any external service configurations
6. **Prioritize performance** due to Vercel's serverless environment constraints

Here’s a tailored `CLAUDE.md` file for your backend Express server hosted on Vercel that serves API endpoints for stock ticker dividend history. It sets clear project context and guidelines for Claude Code or any AI assistant you use.

````markdown
# CLAUDE.md — Express Backend for Stock Ticker Dividend History API

## Project Overview

This project is a backend Express.js API server deployed on Vercel. It provides RESTful endpoints to fetch dividend history data for stock tickers.

- **Purpose:** Serve clean, reliable dividend history data via API for client apps or dashboards.
- **Hosting:** Vercel serverless functions (Edge or Serverless Runtime)
- **Language:** JavaScript (Node.js 18+)
- **Framework:** Express.js (minimal middleware, optimized for serverless)
- **Data source:** External stock data APIs (e.g., Alpha Vantage, Tiingo, IEX Cloud) or internal DB cache
- **Response format:** JSON, with clear error handling and standard HTTP status codes

---

## Project Structure

- `/api` — Vercel API routes implemented as Express endpoints  
- `/lib` — Utility functions for fetching and processing dividend data  
- `/middleware` — Express middleware (e.g., logging, error handling)  
- `/config` — Environment-based configuration (API keys, cache TTL, etc.)  
- `/tests` — Unit and integration tests for API endpoints and logic

---

## API Endpoints

### GET `/api/dividends/:ticker`

- **Description:** Returns the dividend history for a given stock ticker symbol (e.g., AAPL, MSFT)  
- **Query params:**  
  - `startDate` (optional, ISO date string) — filter dividends from this date  
  - `endDate` (optional, ISO date string) — filter dividends until this date  
- **Response:**  
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
    },
    ...
  ]
}
````

* **Errors:**

  * `404` if ticker not found
  * `400` if invalid query params
  * `500` for internal server errors

---

## Coding Guidelines

* Use ES modules (import/export) for consistency
* Write clean, readable async/await code for API calls
* Include JSDoc comments for all public functions and endpoints
* Handle errors explicitly and return meaningful messages
* Follow REST conventions for HTTP methods and status codes
* Avoid side effects in utility functions; keep them pure where possible
* Use environment variables for secrets and keys; do NOT hardcode
* Write unit tests with Jest or preferred testing framework

---

## Deployment Notes

* Ensure all environment variables (API keys, secrets) are set in Vercel dashboard
* Use Vercel's recommended serverless function limits (max 10s runtime, memory limits)
* Optimize API responses for minimal payload size
* Cache dividend data where possible to reduce external API calls and latency

---

## Important Commands

* `npm run dev` — start local dev server with hot reload
* `npm run build` — build for production (if applicable)
* `npm test` — run tests
* `vercel deploy` — deploy latest version to Vercel

---

## Known Limitations & TODOs

* Rate limits from external stock APIs may require retries or backoff
* Pagination support for dividend lists is currently not implemented
* Add integration with internal caching or DB layer for improved performance

---

## Contact / Maintainers

* Maintained by \[Your Name or Team]
* Contact: [your.email@example.com](mailto:your.email@example.com)

---

# End of CLAUDE.md


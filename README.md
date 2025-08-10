# Ticker Backend API

A secure Express.js API deployed on Vercel for fetching stock dividend history data with API key authentication.

## Features

- **🔐 API Key Authentication** - Secure access with rate limiting
- **📈 Dividend History** - Get dividend data for stock tickers  
- **⚡ Rate Limiting** - Built-in request throttling per API key
- **🔍 Health Monitoring** - Service status endpoint
- **🛠️ API Key Management** - Admin endpoints for key management

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

### Health Check (No Auth Required)
```bash
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "ticker-backend",
  "version": "1.0.0"
}
```

### Get Dividend History (Auth Required)
```bash
curl -H "X-API-Key: tk_demo_key_12345" \
  "https://ticker-backend-nu.vercel.app/api/dividends/AAPL"

curl -H "X-API-Key: tk_demo_key_12345" \
  "https://ticker-backend-nu.vercel.app/api/dividends/AAPL?startDate=2024-01-01&endDate=2024-12-31"
```

Response:
```json
{
  "ticker": "AAPL",
  "dividends": [
    {
      "declarationDate": "2024-05-02",
      "exDividendDate": "2024-05-10",
      "payDate": "2024-05-16",
      "amount": 0.24,
      "currency": "USD",
      "frequency": 4,
      "type": "Cash"
    }
  ],
  "apiKeyName": "Demo Key"
}
```

### API Key Management (Admin Only)

**List API Keys:**
```bash
curl -H "X-Master-Key: master_dev_key_12345" \
  "https://ticker-backend-nu.vercel.app/api/keys"
```

**Create New API Key:**
```bash
curl -X POST \
  -H "X-Master-Key: master_dev_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"name": "My App", "rateLimit": 200}' \
  "https://ticker-backend-nu.vercel.app/api/keys"
```

## Available Tickers (MVP)

- `AAPL` - Apple Inc.
- `MSFT` - Microsoft Corporation

## Rate Limiting

Each API key has a rate limit (requests per hour):
- Demo keys: 50-100 requests/hour
- Custom keys: 1-10,000 requests/hour (configurable)

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
```

## Error Responses

**401 Unauthorized** - Missing or invalid API key:
```json
{
  "error": "API key required",
  "message": "Please provide an API key in the X-API-Key header"
}
```

**429 Rate Limit Exceeded:**
```json
{
  "error": "Rate limit exceeded",
  "limit": 100,
  "resetTime": "2024-01-01T01:00:00.000Z"
}
```

## Local Development

```bash
npm install
npm run dev
```

The API will be available at `http://localhost:3000`

## Deployment

This project is configured for automatic deployment on Vercel. Simply push to your connected GitHub repository.

## Next Steps

- [ ] Integrate with real stock data API (Alpha Vantage, Tiingo, etc.)
- [ ] Add more ticker symbols
- [ ] Implement caching
- [ ] Add input validation
- [ ] Add error logging
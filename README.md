# Ticker Backend API

A simple Express.js API deployed on Vercel for fetching stock dividend history data.

## Features

- **Health Check**: `GET /api/health` - Service status and info
- **Dividend History**: `GET /api/dividends/:ticker` - Get dividend data for a stock ticker

## API Usage

### Health Check
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

### Get Dividend History
```bash
GET /api/dividends/AAPL
GET /api/dividends/AAPL?startDate=2024-01-01&endDate=2024-12-31
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
  ]
}
```

## Available Tickers (MVP)

- `AAPL` - Apple Inc.
- `MSFT` - Microsoft Corporation

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
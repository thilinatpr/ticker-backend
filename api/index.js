/**
 * Root API endpoint
 * GET /api
 */

export default function handler(req, res) {
  res.status(200).json({
    message: 'Ticker Backend API',
    version: '1.0.0',
    authentication: {
      required: true,
      method: 'API Key',
      header: 'X-API-Key or Authorization: Bearer <key>'
    },
    endpoints: {
      health: {
        url: '/api/health',
        method: 'GET',
        auth: false,
        description: 'Service health check'
      },
      dividends: {
        url: '/api/dividends/{ticker}',
        method: 'GET',
        auth: true,
        description: 'Get dividend history for stock ticker',
        parameters: {
          ticker: 'Stock symbol (e.g., AAPL, MSFT)',
          startDate: 'Filter from date (optional, ISO format)',
          endDate: 'Filter to date (optional, ISO format)'
        }
      },
      keys: {
        url: '/api/keys',
        methods: ['GET', 'POST'],
        auth: 'Master Key Required',
        description: 'API key management (admin only)'
      }
    },
    demo: {
      apiKeys: {
        demo: 'tk_demo_key_12345 (100 req/hour)',
        test: 'tk_test_67890 (50 req/hour)'
      },
      examples: {
        'Get AAPL dividends': 'curl -H "X-API-Key: tk_demo_key_12345" https://ticker-backend-nu.vercel.app/api/dividends/AAPL',
        'Get MSFT dividends with date filter': 'curl -H "X-API-Key: tk_demo_key_12345" "https://ticker-backend-nu.vercel.app/api/dividends/MSFT?startDate=2024-01-01"'
      }
    }
  });
}
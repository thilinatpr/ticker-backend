/**
 * Root API endpoint
 * GET /api
 */

export default function handler(req, res) {
  res.status(200).json({
    message: 'Ticker Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      dividends: '/api/dividends/[ticker]'
    }
  });
}
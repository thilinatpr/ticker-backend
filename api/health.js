/**
 * Health check endpoint
 * GET /api/health
 */

export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ticker-backend',
    version: '1.0.0'
  });
}
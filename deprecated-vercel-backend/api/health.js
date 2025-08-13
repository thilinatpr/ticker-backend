/**
 * Health check endpoint
 * GET /api/health
 */

import { setCorsHeaders } from '../middleware/cors.js';

export default function handler(req, res) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ticker-backend',
    version: '1.0.0'
  });
}
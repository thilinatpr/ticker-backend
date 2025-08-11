/**
 * API Key Management Endpoint
 * GET /api/keys - List API keys
 * POST /api/keys - Create new API key
 * Requires master key for authentication
 */

import { createApiKey, listApiKeys } from '../lib/auth.js';
import { setCorsHeaders } from '../middleware/cors.js';

// Master key for API key management (in production, use environment variable)
const MASTER_KEY = process.env.MASTER_API_KEY || 'master_dev_key_12345';

function authenticateMaster(req, res) {
  const masterKey = req.headers['x-master-key'];
  
  if (!masterKey || masterKey !== MASTER_KEY) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Master key required for API key management'
    });
    return false;
  }
  
  return true;
}

export default function handler(req, res) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Authenticate master key
  if (!authenticateMaster(req, res)) {
    return;
  }

  if (req.method === 'GET') {
    // List all API keys
    const keys = listApiKeys();
    
    res.status(200).json({
      keys,
      total: keys.length,
      message: 'API keys retrieved successfully'
    });
    
  } else if (req.method === 'POST') {
    // Create new API key
    const { name, rateLimit } = req.body || {};
    
    if (!name) {
      return res.status(400).json({
        error: 'Name is required',
        message: 'Please provide a name for the API key'
      });
    }

    const rateLimitNum = parseInt(rateLimit) || 100;
    if (rateLimitNum < 1 || rateLimitNum > 10000) {
      return res.status(400).json({
        error: 'Invalid rate limit',
        message: 'Rate limit must be between 1 and 10000 requests per hour'
      });
    }

    const result = createApiKey(name, rateLimitNum);
    
    res.status(201).json({
      message: 'API key created successfully',
      apiKey: result.apiKey,
      keyData: result.keyData,
      warning: 'Store this API key securely. It cannot be retrieved again.'
    });
    
  } else {
    res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET and POST methods are supported'
    });
  }
}
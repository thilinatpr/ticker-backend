/**
 * API Key Authentication utilities
 */

import crypto from 'crypto';

// Simple in-memory store for API keys (in production, use a database)
const API_KEYS = new Map([
  ['tk_demo_key_12345', { 
    name: 'Demo Key', 
    created: new Date().toISOString(),
    rateLimit: 100, // requests per hour
    isActive: true 
  }],
  ['tk_test_67890', { 
    name: 'Test Key', 
    created: new Date().toISOString(),
    rateLimit: 50,
    isActive: true 
  }]
]);

// Rate limiting store (in production, use Redis)
const RATE_LIMIT_STORE = new Map();

/**
 * Generate a new API key
 */
function generateApiKey() {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `tk_${randomBytes}`;
}

/**
 * Validate API key format
 */
function isValidApiKeyFormat(key) {
  return typeof key === 'string' && key.startsWith('tk_') && key.length >= 35;
}

/**
 * Check if API key exists and is active
 */
function validateApiKey(apiKey) {
  if (!isValidApiKeyFormat(apiKey)) {
    return { valid: false, error: 'Invalid API key format' };
  }

  const keyData = API_KEYS.get(apiKey);
  if (!keyData) {
    return { valid: false, error: 'API key not found' };
  }

  if (!keyData.isActive) {
    return { valid: false, error: 'API key is inactive' };
  }

  return { valid: true, keyData };
}

/**
 * Rate limiting check
 */
function checkRateLimit(apiKey, keyData) {
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000); // 1 hour in milliseconds
  
  // Get or initialize rate limit data for this key
  if (!RATE_LIMIT_STORE.has(apiKey)) {
    RATE_LIMIT_STORE.set(apiKey, []);
  }
  
  const requests = RATE_LIMIT_STORE.get(apiKey);
  
  // Remove old requests (older than 1 hour)
  const recentRequests = requests.filter(timestamp => timestamp > hourAgo);
  
  // Check if rate limit exceeded
  if (recentRequests.length >= keyData.rateLimit) {
    return { 
      allowed: false, 
      error: 'Rate limit exceeded',
      limit: keyData.rateLimit,
      remaining: 0,
      resetTime: Math.min(...recentRequests) + (60 * 60 * 1000)
    };
  }
  
  // Add current request
  recentRequests.push(now);
  RATE_LIMIT_STORE.set(apiKey, recentRequests);
  
  return {
    allowed: true,
    limit: keyData.rateLimit,
    remaining: keyData.rateLimit - recentRequests.length
  };
}

/**
 * Authentication middleware for Vercel serverless functions
 */
function requireApiKey(handler) {
  return async (req, res) => {
    // Allow health check without API key for monitoring
    if (req.url === '/api/health' && req.method === 'GET') {
      return handler(req, res);
    }

    // Extract API key from headers
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide an API key in the X-API-Key header or Authorization header'
      });
    }

    // Validate API key
    const validation = validateApiKey(apiKey);
    if (!validation.valid) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: validation.error
      });
    }

    // Check rate limiting
    const rateLimitCheck = checkRateLimit(apiKey, validation.keyData);
    if (!rateLimitCheck.allowed) {
      res.setHeader('X-RateLimit-Limit', rateLimitCheck.limit);
      res.setHeader('X-RateLimit-Remaining', rateLimitCheck.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(rateLimitCheck.resetTime).toISOString());
      
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: rateLimitCheck.error,
        limit: rateLimitCheck.limit,
        resetTime: new Date(rateLimitCheck.resetTime).toISOString()
      });
    }

    // Add rate limit headers to successful requests
    res.setHeader('X-RateLimit-Limit', rateLimitCheck.limit);
    res.setHeader('X-RateLimit-Remaining', rateLimitCheck.remaining);

    // Add API key data to request for use in handler
    req.apiKey = apiKey;
    req.apiKeyData = validation.keyData;

    return handler(req, res);
  };
}

/**
 * Create a new API key
 */
function createApiKey(name, rateLimit = 100) {
  const apiKey = generateApiKey();
  const keyData = {
    name: name || 'Unnamed Key',
    created: new Date().toISOString(),
    rateLimit: rateLimit,
    isActive: true
  };
  
  API_KEYS.set(apiKey, keyData);
  return { apiKey, keyData };
}

/**
 * List all API keys (without revealing the actual keys)
 */
function listApiKeys() {
  const keys = [];
  for (const [key, data] of API_KEYS.entries()) {
    keys.push({
      keyId: key.substring(0, 10) + '...',
      name: data.name,
      created: data.created,
      rateLimit: data.rateLimit,
      isActive: data.isActive
    });
  }
  return keys;
}

/**
 * Deactivate an API key
 */
function deactivateApiKey(apiKey) {
  const keyData = API_KEYS.get(apiKey);
  if (keyData) {
    keyData.isActive = false;
    return true;
  }
  return false;
}

export {
  generateApiKey,
  validateApiKey,
  requireApiKey,
  createApiKey,
  listApiKeys,
  deactivateApiKey,
  checkRateLimit
};
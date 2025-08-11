/**
 * Dashboard Configuration
 * Update these settings for your deployment
 */

export const DASHBOARD_CONFIG = {
  // Base URLs - update these for your deployment
  API_BASE_URL: process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}/api` 
    : 'http://localhost:3000/api',
    
  DASHBOARD_URL: process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}/update-dashboard.html` 
    : 'http://localhost:3000/update-dashboard.html',

  // Rate limiting settings
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: 5,
    DELAY_BETWEEN_REQUESTS: 12000, // 12 seconds
    BATCH_SIZE: 5,
    MAX_CONCURRENT_CHECKS: 10
  },

  // API Keys for multi-user support
  API_KEYS: {
    demo: 'tk_demo_key_12345',
    user1: 'tk_user1_api_key_67890',
    user2: 'tk_user2_api_key_abcde',
    // Add more users as needed
  },

  // Update strategy settings
  UPDATE_STRATEGY: {
    FULL_HISTORICAL_MONTHS: 12, // How many months of historical data
    FUTURE_MONTHS: 3, // How many months ahead to fetch
    STALE_DATA_DAYS: 30, // Consider data stale after N days
    DEFAULT_USER_KEY: 'demo' // Default API key to use
  },

  // User mapping - customize this for your users
  USER_MAPPING: {
    // Map email patterns to API keys
    'demo': 'demo',
    'test': 'demo',
    'user1': 'user1',
    'user2': 'user2',
    // Default key for unmapped users
    '*': 'demo'
  },

  // Dashboard settings
  DASHBOARD: {
    AUTO_START: false, // Auto-start updates when dashboard loads
    SHOW_LOGS: true, // Show activity logs
    PROGRESS_UPDATE_INTERVAL: 1000, // Update progress every N ms
    MAX_LOG_ENTRIES: 500, // Maximum number of log entries to keep
  },

  // Sample ticker lists for testing
  SAMPLE_TICKERS: {
    sp500: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'BRK.B', 'UNH', 'JNJ'],
    tech: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'CRM', 'ORCL', 'ADBE', 'INTC'],
    dividend_kings: ['KO', 'PG', 'JNJ', 'MMM', 'XOM', 'CVX', 'WMT', 'PEP', 'MCD', 'KMP'],
    minimal: ['AAPL', 'MSFT', 'GOOGL']
  }
};

/**
 * Get API key for a user email
 */
export function getUserApiKey(userEmail) {
  const email = userEmail.toLowerCase();
  
  // Check exact matches first
  for (const [pattern, keyName] of Object.entries(DASHBOARD_CONFIG.USER_MAPPING)) {
    if (pattern === '*') continue; // Skip wildcard
    
    if (email.includes(pattern)) {
      return DASHBOARD_CONFIG.API_KEYS[keyName] || DASHBOARD_CONFIG.API_KEYS[DASHBOARD_CONFIG.USER_MAPPING['*']];
    }
  }
  
  // Return default key
  const defaultKeyName = DASHBOARD_CONFIG.USER_MAPPING['*'];
  return DASHBOARD_CONFIG.API_KEYS[defaultKeyName];
}

/**
 * Get masked API key for display
 */
export function maskApiKey(apiKey) {
  if (!apiKey || apiKey.length <= 8) return apiKey;
  return apiKey.substring(0, 6) + '***' + apiKey.substring(apiKey.length - 4);
}

/**
 * Calculate update duration estimate
 */
export function estimateUpdateDuration(tickerCount) {
  if (tickerCount === 0) return 'No updates needed';
  
  const minutes = Math.ceil(tickerCount / DASHBOARD_CONFIG.RATE_LIMIT.REQUESTS_PER_MINUTE);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Get date range for updates
 */
export function getUpdateDateRange(lastUpdated = null) {
  const now = new Date();
  
  if (!lastUpdated) {
    // Full historical update
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - DASHBOARD_CONFIG.UPDATE_STRATEGY.FULL_HISTORICAL_MONTHS);
    
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + DASHBOARD_CONFIG.UPDATE_STRATEGY.FUTURE_MONTHS);
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      type: 'full'
    };
  } else {
    // Incremental update
    const startDate = new Date(lastUpdated);
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      type: 'incremental'
    };
  }
}

/**
 * Build complete dashboard URL with parameters
 */
export function buildDashboardUrl(tickers, lastUpdated, userEmail) {
  const params = new URLSearchParams();
  
  params.append('tickers', JSON.stringify(tickers));
  params.append('apiKey', getUserApiKey(userEmail));
  
  if (lastUpdated) {
    params.append('lastUpdated', lastUpdated);
  }
  
  params.append('user', btoa(userEmail)); // Base64 encode for URL safety
  params.append('session', Date.now().toString());
  
  return `${DASHBOARD_CONFIG.DASHBOARD_URL}?${params.toString()}`;
}

export default DASHBOARD_CONFIG;
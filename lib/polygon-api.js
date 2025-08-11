/**
 * Polygon API integration for fetching dividend data
 * Handles rate limiting (5 calls per minute) and data transformation
 */

import { supabase } from './supabase.js';

const POLYGON_BASE_URL = 'https://api.polygon.io/v3/reference/dividends';
const RATE_LIMIT_PER_MINUTE = 5;

/**
 * Check and update rate limits for Polygon API
 * @returns {Promise<boolean>} True if call is allowed, false if rate limited
 */
async function checkRateLimit() {
  const now = new Date();
  const serviceName = 'polygon';
  
  // Get current rate limit status
  const { data: rateLimit, error } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('service_name', serviceName)
    .single();

  if (error) {
    console.error('Error checking rate limit:', error);
    return false;
  }

  const currentMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
  const resetMinute = new Date(rateLimit.reset_minute);

  // Reset counters if we're in a new minute
  if (currentMinute > resetMinute) {
    const { error: updateError } = await supabase
      .from('rate_limits')
      .update({
        calls_this_minute: 0,
        reset_minute: currentMinute.toISOString()
      })
      .eq('service_name', serviceName);

    if (updateError) {
      console.error('Error resetting rate limit:', updateError);
      return false;
    }

    return true; // New minute, allow call
  }

  // Check if we're under the limit
  if (rateLimit.calls_this_minute >= RATE_LIMIT_PER_MINUTE) {
    return false; // Rate limited
  }

  return true; // Under limit, allow call
}

/**
 * Record an API call in rate limiting and logging tables
 * @param {string} endpoint - API endpoint called
 * @param {string} ticker - Ticker symbol (optional)
 * @param {number} responseStatus - HTTP status code
 * @param {number} responseTime - Response time in milliseconds
 * @param {number} rateLimitRemaining - Remaining calls from API response headers
 * @param {string} errorMessage - Error message if call failed
 * @returns {Promise<void>}
 */
async function recordApiCall(endpoint, ticker, responseStatus, responseTime, rateLimitRemaining, errorMessage = null) {
  const now = new Date();
  const serviceName = 'polygon';

  // Update rate limit counters
  const { error: rateLimitError } = await supabase.rpc('increment_rate_limit_counters', {
    service_name: serviceName
  });

  if (rateLimitError) {
    console.error('Error updating rate limit counters:', rateLimitError);
  }

  // Log the API call
  const { error: logError } = await supabase
    .from('api_call_logs')
    .insert({
      service_name: serviceName,
      endpoint: endpoint,
      ticker_symbol: ticker,
      response_status: responseStatus,
      response_time_ms: responseTime,
      rate_limit_remaining: rateLimitRemaining,
      error_message: errorMessage,
      metadata: {
        timestamp: now.toISOString(),
        user_agent: 'ticker-backend/1.0'
      }
    });

  if (logError) {
    console.error('Error logging API call:', logError);
  }
}

/**
 * Calculate appropriate date range for dividend data
 * @param {boolean} includeFuture - Whether to include future dividend dates
 * @returns {object} Date range with start and end dates
 */
function calculateDateRange(includeFuture = true) {
  const now = new Date();
  
  // Go back 2 years for historical data
  const startDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  
  // Go forward 6 months for announced future dividends
  const endDate = includeFuture 
    ? new Date(now.getFullYear(), now.getMonth() + 6, now.getDate())
    : now;

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

/**
 * Fetch dividend data from Polygon API for a single ticker
 * @param {string} ticker - Stock ticker symbol
 * @param {object} dateRange - Optional date range override
 * @returns {Promise<object[]>} Array of dividend records
 */
export async function fetchPolygonDividends(ticker, dateRange = null) {
  const startTime = Date.now();
  
  // Check rate limit before making call
  const canMakeCall = await checkRateLimit();
  if (!canMakeCall) {
    const error = new Error(`Rate limit exceeded for Polygon API. Maximum ${RATE_LIMIT_PER_MINUTE} calls per minute.`);
    await recordApiCall('/v3/reference/dividends', ticker, 429, Date.now() - startTime, 0, error.message);
    throw error;
  }

  const range = dateRange || calculateDateRange();
  const apiKey = process.env.POLYGON_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('POLYGON_API_KEY environment variable is not set');
  }

  // Build API URL
  const url = new URL(POLYGON_BASE_URL);
  url.searchParams.append('ticker', ticker.toUpperCase());
  url.searchParams.append('ex_dividend_date.gte', range.startDate);
  url.searchParams.append('ex_dividend_date.lte', range.endDate);
  url.searchParams.append('limit', '1000'); // Maximum results per request
  url.searchParams.append('apikey', apiKey);

  console.log(`Fetching dividends for ${ticker} from Polygon API...`);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'ticker-backend/1.0',
        'Accept': 'application/json'
      }
    });

    const responseTime = Date.now() - startTime;
    const rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');

    if (!response.ok) {
      const errorText = await response.text();
      const errorMessage = `Polygon API error (${response.status}): ${errorText}`;
      
      await recordApiCall(url.pathname, ticker, response.status, responseTime, rateLimitRemaining, errorMessage);
      
      if (response.status === 429) {
        throw new Error('Polygon API rate limit exceeded');
      } else if (response.status === 403) {
        throw new Error('Polygon API authentication failed. Check your API key.');
      } else {
        throw new Error(errorMessage);
      }
    }

    const data = await response.json();
    
    await recordApiCall(url.pathname, ticker, response.status, responseTime, rateLimitRemaining);

    console.log(`Fetched ${data.results?.length || 0} dividend records for ${ticker}`);

    return transformPolygonData(data.results || []);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    await recordApiCall(url.pathname, ticker, 0, responseTime, 0, error.message);
    throw error;
  }
}

/**
 * Transform Polygon API response to our internal format
 * @param {object[]} polygonData - Raw data from Polygon API
 * @returns {object[]} Transformed dividend records
 */
function transformPolygonData(polygonData) {
  return polygonData.map(dividend => ({
    declarationDate: dividend.declaration_date || null,
    recordDate: dividend.record_date || null,
    exDividendDate: dividend.ex_dividend_date,
    payDate: dividend.pay_date || null,
    amount: parseFloat(dividend.cash_amount) || 0,
    currency: dividend.currency || 'USD',
    frequency: dividend.frequency || 4,
    type: dividend.dividend_type || 'Cash',
    polygonId: dividend.id || null,
    dataSource: 'polygon'
  }));
}

/**
 * Check if ticker needs dividend data update
 * @param {string} ticker - Stock ticker symbol
 * @param {boolean} force - Force update regardless of last update time
 * @returns {Promise<boolean>} True if update is needed
 */
export async function needsDividendUpdate(ticker, force = false) {
  if (force) {
    return true;
  }

  const { data, error } = await supabase
    .from('tickers')
    .select('last_dividend_update, update_frequency_hours')
    .eq('symbol', ticker.toUpperCase())
    .single();

  if (error) {
    console.error(`Error checking update status for ${ticker}:`, error);
    return true; // Default to updating on error
  }

  if (!data || !data.last_dividend_update) {
    return true; // Never updated before
  }

  const lastUpdate = new Date(data.last_dividend_update);
  const now = new Date();
  const updateInterval = (data.update_frequency_hours || 24) * 60 * 60 * 1000; // Convert to milliseconds

  return (now - lastUpdate) > updateInterval;
}

/**
 * Update ticker's last dividend update timestamp
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<void>}
 */
export async function updateTickerTimestamp(ticker) {
  const { error } = await supabase
    .from('tickers')
    .update({
      last_dividend_update: new Date().toISOString(),
      last_polygon_call: new Date().toISOString()
    })
    .eq('symbol', ticker.toUpperCase());

  if (error) {
    console.error(`Error updating timestamp for ${ticker}:`, error);
  }
}

/**
 * Estimate time until next API call is allowed
 * @returns {Promise<number>} Milliseconds until next call allowed, or 0 if allowed now
 */
export async function getTimeUntilNextCall() {
  const { data: rateLimit, error } = await supabase
    .from('rate_limits')
    .select('calls_this_minute, reset_minute')
    .eq('service_name', 'polygon')
    .single();

  if (error || !rateLimit) {
    return 0; // Default to allowing call
  }

  if (rateLimit.calls_this_minute < RATE_LIMIT_PER_MINUTE) {
    return 0; // Under limit
  }

  const nextResetTime = new Date(rateLimit.reset_minute).getTime() + 60000; // Next minute
  const now = Date.now();
  
  return Math.max(0, nextResetTime - now);
}
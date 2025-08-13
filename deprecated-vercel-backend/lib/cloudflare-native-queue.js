/**
 * Stage 2: Native Cloudflare Queue Integration
 * Uses Cloudflare Queue API instead of HTTP calls for reliable message delivery
 */

/**
 * Send new ticker to native Cloudflare Queue for instant processing
 * Uses Cloudflare Queue API for guaranteed message delivery
 * @param {string|string[]} tickers - Ticker symbol(s) to process
 * @param {string} priority - Processing priority ('high', 'normal', 'low')
 * @param {boolean} force - Force update even if recently updated
 * @returns {Promise<object>} Result with success status and details
 */
export async function sendTickerToNativeQueue(tickers, priority = 'normal', force = false) {
  const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
  const CLOUDFLARE_QUEUE_ID = process.env.CLOUDFLARE_QUEUE_ID || 'ticker-dividend-queue';
  
  // Fallback to HTTP method if native queue credentials not available
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    console.log('Native queue credentials not available, falling back to HTTP method');
    const { sendTickerToQueue } = await import('./cloudflare-queue.js');
    return sendTickerToQueue(tickers, priority, force);
  }

  try {
    const tickerArray = Array.isArray(tickers) ? tickers : [tickers];
    
    const queueMessage = {
      type: 'new_ticker_processing',
      tickers: tickerArray.map(t => t.toUpperCase()),
      priority,
      force,
      timestamp: new Date().toISOString(),
      source: 'native_queue_api',
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    };

    console.log(`Sending ${tickerArray.length} tickers to native Cloudflare Queue: ${tickerArray.join(', ')}`);

    // Use Cloudflare Queue API to send message
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/queues/${CLOUDFLARE_QUEUE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              body: queueMessage,
              id: queueMessage.requestId
            }
          ]
        })
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log(`✓ Successfully sent tickers to native queue:`, result);
      return {
        success: true,
        method: 'native_queue_api',
        tickers: tickerArray,
        status: 'sent_to_native_queue',
        message: 'Tickers sent to native Cloudflare Queue for guaranteed processing',
        queueResult: result
      };
    } else {
      const errorText = await response.text();
      console.log(`Native queue send failed: ${response.status} ${errorText}`);
      
      // Fallback to HTTP method
      console.log('Falling back to HTTP queue method...');
      const { sendTickerToQueue } = await import('./cloudflare-queue.js');
      const fallbackResult = await sendTickerToQueue(tickers, priority, force);
      
      return {
        success: fallbackResult,
        method: 'http_fallback',
        tickers: tickerArray,
        status: fallbackResult ? 'sent_to_http_queue' : 'failed',
        message: fallbackResult 
          ? 'Native queue failed, successfully sent via HTTP fallback'
          : 'Both native queue and HTTP fallback failed'
      };
    }
    
  } catch (error) {
    console.error('Failed to send tickers to native queue:', error.message);
    
    // Fallback to HTTP method
    console.log('Error occurred, falling back to HTTP queue method...');
    try {
      const { sendTickerToQueue } = await import('./cloudflare-queue.js');
      const fallbackResult = await sendTickerToQueue(tickers, priority, force);
      
      return {
        success: fallbackResult,
        method: 'http_fallback_after_error',
        tickers: Array.isArray(tickers) ? tickers : [tickers],
        status: fallbackResult ? 'sent_to_http_queue' : 'failed',
        message: fallbackResult 
          ? 'Native queue error, successfully sent via HTTP fallback'
          : 'Both native queue and HTTP fallback failed',
        error: error.message
      };
    } catch (fallbackError) {
      return {
        success: false,
        method: 'all_methods_failed',
        tickers: Array.isArray(tickers) ? tickers : [tickers],
        status: 'failed',
        message: 'All queue methods failed',
        errors: {
          native: error.message,
          fallback: fallbackError.message
        }
      };
    }
  }
}

/**
 * Send message to native Cloudflare Queue using direct API call
 * This is more reliable than HTTP endpoints as it uses CF's native infrastructure
 * @param {object} message - Message object to send to queue
 * @returns {Promise<boolean>} Success status
 */
export async function sendMessageToNativeQueue(message) {
  const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
  const CLOUDFLARE_QUEUE_ID = process.env.CLOUDFLARE_QUEUE_ID || 'ticker-dividend-queue';
  
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    console.log('Native queue credentials not available');
    return false;
  }

  try {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/queues/${CLOUDFLARE_QUEUE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              body: message,
              id: messageId
            }
          ]
        })
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log(`✓ Message sent to native queue:`, result);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`Native queue message send failed: ${response.status} ${errorText}`);
      return false;
    }
    
  } catch (error) {
    console.error('Failed to send message to native queue:', error.message);
    return false;
  }
}

/**
 * Check if ticker should be processed via native queue (same logic as before)
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<object>} Decision and reasoning
 */
export async function shouldUseNativeQueue(ticker) {
  // Import here to avoid circular dependencies
  const { supabase } = await import('./supabase.js');
  
  try {
    const { data, error } = await supabase
      .from('tickers')
      .select('symbol, last_dividend_update, created_at')
      .eq('symbol', ticker.toUpperCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Ticker doesn't exist - definitely new, use native queue
    if (!data) {
      return {
        useQueue: true,
        reason: 'new_ticker',
        message: 'New ticker needs immediate historical data fetch via native queue'
      };
    }

    // Ticker exists but never had dividend data fetched
    if (!data.last_dividend_update) {
      const createdAt = new Date(data.created_at);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (createdAt > oneHourAgo) {
        return {
          useQueue: true,
          reason: 'recently_created',
          message: 'Recently created ticker needs immediate processing via native queue'
        };
      }
      
      return {
        useQueue: true,
        reason: 'no_dividend_data',
        message: 'Ticker exists but has no dividend data - processing via native queue'
      };
    }

    // Check if dividend data is stale (older than 24 hours)
    const lastUpdate = new Date(data.last_dividend_update);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    if (lastUpdate < twentyFourHoursAgo) {
      return {
        useQueue: false,
        reason: 'stale_existing_ticker',
        message: 'Existing ticker with stale data will be updated by traditional queue'
      };
    }

    return {
      useQueue: false,
      reason: 'recent_existing_ticker',
      message: 'Existing ticker with recent data will be updated by bulk process'
    };

  } catch (error) {
    console.error(`Error checking ticker ${ticker}:`, error);
    
    return {
      useQueue: true,
      reason: 'error_fallback',
      message: `Error checking ticker status, using native queue: ${error.message}`
    };
  }
}
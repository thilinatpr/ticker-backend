/**
 * Cloudflare Queue integration for instant ticker processing
 * Sends messages to CF Queue for immediate historical data fetching
 */

/**
 * Send new ticker to Cloudflare Queue for instant processing
 * @param {string|string[]} tickers - Ticker symbol(s) to process
 * @param {string} priority - Processing priority ('high', 'normal', 'low')
 * @param {boolean} force - Force update even if recently updated
 * @returns {Promise<boolean>} Success status
 */
export async function sendTickerToQueue(tickers, priority = 'normal', force = false) {
  // Try multiple possible worker URLs
  const POSSIBLE_URLS = [
    process.env.CLOUDFLARE_WORKER_QUEUE_URL,
    'ticker-backend-worker-simple.patprathnayaka.workers.dev'
  ].filter(Boolean);
  
  const API_KEY = process.env.TICKER_API_KEY || 'tk_demo_key_12345';

  try {
    const tickerArray = Array.isArray(tickers) ? tickers : [tickers];
    
    const queueMessage = {
      type: 'new_ticker_processing',
      tickers: tickerArray.map(t => t.toUpperCase()),
      priority,
      force,
      timestamp: new Date().toISOString(),
      source: 'api',
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    console.log(`Sending ${tickerArray.length} tickers to Cloudflare Queue: ${tickerArray.join(', ')}`);

    // Try each URL until one works
    for (const workerUrl of POSSIBLE_URLS) {
      try {
        console.log(`Trying worker URL: ${workerUrl}`);
        
        const response = await fetch(`${workerUrl}/queue/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
            'User-Agent': 'ticker-backend/1.0'
          },
          body: JSON.stringify(queueMessage),
          timeout: 10000 // 10 second timeout
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✓ Successfully sent tickers to queue via ${workerUrl}:`, result);
          return true;
        } else {
          console.log(`Queue send failed for ${workerUrl}: ${response.status} ${response.statusText}`);
        }
      } catch (urlError) {
        console.log(`Failed to reach ${workerUrl}:`, urlError.message);
      }
    }
    
    throw new Error(`All worker URLs failed`);
  } catch (error) {
    console.error('Failed to send tickers to queue:', error.message);
    
    // Fallback to traditional job queue if CF Queue fails
    console.log('Falling back to traditional job queue processing...');
    return false;
  }
}

/**
 * Check if ticker should be processed via queue (new ticker) vs bulk updates
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<object>} Decision and reasoning
 */
export async function shouldUseQueue(ticker) {
  // Import here to avoid circular dependencies
  const { supabase } = await import('./supabase.js');
  
  try {
    const { data, error } = await supabase
      .from('tickers')
      .select('symbol, first_dividend_fetch, last_dividend_update, is_active')
      .eq('symbol', ticker.toUpperCase())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }

    // New ticker - use queue for instant processing
    if (!data || !data.first_dividend_fetch) {
      return {
        useQueue: true,
        reason: 'new_ticker',
        message: 'New ticker needs immediate historical data fetch'
      };
    }

    // Existing ticker - let bulk updates handle it
    return {
      useQueue: false,
      reason: 'existing_ticker',
      message: 'Existing ticker will be updated by bulk process'
    };

  } catch (error) {
    console.error(`Error checking ticker ${ticker}:`, error);
    
    // Default to queue on error (safer to process immediately)
    return {
      useQueue: true,
      reason: 'error_fallback',
      message: `Error checking ticker status: ${error.message}`
    };
  }
}
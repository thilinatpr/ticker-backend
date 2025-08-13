-- Deploy only the database functions (skip tables and policies that already exist)

-- Function to get user by API key
CREATE OR REPLACE FUNCTION get_user_by_api_key(p_api_key TEXT)
RETURNS TABLE(
    user_id INTEGER,
    user_name VARCHAR(100),
    plan_type VARCHAR(20),
    max_subscriptions INTEGER,
    current_subscriptions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.user_name,
        u.plan_type,
        u.max_subscriptions,
        COUNT(us.id) as current_subscriptions
    FROM api_users u
    LEFT JOIN user_subscriptions us ON u.id = us.user_id
    WHERE u.api_key = p_api_key AND u.is_active = TRUE
    GROUP BY u.id, u.user_name, u.plan_type, u.max_subscriptions;
END;
$$ LANGUAGE plpgsql;

-- Function to subscribe to ticker
CREATE OR REPLACE FUNCTION subscribe_to_ticker(p_api_key TEXT, p_ticker VARCHAR(10), p_priority INTEGER DEFAULT 1)
RETURNS JSONB AS $$
DECLARE
    v_user_id INTEGER;
    v_max_subs INTEGER;
    v_current_subs INTEGER;
    v_result JSONB;
BEGIN
    -- Get user info
    SELECT user_id, max_subscriptions, current_subscriptions 
    INTO v_user_id, v_max_subs, v_current_subs
    FROM get_user_by_api_key(p_api_key);
    
    -- Check if user exists
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid API key or inactive user'
        );
    END IF;
    
    -- Check subscription limit
    IF v_current_subs >= v_max_subs THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Subscription limit reached',
            'limit', v_max_subs,
            'current', v_current_subs
        );
    END IF;
    
    -- Insert subscription (or update if exists)
    INSERT INTO user_subscriptions (user_id, ticker_symbol, priority)
    VALUES (v_user_id, UPPER(p_ticker), p_priority)
    ON CONFLICT (user_id, ticker_symbol) 
    DO UPDATE SET 
        priority = p_priority,
        subscribed_at = NOW();
    
    -- Log the activity
    INSERT INTO subscription_activity (user_id, action, ticker_symbol, details)
    VALUES (v_user_id, 'subscribe', UPPER(p_ticker), jsonb_build_object('priority', p_priority));
    
    -- Add ticker to global tickers table if not exists
    INSERT INTO tickers (symbol, is_active)
    VALUES (UPPER(p_ticker), true)
    ON CONFLICT (symbol) DO NOTHING;
    
    RETURN jsonb_build_object(
        'success', true,
        'ticker', UPPER(p_ticker),
        'priority', p_priority,
        'subscriptions_used', v_current_subs + 1,
        'subscriptions_limit', v_max_subs
    );
END;
$$ LANGUAGE plpgsql;

-- Function to unsubscribe from ticker
CREATE OR REPLACE FUNCTION unsubscribe_from_ticker(p_api_key TEXT, p_ticker VARCHAR(10))
RETURNS JSONB AS $$
DECLARE
    v_user_id INTEGER;
    v_deleted_count INTEGER;
BEGIN
    -- Get user ID
    SELECT user_id INTO v_user_id FROM get_user_by_api_key(p_api_key);
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid API key or inactive user'
        );
    END IF;
    
    -- Delete subscription
    DELETE FROM user_subscriptions 
    WHERE user_id = v_user_id AND ticker_symbol = UPPER(p_ticker);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    IF v_deleted_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Subscription not found',
            'ticker', UPPER(p_ticker)
        );
    END IF;
    
    -- Log the activity
    INSERT INTO subscription_activity (user_id, action, ticker_symbol)
    VALUES (v_user_id, 'unsubscribe', UPPER(p_ticker));
    
    RETURN jsonb_build_object(
        'success', true,
        'ticker', UPPER(p_ticker),
        'message', 'Successfully unsubscribed'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get user subscriptions
CREATE OR REPLACE FUNCTION get_user_subscriptions(p_api_key TEXT)
RETURNS TABLE(
    ticker_symbol VARCHAR(10),
    subscribed_at TIMESTAMP WITH TIME ZONE,
    priority INTEGER,
    last_dividend_check TIMESTAMP WITH TIME ZONE,
    auto_update_enabled BOOLEAN,
    dividend_count BIGINT
) AS $$
DECLARE
    v_user_id INTEGER;
BEGIN
    -- Get user ID
    SELECT user_id INTO v_user_id FROM get_user_by_api_key(p_api_key);
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid API key or inactive user';
    END IF;
    
    RETURN QUERY
    SELECT 
        us.ticker_symbol,
        us.subscribed_at,
        us.priority,
        us.last_dividend_check,
        us.auto_update_enabled,
        COUNT(d.id) as dividend_count
    FROM user_subscriptions us
    LEFT JOIN dividends d ON us.ticker_symbol = d.ticker
    WHERE us.user_id = v_user_id
    GROUP BY us.id, us.ticker_symbol, us.subscribed_at, us.priority, us.last_dividend_check, us.auto_update_enabled
    ORDER BY us.priority DESC, us.subscribed_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Insert sample API users (matching existing API keys) - use ON CONFLICT to avoid duplicates
INSERT INTO api_users (api_key, user_name, plan_type, max_subscriptions) VALUES
('tk_demo_key_12345', 'Demo User', 'free', 10),
('tk_test_67890', 'Test User', 'basic', 25)
ON CONFLICT (api_key) DO UPDATE SET
    user_name = EXCLUDED.user_name,
    plan_type = EXCLUDED.plan_type,
    max_subscriptions = EXCLUDED.max_subscriptions,
    updated_at = NOW();

-- Insert default preferences for existing users - use ON CONFLICT to avoid duplicates
INSERT INTO subscription_preferences (user_id, update_frequency_hours)
SELECT id, 24 FROM api_users
ON CONFLICT (user_id) DO NOTHING;
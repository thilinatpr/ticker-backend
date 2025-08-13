-- User-specific ticker subscription system schema
-- Extends the existing enhanced schema with user subscription management

-- API users table for managing user accounts linked to API keys
CREATE TABLE IF NOT EXISTS api_users (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(100) UNIQUE NOT NULL,
    user_name VARCHAR(100),
    email VARCHAR(255),
    plan_type VARCHAR(20) DEFAULT 'free', -- free, basic, premium
    max_subscriptions INTEGER DEFAULT 10, -- Subscription limit based on plan
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT valid_plan_type CHECK (plan_type IN ('free', 'basic', 'premium')),
    CONSTRAINT valid_api_key_format CHECK (api_key ~ '^tk_[a-zA-Z0-9_]{6,}$')
);

-- User ticker subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES api_users(id) ON DELETE CASCADE,
    ticker_symbol VARCHAR(10) NOT NULL,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_dividend_check TIMESTAMP WITH TIME ZONE,
    notification_enabled BOOLEAN DEFAULT TRUE,
    auto_update_enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 1, -- 1=normal, 2=high priority for updates
    
    -- Prevent duplicate subscriptions
    UNIQUE(user_id, ticker_symbol),
    
    CONSTRAINT valid_ticker_symbol CHECK (LENGTH(ticker_symbol) >= 1 AND LENGTH(ticker_symbol) <= 10),
    CONSTRAINT valid_priority CHECK (priority IN (1, 2))
);

-- User subscription preferences
CREATE TABLE IF NOT EXISTS subscription_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES api_users(id) ON DELETE CASCADE,
    dividend_alerts BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT FALSE,
    update_frequency_hours INTEGER DEFAULT 24, -- How often to check for updates
    include_future_dividends BOOLEAN DEFAULT TRUE,
    include_historical_months INTEGER DEFAULT 12, -- How many months of history to include
    csv_export_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id),
    CONSTRAINT valid_frequency CHECK (update_frequency_hours IN (1, 6, 12, 24, 48, 168)), -- 1h, 6h, 12h, 24h, 48h, 1week
    CONSTRAINT valid_history_months CHECK (include_historical_months BETWEEN 1 AND 60)
);

-- Subscription activity log for tracking changes
CREATE TABLE IF NOT EXISTS subscription_activity (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES api_users(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL, -- subscribe, unsubscribe, update_preferences
    ticker_symbol VARCHAR(10),
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_action CHECK (action IN ('subscribe', 'unsubscribe', 'update_preferences', 'bulk_subscribe', 'bulk_unsubscribe'))
);

-- Enhanced dividend view for user-specific queries
CREATE OR REPLACE VIEW user_dividends_view AS
SELECT 
    d.*,
    us.user_id,
    us.subscribed_at,
    us.priority,
    u.api_key,
    u.plan_type
FROM dividends d
JOIN user_subscriptions us ON d.ticker = us.ticker_symbol
JOIN api_users u ON us.user_id = u.id
WHERE u.is_active = TRUE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_users_api_key ON api_users(api_key);
CREATE INDEX IF NOT EXISTS idx_api_users_active ON api_users(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_api_users_plan ON api_users(plan_type);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_ticker ON user_subscriptions(ticker_symbol);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_ticker ON user_subscriptions(user_id, ticker_symbol);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_priority ON user_subscriptions(priority DESC);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_auto_update ON user_subscriptions(auto_update_enabled) WHERE auto_update_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_subscription_preferences_user ON subscription_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_activity_user_action ON subscription_activity(user_id, action, created_at);

-- Enable RLS on new tables
ALTER TABLE api_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user-specific data access
CREATE POLICY "Users can only see their own data" ON api_users
    FOR ALL TO authenticated
    USING (api_key = current_setting('app.current_api_key', TRUE));

CREATE POLICY "Users can only manage their own subscriptions" ON user_subscriptions
    FOR ALL TO authenticated
    USING (user_id = (SELECT id FROM api_users WHERE api_key = current_setting('app.current_api_key', TRUE)));

CREATE POLICY "Users can only see their own preferences" ON subscription_preferences
    FOR ALL TO authenticated
    USING (user_id = (SELECT id FROM api_users WHERE api_key = current_setting('app.current_api_key', TRUE)));

CREATE POLICY "Users can only see their own activity" ON subscription_activity
    FOR ALL TO authenticated
    USING (user_id = (SELECT id FROM api_users WHERE api_key = current_setting('app.current_api_key', TRUE)));

-- Functions for subscription management

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

-- Insert sample API users (matching existing API keys)
INSERT INTO api_users (api_key, user_name, plan_type, max_subscriptions) VALUES
('tk_demo_key_12345', 'Demo User', 'free', 10),
('tk_test_67890', 'Test User', 'basic', 25)
ON CONFLICT (api_key) DO UPDATE SET
    user_name = EXCLUDED.user_name,
    plan_type = EXCLUDED.plan_type,
    max_subscriptions = EXCLUDED.max_subscriptions,
    updated_at = NOW();

-- Insert default preferences for existing users
INSERT INTO subscription_preferences (user_id, update_frequency_hours)
SELECT id, 24 FROM api_users
ON CONFLICT (user_id) DO NOTHING;

-- Create subscription summary view for admin/monitoring
CREATE OR REPLACE VIEW subscription_summary AS
SELECT 
    u.api_key,
    u.user_name,
    u.plan_type,
    COUNT(s.id) as total_subscriptions,
    u.max_subscriptions,
    u.created_at as user_created,
    MAX(s.subscribed_at) as last_subscription,
    COUNT(CASE WHEN s.priority = 2 THEN 1 END) as high_priority_subs
FROM api_users u
LEFT JOIN user_subscriptions s ON u.id = s.user_id
WHERE u.is_active = TRUE
GROUP BY u.id, u.api_key, u.user_name, u.plan_type, u.max_subscriptions, u.created_at
ORDER BY total_subscriptions DESC;
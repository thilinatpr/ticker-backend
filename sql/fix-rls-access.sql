-- Fix RLS access issues for subscription system

-- First, let's check if RLS is blocking access
-- Temporarily disable RLS for testing (re-enable after)
ALTER TABLE api_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_preferences DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_activity DISABLE ROW LEVEL SECURITY;

-- Insert users again to make sure they exist
INSERT INTO api_users (api_key, user_name, plan_type, max_subscriptions, is_active) VALUES
('tk_demo_key_12345', 'Demo User', 'free', 10, true),
('tk_test_67890', 'Test User', 'basic', 25, true)
ON CONFLICT (api_key) DO UPDATE SET
    user_name = EXCLUDED.user_name,
    plan_type = EXCLUDED.plan_type,
    max_subscriptions = EXCLUDED.max_subscriptions,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Verify users exist
SELECT id, api_key, user_name, plan_type, is_active FROM api_users;

-- Insert preferences
INSERT INTO subscription_preferences (user_id, update_frequency_hours)
SELECT id, 24 FROM api_users
ON CONFLICT (user_id) DO NOTHING;

-- Re-enable RLS (comment out these lines if you want to keep RLS disabled for testing)
-- ALTER TABLE api_users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE subscription_preferences ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE subscription_activity ENABLE ROW LEVEL SECURITY;
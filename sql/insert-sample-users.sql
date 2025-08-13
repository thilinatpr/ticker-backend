-- Insert sample users for testing
INSERT INTO api_users (api_key, user_name, plan_type, max_subscriptions) VALUES
('tk_demo_key_12345', 'Demo User', 'free', 10),
('tk_test_67890', 'Test User', 'basic', 25)
ON CONFLICT (api_key) DO UPDATE SET
    user_name = EXCLUDED.user_name,
    plan_type = EXCLUDED.plan_type,
    max_subscriptions = EXCLUDED.max_subscriptions,
    updated_at = NOW();

-- Insert default preferences for users
INSERT INTO subscription_preferences (user_id, update_frequency_hours)
SELECT id, 24 FROM api_users
ON CONFLICT (user_id) DO NOTHING;

-- Verify users were created
SELECT api_key, user_name, plan_type, max_subscriptions, is_active FROM api_users;
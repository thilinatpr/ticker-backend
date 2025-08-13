# Manual Database Schema Deployment Guide

Since direct SQL execution via REST API is restricted, the subscription schema needs to be deployed manually through the Supabase SQL Editor.

## 🎯 Quick Deployment Steps

### 1. Open Supabase SQL Editor
1. Go to [your Supabase dashboard](https://app.supabase.com)
2. Select your project: `cdvskimffubkppnyipjc`
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**

### 2. Run the Schema
1. Copy the contents of `/root/ticker-backend/sql/user-subscriptions-schema.sql`
2. Paste into the SQL Editor
3. Click **Run** button

### 3. Verify Deployment
After running the schema, verify the tables were created:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('api_users', 'user_subscriptions', 'subscription_preferences', 'subscription_activity');

-- Check sample users
SELECT api_key, user_name, plan_type, max_subscriptions FROM api_users;

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('subscribe_to_ticker', 'unsubscribe_from_ticker', 'get_user_subscriptions');
```

## 🚀 Alternative: Direct SQL Copy-Paste

If you prefer, here's the complete schema in a single block for easy copy-paste:

```sql
-- Copy everything from user-subscriptions-schema.sql and paste in Supabase SQL Editor
-- The schema includes:
-- ✅ api_users table
-- ✅ user_subscriptions table  
-- ✅ subscription_preferences table
-- ✅ subscription_activity table
-- ✅ user_dividends_view
-- ✅ All indexes and constraints
-- ✅ Row Level Security policies
-- ✅ Database functions
-- ✅ Sample data
```

## 🧪 Test After Deployment

Once deployed, test the system:

```bash
# Test from your local machine
node test-subscriptions.js

# Or test individual endpoints
curl -H "X-API-Key: tk_demo_key_12345" \
  "https://ticker-backend-worker2.patprathnayaka.workers.dev/subscriptions"
```

## ✅ Expected Results

After successful deployment:

1. **Tables Created**: `api_users`, `user_subscriptions`, `subscription_preferences`, `subscription_activity`
2. **Sample Users**: Demo user and test user created with API keys
3. **Functions Available**: All subscription management functions working
4. **Worker Endpoints**: All subscription endpoints return data instead of 404

## 🔧 Troubleshooting

**If tables don't appear:**
- Check for SQL syntax errors in the query results
- Ensure RLS policies are properly created
- Verify foreign key constraints

**If functions don't work:**
- Functions should be created in `public` schema
- Check function permissions and security settings
- Verify parameter names match exactly

**If API still returns 404:**
- Clear browser cache and test again
- Check Cloudflare Worker logs for errors
- Verify Supabase URL and keys in worker environment

## 🎉 Success Indicators

You'll know the deployment worked when:
- ✅ `GET /subscriptions` returns `{"success": true, "subscriptions": [], "total": 0}`
- ✅ `POST /subscriptions` with valid ticker returns success
- ✅ Sample users exist in `api_users` table
- ✅ All database functions are callable via RPC

The schema is designed to be idempotent - you can run it multiple times safely.
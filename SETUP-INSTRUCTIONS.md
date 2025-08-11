# 🚀 Complete Supabase Setup Instructions

Follow these steps to get your ticker backend fully operational with Supabase.

## Step 1: Create Supabase Project (if not done)

1. Go to [supabase.com](https://supabase.com)
2. Create new project or use existing
3. Note your **Project URL** and **anon public key**

## Step 2: Set Environment Variables

Your `.env.local` file should contain:
```
SUPABASE_URL=https://cdvskimffubkppnyipjc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NODE_ENV=development
```

## Step 3: Create Database Schema

1. **Open Supabase Dashboard** → Your Project
2. **Go to SQL Editor** (left sidebar)
3. **Create new query**
4. **Copy and paste** the entire contents of `sql/setup-complete.sql`
5. **Click "Run"** to execute the script

The script will:
- ✅ Create `dividends` table with proper structure
- ✅ Add performance indexes
- ✅ Set up Row Level Security policies
- ✅ Insert sample data (8 dividend records)
- ✅ Verify setup

## Step 4: Verify Setup

Run the test script:
```bash
npm run test:db
```

You should see:
```
🔍 Testing Supabase database connection...
📊 Test 1: Querying AAPL dividend data...
✅ Found 4 AAPL dividend records
📊 Test 2: Querying non-existent ticker (TEST)...
✅ Found 0 TEST dividend records (expected: 0)
🎉 All database tests passed! Supabase connection is working properly.
```

## Step 5: Test API Endpoints

Start the development server:
```bash
npm run dev
```

Test endpoints:
- `GET http://localhost:3000/api/dividends/AAPL`
- `GET http://localhost:3000/api/dividends/MSFT?format=csv`
- `GET http://localhost:3000/api/dividends/AAPL?startDate=2024-01-01`

## Step 6: Deploy to Vercel

1. **Set environment variables** in Vercel dashboard:
   ```
   SUPABASE_URL=https://cdvskimffubkppnyipjc.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   NODE_ENV=production
   ```

2. **Deploy:**
   ```bash
   vercel deploy
   ```

## Troubleshooting

### ❌ "Could not find table 'public.dividends'"
- Run the SQL script from `sql/setup-complete.sql` in Supabase SQL Editor
- Check that RLS policies allow access

### ❌ "Missing environment variables"
- Verify `.env.local` exists with correct values
- For Vercel: Set environment variables in project settings

### ❌ API returns 500 errors
- Check Vercel function logs
- Verify Supabase credentials are correct
- Ensure database policies allow anonymous access

## Database Schema Reference

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `ticker` | VARCHAR(10) | Stock symbol (e.g., 'AAPL') |
| `declaration_date` | DATE | When dividend was announced |
| `record_date` | DATE | Record date for eligibility |
| `ex_dividend_date` | DATE | Ex-dividend date |
| `pay_date` | DATE | Payment date |
| `amount` | DECIMAL(10,6) | Dividend amount |
| `currency` | VARCHAR(3) | Currency code (default: 'USD') |
| `frequency` | INTEGER | Payments per year (default: 4) |
| `type` | VARCHAR(20) | Dividend type (default: 'Cash') |

## 🎉 Success!

Your ticker backend is now fully operational with:
- ✅ Supabase database integration
- ✅ RESTful API endpoints
- ✅ Google Apps Script compatibility
- ✅ CSV export functionality
- ✅ Date filtering
- ✅ Error handling with fallbacks
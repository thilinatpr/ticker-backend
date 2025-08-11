# Supabase Integration Setup

This guide explains how to set up Supabase database integration for the ticker backend API.

## Setup Steps

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your Project URL and anon/public key from Settings > API

### 2. Set Environment Variables

In your Vercel dashboard, add these environment variables:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
NODE_ENV=production
```

For local development, create a `.env.local` file:

```bash
cp .env.example .env.local
# Edit .env.local with your actual Supabase credentials
```

### 3. Create Database Schema

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Run the SQL script from `sql/schema.sql`

This will create:
- `dividends` table with proper indexes
- Row Level Security policies
- Sample data for testing

### 4. API Usage

The API now supports both database and fallback modes:

#### Database Mode (default)
```
GET /api/dividends/AAPL
```

#### Fallback Mode (uses mock data if database fails)
```
GET /api/dividends/AAPL?fallback=true
```

#### With Date Filtering
```
GET /api/dividends/AAPL?startDate=2024-01-01&endDate=2024-12-31
```

### 5. Response Format

The API response now includes a `dataSource` field indicating whether data came from:
- `database` - Supabase database
- `mock` - Fallback mock data

### 6. Error Handling

- Database errors automatically fall back to mock data when `fallback=true`
- 404 returned when no data found in either database or mock data
- 500 returned for server errors when fallback is disabled

## Database Schema

The `dividends` table structure:

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| ticker | VARCHAR(10) | Stock symbol |
| declaration_date | DATE | Date dividend was declared |
| ex_dividend_date | DATE | Ex-dividend date |
| pay_date | DATE | Payment date |
| amount | DECIMAL(10,6) | Dividend amount |
| currency | VARCHAR(3) | Currency (default: USD) |
| frequency | INTEGER | Payments per year (default: 4) |
| type | VARCHAR(20) | Dividend type (default: Cash) |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

## Adding New Data

Use the `storeDividendHistory` function from `lib/supabase.js`:

```javascript
import { storeDividendHistory } from './lib/supabase.js';

const dividends = [
  {
    declarationDate: '2024-01-15',
    exDividendDate: '2024-01-25',
    payDate: '2024-02-01',
    amount: 0.25,
    currency: 'USD',
    frequency: 4,
    type: 'Cash'
  }
];

await storeDividendHistory('AAPL', dividends);
```
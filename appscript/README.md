# 📊 Dividend Dashboard - Google Apps Script Integration

Simple integration to trigger dividend dashboard updates directly from Google Sheets.

## 🚀 Quick Setup

### Step 1: Copy Files to Google Apps Script
1. Go to [script.google.com](https://script.google.com)
2. Create new project
3. Copy `DividendDashboard.gs` content to your project
4. Save the project

### Step 2: Run Setup
```javascript
DividendDash_completeSetup();
```

### Step 3: Use the Dashboard
- **Automatic**: Enter "UPDATE_DIVIDENDS" in cell A1 of your Google Sheet
- **Manual**: Run `DividendDash_triggerUpdate()` in Apps Script

## 📋 Available Functions

### Setup Functions
- `DividendDash_completeSetup()` - One-time setup (run once)
- `DividendDash_validateSetup()` - Check if everything works
- `DividendDash_testIntegration()` - Test dashboard integration

### Trigger Functions
- `DividendDash_triggerUpdate()` - Open dashboard manually (always works)
- `onEdit(e)` - Automatic trigger when A1 = "UPDATE_DIVIDENDS"

## 🎛️ How It Works

1. **Add tickers** to column A in your Google Sheet:
   ```
   A1: Ticker     B1: Last Updated
   A2: AAPL
   A3: MSFT
   A4: GOOGL
   A5: TSLA
   ```

2. **Trigger dashboard** by clearing A1 and entering "UPDATE_DIVIDENDS"

3. **Dashboard opens** automatically with your tickers ready for processing

4. **Processing time**: ~1 hour 40 minutes for 500 tickers (5 requests/minute rate limit)

## ⚡ Configuration

The dashboard connects to: `https://ticker-backend-fw3jr13tb-thilinas-projects-f6f25033.vercel.app`

**API Keys:**
- Demo: `tk_demo_key_12345` (rate limited, for testing)
- Production keys can be configured in the script

## 🧪 Testing

```javascript
// Test everything works
DividendDash_validateSetup();

// Manual trigger test  
DividendDash_triggerUpdate();

// Integration test
DividendDash_testIntegration();
```

## 📁 Files in This Directory

- `DividendDashboard.gs` - Main integration script (copy this to Apps Script)
- `appsscript.json` - Project manifest
- `README.md` - This guide

## 🎯 Troubleshooting

**Dashboard doesn't open?**
- Check execution logs in Apps Script
- Try manual trigger: `DividendDash_triggerUpdate()`

**No tickers found?**
- Make sure tickers are in column A (A2, A3, A4...)
- Check ticker format: uppercase text like "AAPL", "MSFT"

**Setup errors?**
- Run `DividendDash_validateSetup()` to diagnose issues

## 🚀 Ready to Process 500+ Tickers!

Once set up, your dividend dashboard can process hundreds of tickers automatically, bypassing serverless execution limits by running in the browser with real-time progress tracking.

**Perfect for portfolio dividend analysis and tracking!** 📈
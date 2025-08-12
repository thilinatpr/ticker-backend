# GitHub Actions Deployment Setup

## Overview

This repository is configured for automated Cloudflare Worker deployment using GitHub Actions. The workflow deploys the ticker backend worker automatically on pushes to the main/master branch.

## Required GitHub Secrets

### CLOUDFLARE_API_TOKEN

**Purpose:** Authenticate with Cloudflare API for worker deployment and queue management

**How to get it:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use "Cloudflare Workers:Edit" template or create custom token with these permissions:
   - **Account permissions:** `Cloudflare Workers:Edit`
   - **Zone permissions:** `Zone Settings:Read, Zone:Read` (if using custom domains)
   - **Account resources:** `Include - All accounts` (or specific account)

**Required permissions for this token:**
```
Account - Cloudflare Workers:Edit
Account - Account Settings:Read  
```

**To add to GitHub:**
1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `CLOUDFLARE_API_TOKEN`
5. Value: Your Cloudflare API token
6. Click "Add secret"

## Deployment Workflow

### Automatic Deployment
- **Triggers:** Push to `main` or `master` branch with changes in `ticker-backend-worker2-deployed/` folder
- **Manual trigger:** Go to Actions tab → "Deploy Cloudflare Worker" → "Run workflow"

### Workflow Steps
1. **Setup:** Install Node.js and dependencies
2. **Authentication:** Verify Cloudflare API token
3. **Queue Setup:** Create/verify `ticker-dividend-queue` exists
4. **Deploy:** Deploy worker using Wrangler CLI
5. **Verify:** Test worker health endpoints
6. **Summary:** Display deployment information

### Environment Support
- **Production:** Default deployment environment
- **Development:** Available for manual deployments

## Worker Configuration

### Current Settings
- **Worker Name:** `ticker-backend-worker2`
- **Queue Name:** `ticker-dividend-queue`
- **Cron Schedule:** Daily at 9 AM and 9 PM UTC
- **API Endpoint:** Production Vercel deployment
- **API Key:** Demo key (for testing)

### Files Structure
```
ticker-backend-worker2-deployed/
├── src/
│   └── simple-index.js      # Main worker code
├── wrangler.toml           # Cloudflare configuration
├── package.json            # Dependencies
└── package-lock.json       # Locked dependencies
```

## Troubleshooting

### Common Issues

**❌ "CLOUDFLARE_API_TOKEN secret is not set"**
- Add the secret to GitHub repository settings
- Ensure token has correct permissions

**❌ Queue creation failed**
- Queue likely already exists (this is normal)
- Ensure account has Cloudflare Workers paid plan for queues

**❌ Deployment fails with permissions error**
- Check API token permissions
- Ensure token includes `Cloudflare Workers:Edit` permission

**❌ Health check fails**
- Worker might need time to propagate globally
- Check Cloudflare Dashboard for deployment status
- Verify worker URLs in the workflow

### Manual Verification

After deployment, verify the worker is running:

```bash
# Test health endpoint
curl https://ticker-backend-worker2.thilinatpr.workers.dev/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-08-12T...",
  "service": "ticker-backend-worker-simple",
  "environment": {
    "hasApiBaseUrl": true,
    "hasApiKey": true,
    "hasQueue": true
  }
}
```

### Monitoring

**View Logs:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Workers & Pages → ticker-backend-worker2
3. Click "Logs" tab
4. Monitor cron job execution and queue processing

**Check Cron Status:**
- Cron jobs run twice daily (9 AM and 9 PM UTC)
- Look for scheduled events in worker logs
- Verify API calls to main ticker backend

## Security Notes

- API tokens are stored as encrypted GitHub secrets
- Worker uses demo API key (consider upgrading for production)
- Queue messages are processed securely within Cloudflare network
- All external API calls use HTTPS

## Next Steps

1. ✅ Add `CLOUDFLARE_API_TOKEN` to GitHub secrets
2. ✅ Push changes to trigger first deployment
3. ✅ Monitor deployment in GitHub Actions tab
4. ✅ Verify worker health after deployment
5. ✅ Check worker logs in Cloudflare Dashboard
6. 🔄 Upgrade to production API key when ready
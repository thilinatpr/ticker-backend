# Vercel Environment Variables Setup

## 🚀 **Required Environment Variables for Vercel Deployment**

### **1. Database (Required)**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```

### **2. External APIs (Required)**
```bash
POLYGON_API_KEY=your-polygon-api-key
```

### **3. API Management (Recommended)**
```bash
MASTER_API_KEY=your-secure-master-key-for-api-management
TICKER_API_KEY=your-main-api-key-for-worker-auth
```

### **4. Cloudflare Integration (Optional)**
```bash
CLOUDFLARE_WORKER_QUEUE_URL=https://ticker-backend-worker-simple.patprathnayaka.workers.dev
```

### **5. Environment Configuration**
```bash
NODE_ENV=production
CUSTOM_BASE_URL=https://ticker-backend-nu.vercel.app
```

## 📋 **How to Set in Vercel Dashboard**

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable with these settings:
   - **Environment**: Production, Preview, Development (or specific)
   - **Value**: Your actual secret values

## ⚠️ **Critical Notes**

### **DO NOT set these manually (Vercel auto-populates):**
- `VERCEL_URL` - Auto-generated deployment URL
- `VERCEL_ENV` - Auto-set to development/preview/production

### **Security Best Practices:**
- Never commit real API keys to git
- Use different keys for development/production
- Rotate keys regularly
- Use strong, unique master keys

### **For the permanent URL approach:**
Set `CUSTOM_BASE_URL=https://ticker-backend-nu.vercel.app` to ensure consistent URLs across deployments instead of relying on auto-generated Vercel URLs.

## 🔧 **Current Configuration Issues Fixed**

1. **✅ Added missing environment variables** to .env.example
2. **✅ Fixed VERCEL_URL dependency** with CUSTOM_BASE_URL fallback
3. **✅ Separated deployment tokens** from runtime configuration
4. **✅ Added proper documentation** for each variable's purpose
5. **✅ Made optional variables clearly marked** as optional

## 🧪 **Testing the Setup**

After setting environment variables in Vercel:
1. Deploy the application
2. Test health endpoint: `GET /api/health`
3. Test with API key: `GET /api/dividends/AAPL` with `X-API-Key` header
4. Check worker integration if configured

## 🔄 **Migration from Current Setup**

If you have environment variables set in Vercel already:
1. Add the missing variables listed above
2. Update `CUSTOM_BASE_URL` to your permanent URL
3. Ensure `CLOUDFLARE_WORKER_QUEUE_URL` points to correct worker
4. Test the deployment after adding variables
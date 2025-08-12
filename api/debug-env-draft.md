/**
 * Debug endpoint to check environment variables (development only)
 */

export default async function handler(req, res) {
  // Only allow in development or with special debug header
  if (process.env.NODE_ENV === 'production' && req.headers['x-debug-key'] !== 'debug123') {
    return res.status(403).json({ error: 'Debug endpoint disabled in production' });
  }

  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    POLYGON_API_KEY: process.env.POLYGON_API_KEY ? 
      `${process.env.POLYGON_API_KEY.substring(0, 8)}...` : 'NOT_SET',
    SUPABASE_URL: process.env.SUPABASE_URL ? 
      `${process.env.SUPABASE_URL.substring(0, 20)}...` : 'NOT_SET',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 
      `${process.env.SUPABASE_ANON_KEY.substring(0, 8)}...` : 'NOT_SET'
  };

  res.json({
    message: 'Environment variables check',
    env: envVars,
    timestamp: new Date().toISOString()
  });
}
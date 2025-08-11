/**
 * Main entry point for local development
 * In production, Vercel handles routing through the /api directory
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Basic route for local testing
app.get('/', (req, res) => {
  res.json({
    message: 'Ticker Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      dividends: '/api/dividends/:ticker',
      updateTickers: '/api/update-tickers',
      jobs: '/api/jobs',
      processQueue: '/api/process-queue'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ticker-backend',
    version: '1.0.0',
    features: [
      'dividend-tracking',
      'background-processing',
      'rate-limiting',
      'job-management'
    ]
  });
});

// For ES modules, check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(port, () => {
    console.log(`🚀 Ticker Backend API Server running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/api/health`);
    console.log(`📋 Available endpoints:`);
    console.log(`   • GET  /api/health`);
    console.log(`   • GET  /api/dividends/:ticker`);
    console.log(`   • POST /api/update-tickers`);
    console.log(`   • GET  /api/jobs`);
    console.log(`   • POST /api/process-queue`);
  });
}

export default app;
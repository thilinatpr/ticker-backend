/**
 * Main entry point for local development
 * In production, Vercel handles routing through the /api directory
 */

const express = require('express');
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
      dividends: '/api/dividends/:ticker'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ticker-backend',
    version: '1.0.0'
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/api/health`);
  });
}

module.exports = app;
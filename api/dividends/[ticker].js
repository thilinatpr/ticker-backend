/**
 * API endpoint for fetching dividend history by ticker symbol
 * GET /api/dividends/:ticker
 * Requires: X-API-Key header
 */

const { requireApiKey } = require('../../lib/auth');

const mockDividendData = {
  'AAPL': [
    {
      declarationDate: '2024-05-02',
      exDividendDate: '2024-05-10',
      payDate: '2024-05-16',
      amount: 0.24,
      currency: 'USD',
      frequency: 4,
      type: 'Cash'
    },
    {
      declarationDate: '2024-02-01',
      exDividendDate: '2024-02-09',
      payDate: '2024-02-15',
      amount: 0.24,
      currency: 'USD',
      frequency: 4,
      type: 'Cash'
    }
  ],
  'MSFT': [
    {
      declarationDate: '2024-06-18',
      exDividendDate: '2024-08-21',
      payDate: '2024-09-12',
      amount: 0.75,
      currency: 'USD',
      frequency: 4,
      type: 'Cash'
    }
  ]
};

function handler(req, res) {
  const { ticker } = req.query;
  const { startDate, endDate } = req.query;

  if (!ticker) {
    return res.status(400).json({
      error: 'Ticker symbol is required'
    });
  }

  const tickerUpper = ticker.toUpperCase();
  const dividendHistory = mockDividendData[tickerUpper];

  if (!dividendHistory) {
    return res.status(404).json({
      error: `No dividend data found for ticker: ${tickerUpper}`
    });
  }

  let filteredDividends = dividendHistory;

  // Filter by date range if provided
  if (startDate || endDate) {
    filteredDividends = dividendHistory.filter(dividend => {
      const exDate = new Date(dividend.exDividendDate);
      
      if (startDate && exDate < new Date(startDate)) {
        return false;
      }
      
      if (endDate && exDate > new Date(endDate)) {
        return false;
      }
      
      return true;
    });
  }

  res.status(200).json({
    ticker: tickerUpper,
    dividends: filteredDividends,
    apiKeyName: req.apiKeyData?.name || 'Unknown'
  });
}

export default requireApiKey(handler);
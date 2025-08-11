/**
 * API endpoint for fetching dividend history by ticker symbol
 * GET /api/dividends/:ticker
 * Requires: X-API-Key header
 */

import { requireApiKey } from '../../lib/auth.js';
import { setCorsHeaders } from '../../middleware/cors.js';
import { getDividendHistory } from '../../lib/supabase.js';

const mockDividendData = {
  'AAPL': [
    {
      declarationDate: '2024-05-02',
      recordDate: '2024-05-13',
      exDividendDate: '2024-05-10',
      payDate: '2024-05-16',
      amount: 0.24,
      currency: 'USD',
      frequency: 4,
      type: 'Cash'
    },
    {
      declarationDate: '2024-02-01',
      recordDate: '2024-02-12',
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
      recordDate: '2024-08-22',
      exDividendDate: '2024-08-21',
      payDate: '2024-09-12',
      amount: 0.75,
      currency: 'USD',
      frequency: 4,
      type: 'Cash'
    }
  ]
};

async function handler(req, res) {
  // Set CORS headers for Apps Script compatibility
  setCorsHeaders(res);
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { ticker } = req.query;
  const { startDate, endDate, format, fallback, checkOnly, lastUpdated } = req.query;

  if (!ticker) {
    return res.status(400).json({
      error: 'Ticker symbol is required'
    });
  }

  const tickerUpper = ticker.toUpperCase();
  
  // Handle checkOnly request - return whether ticker needs updating
  if (checkOnly === 'true') {
    try {
      const dividendHistory = await getDividendHistory(tickerUpper);
      
      if (dividendHistory.length === 0) {
        return res.status(200).json({
          needsUpdate: true,
          reason: 'No dividend data found',
          lastDividendDate: null
        });
      }
      
      // Check if we have recent data
      const mostRecentDividend = dividendHistory
        .sort((a, b) => new Date(b.exDividendDate) - new Date(a.exDividendDate))[0];
      
      const mostRecentDate = new Date(mostRecentDividend.exDividendDate);
      const now = new Date();
      const daysSinceUpdate = Math.floor((now - mostRecentDate) / (1000 * 60 * 60 * 24));
      
      // If lastUpdated provided, check if we have new data since then
      if (lastUpdated) {
        const lastUpdateDate = new Date(lastUpdated);
        const needsUpdate = mostRecentDate > lastUpdateDate || daysSinceUpdate > 30;
        
        return res.status(200).json({
          needsUpdate,
          reason: needsUpdate ? 'New dividends available or data is stale' : 'Data is up to date',
          lastDividendDate: mostRecentDividend.exDividendDate,
          daysSinceLastUpdate: daysSinceUpdate
        });
      }
      
      // Default: needs update if data is older than 30 days
      const needsUpdate = daysSinceUpdate > 30;
      
      return res.status(200).json({
        needsUpdate,
        reason: needsUpdate ? 'Data is stale (>30 days)' : 'Data is recent',
        lastDividendDate: mostRecentDividend.exDividendDate,
        daysSinceLastUpdate: daysSinceUpdate
      });
      
    } catch (error) {
      console.error('Error checking ticker update status:', error);
      return res.status(200).json({
        needsUpdate: true,
        reason: 'Database error - assuming update needed',
        error: error.message
      });
    }
  }
  
  try {
    // Try to get data from Supabase first
    let dividendHistory = await getDividendHistory(tickerUpper, startDate, endDate);
    
    // Fallback to mock data if no data found and fallback is requested
    if (dividendHistory.length === 0 && fallback === 'true') {
      const mockData = mockDividendData[tickerUpper];
      if (mockData) {
        dividendHistory = mockData;
        
        // Apply date filtering to mock data
        if (startDate || endDate) {
          dividendHistory = mockData.filter(dividend => {
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
      }
    }

    if (dividendHistory.length === 0) {
      return res.status(404).json({
        error: `No dividend data found for ticker: ${tickerUpper}`
      });
    }

    // Handle CSV format for Google Sheets IMPORTDATA function
    if (format === 'csv') {
      const csvHeader = 'Declaration Date,Record Date,Ex-Dividend Date,Pay Date,Amount,Currency,Frequency,Type';
      const csvRows = dividendHistory.map(d => 
        `${d.declarationDate},${d.recordDate || ''},${d.exDividendDate},${d.payDate},${d.amount},${d.currency},${d.frequency},${d.type}`
      );
      const csvContent = [csvHeader, ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${tickerUpper}_dividends.csv"`);
      return res.status(200).send(csvContent);
    }
    
    // Default JSON response for Apps Script
    res.status(200).json({
      ticker: tickerUpper,
      dividends: dividendHistory,
      apiKeyName: req.apiKeyData?.name || 'Unknown',
      totalRecords: dividendHistory.length,
      lastUpdated: new Date().toISOString(),
      dataSource: dividendHistory === mockDividendData[tickerUpper] ? 'mock' : 'database'
    });
    
  } catch (error) {
    console.error('Error fetching dividend data:', error);
    
    // Fallback to mock data on database error
    const mockData = mockDividendData[tickerUpper];
    if (mockData && (fallback === 'true' || fallback === undefined)) {
      let filteredDividends = mockData;
      
      // Apply date filtering to mock data
      if (startDate || endDate) {
        filteredDividends = mockData.filter(dividend => {
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
      
      return res.status(200).json({
        ticker: tickerUpper,
        dividends: filteredDividends,
        apiKeyName: req.apiKeyData?.name || 'Unknown',
        totalRecords: filteredDividends.length,
        lastUpdated: new Date().toISOString(),
        dataSource: 'mock',
        warning: 'Database unavailable, using fallback data'
      });
    }
    
    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Database unavailable'
    });
  }
}

export default requireApiKey(handler);
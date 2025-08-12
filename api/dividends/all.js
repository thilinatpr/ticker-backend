/**
 * API endpoint for fetching dividend history for all tickers
 * GET /api/dividends/all
 * Requires: X-API-Key header
 * Supports CSV format for bulk export
 */

import { requireApiKey } from '../../lib/auth.js';
import { setCorsHeaders } from '../../middleware/cors.js';
import { getAllDividendHistory } from '../../lib/supabase.js';

async function handler(req, res) {
  // Set CORS headers for Apps Script compatibility
  setCorsHeaders(res);
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { startDate, endDate, format, limit, offset } = req.query;
  
  try {
    // Get all dividend data from Supabase
    const dividendHistory = await getAllDividendHistory(startDate, endDate, limit, offset);
    
    if (dividendHistory.length === 0) {
      return res.status(404).json({
        error: 'No dividend data found'
      });
    }

    // Handle CSV format for bulk export
    if (format === 'csv') {
      const csvHeader = 'Ticker,Declaration Date,Record Date,Ex-Dividend Date,Pay Date,Amount,Currency,Frequency,Type';
      const csvRows = dividendHistory.map(d => 
        `${d.ticker},${d.declarationDate || ''},${d.recordDate || ''},${d.exDividendDate},${d.payDate || ''},${d.amount},${d.currency},${d.frequency},${d.type}`
      );
      const csvContent = [csvHeader, ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="all_dividends.csv"`);
      return res.status(200).send(csvContent);
    }
    
    // Default JSON response
    res.status(200).json({
      dividends: dividendHistory,
      apiKeyName: req.apiKeyData?.name || 'Unknown',
      totalRecords: dividendHistory.length,
      lastUpdated: new Date().toISOString(),
      dataSource: 'database'
    });
    
  } catch (error) {
    console.error('Error fetching all dividend data:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Database unavailable'
    });
  }
}

export default requireApiKey(handler);
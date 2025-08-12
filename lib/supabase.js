/**
 * Supabase client configuration
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Get dividend history for a ticker from Supabase
 * @param {string} ticker - Stock ticker symbol
 * @param {string} startDate - Optional start date filter (ISO string)
 * @param {string} endDate - Optional end date filter (ISO string)
 * @returns {Promise<Array>} Array of dividend records
 */
export async function getDividendHistory(ticker, startDate, endDate) {
  let query = supabase
    .from('dividends')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .order('ex_dividend_date', { ascending: false });

  if (startDate) {
    query = query.gte('ex_dividend_date', startDate);
  }

  if (endDate) {
    query = query.lte('ex_dividend_date', endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  // Transform database fields to API format
  return data.map(record => ({
    declarationDate: record.declaration_date,
    recordDate: record.record_date,
    exDividendDate: record.ex_dividend_date,
    payDate: record.pay_date,
    amount: parseFloat(record.amount),
    currency: record.currency,
    frequency: record.frequency,
    type: record.type
  }));
}

/**
 * Store dividend data in Supabase with enhanced error handling and validation
 * @param {string} ticker - Stock ticker symbol
 * @param {Array} dividends - Array of dividend objects
 * @returns {Promise<object>} Result summary with counts
 */
export async function storeDividendHistory(ticker, dividends) {
  if (!dividends || dividends.length === 0) {
    return {
      inserted: 0,
      updated: 0,
      errors: 0,
      total: 0
    };
  }

  const tickerUpper = ticker.toUpperCase();
  
  // Validate and transform records
  const validRecords = [];
  const errors = [];

  for (const dividend of dividends) {
    try {
      // Validate required fields
      if (!dividend.exDividendDate) {
        errors.push(`Missing ex-dividend date for ${tickerUpper}`);
        continue;
      }

      if (!dividend.amount || dividend.amount <= 0) {
        errors.push(`Invalid dividend amount for ${tickerUpper} on ${dividend.exDividendDate}: ${dividend.amount}`);
        continue;
      }

      const record = {
        ticker: tickerUpper,
        declaration_date: dividend.declarationDate || null,
        record_date: dividend.recordDate || null,
        ex_dividend_date: dividend.exDividendDate,
        pay_date: dividend.payDate || null,
        amount: parseFloat(dividend.amount),
        currency: dividend.currency || 'USD',
        frequency: dividend.frequency || 4,
        type: dividend.type || 'Cash',
        polygon_id: dividend.polygonId || null,
        data_source: dividend.dataSource || 'polygon',
        cash_amount_usd: dividend.currency === 'USD' ? parseFloat(dividend.amount) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      validRecords.push(record);

    } catch (err) {
      errors.push(`Error processing dividend record: ${err.message}`);
    }
  }

  if (validRecords.length === 0) {
    throw new Error(`No valid dividend records to store for ${tickerUpper}. Errors: ${errors.join(', ')}`);
  }

  // Store records with upsert to handle duplicates
  const { error, count } = await supabase
    .from('dividends')
    .upsert(validRecords, {
      onConflict: 'ticker,ex_dividend_date',
      count: 'exact'
    })
    .select('id');

  if (error) {
    console.error(`Failed to store dividend data for ${tickerUpper}:`, error);
    throw new Error(`Failed to store dividend data for ${tickerUpper}: ${error.message}`);
  }

  console.log(`Successfully stored ${count || validRecords.length} dividend records for ${tickerUpper}`);

  return {
    inserted: count || validRecords.length,
    updated: 0, // Supabase upsert doesn't distinguish between insert/update
    errors: errors.length,
    total: dividends.length,
    validRecords: validRecords.length,
    errorMessages: errors
  };
}

/**
 * Get dividend history for all tickers from Supabase
 * @param {string} startDate - Optional start date filter (ISO string)
 * @param {string} endDate - Optional end date filter (ISO string)
 * @param {number} limit - Optional limit for pagination
 * @param {number} offset - Optional offset for pagination
 * @returns {Promise<Array>} Array of dividend records with ticker symbols
 */
export async function getAllDividendHistory(startDate, endDate, limit, offset) {
  let query = supabase
    .from('dividends')
    .select('*')
    .order('ex_dividend_date', { ascending: false });

  if (startDate) {
    query = query.gte('ex_dividend_date', startDate);
  }

  if (endDate) {
    query = query.lte('ex_dividend_date', endDate);
  }

  if (limit) {
    query = query.limit(parseInt(limit));
  }

  if (offset) {
    query = query.range(parseInt(offset || 0), parseInt(offset || 0) + parseInt(limit || 1000) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  // Transform database fields to API format
  return data.map(record => ({
    ticker: record.ticker,
    declarationDate: record.declaration_date,
    recordDate: record.record_date,
    exDividendDate: record.ex_dividend_date,
    payDate: record.pay_date,
    amount: parseFloat(record.amount),
    currency: record.currency,
    frequency: record.frequency,
    type: record.type
  }));
}
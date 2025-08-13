/**
 * One-time schema fix for polygon_id field length
 * GET /api/fix-schema
 * This extends polygon_id from VARCHAR(50) to VARCHAR(100)
 */

import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    console.log('Fixing polygon_id field length...');

    // Extend polygon_id field from VARCHAR(50) to VARCHAR(100)
    const { error } = await supabase
      .from('dividends')
      .select('id')
      .limit(1); // Just test connection first

    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    // Use raw SQL to alter the column
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE dividends ALTER COLUMN polygon_id TYPE VARCHAR(100)'
    });

    if (alterError) {
      // Try alternative approach
      console.log('Direct RPC failed, trying alternative...');
      
      // Since we can't run raw SQL easily, let's just document the fix needed
      return res.json({
        success: false,
        message: 'Schema fix needed but requires database admin access',
        issue: 'polygon_id VARCHAR(50) needs to be VARCHAR(100)',
        polygonIdExample: 'Ed2c9da60abda1e3f0e99a43f6465863c137b671e1f5cd3f833d1fcb4f4eb27fe',
        currentLength: 50,
        requiredLength: 100,
        sqlFix: 'ALTER TABLE dividends ALTER COLUMN polygon_id TYPE VARCHAR(100);',
        recommendation: 'Run this SQL in Supabase SQL Editor'
      });
    }

    console.log('Schema fix completed successfully');

    res.json({
      success: true,
      message: 'polygon_id field extended to VARCHAR(100)',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Schema fix error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      issue: 'polygon_id VARCHAR(50) needs to be VARCHAR(100)',
      polygonIdExample: 'Ed2c9da60abda1e3f0e99a43f6465863c137b671e1f5cd3f833d1fcb4f4eb27fe',
      sqlFix: 'ALTER TABLE dividends ALTER COLUMN polygon_id TYPE VARCHAR(100);',
      recommendation: 'Run this SQL in Supabase SQL Editor'
    });
  }
}
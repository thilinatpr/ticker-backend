#!/usr/bin/env node

/**
 * Deploy user subscription schema to Supabase database
 * This script executes the SQL schema via Supabase REST API
 */

const fs = require('fs');
const path = require('path');

// Supabase configuration
const SUPABASE_URL = 'https://cdvskimffubkppnyipjc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkdnNraW1mZnVia3BwbnlpcGpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4OTAwNDksImV4cCI6MjA3MDQ2NjA0OX0.dEtTfbzDfFmP2wJH-TosngTj9useLGwKW3l_xTWDk7o';

async function executeSQL(sql, description) {
  console.log(`\n🔄 ${description}...`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ sql_statement: sql })
    });

    if (response.ok) {
      console.log(`✅ ${description} - SUCCESS`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`❌ ${description} - FAILED: ${response.status}`);
      console.log(`Error: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${description} - ERROR: ${error.message}`);
    return false;
  }
}

async function createExecuteFunction() {
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_statement TEXT)
    RETURNS TEXT AS $$
    BEGIN
        EXECUTE sql_statement;
        RETURN 'Success';
    EXCEPTION
        WHEN OTHERS THEN
            RETURN 'Error: ' || SQLERRM;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  return await executeSQL(createFunctionSQL, 'Creating SQL execution helper function');
}

async function deploySchema() {
  console.log('🚀 Deploying User Subscription Schema to Supabase');
  console.log('📍 Database:', SUPABASE_URL);
  console.log('=' * 60);

  // First, try to create the helper function
  const helperCreated = await createExecuteFunction();
  
  if (!helperCreated) {
    console.log('❌ Cannot proceed without SQL execution function');
    console.log('📝 Manual deployment required - run the SQL file directly in Supabase SQL Editor');
    return;
  }

  // Read the schema file
  const schemaPath = path.join(__dirname, 'sql', 'user-subscriptions-schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    console.log('❌ Schema file not found:', schemaPath);
    return;
  }

  const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
  console.log(`📄 Read schema file: ${schemaPath}`);
  console.log(`📏 File size: ${schemaSQL.length} characters`);

  // Split SQL into individual statements for better error handling
  const statements = schemaSQL
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

  console.log(`🔢 Found ${statements.length} SQL statements to execute`);

  let successCount = 0;
  let failureCount = 0;

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    
    if (statement.length > 0) {
      const description = `Statement ${i + 1}/${statements.length}`;
      const success = await executeSQL(statement + ';', description);
      
      if (success) {
        successCount++;
      } else {
        failureCount++;
        console.log(`📝 Failed statement: ${statement.substring(0, 100)}...`);
      }
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log('\n' + '=' * 60);
  console.log('📊 Deployment Summary:');
  console.log(`✅ Successful statements: ${successCount}`);
  console.log(`❌ Failed statements: ${failureCount}`);
  console.log(`📈 Success rate: ${Math.round((successCount / (successCount + failureCount)) * 100)}%`);

  if (failureCount === 0) {
    console.log('\n🎉 Schema deployment completed successfully!');
    console.log('🔧 Testing database functions...');
    await testDeployment();
  } else {
    console.log('\n⚠️  Some statements failed. Manual review required.');
    console.log('💡 Tip: Run failed statements manually in Supabase SQL Editor');
  }
}

async function testDeployment() {
  console.log('\n🧪 Testing deployed schema...');

  // Test 1: Check if tables exist
  try {
    const tablesResponse = await fetch(`${SUPABASE_URL}/rest/v1/api_users?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      }
    });

    if (tablesResponse.ok) {
      console.log('✅ Tables created successfully');
    } else {
      console.log('❌ Tables not accessible:', tablesResponse.status);
    }
  } catch (error) {
    console.log('❌ Table test failed:', error.message);
  }

  // Test 2: Check sample users
  try {
    const usersResponse = await fetch(`${SUPABASE_URL}/rest/v1/api_users?select=api_key,user_name,plan_type`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      }
    });

    if (usersResponse.ok) {
      const users = await usersResponse.json();
      console.log('✅ Sample users:', users.length);
      users.forEach(user => {
        console.log(`   - ${user.api_key}: ${user.user_name} (${user.plan_type})`);
      });
    }
  } catch (error) {
    console.log('❌ User test failed:', error.message);
  }

  // Test 3: Check functions
  try {
    const functionResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_by_api_key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ p_api_key: 'tk_demo_key_12345' })
    });

    if (functionResponse.ok) {
      const result = await functionResponse.json();
      console.log('✅ Database functions working');
      console.log('   Demo user found:', result.length > 0);
    } else {
      console.log('❌ Function test failed:', functionResponse.status);
    }
  } catch (error) {
    console.log('❌ Function test failed:', error.message);
  }

  console.log('\n🚀 Ready to test subscription system!');
  console.log('💡 Run: node test-subscriptions.js');
}

// Run deployment
deploySchema().catch(console.error);
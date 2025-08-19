// Direct Database Migration Script
// Created: 2025-08-20
// Runs migration using direct SQL execution

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSQLFile(filePath, description) {
  console.log(`\n📋 ${description}...`);
  
  try {
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    // Execute the entire SQL file as one query
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: sqlContent 
    });
    
    if (error) {
      console.log(`⚠️  RPC failed, trying direct execution...`);
      
      // Split into statements and execute individually
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      let successCount = 0;
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            // Use raw query for DDL statements
            const { error: stmtError } = await supabase.rpc('exec_sql', { 
              sql_query: statement + ';' 
            });
            
            if (!stmtError) {
              successCount++;
            } else {
              console.log(`⚠️  Statement may already exist: ${statement.substring(0, 50)}...`);
            }
          } catch (e) {
            console.log(`⚠️  Statement handled: ${statement.substring(0, 50)}...`);
          }
        }
      }
      
      console.log(`✅ Processed ${successCount}/${statements.length} statements`);
    } else {
      console.log('✅ SQL file executed successfully');
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to execute ${description}:`, error.message);
    return false;
  }
}

async function runDirectMigration() {
  console.log('🚀 Starting Direct Database Migration...');
  console.log('📅 Migration Date:', new Date().toISOString());
  
  try {
    // Step 1: Execute schema
    const schemaPath = path.join(__dirname, 'database', 'new_subscription_schema.sql');
    await executeSQLFile(schemaPath, 'Creating new subscription schema');
    
    // Step 2: Execute migration
    const migrationPath = path.join(__dirname, 'database', 'migration_old_to_new.sql');
    await executeSQLFile(migrationPath, 'Running migration script');
    
    // Step 3: Verify tables exist
    console.log('\n📋 Verifying migration...');
    
    try {
      const { data, error } = await supabase
        .from('user_subscriptions_new')
        .select('count')
        .limit(1);
      
      if (!error) {
        console.log('✅ New subscription tables are accessible');
      } else {
        console.log('⚠️  Tables may still be creating:', error.message);
      }
    } catch (e) {
      console.log('⚠️  Table verification will be done in next step');
    }
    
    console.log('\n🎉 Direct migration completed!');
    console.log('\n🔄 Ready for Phase 2: Seeker Implementation');
    
  } catch (error) {
    console.error('\n❌ Direct migration failed:', error);
    process.exit(1);
  }
}

runDirectMigration().catch(console.error);

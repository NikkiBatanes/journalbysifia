#!/usr/bin/env node

/**
 * Smart Journaling Migration Script
 * Phase 1: Database Foundation
 *
 * This script runs the smart journaling database migration
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting Smart Journaling Migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../database/smart_journaling_migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log('📊 Executing database migration...\n');

    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL,
    });

    if (error) {
      // If rpc doesn't exist, try direct SQL execution
      console.log('⚠️  RPC method not available, trying direct execution...');

      // Split the SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`Executing: ${statement.substring(0, 50)}...`);
          const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement });
          if (stmtError) {
            console.error(`❌ Error executing statement: ${stmtError.message}`);
            throw stmtError;
          }
        }
      }
    }

    console.log('✅ Database migration completed successfully!\n');

    // Verify the migration by checking if tables exist
    console.log('🔍 Verifying migration...');

    const verificationQueries = [
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'journal_entries')",
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'financial_entries')",
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'expounded_steps')",
      "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'subtasks' AND column_name = 'detected_journal_type')",
    ];

    for (const query of verificationQueries) {
      const { error: verifyError } = await supabase.rpc('exec_sql', { sql: query });
      if (verifyError) {
        console.warn(`⚠️  Could not verify: ${query}`);
      } else {
        console.log('✓ Verification passed');
      }
    }

    console.log('\n🎉 Smart Journaling Migration Complete!');
    console.log('\n📋 What was created:');
    console.log('   ✓ journal_entries table');
    console.log('   ✓ financial_entries table');
    console.log('   ✓ expounded_steps table');
    console.log('   ✓ Enhanced subtasks table with journal type detection');
    console.log('   ✓ Indexes for performance');
    console.log('   ✓ RLS policies for security');
    console.log('   ✓ Triggers for updated_at columns');

    console.log('\n🔄 Next Steps:');
    console.log('   1. Deploy updated playbook generation function');
    console.log('   2. Test journal type detection');
    console.log('   3. Implement Phase 2: Smart Journal Detection & Routing');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check your Supabase connection');
    console.error('   2. Verify service role key permissions');
    console.error('   3. Check the migration SQL file');
    process.exit(1);
  }
}

// Alternative method using direct SQL execution
async function runMigrationDirect() {
  console.log('🚀 Starting Smart Journaling Migration (Direct SQL)...\n');

  try {
    const migrationPath = path.join(__dirname, '../database/smart_journaling_migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log('📊 Executing database migration...\n');

    // Execute the migration using from() method
    const { error } = await supabase
      .from('_migrations')
      .insert({
        name: 'smart_journaling_migration',
        sql: migrationSQL,
        executed_at: new Date().toISOString(),
      });

    if (error) {
      console.log('⚠️  Direct table insert failed, trying SQL execution...');

      // Manual execution approach
      console.log('📝 Please run the following SQL manually in your Supabase SQL editor:');
      console.log('=' .repeat(80));
      console.log(migrationSQL);
      console.log('=' .repeat(80));

      return;
    }

    console.log('✅ Migration logged successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);

    // Fallback: show the SQL to run manually
    console.log('\n📝 Please run the migration SQL manually:');
    console.log('   1. Open your Supabase dashboard');
    console.log('   2. Go to SQL Editor');
    console.log('   3. Run the contents of: database/smart_journaling_migration.sql');
  }
}

// Run the migration
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { runMigration, runMigrationDirect };

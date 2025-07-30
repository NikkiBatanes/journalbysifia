#!/usr/bin/env node

/**
 * Migration Script: Add 'freeform' to prayers journal_category constraint
 *
 * This script updates the database to allow 'freeform' as a valid journal_category
 * for the prayers table, enabling the new Free-form Prayer feature.
 */

const { createClient } = require('@supabase/supabase-js');
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
  try {
    console.log('🚀 Starting Free-form Prayer migration...');

    console.log('📝 Executing migration SQL...');

    // Drop existing constraint
    console.log('   - Dropping existing constraint...');
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE prayers DROP CONSTRAINT IF EXISTS prayers_journal_category_check;',
    });

    if (dropError) {
      console.warn('⚠️  Warning dropping constraint:', dropError.message);
    } else {
      console.log('   ✅ Existing constraint dropped');
    }

    // Add new constraint
    console.log('   - Adding new constraint with freeform...');
    const { error: addError } = await supabase.rpc('exec_sql', {
      sql: "ALTER TABLE prayers ADD CONSTRAINT prayers_journal_category_check CHECK (journal_category IN ('adoration', 'confession', 'thanksgiving', 'supplication', 'freeform'));",
    });

    if (addError) {
      console.error('❌ Error adding new constraint:', addError.message);
      process.exit(1);
    }

    console.log('   ✅ New constraint added successfully');

    // Verify the constraint
    console.log('🔍 Verifying constraint...');
    const { data: constraintData, error: verifyError } = await supabase.rpc('exec_sql', {
      sql: "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'prayers_journal_category_check';",
    });

    if (verifyError) {
      console.warn('⚠️  Could not verify constraint:', verifyError.message);
    } else {
      console.log('   ✅ Constraint verified:', constraintData);
    }

    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('   The prayers table now accepts "freeform" as a valid journal_category.');
    console.log('   Users can now create Free-form Prayer entries.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the migration
runMigration();

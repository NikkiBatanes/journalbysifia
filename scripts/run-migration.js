// Script to run database migration for devotional metadata columns
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Running devotional metadata migration...');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../database/migrations/add_devotional_metadata_to_reflections.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!');
    console.log('📝 Added devotional metadata columns to reflection_entries table:');
    console.log('   - source (TEXT)');
    console.log('   - devotional_title (TEXT)');
    console.log('   - day_number (INTEGER)');
    console.log('   - day_title (TEXT)');
    console.log('   - total_days (INTEGER)');
    console.log('   - question_number (INTEGER)');
    console.log('🔍 Added indexes for better query performance');

  } catch (err) {
    console.error('❌ Error running migration:', err);
    process.exit(1);
  }
}

// Alternative method using direct SQL execution if rpc doesn't work
async function runMigrationDirect() {
  try {
    console.log('🚀 Running devotional metadata migration (direct method)...');

    const migrations = [
      'ALTER TABLE reflection_entries ADD COLUMN IF NOT EXISTS prompt TEXT',
      'ALTER TABLE reflection_entries ADD COLUMN IF NOT EXISTS tags TEXT[]',
      'ALTER TABLE reflection_entries ADD COLUMN IF NOT EXISTS source TEXT',
      'ALTER TABLE reflection_entries ADD COLUMN IF NOT EXISTS devotional_title TEXT',
      'ALTER TABLE reflection_entries ADD COLUMN IF NOT EXISTS day_number INTEGER',
      'ALTER TABLE reflection_entries ADD COLUMN IF NOT EXISTS day_title TEXT',
      'ALTER TABLE reflection_entries ADD COLUMN IF NOT EXISTS total_days INTEGER',
      'ALTER TABLE reflection_entries ADD COLUMN IF NOT EXISTS question_number INTEGER',
      'CREATE INDEX IF NOT EXISTS idx_reflection_entries_source ON reflection_entries(source)',
      'CREATE INDEX IF NOT EXISTS idx_reflection_entries_devotional_title ON reflection_entries(devotional_title)',
      'CREATE INDEX IF NOT EXISTS idx_reflection_entries_day_number ON reflection_entries(day_number)',
    ];

    for (const sql of migrations) {
      console.log(`Executing: ${sql}`);
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.error(`❌ Error executing: ${sql}`, error);
        // Continue with other migrations
      } else {
        console.log('✅ Success');
      }
    }

    console.log('✅ Migration completed!');

  } catch (err) {
    console.error('❌ Error running migration:', err);
    process.exit(1);
  }
}

// Try the main method first, fallback to direct method
runMigration().catch(() => {
  console.log('🔄 Trying alternative migration method...');
  runMigrationDirect();
});

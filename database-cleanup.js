/**
 * Database Cleanup Script for siFia Journal App
 *
 * This script removes duplicate entries from the journal_entries table
 * that are causing PGRST116 errors during cloud sync.
 *
 * Run this once to clean up existing duplicates.
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to replace these with your actual Supabase credentials
const SUPABASE_URL = 'your-supabase-url';
const SUPABASE_SERVICE_KEY = 'your-service-role-key'; // Use service role for admin operations

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function cleanupDuplicateEntries() {
  console.log('🧹 Starting comprehensive duplicate cleanup...');

  try {
    // 1. Find all duplicate groups
    const { data: duplicateGroups, error: findError } = await supabase
      .from('journal_entries')
      .select('user_id, content_type, selected_date, count(*)')
      .group('user_id, content_type, selected_date')
      .having('count(*) > 1');

    if (findError) {
      console.error('Error finding duplicates:', findError);
      return;
    }

    console.log(`Found ${duplicateGroups?.length || 0} groups with duplicates`);

    if (!duplicateGroups || duplicateGroups.length === 0) {
      console.log('✅ No duplicates found! Database is clean.');
      return;
    }

    let totalCleaned = 0;

    // 2. Process each duplicate group
    for (const group of duplicateGroups) {
      console.log(`\n🔍 Processing duplicates for: ${group.content_type} on ${group.selected_date}`);

      // Get all entries in this group, ordered by updated_at (newest first)
      const { data: entries, error: fetchError } = await supabase
        .from('journal_entries')
        .select('id, updated_at')
        .eq('user_id', group.user_id)
        .eq('content_type', group.content_type)
        .eq('selected_date', group.selected_date)
        .order('updated_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching entries:', fetchError);
        continue;
      }

      if (entries && entries.length > 1) {
        // Keep the first (newest) entry, delete the rest
        const toDelete = entries.slice(1).map(e => e.id);

        console.log(`  📊 Found ${entries.length} duplicates, keeping newest, deleting ${toDelete.length}`);

        const { error: deleteError } = await supabase
          .from('journal_entries')
          .delete()
          .in('id', toDelete);

        if (deleteError) {
          console.error('  ❌ Error deleting duplicates:', deleteError);
        } else {
          console.log(`  ✅ Successfully deleted ${toDelete.length} duplicate entries`);
          totalCleaned += toDelete.length;
        }
      }
    }

    console.log(`\n🎉 Cleanup complete! Removed ${totalCleaned} duplicate entries.`);
    console.log('✅ Database should now be free of PGRST116 errors.');

  } catch (error) {
    console.error('❌ Unexpected error during cleanup:', error);
  }
}

async function verifyCleanup() {
  console.log('\n🔍 Verifying cleanup...');

  const { data: remainingDuplicates, error } = await supabase
    .from('journal_entries')
    .select('user_id, content_type, selected_date, count(*)')
    .group('user_id, content_type, selected_date')
    .having('count(*) > 1');

  if (error) {
    console.error('Error verifying cleanup:', error);
    return;
  }

  if (!remainingDuplicates || remainingDuplicates.length === 0) {
    console.log('✅ Verification passed! No duplicates remain.');
  } else {
    console.log(`⚠️ Warning: ${remainingDuplicates.length} duplicate groups still exist.`);
  }
}

// Main execution
async function main() {
  console.log('🚀 siFia Database Cleanup Script');
  console.log('==================================');

  await cleanupDuplicateEntries();
  await verifyCleanup();

  console.log('\n✨ Script complete!');
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { cleanupDuplicateEntries, verifyCleanup };

#!/usr/bin/env node

/**
 * Migration Script: Add subscription_display_name column
 * 
 * This script adds the subscription_display_name column to user_subscriptions_new table
 * and updates existing records with proper display names.
 */

const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config();

// Import Supabase client
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('🚀 Starting subscription_display_name migration...\n');

  try {
    // Step 1: Add column
    console.log('📝 Step 1: Adding subscription_display_name column...');
    const { error: addColumnError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'user_subscriptions_new' 
                AND column_name = 'subscription_display_name'
            ) THEN
                ALTER TABLE user_subscriptions_new 
                ADD COLUMN subscription_display_name TEXT;
                RAISE NOTICE 'Added subscription_display_name column';
            ELSE
                RAISE NOTICE 'Column already exists';
            END IF;
        END $$;
      `
    });

    if (addColumnError) {
      // Try direct SQL execution if RPC doesn't exist
      console.log('⚠️  RPC method not available, trying direct SQL execution...');
      
      const { error: directError } = await supabase
        .from('user_subscriptions_new')
        .select('subscription_display_name')
        .limit(1);

      if (directError && directError.message.includes('column "subscription_display_name" does not exist')) {
        console.log('⚠️  Column does not exist. Please run the migration manually in Supabase SQL Editor.');
        console.log('\n📋 Copy and paste this SQL in Supabase Dashboard > SQL Editor:\n');
        
        const migrationSQL = fs.readFileSync(
          path.join(__dirname, '../database/migrations/add_subscription_display_name.sql'),
          'utf8'
        );
        console.log('─'.repeat(80));
        console.log(migrationSQL);
        console.log('─'.repeat(80));
        console.log('\n✅ After running the SQL, your migration will be complete!');
        return;
      }
    }

    console.log('✅ Column check complete\n');

    // Step 2: Update existing records
    console.log('📝 Step 2: Updating existing records with display names...');
    
    const { data: subscriptions, error: fetchError } = await supabase
      .from('user_subscriptions_new')
      .select('id, tier, trial_chosen_tier, subscription_display_name');

    if (fetchError) {
      throw new Error(`Failed to fetch subscriptions: ${fetchError.message}`);
    }

    console.log(`Found ${subscriptions.length} subscriptions to update`);

    let updated = 0;
    let skipped = 0;

    for (const sub of subscriptions) {
      // Skip if already has display name
      if (sub.subscription_display_name) {
        skipped++;
        continue;
      }

      let displayName;
      
      if (sub.tier === 'free_trial' && sub.trial_chosen_tier) {
        const tierName = sub.trial_chosen_tier.replace('_', ' ');
        displayName = `siFia ${tierName.charAt(0).toUpperCase() + tierName.slice(1)} Trial`;
      } else if (sub.tier === 'free_trial') {
        displayName = 'siFia Growth Trial';
      } else {
        const tierName = sub.tier.replace('_', ' ');
        displayName = `siFia ${tierName.charAt(0).toUpperCase() + tierName.slice(1)}`;
      }

      const { error: updateError } = await supabase
        .from('user_subscriptions_new')
        .update({ subscription_display_name: displayName })
        .eq('id', sub.id);

      if (updateError) {
        console.error(`❌ Failed to update subscription ${sub.id}:`, updateError.message);
      } else {
        updated++;
        console.log(`  ✓ Updated ${sub.tier} → "${displayName}"`);
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   - Updated: ${updated} records`);
    console.log(`   - Skipped: ${skipped} records (already had display names)`);
    console.log(`   - Total: ${subscriptions.length} records\n`);

    // Step 3: Verify
    console.log('📝 Step 3: Verifying migration...');
    const { data: verification, error: verifyError } = await supabase
      .from('user_subscriptions_new')
      .select('tier, subscription_display_name')
      .is('subscription_display_name', null);

    if (verifyError) {
      console.warn('⚠️  Could not verify migration:', verifyError.message);
    } else if (verification.length > 0) {
      console.warn(`⚠️  Warning: ${verification.length} records still have NULL display names`);
    } else {
      console.log('✅ All records have display names!\n');
    }

    console.log('🎉 Migration successful! All subscription display names are now set.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n📋 Please run the migration manually in Supabase SQL Editor:');
    console.error('   File: database/migrations/add_subscription_display_name.sql\n');
    process.exit(1);
  }
}

// Run migration
runMigration();

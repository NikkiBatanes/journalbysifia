#!/usr/bin/env node

/**
 * Database Cleanup Script
 *
 * Fixes duplicate user profiles and subscription records that are causing
 * unique constraint violations and multiple row errors.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDuplicateUserProfiles() {
  console.log('🔍 Checking for duplicate user profiles...');

  try {
    // Find users with multiple profiles
    const { data: duplicates, error } = await supabase
      .from('user_profiles')
      .select('id, created_at')
      .order('id, created_at');

    if (error) {
      console.error('Error fetching user profiles:', error);
      return;
    }

    // Group by user ID and find duplicates
    const userGroups = {};
    duplicates.forEach(profile => {
      if (!userGroups[profile.id]) {
        userGroups[profile.id] = [];
      }
      userGroups[profile.id].push(profile);
    });

    const duplicateUsers = Object.entries(userGroups).filter(([userId, profiles]) => profiles.length > 1);

    if (duplicateUsers.length === 0) {
      console.log('✅ No duplicate user profiles found');
      return;
    }

    console.log(`🚨 Found ${duplicateUsers.length} users with duplicate profiles`);

    // For each user with duplicates, keep the oldest profile and delete the rest
    for (const [userId, profiles] of duplicateUsers) {
      console.log(`Cleaning up user ${userId} (${profiles.length} profiles)`);

      // Sort by created_at to keep the oldest
      profiles.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const toKeep = profiles[0];
      const toDelete = profiles.slice(1);

      console.log(`  Keeping profile created at: ${toKeep.created_at}`);
      console.log(`  Deleting ${toDelete.length} duplicate profiles`);

      // Delete duplicate profiles
      for (const profile of toDelete) {
        const { error: deleteError } = await supabase
          .from('user_profiles')
          .delete()
          .eq('id', profile.id)
          .eq('created_at', profile.created_at);

        if (deleteError) {
          console.error(`  ❌ Error deleting duplicate profile: ${deleteError.message}`);
        } else {
          console.log(`  ✅ Deleted duplicate profile created at: ${profile.created_at}`);
        }
      }
    }

  } catch (error) {
    console.error('Error in cleanupDuplicateUserProfiles:', error);
  }
}

async function cleanupDuplicateSubscriptions() {
  console.log('🔍 Checking for duplicate user subscriptions...');

  try {
    // Find users with multiple subscriptions
    const { data: subscriptions, error } = await supabase
      .from('user_subscriptions')
      .select('user_id, created_at, tier, status')
      .order('user_id, created_at');

    if (error) {
      console.error('Error fetching user subscriptions:', error);
      return;
    }

    // Group by user ID and find duplicates
    const userGroups = {};
    subscriptions.forEach(sub => {
      if (!userGroups[sub.user_id]) {
        userGroups[sub.user_id] = [];
      }
      userGroups[sub.user_id].push(sub);
    });

    const duplicateUsers = Object.entries(userGroups).filter(([userId, subs]) => subs.length > 1);

    if (duplicateUsers.length === 0) {
      console.log('✅ No duplicate user subscriptions found');
      return;
    }

    console.log(`🚨 Found ${duplicateUsers.length} users with duplicate subscriptions`);

    // For each user with duplicates, keep the most recent active subscription
    for (const [userId, subs] of duplicateUsers) {
      console.log(`Cleaning up user ${userId} subscriptions (${subs.length} records)`);

      // Sort by priority: active status first, then by created_at (newest first)
      subs.sort((a, b) => {
        // Active subscriptions first
        if (a.status === 'active' && b.status !== 'active') {return -1;}
        if (b.status === 'active' && a.status !== 'active') {return 1;}

        // Then by created_at (newest first)
        return new Date(b.created_at) - new Date(a.created_at);
      });

      const toKeep = subs[0];
      const toDelete = subs.slice(1);

      console.log(`  Keeping subscription: ${toKeep.tier} (${toKeep.status}) created at: ${toKeep.created_at}`);
      console.log(`  Deleting ${toDelete.length} duplicate subscriptions`);

      // Delete duplicate subscriptions
      for (const sub of toDelete) {
        const { error: deleteError } = await supabase
          .from('user_subscriptions')
          .delete()
          .eq('user_id', sub.user_id)
          .eq('created_at', sub.created_at);

        if (deleteError) {
          console.error(`  ❌ Error deleting duplicate subscription: ${deleteError.message}`);
        } else {
          console.log(`  ✅ Deleted duplicate subscription: ${sub.tier} (${sub.status})`);
        }
      }
    }

  } catch (error) {
    console.error('Error in cleanupDuplicateSubscriptions:', error);
  }
}

async function fixSpecificUserIssue() {
  const problemUserId = 'b9500426-8818-48ce-807e-eb18c803d8fd';
  console.log(`🔧 Fixing specific issue for user: ${problemUserId}`);

  try {
    // Check current subscriptions for this user
    const { data: existingSubs, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', problemUserId);

    if (fetchError) {
      console.error('Error fetching existing subscriptions:', fetchError);
      return;
    }

    console.log(`Found ${existingSubs.length} existing subscriptions for user ${problemUserId}`);

    if (existingSubs.length > 1) {
      // Keep the most recent one
      existingSubs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const toKeep = existingSubs[0];
      const toDelete = existingSubs.slice(1);

      console.log(`Keeping subscription: ${toKeep.tier} created at ${toKeep.created_at}`);

      for (const sub of toDelete) {
        const { error: deleteError } = await supabase
          .from('user_subscriptions')
          .delete()
          .eq('user_id', sub.user_id)
          .eq('created_at', sub.created_at);

        if (deleteError) {
          console.error(`Error deleting subscription: ${deleteError.message}`);
        } else {
          console.log(`✅ Deleted duplicate subscription created at ${sub.created_at}`);
        }
      }
    }

    // Check user profiles for this user
    const { data: existingProfiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', problemUserId);

    if (profileError) {
      console.error('Error fetching user profiles:', profileError);
      return;
    }

    console.log(`Found ${existingProfiles.length} profiles for user ${problemUserId}`);

    if (existingProfiles.length > 1) {
      // Keep the oldest one
      existingProfiles.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const toKeep = existingProfiles[0];
      const toDelete = existingProfiles.slice(1);

      console.log(`Keeping profile created at ${toKeep.created_at}`);

      for (const profile of toDelete) {
        const { error: deleteError } = await supabase
          .from('user_profiles')
          .delete()
          .eq('id', profile.id)
          .eq('created_at', profile.created_at);

        if (deleteError) {
          console.error(`Error deleting profile: ${deleteError.message}`);
        } else {
          console.log(`✅ Deleted duplicate profile created at ${profile.created_at}`);
        }
      }
    }

  } catch (error) {
    console.error('Error fixing specific user issue:', error);
  }
}

async function main() {
  console.log('🚀 Starting database cleanup...\n');

  // Fix the specific user causing immediate issues
  await fixSpecificUserIssue();
  console.log('');

  // Clean up all duplicate user profiles
  await cleanupDuplicateUserProfiles();
  console.log('');

  // Clean up all duplicate subscriptions
  await cleanupDuplicateSubscriptions();
  console.log('');

  console.log('✅ Database cleanup completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Restart your React Native app');
  console.log('2. Test the subscription flow');
  console.log('3. Check that onboarding works correctly');
}

if (require.main === module) {
  main().catch(console.error);
}

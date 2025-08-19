#!/usr/bin/env node

/**
 * Migration Verification Script
 * Verifies that the database migration was successful and all components are working
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function verifyMigration() {
  console.log('🔍 Verifying database migration...\n');
  
  let allTestsPassed = true;
  const results = [];

  // Test 1: Check if new tables exist
  console.log('1️⃣ Checking table existence...');
  try {
    const { data: tables, error } = await supabase
      .from('user_subscriptions_new')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ user_subscriptions_new table missing');
      results.push('❌ user_subscriptions_new table missing');
      allTestsPassed = false;
    } else {
      console.log('✅ user_subscriptions_new table exists');
      results.push('✅ user_subscriptions_new table exists');
    }
  } catch (err) {
    console.log('❌ Error checking user_subscriptions_new:', err.message);
    results.push('❌ Error checking user_subscriptions_new');
    allTestsPassed = false;
  }

  // Test 2: Check family tables with more detailed error reporting
  try {
    const { data, error } = await supabase
      .from('family_subscription_groups')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ family_subscription_groups table error:', error.message);
      console.log('Error details:', error);
      results.push('❌ family_subscription_groups table error: ' + error.message);
      allTestsPassed = false;
    } else {
      console.log('✅ family_subscription_groups table exists');
      results.push('✅ family_subscription_groups table exists');
    }
  } catch (err) {
    console.log('❌ Error checking family tables:', err.message);
    results.push('❌ Error checking family tables: ' + err.message);
    allTestsPassed = false;
  }

  // Test 2b: Check family_members table
  try {
    const { data, error } = await supabase
      .from('family_members')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ family_members table error:', error.message);
      results.push('❌ family_members table error: ' + error.message);
      allTestsPassed = false;
    } else {
      console.log('✅ family_members table exists');
      results.push('✅ family_members table exists');
    }
  } catch (err) {
    console.log('❌ Error checking family_members:', err.message);
    results.push('❌ Error checking family_members: ' + err.message);
    allTestsPassed = false;
  }

  // Test 3: Check usage tracking table
  try {
    const { data, error } = await supabase
      .from('subscription_usage_tracking')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ subscription_usage_tracking table missing');
      results.push('❌ subscription_usage_tracking table missing');
      allTestsPassed = false;
    } else {
      console.log('✅ subscription_usage_tracking table exists');
      results.push('✅ subscription_usage_tracking table exists');
    }
  } catch (err) {
    console.log('❌ Error checking usage tracking:', err.message);
    results.push('❌ Error checking usage tracking');
    allTestsPassed = false;
  }

  // Test 4: Check database functions
  console.log('\n2️⃣ Testing database functions...');
  
  // Test create_default_seeker_subscription function
  try {
    // Create a test user ID (we won't actually create the user)
    const testUserId = '00000000-0000-0000-0000-000000000001';
    
    const { data, error } = await supabase.rpc('create_default_seeker_subscription', {
      target_user_id: testUserId
    });
    
    if (error && !error.message.includes('violates foreign key constraint')) {
      console.log('❌ create_default_seeker_subscription function error:', error.message);
      results.push('❌ create_default_seeker_subscription function error');
      allTestsPassed = false;
    } else {
      console.log('✅ create_default_seeker_subscription function exists');
      results.push('✅ create_default_seeker_subscription function exists');
    }
  } catch (err) {
    console.log('❌ Error testing create_default_seeker_subscription:', err.message);
    results.push('❌ Error testing create_default_seeker_subscription');
    allTestsPassed = false;
  }

  // Test start_free_trial function
  try {
    const testUserId = '00000000-0000-0000-0000-000000000001';
    
    const { data, error } = await supabase.rpc('start_free_trial', {
      target_user_id: testUserId,
      duration_days: 3
    });
    
    if (error && !error.message.includes('violates foreign key constraint')) {
      console.log('❌ start_free_trial function error:', error.message);
      results.push('❌ start_free_trial function error');
      allTestsPassed = false;
    } else {
      console.log('✅ start_free_trial function exists');
      results.push('✅ start_free_trial function exists');
    }
  } catch (err) {
    console.log('❌ Error testing start_free_trial:', err.message);
    results.push('❌ Error testing start_free_trial');
    allTestsPassed = false;
  }

  // Test check_and_handle_expired_trials function
  try {
    const { data, error } = await supabase.rpc('check_and_handle_expired_trials');
    
    if (error) {
      console.log('❌ check_and_handle_expired_trials function error:', error.message);
      results.push('❌ check_and_handle_expired_trials function error');
      allTestsPassed = false;
    } else {
      console.log('✅ check_and_handle_expired_trials function exists');
      results.push('✅ check_and_handle_expired_trials function exists');
    }
  } catch (err) {
    console.log('❌ Error testing check_and_handle_expired_trials:', err.message);
    results.push('❌ Error testing check_and_handle_expired_trials');
    allTestsPassed = false;
  }

  // Test 5: Check discount_codes table
  console.log('\n3️⃣ Checking discount_codes table...');
  try {
    const { data, error } = await supabase
      .from('discount_codes')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ discount_codes table missing or inaccessible');
      results.push('❌ discount_codes table missing');
      allTestsPassed = false;
    } else {
      console.log('✅ discount_codes table exists');
      results.push('✅ discount_codes table exists');
    }
  } catch (err) {
    console.log('❌ Error checking discount_codes:', err.message);
    results.push('❌ Error checking discount_codes');
    allTestsPassed = false;
  }

  // Summary
  console.log('\n📊 Migration Verification Summary:');
  console.log('=====================================');
  results.forEach(result => console.log(result));
  
  if (allTestsPassed) {
    console.log('\n🎉 Migration verification PASSED!');
    console.log('✅ All database components are ready for testing.');
    console.log('\n📋 Next Steps:');
    console.log('1. Run the end-to-end test: node test-complete-subscription-flow.js');
    console.log('2. Test the app with new subscription system');
    console.log('3. Deploy to production when ready');
  } else {
    console.log('\n❌ Migration verification FAILED!');
    console.log('Please check the errors above and re-run the migration script.');
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure the migration script ran without errors in Supabase SQL Editor');
    console.log('2. Check that your SUPABASE_URL and SUPABASE_ANON_KEY are correct');
    console.log('3. Verify you have the necessary permissions in your Supabase project');
  }
  
  return allTestsPassed;
}

// Run verification
verifyMigration()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Verification script error:', error);
    process.exit(1);
  });

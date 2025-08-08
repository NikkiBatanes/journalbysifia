#!/usr/bin/env node

/**
 * Subscription Intelligence System Test
 * 
 * This script tests the core subscription functionality
 * Run with: node test-subscription-system.js
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  console.log('Please set them in your .env file or environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSubscriptionSystem() {
  console.log('🧪 Testing Subscription Intelligence System\n');

  try {
    // Test 1: Check if subscription_pricing table exists and has correct data
    console.log('📋 Test 1: Checking Subscription Pricing Data');
    const { data: pricing, error: pricingError } = await supabase
      .from('subscription_pricing')
      .select('*')
      .order('monthly_price_cents');

    if (pricingError) {
      console.error('❌ Pricing table error:', pricingError.message);
      return;
    }

    console.log('✅ Pricing data found:');
    pricing.forEach(tier => {
      const monthly = (tier.monthly_price_cents / 100).toFixed(2);
      const annual = (tier.annual_price_cents / 100).toFixed(2);
      console.log(`   ${tier.tier}: $${monthly}/month, $${annual}/year`);
    });

    // Test 2: Check subscription limits function
    console.log('\n📊 Test 2: Testing Subscription Limits Function');
    const tiers = ['basic', 'starter', 'growth', 'transformation', 'family'];
    
    for (const tier of tiers) {
      const { data, error } = await supabase.rpc('get_subscription_limits', { p_tier: tier });
      if (error) {
        console.error(`❌ Error getting limits for ${tier}:`, error.message);
      } else {
        console.log(`✅ ${tier}: ${JSON.stringify(data)}`);
      }
    }

    // Test 3: Check if user_subscriptions table exists
    console.log('\n👥 Test 3: Checking User Subscriptions Table');
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('tier, status, count()')
      .limit(1);

    if (subError) {
      console.error('❌ User subscriptions table error:', subError.message);
    } else {
      console.log('✅ User subscriptions table accessible');
    }

    // Test 4: Check subscription intelligence tables
    console.log('\n🧠 Test 4: Checking Intelligence Tables');
    const intelligenceTables = [
      'user_intelligence_profiles',
      'user_behavior_events',
      'generation_queue'
    ];

    for (const table of intelligenceTables) {
      const { data, error } = await supabase
        .from(table)
        .select('count()')
        .limit(1);

      if (error) {
        console.error(`❌ ${table} error:`, error.message);
      } else {
        console.log(`✅ ${table} table accessible`);
      }
    }

    console.log('\n🎉 Subscription Intelligence System Tests Complete!');
    console.log('\n📖 Next Steps:');
    console.log('1. Check the SUBSCRIPTION_TESTING_GUIDE.md for detailed testing');
    console.log('2. Test the UI components in your React Native app');
    console.log('3. Verify trial expiration and cancellation flows');
    console.log('4. Test feature restrictions for different tiers');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your Supabase connection');
    console.log('2. Verify the database schema was deployed correctly');
    console.log('3. Check environment variables');
  }
}

// Run the tests
testSubscriptionSystem().catch(console.error);

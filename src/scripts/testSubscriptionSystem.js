// Simple JavaScript test for subscription system compatibility
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (error) {
  console.log('⚠️  Supabase client initialization failed (expected in test environment)');
}

class SubscriptionSystemTester {
  async testDatabaseTables() {
    console.log('\n=== Testing Database Tables ===');

    const requiredTables = [
      'user_behavior_events',
      'user_subscriptions',
      'subscription_usage_tracking',
      'user_intelligence_profiles',
    ];

    const results = {};

    for (const table of requiredTables) {
      try {
        if (!supabase) {
          results[table] = 'SKIP - No Supabase connection';
          continue;
        }

        const { error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          results[table] = `FAIL - ${error.message}`;
        } else {
          results[table] = 'PASS - Table accessible';
        }
      } catch (err) {
        results[table] = `ERROR - ${err.message}`;
      }
    }

    // Print results
    for (const [table, result] of Object.entries(results)) {
      const status = result.startsWith('PASS') ? '✅' :
                    result.startsWith('SKIP') ? '⏭️' : '❌';
      console.log(`${status} ${table}: ${result}`);
    }

    return results;
  }

  async testSubscriptionService() {
    console.log('\n=== Testing Subscription Service ===');

    try {
      // Try to import the subscription service
      const subscriptionService = require('../services/subscriptionServiceCompatible');
      console.log('✅ subscriptionServiceCompatible.ts: Import successful');

      // Test basic methods exist
      const methods = [
        'getCurrentSubscription',
        'checkFeatureAccess',
        'trackUsage',
        'getUsageStats',
        'canUpgrade',
      ];

      for (const method of methods) {
        if (typeof subscriptionService[method] === 'function') {
          console.log(`✅ ${method}: Method exists`);
        } else {
          console.log(`❌ ${method}: Method missing`);
        }
      }

    } catch (error) {
      console.log(`❌ subscriptionServiceCompatible.ts: Import failed - ${error.message}`);
    }
  }

  async testAnalyticsService() {
    console.log('\n=== Testing Analytics Service ===');

    try {
      // Try to import the analytics service
      const analyticsService = require('../services/analyticsService');
      console.log('✅ analyticsService.ts: Import successful');

      // Test basic methods exist
      const methods = [
        'trackEvent',
        'getSubscriptionAnalytics',
        'getDashboardMetrics',
        'trackUsage',
      ];

      for (const method of methods) {
        if (typeof analyticsService[method] === 'function') {
          console.log(`✅ ${method}: Method exists`);
        } else {
          console.log(`❌ ${method}: Method missing`);
        }
      }

    } catch (error) {
      console.log(`❌ analyticsService.ts: Import failed - ${error.message}`);
    }
  }

  async testUIComponents() {
    console.log('\n=== Testing UI Components ===');

    const components = [
      '../components/EnhancedActionStepCard',
      '../components/DocumentCardView',
    ];

    for (const component of components) {
      try {
        require(component);
        console.log(`✅ ${component.split('/').pop()}: Import successful`);
      } catch (error) {
        console.log(`❌ ${component.split('/').pop()}: Import failed - ${error.message}`);
      }
    }
  }

  async testTrialConfiguration() {
    console.log('\n=== Testing Trial Configuration ===');

    try {
      const trialConfig = require('../constants/trialConfig');
      console.log('✅ trialConfig.ts: Import successful');

      if (trialConfig.TRIAL_DURATION_DAYS === 3) {
        console.log('✅ Trial duration: Correctly set to 3 days');
      } else {
        console.log(`❌ Trial duration: Expected 3 days, got ${trialConfig.TRIAL_DURATION_DAYS}`);
      }

      if (trialConfig.TRIAL_SUBTITLE && trialConfig.TRIAL_SUBTITLE.includes('3 days')) {
        console.log('✅ Trial subtitle: Contains "3 days"');
      } else {
        console.log('❌ Trial subtitle: Does not contain "3 days"');
      }

    } catch (error) {
      console.log(`❌ trialConfig.ts: Import failed - ${error.message}`);
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Subscription System Tests...\n');

    const startTime = Date.now();

    try {
      await this.testDatabaseTables();
      await this.testSubscriptionService();
      await this.testAnalyticsService();
      await this.testUIComponents();
      await this.testTrialConfiguration();

      const duration = Date.now() - startTime;
      console.log(`\n✅ All tests completed in ${duration}ms`);
      console.log('\n📋 Summary:');
      console.log('- Database schema compatibility: Tested');
      console.log('- Subscription service: Tested');
      console.log('- Analytics service: Tested');
      console.log('- UI components: Tested');
      console.log('- Trial configuration: Tested');

    } catch (error) {
      console.error(`\n❌ Test suite failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run tests automatically
const tester = new SubscriptionSystemTester();
tester.runAllTests().catch(console.error);

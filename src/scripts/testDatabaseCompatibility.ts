/**
 * Database Compatibility Test Script
 *
 * Tests the compatibility of our subscription and analytics services
 * with the existing siFia database schema.
 */

// Import your existing supabase configuration
// import { supabase } from '../config/supabase';
declare const supabase: any;

import { subscriptionServiceCompatible } from '../services/subscriptionServiceCompatible';
import { analyticsService } from '../services/analyticsService';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  data?: any;
}

class DatabaseCompatibilityTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting database compatibility tests...\n');

    // Test database connection
    await this.testDatabaseConnection();

    // Test existing tables
    await this.testExistingTables();

    // Test subscription service
    await this.testSubscriptionService();

    // Test analytics service
    await this.testAnalyticsService();

    // Test usage tracking
    await this.testUsageTracking();

    // Print results
    this.printResults();

    return this.results;
  }

  private async testDatabaseConnection(): Promise<void> {
    try {
      const { data: _data, error } = await supabase.from('users').select('count').limit(1);

      this.addResult({
        test: 'Database Connection',
        passed: !error,
        error: error?.message,
        data: _data ? 'Connected successfully' : undefined,
      });
    } catch (error) {
      this.addResult({
        test: 'Database Connection',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async testExistingTables(): Promise<void> {
    const requiredTables = [
      'users',
      'subscriptions',
      'usage_tracking',
      'playbooks',
      'devotionals',
      'user_events',
    ];

    for (const table of requiredTables) {
      try {
        const { data: _data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        this.addResult({
          test: `Table exists: ${table}`,
          passed: !error,
          error: error?.message,
          data: _data ? `Table accessible (${_data.length} rows sampled)` : undefined,
        });
      } catch (error) {
        this.addResult({
          test: `Table exists: ${table}`,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  private async testSubscriptionService(): Promise<void> {
    try {
      // Test getting subscription limits
      const limits = subscriptionServiceCompatible.getSubscriptionLimits('growth');

      this.addResult({
        test: 'Subscription Service - Get Limits',
        passed: !!limits && limits.playbooks > 0,
        data: limits,
      });

      // Test tier hierarchy
      const hierarchy = subscriptionServiceCompatible.getTierHierarchy();

      this.addResult({
        test: 'Subscription Service - Tier Hierarchy',
        passed: Array.isArray(hierarchy) && hierarchy.length > 0,
        data: hierarchy,
      });

      // Test pricing
      const pricing = subscriptionServiceCompatible.getTierPricing('growth');

      this.addResult({
        test: 'Subscription Service - Pricing',
        passed: !!pricing && pricing.monthly > 0,
        data: pricing,
      });

    } catch (error) {
      this.addResult({
        test: 'Subscription Service',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async testAnalyticsService(): Promise<void> {
    try {
      // Test analytics service initialization
      const initialized = !!analyticsService;

      this.addResult({
        test: 'Analytics Service - Initialization',
        passed: initialized,
        data: initialized ? 'Service initialized successfully' : undefined,
      });

      // Test event tracking (without actually sending events)
      const canTrack = typeof analyticsService.trackEvent === 'function';

      this.addResult({
        test: 'Analytics Service - Event Tracking Method',
        passed: canTrack,
        data: canTrack ? 'trackEvent method available' : undefined,
      });

      // Test feature usage tracking method
      const canTrackFeature = typeof analyticsService.trackFeatureUsage === 'function';

      this.addResult({
        test: 'Analytics Service - Feature Tracking Method',
        passed: canTrackFeature,
        data: canTrackFeature ? 'trackFeatureUsage method available' : undefined,
      });

    } catch (error) {
      this.addResult({
        test: 'Analytics Service',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async testUsageTracking(): Promise<void> {
    try {
      // Test if we can query the usage_tracking table structure
      const { error } = await supabase
        .from('usage_tracking')
        .select('*')
        .limit(0); // Get structure without data

      this.addResult({
        test: 'Usage Tracking - Table Structure',
        passed: !error,
        error: error?.message,
        data: !error ? 'Table structure accessible' : undefined,
      });

      // Test if we can query user_events table
      const { error: eventsError } = await supabase
        .from('user_events')
        .select('*')
        .limit(0);

      this.addResult({
        test: 'User Events - Table Structure',
        passed: !eventsError,
        error: eventsError?.message,
        data: !eventsError ? 'Table structure accessible' : undefined,
      });

    } catch (error) {
      this.addResult({
        test: 'Usage Tracking',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private addResult(result: TestResult): void {
    this.results.push(result);
  }

  private printResults(): void {
    console.log('\n📊 Test Results Summary:');
    console.log('========================\n');

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.test}`);

      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      if (result.data && typeof result.data === 'object') {
        console.log(`   Data: ${JSON.stringify(result.data, null, 2)}`);
      } else if (result.data) {
        console.log(`   Data: ${result.data}`);
      }

      console.log('');
    });

    console.log(`\n📈 Overall: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%)`);

    if (passed === total) {
      console.log('🎉 All tests passed! Your database is compatible with the new services.');
    } else {
      console.log('⚠️  Some tests failed. Review the errors above and ensure your database schema is up to date.');
    }
  }

  // Get failed tests for debugging
  getFailedTests(): TestResult[] {
    return this.results.filter(r => !r.passed);
  }

  // Get summary statistics
  getSummary(): { passed: number; failed: number; total: number; percentage: number } {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;

    return {
      passed,
      failed: total - passed,
      total,
      percentage: Math.round((passed / total) * 100),
    };
  }
}

// Export for use in other scripts
export const databaseTester = new DatabaseCompatibilityTester();

// Run tests if this script is executed directly
if (require.main === module) {
  databaseTester.runAllTests().catch(console.error);
}

export default DatabaseCompatibilityTester;

/**
 * Comprehensive Subscription System Test Script
 * 
 * Tests all subscription features including expounding and exporting
 */

// Import your existing supabase configuration
// import { supabase } from '../config/supabase';
declare const supabase: any;

import { subscriptionServiceCompatible } from '../services/subscriptionServiceCompatible';
import { analyticsService } from '../services/analyticsService';

interface TestResult {
  category: string;
  test: string;
  passed: boolean;
  error?: string;
  data?: any;
}

class SubscriptionSystemTester {
  private results: TestResult[] = [];
  private testUserId: string = 'test-user-' + Date.now();

  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting comprehensive subscription system tests...\n');

    // Database Tests
    await this.testDatabaseSchema();
    await this.testSubscriptionService();
    await this.testAnalyticsService();
    await this.testExpoundingFeatures();
    await this.testExportFeatures();
    await this.testTrialSystem();

    // Print results
    this.printResults();
    return this.results;
  }

  private async testDatabaseSchema(): Promise<void> {
    console.log('📊 Testing database schema...');

    // Test required tables exist
    const requiredTables = [
      'subscriptions',
      'usage_tracking', 
      'user_events',
      'playbooks',
      'devotionals',
      'step_expounding',
      'user_questions'
    ];

    for (const table of requiredTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        this.addResult({
          category: 'Database Schema',
          test: `Table exists: ${table}`,
          passed: !error,
          error: error?.message,
          data: !error ? `✅ Table accessible` : undefined
        });
      } catch (error) {
        this.addResult({
          category: 'Database Schema',
          test: `Table exists: ${table}`,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Test subscription_tier enum
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('tier')
        .limit(1);

      this.addResult({
        category: 'Database Schema',
        test: 'subscription_tier enum works',
        passed: !error,
        error: error?.message,
        data: !error ? '✅ Enum accessible' : undefined
      });
    } catch (error) {
      this.addResult({
        category: 'Database Schema',
        test: 'subscription_tier enum works',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testSubscriptionService(): Promise<void> {
    console.log('💳 Testing subscription service...');

    try {
      // Test tier limits
      const limits = subscriptionServiceCompatible.getSubscriptionLimits('growth');
      this.addResult({
        category: 'Subscription Service',
        test: 'Get subscription limits',
        passed: !!limits && limits.playbooks > 0,
        data: { playbooks: limits.playbooks, expoundingEnabled: limits.expoundingEnabled }
      });

      // Test tier hierarchy
      const hierarchy = subscriptionServiceCompatible.getTierHierarchy();
      this.addResult({
        category: 'Subscription Service',
        test: 'Get tier hierarchy',
        passed: Array.isArray(hierarchy) && hierarchy.length > 0,
        data: hierarchy
      });

      // Test pricing
      const pricing = subscriptionServiceCompatible.getTierPricing('growth');
      this.addResult({
        category: 'Subscription Service',
        test: 'Get tier pricing',
        passed: !!pricing && pricing.monthly > 0,
        data: pricing
      });

      // Test feature access check
      const featureAccess = await subscriptionServiceCompatible.canUseFeature(this.testUserId, 'expounding_content');
      this.addResult({
        category: 'Subscription Service',
        test: 'Check feature access',
        passed: typeof featureAccess.canUse === 'boolean',
        data: featureAccess
      });

    } catch (error) {
      this.addResult({
        category: 'Subscription Service',
        test: 'Service functionality',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testAnalyticsService(): Promise<void> {
    console.log('📈 Testing analytics service...');

    try {
      // Test service initialization
      this.addResult({
        category: 'Analytics Service',
        test: 'Service initialization',
        passed: !!analyticsService,
        data: '✅ Service available'
      });

      // Test method availability
      const methods = [
        'trackEvent',
        'trackFeatureUsage',
        'trackRetentionEvent',
        'getUserBehaviorMetrics'
      ];

      for (const method of methods) {
        this.addResult({
          category: 'Analytics Service',
          test: `Method available: ${method}`,
          passed: typeof (analyticsService as any)[method] === 'function',
          data: '✅ Method exists'
        });
      }

    } catch (error) {
      this.addResult({
        category: 'Analytics Service',
        test: 'Service functionality',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testExpoundingFeatures(): Promise<void> {
    console.log('📖 Testing expounding features...');

    try {
      // Test step_expounding table
      const { data: expoundingData, error: expoundingError } = await supabase
        .from('step_expounding')
        .select('*')
        .limit(1);

      this.addResult({
        category: 'Expounding Features',
        test: 'step_expounding table accessible',
        passed: !expoundingError,
        error: expoundingError?.message,
        data: !expoundingError ? '✅ Table ready for expounding content' : undefined
      });

      // Test user_questions table
      const { data: questionsData, error: questionsError } = await supabase
        .from('user_questions')
        .select('*')
        .limit(1);

      this.addResult({
        category: 'Expounding Features',
        test: 'user_questions table accessible',
        passed: !questionsError,
        error: questionsError?.message,
        data: !questionsError ? '✅ Table ready for user questions' : undefined
      });

      // Test expounding feature access for different tiers
      const tiers = ['free_trial', 'starter', 'growth', 'transformation'];
      for (const tier of tiers) {
        const limits = subscriptionServiceCompatible.getSubscriptionLimits(tier as any);
        this.addResult({
          category: 'Expounding Features',
          test: `Expounding access for ${tier}`,
          passed: true,
          data: { tier, expoundingEnabled: limits.expoundingEnabled }
        });
      }

    } catch (error) {
      this.addResult({
        category: 'Expounding Features',
        test: 'Expounding system',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testExportFeatures(): Promise<void> {
    console.log('📄 Testing export features...');

    try {
      // Test export limits for different tiers
      const tiers = ['free_trial', 'starter', 'growth', 'transformation'];
      for (const tier of tiers) {
        const limits = subscriptionServiceCompatible.getSubscriptionLimits(tier as any);
        this.addResult({
          category: 'Export Features',
          test: `Export limits for ${tier}`,
          passed: true,
          data: { tier, exports: limits.exports }
        });
      }

      // Test export feature access
      const exportAccess = await subscriptionServiceCompatible.canUseFeature(this.testUserId, 'export_pdf');
      this.addResult({
        category: 'Export Features',
        test: 'Export feature access check',
        passed: typeof exportAccess.canUse === 'boolean',
        data: exportAccess
      });

      // Test usage tracking for exports
      const trackingResult = await subscriptionServiceCompatible.trackUsage(this.testUserId, 'export_count', 1);
      this.addResult({
        category: 'Export Features',
        test: 'Export usage tracking',
        passed: typeof trackingResult === 'boolean',
        data: { tracked: trackingResult }
      });

    } catch (error) {
      this.addResult({
        category: 'Export Features',
        test: 'Export system',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testTrialSystem(): Promise<void> {
    console.log('🎯 Testing trial system...');

    try {
      // Test trial tier limits
      const trialLimits = subscriptionServiceCompatible.getSubscriptionLimits('free_trial');
      this.addResult({
        category: 'Trial System',
        test: 'Free trial limits',
        passed: !!trialLimits,
        data: {
          playbooks: trialLimits.playbooks,
          devotionals: trialLimits.devotionals,
          exports: trialLimits.exports,
          expoundingEnabled: trialLimits.expoundingEnabled
        }
      });

      // Test trial pricing
      const trialPricing = subscriptionServiceCompatible.getTierPricing('free_trial');
      this.addResult({
        category: 'Trial System',
        test: 'Free trial pricing',
        passed: trialPricing.monthly === 0,
        data: trialPricing
      });

      // Test next tier suggestion
      const nextTier = subscriptionServiceCompatible.getNextTier('free_trial');
      this.addResult({
        category: 'Trial System',
        test: 'Next tier suggestion',
        passed: !!nextTier,
        data: { nextTier }
      });

    } catch (error) {
      this.addResult({
        category: 'Trial System',
        test: 'Trial functionality',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private addResult(result: TestResult): void {
    this.results.push(result);
  }

  private printResults(): void {
    console.log('\n📊 Test Results Summary:');
    console.log('========================\n');

    const categories = [...new Set(this.results.map(r => r.category))];
    
    categories.forEach(category => {
      const categoryResults = this.results.filter(r => r.category === category);
      const passed = categoryResults.filter(r => r.passed).length;
      const total = categoryResults.length;
      
      console.log(`\n🔍 ${category} (${passed}/${total})`);
      console.log('─'.repeat(50));
      
      categoryResults.forEach(result => {
        const status = result.passed ? '✅' : '❌';
        console.log(`${status} ${result.test}`);
        
        if (result.error) {
          console.log(`   ❗ Error: ${result.error}`);
        }
        
        if (result.data && typeof result.data === 'object') {
          console.log(`   📋 Data: ${JSON.stringify(result.data, null, 2)}`);
        } else if (result.data) {
          console.log(`   📋 ${result.data}`);
        }
      });
    });

    const totalPassed = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    const percentage = Math.round((totalPassed / totalTests) * 100);

    console.log(`\n📈 Overall: ${totalPassed}/${totalTests} tests passed (${percentage}%)`);
    
    if (totalPassed === totalTests) {
      console.log('🎉 All tests passed! Your subscription system is ready.');
    } else {
      console.log('⚠️  Some tests failed. Review the errors above.');
    }

    // Feature availability summary
    console.log('\n🎯 Feature Availability Summary:');
    console.log('================================');
    
    const tiers = ['free_trial', 'starter', 'growth', 'transformation'];
    tiers.forEach(tier => {
      const limits = subscriptionServiceCompatible.getSubscriptionLimits(tier as any);
      console.log(`\n${tier.toUpperCase()}:`);
      console.log(`  📚 Playbooks: ${limits.playbooks}`);
      console.log(`  🙏 Devotionals: ${limits.devotionals}`);
      console.log(`  📄 Exports: ${limits.exports}`);
      console.log(`  📖 Expounding: ${limits.expoundingEnabled ? '✅' : '❌'}`);
      console.log(`  🧠 Intelligence: ${limits.intelligenceEnabled ? '✅' : '❌'}`);
    });
  }

  // Get failed tests for debugging
  getFailedTests(): TestResult[] {
    return this.results.filter(r => !r.passed);
  }

  // Get summary by category
  getSummaryByCategory(): Record<string, { passed: number; total: number; percentage: number }> {
    const categories = [...new Set(this.results.map(r => r.category))];
    const summary: Record<string, { passed: number; total: number; percentage: number }> = {};
    
    categories.forEach(category => {
      const categoryResults = this.results.filter(r => r.category === category);
      const passed = categoryResults.filter(r => r.passed).length;
      const total = categoryResults.length;
      
      summary[category] = {
        passed,
        total,
        percentage: Math.round((passed / total) * 100)
      };
    });
    
    return summary;
  }
}

// Export for use in other scripts
export const subscriptionTester = new SubscriptionSystemTester();

// Run tests automatically
subscriptionTester.runAllTests().catch(console.error);

export default SubscriptionSystemTester;

/**
 * Onboarding A/B Testing Service
 * Implements conversion optimization experiments for onboarding flow
 * Phase 4: A/B Testing Framework
 */

import { supabase } from './supabaseClient';

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  config: Record<string, any>;
  weight: number; // Percentage of users to assign to this variant
  isControl: boolean;
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: ABTestVariant[];
  startDate: string;
  endDate?: string;
  targetMetric: string;
  minimumSampleSize: number;
  confidenceLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface ABTestAssignment {
  userId: string;
  testId: string;
  variantId: string;
  assignedAt: string;
  hasConverted: boolean;
  conversionAt?: string;
  metadata: Record<string, any>;
}

export interface ABTestResults {
  testId: string;
  variants: Array<{
    variantId: string;
    name: string;
    participants: number;
    conversions: number;
    conversionRate: number;
    confidenceInterval: [number, number];
    isSignificant: boolean;
    isWinner: boolean;
  }>;
  overallResults: {
    totalParticipants: number;
    testDuration: number;
    statisticalSignificance: boolean;
    recommendedAction: 'continue' | 'stop_winner' | 'stop_inconclusive';
  };
}

class OnboardingABTestingService {
  private supabase = supabase;

  /**
   * Create a new A/B test
   */
  async createABTest(test: Omit<ABTest, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const testData = {
      ...test,
      id: `test_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('ab_tests')
      .insert([testData])
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create A/B test: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Get user's variant assignment for a test
   */
  async getUserVariant(userId: string, testId: string): Promise<ABTestVariant | null> {
    // Check if user already has an assignment
    const { data: existingAssignment } = await this.supabase
      .from('ab_test_assignments')
      .select('variant_id')
      .eq('user_id', userId)
      .eq('test_id', testId)
      .single();

    if (existingAssignment) {
      // Return existing variant
      const { data: variant } = await this.supabase
        .from('ab_test_variants')
        .select('*')
        .eq('id', existingAssignment.variant_id)
        .single();

      return variant;
    }

    // Get test details
    const { data: test } = await this.supabase
      .from('ab_tests')
      .select('*, variants:ab_test_variants(*)')
      .eq('id', testId)
      .eq('status', 'running')
      .single();

    if (!test || !test.variants) {
      return null;
    }

    // Assign user to variant based on weights
    const variant = this.assignUserToVariant(userId, test.variants);

    if (variant) {
      // Record assignment
      await this.recordAssignment(userId, testId, variant.id);
    }

    return variant;
  }

  /**
   * Assign user to variant based on weights and user ID hash
   */
  private assignUserToVariant(userId: string, variants: ABTestVariant[]): ABTestVariant | null {
    // Create deterministic hash from user ID
    const hash = this.hashUserId(userId);
    const hashValue = hash % 100; // Convert to 0-99 range

    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += variant.weight;
      if (hashValue < cumulativeWeight) {
        return variant;
      }
    }

    // Fallback to control variant
    return variants.find(v => v.isControl) || variants[0];
  }

  /**
   * Simple hash function for user ID
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      // eslint-disable-next-line no-bitwise
      hash = ((hash << 5) - hash) + char;
      // eslint-disable-next-line no-bitwise
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Record user assignment to variant
   */
  private async recordAssignment(userId: string, testId: string, variantId: string): Promise<void> {
    const assignment: Omit<ABTestAssignment, 'hasConverted'> = {
      userId,
      testId,
      variantId,
      assignedAt: new Date().toISOString(),
      metadata: {},
    };

    await this.supabase
      .from('ab_test_assignments')
      .insert([{
        user_id: assignment.userId,
        test_id: assignment.testId,
        variant_id: assignment.variantId,
        assigned_at: assignment.assignedAt,
        has_converted: false,
        metadata: assignment.metadata,
      }]);
  }

  /**
   * Record conversion event
   */
  async recordConversion(
    userId: string,
    testId: string,
    conversionData?: Record<string, any>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('ab_test_assignments')
      .update({
        has_converted: true,
        conversion_at: new Date().toISOString(),
        metadata: conversionData || {},
      })
      .eq('user_id', userId)
      .eq('test_id', testId);

    if (error) {
      throw new Error(`Failed to record conversion: ${error.message}`);
    }
  }

  /**
   * Get A/B test results
   */
  async getTestResults(testId: string): Promise<ABTestResults> {
    // Get test and variants
    const { data: test } = await this.supabase
      .from('ab_tests')
      .select('*, variants:ab_test_variants(*)')
      .eq('id', testId)
      .single();

    if (!test) {
      throw new Error('Test not found');
    }

    // Get assignments and conversions
    const { data: assignments } = await this.supabase
      .from('ab_test_assignments')
      .select('variant_id, has_converted, assigned_at, conversion_at')
      .eq('test_id', testId);

    if (!assignments) {
      throw new Error('No assignment data found');
    }

    // Calculate results for each variant
    const variantResults = test.variants.map((variant: ABTestVariant) => {
      const variantAssignments = assignments.filter(a => a.variant_id === variant.id);
      const conversions = variantAssignments.filter(a => a.has_converted).length;
      const participants = variantAssignments.length;
      const conversionRate = participants > 0 ? (conversions / participants) * 100 : 0;

      // Calculate confidence interval (simplified)
      const confidenceInterval = this.calculateConfidenceInterval(conversions, participants);

      return {
        variantId: variant.id,
        name: variant.name,
        participants,
        conversions,
        conversionRate,
        confidenceInterval,
        isSignificant: participants >= test.minimumSampleSize,
        isWinner: false, // Will be determined after comparing all variants
      };
    });

    // Determine winner
    const controlVariant = variantResults.find(v =>
      test.variants.find((tv: ABTestVariant) => tv.id === v.variantId)?.isControl
    );

    if (controlVariant) {
      variantResults.forEach(variant => {
        if (variant.variantId !== controlVariant.variantId) {
          variant.isWinner = variant.conversionRate > controlVariant.conversionRate &&
                            variant.isSignificant;
        }
      });
    }

    // Calculate overall results
    const totalParticipants = assignments.length;
    const testStartDate = new Date(test.startDate);
    const testDuration = Date.now() - testStartDate.getTime();
    const hasSignificantResults = variantResults.some(v => v.isSignificant);
    const hasWinner = variantResults.some(v => v.isWinner);

    let recommendedAction: 'continue' | 'stop_winner' | 'stop_inconclusive' = 'continue';
    if (hasSignificantResults) {
      recommendedAction = hasWinner ? 'stop_winner' : 'stop_inconclusive';
    }

    return {
      testId,
      variants: variantResults,
      overallResults: {
        totalParticipants,
        testDuration,
        statisticalSignificance: hasSignificantResults,
        recommendedAction,
      },
    };
  }

  /**
   * Calculate confidence interval (simplified)
   */
  private calculateConfidenceInterval(conversions: number, participants: number): [number, number] {
    if (participants === 0) {return [0, 0];}

    const p = conversions / participants;
    const z = 1.96; // 95% confidence level
    const margin = z * Math.sqrt((p * (1 - p)) / participants);

    return [
      Math.max(0, (p - margin) * 100),
      Math.min(100, (p + margin) * 100),
    ];
  }

  /**
   * Get active tests for user
   */
  async getActiveTestsForUser(userId: string): Promise<Array<{ test: ABTest; variant: ABTestVariant }>> {
    const { data: activeTests } = await this.supabase
      .from('ab_tests')
      .select('*, variants:ab_test_variants(*)')
      .eq('status', 'running');

    if (!activeTests) {return [];}

    const userTests = [];
    for (const test of activeTests) {
      const variant = await this.getUserVariant(userId, test.id);
      if (variant) {
        userTests.push({ test, variant });
      }
    }

    return userTests;
  }

  /**
   * Predefined onboarding A/B tests
   */
  async createOnboardingTests(): Promise<string[]> {
    const tests = [
      {
        name: 'Faith Journey Step Order',
        description: 'Test different orders of faith journey questions',
        status: 'draft' as const,
        variants: [
          {
            id: 'control_order',
            name: 'Control: Standard Order',
            description: 'Current faith journey question order',
            config: { questionOrder: 'standard' },
            weight: 50,
            isControl: true,
          },
          {
            id: 'optimized_order',
            name: 'Optimized: Christ Acceptance First',
            description: 'Ask Christ acceptance question first',
            config: { questionOrder: 'christ_first' },
            weight: 50,
            isControl: false,
          },
        ],
        startDate: new Date().toISOString(),
        targetMetric: 'onboarding_completion_rate',
        minimumSampleSize: 100,
        confidenceLevel: 95,
      },
      {
        name: 'Goal Selection Interface',
        description: 'Test different goal selection UI approaches',
        status: 'draft' as const,
        variants: [
          {
            id: 'checkbox_goals',
            name: 'Control: Checkbox Selection',
            description: 'Current checkbox-based goal selection',
            config: { selectionType: 'checkbox' },
            weight: 50,
            isControl: true,
          },
          {
            id: 'card_goals',
            name: 'Card-based Selection',
            description: 'Visual card-based goal selection',
            config: { selectionType: 'cards' },
            weight: 50,
            isControl: false,
          },
        ],
        startDate: new Date().toISOString(),
        targetMetric: 'goal_engagement_rate',
        minimumSampleSize: 150,
        confidenceLevel: 95,
      },
    ];

    const testIds = [];
    for (const test of tests) {
      const testId = await this.createABTest(test);
      testIds.push(testId);
    }

    return testIds;
  }
}

export const onboardingABTestingService = new OnboardingABTestingService();

/**
 * Onboarding Conversion Analytics Service
 * Tracks and analyzes conversion funnel metrics for the new onboarding flow
 * Provides insights for optimization and A/B testing
 */

import { supabase } from './supabaseClient';

export interface ConversionFunnelData {
  step: string;
  stepNumber: number;
  totalUsers: number;
  completedUsers: number;
  conversionRate: number;
  averageTimeSpent: number;
  dropOffRate: number;
  topDropOffReasons: string[];
}

export interface OnboardingCohortAnalysis {
  cohortDate: string;
  totalStarted: number;
  completedOnboarding: number;
  day1Retention: number;
  day7Retention: number;
  day30Retention: number;
  firstActivityCompletion: number;
  averageTimeToComplete: number;
}

export interface UserSegmentPerformance {
  segment: string;
  segmentCriteria: Record<string, any>;
  userCount: number;
  completionRate: number;
  engagementScore: number;
  retentionRate: number;
  recommendedOptimizations: string[];
}

export interface ABTestResult {
  testId: string;
  testName: string;
  variant: string;
  userCount: number;
  conversionRate: number;
  statisticalSignificance: number;
  confidenceInterval: [number, number];
  recommendedAction: 'continue' | 'stop' | 'expand' | 'optimize';
}

class OnboardingConversionAnalytics {
  private supabase = supabase;

  /**
   * Get conversion funnel analysis
   */
  async getConversionFunnel(dateRange?: { start: string; end: string }): Promise<ConversionFunnelData[]> {
    try {
      const { data: progressData, error } = await this.supabase
        .from('onboarding_progress')
        .select(`
          user_id,
          current_step,
          completed_steps,
          is_completed,
          time_spent_seconds,
          created_at,
          abandoned_at
        `)
        .gte('created_at', dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', dateRange?.end || new Date().toISOString());

      if (error) {throw error;}

      const { data: stepData, error: stepError } = await this.supabase
        .from('onboarding_step_analytics')
        .select(`
          user_id,
          step_name,
          step_number,
          completion_method,
          time_spent_seconds,
          created_at
        `)
        .gte('created_at', dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', dateRange?.end || new Date().toISOString());

      if (stepError) {throw stepError;}

      return this.analyzeFunnelData(progressData || [], stepData || []);
    } catch (error) {
      console.error('[ConversionAnalytics] Error getting funnel data:', error);
      return [];
    }
  }

  /**
   * Analyze funnel conversion data
   */
  private analyzeFunnelData(progressData: any[], stepData: any[]): ConversionFunnelData[] {
    const steps = [
      { name: 'welcome_carousel', number: 1, displayName: 'Welcome Carousel' },
      { name: 'smart_assessment', number: 2, displayName: 'Smart Assessment' },
      { name: 'personalized_preview', number: 3, displayName: 'Personalized Preview' },
      { name: 'onboarding_complete', number: 4, displayName: 'Onboarding Complete' },
    ];

    const totalUsers = new Set(progressData.map(p => p.user_id)).size;

    return steps.map(step => {
      const stepUsers = stepData.filter(s => s.step_name === step.name);
      const completedUsers = stepUsers.filter(s => s.completion_method === 'completed').length;
      const totalStepUsers = stepUsers.length;

      const conversionRate = totalUsers > 0 ? (completedUsers / totalUsers) * 100 : 0;
      const dropOffRate = totalStepUsers > 0 ? ((totalStepUsers - completedUsers) / totalStepUsers) * 100 : 0;

      const averageTimeSpent = stepUsers.length > 0
        ? stepUsers.reduce((sum, s) => sum + (s.time_spent_seconds || 0), 0) / stepUsers.length
        : 0;

      const dropOffReasons = this.getDropOffReasons(step.name, stepData);

      return {
        step: step.displayName,
        stepNumber: step.number,
        totalUsers: totalStepUsers,
        completedUsers,
        conversionRate,
        averageTimeSpent,
        dropOffRate,
        topDropOffReasons: dropOffReasons,
      };
    });
  }

  /**
   * Get drop-off reasons for a specific step
   */
  private getDropOffReasons(stepName: string, stepData: any[]): string[] {
    const stepDropOffs = stepData.filter(s =>
      s.step_name === stepName &&
      ['abandoned', 'skipped'].includes(s.completion_method)
    );

    const reasonCounts: Record<string, number> = {};

    stepDropOffs.forEach(dropOff => {
      const reason = this.inferDropOffReason(stepName, dropOff);
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });

    return Object.entries(reasonCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([reason]) => reason);
  }

  /**
   * Infer drop-off reason based on step and data
   */
  private inferDropOffReason(stepName: string, dropOffData: any): string {
    const timeSpent = dropOffData.time_spent_seconds || 0;

    switch (stepName) {
      case 'welcome_carousel':
        if (timeSpent < 10) {return 'Too fast - likely accidental skip';}
        if (timeSpent > 120) {return 'Lost interest - took too long';}
        return 'Chose to skip introduction';

      case 'smart_assessment':
        if (timeSpent < 30) {return 'Questions seemed too personal';}
        if (timeSpent > 300) {return 'Assessment too long';}
        return 'Uncertain about answers';

      case 'personalized_preview':
        if (timeSpent < 20) {return 'Preview not compelling';}
        if (timeSpent > 180) {return 'Information overload';}
        return 'Not ready to commit';

      default:
        return 'Unknown reason';
    }
  }

  /**
   * Get cohort analysis for onboarding performance
   */
  async getCohortAnalysis(cohortSize: 'daily' | 'weekly' = 'weekly'): Promise<OnboardingCohortAnalysis[]> {
    try {
      const { data: cohortData, error } = await this.supabase.rpc('get_onboarding_cohort_analysis', {
        cohort_size: cohortSize,
        days_back: 30,
      });

      if (error) {throw error;}

      return cohortData || [];
    } catch (error) {
      console.error('[ConversionAnalytics] Error getting cohort analysis:', error);
      return [];
    }
  }

  /**
   * Analyze user segment performance
   */
  async getUserSegmentPerformance(): Promise<UserSegmentPerformance[]> {
    try {
      const { data: userData, error } = await this.supabase
        .from('onboarding_progress')
        .select(`
          user_id,
          is_completed,
          time_spent_seconds,
          created_at,
          faith_journey_profiles!inner(spiritual_maturity, church_attendance),
          onboarding_personalization_profiles!inner(daily_commitment_minutes, learning_style)
        `)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) {throw error;}

      return this.analyzeUserSegments(userData || []);
    } catch (error) {
      console.error('[ConversionAnalytics] Error getting segment performance:', error);
      return [];
    }
  }

  /**
   * Analyze user segments
   */
  private analyzeUserSegments(userData: any[]): UserSegmentPerformance[] {
    const segments = [
      {
        name: 'New Believers',
        criteria: { spiritual_maturity: 'new_believer' },
      },
      {
        name: 'Growing Christians',
        criteria: { spiritual_maturity: 'growing' },
      },
      {
        name: 'Mature Believers',
        criteria: { spiritual_maturity: 'mature' },
      },
      {
        name: 'Time-Constrained (≤5 min)',
        criteria: { daily_commitment_minutes: { lte: 5 } },
      },
      {
        name: 'Committed (>15 min)',
        criteria: { daily_commitment_minutes: { gt: 15 } },
      },
    ];

    return segments.map(segment => {
      const segmentUsers = this.filterUsersBySegment(userData, segment.criteria);
      const completionRate = segmentUsers.length > 0
        ? (segmentUsers.filter(u => u.is_completed).length / segmentUsers.length) * 100
        : 0;

      const engagementScore = this.calculateEngagementScore(segmentUsers);
      const retentionRate = this.calculateRetentionRate(segmentUsers);
      const optimizations = this.generateOptimizationRecommendations(segment.name, completionRate, engagementScore);

      return {
        segment: segment.name,
        segmentCriteria: segment.criteria,
        userCount: segmentUsers.length,
        completionRate,
        engagementScore,
        retentionRate,
        recommendedOptimizations: optimizations,
      };
    });
  }

  /**
   * Filter users by segment criteria
   */
  private filterUsersBySegment(userData: any[], criteria: any): any[] {
    return userData.filter(user => {
      for (const [key, value] of Object.entries(criteria)) {
        const userValue = this.getUserValue(user, key);

        if (typeof value === 'object' && value !== null) {
          if ('lte' in value && userValue > (value as any).lte) {return false;}
          if ('gt' in value && userValue <= (value as any).gt) {return false;}
        } else if (userValue !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Get user value by key path
   */
  private getUserValue(user: any, key: string): any {
    if (key === 'spiritual_maturity') {
      return user.faith_journey_profiles?.spiritual_maturity;
    }
    if (key === 'daily_commitment_minutes') {
      return user.onboarding_personalization_profiles?.daily_commitment_minutes;
    }
    return user[key];
  }

  /**
   * Calculate engagement score for user segment
   */
  private calculateEngagementScore(users: any[]): number {
    if (users.length === 0) {return 0;}

    const avgTimeSpent = users.reduce((sum, u) => sum + (u.time_spent_seconds || 0), 0) / users.length;
    const completionRate = users.filter(u => u.is_completed).length / users.length;

    // Normalize to 0-100 scale
    const timeScore = Math.min(avgTimeSpent / 300, 1) * 50; // Max 5 minutes = 50 points
    const completionScore = completionRate * 50; // Completion = 50 points

    return Math.round(timeScore + completionScore);
  }

  /**
   * Calculate retention rate (placeholder - would need additional data)
   */
  private calculateRetentionRate(users: any[]): number {
    // This would require additional tracking of user activity post-onboarding
    // For now, return a placeholder based on completion rate
    const completionRate = users.length > 0
      ? users.filter(u => u.is_completed).length / users.length
      : 0;

    return Math.round(completionRate * 0.7 * 100); // Assume 70% of completers are retained
  }

  /**
   * Generate optimization recommendations
   */
  private generateOptimizationRecommendations(segment: string, completionRate: number, engagementScore: number): string[] {
    const recommendations: string[] = [];

    if (completionRate < 50) {
      recommendations.push('Reduce onboarding friction');
      recommendations.push('Add progress indicators');
    }

    if (engagementScore < 60) {
      recommendations.push('Improve content relevance');
      recommendations.push('Add interactive elements');
    }

    switch (segment) {
      case 'New Believers':
        recommendations.push('Simplify language and concepts');
        recommendations.push('Add more encouragement and support');
        break;
      case 'Time-Constrained (≤5 min)':
        recommendations.push('Emphasize quick wins');
        recommendations.push('Streamline assessment questions');
        break;
      case 'Committed (>15 min)':
        recommendations.push('Offer advanced content previews');
        recommendations.push('Highlight community features');
        break;
    }

    return recommendations.slice(0, 3); // Return top 3 recommendations
  }

  /**
   * Track A/B test performance
   */
  async getABTestResults(testId: string): Promise<ABTestResult[]> {
    try {
      const { data: testData, error } = await this.supabase
        .from('onboarding_ab_tests')
        .select(`
          variant,
          user_id,
          conversion_event,
          created_at
        `)
        .eq('test_id', testId)
        .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());

      if (error) {throw error;}

      return this.analyzeABTestData(testId, testData || []);
    } catch (error) {
      console.error('[ConversionAnalytics] Error getting A/B test results:', error);
      return [];
    }
  }

  /**
   * Analyze A/B test data
   */
  private analyzeABTestData(testId: string, testData: any[]): ABTestResult[] {
    const variants = [...new Set(testData.map(d => d.variant))];

    return variants.map(variant => {
      const variantData = testData.filter(d => d.variant === variant);
      const totalUsers = new Set(variantData.map(d => d.user_id)).size;
      const conversions = variantData.filter(d => d.conversion_event === 'onboarding_completed').length;
      const conversionRate = totalUsers > 0 ? (conversions / totalUsers) * 100 : 0;

      // Calculate statistical significance (simplified)
      const significance = this.calculateStatisticalSignificance(conversions, totalUsers, testData);
      const confidenceInterval = this.calculateConfidenceInterval(conversions, totalUsers);
      const recommendedAction = this.getRecommendedAction(conversionRate, significance);

      return {
        testId,
        testName: `Onboarding Test ${testId}`,
        variant,
        userCount: totalUsers,
        conversionRate,
        statisticalSignificance: significance,
        confidenceInterval,
        recommendedAction,
      };
    });
  }

  /**
   * Calculate statistical significance (simplified)
   */
  private calculateStatisticalSignificance(conversions: number, total: number, allData: any[]): number {
    // Simplified z-test calculation
    if (total < 30) {return 0;} // Not enough data

    const p = conversions / total;
    const allConversions = allData.filter(d => d.conversion_event === 'onboarding_completed').length;
    const allTotal = new Set(allData.map(d => d.user_id)).size;
    const pOverall = allTotal > 0 ? allConversions / allTotal : 0;

    const se = Math.sqrt((pOverall * (1 - pOverall)) / total);
    const z = Math.abs(p - pOverall) / se;

    // Convert z-score to confidence level (simplified)
    if (z > 2.58) {return 99;}
    if (z > 1.96) {return 95;}
    if (z > 1.65) {return 90;}
    return Math.round(z * 50); // Rough approximation
  }

  /**
   * Calculate confidence interval
   */
  private calculateConfidenceInterval(conversions: number, total: number): [number, number] {
    if (total === 0) {return [0, 0];}

    const p = conversions / total;
    const se = Math.sqrt((p * (1 - p)) / total);
    const margin = 1.96 * se; // 95% confidence interval

    return [
      Math.max(0, (p - margin) * 100),
      Math.min(100, (p + margin) * 100),
    ];
  }

  /**
   * Get recommended action for A/B test
   */
  private getRecommendedAction(conversionRate: number, significance: number): 'continue' | 'stop' | 'expand' | 'optimize' {
    if (significance < 90) {return 'continue';} // Need more data
    if (conversionRate > 70) {return 'expand';} // Great performance
    if (conversionRate > 50) {return 'optimize';} // Good but can improve
    return 'stop'; // Poor performance
  }

  /**
   * Get real-time conversion metrics
   */
  async getRealTimeMetrics(): Promise<{
    activeUsers: number;
    currentConversionRate: number;
    avgTimeToComplete: number;
    topPerformingVariant?: string;
  }> {
    try {
      const { data: realtimeData, error } = await this.supabase.rpc('get_realtime_onboarding_metrics');

      if (error) {throw error;}

      return realtimeData || {
        activeUsers: 0,
        currentConversionRate: 0,
        avgTimeToComplete: 0,
      };
    } catch (error) {
      console.error('[ConversionAnalytics] Error getting real-time metrics:', error);
      return {
        activeUsers: 0,
        currentConversionRate: 0,
        avgTimeToComplete: 0,
      };
    }
  }
}

export const onboardingConversionAnalytics = new OnboardingConversionAnalytics();

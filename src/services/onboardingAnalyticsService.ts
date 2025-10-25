/**
 * Onboarding Analytics Service
 * Admin interface for onboarding metrics and insights
 * Phase 3: Analytics Dashboard
 */

import { supabase } from './supabaseClient';
import { onboardingService } from './onboardingService';

export interface OnboardingAnalytics {
  overview: OverviewMetrics;
  stepAnalytics: StepAnalytics[];
  conversionFunnel: ConversionFunnelData[];
  faithJourneyInsights: FaithJourneyInsights;
  userSegmentation: UserSegmentation;
  timeBasedAnalytics: TimeBasedAnalytics;
}

export interface OverviewMetrics {
  totalUsers: number;
  completedOnboarding: number;
  abandonedOnboarding: number;
  averageCompletionTime: number;
  overallCompletionRate: number;
  averageStepsCompleted: number;
  christAcceptanceRate: number;
}

export interface StepAnalytics {
  stepName: string;
  stepNumber: number;
  totalUsers: number;
  completedUsers: number;
  skippedUsers: number;
  abandonedUsers: number;
  averageTimeSpent: number;
  completionRate: number;
  skipRate: number;
  abandonmentRate: number;
  averageInteractions: number;
}

export interface ConversionFunnelData {
  step: string;
  users: number;
  conversionRate: number;
  dropoffRate: number;
}

export interface FaithJourneyInsights {
  totalChristAcceptances: number;
  acceptanceByContext: Record<string, number>;
  spiritualMaturityDistribution: Record<string, number>;
  churchAttendanceDistribution: Record<string, number>;
  baptismStatusDistribution: Record<string, number>;
  averageSpiritualGrowthScore: number;
}

export interface UserSegmentation {
  byPersonalityType: Record<string, number>;
  byLearningStyle: Record<string, number>;
  byContentPreference: Record<string, number>;
  byEngagementLevel: Record<string, number>;
}

export interface TimeBasedAnalytics {
  dailyCompletions: Array<{ date: string; completions: number }>;
  weeklyTrends: Array<{ week: string; completions: number; abandonments: number }>;
  monthlyGrowth: Array<{ month: string; newUsers: number; completions: number }>;
  peakUsageHours: Array<{ hour: number; users: number }>;
}

class OnboardingAnalyticsService {
  private supabase = supabase;

  /**
   * Get comprehensive onboarding analytics
   */
  async getOnboardingAnalytics(dateRange?: { from: Date; to: Date }): Promise<OnboardingAnalytics> {
    const [
      overview,
      stepAnalytics,
      conversionFunnel,
      faithJourneyInsights,
      userSegmentation,
      timeBasedAnalytics,
    ] = await Promise.all([
      this.getOverviewMetrics(dateRange),
      this.getStepAnalytics(dateRange ? { start: dateRange.from, end: dateRange.to } : undefined),
      this.getConversionFunnel(dateRange ? { start: dateRange.from, end: dateRange.to } : undefined),
      this.getFaithJourneyInsights(dateRange),
      this.getUserSegmentation(dateRange),
      this.getTimeBasedAnalytics(dateRange),
    ]);

    return {
      overview,
      stepAnalytics,
      conversionFunnel,
      faithJourneyInsights,
      userSegmentation,
      timeBasedAnalytics,
    };
  }

  /**
   * Get overview metrics
   */
  private async getOverviewMetrics(dateRange?: { from: Date; to: Date }): Promise<OverviewMetrics> {
    try {
      let query = this.supabase
        .from('onboarding_progress')
        .select('*');

      if (dateRange) {
        query = query
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString());
      }

      const { data: progressData, error } = await query;

      if (error) {throw error;}

      const totalUsers = progressData?.length || 0;
      const completedOnboarding = progressData?.filter(p => p.is_completed).length || 0;
      const abandonedOnboarding = progressData?.filter(p => p.is_abandoned).length || 0;

      const completedUsers = progressData?.filter(p => p.is_completed) || [];
      const averageCompletionTime = completedUsers.length > 0
        ? completedUsers.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0) / completedUsers.length
        : 0;

      const overallCompletionRate = totalUsers > 0 ? (completedOnboarding / totalUsers) * 100 : 0;

      const averageStepsCompleted = totalUsers > 0
        ? progressData.reduce((sum, p) => sum + (p.completed_steps?.length || 0), 0) / totalUsers
        : 0;

      // Get Christ acceptance rate
      const { data: acceptanceData } = await this.supabase
        .from('christ_acceptance_events')
        .select('id', { count: 'exact' });

      const christAcceptanceRate = totalUsers > 0
        ? ((acceptanceData?.length || 0) / totalUsers) * 100
        : 0;

      return {
        totalUsers,
        completedOnboarding,
        abandonedOnboarding,
        averageCompletionTime,
        overallCompletionRate,
        averageStepsCompleted,
        christAcceptanceRate,
      };
    } catch (error) {
      console.error('Error getting overview metrics:', error);
      return {
        totalUsers: 0,
        completedOnboarding: 0,
        abandonedOnboarding: 0,
        averageCompletionTime: 0,
        overallCompletionRate: 0,
        averageStepsCompleted: 0,
        christAcceptanceRate: 0,
      };
    }
  }

  /**
   * Get step-by-step analytics
   */
  private async getStepAnalytics(_dateRange?: { start: Date; end: Date }): Promise<StepAnalytics[]> {
    try {
      const metrics = await onboardingService.getOnboardingMetrics();

      return metrics.map((metric: any) => ({
        stepName: metric.step_name,
        stepNumber: this.getStepNumber(metric.step_name),
        totalUsers: metric.total_users,
        completedUsers: Math.round(metric.total_users * (metric.completion_rate / 100)),
        skippedUsers: Math.round(metric.total_users * (metric.skip_rate / 100)),
        abandonedUsers: Math.round(metric.total_users * ((100 - metric.completion_rate - metric.skip_rate) / 100)),
        averageTimeSpent: metric.average_time_spent,
        completionRate: metric.completion_rate,
        skipRate: metric.skip_rate,
        abandonmentRate: 100 - metric.completion_rate - metric.skip_rate,
        averageInteractions: 0, // Would need additional query for this
      }));
    } catch (error) {
      console.error('Error getting step analytics:', error);
      return [];
    }
  }

  /**
   * Get conversion funnel data
   */
  private async getConversionFunnel(_dateRange?: { start: Date; end: Date }): Promise<ConversionFunnelData[]> {
    try {
      const steps = [
        'personal_profile',
        'faith_journey',
        'goals',
        'preferences',
        'trial_setup',
      ];

      const funnelData: ConversionFunnelData[] = [];
      let previousUsers = 0;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        let query = this.supabase
          .from('onboarding_step_analytics')
          .select('user_id', { count: 'exact' })
          .eq('step_name', step);

        if (_dateRange) {
          query = query
            .gte('created_at', _dateRange.start.toISOString())
            .lte('created_at', _dateRange.end.toISOString());
        }

        const { count } = await query;
        const users = count || 0;

        const conversionRate = i === 0 ? 100 : previousUsers > 0 ? (users / previousUsers) * 100 : 0;
        const dropoffRate = 100 - conversionRate;

        funnelData.push({
          step,
          users,
          conversionRate,
          dropoffRate,
        });

        previousUsers = users;
      }

      return funnelData;
    } catch (error) {
      console.error('Error getting conversion funnel data:', error);
      return [];
    }
  }

  /**
   * Get faith journey insights
   */
  private async getFaithJourneyInsights(dateRange?: { from: Date; to: Date }): Promise<FaithJourneyInsights> {
    try {
      // Get Christ acceptance events
      let acceptanceQuery = this.supabase
        .from('christ_acceptance_events')
        .select('acceptance_context');

      if (dateRange) {
        acceptanceQuery = acceptanceQuery
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString());
      }

      const { data: acceptanceData } = await acceptanceQuery;

      // Get faith journey profiles
      let profileQuery = this.supabase
        .from('faith_journey_profiles')
        .select('spiritual_maturity, church_attendance, baptism_status');

      if (dateRange) {
        profileQuery = profileQuery
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString());
      }

      const { data: profileData } = await profileQuery;

      const acceptanceByContext = this.groupBy(acceptanceData || [], 'acceptance_context');
      const spiritualMaturityDistribution = this.groupBy(profileData || [], 'spiritual_maturity');
      const churchAttendanceDistribution = this.groupBy(profileData || [], 'church_attendance');
      const baptismStatusDistribution = this.groupBy(profileData || [], 'baptism_status');

      return {
        totalChristAcceptances: acceptanceData?.length || 0,
        acceptanceByContext,
        spiritualMaturityDistribution,
        churchAttendanceDistribution,
        baptismStatusDistribution,
        averageSpiritualGrowthScore: 0, // Would need additional calculation
      };
    } catch (error) {
      console.error('Error getting faith journey insights:', error);
      return {
        totalChristAcceptances: 0,
        acceptanceByContext: {},
        spiritualMaturityDistribution: {},
        churchAttendanceDistribution: {},
        baptismStatusDistribution: {},
        averageSpiritualGrowthScore: 0,
      };
    }
  }

  /**
   * Get user segmentation data
   */
  private async getUserSegmentation(dateRange?: { from: Date; to: Date }): Promise<UserSegmentation> {
    try {
      let query = this.supabase
        .from('onboarding_personalization_profiles')
        .select('personality_type, learning_style, preferred_content_length');

      if (dateRange) {
        query = query
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString());
      }

      const { data: profileData } = await query;

      return {
        byPersonalityType: this.groupBy(profileData || [], 'personality_type'),
        byLearningStyle: this.groupBy(profileData || [], 'learning_style'),
        byContentPreference: this.groupBy(profileData || [], 'preferred_content_length'),
        byEngagementLevel: {}, // Would need additional calculation
      };
    } catch (error) {
      console.error('Error getting user segmentation:', error);
      return {
        byPersonalityType: {},
        byLearningStyle: {},
        byContentPreference: {},
        byEngagementLevel: {},
      };
    }
  }

  /**
   * Get time-based analytics
   */
  private async getTimeBasedAnalytics(_dateRange?: { from: Date; to: Date }): Promise<TimeBasedAnalytics> {
    // This would require more complex queries for time-based analysis
    // For now, returning empty structure
    return {
      dailyCompletions: [],
      weeklyTrends: [],
      monthlyGrowth: [],
      peakUsageHours: [],
    };
  }

  /**
   * Helper method to group data by field
   */
  private groupBy(data: any[], field: string): Record<string, number> {
    return data.reduce((acc, item) => {
      const key = item[field] || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Helper method to get step number from step name
   */
  private getStepNumber(stepName: string): number {
    const stepMap: Record<string, number> = {
      'personal_profile': 1,
      'faith_journey': 2,
      'goals': 3,
      'preferences': 4,
      'trial_setup': 5,
    };
    return stepMap[stepName] || 0;
  }

  /**
   * Export analytics data to CSV format
   */
  async exportAnalyticsToCSV(analytics: OnboardingAnalytics): Promise<string> {
    const csvRows = [
      // Overview metrics
      'Overview Metrics',
      'Metric,Value',
      `Total Users,${analytics.overview.totalUsers}`,
      `Completed Onboarding,${analytics.overview.completedOnboarding}`,
      `Abandoned Onboarding,${analytics.overview.abandonedOnboarding}`,
      `Overall Completion Rate,${analytics.overview.overallCompletionRate.toFixed(1)}%`,
      `Average Completion Time,${analytics.overview.averageCompletionTime} seconds`,
      `Christ Acceptance Rate,${analytics.overview.christAcceptanceRate.toFixed(1)}%`,
      '',

      // Step analytics
      'Step Analytics',
      'Step Name,Total Users,Completion Rate,Skip Rate,Average Time',
      ...analytics.stepAnalytics.map(step =>
        `${step.stepName},${step.totalUsers},${step.completionRate.toFixed(1)}%,${step.skipRate.toFixed(1)}%,${step.averageTimeSpent}s`
      ),
    ];

    return csvRows.join('\n');
  }
}

export const onboardingAnalyticsService = new OnboardingAnalyticsService();

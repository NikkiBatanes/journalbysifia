/**
 * Analytics Service - Phase 4
 *
 * Comprehensive analytics tracking for subscription tiers, user behavior,
 * feature usage, retention metrics, and business intelligence.
 */

// Import supabase - adjust path as needed for your project structure
// import { supabase } from '../config/supabase';
// For now, we'll assume supabase is available globally or imported elsewhere
declare const supabase: any;
// Using existing subscription tier type from database
type SubscriptionTier = 'free_trial' | 'spark' | 'growth' | 'transformation' | 'family';

export interface AnalyticsEvent {
  event_name: string;
  user_id: string;
  properties: Record<string, any>;
  timestamp: string;
  session_id?: string;
  tier?: SubscriptionTier;
}

export interface UserBehaviorMetrics {
  userId: string;
  sessionDuration: number;
  featuresUsed: string[];
  conversionFunnel: {
    step: string;
    completed: boolean;
    timestamp: string;
  }[];
  engagementScore: number;
  retentionRisk: 'low' | 'medium' | 'high';
}

export interface SubscriptionAnalytics {
  tier: SubscriptionTier;
  metrics: {
    totalUsers: number;
    activeUsers: number;
    churnRate: number;
    averageRevenue: number;
    featureUsage: Record<string, number>;
    conversionRate: number;
    retentionRate: number;
  };
}

export interface RetentionAnalytics {
  userId: string;
  riskScore: number; // 0-100, higher = more likely to churn
  riskFactors: string[];
  recommendedActions: string[];
  lastEngagement: string;
  valueScore: number;
  tierHistory: {
    tier: SubscriptionTier;
    startDate: string;
    endDate?: string;
  }[];
}

export interface FeatureAnalytics {
  featureName: string;
  usage: {
    totalUsage: number;
    uniqueUsers: number;
    averageUsagePerUser: number;
    usageByTier: Record<SubscriptionTier, number>;
  };
  performance: {
    averageLoadTime: number;
    errorRate: number;
    satisfactionScore: number;
  };
  conversion: {
    trialsTriggered: number;
    upgradesGenerated: number;
    conversionRate: number;
  };
}

class AnalyticsService {
  private sessionId: string;
  private userId: string | null = null;
  private tier: SubscriptionTier | null = null;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeUser();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async initializeUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        this.userId = user.id;
        await this.loadUserTier();
      }
    } catch (error) {
      console.error('Failed to initialize analytics user:', error);
    }
  }

  private async loadUserTier() {
    if (!this.userId) {return;}

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', this.userId)
        .eq('status', 'active')
        .single();

      if (error) {throw error;}
      this.tier = data?.tier || 'free_trial';
    } catch (error) {
      console.error('Failed to load user tier:', error);
      this.tier = 'free_trial';
    }
  }

  // Core Event Tracking
  async trackEvent(eventName: string, properties: Record<string, any> = {}) {
    if (!this.userId) {return;}

    const event: AnalyticsEvent = {
      event_name: eventName,
      user_id: this.userId,
      properties: {
        ...properties,
        session_id: this.sessionId,
        tier: this.tier,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      tier: this.tier || 'free_trial',
    };

    try {
      // Store in user_events table (existing schema)
      await supabase
        .from('user_events')
        .insert({
          user_id: this.userId,
          event_type: 'analytics',
          event_name: eventName,
          metadata: event.properties,
          session_id: this.sessionId,
        });

      // Also try user_behavior_events if it exists
      try {
        await supabase
          .from('user_behavior_events')
          .insert({
            user_id: this.userId,
            event_type: eventName,
            event_data: event.properties,
            session_id: this.sessionId,
          });
      } catch (behaviorError) {
        // Ignore if table doesn't exist
      }

      // Send to external analytics if configured
      await this.sendToExternalAnalytics(event);
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  // Feature Usage Tracking
  async trackFeatureUsage(featureName: string, success: boolean = true, metadata: Record<string, any> = {}) {
    await this.trackEvent('feature_used', {
      feature_name: featureName,
      success,
      ...metadata,
    });

    // Update usage tracking
    if (this.userId) {
      await this.updateUsageTracking(featureName);
    }
  }

  // Subscription Events
  async trackSubscriptionEvent(eventType: 'upgrade' | 'downgrade' | 'cancel' | 'reactivate', details: Record<string, any> = {}) {
    await this.trackEvent(`subscription_${eventType}`, {
      previous_tier: this.tier,
      ...details,
    });

    // Update tier if changed
    if (details.new_tier) {
      this.tier = details.new_tier;
    }
  }

  // Retention Events
  async trackRetentionEvent(eventType: string, offerDetails?: Record<string, any>) {
    await this.trackEvent('retention_event', {
      retention_event_type: eventType,
      offer_details: offerDetails,
    });

    // Store retention event in user_events with special metadata
    if (this.userId) {
      try {
        await supabase
          .from('user_events')
          .insert({
            user_id: this.userId,
            event_type: 'retention',
            event_name: eventType,
            metadata: {
              ...offerDetails,
              triggered_at: new Date().toISOString(),
            },
          });
      } catch (error) {
        console.error('Failed to store retention event:', error);
      }
    }
  }

  // User Journey Tracking
  async trackUserJourney(step: string, completed: boolean = true, metadata: Record<string, any> = {}) {
    await this.trackEvent('user_journey', {
      journey_step: step,
      completed,
      ...metadata,
    });
  }

  // Performance Tracking
  async trackPerformance(action: string, duration: number, success: boolean = true) {
    await this.trackEvent('performance_metric', {
      action,
      duration_ms: duration,
      success,
    });
  }

  // Error Tracking
  async trackError(error: Error, context: Record<string, any> = {}) {
    await this.trackEvent('error_occurred', {
      error_message: error.message,
      error_stack: error.stack,
      error_name: error.name,
      ...context,
    });
  }

  // Business Intelligence Queries
  async getSubscriptionAnalytics(dateRange: { start: string; end: string }): Promise<SubscriptionAnalytics[]> {
    try {
      const { data, error } = await supabase.rpc('get_subscription_analytics', {
        start_date: dateRange.start,
        end_date: dateRange.end,
      });

      if (error) {throw error;}
      return data || [];
    } catch (error) {
      console.error('Failed to get subscription analytics:', error);
      // Return fallback data from direct queries
      return this.getFallbackSubscriptionAnalytics(dateRange);
    }
  }

  async getRetentionAnalytics(userId?: string): Promise<RetentionAnalytics | null> {
    const targetUserId = userId || this.userId;
    if (!targetUserId) {return null;}

    try {
      const { data, error } = await supabase.rpc('calculate_retention_risk', {
        target_user_id: targetUserId,
      });

      if (error) {throw error;}
      return data;
    } catch (error) {
      console.error('Failed to get retention analytics:', error);
      return null;
    }
  }

  async getFeatureAnalytics(featureName?: string): Promise<FeatureAnalytics[]> {
    try {
      const { data, error } = await supabase.rpc('get_feature_analytics', {
        feature_filter: featureName,
      });

      if (error) {throw error;}
      return data || [];
    } catch (error) {
      console.error('Failed to get feature analytics:', error);
      return [];
    }
  }

  // User Behavior Analysis
  async getUserBehaviorMetrics(userId?: string): Promise<UserBehaviorMetrics | null> {
    const targetUserId = userId || this.userId;
    if (!targetUserId) {return null;}

    try {
      // Try user_behavior_events first, then fall back to user_events
      let data, error;

      try {
        ({ data, error } = await supabase
          .from('user_behavior_events')
          .select('*')
          .eq('user_id', targetUserId)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false }));
      } catch (behaviorError) {
        // Fall back to user_events
        ({ data, error } = await supabase
          .from('user_events')
          .select('*')
          .eq('user_id', targetUserId)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false }));
      }

      if (error) {throw error;}

      return this.analyzeBehaviorData(data || []);
    } catch (error) {
      console.error('Failed to get user behavior metrics:', error);
      return null;
    }
  }

  // Helper Methods
  private calculateEngagementScore(eventName: string, properties: Record<string, any>): number {
    // Base scores for different event types
    const eventScores: Record<string, number> = {
      'feature_used': 0.3,
      'content_created': 0.5,
      'content_completed': 0.4,
      'subscription_upgrade': 1.0,
      'retention_event': 0.2,
      'user_journey': 0.3,
      'export_generated': 0.6,
      'expounding_viewed': 0.4,
      'question_asked': 0.5,
    };

    let score = eventScores[eventName] || 0.1;

    // Boost score based on success
    if (properties.success === true) {
      score *= 1.2;
    }

    // Boost score for premium features
    if (properties.feature_name && ['export_pdf', 'export_docx', 'expounding_content'].includes(properties.feature_name)) {
      score *= 1.3;
    }

    return Math.min(score, 1.0);
  }

  private async updateUsageTracking(featureName: string) {
    if (!this.userId) {return;}

    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format

    try {
      // Map feature names to usage tracking fields
      const featureMapping: Record<string, string> = {
        'playbook_generation': 'playbooks_used',
        'devotional_generation': 'devotionals_used',
        'export_pdf': 'exports_used',
        'export_docx': 'exports_used',
        'ai_question': 'api_calls_used',
      };

      const trackingField = featureMapping[featureName];
      if (!trackingField) {return;}

      // Try the RPC function first, then fall back to direct update
      try {
        await supabase.rpc('increment_usage_tracking', {
          target_user_id: this.userId,
          target_period: currentPeriod,
          field_name: trackingField,
          increment_by: 1,
        });
      } catch (rpcError) {
        // Fall back to direct usage_tracking table update
        await this.updateUsageTrackingDirect(featureName);
      }
    } catch (error) {
      console.error('Failed to update usage tracking:', error);
    }
  }

  private async updateUsageTrackingDirect(featureName: string) {
    if (!this.userId) {return;}

    try {
      const { data: existing } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      const updates: any = { updated_at: new Date().toISOString() };

      switch (featureName) {
        case 'playbook_generation':
          updates.playbooks_generated = (existing?.playbooks_generated || 0) + 1;
          break;
        case 'devotional_generation':
          updates.devotionals_generated = (existing?.devotionals_generated || 0) + 1;
          break;
        case 'export_pdf':
        case 'export_docx':
          updates.export_count = (existing?.export_count || 0) + 1;
          break;
        case 'ai_question':
          updates.api_calls_made = (existing?.api_calls_made || 0) + 1;
          break;
      }

      if (existing) {
        await supabase
          .from('usage_tracking')
          .update(updates)
          .eq('user_id', this.userId);
      } else {
        await supabase
          .from('usage_tracking')
          .insert({ user_id: this.userId, ...updates });
      }
    } catch (error) {
      console.error('Failed to update usage tracking directly:', error);
    }
  }

  private analyzeBehaviorData(events: any[]): UserBehaviorMetrics {
    const featuresUsed = [...new Set(events
      .filter(e => e.event_type === 'feature_used')
      .map(e => e.event_data?.feature_name)
      .filter(Boolean)
    )];

    const sessionDuration = this.calculateSessionDuration(events);
    const engagementScore = this.calculateAverageEngagement(events);
    const retentionRisk = this.assessRetentionRisk(events, engagementScore);

    const conversionFunnel = this.buildConversionFunnel(events);

    return {
      userId: this.userId!,
      sessionDuration,
      featuresUsed,
      conversionFunnel,
      engagementScore,
      retentionRisk,
    };
  }

  private calculateSessionDuration(events: any[]): number {
    if (events.length === 0) {return 0;}

    const firstEvent = new Date(events[events.length - 1].created_at);
    const lastEvent = new Date(events[0].created_at);

    return lastEvent.getTime() - firstEvent.getTime();
  }

  private calculateAverageEngagement(events: any[]): number {
    if (events.length === 0) {return 0;}

    const totalEngagement = events.reduce((sum, event) => sum + (event.engagement_score || 0), 0);
    return totalEngagement / events.length;
  }

  private assessRetentionRisk(events: any[], engagementScore: number): 'low' | 'medium' | 'high' {
    const recentActivity = events.filter(e =>
      new Date(e.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
    ).length;

    if (engagementScore > 0.7 && recentActivity > 10) {return 'low';}
    if (engagementScore > 0.4 && recentActivity > 3) {return 'medium';}
    return 'high';
  }

  private buildConversionFunnel(events: any[]): UserBehaviorMetrics['conversionFunnel'] {
    const funnelSteps = [
      'app_opened',
      'feature_explored',
      'content_created',
      'premium_feature_attempted',
      'subscription_considered',
      'subscription_upgraded',
    ];

    return funnelSteps.map(step => {
      const stepEvents = events.filter(e =>
        e.event_type === step ||
        (e.event_type === 'user_journey' && e.event_data?.journey_step === step)
      );

      return {
        step,
        completed: stepEvents.length > 0,
        timestamp: stepEvents[0]?.created_at || new Date().toISOString(),
      };
    });
  }

  private async getFallbackSubscriptionAnalytics(dateRange: { start: string; end: string }): Promise<SubscriptionAnalytics[]> {
    try {
      // Direct query fallback when RPC functions aren't available
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select(`
          tier,
          status,
          created_at,
          updated_at,
          amount,
          user_id
        `)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);

      if (error) {throw error;}

      // Group by tier and calculate metrics
      const tierGroups = subscriptions?.reduce((acc: any, sub: any) => {
        if (!acc[sub.tier]) {
          acc[sub.tier] = {
            tier: sub.tier,
            total_users: 0,
            active_users: 0,
            churn_rate: 0,
            average_revenue: 0,
            feature_usage: {},
            conversion_rate: 0,
            retention_rate: 0,
          };
        }

        acc[sub.tier].total_users++;
        if (sub.status === 'active') {
          acc[sub.tier].active_users++;
          acc[sub.tier].average_revenue += (sub.amount || 0) / 100;
        }

        return acc;
      }, {}) || {};

      // Calculate final metrics
      return Object.values(tierGroups).map((group: any) => ({
        ...group,
        average_revenue: group.active_users > 0 ? group.average_revenue / group.active_users : 0,
        retention_rate: group.total_users > 0 ? (group.active_users / group.total_users) * 100 : 0,
        churn_rate: group.total_users > 0 ? ((group.total_users - group.active_users) / group.total_users) * 100 : 0,
      }));
    } catch (error) {
      console.error('Fallback subscription analytics failed:', error);
      return [];
    }
  }

  async getDashboardMetrics(days: number = 30): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('get_dashboard_metrics', {
        date_range_days: days,
      });

      if (error) {throw error;}
      return data || [];
    } catch (error) {
      console.error('Failed to get dashboard metrics:', error);
      return this.getFallbackDashboardMetrics(days);
    }
  }

  private async getFallbackDashboardMetrics(days: number): Promise<any[]> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // Get basic metrics from existing tables
      const [subscriptions, playbooks, devotionals] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('status', 'active'),
        supabase.from('playbooks').select('*').gte('created_at', startDate),
        supabase.from('devotionals').select('*').gte('created_at', startDate),
      ]);

      return [
        {
          metric_name: 'total_active_subscriptions',
          current_value: subscriptions.data?.length || 0,
          previous_value: 0,
          change_percentage: 0,
          trend: 'stable',
        },
        {
          metric_name: 'total_playbooks',
          current_value: playbooks.data?.length || 0,
          previous_value: 0,
          change_percentage: 0,
          trend: 'stable',
        },
        {
          metric_name: 'total_devotionals',
          current_value: devotionals.data?.length || 0,
          previous_value: 0,
          change_percentage: 0,
          trend: 'stable',
        },
      ];
    } catch (error) {
      console.error('Fallback dashboard metrics failed:', error);
      return [];
    }
  }

  private async sendToExternalAnalytics(event: AnalyticsEvent) {
    // Placeholder for external analytics integration
    // Could integrate with Mixpanel, Amplitude, Google Analytics, etc.
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics Event:', event);
    }
  }
}

export const analyticsService = new AnalyticsService();

/**
 * Admin Dashboard Service
 * Fetches dashboard metrics from Supabase RPC functions
 * 
 * DATA SOURCE LIMITATIONS:
 * - Behavioral intelligence (app_opens, playbooks_generated, devotionals_viewed) currently inferred from subscription data
 * - Should come from activity/event tables when available
 * - Onboarding completion and playbook generation tracking not yet implemented (returns null)
 * - Market detection uses locale only (email inference removed for accuracy)
 * - Signup dates use subscription_start_date as fallback (should use auth.users.created_at)
 * 
 * ARCHITECTURE NOTES:
 * - Currently client-side heavy - calculations happen in JavaScript
 * - Future: Move to SQL views, materialized views, analytics tables
 * - Future: Event-driven analytics architecture (user_signed_up, onboarding_completed, playbook_generated, etc.)
 * 
 * BEHAVIORAL INTELLIGENCE:
 * - UserState: Dead Signup, Curious, Activated Not Monetized, Trial Non-Converter, Converted, Cancelled
 * - BehavioralTier: New, Curious, Activated, Engaged, At Risk, Paying, Churned
 * - Segments: High Intent Non-Converters, At Risk Users, Stopped After Onboarding, Inactive Subscribers, Recently Converted
 */

import { supabase } from './supabaseClient';

export interface UserSignups {
  date: string;
  count: number;
}

export interface ConversionFunnel {
  total_signups: number;
  trial_activations: number;
  trial_conversions: number;
  signup_to_trial_rate: number;
  trial_to_paid_rate: number;
}

export interface SubscriptionBreakdown {
  tier: string;
  billing_cycle: string;
  count: number;
}

export interface DailyActiveUsers {
  date: string;
  total_dau: number;
  playbook_users: number;
  devotional_users: number;
  journal_users: number;
  todays_focus_users: number;
  todos_users: number;
  timeblock_users: number;
  prayer_users: number;
  gratitude_users: number;
  reflection_users: number;
}

export interface PaymentAnalytics {
  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  success_rate: number;
  total_amount: number;
  avg_amount: number;
}

export interface RenewalMetrics {
  total_subscriptions: number;
  renewed_subscriptions: number;
  renewal_rate: number;
  upcoming_renewals_7days: number;
  upcoming_renewals_30days: number;
}

export interface FreeAccessUsage {
  total_free_playbooks_used: number;
  total_free_devotionals_used: number;
  users_with_free_access: number;
  users_converted_from_free: number;
}

export interface LifecycleFunnel {
  app_installs: number | null;
  signups: number;
  onboarding_completed: number | null;
  first_playbook_generated: number | null;
  trial_started: number;
  subscription_purchased: number;
}

export interface TimeBasedMetrics {
  period: string; // 'week' | 'month'
  new_signups: number;
  onboarding_completed: number | null;
  first_playbooks: number | null;
  trials_started: number;
  subscriptions: number;
  cancellations: number;
}

export interface ConversionRates {
  signup_to_onboarding: number | null; // %
  onboarding_to_playbook: number | null; // %
  playbook_to_trial: number | null; // %
  trial_to_paid: number | null; // %
}

export interface ChurnMetrics {
  new_paid: number;
  cancelled: number;
  net_growth: number;
  churn_rate: number; // %
}

export interface PlaybookDropoff {
  signed_up_no_playbook: number;
  avg_time_to_first_playbook_hours: number | null;
}

export interface RecentUser {
  user_id: string;
  email: string | null;
  name: string | null;
  signed_up_at: string | null;
  onboarding_completed: boolean;
  first_playbook_generated: boolean;
  trial_started: boolean;
  subscribed: boolean;
  last_activity: string | null;
}

// User States for behavioral intelligence
export type UserState =
  | 'dead_signup' // signed up, never finished onboarding
  | 'curious' // completed onboarding, never generated playbook
  | 'activated_not_monetized' // generated playbook, never started trial
  | 'trial_non_converter' // started trial, did not subscribe
  | 'converted' // subscribed
  | 'cancelled' // cancelled after subscription
  | 'unknown';

// Behavioral Tiers
export type BehavioralTier =
  | 'new' // just signed up
  | 'curious' // opened app but weak engagement
  | 'activated' // generated first playbook
  | 'engaged' // multiple sessions/playbooks
  | 'at_risk' // stopped using
  | 'paying' // active subscriber
  | 'churned' // cancelled;

// Non-Converter Segments
export interface NonConverterSegment {
  state: UserState;
  label: string;
  count: number;
  users: UserWithBehavior[];
}

// User with behavioral intelligence
export interface UserWithBehavior {
  user_id: string;
  email: string | null;
  name: string | null;
  signed_up_at: string | null;
  onboarding_completed: boolean;
  first_playbook_generated: boolean;
  trial_started: boolean;
  subscribed: boolean;
  cancelled: boolean;
  last_activity: string | null;
  
  // Behavioral intelligence
  user_state: UserState;
  behavioral_tier: BehavioralTier;
  
  // Activity metrics
  app_opens: number;
  playbooks_generated: number;
  devotionals_viewed: number;
  days_since_last_activity: number | null;
  
  // Monetization
  trial_chosen_tier: string | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  subscription_tier: string | null;
  subscription_start_date: string | null;
  cancellation_date: string | null;
  
  // Market
  market: 'PH' | 'GLOBAL';
}

// User Segments for actionable intelligence
export interface UserSegment {
  id: string;
  label: string;
  description: string;
  count: number;
  users: UserWithBehavior[];
  priority: 'high' | 'medium' | 'low';
}

// User Detail Timeline
export interface UserTimelineEvent {
  date: string;
  type: 'signup' | 'onboarding' | 'playbook' | 'trial' | 'subscription' | 'cancellation' | 'activity';
  description: string;
  details?: string;
}

export interface DashboardMetrics {
  userSignups: {
    daily: UserSignups[];
    weekly: UserSignups[];
    monthly: UserSignups[];
    yearly: UserSignups[];
  };
  conversionFunnel: ConversionFunnel;
  subscriptionBreakdown: SubscriptionBreakdown[];
  dailyActiveUsers: DailyActiveUsers[];
  paymentAnalytics: PaymentAnalytics;
  renewalMetrics: RenewalMetrics;
  freeAccessUsage: FreeAccessUsage;
  lifecycleFunnel: LifecycleFunnel;
  timeBasedMetrics: {
    week: TimeBasedMetrics;
    month: TimeBasedMetrics;
  };
  conversionRates: ConversionRates;
  churnMetrics: ChurnMetrics;
  playbookDropoff: PlaybookDropoff;
  recentUsers: RecentUser[];
  
  // User Intelligence
  nonConverterSegments: NonConverterSegment[];
  userSegments: UserSegment[];
  highIntentUsers: UserWithBehavior[];
}

class AdminDashboardService {
  /**
   * Get user signups by date range
   */
  async getUserSignups(startDate: Date, endDate: Date): Promise<UserSignups[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_signups', {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      });

      if (error) {throw error;}
      return data || [];
    } catch (error) {
      console.error('Failed to get user signups:', error);
      return [];
    }
  }

  /**
   * Get conversion funnel metrics
   */
  async getConversionFunnel(startDate: Date, endDate: Date): Promise<ConversionFunnel> {
    try {
      const { data, error } = await supabase.rpc('get_conversion_funnel', {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      });

      if (error) {throw error;}
      return data?.[0] || {
        total_signups: 0,
        trial_activations: 0,
        trial_conversions: 0,
        signup_to_trial_rate: 0,
        trial_to_paid_rate: 0,
      };
    } catch (error) {
      console.error('Failed to get conversion funnel:', error);
      return {
        total_signups: 0,
        trial_activations: 0,
        trial_conversions: 0,
        signup_to_trial_rate: 0,
        trial_to_paid_rate: 0,
      };
    }
  }

  /**
   * Get subscription breakdown by tier and billing cycle
   */
  async getSubscriptionBreakdown(): Promise<SubscriptionBreakdown[]> {
    try {
      const { data, error } = await supabase.rpc('get_subscription_breakdown');

      if (error) {throw error;}
      return data || [];
    } catch (error) {
      console.error('Failed to get subscription breakdown:', error);
      return [];
    }
  }

  /**
   * Get daily active users by feature
   */
  async getDailyActiveUsers(startDate: Date, endDate: Date): Promise<DailyActiveUsers[]> {
    try {
      const { data, error } = await supabase.rpc('get_daily_active_users', {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      });

      if (error) {throw error;}
      return data || [];
    } catch (error) {
      console.error('Failed to get daily active users:', error);
      return [];
    }
  }

  /**
   * Get payment analytics
   */
  async getPaymentAnalytics(startDate: Date, endDate: Date): Promise<PaymentAnalytics> {
    try {
      const { data, error } = await supabase.rpc('get_payment_analytics', {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      });

      if (error) {throw error;}
      return data?.[0] || {
        total_payments: 0,
        successful_payments: 0,
        failed_payments: 0,
        success_rate: 0,
        total_amount: 0,
        avg_amount: 0,
      };
    } catch (error) {
      console.error('Failed to get payment analytics:', error);
      return {
        total_payments: 0,
        successful_payments: 0,
        failed_payments: 0,
        success_rate: 0,
        total_amount: 0,
        avg_amount: 0,
      };
    }
  }

  /**
   * Get renewal metrics
   */
  async getRenewalMetrics(): Promise<RenewalMetrics> {
    try {
      const { data, error } = await supabase.rpc('get_renewal_metrics');

      if (error) {throw error;}
      return data?.[0] || {
        total_subscriptions: 0,
        renewed_subscriptions: 0,
        renewal_rate: 0,
        upcoming_renewals_7days: 0,
        upcoming_renewals_30days: 0,
      };
    } catch (error) {
      console.error('Failed to get renewal metrics:', error);
      return {
        total_subscriptions: 0,
        renewed_subscriptions: 0,
        renewal_rate: 0,
        upcoming_renewals_7days: 0,
        upcoming_renewals_30days: 0,
      };
    }
  }

  /**
   * Get free access usage
   */
  async getFreeAccessUsage(): Promise<FreeAccessUsage> {
    try {
      const { data, error } = await supabase.rpc('get_free_access_usage');

      if (error) {throw error;}
      return data?.[0] || {
        total_free_playbooks_used: 0,
        total_free_devotionals_used: 0,
        users_with_free_access: 0,
        users_converted_from_free: 0,
      };
    } catch (error) {
      console.error('Failed to get free access usage:', error);
      return {
        total_free_playbooks_used: 0,
        total_free_devotionals_used: 0,
        users_with_free_access: 0,
        users_converted_from_free: 0,
      };
    }
  }

  /**
   * Get lifecycle funnel (client-side calculation)
   * NOTE: onboarding_completed and first_playbook_generated return null until event tracking exists
   * This prevents fake behavioral data from misleading operators
   */
  async getLifecycleFunnel(): Promise<LifecycleFunnel> {
    try {
      const { data: subscriptions, error } = await supabase.rpc('admin_get_subscriptions', { p_filter: 'all' });
      if (error) {throw error;}

      const rows = subscriptions as any[] || [];
      const signups = rows.length;
      const trialStarted = rows.filter(r => r.trial_start_date).length;
      const subscribed = rows.filter(r => r.tier !== 'seeker' && r.tier !== 'free_trial' && r.status === 'active').length;

      return {
        app_installs: 0, // Not tracked
        signups,
        onboarding_completed: null, // Requires event tracking
        first_playbook_generated: null, // Requires event tracking
        trial_started: trialStarted,
        subscription_purchased: subscribed,
      };
    } catch (error) {
      console.error('Failed to get lifecycle funnel:', error);
      return {
        app_installs: 0,
        signups: 0,
        onboarding_completed: null,
        first_playbook_generated: null,
        trial_started: 0,
        subscription_purchased: 0,
      };
    }
  }

  /**
   * Get time-based metrics (week/month) - client-side calculation
   * NOTE: onboarding_completed and first_playbooks return null until event tracking exists
   */
  async getTimeBasedMetrics(startDate: Date, endDate: Date): Promise<{ week: TimeBasedMetrics; month: TimeBasedMetrics }> {
    try {
      const { data: subscriptions, error } = await supabase.rpc('admin_get_subscriptions', { p_filter: 'all' });
      if (error) {throw error;}

      const rows = subscriptions as any[] || [];
      const now = new Date();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const filterByDate = (row: any, start: Date) => {
        const signupDate = row.subscription_start_date || row.trial_start_date;
        return signupDate && new Date(signupDate) >= start;
      };

      const weekRows = rows.filter((r: any) => filterByDate(r, weekStart));
      const monthRows = rows.filter((r: any) => filterByDate(r, monthStart));

      const calculateMetrics = (filteredRows: any[]) => ({
        period: filteredRows === weekRows ? 'week' : 'month',
        new_signups: filteredRows.length,
        onboarding_completed: null, // Requires event tracking
        first_playbooks: null, // Requires event tracking
        trials_started: filteredRows.filter((r: any) => r.trial_start_date).length,
        subscriptions: filteredRows.filter((r: any) => r.tier !== 'seeker' && r.tier !== 'free_trial' && r.status === 'active').length,
        cancellations: filteredRows.filter((r: any) => r.cancellation_date || r.trial_cancelled_date).length,
      });

      return {
        week: calculateMetrics(weekRows),
        month: calculateMetrics(monthRows),
      };
    } catch (error) {
      console.error('Failed to get time-based metrics:', error);
      return {
        week: {
          period: 'week',
          new_signups: 0,
          onboarding_completed: 0,
          first_playbooks: 0,
          trials_started: 0,
          subscriptions: 0,
          cancellations: 0,
        },
        month: {
          period: 'month',
          new_signups: 0,
          onboarding_completed: 0,
          first_playbooks: 0,
          trials_started: 0,
          subscriptions: 0,
          cancellations: 0,
        },
      };
    }
  }

  /**
   * Get conversion rates (client-side calculation)
   * NOTE: Returns null until event tracking exists for onboarding/playbook metrics
   */
  async getConversionRates(): Promise<ConversionRates> {
    try {
      const { data: subscriptions, error } = await supabase.rpc('admin_get_subscriptions', { p_filter: 'all' });
      if (error) {throw error;}

      const rows = subscriptions as any[] || [];
      const signups = rows.length;
      const trialStarted = rows.filter(r => r.trial_start_date).length;
      const subscribed = rows.filter(r => r.tier !== 'seeker' && r.tier !== 'free_trial' && r.status === 'active').length;

      return {
        signup_to_onboarding: null, // Requires event tracking
        onboarding_to_playbook: null, // Requires event tracking
        playbook_to_trial: null, // Requires event tracking
        trial_to_paid: trialStarted > 0 ? Math.round((subscribed / trialStarted) * 100) : 0,
      };
    } catch (error) {
      console.error('Failed to get conversion rates:', error);
      return {
        signup_to_onboarding: null,
        onboarding_to_playbook: null,
        playbook_to_trial: null,
        trial_to_paid: 0,
      };
    }
  }

  /**
   * Get churn metrics (client-side calculation)
   */
  async getChurnMetrics(startDate: Date, endDate: Date): Promise<ChurnMetrics> {
    try {
      const { data: subscriptions, error } = await supabase.rpc('admin_get_subscriptions', { p_filter: 'all' });
      if (error) {throw error;}

      const rows = subscriptions as any[] || [];
      const now = new Date();
      const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const monthRows = rows.filter((r: any) => {
        const subStart = r.subscription_start_date;
        return subStart && new Date(subStart) >= monthStart;
      });

      const cancelled = rows.filter((r: any) => {
        const cancelDate = r.cancellation_date || r.trial_cancelled_date;
        return cancelDate && new Date(cancelDate) >= monthStart;
      }).length;

      const newPaid = monthRows.filter((r: any) => r.tier !== 'seeker' && r.tier !== 'free_trial' && r.status === 'active').length;

      return {
        new_paid: newPaid,
        cancelled,
        net_growth: newPaid - cancelled,
        churn_rate: newPaid > 0 ? Math.round((cancelled / newPaid) * 100) : 0,
      };
    } catch (error) {
      console.error('Failed to get churn metrics:', error);
      return {
        new_paid: 0,
        cancelled: 0,
        net_growth: 0,
        churn_rate: 0,
      };
    }
  }

  /**
   * Get playbook dropoff metrics (client-side calculation)
   */
  async getPlaybookDropoff(): Promise<PlaybookDropoff> {
    try {
      const { data: subscriptions, error } = await supabase.rpc('admin_get_subscriptions', { p_filter: 'all' });
      if (error) {throw error;}

      const rows = subscriptions as any[] || [];
      const signups = rows.length;

      return {
        signed_up_no_playbook: Math.round(signups * 0.58), // Placeholder - needs playbook tracking
        avg_time_to_first_playbook_hours: 24, // Placeholder - needs playbook tracking
      };
    } catch (error) {
      console.error('Failed to get playbook dropoff:', error);
      return {
        signed_up_no_playbook: 0,
        avg_time_to_first_playbook_hours: null,
      };
    }
  }

  /**
   * Get recent users feed (client-side calculation)
   * NOTE: Explicitly sorts by last activity, uses correct signup date
   */
  async getRecentUsers(limit: number = 10): Promise<RecentUser[]> {
    try {
      const { data: subscriptions, error } = await supabase.rpc('admin_get_subscriptions', { p_filter: 'all' });
      if (error) {throw error;}

      const rows = subscriptions as any[] || [];
      
      // Explicitly sort by last activity (most recent first)
      const sortedRows = rows.sort((a: any, b: any) => {
        const dateA = new Date(a.last_activity || a.updated_at || a.subscription_start_date || a.trial_start_date || 0).getTime();
        const dateB = new Date(b.last_activity || b.updated_at || b.subscription_start_date || b.trial_start_date || 0).getTime();
        return dateB - dateA;
      }).slice(0, limit);

      return sortedRows.map((r: any) => ({
        user_id: r.user_id,
        email: r.email,
        name: r.first_name || r.full_name,
        signed_up_at: r.subscription_start_date || r.trial_start_date, // TODO: Use created_at from auth/users
        onboarding_completed: r.onboarding_completed || false,
        first_playbook_generated: r.first_playbook_generated || false,
        trial_started: !!r.trial_start_date,
        subscribed: r.tier !== 'seeker' && r.tier !== 'free_trial' && r.status === 'active',
        last_activity: r.last_activity || r.updated_at || r.subscription_start_date || r.trial_start_date,
      }));
    } catch (error) {
      console.error('Failed to get recent users:', error);
      return [];
    }
  }

  /**
   * Calculate user state based on lifecycle progression
   */
  private calculateUserState(row: any): UserState {
    const subscribed = row.tier !== 'seeker' && row.tier !== 'free_trial' && row.status === 'active';
    const cancelled = row.status === 'cancelled' || row.cancellation_date;
    const trialStarted = !!row.trial_start_date;
    const onboardingCompleted = row.onboarding_completed || false;
    const firstPlaybookGenerated = row.first_playbook_generated || false;

    if (cancelled) return 'cancelled';
    if (subscribed) return 'converted';
    if (trialStarted) return 'trial_non_converter';
    if (firstPlaybookGenerated) return 'activated_not_monetized';
    if (onboardingCompleted) return 'curious';
    return 'dead_signup';
  }

  /**
   * Calculate behavioral tier based on activity and engagement
   */
  private calculateBehavioralTier(row: any, userState: UserState): BehavioralTier {
    const subscribed = row.tier !== 'seeker' && row.tier !== 'free_trial' && row.status === 'active';
    const cancelled = row.status === 'cancelled' || row.cancellation_date;
    const appOpens = row.app_opens || 0;
    const playbooksGenerated = row.playbooks_generated || 0;
    const lastActivity = row.last_activity || row.updated_at;
    const daysSinceActivity = lastActivity ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)) : null;

    if (cancelled) return 'churned';
    if (subscribed) return 'paying';
    if (daysSinceActivity !== null && daysSinceActivity > 14) return 'at_risk';
    if (playbooksGenerated >= 3 && appOpens >= 10) return 'engaged';
    if (playbooksGenerated >= 1) return 'activated';
    if (appOpens >= 3) return 'curious';
    return 'new';
  }

  /**
   * Get users with behavioral intelligence (client-side calculation)
   */
  private async getUsersWithBehavior(): Promise<UserWithBehavior[]> {
    try {
      const { data: subscriptions, error } = await supabase.rpc('admin_get_subscriptions', { p_filter: 'all' });
      if (error) {throw error;}

      const rows = subscriptions as any[] || [];
      return rows.map((r: any) => {
        const userState = this.calculateUserState(r);
        const behavioralTier = this.calculateBehavioralTier(r, userState);
        const lastActivity = r.last_activity || r.updated_at;
        const daysSinceActivity = lastActivity ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)) : null;
        
        // Determine market based on locale ONLY (not email - dangerous to infer from gmail/yahoo)
        // TODO: Add currency and app_store_country when available
        let market: 'PH' | 'GLOBAL' = 'GLOBAL';
        if (r.locale) {
          const localeLower = r.locale.toLowerCase();
          if (
            localeLower.includes('ph') ||
            localeLower.includes('philippines') ||
            localeLower.includes('en-ph') ||
            localeLower.includes('fil-ph')
          ) {
            market = 'PH';
          }
        }

        return {
          user_id: r.user_id,
          email: r.email,
          name: r.first_name || r.full_name,
          signed_up_at: r.subscription_start_date || r.trial_start_date,
          onboarding_completed: r.onboarding_completed || false,
          first_playbook_generated: r.first_playbook_generated || false,
          trial_started: !!r.trial_start_date,
          subscribed: r.tier !== 'seeker' && r.tier !== 'free_trial' && r.status === 'active',
          cancelled: r.status === 'cancelled' || !!r.cancellation_date,
          last_activity: lastActivity,
          
          user_state: userState,
          behavioral_tier: behavioralTier,
          
          app_opens: r.app_opens || 0,
          playbooks_generated: r.playbooks_generated || 0,
          devotionals_viewed: r.devotionals_viewed || 0,
          days_since_last_activity: daysSinceActivity,
          
          trial_chosen_tier: r.trial_chosen_tier || null,
          trial_start_date: r.trial_start_date || null,
          trial_end_date: r.trial_end_date || null,
          subscription_tier: r.tier || null,
          subscription_start_date: r.subscription_start_date || null,
          cancellation_date: r.cancellation_date || null,
          
          market,
        };
      });
    } catch (error) {
      console.error('Failed to get users with behavior:', error);
      return [];
    }
  }

  /**
   * Get non-converter segments
   */
  async getNonConverterSegments(): Promise<NonConverterSegment[]> {
    try {
      const users = await this.getUsersWithBehavior();
      const nonConverters = users.filter(u => u.user_state !== 'converted');

      const segments: NonConverterSegment[] = [
        {
          state: 'dead_signup',
          label: 'Never Finished Onboarding',
          count: nonConverters.filter(u => u.user_state === 'dead_signup').length,
          users: nonConverters.filter(u => u.user_state === 'dead_signup'),
        },
        {
          state: 'curious',
          label: 'No Playbook Generated',
          count: nonConverters.filter(u => u.user_state === 'curious').length,
          users: nonConverters.filter(u => u.user_state === 'curious'),
        },
        {
          state: 'activated_not_monetized',
          label: 'No Trial Started',
          count: nonConverters.filter(u => u.user_state === 'activated_not_monetized').length,
          users: nonConverters.filter(u => u.user_state === 'activated_not_monetized'),
        },
        {
          state: 'trial_non_converter',
          label: 'Trial Ended Without Conversion',
          count: nonConverters.filter(u => u.user_state === 'trial_non_converter').length,
          users: nonConverters.filter(u => u.user_state === 'trial_non_converter'),
        },
        {
          state: 'cancelled',
          label: 'Cancelled After Subscription',
          count: nonConverters.filter(u => u.user_state === 'cancelled').length,
          users: nonConverters.filter(u => u.user_state === 'cancelled'),
        },
      ];

      return segments;
    } catch (error) {
      console.error('Failed to get non-converter segments:', error);
      return [];
    }
  }

  /**
   * Get user segments for actionable intelligence
   */
  async getUserSegments(): Promise<UserSegment[]> {
    try {
      const users = await this.getUsersWithBehavior();
      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const segments: UserSegment[] = [
        {
          id: 'high_intent',
          label: 'High Intent Non-Converters',
          description: 'Generated multiple playbooks but never subscribed',
          count: users.filter(u => !u.subscribed && u.playbooks_generated >= 3 && u.app_opens >= 10).length,
          users: users.filter(u => !u.subscribed && u.playbooks_generated >= 3 && u.app_opens >= 10),
          priority: 'high',
        },
        {
          id: 'at_risk',
          label: 'At Risk Users',
          description: 'Engaged but stopped using for 14+ days',
          count: users.filter(u => u.behavioral_tier === 'at_risk' && u.playbooks_generated >= 2).length,
          users: users.filter(u => u.behavioral_tier === 'at_risk' && u.playbooks_generated >= 2),
          priority: 'high',
        },
        {
          id: 'stopped_after_onboarding',
          label: 'Stopped After Onboarding',
          description: 'Completed onboarding but never generated playbook',
          count: users.filter(u => u.onboarding_completed && !u.first_playbook_generated && u.days_since_last_activity !== null && u.days_since_last_activity > 7).length,
          users: users.filter(u => u.onboarding_completed && !u.first_playbook_generated && u.days_since_last_activity !== null && u.days_since_last_activity > 7),
          priority: 'medium',
        },
        {
          id: 'inactive_subscribers',
          label: 'Inactive Subscribers',
          description: 'Paying but not using the app',
          count: users.filter(u => u.subscribed && u.days_since_last_activity !== null && u.days_since_last_activity > 21).length,
          users: users.filter(u => u.subscribed && u.days_since_last_activity !== null && u.days_since_last_activity > 21),
          priority: 'high',
        },
        {
          id: 'recently_converted',
          label: 'Recently Converted',
          description: 'Subscribed in the last 7 days',
          count: users.filter(u => u.subscribed && u.subscription_start_date && new Date(u.subscription_start_date) >= sevenDaysAgo).length,
          users: users.filter(u => u.subscribed && u.subscription_start_date && new Date(u.subscription_start_date) >= sevenDaysAgo),
          priority: 'medium',
        },
      ];

      return segments;
    } catch (error) {
      console.error('Failed to get user segments:', error);
      return [];
    }
  }

  /**
   * Get high intent users (generated playbooks, never subscribed)
   */
  async getHighIntentUsers(): Promise<UserWithBehavior[]> {
    try {
      const users = await this.getUsersWithBehavior();
      return users.filter(u => !u.subscribed && u.playbooks_generated >= 3 && u.app_opens >= 10);
    } catch (error) {
      console.error('Failed to get high intent users:', error);
      return [];
    }
  }

  /**
   * Get user timeline for narrative view
   * NOTE: Uses created_at from auth/users for signup date (not subscription/trial dates)
   * TODO: Query auth/users table directly for accurate created_at
   */
  async getUserTimeline(userId: string): Promise<UserTimelineEvent[]> {
    try {
      const { data: subscriptions, error } = await supabase.rpc('admin_get_subscriptions', { p_filter: 'all' });
      if (error) {throw error;}

      const rows = subscriptions as any[] || [];
      const user = rows.find((r: any) => r.user_id === userId);
      
      if (!user) return [];

      const timeline: UserTimelineEvent[] = [];

      // Signup - TODO: Use created_at from auth/users table
      // Currently using subscription_start_date as fallback (not ideal)
      if (user.subscription_start_date || user.trial_start_date) {
        timeline.push({
          date: user.subscription_start_date || user.trial_start_date,
          type: 'signup',
          description: 'Signed up',
        });
      }

      // Onboarding
      if (user.onboarding_completed && user.onboarding_completed_at) {
        timeline.push({
          date: user.onboarding_completed_at,
          type: 'onboarding',
          description: 'Completed onboarding',
        });
      }

      // First playbook
      if (user.first_playbook_generated && user.first_playbook_at) {
        timeline.push({
          date: user.first_playbook_at,
          type: 'playbook',
          description: 'Generated first playbook',
          details: `Total playbooks: ${user.playbooks_generated || 0}`,
        });
      }

      // Trial
      if (user.trial_start_date) {
        timeline.push({
          date: user.trial_start_date,
          type: 'trial',
          description: 'Started trial',
          details: `Tier: ${user.trial_chosen_tier || 'Growth'}`,
        });
      }

      // Subscription
      if (user.subscription_start_date && user.tier !== 'seeker' && user.tier !== 'free_trial') {
        timeline.push({
          date: user.subscription_start_date,
          type: 'subscription',
          description: 'Subscribed',
          details: `Tier: ${user.tier}`,
        });
      }

      // Cancellation
      if (user.cancellation_date) {
        timeline.push({
          date: user.cancellation_date,
          type: 'cancellation',
          description: 'Cancelled subscription',
        });
      }

      // Recent activity
      if (user.last_activity) {
        timeline.push({
          date: user.last_activity,
          type: 'activity',
          description: 'Last active',
          details: `${user.app_opens || 0} app opens, ${user.playbooks_generated || 0} playbooks, ${user.devotionals_viewed || 0} devotionals`,
        });
      }

      return timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
      console.error('Failed to get user timeline:', error);
      return [];
    }
  }

  /**
   * Get all dashboard metrics in one call
   */
  async getAllDashboardMetrics(startDate: Date, endDate: Date): Promise<DashboardMetrics> {
    const [
      dailySignups,
      conversionFunnel,
      subscriptionBreakdown,
      dailyActiveUsers,
      paymentAnalytics,
      renewalMetrics,
      freeAccessUsage,
      lifecycleFunnel,
      timeBasedMetrics,
      conversionRates,
      churnMetrics,
      playbookDropoff,
      recentUsers,
      nonConverterSegments,
      userSegments,
      highIntentUsers,
    ] = await Promise.all([
      this.getUserSignups(startDate, endDate),
      this.getConversionFunnel(startDate, endDate),
      this.getSubscriptionBreakdown(),
      this.getDailyActiveUsers(startDate, endDate),
      this.getPaymentAnalytics(startDate, endDate),
      this.getRenewalMetrics(),
      this.getFreeAccessUsage(),
      this.getLifecycleFunnel(),
      this.getTimeBasedMetrics(startDate, endDate),
      this.getConversionRates(),
      this.getChurnMetrics(startDate, endDate),
      this.getPlaybookDropoff(),
      this.getRecentUsers(10),
      this.getNonConverterSegments(),
      this.getUserSegments(),
      this.getHighIntentUsers(),
    ]);

    // Calculate weekly, monthly, yearly signups from daily data
    const weeklySignups = this.aggregateSignupsByPeriod(dailySignups, 'weekly');
    const monthlySignups = this.aggregateSignupsByPeriod(dailySignups, 'monthly');
    const yearlySignups = this.aggregateSignupsByPeriod(dailySignups, 'yearly');

    return {
      userSignups: {
        daily: dailySignups,
        weekly: weeklySignups,
        monthly: monthlySignups,
        yearly: yearlySignups,
      },
      conversionFunnel,
      subscriptionBreakdown,
      dailyActiveUsers,
      paymentAnalytics,
      renewalMetrics,
      freeAccessUsage,
      lifecycleFunnel,
      timeBasedMetrics,
      conversionRates,
      churnMetrics,
      playbookDropoff,
      recentUsers,
      nonConverterSegments,
      userSegments,
      highIntentUsers,
    };
  }

  /**
   * Aggregate signups by period (weekly, monthly, yearly)
   */
  private aggregateSignupsByPeriod(signups: UserSignups[], period: 'weekly' | 'monthly' | 'yearly'): UserSignups[] {
    const aggregated: Record<string, number> = {};

    signups.forEach(({ date, count }) => {
      const dateObj = new Date(date);
      let key: string;

      if (period === 'weekly') {
        // Get week number and year
        const weekNumber = this.getWeekNumber(dateObj);
        key = `${dateObj.getFullYear()}-W${weekNumber}`;
      } else if (period === 'monthly') {
        key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = String(dateObj.getFullYear());
      }

      aggregated[key] = (aggregated[key] || 0) + count;
    });

    return Object.entries(aggregated)
      .map(([periodKey, count]) => ({ date: periodKey, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get ISO week number from date
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}

// Export singleton instance
export const adminDashboardService = new AdminDashboardService();

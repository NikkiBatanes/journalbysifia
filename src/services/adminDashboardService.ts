/**
 * Admin Dashboard Service - Phase 3
 *
 * Comprehensive analytics queries and aggregation functions for the admin dashboard
 * Calls Supabase RPC functions to fetch aggregated analytics data
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
    ] = await Promise.all([
      this.getUserSignups(startDate, endDate),
      this.getConversionFunnel(startDate, endDate),
      this.getSubscriptionBreakdown(),
      this.getDailyActiveUsers(startDate, endDate),
      this.getPaymentAnalytics(startDate, endDate),
      this.getRenewalMetrics(),
      this.getFreeAccessUsage(),
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

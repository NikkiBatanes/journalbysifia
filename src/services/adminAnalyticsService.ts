/**
 * Admin Analytics Service - Phase 2
 *
 * Comprehensive event tracking for admin dashboard analytics
 * Tracks user signups, app opens, feature usage, payments, and conversions
 */

import { supabase } from './supabaseClient';
import { Platform } from 'react-native';

// Event types for analytics tracking
export type AnalyticsEventType =
  | 'user_signup'
  | 'app_open'
  | 'session_end'
  | 'feature_used'
  | 'trial_start'
  | 'trial_conversion'
  | 'subscription_upgrade'
  | 'subscription_downgrade'
  | 'subscription_cancel'
  | 'subscription_renewal'
  | 'payment_success'
  | 'payment_failed'
  | 'payment_pending'
  | 'payment_refunded';

export type EventCategory =
  | 'acquisition'
  | 'engagement'
  | 'conversion'
  | 'retention'
  | 'revenue';

export interface AnalyticsEvent {
  user_id: string;
  event_type: AnalyticsEventType;
  event_category?: EventCategory;
  properties?: Record<string, any>;
  session_id?: string;
  platform?: 'ios' | 'android' | 'web';
}

export interface SubscriptionAnalyticsEvent {
  user_id: string;
  event_type: 'signup' | 'trial_start' | 'trial_conversion' | 'upgrade' | 'downgrade' | 'cancel' | 'renewal';
  from_tier?: string;
  to_tier?: string;
  billing_cycle?: 'monthly' | 'annual';
  free_playbook_used?: boolean;
  platform?: 'ios' | 'android';
  amount?: number;
  currency?: string;
}

export interface PaymentAnalyticsEvent {
  user_id: string;
  transaction_id: string;
  original_transaction_id?: string;
  product_id: string;
  amount: number;
  currency?: string;
  status: 'success' | 'failed' | 'pending' | 'refunded';
  failure_reason?: string;
  platform: 'ios' | 'android';
  is_renewal?: boolean;
  renewal_date?: string;
  is_trial?: boolean;
  receipt_data?: any;
}

class AdminAnalyticsService {
  private sessionId: string;
  private sessionStartTime: number;
  private userId: string | null = null;
  private platform: 'ios' | 'android' | 'web' = 'web';

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.detectPlatform();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private detectPlatform() {
    if (Platform.OS === 'ios') {
      this.platform = 'ios';
    } else if (Platform.OS === 'android') {
      this.platform = 'android';
    } else {
      this.platform = 'web';
    }
  }

  /**
   * Set the current user ID for analytics tracking
   */
  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * Track user signup event
   */
  async trackSignup(userId: string, source: string = 'unknown') {
    try {
      // Track in analytics_events
      await supabase.from('analytics_events').insert({
        user_id: userId,
        event_type: 'user_signup',
        event_category: 'acquisition',
        properties: { source, platform: this.platform },
        session_id: this.sessionId,
        platform: this.platform,
      });

      // Track in subscription_analytics
      await supabase.from('subscription_analytics').insert({
        user_id: userId,
        event_type: 'signup',
        platform: this.platform,
      });

      console.log('✅ Analytics: User signup tracked', { userId, source });
    } catch (error) {
      console.error('❌ Analytics: Failed to track signup', error);
    }
  }

  /**
   * Track app open event
   */
  async trackAppOpen(userId: string) {
    try {
      this.userId = userId;
      this.sessionId = this.generateSessionId();
      this.sessionStartTime = Date.now();

      await supabase.from('analytics_events').insert({
        user_id: userId,
        event_type: 'app_open',
        event_category: 'engagement',
        properties: { platform: this.platform },
        session_id: this.sessionId,
        platform: this.platform,
      });

      // Update daily activity
      await this.updateDailyActivity(userId, 'app_open');

      console.log('✅ Analytics: App open tracked', { userId, sessionId: this.sessionId });
    } catch (error) {
      console.error('❌ Analytics: Failed to track app open', error);
    }
  }

  /**
   * Track session end
   */
  async trackSessionEnd(userId: string) {
    try {
      const sessionDuration = Date.now() - this.sessionStartTime;

      await supabase.from('analytics_events').insert({
        user_id: userId,
        event_type: 'session_end',
        event_category: 'engagement',
        properties: {
          session_duration_seconds: Math.floor(sessionDuration / 1000),
          platform: this.platform,
        },
        session_id: this.sessionId,
        platform: this.platform,
      });

      // Update daily activity with session duration
      await this.updateDailyActivity(userId, 'session_end', { session_duration_seconds: Math.floor(sessionDuration / 1000) });

      console.log('✅ Analytics: Session end tracked', { userId, duration: sessionDuration });
    } catch (error) {
      console.error('❌ Analytics: Failed to track session end', error);
    }
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(userId: string, feature: string, details: Record<string, any> = {}) {
    try {
      await supabase.from('analytics_events').insert({
        user_id: userId,
        event_type: 'feature_used',
        event_category: 'engagement',
        properties: {
          feature,
          ...details,
          platform: this.platform,
        },
        session_id: this.sessionId,
        platform: this.platform,
      });

      // Update daily activity for specific features
      await this.updateDailyActivity(userId, feature, details);

      console.log('✅ Analytics: Feature usage tracked', { userId, feature });
    } catch (error) {
      console.error('❌ Analytics: Failed to track feature usage', error);
    }
  }

  /**
   * Track trial activation
   */
  async trackTrialActivation(userId: string, chosenTier: string) {
    try {
      await supabase.from('subscription_analytics').insert({
        user_id: userId,
        event_type: 'trial_start',
        to_tier: chosenTier,
        platform: this.platform,
      });

      console.log('✅ Analytics: Trial activation tracked', { userId, chosenTier });
    } catch (error) {
      console.error('❌ Analytics: Failed to track trial activation', error);
    }
  }

  /**
   * Track subscription conversion (trial to paid)
   */
  async trackSubscriptionConversion(
    userId: string,
    fromTier: string,
    toTier: string,
    billingCycle: 'monthly' | 'annual',
    amount?: number
  ) {
    try {
      await supabase.from('subscription_analytics').insert({
        user_id: userId,
        event_type: 'trial_conversion',
        from_tier: fromTier,
        to_tier: toTier,
        billing_cycle: billingCycle,
        platform: this.platform,
        amount: amount,
        currency: 'USD',
      });

      console.log('✅ Analytics: Subscription conversion tracked', { userId, fromTier, toTier, billingCycle });
    } catch (error) {
      console.error('❌ Analytics: Failed to track subscription conversion', error);
    }
  }

  /**
   * Track subscription upgrade/downgrade
   */
  async trackSubscriptionChange(
    userId: string,
    eventType: 'upgrade' | 'downgrade',
    fromTier: string,
    toTier: string,
    billingCycle?: 'monthly' | 'annual',
    amount?: number
  ) {
    try {
      await supabase.from('subscription_analytics').insert({
        user_id: userId,
        event_type: eventType,
        from_tier: fromTier,
        to_tier: toTier,
        billing_cycle: billingCycle,
        platform: this.platform,
        amount: amount,
        currency: 'USD',
      });

      console.log('✅ Analytics: Subscription change tracked', { userId, eventType, fromTier, toTier });
    } catch (error) {
      console.error('❌ Analytics: Failed to track subscription change', error);
    }
  }

  /**
   * Track subscription cancellation
   */
  async trackSubscriptionCancellation(userId: string, currentTier: string) {
    try {
      await supabase.from('subscription_analytics').insert({
        user_id: userId,
        event_type: 'cancel',
        from_tier: currentTier,
        platform: this.platform,
      });

      console.log('✅ Analytics: Subscription cancellation tracked', { userId, currentTier });
    } catch (error) {
      console.error('❌ Analytics: Failed to track subscription cancellation', error);
    }
  }

  /**
   * Track subscription renewal
   */
  async trackSubscriptionRenewal(
    userId: string,
    tier: string,
    billingCycle: 'monthly' | 'annual',
    amount: number
  ) {
    try {
      await supabase.from('subscription_analytics').insert({
        user_id: userId,
        event_type: 'renewal',
        to_tier: tier,
        billing_cycle: billingCycle,
        platform: this.platform,
        amount: amount,
        currency: 'USD',
      });

      console.log('✅ Analytics: Subscription renewal tracked', { userId, tier, billingCycle });
    } catch (error) {
      console.error('❌ Analytics: Failed to track subscription renewal', error);
    }
  }

  /**
   * Track payment event
   */
  async trackPaymentEvent(event: PaymentAnalyticsEvent) {
    try {
      await supabase.from('payment_analytics').insert({
        user_id: event.user_id,
        transaction_id: event.transaction_id,
        original_transaction_id: event.original_transaction_id,
        product_id: event.product_id,
        amount: event.amount,
        currency: event.currency || 'USD',
        status: event.status,
        failure_reason: event.failure_reason,
        platform: event.platform,
        is_renewal: event.is_renewal || false,
        renewal_date: event.renewal_date ? new Date(event.renewal_date).toISOString() : null,
        is_trial: event.is_trial || false,
        receipt_data: event.receipt_data,
      });

      console.log('✅ Analytics: Payment event tracked', {
        userId: event.user_id,
        transactionId: event.transaction_id,
        status: event.status,
      });
    } catch (error) {
      console.error('❌ Analytics: Failed to track payment event', error);
    }
  }

  /**
   * Track free access usage (free playbook)
   */
  async trackFreeAccessUsage(
    userId: string,
    playbookUsed: boolean = false,
  ) {
    try {
      if (!playbookUsed) {return;}

      await supabase.from('subscription_analytics').insert({
        user_id: userId,
        event_type: 'signup', // Using signup as base event for free access tracking
        free_playbook_used: playbookUsed,
        platform: this.platform,
      });

      console.log('✅ Analytics: Free access usage tracked', { userId, playbookUsed });
    } catch (error) {
      console.error('❌ Analytics: Failed to track free access usage', error);
    }
  }

  /**
   * Update daily activity for a user
   */
  private async updateDailyActivity(
    userId: string,
    action: string,
    details: Record<string, any> = {}
  ) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Check if record exists for today
      const { data: existing } = await supabase
        .from('user_activity_daily')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      const updates: any = { updated_at: new Date().toISOString() };

      switch (action) {
        case 'app_open':
          updates.app_opens = (existing?.app_opens || 0) + 1;
          break;
        case 'session_end':
          updates.session_duration_seconds = (existing?.session_duration_seconds || 0) + (details.session_duration_seconds || 0);
          break;
        case 'playbook_view':
        case 'playbook':
          updates.playbook_views = (existing?.playbook_views || 0) + 1;
          break;
        case 'journal':
          updates.journal_opens = (existing?.journal_opens || 0) + 1;
          break;
        case 'todays_focus':
          updates.todays_focus_used = true;
          break;
        case 'todos':
          updates.todos_used = true;
          break;
        case 'timeblock':
          updates.timeblock_used = true;
          break;
        case 'prayer':
          updates.prayer_used = true;
          break;
        case 'gratitude':
          updates.gratitude_used = true;
          break;
        case 'reflection':
          updates.reflection_used = true;
          break;
        case 'looking_forward':
          updates.looking_forward_used = true;
          break;
        case 'today_win':
          updates.today_win_used = true;
          break;
        case 'playbook_created':
          updates.playbooks_created = (existing?.playbooks_created || 0) + 1;
          break;
      }

      if (existing) {
        await supabase
          .from('user_activity_daily')
          .update(updates)
          .eq('user_id', userId)
          .eq('date', today);
      } else {
        await supabase
          .from('user_activity_daily')
          .insert({
            user_id: userId,
            date: today,
            ...updates,
          });
      }
    } catch (error) {
      console.error('❌ Analytics: Failed to update daily activity', error);
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

// Export singleton instance
export const adminAnalyticsService = new AdminAnalyticsService();

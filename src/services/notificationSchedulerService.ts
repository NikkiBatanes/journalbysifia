import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { notificationManagementService, NotificationQueueItem } from './notificationManagementService';
import { notificationAnalyticsService } from './notificationAnalyticsService';
import { notificationBatchingService } from './notificationBatchingService';
import { AppState, AppStateStatus } from 'react-native';
import {
  SMART_NOTIFICATION_IMPORTANT_TYPES,
  SMART_NOTIFICATION_PREFERENCE_MAP,
} from './notifications/notificationTypes';

export interface ScheduleOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical';
  batchWithOthers?: boolean;
}

/**
 * Notification Scheduler Service
 * Handles intelligent scheduling and batching
 */
class NotificationSchedulerService {
  private readonly MAX_NOTIFICATIONS_PER_DAY = 20;
  private appState: AppStateStatus = 'active';

  constructor() {
    // Listen to app state changes for smart suppression
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    this.appState = nextAppState;
    Logger.info('App state changed', {
      component: 'notificationSchedulerService',
      state: nextAppState,
    });
  }

  /**
   * Check if app is currently active (smart suppression)
   */
  isAppActive(): boolean {
    return this.appState === 'active';
  }

  /**
   * Schedule a notification with smart batching
   */
  async scheduleNotification(
    notification: NotificationQueueItem,
    options: ScheduleOptions = {}
  ): Promise<boolean> {
    try {
      const {
        priority = 'normal',
        batchWithOthers = true,
      } = options;

      // Smart suppression: Only suppress low-priority notifications when app is active
      // EXCEPTION: Prayer requests, devotionals, affirmations, scripture, and critical notifications always send
      const importantTypes = [
        'prayer_request_reminder',
        'prayer_request_alert',
        'devotional_reminder',
        'daily_scripture',
        'affirmation_reminder',
        'morning_devotional',
        'evening_reflection',
        'gratitude_reminder',
        'midday_checkin',
        ...SMART_NOTIFICATION_IMPORTANT_TYPES,
      ];
      const isImportant = importantTypes.includes(notification.type) ||
                         notification.title?.toLowerCase().includes('pray for');

      // Only suppress if app is active AND it's a low-priority, non-important notification
      if (this.isAppActive() && priority === 'low' && !isImportant) {
        Logger.info('App is active - suppressing low-priority notification', {
          component: 'notificationSchedulerService',
          userId: notification.user_id,
          type: notification.type,
        });
        return false;
      }

      // Check notification fatigue - only block if critical AND user is fatigued
      const isFatigued = await notificationAnalyticsService.checkNotificationFatigue(notification.user_id);
      const isImportantForFatigue = importantTypes.includes(notification.type) ||
                                    notification.title?.toLowerCase().includes('pray for');

      // Only suppress low-priority notifications when fatigued
      if (isFatigued && priority === 'low' && !isImportantForFatigue) {
        Logger.info('User experiencing notification fatigue - skipping low-priority notification', {
          component: 'notificationSchedulerService',
          userId: notification.user_id,
          type: notification.type,
        });
        return false;
      }

      // Get user's notification preferences
      const preferences = await notificationManagementService.getNotificationPreferences(notification.user_id);

      // Check if user has this notification type enabled
      if (preferences && !this.isNotificationTypeEnabled(notification.type, preferences)) {
        Logger.info('Notification type disabled by user', {
          component: 'notificationSchedulerService',
          userId: notification.user_id,
          type: notification.type,
        });
        return false;
      }

      // Check daily limit (except for critical notifications)
      if (priority !== 'critical' && batchWithOthers) {
        const todayCount = await this.getTodayNotificationCount(notification.user_id);
        if (todayCount >= this.MAX_NOTIFICATIONS_PER_DAY) {
          Logger.info('Daily notification limit reached - batching or skipping', {
            component: 'notificationSchedulerService',
            userId: notification.user_id,
            count: todayCount,
          });

          // Try to batch with existing notifications
          const batched = await this.batchWithExisting(notification);
          return batched;
        }
      }

      // Use scheduled time or current time
      const scheduledFor = notification.scheduled_for ? new Date(notification.scheduled_for) : new Date();

      // Schedule the notification
      const finalNotification: NotificationQueueItem = {
        ...notification,
        scheduled_for: scheduledFor.toISOString(),
        priority,
      };

      const success = await notificationManagementService.scheduleNotification(finalNotification);

      if (success) {
        Logger.info('Notification scheduled successfully', {
          component: 'notificationSchedulerService',
          userId: notification.user_id,
          type: notification.type,
          scheduledFor: scheduledFor.toISOString(),
        });
      }

      return success;
    } catch (error) {
      Logger.error('Failed to schedule notification', error as Error, {
        component: 'notificationSchedulerService',
        type: notification.type,
      });
      return false;
    }
  }

  /**
   * Check if notification type is enabled in user preferences
   */
  private isNotificationTypeEnabled(type: string, preferences: any): boolean {
    const typeMap: Record<string, string> = {
      'prayer_reminder': 'prayer_reminders',
      'devotional_reminder': 'devotional_reminders',
      'journal_prompt': 'journal_prompts',
      'streak_alert': 'streak_alerts',
      'playbook_step': 'playbook_steps',
      'milestone_celebration': 'milestone_celebrations',
      'trial_notification': 'trial_notifications',
      'prayer_request_reminder': 'prayer_request_alerts',
      'prayer_request_alert': 'prayer_request_alerts', // Add mapping for immediate prayer alerts
      'trial_expiring': 'trial_notifications',
      'payment_failed': 'trial_notifications',
      'grace_period': 'trial_notifications',
      'renewal_reminder': 'trial_notifications',
      'payment_successful': 'trial_notifications',
      'subscription_cancelled': 'trial_notifications',
      ...SMART_NOTIFICATION_PREFERENCE_MAP,
    };

    const prefKey = typeMap[type];
    if (!prefKey) {
      // Unknown type - allow by default
      return true;
    }

    return preferences[prefKey] !== false;
  }

  /**
   * Get count of notifications sent/scheduled today
   */
  private async getTodayNotificationCount(userId: string): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('notification_queue')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('scheduled_for', today.toISOString())
        .in('status', ['pending', 'sent']);

      if (error) {
        Logger.error('Failed to get today notification count', error as Error, {
          component: 'notificationSchedulerService',
          userId,
        });
        return 0;
      }

      return count || 0;
    } catch (error) {
      Logger.error('Error getting today notification count', error as Error, {
        component: 'notificationSchedulerService',
        userId,
      });
      return 0;
    }
  }


  /**
   * Try to batch notification with existing ones
   */
  private async batchWithExisting(notification: NotificationQueueItem): Promise<boolean> {
    try {
      // Check if this notification type can be batched
      if (!notificationBatchingService.canBatch(notification.type)) {
        Logger.info('Notification type cannot be batched - skipping', {
          component: 'notificationSchedulerService',
          userId: notification.user_id,
          type: notification.type,
        });
        return false;
      }

      // First, add this notification to the queue
      await notificationManagementService.scheduleNotification(notification);

      // Then attempt to batch with similar notifications
      const batched = await notificationBatchingService.batchNotifications(
        notification.user_id,
        notification.type
      );

      if (batched) {
        Logger.info('Successfully batched notification', {
          component: 'notificationSchedulerService',
          userId: notification.user_id,
          type: notification.type,
        });
        return true;
      }

      Logger.info('Notification added to queue but not batched yet', {
        component: 'notificationSchedulerService',
        userId: notification.user_id,
        type: notification.type,
      });
      return true;
    } catch (error) {
      Logger.error('Error batching notification', error as Error, {
        component: 'notificationSchedulerService',
      });
      return false;
    }
  }


  /**
   * Schedule trial expiring notification
   */
  async scheduleTrialExpiringNotification(userId: string, expiryDate: Date): Promise<boolean> {
    // Schedule for 1 day before expiry
    const scheduledFor = new Date(expiryDate);
    scheduledFor.setDate(scheduledFor.getDate() - 1);
    scheduledFor.setHours(10, 0, 0, 0); // 10 AM

    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'trial_expiring',
      title: 'Your trial ends tomorrow',
      message: 'Keep your access going if you\'d like more room for playbooks, devotionals, and reflection.',
      data: {
        deep_link: 'sifia://subscription/upgrade',
        days_remaining: 1,
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'critical',
    };

    return await this.scheduleNotification(notification, {
      priority: 'critical',
      batchWithOthers: false,
    });
  }

  /**
   * Schedule payment failure notification
   */
  async schedulePaymentFailureNotification(userId: string, failureReason?: string): Promise<boolean> {
    const scheduledFor = new Date();
    scheduledFor.setHours(scheduledFor.getHours() + 1); // 1 hour from now

    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'payment_failed',
      title: 'Payment Failed 💳',
      message: failureReason
        ? `Payment failed: ${failureReason}. Please update your payment method.`
        : 'Your payment method failed. Please update it to continue your subscription.',
      data: {
        deep_link: 'sifia://subscription/manage',
        failure_reason: failureReason,
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'critical',
    };

    return await this.scheduleNotification(notification, {
      priority: 'critical',
      batchWithOthers: false,
    });
  }

  /**
   * Schedule grace period notification
   */
  async scheduleGracePeriodNotification(userId: string, gracePeriodEnds: Date): Promise<boolean> {
    const scheduledFor = new Date();
    scheduledFor.setHours(scheduledFor.getHours() + 2); // 2 hours from now

    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'grace_period',
      title: 'Grace Period Started ⚠️',
      message: `Your subscription is in grace period until ${gracePeriodEnds.toLocaleDateString()}. Update payment soon!`,
      data: {
        deep_link: 'sifia://subscription/manage',
        grace_period_ends: gracePeriodEnds.toISOString(),
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'high',
    };

    return await this.scheduleNotification(notification, {
      priority: 'high',
      batchWithOthers: false,
    });
  }


  /**
   * Schedule payment success notification
   */
  async schedulePaymentSuccessNotification(userId: string, newTier: string, amount: number): Promise<boolean> {
    // Deduplication: Check if a similar payment success notification was recently sent
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    const { data: recentNotifications, error: checkError } = await supabase
      .from('notification_queue')
      .select('id, type, data')
      .eq('user_id', userId)
      .eq('type', 'payment_successful')
      .gte('created_at', fiveMinutesAgo.toISOString())
      .in('status', ['pending', 'sent', 'processing']);

    if (!checkError && recentNotifications && recentNotifications.length > 0) {
      // Check if any recent notification is for the same tier
      const hasRecentTierNotification = recentNotifications.some((notif: any) => {
        return notif.data?.new_tier === newTier;
      });

      if (hasRecentTierNotification) {
        Logger.info('Payment success notification already sent recently for this tier - skipping duplicate', {
          component: 'notificationSchedulerService',
          userId,
          newTier,
          recentCount: recentNotifications.length,
        });
        return false; // Skip duplicate notification
      }
    }

    const scheduledFor = new Date();
    scheduledFor.setMinutes(scheduledFor.getMinutes() + 5); // 5 minutes from now

    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'payment_successful',
      title: `Welcome to ${newTier}! 🩵`,
      message: 'Your payment was successful. You now have more room for reflection, playbooks, and devotionals.',
      data: {
        deep_link: 'sifia://dashboard',
        new_tier: newTier,
        amount,
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'normal',
    };

    return await this.scheduleNotification(notification, {
      priority: 'normal',
      batchWithOthers: true,
    });
  }

  /**
   * Schedule subscription renewal / plan replenishment notification.
   * Sent after a successful billing cycle renewal so the user knows their room is restored.
   */
  async scheduleSubscriptionRenewalNotification(userId: string, tier: string): Promise<boolean> {
    const displayTier = (tier === 'seeker' || tier === 'siFia Seeker') ? 'siFia Free' : tier;
    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'subscription_renewed',
      title: 'Your room is restored',
      message: `Your ${displayTier} plan renewed. Fresh room for playbooks and devotionals — keep going.`,
      data: {
        deep_link: 'sifia://dashboard',
        tier,
      },
      scheduled_for: null as any, // deliver immediately
      priority: 'normal',
    };

    return await this.scheduleNotification(notification, {
      priority: 'normal',
      batchWithOthers: false,
    });
  }

  /**
   * Schedule subscription cancelled notification
   */
  async scheduleSubscriptionCancelledNotification(userId: string, endDate: Date): Promise<boolean> {
    const scheduledFor = new Date();
    scheduledFor.setMinutes(scheduledFor.getMinutes() + 5); // 5 minutes from now

    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'subscription_cancelled',
      title: 'Subscription Cancelled 📋',
      message: `We'll miss you! Your benefits continue until ${endDate.toLocaleDateString()}.`,
      data: {
        deep_link: 'sifia://subscription/reactivate',
        end_date: endDate.toISOString(),
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'normal',
    };

    return await this.scheduleNotification(notification, {
      priority: 'normal',
      batchWithOthers: true,
    });
  }
}

export const notificationSchedulerService = new NotificationSchedulerService();

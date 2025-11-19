import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { notificationManagementService, NotificationQueueItem } from './notificationManagementService';
import { notificationAnalyticsService } from './notificationAnalyticsService';
import { notificationBatchingService } from './notificationBatchingService';
import { AppState, AppStateStatus } from 'react-native';

export interface ScheduleOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical';
  batchWithOthers?: boolean;
}

/**
 * Notification Scheduler Service
 * Handles intelligent scheduling and batching
 */
class NotificationSchedulerService {
  private readonly MAX_NOTIFICATIONS_PER_DAY = 3;
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

      // Smart suppression: Don't schedule if app is active (user is already engaged)
      if (this.isAppActive() && priority !== 'critical') {
        Logger.info('App is active - suppressing notification', {
          component: 'notificationSchedulerService',
          userId: notification.user_id,
          type: notification.type,
        });
        return false;
      }

      // Check notification fatigue
      const isFatigued = await notificationAnalyticsService.checkNotificationFatigue(notification.user_id);
      if (isFatigued && priority !== 'critical') {
        Logger.info('User experiencing notification fatigue - skipping notification', {
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

      const { data, error } = await supabase
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

      return (data as any)?.count || 0;
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
   * Schedule daily devotional reminder
   */
  async scheduleDevotionalReminder(userId: string, preferredTime: string = '07:00'): Promise<boolean> {
    const [hour, min] = preferredTime.split(':').map(Number);
    const scheduledFor = new Date();
    scheduledFor.setHours(hour, min, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (scheduledFor < new Date()) {
      scheduledFor.setDate(scheduledFor.getDate() + 1);
    }

    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'devotional_reminder',
      title: 'Daily Devotional Ready 📖',
      message: 'Start your day with God\'s Word and wisdom.',
      data: {
        deep_link: 'sifia://devotionals/today',
        reminder_type: 'devotional',
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
   * Schedule daily prayer reminder
   */
  async schedulePrayerReminder(userId: string, preferredTime: string = '08:00'): Promise<boolean> {
    const [hour, min] = preferredTime.split(':').map(Number);
    const scheduledFor = new Date();
    scheduledFor.setHours(hour, min, 0, 0);

    if (scheduledFor < new Date()) {
      scheduledFor.setDate(scheduledFor.getDate() + 1);
    }

    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'prayer_reminder',
      title: 'Time to Connect with God 🙏',
      message: 'Take 5 minutes to bring your heart before the Lord.',
      data: {
        deep_link: 'sifia://journal/prayer',
        reminder_type: 'prayer',
        suggested_duration: '5-10 minutes',
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
      title: 'Your Trial Ends Tomorrow ⏰',
      message: 'Continue your spiritual growth journey - upgrade now to keep full access.',
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
}

export const notificationSchedulerService = new NotificationSchedulerService();

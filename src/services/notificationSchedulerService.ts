import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { notificationManagementService, NotificationQueueItem } from './notificationManagementService';
import { notificationAnalyticsService } from './notificationAnalyticsService';
import { AppState, AppStateStatus } from 'react-native';

export interface ScheduleOptions {
  respectQuietHours?: boolean;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  batchWithOthers?: boolean;
}

/**
 * Notification Scheduler Service
 * Handles intelligent scheduling, batching, and quiet hours enforcement
 */
class NotificationSchedulerService {
  private readonly MAX_NOTIFICATIONS_PER_DAY = 3;
  private readonly QUIET_HOURS_DEFAULT_START = '22:00';
  private readonly QUIET_HOURS_DEFAULT_END = '07:00';
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
   * Schedule a notification with smart batching and quiet hours
   */
  async scheduleNotification(
    notification: NotificationQueueItem,
    options: ScheduleOptions = {}
  ): Promise<boolean> {
    try {
      const {
        respectQuietHours = true,
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

      // Adjust scheduled time for quiet hours
      let scheduledFor = notification.scheduled_for ? new Date(notification.scheduled_for) : new Date();

      if (respectQuietHours && priority !== 'critical') {
        scheduledFor = await this.adjustForQuietHours(
          scheduledFor,
          notification.user_id,
          preferences
        );
      }

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
   * Adjust scheduled time to respect quiet hours
   */
  private async adjustForQuietHours(
    scheduledFor: Date,
    userId: string,
    preferences: any
  ): Promise<Date> {
    try {
      const quietStart = preferences?.quiet_hours_start || this.QUIET_HOURS_DEFAULT_START;
      const quietEnd = preferences?.quiet_hours_end || this.QUIET_HOURS_DEFAULT_END;

      const [startHour, startMin] = quietStart.split(':').map(Number);
      const [endHour, endMin] = quietEnd.split(':').map(Number);

      const scheduledHour = scheduledFor.getHours();
      const scheduledMin = scheduledFor.getMinutes();

      // Check if scheduled time falls within quiet hours
      const isInQuietHours = this.isTimeInQuietHours(
        scheduledHour,
        scheduledMin,
        startHour,
        startMin,
        endHour,
        endMin
      );

      if (isInQuietHours) {
        // Move to end of quiet hours
        const adjusted = new Date(scheduledFor);
        adjusted.setHours(endHour, endMin, 0, 0);

        // If that's in the past, move to tomorrow
        if (adjusted < new Date()) {
          adjusted.setDate(adjusted.getDate() + 1);
        }

        Logger.info('Adjusted notification time for quiet hours', {
          component: 'notificationSchedulerService',
          original: scheduledFor.toISOString(),
          adjusted: adjusted.toISOString(),
        });

        return adjusted;
      }

      return scheduledFor;
    } catch (error) {
      Logger.error('Error adjusting for quiet hours', error as Error, {
        component: 'notificationSchedulerService',
      });
      return scheduledFor;
    }
  }

  /**
   * Check if a time falls within quiet hours
   */
  private isTimeInQuietHours(
    hour: number,
    min: number,
    startHour: number,
    startMin: number,
    endHour: number,
    endMin: number
  ): boolean {
    const timeInMinutes = hour * 60 + min;
    const startInMinutes = startHour * 60 + startMin;
    const endInMinutes = endHour * 60 + endMin;

    if (startInMinutes < endInMinutes) {
      // Normal case: e.g., 22:00 - 23:59
      return timeInMinutes >= startInMinutes && timeInMinutes < endInMinutes;
    } else {
      // Overnight case: e.g., 22:00 - 07:00
      return timeInMinutes >= startInMinutes || timeInMinutes < endInMinutes;
    }
  }

  /**
   * Try to batch notification with existing ones
   */
  private async batchWithExisting(notification: NotificationQueueItem): Promise<boolean> {
    try {
      // For now, just skip the notification if we're over limit
      // In Phase 4, we'll implement smart batching (combining multiple notifications)
      Logger.info('Skipping notification due to daily limit', {
        component: 'notificationSchedulerService',
        userId: notification.user_id,
        type: notification.type,
      });
      return false;
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
      title: 'Today\'s Devotional is Ready 📖',
      message: 'Start your day with God\'s Word and wisdom.',
      data: {
        deep_link: 'sifia://devotionals/today',
        reminder_type: 'devotional',
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'normal',
    };

    return await this.scheduleNotification(notification, {
      respectQuietHours: true,
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
      respectQuietHours: true,
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
      respectQuietHours: false, // Critical notifications bypass quiet hours
      priority: 'critical',
      batchWithOthers: false,
    });
  }
}

export const notificationSchedulerService = new NotificationSchedulerService();

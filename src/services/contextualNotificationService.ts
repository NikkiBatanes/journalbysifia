import { Logger } from '../utils/ProductionLogger';
import { notificationSchedulerService } from './notificationSchedulerService';
import { NotificationQueueItem } from './notificationManagementService';
import { supabase } from './supabaseClient';

export interface UserActivity {
  user_id: string;
  last_prayer?: string;
  last_devotional?: string;
  last_journal_entry?: string;
  last_playbook_action?: string;
  updated_at?: string;
}

/**
 * Contextual Notification Service
 * Handles smart, behavior-based notifications
 */
class ContextualNotificationService {

  /**
   * Schedule pending prayer request reminder
   */
  async schedulePrayerRequestReminder(userId: string): Promise<boolean> {
    try {
      // Get unanswered prayer requests older than 24 hours
      const pendingRequests = await this.getPendingPrayerRequests(userId);

      if (pendingRequests.length === 0) {
        return false;
      }

      const [hour, min] = ['08', '00'].map(Number);
      const scheduledFor = new Date();
      scheduledFor.setHours(hour, min, 0, 0);

      if (scheduledFor < new Date()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }

      // Personalize message with name if available
      const firstRequest = pendingRequests[0];
      const personName = firstRequest?.name || firstRequest?.title;

      let title = 'Prayer Requests Awaiting 🙏🏼';
      let message = '';

      if (pendingRequests.length === 1 && personName) {
        title = `Pray for ${personName} Now 🙏🏼`;
        message = 'Lift them up in prayer today.';
      } else if (pendingRequests.length === 1) {
        title = 'Prayer Request Waiting 🙏🏼';
        message = 'Someone needs your prayers today.';
      } else if (personName) {
        title = `Pray for ${personName} and ${pendingRequests.length - 1} Others 🙏🏼`;
        message = `${pendingRequests.length} prayer requests need your attention.`;
      } else {
        title = 'Prayer Requests Awaiting 🙏🏼';
        message = `You have ${pendingRequests.length} prayer requests that need your prayers today.`;
      }

      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'prayer_request_reminder',
        title,
        message,
        data: {
          deep_link: 'sifia://journal/prayer?tab=requests',
          count: pendingRequests.length,
          oldest_request_id: firstRequest?.id,
          person_name: personName,
        },
        scheduled_for: scheduledFor.toISOString(),
        priority: 'normal',
      };

      const success = await notificationSchedulerService.scheduleNotification(notification, {

        priority: 'normal',
        batchWithOthers: true,
      });

      if (success) {
        Logger.info('Prayer request reminder scheduled', {
          component: 'contextualNotificationService',
          userId,
          count: pendingRequests.length,
        });
      }

      return success;
    } catch (error) {
      Logger.error('Failed to schedule prayer request reminder', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return false;
    }
  }


  /**
   * Schedule general journal reminder (if user hasn't journaled in 3 days)
   */
  async scheduleJournalReminder(userId: string): Promise<boolean> {
    try {
      const daysSinceLastJournal = await this.getDaysSinceLastJournal(userId);

      if (daysSinceLastJournal < 3) {
        return false;
      }

      const [hour, min] = ['18', '30'].map(Number);
      const scheduledFor = new Date();
      scheduledFor.setHours(hour, min, 0, 0);

      if (scheduledFor < new Date()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }

      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'journal_reminder',
        title: 'Time to Reflect ✍🏼',
        message: 'Your journal is waiting. What\'s on your heart today?',
        data: {
          deep_link: 'sifia://journal',
          days_since_last: daysSinceLastJournal,
        },
        scheduled_for: scheduledFor.toISOString(),
        priority: 'normal',
      };

      return await notificationSchedulerService.scheduleNotification(notification, {

        priority: 'normal',
        batchWithOthers: true,
      });
    } catch (error) {
      Logger.error('Failed to schedule journal reminder', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return false;
    }
  }


  /**
   * Schedule all daily notifications for a user
   * Call this once per day (e.g., via cron job)
   */
  async scheduleAllDailyNotifications(userId: string): Promise<void> {
    try {
      await Promise.all([
        this.schedulePrayerRequestReminder(userId),
        this.scheduleJournalReminder(userId),
      ]);

      Logger.info('All daily notifications scheduled', {
        component: 'contextualNotificationService',
        userId,
      });
    } catch (error) {
      Logger.error('Failed to schedule all daily notifications', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
    }
  }

  // ===== Helper Methods (Database Queries) =====

  private async getPendingPrayerRequests(userId: string): Promise<any[]> {
    try {
      // Get unanswered prayer requests older than 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('prayers')
        .select('*')
        .eq('user_id', userId)
        .eq('is_prayer_request', true)
        .eq('prayed', false)
        .lt('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: true });

      if (error) {
        Logger.error('Error fetching pending prayer requests', error as Error, {
          component: 'contextualNotificationService',
          userId,
        });
        return [];
      }

      return data || [];
    } catch (error) {
      Logger.error('Failed to get pending prayer requests', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return [];
    }
  }

  private async getDaysSinceLastJournal(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        Logger.error('Error checking last journal entry', error as Error, {
          component: 'contextualNotificationService',
          userId,
        });
        return 0;
      }

      if (!data || data.length === 0) {
        return 999; // No journal entries ever
      }

      const lastEntry = new Date(data[0].created_at);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - lastEntry.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays;
    } catch (error) {
      Logger.error('Failed to calculate days since last journal', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return 0;
    }
  }

}

export const contextualNotificationService = new ContextualNotificationService();

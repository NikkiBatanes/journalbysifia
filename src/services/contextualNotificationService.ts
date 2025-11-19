import { Logger } from '../utils/ProductionLogger';
import { notificationSchedulerService } from './notificationSchedulerService';
import { NotificationQueueItem } from './notificationManagementService';

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
   * Schedule daily devotional reminder
   */
  async scheduleDailyDevotionalReminder(
    userId: string,
    preferredTime: string = '07:00'
  ): Promise<boolean> {
    try {
      // Check if user has already completed today's devotional
      const hasCompletedToday = await this.hasCompletedDevotionalToday(userId);
      if (hasCompletedToday) {
        Logger.info('User already completed devotional today - skipping reminder', {
          component: 'contextualNotificationService',
          userId,
        });
        return false;
      }

      return await notificationSchedulerService.scheduleDevotionalReminder(userId, preferredTime);
    } catch (error) {
      Logger.error('Failed to schedule devotional reminder', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return false;
    }
  }

  /**
   * Schedule daily prayer reminder
   */
  async scheduleDailyPrayerReminder(
    userId: string,
    preferredTime: string = '08:00'
  ): Promise<boolean> {
    try {
      // Check if user has already prayed today
      const hasPrayedToday = await this.hasPrayedToday(userId);
      if (hasPrayedToday) {
        Logger.info('User already prayed today - skipping reminder', {
          component: 'contextualNotificationService',
          userId,
        });
        return false;
      }

      return await notificationSchedulerService.schedulePrayerReminder(userId, preferredTime);
    } catch (error) {
      Logger.error('Failed to schedule prayer reminder', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return false;
    }
  }

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

      const [hour, min] = ['09', '00'].map(Number);
      const scheduledFor = new Date();
      scheduledFor.setHours(hour, min, 0, 0);

      if (scheduledFor < new Date()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }

      // Personalize message with name if available
      const firstRequest = pendingRequests[0];
      const personName = firstRequest?.name || firstRequest?.title;

      let title = 'Prayer Requests Awaiting 🙏';
      let message = '';

      if (pendingRequests.length === 1 && personName) {
        title = `Pray for ${personName} Now 🙏`;
        message = 'Lift them up in prayer today.';
      } else if (pendingRequests.length === 1) {
        title = 'Prayer Request Waiting 🙏';
        message = 'Someone needs your prayers today.';
      } else if (personName) {
        title = `Pray for ${personName} and ${pendingRequests.length - 1} Others 🙏`;
        message = `${pendingRequests.length} prayer requests need your attention.`;
      } else {
        title = 'Prayer Requests Awaiting 🙏';
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
   * Schedule unanswered devotional reflection reminder
   */
  async scheduleDevotionalReflectionReminder(userId: string): Promise<boolean> {
    try {
      // Get devotionals completed but not reflected on (older than 24 hours)
      const unreflectedDevotionals = await this.getUnreflectedDevotionals(userId);

      if (unreflectedDevotionals.length === 0) {
        return false;
      }

      const devotional = unreflectedDevotionals[0]; // Most recent
      const [hour, min] = ['18', '00'].map(Number);
      const scheduledFor = new Date();
      scheduledFor.setHours(hour, min, 0, 0);

      if (scheduledFor < new Date()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }

      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'devotional_reflection',
        title: 'Complete Your Reflection ✍️',
        message: `You read "${devotional.title}" - take a moment to reflect on it.`,
        data: {
          deep_link: `sifia://devotionals/${devotional.id}/reflect`,
          devotional_id: devotional.id,
          title: devotional.title,
        },
        scheduled_for: scheduledFor.toISOString(),
        priority: 'normal',
      };

      const success = await notificationSchedulerService.scheduleNotification(notification, {
        
        priority: 'normal',
        batchWithOthers: true,
      });

      if (success) {
        Logger.info('Devotional reflection reminder scheduled', {
          component: 'contextualNotificationService',
          userId,
          devotionalId: devotional.id,
        });
      }

      return success;
    } catch (error) {
      Logger.error('Failed to schedule devotional reflection reminder', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return false;
    }
  }

  /**
   * Schedule gratitude reminder
   */
  async scheduleGratitudeReminder(userId: string): Promise<boolean> {
    try {
      // Check if user has logged gratitude today
      const hasGratitudeToday = await this.hasGratitudeToday(userId);
      if (hasGratitudeToday) {
        return false;
      }

      const [hour, min] = ['20', '00'].map(Number);
      const scheduledFor = new Date();
      scheduledFor.setHours(hour, min, 0, 0);

      if (scheduledFor < new Date()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }

      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'gratitude_reminder',
        title: 'What Are You Grateful For Today? 🌟',
        message: 'Take a moment to count your blessings.',
        data: {
          deep_link: 'sifia://journal/gratitude',
        },
        scheduled_for: scheduledFor.toISOString(),
        priority: 'normal',
      };

      return await notificationSchedulerService.scheduleNotification(notification, {
        
        priority: 'normal',
        batchWithOthers: true,
      });
    } catch (error) {
      Logger.error('Failed to schedule gratitude reminder', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return false;
    }
  }

  /**
   * Schedule today's wins reminder
   */
  async scheduleWinsReminder(userId: string): Promise<boolean> {
    try {
      // Check if user has logged wins today
      const hasWinsToday = await this.hasWinsToday(userId);
      if (hasWinsToday) {
        return false;
      }

      const [hour, min] = ['21', '00'].map(Number);
      const scheduledFor = new Date();
      scheduledFor.setHours(hour, min, 0, 0);

      if (scheduledFor < new Date()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }

      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'wins_reminder',
        title: 'Celebrate Today\'s Wins! 🏆',
        message: 'What victories - big or small - did you experience today?',
        data: {
          deep_link: 'sifia://journal/wins',
        },
        scheduled_for: scheduledFor.toISOString(),
        priority: 'normal',
      };

      return await notificationSchedulerService.scheduleNotification(notification, {
        
        priority: 'normal',
        batchWithOthers: true,
      });
    } catch (error) {
      Logger.error('Failed to schedule wins reminder', error as Error, {
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

      const [hour, min] = ['19', '00'].map(Number);
      const scheduledFor = new Date();
      scheduledFor.setHours(hour, min, 0, 0);

      if (scheduledFor < new Date()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }

      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'journal_reminder',
        title: 'Time to Reflect ✍️',
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
   * Schedule incomplete action steps reminder
   */
  async schedulePlaybookReminder(userId: string): Promise<boolean> {
    try {
      const incompletePlaybooks = await this.getIncompletePlaybooks(userId);

      if (incompletePlaybooks.length === 0) {
        return false;
      }

      const playbook = incompletePlaybooks[0]; // Most recent
      const [hour, min] = ['10', '00'].map(Number);
      const scheduledFor = new Date();
      scheduledFor.setHours(hour, min, 0, 0);

      if (scheduledFor < new Date()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }

      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'playbook_reminder',
        title: 'Continue Your Spiritual Journey 🎯',
        message: `You have ${playbook.incomplete_steps} action step(s) waiting in "${playbook.title}".`,
        data: {
          deep_link: `sifia://playbooks/${playbook.id}`,
          playbook_id: playbook.id,
          incomplete_steps: playbook.incomplete_steps,
        },
        scheduled_for: scheduledFor.toISOString(),
        priority: 'normal',
      };

      return await notificationSchedulerService.scheduleNotification(notification, {
        
        priority: 'normal',
        batchWithOthers: true,
      });
    } catch (error) {
      Logger.error('Failed to schedule playbook reminder', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return false;
    }
  }

  /**
   * Schedule daily scripture notification
   */
  async scheduleDailyScripture(userId: string): Promise<boolean> {
    try {
      const [hour, min] = ['06', '00'].map(Number);
      const scheduledFor = new Date();
      scheduledFor.setHours(hour, min, 0, 0);

      if (scheduledFor < new Date()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }

      // Get today's scripture (placeholder - implement actual scripture service)
      const scripture = await this.getTodaysScripture();

      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'daily_scripture',
        title: 'Today\'s Scripture 📜',
        message: `${scripture.reference}: ${scripture.preview}...`,
        data: {
          deep_link: 'sifia://dashboard/scripture',
          verse_reference: scripture.reference,
          verse_text: scripture.text,
        },
        scheduled_for: scheduledFor.toISOString(),
        priority: 'normal',
      };

      return await notificationSchedulerService.scheduleNotification(notification, {
        
        priority: 'normal',
        batchWithOthers: true,
      });
    } catch (error) {
      Logger.error('Failed to schedule daily scripture', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return false;
    }
  }

  /**
   * Schedule unread affirmations reminder
   */
  async scheduleAffirmationReminder(userId: string): Promise<boolean> {
    try {
      const unreadCount = await this.getUnreadAffirmationsCount(userId);

      if (unreadCount === 0) {
        return false;
      }

      const [hour, min] = ['09', '00'].map(Number);
      const scheduledFor = new Date();
      scheduledFor.setHours(hour, min, 0, 0);

      if (scheduledFor < new Date()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }

      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'affirmation_reminder',
        title: 'Speak Truth Over Your Life 💬',
        message: `You have ${unreadCount} affirmation(s) waiting to be declared.`,
        data: {
          deep_link: 'sifia://dashboard/affirmations',
          count: unreadCount,
        },
        scheduled_for: scheduledFor.toISOString(),
        priority: 'normal',
      };

      return await notificationSchedulerService.scheduleNotification(notification, {
        
        priority: 'normal',
        batchWithOthers: true,
      });
    } catch (error) {
      Logger.error('Failed to schedule affirmation reminder', error as Error, {
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
        this.scheduleDailyDevotionalReminder(userId),
        this.scheduleDailyPrayerReminder(userId),
        this.schedulePrayerRequestReminder(userId),
        this.scheduleDevotionalReflectionReminder(userId),
        this.scheduleGratitudeReminder(userId),
        this.scheduleWinsReminder(userId),
        this.scheduleJournalReminder(userId),
        this.schedulePlaybookReminder(userId),
        this.scheduleDailyScripture(userId),
        this.scheduleAffirmationReminder(userId),
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

  private async hasCompletedDevotionalToday(_userId: string): Promise<boolean> {
    // TODO: Implement actual check against devotionals table
    // For now, return false to allow scheduling
    return false;
  }

  private async hasPrayedToday(_userId: string): Promise<boolean> {
    // TODO: Implement actual check against prayer logs
    return false;
  }

  private async getPendingPrayerRequests(_userId: string): Promise<any[]> {
    // TODO: Implement actual query for unanswered prayer requests > 24 hours
    return [];
  }

  private async getUnreflectedDevotionals(_userId: string): Promise<any[]> {
    // TODO: Implement actual query for completed but unreflected devotionals
    return [];
  }

  private async hasGratitudeToday(_userId: string): Promise<boolean> {
    // TODO: Implement actual check against gratitude logs
    return false;
  }

  private async hasWinsToday(_userId: string): Promise<boolean> {
    // TODO: Implement actual check against wins logs
    return false;
  }

  private async getDaysSinceLastJournal(_userId: string): Promise<number> {
    // TODO: Implement actual check against journal entries
    return 0;
  }

  private async getIncompletePlaybooks(_userId: string): Promise<any[]> {
    // TODO: Implement actual query for playbooks with incomplete steps > 48 hours
    return [];
  }

  private async getTodaysScripture(): Promise<{ reference: string; text: string; preview: string }> {
    // TODO: Implement actual scripture service
    return {
      reference: 'Philippians 4:13',
      text: 'I can do all things through Christ who strengthens me.',
      preview: 'I can do all things through Christ...',
    };
  }

  private async getUnreadAffirmationsCount(_userId: string): Promise<number> {
    // TODO: Implement actual check against affirmations
    return 0;
  }
}

export const contextualNotificationService = new ContextualNotificationService();

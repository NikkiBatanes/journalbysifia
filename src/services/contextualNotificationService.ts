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

      // Check if user has devotionals available (subscription/limits)
      const hasDevotionalAccess = await this.hasDevotionalAccess(userId);
      if (!hasDevotionalAccess) {
        Logger.info('User does not have devotional access - skipping reminder', {
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
        title: 'Complete Your Reflection ✍🏼',
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

  private async hasCompletedDevotionalToday(userId: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('devotional_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .eq('completed', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        Logger.error('Error checking devotional completion', error as Error, {
          component: 'contextualNotificationService',
          userId,
        });
        return false;
      }

      return !!data;
    } catch (error) {
      Logger.error('Failed to check devotional completion', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return false;
    }
  }

  private async hasPrayedToday(userId: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('prayers')
        .select('*')
        .eq('user_id', userId)
        .eq('selected_date', today)
        .limit(1);

      if (error) {
        Logger.error('Error checking prayer completion', error as Error, {
          component: 'contextualNotificationService',
          userId,
        });
        return false;
      }

      return (data && data.length > 0) || false;
    } catch (error) {
      Logger.error('Failed to check prayer completion', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return false;
    }
  }

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

  private async getUnreflectedDevotionals(userId: string): Promise<any[]> {
    try {
      // Get devotionals completed today but without reflection
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('devotional_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .eq('completed', true)
        .is('reflection', null);

      if (error) {
        Logger.error('Error fetching unreflected devotionals', new Error(error.message || String(error)), {
          component: 'contextualNotificationService',
          userId,
          errorDetails: error,
        });
        return [];
      }

      return data || [];
    } catch (error) {
      Logger.error('Failed to get unreflected devotionals', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return [];
    }
  }

  private async hasGratitudeToday(userId: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('created_at', today)
        .ilike('content', '%gratitude%')
        .limit(1);

      if (error) {
        Logger.error('Error checking gratitude completion', error as Error, {
          component: 'contextualNotificationService',
          userId,
        });
        return false;
      }

      return (data && data.length > 0) || false;
    } catch (error) {
      Logger.error('Failed to check gratitude completion', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return false;
    }
  }

  private async hasWinsToday(userId: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('created_at', today)
        .ilike('content', '%win%')
        .limit(1);

      if (error) {
        Logger.error('Error checking wins completion', error as Error, {
          component: 'contextualNotificationService',
          userId,
        });
        return false;
      }

      return (data && data.length > 0) || false;
    } catch (error) {
      Logger.error('Failed to check wins completion', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return false;
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

  private async getIncompletePlaybooks(userId: string): Promise<any[]> {
    try {
      // Get playbooks with incomplete steps older than 48 hours
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('playbooks')
        .select(`
          *,
          action_steps!inner(
            id,
            completed,
            subtasks(
              id,
              completed
            )
          )
        `)
        .eq('user_id', userId)
        .lt('created_at', fortyEightHoursAgo)
        .eq('action_steps.completed', false);

      if (error) {
        Logger.error('Error fetching incomplete playbooks', new Error(error.message || String(error)), {
          component: 'contextualNotificationService',
          userId,
          errorDetails: error,
        });
        return [];
      }

      return data || [];
    } catch (error) {
      Logger.error('Failed to get incomplete playbooks', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return [];
    }
  }

  private async getTodaysScripture(): Promise<{ reference: string; text: string; preview: string }> {
    try {
      // Get today's scripture from affirmations table
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('affirmations')
        .select('reference, text')
        .eq('date', today)
        .single();

      if (error || !data) {
        // Fallback to default scripture
        return {
          reference: 'Philippians 4:13',
          text: 'I can do all things through Christ who strengthens me.',
          preview: 'I can do all things through Christ...',
        };
      }

      const text = data.text || 'I can do all things through Christ who strengthens me.';
      const reference = data.reference || 'Philippians 4:13';
      const preview = text.length > 50 ? text.substring(0, 47) + '...' : text;

      return { reference, text, preview };
    } catch (error) {
      Logger.error('Failed to get today\'s scripture', error as Error, {
        component: 'contextualNotificationService',
      });
      return {
        reference: 'Philippians 4:13',
        text: 'I can do all things through Christ who strengthens me.',
        preview: 'I can do all things through Christ...',
      };
    }
  }

  private async getUnreadAffirmationsCount(userId: string): Promise<number> {
    try {
      // Get count of affirmations not yet read by user
      const { data, error } = await supabase
        .from('affirmations')
        .select('id', { count: 'exact' })
        .not('read_by', 'cs', `[${userId}]`)
        .eq('active', true);

      if (error) {
        Logger.error('Error fetching unread affirmations count', error as Error, {
          component: 'contextualNotificationService',
          userId,
        });
        return 0;
      }

      return (data?.length) || 0;
    } catch (error) {
      Logger.error('Failed to get unread affirmations count', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return 0;
    }
  }

  /**
   * Check if user has access to devotionals (subscription/limits)
   */
  private async hasDevotionalAccess(userId: string): Promise<boolean> {
    try {
      // Import subscription service to check user's access
      const { subscriptionService } = await import('./subscriptionService');

      // Check if user can generate devotionals
      const canGenerate = await subscriptionService.canGenerate(userId, 'devotional');

      // If they can generate new ones, they definitely have access
      if (canGenerate.allowed) {
        return true;
      }

      // Even if they can't generate new ones, check if they have existing devotionals
      // that are incomplete or not marked as complete
      const hasExistingDevotionals = await this.hasExistingDevotionals(userId);

      return hasExistingDevotionals;
    } catch (error) {
      Logger.error('Failed to check devotional access', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });

      // Default to false if we can't check
      return false;
    }
  }

  /**
   * Check if user has existing devotionals that are incomplete or not marked as complete
   */
  private async hasExistingDevotionals(userId: string): Promise<boolean> {
    try {
      // Check for devotionals that are not marked as completed
      const { data, error } = await supabase
        .from('devotionals')
        .select('id')
        .eq('user_id', userId)
        .eq('completed', false)
        .limit(1);

      if (error) {
        Logger.error('Error checking existing devotionals', error as Error);
        return false;
      }

      // If user has any incomplete devotionals, they should get reminders
      return (data && data.length > 0);
    } catch (error) {
      Logger.error('Failed to check existing devotionals', error as Error, {
        component: 'contextualNotificationService',
        userId,
      });
      return false;
    }
  }
}

export const contextualNotificationService = new ContextualNotificationService();

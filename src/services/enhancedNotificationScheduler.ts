import { Logger } from '../utils/ProductionLogger';
import { notificationSchedulerService } from './notificationSchedulerService';
import { contextualNotificationService } from './contextualNotificationService';
import { NotificationQueueItem } from './notificationManagementService';
import { supabase } from './supabaseClient';

/**
 * Enhanced Notification Scheduler
 * Schedules multiple daily reminders to keep users engaged
 *
 * SCHEDULE:
 * - 6:00 AM: Morning scripture
 * - 9:00 AM: Morning affirmation reminder
 * - 12:00 PM: Midday check-in (playbook/prayer)
 * - 6:00 PM: Evening reflection reminder
 * - 8:00 PM: Gratitude/wins reminder
 *
 * PLUS context-based reminders for:
 * - Incomplete playbooks
 * - Unanswered prayer requests
 * - Streak maintenance
 * - Journal entries
 */
class EnhancedNotificationScheduler {
  /**
   * Schedule ALL daily notifications for a user
   * This should be called once per day (via cron or on app launch)
   */
  async scheduleAllDailyNotifications(userId: string): Promise<void> {
    try {
      Logger.info('📅 Scheduling comprehensive daily notifications', {
        component: 'EnhancedNotificationScheduler',
        userId,
      });

      // Get user's first name for personalization
      const userName = await this.getUserFirstName(userId);

      // Schedule fixed-time notifications
      await Promise.allSettled([
        // 6:00 AM - Morning scripture
        this.scheduleDailyScripture(userId, userName, '06:00'),

        // 9:00 AM - Morning affirmation
        this.scheduleMorningAffirmation(userId, userName, '09:00'),

        // 12:00 PM - Midday check-in
        this.scheduleMiddayCheckIn(userId, userName, '12:00'),

        // 6:00 PM - Evening reflection
        this.scheduleEveningReflection(userId, userName, '18:00'),

        // 8:00 PM - Gratitude reminder
        this.scheduleGratitudeReminder(userId, userName, '20:00'),

        // 4:00 PM - Upgrade reminder for free tier users (once per week)
        this.scheduleUpgradeReminder(userId, userName, '16:00'),
      ]);

      // Schedule context-based notifications
      await Promise.allSettled([
        // Prayer-related
        contextualNotificationService.schedulePrayerRequestReminder(userId),

        // Journal prompts
        contextualNotificationService.scheduleJournalReminder(userId),
      ]);

      Logger.info('✅ All daily notifications scheduled successfully', {
        component: 'EnhancedNotificationScheduler',
        userId,
      });
    } catch (error) {
      Logger.error('Failed to schedule all daily notifications', error as Error, {
        component: 'EnhancedNotificationScheduler',
        userId,
      });
    }
  }

  /**
   * Schedule daily scripture notification (6:05 AM user time)
   */
  private async scheduleDailyScripture(
    userId: string,
    userName: string,
    time: string
  ): Promise<void> {
    const [hour, min] = time.split(':').map(Number);
    const scheduledFor = await this.getScheduledTimeInUserTimezone(userId, hour, min + 5); // 5 minutes after the hour

    // Get today's scripture
    const scripture = await this.getTodaysScripture();

    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'daily_scripture',
      title: 'Today\'s Scripture 📖',
      message: `${scripture.reference}: "${scripture.preview}"`,
      data: {
        deep_link: 'sifia://dashboard/scripture',
        verse_reference: scripture.reference,
        verse_text: scripture.text,
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'high',
    };

    await notificationSchedulerService.scheduleNotification(notification, {
      priority: 'high',
      batchWithOthers: false,
    });
  }

  /**
   * Schedule morning affirmation (9:00 AM user time)
   */
  private async scheduleMorningAffirmation(
    userId: string,
    userName: string,
    time: string
  ): Promise<void> {
    const [hour, min] = time.split(':').map(Number);
    const scheduledFor = await this.getScheduledTimeInUserTimezone(userId, hour, min);

    // Get user's personalized affirmation
    const affirmation = await this.getUserAffirmation(userId, userName);

    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'affirmation_reminder',
      title: 'Speak Truth Over Your Life 💬',
      message: affirmation,
      data: {
        deep_link: 'sifia://dashboard/affirmations',
        affirmation_text: affirmation,
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'normal',
    };

    await notificationSchedulerService.scheduleNotification(notification, {
      priority: 'normal',
      batchWithOthers: false,
    });
  }

  /**
   * Schedule midday check-in (12:00 PM user time)
   */
  private async scheduleMiddayCheckIn(
    userId: string,
    userName: string,
    time: string
  ): Promise<void> {
    const [hour, min] = time.split(':').map(Number);
    const scheduledFor = await this.getScheduledTimeInUserTimezone(userId, hour, min);

    // Check what the user needs most
    const hasIncompletePlaybook = await this.hasIncompletePlaybook(userId);
    const hasPendingPrayers = await this.hasPendingPrayers(userId);

    let title = `${userName}, Take a Moment with God 🙏🏼`;
    let message = 'How\'s your day going? Check in with your spiritual journey.';
    let deepLink = 'sifia://dashboard';

    if (hasIncompletePlaybook) {
      title = `${userName}, Continue Your Journey 🎯`;
      message = 'You have action steps waiting. Take the next step in faith.';
      deepLink = 'sifia://playbooks';
    } else if (hasPendingPrayers) {
      title = `${userName}, Lift Someone Up 🙏🏼`;
      message = 'Prayer requests are waiting. Take a moment to intercede.';
      deepLink = 'sifia://journal/prayer?tab=requests';
    }

    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'midday_checkin',
      title,
      message,
      data: {
        deep_link: deepLink,
        reminder_type: 'midday_checkin',
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'normal',
    };

    await notificationSchedulerService.scheduleNotification(notification, {
      priority: 'normal',
      batchWithOthers: false,
    });
  }

  /**
   * Schedule evening reflection (6:00 PM user time)
   */
  private async scheduleEveningReflection(
    userId: string,
    userName: string,
    time: string
  ): Promise<void> {
    const [hour, min] = time.split(':').map(Number);
    const scheduledFor = await this.getScheduledTimeInUserTimezone(userId, hour, min);

    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'evening_reflection',
      title: `${userName}, Reflect on Your Day ✨`,
      message: 'How did God show up today? Take a moment to journal.',
      data: {
        deep_link: 'sifia://journal',
        reminder_type: 'evening_reflection',
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'normal',
    };

    await notificationSchedulerService.scheduleNotification(notification, {
      priority: 'normal',
      batchWithOthers: false,
    });
  }

  /**
   * Schedule gratitude reminder (8:00 PM user time)
   */
  private async scheduleGratitudeReminder(
    userId: string,
    userName: string,
    time: string
  ): Promise<void> {
    const [hour, min] = time.split(':').map(Number);
    const scheduledFor = await this.getScheduledTimeInUserTimezone(userId, hour, min);

    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'gratitude_reminder',
      title: `${userName}, Count Your Blessings 🌟`,
      message: 'What are you grateful for today? End your day with thanksgiving.',
      data: {
        deep_link: 'sifia://journal/gratitude',
        reminder_type: 'gratitude',
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'normal',
    };

    await notificationSchedulerService.scheduleNotification(notification, {
      priority: 'normal',
      batchWithOthers: false,
    });
  }

  /**
   * Schedule upgrade reminder for free tier users (7:00 PM user time, once per week)
   */
  private async scheduleUpgradeReminder(
    userId: string,
    userName: string,
    time: string
  ): Promise<void> {
    // Check if user is on free tier
    const isFreeTier = await this.isFreeTierUser(userId);
    if (!isFreeTier) {
      return; // Skip for premium users
    }

    // Check if upgrade notification was sent this week
    const wasSentThisWeek = await this.wasUpgradeNotificationSentThisWeek(userId);
    if (wasSentThisWeek) {
      return; // Skip if already sent this week
    }

    const [hour, min] = time.split(':').map(Number);
    const scheduledFor = await this.getScheduledTimeInUserTimezone(userId, hour, min);

    const notification: NotificationQueueItem = {
      user_id: userId,
      type: 'upgrade_reminder',
      title: `${userName}, A Thought for Your Journey 🙏`,
      message: 'There\'s more to explore in your walk with God. Premium offers additional tools for your spiritual growth.',
      data: {
        deep_link: 'sifia://subscription/upgrade',
        reminder_type: 'upgrade',
      },
      scheduled_for: scheduledFor.toISOString(),
      priority: 'low',
    };

    await notificationSchedulerService.scheduleNotification(notification, {
      priority: 'low',
      batchWithOthers: true,
    });
  }

  // ===== Helper Methods =====

  /**
   * Get scheduled time in user's timezone
   * Converts local time (e.g., 6:00 AM) to proper UTC time for the user
   */
  private async getScheduledTimeInUserTimezone(userId: string, hour: number, min: number): Promise<Date> {
    try {
      // Get user's timezone preference or default to UTC
      const { data: preferences } = await supabase
        .from('notification_preferences')
        .select('timezone')
        .eq('user_id', userId)
        .single();

      const userTimezone = preferences?.timezone || 'UTC';

      // Create time in user's timezone
      const now = new Date();
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));

      // Set the desired time in user's timezone
      userTime.setHours(hour, min, 0, 0);

      // If that time has already passed today, schedule for tomorrow
      if (userTime < now) {
        userTime.setDate(userTime.getDate() + 1);
      }

      return userTime;
    } catch (error) {
      // Fallback to UTC if timezone lookup fails
      const scheduledFor = new Date();
      scheduledFor.setHours(hour, min, 0, 0);

      if (scheduledFor < new Date()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }

      return scheduledFor;
    }
  }

  private async isFreeTierUser(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return true; // Default to free tier if can't determine
      }

      return data.subscription_tier === 'free' || !data.subscription_tier;
    } catch (error) {
      Logger.error('Failed to check user subscription tier', error as Error, {
        component: 'EnhancedNotificationScheduler',
        userId,
      });
      return true; // Default to free tier on error
    }
  }

  private async wasUpgradeNotificationSentThisWeek(userId: string): Promise<boolean> {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('notification_delivery_log')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'upgrade_reminder')
        .gte('created_at', oneWeekAgo.toISOString())
        .limit(1);

      if (error) {
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      Logger.error('Failed to check upgrade notification history', error as Error, {
        component: 'EnhancedNotificationScheduler',
        userId,
      });
      return false;
    }
  }

  private async getUserFirstName(userId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('first_name')
        .eq('id', userId)
        .single();

      if (error || !data?.first_name) {
        return 'Friend';
      }

      return data.first_name;
    } catch (error) {
      Logger.error('Failed to get user first name', error as Error, {
        component: 'EnhancedNotificationScheduler',
        userId,
      });
      return 'Friend';
    }
  }

  private async getTodaysScripture(): Promise<{
    reference: string;
    text: string;
    preview: string;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('daily_scriptures')
        .select('reference, text')
        .eq('date', today)
        .single();

      if (error || !data) {
        return {
          reference: 'Philippians 4:13',
          text: 'I can do all things through Christ who strengthens me.',
          preview: 'I can do all things through Christ...',
        };
      }

      const text = data.text || 'I can do all things through Christ who strengthens me.';
      const reference = data.reference || 'Philippians 4:13';
      const preview = text.length > 60 ? text.substring(0, 57) + '...' : text;

      return { reference, text, preview };
    } catch (error) {
      return {
        reference: 'Philippians 4:13',
        text: 'I can do all things through Christ who strengthens me.',
        preview: 'I can do all things through Christ...',
      };
    }
  }

  private async getUserAffirmation(userId: string, userName: string): Promise<string> {
    try {
      // Get user's most recent playbook affirmation
      const { data, error } = await supabase
        .from('playbooks')
        .select('affirmations')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data?.affirmations && Array.isArray(data.affirmations) && data.affirmations.length > 0) {
        // Return a random affirmation from their playbook
        const randomIndex = Math.floor(Math.random() * data.affirmations.length);
        return data.affirmations[randomIndex];
      }

      // Fallback affirmations
      const fallbackAffirmations = [
        `I am ${userName}, loved unconditionally by God.`,
        `I am ${userName}, and God gives me strength for each challenge.`,
        `I am ${userName}, and I can find peace in God's presence.`,
        `I am ${userName}, chosen and equipped by God for His purpose.`,
        `I am ${userName}, and God's grace is sufficient for me today.`,
      ];

      const randomIndex = Math.floor(Math.random() * fallbackAffirmations.length);
      return fallbackAffirmations[randomIndex];
    } catch (error) {
      return `I am ${userName}, loved unconditionally by God.`;
    }
  }

  private async hasIncompletePlaybook(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('playbooks')
        .select('id')
        .eq('user_id', userId)
        .eq('completed', false)
        .limit(1);

      return !error && data && data.length > 0;
    } catch (error) {
      return false;
    }
  }

  private async hasPendingPrayers(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('prayers')
        .select('id')
        .eq('user_id', userId)
        .eq('is_prayer_request', true)
        .eq('prayed', false)
        .limit(1);

      return !error && data && data.length > 0;
    } catch (error) {
      return false;
    }
  }
}

export const enhancedNotificationScheduler = new EnhancedNotificationScheduler();

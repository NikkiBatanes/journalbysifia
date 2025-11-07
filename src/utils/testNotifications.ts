import { pushNotificationService } from '../services/pushNotificationService';
import { Logger } from './ProductionLogger';

/**
 * Test Notification Triggers
 * Use these to test different notification types
 */

export const testNotifications = {
  /**
   * Send a test prayer streak alert
   */
  async sendPrayerStreakAlert() {
    try {
      Logger.info('Attempting to send test prayer streak alert');
      
      // Schedule for immediate delivery (1 second from now)
      const scheduledDate = new Date(Date.now() + 1000);
      
      await pushNotificationService.scheduleLocalNotification({
        title: "Don't Break Your 5-Day Prayer Streak! 🔥",
        message: "You're on fire! Keep your spiritual momentum going.",
        data: {
          deep_link: 'sifia://journal/prayer',
          type: 'streak_alert',
          streak_type: 'prayer',
          current_streak: 5,
        },
        priority: 'high',
      }, scheduledDate);
      
      Logger.info('Test prayer streak alert scheduled successfully');
      return true;
    } catch (error) {
      Logger.error('Failed to send test notification', error as Error);
      throw error;
    }
  },

  /**
   * Send a test devotional reminder
   */
  async sendDevotionalReminder() {
    try {
      await pushNotificationService.scheduleLocalNotification({
        title: "Today's Devotional is Ready 📖",
        message: "Start your day with God's Word and wisdom.",
        data: {
          deep_link: 'sifia://devotionals/today',
          type: 'devotional_reminder',
        },
      });
      Logger.info('Test devotional reminder sent');
    } catch (error) {
      Logger.error('Failed to send test notification', error as Error);
    }
  },

  /**
   * Send a test prayer request notification
   */
  async sendPrayerRequest() {
    try {
      await pushNotificationService.scheduleLocalNotification({
        title: "Pray for Sarah Now 🙏",
        message: "Lift them up in prayer today.",
        data: {
          deep_link: 'sifia://journal/prayer?tab=requests',
          type: 'prayer_request_reminder',
          person_name: 'Sarah',
        },
      });
      Logger.info('Test prayer request sent');
    } catch (error) {
      Logger.error('Failed to send test notification', error as Error);
    }
  },

  /**
   * Send a test milestone celebration
   */
  async sendMilestoneCelebration() {
    try {
      await pushNotificationService.scheduleLocalNotification({
        title: "You Reached 500 Faith Points! 🌟",
        message: "Your spiritual growth is inspiring. Keep going!",
        data: {
          deep_link: 'sifia://profile/stats',
          type: 'milestone_celebration',
          milestone_type: 'faith_points',
          value: 500,
        },
      });
      Logger.info('Test milestone celebration sent');
    } catch (error) {
      Logger.error('Failed to send test notification', error as Error);
    }
  },

  /**
   * Send a test level up notification
   */
  async sendLevelUp() {
    try {
      await pushNotificationService.scheduleLocalNotification({
        title: "Level Up! You're Now a Disciple! 🎉",
        message: "Your faith journey is progressing beautifully.",
        data: {
          deep_link: 'sifia://profile/stats',
          type: 'milestone_celebration',
          milestone_type: 'level_up',
          new_level: 3,
        },
      });
      Logger.info('Test level up sent');
    } catch (error) {
      Logger.error('Failed to send test notification', error as Error);
    }
  },

  /**
   * Send a test gratitude reminder
   */
  async sendGratitudeReminder() {
    try {
      await pushNotificationService.scheduleLocalNotification({
        title: "What Are You Grateful For Today? 🌟",
        message: "Take a moment to count your blessings.",
        data: {
          deep_link: 'sifia://journal/gratitude',
          type: 'gratitude_reminder',
        },
      });
      Logger.info('Test gratitude reminder sent');
    } catch (error) {
      Logger.error('Failed to send test notification', error as Error);
    }
  },

  /**
   * Send a test weekly summary
   */
  async sendWeeklySummary() {
    try {
      await pushNotificationService.scheduleLocalNotification({
        title: "Your Week in Faith 📊",
        message: "This week: 5 prayers, 4 devotionals, 3 journal entries. Active: 7-day prayer streak 🔥. +120 faith points earned!",
        data: {
          deep_link: 'sifia://profile/stats',
          type: 'weekly_summary',
        },
      });
      Logger.info('Test weekly summary sent');
    } catch (error) {
      Logger.error('Failed to send test notification', error as Error);
    }
  },

  /**
   * Send all test notifications (one every 2 seconds)
   */
  async sendAllTests() {
    const tests = [
      this.sendPrayerStreakAlert,
      this.sendDevotionalReminder,
      this.sendPrayerRequest,
      this.sendMilestoneCelebration,
      this.sendLevelUp,
      this.sendGratitudeReminder,
      this.sendWeeklySummary,
    ];

    for (let i = 0; i < tests.length; i++) {
      await tests[i]();
      if (i < tests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    Logger.info('All test notifications sent');
  },
};

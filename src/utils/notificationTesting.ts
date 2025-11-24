import { notificationDebugger } from './notificationDebugger';
import { DailyNotificationScheduler } from './dailyNotificationScheduler';
import { contextualNotificationService } from '../services/contextualNotificationService';
import { notificationSchedulerService } from '../services/notificationSchedulerService';
import { Logger } from './ProductionLogger';

/**
 * Notification Testing Utility
 * Helps test notifications without smart suppression
 */

export const notificationTesting = {
  /**
   * Force schedule daily notifications bypassing smart suppression
   */
  async forceScheduleDailyNotifications(userId: string): Promise<boolean> {
    try {
      Logger.info('🧪 Force scheduling daily notifications (bypassing suppression)', { userId });
      
      // Clear the daily scheduling flag to allow rescheduling
      await DailyNotificationScheduler.forceReschedule(userId);
      
      // Schedule critical priority notifications that bypass suppression
      const criticalNotifications = [
        {
          type: 'devotional_reminder',
          title: '📖 Daily Devotional',
          message: 'Time for your daily devotional!',
          priority: 'critical' as const,
        },
        {
          type: 'prayer_reminder', 
          title: '🙏 Daily Prayer',
          message: 'Time for your daily prayer!',
          priority: 'critical' as const,
        },
        {
          type: 'gratitude_reminder',
          title: '🌟 Gratitude Time',
          message: 'What are you grateful for today?',
          priority: 'critical' as const,
        }
      ];

      let successCount = 0;
      
      for (const notification of criticalNotifications) {
        try {
          // Schedule for 1 minute from now
          const scheduledFor = new Date(Date.now() + 60000);
          
          const result = await notificationSchedulerService.scheduleNotification({
            user_id: userId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            scheduled_for: scheduledFor.toISOString(),
            priority: notification.priority,
            data: {
              deep_link: `sifia://journal/${notification.type.includes('devotional') ? 'devotional' : 'prayer'}`,
              type: notification.type,
              forced: true,
            },
          }, { priority: 'critical', batchWithOthers: false });
          
          if (result) {
            successCount++;
            Logger.info(`✅ Scheduled ${notification.type} for ${scheduledFor.toLocaleTimeString()}`);
          }
        } catch (error) {
          Logger.error(`Failed to schedule ${notification.type}`, error as Error);
        }
      }
      
      Logger.info(`🧪 Force scheduled ${successCount}/${criticalNotifications.length} notifications`);
      return successCount > 0;
      
    } catch (error) {
      Logger.error('Failed to force schedule daily notifications', error as Error);
      return false;
    }
  },

  /**
   * Test immediate critical notification
   */
  async sendCriticalTestNotification(userId: string): Promise<boolean> {
    try {
      const result = await notificationSchedulerService.scheduleNotification({
        user_id: userId,
        type: 'critical_test',
        title: '🚨 Critical Test Notification',
        message: 'This should bypass smart suppression!',
        scheduled_for: new Date(Date.now() + 5000).toISOString(), // 5 seconds from now
        priority: 'critical',
        data: {
          deep_link: 'sifia://dashboard',
          type: 'critical_test',
          test: true,
        },
      }, { priority: 'critical', batchWithOthers: false });
      
      Logger.info('🚨 Critical test notification scheduled', { result });
      return result;
    } catch (error) {
      Logger.error('Failed to send critical test notification', error as Error);
      return false;
    }
  },

  /**
   * Check why notifications are being suppressed
   */
  async diagnoseSuppression(userId: string): Promise<{
    appActive: boolean;
    fatigue: boolean;
    preferences: any;
    recentCount: number;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    
    // Check app state
    const appActive = notificationSchedulerService.isAppActive();
    if (appActive) {
      recommendations.push('📱 Background the app to receive notifications');
      recommendations.push('⏰ Notifications are suppressed when app is active');
    }
    
    // Check notification fatigue
    const fatigue = await notificationSchedulerService.checkNotificationFatigue(userId);
    if (fatigue) {
      recommendations.push('🚫 You\'ve received too many notifications recently');
      recommendations.push('⏳ Wait a few hours for fatigue to reset');
    }
    
    // Check preferences
    const preferences = await notificationSchedulerService.getNotificationPreferences(userId);
    if (!preferences) {
      recommendations.push('⚙️ Complete notification setup in profile settings');
    }
    
    // Check recent count
    const recentCount = await notificationSchedulerService.getTodayNotificationCount(userId);
    if (recentCount >= 3) {
      recommendations.push('📊 Daily limit of 3 notifications reached');
    }
    
    return {
      appActive,
      fatigue,
      preferences,
      recentCount,
      recommendations,
    };
  },

  /**
   * Create a scheduled notification for specific time
   */
  async scheduleNotificationForTime(
    userId: string, 
    type: string, 
    title: string, 
    message: string,
    hour: number,
    minute: number
  ): Promise<boolean> {
    try {
      const scheduledFor = new Date();
      scheduledFor.setHours(hour, minute, 0, 0);
      
      // If time has passed, schedule for tomorrow
      if (scheduledFor <= new Date()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }
      
      const result = await notificationSchedulerService.scheduleNotification({
        user_id: userId,
        type,
        title,
        message,
        scheduled_for: scheduledFor.toISOString(),
        priority: 'critical', // Bypass suppression
        data: {
          deep_link: 'sifia://dashboard',
          type,
          scheduled: true,
        },
      }, { priority: 'critical', batchWithOthers: false });
      
      Logger.info(`⏰ Scheduled ${type} for ${scheduledFor.toLocaleString()}`, { result });
      return result;
      
    } catch (error) {
      Logger.error(`Failed to schedule ${type} for specific time`, error as Error);
      return false;
    }
  }
};

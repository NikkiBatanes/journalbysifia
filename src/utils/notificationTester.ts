import { Logger } from './ProductionLogger';
import { DailyNotificationScheduler } from './dailyNotificationScheduler';
import { pushNotificationService } from '../services/pushNotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildSmartNotificationCopy } from '../services/notifications/notificationCopyBank';
import { SMART_NOTIFICATION_TYPES } from '../services/notifications/notificationTypes';

/**
 * Notification Testing Utilities
 * Use these functions to test notification delivery
 */
export class NotificationTester {
  /**
   * Send every smart notification copy as staggered local notifications.
   * This is intentionally local-only so dev copy testing does not pollute the queue.
   */
  static async sendAllSmartNotificationCopyTests(): Promise<number> {
    try {
      Logger.info('🧪 Scheduling all smart notification copy tests', {
        component: 'NotificationTester',
        count: SMART_NOTIFICATION_TYPES.length,
      });

      const baseTime = Date.now() + 3000;

      await Promise.all(
        SMART_NOTIFICATION_TYPES.map(async (type, index) => {
          const copy = buildSmartNotificationCopy(type, {
            dayNumber: 2,
            totalDays: 7,
            actionText: 'take one step toward community today',
            verseReference: 'Psalm 23:1',
            verseText: 'The Lord is my shepherd; I shall not want.',
            questionText: 'Where do you need to trust God with the next step today?',
            wordToSpeak: 'I am not alone. God is leading me one faithful step at a time.',
            heartJournalTitle: 'Am I trusting God with my work or financial concerns?',
            personName: 'Lisa',
            remainingCount: 3,
            refreshDate: 'May 15',
          });

          await pushNotificationService.scheduleLocalNotification({
            title: copy.title,
            message: copy.message,
            data: {
              deep_link: 'sifia://dashboard',
              test: true,
              notification_type: type,
            },
            priority: index < 5 ? 'high' : 'normal',
          }, new Date(baseTime + index * 2500));
        })
      );

      Logger.info('✅ All smart notification copy tests scheduled', {
        component: 'NotificationTester',
        count: SMART_NOTIFICATION_TYPES.length,
      });

      return SMART_NOTIFICATION_TYPES.length;
    } catch (error) {
      Logger.error('Failed to schedule all smart notification copy tests', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Send a test notification immediately
   */
  static async sendTestNotification(userId: string, userName: string = 'Friend'): Promise<void> {
    try {
      Logger.info('🧪 Sending test notification', {
        component: 'NotificationTester',
        userId,
      });

      await pushNotificationService.scheduleLocalNotification({
        title: `Test Notification for ${userName}! 🔔`,
        message: 'If you see this, notifications are working! Tap to open siFia.',
        data: {
          deep_link: 'sifia://dashboard',
          test: true,
        },
        priority: 'high',
      }, new Date(Date.now() + 3000)); // 3 seconds from now

      Logger.info('✅ Test notification scheduled', {
        component: 'NotificationTester',
      });
    } catch (error) {
      Logger.error('Failed to send test notification', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Force schedule all notifications for a user (bypass time checks)
   */
  static async forceScheduleAllNotifications(userId: string): Promise<void> {
    try {
      Logger.info('🔄 Force scheduling all notifications', {
        component: 'NotificationTester',
        userId,
      });

      // Clear last scheduled timestamp to allow re-scheduling
      await AsyncStorage.removeItem('notifications:lastScheduled');

      // Schedule all notifications
      await DailyNotificationScheduler.forceReschedule(userId);

      Logger.info('✅ All notifications force scheduled', {
        component: 'NotificationTester',
      });
    } catch (error) {
      Logger.error('Failed to force schedule notifications', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Check notification queue for a user
   */
  static async checkNotificationQueue(userId: string): Promise<any[]> {
    try {
      Logger.info('📋 Checking notification queue', {
        component: 'NotificationTester',
        userId,
      });

      const { supabase } = await import('../services/supabaseClient');

      const { data, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', userId)
        .order('scheduled_for', { ascending: true });

      if (error) {
        throw error;
      }

      Logger.info(`Found ${data?.length || 0} notifications in queue`, {
        component: 'NotificationTester',
        count: data?.length || 0,
      });

      return data || [];
    } catch (error) {
      Logger.error('Failed to check notification queue', error as Error, {
        component: 'NotificationTester',
      });
      return [];
    }
  }

  /**
   * Get notification delivery stats
   */
  static async getDeliveryStats(userId: string): Promise<any> {
    try {
      const { supabase } = await import('../services/supabaseClient');

      const { data, error } = await supabase
        .from('notification_queue')
        .select('status')
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      const stats = {
        total: data?.length || 0,
        pending: data?.filter(n => n.status === 'pending').length || 0,
        sent: data?.filter(n => n.status === 'sent').length || 0,
        failed: data?.filter(n => n.status === 'failed').length || 0,
      };

      Logger.info('📊 Notification delivery stats', {
        component: 'NotificationTester',
        stats,
      });

      return stats;
    } catch (error) {
      Logger.error('Failed to get delivery stats', error as Error, {
        component: 'NotificationTester',
      });
      return { total: 0, pending: 0, sent: 0, failed: 0 };
    }
  }

  /**
   * Clear all pending notifications for a user
   */
  static async clearPendingNotifications(userId: string): Promise<void> {
    try {
      Logger.info('🗑️ Clearing pending notifications', {
        component: 'NotificationTester',
        userId,
      });

      const { supabase } = await import('../services/supabaseClient');

      const { error } = await supabase
        .from('notification_queue')
        .delete()
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (error) {
        throw error;
      }

      Logger.info('✅ Pending notifications cleared', {
        component: 'NotificationTester',
      });
    } catch (error) {
      Logger.error('Failed to clear pending notifications', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Test notification permissions
   */
  static async checkPermissions(): Promise<any> {
    try {
      const permissions = await pushNotificationService.checkPermissions();

      Logger.info('🔐 Notification permissions', {
        component: 'NotificationTester',
        permissions,
      });

      return permissions;
    } catch (error) {
      Logger.error('Failed to check permissions', error as Error, {
        component: 'NotificationTester',
      });
      return null;
    }
  }

  /**
   * Get device token status
   */
  static async checkDeviceToken(): Promise<string | null> {
    try {
      const token = await pushNotificationService.getStoredToken();

      if (token) {
        Logger.info('📱 Device token found', {
          component: 'NotificationTester',
          tokenPreview: token.substring(0, 20) + '...',
        });
      } else {
        Logger.warn('⚠️ No device token found', {
          component: 'NotificationTester',
        });
      }

      return token;
    } catch (error) {
      Logger.error('Failed to check device token', error as Error, {
        component: 'NotificationTester',
      });
      return null;
    }
  }

  /**
   * Run full notification diagnostic
   */
  static async runDiagnostic(userId: string): Promise<any> {
    try {
      Logger.info('🔍 Running notification diagnostic', {
        component: 'NotificationTester',
        userId,
      });

      const results = {
        permissions: await this.checkPermissions(),
        deviceToken: await this.checkDeviceToken(),
        queueStats: await this.getDeliveryStats(userId),
        pendingNotifications: await this.checkNotificationQueue(userId),
      };

      Logger.info('✅ Diagnostic complete', {
        component: 'NotificationTester',
        results,
      });

      return results;
    } catch (error) {
      Logger.error('Diagnostic failed', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }
}

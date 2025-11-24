import { pushNotificationService } from '../services/pushNotificationService';
import { Logger } from './ProductionLogger';

/**
 * Direct notification testing - bypasses all scheduling logic
 */

export const directNotificationTest = {
  /**
   * Send immediate notification directly through push service
   * This bypasses scheduling, suppression, fatigue, everything
   */
  async sendImmediateTest(userId: string): Promise<boolean> {
    try {
      Logger.info('🚨 Sending DIRECT immediate test notification', { userId });
      
      // Schedule local notification directly (bypasses all backend logic)
      await pushNotificationService.scheduleLocalNotification({
        title: '🚨 DIRECT TEST',
        message: 'This bypasses ALL scheduling logic!',
        badge: 1,
        sound: 'default',
        data: {
          deep_link: 'sifia://dashboard',
          type: 'direct_test',
          bypass: true,
        },
      }, new Date(Date.now() + 2000)); // 2 seconds from now
      
      Logger.info('✅ Direct test notification scheduled successfully');
      return true;
      
    } catch (error) {
      Logger.error('❌ Failed to send direct test notification', error as Error);
      return false;
    }
  },

  /**
   * Test immediate notification with current time
   */
  async sendNowTest(userId: string): Promise<boolean> {
    try {
      Logger.info('⚡ Sending NOW test notification', { userId });
      
      // Schedule for right now
      await pushNotificationService.scheduleLocalNotification({
        title: '⚡ NOW TEST',
        message: 'This should appear immediately!',
        badge: 1,
        sound: 'default',
        data: {
          deep_link: 'sifia://dashboard',
          type: 'now_test',
          immediate: true,
        },
      }); // No date parameter = immediately
      
      Logger.info('✅ Now test notification scheduled successfully');
      return true;
      
    } catch (error) {
      Logger.error('❌ Failed to send now test notification', error as Error);
      return false;
    }
  },

  /**
   * Test basic notification without any data
   */
  async sendBasicTest(userId: string): Promise<boolean> {
    try {
      Logger.info('📱 Sending basic test notification', { userId });
      
      // Simplest possible notification
      await pushNotificationService.scheduleLocalNotification({
        title: 'Basic Test',
        message: 'Minimal notification test',
      });
      
      Logger.info('✅ Basic test notification scheduled successfully');
      return true;
      
    } catch (error) {
      Logger.error('❌ Failed to send basic test notification', error as Error);
      return false;
    }
  },

  /**
   * Check if push notification service is working
   */
  async testPushService(): Promise<{
    available: boolean;
    permissions: any;
    deviceToken: string | null;
    error?: string;
  }> {
    try {
      Logger.info('🔍 Testing push notification service');
      
      // Check permissions
      const permissions = await pushNotificationService.checkPermissions();
      
      // Check device token
      const deviceToken = await pushNotificationService.getStoredToken();
      
      return {
        available: true,
        permissions,
        deviceToken,
      };
      
    } catch (error) {
      Logger.error('❌ Push notification service test failed', error as Error);
      return {
        available: false,
        permissions: null,
        deviceToken: null,
        error: (error as Error).message,
      };
    }
  }
};

import { supabase } from '../services/supabaseClient';
import { notificationSchedulerService } from '../services/notificationSchedulerService';
import { notificationDeliveryService } from '../services/notificationDeliveryService';
import { Logger } from '../utils/ProductionLogger';

/**
 * Comprehensive Notification Test Utility
 * Tests the entire notification pipeline end-to-end
 */

export const comprehensiveNotificationTest = {
  /**
   * Test the complete notification pipeline
   */
  async testCompletePipeline(userId: string): Promise<{
    success: boolean;
    steps: string[];
    results: any;
    error?: string;
  }> {
    const steps: string[] = [];
    const results: any = {};

    try {
      Logger.info('🧪 Starting comprehensive notification pipeline test', { userId });
      steps.push('📍 Starting comprehensive notification test...');

      // Step 1: Check current queue status
      steps.push('🔍 Step 1: Checking current queue status...');
      const beforeStats = await notificationDeliveryService.getDeliveryStats();
      results.beforeQueue = beforeStats;
      steps.push(`✅ Queue status: Pending=${beforeStats.pending}, Processing=${beforeStats.processing}, Sent=${beforeStats.sent}`);

      // Step 2: Create a test notification directly
      steps.push('📝 Step 2: Creating test notification...');
      const testNotification = {
        user_id: userId,
        type: 'comprehensive_test',
        title: '🧪 Comprehensive Test',
        message: 'This is a comprehensive pipeline test notification',
        scheduled_for: new Date(Date.now() + 2000).toISOString(), // 2 seconds from now
        priority: 'high',
        data: {
          deep_link: 'sifia://dashboard',
          type: 'comprehensive_test',
          test: true,
          timestamp: new Date().toISOString(),
        },
      };

      const scheduleResult = await notificationSchedulerService.scheduleNotification(testNotification, {
        priority: 'high',
        batchWithOthers: false,
      });

      if (!scheduleResult) {
        steps.push('❌ Failed to schedule test notification');
        return {
          success: false,
          steps,
          results,
          error: 'Failed to schedule test notification',
        };
      }

      steps.push('✅ Test notification scheduled successfully');
      results.scheduleResult = scheduleResult;

      // Step 3: Wait a moment for scheduling
      steps.push('⏳ Step 3: Waiting for scheduling to complete...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Check queue after scheduling
      steps.push('🔍 Step 4: Checking queue after scheduling...');
      const afterScheduleStats = await notificationDeliveryService.getDeliveryStats();
      results.afterScheduleQueue = afterScheduleStats;
      
      if (afterScheduleStats.pending > beforeStats.pending) {
        steps.push(`✅ Queue updated: Pending increased from ${beforeStats.pending} to ${afterScheduleStats.pending}`);
      } else {
        steps.push(`⚠️ Queue unchanged: Pending still ${afterScheduleStats.pending}`);
      }

      // Step 5: Manually trigger delivery service
      steps.push('🚀 Step 5: Manually triggering delivery service...');
      await notificationDeliveryService.processPendingNotifications();
      steps.push('✅ Delivery service processed');

      // Step 6: Wait for processing
      steps.push('⏳ Step 6: Waiting for processing to complete...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 7: Check final queue status
      steps.push('🔍 Step 7: Checking final queue status...');
      const finalStats = await notificationDeliveryService.getDeliveryStats();
      results.finalQueue = finalStats;
      
      if (finalStats.sent > beforeStats.sent) {
        steps.push(`✅ Success: Sent increased from ${beforeStats.sent} to ${finalStats.sent}`);
      } else if (finalStats.failed > beforeStats.failed) {
        steps.push(`❌ Failed: Failed increased from ${beforeStats.failed} to ${finalStats.failed}`);
      } else {
        steps.push(`⚠️ No change: Sent=${finalStats.sent}, Failed=${finalStats.failed}`);
      }

      // Step 8: Check database directly
      steps.push('🔍 Step 8: Checking database directly...');
      const { data: dbNotifications, error: dbError } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'comprehensive_test')
        .order('created_at', { ascending: false })
        .limit(5);

      if (dbError) {
        steps.push(`❌ Database error: ${dbError.message}`);
      } else {
        results.databaseNotifications = dbNotifications;
        steps.push(`✅ Found ${dbNotifications?.length || 0} test notifications in database`);
        
        if (dbNotifications && dbNotifications.length > 0) {
          const latest = dbNotifications[0];
          steps.push(`📊 Latest notification: Status=${latest.status}, Created=${latest.created_at}, Scheduled=${latest.scheduled_for}`);
        }
      }

      // Step 9: Summary
      const delivered = finalStats.sent > beforeStats.sent;
      const queued = afterScheduleStats.pending > beforeStats.pending;
      
      if (delivered) {
        steps.push('🎉 SUCCESS: Notification was delivered!');
      } else if (queued) {
        steps.push('⚠️ PARTIAL: Notification was queued but not delivered');
      } else {
        steps.push('❌ FAILED: Notification was not queued or delivered');
      }

      return {
        success: delivered || queued,
        steps,
        results,
      };

    } catch (error) {
      Logger.error('Comprehensive notification test failed', error as Error, { userId });
      steps.push(`❌ Test failed: ${(error as Error).message}`);
      
      return {
        success: false,
        steps,
        results,
        error: (error as Error).message,
      };
    }
  },

  /**
   * Test immediate local notification (bypasses queue)
   */
  async testImmediateNotification(): Promise<boolean> {
    try {
      Logger.info('🧪 Testing immediate local notification');
      
      // This uses the direct notification test that bypasses the queue
      const { directNotificationTest } = await import('./directNotificationTest');
      
      const result = await directNotificationTest.sendImmediateTest('test-user');
      
      Logger.info('Immediate notification test result', { result });
      return result;
      
    } catch (error) {
      Logger.error('Immediate notification test failed', error as Error);
      return false;
    }
  },

  /**
   * Get detailed queue analysis
   */
  async getQueueAnalysis(userId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    recent: any[];
  }> {
    try {
      // Get all notifications for user
      const { data: notifications, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !notifications) {
        return {
          total: 0,
          byStatus: {},
          byType: {},
          recent: [],
        };
      }

      // Analyze by status
      const byStatus: Record<string, number> = {};
      const byType: Record<string, number> = {};

      notifications.forEach(notification => {
        byStatus[notification.status] = (byStatus[notification.status] || 0) + 1;
        byType[notification.type] = (byType[notification.type] || 0) + 1;
      });

      return {
        total: notifications.length,
        byStatus,
        byType,
        recent: notifications.slice(0, 10),
      };

    } catch (error) {
      Logger.error('Queue analysis failed', error as Error);
      return {
        total: 0,
        byStatus: {},
        byType: {},
        recent: [],
      };
    }
  }
};

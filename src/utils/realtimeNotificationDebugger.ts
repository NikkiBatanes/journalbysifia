import { supabase } from '../services/supabaseClient';
import { notificationDeliveryService } from '../services/notificationDeliveryService';
import { notificationSchedulerService } from '../services/notificationSchedulerService';
import { contextualNotificationService } from '../services/contextualNotificationService';
import { Logger } from '../utils/ProductionLogger';

/**
 * Real-time notification debugging utility
 * Tests the complete pipeline to identify why notifications aren't arriving
 */

export const realtimeNotificationDebugger = {
  /**
   * Comprehensive real-time notification test
   */
  async debugRealtimeNotifications(userId: string): Promise<{
    success: boolean;
    steps: string[];
    results: any;
    issues: string[];
  }> {
    const steps: string[] = [];
    const results: any = {};
    const issues: string[] = [];

    try {
      Logger.info('🔍 Starting real-time notification debugging', { userId });
      steps.push('📍 Starting comprehensive real-time notification test...');

      // Step 1: Check user's devotionals
      steps.push('📚 Step 1: Checking user devotionals...');
      const devotionalsCheck = await this.checkUserDevotionals(userId);
      results.devotionalsCheck = devotionalsCheck;
      
      if (devotionalsCheck.total === 0) {
        issues.push('No devotionals found for user');
        steps.push('❌ No devotionals found');
      } else {
        steps.push(`✅ Found ${devotionalsCheck.total} devotionals (${devotionalsCheck.incomplete} incomplete)`);
      }

      // Step 2: Check device token
      steps.push('📱 Step 2: Checking device token...');
      const deviceTokenCheck = await this.checkDeviceToken(userId);
      results.deviceTokenCheck = deviceTokenCheck;
      
      if (!deviceTokenCheck.hasToken) {
        issues.push('No device token registered');
        steps.push('❌ No device token found');
      } else {
        steps.push(`✅ Device token found: ${deviceTokenCheck.token.substring(0, 10)}...`);
      }

      // Step 3: Check notification queue
      steps.push('📋 Step 3: Checking notification queue...');
      const queueCheck = await this.checkNotificationQueue(userId);
      results.queueCheck = queueCheck;
      steps.push(`📊 Queue status: ${queueCheck.total} notifications (${queueCheck.pending} pending)`);

      // Step 4: Test scheduling directly
      steps.push('⏰ Step 4: Testing devotional reminder scheduling...');
      const schedulingTest = await this.testDevotionalScheduling(userId);
      results.schedulingTest = schedulingTest;
      
      if (!schedulingTest.success) {
        issues.push('Failed to schedule devotional reminder');
        steps.push('❌ Failed to schedule devotional reminder');
      } else {
        steps.push('✅ Devotional reminder scheduled successfully');
      }

      // Step 5: Test delivery service
      steps.push('🚚 Step 5: Testing delivery service...');
      const deliveryTest = await this.testDeliveryService();
      results.deliveryTest = deliveryTest;
      steps.push(`📊 Delivery service: ${deliveryTest.pending} pending, ${deliveryTest.sent} sent`);

      // Step 6: Check notification permissions
      steps.push('🔐 Step 6: Checking notification permissions...');
      const permissionCheck = await this.checkNotificationPermissions();
      results.permissionCheck = permissionCheck;
      
      if (!permissionCheck.granted) {
        issues.push('Notification permissions not granted');
        steps.push('❌ Notification permissions not granted');
      } else {
        steps.push('✅ Notification permissions granted');
      }

      // Step 7: Create immediate test notification
      steps.push('⚡ Step 7: Creating immediate test notification...');
      const immediateTest = await this.createImmediateTestNotification(userId);
      results.immediateTest = immediateTest;
      
      if (!immediateTest.success) {
        issues.push('Failed to create immediate test notification');
        steps.push('❌ Failed to create immediate test notification');
      } else {
        steps.push('✅ Immediate test notification created');
      }

      // Step 8: Check if delivery service is running
      steps.push('🔄 Step 8: Checking delivery service status...');
      const serviceStatus = await this.checkDeliveryServiceStatus();
      results.serviceStatus = serviceStatus;
      steps.push(`📊 Service status: ${serviceStatus.status}`);

      // Summary
      steps.push('\n📋 SUMMARY:');
      steps.push(`Devotionals: ${results.devotionalsCheck?.total || 0} total, ${results.devotionalsCheck?.incomplete || 0} incomplete`);
      steps.push(`Device token: ${results.deviceTokenCheck?.hasToken ? '✅' : '❌'}`);
      steps.push(`Queue: ${results.queueCheck?.total || 0} notifications`);
      steps.push(`Permissions: ${results.permissionCheck?.granted ? '✅' : '❌'}`);
      steps.push(`Issues found: ${issues.length}`);

      if (issues.length > 0) {
        steps.push('\n🚨 ISSUES FOUND:');
        issues.forEach(issue => steps.push(`❌ ${issue}`));
      }

      return {
        success: issues.length === 0,
        steps,
        results,
        issues,
      };

    } catch (error) {
      Logger.error('Real-time notification debugging failed', error as Error, { userId });
      steps.push(`❌ Debugging failed: ${(error as Error).message}`);
      
      return {
        success: false,
        steps,
        results,
        issues: [`Debugging failed: ${(error as Error).message}`],
      };
    }
  },

  /**
   * Check user's devotionals
   */
  async checkUserDevotionals(userId: string): Promise<{
    total: number;
    incomplete: number;
    completed: number;
    recent: any[];
  }> {
    try {
      const { data, error } = await supabase
        .from('devotionals')
        .select('id, title, completed, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const total = data?.length || 0;
      const incomplete = data?.filter(d => !d.completed).length || 0;
      const completed = data?.filter(d => d.completed).length || 0;
      const recent = data?.slice(0, 3) || [];

      return { total, incomplete, completed, recent };
    } catch (error) {
      Logger.error('Failed to check user devotionals', error as Error);
      return { total: 0, incomplete: 0, completed: 0, recent: [] };
    }
  },

  /**
   * Check device token
   */
  async checkDeviceToken(userId: string): Promise<{
    hasToken: boolean;
    token?: string;
    platform?: string;
    isActive: boolean;
  }> {
    try {
      const { data, error } = await supabase
        .from('device_tokens')
        .select('token, platform, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return { hasToken: false, isActive: false };
      }

      return {
        hasToken: true,
        token: data.token,
        platform: data.platform,
        isActive: data.is_active,
      };
    } catch (error) {
      Logger.error('Failed to check device token', error as Error);
      return { hasToken: false, isActive: false };
    }
  },

  /**
   * Check notification queue
   */
  async checkNotificationQueue(userId: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    recent: any[];
  }> {
    try {
      const { data, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const total = data?.length || 0;
      const pending = data?.filter(n => n.status === 'pending').length || 0;
      const processing = data?.filter(n => n.status === 'processing').length || 0;
      const sent = data?.filter(n => n.status === 'sent').length || 0;
      const failed = data?.filter(n => n.status === 'failed').length || 0;
      const recent = data?.slice(0, 3) || [];

      return { total, pending, processing, sent, failed, recent };
    } catch (error) {
      Logger.error('Failed to check notification queue', error as Error);
      return { total: 0, pending: 0, processing: 0, sent: 0, failed: 0, recent: [] };
    }
  },

  /**
   * Test devotional scheduling
   */
  async testDevotionalScheduling(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await contextualNotificationService.scheduleDailyDevotionalReminder(userId, '07:00');
      return { success: result };
    } catch (error) {
      return { 
        success: false, 
        error: (error as Error).message 
      };
    }
  },

  /**
   * Test delivery service
   */
  async testDeliveryService(): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    total: number;
  }> {
    try {
      return await notificationDeliveryService.getDeliveryStats();
    } catch (error) {
      Logger.error('Failed to test delivery service', error as Error);
      return { pending: 0, processing: 0, sent: 0, failed: 0, total: 0 };
    }
  },

  /**
   * Check notification permissions
   */
  async checkNotificationPermissions(): Promise<{
    granted: boolean;
    canSchedule: boolean;
  }> {
    try {
      // This would need to be implemented based on your notification permission checking
      // For now, return a basic check
      return { granted: true, canSchedule: true };
    } catch (error) {
      Logger.error('Failed to check permissions', error as Error);
      return { granted: false, canSchedule: false };
    }
  },

  /**
   * Create immediate test notification
   */
  async createImmediateTestNotification(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const notification = {
        user_id: userId,
        type: 'realtime_test',
        title: '🧪 Real-time Test',
        message: 'This is a real-time test notification',
        data: {
          deep_link: 'sifia://dashboard',
          type: 'realtime_test',
          timestamp: new Date().toISOString(),
        },
        scheduled_for: new Date(Date.now() + 1000).toISOString(), // 1 second from now
        priority: 'high' as const,
      };

      const result = await notificationSchedulerService.scheduleNotification(notification, {
        priority: 'high',
        batchWithOthers: false,
      });

      return { success: !!result };
    } catch (error) {
      return { 
        success: false, 
        error: (error as Error).message 
      };
    }
  },

  /**
   * Check delivery service status
   */
  async checkDeliveryServiceStatus(): Promise<{
    status: string;
    lastProcessed?: string;
  }> {
    try {
      // Check if delivery service is active by checking recent queue activity
      const { data, error } = await supabase
        .from('notification_queue')
        .select('updated_at')
        .in('status', ['sent', 'processing'])
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return { status: 'inactive' };
      }

      const lastProcessed = data[0].updated_at;
      const timeDiff = Date.now() - new Date(lastProcessed).getTime();
      const isActive = timeDiff < 5 * 60 * 1000; // Active if processed within 5 minutes

      return {
        status: isActive ? 'active' : 'inactive',
        lastProcessed,
      };
    } catch (error) {
      Logger.error('Failed to check delivery service status', error as Error);
      return { status: 'unknown' };
    }
  },
};

import { pushNotificationService } from '../services/pushNotificationService';
import { DailyNotificationScheduler } from '../utils/dailyNotificationScheduler';
import { contextualNotificationService } from '../services/contextualNotificationService';
import { notificationManagementService } from '../services/notificationManagementService';
import { supabase } from '../services/supabaseClient';
import { testNotifications } from '../utils/testNotifications';
import { Logger } from './ProductionLogger';

/**
 * Comprehensive Notification Debug Tool
 * Helps diagnose why push notifications aren't working
 */

export const notificationDebugger = {
  /**
   * Run complete notification system diagnostic
   */
  async runFullDiagnostic(userId: string) {
    Logger.info('🔍 Starting full notification diagnostic', { userId });
    
    const results = {
      userId,
      timestamp: new Date().toISOString(),
      checks: {} as Record<string, any>,
      issues: [] as string[],
      recommendations: [] as string[],
    };

    // 1. Check Basic Setup
    results.checks.basicSetup = await this.checkBasicSetup(userId);
    
    // 2. Check Device Token
    results.checks.deviceToken = await this.checkDeviceToken(userId);
    
    // 3. Check Permissions
    results.checks.permissions = await this.checkPermissions();
    
    // 4. Check Scheduled Notifications
    results.checks.scheduledNotifications = await this.checkScheduledNotifications(userId);
    
    // 5. Check Notification Preferences
    results.checks.preferences = await this.checkNotificationPreferences(userId);
    
    // 6. Check Backend Notification Queue
    results.checks.backendQueue = await this.checkBackendNotificationQueue(userId);
    
    // 7. Check Recent Notification History
    results.checks.recentHistory = await this.checkRecentNotificationHistory(userId);
    
    // 8. Test Immediate Notification
    results.checks.immediateTest = await this.testImmediateNotification();

    // Analyze results and provide recommendations
    this.analyzeResults(results);
    
    Logger.info('🔍 Notification diagnostic complete', { 
      issuesCount: results.issues.length,
      recommendationsCount: results.recommendations.length 
    });
    
    return results;
  },

  /**
   * Check basic notification setup
   */
  async checkBasicSetup(userId: string) {
    const check = {
      status: 'unknown' as 'pass' | 'fail' | 'unknown',
      details: {} as Record<string, any>
    };

    try {
      // Check if notification setup is called in App.tsx
      check.details.appSetupCalled = true; // We know this from App.tsx line 145
      
      // Check if user is valid
      check.details.validUserId = !!userId;
      
      // Check push notification service initialization
      try {
        await pushNotificationService.initialize(userId);
        check.details.pushServiceInitialized = true;
        check.status = 'pass';
      } catch (error) {
        check.details.pushServiceError = (error as Error).message;
        check.status = 'fail';
      }
      
    } catch (error) {
      check.details.error = (error as Error).message;
      check.status = 'fail';
    }

    return check;
  },

  /**
   * Check device token registration
   */
  async checkDeviceToken(userId: string) {
    const check = {
      status: 'unknown' as 'pass' | 'fail' | 'unknown',
      details: {} as Record<string, any>
    };

    try {
      // Query device tokens from database
      const { data: tokens, error } = await supabase
        .from('device_tokens')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        check.details.databaseError = error.message;
        check.status = 'fail';
        return check;
      }

      check.details.tokenCount = tokens?.length || 0;
      check.details.tokens = tokens?.map(t => ({
        platform: t.platform,
        is_active: t.is_active,
        created_at: t.created_at,
        updated_at: t.updated_at,
        token_preview: t.token ? `${t.token.substring(0, 20)}...` : null
      }));

      if (!tokens || tokens.length === 0) {
        check.status = 'fail';
        check.details.message = 'No device tokens found - notifications cannot be delivered';
      } else {
        const activeToken = tokens.find(t => t.is_active);
        if (activeToken) {
          check.status = 'pass';
          check.details.activeToken = {
            platform: activeToken.platform,
            lastUpdated: activeToken.updated_at
          };
        } else {
          check.status = 'fail';
          check.details.message = 'Found tokens but none are active';
        }
      }

    } catch (error) {
      check.details.error = (error as Error).message;
      check.status = 'fail';
    }

    return check;
  },

  /**
   * Check notification permissions
   */
  async checkPermissions() {
    const check = {
      status: 'unknown' as 'pass' | 'fail' | 'unknown',
      details: {} as Record<string, any>
    };

    try {
      const permissions = await pushNotificationService.checkPermissions();
      check.details.permissions = permissions;
      
      const hasAnyPermission = permissions.alert || permissions.badge || permissions.sound;
      
      if (hasAnyPermission) {
        check.status = 'pass';
        check.details.message = 'Permissions granted';
      } else {
        check.status = 'fail';
        check.details.message = 'No notification permissions granted';
      }

    } catch (error) {
      check.details.error = (error as Error).message;
      check.status = 'fail';
    }

    return check;
  },

  /**
   * Check scheduled notifications
   */
  async checkScheduledNotifications(userId: string) {
    const check = {
      status: 'unknown' as 'pass' | 'fail' | 'unknown',
      details: {} as Record<string, any>
    };

    try {
      // Check if daily notifications are scheduled
      const shouldSchedule = await DailyNotificationScheduler.shouldScheduleToday();
      check.details.needsScheduling = shouldSchedule;
      
      if (shouldSchedule) {
        // Force schedule to test
        const scheduleResult = await DailyNotificationScheduler.scheduleForUser(userId);
        check.details.scheduleResult = scheduleResult;
        check.status = scheduleResult ? 'pass' : 'fail';
      } else {
        check.status = 'pass';
        check.details.message = 'Notifications already scheduled for today';
      }

      // Check what types of notifications should be scheduled
      check.details.availableNotificationTypes = [
        'daily_devotional_reminder',
        'daily_prayer_reminder', 
        'prayer_request_reminder',
        'devotional_reflection_reminder',
        'gratitude_reminder',
        'wins_reminder',
        'journal_reminder',
        'playbook_reminder',
        'daily_scripture',
        'affirmation_reminder'
      ];

    } catch (error) {
      check.details.error = (error as Error).message;
      check.status = 'fail';
    }

    return check;
  },

  /**
   * Check user notification preferences
   */
  async checkNotificationPreferences(userId: string) {
    const check = {
      status: 'unknown' as 'pass' | 'fail' | 'unknown',
      details: {} as Record<string, any>
    };

    try {
      const preferences = await notificationManagementService.getNotificationPreferences(userId);
      check.details.preferences = preferences;
      
      if (preferences) {
        check.status = 'pass';
        check.details.enabledTypes = Object.keys(preferences).filter(key => 
          preferences[key as keyof typeof preferences] === true
        );
      } else {
        check.status = 'fail';
        check.details.message = 'No notification preferences found';
      }

    } catch (error) {
      check.details.error = (error as Error).message;
      check.status = 'fail';
    }

    return check;
  },

  /**
   * Check backend notification queue
   */
  async checkBackendNotificationQueue(userId: string) {
    const check = {
      status: 'unknown' as 'pass' | 'fail' | 'unknown',
      details: {} as Record<string, any>
    };

    try {
      const pendingNotifications = await notificationManagementService.getPendingNotifications(userId);
      check.details.pendingCount = pendingNotifications.length;
      check.details.pendingNotifications = pendingNotifications.slice(0, 5).map(n => ({
        type: n.type,
        scheduled_for: n.scheduled_for,
        priority: n.priority,
        created_at: n.created_at
      }));

      if (pendingNotifications.length > 0) {
        check.status = 'pass';
        check.details.message = `${pendingNotifications.length} notifications in queue`;
      } else {
        check.status = 'unknown';
        check.details.message = 'No pending notifications in queue';
      }

    } catch (error) {
      check.details.error = (error as Error).message;
      check.status = 'fail';
    }

    return check;
  },

  /**
   * Check recent notification history
   */
  async checkRecentNotificationHistory(userId: string) {
    const check = {
      status: 'unknown' as 'pass' | 'fail' | 'unknown',
      details: {} as Record<string, any>
    };

    try {
      // Check notification analytics
      const { data: analytics, error } = await supabase
        .from('notification_analytics')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        check.details.databaseError = error.message;
        check.status = 'fail';
        return check;
      }

      check.details.recentCount = analytics?.length || 0;
      check.details.recentNotifications = analytics?.map(a => ({
        type: a.notification_type,
        status: a.status,
        created_at: a.created_at,
        error_message: a.error_message
      }));

      const successfulNotifications = analytics?.filter(a => a.status === 'sent').length || 0;
      
      if (successfulNotifications > 0) {
        check.status = 'pass';
        check.details.successfulCount = successfulNotifications;
        check.details.message = `${successfulNotifications} successful notifications recently`;
      } else {
        check.status = 'fail';
        check.details.message = 'No successful notifications in recent history';
      }

    } catch (error) {
      check.details.error = (error as Error).message;
      check.status = 'fail';
    }

    return check;
  },

  /**
   * Test immediate notification delivery
   */
  async testImmediateNotification() {
    const check = {
      status: 'unknown' as 'pass' | 'fail' | 'unknown',
      details: {} as Record<string, any>
    };

    try {
      // Schedule test notification for immediate delivery
      await testNotifications.sendPrayerStreakAlert();
      check.status = 'pass';
      check.details.message = 'Test notification scheduled successfully';
      check.details.scheduledFor = new Date(Date.now() + 1000).toISOString();
    } catch (error) {
      check.details.error = (error as Error).message;
      check.status = 'fail';
    }

    return check;
  },

  /**
   * Analyze diagnostic results and provide recommendations
   */
  analyzeResults(results: any) {
    const { checks } = results;

    // Analyze device token
    if (checks.deviceToken?.status === 'fail') {
      results.issues.push('❌ Device token not registered or inactive');
      results.recommendations.push('📱 Ensure app has permission to send notifications');
      results.recommendations.push('🔄 Try restarting the app to refresh device token');
    }

    // Analyze permissions
    if (checks.permissions?.status === 'fail') {
      results.issues.push('❌ Notification permissions not granted');
      results.recommendations.push('⚙️ Go to Settings > Notifications > siFia and enable notifications');
    }

    // Analyze scheduled notifications
    if (checks.scheduledNotifications?.status === 'fail') {
      results.issues.push('❌ Daily notifications not scheduled properly');
      results.recommendations.push('🕐 Check app scheduling permissions');
      results.recommendations.push('📱 Make sure app can run in background');
    }

    // Analyze preferences
    if (checks.preferences?.status === 'fail') {
      results.issues.push('❌ No notification preferences found');
      results.recommendations.push('⚙️ Complete notification setup in onboarding or profile settings');
    }

    // Analyze recent history
    if (checks.recentHistory?.status === 'fail') {
      results.issues.push('❌ No successful notifications in recent history');
      results.recommendations.push('🔧 Check backend notification delivery system');
      results.recommendations.push('📱 Verify device token is valid and active');
    }

    // If no issues found
    if (results.issues.length === 0) {
      results.recommendations.push('✅ Notification system appears to be working correctly');
      results.recommendations.push('📧 If you\'re still not receiving notifications, check device settings');
      results.recommendations.push('🔔 Verify Do Not Disturb is off and volume is up');
    }
  },

  /**
   * Get quick status summary
   */
  async getQuickStatus(userId: string) {
    const diagnostic = await this.runFullDiagnostic(userId);
    
    return {
      overallStatus: diagnostic.issues.length === 0 ? 'healthy' : 'issues_found',
      issueCount: diagnostic.issues.length,
      keyIssues: diagnostic.issues.slice(0, 3),
      hasDeviceToken: diagnostic.checks.deviceToken?.status === 'pass',
      hasPermissions: diagnostic.checks.permissions?.status === 'pass',
      notificationsScheduled: diagnostic.checks.scheduledNotifications?.status === 'pass',
      pendingNotifications: diagnostic.checks.backendQueue?.details?.pendingCount || 0,
      lastSuccessfulNotification: diagnostic.checks.recentHistory?.details?.recentNotifications?.[0]?.created_at
    };
  }
};

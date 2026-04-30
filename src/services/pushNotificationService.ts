import { Alert, Linking, Platform } from 'react-native';
import { Logger } from '../utils/ProductionLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';
import {
  PushNotificationBridge,
  addNotificationEventListener,
  isNativeModuleAvailable,
} from '../modules/PushNotificationBridge';

// Conditionally import push notification library for Android
let PushNotification: any = null;
if (Platform.OS === 'android') {
  try {
    PushNotification = require('react-native-push-notification');
  } catch (error) {
    Logger.warn('[PushNotification] react-native-push-notification not available', {
      component: 'pushNotificationService',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface DeviceToken {
  user_id: string;
  token: string;
  platform: 'ios' | 'android';
  device_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPayload {
  title: string;
  message: string;
  data?: any;
  badge?: number;
  sound?: string;
  priority?: 'high' | 'normal';
}

class PushNotificationService {
  private isInitialized = false;
  private deviceToken: string | null = null;
  private eventListeners: Array<{ remove: () => void }> = [];
  private notificationQueue: any[] = [];
  private isProcessingQueue = false;

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) {
      Logger.info('[PushNotification] Already initialized', {
        component: 'pushNotificationService',
      });
      return;
    }

    try {
      Logger.info('[PushNotification] Starting initialization', {
        component: 'pushNotificationService',
        platform: Platform.OS,
        userId,
      });

      if (Platform.OS === 'ios') {
        await this.initializeIOS(userId);
      } else if (Platform.OS === 'android') {
        await this.initializeAndroid(userId);
      }

      if (!this.deviceToken) {
        const storedToken = await this.getStoredToken();
        if (storedToken) {
          await this.saveDeviceToken(userId, storedToken);
        }
      }

      // ENTERPRISE: Load queued notifications from storage
      await this.loadNotificationQueue();

      // ENTERPRISE: Sync badge count on launch
      await this.syncBadgeCount(userId);

      // ENTERPRISE: Process any queued notifications
      await this.processNotificationQueue(userId);

      this.isInitialized = true;
      Logger.info('[PushNotification] Initialization complete', {
        component: 'pushNotificationService',
      });
    } catch (error) {
      Logger.error('[PushNotification] Initialization error', error as Error, {
        component: 'pushNotificationService',
      });
      throw error;
    }
  }

  private async initializeIOS(userId: string): Promise<void> {
    Logger.info('INIT: Starting iOS initialization for user', { userId });
    Logger.info('[PushNotification] Initializing iOS push notifications', {
      component: 'pushNotificationService',
      userId,
    });

    if (!isNativeModuleAvailable()) {
      Logger.warn('INIT: Native module NOT available');
      Logger.warn('[PushNotification] Native module not available', {
        component: 'pushNotificationService',
      });
      return;
    }

    Logger.info('INIT: Native module available, registering event listeners');

    // Listen for device token registration
    const tokenListener = addNotificationEventListener(
      'RemoteNotificationRegistered',
      async (event: any) => {
        Logger.info('TOKEN EVENT: RemoteNotificationRegistered fired!', event);
        Logger.info('[PushNotification] Device token received', {
          component: 'pushNotificationService',
          tokenLength: event.deviceToken?.length,
        });
        this.deviceToken = event.deviceToken;
        Logger.info('TOKEN: Calling saveDeviceToken with', { deviceToken: event.deviceToken?.substring(0, 20) + '...' });
        await this.saveDeviceToken(userId, event.deviceToken);
        Logger.info('TOKEN: saveDeviceToken completed');
      }
    );

    if (tokenListener) {
      this.eventListeners.push(tokenListener);
    }

    // Listen for registration failures
    const errorListener = addNotificationEventListener(
      'RemoteNotificationRegistrationFailed',
      (event: any) => {
        Logger.error('TOKEN EVENT: RemoteNotificationRegistrationFailed fired!', event);
        Logger.error(
          '[PushNotification] Registration failed',
          new Error(event.error),
          {
            component: 'pushNotificationService',
          }
        );
      }
    );

    if (errorListener) {
      this.eventListeners.push(errorListener);
    }

    // Listen for incoming notifications
    const notificationListener = addNotificationEventListener(
      'RemoteNotificationReceived',
      async (notification: any) => {
        Logger.info('NOTIFICATION EVENT: RemoteNotificationReceived fired!', notification);
        Logger.info('[PushNotification] Notification received', {
          component: 'pushNotificationService',
          notification,
        });

        // Save notification to history when received
        await this.saveNotificationOnReceive(notification);

        this.handleNotificationTap(notification);
      }
    );

    if (notificationListener) {
      this.eventListeners.push(notificationListener);
    }

    Logger.info('INIT: All iOS event listeners registered successfully');
    Logger.info('[PushNotification] iOS event listeners registered', {
      component: 'pushNotificationService',
    });
  }

  private async initializeAndroid(userId: string): Promise<void> {
    if (!PushNotification) {
      Logger.warn('[PushNotification] Android module not available', {
        component: 'pushNotificationService',
      });
      return;
    }

    // Configure push notifications for Android
    PushNotification.configure({
      onRegister: async (token: any) => {
        this.deviceToken = token.token;
        await this.saveDeviceToken(userId, token.token);
      },
      onNotification: async (notification: any) => {
        if (notification.userInteraction) {
          this.handleNotificationTap(notification);
        } else {
          // Save notification when received (not just when tapped)
          await this.saveNotificationOnReceive(notification);
        }
      },
      onRegistrationError: (err: any) => {
        Logger.error('[PushNotification] Android registration error', err as Error, {
          component: 'pushNotificationService',
        });
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: true,
    });

    // Create notification channels
    PushNotification.createChannel(
      {
        channelId: 'sifia-default',
        channelName: 'siFia Notifications',
        channelDescription: 'Default notification channel for siFia',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      () => {}
    );

    PushNotification.createChannel(
      {
        channelId: 'sifia-critical',
        channelName: 'siFia Critical',
        channelDescription: 'Critical notifications',
        playSound: true,
        soundName: 'default',
        importance: 5,
        vibrate: true,
      },
      () => {}
    );
  }

  async requestPermissions(): Promise<boolean> {
    try {
      Logger.info('PERMISSIONS: requestPermissions called');
      if (Platform.OS === 'ios') {
        if (!isNativeModuleAvailable()) {
          Logger.warn('PERMISSIONS: Native module not available');
          Logger.warn('[PushNotification] Native module not available for permissions', {
            component: 'pushNotificationService',
          });
          return true;
        }

        // Check current permissions first
        const current = await PushNotificationBridge.checkPermissions();
        const alreadyGranted = current.alert || current.badge || current.sound;

        if (alreadyGranted) {
          Logger.info('PERMISSIONS: Permissions already granted - forcing APNS re-registration');
          Logger.info('[PushNotification] Permissions already granted - forcing APNS re-registration', {
            component: 'pushNotificationService',
            permissions: current,
          });

          try {
            // Force re-registration to re-emit the device token event
            Logger.info('PERMISSIONS: Calling registerForRemoteNotifications...');
            await PushNotificationBridge.registerForRemoteNotifications();
            Logger.info('PERMISSIONS: registerForRemoteNotifications completed');
          } catch (error) {
            Logger.error('PERMISSIONS: Error re-registering for remote notifications:', error);
            Logger.error('[PushNotification] Error re-registering for remote notifications', error as Error, {
              component: 'pushNotificationService',
            });
          }

          return true;
        }

        // Always re-trigger registration to ensure token is emitted
        Logger.info('PERMISSIONS: Calling native requestPermissions...');
        const granted = await PushNotificationBridge.requestPermissions();
        Logger.info('PERMISSIONS: Native requestPermissions returned', { granted });
        Logger.info('[PushNotification] iOS permissions result', {
          component: 'pushNotificationService',
          granted,
        });
        return granted;
      }

      // Android - permissions handled by PushNotification library
      return true;
    } catch (error) {
      Logger.error('[PushNotification] Permission request error', error as Error, {
        component: 'pushNotificationService',
      });
      return true; // Return true to not block onboarding
    }
  }

  async checkPermissions(): Promise<any> {
    try {
      if (Platform.OS === 'ios') {
        if (!isNativeModuleAvailable()) {
          return { alert: true, badge: true, sound: true };
        }
        return await PushNotificationBridge.checkPermissions();
      }
      // Android
      return { alert: true, badge: true, sound: true };
    } catch (error) {
      Logger.warn('[PushNotification] Error checking permissions, using defaults', {
        component: 'pushNotificationService',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return { alert: true, badge: true, sound: true };
    }
  }

  async saveDeviceToken(userId: string, token: string): Promise<void> {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {

        const deviceToken: DeviceToken = {
          user_id: userId,
          token,
          platform: Platform.OS as 'ios' | 'android',
          device_id: await this.getDeviceId(),
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Save to local storage
        await AsyncStorage.setItem('push_token', token);

        // Save to Supabase
        const { error } = await supabase
          .from('device_tokens')
          .upsert(deviceToken, {
            onConflict: 'user_id,device_id',
          });

        if (error) {
          Logger.error('[PushNotification] Error saving token to Supabase', new Error(error.message || 'Unknown error'), {
            component: 'pushNotificationService',
            userId,
            attempt,
            errorCode: error.code,
            errorMessage: error.message,
          });
          // Don't throw - just log and continue
          return;
        }

        Logger.info('[PushNotification] Device token saved successfully', {
          component: 'pushNotificationService',
          userId: deviceToken.user_id,
          deviceId: deviceToken.device_id,
          attempt,
        });

        // Success - exit retry loop
        return;

      } catch (error) {
        if (attempt === maxRetries) {
          Logger.error('[PushNotification] Error saving token to Supabase after all retries', error as Error, {
            component: 'pushNotificationService',
            userId,
            attempts: attempt,
            maxRetries,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        } else {
          Logger.warn(`[PushNotification] Error saving token, attempt ${attempt}/${maxRetries}`, {
            component: 'pushNotificationService',
            userId,
            attempt,
            maxRetries,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  async getStoredToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('push_token');
    } catch (error) {
      Logger.error('[PushNotification] Error getting stored token', error as Error, {
      component: 'pushNotificationService',
    });
      return null;
    }
  }

  async scheduleLocalNotification(payload: NotificationPayload, date?: Date): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        if (!isNativeModuleAvailable()) {
          Logger.warn('[PushNotification] Native module not available', {
            component: 'pushNotificationService',
          });
          return;
        }

        await PushNotificationBridge.scheduleLocalNotification({
          title: payload.title,
          body: payload.message,
          badge: payload.badge,
          sound: payload.sound || 'default',
          userInfo: payload.data,
          fireDate: date ? date.getTime() : Date.now() + 1000,
        });
      } else if (Platform.OS === 'android' && PushNotification) {
        PushNotification.localNotificationSchedule({
          title: payload.title,
          message: payload.message,
          date: date || new Date(Date.now() + 1000),
          playSound: true,
          soundName: payload.sound || 'default',
          badge: payload.badge,
          userInfo: payload.data,
          channelId: payload.priority === 'high' ? 'sifia-critical' : 'sifia-default',
        });
      }
    } catch (error) {
      Logger.error('[PushNotification] Error scheduling local notification', error as Error, {
        component: 'pushNotificationService',
      });
    }
  }

  async cancelAllLocalNotifications(): Promise<void> {
    if (Platform.OS === 'ios' && isNativeModuleAvailable()) {
      PushNotificationBridge.cancelAllLocalNotifications();
    } else if (Platform.OS === 'android' && PushNotification) {
      PushNotification.cancelAllLocalNotifications();
    }
  }

  async setBadgeNumber(number: number): Promise<void> {
    if (Platform.OS === 'ios' && isNativeModuleAvailable()) {
      PushNotificationBridge.setBadgeNumber(number);
    }
  }

  async openNotificationSettings(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      Alert.alert(
        'Settings',
        'Please open Settings > Apps > siFia > Notifications to manage your notification preferences.',
        [{ text: 'OK' }]
      );
    }
  }

  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        // Generate a simple device ID
        deviceId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('device_id', deviceId);
      }
      return deviceId;
    } catch (error) {
      Logger.error('[PushNotification] Error getting device ID', error as Error, {
      component: 'pushNotificationService',
    });
      return `${Platform.OS}_${Date.now()}`;
    }
  }

  private async saveNotificationToHistory(userId: string, notification: any): Promise<void> {
    try {
      // Map notification types to valid enum values
      const notificationTypeMap: Record<string, string> = {
        'prayer_reminder': 'REMINDER',
        'devotional_reminder': 'REMINDER',
        'journal_prompt': 'REMINDER',
        'milestone_celebration': 'ACHIEVEMENT',
        'trial_notification': 'PROMOTIONAL',
        'streak_alert': 'ACHIEVEMENT',
        'prayer_request': 'ACTIVITY',
        'system': 'SYSTEM',
      };

      const mappedType = notificationTypeMap[notification.type] || 'SYSTEM';

      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: mappedType,
          title: notification.title
            || notification.aps?.alert?.title
            || (typeof notification.aps?.alert === 'string' ? notification.aps.alert : null)
            || 'Notification',
          message: notification.message
            || notification.body
            || notification.aps?.alert?.body
            || '',
          data: notification.data || {},
          is_read: false,
          created_at: new Date().toISOString(),
        });

      if (error) {
        Logger.error('[PushNotification] Error saving notification to history', error, {
          component: 'pushNotificationService',
          notificationType: notification.type,
          mappedType,
          errorDetails: {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          },
        });
      } else {
        Logger.info('[PushNotification] Notification saved to history', {
          component: 'pushNotificationService',
          notificationType: notification.type,
          mappedType,
        });
      }
    } catch (error) {
      Logger.error('[PushNotification] Failed to save notification to history', error as Error, {
        component: 'pushNotificationService',
      });
    }
  }

  private async saveNotificationOnReceive(notification: any): Promise<void> {
    try {
      // Get current user ID from AsyncStorage or session
      const userId = await AsyncStorage.getItem('current_user_id');
      if (userId) {
        await this.saveNotificationToHistory(userId, notification);

        // ENTERPRISE: Update badge count
        await this.syncBadgeCount(userId);
      } else {
        // ENTERPRISE: Queue notification if no user ID (offline)
        await this.queueNotification(notification);
        Logger.warn('[PushNotification] No user ID found, notification queued', {
          component: 'pushNotificationService',
        });
      }
    } catch (error) {
      // ENTERPRISE: Queue on error for retry
      await this.queueNotification(notification);
      Logger.error('[PushNotification] Failed to save notification, queued for retry', error as Error, {
        component: 'pushNotificationService',
      });
    }
  }

  private handleNotificationTap(notification: any): void {
    try {
      // Save notification to history when tapped
      // Get userId from notification data or from stored user session
      const userId = notification.data?.user_id || notification.userId;
      if (userId) {
        this.saveNotificationToHistory(userId, notification);
      }

      // Import deep link service dynamically to avoid circular dependencies
      import('./notificationDeepLinkService').then(({ notificationDeepLinkService }) => {
        notificationDeepLinkService.handleNotificationTap(notification);
      }).catch((error) => {
        Logger.error('[PushNotification] Failed to load deep link service', error as Error, {
          component: 'pushNotificationService',
        });
      });
    } catch (error) {
      Logger.error('[PushNotification] Failed to handle notification tap', error as Error, {
        component: 'pushNotificationService',
      });
    }
  }

  /**
   * ENTERPRISE: Sync badge count from server
   */
  private async syncBadgeCount(userId: string): Promise<void> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        Logger.error('[PushNotification] Failed to sync badge count', error, {
          component: 'pushNotificationService',
        });
        return;
      }

      if (count !== null) {
        await this.setBadgeNumber(count);
        Logger.info('[PushNotification] Badge count synced', {
          component: 'pushNotificationService',
          count,
        });
      }
    } catch (error) {
      Logger.error('[PushNotification] Error syncing badge count', error as Error, {
        component: 'pushNotificationService',
      });
    }
  }

  /**
   * ENTERPRISE: Process queued notifications
   */
  private async processNotificationQueue(userId: string): Promise<void> {
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      Logger.info('[PushNotification] Processing queued notifications', {
        component: 'pushNotificationService',
        count: this.notificationQueue.length,
      });

      const queue = [...this.notificationQueue];
      this.notificationQueue = [];

      for (const notification of queue) {
        try {
          await this.saveNotificationToHistory(userId, notification);
        } catch (error) {
          Logger.error('[PushNotification] Failed to process queued notification', error as Error, {
            component: 'pushNotificationService',
          });
        }
      }

      // Clear persisted queue after successful processing
      await AsyncStorage.removeItem('notification_queue');

      Logger.info('[PushNotification] Queue processing complete', {
        component: 'pushNotificationService',
      });
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * ENTERPRISE: Add notification to queue if offline
   */
  private async queueNotification(notification: any): Promise<void> {
    this.notificationQueue.push({
      ...notification,
      queuedAt: Date.now(),
    });

    // Save queue to AsyncStorage for persistence
    try {
      await AsyncStorage.setItem(
        'notification_queue',
        JSON.stringify(this.notificationQueue)
      );
      Logger.info('[PushNotification] Notification queued', {
        component: 'pushNotificationService',
        queueSize: this.notificationQueue.length,
      });
    } catch (error) {
      Logger.error('[PushNotification] Failed to persist queue', error as Error, {
        component: 'pushNotificationService',
      });
    }
  }

  /**
   * ENTERPRISE: Load queued notifications from storage
   */
  private async loadNotificationQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem('notification_queue');
      if (queueData) {
        this.notificationQueue = JSON.parse(queueData);
        Logger.info('[PushNotification] Loaded notification queue', {
          component: 'pushNotificationService',
          count: this.notificationQueue.length,
        });
      }
    } catch (error) {
      Logger.error('[PushNotification] Failed to load queue', error as Error, {
        component: 'pushNotificationService',
      });
    }
  }

  /**
   * ENTERPRISE: Mark notification as read and update badge
   */
  async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        Logger.error('[PushNotification] Failed to mark notification as read', error, {
          component: 'pushNotificationService',
        });
        return;
      }

      // Update badge count
      await this.syncBadgeCount(userId);

      Logger.info('[PushNotification] Notification marked as read', {
        component: 'pushNotificationService',
        notificationId,
      });
    } catch (error) {
      Logger.error('[PushNotification] Error marking notification as read', error as Error, {
        component: 'pushNotificationService',
      });
    }
  }

  /**
   * ENTERPRISE: Mark all notifications as read
   */
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        Logger.error('[PushNotification] Failed to mark all notifications as read', error, {
          component: 'pushNotificationService',
        });
        return;
      }

      // Clear badge
      await this.setBadgeNumber(0);

      Logger.info('[PushNotification] All notifications marked as read', {
        component: 'pushNotificationService',
      });
    } catch (error) {
      Logger.error('[PushNotification] Error marking all notifications as read', error as Error, {
        component: 'pushNotificationService',
      });
    }
  }

  /**
   * ENTERPRISE: Force badge sync (call after notification actions)
   */
  async refreshBadgeCount(userId: string): Promise<void> {
    await this.syncBadgeCount(userId);
  }

  /**
   * Public test method to verify notification saving works
   * Call this to test the notification system functionality
   */
  async testNotificationSaving(notification?: any): Promise<boolean> {
    try {
      const testNotification = notification || {
        type: 'prayer_reminder',
        title: 'Test Prayer Reminder',
        message: 'Time for your daily prayer',
        data: {
          type: 'prayer_reminder',
          scheduled: true,
          test: true,
        },
      };

      // Get current user ID from AsyncStorage
      const userId = await AsyncStorage.getItem('current_user_id');
      if (!userId) {
        // Use a valid UUID for testing
        await this.saveNotificationToHistory('00000000-0000-0000-0000-000000000001', testNotification);
      } else {
        await this.saveNotificationToHistory(userId, testNotification);
      }

      return true;
    } catch (error) {
      Logger.error('Failed to save notification', error as Error, {
        component: 'pushNotificationService',
      });
      return false;
    }
  }
}

export const pushNotificationService = new PushNotificationService();

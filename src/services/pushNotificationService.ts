// Conditionally import push notification library
let PushNotification: any = null;
try {
  PushNotification = require('react-native-push-notification');
} catch (error) {
  console.warn('[PushNotification] react-native-push-notification not available:', error);
}
import { Platform, Alert, Linking } from 'react-native';

// Conditionally import PushNotificationIOS only on iOS
let PushNotificationIOS: any = null;
if (Platform.OS === 'ios') {
  try {
    PushNotificationIOS = require('@react-native-community/push-notification-ios');
    // Verify the module has the required methods
    if (!PushNotificationIOS || typeof PushNotificationIOS.checkPermissions !== 'function') {
      console.log('[PushNotification] PushNotificationIOS methods not available - using fallback');
      PushNotificationIOS = null;
    }
  } catch (error) {
    console.log('[PushNotification] PushNotificationIOS not available - using fallback:', (error as Error).message);
    PushNotificationIOS = null;
  }
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';

export interface DeviceToken {
  userId: string;
  token: string;
  platform: 'ios' | 'android';
  deviceId: string;
  createdAt: string;
  updatedAt: string;
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

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Skip initialization if PushNotification is not available
      if (!PushNotification) {
        console.warn('[PushNotification] Service not available, skipping initialization');
        this.isInitialized = true;
        return;
      }

      // Configure push notifications
      PushNotification.configure({
        // Called when token is generated (iOS and Android)
        onRegister: async (token: any) => {
          console.log('[PushNotification] Token received:', token);
          this.deviceToken = token.token;
          await this.saveDeviceToken(userId, token.token);
        },

        // Called when a remote notification is received while app is in foreground
        onNotification: (notification: any) => {
          console.log('[PushNotification] Notification received:', notification);
          
          // Handle notification tap
          if (notification.userInteraction) {
            this.handleNotificationTap(notification);
          }

          // iOS: Call completion handler
          if (Platform.OS === 'ios' && PushNotificationIOS) {
            notification.finish(PushNotificationIOS.FetchResult.NoData);
          }
        },

        // Called when user taps notification
        onAction: (notification: any) => {
          console.log('[PushNotification] Action received:', notification);
        },

        // Called when registration fails (Android)
        onRegistrationError: (err: any) => {
          console.error('[PushNotification] Registration error:', err);
        },

        // IOS ONLY: Called when user permissions are granted/denied
        permissions: {
          alert: true,
          badge: true,
          sound: true,
        },

        // Should the initial notification be popped automatically
        popInitialNotification: true,

        // Request permissions on app start (iOS)
        requestPermissions: Platform.OS === 'ios',
      });

      // Create default notification channel (Android)
      if (Platform.OS === 'android' && PushNotification) {
        PushNotification.createChannel(
          {
            channelId: 'sifia-default',
            channelName: 'siFia Notifications',
            channelDescription: 'Default notification channel for siFia',
            playSound: true,
            soundName: 'default',
            importance: 4, // High importance
            vibrate: true,
          },
          (created: any) => console.log(`[PushNotification] Channel created: ${created}`)
        );

        // Create high priority channel for critical notifications
        PushNotification.createChannel(
          {
            channelId: 'sifia-critical',
            channelName: 'siFia Critical',
            channelDescription: 'Critical notifications (trial expiry, streak alerts)',
            playSound: true,
            soundName: 'default',
            importance: 5, // Max importance
            vibrate: true,
          },
          (created: any) => console.log(`[PushNotification] Critical channel created: ${created}`)
        );
      }

      this.isInitialized = true;
      console.log('[PushNotification] Service initialized successfully');
    } catch (error) {
      console.error('[PushNotification] Initialization error:', error);
      throw error;
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios' && PushNotificationIOS && typeof PushNotificationIOS.checkPermissions === 'function') {
        // Check current permissions first
        const current: any = await new Promise((resolve) =>
          PushNotificationIOS.checkPermissions((p: any) => resolve(p))
        );
        console.log('[PushNotification] Current iOS permissions:', current);

        const alreadyGranted = !!(current?.alert || current?.badge || current?.sound);
        if (alreadyGranted) return true;

        // Request permissions
        if (typeof PushNotificationIOS.requestPermissions === 'function') {
          const requested = await PushNotificationIOS.requestPermissions({
            alert: true,
            badge: true,
            sound: true,
          });
          console.log('[PushNotification] Requested iOS permissions result:', requested);
          return !!(requested?.alert || requested?.badge || requested?.sound);
        }
      }
      // Android or fallback
      console.log('[PushNotification] Using fallback permissions (iOS module not available)');
      return true;
    } catch (error) {
      console.error('[PushNotification] Permission request error:', error);
      return true; // Return true to not block onboarding
    }
  }

  async checkPermissions(): Promise<any> {
    try {
      if (Platform.OS === 'ios' && PushNotificationIOS && typeof PushNotificationIOS.checkPermissions === 'function') {
        return new Promise((resolve) => {
          PushNotificationIOS.checkPermissions((permissions: any) => {
            resolve(permissions);
          });
        });
      } else {
        // Android or iOS without PushNotificationIOS: Return default permissions
        console.log('[PushNotification] Using default permissions (PushNotificationIOS not available)');
        return { alert: true, badge: true, sound: true };
      }
    } catch (error) {
      console.warn('[PushNotification] Error checking permissions, using defaults:', error);
      return { alert: true, badge: true, sound: true };
    }
  }

  async saveDeviceToken(userId: string, token: string): Promise<void> {
    try {
      const deviceToken: DeviceToken = {
        userId,
        token,
        platform: Platform.OS as 'ios' | 'android',
        deviceId: await this.getDeviceId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
        console.error('[PushNotification] Error saving token to Supabase:', error);
      } else {
        console.log('[PushNotification] Device token saved successfully');
      }
    } catch (error) {
      console.error('[PushNotification] Error saving device token:', error);
    }
  }

  async getStoredToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('push_token');
    } catch (error) {
      console.error('[PushNotification] Error getting stored token:', error);
      return null;
    }
  }

  async scheduleLocalNotification(payload: NotificationPayload, date?: Date): Promise<void> {
    try {
      if (!PushNotification) {
        console.warn('[PushNotification] Service not available, cannot schedule notification');
        return;
      }
      
      PushNotification.localNotificationSchedule({
        title: payload.title,
        message: payload.message,
        date: date || new Date(Date.now() + 1000), // Default to 1 second from now
        playSound: true,
        soundName: payload.sound || 'default',
        badge: payload.badge,
        userInfo: payload.data,
        channelId: payload.priority === 'high' ? 'sifia-critical' : 'sifia-default',
      });
    } catch (error) {
      console.error('[PushNotification] Error scheduling local notification:', error);
    }
  }

  async cancelAllLocalNotifications(): Promise<void> {
    if (PushNotification) {
      PushNotification.cancelAllLocalNotifications();
    }
  }

  async setBadgeNumber(number: number): Promise<void> {
    if (Platform.OS === 'ios' && PushNotificationIOS) {
      PushNotificationIOS.setApplicationIconBadgeNumber(number);
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
      console.error('[PushNotification] Error getting device ID:', error);
      return `${Platform.OS}_${Date.now()}`;
    }
  }

  private handleNotificationTap(notification: any): void {
    console.log('[PushNotification] Notification tapped:', notification);
    
    // Handle different notification types
    const { type, playbookId, devotionalId, actionStepId } = notification.data || {};
    
    switch (type) {
      case 'playbook_step':
        // Navigate to specific playbook and action step
        // navigation.navigate('PlaybookDetail', { playbookId, actionStepId });
        break;
      case 'devotional_reminder':
        // Navigate to devotional
        // navigation.navigate('DevotionalDetail', { devotionalId });
        break;
      case 'prayer_reminder':
        // Navigate to prayer/journal section
        // navigation.navigate('Journal', { tab: 'prayer' });
        break;
      default:
        // Navigate to home screen
        // navigation.navigate('Home');
        break;
    }
  }
}

export const pushNotificationService = new PushNotificationService();

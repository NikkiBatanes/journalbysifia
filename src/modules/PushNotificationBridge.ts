/**
 * Native Push Notification Bridge
 * Provides direct access to iOS native push notification functionality
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

interface PushNotificationBridgeInterface {
  requestPermissions: () => Promise<boolean>;
  checkPermissions: () => Promise<{
    alert: boolean;
    badge: boolean;
    sound: boolean;
    authorizationStatus: number;
  }>;
  setBadgeNumber: (number: number) => void;
  getBadgeNumber: () => Promise<number>;
  cancelAllLocalNotifications: () => void;
  removeAllDeliveredNotifications: () => void;
  scheduleLocalNotification: (notification: {
    title: string;
    body: string;
    badge?: number;
    sound?: string;
    userInfo?: any;
    fireDate?: number;
    id?: string;
  }) => Promise<string>;
}

// Get the native module
const { RCTPushNotificationBridge } = NativeModules;

// Create event emitter for listening to native events
let eventEmitter: NativeEventEmitter | null = null;
if (Platform.OS === 'ios' && RCTPushNotificationBridge) {
  eventEmitter = new NativeEventEmitter(RCTPushNotificationBridge);
}

/**
 * Push Notification Bridge
 * Direct interface to native iOS push notification functionality
 */
export const PushNotificationBridge: PushNotificationBridgeInterface = {
  /**
   * Request push notification permissions
   */
  requestPermissions: async (): Promise<boolean> => {
    if (Platform.OS !== 'ios' || !RCTPushNotificationBridge) {
      return true; // Android handles permissions differently
    }
    try {
      return await RCTPushNotificationBridge.requestPermissions();
    } catch (error) {
      console.error('[PushNotificationBridge] Error requesting permissions:', error);
      return false;
    }
  },

  /**
   * Check current notification permissions
   */
  checkPermissions: async () => {
    if (Platform.OS !== 'ios' || !RCTPushNotificationBridge) {
      return { alert: true, badge: true, sound: true, authorizationStatus: 2 };
    }
    try {
      return await RCTPushNotificationBridge.checkPermissions();
    } catch (error) {
      console.error('[PushNotificationBridge] Error checking permissions:', error);
      return { alert: false, badge: false, sound: false, authorizationStatus: 0 };
    }
  },

  /**
   * Set app badge number
   */
  setBadgeNumber: (number: number) => {
    if (Platform.OS === 'ios' && RCTPushNotificationBridge) {
      RCTPushNotificationBridge.setBadgeNumber(number);
    }
  },

  /**
   * Get current app badge number
   */
  getBadgeNumber: async (): Promise<number> => {
    if (Platform.OS !== 'ios' || !RCTPushNotificationBridge) {
      return 0;
    }
    try {
      return await RCTPushNotificationBridge.getBadgeNumber();
    } catch (error) {
      console.error('[PushNotificationBridge] Error getting badge number:', error);
      return 0;
    }
  },

  /**
   * Cancel all pending local notifications
   */
  cancelAllLocalNotifications: () => {
    if (Platform.OS === 'ios' && RCTPushNotificationBridge) {
      RCTPushNotificationBridge.cancelAllLocalNotifications();
    }
  },

  /**
   * Remove all delivered notifications from notification center
   */
  removeAllDeliveredNotifications: () => {
    if (Platform.OS === 'ios' && RCTPushNotificationBridge) {
      RCTPushNotificationBridge.removeAllDeliveredNotifications();
    }
  },

  /**
   * Schedule a local notification
   */
  scheduleLocalNotification: async (notification): Promise<string> => {
    if (Platform.OS !== 'ios' || !RCTPushNotificationBridge) {
      return '';
    }
    try {
      return await RCTPushNotificationBridge.scheduleLocalNotification(notification);
    } catch (error) {
      console.error('[PushNotificationBridge] Error scheduling notification:', error);
      throw error;
    }
  },
};

/**
 * Event listener types
 */
export type NotificationEventType =
  | 'RemoteNotificationRegistered'
  | 'RemoteNotificationRegistrationFailed'
  | 'RemoteNotificationReceived'
  | 'LocalNotificationReceived';

export interface NotificationEventListener {
  (event: any): void;
}

/**
 * Add event listener for notification events
 */
export function addNotificationEventListener(
  eventType: NotificationEventType,
  listener: NotificationEventListener
): { remove: () => void } | null {
  if (!eventEmitter) {
    console.warn('[PushNotificationBridge] Event emitter not available');
    return null;
  }

  const subscription = eventEmitter.addListener(eventType, listener);
  return {
    remove: () => subscription.remove(),
  };
}

/**
 * Remove all listeners for a specific event type
 */
export function removeAllListeners(eventType: NotificationEventType): void {
  if (eventEmitter) {
    eventEmitter.removeAllListeners(eventType);
  }
}

/**
 * Check if the native module is available
 */
export function isNativeModuleAvailable(): boolean {
  return Platform.OS === 'ios' && !!RCTPushNotificationBridge;
}

export default PushNotificationBridge;

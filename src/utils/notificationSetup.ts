import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { pushNotificationService } from '../services/pushNotificationService';
import { notificationDeepLinkService } from '../services/notificationDeepLinkService';
import { DailyNotificationScheduler } from './dailyNotificationScheduler';
import { notificationDeliveryService } from '../services/notificationDeliveryService';
import { Logger } from './ProductionLogger';

/**
 * Initialize notification system
 * Call this in App.tsx or main entry point
 */
export function useNotificationSetup(userId: string | undefined, navigationRef: any) {
  useEffect(() => {
    if (!navigationRef || !navigationRef.current) {
      return;
    }

    // Set navigation reference for deep links
    notificationDeepLinkService.setNavigationRef(navigationRef.current);

    Logger.info('Notification deep-link service initialized', {
      component: 'notificationSetup',
    });
  }, [navigationRef]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    // Initialize push notification service
    const initPushNotifications = async () => {
      try {
        await pushNotificationService.initialize(userId);
        Logger.info('Push notification service initialized', {
          component: 'notificationSetup',
          userId,
        });

        // Check if device token exists, if not try to register it
        const hasToken = await pushNotificationService.getStoredToken();
        if (!hasToken) {
          Logger.warn('No device token found after initialization, attempting registration', {
            component: 'notificationSetup',
            userId,
          });

          // Try to request permissions and get token
          const permissionsGranted = await pushNotificationService.requestPermissions();
          if (permissionsGranted) {
            const tokenAfterPermission = await pushNotificationService.getStoredToken();
            if (tokenAfterPermission) {
              await pushNotificationService.saveDeviceToken(userId, tokenAfterPermission);
              Logger.info('Device token registered successfully', {
                component: 'notificationSetup',
                userId,
              });
            } else {
              Logger.warn('Still no device token after permission request', {
                component: 'notificationSetup',
                userId,
              });
            }
          }
        }

        // Start notification delivery service
        notificationDeliveryService.start();
        Logger.info('Notification delivery service started', {
          component: 'notificationSetup',
          userId,
        });
      } catch (error) {
        Logger.error('Failed to initialize push notifications', error as Error, {
          component: 'notificationSetup',
          userId,
        });
      }
    };

    // Schedule daily notifications
    const scheduleDailyNotifications = async () => {
      try {
        await DailyNotificationScheduler.scheduleForUser(userId);
        Logger.info('Daily notifications scheduled', {
          component: 'notificationSetup',
          userId,
        });
      } catch (error) {
        Logger.error('Failed to schedule daily notifications', error as Error, {
          component: 'notificationSetup',
          userId,
        });
      }
    };

    initPushNotifications();
    scheduleDailyNotifications();
  }, [userId]);

  // Listen for app state changes to reschedule when app comes to foreground
  useEffect(() => {
    if (!userId) {
      return;
    }

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground - check if we need to reschedule
        try {
          await DailyNotificationScheduler.scheduleForUser(userId);
        } catch (error) {
          Logger.error('Failed to reschedule on app active', error as Error, {
            component: 'notificationSetup',
          });
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [userId]);
}

/**
 * Get pending notification count for badge
 */
export async function getPendingNotificationCount(userId: string): Promise<number> {
  try {
    const { notificationManagementService } = await import('../services/notificationManagementService');
    const pending = await notificationManagementService.getPendingNotifications(userId);
    return pending.length;
  } catch (error) {
    Logger.error('Failed to get pending notification count', error as Error, {
      component: 'notificationSetup',
    });
    return 0;
  }
}

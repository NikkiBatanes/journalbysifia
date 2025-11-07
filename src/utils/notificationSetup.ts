import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { notificationDeepLinkService } from '../services/notificationDeepLinkService';
import { pushNotificationService } from '../services/pushNotificationService';
import { DailyNotificationScheduler } from './dailyNotificationScheduler';
import { Logger } from './ProductionLogger';

/**
 * Initialize notification system
 * Call this in App.tsx or main entry point
 */
export function useNotificationSetup(userId: string | undefined, navigationRef: any) {
  useEffect(() => {
    if (!navigationRef) {
      return;
    }

    // Set navigation reference for deep links
    notificationDeepLinkService.setNavigationRef(navigationRef);
    
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

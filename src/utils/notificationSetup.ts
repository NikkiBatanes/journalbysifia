import { useEffect } from 'react';
import { pushNotificationService } from '../services/pushNotificationService';
import { notificationDeepLinkService } from '../services/notificationDeepLinkService';
import { notificationDeliveryService } from '../services/notificationDeliveryService';
import { Logger } from './ProductionLogger';
import { supabase } from '../services/supabaseClient';

/**
 * Save user's device timezone to user_profiles for notification scheduling
 */
const saveUserTimezone = async (userId: string) => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await supabase
      .from('user_profiles')
      .update({ timezone })
      .eq('id', userId);
    Logger.info('Timezone saved', { component: 'notificationSetup', timezone });
  } catch (error) {
    Logger.error('Failed to save timezone', error as Error, {
      component: 'notificationSetup',
    });
  }
};

/**
 * Initialize notification system
 * Call this in App.tsx or main entry point
 */
export function useNotificationSetup(userId: string | undefined, navigationRef: any) {
  useEffect(() => {
    if (!navigationRef) {
      return;
    }

    // Set navigation reference for deep links - pass the ref object
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

        // Save device timezone for notification scheduling
        await saveUserTimezone(userId);

        Logger.info('Push notification service initialized', {
          component: 'notificationSetup',
          userId,
        });

        // Do not request notification permission during app startup.
        // Permission is requested only from OnboardingNotificationSetupScreen
        // after the user chooses to enable notifications.
        const hasToken = await pushNotificationService.getStoredToken();
        if (hasToken) {
          await pushNotificationService.saveDeviceToken(userId, hasToken);
          Logger.info('Stored device token synced', {
            component: 'notificationSetup',
            userId,
          });
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

    initPushNotifications();
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

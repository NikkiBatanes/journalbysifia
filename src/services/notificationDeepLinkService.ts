/**
 * Notification Deep Link Service
 * Handles navigation from push notifications to specific app screens
 * TODO: Implement full deep linking logic
 */

import { Logger } from '../utils/ProductionLogger';

class NotificationDeepLinkService {
  private navigationRef: any = null;

  /**
   * Set the navigation reference for deep linking
   */
  setNavigationRef(ref: any): void {
    this.navigationRef = ref;
    Logger.info('Navigation reference set for deep linking', {
      component: 'notificationDeepLinkService',
      hasRef: !!ref,
    });
  }

  /**
   * Handle notification tap and navigate to appropriate screen
   */
  handleNotificationTap(notification: any): void {
    try {
      Logger.info('Handling notification tap', {
        component: 'notificationDeepLinkService',
        notificationId: notification?.id,
        deepLink: notification?.data?.deep_link,
      });

      if (!this.navigationRef) {
        Logger.warn('Navigation ref not set, cannot handle deep link', {
          component: 'notificationDeepLinkService',
        });
        return;
      }

      const deepLink = notification?.data?.deep_link;
      if (!deepLink) {
        Logger.warn('No deep link found in notification', {
          component: 'notificationDeepLinkService',
          notificationId: notification?.id,
        });
        return;
      }

      // Parse and navigate to deep link
      this.navigate(deepLink);
    } catch (error) {
      Logger.error('Failed to handle notification tap', error as Error, {
        component: 'notificationDeepLinkService',
        notificationId: notification?.id,
      });
    }
  }

  /**
   * Navigate to a specific deep link
   */
  navigate(deepLink: string): void {
    try {
      Logger.info('Navigating to deep link', {
        component: 'notificationDeepLinkService',
        deepLink,
      });

      if (!this.navigationRef) {
        Logger.warn('Navigation ref not set, cannot navigate', {
          component: 'notificationDeepLinkService',
        });
        return;
      }

      // Parse deep link URL
      // Format: sifia://screen/id or sifia://screen
      const url = deepLink.replace('sifia://', '');
      const parts = url.split('/');
      const screen = parts[0];
      const id = parts[1];

      // Navigate based on screen type
      switch (screen) {
        case 'prayer':
          // Navigate to Journal screen with prayer tab
          this.navigationRef.navigate('Journal', {
            initialTab: 'pray',
            prayerId: id,
          });
          Logger.info('Navigated to prayer', {
            component: 'notificationDeepLinkService',
            prayerId: id,
          });
          break;

        case 'playbook':
          // Navigate to Playbook screen
          this.navigationRef.navigate('Playbook', {
            playbookId: id,
          });
          Logger.info('Navigated to playbook', {
            component: 'notificationDeepLinkService',
            playbookId: id,
          });
          break;

        case 'devotional':
          // Navigate to Devotional screen
          this.navigationRef.navigate('Devotional', {
            devotionalId: id,
          });
          Logger.info('Navigated to devotional', {
            component: 'notificationDeepLinkService',
            devotionalId: id,
          });
          break;

        case 'journal':
          // Navigate to Journal screen
          this.navigationRef.navigate('Journal');
          Logger.info('Navigated to journal', {
            component: 'notificationDeepLinkService',
          });
          break;

        case 'profile':
          // Navigate to Profile screen
          this.navigationRef.navigate('Profile');
          Logger.info('Navigated to profile', {
            component: 'notificationDeepLinkService',
          });
          break;

        default:
          Logger.warn('Unknown deep link screen type', {
            component: 'notificationDeepLinkService',
            screen,
            deepLink,
          });
          break;
      }
    } catch (error) {
      Logger.error('Failed to navigate to deep link', error as Error, {
        component: 'notificationDeepLinkService',
        deepLink,
      });
    }
  }
}

export const notificationDeepLinkService = new NotificationDeepLinkService();

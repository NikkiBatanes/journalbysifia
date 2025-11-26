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

      // Navigate based on screen type - use simple tab navigation
      switch (screen) {
        case 'prayer':
          // Navigate to Journal tab first, then handle prayer navigation
          this.navigationRef.navigate('MainTabs', { screen: 'Journal' });
          // Note: prayerId and initialTab will be handled by the Journal screen itself
          Logger.info('Navigated to Journal for prayer', {
            component: 'notificationDeepLinkService',
            prayerId: id,
          });
          break;

        case 'playbook':
          // Navigate to Playbooks tab
          this.navigationRef.navigate('MainTabs', { screen: 'Playbooks' });
          Logger.info('Navigated to Playbooks', {
            component: 'notificationDeepLinkService',
            playbookId: id,
          });
          break;

        case 'devotional':
          // Navigate to Devotionals tab
          this.navigationRef.navigate('MainTabs', { screen: 'Devotionals' });
          Logger.info('Navigated to Devotionals', {
            component: 'notificationDeepLinkService',
            devotionalId: id,
          });
          break;

        case 'journal':
          // Navigate to Journal tab
          this.navigationRef.navigate('MainTabs', { screen: 'Journal' });
          Logger.info('Navigated to Journal', {
            component: 'notificationDeepLinkService',
          });
          break;

        case 'profile':
          // Navigate to Dashboard tab (Profile is accessed within Dashboard)
          this.navigationRef.navigate('MainTabs', { screen: 'Dashboard' });
          Logger.info('Navigated to Dashboard for Profile', {
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

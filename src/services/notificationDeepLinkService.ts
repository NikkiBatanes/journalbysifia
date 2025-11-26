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

      // Navigate based on screen type - use root-level screen navigation
      switch (screen) {
        case 'prayer':
          // Navigate to Journal screen directly with prayer parameters
          this.navigationRef.navigate('MainTabs', { screen: 'Journal' });
          // Journal screen will handle prayer navigation based on notification data
          Logger.info('Navigated to Journal for prayer', {
            component: 'notificationDeepLinkService',
            prayerId: id,
          });
          break;

        case 'playbook':
          // Navigate to specific PlaybookDetail screen
          if (id) {
            this.navigationRef.navigate('PlaybookDetail', { playbookId: id });
          } else {
            // Navigate to Playbooks tab if no specific ID
            this.navigationRef.navigate('MainTabs', { screen: 'Playbooks' });
          }
          Logger.info('Navigated to Playbook', {
            component: 'notificationDeepLinkService',
            playbookId: id,
          });
          break;

        case 'devotional':
          // Navigate to specific DevotionalDetail screen
          if (id) {
            this.navigationRef.navigate('DevotionalDetail', { devotionalId: id });
          } else {
            // Navigate to Devotionals tab if no specific ID
            this.navigationRef.navigate('MainTabs', { screen: 'Devotionals' });
          }
          Logger.info('Navigated to Devotional', {
            component: 'notificationDeepLinkService',
            devotionalId: id,
          });
          break;

        case 'journal':
          // Navigate to Journal screen directly
          this.navigationRef.navigate('MainTabs', { screen: 'Journal' });
          Logger.info('Navigated to Journal', {
            component: 'notificationDeepLinkService',
          });
          break;

        case 'profile':
          // Navigate to UserProfileModal for direct profile access
          this.navigationRef.navigate('UserProfileModal');
          Logger.info('Navigated to Profile', {
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

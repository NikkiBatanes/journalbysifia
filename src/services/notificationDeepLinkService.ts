import { Logger } from '../utils/ProductionLogger';

export interface DeepLinkRoute {
  screen: string;
  params?: Record<string, any>;
}

/**
 * Deep Link Navigation Service
 * Handles parsing and navigation for notification deep links
 */
class NotificationDeepLinkService {
  private navigationRef: any = null;

  /**
   * Set the navigation reference (called from App.tsx)
   */
  setNavigationRef(ref: any): void {
    this.navigationRef = ref;
  }

  /**
   * Parse a deep link URL and return the route
   */
  parseDeepLink(url: string): DeepLinkRoute | null {
    try {
      // Remove the scheme (sifia://)
      const path = url.replace(/^sifia:\/\//, '');
      
      // Split into path and query params
      const [pathPart, queryPart] = path.split('?');
      const pathSegments = pathPart.split('/').filter(Boolean);

      // Parse query parameters
      const queryParams: Record<string, any> = {};
      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        params.forEach((value, key) => {
          queryParams[key] = value;
        });
      }

      // Map deep links to screens
      return this.mapPathToRoute(pathSegments, queryParams);
    } catch (error) {
      Logger.error('Failed to parse deep link', error as Error, {
        component: 'notificationDeepLinkService',
        url,
      });
      return null;
    }
  }

  /**
   * Map path segments to a route
   */
  private mapPathToRoute(segments: string[], queryParams: Record<string, any>): DeepLinkRoute | null {
    if (segments.length === 0) {
      return { screen: 'DashboardHome' };
    }

    const [primary, secondary, tertiary] = segments;

    switch (primary) {
      case 'journal':
        return this.mapJournalRoute(secondary, queryParams);
      
      case 'devotionals':
        return this.mapDevotionalsRoute(secondary, queryParams);
      
      case 'playbooks':
        return this.mapPlaybooksRoute(secondary, queryParams);
      
      case 'dashboard':
        return this.mapDashboardRoute(secondary, queryParams);
      
      case 'profile':
        return this.mapProfileRoute(secondary, queryParams);
      
      case 'subscription':
        return this.mapSubscriptionRoute(secondary, queryParams);
      
      default:
        Logger.warn('Unknown deep link path', {
          component: 'notificationDeepLinkService',
          path: segments.join('/'),
        });
        return { screen: 'DashboardHome' };
    }
  }

  /**
   * Map journal routes
   */
  private mapJournalRoute(secondary: string | undefined, queryParams: Record<string, any>): DeepLinkRoute {
    const params: Record<string, any> = { ...queryParams };

    if (secondary === 'prayer') {
      params.initialTab = 'prayer';
      if (queryParams.tab === 'requests') {
        params.openRequests = true;
      }
      if (queryParams.answered === 'true' && queryParams.id) {
        params.highlightPrayerId = queryParams.id;
      }
    } else if (secondary === 'gratitude') {
      params.initialTab = 'gratitude';
    } else if (secondary === 'wins') {
      params.initialTab = 'wins';
    }

    return {
      screen: 'Journal',
      params,
    };
  }

  /**
   * Map devotionals routes
   */
  private mapDevotionalsRoute(secondary: string | undefined, queryParams: Record<string, any>): DeepLinkRoute {
    if (secondary === 'today') {
      return {
        screen: 'Devotionals',
        params: { filter: 'today' },
      };
    }

    // Devotional detail with ID
    if (secondary && secondary !== 'today') {
      const params: Record<string, any> = { devotionalId: secondary };
      
      if (queryParams.openReflection === 'true') {
        params.openReflection = true;
      }

      return {
        screen: 'DevotionalDetail',
        params,
      };
    }

    return {
      screen: 'Devotionals',
    };
  }

  /**
   * Map playbooks routes
   */
  private mapPlaybooksRoute(secondary: string | undefined, queryParams: Record<string, any>): DeepLinkRoute {
    if (secondary) {
      const params: Record<string, any> = { playbookId: secondary };
      
      if (queryParams.celebrate === 'true') {
        params.showCelebration = true;
      }

      return {
        screen: 'PlaybookDetail',
        params,
      };
    }

    return {
      screen: 'PlaybookList',
    };
  }

  /**
   * Map dashboard routes
   */
  private mapDashboardRoute(secondary: string | undefined, queryParams: Record<string, any>): DeepLinkRoute {
    const params: Record<string, any> = {};

    if (secondary === 'affirmations') {
      params.scrollTo = 'affirmations';
    } else if (secondary === 'scripture') {
      params.scrollTo = 'scripture';
    }

    return {
      screen: 'DashboardHome',
      params,
    };
  }

  /**
   * Map profile routes
   */
  private mapProfileRoute(secondary: string | undefined, queryParams: Record<string, any>): DeepLinkRoute {
    const params: Record<string, any> = {};

    if (secondary === 'stats') {
      params.scrollTo = 'stats';
    }

    return {
      screen: 'UserProfile',
      params,
    };
  }

  /**
   * Map subscription routes
   */
  private mapSubscriptionRoute(secondary: string | undefined, queryParams: Record<string, any>): DeepLinkRoute {
    if (secondary === 'upgrade') {
      return {
        screen: 'OnboardingSalesOffer',
        params: { upgradeMode: true },
      };
    }

    return {
      screen: 'DashboardHome',
    };
  }

  /**
   * Navigate to a deep link
   */
  navigate(url: string): boolean {
    try {
      if (!this.navigationRef) {
        Logger.error('Navigation ref not set', undefined, {
          component: 'notificationDeepLinkService',
        });
        return false;
      }

      const route = this.parseDeepLink(url);
      if (!route) {
        return false;
      }

      Logger.info('Navigating to deep link', {
        component: 'notificationDeepLinkService',
        url,
        screen: route.screen,
        params: route.params,
      });

      // Main tab screens that should navigate full-screen (not as modals)
      const mainTabScreens = ['DashboardHome', 'PlaybookList', 'Devotionals', 'Journal'];
      
      if (mainTabScreens.includes(route.screen)) {
        // For main tab screens: dismiss any modals and navigate to the tab
        // Use reset to ensure we're at the root of the stack
        this.navigationRef.reset({
          index: 0,
          routes: [
            {
              name: 'MainTabs',
              state: {
                routes: [
                  {
                    name: route.screen,
                    params: route.params,
                  },
                ],
              },
            },
          ],
        });
      } else {
        // For detail screens (PlaybookDetail, DevotionalDetail, etc.), navigate normally
        this.navigationRef.navigate(route.screen, route.params);
      }
      
      return true;
    } catch (error) {
      Logger.error('Failed to navigate deep link', error as Error, {
        component: 'notificationDeepLinkService',
        url,
      });
      return false;
    }
  }

  /**
   * Handle notification tap
   */
  handleNotificationTap(notification: any): void {
    try {
      const { data } = notification;
      
      if (!data) {
        Logger.warn('Notification has no data', {
          component: 'notificationDeepLinkService',
        });
        return;
      }

      // Extract deep link from notification data
      const deepLink = data.deep_link || data.deepLink || data.action;
      
      if (deepLink && typeof deepLink === 'string') {
        this.navigate(deepLink);
      } else {
        // Fallback: navigate to home
        Logger.warn('Notification has no deep link', {
          component: 'notificationDeepLinkService',
          data,
        });
        this.navigationRef?.navigate('DashboardHome');
      }
    } catch (error) {
      Logger.error('Failed to handle notification tap', error as Error, {
        component: 'notificationDeepLinkService',
      });
    }
  }
}

export const notificationDeepLinkService = new NotificationDeepLinkService();

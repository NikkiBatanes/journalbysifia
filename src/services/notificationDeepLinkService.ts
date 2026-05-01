/**
 * Notification Deep Link Service
 * Handles navigation from push notifications to specific app screens
 * TODO: Implement full deep linking logic
 */

import { Logger } from '../utils/ProductionLogger';

class NotificationDeepLinkService {
  private navigationRef: any = null;

  private parseQuery(queryString?: string): Record<string, string> {
    if (!queryString) {
      return {};
    }

    return queryString.split('&').reduce<Record<string, string>>((params, pair) => {
      const [rawKey, rawValue = ''] = pair.split('=');
      if (!rawKey) {
        return params;
      }

      try {
        params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
      } catch {
        params[rawKey] = rawValue;
      }

      return params;
    }, {});
  }

  /**
   * Set the navigation reference for deep linking
   */
  setNavigationRef(ref: any): void {
    this.navigationRef = ref;
    Logger.info('Navigation reference set for deep linking', {
      component: 'notificationDeepLinkService',
      hasRef: !!ref,
      hasCurrent: !!ref?.current,
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

      if (!this.navigationRef || !this.navigationRef.current) {
        Logger.warn('Navigation ref not set, cannot handle deep link', {
          component: 'notificationDeepLinkService',
          hasRef: !!this.navigationRef,
          hasCurrent: !!this.navigationRef?.current,
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
   * Dismiss any open notification modal
   */
  private dismissNotificationModal(): void {
    try {
      // Check if there's a Notifications screen open and dismiss it
      const state = this.navigationRef.current?.getState();
      if (state) {
        const routes = state.routes;
        const currentRoute = routes[routes.length - 1];

        // If the current route is Notifications, go back to dismiss it
        if (currentRoute?.name === 'Notifications') {
          Logger.info('Dismissing notification modal before navigation', {
            component: 'notificationDeepLinkService',
          });
          this.navigationRef.current.goBack();
        }
      }
    } catch (error) {
      Logger.warn('Failed to dismiss notification modal', {
        component: 'notificationDeepLinkService',
        errorMessage: error instanceof Error ? error.message : String(error),
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

      if (!this.navigationRef || !this.navigationRef.current) {
        Logger.warn('Navigation ref not set, cannot navigate', {
          component: 'notificationDeepLinkService',
          hasRef: !!this.navigationRef,
          hasCurrent: !!this.navigationRef?.current,
        });
        return;
      }

      // Dismiss any open notification modal before navigating
      this.dismissNotificationModal();

      // Parse deep link URL.
      // Supported: sifia://screen/id, sifia://screen/id/day/2, and query params.
      const url = deepLink.replace('sifia://', '');
      const [path, queryString] = url.split('?');
      const query = this.parseQuery(queryString);
      const parts = path.split('/').filter(Boolean);
      const screen = parts[0];
      const id = parts[1];

      // Navigate based on screen type - use root-level screen navigation
      switch (screen) {
        case 'prayer':
          // Navigate to Journal screen directly with prayer parameters
          this.navigationRef.current.navigate('MainTabs', { screen: 'Journal' });
          // Journal screen will handle prayer navigation based on notification data
          Logger.info('Navigated to Journal for prayer', {
            component: 'notificationDeepLinkService',
            prayerId: id,
          });
          break;

        case 'playbook':
        case 'playbooks':
          if (id && id !== 'new') {
            const target = parts[2];
            const walkthroughTarget = parts[3];

            if (target === 'walkthrough') {
              const stepMap: Record<string, number> = {
                verse: 2,
                actions: 3,
                prayer: 4,
                words: 5,
                speak: 5,
              };
              const initialStep = stepMap[walkthroughTarget] ?? 0;
              const rawActionIndex = walkthroughTarget === 'actions' ? Number(parts[4]) : undefined;

              this.navigationRef.current.navigate('PlaybookWalkthrough', {
                playbook: { id },
                source: 'playbook_list',
                initialStep,
                ...(Number.isFinite(rawActionIndex) ? { initialActionIndex: rawActionIndex } : {}),
              });
            } else if (target === 'prayer') {
              this.navigationRef.current.navigate('PlaybookWalkthrough', {
                playbook: { id },
                source: 'playbook_list',
                initialStep: 4,
              });
            } else if (target === 'verse') {
              this.navigationRef.current.navigate('PlaybookWalkthrough', {
                playbook: { id },
                source: 'playbook_list',
                initialStep: 2,
              });
            } else if (target === 'speak') {
              this.navigationRef.current.navigate('PlaybookWalkthrough', {
                playbook: { id },
                source: 'playbook_list',
                initialStep: 5,
              });
            } else if (target === 'action') {
              this.navigationRef.current.navigate('PlaybookWalkthrough', {
                playbook: { id },
                source: 'playbook_list',
                initialStep: 3,
              });
            } else {
              this.navigationRef.current.navigate('PlaybookDetail', { playbookId: id });
            }
          } else {
            // Navigate to Playbooks tab if no specific ID
            this.navigationRef.current.navigate('MainTabs', { screen: 'Playbooks' });
          }
          Logger.info('Navigated to Playbook', {
            component: 'notificationDeepLinkService',
            playbookId: id,
          });
          break;

        case 'devotional':
        case 'devotionals':
          // Navigate to specific DevotionalDetail screen
          if (id && id !== 'today' && id !== 'new') {
            const dayIndex = parts.indexOf('day');
            const dayNumber = dayIndex >= 0 ? Number(parts[dayIndex + 1]) : undefined;
            this.navigationRef.current.navigate('DevotionalDetail', {
              devotionalId: id,
              ...(Number.isFinite(dayNumber) ? { initialDay: dayNumber } : {}),
            });
          } else {
            // Navigate to Devotionals tab if no specific ID
            this.navigationRef.current.navigate('MainTabs', { screen: 'Devotionals' });
          }
          Logger.info('Navigated to Devotional', {
            component: 'notificationDeepLinkService',
            devotionalId: id,
          });
          break;

        case 'journal':
          if (id === 'heart' && query.title) {
            this.navigationRef.current.navigate('MainTabs', {
              screen: 'Journal',
              params: {
                screen: 'ReflectionEditor',
                params: {
                  selectedDate: new Date().toISOString(),
                  initialMode: 'guided',
                  initialPrompt: query.title,
                  initialTitle: query.title,
                  lockTitle: true,
                  source: 'guided',
                },
              },
            });
          } else {
            // Navigate to Journal screen directly
            this.navigationRef.current.navigate('MainTabs', { screen: 'Journal' });
          }
          Logger.info('Navigated to Journal', {
            component: 'notificationDeepLinkService',
          });
          break;

        case 'dashboard':
        case 'home':
          this.navigationRef.current.navigate('MainTabs', { screen: 'Overview' });
          Logger.info('Navigated to Dashboard', {
            component: 'notificationDeepLinkService',
          });
          break;

        case 'profile':
          // Navigate to UserProfileModal for direct profile access
          this.navigationRef.current.navigate('UserProfileModal');
          Logger.info('Navigated to Profile', {
            component: 'notificationDeepLinkService',
          });
          break;

        case 'subscription':
          this.navigationRef.current.navigate('OnboardingSalesOffer', {
            upgradeMode: true,
            source: 'notification',
            skipNotificationPreference: true,
          });
          Logger.info('Navigated to subscription offer', {
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

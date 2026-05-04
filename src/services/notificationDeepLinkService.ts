/**
 * Notification Deep Link Service
 * Handles navigation from push notifications to specific app screens
 * TODO: Implement full deep linking logic
 */

import { Logger } from '../utils/ProductionLogger';
import { supabase } from './supabaseClient';

class NotificationDeepLinkService {
  private navigationRef: any = null;
  /** Deep links queued before the navigation ref was ready (cold-start taps) */
  private pendingDeepLink: string | null = null;
  /** Debounce: timestamp of the last successfully started navigation */
  private lastNavigateTimestamp = 0;
  private static readonly NAVIGATE_DEBOUNCE_MS = 1500;

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

  private getNotificationDeepLink(notification: any): string | undefined {
    return notification?.data?.deep_link ||
      notification?.data?.deepLink ||
      notification?.data?.url ||
      notification?.deep_link ||
      notification?.deepLink;
  }

  private async navigateToPrayerById(prayerId: string, options?: { forcePeopleWalkthrough?: boolean }): Promise<boolean> {
    if (!prayerId || !this.navigationRef?.current) {
      return false;
    }

    try {
      const { data: prayer, error } = await supabase
        .from('prayers')
        .select('*')
        .eq('id', prayerId)
        .maybeSingle();

      if (error || !prayer) {
        Logger.warn('Unable to resolve prayer deep link by id', {
          component: 'notificationDeepLinkService',
          prayerId,
          errorMessage: error?.message,
        });
        return false;
      }

      let targetPrayer = prayer;
      const isPrayerRequest = prayer.is_prayer_request === true;

      if (options?.forcePeopleWalkthrough && isPrayerRequest) {
        const { data: linkedPrayer, error: linkedPrayerError } = await supabase
          .from('prayers')
          .select('*')
          .eq('user_id', prayer.user_id)
          .eq('prayer_type', 'people')
          .eq('is_prayer_request', false)
          .eq('metadata->>original_request_id', prayer.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (linkedPrayerError) {
          Logger.warn('Unable to resolve prayed-for prayer from request id', {
            component: 'notificationDeepLinkService',
            prayerId,
            errorMessage: linkedPrayerError.message,
          });
        }

        if (linkedPrayer) {
          targetPrayer = linkedPrayer;
        } else {
          const { data: fallbackPrayer, error: fallbackPrayerError } = await supabase
            .from('prayers')
            .select('*')
            .eq('user_id', prayer.user_id)
            .eq('prayer_type', 'people')
            .eq('is_prayer_request', false)
            .eq('person_name', prayer.person_name)
            .eq('metadata->>original_request_content', prayer.content)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (fallbackPrayerError) {
            Logger.warn('Unable to resolve prayed-for prayer from request fallback data', {
              component: 'notificationDeepLinkService',
              prayerId,
              errorMessage: fallbackPrayerError.message,
            });
          }

          if (fallbackPrayer) {
            targetPrayer = fallbackPrayer;
          }
        }
      }

      const isTargetPrayerRequest = targetPrayer.is_prayer_request === true;

      if (targetPrayer.prayer_type === 'journal') {
        this.navigationRef.current.navigate('PrayerJournalWalkthrough', {
          selectedDate: targetPrayer.selected_date
            ? new Date(`${targetPrayer.selected_date}T12:00:00`).toISOString()
            : undefined,
          initialPrayerType: targetPrayer.journal_category === 'personal_prayer' ? 'open' : 'acts',
          editingPrayerId: targetPrayer.id,
          fromNotificationAnsweredCheck: options?.forcePeopleWalkthrough === true,
        });
      } else
      // Navigate to PrayerEditor for prayer requests (like "pray for now" button)
      // Navigate to PrayersForPeopleWalkthrough for editing existing prayers
      if (isTargetPrayerRequest && !options?.forcePeopleWalkthrough) {
        this.navigationRef.current.navigate('PrayerEditor', {
          prayerRequest: {
            person_name: targetPrayer.person_name || '',
            content: targetPrayer.content || '',
            id: targetPrayer.id,
            user_id: targetPrayer.user_id,
            selected_date: targetPrayer.selected_date || new Date().toLocaleDateString('en-CA'),
          },
        });
      } else {
        this.navigationRef.current.navigate('PrayersForPeopleWalkthrough', {
          initialPersonName: targetPrayer.person_name || '',
          initialPrayerRequest: isTargetPrayerRequest && !options?.forcePeopleWalkthrough ? targetPrayer.content : undefined,
          initialPrayerText: !isTargetPrayerRequest || options?.forcePeopleWalkthrough ? targetPrayer.content : undefined,
          initialPrayerType: isTargetPrayerRequest && !options?.forcePeopleWalkthrough ? 'prayer-request' : 'pray-for-someone',
          editingPrayerId: targetPrayer.id,
          initialTrackAnswered: targetPrayer.metadata?.track_answered,
          fromNotificationAnsweredCheck: options?.forcePeopleWalkthrough === true,
          selectedDate: targetPrayer.selected_date
            ? new Date(`${targetPrayer.selected_date}T12:00:00`).toISOString()
            : undefined,
        });
      }

      Logger.info('Navigated directly to prayer editor from deep link', {
        component: 'notificationDeepLinkService',
        prayerId: targetPrayer.id,
        selectedDate: targetPrayer.selected_date,
        isPrayerRequest: isTargetPrayerRequest,
      });
      return true;
    } catch (error) {
      Logger.error('Failed to navigate to prayer by id', error as Error, {
        component: 'notificationDeepLinkService',
        prayerId,
      });
      return false;
    }
  }

  private getSelectedDateParam(query: Record<string, string>): string {
    const rawDate = query.selectedDate || query.date;
    if (!rawDate) {
      return new Date().toISOString();
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return new Date(`${rawDate}T12:00:00`).toISOString();
    }

    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  private navigateToJournalTarget(target: string | undefined, query: Record<string, string>): void {
    const selectedDate = this.getSelectedDateParam(query);

    switch (target) {
      case 'focus':
      case 'todays-focus':
      case 'todays_focus':
        this.navigationRef.current.navigate('TodaysFocusWalkthrough', { selectedDate });
        return;
      case 'todos':
      case 'todo':
        this.navigationRef.current.navigate('TodosWalkthrough', { selectedDate });
        return;
      case 'win':
      case 'wins':
      case 'todays-win':
      case 'todays_win':
        this.navigationRef.current.navigate('TodaysWinWalkthrough', { selectedDate });
        return;
      case 'looking-forward':
      case 'looking_forward':
      case 'tomorrow':
        this.navigationRef.current.navigate('TomorrowInHisHandsWalkthrough', { selectedDate });
        return;
      case 'gratitude':
        this.navigationRef.current.navigate('MainTabs', {
          screen: 'Journal',
          params: {
            screen: 'JournalMain',
            params: {
              targetSection: 'gratitude',
              selectedDate,
            },
          },
        });
        return;
      case 'prayer':
        // Handle tab parameter for prayer requests
        if (query.tab === 'requests') {
          this.navigationRef.current.navigate('MainTabs', {
            screen: 'Journal',
            params: {
              screen: 'JournalMain',
              params: {
                targetSection: 'prayer',
                openPrayerRequestsTab: true,
                selectedDate,
              },
            },
          });
        } else {
          this.navigationRef.current.navigate('PrayerJournalWalkthrough', { selectedDate });
        }
        return;
      case 'heart':
        // Navigate to dashboard to open guided reflection modal with the question
        console.log('🔔 Heart deep link navigating to dashboard:', { openGuidedReflection: query.openGuidedReflection, question: query.question });
        this.navigationRef.current.navigate('MainTabs', {
          screen: 'Overview',
          params: {
            screen: 'DashboardHome',
            params: {
              ...(query.openGuidedReflection === 'true' ? { openGuidedReflection: true } : {}),
              ...(query.question ? { guidedReflectionQuestion: query.question } : {}),
            },
          },
        });
        return;
      case 'reflections':
      case 'reflection':
        console.log('🔔 Reflection deep link navigating directly to Journal stack ReflectionEditor');
        this.navigationRef.current.navigate('MainTabs', {
          screen: 'Journal',
          params: {
            screen: 'ReflectionEditor',
            params: {
              selectedDate: selectedDate,
              openHeart: true,
            },
          },
        });
        return;
      case 'prayer-people':
        this.navigationRef.current.navigate('PrayersForPeopleWalkthrough');
        return;
      default:
        this.navigationRef.current.navigate('MainTabs', {
          screen: 'Journal',
          params: {
            targetSection: target,
            ...query,
            selectedDate,
          },
        });
    }
  }

  /**
   * Set the navigation reference for deep linking.
   * Flushes any deep link that arrived before the ref was ready (cold-start tap).
   */
  setNavigationRef(ref: any): void {
    this.navigationRef = ref;
    Logger.info('Navigation reference set for deep linking', {
      component: 'notificationDeepLinkService',
      hasRef: !!ref,
      hasCurrent: !!ref?.current,
    });

    // Flush a pending deep link that arrived before navigation was ready
    if (this.pendingDeepLink && ref?.current) {
      const link = this.pendingDeepLink;
      this.pendingDeepLink = null;
      Logger.info('Flushing pending deep link after navigation ref became ready', {
        component: 'notificationDeepLinkService',
        link,
      });
      // Small delay to let the navigator finish mounting
      setTimeout(() => {
        this.navigate(link).catch((error) => {
          Logger.error('Failed to flush pending deep link', error as Error, {
            component: 'notificationDeepLinkService',
            link,
          });
        });
      }, 300);
    }
  }

  /**
   * Navigate to any root-stack screen using the App-level NavigationContainerRef.
   * More reliable than navigateFromRoot for presenting fullScreenModals after
   * nested-navigator modal dismissals on iOS Fabric/Bridgeless.
   */
  navigateTo(routeName: string, params?: Record<string, unknown>): boolean {
    if (!this.navigationRef?.current) {
      Logger.warn('[notificationDeepLinkService] navigateTo: ref not available', {
        routeName,
      });
      return false;
    }
    this.navigationRef.current.navigate(routeName as never, params as never);
    return true;
  }

  /**
   * Handle notification tap and navigate to appropriate screen
   */
  handleNotificationTap(notification: any): void {
    try {
      Logger.info('Handling notification tap', {
        component: 'notificationDeepLinkService',
        notificationId: notification?.id,
        deepLink: this.getNotificationDeepLink(notification),
      });

      const deepLink = this.getNotificationDeepLink(notification);
      if (!deepLink) {
        Logger.warn('No deep link found in notification', {
          component: 'notificationDeepLinkService',
          notificationId: notification?.id,
        });
        return;
      }

      if (!this.navigationRef || !this.navigationRef.current) {
        // Navigation isn't mounted yet (cold-start tap). Queue the link so
        // setNavigationRef() can flush it once the navigator is ready.
        Logger.warn('Navigation ref not ready — queuing deep link for cold-start flush', {
          component: 'notificationDeepLinkService',
          hasRef: !!this.navigationRef,
          deepLink,
        });
        this.pendingDeepLink = deepLink;
        return;
      }

      // Parse and navigate to deep link
      this.navigate(deepLink).catch(error => {
        Logger.error('Unhandled notification deep link navigation failure', error as Error, {
          component: 'notificationDeepLinkService',
          deepLink,
        });
      });
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
  async navigate(deepLink: string): Promise<void> {
    try {
      // Debounce: drop duplicate taps that arrive within the window.
      // This covers both push-notification taps AND in-app notification list taps,
      // preventing React Navigation state corruption when the user taps several
      // notifications in quick succession.
      const now = Date.now();
      if (now - this.lastNavigateTimestamp < NotificationDeepLinkService.NAVIGATE_DEBOUNCE_MS) {
        Logger.info('Deep link navigation debounced — ignoring duplicate tap', {
          component: 'notificationDeepLinkService',
          deepLink,
          msSinceLast: now - this.lastNavigateTimestamp,
        });
        return;
      }
      this.lastNavigateTimestamp = now;

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
          if (id) {
            const didNavigate = await this.navigateToPrayerById(id, {
              forcePeopleWalkthrough: query.mode === 'people',
            });
            if (didNavigate) {
              break;
            }
          }
          this.navigationRef.current.navigate('MainTabs', {
            screen: 'Journal',
            params: {
              targetSection: 'prayer',
              targetPrayerId: id,
              ...query,
            },
          });
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

            console.log('🔔 Playbook deeplink parsed:', { screen, id, target, walkthroughTarget, parts });

            if (target === 'walkthrough') {
              const stepMap: Record<string, number> = {
                verse: 2,
                actions: 3,
                prayer: 4,
                words: 5,
                speak: 5,
                completed: 6,
              };
              const initialStep = stepMap[walkthroughTarget] ?? 0;
              const rawActionIndex = walkthroughTarget === 'actions' ? Number(parts[4]) : undefined;

              console.log('🔔 Navigating to PlaybookWalkthrough with:', { id, initialStep, walkthroughTarget });

              this.navigationRef.current.navigate('PlaybookWalkthrough', {
                playbook: { id },
                source: 'playbook_list',
                initialStep,
                fromNotification: true,
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
            } else if (target === 'devotional') {
              this.navigationRef.current.navigate('PlaybookWalkthrough', {
                playbook: { id },
                source: 'playbook_list',
                initialStep: 6,
              });
            } else {
              // No specific target — open the walkthrough at step 0 (overview).
              // PlaybookWalkthroughScreen detects a partial { id } object and
              // auto-fetches the full playbook, so passing { id } alone is safe.
              this.navigationRef.current.navigate('PlaybookWalkthrough', {
                playbook: { id },
                source: 'playbook_list',
              });
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
          if (id === 'today') {
            // Navigate to today's devotional - need to fetch and navigate
            this.navigationRef.current.navigate('MainTabs', { screen: 'Devotionals', params: { openToday: true } });
          } else if (id && id !== 'new') {
            const dayIndex = parts.indexOf('day');
            const dayNumber = dayIndex >= 0 ? Number(parts[dayIndex + 1]) : undefined;
            this.navigationRef.current.navigate('DevotionalDetail', {
              devotionalId: id,
              ...(Number.isFinite(dayNumber) ? { initialDay: dayNumber } : {}),
              ...(query.scrollToPrayer === 'true' ? { scrollToPrayer: true } : {}),
              ...(query.openReflection === 'true' ? { openReflection: true } : {}),
              ...(query.question ? { reflectionQuestion: query.question } : {}),
              ...(query.questionNumber ? { reflectionQuestionNumber: Number(query.questionNumber) } : {}),
            });
          } else if (id === 'new') {
            // Navigate to create new devotional
            this.navigationRef.current.navigate('MainTabs', { screen: 'Devotionals', params: { createNew: true } });
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
            this.navigateToJournalTarget(id, query);
          } else if (id === 'prayer' && query.id) {
            const didNavigate = await this.navigateToPrayerById(query.id);
            if (!didNavigate) {
              this.navigationRef.current.navigate('MainTabs', {
                screen: 'Journal',
                params: {
                  targetSection: 'prayer',
                  targetPrayerId: query.id,
                  ...query,
                },
              });
            }
          } else {
            this.navigateToJournalTarget(id, query);
          }
          Logger.info('Navigated to Journal', {
            component: 'notificationDeepLinkService',
          });
          break;

        case 'dashboard':
        case 'home':
          console.log('🔔 Dashboard deep link with params:', query);
          this.navigationRef.current.navigate('MainTabs', {
            screen: 'Overview',
            params: {
              screen: 'DashboardHome',
              params: {
                ...(query.openGuidedReflection === 'true' ? { openGuidedReflection: true } : {}),
                ...(query.question ? { guidedReflectionQuestion: query.question } : {}),
              },
            },
          });
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
          if (id === 'upgrade') {
            this.navigationRef.current.navigate('OnboardingSalesOffer', {
              upgradeMode: true,
              source: 'notification',
              skipNotificationPreference: true,
            });
          } else {
            this.navigationRef.current.navigate('OnboardingSalesOffer', {
              upgradeMode: true,
              source: 'notification',
              skipNotificationPreference: true,
            });
          }
          Logger.info('Navigated to subscription offer', {
            component: 'notificationDeepLinkService',
          });
          break;

        case 'userinput':
          this.navigationRef.current.navigate('UserInput', {
            autoFocus: true,
          });
          Logger.info('Navigated to UserInput screen', {
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

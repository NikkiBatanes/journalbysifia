/**
 * siFia - Main Application Component
 * A React Native application for managing playbooks and user content
 */

// Polyfill for URL API in React Native
import 'react-native-url-polyfill/auto';

// Import safe networking manager to prevent blob crashes
import './src/utils/SafeNetworkingManager';

import React, {useState, useEffect} from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {
  View,
  StatusBar,
  StyleSheet,
  LogBox,
  Image,
  AppState,
  AppStateStatus,
  Linking,
} from 'react-native';

import {
  NavigationContainer,
  NavigationContainerRef,
  DarkTheme,
} from '@react-navigation/native';

const AppNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#526A5B',
    card: '#526A5B',
  },
};

import {Colors} from './src/theme/colors';
import {gospelShareService} from './src/services/gospelShareService';
import {gospelStorage} from './src/storage/gospelStorage';
import {getAllRoutineStates} from './src/storage/routineStateStorage';
import {getAllBibleStudySessions} from './src/storage/bibleStudyStorage';
import {getAllLocalJournalEntries} from './src/storage/journalStorage';
import {PrayerApi} from './src/services/api/prayerApi';
import {
  backfillContentImpactHistory,
  backfillGospelImpactHistory,
  backfillSelfGospelAcceptance,
  backfillJournalImpactHistory,
  flushJournalImpactEvents,
  startJournalImpactSync,
} from './src/services/journalImpactAnalyticsService';
import {ThemeProvider} from './src/theme/ThemeContext';
import RootStackNavigator from './src/navigation/RootStackNavigator';

import ActionStepsProviderWrapper from './src/context/ActionStepsProviderWrapper';
import { NetworkErrorBoundary } from './src/components/NetworkErrorBoundary';
import {UserProvider} from './src/context/UserContext';
import AuthStackNavigator from './src/navigation/AuthStackNavigator';
import {LogoutContext} from './src/context/LogoutContext';
import {ScrollProvider} from './src/context/ScrollContext';

import IndustryStandardAuthProvider from './src/context/IndustryStandardAuthContext';
// import AuthGuard from './src/components/AuthGuard'; // unused
import {NetworkStatus} from './src/components/NetworkStatus';
import AuthStateMonitor from './src/components/AuthStateMonitor';
import {OnboardingProvider} from './src/context/OnboardingContext';
// import { OnboardingIntegration } from './src/components/onboarding/OnboardingIntegration'; // unused
import {PointsNotificationProvider} from './src/context/PointsNotificationContext';
import {BadgeNotificationProvider} from './src/context/BadgeNotificationContext';

import {QueryClientProvider} from '@tanstack/react-query';
import {SafeAreaProvider} from 'react-native-safe-area-context';
// Removed ErrorBoundary unused default import (no default export)
import {queryClient} from './src/config/queryClientConfig';
import GlobalFontApplier from './src/components/common/GlobalFontApplier';
import {initializeLogger} from './src/config/logging.config';
import { experiencePreferences } from './src/services/experiencePreferences';
import { initializeMetaAppEvents } from './src/services/metaAppEventsService';
import { onboardingService } from './src/services/onboardingService';
import {
  getJournalOnboardingSetup,
  isJournalOnboardingComplete,
} from './src/services/journalOnboardingState';
import {hydrateDashboardScriptures} from './src/services/dashboardScripturePrefetchService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearLoginFlowRedirect,
  getPostAuthRedirect,
} from './src/utils/postAuthRedirect';
import {clearJournalDevelopmentDataOnce} from './src/dev/clearDevelopmentData';

// Hide debug notifications
LogBox.ignoreLogs(['Warning: ...']); // Ignore specific warnings if needed
LogBox.ignoreAllLogs(); // Ignore all log notifications

// Initialize production-ready logger
initializeLogger();


// Global default font is applied dynamically via GlobalFontApplier using theme.currentFont

const NEW_AUTH_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

const INTRO_AUTH_ROUTES = new Set([
  'Auth',
  'Login',
  'EmailLogin',
  'Register',
  'EmailRegister',
  'TransformJourney',
  'OnboardingWhenToOpenSiFia',
  'OnboardingPosture',
  'OnboardingAccountCreation',
  'OnboardingWelcome',
]);

// Routes a Journal user should never remain on after authentication.
// Covers the Journal first-launch flow plus legacy siFia destinations
// written by legacy post_auth_redirect values.
const JOURNAL_POST_AUTH_EXIT_ROUTES = new Set([
  ...INTRO_AUTH_ROUTES,
  'JournalOnboarding',
  'OnboardingSplash',
  'OnboardingPersonalization',
  'OnboardingNotificationSetup',
]);

const isRecentlyCreatedAuthUser = (createdAt?: string): boolean => {
  if (!createdAt) {
    return false;
  }

  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) {
    return false;
  }

  return Date.now() - createdTime < NEW_AUTH_ACCOUNT_WINDOW_MS;
};

const isOAuthUser = (user: any): boolean => {
  const provider = user?.app_metadata?.provider || user?.identities?.[0]?.provider;
  return provider === 'apple' || provider === 'google';
};

// Main App Component
function App(): React.JSX.Element {
  const [fontsLoaded] = useState(true); // Fonts are auto-linked via RNVectorIcons pod
  const [playbook] = useState<{actionSteps: any[]}>({actionSteps: []});
  const [developmentDataReady, setDevelopmentDataReady] = useState(!__DEV__);

  // Load experience preferences on app startup
  useEffect(() => {
    initializeMetaAppEvents();
    experiencePreferences.loadOnce();
    void clearJournalDevelopmentDataOnce().then(removed => {
      if (removed > 0) {queryClient.invalidateQueries();}
    }).catch(error => {
      console.error('[DevelopmentData] Unable to clear local content', error);
    }).finally(() => {
      setDevelopmentDataReady(true);
    });
  }, []);

  // Vector icon fonts are automatically bundled by RNVectorIcons pod
  // No manual loading required in modern React Native

  if (!developmentDataReady) {
    return (
      <View style={styles.loadingContainer}>
        <Image
          source={require('./assets/images/journalbysifia-splash.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <IndustryStandardAuthProvider>
        <SafeAreaProvider>
          <AppWithAuth fontsLoaded={fontsLoaded} playbook={playbook} />
        </SafeAreaProvider>
      </IndustryStandardAuthProvider>
    </QueryClientProvider>
  );
}

import {useAuth} from './src/context/IndustryStandardAuthContext';
import {useNotificationSetup} from './src/utils/notificationSetup';
import {useMorningWidget} from './src/hooks/useMorningWidget';
import {initializeSentry} from './src/config/sentry';
import * as Sentry from '@sentry/react-native';
import { realtimeManager } from './src/utils/supabaseRealtimeManager';
import { adminAnalyticsService } from './src/services/adminAnalyticsService';

// Initialize Sentry with proper configuration from environment variables
initializeSentry();

function AppWithAuth({
  fontsLoaded,
  playbook,
}: {
  fontsLoaded: boolean;
  playbook: {actionSteps: any[]};
}) {
  const {isAuthenticated, bootstrapping, user, signOut} = useAuth();
  const navigationRef = React.useRef<NavigationContainerRef<any> | null>(null);
  const [currentRouteName, setCurrentRouteName] = useState<string | undefined>(
    undefined,
  );
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const lastHandledLoginRedirectRef = React.useRef<string | null>(null);
  // Journal first-launch flag (local, auth-independent). null = not loaded yet.
  const [journalOnboarded, setJournalOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    const claimFromUrl = (url: string | null) => {
      const match = url?.match(/^sifia:\/\/gospel\/claim\/([^/?#]+)/i);
      if (!match) return;
      gospelShareService.claimResponse(match[1]).catch(() => {});
    };
    Linking.getInitialURL().then(claimFromUrl).catch(() => {});
    const subscription = Linking.addEventListener('url', event => claimFromUrl(event.url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const stopSync = startJournalImpactSync();
    Promise.all([
      gospelStorage.getShareEvents(),
      gospelStorage.getResponse(),
      getAllRoutineStates(),
      PrayerApi.getAllPrayers('local'),
      getAllBibleStudySessions(),
      getAllLocalJournalEntries(),
    ])
      .then(([shares, selfResponse, routines, prayers, bibleStudies, journalEntries]) => Promise.all([
        backfillGospelImpactHistory(shares),
        backfillSelfGospelAcceptance(selfResponse),
        backfillJournalImpactHistory(routines, prayers),
        backfillContentImpactHistory(
          bibleStudies,
          journalEntries.filter(entry => entry.content_type === 'gratitude'),
          journalEntries.filter(entry => entry.content_type === 'today_win'),
        ),
      ]))
      .catch(() => {});
    return stopSync;
  }, []);

  // Linking configuration for deep links - MUST be before any early returns
  // Only enable linking when authenticated to prevent interference with logout
  const linking = React.useMemo(() => {
    if (bootstrapping) {
      return undefined;
    }

    return {
      prefixes: ['sifia://', 'https://sifia.app', 'http://sifia.app'],
      config: {
        screens: {
          // GlobalResetPassword is handled manually via deep link listener
          // to properly extract and pass tokens from hash fragment
          Auth: {
            screens: {
              ForgotPassword: 'forgot-password',
              EmailLogin: 'login',
              Register: 'register',
            },
          },
        },
      },
    };
  }, [bootstrapping]);

  // Initialize notification system (deep links, scheduling, badges)
  useNotificationSetup(user?.id, navigationRef);

  // Morning Home Screen widget: widget deep links + pending check-in sync
  useMorningWidget();

  // Track app state changes for analytics (session tracking)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState === 'active' && nextAppState.match(/inactive|background/)) {
        // App going to background - track session end
        if (isAuthenticated && user?.id) {
          adminAnalyticsService.trackSessionEnd(user.id);
        }
      } else if (appState.match(/inactive|background/) && nextAppState === 'active') {
        void flushJournalImpactEvents().catch(() => {});
        // App coming to foreground - track new session
        if (isAuthenticated && user?.id) {
          adminAnalyticsService.trackAppOpen(user.id);
        }
      }
      setAppState(nextAppState);
    });

    return () => subscription.remove();
  }, [appState, isAuthenticated, user?.id]);

  const HIDE_NETWORK_ON = React.useMemo(
    () =>
      new Set<string>([
        'JournalOnboarding',
        'OnboardingSplash',
        'TransformJourney',
        'OnboardingWelcome',
        'OnboardingPersonalization',
        'OnboardingPlaybookGeneration',
        'OnboardingPlaybookReady',
        'OnboardingPaymentProcessing',
        'OnboardingPaymentConfirmation',
        'OnboardingNotificationSetup',
        // Auth screens - hide network status during authentication
        'Auth',
        'Login',
        'Register',
        'EmailLogin',
        'EmailRegister',
        'ResetPassword',
      ]),
    [],
  );

  // Load Journal first-launch flag once at startup. This is local state
  // (AsyncStorage) and intentionally independent of authentication.
  useEffect(() => {
    let mounted = true;
    Promise.all([
      isJournalOnboardingComplete(),
      getJournalOnboardingSetup(),
    ]).then(async ([done, setup]) => {
      if (done) {
        // Disk-only: restore the selected translation before Today mounts.
        await hydrateDashboardScriptures(setup.bibleVersion);
      }
      if (mounted) { setJournalOnboarded(done); }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (__DEV__) {
      console.log(' siFia App initialized');
    }
    if (isAuthenticated && user?.id) {
      adminAnalyticsService.trackAppOpen(user.id);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || bootstrapping) {
      lastHandledLoginRedirectRef.current = null;
      return;
    }

    let cancelled = false;

    const routeAuthenticatedUser = async () => {
      const navigation = navigationRef.current;
      if (!navigation?.isReady?.()) {
        return;
      }

      const currentRoute = navigation.getCurrentRoute()?.name;

      try {
        // Journal by siFia: once the local first-launch flag is set,
        // post-auth always lands on MainTabs. Legacy post_auth_redirect
        // targets (UserInput, OnboardingPersonalization, ...) belong to
        // siFia flows and are dropped here.
        const journalOnboardedNow = await isJournalOnboardingComplete();
        if (journalOnboardedNow) {
          try {
            await AsyncStorage.removeItem('post_auth_redirect');
          } catch {}
          if (
            !cancelled &&
            currentRoute &&
            JOURNAL_POST_AUTH_EXIT_ROUTES.has(currentRoute)
          ) {
            lastHandledLoginRedirectRef.current = `${user.id}:MainTabs`;
            navigation.reset({
              index: 0,
              routes: [{name: 'MainTabs' as never}],
            });
          }
          return;
        }

        const redirect = await getPostAuthRedirect('App:postAuthRedirect');
        const legacyTarget = redirect?.target;
        const target = ['UserInput', 'GeneratingPlaybook', 'OnboardingPlaybookGeneration', 'OnboardingPlaybookReady'].includes(legacyTarget || '')
          ? 'MainTabs'
          : legacyTarget;
        const params = redirect?.params || {};
        const isLoginFlow = redirect?.is_login_flow === true;
        const redirectKey = `${user.id}:${target || ''}`;
        const isBrandNewOAuthAccount = isOAuthUser(user) && isRecentlyCreatedAuthUser(user.created_at);

        if (isLoginFlow && target && isBrandNewOAuthAccount) {
          await clearLoginFlowRedirect('App:postAuthRedirect:newOAuthAccount');
        } else if (isLoginFlow && target) {
          if (!cancelled && lastHandledLoginRedirectRef.current !== redirectKey) {
            lastHandledLoginRedirectRef.current = redirectKey;
            navigation.reset({
              index: 0,
              routes: [{ name: target as never, params: params as never }],
            });
          }

          await clearLoginFlowRedirect('App:postAuthRedirect');
          return;
        }

        if (currentRoute && INTRO_AUTH_ROUTES.has(currentRoute)) {
          const hasCompleted = await onboardingService.hasCompletedOnboarding(user.id);
          if (!cancelled && hasCompleted) {
            lastHandledLoginRedirectRef.current = `${user.id}:MainTabs`;
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainTabs' as never }],
            });
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[App] Failed to route authenticated user after login:', error);
        }
      }
    };

    const timeout = setTimeout(routeAuthenticatedUser, 50);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [bootstrapping, isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return;
    }

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        // Clean up WebSocket connections to prevent NSInternalInconsistencyException
        try {
          realtimeManager.cleanupAllSubscriptions();
          if (__DEV__) {
            console.log('[App] Cleaned up WebSocket subscriptions on background');
          }
        } catch (error) {
          if (__DEV__) {
            console.error('[App] Error cleaning up subscriptions:', error);
          }
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
      // Clean up WebSocket connections on unmount
      try {
        realtimeManager.cleanupAllSubscriptions();
        if (__DEV__) {
          console.log('[App] Cleaned up WebSocket subscriptions on unmount');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[App] Error cleaning up subscriptions on unmount:', error);
        }
      }
    };
  }, [isAuthenticated, user?.id]);

  // Re-initialize notification setup when navigation ref changes
  useEffect(() => {
    if (navigationRef.current && user?.id) {
      console.log('[App] Navigation ref ready for notifications');
    }
  }, [user?.id]);

  // Only block initial render while bootstrapping the initial session.
  // DO NOT block on transient auth action loading to avoid navigator remounts
  // that can reset to onboarding after failed logins.
  if (!fontsLoaded || bootstrapping || journalOnboarded === null) {
    return (
      <View style={styles.loadingContainer}>
        <Image
          source={require('./assets/images/journalbysifia-splash.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={AppNavigationTheme}
      ref={ref => {
        navigationRef.current = ref;
      }}
      linking={linking as any}
      onReady={() => {
        try {
          const name = navigationRef.current?.getCurrentRoute()?.name;
          setCurrentRouteName(name);
          console.log('[App] Navigation ready, current route:', name);
        } catch (err) {
          console.warn('[App] Error getting current route on ready:', err);
        }
      }}
      onStateChange={() => {
        try {
          const name = navigationRef.current?.getCurrentRoute()?.name;
          setCurrentRouteName(name);
        } catch (err) {
          console.warn(
            '[App] Error getting current route on state change:',
            err,
          );
        }
      }}
      fallback={
        <View style={styles.loadingContainer}>
          <Image
            source={require('./assets/images/journalbysifia-splash.png')}
            style={styles.loadingLogo}
            resizeMode="contain"
          />
        </View>
      }>
      <GestureHandlerRootView style={styles.gestureHandler}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.hopeWhite} />
        <NetworkErrorBoundary name="App">
          <ThemeProvider>
            <GlobalFontApplier />
            <ScrollProvider>
              <ActionStepsProviderWrapper initialSteps={playbook.actionSteps}>
                <UserProvider>
                  <OnboardingProvider>
                    <PointsNotificationProvider>
                      <BadgeNotificationProvider>
                        <LogoutContext.Provider
                        value={{
                          onLogout: async () => {
                            try {
                              await signOut();
                            } catch (error) {
                              console.warn(
                                '[App] LogoutContext signOut failed',
                                error,
                              );
                            }
                          },
                        }}>
                        <AuthStateMonitor>
                          <RootStackNavigator
                            isAuthenticated={isAuthenticated}
                            handleLogin={async () => {}}
                            handleLogout={async () => {}}
                            onLogin={async () => {}}
                            AuthStack={AuthStackNavigator}
                            initialRouteName={
                              journalOnboarded ? 'MainTabs' : 'JournalOnboarding'
                            }
                          />
                          {currentRouteName &&
                          !HIDE_NETWORK_ON.has(currentRouteName) ? (
                            <NetworkStatus />
                          ) : null}
                        </AuthStateMonitor>
                      </LogoutContext.Provider>
                      </BadgeNotificationProvider>
                    </PointsNotificationProvider>
                  </OnboardingProvider>
                </UserProvider>
              </ActionStepsProviderWrapper>
            </ScrollProvider>
          </ThemeProvider>
        </NetworkErrorBoundary>
      </GestureHandlerRootView>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  gestureHandler: {
    flex: 1,
    backgroundColor: Colors.sage,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.sageMuted,
  },
  loadingLogo: {
    width: 240,
    height: 240,
    marginBottom: 16,
  },
});

export default Sentry.wrap(App);

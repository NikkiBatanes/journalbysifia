/**
 * siFia - Main Application Component
 * A React Native application for managing playbooks and user content
 */

// Polyfill for URL API in React Native
import 'react-native-url-polyfill/auto';

import React, { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StatusBar, StyleSheet, LogBox, Image, AppState, AppStateStatus, Linking } from 'react-native';

import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';


import { Colors } from './src/theme/colors';
import { ThemeProvider } from './src/theme/ThemeContext';
import RootStackNavigator from './src/navigation/RootStackNavigator';

import ActionStepsProviderWrapper from './src/context/ActionStepsProviderWrapper';
import { UserProvider } from './src/context/UserContext';
import AuthStackNavigator from './src/navigation/AuthStackNavigator';
import { LogoutContext } from './src/context/LogoutContext';
import { ScrollProvider } from './src/context/ScrollContext';

import IndustryStandardAuthProvider from './src/context/IndustryStandardAuthContext';
// import AuthGuard from './src/components/AuthGuard'; // unused
import { NetworkStatus } from './src/components/NetworkStatus';
import AuthStateMonitor from './src/components/AuthStateMonitor';
import { OnboardingProvider } from './src/context/OnboardingContext';
// import { OnboardingIntegration } from './src/components/onboarding/OnboardingIntegration'; // unused
import { PointsNotificationProvider } from './src/context/PointsNotificationContext';

import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Removed ErrorBoundary unused default import (no default export)
import { queryClient } from './src/config/queryClientConfig';
import GlobalFontApplier from './src/components/common/GlobalFontApplier';
import { initializeLogger } from './src/config/logging.config';

// Hide debug notifications
LogBox.ignoreLogs(['Warning: ...']); // Ignore specific warnings if needed
LogBox.ignoreAllLogs(); // Ignore all log notifications

// Initialize production-ready logger
initializeLogger();

// Global default font is applied dynamically via GlobalFontApplier using theme.currentFont

// Main App Component
function App(): React.JSX.Element {
  const [fontsLoaded] = useState(true); // Vector icons are auto-linked
  const [playbook] = useState<{ actionSteps: any[] }>({ actionSteps: [] });

  // Vector icons are automatically loaded through native linking in modern versions
  // No need for manual font loading

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

import { useAuth } from './src/context/IndustryStandardAuthContext';
import { useNotificationSetup } from './src/utils/notificationSetup';
import { parseDeepLink, getInitialDeepLink, addDeepLinkListener } from './src/utils/deepLinkHandler';

function AppWithAuth({ fontsLoaded, playbook }: { fontsLoaded: boolean; playbook: { actionSteps: any[] } }) {

  const { isAuthenticated, bootstrapping, user, signOut } = useAuth();
  const navigationRef = React.useRef<NavigationContainerRef<any> | null>(null);
  const [currentRouteName, setCurrentRouteName] = useState<string | undefined>(undefined);

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
          GlobalResetPassword: 'reset-password',
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
  useNotificationSetup(user?.id, navigationRef.current);

  // Handle deep links for password reset
  useEffect(() => {
    // Handle deep link while app is running
    const handleDeepLink = (url: string) => {
      console.log('[App] 🔗 Deep link received:', url);
      console.log('[App] 📊 Current state - isAuthenticated:', isAuthenticated, 'bootstrapping:', bootstrapping);
      
      const params = parseDeepLink(url);
      if (!params) {
        console.log('[App] ❌ Failed to parse deep link');
        return;
      }

      console.log('[App] ✅ Parsed deep link:', { type: params.type, hasToken: !!params.accessToken });

      if (params.type === 'reset-password') {
        if (!params.accessToken) {
          console.error('[App] ❌ No access token in reset password link');
          return;
        }

        console.log('[App] 🚀 Navigating to ResetPassword screen...');
        
        // Wait for navigation to be ready, then navigate
        const navigateToReset = () => {
          if (!navigationRef.current) {
            console.log('[App] ⏳ Navigation not ready, retrying...');
            setTimeout(navigateToReset, 100);
            return;
          }

          try {
            console.log('[App] 📍 Navigation ready, navigating now...');
            
            // Get current route to see where we are
            const currentRoute = navigationRef.current.getCurrentRoute();
            console.log('[App] 📍 Current route:', currentRoute?.name);
            
            // Navigate directly to root-level GlobalResetPassword screen
            navigationRef.current.navigate('GlobalResetPassword', {
              access_token: params.accessToken,
              refresh_token: params.refreshToken,
            });
            console.log('[App] ✅ Navigation command sent to GlobalResetPassword');
          } catch (error) {
            console.error('[App] ❌ Navigation error:', error);
          }
        };

        // Start navigation attempt after short delay
        setTimeout(navigateToReset, 500);
      }
    };

    // Handle initial deep link (app opened via link)
    const handleInitialDeepLink = async () => {
      // Wait for bootstrap to complete
      if (bootstrapping) {
        console.log('[App] ⏸️ Waiting for bootstrap to complete...');
        setTimeout(handleInitialDeepLink, 200);
        return;
      }

      console.log('[App] 🔍 Checking for initial deep link...');
      const url = await getInitialDeepLink();
      if (url) {
        console.log('[App] 📧 Initial deep link found:', url);
        handleDeepLink(url);
      } else {
        console.log('[App] ℹ️ No initial deep link');
      }
    };

    handleInitialDeepLink();

    // Listen for deep links while app is running
    const subscription = addDeepLinkListener(handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, bootstrapping, signOut]);

  const HIDE_NETWORK_ON = React.useMemo(() => new Set<string>([
    'OnboardingSplash',
    'TransformJourney',
    'OnboardingWelcome',
    'OnboardingPersonalization',
    'OnboardingPlaybookGeneration',
    'OnboardingPlaybookReady',
    'OnboardingSalesOffer',
    'OnboardingTrialOffer',
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
  ]), []);

  useEffect(() => {
    // Initialize app-level services
    console.log(' siFia App initialized');

    // ENTERPRISE: Sync subscription status on app launch
    const syncSubscriptionStatus = async () => {
      if (isAuthenticated && user?.id) {
        try {
          const { AppleStoreKitService } = await import('./src/services/AppleStoreKitService');

          console.log('[App] Syncing subscription status on launch...');
          const storeKit = AppleStoreKitService.getInstance();
          await storeKit.checkAndSyncSubscriptionStatus(user.id);
          console.log('[App] Subscription status synced');
        } catch (error) {
          console.error('[App] Failed to sync subscription status:', error);
        }
      }
    };

    syncSubscriptionStatus();
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return;
    }

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        (async () => {
          try {
            const { AppleStoreKitService } = await import('./src/services/AppleStoreKitService');
            const storeKit = AppleStoreKitService.getInstance();
            await storeKit.checkAndSyncSubscriptionStatus(user.id);
          } catch (error) {
            console.error('[App] Failed to sync subscription status on foreground:', error);
          }
        })();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
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
  if (!fontsLoaded || bootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <Image
          source={require('./assets/icons/siFiaTransparent.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={(ref) => {
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
          console.warn('[App] Error getting current route on state change:', err);
        }
      }}
      fallback={
        <View style={styles.loadingContainer}>
          <Image
            source={require('./assets/icons/siFiaTransparent.png')}
            style={styles.loadingLogo}
            resizeMode="contain"
          />
        </View>
      }
    >
      <GestureHandlerRootView style={styles.gestureHandler}>


        <StatusBar barStyle="dark-content" backgroundColor={Colors.hopeWhite} />
        <ThemeProvider>
          <GlobalFontApplier />
          <ScrollProvider>
            <ActionStepsProviderWrapper initialSteps={playbook.actionSteps}>
              <UserProvider>
                <OnboardingProvider>
                  <PointsNotificationProvider>
                    <LogoutContext.Provider
                      value={{
                        onLogout: async () => {
                          try {
                            await signOut();
                          } catch (error) {
                            console.warn('[App] LogoutContext signOut failed', error);
                          }
                        },
                      }}
                    >
                      <AuthStateMonitor>
                        <RootStackNavigator
                          isAuthenticated={isAuthenticated}
                          handleLogin={async () => {}}
                          handleLogout={async () => {}}
                          onLogin={async () => {}}
                          AuthStack={AuthStackNavigator}
                        />
                        {currentRouteName && !HIDE_NETWORK_ON.has(currentRouteName) ? (
                          <NetworkStatus />
                        ) : null}
                      </AuthStateMonitor>
                    </LogoutContext.Provider>
                  </PointsNotificationProvider>
                </OnboardingProvider>
              </UserProvider>
            </ActionStepsProviderWrapper>
          </ScrollProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  gestureHandler: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.anchorBlue,
  },
  loadingLogo: {
    width: 160,
    height: 160,
    marginBottom: 16,
  },
});

export default App;

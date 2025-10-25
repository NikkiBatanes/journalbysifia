/**
 * siFia - Main Application Component
 * A React Native application for managing playbooks and user content
 */

// Polyfill for URL API in React Native
import 'react-native-url-polyfill/auto';

import React, { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StatusBar, StyleSheet, LogBox, Image } from 'react-native';

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

// Hide debug notifications
LogBox.ignoreLogs(['Warning: ...']); // Ignore specific warnings if needed
LogBox.ignoreAllLogs(); // Ignore all log notifications

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

function AppWithAuth({ fontsLoaded, playbook }: { fontsLoaded: boolean; playbook: { actionSteps: any[] } }) {

  const { isAuthenticated, bootstrapping, user } = useAuth();
  const navigationRef = React.useRef<NavigationContainerRef<any> | null>(null);
  const [currentRouteName, setCurrentRouteName] = useState<string | undefined>(undefined);

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


        <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
        <ThemeProvider>
          <GlobalFontApplier />
          <ScrollProvider>
            <ActionStepsProviderWrapper initialSteps={playbook.actionSteps}>
              <UserProvider>
                <OnboardingProvider>
                  <PointsNotificationProvider>
                    <LogoutContext.Provider value={{ onLogout: async () => {} }}>
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

/**
 * siFia - Main Application Component
 * A React Native application for managing playbooks and user content
 */

// Polyfill for URL API in React Native
import 'react-native-url-polyfill/auto';

import React, { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StatusBar, ActivityIndicator, StyleSheet, LogBox, Text as RNText, TextInput as RNTextInput } from 'react-native';

import { NavigationContainer } from '@react-navigation/native';

import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors } from './src/theme/colors';
import { ThemeProvider } from './src/theme/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import RootStackNavigator from './src/navigation/RootStackNavigator';

import ActionStepsProviderWrapper from './src/context/ActionStepsProviderWrapper';
import { UserProvider } from './src/context/UserContext';
import AuthStackNavigator from './src/navigation/AuthStackNavigator';
import { LogoutContext } from './src/context/LogoutContext';
import { ScrollProvider } from './src/context/ScrollContext';

import IndustryStandardAuthProvider from './src/context/IndustryStandardAuthContext';
// import AuthGuard from './src/components/AuthGuard'; // unused
import { QueryProvider } from './src/providers/QueryProvider';
import { NetworkStatus } from './src/components/NetworkStatus';
import AuthStateMonitor from './src/components/AuthStateMonitor';
import { OnboardingProvider } from './src/context/OnboardingContext';
// import { OnboardingIntegration } from './src/components/onboarding/OnboardingIntegration'; // unused
import { PointsNotificationProvider } from './src/context/PointsNotificationContext';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from './src/components/ErrorBoundary/ErrorBoundary';
import { queryClient } from './src/config/queryClientConfig';
import { trialExpiryService } from './src/services/TrialExpiryService';
import GlobalFontApplier from './src/components/common/GlobalFontApplier';

// Hide debug notifications
LogBox.ignoreLogs(['Warning: ...']); // Ignore specific warnings if needed
LogBox.ignoreAllLogs(); // Ignore all log notifications

// Global default font is applied dynamically via GlobalFontApplier using theme.currentFont

// Main App Component
function App(): React.JSX.Element {
  const [fontsLoaded, setFontsLoaded] = useState(true); // Vector icons are auto-linked
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

  const { isAuthenticated, bootstrapping } = useAuth();

  useEffect(() => {
    // Initialize app-level services
    console.log(' siFia App initialized');
    
    // Start trial expiry monitoring
    trialExpiryService.checkAndHandleExpiredTrials();
    trialExpiryService.scheduleTrialExpiryCheck();
  }, []);

  // Only block initial render while bootstrapping the initial session.
  // Do NOT block on transient auth action loading to avoid navigator remounts
  // that can reset to onboarding after failed logins.
  if (!fontsLoaded || bootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.anchorBlue} />
      </View>
    );
  }

  return (
    <NavigationContainer>
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
                      {/* OnboardingIntegration temporarily disabled to fix email registration flow */}
                      {/* <OnboardingIntegration> */}
                        <RootStackNavigator
                          isAuthenticated={isAuthenticated}
                          handleLogin={async () => {}}
                          handleLogout={async () => {}}
                          onLogin={async () => {}}
                          AuthStack={AuthStackNavigator}
                        />
                        <NetworkStatus />
                      {/* </OnboardingIntegration> */}
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
    backgroundColor: Colors.hopeWhite,
  },
});

export default App;

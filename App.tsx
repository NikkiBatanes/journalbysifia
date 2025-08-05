/**
 * siFia - Main Application Component
 * A React Native application for managing playbooks and user content
 */

// Polyfill for URL API in React Native
import 'react-native-url-polyfill/auto';

import React, { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StatusBar, ActivityIndicator, StyleSheet, LogBox } from 'react-native';
import DevAdminFloatingButton from './src/components/admin/DevAdminFloatingButton';
import DevAdminPanelModal from './src/components/admin/DevAdminPanelModal';
import { NavigationContainer } from '@react-navigation/native';

import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors } from './src/theme/colors';
import RootStackNavigator from './src/navigation/RootStackNavigator';

import ActionStepsProviderWrapper from './src/context/ActionStepsProviderWrapper';
import { UserProvider } from './src/context/UserContext';
import AuthStackNavigator from './src/navigation/AuthStackNavigator';
import { LogoutContext } from './src/context/LogoutContext';
// import { DevotionalProvider } from './src/context/DevotionalContext'; // Removed - migrated to React Query
import { ScrollProvider } from './src/context/ScrollContext';

import IndustryStandardAuthProvider from './src/context/IndustryStandardAuthContext';
import AuthGuard from './src/components/AuthGuard';
import { QueryProvider } from './src/providers/QueryProvider';
import { NetworkStatus } from './src/components/NetworkStatus';
import AuthStateMonitor from './src/components/AuthStateMonitor';
import { OnboardingProvider } from './src/context/OnboardingContext';
import { OnboardingIntegration } from './src/components/onboarding/OnboardingIntegration';

// Stack navigator removed as it's not currently used

// Hide debug notifications
LogBox.ignoreLogs(['Warning: ...']); // Ignore specific warnings if needed
LogBox.ignoreAllLogs(); // Ignore all log notifications

// Main App Component
function App(): React.JSX.Element {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [playbook] = useState<{ actionSteps: any[] }>({ actionSteps: [] });

  // Load custom fonts and icon fonts
  useEffect(() => {
    let isMounted = true;
    const loadFonts = async () => {
      try {
        await Promise.all([
          Ionicons.loadFont(),
          MaterialCommunityIcons.loadFont(),
        ]);
      } catch (error) {
        console.warn('Error loading fonts:', error);
      } finally {
        if (isMounted) {
          setFontsLoaded(true);
        }
      }
    };
    loadFonts();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <QueryProvider>
      <IndustryStandardAuthProvider>
        <AppWithAuth fontsLoaded={fontsLoaded} playbook={playbook} />
      </IndustryStandardAuthProvider>
    </QueryProvider>
  );
}

function AppWithAuth({ fontsLoaded, playbook }: { fontsLoaded: boolean; playbook: { actionSteps: any[] } }) {
  const [adminPanelVisible, setAdminPanelVisible] = useState(false);
  
  const handleOpenAdminPanel = () => {
    console.log('🟢 Opening admin panel...');
    setAdminPanelVisible(true);
  };
  
  const handleCloseAdminPanel = () => {
    console.log('🔴 Closing admin panel...');
    setAdminPanelVisible(false);
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.anchorBlue} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <GestureHandlerRootView style={styles.gestureHandler}>
        {/* DEV-ONLY: Floating button */}
        {__DEV__ && (
          <DevAdminFloatingButton onPress={handleOpenAdminPanel} />
        )}

        <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
        <ScrollProvider>
          <ActionStepsProviderWrapper initialSteps={playbook.actionSteps}>
            <UserProvider>
              <OnboardingProvider>
                <LogoutContext.Provider value={{ onLogout: async () => {} }}>
                  <AuthStateMonitor>
                    <AuthGuard>
                      <OnboardingIntegration>
                        <RootStackNavigator
                          isAuthenticated={true} // Will be managed by AuthGuard
                          handleLogin={async () => {}}
                          handleLogout={async () => {}}
                          onLogin={async () => {}}
                          AuthStack={AuthStackNavigator}
                        />
                        <NetworkStatus />

                        {/* DEV-ONLY: Admin panel modal inside OnboardingProvider context */}
                        {__DEV__ && (
                          <DevAdminPanelModal visible={adminPanelVisible} onClose={handleCloseAdminPanel} />
                        )}
                      </OnboardingIntegration>
                    </AuthGuard>
                  </AuthStateMonitor>
                </LogoutContext.Provider>
              </OnboardingProvider>
            </UserProvider>
          </ActionStepsProviderWrapper>
        </ScrollProvider>
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

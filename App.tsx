/**
 * siFia - Main Application Component
 * A React Native application for managing playbooks and user content
 */

// Polyfill for URL API in React Native
import 'react-native-url-polyfill/auto';

import React, { useState, useEffect, useCallback } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StatusBar, ActivityIndicator, StyleSheet, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors } from './src/theme/colors';
import RootStackNavigator from './src/navigation/RootStackNavigator';
import { checkAuth, clearSession } from './src/services/supabaseApi';
import ActionStepsProviderWrapper from './src/context/ActionStepsProviderWrapper';
import { UserProvider } from './src/context/UserContext';
import AuthStackNavigator from './src/navigation/AuthStackNavigator';
import { LogoutContext } from './src/context/LogoutContext';
import { DevotionalProvider } from './src/context/DevotionalContext';
import { ScrollProvider } from './src/context/ScrollContext';
import { PrayerProvider } from './src/context/PrayerContext';

// Stack navigator removed as it's not currently used

// Hide debug notifications
LogBox.ignoreLogs(['Warning: ...']); // Ignore specific warnings if needed
LogBox.ignoreAllLogs(); // Ignore all log notifications

// Main App Component
function App(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [playbook] = useState<{ actionSteps: any[] }>({ actionSteps: [] });

  // Load custom fonts and icon fonts
  useEffect(() => {
    let isMounted = true;

    const loadFonts = async () => {
      try {
        // Load any custom fonts here if needed
        // Example:
        // await Font.loadAsync({
        //   'Custom-Font': require('./assets/fonts/CustomFont.ttf'),
        // });

        // Load icon fonts
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

  // Check if user is logged in on app start
  useEffect(() => {
    const checkUser = async () => {
      try {
        const isLoggedIn = await checkAuth();
        setIsAuthenticated(!!isLoggedIn);
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkUser();
  }, []);

  // Handle successful login
  const handleLogin = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await clearSession();
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  // Combine loading states
  const isAppReady = fontsLoaded && !isLoading;

  // Show loading state while app is getting ready
  if (!isAppReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.anchorBlue} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureHandler}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
      <ScrollProvider>
        <ActionStepsProviderWrapper initialSteps={playbook.actionSteps}>
          <PrayerProvider>
            <DevotionalProvider>
              <UserProvider>
                <LogoutContext.Provider value={{ onLogout: handleLogout }}>
                  <NavigationContainer>
                    {isAuthenticated ? (
                      <RootStackNavigator
                        isAuthenticated={isAuthenticated}
                        handleLogin={handleLogin}
                        handleLogout={handleLogout}
                        onLogin={handleLogin}
                        AuthStack={AuthStackNavigator}
                      />
                    ) : (
                      <AuthStackNavigator onLogin={handleLogin} />
                    )}
                  </NavigationContainer>
                </LogoutContext.Provider>
              </UserProvider>
            </DevotionalProvider>
          </PrayerProvider>
        </ActionStepsProviderWrapper>
      </ScrollProvider>
    </GestureHandlerRootView>
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

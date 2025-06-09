/**
 * AnchoredApp - Main Application Component
 * A React Native application for managing playbooks and user content
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StatusBar, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';



// Import theme colors
import { Colors } from './src/theme/colors'; // (Keep this if App.tsx is at project root)
// If this still fails, try: import { Colors } from './theme/colors';
// (But based on your structure, the current path should be correct)
import LoadingScreen from './src/components/LoadingScreen';

// Import vector icons


import { TabBarIcons } from './src/constants/tabBarIcons';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import RootStackNavigator from './src/navigation/RootStackNavigator';
import { checkAuth, signOut } from './src/services/supabaseApi';

// Screens

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import UserInputScreen from './src/screens/UserInputScreen';
import PlaybookListScreen from './src/screens/PlaybookListScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import PlaybookDetailScreen from './src/screens/PlaybookDetailScreen';

import CardDetailScreen from './src/screens/CardDetailScreen';
import ActionStepsProviderWrapper from './src/context/ActionStepsProviderWrapper';


// Types
import { RootStackParamList, BottomTabParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

import AuthStackNavigator from './src/navigation/AuthStackNavigator';

import { UserProvider } from './src/context/UserContext';

// Main App Component
function App(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [playbook, setPlaybook] = useState<{ actionSteps: any[] }>({ actionSteps: [] });



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
      await signOut();
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.hopeWhite }}>
        <ActivityIndicator size="large" color={Colors.anchorBlue} />
      </View>
    );
  }



  return (
    <UserProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ActionStepsProviderWrapper initialSteps={playbook.actionSteps}>
          <NavigationContainer>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.hopeWhite} />
            <RootStackNavigator
              isAuthenticated={isAuthenticated}
              handleLogout={handleLogout}
              handleLogin={handleLogin}
              AuthStack={AuthStackNavigator}
            />
          </NavigationContainer>
        </ActionStepsProviderWrapper>
      </GestureHandlerRootView>
    </UserProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
});

export default App;

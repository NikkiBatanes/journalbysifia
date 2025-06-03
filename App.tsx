/**
 * AnchoredApp - Main Application Component
 * A React Native application for managing playbooks and user content
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StyleSheet, StatusBar, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Font from 'expo-font';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
// Define tab bar icon types
type TabBarIcon = {
  name: string;
  focused: string;
};

type TabBarIconsType = {
  [key: string]: TabBarIcon;
};

// Import theme colors
import { Colors } from './src/theme';

// Import vector icons
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Define the icon names type
type IconName = 'home-outline' | 'home' | 'book-outline' | 'book' | 'person-outline' | 'person';

// Tab bar icons using Ionicons
const TabBarIcons: Record<string, { name: IconName; focused: IconName }> = {
  Home: { name: 'home-outline', focused: 'home' },
  Playbooks: { name: 'book-outline', focused: 'book' },
  Profile: { name: 'person-outline', focused: 'person' }
};
import { checkAuth, signOut } from './src/services/supabaseApi';

// Screens
import AppSplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import UserInputScreen from './src/screens/UserInputScreen';
import PlaybookListScreen from './src/screens/PlaybookListScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import PlaybookDetailScreen from './src/screens/PlaybookDetailScreen';
import CardDetailScreen from './src/screens/CardDetailScreen';
import { ActionStepsProvider } from './src/context/ActionStepsContext';
import { getMockPlaybook } from './src/mocks/playbookMocks';
const playbook = getMockPlaybook();

// Types
import { RootStackParamList, BottomTabParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Main App Tabs
function MainTabs({ onLogout }: { onLogout: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          const iconName = focused 
            ? TabBarIcons[route.name as keyof typeof TabBarIcons].focused 
            : TabBarIcons[route.name as keyof typeof TabBarIcons].name;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.anchorBlue,
        tabBarInactiveTintColor: Colors.trustGrey,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 4,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={UserInputScreen} 
        options={{ title: 'New Playbook' }}
      />
      <Tab.Screen 
        name="Playbooks" 
        component={PlaybookListScreen} 
        options={{ title: 'My Playbooks' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={UserProfileScreen} 
        options={{ 
          title: 'Profile',
          headerShown: true,
          headerRight: () => (
            <Text 
              style={{ fontSize: 20, color: '#FF3B30', marginRight: 15 }}
              onPress={onLogout}
            >
              🚪
            </Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Auth Stack
function AuthStack({ onLogin }: { onLogin: () => void }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login">
        {(props) => (
          <LoginScreen 
            {...props} 
            onLogin={onLogin} 
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Register">
        {(props) => (
          <RegisterScreen 
            {...props} 
            onRegister={onLogin} 
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

// Main App Component
function App(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

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
          MaterialCommunityIcons.loadFont()
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ActionStepsProvider initialSteps={playbook.actionSteps}>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {isAuthenticated ? (
              <>
                <Stack.Screen name="MainTabs">
                  {() => <MainTabs onLogout={handleLogout} />}
                </Stack.Screen>
                <Stack.Screen 
                  name="PlaybookDetail" 
                  component={PlaybookDetailScreen as React.ComponentType} 
                  options={({ navigation }) => {
                    return {
                      headerShown: true,
                      title: '',
                      headerBackVisible: false,
                      headerLeft: () => (
                        <TouchableOpacity 
                          onPress={() => navigation.goBack()}
                          style={{ marginLeft: 0, padding: 8, paddingLeft: 0 }}
                        >
                          <Ionicons name="chevron-back" size={24} color={Colors.anchorBlue} />
                        </TouchableOpacity>
                      ),
                      headerRight: () => (
                        <View style={{ marginRight: 16, overflow: 'hidden', borderRadius: 16 }}>
                          <Image 
                            source={{ uri: 'https://randomuser.me/api/portraits/women/44.jpg' }} 
                            style={{ width: 32, height: 32, borderRadius: 16 }}
                            resizeMode="cover"
                          />
                        </View>
                      ),
                      headerStyle: {
                        backgroundColor: '#f2f5f7',
                      },
                      headerShadowVisible: false,
                    }
                  }}
                />
              <Stack.Screen 
                name="CardDetail"
                component={CardDetailScreen as React.ComponentType}
                options={({ navigation }) => ({
                  headerShown: true,
                  title: '',
                  headerBackVisible: false,
                  headerLeft: () => (
                    <TouchableOpacity 
                      onPress={() => navigation.goBack()}
                      style={{ marginLeft: 0, padding: 8, paddingLeft: 0 }}
                    >
                      <Ionicons name="chevron-back" size={24} color={Colors.hopeWhite} />
                    </TouchableOpacity>
                  ),
                  headerRight: () => (
                    <View style={{ marginRight: 16, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                      <Image 
                        source={{ uri: 'https://randomuser.me/api/portraits/women/44.jpg' }} 
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                        resizeMode="cover"
                      />
                    </View>
                  ),
                  headerStyle: {
                    backgroundColor: Colors.anchorBlue,
                  },
                  headerTintColor: Colors.hopeWhite,
                  headerShadowVisible: false,
                })}
              />
            </>
            ) : (
              <Stack.Screen name="AuthStack">
                {() => <AuthStack onLogin={handleLogin} />}
              </Stack.Screen>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </ActionStepsProvider>
    </GestureHandlerRootView>
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

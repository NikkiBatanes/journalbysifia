/**
 * AnchoredApp - Main Application Component
 * A React Native application for managing playbooks and user content
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, StatusBar, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Font from 'expo-font'; // Using expo-font directly
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

// Tab bar icons using text as fallback
const TabBarIcons: TabBarIconsType = {
  Home: { name: '📝', focused: '📝' },
  Playbooks: { name: '📚', focused: '📚' },
  Profile: { name: '👤', focused: '👤' }
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

// Types
import { RootStackParamList, BottomTabParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Main App Tabs
function MainTabs({ onLogout }: { onLogout: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let icon = TabBarIcons.Home;
          
          if (route.name === 'Home') {
            icon = TabBarIcons.Home;
          } else if (route.name === 'Playbooks') {
            icon = TabBarIcons.Playbooks;
          } else if (route.name === 'Profile') {
            icon = TabBarIcons.Profile;
          }
          
          const iconText = focused ? icon.focused : icon.name;
          return <Text style={{ fontSize: size, color }}>{iconText}</Text>;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          paddingTop: 5,
          height: 60,
          paddingBottom: 5,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 5,
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

  // Load custom fonts
  useEffect(() => {
    let isMounted = true;
    
    const loadFonts = async () => {
      try {
        // Try to load the fonts
        await Font.loadAsync({
          // Using system fonts as fallbacks
          'PlayfairDisplay-Regular': require('react-native-vector-icons/Fonts/Feather.ttf'),
          'PlayfairDisplay-Bold': require('react-native-vector-icons/Fonts/Feather.ttf'),
        });
      } catch (error) {
        console.warn('Error loading custom fonts, using system fonts:', error);
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
  }, []); // Empty dependency array means this runs once on mount

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
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                      <Icon name="chevron-left" size={26} color={Colors.anchorBlue} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  ),
                  headerRight: () => (
                    <Image
                      source={{ uri: 'https://randomuser.me/api/portraits/men/1.jpg' }}
                      style={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: 16, 
                        marginRight: 16 
                      }}
                    />
                  ),
                  headerStyle: {
                    backgroundColor: '#f2f5f7',
                  },
                  headerShadowVisible: false,
                }
              }}
            />
          </>
        ) : (
          <Stack.Screen name="AuthStack">
            {() => <AuthStack onLogin={handleLogin} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
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

// =====================================================
// EXAMPLE: How to integrate the trial system into your main App.tsx
// =====================================================
// Copy the relevant parts into your existing App.tsx file

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import the trial system
import { TrialProvider } from './providers/TrialProvider';
import { TrialStatusBanner } from './components/TrialStatusBanner';
import { AuthProvider } from './providers/AuthProvider'; // Your existing auth provider

// Your existing screens
import { HomeScreen } from './screens/HomeScreen';
import { JournalingScreen } from './screens/JournalingScreen';
import { PlaybookScreen } from './screens/PlaybookScreen';
import { SubscriptionScreen } from './screens/SubscriptionScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        {/* Wrap your app with TrialProvider */}
        <TrialProvider>
          <NavigationContainer>
            <StatusBar style="auto" />

            {/* Add trial banner at the top level */}
            <TrialStatusBanner />

            <Stack.Navigator
              initialRouteName="Home"
              screenOptions={{
                headerStyle: {
                  backgroundColor: '#6366F1',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            >
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ title: 'siFia - Spiritual Growth' }}
              />
              <Stack.Screen
                name="Journaling"
                component={JournalingScreen}
                options={{ title: 'Journaling' }}
              />
              <Stack.Screen
                name="Playbooks"
                component={PlaybookScreen}
                options={{ title: 'Spiritual Playbooks' }}
              />
              <Stack.Screen
                name="Subscription"
                component={SubscriptionScreen}
                options={{ title: 'Upgrade Plan' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </TrialProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// =====================================================
// ALTERNATIVE: If you prefer a more minimal integration
// =====================================================

/*
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrialStatusBanner } from './components/TrialStatusBanner';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourExistingApp />
      <TrialStatusBanner />
    </QueryClientProvider>
  );
}
*/

// src/navigation/HomeStackNavigator.tsx
import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardHomeScreen from '../screens/DashboardHomeScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
// StreakDetailScreen removed; dashboard provides streak information

const Stack = createNativeStackNavigator();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="DashboardHome"
        component={DashboardHomeScreen as React.ComponentType}
        options={{
          headerShown: false,
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: Platform.OS === 'android' ? 'transparentModal' : 'modal',
          animation: Platform.OS === 'android' ? 'none' : 'slide_from_bottom',
          gestureEnabled: Platform.OS === 'android' ? false : true,
          contentStyle: Platform.OS === 'android' ? { backgroundColor: 'transparent' } : undefined,
        }}
      />
      {/* StreakDetail route removed */}
    </Stack.Navigator>
  );
}

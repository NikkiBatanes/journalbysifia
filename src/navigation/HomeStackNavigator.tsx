// src/navigation/HomeStackNavigator.tsx
import React from 'react';
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
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
        }}
      />
      {/* StreakDetail route removed */}
    </Stack.Navigator>
  );
}

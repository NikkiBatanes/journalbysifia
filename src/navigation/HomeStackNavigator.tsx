// src/navigation/HomeStackNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardHomeScreen from '../screens/DashboardHomeScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import StreakDetailScreen from '../screens/StreakDetailScreen';

const Stack = createNativeStackNavigator();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardHome" component={DashboardHomeScreen as React.ComponentType} />
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
      <Stack.Screen
        name="StreakDetail"
        component={StreakDetailScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />
    </Stack.Navigator>
  );
}

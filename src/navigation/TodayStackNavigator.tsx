// src/navigation/TodayStackNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TodayScreen from '../screens/TodayScreen';
import DevReviewTriggersScreen from '../screens/DevReviewTriggersScreen';

const Stack = createNativeStackNavigator();

const TodayStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="TodayHome"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="TodayHome" component={TodayScreen as React.ComponentType} />
      <Stack.Screen
        name="DevReviewTriggers"
        component={DevReviewTriggersScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          contentStyle: { backgroundColor: '#F6F5EF' },
        }}
      />
    </Stack.Navigator>
  );
};

export default TodayStackNavigator;

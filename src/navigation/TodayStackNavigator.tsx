// src/navigation/TodayStackNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TodayScreen from '../screens/TodayScreen';

const Stack = createNativeStackNavigator();

const TodayStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="TodayHome"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="TodayHome" component={TodayScreen as React.ComponentType} />
    </Stack.Navigator>
  );
};

export default TodayStackNavigator;

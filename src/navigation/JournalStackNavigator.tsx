// src/navigation/JournalStackNavigator.tsx
import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import JournalScreen from '../screens/JournalScreen';
import { MomentsScreen } from '../screens/MomentsScreen';
import TimeBlockEditorScreen from '../screens/TimeBlockEditorScreen';
import ReflectionEditorScreen from '../screens/ReflectionEditorScreen';

const Stack = createNativeStackNavigator();

const JournalStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JournalMain" component={JournalScreen as React.ComponentType} />
      <Stack.Screen
        name="JournalMoments"
        component={MomentsScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: Platform.OS === 'android' ? 'transparentModal' : 'modal',
          animation: Platform.OS === 'android' ? 'none' : 'slide_from_bottom',
          gestureEnabled: true,
          contentStyle: Platform.OS === 'android' ? { backgroundColor: 'transparent' } : undefined,
        }}
      />
      <Stack.Screen
        name="TimeBlockEditor"
        component={TimeBlockEditorScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          // Prevent white iOS UIViewController background from flashing through
          // on app resume before React content is fully re-painted.
          contentStyle: { backgroundColor: '#1A3C6D' },
        }}
      />
      <Stack.Screen
        name="ReflectionEditor"
        component={ReflectionEditorScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          // Prevent white iOS UIViewController background from flashing through
          // on app resume before React content is fully re-painted.
          contentStyle: { backgroundColor: '#1A3C6D' },
        }}
      />
    </Stack.Navigator>
  );
};

export default JournalStackNavigator;

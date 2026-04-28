// src/navigation/JournalStackNavigator.tsx
import React from 'react';
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
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
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
        }}
      />
    </Stack.Navigator>
  );
};

export default JournalStackNavigator;

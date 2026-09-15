// src/navigation/JournalStackNavigator.tsx
import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import JournalScreen from '../screens/JournalScreen';
import { MomentsScreen } from '../screens/MomentsScreen';
import TimeBlockEditorScreen from '../screens/TimeBlockEditorScreen';
import ReflectionEditorScreen from '../screens/ReflectionEditorScreen';
import ScriptureNoteEditorScreen from '../screens/ScriptureNoteEditorScreen';
import SermonNotesScreen from '../screens/SermonNotesScreen';
import SermonNotesDetailScreen from '../screens/SermonNotesDetailScreen';
import BibleStudyScreen from '../screens/BibleStudyScreen';
import ReviewScreen from '../screens/ReviewScreen';
import PastReviewsScreen from '../screens/PastReviewsScreen';
import ReviewSettingsScreen from '../screens/ReviewSettingsScreen';

const Stack = createNativeStackNavigator();

const JournalStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator initialRouteName="JournalMoments" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JournalMain" component={JournalScreen as React.ComponentType} />
      <Stack.Screen
        name="JournalMoments"
        component={MomentsScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
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
          // Prevent white iOS UIViewController background from flashing through
          // on app resume before React content is fully re-painted.
          contentStyle: { backgroundColor: '#526A5B' },
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
          contentStyle: { backgroundColor: '#526A5B' },
        }}
      />
      <Stack.Screen
        name="SermonNotesDetail"
        component={SermonNotesDetailScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          contentStyle: { backgroundColor: '#F6F5EF' },
        }}
      />
      <Stack.Screen
        name="SermonNotes"
        component={SermonNotesScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          contentStyle: { backgroundColor: '#F6F5EF' },
        }}
      />
      <Stack.Screen
        name="Review"
        component={ReviewScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          contentStyle: { backgroundColor: '#F6F5EF' },
        }}
      />
      <Stack.Screen
        name="ReviewSettings"
        component={ReviewSettingsScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          contentStyle: { backgroundColor: '#F6F5EF' },
        }}
      />
      <Stack.Screen
        name="PastReviews"
        component={PastReviewsScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          contentStyle: { backgroundColor: '#F6F5EF' },
        }}
      />
      <Stack.Screen
        name="ScriptureNoteEditor"
        component={ScriptureNoteEditorScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          // Prevent white iOS UIViewController background from flashing through
          // on app resume before React content is fully re-painted.
          contentStyle: { backgroundColor: '#526A5B' },
        }}
      />
      <Stack.Screen
        name="BibleStudy"
        component={BibleStudyScreen as React.ComponentType}
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

export default JournalStackNavigator;

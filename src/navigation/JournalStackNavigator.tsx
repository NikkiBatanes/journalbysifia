// src/navigation/JournalStackNavigator.tsx
import React from 'react';
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
import ReviewReaderScreen from '../screens/ReviewReaderScreen';
import PrayerV2DemoScreen from '../dev/PrayerV2DemoScreen';
import TodayPrayerCardGalleryScreen from '../dev/TodayPrayerCardGalleryScreen';
import ReviewQAScreen from '../dev/reviews/ReviewQAScreen';

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
          presentation: 'card',
          animation: 'none',
          gestureEnabled: false,
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
          // A native fade exposes the ivory Journal screen underneath before
          // the green editor sheet is opaque, producing a full-screen flash.
          // The editor has its own content entrance animations.
          animation: 'none',
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
          animation: 'none',
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
        name="ReviewReader"
        component={ReviewReaderScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right',
          gestureEnabled: true,
          contentStyle: { backgroundColor: '#F6F5EF' },
        }}
      />
      {__DEV__ && <Stack.Screen
        name="PrayerV2Demo"
        component={PrayerV2DemoScreen as React.ComponentType}
        options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
      />}
      {__DEV__ && <Stack.Screen
        name="TodayPrayerCardGallery"
        component={TodayPrayerCardGalleryScreen as React.ComponentType}
        options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
      />}
      {__DEV__ && <Stack.Screen
        name="ReviewQA"
        component={ReviewQAScreen as React.ComponentType}
        options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
      />}
      <Stack.Screen
        name="ScriptureNoteEditor"
        component={ScriptureNoteEditorScreen as React.ComponentType}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'none',
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
          // Bible Study performs its own staggered content reveal after its
          // saved session has loaded. A native fade here makes that entrance
          // appear to run twice.
          animation: 'none',
          gestureEnabled: true,
          contentStyle: { backgroundColor: '#F6F5EF' },
        }}
      />
    </Stack.Navigator>
  );
};

export default JournalStackNavigator;

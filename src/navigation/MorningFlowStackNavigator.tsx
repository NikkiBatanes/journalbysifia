import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '../theme/colors';
import { RoutineProvider } from '../context/RoutineContext';
import { useMorningStatusBar } from '../hooks/useMorningStatusBar';

import EmotionCheckInScreen from '../screens/morning/EmotionCheckInScreen';
import UnderneathItScreen from '../screens/morning/UnderneathItScreen';
import PsalmOfTheDayScreen from '../screens/morning/PsalmOfTheDayScreen';
import CarryItScreen from '../screens/morning/CarryItScreen';
import MorningClosingScreen from '../screens/morning/MorningClosingScreen';
import MorningTodaysFocusScreen from '../screens/morning/MorningTodaysFocusScreen';
import MorningTodosScreen from '../screens/morning/MorningTodosScreen';

export type MorningFlowParamList = {
  EmotionCheckIn: { morningFlow?: boolean } | undefined;
  UnderneathIt: {
    feeling?: string | null;
    feelingIcon?: string;
    feelingIconType?: 'ionicons' | 'material';
    morningFlow?: boolean;
  } | undefined;
  TodaysFocus: {
    selectedDate?: string;
    feeling?: string | null;
    feelingIcon?: string;
    feelingIconType?: 'ionicons' | 'material';
    underneath?: string;
  } | undefined;
  Todos: { [key: string]: any } | undefined;
  PsalmOfTheDay: { [key: string]: any } | undefined;
  CarryIt: { [key: string]: any } | undefined;
  MorningClosing:
    | {
        feeling?: string;
        feelingIcon?: string;
        feelingIconType?: 'ionicons' | 'material';
        underneath?: string;
        standalone?: boolean;
        checkedInAt?: string;
        focus?: string;
        focusIcon?: string;
        focusIconType?: 'ionicons' | 'material' | 'fontawesome';
        focusCategory?: string;
        customFocus?: string;
        personalText?: string;
        priorities?: Array<{ id?: string; text: string; completed?: boolean }>;
        mainPriority?: string;
        topTodos?: string[];
        psalmNumber?: number;
        psalmRead?: boolean;
        selectedAttributes?: string[];
        customAttribute?: string;
        carry?: string;
      }
    | undefined;
};

const Stack = createNativeStackNavigator<MorningFlowParamList>();

const MorningFlowStackNavigator = () => {
  useMorningStatusBar();

  return (
  <RoutineProvider>
    <Stack.Navigator
      initialRouteName="EmotionCheckIn"
      screenOptions={{
        headerShown: false,
        presentation: 'card',
        // Every screen shares the same cream canvas, so this reads as content rising
        // into place instead of the whole page sliding horizontally.
        animation: 'fade_from_bottom',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        animationMatchesGesture: true,
        statusBarHidden: true,
        contentStyle: { backgroundColor: Colors.lightBackground },
      }}
    >
      <Stack.Screen name="EmotionCheckIn" component={EmotionCheckInScreen} />
      <Stack.Screen name="UnderneathIt" component={UnderneathItScreen} />
      <Stack.Screen name="TodaysFocus" component={MorningTodaysFocusScreen} />
      <Stack.Screen name="Todos" component={MorningTodosScreen} />
      <Stack.Screen name="PsalmOfTheDay" component={PsalmOfTheDayScreen} />
      <Stack.Screen name="CarryIt" component={CarryItScreen} />
      <Stack.Screen
        name="MorningClosing"
        component={MorningClosingScreen}
        options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
      />
    </Stack.Navigator>
  </RoutineProvider>
  );
};

export default MorningFlowStackNavigator;

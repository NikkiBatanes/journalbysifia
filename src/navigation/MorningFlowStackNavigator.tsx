import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '../theme/colors';

import EmotionCheckInScreen from '../screens/morning/EmotionCheckInScreen';
import UnderneathItScreen from '../screens/morning/UnderneathItScreen';
import PsalmOfTheDayScreen from '../screens/morning/PsalmOfTheDayScreen';
import CarryItScreen from '../screens/morning/CarryItScreen';
import MorningClosingScreen from '../screens/morning/MorningClosingScreen';
import TodaysFocusWalkthroughScreen from '../screens/TodaysFocusWalkthroughScreen';
import TodosWalkthroughScreen from '../screens/TodosWalkthroughScreen';

export type MorningFlowParamList = {
  EmotionCheckIn: { morningFlow?: boolean } | undefined;
  UnderneathIt: { feeling?: string | null; morningFlow?: boolean } | undefined;
  TodaysFocus: { selectedDate?: string; feeling?: string | null; underneath?: string } | undefined;
  Todos: { [key: string]: any } | undefined;
  PsalmOfTheDay: undefined;
  CarryIt: undefined;
  MorningClosing:
    | {
        feeling?: string;
        underneath?: string;
        standalone?: boolean;
        checkedInAt?: string;
        focus?: string;
        mainPriority?: string;
        topTodos?: string[];
        carry?: string;
      }
    | undefined;
};

const Stack = createNativeStackNavigator<MorningFlowParamList>();

const MorningFlowStackNavigator = () => (
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
      contentStyle: { backgroundColor: Colors.lightBackground },
    }}
  >
    <Stack.Screen name="EmotionCheckIn" component={EmotionCheckInScreen} />
    <Stack.Screen name="UnderneathIt" component={UnderneathItScreen} />
    <Stack.Screen name="TodaysFocus" component={TodaysFocusWalkthroughScreen as React.ComponentType} />
    <Stack.Screen name="Todos" component={TodosWalkthroughScreen as React.ComponentType} />
    <Stack.Screen name="PsalmOfTheDay" component={PsalmOfTheDayScreen} />
    <Stack.Screen name="CarryIt" component={CarryItScreen} />
    <Stack.Screen name="MorningClosing" component={MorningClosingScreen} />
  </Stack.Navigator>
);

export default MorningFlowStackNavigator;

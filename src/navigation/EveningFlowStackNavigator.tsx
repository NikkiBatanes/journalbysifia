import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '../theme/colors';

import {
  EveningGratitudeScreen,
  EveningWinScreen,
  EveningProverbsScreen,
  EveningCarryWisdomScreen,
  EveningLookingForwardScreen,
  EveningClosingScreen,
} from '../screens/evening/EveningFlowScreens';

export type EveningFlowParamList = {
  Gratitude: { selectedDate?: string } | undefined;
  Win: { [key: string]: any } | undefined;
  Proverbs: { [key: string]: any } | undefined;
  CarryWisdom: { [key: string]: any } | undefined;
  LookingForward: { [key: string]: any } | undefined;
  EveningClosing: { [key: string]: any } | undefined;
};

const Stack = createNativeStackNavigator<EveningFlowParamList>();

const EveningFlowStackNavigator = () => (
  <Stack.Navigator
    initialRouteName="Gratitude"
    screenOptions={{
      headerShown: false,
      presentation: 'card',
      animation: 'fade_from_bottom',
      gestureEnabled: true,
      fullScreenGestureEnabled: true,
      animationMatchesGesture: true,
      contentStyle: { backgroundColor: Colors.lightBackground },
    }}
  >
    <Stack.Screen name="Gratitude" component={EveningGratitudeScreen} />
    <Stack.Screen name="Win" component={EveningWinScreen} />
    <Stack.Screen name="Proverbs" component={EveningProverbsScreen} />
    <Stack.Screen name="CarryWisdom" component={EveningCarryWisdomScreen} />
    <Stack.Screen name="LookingForward" component={EveningLookingForwardScreen} />
    <Stack.Screen name="EveningClosing" component={EveningClosingScreen} />
  </Stack.Navigator>
);

export default EveningFlowStackNavigator;

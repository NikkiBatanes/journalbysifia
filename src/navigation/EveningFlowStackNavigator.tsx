import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '../theme/colors';
import { RoutineProvider } from '../context/RoutineContext';
import { useEveningStatusBar } from '../hooks/useEveningStatusBar';

import EveningProverbsScreen from '../screens/evening/EveningProverbsScreen';
import {
  EveningCarryWisdomScreen,
  EveningClosingScreen,
} from '../screens/evening/EveningFlowScreens';
import EveningGratitudeScreen from '../screens/evening/EveningGratitudeScreen';
import EveningWinScreen from '../screens/evening/EveningWinScreen';
import EveningLookingForwardScreen from '../screens/evening/EveningLookingForwardScreen';
import RoutineResumeScreen from '../screens/routine/RoutineResumeScreen';
import { toLocalDateString } from '../utils/date';
import { canOpenRoutineForDate } from '../services/routineDatePolicy';

export type EveningFlowParamList = {
  RoutineEntry: undefined;
  Gratitude: { selectedDate?: string } | undefined;
  Win: { [key: string]: any } | undefined;
  Proverbs: { [key: string]: any } | undefined;
  CarryWisdom: { [key: string]: any } | undefined;
  LookingForward: { [key: string]: any } | undefined;
  EveningClosing: { [key: string]: any } | undefined;
};

const Stack = createNativeStackNavigator<EveningFlowParamList>();

const EveningFlowStackNavigator = ({ route, navigation }: { route: { params?: { selectedDate?: string } }; navigation: any }) => {
  useEveningStatusBar();
  const selectedDate = route.params?.selectedDate ?? toLocalDateString(new Date());
  const futureDate = !canOpenRoutineForDate(selectedDate);

  React.useEffect(() => {
    if (futureDate) {navigation.goBack();}
  }, [futureDate, navigation]);

  if (futureDate) {
    return <View style={{ flex: 1, backgroundColor: Colors.lightBackground }} />;
  }

  return (
  <RoutineProvider routine="evening" selectedDate={selectedDate}>
    <Stack.Navigator
    initialRouteName="RoutineEntry"
    screenOptions={{
      headerShown: false,
      presentation: 'card',
      animation: 'fade_from_bottom',
      // Journal experiences handle swipes, including validation, themselves.
      gestureEnabled: false,
      statusBarHidden: true,
      contentStyle: { backgroundColor: Colors.lightBackground },
    }}
  >
    <Stack.Screen name="RoutineEntry" component={RoutineResumeScreen} />
    <Stack.Screen name="Gratitude" component={EveningGratitudeScreen} />
    <Stack.Screen name="Win" component={EveningWinScreen} />
    <Stack.Screen name="Proverbs" component={EveningProverbsScreen} />
    <Stack.Screen name="CarryWisdom" component={EveningCarryWisdomScreen} />
    <Stack.Screen name="LookingForward" component={EveningLookingForwardScreen} />
    <Stack.Screen name="EveningClosing" component={EveningClosingScreen} />
  </Stack.Navigator>
  </RoutineProvider>
  );
};

export default EveningFlowStackNavigator;

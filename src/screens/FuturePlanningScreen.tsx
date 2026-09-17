import React, { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import TodaysFocusExperience from '../components/journal/TodaysFocusExperience';
import TodosExperience from '../components/journal/TodosExperience';
import type { RootStackParamList } from '../navigation/types';
import { fromLocalDateString } from '../utils/date';
import { getLocalJournalSingleton, getLocalTodosForDate } from '../storage/journalStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'FuturePlanning'>;

const FuturePlanningScreen: React.FC<Props> = ({ route, navigation }) => {
  const [step, setStep] = useState<'focus' | 'todos'>('focus');
  const selectedDate = fromLocalDateString(route.params.selectedDate);
  const planningContext = route.params.isTomorrow ? 'tomorrow' : 'later';

  // When Copy Todos is the only prepared content, enter at the existing Todo
  // plan rather than showing an empty Focus step first. Focus-led plans retain
  // their existing entry point.
  useEffect(() => {
    let active = true;
    Promise.all([
      getLocalJournalSingleton('todays_focus', route.params.selectedDate),
      getLocalTodosForDate(route.params.selectedDate),
    ]).then(([focus, todos]) => {
      if (active && !focus && todos.length > 0) {setStep('todos');}
    }).catch(() => {});
    return () => { active = false; };
  }, [route.params.selectedDate]);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, 'slide');
      StatusBar.setBarStyle('dark-content');
      return () => {
        StatusBar.setHidden(false, 'slide');
        StatusBar.setBarStyle('dark-content');
      };
    }, []),
  );

  const exit = useCallback(() => {
    DeviceEventEmitter.emit('future_plan_saved', { date: route.params.selectedDate });
    navigation.goBack();
  }, [navigation, route.params.selectedDate]);

  if (step === 'focus') {
    return (
      <TodaysFocusExperience
        selectedDate={selectedDate}
        planningContext={planningContext}
        completionButtonText="Continue"
        footerText="You can return and change this plan at any time."
        onClose={exit}
        onSkip={() => setStep('todos')}
        onComplete={() => setStep('todos')}
      />
    );
  }

  return (
    <TodosExperience
      selectedDate={selectedDate}
      planningContext={planningContext}
      onClose={exit}
      onComplete={exit}
      skipCompletionPage
    />
  );
};

export default withErrorBoundary(FuturePlanningScreen, 'FuturePlanningScreen');

import React, { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import TodosExperience from '../components/journal/TodosExperience';

import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TodosWalkthrough'>;

const TodosWalkthroughScreen: React.FC<Props> = ({ route, navigation }) => {
  const selectedDateStr = route.params?.selectedDate;
  const selectedDate = selectedDateStr ? new Date(selectedDateStr) : new Date();

  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, 'slide');
      StatusBar.setBarStyle('dark-content');
      return () => {
        StatusBar.setHidden(false, 'slide');
        StatusBar.setBarStyle('dark-content');
      };
    }, [])
  );

  const onComplete = useCallback(async (_result: { record: any; items: any[] }) => {
    navigation.goBack();
  }, [navigation]);

  const onClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <TodosExperience
      selectedDate={selectedDate}
      onClose={onClose}
      onComplete={onComplete}
    />
  );
};

export default withErrorBoundary(TodosWalkthroughScreen, 'TodosWalkthroughScreen');

import React, { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import TodaysFocusExperience from '../components/journal/TodaysFocusExperience';

import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TodaysFocusWalkthrough'>;

const TodaysFocusWalkthroughScreen: React.FC<Props> = ({ route, navigation }) => {
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

  const onComplete = useCallback(async (_record: any) => {
    navigation.goBack();
  }, [navigation]);

  const onClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <TodaysFocusExperience
      selectedDate={selectedDate}
      onClose={onClose}
      onComplete={onComplete}
    />
  );
};

export default withErrorBoundary(TodaysFocusWalkthroughScreen, 'TodaysFocusWalkthroughScreen');

import React, { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';

import { useRoutine } from '../../context/RoutineContext';
import { exitMorningFlow } from '../../navigation/exitEveningFlow';
import TodaysFocusExperience from '../../components/journal/TodaysFocusExperience';

const MorningTodaysFocusScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { selectedDate, markStepCompleted } = useRoutine();

  const handleComplete = useCallback(async (record: any) => {
    await markStepCompleted(
      'todays_focus',
      {
        domain: 'journal',
        content_type: 'todays_focus',
        local_id: record.id,
      },
      'todays_focus',
    );
    navigation.navigate('Todos');
  }, [markStepCompleted, navigation]);

  const handleClose = useCallback(() => {
    exitMorningFlow(navigation, 'Today');
  }, [navigation]);

  return (
    <TodaysFocusExperience
      selectedDate={new Date(selectedDate)}
      onClose={handleClose}
      onComplete={handleComplete}
      completionButtonText="Continue"
      footerText="A simple morning anchor before you move into the rest of your day."
    />
  );
};

export default MorningTodaysFocusScreen;

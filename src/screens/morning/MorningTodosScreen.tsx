import React, { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';

import { useRoutine } from '../../context/RoutineContext';
import TodosExperience from '../../components/journal/TodosExperience';
import { useMorningStatusBar } from '../../hooks/useMorningStatusBar';

const MorningTodosScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { selectedDate, markStepCompleted } = useRoutine();
  useMorningStatusBar();

  const handleComplete = useCallback(async (result: { record: any; items: any[] }) => {
    const todoRefs = result.items.map(item => ({
      domain: 'journal' as const,
      content_type: 'todo',
      local_id: item.id,
    }));
    await markStepCompleted('todos', todoRefs, 'todos');
    navigation.navigate('PsalmOfTheDay', { selectedDate });
  }, [markStepCompleted, navigation, selectedDate]);

  const handleClose = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Today' });
  }, [navigation]);

  return (
    <TodosExperience
      selectedDate={new Date(selectedDate)}
      onClose={handleClose}
      onComplete={handleComplete}
    />
  );
};

export default MorningTodosScreen;

import React, { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';

import { useRoutine } from '../../context/RoutineContext';
import { fromLocalDateString } from '../../utils/date';
import { exitMorningFlow } from '../../navigation/exitEveningFlow';
import TodosExperience from '../../components/journal/TodosExperience';

const MorningTodosScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { selectedDate, markStepCompleted } = useRoutine();

  const handleComplete = useCallback(async (result: { record: any; items: any[] }) => {
    const todoRefs = result.items.map(item => ({
      domain: 'journal' as const,
      content_type: 'todo',
      local_id: item.id,
    }));
    await markStepCompleted('todos', todoRefs, 'todos');
    navigation.navigate('MorningClosing');
  }, [markStepCompleted, navigation]);

  const handleClose = useCallback(() => {
    exitMorningFlow(navigation, 'Today');
  }, [navigation]);

  return (
    <TodosExperience
      selectedDate={fromLocalDateString(selectedDate)}
      onClose={handleClose}
      onComplete={handleComplete}
      routineDraft={{ routine: 'morning', selectedDate, step: 'todos' }}
      skipCompletionPage
    />
  );
};

export default MorningTodosScreen;

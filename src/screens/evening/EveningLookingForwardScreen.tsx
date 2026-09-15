import { exitEveningFlow } from '../../navigation/exitEveningFlow';
import * as React from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
import { LookingForwardExperience } from '../../components/journal/LookingForwardExperience';
import { useRoutine } from '../../context/RoutineContext';

const EveningLookingForwardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { selectedDate, markStepCompleted } = useRoutine();
  const selectedDateObj = new Date(selectedDate);
  const params = route.params ?? {};


  const handleClose = () => {
    exitEveningFlow(navigation, 'Today');
  };

  const handleComplete = async (record: any) => {
    let content: any = {};
    try {
      content = typeof record.content === 'string' ? JSON.parse(record.content) : record.content;
    } catch (error) {
      console.error('Error parsing saved looking forward content:', error);
    }

    const lookingForward = (content?.entry?.text ?? '').trim();
    const lookingForwardContext = content?.emotionName ?? '';

    await markStepCompleted('looking_forward', {
      domain: 'journal',
      content_type: 'looking_forward',
      local_id: record.id,
    });

    DeviceEventEmitter.emit('reflection_saved', { type: 'looking_forward', date: selectedDate });

    navigation.navigate('EveningClosing', {
      ...params,
      selectedDate,
      lookingForward,
      lookingForwardContext,
      lookingForwardIcon: content.emotionIcon,
      lookingForwardId: record.id,
    });
  };

  return (
    <LookingForwardExperience
      selectedDate={selectedDateObj}
      insets={insets}
      onClose={handleClose}
      onComplete={handleComplete}
      skipCompletionPage
    />
  );
};

export default withErrorBoundary(EveningLookingForwardScreen, 'EveningLookingForwardScreen');

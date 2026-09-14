import * as React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { TodayWinExperience } from '../TodaysWinWalkthroughScreen';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
import { useRoutine } from '../../context/RoutineContext';

const EveningWinScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { selectedDate, markStepCompleted } = useRoutine();
  const selectedDateObj = new Date(selectedDate);
  const params = route.params ?? {};

  const handleClose = () => {
    navigation.goBack();
  };

  const handleComplete = async (record: any) => {
    let content: any = {};
    try {
      content = typeof record.content === 'string' ? JSON.parse(record.content) : record.content;
    } catch (error) {
      console.error('Error parsing saved win content:', error);
    }

    const win = ((content.quietWin ?? '').trim() || (content.winTypeName ?? ''));
    const winContext = content.winTypeName ?? '';

    await markStepCompleted('win', {
      domain: 'journal',
      content_type: 'today_win',
      local_id: record.id,
    });

    navigation.navigate('Proverbs', {
      ...params,
      selectedDate,
      win,
      winContext,
      winId: record.id,
    });
  };

  return (
    <TodayWinExperience
      selectedDate={selectedDateObj}
      insets={{ top: 50, bottom: insets.bottom + 20 }}
      onClose={handleClose}
      onComplete={handleComplete}
    />
  );
};

export default withErrorBoundary(EveningWinScreen, 'EveningWinScreen');

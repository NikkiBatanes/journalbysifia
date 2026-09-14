import * as React from 'react';
import { useCallback } from 'react';
import { StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../utils/date';
import { analytics } from '../utils/analytics';
import { visibleStreakService } from '../services/visibleStreakService';
import { LookingForwardExperience } from '../components/journal/LookingForwardExperience';

import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TomorrowInHisHandsWalkthrough'>;

const TomorrowInHisHandsWalkthroughScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedDate: selectedDateStr } = route.params || {};
  const selectedDate = selectedDateStr ? new Date(selectedDateStr) : new Date();
  const dateStr = toLocalDateString(selectedDate);

  // Hide status bar for translucent scrolling effect
  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, 'slide');
      StatusBar.setBarStyle('light-content');
      return () => {
        StatusBar.setHidden(false, 'slide');
        StatusBar.setBarStyle('light-content');
      };
    }, [])
  );

  const handleComplete = async (record: any) => {
    let content: any = {};
    try {
      content = typeof record.content === 'string' ? JSON.parse(record.content) : record.content;
    } catch (error) {
      console.error('Error parsing looking forward record content:', error);
    }

    let navigatedToStreak = false;
    if (user?.id) {
      const shouldShowStreak = await visibleStreakService.shouldShowCelebration(user.id, 'journal_looking_forward_added');
      if (shouldShowStreak) {
        await visibleStreakService.markShownToday(user.id);
        (navigation as any).navigate('StreakPlan', {
          userId: user.id,
          source: 'journal_looking_forward_added',
          dismissRouteCount: 2,
        });
        navigatedToStreak = true;
      }
    }

    if (user?.id) {
      analytics.trackFocusEvent('tomorrow_saved', {
        emotion: content?.emotionId || '',
        has_text: (content?.entry?.text ?? '').length > 0,
        date: dateStr,
      }, user.id);
    }

    if (!navigatedToStreak) {
      navigation.goBack();
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <LookingForwardExperience
      selectedDate={selectedDate}
      insets={insets}
      onClose={handleClose}
      onComplete={handleComplete}
    />
  );
};

export default withErrorBoundary(TomorrowInHisHandsWalkthroughScreen, 'TomorrowInHisHandsWalkthroughScreen');

import React, { useMemo, useRef, useEffect, useState, useLayoutEffect } from 'react';
import { View, StyleSheet, StatusBar, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import TimeBlockLogEditor, { TimeBlockLogEditorRef } from '../components/journal/TimeBlockLogEditor';
import { useRoute, useNavigation } from '@react-navigation/native';
import { toLocalDateString } from '../utils/date';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useCreateTimeBlock, useUpdateTimeBlock } from '../services/hooks/useTimeBlockData';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';
import { Logger } from '../utils/ProductionLogger';

interface RouteParams {
  selectedDate?: string;
  existingTimeBlock?: any;
  autoFocus?: boolean;
}

const TimeBlockEditorScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const timeBlockEditorRef = useRef<TimeBlockLogEditorRef>(null);

  const params = route.params as RouteParams;
  const selectedDate = params?.selectedDate || toLocalDateString(new Date());
  const existingTimeBlock = params?.existingTimeBlock;
  const autoFocus = params?.autoFocus || false;
  const selectedDateForSave = useMemo(() => new Date(`${selectedDate}T00:00:00`), [selectedDate]);
  const [hasFocused, setHasFocused] = useState(false);

  useEffect(() => {
    Logger.info('[TimeBlockEditorScreen] Component MOUNTED', {
      selectedDate,
      hasExistingTimeBlock: !!existingTimeBlock,
      existingTitle: existingTimeBlock?.title,
      autoFocus,
    });
    return () => {
      Logger.info('[TimeBlockEditorScreen] Component UNMOUNTED');
      setHasFocused(false); // Reset on unmount
    };
  }, [selectedDate, existingTimeBlock, autoFocus]);

  // Use navigation focus listener to trigger auto-focus when screen comes into focus
  useLayoutEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      Logger.info('[TimeBlockEditorScreen] Screen FOCUSED', { autoFocus, hasFocused });

      // Always auto-focus the title input when screen opens
      if (!hasFocused) {
        setHasFocused(true);
        setTimeout(() => {
          if (timeBlockEditorRef.current) {
            Logger.info('[TimeBlockEditorScreen] Calling focusInput()');
            timeBlockEditorRef.current.focusInput();
          } else {
            Logger.warn('[TimeBlockEditorScreen] timeBlockEditorRef.current is null');
          }
        }, 600); // Delay to allow screen transition to complete
      }
    });

    return unsubscribe;
  }, [navigation, autoFocus, hasFocused]);

  const createMutation = useCreateTimeBlock();
  const updateMutation = useUpdateTimeBlock();

  const handleSave = async (data: any) => {
    try {
      const saveDate = data.date instanceof Date && !Number.isNaN(data.date.getTime())
        ? data.date
        : selectedDateForSave;
      const saveDateString = toLocalDateString(saveDate);
      // Create full datetime objects for the selected date
      let startDateTime: Date;
      let endDateTime: Date;

      startDateTime = data.isAllDay
        ? new Date(`${saveDateString}T00:00:00`)
        : new Date(`${saveDateString}T${data.startTime.toTimeString().slice(0, 8)}`);

      endDateTime = data.isAllDay
        ? new Date(`${saveDateString}T23:59:59`)
        : new Date(`${saveDateString}T${data.endTime.toTimeString().slice(0, 8)}`);

      // Validate that start time is before end time
      if (startDateTime >= endDateTime) {
        Alert.alert('Invalid Time Range', 'Start time must be before end time. Please adjust your time selection.');
        return;
      }

      const timeBlockData = {
        user_id: user?.id || '',
        selected_date: saveDateString,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        all_day: data.isAllDay,
        title: data.title,
        location: data.location || '',
        category: data.category,
        description: data.notes || '',
        alert: data.alert || 'none',
        repeat_rule: data.repeatFrequency && data.repeatFrequency !== 'never' ? {
          frequency: data.repeatFrequency,
          endDate: data.repeatEndDate,
          customDays: data.repeatCustomDays,
          customFrequency: data.repeatCustomFrequency,
        } : {
          frequency: 'never',
        },
        repeat_until: data.repeatEndDate?.toISOString().split('T')[0],
        repeat_frequency: data.repeatFrequency,
        repeat_end_date: data.repeatEndDate?.toISOString(),
        alarm_minutes: data.alarmMinutes,
        is_completed: false,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        metadata: {},
        version: 1,
      };

      if (data.isEditing && data.existingId) {
        // Update existing time block
        await updateMutation.mutateAsync({
          id: data.existingId,
          updates: timeBlockData,
        });
      } else {
        // Create new time block
        await createMutation.mutateAsync(timeBlockData as any);
      }

      // Invalidate cache to refresh the list
      if (user?.id) {
        const affectedDates = new Set([selectedDate, saveDateString]);
        for (const affectedDate of affectedDates) {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.timeBlocks.byDate(user.id, affectedDate),
          });
        }
        await queryClient.invalidateQueries({
          queryKey: [queryKeys.timeBlocks.all[0]],
        });
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error saving time block:', error);
      Alert.alert('Error', 'Failed to save time block. Please try again.');
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const handleUpgradeRequired = () => {
    navigation.goBack();
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#526A5B" />
      <View style={styles.container}>
        <TimeBlockLogEditor
          ref={timeBlockEditorRef}
          onSave={handleSave}
          onCancel={handleCancel}
          onUpgradeRequired={handleUpgradeRequired}
          initialContent={existingTimeBlock?.description || ''}
          subtaskTitle=""
          _subtaskId={undefined}
          _stepId={undefined}
          playbookTitle={undefined}
          actionStepNumber={undefined}
          actionStepTitle={undefined}
          isLoading={false}
          existingTimeBlock={existingTimeBlock}
          selectedDate={selectedDate}
          context="journal"
          dateString={new Date(selectedDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#526A5B',
  },
});

export default TimeBlockEditorScreen;

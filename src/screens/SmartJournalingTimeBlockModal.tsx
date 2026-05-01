import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Modal,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NewSuccessModal from '../components/NewSuccessModal';
import { useSuccessModal } from '../hooks/useSuccessModal';
import TimeBlockLogEditor, { TimeBlockLogEditorRef } from '../components/journal/TimeBlockLogEditor';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useActionSteps } from '../context/ActionStepsContext';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { TimeBlockApi, TimeBlockApiEntry } from '../services/api/timeBlockApi';
import { toLocalDateString } from '../utils/date';
import { Logger } from '../utils/ProductionLogger';
import { useSubscription } from '../hooks/useSubscription';
import {
  checkPlanningAccess,
  getEffectivePlanningTier,
  isFuturePlanningDate,
} from '../utils/tierLockingRules';

interface SmartJournalingTimeBlockModalProps {
  visible: boolean;
  subtaskTitle: string;
  subtaskId?: string;
  stepId?: string;
  playbookId?: string;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  existingTimeBlock?: any;
  selectedDate?: string;
  onSave: (entry: any) => void;
  onCancel: () => void;
}

const SmartJournalingTimeBlockModal: React.FC<SmartJournalingTimeBlockModalProps> = ({
  visible,
  subtaskTitle,
  subtaskId,
  stepId,
  playbookId,
  playbookTitle,
  actionStepNumber,
  actionStepTitle,
  existingTimeBlock,
  selectedDate,
  onSave,
  onCancel,
}) => {

  const { user } = useAuth();
  const navigation = useNavigation();
  const { subscription } = useSubscription();
  const queryClient = useQueryClient();
  const { handleAutoCheckStep } = useActionSteps();
  const planningTier = useMemo(() => getEffectivePlanningTier(subscription), [subscription]);

  // Store the initial metadata to preserve it
  const [preservedSubtaskTitle, setPreservedSubtaskTitle] = useState(subtaskTitle);
  const [preservedActionStepNumber, setPreservedActionStepNumber] = useState(actionStepNumber);
  const [preservedActionStepTitle, setPreservedActionStepTitle] = useState(actionStepTitle);
  const [preservedPlaybookTitle, setPreservedPlaybookTitle] = useState(playbookTitle);

  // Track when metadata props change and preserve non-empty values
  React.useEffect(() => {
    if (subtaskTitle && subtaskTitle.trim() !== '') {
      setPreservedSubtaskTitle(subtaskTitle);
    }
  }, [subtaskTitle]);

  React.useEffect(() => {
    if (actionStepNumber !== undefined && actionStepNumber !== null) {
      setPreservedActionStepNumber(actionStepNumber);
    }
  }, [actionStepNumber]);

  React.useEffect(() => {
    if (actionStepTitle && actionStepTitle.trim() !== '') {
      setPreservedActionStepTitle(actionStepTitle);
    }
  }, [actionStepTitle]);

  React.useEffect(() => {
    if (playbookTitle && playbookTitle.trim() !== '') {
      setPreservedPlaybookTitle(playbookTitle);
    }
  }, [playbookTitle]);

  // New success modal system
  const successModal = useSuccessModal(
    () => onCancel(), // onDone: close the modal
    () => {} // onEdit: keep modal open for editing
  );
  const [_completionInfo, setCompletionInfo] = useState<{ stepId: string; subtaskId: string } | null>(null);
  const [isEditSession, setIsEditSession] = useState(false);
  const [prevVisible, setPrevVisible] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [_pendingTimeBlockData, _setPendingTimeBlockData] = useState<{ timeBlockEntry: any } | null>(null); // Store data before DB save
  const timeBlockEditorRef = useRef<TimeBlockLogEditorRef>(null);
  const [temporarilyHiddenForUpgrade, setTemporarilyHiddenForUpgrade] = useState(false);
  const shouldRestoreAfterUpgradeRef = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', () => {
      if (shouldRestoreAfterUpgradeRef.current) {
        shouldRestoreAfterUpgradeRef.current = false;
        setTemporarilyHiddenForUpgrade(false);
      }
    });

    return unsubscribe;
  }, [navigation]);

  // Track visibility changes to detect when modal opens/closes
  useEffect(() => {
    if (!visible) {
      shouldRestoreAfterUpgradeRef.current = false;
      setTemporarilyHiddenForUpgrade(false);
    }

    if (visible && !prevVisible) {
      // Modal just opened
      setIsEditSession(!!existingTimeBlock);
      setHasSaved(false);

      // Auto-focus the first input when modal opens for new entries
      if (!existingTimeBlock) {
        setTimeout(() => {
          if (timeBlockEditorRef.current) {
            timeBlockEditorRef.current.focusInput();
          }
        }, 500); // Delay to allow modal animation to complete
      }
    } else if (!visible && prevVisible && hasSaved) {
      // Modal just closed after saving

    }
    setPrevVisible(visible);
  }, [visible, prevVisible, existingTimeBlock, hasSaved]);

  // Get today's date for time block queries
  const today = toLocalDateString(new Date());

  // Query for existing time blocks (currently unused but may be needed for future features)
  useQuery({
    queryKey: ['timeBlocks', user?.id, today],
    queryFn: () => user ? TimeBlockApi.getTimeBlocks(user.id, today) : Promise.resolve([]),
    enabled: !!user && visible,
  });

  // Create time block mutation
  const createTimeBlockMutation = useMutation({
    mutationFn: async (timeBlockData: Omit<TimeBlockApiEntry, 'id' | 'created_at' | 'updated_at'>) => {
      if (!user) {throw new Error('User not authenticated');}
      return TimeBlockApi.createTimeBlock(timeBlockData);
    },
    onSuccess: (data) => {

      // Invalidate timeblock queries for the saved date
      const savedDateStr = data.selected_date; // Use the actual saved date from the response
      const todayStr = toLocalDateString(new Date());

      // PERFORMANCE: Parallel cache invalidation instead of sequential
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ['timeBlocks', 'byDate', user?.id, savedDateStr] }),
        queryClient.invalidateQueries({ queryKey: ['timeBlocks'] }),
        queryClient.invalidateQueries({ queryKey: ['journal', 'all'] }),
      ];
      // Also invalidate for today if different
      if (savedDateStr !== todayStr) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: ['timeBlocks', 'byDate', user?.id, todayStr] })
        );
      }
      Promise.all(invalidations);

      setHasSaved(true);

      // Store completion info but don't mark as completed yet
      // Completion only happens when user clicks "Done" in success modal
      if (stepId && subtaskId) {

        setCompletionInfo({ stepId, subtaskId });
      }
    },
    onError: (error) => {
      Logger.error('❌ Error creating time block', error as Error, { component: 'SmartJournalingTimeBlockModal' });
      Alert.alert('Error', 'Failed to save time block. Please try again.');
    },
  });

  // Update time block mutation
  const updateTimeBlockMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TimeBlockApiEntry> }) => {
      return TimeBlockApi.updateTimeBlock(id, updates);
    },
    onSuccess: (data) => {

      // Invalidate timeblock queries for the saved date
      const savedDateStr = data.selected_date; // Use the actual saved date from the response
      const todayStr = toLocalDateString(new Date());

      // PERFORMANCE: Parallel cache invalidation instead of sequential
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ['timeBlocks', 'byDate', user?.id, savedDateStr] }),
        queryClient.invalidateQueries({ queryKey: ['timeBlocks'] }),
      ];
      // Also invalidate for today if different
      if (savedDateStr !== todayStr) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: ['timeBlocks', 'byDate', user?.id, todayStr] })
        );
      }
      Promise.all(invalidations);
      setHasSaved(true);
    },
    onError: (error) => {
      Logger.error('❌ Error updating time block', error as Error, { component: 'SmartJournalingTimeBlockModal' });
      Alert.alert('Error', 'Failed to update time block. Please try again.');
    },
  });

  // Save time block data to database immediately and mark subtask complete
  const saveTimeBlock = async (timeBlockData: {
    title: string;
    startTime: Date;
    endTime: Date;
    category: string;
    notes?: string;
    location?: string;
    isAllDay: boolean;
    date: Date;
    alert?: 'none' | 'at-time' | '5-min' | '10-min' | '15-min' | '30-min' | '1-hour' | '2-hours' | '1-day' | '2-days' | '1-week';
    alarmMinutes?: number; // For calendar sync
    repeatFrequency?: 'never' | 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'yearly' | 'custom';
    repeatEndDate?: Date | null;
    repeatCustomDays?: number[];
    repeatCustomFrequency?: { value: number; unit: 'day' | 'week' | 'month' | 'year' } | null;
    isEditing?: boolean;
    existingId?: string;
  }) => {
    try {
      if (!user) {
        Alert.alert('Error', 'You must be logged in to save time blocks.');
        return;
      }

      const planningAccess = checkPlanningAccess(planningTier, 'inApp');
      if (isFuturePlanningDate(timeBlockData.date) && planningAccess.isLocked) {
        shouldRestoreAfterUpgradeRef.current = true;
        setTemporarilyHiddenForUpgrade(true);
        setTimeout(() => {
          (navigation as any).navigate('OnboardingSalesOffer', {
            source: 'planning_lock',
            feature: 'future_planning',
            tier: planningTier,
            skipNotificationPreference: true,
            dismissBehavior: 'goBack',
          });
        }, 50);
        return;
      }

      // Build repeat rule for calendar sync
      const repeatRule = timeBlockData.repeatFrequency && timeBlockData.repeatFrequency !== 'never' ? {
        frequency: timeBlockData.repeatFrequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
        endDate: timeBlockData.repeatEndDate || undefined,
        customDays: timeBlockData.repeatCustomDays,
        customFrequency: timeBlockData.repeatCustomFrequency,
      } : {
        frequency: 'never' as const,
      };

      const timeBlockEntry: Omit<TimeBlockApiEntry, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        selected_date: toLocalDateString(timeBlockData.date),
        start_time: timeBlockData.startTime.toISOString(),
        end_time: timeBlockData.endTime.toISOString(),
        all_day: timeBlockData.isAllDay,
        title: timeBlockData.title,
        location: timeBlockData.location || '',
        category: timeBlockData.category,
        description: timeBlockData.notes || '',
        alert: timeBlockData.alert || 'none',
        repeat_rule: repeatRule,
        repeat_until: timeBlockData.repeatEndDate?.toISOString().split('T')[0],
        repeat_frequency: timeBlockData.repeatFrequency,
        repeat_end_date: timeBlockData.repeatEndDate?.toISOString(),
        alarm_minutes: timeBlockData.alarmMinutes, // Save alarm minutes for calendar sync
        is_completed: false,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        metadata: {
          subtaskTitle: preservedSubtaskTitle,
          subtaskId,
          stepId,
          playbookId,
          playbookTitle: preservedPlaybookTitle,
          actionStepNumber: preservedActionStepNumber,
          actionStepTitle: preservedActionStepTitle,
          source: 'smart_journaling',
        },
        version: 1,
      };

      let result;
      if (isEditSession && existingTimeBlock?.id) {
        result = await updateTimeBlockMutation.mutateAsync({
          id: existingTimeBlock.id,
          updates: timeBlockEntry,
        });
      } else {
        result = await createTimeBlockMutation.mutateAsync(timeBlockEntry);
      }

      // Mark subtask as completed and protected immediately since data is saved (only for new time blocks)
      if (stepId && subtaskId && handleAutoCheckStep && !isEditSession) {
        // Auto-check and protect the subtask
        handleAutoCheckStep(stepId, subtaskId);
      }

      // Notify parent of successful save
      onSave(result);

      // CRITICAL FIX: Emit timeblock event to refresh Moments screen
      DeviceEventEmitter.emit('timeblock_saved', { timeblock: result });

      // Show success modal after cache invalidation completes
      setTimeout(() => {
        successModal.showSuccess({
          title: isEditSession ? 'Time Block Updated' : 'Time Block Saved',
          message: isEditSession ? 'Your time block has been updated.' : 'Your time block has been saved to your journal.',
          showEditButton: true,
        });
        setHasSaved(true);
      }, 100);

    } catch (error: any) {
      Logger.error('❌ SmartJournalingTimeBlockModal: SAVE FAILED', error as Error, { component: 'SmartJournalingTimeBlockModal' });
      Alert.alert(
        'Error',
        `Failed to save time block: ${error?.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  // Note: Removed unused _handleSuccessModalClose and _handleEdit functions
  // The success modal is now handled by the useSuccessModal hook

  const isLoading = false; // Placeholder - make sure to import and use the actual mutations if needed

  return (
    <>
      <Modal
        visible={visible && !temporarilyHiddenForUpgrade}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCancel}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <TimeBlockLogEditor
            ref={timeBlockEditorRef}
            onSave={saveTimeBlock}
            onCancel={handleCancel}
            onUpgradeRequired={onCancel} // Close modal before navigating to upgrade
            initialContent={existingTimeBlock?.description || ''}
            subtaskTitle={preservedSubtaskTitle}
            _subtaskId={subtaskId}
            _stepId={stepId}
            playbookTitle={preservedPlaybookTitle}
            actionStepNumber={preservedActionStepNumber}
            actionStepTitle={preservedActionStepTitle}
            isLoading={isLoading}
            existingTimeBlock={existingTimeBlock}
            selectedDate={selectedDate}
            context="faithful-actions"
            dateString={new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />

          {/* New success modal system - completely isolated and robust */}
          <NewSuccessModal
            visible={successModal.isVisible}
            config={successModal.config}
            onDone={successModal.handleDone}
            onEdit={successModal.handleEdit}
          />
        </GestureHandlerRootView>
      </Modal>
    </>
  );
};

export default withErrorBoundary(SmartJournalingTimeBlockModal, 'SmartJournalingTimeBlockModal');

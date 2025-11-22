import React, { useState, useEffect, useRef } from 'react';
import { Logger } from '../utils/ProductionLogger';
import { Modal, Alert } from 'react-native';
import NewSuccessModal from '../components/NewSuccessModal';
import { useSuccessModal } from '../hooks/useSuccessModal';
import TimeBlockLogEditor, { TimeBlockLogEditorRef } from '../components/journal/TimeBlockLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/reflectionStyles';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useActionSteps } from '../context/ActionStepsContext';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { TimeBlockApi, TimeBlockApiEntry } from '../services/api/timeBlockApi';
import { toLocalDateString } from '../utils/date';

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
  onSave,
  onCancel,
}) => {

  const { user } = useAuth();
  const { handleToggleStep, actionSteps } = useActionSteps();
  const queryClient = useQueryClient();

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

  // Track visibility changes to detect when modal opens/closes
  useEffect(() => {
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

      queryClient.invalidateQueries({
        queryKey: ['timeBlocks', 'byDate', user?.id, savedDateStr],
      });
      // Also invalidate for today in case they're the same
      const todayStr = toLocalDateString(new Date());
      if (savedDateStr !== todayStr) {
        queryClient.invalidateQueries({
          queryKey: ['timeBlocks', 'byDate', user?.id, todayStr],
        });
      }
      // Also invalidate broader timeblock queries as fallback
      queryClient.invalidateQueries({ queryKey: ['timeBlocks'] });
      queryClient.invalidateQueries({ queryKey: ['journal', 'all'] });

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
      queryClient.invalidateQueries({
        queryKey: ['timeBlocks', 'byDate', user?.id, savedDateStr],
      });
      // Also invalidate for today in case they're the same
      const todayStr = toLocalDateString(new Date());
      if (savedDateStr !== todayStr) {
        queryClient.invalidateQueries({
          queryKey: ['timeBlocks', 'byDate', user?.id, todayStr],
        });
      }
      // Also invalidate broader timeblock queries as fallback
      queryClient.invalidateQueries({ queryKey: ['timeBlocks'] });
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
  }) => {
    try {
      if (!user) {
        Alert.alert('Error', 'You must be logged in to save time blocks.');
        return;
      }

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
        // Update existing time block

        result = await updateTimeBlockMutation.mutateAsync({
          id: existingTimeBlock.id,
          updates: timeBlockEntry,
        });
      } else {
        // Create new time block

        result = await createTimeBlockMutation.mutateAsync(timeBlockEntry);
      }

      // Call parent onSave callback
      onSave(result);

      // Mark subtask as completed immediately since data is saved (only for new time blocks)
      if (stepId && subtaskId && handleToggleStep && !isEditSession) {

        // Check if the step/subtask is already completed before toggling
        const step = actionSteps.find(s => s.id === stepId);

        if (step) {
          if (subtaskId) {
            // Check subtask completion
            const subtask = step.subTasks?.find(st => st.id === subtaskId);

            if (subtask && !subtask.completed) {

              handleToggleStep(stepId, subtaskId);

            } else {

            }
          } else {
            // Check step completion
            if (!step.completed) {

              handleToggleStep(stepId, subtaskId);

            } else {

            }
          }
        } else {
          Logger.warn('📅 SmartJournalingTimeBlockModal: Step not found in actionSteps', {
        component: 'SmartJournalingTimeBlockModal',
            stepId,
            availableStepIds: actionSteps?.map(s => s.id) || [],
          });
        }
      } else {

      }

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

    // Completion state handled by parent component

    onCancel();
  };

  // Note: Removed unused _handleSuccessModalClose and _handleEdit functions
  // The success modal is now handled by the useSuccessModal hook

  const isLoading = false; // Placeholder - make sure to import and use the actual mutations if needed

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        presentationStyle="overFullScreen"
        onRequestClose={handleCancel}
      >
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
            styles={reflectionLogStyles}
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
      </Modal>
    </>
  );
};

export default withErrorBoundary(SmartJournalingTimeBlockModal, 'SmartJournalingTimeBlockModal');

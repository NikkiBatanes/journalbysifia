import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import SuccessModal from '../components/SuccessModal';
import TimeBlockLogEditor, { TimeBlockLogEditorRef } from '../components/journal/TimeBlockLogEditor';
import { Colors } from '../theme';
import { useAuth } from '../context/IndustryStandardAuthContext';
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
  console.log('🔍 SmartJournalingTimeBlockModal: Props received:', {
    visible,
    subtaskTitle,
    subtaskId,
    stepId,
    playbookId,
    playbookTitle,
    actionStepNumber,
    actionStepTitle,
    existingTimeBlock,
  });

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

  const [showSuccessModal, setShowSuccessModal] = useState(false);
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
      console.log('📅 SmartJournalingTimeBlockModal: Modal opened, isEditSession:', !!existingTimeBlock);

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
      console.log('📅 SmartJournalingTimeBlockModal: Modal closed after save');
    }
    setPrevVisible(visible);
  }, [visible, prevVisible, existingTimeBlock, hasSaved]);

  // Get today's date for time block queries
  const today = new Date().toISOString().split('T')[0];

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
      console.log('✅ Time block created successfully:', data);
      // Invalidate timeblock queries for the saved date
      const savedDateStr = data.selected_date; // Use the actual saved date from the response
      console.log('🔄 Invalidating query with key:', ['timeBlocks', 'byDate', user?.id, savedDateStr]);
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
      console.log('🔄 Query invalidation completed');
      setHasSaved(true);

      // Store completion info but don't mark as completed yet
      // Completion only happens when user clicks "Done" in success modal
      if (stepId && subtaskId) {
        console.log('📅 Storing completion info for later:', { stepId, subtaskId });
        setCompletionInfo({ stepId, subtaskId });
      }
    },
    onError: (error) => {
      console.error('❌ Error creating time block:', error);
      Alert.alert('Error', 'Failed to save time block. Please try again.');
    },
  });

  // Update time block mutation
  const updateTimeBlockMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TimeBlockApiEntry> }) => {
      return TimeBlockApi.updateTimeBlock(id, updates);
    },
    onSuccess: (data) => {
      console.log('✅ Time block updated successfully:', data);
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
      console.error('❌ Error updating time block:', error);
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
  }) => {
    try {
      if (!user) {
        Alert.alert('Error', 'You must be logged in to save time blocks.');
        return;
      }

      console.log('📅 SmartJournalingTimeBlockModal: Saving time block data to database immediately', {
        title: timeBlockData.title,
        date: timeBlockData.date.toISOString().split('T')[0],
        stepId,
        subtaskId,
        actionStepsCount: actionSteps?.length || 0,
      });

      const timeBlockEntry: Omit<TimeBlockApiEntry, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        selected_date: timeBlockData.date.toISOString().split('T')[0],
        start_time: timeBlockData.startTime.toISOString(),
        end_time: timeBlockData.endTime.toISOString(),
        all_day: timeBlockData.isAllDay,
        title: timeBlockData.title,
        location: timeBlockData.location || '',
        category: timeBlockData.category,
        description: timeBlockData.notes || '',
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
        console.log('📅 SmartJournalingTimeBlockModal: Updating existing time block');
        result = await updateTimeBlockMutation.mutateAsync({
          id: existingTimeBlock.id,
          updates: timeBlockEntry,
        });
      } else {
        // Create new time block
        console.log('📅 SmartJournalingTimeBlockModal: Creating new time block');
        result = await createTimeBlockMutation.mutateAsync(timeBlockEntry);
      }

      console.log('✅ SmartJournalingTimeBlockModal: Database save completed');

      // Call parent onSave callback
      onSave(result);

      // Mark subtask as completed immediately since data is saved (only for new time blocks)
      if (stepId && subtaskId && handleToggleStep && !isEditSession) {
        console.log('📅 SmartJournalingTimeBlockModal: Marking subtask as completed (data saved)', {
          stepId,
          subtaskId,
          actionStepsCount: actionSteps?.length || 0,
        });

        // Check if the step/subtask is already completed before toggling
        const step = actionSteps.find(s => s.id === stepId);
        console.log('📅 SmartJournalingTimeBlockModal: Found step:', {
          stepFound: !!step,
          stepId: step?.id,
          stepCompleted: step?.completed,
          subTasksCount: step?.subTasks?.length || 0,
        });

        if (step) {
          if (subtaskId) {
            // Check subtask completion
            const subtask = step.subTasks?.find(st => st.id === subtaskId);
            console.log('📅 SmartJournalingTimeBlockModal: Found subtask:', {
              subtaskFound: !!subtask,
              subtaskId: subtask?.id,
              subtaskCompleted: subtask?.completed,
            });

            if (subtask && !subtask.completed) {
              console.log('📅 SmartJournalingTimeBlockModal: Calling handleToggleStep to mark subtask as completed');
              handleToggleStep(stepId, subtaskId);
              console.log('📅 SmartJournalingTimeBlockModal: handleToggleStep called successfully');
            } else {
              console.log('📅 SmartJournalingTimeBlockModal: Subtask already completed or not found, skipping toggle');
            }
          } else {
            // Check step completion
            if (!step.completed) {
              console.log('📅 SmartJournalingTimeBlockModal: Calling handleToggleStep to mark step as completed');
              handleToggleStep(stepId, subtaskId);
              console.log('📅 SmartJournalingTimeBlockModal: handleToggleStep called successfully');
            } else {
              console.log('📅 SmartJournalingTimeBlockModal: Step already completed, skipping toggle');
            }
          }
        } else {
          console.warn('📅 SmartJournalingTimeBlockModal: Step not found in actionSteps:', {
            stepId,
            availableStepIds: actionSteps?.map(s => s.id) || [],
          });
        }
      } else {
        console.log('📅 SmartJournalingTimeBlockModal: Skipping completion - editing existing time block or missing data:', {
          hasStepId: !!stepId,
          hasSubtaskId: !!subtaskId,
          hasHandleToggleStep: !!handleToggleStep,
          isEditSession,
        });
      }

      // Show success modal after save and completion (with small delay to allow UI update)
      setTimeout(() => {
        setShowSuccessModal(true);
        setHasSaved(true);
      }, 100);

      console.log('✅ SmartJournalingTimeBlockModal: Time block saved and subtask marked complete');
    } catch (error: any) {
      console.error('❌ SmartJournalingTimeBlockModal: SAVE FAILED:', error);
      Alert.alert(
        'Error',
        `Failed to save time block: ${error?.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  };



  const handleCancel = () => {
    console.log('📅 SmartJournalingTimeBlockModal: Cancel pressed');

    // Debug: Check completion state when cancelling
    if (stepId && subtaskId) {
      const step = actionSteps.find(s => s.id === stepId);
      const subtask = step?.subTasks?.find(st => st.id === subtaskId);
      console.log('📅 SmartJournalingTimeBlockModal: Cancel - Current completion state:', {
        stepId,
        subtaskId,
        stepCompleted: step?.completed,
        subtaskCompleted: subtask?.completed,
        stepFound: !!step,
        subtaskFound: !!subtask,
      });
    }

    onCancel();
  };

  // Called when "Done" is pressed in SuccessModal (data already saved, just close modal)
  const handleSuccessModalClose = () => {
    console.log('📅 SmartJournalingTimeBlockModal: Done button pressed, closing modal (data already saved)');
    setShowSuccessModal(false);
    onCancel(); // Close the modal
  };

  const handleEdit = () => {
    console.log('📅 SmartJournalingTimeBlockModal: Edit button pressed, closing success modal');

    // Debug: Check completion state when editing
    if (stepId && subtaskId) {
      const step = actionSteps.find(s => s.id === stepId);
      const subtask = step?.subTasks?.find(st => st.id === subtaskId);
      console.log('📅 SmartJournalingTimeBlockModal: Edit - Current completion state:', {
        stepId,
        subtaskId,
        stepCompleted: step?.completed,
        subtaskCompleted: subtask?.completed,
        stepFound: !!step,
        subtaskFound: !!subtask,
      });
    }

    setShowSuccessModal(false);
    // Focus the input and position cursor at the end
    setTimeout(() => {
      if (timeBlockEditorRef.current) {
        timeBlockEditorRef.current.focusInput();
      }
    }, 300); // Small delay to allow modal to close
    // Keep modal open for continued editing
  };

  const isLoading = createTimeBlockMutation.isPending || updateTimeBlockMutation.isPending;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCancel}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TimeBlockLogEditor
            ref={timeBlockEditorRef}
            onSave={saveTimeBlock}
            onCancel={handleCancel}
            initialContent={existingTimeBlock?.description || ''}
            subtaskTitle={preservedSubtaskTitle}
            _subtaskId={subtaskId}
            _stepId={stepId}
            playbookTitle={preservedPlaybookTitle}
            actionStepNumber={preservedActionStepNumber}
            actionStepTitle={preservedActionStepTitle}
            isLoading={isLoading}
            existingTimeBlock={existingTimeBlock}
            dateString={new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />

          <SuccessModal
            visible={showSuccessModal}
            onDismiss={handleSuccessModalClose}
            onEdit={handleEdit}
            title={isEditSession ? 'Time Block Updated!' : 'Time Block Created!'}
            message={isEditSession
              ? 'Your time block has been successfully updated.'
              : 'Your time block has been successfully created and added to your schedule.'
            }
            buttonText="Done"
          />
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
});

export default SmartJournalingTimeBlockModal;

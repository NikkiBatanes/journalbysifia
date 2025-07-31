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
  const { handleToggleStep } = useActionSteps();
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
  const [pendingTimeBlockData, setPendingTimeBlockData] = useState<any>(null); // Store data before DB save
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

  // Prepare time block data for saving (but don't save to DB yet)
  const prepareTimeBlock = async (timeBlockData: {
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

      console.log('📅 SmartJournalingTimeBlockModal: Preparing time block data (not saving to DB yet)', {
        title: timeBlockData.title,
        date: timeBlockData.date.toISOString().split('T')[0],
        isEditSession,
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

      // Store the prepared data for later saving
      setPendingTimeBlockData({ timeBlockData, timeBlockEntry });

      // Show success modal immediately (before DB save)
      setShowSuccessModal(true);
      setHasSaved(true);

      // Set completion info for later use
      if (stepId && subtaskId) {
        console.log('📅 SmartJournalingTimeBlockModal: Setting completion info for later use');
        setCompletionInfo({ stepId, subtaskId });
      }

      console.log('✅ SmartJournalingTimeBlockModal: Time block prepared, showing success modal');
    } catch (error: any) {
      console.error('❌ SmartJournalingTimeBlockModal: PREPARE FAILED:', error);
      Alert.alert(
        'Error',
        `Failed to prepare time block: ${error?.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  };

  // Actually save to database (called only when user clicks "Done")
  const saveToDatabase = async () => {
    if (!pendingTimeBlockData) {
      console.error('❌ No pending time block data to save');
      return;
    }

    try {
      console.log('📅 SmartJournalingTimeBlockModal: Saving to database...', pendingTimeBlockData);

      const { timeBlockEntry } = pendingTimeBlockData;

      if (isEditSession && existingTimeBlock?.id) {
        // Update existing time block
        await updateTimeBlockMutation.mutateAsync({
          id: existingTimeBlock.id,
          updates: timeBlockEntry,
        });
      } else {
        // Create new time block
        await createTimeBlockMutation.mutateAsync(timeBlockEntry);
      }

      console.log('✅ SmartJournalingTimeBlockModal: Database save completed');

      // Call the parent onSave callback
      onSave(timeBlockEntry);

      return timeBlockEntry;
    } catch (error: any) {
      console.error('❌ SmartJournalingTimeBlockModal: DATABASE SAVE FAILED:', error);
      // Clear completion info and pending data on error to prevent false completion
      setCompletionInfo(null);
      setHasSaved(false);
      setPendingTimeBlockData(null);

      Alert.alert(
        'Save Failed',
        `Failed to save time block: ${error?.message || 'Unknown error'}. Please try again.`,
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  const handleCancel = () => {
    console.log('📅 SmartJournalingTimeBlockModal: Cancel pressed');
    onCancel();
  };

  const handleSuccessModalClose = async () => {
    console.log('📅 SmartJournalingTimeBlockModal: Done button clicked - saving to database');

    try {
      // Save to database when user clicks "Done"
      await saveToDatabase();

      setShowSuccessModal(false);

      // Mark step as completed after successful save
      if (_completionInfo && handleToggleStep) {
        console.log('📅 SmartJournalingTimeBlockModal: Marking step as completed after DB save:', _completionInfo);
        handleToggleStep(_completionInfo.stepId, _completionInfo.subtaskId);
        setCompletionInfo(null);
      }

      // Clear pending data after successful save
      setPendingTimeBlockData(null);

      onCancel(); // Close the main modal
    } catch (error) {
      console.error('❌ Failed to save time block on Done click:', error);
      // Don't close the modal if save failed - let user try again
    }
  };

  const handleEdit = () => {
    console.log('📅 SmartJournalingTimeBlockModal: Edit button clicked - keeping data for editing');
    setShowSuccessModal(false);
    // Focus the input and position cursor at the end
    setTimeout(() => {
      if (timeBlockEditorRef.current) {
        timeBlockEditorRef.current.focusInput();
      }
    }, 300); // Small delay to allow modal to close
    // The editor will remain open since we're not calling onCancel
    // Step information and pending data are preserved for continued editing
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
            onSave={prepareTimeBlock}
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

import React, { useState, useEffect } from 'react';
import { StyleSheet, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import SuccessModal from '../components/SuccessModal';
import TimeBlockLogEditor from '../components/journal/TimeBlockLogEditor';
import { Colors } from '../theme';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useActionSteps } from '../context/ActionStepsContext';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { TimeBlockApi, TimeBlockApiEntry } from '../services/api/timeBlockApi';

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

  // Track visibility changes to detect when modal opens/closes
  useEffect(() => {
    if (visible && !prevVisible) {
      // Modal just opened
      setIsEditSession(!!existingTimeBlock);
      setHasSaved(false);
      console.log('📅 SmartJournalingTimeBlockModal: Modal opened, isEditSession:', !!existingTimeBlock);
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
      queryClient.invalidateQueries({ queryKey: ['timeBlocks'] });
      setHasSaved(true);

      // Mark step as completed if we have the necessary IDs
      if (stepId && subtaskId && handleToggleStep) {
        console.log('📅 Marking step as completed:', { stepId, subtaskId });
        setCompletionInfo({ stepId, subtaskId });
        handleToggleStep(stepId, subtaskId);
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
      queryClient.invalidateQueries({ queryKey: ['timeBlocks'] });
      setHasSaved(true);
    },
    onError: (error) => {
      console.error('❌ Error updating time block:', error);
      Alert.alert('Error', 'Failed to update time block. Please try again.');
    },
  });

  const handleSave = async (timeBlockData: {
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

      console.log('📅 SmartJournalingTimeBlockModal: Saving time block:', timeBlockData);

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

      // Show success modal
      setShowSuccessModal(true);

      // Call the parent onSave callback
      onSave(timeBlockEntry);

    } catch (error) {
      console.error('❌ Error in handleSave:', error);
      Alert.alert('Error', 'Failed to save time block. Please try again.');
    }
  };

  const handleCancel = () => {
    console.log('📅 SmartJournalingTimeBlockModal: Cancel pressed');
    onCancel();
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    onCancel(); // Close the main modal
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
            onSave={handleSave}
            onCancel={handleCancel}
            initialContent={existingTimeBlock?.description || ''}
            subtaskTitle={preservedSubtaskTitle}
            subtaskId={subtaskId}
            stepId={stepId}
            playbookTitle={preservedPlaybookTitle}
            actionStepNumber={preservedActionStepNumber}
            actionStepTitle={preservedActionStepTitle}
            isLoading={isLoading}
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
            title={isEditSession ? 'Time Block Updated!' : 'Time Block Created!'}
            message={isEditSession
              ? 'Your time block has been successfully updated.'
              : 'Your time block has been successfully created and added to your schedule.'
            }
            buttonText="Continue"
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

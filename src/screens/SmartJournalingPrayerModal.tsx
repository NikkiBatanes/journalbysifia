import React, { useState, useEffect } from 'react';
import { StyleSheet, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import SuccessModal from '../components/SuccessModal';
import PrayerLogEditor from '../components/journal/PrayerLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/reflectionStyles';
import { Colors } from '../theme';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useActionSteps } from '../context/ActionStepsContext';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { PrayerApi, PrayerApiEntry } from '../services/api/prayerApi';

interface SmartJournalingPrayerModalProps {
  visible: boolean;
  subtaskTitle: string;
  subtaskId?: string;
  stepId?: string;
  playbookId?: string;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  existingPrayer?: any; // For editing existing prayer entries
  onSave: (entry: any) => void;
  onCancel: () => void;
}

const SmartJournalingPrayerModal: React.FC<SmartJournalingPrayerModalProps> = ({
  visible,
  subtaskTitle,
  subtaskId,
  stepId,
  playbookId,
  playbookTitle,
  actionStepNumber,
  actionStepTitle,
  existingPrayer,
  onSave,
  onCancel,
}) => {
  const { user } = useAuth();
  const { handleToggleStep } = useActionSteps();
  const queryClient = useQueryClient();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completionInfo, setCompletionInfo] = useState<{ stepId: string; subtaskId: string } | null>(null);
  const [isEditSession, setIsEditSession] = useState(false); // Track if user is in edit mode
  const [prevVisible, setPrevVisible] = useState(false);

  // Fetch existing prayer data for this subtask
  const dateStr = new Date().toISOString().split('T')[0];
  const { data: existingPrayerEntries = [] } = useQuery({
    queryKey: ['personal_prayers', user?.id, dateStr, subtaskId],
    queryFn: async () => {
      if (!user?.id || !subtaskId) {return [];}

      // Fetch personal prayer entries for today that match this subtask
      const prayers = await PrayerApi.getACTSPrayers(user.id, dateStr);
      const personalPrayers = prayers.freeform || [];

      return personalPrayers.filter((prayer: PrayerApiEntry) => {
        // Check if this prayer is associated with the current subtask
        try {
          const content = typeof prayer.content === 'string' ? JSON.parse(prayer.content) : prayer.content;
          return content.metadata?.subtask_id === subtaskId || content.subtask_id === subtaskId;
        } catch (error) {
          // If content is not JSON, check if it's a simple string prayer for this subtask
          return false;
        }
      });
    },
    enabled: !!user?.id && !!subtaskId,
    staleTime: 30000, // 30 seconds
  });

  // Get the most recent prayer entry for this subtask
  const currentPrayerEntry = existingPrayerEntries[0] || existingPrayer;

  // Determine if this is an edit session when modal opens
  useEffect(() => {
    if (visible && !prevVisible) {
      const hasExistingData = currentPrayerEntry?.content && (() => {
        try {
          const parsedContent = typeof currentPrayerEntry.content === 'string'
            ? JSON.parse(currentPrayerEntry.content)
            : currentPrayerEntry.content;
          return parsedContent.text && parsedContent.text.trim();
        } catch (error) {
          // If content is not JSON, treat as simple string
          return currentPrayerEntry.content.trim();
        }
      })();
      setIsEditSession(!!hasExistingData);
    }
    setPrevVisible(visible);
  }, [visible, prevVisible, currentPrayerEntry]);

  // Create prayer mutation
  const createPrayerMutation = useMutation({
    mutationFn: async (prayerData: {
      content: string;
      date: Date;
    }) => {
      if (!user?.id) {throw new Error('User not authenticated');}

      const prayerEntry: Omit<PrayerApiEntry, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        prayer_type: 'journal',
        journal_category: 'personal_prayer',
        content: JSON.stringify({
          text: prayerData.content,
          metadata: {
            subtask_id: subtaskId,
            step_id: stepId,
            playbook_id: playbookId,
            playbook_title: playbookTitle,
            subtask_title: subtaskTitle,
            action_step_number: actionStepNumber,
            action_step_title: actionStepTitle,
          },
        }),
        selected_date: prayerData.date.toISOString().split('T')[0],
        status: undefined, // Personal prayers don't have status
      };

      return await PrayerApi.createPrayer(prayerEntry);
    },
    onSuccess: (data) => {
      console.log('🙏 Prayer created successfully:', data);
      // Invalidate and refetch prayer queries
      queryClient.invalidateQueries({ queryKey: ['personal_prayers'] });
      queryClient.invalidateQueries({ queryKey: ['prayers'] });
    },
    onError: (error) => {
      console.error('Error creating prayer:', error);
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    },
  });

  // Update prayer mutation
  const updatePrayerMutation = useMutation({
    mutationFn: async (prayerData: {
      content: string;
      date: Date;
    }) => {
      if (!currentPrayerEntry?.id) {throw new Error('No prayer entry to update');}

      const updates = {
        content: JSON.stringify({
          text: prayerData.content,
          metadata: {
            subtask_id: subtaskId,
            step_id: stepId,
            playbook_id: playbookId,
            playbook_title: playbookTitle,
            subtask_title: subtaskTitle,
            action_step_number: actionStepNumber,
            action_step_title: actionStepTitle,
          },
        }),
        selected_date: prayerData.date.toISOString().split('T')[0],
      };

      return await PrayerApi.updatePrayer(currentPrayerEntry.id, updates);
    },
    onSuccess: (data) => {
      console.log('🙏 Prayer updated successfully:', data);
      // Invalidate and refetch prayer queries
      queryClient.invalidateQueries({ queryKey: ['personal_prayers'] });
      queryClient.invalidateQueries({ queryKey: ['prayers'] });
    },
    onError: (error) => {
      console.error('Error updating prayer:', error);
      Alert.alert('Error', 'Failed to update prayer. Please try again.');
    },
  });

  const savePrayer = async (prayerData: { content: string; date: Date }) => {
    try {
      console.log('🙏 SmartJournalingPrayerModal: Saving prayer...', {
        hasExistingEntry: !!currentPrayerEntry,
        isEditSession,
        contentLength: prayerData.content.length,
      });

      let savedEntry;
      if (currentPrayerEntry?.id) {
        // Update existing prayer
        savedEntry = await updatePrayerMutation.mutateAsync(prayerData);
      } else {
        // Create new prayer
        savedEntry = await createPrayerMutation.mutateAsync(prayerData);
      }

      // Always show success modal on save
      setShowSuccessModal(true);

      // Mark step as complete if stepId is provided
      if (stepId && subtaskId) {
        setCompletionInfo({ stepId, subtaskId });
      }

      // Always call onSave with delay to allow modal to render
      setTimeout(() => {
        onSave(savedEntry);
      }, 100);

      console.log('🙏 SmartJournalingPrayerModal: onSave called successfully');
    } catch (error) {
      console.error('🙏 SmartJournalingPrayerModal: Error in savePrayer:', error);
      // Error handling is done in the mutation's onError
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);

    // Mark step as complete after success modal closes
    if (completionInfo) {
      const { stepId: completedStepId, subtaskId: completedSubtaskId } = completionInfo;
      console.log('🙏 SmartJournalingPrayerModal: Marking step as complete:', {
        stepId: completedStepId,
        subtaskId: completedSubtaskId,
      });

      handleToggleStep(completedStepId, completedSubtaskId);
      setCompletionInfo(null);
    }
  };

  // Get initial content for the editor
  const getInitialContent = () => {
    if (!currentPrayerEntry?.content) {return '';}

    try {
      const parsedContent = typeof currentPrayerEntry.content === 'string'
        ? JSON.parse(currentPrayerEntry.content)
        : currentPrayerEntry.content;
      return parsedContent.text || '';
    } catch (error) {
      // If content is not JSON, treat as simple string
      return currentPrayerEntry.content || '';
    }
  };

  const isLoading = createPrayerMutation.isPending || updatePrayerMutation.isPending;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onCancel}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <PrayerLogEditor
            onSave={savePrayer}
            onCancel={onCancel}
            initialContent={getInitialContent()}
            subtaskTitle={subtaskTitle}
            playbookTitle={playbookTitle}
            actionStepNumber={actionStepNumber}
            actionStepTitle={actionStepTitle}
            isLoading={isLoading}
            styles={reflectionLogStyles}
          />
        </KeyboardAvoidingView>
      </Modal>

      <SuccessModal
        visible={showSuccessModal}
        title={isEditSession ? 'Prayer Updated!' : 'Prayer Saved!'}
        message={
          isEditSession
            ? 'Your prayer has been updated successfully.'
            : 'Your prayer has been saved successfully.'
        }
        onDismiss={handleSuccessModalClose}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
});

export default SmartJournalingPrayerModal;

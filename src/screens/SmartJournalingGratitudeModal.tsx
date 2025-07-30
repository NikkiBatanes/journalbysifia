import React, { useState, useEffect } from 'react';
import { Modal, KeyboardAvoidingView, Platform, StyleSheet, Alert, Keyboard } from 'react-native';
import SuccessModal from '../components/SuccessModal';
import GratitudeLogEditor from '../components/journal/GratitudeLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/reflectionStyles';
import { Colors } from '../theme';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useActionSteps } from '../context/ActionStepsContext';
import {
  useCreateJournalEntry,
  useUpdateJournalEntry,
} from '../services/hooks/useJournalData';
import { useQueryClient } from '@tanstack/react-query';


interface SmartJournalingGratitudeModalProps {
  visible: boolean;
  subtaskTitle: string;
  subtaskId?: string;
  stepId?: string;
  playbookId?: string;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  existingGratitude?: any; // For editing existing gratitude entries
  onSave: (entry: any) => void;
  onCancel: () => void;
}

const SmartJournalingGratitudeModal: React.FC<SmartJournalingGratitudeModalProps> = ({
  visible,
  subtaskTitle,
  subtaskId,
  stepId,
  playbookId,
  playbookTitle,
  actionStepNumber,
  actionStepTitle,
  existingGratitude,
  onSave,
  onCancel,
}) => {

  const { user } = useAuth();
  const { handleToggleStep } = useActionSteps();
  const queryClient = useQueryClient();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completionInfo, setCompletionInfo] = useState<{ stepId: string; subtaskId: string } | null>(null);
  const dateStr = new Date().toISOString().split('T')[0]; // Use ISO format

  // Debug: Log existing gratitude prop
  React.useEffect(() => {
    console.log('🙏 SmartJournalingGratitudeModal: Props debug:', {
      visible,
      subtaskTitle,
      subtaskId,
      subtaskIdType: typeof subtaskId,
      stepId,
      playbookId,
      playbookTitle,
      actionStepNumber,
      actionStepTitle,
      existingGratitude: existingGratitude ? {
        id: existingGratitude.id,
        content: existingGratitude.content?.substring(0, 50) + '...',
        hasContent: !!existingGratitude.content,
        subtask_id: existingGratitude.subtask_id,
      } : null,
      isEditMode: !!existingGratitude,
    });
  }, [visible, subtaskTitle, subtaskId, stepId, playbookId, playbookTitle, actionStepNumber, actionStepTitle, existingGratitude]);

  // Clear completion info when modal opens to prevent accidental triggers
  const [prevVisible, setPrevVisible] = useState(visible);
  useEffect(() => {
    if (visible && !prevVisible) {
      // Modal is opening (transition from false to true)
      console.log('🙏 SmartJournalingGratitudeModal: Modal opening, clearing any existing completion info');
      setCompletionInfo(null);
    }
    setPrevVisible(visible);
  }, [visible, prevVisible]);

  // Handle subtask completion when modal closes after "DONE" is clicked
  useEffect(() => {
    console.log('🙏 SmartJournalingGratitudeModal: Completion useEffect triggered', {
      visible,
      hasCompletionInfo: !!completionInfo,
      completionInfo,
    });

    // Only complete subtask when modal is closing and we have completion info from successful save
    if (!visible && completionInfo && completionInfo.stepId && completionInfo.subtaskId) {
      const { stepId: completionStepId, subtaskId: completionSubtaskId } = completionInfo;
      console.log('🙏 SmartJournalingGratitudeModal: Setting timer for subtask completion');

      // Wait for modal slide-down animation to complete (typically 300-500ms)
      const timer = setTimeout(() => {
        console.log('🙏 SmartJournalingGratitudeModal: Auto-completing subtask after modal slide-down', {
          stepId: completionStepId,
          subtaskId: completionSubtaskId,
        });
        handleToggleStep(completionStepId, completionSubtaskId);
        setCompletionInfo(null);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [visible, completionInfo, handleToggleStep]);

  // React Query mutations
  const createMutation = useCreateJournalEntry();
  const updateMutation = useUpdateJournalEntry();

  const handleSaveGratitude = async (gratitudeData: {
    items: string[];
    date: Date;
  }) => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    console.log('🙏 SmartJournalingGratitudeModal: Saving gratitude entry:', {
      items: gratitudeData.items,
      subtaskId,
      stepId,
      playbookId,
      isEditMode: !!existingGratitude,
    });

    try {
      // Filter out blank items and remove number prefixes
      const cleanedItems = gratitudeData.items
        .filter(item => item.trim().length > 0) // Remove blank items
        .map(item => {
          // Remove number prefix (e.g., "1. ", "2. ", etc.)
          const cleaned = item.replace(/^\d+\. /, '').trim();
          return cleaned;
        })
        .filter(item => item.length > 0); // Remove any items that became empty after cleaning

      const gratitudeEntry = {
        user_id: user.id,
        selected_date: gratitudeData.date.toISOString().split('T')[0],
        content_type: 'gratitude' as const,
        content: JSON.stringify({
          items: cleanedItems,
          metadata: {
            subtaskTitle,
            playbookTitle,
            actionStepNumber,
            actionStepTitle,
            source: 'smart_journaling',
            subtask_id: subtaskId || null,
            step_id: stepId || null,
            playbook_id: playbookId || null,
          },
        }),
      };

      let result;
      if (existingGratitude?.id) {
        // Update existing gratitude entry
        console.log('🙏 SmartJournalingGratitudeModal: Updating existing gratitude entry');
        result = await updateMutation.mutateAsync({
          id: existingGratitude.id,
          updates: gratitudeEntry,
        });
      } else {
        // Create new gratitude entry
        console.log('🙏 SmartJournalingGratitudeModal: Creating new gratitude entry');
        result = await createMutation.mutateAsync(gratitudeEntry);
      }

      console.log('🙏 SmartJournalingGratitudeModal: Save successful:', result);

      // Track analytics (simplified for now)
      console.log('🙏 Gratitude analytics:', {
        action: existingGratitude ? 'updated' : 'created',
        items_count: gratitudeData.items.filter(item => item.trim()).length,
        source: 'smart_journaling',
      });

      // Invalidate and refetch relevant queries
      await queryClient.invalidateQueries({
        queryKey: ['gratitude', user.id, dateStr],
      });

      // Show success modal
      setShowSuccessModal(true);

      // Store completion info for later use
      if (stepId && subtaskId) {
        console.log('🙏 SmartJournalingGratitudeModal: Setting completion info for subtask');
        setCompletionInfo({ stepId, subtaskId });
      }

      // Call the onSave callback
      onSave(result);

    } catch (error) {
      console.error('🙏 SmartJournalingGratitudeModal: Error saving gratitude entry:', error);
      Alert.alert(
        'Error',
        'Failed to save gratitude entry. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleCancel = () => {
    console.log('🙏 SmartJournalingGratitudeModal: Cancel pressed');
    setCompletionInfo(null); // Clear any completion info
    onCancel();
  };

  const handleSuccessModalClose = () => {
    console.log('🙏 SmartJournalingGratitudeModal: Success modal closing');
    setShowSuccessModal(false);
    // Don't call onCancel here - let the completion useEffect handle subtask completion
  };

  // Parse existing gratitude content for editing
  const initialGratitudeItems = React.useMemo(() => {
    if (!existingGratitude?.content) {return ['', '', ''];}

    try {
      const parsed = typeof existingGratitude.content === 'string'
        ? JSON.parse(existingGratitude.content)
        : existingGratitude.content;

      if (parsed.items && Array.isArray(parsed.items)) {
        // Ensure we always have at least 3 items for the UI
        const items = parsed.items.map((item: any) =>
          typeof item === 'string' ? item : item.text || ''
        );
        while (items.length < 3) {items.push('');}
        return items.slice(0, 3); // Limit to 3 items
      }
    } catch (error) {
      console.error('🙏 Error parsing existing gratitude content:', error);
    }

    return ['', '', ''];
  }, [existingGratitude]);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          Keyboard.dismiss();
          // Small delay to ensure keyboard is fully dismissed before closing
          setTimeout(() => {
            handleCancel();
          }, 10);
        }}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <GratitudeLogEditor
            onSave={handleSaveGratitude}
            onCancel={handleCancel}
            initialItems={initialGratitudeItems}
            subtaskTitle={subtaskTitle}
            playbookTitle={playbookTitle}
            actionStepNumber={actionStepNumber}
            actionStepTitle={actionStepTitle}
            isLoading={createMutation.isPending || updateMutation.isPending}
            styles={reflectionLogStyles}
          />
        </KeyboardAvoidingView>
      </Modal>

      <SuccessModal
        visible={showSuccessModal}
        onDismiss={handleSuccessModalClose}
        title="Gratitude Saved!"
        message="Your gratitude entry has been saved successfully."
        animationDuration={300}
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

export default SmartJournalingGratitudeModal;

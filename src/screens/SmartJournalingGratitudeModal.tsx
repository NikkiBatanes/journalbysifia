import React, { useState, useEffect } from 'react';
import { StyleSheet, Modal, KeyboardAvoidingView, Platform, Alert, Keyboard } from 'react-native';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { JournalApi } from '../services/api/journalApi';

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
  // console.log('🙏 SmartJournalingGratitudeModal: Component rendered with props:', {
  //   visible,
  //   subtaskTitle,
  //   subtaskId,
  //   stepId,
  //   playbookId,
  //   hasExistingGratitude: !!existingGratitude,
  // });

  const { user } = useAuth();
  const { handleToggleStep, actionSteps } = useActionSteps();
  const queryClient = useQueryClient();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completionInfo, setCompletionInfo] = useState<{ stepId: string; subtaskId: string } | null>(null);
  const [isEditSession, setIsEditSession] = useState(false); // Track if user is in edit mode

  // Fetch existing gratitude data for this subtask
  const dateStr = new Date().toISOString().split('T')[0];
  const { data: existingGratitudeEntries = [] } = useQuery({
    queryKey: ['gratitude', user?.id, dateStr, subtaskId],
    queryFn: async () => {
      if (!user?.id || !subtaskId) {return [];}

      // Fetch gratitude entries for today that match this subtask
      const entries = await JournalApi.getGratitudeEntries(user.id, dateStr);
      return entries.filter((entry: any) => {
        // Check subtask_id in metadata field first (new format)
        if (entry.metadata?.subtask_id) {
          return entry.metadata.subtask_id === subtaskId;
        }

        // Fallback to checking in content for backward compatibility (old format)
        try {
          const parsedContent = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
          return parsedContent.metadata?.subtask_id === subtaskId || parsedContent.subtask_id === subtaskId;
        } catch (error) {
          console.error('Error parsing gratitude content:', error);
          return false;
        }
      });
    },
    enabled: !!user?.id && !!subtaskId, // Remove 'visible' dependency to prefetch data
    staleTime: 30000, // 30 seconds
  });

  // Get the most recent gratitude entry for this subtask
  const currentGratitudeEntry = existingGratitudeEntries[0] || existingGratitude;

  // Debug: Track when data becomes available
  useEffect(() => {
    if (currentGratitudeEntry) {
      console.log('🙏 SmartJournalingGratitudeModal: Current gratitude entry available:', {
        id: currentGratitudeEntry.id,
        hasContent: !!currentGratitudeEntry.content,
        contentPreview: currentGratitudeEntry.content
          ? (typeof currentGratitudeEntry.content === 'string'
              ? currentGratitudeEntry.content.substring(0, 50)
              : JSON.stringify(currentGratitudeEntry.content).substring(0, 50)
            ) + '...'
          : null,
      });
    } else {
      console.log('🙏 SmartJournalingGratitudeModal: No current gratitude entry available');
    }
  }, [currentGratitudeEntry]);

  // Debug: Track showSuccessModal state changes
  // useEffect(() => {
  //   console.log('🙏 SmartJournalingGratitudeModal: showSuccessModal changed to:', showSuccessModal);
  // }, [showSuccessModal]);

  // Debug: Log existing gratitude prop
  // React.useEffect(() => {
  //   console.log('🙏 SmartJournalingGratitudeModal: Props debug:', {
  //     visible,
  //     subtaskTitle,
  //     subtaskId,
  //     subtaskIdType: typeof subtaskId,
  //     stepId,
  //     playbookId,
  //     playbookTitle,
  //     actionStepNumber,
  //     actionStepTitle,
  //     existingGratitude: existingGratitude ? {
  //       id: existingGratitude.id,
  //       content: existingGratitude.content?.substring(0, 50) + '...',
  //       hasContent: !!existingGratitude.content,
  //       subtask_id: existingGratitude.subtask_id,
  //     } : null,
  //     isEditMode: !!existingGratitude,
  //   });
  // }, [visible, subtaskTitle, subtaskId, stepId, playbookId, playbookTitle, actionStepNumber, actionStepTitle, existingGratitude]);

  // Clear completion info when modal opens to prevent accidental triggers
  const [prevVisible, setPrevVisible] = useState(visible);
  useEffect(() => {
    if (visible && !prevVisible) {
      // Modal is opening (transition from false to true)
      console.log('🙏 SmartJournalingGratitudeModal: Modal opening, clearing any existing completion info');
      setCompletionInfo(null);

      // Determine if this is an edit session (has existing data)
      const hasExistingData = currentGratitudeEntry?.content && (() => {
        try {
          const parsedContent = typeof currentGratitudeEntry.content === 'string'
            ? JSON.parse(currentGratitudeEntry.content)
            : currentGratitudeEntry.content;
          return parsedContent.items && parsedContent.items.some((item: string) => item.trim());
        } catch (error) {
          return false;
        }
      })();

      setIsEditSession(!!hasExistingData);
      console.log('🙏 SmartJournalingGratitudeModal: Edit session:', !!hasExistingData);
    }
    setPrevVisible(visible);
  }, [visible, prevVisible, currentGratitudeEntry]);

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

        // Check if the step/subtask is already completed before toggling
        const step = actionSteps.find(s => s.id === completionStepId);
        if (step) {
          if (completionSubtaskId) {
            // Check subtask completion
            const subtask = step.subTasks?.find(st => st.id === completionSubtaskId);
            if (subtask && !subtask.completed) {
              console.log('🙏 SmartJournalingGratitudeModal: Marking subtask as completed');
              handleToggleStep(completionStepId, completionSubtaskId);
            } else {
              console.log('🙏 SmartJournalingGratitudeModal: Subtask already completed, skipping toggle');
            }
          } else {
            // Check step completion
            if (!step.completed) {
              console.log('🙏 SmartJournalingGratitudeModal: Marking step as completed');
              handleToggleStep(completionStepId, completionSubtaskId);
            } else {
              console.log('🙏 SmartJournalingGratitudeModal: Step already completed, skipping toggle');
            }
          }
        }

        setCompletionInfo(null);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [visible, completionInfo, handleToggleStep, actionSteps]);

  // React Query mutations
  const createMutation = useCreateJournalEntry();
  const updateMutation = useUpdateJournalEntry();

  // Debug: Track mutation states
  useEffect(() => {
    console.log('🙏 SmartJournalingGratitudeModal: Mutation states changed:', {
      createPending: createMutation.isPending,
      createSuccess: createMutation.isSuccess,
      createError: createMutation.isError,
      updatePending: updateMutation.isPending,
      updateSuccess: updateMutation.isSuccess,
      updateError: updateMutation.isError,
    });
  }, [
    createMutation.isPending,
    createMutation.isSuccess,
    createMutation.isError,
    updateMutation.isPending,
    updateMutation.isSuccess,
    updateMutation.isError,
  ]);

  // Save gratitude using React Query system - following reflection modal pattern
  const saveGratitude = async (gratitudeData: {
    items: string[];
    date: Date;
  }) => {
    // console.log('🙏 SmartJournalingGratitudeModal: saveGratitude called! Stack trace:', new Error().stack);

    try {
      if (!user?.id) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // console.log('🙏 SmartJournalingGratitudeModal: Saving gratitude entry:', {
      //   items: gratitudeData.items,
      //   subtaskId,
      //   stepId,
      //   playbookId,
      //   isEditMode: !!currentGratitudeEntry,
      // });

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
        }),
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
      };

      let result;
      if (currentGratitudeEntry?.id) {
        // Update existing gratitude entry
        console.log('🙏 SmartJournalingGratitudeModal: Updating existing gratitude entry');
        result = await updateMutation.mutateAsync({
          id: currentGratitudeEntry.id,
          updates: gratitudeEntry,
        });
      } else {
        // Create new gratitude entry
        console.log('🙏 SmartJournalingGratitudeModal: Creating new gratitude entry');
        result = await createMutation.mutateAsync(gratitudeEntry);
      }

      // console.log('🙏 SmartJournalingGratitudeModal: Save successful:', result);

      // Track analytics (simplified for now)
      // console.log('🙏 Gratitude analytics:', {
      //   action: currentGratitudeEntry ? 'updated' : 'created',
      //   items_count: gratitudeData.items.filter(item => item.trim()).length,
      //   source: 'smart_journaling',
      // });

      // Invalidate and refetch relevant queries more specifically
      // console.log('🙏 SmartJournalingGratitudeModal: Invalidating queries...');
      await queryClient.invalidateQueries({
        queryKey: ['gratitude', user.id, dateStr, subtaskId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['gratitude', user.id, dateStr],
      });
      // console.log('🙏 SmartJournalingGratitudeModal: Queries invalidated');

      // Show success modal for all saves (both new entries and edits)
      setShowSuccessModal(true);

      // Store completion info for later use - only AFTER successful save
      if (stepId && subtaskId) {
        console.log('🙏 SmartJournalingGratitudeModal: Setting completion info for step completion after successful save');
        setCompletionInfo({ stepId, subtaskId });
      }

      // Call onSave with delay to allow success modal to render
      setTimeout(() => {
        onSave(result);
      }, 100);

    } catch (error) {
      console.error('🙏 SmartJournalingGratitudeModal: Error saving gratitude entry:', error);
      // Clear completion info on error to prevent false completion
      setCompletionInfo(null);
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
    onCancel(); // Close the main modal
  };

  const handleEdit = () => {
    console.log('🙏 SmartJournalingGratitudeModal: Edit button pressed, closing success modal');
    setShowSuccessModal(false);
    // Keep modal open for continued editing
  };



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
          {/* TEST BUTTON - Remove after debugging */}


          <GratitudeLogEditor
            onSave={saveGratitude}
            onCancel={onCancel}
            initialItems={currentGratitudeEntry?.content ?
              (() => {
                try {
                  const parsedContent = typeof currentGratitudeEntry.content === 'string'
                    ? JSON.parse(currentGratitudeEntry.content)
                    : currentGratitudeEntry.content;
                  return parsedContent.items || [];
                } catch (error) {
                  console.error('Error parsing gratitude content for initialItems:', error);
                  return [];
                }
              })()
              : undefined
            }
            subtaskTitle={subtaskTitle}
            subtaskId={subtaskId}
            stepId={stepId}
            playbookTitle={playbookTitle}
            actionStepNumber={actionStepNumber}
            actionStepTitle={actionStepTitle}
            isLoading={createMutation.isPending || updateMutation.isPending}
            styles={reflectionLogStyles}
          />
        </KeyboardAvoidingView>

        {/* Success Modal - Shows for all saves */}
        <SuccessModal
          visible={showSuccessModal}
          onDismiss={handleSuccessModalClose}
          onEdit={handleEdit}
          title={isEditSession ? 'Gratitude Updated!' : 'Gratitude Saved!'}
          message={isEditSession ? 'Your gratitude entry has been updated successfully.' : 'Your gratitude entry has been saved successfully.'}
          animationDuration={300}
        />
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

export default SmartJournalingGratitudeModal;

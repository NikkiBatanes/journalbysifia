import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Modal, KeyboardAvoidingView, Platform, Alert, Keyboard } from 'react-native';
import SuccessModal from '../components/SuccessModal';
import GratitudeLogEditor, { GratitudeLogEditorRef } from '../components/journal/GratitudeLogEditor';
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
  const gratitudeEditorRef = useRef<GratitudeLogEditorRef>(null);

  // Preserve initial metadata to prevent loss after parent state clears
  const [preservedSubtaskTitle, setPreservedSubtaskTitle] = useState(subtaskTitle);
  const [preservedActionStepNumber, setPreservedActionStepNumber] = useState(actionStepNumber);
  const [preservedActionStepTitle, setPreservedActionStepTitle] = useState(actionStepTitle);
  const [preservedPlaybookTitle, setPreservedPlaybookTitle] = useState(playbookTitle);

  // Update preserved metadata when receiving non-empty values
  useEffect(() => {
    if (subtaskTitle && subtaskTitle.trim() !== '') {
      setPreservedSubtaskTitle(subtaskTitle);
    }
  }, [subtaskTitle]);

  useEffect(() => {
    if (actionStepNumber !== undefined && actionStepNumber > 0) {
      setPreservedActionStepNumber(actionStepNumber);
    }
  }, [actionStepNumber]);

  useEffect(() => {
    if (actionStepTitle && actionStepTitle.trim() !== '') {
      setPreservedActionStepTitle(actionStepTitle);
    }
  }, [actionStepTitle]);

  useEffect(() => {
    if (playbookTitle && playbookTitle.trim() !== '') {
      setPreservedPlaybookTitle(playbookTitle);
    }
  }, [playbookTitle]);

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
      console.log('🙏 SmartJournalingGratitudeModal: Modal opening');

      // Debug: Check completion state when modal opens
      if (stepId && subtaskId) {
        const step = actionSteps.find(s => s.id === stepId);
        const subtask = step?.subTasks?.find(st => st.id === subtaskId);
        console.log('🙏 SmartJournalingGratitudeModal: Modal opening - Current completion state:', {
          stepId,
          subtaskId,
          stepCompleted: step?.completed,
          subtaskCompleted: subtask?.completed,
          stepFound: !!step,
          subtaskFound: !!subtask,
        });
      }

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

      console.log('🙏 SmartJournalingGratitudeModal: Edit session:', !!hasExistingData);

      // Auto-focus the first input when modal opens for new entries
      if (!hasExistingData) {
        setTimeout(() => {
          if (gratitudeEditorRef.current) {
            gratitudeEditorRef.current.focusInput();
          }
        }, 500); // Delay to allow modal animation to complete
      }
    }
    setPrevVisible(visible);
  }, [visible, prevVisible, currentGratitudeEntry, actionSteps, stepId, subtaskId]);



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

  // Debug: Track actionSteps changes to see if completion state is being lost
  useEffect(() => {
    if (stepId && subtaskId && actionSteps?.length > 0) {
      const step = actionSteps.find(s => s.id === stepId);
      const subtask = step?.subTasks?.find(st => st.id === subtaskId);
      console.log('🙏 SmartJournalingGratitudeModal: ActionSteps changed - Current completion state:', {
        stepId,
        subtaskId,
        stepCompleted: step?.completed,
        subtaskCompleted: subtask?.completed,
        stepFound: !!step,
        subtaskFound: !!subtask,
        totalSteps: actionSteps.length,
        timestamp: new Date().toISOString(),
      });
    }
  }, [actionSteps, stepId, subtaskId]);

  // Save gratitude data to database immediately and mark subtask complete
  const saveGratitude = async (gratitudeData: {
    items: string[];
    date: Date;
  }) => {
    try {
      if (!user?.id) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      console.log('🙏 SmartJournalingGratitudeModal: Saving gratitude data to database immediately', {
        items: gratitudeData.items,
        subtaskId,
        stepId,
        playbookId,
        isEditMode: !!currentGratitudeEntry,
      });

      // Filter out blank items and remove number prefixes
      const cleanedItems = gratitudeData.items
        .filter(item => item.trim().length > 0)
        .map(item => {
          const cleaned = item.replace(/^\d+\. /, '').trim();
          return cleaned;
        })
        .filter(item => item.length > 0);

      const gratitudeEntry = {
        user_id: user?.id || '',
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

      // Invalidate and refetch relevant queries
      if (user?.id) {
        await queryClient.invalidateQueries({
          queryKey: ['gratitude', user.id, dateStr, subtaskId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['gratitude', user.id, dateStr],
        });
      }

      console.log('✅ SmartJournalingGratitudeModal: Database save completed');

      // Call parent onSave callback
      onSave(result);

      // Mark subtask as completed immediately since data is saved
      if (stepId && subtaskId && handleToggleStep) {
        console.log('🙏 SmartJournalingGratitudeModal: Marking subtask as completed (data saved)', {
          stepId,
          subtaskId,
          actionStepsCount: actionSteps?.length || 0,
        });

        // Check if the step/subtask is already completed before toggling
        const step = actionSteps.find(s => s.id === stepId);
        console.log('🙏 SmartJournalingGratitudeModal: Found step:', {
          stepFound: !!step,
          stepId: step?.id,
          stepCompleted: step?.completed,
          subTasksCount: step?.subTasks?.length || 0,
        });

        if (step) {
          if (subtaskId) {
            // Check subtask completion
            const subtask = step.subTasks?.find(st => st.id === subtaskId);
            console.log('🙏 SmartJournalingGratitudeModal: Found subtask:', {
              subtaskFound: !!subtask,
              subtaskId: subtask?.id,
              subtaskCompleted: subtask?.completed,
            });

            if (subtask && !subtask.completed) {
              console.log('🙏 SmartJournalingGratitudeModal: Calling handleToggleStep to mark subtask as completed');
              handleToggleStep(stepId, subtaskId);
              console.log('🙏 SmartJournalingGratitudeModal: handleToggleStep called successfully');
            } else {
              console.log('🙏 SmartJournalingGratitudeModal: Subtask already completed or not found, skipping toggle');
            }
          } else {
            // Check step completion
            if (!step.completed) {
              console.log('🙏 SmartJournalingGratitudeModal: Calling handleToggleStep to mark step as completed');
              handleToggleStep(stepId, subtaskId);
              console.log('🙏 SmartJournalingGratitudeModal: handleToggleStep called successfully');
            } else {
              console.log('🙏 SmartJournalingGratitudeModal: Step already completed, skipping toggle');
            }
          }
        } else {
          console.warn('🙏 SmartJournalingGratitudeModal: Step not found in actionSteps:', {
            stepId,
            availableStepIds: actionSteps?.map(s => s.id) || [],
          });
        }
      } else {
        console.warn('🙏 SmartJournalingGratitudeModal: Missing required data for completion:', {
          hasStepId: !!stepId,
          hasSubtaskId: !!subtaskId,
          hasHandleToggleStep: !!handleToggleStep,
        });
      }

      // Show success modal after save and completion (with small delay to allow UI update)
      setTimeout(() => {
        setShowSuccessModal(true);
      }, 100);

      console.log('✅ SmartJournalingGratitudeModal: Gratitude saved and subtask marked complete');
    } catch (error: any) {
      console.error('❌ SmartJournalingGratitudeModal: SAVE FAILED:', error);
      Alert.alert(
        'Error',
        `Failed to save gratitude: ${error?.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  };



  const handleCancel = () => {
    console.log('🙏 SmartJournalingGratitudeModal: Cancel pressed');

    // Debug: Check completion state when cancelling
    if (stepId && subtaskId) {
      const step = actionSteps.find(s => s.id === stepId);
      const subtask = step?.subTasks?.find(st => st.id === subtaskId);
      console.log('🙏 SmartJournalingGratitudeModal: Cancel - Current completion state:', {
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

  const handleSuccessModalClose = () => {
    console.log('🙏 User clicked Done - closing modal (already saved and completed)');
    setShowSuccessModal(false);
    onCancel(); // Close the main modal
  };

  const handleEdit = () => {
    console.log('🙏 SmartJournalingGratitudeModal: Edit button pressed, closing success modal');

    // Debug: Check completion state when editing
    if (stepId && subtaskId) {
      const step = actionSteps.find(s => s.id === stepId);
      const subtask = step?.subTasks?.find(st => st.id === subtaskId);
      console.log('🙏 SmartJournalingGratitudeModal: Edit - Current completion state:', {
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
      if (gratitudeEditorRef.current) {
        gratitudeEditorRef.current.focusInput();
      }
    }, 300); // Small delay to allow modal to close
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
            ref={gratitudeEditorRef}
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
            subtaskTitle={preservedSubtaskTitle}
            subtaskId={subtaskId}
            stepId={stepId}
            playbookTitle={preservedPlaybookTitle}
            actionStepNumber={preservedActionStepNumber}
            actionStepTitle={preservedActionStepTitle}
            isLoading={createMutation.isPending || updateMutation.isPending}
            styles={reflectionLogStyles}
          />
        </KeyboardAvoidingView>

        {/* Success Modal - Shows for all saves */}
        <SuccessModal
          visible={showSuccessModal}
          onDismiss={handleSuccessModalClose}
          onEdit={handleEdit}
          title={'Gratitude Saved!'}
          message={'Your gratitude entry has been saved successfully.'}
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

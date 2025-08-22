import React, { useState, useEffect, useRef } from 'react';
import { toLocalDateString } from '../utils/date';
import { Modal, KeyboardAvoidingView, Platform, StyleSheet, Alert, View } from 'react-native';
import NewSuccessModal from '../components/NewSuccessModal';
import { useSuccessModal } from '../hooks/useSuccessModal';
import ReflectionLogEditor, { ReflectionLogEditorRef } from '../components/journal/ReflectionLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/reflectionStyles';
import { Colors } from '../theme';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useActionSteps } from '../context/ActionStepsContext';
import { useCreateReflection, useUpdateReflection } from '../services/hooks/useReflectionData';
import { useQueryClient } from '@tanstack/react-query';

import { analytics } from '../utils/analytics';

interface SmartJournalingReflectionModalProps {
  visible: boolean;
  subtaskTitle: string;
  subtaskId?: string;
  stepId?: string;
  playbookId?: string;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  existingReflection?: any; // For editing existing reflections
  selectedDate?: Date; // Date to use for reflection (defaults to current date)
  onSave: (entry: any) => void;
  onCancel: () => void;
}

const SmartJournalingReflectionModal: React.FC<SmartJournalingReflectionModalProps> = ({
  visible,
  subtaskTitle,
  subtaskId,
  stepId,
  playbookId,
  playbookTitle,
  actionStepNumber,
  actionStepTitle,
  existingReflection,
  selectedDate,
  onSave,
  onCancel,
}) => {
  // Store the initial metadata to preserve it even if props become empty after save
  const [preservedSubtaskTitle, setPreservedSubtaskTitle] = React.useState(subtaskTitle);
  const [preservedActionStepNumber, setPreservedActionStepNumber] = React.useState(actionStepNumber);
  const [preservedActionStepTitle, setPreservedActionStepTitle] = React.useState(actionStepTitle);
  const [preservedPlaybookTitle, setPreservedPlaybookTitle] = React.useState(playbookTitle);

  // Track when metadata props change and preserve non-empty values
  React.useEffect(() => {
    if (subtaskTitle && subtaskTitle.trim() !== '') {
      setPreservedSubtaskTitle(subtaskTitle);
      console.log('💾 SmartJournalingReflectionModal: Preserved subtaskTitle:', subtaskTitle);
    }
  }, [subtaskTitle]);

  React.useEffect(() => {
    if (actionStepNumber !== undefined && actionStepNumber !== null) {
      setPreservedActionStepNumber(actionStepNumber);
      console.log('💾 SmartJournalingReflectionModal: Preserved actionStepNumber:', actionStepNumber);
    }
  }, [actionStepNumber]);

  React.useEffect(() => {
    if (actionStepTitle && actionStepTitle.trim() !== '') {
      setPreservedActionStepTitle(actionStepTitle);
      console.log('💾 SmartJournalingReflectionModal: Preserved actionStepTitle:', actionStepTitle);
    }
  }, [actionStepTitle]);

  React.useEffect(() => {
    if (playbookTitle && playbookTitle.trim() !== '') {
      setPreservedPlaybookTitle(playbookTitle);
      console.log('💾 SmartJournalingReflectionModal: Preserved playbookTitle:', playbookTitle);
    }
  }, [playbookTitle]);

  const { user } = useAuth();
  const { handleToggleStep, actionSteps } = useActionSteps();
  const queryClient = useQueryClient();

  // Success modal handlers
  const successModal = useSuccessModal(
    () => {
      // Done callback - close the main modal
      console.log('✅ SmartJournalingReflectionModal: Success modal Done pressed - closing main modal');
      onCancel(); // This closes the main modal
    },
    () => {
      // Edit callback - keep modal open and focus input
      console.log('✏️ SmartJournalingReflectionModal: Success modal Edit pressed - keeping modal open');
      handleEditFocus();
    }
  );

  // Debug: Log success modal state changes
  useEffect(() => {
    console.log('🔍 SmartJournalingReflectionModal: Success modal state changed:', {
      isVisible: successModal.isVisible,
      hasConfig: !!successModal.config,
      configTitle: successModal.config?.title,
    });
  }, [successModal.isVisible, successModal.config]);

  const dateToUse = selectedDate || new Date();
  const dateStr = toLocalDateString(dateToUse); // Use selected date for consistency
  const reflectionEditorRef = useRef<ReflectionLogEditorRef>(null);

  // Debug: Log existing reflection prop
  React.useEffect(() => {
    console.log('💭 SmartJournalingReflectionModal: Props debug:', {
      visible,
      subtaskTitle,
      subtaskId,
      subtaskIdType: typeof subtaskId,
      stepId,
      playbookId,
      playbookTitle,
      actionStepNumber,
      actionStepTitle,
      existingReflection: existingReflection ? {
        id: existingReflection.id,
        title: existingReflection.title,
        content: existingReflection.content?.substring(0, 50) + '...',
        hasContent: !!existingReflection.content,
        subtask_id: existingReflection.subtask_id,
      } : null,
      isEditMode: !!existingReflection,
    });
  }, [visible, subtaskTitle, subtaskId, stepId, playbookId, playbookTitle, actionStepNumber, actionStepTitle, existingReflection]);

  // Clear completion info when modal opens to prevent accidental triggers
  const [prevVisible, setPrevVisible] = useState(visible);
  useEffect(() => {
    if (visible && !prevVisible) {
      // Modal is opening (transition from false to true)
      console.log('📝 SmartJournalingReflectionModal: Modal opening');

      // Reset success modal state when main modal opens to prevent stale state
      successModal.hideSuccess();
      console.log('🔄 SmartJournalingReflectionModal: Reset success modal state on modal open');

      // Auto-focus the first input when modal opens for new entries
      const hasExistingContent = existingReflection?.content && existingReflection.content.trim();
      if (!hasExistingContent) {
        setTimeout(() => {
          if (reflectionEditorRef.current) {
            reflectionEditorRef.current.focusInput();
          }
        }, 500); // Delay to allow modal animation to complete
      }
    }
    setPrevVisible(visible);
  }, [visible, prevVisible, existingReflection?.content, successModal]);



  const { createMutation, updateMutation } = {
    createMutation: useCreateReflection(),
    updateMutation: useUpdateReflection(),
  };
  const isLoading = createMutation.isPending || updateMutation.isPending;
  // Note: We don't need to refetch data since the modal will close after saving

  // Save reflection data to database immediately and mark subtask complete
  const saveReflection = async (entry: {
    title: string;
    content: string;
    tags?: string[];
    type?: string;
    source?: string;
    prompt?: string;
    [key: string]: any; // Allow additional fields from ReflectionLogEditor
  }) => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('💭 SmartJournalingReflectionModal: Saving reflection data to database immediately', {
        subtaskTitle,
        subtaskId,
        playbookId,
        entry,
        entryType: entry.type,
      });

      const reflectionData = {
        user_id: user.id,
        title: entry.title,
        content: entry.content,
        type: 'playbook' as const,
        source: 'playbook' as const,
        selected_date: dateStr,
        tags: [...(entry.tags || []), 'playbook'],
        ...(playbookTitle && { playbook_title: playbookTitle }),
        ...(playbookId && { playbook_id: playbookId }),
        ...(subtaskId && { subtask_id: subtaskId }),
        ...(actionStepNumber !== undefined && { day_number: actionStepNumber }),
        ...(actionStepTitle && { day_title: actionStepTitle }),
      };

      // Track analytics
      analytics.track('smart_journaling_reflection_saved', {
        subtask_id: subtaskId,
        playbook_id: playbookId,
        content_length: reflectionData.content.length,
        has_tags: (reflectionData.tags || []).length > 0,
      });

      // Use update if editing existing reflection, otherwise create new one
      let savedReflection;
      if (existingReflection) {
        console.log('💭 SmartJournalingReflectionModal: Updating existing reflection:', existingReflection.id);
        savedReflection = await updateMutation.mutateAsync({
          id: existingReflection.id,
          updates: reflectionData,
        });
        console.log('✅ SmartJournalingReflectionModal: Reflection updated successfully:', savedReflection?.id);
      } else {
        console.log('💭 SmartJournalingReflectionModal: Creating new reflection...');
        savedReflection = await createMutation.mutateAsync(reflectionData);
        console.log('✅ SmartJournalingReflectionModal: Reflection created successfully:', savedReflection?.id);
      }

      // Validate that the reflection was actually saved
      if (!savedReflection || !savedReflection.id) {
        throw new Error('Failed to save reflection - no ID returned');
      }

      // Simple cache invalidation (revert to working approach)
      if (user?.id) {
        await queryClient.invalidateQueries({
          queryKey: ['reflections', 'byDate', user.id, dateStr],
        });
        await queryClient.invalidateQueries({
          queryKey: ['journal', 'reflections', user.id, dateStr],
        });
        await queryClient.invalidateQueries({
          queryKey: ['journal', 'all'],
        });
      }

      console.log('✅ SmartJournalingReflectionModal: Cache invalidation completed');

      // Call parent onSave callback
      onSave(savedReflection);

      // Mark subtask as completed immediately since data is saved (only for new reflections)
      if (!existingReflection && stepId && subtaskId && handleToggleStep) {
        console.log('💭 SmartJournalingReflectionModal: Marking subtask as completed (data saved)', {
          stepId,
          subtaskId,
          actionStepsCount: actionSteps?.length || 0,
        });

        // Check if the step/subtask is already completed before toggling
        const step = actionSteps.find(s => s.id === stepId);
        console.log('💭 SmartJournalingReflectionModal: Found step:', {
          stepFound: !!step,
          stepId: step?.id,
          stepCompleted: step?.completed,
          subTasksCount: step?.subTasks?.length || 0,
        });

        if (step) {
          if (subtaskId) {
            // Check subtask completion
            const subtask = step.subTasks?.find(st => st.id === subtaskId);
            console.log('💭 SmartJournalingReflectionModal: Found subtask:', {
              subtaskFound: !!subtask,
              subtaskId: subtask?.id,
              subtaskCompleted: subtask?.completed,
            });

            if (subtask && !subtask.completed) {
              console.log('💭 SmartJournalingReflectionModal: Calling handleToggleStep to mark subtask as completed');
              handleToggleStep(stepId, subtaskId);
              console.log('💭 SmartJournalingReflectionModal: handleToggleStep called successfully');
            } else {
              console.log('💭 SmartJournalingReflectionModal: Subtask already completed or not found, skipping toggle');
            }
          } else {
            // Check step completion
            if (!step.completed) {
              console.log('💭 SmartJournalingReflectionModal: Calling handleToggleStep to mark step as completed');
              handleToggleStep(stepId, subtaskId);
              console.log('💭 SmartJournalingReflectionModal: handleToggleStep called successfully');
            } else {
              console.log('💭 SmartJournalingReflectionModal: Step already completed, skipping toggle');
            }
          }
        } else {
          console.warn('💭 SmartJournalingReflectionModal: Step not found in actionSteps:', {
            stepId,
            availableStepIds: actionSteps?.map(s => s.id) || [],
          });
        }
      } else {
        console.log('💭 SmartJournalingReflectionModal: Skipping completion - editing existing reflection or missing data:', {
          hasExistingReflection: !!existingReflection,
          hasStepId: !!stepId,
          hasSubtaskId: !!subtaskId,
          hasHandleToggleStep: !!handleToggleStep,
        });
      }

      // Show success modal in next render cycle to avoid React state batching issues
      const isEditing = !!existingReflection;
      setTimeout(() => {
        successModal.showSuccess({
          title: isEditing ? 'Reflection Updated' : 'Reflection Saved',
          message: isEditing ? 'Your reflection has been updated.' : 'Your reflection has been saved to your journal.',
          showEditButton: true,
        });
        console.log('✅ SmartJournalingReflectionModal: Success modal triggered in next render cycle');
      }, 0);
      console.log('✅ SmartJournalingReflectionModal: Success modal scheduled to show');

      console.log('✅ SmartJournalingReflectionModal: Reflection saved and subtask marked complete');
    } catch (error: any) {
      console.error('❌ SmartJournalingReflectionModal: SAVE FAILED:', error);
      Alert.alert(
        'Error',
        `Failed to save reflection: ${error?.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  };



  // Edit handler for focusing input after success modal closes
  const handleEditFocus = () => {
    // Focus the input and position cursor at the end
    setTimeout(() => {
      if (reflectionEditorRef.current) {
        reflectionEditorRef.current.focusInput();
      }
    }, 300); // Small delay to allow modal to close
    // Keep modal open for continued editing
  };

  const handleCancel = () => {
    console.log('💭 SmartJournalingReflectionModal: Cancel pressed');

    // Debug: Check completion state when cancelling
    if (stepId && subtaskId) {
      const step = actionSteps.find(s => s.id === stepId);
      const subtask = step?.subTasks?.find(st => st.id === subtaskId);
      console.log('💭 SmartJournalingReflectionModal: Cancel - Current completion state:', {
        stepId,
        subtaskId,
        stepCompleted: step?.completed,
        subtaskCompleted: subtask?.completed,
        stepFound: !!step,
        subtaskFound: !!subtask,
      });
    }

    // ReflectionLogEditor handles draft saving automatically
    // No need for discard confirmation as drafts are preserved
    onCancel();
  };

  // Debug: Log main modal visibility changes
  useEffect(() => {
    console.log('🎭 SmartJournalingReflectionModal: Main modal visibility changed:', {
      visible,
      timestamp: new Date().toISOString(),
    });
  }, [visible]);

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
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.container}>
            <ReflectionLogEditor
              ref={reflectionEditorRef}
              onSave={saveReflection}
              onCancel={handleCancel}
              // Note: onDelete prop intentionally omitted - users delete via Reflection Log
              initialTitle={preservedSubtaskTitle}
              lockTitle={true}
              source="playbook"
              initialMode="free-form"
              styles={reflectionLogStyles}
              dateString={(function() {
                const now = new Date();
                const year = now.getFullYear();
                const todayString = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                const todayStringWithYear = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                return year === new Date().getFullYear() ? todayString : todayStringWithYear;
              })()}
              playbookTitle={preservedPlaybookTitle}
              dayNumber={(() => {
                console.log('🔍 SmartJournalingReflectionModal: Step info debug:', {
                  existingReflection_day_number: existingReflection?.day_number,
                  existingReflection_day_title: existingReflection?.day_title,
                  preservedActionStepNumber,
                  preservedActionStepTitle,
                  existingReflectionKeys: existingReflection ? Object.keys(existingReflection) : 'no existing reflection',
                });
                return existingReflection?.day_number ?? preservedActionStepNumber;
              })()}
              dayTitle={existingReflection?.day_title ?? preservedActionStepTitle}
              subtaskId={subtaskId}
              initialEntry={existingReflection ? {
                title: existingReflection.title || preservedSubtaskTitle,
                content: existingReflection.content || '',
                tags: existingReflection.tags || [],
                type: 'free-form',
                source: 'playbook',
              } : undefined}
              isLoading={isLoading}
            />

          {/* New success modal system - completely isolated and robust */}
          <NewSuccessModal
            visible={successModal.isVisible}
            config={successModal.config}
            onDone={successModal.handleDone}
            onEdit={successModal.handleEdit}
          />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Loading overlay removed to preserve metadata visibility during save */}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: Colors.hopeWhite,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.anchorBlue,
    fontWeight: '500',
  },
});

export default SmartJournalingReflectionModal;

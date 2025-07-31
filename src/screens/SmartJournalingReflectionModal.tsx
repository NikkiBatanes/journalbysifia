import React, { useState, useEffect, useRef } from 'react';
import { Modal, KeyboardAvoidingView, Platform, StyleSheet, Alert, View } from 'react-native';
import SuccessModal from '../components/SuccessModal';
import ReflectionLogEditor, { ReflectionLogEditorRef } from '../components/journal/ReflectionLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/reflectionStyles';
import { Colors } from '../theme';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useActionSteps } from '../context/ActionStepsContext';
import { useCreateReflection, useUpdateReflection } from '../services/hooks/useReflectionData';
import { useQueryClient } from '@tanstack/react-query';
import { usePlaybookStore } from '../store/usePlaybookStore';
import { updatePlaybookActionSteps } from '../services/apiIntegration';
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
  const { handleToggleStep } = useActionSteps();
  const queryClient = useQueryClient();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completionInfo, setCompletionInfo] = useState<{ stepId: string; subtaskId: string } | null>(null);
  const [pendingReflectionData, setPendingReflectionData] = useState<any>(null); // Store data before DB save
  const dateStr = new Date().toISOString().split('T')[0]; // Use ISO format to match ReflectionLogReactQuery
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
      console.log('📝 SmartJournalingReflectionModal: Modal opening, clearing any existing completion info');
      setCompletionInfo(null);

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
  }, [visible, prevVisible, existingReflection?.content]);

  // Handle subtask completion when modal closes after "DONE" is clicked
  useEffect(() => {
    console.log('💭 SmartJournalingReflectionModal: Completion useEffect triggered', {
      visible,
      hasCompletionInfo: !!completionInfo,
      completionInfo,
    });

    // Clear completion info when modal closes without completing
    // Completion only happens when user clicks "Done" in success modal
    if (!visible && completionInfo) {
      console.log('📝 SmartJournalingReflectionModal: Modal closed, completion info preserved for Done button');
    }
  }, [visible, completionInfo, handleToggleStep]);

  const { createMutation, updateMutation } = {
    createMutation: useCreateReflection(),
    updateMutation: useUpdateReflection(),
  };
  const isLoading = createMutation.isPending || updateMutation.isPending;
  // Note: We don't need to refetch data since the modal will close after saving

  // Prepare reflection data for saving (but don't save to DB yet)
  const prepareReflection = async (entry: {
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

      console.log('💭 SmartJournalingReflectionModal: Preparing reflection data (not saving to DB yet)', {
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

      // Store the prepared data for later saving
      setPendingReflectionData(reflectionData);

      // Show success modal immediately (before DB save)
      setShowSuccessModal(true);

      // Set completion info for later use
      if (!existingReflection && stepId && subtaskId) {
        console.log('💭 SmartJournalingReflectionModal: Setting completion info for later use', {
          stepId,
          subtaskId,
        });
        setCompletionInfo({ stepId, subtaskId });
      }

      console.log('✅ SmartJournalingReflectionModal: Reflection prepared, showing success modal');
    } catch (error: any) {
      console.error('❌ SmartJournalingReflectionModal: PREPARE FAILED:', error);
      Alert.alert(
        'Error',
        `Failed to prepare reflection: ${error?.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  };

  // Actually save to database (called only when user clicks "Done")
  const saveToDatabase = async () => {
    if (!pendingReflectionData) {
      console.error('❌ No pending reflection data to save');
      return;
    }

    try {
      console.log('💭 SmartJournalingReflectionModal: Saving to database...', pendingReflectionData);

      // Track analytics
      analytics.track('smart_journaling_reflection_saved', {
        subtask_id: subtaskId,
        playbook_id: playbookId,
        content_length: pendingReflectionData.content.length,
        has_tags: (pendingReflectionData.tags || []).length > 0,
      });

      // Use update if editing existing reflection, otherwise create new one
      let savedReflection;
      if (existingReflection) {
        console.log('💭 SmartJournalingReflectionModal: Updating existing reflection:', existingReflection.id);
        savedReflection = await updateMutation.mutateAsync({
          id: existingReflection.id,
          updates: pendingReflectionData,
        });
        console.log('✅ SmartJournalingReflectionModal: Reflection updated successfully:', savedReflection?.id);
      } else {
        console.log('💭 SmartJournalingReflectionModal: Creating new reflection...');
        savedReflection = await createMutation.mutateAsync(pendingReflectionData);
        console.log('✅ SmartJournalingReflectionModal: Reflection created successfully:', savedReflection?.id);
      }

      // Validate that the reflection was actually saved
      if (!savedReflection || !savedReflection.id) {
        throw new Error('Save operation completed but no reflection ID returned - save may have failed');
      }

      console.log('✅ SmartJournalingReflectionModal: Save validation passed - reflection has ID:', savedReflection.id);

      // Invalidate reflection cache to ensure UI updates
      console.log('🔄 SmartJournalingReflectionModal: Invalidating reflection cache for UI refresh...');

      const currentDateStr = new Date().toISOString().split('T')[0];

      // 1. Invalidate Daily UI query
      if (user?.id) {
        await queryClient.invalidateQueries({
          queryKey: ['reflections', 'byDate', user.id, currentDateStr],
          exact: true,
        });
      }

      // 2. Invalidate smart journaling subtask query
      if (subtaskId && user?.id) {
        await queryClient.invalidateQueries({
          queryKey: ['reflections', 'subtask', user.id, subtaskId],
          exact: true,
        });
      }

      // 3. Broad invalidation as fallback
      await queryClient.invalidateQueries({
        queryKey: ['reflections'],
        exact: false,
      });

      console.log('✅ SmartJournalingReflectionModal: Database save and cache invalidation completed');

      // Call parent onSave callback
      onSave(pendingReflectionData);

      return savedReflection;
    } catch (error: any) {
      // Clear completion info on error to prevent false completion
      setCompletionInfo(null);
      setPendingReflectionData(null);

      const errorMessage = error?.message || 'Unknown error';
      console.error('❌ SmartJournalingReflectionModal: DATABASE SAVE FAILED:', {
        error,
        errorMessage,
        userId: user?.id,
        subtaskId,
        playbookId,
        existingReflection: existingReflection?.id,
        isUpdate: !!existingReflection,
      });

      // Track save failures for debugging
      analytics.track('smart_journaling_save_failed', {
        error_message: errorMessage,
        subtask_id: subtaskId,
        playbook_id: playbookId,
        is_update: !!existingReflection,
      });

      Alert.alert(
        'Save Failed',
        `Failed to save reflection: ${errorMessage}. Please try again.`,
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  // Note: Delete functionality intentionally removed from smart journaling modal.
  // Users can delete reflections through the main Reflection Log interface.

  const handleSuccessModalClose = async () => {
    console.log('📝 User clicked Done - saving to database and closing modal');
    setShowSuccessModal(false);

    try {
      // Save to database when user clicks "Done"
      await saveToDatabase();

      // Mark step as completed when user clicks "Done"
      if (completionInfo && handleToggleStep) {
        console.log('📝 Marking step as completed on Done click:', completionInfo);
        handleToggleStep(completionInfo.stepId, completionInfo.subtaskId);

        // Save the updated steps to the database
        if (playbookId) {
          try {
            // Get the current playbook from the store
            const currentPlaybook = usePlaybookStore.getState().playbooks.find(p => p.id === playbookId);
            if (currentPlaybook) {
              // Save the updated action steps
              await updatePlaybookActionSteps(playbookId, currentPlaybook.actionSteps || []);
              console.log('✅ Successfully saved completion status to database');
            }
          } catch (error) {
            console.error('❌ Failed to save completion status:', error);
            // Optionally show an error message to the user
            Alert.alert(
              'Update Failed',
              'Could not update the completion status. Please try again.'
            );
          }
        }

        setCompletionInfo(null);
      }

      // Clear pending data after successful save
      setPendingReflectionData(null);

      onCancel();
    } catch (error) {
      console.error('❌ Failed to save reflection on Done click:', error);
      // Don't close the modal if save failed - let user try again
    }
  };

  const handleEdit = () => {
    console.log('Edit button pressed, closing success modal');
    setShowSuccessModal(false);
    // Focus the input and position cursor at the end
    setTimeout(() => {
      if (reflectionEditorRef.current) {
        reflectionEditorRef.current.focusInput();
      }
    }, 300); // Small delay to allow modal to close
    // The editor will remain open since we're not calling onCancel
    // Step information is preserved for continued editing
  };

  const handleCancel = () => {
    // ReflectionLogEditor handles draft saving automatically
    // No need for discard confirmation as drafts are preserved
    onCancel();
  };

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
              onSave={prepareReflection}
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

          <SuccessModal
            visible={showSuccessModal}
            title="Reflection Saved"
            message="Your reflection has been saved to your journal."
            onDismiss={handleSuccessModalClose}
            onEdit={handleEdit}
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

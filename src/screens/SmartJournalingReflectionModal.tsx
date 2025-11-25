import React, { useState, useEffect, useRef } from 'react';
import { Logger } from '../utils/ProductionLogger';
import { toLocalDateString } from '../utils/date';
import { Modal, Alert, Keyboard, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NewSuccessModal from '../components/NewSuccessModal';
import { useSuccessModal } from '../hooks/useSuccessModal';
import ReflectionLogEditor, { ReflectionLogEditorRef } from '../components/journal/ReflectionLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/reflectionStyles';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useActionSteps } from '../context/ActionStepsContext';
import { useCreateReflection, useUpdateReflection } from '../services/hooks/useReflectionData';
import { useQueryClient } from '@tanstack/react-query';
import { faithPointsService } from '../services/faithPointsService';

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
  // When true, this reflection was opened from a guided prompt and should hide metadata
  isGuidedReflection?: boolean;
  // When true, hide the guided prompt button (heart icon)
  hideGuidedPromptButton?: boolean;
  // Initial title for the reflection
  initialTitle?: string;
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
  isGuidedReflection = false,
  hideGuidedPromptButton = true, // Default to true for backward compatibility
  initialTitle,
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

  const { user } = useAuth();

  // Make ActionSteps optional - modal can work without it (e.g., from Dashboard)
  let handleToggleStep: ((stepId: string) => void) | undefined;
  let actionSteps: any[] | undefined;
  try {
    const context = useActionSteps();
    handleToggleStep = context.handleToggleStep;
    actionSteps = context.actionSteps;
  } catch (error) {
    // Not in ActionStepsProvider context - that's okay, modal still works
    handleToggleStep = undefined;
    actionSteps = undefined;
  }

  const queryClient = useQueryClient();

  // Success modal handlers
  const successModal = useSuccessModal(
    () => {
      // Done callback - close the main modal

      onCancel(); // This closes the main modal
    },
    () => {
      // Edit callback - keep modal open and focus input

      handleEditFocus();
    }
  );

  // Debug: Log success modal state changes
  useEffect(() => {

  }, [successModal.isVisible, successModal.config]);

  const dateToUse = selectedDate || new Date();
  const dateStr = toLocalDateString(dateToUse); // Use selected date for consistency

  // Debug logging for date handling

  const reflectionEditorRef = useRef<ReflectionLogEditorRef>(null);

  // Debug: Log existing reflection prop
  React.useEffect(() => {

  }, [visible, subtaskTitle, subtaskId, stepId, playbookId, playbookTitle, actionStepNumber, actionStepTitle, existingReflection]);

  // Clear completion info when modal opens to prevent accidental triggers
  const [prevVisible, setPrevVisible] = useState(visible);
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible && !prevVisible) {
      // Modal is opening (transition from false to true)

      // Reset success modal state when main modal opens to prevent stale state
      successModal.hideSuccess();

      // Auto-focus the first input when modal opens for new entries
      const hasExistingContent = existingReflection?.content && existingReflection.content.trim();
      const isFreeformMode = !isGuidedReflection && !playbookId;

      // Skip auto-focus for freeform mode - let ReflectionLogEditor handle its own focus
      if (!hasExistingContent && !isFreeformMode) {

        focusTimeoutRef.current = setTimeout(() => {
          if (reflectionEditorRef.current) {

            reflectionEditorRef.current.focusInput();
          }
        }, 500); // Delay to allow modal animation to complete
      } else {

      }
    } else if (!visible && prevVisible) {
      // Modal is closing - clear any pending focus timeout
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;

      }
    }
    setPrevVisible(visible);
  }, [visible, prevVisible, existingReflection?.content, successModal, isGuidedReflection, playbookId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

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

      // Determine context: guided or playbook
      const isPlaybookContext = !isGuidedReflection && !!playbookId;

      // Use the type from ReflectionLogEditor if it's 'guided', otherwise use modal logic
      const finalType = entry.type === 'guided' ? 'guided' : (isGuidedReflection ? 'guided' : isPlaybookContext ? 'playbook' : 'free');
      const finalSource = entry.type === 'guided' ? 'guided' : (isGuidedReflection ? 'guided' : isPlaybookContext ? 'playbook' : 'freeform');

      // Validate UUID format before including in data
      const isValidUUID = (id: string | undefined): boolean => {
        if (!id) {return false;}
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(id);
      };

      const reflectionData = {
        user_id: user?.id || '',
        title: entry.title,
        content: entry.content,
        type: finalType,
        selected_date: dateStr,
        tags: [...(entry.tags || []), (finalType === 'guided' ? 'guided' : finalType === 'playbook' ? 'playbook' : 'freeform')],
        // Save the prompt for guided reflections so it can be displayed in the journal
        ...(finalType === 'guided' && (entry.prompt || preservedSubtaskTitle) ? { prompt: entry.prompt || preservedSubtaskTitle } : {}),
        // Only attach playbook metadata when not guided - validate UUIDs before including
        ...(isPlaybookContext && playbookTitle ? { playbook_title: playbookTitle } : {}),
        ...(isPlaybookContext && isValidUUID(playbookId) ? { playbook_id: playbookId } : {}),
        ...(isPlaybookContext && isValidUUID(subtaskId) ? { subtask_id: subtaskId } : {}),
        ...(isPlaybookContext && actionStepNumber !== undefined ? { day_number: actionStepNumber } : {}),
        ...(isPlaybookContext && actionStepTitle ? { day_title: actionStepTitle } : {}),
      };

      // Track analytics
      analytics.track('smart_journaling_reflection_saved', {
        subtask_id: subtaskId,
        playbook_id: playbookId,
        content_length: reflectionData.content.length,
        has_tags: (reflectionData.tags || []).length > 0,
      });

      // If this is a guided reflection, persist completion for today and notify listeners to update UI immediately
      if (isGuidedReflection) {
        try {
          const dateStrKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
          const storageKey = `@guided_completed_${dateStrKey}`;
          const existing = await AsyncStorage.getItem(storageKey);
          const list: string[] = existing ? JSON.parse(existing) : [];
          const q = preservedSubtaskTitle || entry.title;
          if (q && !list.includes(q)) {
            list.push(q);
            await AsyncStorage.setItem(storageKey, JSON.stringify(list));
          }
          // Emit global event so dashboard can remove the prompt immediately
          Keyboard.dismiss();
          DeviceEventEmitter.emit('guided_reflection_completed', { question: q, date: dateStrKey });
        } catch (e) {
          Logger.warn('Failed to persist guided completion', {
        component: 'SmartJournalingReflectionModal',
        error: e as Error,
      });
        }
      }

      // Use update if editing existing reflection, otherwise create new one
      let savedReflection;
      if (existingReflection) {

        savedReflection = await updateMutation.mutateAsync({
          id: existingReflection.id,
          updates: reflectionData,
        });

      } else {

        savedReflection = await createMutation.mutateAsync(reflectionData);

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

      // Emit event to refresh moments screen and journal screen
      DeviceEventEmitter.emit('reflection_saved', {
        reflectionId: savedReflection.id,
        type: reflectionData.type,
        source: finalSource,
      });

      // Award faith points for answering reflection question (only for new reflections)
      if (!existingReflection && user?.id) {
        try {
          await faithPointsService.awardPoints(
            user.id,
            'reflection_question_answered',
            {
              suppressNotification: true,
              source: finalType === 'guided' ? 'guided_prompt' : finalType === 'playbook' ? 'playbook_reflection' : 'devotional_question',
              question: preservedSubtaskTitle || entry.title,
            }
          );
        } catch (error) {
          Logger.warn('Failed to award faith points for reflection', {
            component: 'SmartJournalingReflectionModal',
            error: error as Error,
          });
        }
      }

      // Call parent onSave callback
      onSave(savedReflection);

      // Mark subtask as completed immediately since data is saved (only for new reflections)
      if (!existingReflection && stepId && subtaskId && handleToggleStep && actionSteps && !isGuidedReflection && isPlaybookContext) {

        // Check if the step/subtask is already completed before toggling
        const step = actionSteps.find((s: any) => s.id === stepId);

        if (step) {
          if (subtaskId) {
            // Check subtask completion
            const subtask = step.subTasks?.find((st: any) => st.id === subtaskId);

            if (subtask && !subtask.completed) {

              handleToggleStep(stepId);

            } else {

            }
          } else {
            // Check step completion
            if (!step.completed) {

              handleToggleStep(stepId);

            } else {

            }
          }
        }
      }

      // Show success modal in next render cycle to avoid React state batching issues
      const isEditing = !!existingReflection;
      setTimeout(() => {
        successModal.showSuccess({
          title: isEditing ? 'Reflection Updated' : 'Reflection Saved',
          message: isEditing ? 'Your reflection has been updated.' : 'Your reflection has been saved to your journal.',
          showEditButton: true,
        });

      }, 0);

    } catch (error: any) {
      Logger.error('❌ SmartJournalingReflectionModal: SAVE FAILED', error as Error, { component: 'SmartJournalingReflectionModal' });
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

    // Completion state handled by parent component

    // ReflectionLogEditor already handles keyboard dismissal and delay
    // Don't dismiss keyboard here to avoid double dismissal conflict
    onCancel();
  };

  // Debug: Log main modal visibility changes
  useEffect(() => {

  }, [visible]);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCancel}
      >
            <ReflectionLogEditor
              ref={reflectionEditorRef}
              onSave={saveReflection}
              onCancel={handleCancel}
              onUpgradeRequired={onCancel} // Close modal before navigating to upgrade
              // Note: onDelete prop intentionally omitted - users delete via Reflection Log
              // Pass initialTitle for freeform mode, or preservedSubtaskTitle for guided/playbook
              initialTitle={initialTitle !== undefined ? initialTitle : (preservedSubtaskTitle || '')}
              lockTitle={isGuidedReflection || !!playbookId}
              // Source: guided for guided prompt, playbook for playbook context, 'thoughts' for dashboard (enforces gating)
              source={isGuidedReflection ? 'guided' : (playbookId ? 'playbook' : 'thoughts')}
              initialMode="free-form"
              styles={reflectionLogStyles}
              dateString={(function() {
                const year = dateToUse.getFullYear();
                const currentYear = new Date().getFullYear();
                const dateString = dateToUse.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                const dateStringWithYear = dateToUse.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                return year === currentYear ? dateString : dateStringWithYear;
              })()} // Use the selected date for formatting
              // Only pass playbook metadata when not guided
              playbookTitle={(!isGuidedReflection && !!playbookId) ? preservedPlaybookTitle : undefined}
              dayNumber={(!isGuidedReflection && !!playbookId) ? (() => {

                return existingReflection?.day_number ?? preservedActionStepNumber;
              })() : undefined}
              dayTitle={(!isGuidedReflection && !!playbookId) ? (existingReflection?.day_title ?? preservedActionStepTitle) : undefined}
              subtaskId={subtaskId}
              initialEntry={existingReflection ? {
                title: existingReflection.title || preservedSubtaskTitle,
                content: existingReflection.content || '',
                tags: existingReflection.tags || [],
                type: 'free-form',
                source: isGuidedReflection ? 'guided' : (playbookId ? 'playbook' : 'thoughts'),
              } : undefined}
              isLoading={isLoading}
              hideGuidedPromptButton={hideGuidedPromptButton}
            />

          {/* New success modal system - completely isolated and robust */}
          <NewSuccessModal
            visible={successModal.isVisible}
            config={successModal.config}
            onDone={successModal.handleDone}
            onEdit={successModal.handleEdit}
          />
      </Modal>

      {/* Loading overlay removed to preserve metadata visibility during save */}
    </>
  );
};

export default withErrorBoundary(SmartJournalingReflectionModal, 'SmartJournalingReflectionModal');

import React, { useState, useEffect, useRef } from 'react';
import { Logger } from '../utils/ProductionLogger';
import { Modal, Alert, Keyboard } from 'react-native';
import NewSuccessModal from '../components/NewSuccessModal';
import { useSuccessModal } from '../hooks/useSuccessModal';
import GratitudeLogEditor, { GratitudeLogEditorRef } from '../components/journal/GratitudeLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/reflectionStyles';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useActionSteps } from '../context/ActionStepsContext';
import {
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useDeleteJournalEntry,
} from '../services/hooks/useJournalData';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { JournalApi } from '../services/api/journalApi';
import { toLocalDateString } from '../utils/date';

interface SmartJournalingGratitudeModalProps {
  visible: boolean;
  isActive?: boolean;
  subtaskTitle?: string;
  subtaskId?: string;
  stepId?: string;
  playbookId?: string;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  existingGratitude?: any;
  onSave: (entry: any) => void;
  onCancel: () => void;
  stepBody?: string;
  stepExample?: string | null;
}

const SmartJournalingGratitudeModal: React.FC<SmartJournalingGratitudeModalProps> = ({
  visible,
  isActive = true, // Default to true for backward compatibility
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
  stepBody,
  stepExample,
}) => {


  const { user } = useAuth();
  const { handleAutoCheckStep, actionSteps } = useActionSteps();
  const queryClient = useQueryClient();
  // New success modal system
  const successModal = useSuccessModal(
    () => onCancel(), // onDone: close the modal
    () => {} // onEdit: keep modal open for editing
  );
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
  const dateStr = toLocalDateString(new Date());
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
          Logger.error('Error parsing gratitude content', error as Error, {
      component: 'SmartJournalingGratitudeModal',
    });
          return false;
        }
      });
    },
    enabled: !!user?.id && !!subtaskId, // Remove 'visible' dependency to prefetch data
    staleTime: 30000, // 30 seconds
  });

  // Get the most recent gratitude entry for this subtask
  const currentGratitudeEntry = existingGratitudeEntries[0] || existingGratitude;

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
  const [prevActive, setPrevActive] = useState(false); // Start with false to detect initial activation
  const [prevVisible, setPrevVisible] = useState(false); // Start with false to detect initial visibility

  useEffect(() => {
    // Focus when modal becomes active (either through visibility change or isActive prop change)
    if (isActive && !prevActive) {
      // Modal is becoming active (transition from false to true)
      // Auto-focus the first input when modal opens (for both new and existing entries)
      // Use a longer delay to ensure modal is fully rendered and keyboard is ready
      setTimeout(() => {
        if (gratitudeEditorRef.current) {
          gratitudeEditorRef.current.focusInput();
        }
      }, 800); // Increased delay for better reliability
    }
    setPrevActive(isActive);
  }, [isActive, prevActive, currentGratitudeEntry, actionSteps, stepId, subtaskId]);

  // Also trigger focus when visible prop changes (for dashboard usage)
  useEffect(() => {
    // Focus when modal becomes visible (transition from false to true)
    if (visible && !prevVisible) {
      // Modal is becoming visible (transition from false to true)
      // Auto-focus the first input when modal opens (for both new and existing entries)
      // Use a longer delay to ensure modal is fully rendered and keyboard is ready
      setTimeout(() => {
        if (gratitudeEditorRef.current) {
          gratitudeEditorRef.current.focusInput();
        }
      }, 800); // Increased delay for better reliability
    }
    setPrevVisible(visible);
  }, [visible, prevVisible, currentGratitudeEntry, actionSteps, stepId, subtaskId]);

  // React Query mutations
  const createMutation = useCreateJournalEntry();
  const updateMutation = useUpdateJournalEntry();
  const deleteMutation = useDeleteJournalEntry();

  // Track mutation states
  useEffect(() => {

  }, [
    createMutation.isPending,
    createMutation.isSuccess,
    createMutation.isError,
    updateMutation.isPending,
    updateMutation.isSuccess,
    updateMutation.isError,
  ]);

  // Track actionSteps changes to see if completion state is being lost
  // Removed unused debug effect

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

      // Filter out blank items and remove number prefixes
      const cleanedItems = gratitudeData.items
        .filter(item => item.trim().length > 0)
        .map(item => {
          const cleaned = item.replace(/^\d+\. /, '').trim();
          return cleaned;
        })
        .filter(item => item.length > 0);

      // Delete only gratitude entries that match this subtaskId to prevent duplicates
      // If no subtaskId, delete all entries for the day (general gratitude editing)
      const allEntries = await JournalApi.getGratitudeEntries(user.id, dateStr);
      const entriesToDelete = subtaskId
        ? allEntries.filter((entry: any) => {
            // Check subtask_id in metadata field first (new format)
            if (entry.metadata?.subtask_id) {
              return entry.metadata.subtask_id === subtaskId;
            }
            // Fallback to checking in content for backward compatibility (old format)
            try {
              const parsedContent = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
              return parsedContent.metadata?.subtask_id === subtaskId || parsedContent.subtask_id === subtaskId;
            } catch {
              return false;
            }
          })
        : allEntries; // Delete all if no subtaskId (general gratitude from journal screen)

      for (const entry of entriesToDelete) {
        await deleteMutation.mutateAsync(entry.id);
      }

      const gratitudeEntry = {
        user_id: user?.id || '',
        selected_date: toLocalDateString(gratitudeData.date),
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

      // Always create a new entry after deleting all existing ones
      const result = await createMutation.mutateAsync(gratitudeEntry);

      // Call parent onSave callback immediately
      onSave(result);

      // Show success modal after a delay so user can see their saved content
      setTimeout(() => {
        successModal.showSuccess({
          title: 'Gratitude Saved',
          message: 'Your gratitude has been saved to your journal.',
          showEditButton: true,
        });
      }, 500);

      // PERFORMANCE: All cache invalidation is non-blocking - happens after UI updates
      if (user?.id) {
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ['journal', 'gratitude', user.id, dateStr],
          });
          queryClient.invalidateQueries({
            queryKey: ['journal', 'all'],
          });
        }, 0);
      }

      // PERFORMANCE: Handle action steps completion asynchronously (non-blocking)
      if (stepId && subtaskId && handleAutoCheckStep) {
        // Run in next tick to avoid blocking UI
        setTimeout(() => {
          // Auto-check and protect the subtask
          handleAutoCheckStep(stepId, subtaskId);
        }, 0);
      }

    } catch (error: any) {
      Logger.error('❌ SmartJournalingGratitudeModal: SAVE FAILED', error as Error, {
      component: 'SmartJournalingGratitudeModal',
    });
      Alert.alert(
        'Error',
        `Failed to save gratitude: ${error?.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleCancel = () => {

    // Completion state handled by parent component

    onCancel();
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleSuccessModalClose = () => {

    // Handled by success modal hook
    onCancel(); // Close the main modal
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleEdit = () => {

    // Completion state handled by parent component

    // Handled by success modal hook
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
        transparent={false}
        onRequestClose={() => {
          Keyboard.dismiss();
          // Small delay to ensure keyboard is fully dismissed before closing
          setTimeout(() => {
            handleCancel();
          }, 10);
        }}
      >
          {/* TEST BUTTON - Remove after debugging */}

          <GratitudeLogEditor
            ref={gratitudeEditorRef}
            onSave={saveGratitude}
            onCancel={onCancel}
            onUpgradeRequired={onCancel} // Close modal before navigating to upgrade
            initialItems={(() => {
              if (currentGratitudeEntry?.content) {
                try {
                  const parsedContent = typeof currentGratitudeEntry.content === 'string'
                    ? JSON.parse(currentGratitudeEntry.content)
                    : currentGratitudeEntry.content;
                  const items = parsedContent.items || [];
                  console.log('SmartJournalingGratitudeModal - Parsed initialItems:', items);
                  return items;
                } catch (error) {
                  Logger.error('Error parsing gratitude content for initialItems', error as Error, {
      component: 'SmartJournalingGratitudeModal',
    });
                  return [];
                }
              }
              console.log('SmartJournalingGratitudeModal - No currentGratitudeEntry.content, initialItems will be undefined');
              return undefined;
            })()}
            subtaskTitle={preservedSubtaskTitle}
            subtaskId={subtaskId}
            stepId={stepId}
            playbookTitle={preservedPlaybookTitle}
            actionStepNumber={preservedActionStepNumber}
            actionStepTitle={preservedActionStepTitle}
            isLoading={createMutation.isPending || updateMutation.isPending}
            styles={reflectionLogStyles}
            stepBody={stepBody}
            stepExample={stepExample}
          />

          {/* New success modal system - completely isolated and robust */}
          <NewSuccessModal
          visible={successModal.isVisible}
          config={successModal.config}
          onDone={successModal.handleDone}
          onEdit={successModal.handleEdit}
          />
      </Modal>
    </>
  );
};

export default withErrorBoundary(SmartJournalingGratitudeModal, 'SmartJournalingGratitudeModal');

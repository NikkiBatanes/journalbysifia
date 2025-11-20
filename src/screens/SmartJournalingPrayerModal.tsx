import React, { useState, useEffect, useRef } from 'react';
import { Logger } from '../utils/ProductionLogger';
import { StyleSheet, Modal, View, Alert } from 'react-native';
import NewSuccessModal from '../components/NewSuccessModal';
import { useSuccessModal } from '../hooks/useSuccessModal';
import PrayerLogEditor, { PrayerLogEditorRef } from '../components/journal/PrayerLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/reflectionStyles';
import { Colors } from '../theme';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useActionSteps } from '../context/ActionStepsContext';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { PrayerApi, PrayerApiEntry } from '../services/api/prayerApi';
import { toLocalDateString } from '../utils/date';
import { useNotificationIntegration } from '../hooks/useNotificationIntegration';

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
  // New optional initializers for People tab
  initialActiveTab?: 'freeform' | 'people';
  initialPersonName?: string;
  initialPrayerRequest?: string;
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
  initialActiveTab,
  initialPersonName,
  initialPrayerRequest,
}) => {
  // Debug: Log all props received by SmartJournalingPrayerModal

  const { user } = useAuth();
  const { handleToggleStep, actionSteps } = useActionSteps();
  const queryClient = useQueryClient();
  const { trackPrayer } = useNotificationIntegration();

  // Debug logging

  // Store the initial metadata to preserve it even if props become empty after save
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

  // New success modal system
  const successModal = useSuccessModal(
    () => onCancel(), // onDone: close the modal
    () => {} // onEdit: keep modal open for editing
  );
  const [_completionInfo, _setCompletionInfo] = useState<{ stepId: string; subtaskId: string } | null>(null);
  const [isEditSession, setIsEditSession] = useState(false); // Track if user is in edit mode
  const [prevVisible, setPrevVisible] = useState(false);
  const [_hasSaved, setHasSaved] = useState(false); // Track if a save actually happened
  const [_pendingPrayerData, _setPendingPrayerData] = useState<{ content: string; date: Date } | null>(null); // Store data before DB save
  const prayerEditorRef = useRef<PrayerLogEditorRef>(null);

  // Fetch existing prayer data for this subtask
  const dateStr = toLocalDateString(new Date());
  const { data: existingPrayerEntries = [] } = useQuery({
    queryKey: ['personal_prayers', user?.id, dateStr, subtaskId],
    queryFn: async () => {
      if (!user?.id || !subtaskId) {

        return [];
      }

      // Fetch personal prayer entries for today that match this subtask
      const prayers = await PrayerApi.getACTSPrayers(user.id, dateStr);
      const personalPrayers = prayers.freeform || [];

      const filteredPrayers = personalPrayers.filter((prayer: PrayerApiEntry) => {

        // Check metadata first (new format)
        if (prayer.metadata && typeof prayer.metadata === 'object') {
          const match = prayer.metadata.subtask_id === subtaskId;

          if (match) {return true;}
        }

        // Check if this prayer is associated with the current subtask (old format)
        try {
          const content = typeof prayer.content === 'string' ? JSON.parse(prayer.content) : prayer.content;
          const match = content.metadata?.subtask_id === subtaskId || content.subtask_id === subtaskId;

          return match;
        } catch (error) {
          // If content is not JSON, check if it's a simple string prayer for this subtask

          return false;
        }
      });

      return filteredPrayers;
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
        if (typeof currentPrayerEntry.content === 'string') {
          try {
            // Try to parse as JSON (old format)
            const parsedContent = JSON.parse(currentPrayerEntry.content);
            return parsedContent.text && parsedContent.text.trim();
          } catch (error) {
            // If parsing fails, it's plain text (new format)
            return currentPrayerEntry.content.trim();
          }
        }
        return currentPrayerEntry.content && String(currentPrayerEntry.content).trim();
      })();
      setIsEditSession(!!hasExistingData);

      // Auto-focus the first input when modal opens for new entries
      if (!hasExistingData) {
        setTimeout(() => {
          if (prayerEditorRef.current) {
            prayerEditorRef.current.focusInput();
          }
        }, 500); // Delay to allow modal animation to complete
      }
    }
    setPrevVisible(visible);
  }, [visible, prevVisible, currentPrayerEntry]);

  // Create prayer mutation
  const createPrayerMutation = useMutation({
    mutationFn: async (prayerData: {
      content: string;
      date: Date;
      activeTab: 'freeform' | 'people';
      prayerForPerson?: string;
      prayerRequest?: string;
    }) => {
      if (!user?.id) {throw new Error('User not authenticated');}

      let prayerEntry: Omit<PrayerApiEntry, 'id' | 'created_at' | 'updated_at'>;
      // Always use current date for prayers, not the selected journal date
      const currentDate = new Date();
      const prayerDateStr = toLocalDateString(currentDate);

      if (prayerData.activeTab === 'people') {
        // Save as "people" prayer type (like in journal screen)
        prayerEntry = {
          user_id: user.id,
          prayer_type: 'people',
          content: prayerData.prayerRequest || '', // The prayer request content
          person_name: prayerData.prayerForPerson || '',
          metadata: {
            subtask_id: subtaskId,
            step_id: stepId,
            playbook_id: playbookId,
            playbook_title: playbookTitle,
            subtask_title: subtaskTitle,
            action_step_number: actionStepNumber,
            action_step_title: actionStepTitle,
            is_prayer_request: false, // This is a prayer, not a request
          },
          selected_date: prayerDateStr, // Current date for prayers
        };
      } else {
        // Save as "journal" prayer type (freeform)
        prayerEntry = {
          user_id: user.id,
          prayer_type: 'journal',
          journal_category: 'personal_prayer',
          content: prayerData.content, // Only the prayer text
          metadata: {
            subtask_id: subtaskId,
            step_id: stepId,
            playbook_id: playbookId,
            playbook_title: playbookTitle,
            subtask_title: subtaskTitle,
            action_step_number: actionStepNumber,
            action_step_title: actionStepTitle,
          },
          selected_date: prayerDateStr,
          status: undefined, // Personal prayers don't have status
        };
      }

      return await PrayerApi.createPrayer(prayerEntry);
    },
    onSuccess: async (data) => {

      // Proper cache invalidation using correct query keys
      if (user?.id && data?.selected_date) {
        const savedDateStr = data.selected_date; // Use the actual date from the saved data

        queryClient.invalidateQueries({ queryKey: ['prayers', 'personal', user.id, savedDateStr] });
        queryClient.invalidateQueries({ queryKey: ['prayers', 'people', user.id, savedDateStr] });
        queryClient.invalidateQueries({ queryKey: ['prayers', 'entries', user.id, savedDateStr] });
        queryClient.invalidateQueries({ queryKey: ['prayers', user.id] });
        queryClient.invalidateQueries({ queryKey: ['journal', 'all'] });

        // Track prayer activity for notifications (streak tracking, alerts)
        try {
          await trackPrayer();
        } catch (error) {
          Logger.error('Failed to track prayer for notifications', error as Error, { component: 'SmartJournalingPrayerModal' });
        }
      }
    },
    onError: (error) => {
      Logger.error('Error creating prayer', error as Error, { component: 'SmartJournalingPrayerModal' });
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    },
  });

  // Update prayer mutation
  const updatePrayerMutation = useMutation({
    mutationFn: async (prayerData: {
      content: string;
      date: Date;
      activeTab: 'freeform' | 'people';
      prayerForPerson?: string;
      prayerRequest?: string;
    }) => {
      if (!currentPrayerEntry?.id) {throw new Error('No prayer entry to update');}

      const prayerDateStr = toLocalDateString(prayerData.date);

      let updates: any;

      if (prayerData.activeTab === 'people') {
        // Update as "people" prayer type
        updates = {
          content: prayerData.prayerRequest || '',
          person_name: prayerData.prayerForPerson || '',
          metadata: {
            subtask_id: subtaskId,
            step_id: stepId,
            playbook_id: playbookId,
            playbook_title: playbookTitle,
            subtask_title: subtaskTitle,
            action_step_number: actionStepNumber,
            action_step_title: actionStepTitle,
            is_prayer_request: false,
          },
          selected_date: prayerDateStr,
        };
      } else {
        // Update as "journal" prayer type
        updates = {
          content: prayerData.content, // Only the prayer text
          metadata: {
            subtask_id: subtaskId,
            step_id: stepId,
            playbook_id: playbookId,
            playbook_title: playbookTitle,
            subtask_title: subtaskTitle,
            action_step_number: actionStepNumber,
            action_step_title: actionStepTitle,
          },
          selected_date: prayerDateStr,
        };
      }

      return await PrayerApi.updatePrayer(currentPrayerEntry.id, updates);
    },
    onSuccess: (data) => {

      // Proper cache invalidation using correct query keys
      if (user?.id && data?.selected_date) {
        const savedDateStr = data.selected_date; // Use the actual date from the saved data

        queryClient.invalidateQueries({ queryKey: ['prayers', 'personal', user.id, savedDateStr] });
        queryClient.invalidateQueries({ queryKey: ['prayers', 'people', user.id, savedDateStr] });
        queryClient.invalidateQueries({ queryKey: ['prayers', 'entries', user.id, savedDateStr] });
        queryClient.invalidateQueries({ queryKey: ['prayers', user.id] });
        queryClient.invalidateQueries({ queryKey: ['journal', 'all'] });
      }
    },
    onError: (error) => {
      Logger.error('Error updating prayer', error as Error, { component: 'SmartJournalingPrayerModal' });
      Alert.alert('Error', 'Failed to update prayer. Please try again.');
    },
  });

  // Save prayer data to database immediately and mark subtask complete
  const savePrayer = async (prayerData: {
    content: string;
    date: Date;
    activeTab: 'freeform' | 'people';
    prayerForPerson?: string;
    prayerRequest?: string;
  }) => {
    try {

      let result;
      if (currentPrayerEntry?.id) {
        // Update existing prayer

        result = await updatePrayerMutation.mutateAsync(prayerData);
      } else {
        // Create new prayer

        result = await createPrayerMutation.mutateAsync(prayerData);
      }

      // Call parent onSave callback
      onSave(result);

      // Mark subtask as completed immediately since data is saved (only for new prayers)
      if (stepId && subtaskId && handleToggleStep && !currentPrayerEntry?.id) {

        // Check if the step/subtask is already completed before toggling
        const step = actionSteps.find(s => s.id === stepId);

        if (step) {
          if (subtaskId) {
            // Check subtask completion
            const subtask = step.subTasks?.find(st => st.id === subtaskId);

            if (subtask && !subtask.completed) {

              handleToggleStep(stepId, subtaskId);

            } else {

            }
          } else {
            // Check step completion
            if (!step.completed) {

              handleToggleStep(stepId, subtaskId);

            } else {

            }
          }
        } else {
          Logger.warn('🙏 SmartJournalingPrayerModal: Step not found in actionSteps', {
        component: 'SmartJournalingPrayerModal',
            stepId,
            availableStepIds: actionSteps?.map(s => s.id) || [],
          });
        }
      } else {

      }

      // Show success modal after cache invalidation completes (longer delay to ensure UI updates)
      setTimeout(() => {
        setHasSaved(true);
        successModal.showSuccess({
          title: isEditSession ? 'Prayer Updated' : 'Prayer Saved',
          message: isEditSession ? 'Your prayer has been updated.' : 'Your prayer has been saved to your journal.',
          showEditButton: true,
        });
      }, 500);

    } catch (error: any) {
      Logger.error('❌ SmartJournalingPrayerModal: SAVE FAILED', error as Error, { component: 'SmartJournalingPrayerModal' });
      Alert.alert(
        'Error',
        `Failed to save prayer: ${error?.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  };

  // Called when "Done" is pressed in SuccessModal (data already saved, just close modal)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleSuccessModalClose = () => {

    // Handled by success modal hook
    onCancel(); // Close the modal
  };

  // Called when "Edit" is pressed in SuccessModal
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleEdit = () => {

    // Completion state handled by parent component

    // Handled by success modal hook
    // Focus the input and position cursor at the end
    setTimeout(() => {
      if (prayerEditorRef.current) {
        prayerEditorRef.current.focusInput();
      }
    }, 300); // Small delay to allow modal to close
    // Keep modal open for continued editing
  };

  const handleCancel = () => {

    // Completion state handled by parent component

    onCancel();
  };

  // Get initial content for the editor
  const getInitialContent = () => {

    if (!currentPrayerEntry?.content) {

      return '';
    }

    // Handle both old JSON format and new plain text format
    if (typeof currentPrayerEntry.content === 'string') {
      try {
        // Try to parse as JSON (old format)
        const parsedContent = JSON.parse(currentPrayerEntry.content);
        const result = parsedContent.text || currentPrayerEntry.content;

        return result;
      } catch (error) {
        // If parsing fails, it's plain text (new format)

        return currentPrayerEntry.content;
      }
    }

    const result = currentPrayerEntry.content || '';

    return result;
  };

  const isLoading = createPrayerMutation.isPending || updatePrayerMutation.isPending;

  // Debug logging

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onCancel}
      >
          <PrayerLogEditor
            ref={prayerEditorRef}
            onSave={savePrayer}
            onCancel={handleCancel}
            initialContent={getInitialContent()}
            subtaskTitle={preservedSubtaskTitle}
            subtaskId={subtaskId}
            stepId={stepId}
            playbookTitle={preservedPlaybookTitle}
            actionStepNumber={preservedActionStepNumber}
            actionStepTitle={preservedActionStepTitle}
            isLoading={isLoading}
            styles={reflectionLogStyles}
            initialActiveTab={initialActiveTab}
            initialPersonName={initialPersonName}
            initialPrayerRequest={initialPrayerRequest}
            dateString={(function() {
              const now = new Date();
              const year = now.getFullYear();
              const todayString = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
              const todayStringWithYear = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
              return year === new Date().getFullYear() ? todayString : todayStringWithYear;
            })()}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
});

export default withErrorBoundary(SmartJournalingPrayerModal, 'SmartJournalingPrayerModal');

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
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
  console.log('🔍 SmartJournalingPrayerModal: Props received:', {
    visible,
    subtaskTitle,
    subtaskId,
    stepId,
    playbookId,
    playbookTitle,
    actionStepNumber,
    actionStepTitle,
    existingPrayer,
  });
  const { user } = useAuth();
  const { handleToggleStep, actionSteps } = useActionSteps();
  const queryClient = useQueryClient();

  // Debug logging
  console.log('🙏 SmartJournalingPrayerModal: subtaskTitle received:', subtaskTitle);
  console.log('🙏 SmartJournalingPrayerModal: playbookTitle:', playbookTitle);
  console.log('🙏 SmartJournalingPrayerModal: actionStepTitle:', actionStepTitle);

  // Store the initial metadata to preserve it even if props become empty after save
  const [preservedSubtaskTitle, setPreservedSubtaskTitle] = useState(subtaskTitle);
  const [preservedActionStepNumber, setPreservedActionStepNumber] = useState(actionStepNumber);
  const [preservedActionStepTitle, setPreservedActionStepTitle] = useState(actionStepTitle);
  const [preservedPlaybookTitle, setPreservedPlaybookTitle] = useState(playbookTitle);

  // Track when metadata props change and preserve non-empty values
  React.useEffect(() => {
    console.log('🔄 SmartJournalingPrayerModal: subtaskTitle changed to:', subtaskTitle);
    if (subtaskTitle && subtaskTitle.trim() !== '') {
      setPreservedSubtaskTitle(subtaskTitle);
      console.log('💾 SmartJournalingPrayerModal: Preserved subtaskTitle:', subtaskTitle);
    }
  }, [subtaskTitle]);

  React.useEffect(() => {
    if (actionStepNumber !== undefined && actionStepNumber !== null) {
      setPreservedActionStepNumber(actionStepNumber);
      console.log('💾 SmartJournalingPrayerModal: Preserved actionStepNumber:', actionStepNumber);
    }
  }, [actionStepNumber]);

  React.useEffect(() => {
    if (actionStepTitle && actionStepTitle.trim() !== '') {
      setPreservedActionStepTitle(actionStepTitle);
      console.log('💾 SmartJournalingPrayerModal: Preserved actionStepTitle:', actionStepTitle);
    }
  }, [actionStepTitle]);

  React.useEffect(() => {
    if (playbookTitle && playbookTitle.trim() !== '') {
      setPreservedPlaybookTitle(playbookTitle);
      console.log('💾 SmartJournalingPrayerModal: Preserved playbookTitle:', playbookTitle);
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
        console.log('🔍 Prayer Query: Missing user or subtaskId:', { userId: user?.id, subtaskId });
        return [];
      }

      console.log('🔍 Prayer Query: Fetching prayers for:', { userId: user.id, dateStr, subtaskId });
      // Fetch personal prayer entries for today that match this subtask
      const prayers = await PrayerApi.getACTSPrayers(user.id, dateStr);
      const personalPrayers = prayers.freeform || [];
      console.log('🔍 Prayer Query: All personal prayers found:', personalPrayers.length);

      const filteredPrayers = personalPrayers.filter((prayer: PrayerApiEntry) => {
        console.log('🔍 Prayer Query: Checking prayer:', { id: prayer.id, hasMetadata: !!prayer.metadata, content: typeof prayer.content });

        // Check metadata first (new format)
        if (prayer.metadata && typeof prayer.metadata === 'object') {
          const match = prayer.metadata.subtask_id === subtaskId;
          console.log('🔍 Prayer Query: Metadata check:', { subtask_id: prayer.metadata.subtask_id, expected: subtaskId, match });
          if (match) {return true;}
        }

        // Check if this prayer is associated with the current subtask (old format)
        try {
          const content = typeof prayer.content === 'string' ? JSON.parse(prayer.content) : prayer.content;
          const match = content.metadata?.subtask_id === subtaskId || content.subtask_id === subtaskId;
          console.log('🔍 Prayer Query: Content check:', { contentMetadata: content.metadata?.subtask_id, contentSubtaskId: content.subtask_id, expected: subtaskId, match });
          return match;
        } catch (error) {
          // If content is not JSON, check if it's a simple string prayer for this subtask
          console.log('🔍 Prayer Query: Content parsing failed, skipping prayer');
          return false;
        }
      });

      console.log('🔍 Prayer Query: Filtered prayers:', filteredPrayers.length);
      return filteredPrayers;
    },
    enabled: !!user?.id && !!subtaskId,
    staleTime: 30000, // 30 seconds
  });

  // Get the most recent prayer entry for this subtask
  const currentPrayerEntry = existingPrayerEntries[0] || existingPrayer;
  console.log('🔍 Prayer Query: Current prayer entry:', {
    hasCurrentEntry: !!currentPrayerEntry,
    entryId: currentPrayerEntry?.id,
    hasContent: !!currentPrayerEntry?.content,
    contentType: typeof currentPrayerEntry?.content,
    existingEntriesCount: existingPrayerEntries.length,
  });

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
      console.log('🙏 Creating prayer with current date:', prayerDateStr, 'activeTab:', prayerData.activeTab);

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
    onSuccess: (data) => {
      console.log('🙏 Prayer created successfully:', data);
      // Proper cache invalidation using correct query keys
      if (user?.id && data?.selected_date) {
        const savedDateStr = data.selected_date; // Use the actual date from the saved data
        console.log('🙏 Invalidating cache for date:', savedDateStr);
        queryClient.invalidateQueries({ queryKey: ['prayers', 'personal', user.id, savedDateStr] });
        queryClient.invalidateQueries({ queryKey: ['prayers', 'people', user.id, savedDateStr] });
        queryClient.invalidateQueries({ queryKey: ['prayers', 'entries', user.id, savedDateStr] });
        queryClient.invalidateQueries({ queryKey: ['prayers', user.id] });
        queryClient.invalidateQueries({ queryKey: ['journal', 'all'] });
      }
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
      activeTab: 'freeform' | 'people';
      prayerForPerson?: string;
      prayerRequest?: string;
    }) => {
      if (!currentPrayerEntry?.id) {throw new Error('No prayer entry to update');}

      const prayerDateStr = toLocalDateString(prayerData.date);
      console.log('🙏 Updating prayer with date:', prayerDateStr, 'activeTab:', prayerData.activeTab);
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
      console.log('🙏 Prayer updated successfully:', data);
      // Proper cache invalidation using correct query keys
      if (user?.id && data?.selected_date) {
        const savedDateStr = data.selected_date; // Use the actual date from the saved data
        console.log('🙏 Invalidating cache for date:', savedDateStr);
        queryClient.invalidateQueries({ queryKey: ['prayers', 'personal', user.id, savedDateStr] });
        queryClient.invalidateQueries({ queryKey: ['prayers', 'people', user.id, savedDateStr] });
        queryClient.invalidateQueries({ queryKey: ['prayers', 'entries', user.id, savedDateStr] });
        queryClient.invalidateQueries({ queryKey: ['prayers', user.id] });
        queryClient.invalidateQueries({ queryKey: ['journal', 'all'] });
      }
    },
    onError: (error) => {
      console.error('Error updating prayer:', error);
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
      console.log('🙏 SmartJournalingPrayerModal: Saving prayer data to database immediately', {
        hasExistingEntry: !!currentPrayerEntry,
        contentLength: prayerData.content.length,
        activeTab: prayerData.activeTab,
        prayerForPerson: prayerData.prayerForPerson,
        stepId,
        subtaskId,
        actionStepsCount: actionSteps?.length || 0,
      });

      let result;
      if (currentPrayerEntry?.id) {
        // Update existing prayer
        console.log('🙏 SmartJournalingPrayerModal: Updating existing prayer');
        result = await updatePrayerMutation.mutateAsync(prayerData);
      } else {
        // Create new prayer
        console.log('🙏 SmartJournalingPrayerModal: Creating new prayer');
        result = await createPrayerMutation.mutateAsync(prayerData);
      }

      console.log('✅ SmartJournalingPrayerModal: Database save completed');

      // Call parent onSave callback
      onSave(result);

      // Mark subtask as completed immediately since data is saved (only for new prayers)
      if (stepId && subtaskId && handleToggleStep && !currentPrayerEntry?.id) {
        console.log('🙏 SmartJournalingPrayerModal: Marking subtask as completed (data saved)', {
          stepId,
          subtaskId,
          actionStepsCount: actionSteps?.length || 0,
        });

        // Check if the step/subtask is already completed before toggling
        const step = actionSteps.find(s => s.id === stepId);
        console.log('🙏 SmartJournalingPrayerModal: Found step:', {
          stepFound: !!step,
          stepId: step?.id,
          stepCompleted: step?.completed,
          subTasksCount: step?.subTasks?.length || 0,
        });

        if (step) {
          if (subtaskId) {
            // Check subtask completion
            const subtask = step.subTasks?.find(st => st.id === subtaskId);
            console.log('🙏 SmartJournalingPrayerModal: Found subtask:', {
              subtaskFound: !!subtask,
              subtaskId: subtask?.id,
              subtaskCompleted: subtask?.completed,
            });

            if (subtask && !subtask.completed) {
              console.log('🙏 SmartJournalingPrayerModal: Calling handleToggleStep to mark subtask as completed');
              handleToggleStep(stepId, subtaskId);
              console.log('🙏 SmartJournalingPrayerModal: handleToggleStep called successfully');
            } else {
              console.log('🙏 SmartJournalingPrayerModal: Subtask already completed or not found, skipping toggle');
            }
          } else {
            // Check step completion
            if (!step.completed) {
              console.log('🙏 SmartJournalingPrayerModal: Calling handleToggleStep to mark step as completed');
              handleToggleStep(stepId, subtaskId);
              console.log('🙏 SmartJournalingPrayerModal: handleToggleStep called successfully');
            } else {
              console.log('🙏 SmartJournalingPrayerModal: Step already completed, skipping toggle');
            }
          }
        } else {
          console.warn('🙏 SmartJournalingPrayerModal: Step not found in actionSteps:', {
            stepId,
            availableStepIds: actionSteps?.map(s => s.id) || [],
          });
        }
      } else {
        console.log('🙏 SmartJournalingPrayerModal: Skipping completion - editing existing prayer or missing data:', {
          hasStepId: !!stepId,
          hasSubtaskId: !!subtaskId,
          hasHandleToggleStep: !!handleToggleStep,
          isExistingPrayer: !!currentPrayerEntry?.id,
        });
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

      console.log('✅ SmartJournalingPrayerModal: Prayer saved and subtask marked complete');
    } catch (error: any) {
      console.error('❌ SmartJournalingPrayerModal: SAVE FAILED:', error);
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
    console.log('🙏 PRAYER: Done button pressed, closing modal (data already saved)');
    console.log('🔍 PRAYER: About to hide success modal and close main modal');
    // Handled by success modal hook
    onCancel(); // Close the modal
  };

  // Called when "Edit" is pressed in SuccessModal
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleEdit = () => {
    console.log('🙏 PRAYER: Edit button pressed, closing success modal');
    console.log('🔍 PRAYER: About to hide success modal for editing');

    // Debug: Check completion state when editing
    if (stepId && subtaskId) {
      const step = actionSteps.find(s => s.id === stepId);
      const subtask = step?.subTasks?.find(st => st.id === subtaskId);
      console.log('🙏 SmartJournalingPrayerModal: Edit - Current completion state:', {
        stepId,
        subtaskId,
        stepCompleted: step?.completed,
        subtaskCompleted: subtask?.completed,
        stepFound: !!step,
        subtaskFound: !!subtask,
      });
    }

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
    console.log('🙏 SmartJournalingPrayerModal: Cancel pressed');

    // Debug: Check completion state when cancelling
    if (stepId && subtaskId) {
      const step = actionSteps.find(s => s.id === stepId);
      const subtask = step?.subTasks?.find(st => st.id === subtaskId);
      console.log('🙏 SmartJournalingPrayerModal: Cancel - Current completion state:', {
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

  // Get initial content for the editor
  const getInitialContent = () => {
    console.log('🔍 getInitialContent: Starting with currentPrayerEntry:', {
      hasEntry: !!currentPrayerEntry,
      hasContent: !!currentPrayerEntry?.content,
      contentType: typeof currentPrayerEntry?.content,
      contentPreview: currentPrayerEntry?.content ? String(currentPrayerEntry.content).substring(0, 50) + '...' : 'none',
    });

    if (!currentPrayerEntry?.content) {
      console.log('🔍 getInitialContent: No content found, returning empty string');
      return '';
    }

    // Handle both old JSON format and new plain text format
    if (typeof currentPrayerEntry.content === 'string') {
      try {
        // Try to parse as JSON (old format)
        const parsedContent = JSON.parse(currentPrayerEntry.content);
        const result = parsedContent.text || currentPrayerEntry.content;
        console.log('🔍 getInitialContent: Parsed JSON format, returning:', result.substring(0, 50) + '...');
        return result;
      } catch (error) {
        // If parsing fails, it's plain text (new format)
        console.log('🔍 getInitialContent: Plain text format, returning:', currentPrayerEntry.content.substring(0, 50) + '...');
        return currentPrayerEntry.content;
      }
    }

    const result = currentPrayerEntry.content || '';
    console.log('🔍 getInitialContent: Non-string content, returning:', String(result).substring(0, 50) + '...');
    return result;
  };

  const isLoading = createPrayerMutation.isPending || updatePrayerMutation.isPending;

  // Debug logging
  console.log('🙏 SmartJournalingPrayerModal: Render - successModal visible:', successModal.isVisible, 'isEditSession:', isEditSession);

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

export default withErrorBoundary(SmartJournalingPrayerModal, 'SmartJournalingPrayerModal');

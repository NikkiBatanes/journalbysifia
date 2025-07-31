import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import SuccessModal from '../components/SuccessModal';
import PrayerLogEditor, { PrayerLogEditorRef } from '../components/journal/PrayerLogEditor';
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
  const { handleToggleStep } = useActionSteps();
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

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completionInfo, setCompletionInfo] = useState<{ stepId: string; subtaskId: string } | null>(null);
  const [isEditSession, setIsEditSession] = useState(false); // Track if user is in edit mode
  const [prevVisible, setPrevVisible] = useState(false);
  const [hasSaved, setHasSaved] = useState(false); // Track if a save actually happened
  const prayerEditorRef = useRef<PrayerLogEditorRef>(null);

  // Fetch existing prayer data for this subtask
  const dateStr = new Date().toISOString().split('T')[0];
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
    }) => {
      if (!user?.id) {throw new Error('User not authenticated');}

      const prayerEntry: Omit<PrayerApiEntry, 'id' | 'created_at' | 'updated_at'> = {
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

      // Show success modal and set hasSaved true
      setHasSaved(true);
      setShowSuccessModal(true);

      // Mark step as complete only for NEW prayers (not when editing existing ones)
      // Only set completion info AFTER successful save
      if (stepId && subtaskId && !currentPrayerEntry?.id) {
        console.log('🙏 SmartJournalingPrayerModal: Setting completion info for NEW prayer after successful save');
        setCompletionInfo({ stepId, subtaskId });
      } else if (currentPrayerEntry?.id) {
        console.log('🙏 SmartJournalingPrayerModal: Skipping completion toggle for EDITED prayer');
      }

      // Call parent onSave callback immediately (like reflection modal)
      onSave(savedEntry);

      console.log('🙏 SmartJournalingPrayerModal: onSave called successfully');
    } catch (error) {
      console.error('🙏 SmartJournalingPrayerModal: Error in savePrayer:', error);
      // Clear completion info and hasSaved state on error to prevent false completion
      setCompletionInfo(null);
      setHasSaved(false);
      // Error handling is done in the mutation's onError
    }
  };

  // Called when "Done" is pressed in SuccessModal
  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    if (hasSaved && completionInfo) {
      // Only mark as complete if a save actually happened
      const { stepId: completedStepId, subtaskId: completedSubtaskId } = completionInfo;
      handleToggleStep(completedStepId, completedSubtaskId);
      setCompletionInfo(null);
      setHasSaved(false); // Reset for next open
      onCancel(); // Close the modal
    } else {
      // Just close modal if not saved (shouldn't happen from success modal)
      onCancel();
    }
  };

  // Called when "Edit" is pressed in SuccessModal
  const handleEdit = () => {
    setShowSuccessModal(false);
    // Focus the input and position cursor at the end
    setTimeout(() => {
      if (prayerEditorRef.current) {
        prayerEditorRef.current.focusInput();
      }
    }, 300); // Small delay to allow modal to close
    // Remain in editor, keep modal open
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
  console.log('🙏 SmartJournalingPrayerModal: Render - showSuccessModal:', showSuccessModal, 'isEditSession:', isEditSession);

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
            onCancel={onCancel}
            initialContent={getInitialContent()}
            subtaskTitle={preservedSubtaskTitle}
            subtaskId={subtaskId}
            stepId={stepId}
            playbookTitle={preservedPlaybookTitle}
            actionStepNumber={preservedActionStepNumber}
            actionStepTitle={preservedActionStepTitle}
            isLoading={isLoading}
            styles={reflectionLogStyles}
            dateString={(function() {
              const now = new Date();
              const year = now.getFullYear();
              const todayString = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
              const todayStringWithYear = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
              return year === new Date().getFullYear() ? todayString : todayStringWithYear;
            })()}
          />

          <SuccessModal
            visible={showSuccessModal}
            title={isEditSession ? 'Prayer Updated!' : 'Prayer Saved!'}
            message={
              isEditSession
                ? 'Your prayer has been updated.'
                : 'Your prayer has been saved to your journal.'
            }
            onDismiss={handleSuccessModalClose}
            onEdit={handleEdit}
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

export default SmartJournalingPrayerModal;

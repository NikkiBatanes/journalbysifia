import React, { useState, useEffect, useRef } from 'react';
import { Logger } from '../utils/ProductionLogger';
import { toLocalDateString } from '../utils/date';
import { Modal, Alert, DeviceEventEmitter, View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NewSuccessModal from '../components/NewSuccessModal';
import { useSuccessModal } from '../hooks/useSuccessModal';
import ReflectionLogEditor, { ReflectionLogEditorRef } from '../components/journal/ReflectionLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/reflectionStyles';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useCreateReflection, useUpdateReflection } from '../services/hooks/useReflectionData';
import { useQueryClient } from '@tanstack/react-query';
import { faithPointsService } from '../services/faithPointsService';
import { visibleStreakService } from '../services/visibleStreakService';
import { analytics } from '../utils/analytics';
import { Colors } from '../theme';
import ThemedText from '../components/common/ThemedText';
import type { NavigationProp } from '@react-navigation/native';

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
  navigation?: NavigationProp<any>;
  // When true, this reflection was opened from a guided prompt and should hide metadata
  isGuidedReflection?: boolean;
  // When true, hide the guided prompt button (heart icon)
  hideGuidedPromptButton?: boolean;
  // When true, hide the pencil icon for guided reflections
  hidePencilIcon?: boolean;
  // When true, this is from journal carousel (freeform) not dashboard smart journaling
  isJournalCarousel?: boolean;
  stepBody?: string;
  stepExample?: string | null
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
  selectedDate = new Date(),
  onSave,
  onCancel,
  navigation,
  isGuidedReflection = false,
  hideGuidedPromptButton = false,
  hidePencilIcon = false,
  isJournalCarousel = false,
  stepBody,
  stepExample,
}) => {
  // Store the initial metadata to preserve it even if props become empty after save
  const [preservedSubtaskTitle, setPreservedSubtaskTitle] = React.useState(subtaskTitle);
  const [_preservedActionStepNumber, setPreservedActionStepNumber] = React.useState(actionStepNumber);
  const [_preservedActionStepTitle, setPreservedActionStepTitle] = React.useState(actionStepTitle);
  const [_preservedPlaybookTitle, setPreservedPlaybookTitle] = React.useState(playbookTitle);

  // Track when metadata props change and preserve non-empty values
  // PERFORMANCE: Combine all metadata updates into single useEffect to reduce re-renders
  React.useEffect(() => {
    if (subtaskTitle && subtaskTitle.trim() !== '') {
      setPreservedSubtaskTitle(subtaskTitle);
    }
    if (actionStepNumber !== undefined && actionStepNumber !== null) {
      setPreservedActionStepNumber(actionStepNumber);
    }
    if (actionStepTitle && actionStepTitle.trim() !== '') {
      setPreservedActionStepTitle(actionStepTitle);
    }
    if (playbookTitle && playbookTitle.trim() !== '') {
      setPreservedPlaybookTitle(playbookTitle);
    }
  }, [subtaskTitle, actionStepNumber, actionStepTitle, playbookTitle]);

  const { user } = useAuth();


  const queryClient = useQueryClient();

  // Success modal handlers
  const successModal = useSuccessModal(
    () => {
      // Done callback - use ReflectionLogEditor's handleCancel logic which has proper keyboard dismissal
      if (reflectionEditorRef.current) {
        reflectionEditorRef.current.triggerCancel();
      }
    },
    () => {
      // Edit callback - keep modal open and focus input
      handleEditFocus();
    }
  );

  // Log success modal state changes
  useEffect(() => {

  }, [successModal.isVisible, successModal.config]);

  const dateToUse = selectedDate || new Date();
  const dateStr = toLocalDateString(dateToUse); // Use selected date for consistency

  // Logging for date handling

  const reflectionEditorRef = useRef<ReflectionLogEditorRef>(null);

  // Log existing reflection prop
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

      // PERFORMANCE: Parallel cache invalidation instead of sequential
      if (user?.id) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['reflections', 'byDate', user.id, dateStr],
          }),
          queryClient.invalidateQueries({
            queryKey: ['journal', 'reflections', user.id, dateStr],
          }),
          queryClient.invalidateQueries({
            queryKey: ['journal', 'all'],
          }),
        ]);
      }

      // Emit event to refresh moments screen and journal screen
      DeviceEventEmitter.emit('reflection_saved', {
        reflectionId: savedReflection.id,
        type: reflectionData.type,
        source: finalSource,
        // Include devotional metadata for precise question removal
        ...(finalSource === 'playbook' ? {
          devotionalId: playbookId,
          dayNumber: actionStepNumber,
          questionNumber: 1, // Default to 1 for single questions, could be enhanced for multiple questions
        } : {}),
      });

      // Award faith points for saving reflection (only for new reflections)
      // PERFORMANCE: Make this non-blocking to improve perceived performance
      if (!existingReflection && user?.id) {
        // Fire and forget - don't await to avoid blocking the save process
        faithPointsService.awardPoints(
          user.id,
          'reflection_saved',
          {
            suppressNotification: true,
            source: finalType === 'guided' ? 'guided_prompt' : finalType === 'playbook' ? 'playbook_reflection' : 'journal_reflection',
            question: preservedSubtaskTitle || entry.title,
          }
        ).catch(error => {
          // Log error but don't fail the save process
          Logger.warn('Failed to award faith points for reflection', {
            component: 'SmartJournalingReflectionModal',
            error: error as Error,
          });
        });

        // Check if streak celebration should show for reflection (only for new reflections)
        const shouldShowStreak = await visibleStreakService.shouldShowCelebration(user.id, 'reflection_saved');
        if (shouldShowStreak) {
          await visibleStreakService.markShownToday(user.id);
          if (navigation) {
            (navigation as any).navigate('StreakPlan', {
              userId: user.id,
              source: 'reflection_saved',
            });
          }
        }
      }

      // Call parent onSave callback
      // PERFORMANCE: Subtask toggle logic moved to ActionStepsCard for better separation of concerns
      onSave(savedReflection);

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
    // Don't dismiss keyboard here - ReflectionLogEditor handles it properly with blur logic and delay
    onCancel();
  };

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
              // Pass subtaskTitle for all modes - freeform can have initial title too
              initialTitle={preservedSubtaskTitle || ''}
              lockTitle={isGuidedReflection || !!playbookId}
              // Source: 'thoughts' for smart journaling, 'guided' for guided prompts, 'freeform' for journal carousel
              // Guided prompts need their own source to show correct pencil icon
              source={isJournalCarousel ? 'freeform' : (isGuidedReflection ? 'guided' : 'thoughts')}
              initialMode="free-form"
              styles={reflectionLogStyles}
              dateString={(function() {
                const year = dateToUse.getFullYear();
                const currentYear = new Date().getFullYear();
                const dateString = dateToUse.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                const dateStringWithYear = dateToUse.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                return year === currentYear ? dateString : dateStringWithYear;
              })()} // Use the selected date for formatting
              // Pass metadata from existing reflection or from props
              // For playbook context, always pass metadata when available
              playbookTitle={isGuidedReflection ? undefined : (existingReflection?.playbook_title || playbookTitle)}
              dayNumber={isGuidedReflection ? undefined : (existingReflection?.day_number || actionStepNumber)}
              dayTitle={isGuidedReflection ? undefined : (existingReflection?.day_title || actionStepTitle)}
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
              hidePencilIcon={hidePencilIcon}
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

      {/* Loading overlay for save operations - shows feedback without hiding content */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={Colors.anchorBlue} />
            <ThemedText style={styles.loadingText}>
              {existingReflection ? 'Updating reflection...' : 'Saving reflection...'}
            </ThemedText>
            <ThemedText style={styles.loadingSubText}>
              Please wait a moment
            </ThemedText>
          </View>
        </View>
      )}
    </>
  );
};

const styles = {
  loadingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 1000,
  },
  loadingContent: {
    backgroundColor: Colors.hopeWhite,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center' as const,
    minWidth: 200,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 12,
    textAlign: 'center' as const,
  },
  loadingSubText: {
    fontSize: 14,
    color: Colors.textGray,
    marginTop: 4,
    textAlign: 'center' as const,
  },
};

// Memoize to prevent unnecessary re-renders when props haven't changed
const MemoizedSmartJournalingReflectionModal = React.memo(SmartJournalingReflectionModal);

export default withErrorBoundary(MemoizedSmartJournalingReflectionModal, 'SmartJournalingReflectionModal');

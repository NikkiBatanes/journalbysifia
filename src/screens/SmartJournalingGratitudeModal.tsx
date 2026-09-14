import React, { useState, useEffect, useRef } from 'react';
import { Logger } from '../utils/ProductionLogger';
import { Modal, Alert, Keyboard, Platform, StyleSheet, View } from 'react-native';
import NewSuccessModal from '../components/NewSuccessModal';
import { useSuccessModal } from '../hooks/useSuccessModal';
import GratitudeLogEditor, { GratitudeLogEditorRef } from '../components/journal/GratitudeLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/reflectionStyles';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useActionSteps } from '../context/ActionStepsContext';
import {
  createLocalJournalEntry,
  getLocalJournalEntries,
  updateLocalJournalEntry,
  deleteLocalJournalEntry,
} from '../storage/journalStorage';
import { toLocalDateString } from '../utils/date';
import { visibleStreakService } from '../services/visibleStreakService';
import type { NavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';

interface SmartJournalingGratitudeModalProps {
  visible: boolean;
  isActive?: boolean;
  subtaskTitle?: string;
  subtaskId?: string;
  stepId?: string;
  playbookId?: string;
  playbookTitle?: string;
  playbookStatus?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  existingGratitude?: any;
  onSave?: (data: any) => void;
  onClose?: () => void;
  navigation?: NavigationProp<any>;
  stepBody?: string;
  stepExample?: string | null;
  selectedDate?: Date;
}

const SmartJournalingGratitudeModal: React.FC<SmartJournalingGratitudeModalProps> = ({
  visible,
  isActive = true, // Default to true for backward compatibility
  subtaskTitle,
  subtaskId,
  stepId,
  playbookId,
  playbookTitle,
  playbookStatus,
  actionStepNumber,
  actionStepTitle,
  existingGratitude,
  onSave,
  onClose,
  navigation,
  stepBody,
  stepExample,
  selectedDate = new Date(),
}) => {


  const internalNavigation = useNavigation<NavigationProp<any>>();
  const nav = navigation ?? internalNavigation;

  const { user } = useAuth();
  const { handleAutoCheckStep, actionSteps } = useActionSteps();
  // Store saved result to call onSave when user clicks Done in success modal
  const [savedGratitudeResult, setSavedGratitudeResult] = useState<any>(null);
  const [isSuccessModalShown, setIsSuccessModalShown] = useState(false);
  // Pending streak navigation — executed after the RN Modal closes so StreakPlan isn't hidden behind it
  const pendingStreakRef = useRef<{ userId: string; source: string } | null>(null);

  // New success modal system
  const successModal = useSuccessModal(
    () => {
      // onDone: call onSave with saved result, then close modal
      if (savedGratitudeResult) {
        onSave?.(savedGratitudeResult);
        setSavedGratitudeResult(null);
      }
      setIsSuccessModalShown(false);
      onClose?.();
      // Navigate to StreakPlan after the modal animation finishes (350ms)
      const streakParams = pendingStreakRef.current;
      pendingStreakRef.current = null;
      if (streakParams) {
        setTimeout(() => {
          (nav as any).navigate('StreakPlan', streakParams);
        }, 350);
      }
    },
    () => {
      setIsSuccessModalShown(false);
    } // onEdit: keep modal open for editing
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
  const dateStr = toLocalDateString(selectedDate);
  const [localGratitudeEntries, setLocalGratitudeEntries] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const entries = await getLocalJournalEntries('gratitude', dateStr);
      if (!mounted) return;
      const matches = subtaskId
        ? entries.filter(e => e.metadata?.subtask_id === subtaskId)
        : entries.filter(e => !e.metadata?.subtask_id);
      setLocalGratitudeEntries(matches);
    })();
    return () => { mounted = false; };
  }, [dateStr, subtaskId]);

  // Get the most recent gratitude entry for this subtask
  const currentGratitudeEntry = localGratitudeEntries[0] || existingGratitude;

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

  // Check if metadata is present (from faithful actions pencil tooltip)
  const hasMetadata = Boolean(
    preservedSubtaskTitle ||
    preservedPlaybookTitle ||
    preservedActionStepNumber ||
    preservedActionStepTitle ||
    stepBody ||
    stepExample
  );

  useEffect(() => {
    // Focus when modal becomes active (either through visibility change or isActive prop change)
    if (isActive && !prevActive) {
      // Modal is becoming active (transition from false to true)
      // Auto-focus the first input when modal opens (for both new and existing entries)
      // Use a longer delay to ensure modal is fully rendered and keyboard is ready
      setTimeout(() => {
        if (gratitudeEditorRef.current) {
          // Skip scroll to bottom when metadata is present (from faithful actions)
          gratitudeEditorRef.current.focusInput(hasMetadata);
        }
      }, 800); // Increased delay for better reliability
    }
    setPrevActive(isActive);
  }, [isActive, prevActive, currentGratitudeEntry, actionSteps, stepId, subtaskId, hasMetadata]);

  // Also trigger focus when visible prop changes (for dashboard usage)
  useEffect(() => {
    // Focus when modal becomes visible (transition from false to true)
    if (visible && !prevVisible) {
      // Modal is becoming visible (transition from false to true)
      // Auto-focus the first input when modal opens (for both new and existing entries)
      // Use a longer delay to ensure modal is fully rendered and keyboard is ready
      setTimeout(() => {
        if (gratitudeEditorRef.current) {
          // Skip scroll to bottom when metadata is present (from faithful actions)
          gratitudeEditorRef.current.focusInput(hasMetadata);
        }
      }, 800); // Increased delay for better reliability
    }
    setPrevVisible(visible);
  }, [visible, prevVisible, currentGratitudeEntry, actionSteps, stepId, subtaskId, hasMetadata]);

  // Track actionSteps changes to see if completion state is being lost
  // Removed unused debug effect

  // Save gratitude data to database immediately and mark subtask complete
  const saveGratitude = async (gratitudeData: {
    items: string[];
    date: Date;
  }) => {
    try {
      // Filter out blank items and remove number prefixes
      const cleanedItems = gratitudeData.items
        .filter(item => item.trim().length > 0)
        .map(item => {
          const cleaned = item.replace(/^\d+\. /, '').trim();
          return cleaned;
        })
        .filter(item => item.length > 0);

      const allEntries = await getLocalJournalEntries('gratitude', toLocalDateString(gratitudeData.date));
      const entriesToDelete = subtaskId
        ? allEntries.filter(entry => entry.metadata?.subtask_id === subtaskId)
        : allEntries.filter(entry => !entry.metadata?.subtask_id);

      for (const entry of entriesToDelete) {
        await deleteLocalJournalEntry(entry.id, 'gratitude', toLocalDateString(gratitudeData.date));
      }

      const savedDate = toLocalDateString(gratitudeData.date);
      const created = await createLocalJournalEntry({
        content_type: 'gratitude',
        selected_date: savedDate,
        content: JSON.stringify({ items: cleanedItems }),
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
      });

      setSavedGratitudeResult(created);

      // Check if streak celebration should show for gratitude
      // Only show streak if not associated with a playbook OR playbook is completed
      const isPlaybookContext = !!playbookId;
      const isPlaybookCompleted = playbookStatus === 'completed';
      const shouldCheckStreak = !isPlaybookContext || isPlaybookCompleted;

      if (shouldCheckStreak) {
        const shouldShowStreak = user?.id
          ? await visibleStreakService.shouldShowCelebration(user.id, 'journal_gratitude_added')
          : false;

        if (shouldShowStreak && user?.id) {
          // Store params — navigation happens after the RN Modal closes (in onDone callback)
          await visibleStreakService.markShownToday(user.id);
          pendingStreakRef.current = { userId: user.id, source: 'journal_gratitude_added' };
        }
      }

      // Show success modal immediately (data is saved, just waiting for user confirmation)
      if (!isSuccessModalShown) {
        setIsSuccessModalShown(true);
        successModal.showSuccess({
          title: 'Gratitude Saved',
          message: 'Your gratitude has been saved to your journal.',
          showEditButton: true,
        });
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

    onClose?.();
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleSuccessModalClose = () => {

    // Handled by success modal hook
    onClose?.(); // Close the main modal
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleEdit = () => {

    // Completion state handled by parent component

    // Handled by success modal hook
    // Focus the input and position cursor at the end
    setTimeout(() => {
      if (gratitudeEditorRef.current) {
        // Skip scroll to bottom when metadata is present (from faithful actions)
        gratitudeEditorRef.current.focusInput(hasMetadata);
      }
    }, 300); // Small delay to allow modal to close
    // Keep modal open for continued editing
  };

  const gratitudeEditorStyles = Platform.OS === 'android'
    ? {
        ...reflectionLogStyles,
        container: [reflectionLogStyles.container, styles.androidEditorContainer],
        keyboardAvoidingView: [reflectionLogStyles.keyboardAvoidingView, styles.androidRoundedBlueSheet],
        contentCard: [reflectionLogStyles.contentCard, styles.androidRoundedBlueSheet],
        fabWrapper: [reflectionLogStyles.fabWrapper, styles.androidBottomFill],
      }
    : reflectionLogStyles;

  const modalContent = (
    <>
      <GratitudeLogEditor
        ref={gratitudeEditorRef}
        onSave={saveGratitude}
        onCancel={onClose || (() => {})}
        onUpgradeRequired={onClose || (() => {})} // Close modal before navigating to upgrade
        selectedDate={selectedDate}
        initialItems={(() => {
          if (currentGratitudeEntry?.content) {
            try {
              const parsedContent = typeof currentGratitudeEntry.content === 'string'
                ? JSON.parse(currentGratitudeEntry.content)
                : currentGratitudeEntry.content;
              const items = parsedContent.items || [];
              return items;
            } catch (error) {
              Logger.error('Error parsing gratitude content for initialItems', error as Error, {
                component: 'SmartJournalingGratitudeModal',
              });
              return [];
            }
          }
          return undefined;
        })()}
        subtaskTitle={preservedSubtaskTitle}
        subtaskId={subtaskId}
        stepId={stepId}
        playbookTitle={preservedPlaybookTitle}
        actionStepNumber={preservedActionStepNumber}
        actionStepTitle={preservedActionStepTitle}
        isLoading={false}
        styles={gratitudeEditorStyles}
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
    </>
  );

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={Platform.OS === 'android'}
        statusBarTranslucent={Platform.OS === 'android'}
        navigationBarTranslucent={Platform.OS === 'android'}
        onRequestClose={() => {
          Keyboard.dismiss();
          // Small delay to ensure keyboard is fully dismissed before closing
          setTimeout(() => {
            handleCancel();
          }, 10);
        }}
      >
        {Platform.OS === 'android' ? (
          <View style={styles.androidModalRoot}>
            <View style={styles.androidSheet}>
              {modalContent}
            </View>
          </View>
        ) : modalContent}
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  androidModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.hopeWhite,
  },
  androidSheet: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.sage,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  androidEditorContainer: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  androidRoundedBlueSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    backgroundColor: Colors.sage,
  },
  androidBottomFill: {
    backgroundColor: Colors.sage,
    bottom: 0,
  },
});

export default withErrorBoundary(SmartJournalingGratitudeModal, 'SmartJournalingGratitudeModal');

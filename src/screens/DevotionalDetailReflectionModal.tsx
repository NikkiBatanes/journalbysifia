import React, { useState } from 'react';
import { Logger } from '../utils/ProductionLogger';
import { Modal, View, StyleSheet, Keyboard, Alert, DeviceEventEmitter } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import NewSuccessModal from '../components/NewSuccessModal';
import { useSuccessModal } from '../hooks/useSuccessModal';
import ReflectionLogEditor from '../components/journal/ReflectionLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/reflectionStyles';
import { Colors } from '../theme';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { toLocalDateString } from '../utils/date';
import {
  useCreateReflection,
} from '../services/hooks/useReflectionData';
import { useQueryClient } from '@tanstack/react-query';
import { analytics } from '../utils/analytics';
import { faithPointsService } from '../services/faithPointsService';
import { visibleStreakService } from '../services/visibleStreakService';

interface DevotionalDetailReflectionModalProps {
  visible: boolean;
  question: string;
  devotionalId?: string;
  dayNumber?: number;
  dayTitle?: string;
  devotionalTitle?: string;
  totalDays?: number;
  questionNumber?: number;
  existingEntry?: any;
  onSave: (entry: any) => void;
  onCancel: () => void;
  /** True when the user has already prayed/completed today's devotional day.
   *  Streak only triggers for questions to ponder when the day is completed. */
  devotionalDayCompleted?: boolean;
}

const DevotionalDetailReflectionModal: React.FC<DevotionalDetailReflectionModalProps> = ({
  visible,
  question,
  devotionalId,
  devotionalDayCompleted,
  dayNumber,
  dayTitle,
  devotionalTitle,
  totalDays,
  questionNumber,
  existingEntry,
  onSave,
  onCancel,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigation = useNavigation();

  // New success modal system
  const successModal = useSuccessModal(
    () => {
      // Done callback - close the main modal

      onCancel(); // This closes the main modal
    },
    () => {
      // Edit callback - keep modal open for editing

    }
  );
  const [_pendingReflectionData, _setPendingReflectionData] = useState<{ content: string; date: Date } | null>(null);
  const dateStr = toLocalDateString(new Date());

  // React Query hooks
  const createMutation = useCreateReflection();

  // Save reflection using React Query system
  const saveReflection = async (entry: {
    title: string;
    content: string;
    tags?: string[];
    prompt?: string;
    source?: string;
    devotionalTitle?: string;
    dayNumber?: number;
    dayTitle?: string;
    totalDays?: number;
    questionNumber?: number;
  }) => {
    try {

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create save data matching the database schema
      const saveData = {
        title: entry.title,
        content: entry.content,
        type: 'devotional' as const, // Always devotional type for devotional reflections
        source: entry.source || 'devotional' as const, // Use entry source or default to devotional
        user_id: user.id,
        selected_date: existingEntry ? existingEntry.selected_date : dateStr, // Preserve original date if editing
        // Include devotional metadata fields - prefer entry fields over props
        prompt: entry.prompt || question,
        tags: entry.tags || [],
        question_text: question, // Always include the question text for tracking
        // Extract devotional_id from props or existing entry
        devotional_id: existingEntry?.devotional_id || devotionalId,
        ...(entry.devotionalTitle && { devotional_title: entry.devotionalTitle }),
        ...(entry.dayNumber !== undefined && { day_number: entry.dayNumber }),
        ...(entry.dayTitle && { day_title: entry.dayTitle }),
        ...(entry.totalDays !== undefined && { total_days: entry.totalDays }),
        ...(entry.questionNumber !== undefined && { question_number: entry.questionNumber }),
        // Fallback to props if entry fields are not provided
        ...(!entry.devotionalTitle && devotionalTitle && { devotional_title: devotionalTitle }),
        ...(!entry.dayNumber && dayNumber !== undefined && { day_number: dayNumber }),
        ...(!entry.dayTitle && dayTitle && { day_title: dayTitle }),
        ...(!entry.totalDays && totalDays !== undefined && { total_days: totalDays }),
        ...(!entry.questionNumber && questionNumber !== undefined && { question_number: questionNumber }),
      };

      // Save to database using React Query (update existing entry if it exists)

      let result;
      if (existingEntry) {
        // Update existing entry
        const { ReflectionApi } = await import('../services/api/reflectionApi');
        result = await ReflectionApi.updateReflectionEntry(existingEntry.id, saveData);

      } else {
        // Create new entry

        result = await createMutation.mutateAsync(saveData);
      }

      // Track analytics
      analytics.trackReflectionEvent('reflection_created', {
        title_length: entry.title.length,
        content_length: entry.content.length,
        type: 'guided', // Use 'guided' for analytics since devotional is a type of guided reflection
        has_prompt: Boolean(question),
        date: dateStr,
      }, user.id);

      // Emit event to refresh dashboard and remove this question immediately
      DeviceEventEmitter.emit('reflection_saved', {
        reflectionId: result.id,
        type: 'devotional',
        source: 'devotional',
        devotionalId: devotionalId,
        dayNumber: dayNumber,
        questionNumber: questionNumber,
      });

      // PERFORMANCE: No cache invalidation needed - useCreateReflection already handles cache updates
      // The optimized useCreateReflection hook updates cache directly without invalidation
      if (user?.id) {
        // Only invalidate non-critical search queries
        queryClient.invalidateQueries({
          queryKey: ['reflections', 'search'],
          refetchType: 'none',
        });
      }

      // Award faith points for answering devotional question (only for new entries)
      // PERFORMANCE: Make this non-blocking to improve perceived performance
      if (!existingEntry && user?.id) {
        // Fire and forget - don't await to avoid blocking the save process
        faithPointsService.awardPoints(
          user.id,
          'reflection_question_answered',
          {
            suppressNotification: true,
            source: 'devotional_question',
            devotional_id: devotionalId,
            question,
          }
        ).catch(error => {
          // Log error but don't fail the save process
          Logger.warn('Failed to award faith points for devotional reflection', {
            component: 'DevotionalDetailReflectionModal',
            error: error as Error,
          });
        });
      }

      // Call the onSave callback to update parent state
      onSave(result);

      successModal.showSuccess({
        title: 'Ponder Saved',
        message: 'Your devotional ponder has been saved to your journal.',
        showEditButton: true,
      });
      return result;
    } catch (error) {
      Logger.error(' Error saving devotional reflection', error as Error, { component: 'DevotionalDetailReflectionModal' });
      Alert.alert('Error', 'Failed to save devotional reflection. Please try again.');
      throw error;
    }
  };

  // Save reflection data to database immediately
  const saveReflectionData = async (entry: {
    title: string;
    content: string;
    tags: string[];
    date: Date;
    type: string;
    prompt?: string;
    source?: string;
    [key: string]: any;
  }) => {
    try {

      const reflectionData = {
        title: entry.title,
        content: entry.content,
        tags: entry.tags || [],
        // Pass through all the metadata fields from the entry
        ...(entry.prompt && { prompt: entry.prompt }),
        ...(entry.source && { source: entry.source }),
        ...(entry.devotionalTitle && { devotionalTitle: entry.devotionalTitle }),
        ...(entry.dayNumber !== undefined && { dayNumber: entry.dayNumber }),
        ...(entry.dayTitle && { dayTitle: entry.dayTitle }),
        ...(entry.totalDays !== undefined && { totalDays: entry.totalDays }),
        ...(entry.questionNumber !== undefined && { questionNumber: entry.questionNumber }),
      };

      // Save to database immediately
      const savedEntry = await saveReflection(reflectionData);

      // Call the original onSave with the saved entry data
      if (onSave) {
        onSave(savedEntry);
      }

      // For new ponders, check if a streak celebration should show.
      // Only trigger when the user has already completed today's devotional day.
      // If so, close this modal and navigate to StreakPlan instead of showing success modal.
      if (!existingEntry && user?.id && devotionalDayCompleted) {
        const shouldShowStreak = await visibleStreakService.shouldShowCelebration(user.id, 'reflection_saved');
        if (shouldShowStreak) {
          onCancel(); // close the ponder modal
          (navigation as any).navigate('StreakPlan', {
            userId: user.id,
            source: 'reflection_saved',
          });
          return;
        }
      }

      // Show success modal after cache invalidation completes (longer delay to ensure UI updates)
      setTimeout(() => {
        successModal.showSuccess({
        title: 'Ponder Saved',
        message: 'Your devotional ponder has been saved to your journal.',
        showEditButton: true,
      });
      }, 100);

      // No cache invalidation needed - useCreateReflection already handles cache updates
      // The optimized hooks update cache directly without invalidation for instant performance

    } catch (error: any) {
      Logger.error('❌ DevotionalDetailReflectionModal: SAVE FAILED', error as Error, { component: 'DevotionalDetailReflectionModal' });
      Alert.alert(
        'Error',
        `Failed to save reflection: ${error?.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  };

  // Called when "Done" is pressed in SuccessModal (data already saved, just close modal)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSuccessClose = () => {

    // Handled by success modal hook
    onCancel(); // Close the modal
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleEdit = () => {

    // Handled by success modal hook
    // Keep modal open for continued editing
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        Keyboard.dismiss();
        // Small delay to ensure keyboard is fully dismissed before closing
        setTimeout(() => {
          onCancel();
          // Handled by success modal hook
        }, 10);
      }}
      onDismiss={() => {}}
    >
        <View style={styles.modalView}>
          <ReflectionLogEditor
            initialTitle={question}
            initialEntry={existingEntry ? {
              title: existingEntry.title || question,
              content: existingEntry.content || '',
              tags: existingEntry.tags || [],
              type: 'free-form' as const,
              prompt: existingEntry.prompt || question,
              source: 'devotional',
            } : undefined}
            lockTitle
            onSave={saveReflectionData}
            onCancel={onCancel}
            source="devotional"
            initialMode="free-form"
            styles={reflectionLogStyles}
            dateString={(function() {
              const now = new Date();
              const year = now.getFullYear();
              const todayString = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
              const todayStringWithYear = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
              return year === new Date().getFullYear() ? todayString : todayStringWithYear;
            })()}
            devotionalTitle={devotionalTitle}
            totalDays={totalDays}
            dayNumber={dayNumber}
            dayTitle={dayTitle}
            questionNumber={questionNumber}
          />

          {/* New success modal system - completely isolated and robust */}
          <NewSuccessModal
            visible={successModal.isVisible}
            config={successModal.config}
            onDone={successModal.handleDone}
            onEdit={successModal.handleEdit}
          />
        </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  devotionalFooter: {
    padding: 16,
    backgroundColor: Colors.anchorBlue,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  devotionalMetaContainer: {
    marginTop: 8,
  },
  devotionalMeta: {
    fontSize: 14,
    color: Colors.hopeWhite,
    opacity: 0.8,
    marginBottom: 4,
  },
  devotionalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  dayInfo: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  questionMeta: {
    fontSize: 14,
    color: Colors.alertCoral,
    fontWeight: '600',
  },
  modalView: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
});

export default withErrorBoundary(DevotionalDetailReflectionModal, 'DevotionalDetailReflectionModal');

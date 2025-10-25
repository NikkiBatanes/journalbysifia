import React, { useState } from 'react';
import { Modal, View, StyleSheet, Platform, KeyboardAvoidingView, Keyboard, Alert } from 'react-native';
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
  useReflectionData,
} from '../services/hooks/useReflectionData';
import { useQueryClient } from '@tanstack/react-query';
import { analytics } from '../utils/analytics';

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
}

const DevotionalDetailReflectionModal: React.FC<DevotionalDetailReflectionModalProps> = ({
  visible,
  question,
  devotionalId,
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

  console.log('🔍 DevotionalDetailReflectionModal - Props received:', {
    visible,
    devotionalId,
    dayNumber,
    questionNumber,
    existingEntry: existingEntry ? {
      id: existingEntry.id,
      title: existingEntry.title,
      content: existingEntry.content?.substring(0, 50) + '...',
      devotional_id: existingEntry.devotional_id,
      day_number: existingEntry.day_number,
      question_number: existingEntry.question_number,
    } : null,
  });
  // New success modal system
  const successModal = useSuccessModal(
    () => {
      // Done callback - close the main modal
      console.log('✅ DevotionalDetailReflectionModal: Success modal Done pressed - closing main modal');
      onCancel(); // This closes the main modal
    },
    () => {
      // Edit callback - keep modal open for editing
      console.log('✏️ DevotionalDetailReflectionModal: Success modal Edit pressed - keeping modal open');
    }
  );
  const [_pendingReflectionData, _setPendingReflectionData] = useState<{ content: string; date: Date } | null>(null);
  const dateStr = toLocalDateString(new Date());

  // React Query hooks
  const createMutation = useCreateReflection();
  const { refetch } = useReflectionData(user?.id || '', dateStr);

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
      console.log('🔍 DevotionalDetailReflectionModal: saveReflection started with:', entry);
      console.log('🔍 DevotionalDetailReflectionModal: User:', user?.id);
      console.log('🔍 DevotionalDetailReflectionModal: Date string:', dateStr);

      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('🔍 Saving devotional reflection with data:', {
        title: entry.title,
        content: entry.content,
        source: 'devotional',
        devotionalTitle,
        dayNumber,
        questionNumber,
      });

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
      console.log('🔍 DevotionalDetailReflectionModal: Saving with data:', saveData);
      console.log('🔍 DevotionalDetailReflectionModal: Date string:', dateStr);
      console.log('🔍 DevotionalDetailReflectionModal: User ID:', user.id);
      console.log('🔍 DevotionalDetailReflectionModal: Existing entry:', existingEntry);

      let result;
      if (existingEntry) {
        // Update existing entry
        const { ReflectionApi } = await import('../services/api/reflectionApi');
        result = await ReflectionApi.updateReflectionEntry(existingEntry.id, saveData);
        console.log('🔍 DevotionalDetailReflectionModal: Updated existing entry:', result);
      } else {
        // Create new entry
        console.log('🔍 DevotionalDetailReflectionModal: About to call createMutation.mutateAsync with:', saveData);
        console.log('🔍 DevotionalDetailReflectionModal: Mutation status:', { isLoading: createMutation.isPending, isError: createMutation.isError });
        result = await createMutation.mutateAsync(saveData);
      }
      console.log('🔍 DevotionalDetailReflectionModal: Mutation completed successfully:', result);

      // Track analytics
      analytics.trackReflectionEvent('reflection_created', {
        title_length: entry.title.length,
        content_length: entry.content.length,
        type: 'guided', // Use 'guided' for analytics since devotional is a type of guided reflection
        has_prompt: Boolean(question),
        date: dateStr,
      }, user.id);

      // Force refetch to ensure UI updates
      console.log('🔍 DevotionalDetailReflectionModal: About to refetch reflection data...');
      const refetchResult = await refetch();
      console.log('🔍 DevotionalDetailReflectionModal: Refetch completed. Data:', refetchResult.data?.length, 'entries');
      console.log('🔍 DevotionalDetailReflectionModal: Refetch result:', refetchResult);
      console.log('🔍 DevotionalDetailReflectionModal: Refetch data:', refetchResult.data);
      console.log('🔍 DevotionalDetailReflectionModal: Refetch error:', refetchResult.error);

      // Invalidate cache to update journal screen
      if (user?.id) {
        await queryClient.invalidateQueries({
          queryKey: ['reflections', 'byDate', user.id, dateStr],
        });
        await queryClient.invalidateQueries({
          queryKey: ['reflections', 'devotional', user.id],
        });
        await queryClient.invalidateQueries({
          queryKey: ['journal', 'reflections', user.id, dateStr],
        });

        // Simple additional cache invalidation
        await queryClient.invalidateQueries({
          queryKey: ['journal', 'all'],
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
      console.error(' Error saving devotional reflection:', error);
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
      console.log('📝 DevotionalDetailReflectionModal: Saving reflection data to database immediately', {
        title: entry.title,
        contentLength: entry.content.length,
      });

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
      console.log('✅ DevotionalDetailReflectionModal: Database save completed:', savedEntry);

      // Call the original onSave with the saved entry data
      if (onSave) {
        onSave(savedEntry);
      }

      // Show success modal after cache invalidation completes (longer delay to ensure UI updates)
      setTimeout(() => {
        successModal.showSuccess({
        title: 'Ponder Saved',
        message: 'Your devotional ponder has been saved to your journal.',
        showEditButton: true,
      });
      }, 100);

      // Invalidate cache to update journal screen
      if (user?.id) {
        await queryClient.invalidateQueries({
          queryKey: ['reflections', 'byDate', user.id, dateStr],
        });
        await queryClient.invalidateQueries({
          queryKey: ['reflections', 'devotional', user.id],
        });
        await queryClient.invalidateQueries({
          queryKey: ['journal', 'reflections', user.id, dateStr],
        });
      }

      console.log('✅ DevotionalDetailReflectionModal: Reflection saved successfully');
    } catch (error: any) {
      console.error('❌ DevotionalDetailReflectionModal: SAVE FAILED:', error);
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
    console.log('📝 DEVOTIONAL: Done button pressed, closing modal (data already saved)');
    console.log('🔍 DEVOTIONAL: About to hide success modal and close main modal');
    // Handled by success modal hook
    onCancel(); // Close the modal
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleEdit = () => {
    console.log('📝 DEVOTIONAL: Edit button pressed, closing success modal');
    console.log('🔍 DEVOTIONAL: About to hide success modal for editing');
    // Handled by success modal hook
    // Keep modal open for continued editing
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
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
      <KeyboardAvoidingView
        style={styles.centeredView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
      </KeyboardAvoidingView>
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
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalView: {
    backgroundColor: Colors.hopeWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 0,
    width: '100%',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
});

export default withErrorBoundary(DevotionalDetailReflectionModal, 'DevotionalDetailReflectionModal');

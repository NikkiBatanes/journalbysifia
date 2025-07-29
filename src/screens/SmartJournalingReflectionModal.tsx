import React, { useState, useEffect } from 'react';
import { Modal, KeyboardAvoidingView, Platform, StyleSheet, Alert, View, Text, ActivityIndicator } from 'react-native';
import SuccessModal from '../components/SuccessModal';
import ReflectionLogEditor from '../components/journal/ReflectionLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/reflectionStyles';
import { Colors } from '../theme';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useActionSteps } from '../context/ActionStepsContext';
import { toLocalDateString } from '../utils/date';
import {
  useCreateReflection,
  useUpdateReflection,
} from '../services/hooks/useReflectionData';
import { useQueryClient } from '@tanstack/react-query';
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

  const { user } = useAuth();
  const { handleToggleStep } = useActionSteps();
  const queryClient = useQueryClient();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completionInfo, setCompletionInfo] = useState<{ stepId: string; subtaskId: string } | null>(null);
  const dateStr = new Date().toISOString().split('T')[0]; // Use ISO format to match ReflectionLogReactQuery

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
      console.log('💭 SmartJournalingReflectionModal: Modal opening, clearing any existing completion info');
      setCompletionInfo(null);
    }
    setPrevVisible(visible);
  }, [visible, prevVisible]);

  // Handle subtask completion when modal closes after "DONE" is clicked
  useEffect(() => {
    console.log('💭 SmartJournalingReflectionModal: Completion useEffect triggered', {
      visible,
      hasCompletionInfo: !!completionInfo,
      completionInfo,
    });

    // Only complete subtask when modal is closing and we have completion info from successful save
    if (!visible && completionInfo && completionInfo.stepId && completionInfo.subtaskId) {
      const { stepId: completionStepId, subtaskId: completionSubtaskId } = completionInfo;
      console.log('💭 SmartJournalingReflectionModal: Setting timer for subtask completion');

      // Wait for modal slide-down animation to complete (typically 300-500ms)
      const timer = setTimeout(() => {
        console.log('💭 SmartJournalingReflectionModal: Auto-completing subtask after modal slide-down', {
          stepId: completionStepId,
          subtaskId: completionSubtaskId,
        });
        handleToggleStep(completionStepId, completionSubtaskId);
        setCompletionInfo(null); // Clear completion info
      }, 1000); // Wait for modal slide animation to complete

      return () => {
        console.log('💭 SmartJournalingReflectionModal: Clearing timer');
        clearTimeout(timer);
      };
    }
  }, [visible, completionInfo, handleToggleStep]);

  const { createMutation, updateMutation } = {
    createMutation: useCreateReflection(),
    updateMutation: useUpdateReflection(),
  };
  const isLoading = createMutation.isPending || updateMutation.isPending;
  // Note: We don't need to refetch data since the modal will close after saving

  // Save reflection using React Query system
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

      console.log('💭 SmartJournalingReflectionModal: Saving reflection', {
        subtaskTitle,
        subtaskId,
        playbookId,
        entry,
        entryType: entry.type, // Log the type coming from ReflectionLogEditor
      });

      // Track analytics
      analytics.track('smart_journaling_reflection_saved', {
        subtask_id: subtaskId,
        playbook_id: playbookId,
        content_length: entry.content.length,
        has_tags: (entry.tags || []).length > 0,
      });

      console.log('💭 SmartJournalingReflectionModal: Type override - entry.type:', entry.type, '-> overriding to: playbook');

      const reflectionData = {
        user_id: user.id,
        title: entry.title,
        content: entry.content,
        type: 'playbook' as const, // IMPORTANT: Save as 'playbook' type for smart journaling (NOT entry.type which is UI mode)
        source: 'playbook' as const, // Mark source as playbook for filtering
        selected_date: dateStr,
        tags: [...(entry.tags || []), 'playbook'], // Keep playbook tag for filtering
        // Add playbook metadata using dedicated columns
        ...(playbookTitle && { playbook_title: playbookTitle }), // Store in dedicated playbook_title column
        ...(playbookId && { playbook_id: playbookId }), // Store in dedicated playbook_id column
        ...(subtaskId && { subtask_id: subtaskId }), // Store in dedicated subtask_id column
        ...(actionStepNumber !== undefined && { day_number: actionStepNumber }), // Store action step number
        ...(actionStepTitle && { day_title: actionStepTitle }), // Store action step title
      };

      console.log('💭 SmartJournalingReflectionModal: Saving reflection data:', {
        reflectionData,
        subtaskId,
        subtaskIdType: typeof subtaskId,
        hasSubtaskId: !!subtaskId,
      });

      // Use update if editing existing reflection, otherwise create new one
      let savedReflection;
      if (existingReflection) {
        console.log('💭 SmartJournalingReflectionModal: Updating existing reflection:', existingReflection.id);
        savedReflection = await updateMutation.mutateAsync({
          id: existingReflection.id,
          updates: reflectionData,
        });
        console.log('✅ SmartJournalingReflectionModal: Reflection updated successfully:', savedReflection?.id);
      } else {
        console.log('💭 SmartJournalingReflectionModal: Creating new reflection...');
        savedReflection = await createMutation.mutateAsync(reflectionData);
        console.log('✅ SmartJournalingReflectionModal: Reflection created successfully:', savedReflection?.id);
      }
      
      // Validate that the reflection was actually saved
      if (!savedReflection || !savedReflection.id) {
        throw new Error('Save operation completed but no reflection ID returned - save may have failed');
      }
      
      console.log('✅ SmartJournalingReflectionModal: Save validation passed - reflection has ID:', savedReflection.id);

      // IMPORTANT: Manually invalidate reflection cache to ensure UI updates
      console.log('🔄 SmartJournalingReflectionModal: Invalidating reflection cache for UI refresh...');
      
      // Invalidate specific reflection queries to ensure UI updates
      const currentDateStr = new Date().toISOString().split('T')[0]; // Use ISO format to match ReflectionLogReactQuery
      
      // 1. Invalidate Daily UI query (ReflectionLogReactQuery)
      await queryClient.invalidateQueries({ 
        queryKey: ['reflections', 'byDate', user.id, currentDateStr],
        exact: true 
      });
      
      // 2. Invalidate smart journaling subtask query
      if (subtaskId) {
        await queryClient.invalidateQueries({ 
          queryKey: ['reflections', 'subtask', user.id, subtaskId],
          exact: true 
        });
      }
      
      // 3. Broad invalidation as fallback
      await queryClient.invalidateQueries({ 
        queryKey: ['reflections'], 
        exact: false 
      });
      
      console.log('✅ SmartJournalingReflectionModal: Specific cache invalidation completed', {
        dateQuery: ['reflections', 'byDate', user.id, currentDateStr],
        subtaskQuery: subtaskId ? ['reflections', 'subtask', user.id, subtaskId] : 'N/A'
      });
      
      // Note: React Query mutations should handle this automatically, but we're adding manual invalidation
      // to ensure the Daily UI and Reflection Log show the new reflection immediately
      
      // Only set completion info for new reflections, not for updates
      if (!existingReflection && stepId && subtaskId) {
        console.log('💭 SmartJournalingReflectionModal: Setting completion info for new reflection', {
          stepId,
          subtaskId,
        });
        setCompletionInfo({ stepId, subtaskId });
      } else {
        console.log('💭 SmartJournalingReflectionModal: Skipping completion info for existing reflection or missing IDs');
      }

      // Show success modal
      setShowSuccessModal(true);

      // Call parent onSave callback
      onSave(reflectionData);

      console.log('✅ SmartJournalingReflectionModal: Reflection saved successfully - should appear in UI now');
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      const errorStack = error?.stack || 'No stack trace';
      
      console.error('❌ SmartJournalingReflectionModal: SAVE FAILED - Error details:', {
        error: error,
        errorMessage,
        errorStack,
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
        `Failed to save reflection: ${errorMessage}. This could explain why delete operations hang.`,
        [{ text: 'OK' }]
      );
    }
  };

  // Note: Delete functionality intentionally removed from smart journaling modal.
  // Users can delete reflections through the main Reflection Log interface.

  const handleSuccessModalClose = () => {
    console.log('Closing success modal and reflection editor');
    setShowSuccessModal(false);
    onCancel();
  };

  const handleEdit = () => {
    console.log('Edit button pressed, closing success modal');
    setShowSuccessModal(false);
    // The editor will remain open since we're not calling onCancel
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
              onSave={saveReflection}
              onCancel={handleCancel}
              // Note: onDelete prop intentionally omitted - users delete via Reflection Log
              initialTitle={subtaskTitle}
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
              playbookTitle={playbookTitle}
              dayNumber={actionStepNumber}
              dayTitle={actionStepTitle}
              subtaskId={subtaskId}
              initialEntry={existingReflection ? {
                title: existingReflection.title || subtaskTitle,
                content: existingReflection.content || '',
                tags: existingReflection.tags || [],
                type: 'free-form',
                source: 'playbook',
              } : undefined}
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

      {/* Loading overlay for operations */}
      {isLoading && (
        <Modal
          visible={isLoading}
          transparent={true}
          animationType="fade"
          statusBarTranslucent={true}
        >
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.alertCoral} />
              <Text style={styles.loadingText}>Saving reflection...</Text>
            </View>
          </View>
        </Modal>
      )}
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

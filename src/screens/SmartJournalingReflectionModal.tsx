import React, { useState } from 'react';
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completionInfo, setCompletionInfo] = useState<{ stepId?: string; subtaskId?: string } | null>(null);
  const dateStr = toLocalDateString(new Date());

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
      if (existingReflection) {
        await updateMutation.mutateAsync({
          id: existingReflection.id,
          updates: reflectionData,
        });
        console.log('💭 SmartJournalingReflectionModal: Reflection updated successfully');
      } else {
        await createMutation.mutateAsync(reflectionData);
        console.log('💭 SmartJournalingReflectionModal: Reflection created successfully');

        // Store completion info for later (when success modal closes)
        setCompletionInfo({ stepId, subtaskId });
      }

      // Show success modal
      setShowSuccessModal(true);

      // Call parent onSave callback
      onSave(reflectionData);

      console.log('💭 SmartJournalingReflectionModal: Reflection saved successfully');
    } catch (error) {
      console.error('💭 SmartJournalingReflectionModal: Error saving reflection:', error);
      Alert.alert(
        'Error',
        'Failed to save reflection. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSuccessModalClose = () => {
    console.log('Closing success modal and reflection editor');

    // Auto-complete the subtask when success modal is closed (only for new reflections)
    if (completionInfo && completionInfo.stepId && completionInfo.subtaskId) {
      console.log('💭 SmartJournalingReflectionModal: Auto-completing subtask after success modal close', {
        stepId: completionInfo.stepId,
        subtaskId: completionInfo.subtaskId,
      });
      handleToggleStep(completionInfo.stepId, completionInfo.subtaskId);
      setCompletionInfo(null); // Clear completion info
    }

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

      {/* Loading overlay for save operation */}
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

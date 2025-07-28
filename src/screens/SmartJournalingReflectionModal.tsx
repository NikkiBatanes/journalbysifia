import React, { useState } from 'react';
import { Modal, KeyboardAvoidingView, Platform, StyleSheet, Alert, View, Text, ActivityIndicator } from 'react-native';
import SuccessModal from '../components/SuccessModal';
import ReflectionLogEditor from '../components/journal/ReflectionLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/reflectionStyles';
import { Colors } from '../theme';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../utils/date';
import {
  useCreateReflection,
} from '../services/hooks/useReflectionData';
import { analytics } from '../utils/analytics';

interface SmartJournalingReflectionModalProps {
  visible: boolean;
  subtaskTitle: string;
  subtaskId?: string;
  playbookId?: string;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  onSave: (entry: any) => void;
  onCancel: () => void;
}

const SmartJournalingReflectionModal: React.FC<SmartJournalingReflectionModalProps> = ({
  visible,
  subtaskTitle,
  subtaskId,
  playbookId,
  playbookTitle,
  actionStepNumber,
  actionStepTitle,
  onSave,
  onCancel,
}) => {
  const { user } = useAuth();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const dateStr = toLocalDateString(new Date());

  // React Query hooks
  const createMutation = useCreateReflection();
  const isLoading = createMutation.isPending;
  // Note: We don't need to refetch data since the modal will close after saving

  // Save reflection using React Query system
  const saveReflection = async (entry: { title: string; content: string; tags?: string[] }) => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('💭 SmartJournalingReflectionModal: Saving reflection', {
        subtaskTitle,
        subtaskId,
        playbookId,
        entry,
      });

      // Track analytics
      analytics.track('smart_journaling_reflection_saved', {
        subtask_id: subtaskId,
        playbook_id: playbookId,
        content_length: entry.content.length,
        has_tags: (entry.tags || []).length > 0,
      });

      const reflectionData = {
        user_id: user.id,
        title: entry.title,
        content: entry.content,
        type: 'playbook' as const, // Save as 'playbook' type for smart journaling
        source: 'playbook' as const, // Mark source as playbook for filtering
        selected_date: dateStr,
        tags: [...(entry.tags || []), 'playbook'], // Add 'playbook' tag to identify source
        // Add playbook metadata for identification and filtering
        // Using devotional fields to store playbook metadata for now
        ...(playbookTitle && { devotional_title: playbookTitle }),
        ...(actionStepNumber !== undefined && { day_number: actionStepNumber }),
        ...(actionStepTitle && { day_title: actionStepTitle }),
        // Store subtask and playbook IDs in content metadata or tags
        // This helps identify playbook reflections in the daily log
      };

      await createMutation.mutateAsync(reflectionData);

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
              devotionalTitle={playbookTitle}
              dayNumber={actionStepNumber}
              dayTitle={actionStepTitle}
              subtaskId={subtaskId}
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

import React, { useState } from 'react';
import { Modal, View, StyleSheet, Platform, KeyboardAvoidingView, Alert } from 'react-native';
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
        type: 'free' as const,
        selected_date: dateStr,
        // Note: source is optional and typed as 'devotional' only, so we omit it for smart journaling
        // subtask_id, playbook_id, subtask_title will be stored in the content field as metadata
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
    setShowSuccessModal(false);
    onCancel(); // Close the main modal
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
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SuccessModal
        visible={showSuccessModal}
        title="Reflection Saved!"
        message="Your reflection has been saved to your journal."
        onDismiss={handleSuccessModalClose}
        buttonText="Continue"
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
});

export default SmartJournalingReflectionModal;

import React, { useState } from 'react';
import { Modal, View, StyleSheet, Platform, KeyboardAvoidingView, Keyboard, Alert } from 'react-native';
import SuccessModal from '../components/SuccessModal';
import ReflectionLogEditor from '../components/journal/ReflectionLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/ReflectionLog';
import { Colors } from '../theme';
import { useAuth } from '../context/AuthContext';
import { toLocalDateString } from '../utils/date';
import {
  useCreateReflection,
  useReflectionData,
} from '../services/hooks/useReflectionData';
import { analytics } from '../utils/analytics';

interface DevotionalDetailReflectionModalProps {
  visible: boolean;
  question: string;
  dayNumber?: number;
  dayTitle?: string;
  devotionalTitle?: string;
  totalDays?: number;
  questionNumber?: number;
  onSave: (entry: any) => void;
  onCancel: () => void;
}

const DevotionalDetailReflectionModal: React.FC<DevotionalDetailReflectionModalProps> = ({
  visible,
  question,
  dayNumber,
  dayTitle,
  devotionalTitle,
  totalDays,
  questionNumber,
  onSave,
  onCancel,
}) => {
  const { user } = useAuth();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const dateStr = toLocalDateString(new Date());

  // React Query hooks
  const createMutation = useCreateReflection();
  const { refetch } = useReflectionData(user?.id || '', dateStr);

  // Save reflection using React Query system
  const saveReflection = async (entry: { title: string; content: string; tags?: string[] }) => {
    try {
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
      // TODO: Add devotional metadata fields after database migration
      const saveData = {
        title: entry.title,
        content: entry.content,
        type: 'guided' as const, // Always guided for devotional reflections
        user_id: user.id,
        selected_date: dateStr,
        // TEMPORARY: Remove fields that don't exist in database yet
        // prompt: question,
        // tags: entry.tags || [],
        // ...(devotionalTitle && { devotional_title: devotionalTitle }),
        // ...(dayNumber !== undefined && { day_number: dayNumber }),
        // ...(dayTitle && { day_title: dayTitle }),
        // ...(totalDays !== undefined && { total_days: totalDays }),
        // ...(questionNumber !== undefined && { question_number: questionNumber }),
      };

      // Save to database using React Query
      const result = await createMutation.mutateAsync(saveData);
      console.log('🔍 Devotional reflection saved successfully:', result);

      // Track analytics
      analytics.trackReflectionEvent('reflection_created', {
        title_length: entry.title.length,
        content_length: entry.content.length,
        type: 'guided',
        has_prompt: Boolean(question),
        date: dateStr,
      }, user.id);

      // Force refetch to ensure UI updates
      await refetch();
      console.log('🔍 Reflection data refetched after devotional save');

      setShowSuccessModal(true);
      return result;
    } catch (error) {
      console.error('🔍 Error saving devotional reflection:', error);
      Alert.alert('Error', 'Failed to save devotional reflection. Please try again.');
      throw error;
    }
  };

  const handleSave = async (entry: { title: string; content: string; tags?: string[] }) => {
    try {
      console.log('Saving reflection...');
      const savedEntry = await saveReflection({
        title: entry.title,
        content: entry.content,
        tags: entry.tags || [],
      });

      console.log('Reflection saved, calling onSave callback');
      // Call the original onSave with the saved entry data
      if (onSave) {
        onSave(savedEntry);
      }

      console.log('Success modal should be visible now');
    } catch (error) {
      console.error('Failed to save reflection:', error);
      // You might want to show an error message to the user here
    }
  };

  const handleSuccessClose = () => {
    console.log('Closing success modal and reflection editor');
    setShowSuccessModal(false);
    onCancel();
  };

  const handleEdit = () => {
    console.log('Edit button pressed, closing success modal');
    setShowSuccessModal(false);
    // The editor will remain open since we're not calling onCancel
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
          setShowSuccessModal(false);
        }, 10);
      }}
      onDismiss={() => setShowSuccessModal(false)}
    >
      <KeyboardAvoidingView
        style={styles.centeredView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalView}>
          <ReflectionLogEditor
            initialTitle={question}
            lockTitle
            onSave={handleSave}
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

          <SuccessModal
            visible={showSuccessModal}
            title="Ponder Saved"
            message="Your devotional ponder has been saved to your journal."
            onDismiss={handleSuccessClose}
            onEdit={handleEdit}
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

export default DevotionalDetailReflectionModal;

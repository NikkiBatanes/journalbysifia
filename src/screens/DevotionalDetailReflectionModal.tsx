import React, { useState } from 'react';
import { Modal, View, StyleSheet, Platform, KeyboardAvoidingView, Keyboard } from 'react-native';
import SuccessModal from '../components/SuccessModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReflectionLogEditor from '../components/journal/ReflectionLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/ReflectionLog';
import { Colors } from '../theme';

interface ReflectionLogEntry {
  id: string;
  title: string;
  content: string;
  date: Date;
  type: string;
  displayType?: string;
  prompt?: string;
  tags?: string[];
  source?: string;
}

const REFLECTION_LOG_KEY = 'reflectionEntries';

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
  const [_isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [existingEntries, setExistingEntries] = useState<ReflectionLogEntry[]>([]);

  // Load existing entries on mount
  React.useEffect(() => {
    const loadEntries = async () => {
      try {
        const savedEntries = await AsyncStorage.getItem(REFLECTION_LOG_KEY);
        if (savedEntries) {
          setExistingEntries(JSON.parse(savedEntries));
        }
      } catch (error) {
        console.error('Failed to load entries', error);
      }
    };
    loadEntries();
  }, []);

  // Save reflection to AsyncStorage
  const saveReflection = async (entry: Omit<ReflectionLogEntry, 'id' | 'date' | 'type' | 'displayType'>) => {
    try {
      setIsSaving(true);
      const now = new Date();
      // Since this is a devotional reflection, it's always guided
      const newEntry = {
        ...entry,
        id: Date.now().toString(),
        date: now,
        type: 'guided',  // Always set to 'guided' for devotional reflections
        displayType: 'Guided Prompt',
        source: 'devotional',
        // Include devotional metadata
        ...(devotionalTitle && { devotionalTitle }),
        ...(dayNumber !== undefined && { dayNumber }),
        ...(dayTitle && { dayTitle }),
        ...(totalDays !== undefined && { totalDays }),
        ...(questionNumber !== undefined && { questionNumber }),
      };

      // Create updated entries array with new entry at the beginning
      const updatedEntries = [newEntry, ...existingEntries];

      // Save to AsyncStorage
      await AsyncStorage.setItem(
        REFLECTION_LOG_KEY,
        JSON.stringify(updatedEntries)
      );

      // Update local state
      setExistingEntries(updatedEntries);

      setShowSuccessModal(true);
      return newEntry;
    } catch (error) {
      console.error('Error saving reflection:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (entry: { title: string; content: string; tags?: string[] }) => {
    try {
      console.log('Saving reflection...');
      const savedEntry = await saveReflection({
        title: entry.title,
        content: entry.content,
        prompt: question,
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

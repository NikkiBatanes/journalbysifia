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
  onSave: (entry: any) => void;
  onCancel: () => void;
}

const DevotionalDetailReflectionModal: React.FC<DevotionalDetailReflectionModalProps> = ({
  visible,
  question,
  onSave,
  onCancel,
}) => {
  const [isSaving, setIsSaving] = useState(false);
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
      // Determine if this is a guided or freeform reflection
      const isGuided = !!entry.prompt;
      const newEntry = {
        ...entry,
        id: Date.now().toString(),
        date: now,
        type: isGuided ? 'guided' : 'free-form',
        displayType: isGuided ? 'Guided Prompt' : 'Free Form',
        source: 'devotional',
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
      await saveReflection({
        title: entry.title,
        content: entry.content,
        prompt: question,
        tags: entry.tags || [],
      });
      
      // Call the original onSave if provided
      if (onSave) {
        onSave(entry);
      }
    } catch (error) {
      console.error('Failed to save reflection:', error);
      // You might want to show an error message to the user here
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    onCancel();
  };

  const handleEdit = () => {
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
            styles={reflectionLogStyles}
            dateString={(function() {
              const now = new Date();
              const year = now.getFullYear();
              const todayString = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
              const todayStringWithYear = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
              return year === new Date().getFullYear() ? todayString : todayStringWithYear;
            })()}
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

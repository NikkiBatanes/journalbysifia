import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useCreatePrayer } from '../../services/hooks/usePrayerData';
import { toLocalDateString } from '../../utils/date';

interface PersonalPrayerEditorProps {
  selectedDate: Date;
}

const PersonalPrayerEditor: React.FC<PersonalPrayerEditorProps> = ({ selectedDate }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const createPrayer = useCreatePrayer();

  const handleSave = async () => {
    if (!content.trim()) {
      return;
    }

    try {
      await createPrayer.mutateAsync({
        type: 'supplication', // Using supplication type for personal prayers
        content,
        selected_date: toLocalDateString(selectedDate),
        user_id: user?.id || '',
        prayer_type: 'journal', // Using journal as the prayer type
        is_answered: false,
        answered_date: null,
        journal_category: 'supplication',
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving personal prayer:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Personal Prayer</Text>
        {isEditing ? (
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Ionicons name="checkmark" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
            <Ionicons name="create-outline" size={20} color={Colors.anchorBlue} />
          </TouchableOpacity>
        )}
      </View>

      {isEditing ? (
        <TextInput
          style={styles.input}
          multiline
          placeholder="Write your personal prayer here..."
          value={content}
          onChangeText={setContent}
          autoFocus
        />
      ) : (
        <Text style={styles.content}>
          {content || 'Tap the edit button to write a personal prayer...'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.anchorBlue,
  },
  input: {
    minHeight: 120,
    textAlignVertical: 'top',
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  content: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.text,
  },
  editButton: {
    padding: 8,
  },
  saveButton: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 20,
    padding: 8,
  },
});

export default PersonalPrayerEditor;

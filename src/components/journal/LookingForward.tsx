import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface LookingForwardEntry {
  id: string;
  text: string;
  date: Date;
}

export const LookingForward: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [entry, setEntry] = useState<LookingForwardEntry | null>(null);
  const [entryText, setEntryText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const saveEntry = () => {
    if (entryText.trim()) {
      setEntry({
        id: Date.now().toString(),
        text: entryText,
        date: new Date(),
      });
      setEntryText('');
      setIsEditing(false);
    }
  };

  const removeEntry = () => {
    setEntry(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <JournalCard
      icon="arrow-forward-outline"
      title="Looking Forward To"
      subtitle="What are you excited about tomorrow?"
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      showAddButton={!entry && !isEditing}
      onAdd={() => setIsEditing(true)}
    >
      {entry ? (
        <View style={styles.entryContainer}>
          <View style={styles.entryContent}>
            <Text style={styles.entryText}>{entry.text}</Text>
            <Text style={styles.entryTime}>{formatDate(entry.date)}</Text>
          </View>
          <TouchableOpacity
            onPress={removeEntry}
            style={styles.editButton}
          >
            <Ionicons name="create-outline" size={20} color={Colors.mediumGray} />
          </TouchableOpacity>
        </View>
      ) : isEditing ? (
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            value={entryText}
            onChangeText={setEntryText}
            placeholder="What are you looking forward to tomorrow?"
            placeholderTextColor={Colors.mediumGray}
            multiline
            autoFocus
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => {
                setIsEditing(false);
                setEntryText('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, !entryText.trim() && styles.disabledButton]}
              onPress={saveEntry}
              disabled={!entryText.trim()}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.emptyText}>What are you looking forward to tomorrow?</Text>
      )}
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  entryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
  },
  entryContent: {
    flex: 1,
    marginRight: 12,
  },
  entryText: {
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  entryTime: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 12,
  },
  editButton: {
    padding: 4,
  },
  emptyText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginVertical: 8,
  },
  formContainer: {
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: Colors.mediumGray,
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  disabledButton: {
    opacity: 0.5,
  },
  cancelButtonText: {
    color: Colors.darkGray,
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
  saveButtonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
});

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check, Sunrise as LuSunrise } from 'lucide-react-native';

interface LookingForwardEntry {
  id: string;
  text: string;
  date: Date;
}

export const LookingForward: React.FC = () => {
  const [entry, setEntry] = useState<LookingForwardEntry | null>(null);
  const [entryText, setEntryText] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const startAdding = () => {
    setIsAdding(true);
    setEntryText('');
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setEntryText('');
  };

  const saveEntry = () => {
    if (entryText.trim()) {
      setEntry({
        id: Date.now().toString(),
        text: entryText,
        date: new Date(),
      });
      setEntryText('');
      setIsAdding(false);
    }
  };

  const editEntry = () => {
    if (entry) {
      setEntryText(entry.text);
      setIsAdding(true);
    }
  };

  const removeEntry = () => {
    setEntry(null);
    setEntryText('');
  };

  const formatDate = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <JournalCard
      icon={
        <LuSunrise
          size={24}
          color={Colors.alertCoral}
          strokeWidth={2.5}
        />
      }
      title="Looking Forward To"
      subtitle="What are you excited about tomorrow?"
      showAddButton={!entry && !isAdding}
      onAdd={startAdding}
      isAdding={isAdding}
      onCancelAdd={cancelAdding}
    >
      {entry ? (
        <View style={styles.entryContainer}>
          <View style={styles.entryContent}>
            <Text style={styles.entryText}>{entry.text}</Text>
            <Text style={styles.entryTime}>{formatDate(entry.date)}</Text>
          </View>
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              onPress={editEntry}
              style={styles.editButton}
            >
              <Ionicons name="create-outline" size={20} color={Colors.mediumGray} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={removeEntry}
              style={styles.deleteButton}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.alertCoral} />
            </TouchableOpacity>
          </View>
        </View>
      ) : isAdding ? (
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
              onPress={cancelAdding}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, !entryText.trim() && styles.disabledButton]}
              onPress={saveEntry}
              disabled={!entryText.trim()}
            >
              <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  entryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    marginLeft: 8,
    padding: 4,
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
    display: 'none',
  },
  formContainer: {
    marginTop: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
    fontSize: 13,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
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
    backgroundColor: 'transparent',
    marginRight: 8,
    width: 'auto',
    height: 'auto',
    paddingHorizontal: 12,
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

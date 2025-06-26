import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  date: Date;
}

export const JournalEntries: React.FC = () => {
  const [_isExpanded, _setIsExpanded] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newEntry, setNewEntry] = useState({
    title: '',
    content: '',
  });

  const addEntry = () => {
    if (newEntry.title.trim() && newEntry.content.trim()) {
      setEntries([{
        id: Date.now().toString(),
        ...newEntry,
        date: new Date(),
      }, ...entries]);
      setNewEntry({ title: '', content: '' });
      setIsAdding(false);
    }
  };

  const removeEntry = (id: string) => {
    setEntries(entries.filter(entry => entry.id !== id));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const startNewEntry = () => {
    if (isAdding) {return;}
    setNewEntry({ title: '', content: '' });
    setIsAdding(true);
  };

  return (
    <JournalCard
      icon="document-text-outline"
      title="Journal Entries"
      subtitle="Capture your thoughts and reflections"
      showAddButton={!isAdding}
      onAdd={startNewEntry}
    >
      {entries.length > 0 ? (
        <ScrollView style={styles.entriesContainer}>
          {entries.map(entry => (
            <View key={entry.id} style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryTitle} numberOfLines={1}>{entry.title}</Text>
                <TouchableOpacity
                  onPress={() => removeEntry(entry.id)}
                  style={styles.removeButton}
                >
                  <Ionicons name="close" size={18} color={Colors.mediumGray} />
                </TouchableOpacity>
              </View>
              <Text style={styles.entryContent}>{entry.content}</Text>
              <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
            </View>
          ))}
        </ScrollView>
      ) : isAdding ? (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            value={newEntry.title}
            onChangeText={(text) => setNewEntry({...newEntry, title: text})}
            placeholder="Entry Title"
            placeholderTextColor={Colors.mediumGray}
          />
          <TextInput
            style={[styles.input, styles.contentInput]}
            value={newEntry.content}
            onChangeText={(text) => setNewEntry({...newEntry, content: text})}
            placeholder="Write your thoughts here..."
            placeholderTextColor={Colors.mediumGray}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.formButtons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setIsAdding(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton,
                (!newEntry.title.trim() || !newEntry.content.trim()) && styles.disabledButton,
              ]}
              onPress={addEntry}
              disabled={!newEntry.title.trim() || !newEntry.content.trim()}
            >
              <Text style={styles.saveButtonText}>Save Entry</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

    </JournalCard>
  );
};

const styles = StyleSheet.create({
  entriesContainer: {
    maxHeight: 200,
    marginBottom: 8,
  },
  entryCard: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryTitle: {
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  entryContent: {
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  entryDate: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 12,
    textAlign: 'right',
  },
  emptyText: {
    display: 'none',
  },
  removeButton: {
    padding: 4,
  },
  addForm: {
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
    marginBottom: 12,
  },
  contentInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    paddingVertical: 10,
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
  },
  saveButtonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
  },
});

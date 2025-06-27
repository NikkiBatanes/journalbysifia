import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check, NotebookPen as LuNotebookPen } from 'lucide-react-native';

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
      icon={
        <LuNotebookPen 
          size={24}
          color={Colors.alertCoral}
          strokeWidth={2.5}
        />
      }
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
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.saveButton,
                (!newEntry.title.trim() || !newEntry.content.trim()) && styles.disabledButton,
              ]}
              onPress={addEntry}
              disabled={!newEntry.title.trim() || !newEntry.content.trim()}
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
  entriesContainer: {
    maxHeight: 200,
    marginBottom: 8,
  },
  entryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    padding: 12,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.darkGray,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    marginBottom: 12,
    minHeight: 40,
  },
  contentInput: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    padding: 0,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

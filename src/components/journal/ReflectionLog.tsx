import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check, NotebookPen as LuNotebookPen, Sparkles } from 'lucide-react-native';

type ViewMode = 'free-form' | 'guided';

interface ReflectionLogEntry {
  id: string;
  title: string;
  content: string;
  date: Date;
  type: ViewMode;
  prompt?: string;
  tags?: string[];
  location?: string;
}

const GUIDED_PROMPTS = [
  "How did I seek God's guidance in my decisions today?",
  "Did I reflect Christ's love in my interactions?",
  'What challenged my faith, and how did I respond?',
  'Am I prioritizing daily prayer and Scripture reading?',
  "How am I using my talents and resources for God's glory?",
  'What habit or sin is hindering me, and how can I address it?',
  'Did I show forgiveness or grace to someone today?',
  'Am I serving others in my church or community?',
  "Is my career or business aligned with God's values?",
  'How am I managing stress to protect my mental health?',
  "What's one step I can take to improve my physical health?",
  'Am I trusting God with my work or financial concerns?',
  'How can I pursue excellence in my work to honor God?',
  "Am I encouraging others' faith or well-being this week?",
  "What's one way I can grow in a practical skill to reflect God's excellence?",
];

export const ReflectionLog: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('free-form');
  const [visibleCount, setVisibleCount] = useState<number>(3);
  const [entries, setEntries] = useState<ReflectionLogEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(GUIDED_PROMPTS[0]);
  const [newEntry, setNewEntry] = useState({
    title: '',
    content: '',
  });

  const addEntry = (entry: Omit<ReflectionLogEntry, 'id' | 'date'>) => {
    const newEntry = {
      ...entry,
      id: Date.now().toString(),
      date: new Date(),
    };
    setEntries([newEntry, ...entries]);
    setNewEntry({ title: '', content: '' });
    setIsAdding(false);
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

  const renderPromptPicker = () => (
    <Modal
      visible={showPromptPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowPromptPicker(false)}
    >
      <View style={styles.promptModalContainer}>
        <View style={styles.promptModalContent}>
          <View style={styles.promptModalHeader}>
            <Text style={styles.promptModalTitle}>Choose a Reflection Prompt</Text>
            <TouchableOpacity onPress={() => setShowPromptPicker(false)}>
              <Ionicons name="close" size={24} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.promptList}>
            {GUIDED_PROMPTS.map((prompt, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.promptOption,
                  prompt === selectedPrompt && styles.selectedPromptOption
                ]}
                onPress={() => {
                  setSelectedPrompt(prompt);
                  setShowPromptPicker(false);
                }}
              >
                <Text style={styles.promptOptionText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
            {entries.length > 3 && (
              <View style={styles.paginationContainer}>
                <View style={styles.paginationButtonGroup}>
                  {visibleCount < entries.length ? (
                    <TouchableOpacity
                      style={[styles.paginationButton, styles.showMoreButton]}
                      onPress={() => setVisibleCount(prev => Math.min(prev + 3, entries.length))}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chevron-down" size={12} color={Colors.alertCoral} />
                      <Text style={[styles.paginationButtonText, styles.showMoreText]}>
                        Show more
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.paginationButton, styles.showLessButton]}
                      onPress={() => setVisibleCount(3)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chevron-up" size={12} color={Colors.mediumGray} />
                      <Text style={[styles.paginationButtonText, styles.showLessText]}>
                        Show less
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Render entries in a list
  const renderEntries = () => {
    if (entries.length === 0) {
      return null; // Return nothing for empty state
    }
    
    return (
      <>
        <View style={styles.entriesContainer}>
          {entries.slice(0, visibleCount).map((entry) => (
            <View 
              key={entry.id} 
              style={[
                styles.entryCard,
                entry.type === 'guided' ? styles.guidedEntry : styles.freeFormEntry
              ]}
            >
              {entry.type === 'guided' && entry.prompt ? (
                <View style={styles.guidedPromptRow}>
                  <View style={styles.guidedPromptContainer}>
                    <Text style={styles.guidedPromptText}>GUIDED PROMPT</Text>
                  </View>
                  <Text style={styles.timeText}>
                    {new Date(entry.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </Text>
                </View>
              ) : (
                <View style={styles.freeFormPromptRow}>
                  <View style={styles.freeFormPromptContainer}>
                    <Text style={styles.freeFormPromptText}>FREE FORM</Text>
                  </View>
                  <Text style={styles.timeText}>
                    {new Date(entry.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </Text>
                </View>
              )}
              {entry.type === 'guided' && entry.prompt ? (
                <Text style={styles.promptText}>{entry.prompt}</Text>
              ) : entry.title ? (
                <Text style={[styles.promptText, { fontStyle: 'normal' }]}>{entry.title}</Text>
              ) : null}
              <Text 
                style={styles.entryContent}
                numberOfLines={3}
                ellipsizeMode="tail"
              >
                {entry.content}
              </Text>
            </View>
          ))}
        </View>
        {(entries.length > visibleCount || visibleCount > 3) && (
          <View style={styles.paginationContainer}>
            <View style={styles.paginationButtonGroup}>
              {entries.length > visibleCount && (
                <TouchableOpacity
                  style={[styles.paginationButton, styles.showMoreButton]}
                  onPress={() => setVisibleCount(prev => Math.min(prev + 3, entries.length))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-down" size={12} color={Colors.alertCoral} />
                  <Text style={[styles.paginationButtonText, styles.showMoreText]}>
                    Show more
                  </Text>
                </TouchableOpacity>
              )}
              {visibleCount > 3 && (
                <TouchableOpacity
                  style={[styles.paginationButton, styles.showLessButton]}
                  onPress={() => setVisibleCount(3)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-up" size={12} color={Colors.mediumGray} />
                  <Text style={[styles.paginationButtonText, styles.showLessText]}>
                    Show less
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </>
    );
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
      title="Reflection Log"
      subtitle={isAdding ? (viewMode === 'free-form' ? 'Record your thoughts' : 'Reflect with guidance') : 'Your reflections'}
      showAddButton={!isAdding}
      isAdding={isAdding}
      onAdd={() => {
        setNewEntry({ title: '', content: '' });
        setIsAdding(true);
      }}
      onCancelAdd={() => {
        setIsAdding(false);
        setNewEntry({ title: '', content: '' });
      }}
    >
      {isAdding ? (
        <>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'free-form' && styles.activeToggle]}
              onPress={() => setViewMode('free-form')}
            >
              <Text style={styles.toggleText}>Free Form</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'guided' && styles.activeToggle]}
              onPress={() => setViewMode('guided')}
            >
              <Sparkles size={16} color={viewMode === 'guided' ? Colors.alertCoral : Colors.mediumGray} />
              <Text style={[styles.toggleText, { marginLeft: 4 }]}>Guided</Text>
            </TouchableOpacity>
          </View>

          {viewMode === 'free-form' ? (
            <View style={styles.addForm}>
              <TextInput
                style={styles.input}
                placeholder="Title"
                value={newEntry.title}
                onChangeText={text => setNewEntry({...newEntry, title: text})}
                placeholderTextColor={Colors.mediumGray}
              />
              <TextInput
                style={[styles.input, styles.contentInput]}
                placeholder="Write your thoughts..."
                multiline
                value={newEntry.content}
                onChangeText={text => setNewEntry({...newEntry, content: text})}
                placeholderTextColor={Colors.mediumGray}
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.button, 
                    styles.saveButton,
                    (!newEntry.title.trim() || !newEntry.content.trim()) && styles.disabledButton
                  ]}
                  onPress={() => addEntry({
                    ...newEntry,
                    type: 'free-form',
                    title: newEntry.title.trim() || 'Untitled Reflection'
                  })}
                  disabled={!newEntry.title.trim() || !newEntry.content.trim()}
                >
                  <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.addForm}>
              <View style={styles.promptSelector}>
                <Text style={styles.promptLabel}>Reflection Prompt:</Text>
                <TouchableOpacity 
                  style={styles.pickerContainer}
                  onPress={() => setShowPromptPicker(true)}
                >
                  <Text style={styles.selectedPrompt} numberOfLines={1}>{selectedPrompt}</Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.mediumGray} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, styles.guidedInput]}
                placeholder="Write your reflection..."
                multiline
                value={newEntry.content}
                onChangeText={text => setNewEntry({...newEntry, content: text})}
                placeholderTextColor={Colors.mediumGray}
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.button, 
                    styles.saveButton,
                    !newEntry.content.trim() && styles.disabledButton
                  ]}
                  onPress={() => addEntry({
                    title: `Reflection: ${selectedPrompt.substring(0, 30)}...`,
                    content: newEntry.content,
                    type: 'guided',
                    prompt: selectedPrompt
                  })}
                  disabled={!newEntry.content.trim()}
                >
                  <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      ) : (
        // Display all entries in a list
        renderEntries()
      )}
      {renderPromptPicker()}
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    padding: 4,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
  },
  activeToggle: {
    backgroundColor: Colors.hopeWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
    fontSize: 14,
  },
  entriesContainer: {
    width: '100%',
  },
  entryCard: {
    backgroundColor: 'rgba(26, 60, 109, 0.05)', // Base anchor blue with very low opacity
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.1)',
  },
  guidedEntry: {
    backgroundColor: 'rgba(255, 107, 107, 0.05)', // Coral with very low opacity
    borderColor: 'rgba(255, 107, 107, 0.15)',
  },
  freeFormEntry: {
    backgroundColor: 'rgba(76, 184, 144, 0.05)', // Growth green with very low opacity
    borderColor: 'rgba(76, 184, 144, 0.15)',
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
    fontSize: 15,
    flex: 1,
    marginRight: 8,
    marginBottom: 4,
  },
  entryContent: {
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 8,
    marginLeft: 16,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(26, 60, 109, 0.1)',
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    letterSpacing: 0.1,
  },
  // Pagination styles
  paginationContainer: {
    width: '100%',
    paddingVertical: 1,
  },
  paginationButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 0,
    paddingTop: 10,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  paginationButtonText: {
    marginLeft: 2,
    fontSize: 11,
    fontFamily: Fonts.medium,
    lineHeight: 14,
  },
  showMoreButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  showMoreText: {
    color: Colors.alertCoral,
  },
  showLessButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  showLessText: {
    color: Colors.mediumGray,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginLeft: 16,
    paddingLeft: 16,
  },
  tag: {
    backgroundColor: 'rgba(26, 60, 109, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 10,
    color: Colors.anchorBlue,
    fontFamily: Fonts.medium,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 10,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
    marginLeft: 4,
  },
  entryDate: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 12,
    textAlign: 'right',
  },
  entryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  guidedPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  guidedPromptContainer: {
    backgroundColor: 'rgba(255, 81, 90, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  freeFormPromptContainer: {
    backgroundColor: 'rgba(76, 184, 144, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  freeFormPromptText: {
    fontSize: 8,
    color: Colors.growthGreen,
    fontFamily: Fonts.medium,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  freeFormPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  timeText: {
    fontSize: 10,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
  },
  guidedPromptText: {
    fontSize: 8,
    color: Colors.alertCoral,
    fontFamily: Fonts.medium,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  promptText: {
    fontFamily: Fonts.semiBold,
    color: Colors.anchorBlue,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 12,
    fontStyle: 'italic',
    letterSpacing: 0.1,
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
    marginBottom: 8,
  },
  contentInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  guidedInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  cancelButton: {
    // Removed as we're using JournalCard's built-in cancel button
  },
  disabledButton: {
    opacity: 0.5,
  },
  promptSelector: {
    marginBottom: 12,
  },
  promptLabel: {
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
    marginBottom: 4,
    fontSize: 14,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  selectedPrompt: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
    marginRight: 8,
  },
  promptModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  promptModalContent: {
    backgroundColor: Colors.hopeWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    padding: 16,
  },
  promptModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  promptModalTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    color: Colors.darkGray,
  },
  promptList: {
    maxHeight: '90%',
  },
  promptOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  selectedPromptOption: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  promptOptionText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
  },
  removeButton: {
    padding: 4,
  },
  emptyText: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginTop: 16,
  },
});

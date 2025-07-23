import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { NotebookPen as LuNotebookPen, X } from 'lucide-react-native';
import ReflectionLogEditor from './ReflectionLogEditor';
import { useAuth } from '../../context/AuthContext';
import {
  ReflectionLogEntry,
  saveReflectionEntries,
  loadReflectionEntries,
} from '../../storage/reflectionStorage';
import { toLocalDateString } from '../../utils/date';

type ViewMode = 'free-form' | 'guided';

export const GUIDED_PROMPTS = [
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
  'Am I allowing comparison to steal my joy and gratitude for what God has given me?',
];

interface ReflectionLogProps {
  selectedDate?: Date;
  refreshKey?: number; // Add refreshKey to trigger reload
}

export const ReflectionLog: React.FC<ReflectionLogProps> = ({ selectedDate = new Date(), refreshKey = 0 }) => {
  const [, setViewMode] = useState<ViewMode>('free-form');
  const [visibleCount, setVisibleCount] = useState<number>(3);
  const [entries, setEntries] = useState<ReflectionLogEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState('');

  const hydratedRef = useRef(false);
  const [newEntry, setNewEntry] = useState({
    id: '',
    title: '',
    content: '',
    tags: [] as string[],
    date: new Date(),
    type: 'free-form' as ViewMode,
    source: undefined as 'devotional' | undefined,
    prompt: undefined as string | undefined,
    location: undefined as string | undefined,
    devotionalTitle: undefined as string | undefined,
    dayNumber: undefined as number | undefined,
    dayTitle: undefined as string | undefined,
    totalDays: undefined as number | undefined,
    questionNumber: undefined as number | undefined,
    // Required database fields
    user_id: '',
    created_at: '',
    updated_at: '',
    selected_date: '',
  });
  const [selectedEntry, setSelectedEntry] = useState<ReflectionLogEntry | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);

  // Auth and date context
  const { user, loading: authLoading } = useAuth();
  const dateStr = toLocalDateString(selectedDate);
  const currentDate = selectedDate; // Keep for backward compatibility

  // Debug: Log when entries state changes
  useEffect(() => {
    console.log('ReflectionLog entries state changed:', entries.length, 'entries for date:', dateStr);
    entries.forEach((entry, index) => {
      console.log(`Entry ${index}:`, entry.title, entry.selected_date);
    });
  }, [entries, dateStr]);

  // Hydrate reflection entries from storage
  const hydrateReflectionEntries = useCallback(async () => {
    if (!user || hydratedRef.current) {
      return;
    }

    try {
      console.log('Hydrating reflection entries for date:', dateStr);
      const loadedEntries = await loadReflectionEntries(user.id, dateStr);

      // Debug: Check what we got from loadReflectionEntries
      console.log('loadedEntries type:', typeof loadedEntries);
      console.log('loadedEntries isArray:', Array.isArray(loadedEntries));
      console.log('loadedEntries:', loadedEntries);

      // Ensure we have an array
      if (!Array.isArray(loadedEntries)) {
        console.error('loadedEntries is not an array!', loadedEntries);
        setEntries([]);
        return;
      }

      // loadReflectionEntries already filters by selected_date, so no need for additional filtering
      // Just sort by date (newest first)
      const sortedEntries = loadedEntries.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setEntries(sortedEntries);
      hydratedRef.current = true;
    } catch (error) {
      console.error('Error hydrating reflection entries:', error);
      Alert.alert('Error', 'Failed to load reflection entries.');
    }
  }, [user, dateStr]);

  // Hydrate when user, date changes
  useEffect(() => {
    if (!authLoading && user) {
      // Clear entries state and reset hydration when date changes
      setEntries([]);
      hydratedRef.current = false;
      hydrateReflectionEntries();
    }
  }, [user, dateStr, authLoading, hydrateReflectionEntries]);

  // Handle refresh key changes
  useEffect(() => {
    if (!authLoading && user && refreshKey > 0) {
      console.log('RefreshKey changed, refreshing reflection entries...');
      hydratedRef.current = false;
      hydrateReflectionEntries();
    }
  }, [refreshKey, user, authLoading, hydrateReflectionEntries]);

  // Also reload entries when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!authLoading && user) {
        // Only reload if we haven't hydrated yet or if the date has changed
        // This prevents overriding local state updates after saving
        if (!hydratedRef.current) {
          hydrateReflectionEntries();
        }
      }
    }, [user, authLoading, hydrateReflectionEntries])
  );

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
                  prompt === selectedPrompt && styles.selectedPromptOption,
                ]}
                onPress={() => {
                  setSelectedPrompt(prompt);
                  setNewEntry(prev => ({
                    ...prev,
                    title: prompt,
                    type: 'guided',
                  }));
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
  const handleEntryPress = (entry: ReflectionLogEntry) => {
    // Set the selected entry for viewing/editing
    setSelectedEntry(entry);
    // Open the edit view with the selected entry's data in free-form mode
    setIsAdding(true);
    setViewMode('free-form'); // Always open in free-form mode
    setNewEntry({
      id: entry.id,
      title: entry.title || '',
      content: entry.content,
      date: entry.date,
      type: entry.type,
      source: entry.source,
      prompt: entry.prompt,
      tags: entry.tags || [],
      location: entry.location,
      devotionalTitle: (entry as any).devotionalTitle,
      dayNumber: (entry as any).dayNumber,
      dayTitle: (entry as any).dayTitle,
      totalDays: (entry as any).totalDays,
      questionNumber: (entry as any).questionNumber,
      // Required database fields
      user_id: entry.user_id,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      selected_date: entry.selected_date,
    });
  };

  const renderEntryCard = (entry: ReflectionLogEntry) => (
    <TouchableOpacity
      key={entry.id}
      style={[
        styles.entryCard,
        entry.source === 'devotional'
          ? styles.devotionalEntry
          : entry.type === 'guided'
            ? styles.guidedEntry
            : styles.freeFormEntry,
      ]}
      onPress={() => handleEntryPress(entry)}
      activeOpacity={0.8}
    >
      {entry.source === 'devotional' ? (
        <View style={styles.guidedPromptRow}>
          <View style={styles.devotionalPromptContainer}>
            <Text style={styles.devotionalPromptText}>DEVOTIONAL</Text>
          </View>
          <Text style={styles.timeText}>
            {new Date(entry.date).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </Text>
        </View>
      ) : entry.type === 'guided' && entry.prompt ? (
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
        <Text style={styles.promptCardText}>{entry.prompt}</Text>
      ) : entry.title ? (
        <Text style={[styles.promptCardText, styles.normalTitleText]}>{entry.title}</Text>
      ) : null}
      <Text
        style={styles.entryContent}
        numberOfLines={3}
        ellipsizeMode="tail"
      >
        {typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content)}
      </Text>
      {entry.tags && entry.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {entry.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );


  const renderEntries = () => {
    // Filter entries to only show those from the current date
    // Use selected_date for filtering instead of entry.date timestamp
    const filteredEntries = entries.filter(entry => {
      // If entry has selected_date, use that for filtering
      return entry.selected_date === dateStr;
    });

    if (filteredEntries.length === 0) {
      return null; // Return nothing if no entries for the current date
    }

    return (
      <>
        <View style={styles.entriesContainer}>
          {filteredEntries.slice(0, visibleCount).map((entry) => (
            <React.Fragment key={entry.id}>
              {renderEntryCard(entry)}
            </React.Fragment>
          ))}
        </View>
        {(filteredEntries.length > visibleCount || visibleCount > 3) && (
          <View style={styles.paginationContainer}>
            <View style={styles.paginationButtonGroup}>
              {filteredEntries.length > visibleCount && (
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

        {/* Entry Detail Modal */}
        <Modal
          visible={showEntryModal}
          transparent={true}
          animationType="slide"
          statusBarTranslucent={true}
          onRequestClose={() => setShowEntryModal(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalOverlayTouchable}
              activeOpacity={1}
              onPress={() => setShowEntryModal(false)}
            />
            <View style={styles.modalContainer}>
              <View style={styles.modalHandle} />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowEntryModal(false)}
              >
                <X size={24} color={Colors.mediumGray} />
              </TouchableOpacity>

              {selectedEntry && (
                <ScrollView
                  style={styles.modalContent}
                  contentContainerStyle={styles.modalContentContainer}
                  showsVerticalScrollIndicator={true}
                >
                  <View style={[
                    styles.entryCard,
                    styles.modalEntryCard,
                    selectedEntry.type === 'guided' ? styles.guidedEntry : styles.freeFormEntry,
                  ]}>
                    {selectedEntry.type === 'guided' && selectedEntry.prompt ? (
                      <View style={styles.guidedPromptRow}>
                        <View style={styles.guidedPromptContainer}>
                          <Text style={styles.guidedPromptText}>GUIDED PROMPT</Text>
                        </View>
                        <Text style={styles.timeText}>
                          {new Date(selectedEntry.date).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.freeFormPromptRow}>
                        <View style={styles.freeFormPromptContainer}>
                          <Text style={styles.freeFormPromptText}>FREE FORM</Text>
                        </View>
                        <Text style={styles.timeText}>
                          {new Date(selectedEntry.date).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </Text>
                      </View>
                    )}

                    {selectedEntry.type === 'guided' && selectedEntry.prompt && (
                      <Text style={[styles.promptCardText, styles.modalPromptText]}>
                        {selectedEntry.prompt}
                      </Text>
                    )}

                    {selectedEntry.title && (
                      <Text style={[styles.modalTitle, selectedEntry.type !== 'guided' && styles.normalTitleText]}>
                        {selectedEntry.title}
                      </Text>
                    )}

                    <Text style={styles.modalContentText}>
                      {typeof selectedEntry.content === 'string' ? selectedEntry.content : JSON.stringify(selectedEntry.content)}
                    </Text>

                    {selectedEntry.tags && selectedEntry.tags.length > 0 && (
                      <View style={styles.tagsContainer}>
                        {selectedEntry.tags.map((tag, index) => (
                          <View key={index} style={styles.tag}>
                            <Text style={styles.tagText}>#{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {selectedEntry.location && (
                      <View style={styles.locationContainer}>
                        <Ionicons name="location-outline" size={16} color={Colors.mediumGray} />
                        <Text style={styles.locationText}>{selectedEntry.location}</Text>
                      </View>
                    )}
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </>
    );
  };

  const formatDate = (date: Date = currentDate) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const titleInputRef = useRef<TextInput>(null);

  const handleSaveEntry = async (entryData: {
    title: string;
    content: string;
    tags: string[];
    type?: ViewMode;
    prompt?: string;
    source?: 'devotional' | string;
    devotionalTitle?: string;
    dayNumber?: number;
    dayTitle?: string;
    totalDays?: number;
    questionNumber?: number;
  }) => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    try {
      const newEntryData: ReflectionLogEntry = {
        id: Date.now().toString(),
        title: entryData.title,
        content: entryData.content,
        date: new Date(),
        type: entryData.type || (selectedPrompt ? 'guided' : 'free-form') as ViewMode,
        source: entryData.source === 'devotional' ? 'devotional' as const : undefined,
        prompt: entryData.prompt || selectedPrompt || undefined,
        tags: entryData.tags || [],
        location: undefined,
        // Include devotional metadata if available
        ...(entryData.devotionalTitle && { devotionalTitle: entryData.devotionalTitle }),
        ...(entryData.dayNumber !== undefined && { dayNumber: entryData.dayNumber }),
        ...(entryData.dayTitle && { dayTitle: entryData.dayTitle }),
        ...(entryData.totalDays !== undefined && { totalDays: entryData.totalDays }),
        ...(entryData.questionNumber !== undefined && { questionNumber: entryData.questionNumber }),
        // Required database fields
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        selected_date: dateStr,
      };

      // Save to storage using the proper storage functions
      // Filter existing entries to only include entries from the current date
      const currentDateEntries = entries.filter(entry => entry.selected_date === dateStr);
      const updatedEntries = [newEntryData, ...currentDateEntries];
      await saveReflectionEntries(user.id, dateStr, updatedEntries);

      // Update local state immediately
      setEntries(updatedEntries);
      console.log('Entry saved and local state updated:', newEntryData.title);
      console.log('Updated entries count:', updatedEntries.length);
      console.log('Current entries state will be:', updatedEntries.map(e => ({ id: e.id, title: e.title })));

      setNewEntry({
        id: '',
        title: '',
        content: '',
        date: new Date(),
        type: 'free-form',
        tags: [],
        source: undefined,
        prompt: undefined,
        devotionalTitle: undefined,
        dayNumber: undefined,
        dayTitle: undefined,
        totalDays: undefined,
        questionNumber: undefined,
        location: undefined,
        // Required database fields
        user_id: '',
        created_at: '',
        updated_at: '',
        selected_date: '',
      });
      setSelectedPrompt('');
      setIsAdding(false);

      // Don't trigger refresh immediately after saving to prevent overriding local state
      // The local state update should be sufficient for immediate UI feedback
      // if (onEntryAdded) {
      //   setTimeout(() => {
      //     onEntryAdded();
      //   }, 50);
      // }
    } catch (error) {
      console.error('Failed to save entry:', error);
    }
  };

  // Focus the title input when the form is shown
  useEffect(() => {
    if (isAdding) {
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [isAdding]);

  const renderEntryForm = () => {
    const isGuided = !!selectedPrompt;
    const entryTitle = selectedPrompt || newEntry.title;
    const editorKey = selectedPrompt || 'free';

    // Check if this is a devotional entry being edited
    const isDevotionalEntry = newEntry.source === 'devotional';

    // Create a clean entry object for the editor
    const cleanEntry = {
      id: newEntry.id,
      title: newEntry.title,
      content: newEntry.content,
      tags: newEntry.tags || [],
      date: newEntry.date,
      type: newEntry.type,
      source: newEntry.source,
      prompt: newEntry.prompt,
    };

    // Devotional metadata is passed directly to the component props below

    return (
      <ReflectionLogEditor
        key={editorKey}
        onSave={async (entryData: any) => {
          if (!user) {
            console.error('User not authenticated');
            return;
          }

          if (newEntry.id) {
            // Update existing entry
            try {
              // Filter entries to only include current date entries before updating
              const currentDateEntries = entries.filter(entry => entry.selected_date === dateStr);
              const updatedEntries = currentDateEntries.map(e => {
                if (e.id === newEntry.id) {
                  const updatedEntry: ReflectionLogEntry = {
                    ...e,
                    title: entryData.title,
                    content: entryData.content,
                    tags: entryData.tags || [],
                    type: (entryData.type || e.type) as ViewMode,
                    source: entryData.source === 'devotional' ? 'devotional' as const : e.source,
                    prompt: entryData.prompt || e.prompt,
                    // Preserve devotional metadata
                    ...(isDevotionalEntry && {
                      devotionalTitle: entryData.devotionalTitle || newEntry.devotionalTitle,
                      dayNumber: entryData.dayNumber ?? newEntry.dayNumber,
                      dayTitle: entryData.dayTitle || newEntry.dayTitle,
                      totalDays: entryData.totalDays ?? newEntry.totalDays,
                      questionNumber: entryData.questionNumber ?? newEntry.questionNumber,
                    }),
                  };
                  return updatedEntry;
                }
                return e;
              });
              await saveReflectionEntries(user.id, dateStr, updatedEntries);
              setEntries(updatedEntries);

              // Don't trigger refresh immediately after updating to prevent overriding local state
              // The local state update should be sufficient for immediate UI feedback
              // if (onEntryAdded) {
              //   setTimeout(() => {
              //     onEntryAdded();
              //   }, 50);
              // }
            } catch (error) {
              console.error('Failed to update entry:', error);
            }
          } else {
            // Create new entry
            await handleSaveEntry({
              ...entryData,
              type: (entryData.type || (selectedPrompt ? 'guided' : 'free-form')) as ViewMode,
              source: entryData.source || (isDevotionalEntry ? 'devotional' as const : undefined),
              // Include devotional metadata if available
              ...(isDevotionalEntry && {
                devotionalTitle: entryData.devotionalTitle,
                dayNumber: entryData.dayNumber,
                dayTitle: entryData.dayTitle,
                totalDays: entryData.totalDays,
                questionNumber: entryData.questionNumber,
              }),
            });
          }
          setSelectedPrompt('');
          setIsAdding(false);
        }}
        onCancel={() => {
          setSelectedPrompt('');
          setIsAdding(false);
        }}
        initialEntry={cleanEntry}
        initialMode={isGuided ? 'guided' : newEntry.type || 'free-form'}
        initialPrompt={selectedPrompt || newEntry.prompt || ''}
        dateString={formatDate()}
        initialTitle={entryTitle}
        lockTitle={isGuided}
        source={isGuided ? 'guided' : isDevotionalEntry ? 'devotional' : 'freeform'}
        styles={styles}
        // Pass devotional metadata to the editor if available
        {...(isDevotionalEntry ? {
          devotionalTitle: newEntry.devotionalTitle,
          dayNumber: newEntry.dayNumber,
          dayTitle: newEntry.dayTitle,
          totalDays: newEntry.totalDays,
          questionNumber: newEntry.questionNumber,
        } : {})}
      />
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
      subtitle={entries.length > 0 ? `${entries.length} reflections` : 'No reflections yet'}
      showAddButton={true}
      onAdd={() => {
        setNewEntry({
        id: '',
        title: '',
        content: '',
        date: new Date(),
        type: 'free-form',
        tags: [],
        source: undefined,
        prompt: undefined,
        location: undefined,
        devotionalTitle: undefined,
        dayNumber: undefined,
        dayTitle: undefined,
        totalDays: undefined,
        questionNumber: undefined,
        // Required database fields
        user_id: '',
        created_at: '',
        updated_at: '',
        selected_date: '',
      });
        setSelectedPrompt('');  // Clear any selected prompt
        setViewMode('free-form');
        setIsAdding(true);
      }}
    >
      {/* Entries List */}
      {renderEntries()}

      {/* Add/Edit Entry Modal */}
      <Modal
        visible={isAdding}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsAdding(false)}
      >
        {renderEntryForm()}
      </Modal>

      {/* Prompt Picker Modal */}
      {renderPromptPicker()}
    </JournalCard>
  );
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  backgroundContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.anchorBlue,
  },

  keyboardAvoidingView: {
    flex: 1,
  },
  // Content container styles moved below to avoid duplication
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80, // Reduced padding since we're handling keyboard differently
  },
  addMenu: {
    position: 'absolute',
    bottom: 52,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 8,
    minWidth: 120,
    zIndex: 20,
  },
  addMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  addMenuText: {
    color: Colors.hopeWhite,
    marginLeft: 12,
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  bottomButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 0,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.anchorBlue,
    position: 'relative',
    bottom: 0,
    left: 0,
    right: 0,
    // Shadow removed as per request
  },

  // FAB styles
  fabWrapper: {
    position: 'relative',
    width: '100%',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 10,
  },
  leftFabContainer: {
    left: 16,
    right: 'auto',
    alignItems: 'flex-start',
  },
  fabRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabDefaultPosition: {
    bottom: 16,
  },
  androidFabWithKeyboard: {
    bottom: 4, // This will be overridden by the dynamic style
  },
  cancelFab: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  addFab: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  saveFab: {
    backgroundColor: Colors.alertCoral,
  },
  fabDisabled: {
    opacity: 0.5,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: '100%',
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.mediumGray,
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
    fontSize: 14,
  },
  saveButtonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.anchorBlue,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: Colors.anchorBlue,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Full screen styles
  fullScreenContainer: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50, // Increased top padding
    paddingHorizontal: 16,
    paddingBottom: 0,
    zIndex: 10, // Ensure header stays above background
    backgroundColor: Colors.hopeWhite,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 8,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 4,
    alignItems: 'center',
  },
  modeButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 0,
  },
  headerSaveButton: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerSaveButtonText: {
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  contentCard: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  freeFormContainer: {
    flex: 1,
  },
  guidedContainer: {
    flex: 1,
  },
  guidedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.darkGray,
    marginBottom: 16,
  },
  promptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  promptCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    minHeight: 160,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
  },
  promptCardText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'left',
    marginBottom: 16,
    fontWeight: '500',
    letterSpacing: 0.15,
    width: '100%',
  },
  reflectLabel: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignSelf: 'flex-start',
    marginTop: 'auto',
    minWidth: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reflectLabelText: {
    color: Colors.hopeWhite,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  entryInput: {
    backgroundColor: 'transparent',
    padding: 0,
    color: Colors.hopeWhite,
    borderWidth: 0,
    borderBottomWidth: 0,
    includeFontPadding: false,
    textAlignVertical: 'top',
  } as const,
  entryGuidedInput: {
    marginTop: 8,
    minHeight: 200,
    backgroundColor: 'transparent',
    padding: 0,
    color: Colors.hopeWhite,
    borderWidth: 0,
    borderBottomWidth: 0,
    includeFontPadding: false,
    textAlignVertical: 'top',
  } as const,
  titleInput: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
    color: Colors.hopeWhite,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderBottomWidth: 0,
    padding: 0,
  },
  entryContentInput: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderBottomWidth: 0,
    padding: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.semiBold,
    color: Colors.darkGray,
    marginBottom: 12,
  },
  modalContent: {
    flex: 1,
    width: '100%',
  },
  modalContentContainer: {
    paddingBottom: 40, // Add some bottom padding to ensure content isn't cut off
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    backgroundColor: Colors.hopeWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
    padding: 16,
    paddingTop: 16,
    paddingBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.lightGray,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },

  devotionalEntry: {
    backgroundColor: 'rgba(245, 166, 35, 0.05)',
    borderColor: 'rgba(245, 166, 35, 0.15)',
    borderWidth: 0.5,
  },
  devotionalPromptContainer: {
    backgroundColor: 'rgba(245, 166, 35, 0.1)', // 10% opacity faithGold
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  devotionalPromptText: {
    fontSize: 8,
    color: Colors.faithGold,
    fontFamily: Fonts.medium,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  modalEntryCard: {
    padding: 16,
    marginBottom: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalPromptText: {
    fontSize: 16,
    color: Colors.mediumGray,
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 12,
  },
  modalContentText: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.darkGray,
    marginBottom: 16,
  },

  // Button styles
  // These styles are now consolidated at the top of the styles object
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
    padding: 0,
    width: '100%',
  },

  // Toggle styles
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
  toggleTextWithMargin: {
    marginLeft: 4,
  },

  // Entry list styles
  entriesContainer: {
    width: '100%',
  },
  entryCard: {
    backgroundColor: 'rgba(26, 60, 109, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.1)',
  },
  guidedEntry: {
    backgroundColor: 'rgba(255, 107, 107, 0.05)',
    borderColor: 'rgba(255, 107, 107, 0.15)',
  },
  freeFormEntry: {
    backgroundColor: 'rgba(76, 184, 144, 0.05)',
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
  },

  // Prompt styles
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
  guidedPromptText: {
    fontSize: 8,
    color: Colors.alertCoral,
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
  timeText: {
    fontSize: 10,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
  },
  // This style is now defined as promptCardText to avoid duplicate style keys
  normalTitleText: {
    fontStyle: 'normal',
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

  // Meta and tags
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginLeft: 16,
    paddingLeft: 16,
  },
  // Tags container for the entry card
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 2,
  },
  // Tag style - defined once and used throughout the component
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 60, 109, 0.05)',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginLeft: 4,
    marginBottom: 4,
    height: 20,
  },
  // Tag text style - defined once and used throughout the component
  tagText: {
    fontSize: 8,
    color: Colors.anchorBlue,
    fontFamily: Fonts.medium,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Location container style
  location: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Location text style - defined once and used throughout the component
  locationText: {
    marginLeft: 6,
    color: Colors.mediumGray,
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  // Form styles
  addForm: {
    marginTop: 8,
  },
  // This style is now defined as entryInput to avoid duplicate style keys
  transparentInput: {
    backgroundColor: 'transparent',
    color: Colors.hopeWhite,
    borderWidth: 0,
    borderBottomWidth: 0,
    outlineWidth: 0,
  },
  // These styles are now defined as entryContentInput and entryGuidedInput
  // to avoid duplicate style keys
  // Prompt selector styles
  promptSelector: {
    marginBottom: 16,
    width: '100%',
  },
  promptLabel: {
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
    marginBottom: 8,
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
    minHeight: 44, // Enhanced touch area
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
    paddingHorizontal: 16,
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
    color: Colors.mediumGray,
    textAlign: 'center',
    marginTop: 20,
    fontFamily: Fonts.regular,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  modalOverlayTouchable: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  // Tags container for the modal view
  modalTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 16,
    alignItems: 'center',
    gap: 8,
  },
  // Tag input container style - used for the tag input field
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    minWidth: 100,
  },
  tagInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    padding: 0,
    minWidth: 80,
  },
  addTagButton: {
    marginLeft: 4,
  },
  // locationContainer style is defined above with more specific properties
});

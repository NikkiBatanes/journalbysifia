import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, ScrollView, StyleSheet, Platform, KeyboardAvoidingView, Keyboard } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { NotebookPen as LuNotebookPen, X } from 'lucide-react-native';
import ReflectionLogEditor from './ReflectionLogEditor';
import { styles as reflectionLogStyles } from './ReflectionLog';
import { useAuth } from '../../context/AuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  useReflectionData,
  useCreateReflection,
  useUpdateReflection,
  useDeleteReflection,
} from '../../services/hooks/useReflectionData';
import { ReflectionSkeleton } from '../SkeletonLoader/ReflectionSkeleton';
import { analytics } from '../../utils/analytics';
import { QueryErrorBoundary } from '../ErrorBoundary/QueryErrorBoundary';

type ViewMode = 'free' | 'guided';

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

interface ReflectionLogEntry {
  id: string;
  title: string;
  content: string;
  type: ViewMode;
  source?: 'devotional';
  prompt?: string;
  tags: string[];
  location?: string;
  devotionalTitle?: string;
  dayNumber?: number;
  dayTitle?: string;
  totalDays?: number;
  questionNumber?: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  selected_date: string;
}

interface ReflectionLogProps {
  selectedDate?: Date;
  refreshKey?: number;
}

export const ReflectionLogReactQuery: React.FC<ReflectionLogProps> = ({ selectedDate = new Date() }) => {
  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);
  const loadStartTime = useRef(Date.now());
  // const [retryCount, setRetryCount] = useState(0); // Unused

  // React Query hooks with enhanced error handling
  const {
    data: reflectionEntries = [],
    isLoading,
    error,
    refetch,
    // isRefetching, // Unused
  } = useReflectionData(user?.id || '', dateStr);

  const createMutation = useCreateReflection();
  const updateMutation = useUpdateReflection();
  const deleteMutation = useDeleteReflection();

  // Transform API data to local format with memoization
  const entries: ReflectionLogEntry[] = React.useMemo(() =>
    reflectionEntries.map(entry => ({
      id: entry.id,
      title: entry.title,
      content: entry.content,
      type: entry.type,
      source: entry.source,
      prompt: undefined, // Prompt not stored in database
      tags: [], // Tags would need to be parsed from content or stored separately
      location: undefined,
      devotionalTitle: entry.devotional_title,
      dayNumber: entry.day_number,
      dayTitle: entry.day_title,
      totalDays: entry.total_days,
      questionNumber: entry.question_number,
      user_id: entry.user_id,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      selected_date: entry.selected_date,
    })), [reflectionEntries]
  );

  // Analytics tracking for load performance
  useEffect(() => {
    if (!isLoading && reflectionEntries.length >= 0) {
      const loadTime = Date.now() - loadStartTime.current;
      analytics.trackReflectionEvent('reflection_loaded', {
        entries_count: reflectionEntries.length,
        load_time_ms: loadTime,
        date: dateStr,
      }, user?.id);
    }
  }, [isLoading, reflectionEntries.length, dateStr, user?.id]);

  // Local state
  const [visibleCount, setVisibleCount] = useState(3);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState('');
  // const [selectedEntry, setSelectedEntry] = useState<ReflectionLogEntry | null>(null); // Unused
  // const [showEntryModal, setShowEntryModal] = useState(false); // Unused
  const [newEntry, setNewEntry] = useState({
    title: '',
    content: '',
    type: 'free' as ViewMode,
    prompt: '',
    tags: [] as string[],
    location: '',
    source: undefined as string | undefined,
  });

  const resetForm = useCallback(() => {
    setNewEntry({
      title: '',
      content: '',
      type: 'free',
      prompt: '',
      tags: [],
      location: '',
      source: undefined,
    });
    setSelectedPrompt('');
    setIsAdding(false);
    setEditingId(null);
  }, []);

  const handleDeleteEntry = useCallback(async (entryId: string) => {
    const entryToDelete = entries.find(e => e.id === entryId);

    Alert.alert(
      'Delete Reflection',
      'Are you sure you want to delete this reflection entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            console.log('🔍 ReflectionLog: Deleting entry', entryId);
            const startTime = Date.now();

            try {
              await deleteMutation.mutateAsync(entryId);

              console.log('🔍 ReflectionLog: Entry deleted successfully in', Date.now() - startTime, 'ms');

              // Track deletion analytics
              if (entryToDelete && user) {
                analytics.trackReflectionEvent('reflection_deleted', {
                  reflection_id: entryId,
                  title_length: entryToDelete.title.length,
                  content_length: entryToDelete.content.length,
                  type: entryToDelete.type,
                  date: dateStr,
                }, user.id);
              }
            } catch (deleteError) {
              console.error('🔍 ReflectionLog: Error deleting reflection entry:', deleteError);

              // Track error analytics
              if (user) {
                analytics.trackReflectionEvent('reflection_error', {
                  error_type: 'delete_failed',
                  operation: 'delete',
                  date: dateStr,
                }, user.id);
              }

              Alert.alert(
                'Error',
                'Failed to delete reflection entry. Please check your connection and try again.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Retry', onPress: () => handleDeleteEntry(entryId) },
                ]
              );
            }
          },
        },
      ]
    );
  }, [entries, deleteMutation, user, dateStr]);

  // handleEntryPress removed - not used in original design

  // startAdding removed - not used in original design

  // Handle prompt selection with analytics
  const handlePromptSelection = useCallback((prompt: string) => {
    setSelectedPrompt(prompt);
    setNewEntry(prev => ({ ...prev, prompt, type: 'guided' }));
    setShowPromptPicker(false);

    // Track prompt selection analytics
    if (user) {
      analytics.trackReflectionEvent('reflection_prompt_selected', {
        prompt_text: prompt,
        date: dateStr,
      }, user.id);
    }
  }, [user, dateStr]);

  // handleTypeChange removed - using ReflectionLogEditor instead

  // formatDate removed - not used in original design

  const renderPromptPicker = () => (
    <Modal
      visible={showPromptPicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowPromptPicker(false)}
    >
      <View style={styles.promptModalContainer}>
        <View style={styles.promptModalContent}>
          <View style={styles.promptModalHeader}>
            <Text style={styles.promptModalTitle}>Select a Prompt</Text>
            <TouchableOpacity onPress={() => setShowPromptPicker(false)}>
              <X size={24} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.promptList}>
            {GUIDED_PROMPTS.map((prompt, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.promptOption,
                  selectedPrompt === prompt && styles.selectedPromptOption,
                ]}
                onPress={() => handlePromptSelection(prompt)}
              >
                <Text style={styles.promptOptionText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderEntries = () => {
    if (isLoading) {
      return <ReflectionSkeleton />;
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Failed to load reflections</Text>
          <Text style={styles.errorMessage}>
            {error.message || 'Something went wrong. Please try again.'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              console.log('🔄 User retrying reflection fetch');
              analytics.trackReflectionEvent('reflection_error', {
                error_type: error.message || 'Unknown error',
                operation: 'fetch',
                date: dateStr,
              });
              refetch();
            }}
          >
            <Ionicons name="refresh" size={16} color={Colors.hopeWhite} style={styles.spinning} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Debug logging
    console.log('🔍 ReflectionLog Debug:', {
      totalEntries: entries.length,
      currentDate: dateStr,
      entriesData: entries.map(e => ({ id: e.id, date: e.selected_date, title: e.title })),
    });

    // Filter entries to only show those from the current date
    const filteredEntries = entries.filter(entry => {
      return entry.selected_date === dateStr;
    });

    console.log('🔍 Filtered entries for date:', dateStr, 'count:', filteredEntries.length);

    // Show empty state instead of returning null
    if (filteredEntries.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No reflections for this date</Text>
          <Text style={styles.emptySubtext}>Tap the + button to add your first reflection</Text>
        </View>
      );
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
                  onPress={() => setVisibleCount(prev => Math.min(prev + 3, filteredEntries.length))}
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
      activeOpacity={0.8}
    >
      {entry.source === 'devotional' ? (
        <View style={styles.guidedPromptRow}>
          <View style={styles.devotionalPromptContainer}>
            <Text style={styles.devotionalPromptText}>DEVOTIONAL</Text>
          </View>
          <Text style={styles.timeText}>
            {new Date(entry.created_at).toLocaleTimeString('en-US', {
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
            {new Date(entry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </Text>
        </View>
      ) : (
        <View style={styles.freeFormPromptRow}>
          <View style={styles.freeFormPromptContainer}>
            <Text style={styles.freeFormPromptText}>FREE FORM</Text>
          </View>
          <Text style={styles.timeText}>
            {new Date(entry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
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
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );

  // renderEntryForm removed - using ReflectionLogEditor instead

  // renderEntryModal removed - not used in original design

  React.useEffect(() => {
    if (error) {
      Alert.alert('Error', 'Failed to load reflection entries.');
    }
  }, [error]);

  // handleRetry removed - not used in original design

  // Loading state with skeleton
  if (isLoading) {
    return (
      <QueryErrorBoundary>
        <JournalCard
          icon={<LuNotebookPen size={24} color={Colors.anchorBlue} strokeWidth={2.5} />}
          title="Reflection Log"
          subtitle="Loading your reflections..."
          showAddButton={false}
          onAdd={() => {}}
          isAdding={false}
        >
          <ReflectionSkeleton count={3} />
        </JournalCard>
      </QueryErrorBoundary>
    );
  }

  // Error state with retry option
  if (error) {
    return (
      <JournalCard
        icon={<LuNotebookPen size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
        title="Reflection Log"
        subtitle="Unable to load reflections"
        showAddButton={false}
        onAdd={() => {}}
      >
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Failed to load reflections</Text>
          <Text style={styles.errorMessage}>
            {error.message || 'Something went wrong. Please try again.'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              console.log('🔄 User retrying reflection fetch');
              analytics.trackReflectionEvent('reflection_error', {
                error_type: error.message || 'Unknown error',
                operation: 'retry',
                date: dateStr,
              });
              refetch();
            }}
          >
            <Ionicons name="refresh" size={16} color={Colors.hopeWhite} style={styles.spinning} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </JournalCard>
    );
  }

  return (
    <QueryErrorBoundary>
      <JournalCard
        icon={<LuNotebookPen size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
        title="Reflection Log"
        subtitle={entries && entries.length > 0 ? `${entries.length} reflections` : 'No reflections yet'}
        showAddButton={true}
        onAdd={() => {
          setNewEntry({
            title: '',
            content: '',
            type: 'free',
            prompt: '',
            tags: [],
            location: '',
            source: undefined,
          });
          setSelectedPrompt('');
          setIsAdding(true);
          setEditingId(null);
        }}
      >
      {/* Entries List */}
      {renderEntries()}

      {/* Add/Edit Entry Modal */}
      <Modal
        visible={isAdding}
        animationType="slide"
        transparent
        onRequestClose={() => {
          Keyboard.dismiss();
          // Small delay to ensure keyboard is fully dismissed before closing
          setTimeout(() => {
            resetForm();
            setIsAdding(false);
          }, 10);
        }}
      >
        <KeyboardAvoidingView
          style={modalStyles.centeredView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={modalStyles.modalView}>
            {isAdding && (
              <ReflectionLogEditor
            onSave={async (entryData: any) => {
              if (!user) {
                console.error('User not authenticated');
                return;
              }

              try {
                // Only include fields that exist in the database schema
                const saveData = {
                  title: entryData.title,
                  content: entryData.content,
                  type: entryData.type || newEntry.type || 'free',
                  user_id: user.id,
                  selected_date: dateStr,
                };

                console.log('🔍 Saving reflection with data:', saveData);

                if (editingId) {
                  // Update existing entry
                  await updateMutation.mutateAsync({ id: editingId, updates: saveData });

                  // Track update analytics
                  const existingEntry = entries.find(e => e.id === editingId);
                  analytics.trackReflectionEvent('reflection_updated', {
                    reflection_id: editingId,
                    title_length: saveData.title.length,
                    content_length: saveData.content.length,
                    previous_title_length: existingEntry?.title.length || 0,
                    previous_content_length: existingEntry?.content.length || 0,
                    type: saveData.type as 'free' | 'guided',
                    date: dateStr,
                  }, user.id);
                } else {
                  // Create new entry
                  const result = await createMutation.mutateAsync(saveData);
                  console.log('🔍 Created reflection result:', result);

                  // Track creation analytics
                  analytics.trackReflectionEvent('reflection_created', {
                    title_length: saveData.title.length,
                    content_length: saveData.content.length,
                    type: saveData.type,
                    has_prompt: Boolean(entryData.prompt || selectedPrompt),
                    date: dateStr,
                  }, user.id);
                }

                console.log('🔍 ReflectionLog: Entry saved successfully');
                
                // Force refetch to ensure UI updates immediately
                await refetch();
                console.log('🔍 ReflectionLog: Data refetched after save');
              } catch (saveError) {
                console.error('🔍 ReflectionLog: Save failed:', saveError);
                Alert.alert('Error', 'Failed to save reflection entry. Please try again.');
                return; // Don't close the modal if save failed
              }

              // Reset form and close modal on successful save
              resetForm();
              setIsAdding(false);
            }}
            onCancel={() => {
              resetForm();
              setIsAdding(false);
            }}
            initialEntry={{
              title: newEntry.title,
              content: newEntry.content,
              tags: newEntry.tags || [],
              type: newEntry.type === 'free' ? 'free-form' : newEntry.type,
              source: newEntry.source,
              prompt: newEntry.prompt,
            }}
            initialMode={selectedPrompt ? 'guided' : (newEntry.type === 'guided' ? 'guided' : 'free-form')}
            initialPrompt={selectedPrompt || newEntry.prompt || ''}
            initialTitle={selectedPrompt || newEntry.title}
            lockTitle={Boolean(selectedPrompt)}
            source={selectedPrompt ? 'guided' : 'freeform'}
            styles={reflectionLogStyles}
            dateString={(function() {
              const now = new Date();
              const year = now.getFullYear();
              const todayString = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
              const todayStringWithYear = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
              return year === new Date().getFullYear() ? todayString : todayStringWithYear;
            })()}
          />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Prompt Picker Modal */}
      {renderPromptPicker()}
    </JournalCard>
    </QueryErrorBoundary>
  );
};

const styles = StyleSheet.create({
  loadingText: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 13,
    textAlign: 'center',
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontFamily: Fonts.medium,
    color: Colors.mediumGray,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  showMoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  showMoreText: {
    fontFamily: Fonts.medium,
    color: Colors.anchorBlue,
    fontSize: 13,
  },
  entryCard: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.alertCoral,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.darkGray,
    flex: 1,
    marginRight: 8,
  },
  entryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
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
  entryMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryType: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.anchorBlue,
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  entryDate: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.mediumGray,
  },
  entryPrompt: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.mediumGray,
    fontStyle: 'italic',
    marginTop: 4,
  },
  addForm: {
    marginTop: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    padding: 2,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: Colors.hopeWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeButtonText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.mediumGray,
  },
  typeButtonTextActive: {
    color: Colors.darkGray,
  },
  promptSelector: {
    marginBottom: 16,
  },
  promptLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.darkGray,
    marginBottom: 8,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
  },
  selectedPrompt: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
    marginRight: 8,
  },
  placeholderText: {
    color: Colors.mediumGray,
    fontStyle: 'italic',
  },
  input: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    minHeight: 40,
  },
  contentInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  cancelButton: {
    backgroundColor: Colors.mediumGray,
  },
  disabledButton: {
    opacity: 0.5,
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
  },
  promptModalTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    color: Colors.darkGray,
  },
  promptList: {
    maxHeight: 400,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  modalTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.darkGray,
    flex: 1,
    marginRight: 8,
  },
  modalBody: {
    flex: 1,
  },
  promptContainer: {
    backgroundColor: 'rgba(26, 60, 109, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  promptText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.anchorBlue,
    fontStyle: 'italic',
  },
  modalContentText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  modalMetaText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
  },
  // Error handling styles
  errorContainer: {
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.darkGray,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.anchorBlue,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  retryButtonText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  spinning: {
    // Add rotation animation if needed
    opacity: 0.7,
  },
  // Original layout styles
  devotionalEntry: {
    backgroundColor: 'rgba(245, 166, 35, 0.05)',
    borderColor: 'rgba(245, 166, 35, 0.15)',
    borderWidth: 0.5,
  },
  guidedEntry: {
    backgroundColor: 'rgba(255, 107, 107, 0.05)',
    borderColor: 'rgba(255, 107, 107, 0.15)',
  },
  freeFormEntry: {
    backgroundColor: 'rgba(76, 184, 144, 0.05)',
    borderColor: 'rgba(76, 184, 144, 0.15)',
  },
  guidedPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  devotionalPromptContainer: {
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
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
  normalTitleText: {
    fontStyle: 'normal',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 2,
  },
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
  tagText: {
    fontSize: 8,
    color: Colors.anchorBlue,
    fontFamily: Fonts.medium,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Entry list styles
  entriesContainer: {
    width: '100%',
  },
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
  showLessButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  showLessText: {
    color: Colors.mediumGray,
  },
});

// Modal styles for the white background modal
const modalStyles = StyleSheet.create({
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

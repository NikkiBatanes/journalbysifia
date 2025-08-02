import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, ScrollView, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { NotebookPen as LuNotebookPen, X, Pencil } from 'lucide-react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';

import ReflectionLogEditor from './ReflectionLogEditor';
import { styles as reflectionLogStyles } from './reflectionStyles';
import { GUIDED_PROMPTS } from './reflectionConstants';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import {
  useReflectionData,
  useCreateReflection,
  useUpdateReflection,
  useDeleteReflection,
} from '../../services/hooks/useReflectionData';
import { ReflectionSkeleton } from '../SkeletonLoader/ReflectionSkeleton';
import { toLocalDateString } from '../../utils/date';
import { analytics } from '../../utils/analytics';


type ViewMode = 'free' | 'guided' | 'devotional' | 'playbook';

interface ReflectionLogEntry {
  id: string;
  title: string;
  content: string;
  type: ViewMode;
  source?: 'devotional' | 'playbook';
  prompt?: string;
  tags: string[];
  location?: string;
  devotional_title?: string;
  day_number?: number;
  day_title?: string;
  total_days?: number;
  question_number?: number;
  // Playbook-specific fields
  playbook_title?: string;
  playbook_id?: string;
  subtask_id?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  selected_date: string;
}

interface ReflectionLogProps {
  selectedDate?: Date;
  refreshKey?: number;
  viewMode?: 'carousel' | 'inline' | 'moments';
  expanded?: boolean;
  onExpand?: () => void;
}

export const ReflectionLogReactQuery: React.FC<ReflectionLogProps> = ({ selectedDate = new Date(), viewMode, expanded, onExpand }) => {
  // Global edit mode context (only for inline view)
  // Global edit mode context - safe version that handles missing provider
  const globalEditMode = useEditModeSafe();


  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);

  // Generate a meaningful subtitle based on the number of entries
  const getReflectionSubtitle = (count: number): string => {
    if (count === 0) {return 'Start reflecting today';}
    if (count === 1) {return '1 reflection today';}
    if (count < 5) {return `${count} reflections today`;}
    return `You've shared ${count} reflections today`;
  };

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
      title: entry.title || '', // Handle optional title from API
      content: entry.content,
      type: entry.type as ViewMode,
      source: entry.source as 'devotional' | undefined,
      prompt: entry.prompt, // Use prompt from API
      tags: entry.tags || [], // Use tags from API or empty array
      location: undefined,
      devotional_title: entry.devotional_title,
      day_number: entry.day_number,
      day_title: entry.day_title,
      total_days: entry.total_days,
      question_number: entry.question_number,
      // Playbook-specific fields
      playbook_title: entry.playbook_title,
      playbook_id: entry.playbook_id,
      subtask_id: entry.subtask_id,
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
  const [selectedEntry, setSelectedEntry] = useState<ReflectionLogEntry | null>(null);
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
    setSelectedEntry(null);
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
                  type: entryToDelete.type === 'devotional' ? 'guided' : entryToDelete.type === 'playbook' ? 'free' : entryToDelete.type,
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

  // Handle entry press for editing
  const handleEntryPress = (entry: ReflectionLogEntry) => {
    console.log('🔍 Editing entry:', entry.id, entry.title, 'type:', entry.type);

    // Set editing state
    setEditingId(entry.id);
    setSelectedEntry(entry);

    // For guided and devotional entries, set the selected prompt if available
    if (entry.type === 'guided' || entry.type === 'devotional') {
      // Use the stored prompt, or the title if it was used as a prompt, or empty string
      const promptToUse = entry.prompt || (entry.title && GUIDED_PROMPTS.includes(entry.title) ? entry.title : '');
      setSelectedPrompt(promptToUse);
    } else {
      setSelectedPrompt('');
    }

    // Populate the form with existing entry data
    setNewEntry({
      title: entry.title || '',
      content: entry.content,
      type: entry.type,
      source: entry.source,
      prompt: entry.prompt || '',
      tags: entry.tags || [],
      location: entry.location || '',
    });

    // Open the editor modal
    setIsAdding(true);
  };

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
      rawReflectionEntries: reflectionEntries,
      transformedEntries: entries,
      isLoading,
      error: error?.message,
      userId: user?.id,
    });

    // Filter entries to only show those from the current date
    const filteredEntries = entries.filter(entry => {
      console.log('🔍 Comparing dates:', entry.selected_date, '===', dateStr, entry.selected_date === dateStr);
      return entry.selected_date === dateStr;
    });

    console.log('🔍 Filtered entries for date:', dateStr, 'count:', filteredEntries.length);

    // TEMPORARY: Show all entries for debugging
    const entriesToShow = filteredEntries.length > 0 ? filteredEntries : entries;
    console.log('🔍 Entries to show:', entriesToShow.length);

    // Return empty state when there are no entries to show
    if (entriesToShow.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="head-dots-horizontal-outline"
              size={32}
              color={Colors.mediumGray}
              style={styles.emptyStateIcon}
            />
            <Text style={styles.sectionLabel} accessibilityRole="text">REFLECTION</Text>
          </View>
          <View style={styles.titleContainer}>
            <Text
              style={styles.emptyStateTitle}
              accessibilityRole="header"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Open Your Heart
            </Text>
          </View>
          <Text style={styles.emptyStateSubtext} accessibilityRole="text">
            Reflect on your emotions and faith to grow closer to God.
          </Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => {
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
              setSelectedEntry(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="Begin reflection"
          >
            <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
            <Text style={styles.emptyStateButtonText}>Begin</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        <View style={styles.entriesContainer}>
          {entriesToShow.slice(0, visibleCount).map((entry) => (
            <React.Fragment key={entry.id}>
              {renderEntryCard(entry)}
            </React.Fragment>
          ))}
        </View>
        {(entriesToShow.length > visibleCount || visibleCount > 3) && (
          <View style={styles.paginationContainer}>
            <View style={styles.paginationButtonGroup}>
              {entriesToShow.length > visibleCount && (
                <TouchableOpacity
                  style={[styles.paginationButton, styles.showMoreButton]}
                  onPress={() => setVisibleCount(prev => Math.min(prev + 3, entriesToShow.length))}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Show more reflections. ${entriesToShow.length - visibleCount} remaining`}
                  accessibilityHint="Loads 3 more reflection items to the list"
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
                  accessibilityRole="button"
                  accessibilityLabel="Show less reflections"
                  accessibilityHint="Collapses the list to show only the first 3 reflections"
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
          : (entry.type === 'guided' || entry.type === 'devotional')
            ? styles.guidedEntry
            : styles.freeFormEntry,
      ]}
      onPress={() => handleEntryPress(entry)}
      activeOpacity={0.8}
    >
      {entry.source === 'devotional' || entry.type === 'devotional' ? (
        <View>
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
          {/* Devotional Metadata - Removed as per design */}
          {/* Playbook Metadata */}
          {(entry.playbook_title || entry.day_number || entry.day_title) && entry.source === 'playbook' && (
            <View style={styles.devotionalMetadata}>
              {entry.playbook_title && (
                <Text style={styles.devotionalTitle}>{entry.playbook_title}</Text>
              )}
              {(entry.day_number || entry.day_title) && (
                <Text style={styles.devotionalDayInfo}>
                  {entry.day_number && `Day ${entry.day_number}`}
                  {entry.day_number && entry.day_title && ' • '}
                  {entry.day_title}
                </Text>
              )}
            </View>
          )}
        </View>
      ) : entry.source === 'playbook' || entry.type === 'playbook' ? (
        <View style={styles.guidedPromptRow}>
          <View style={styles.devotionalPromptContainer}>
            <Text style={styles.devotionalPromptText}>PLAYBOOK</Text>
          </View>
          <Text style={styles.timeText}>
            {new Date(entry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </Text>
        </View>
      ) : entry.type === 'guided' ? (
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
      {entry.source === 'devotional' || entry.type === 'devotional' ? (
        <Text style={styles.promptCardText}>{entry.prompt || entry.title || 'Devotional Reflection'}</Text>
      ) : entry.type === 'guided' ? (
        <Text style={styles.promptCardText}>{entry.prompt || entry.title || 'Guided Reflection'}</Text>
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
      {entry.tags && entry.tags.filter(tag => tag !== 'playbook').length > 0 && (
        <View style={styles.tagsContainer}>
          {entry.tags.filter(tag => tag !== 'playbook').map((tag, index) => (
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
      <JournalCard
        icon={<LuNotebookPen size={24} color={Colors.anchorBlue} strokeWidth={2.5} />}
        title="HEART JOURNAL"
        subtitle="Loading your reflections..."
        showAddButton={false}
        onAdd={() => {}}
        isAdding={false}
      >
        <ReflectionSkeleton count={3} />
      </JournalCard>
    );
  }

  // Error state with retry option
  if (error) {
    return (
      <JournalCard
        icon={<LuNotebookPen size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
        title="HEART JOURNAL"
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

  // Determine if there's content
  const hasContent = entries.length > 0;

  // Hide empty component in inline view
  if (viewMode === 'inline' && !isLoading && !error && entries.length === 0) {
    return null;
  }

  return (
    <JournalCard
      icon={hasContent ? <MaterialCommunityIcons name="head-dots-horizontal-outline" size={24} color={Colors.alertCoral} /> : undefined}
      title={hasContent ? 'HEART JOURNAL' : undefined}
      subtitle={hasContent ? getReflectionSubtitle(entries?.length || 0) : undefined}
      showAddButton={hasContent}
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
        setSelectedEntry(null);
      }}
      headerRight={globalEditMode?.isGlobalEditMode ? (
        <TouchableOpacity
          onPress={() => {
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
            setSelectedEntry(null);
          }}
          style={styles.editButton}
          accessibilityRole="button"
          accessibilityLabel="Add new reflection"
        >
          <Ionicons
            name="pencil"
            size={16}
            color={Colors.mediumGray}
          />
        </TouchableOpacity>
      ) : undefined}
      viewMode={viewMode}
      expanded={expanded}
      onExpand={onExpand}
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
                  type: editingId ? (selectedEntry?.type || newEntry.type || 'free') : (entryData.type || newEntry.type || 'free'),
                  user_id: user.id,
                  selected_date: dateStr,
                };

                console.log('🔍 Saving reflection with data:', saveData);
                console.log('🔍 Entry context:', {
                  editingId,
                  selectedEntryType: selectedEntry?.type,
                  newEntryType: newEntry.type,
                  entryDataType: entryData.type,
                  finalType: saveData.type,
                });

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

              // Close global edit mode if active
              if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
                globalEditMode.setGlobalEditMode(false);
              }
            }}
            onCancel={() => {
              resetForm();
              setIsAdding(false);
            }}
            onDelete={editingId ? async (id: string) => {
              try {
                await deleteMutation.mutateAsync(id);
                await refetch();
                console.log('Reflection deleted successfully');
              } catch (deleteError) {
                console.error('Failed to delete reflection:', deleteError);
                Alert.alert('Error', 'Failed to delete reflection. Please try again.');
              }
            } : undefined}
            entryId={editingId || undefined}
            initialEntry={{
              title: newEntry.title,
              content: newEntry.content,
              tags: newEntry.tags || [],
              type: newEntry.type === 'free' ? 'free-form' : newEntry.type === 'devotional' ? 'guided' : newEntry.type === 'playbook' ? 'free-form' : newEntry.type,
              source: newEntry.source,
              prompt: newEntry.prompt,
            }}
            initialMode={(newEntry.type === 'guided' || newEntry.type === 'devotional') ? 'guided' : 'free-form'}
            initialPrompt={(newEntry.type === 'guided' || newEntry.type === 'devotional') ? (selectedPrompt || newEntry.prompt || newEntry.title || '') : ''}
            initialTitle={(newEntry.type === 'guided' || newEntry.type === 'devotional') && Boolean(selectedPrompt) ? (selectedPrompt || newEntry.prompt || newEntry.title || '') : ''}
            lockTitle={(newEntry.type === 'guided' || newEntry.type === 'devotional') && Boolean(selectedPrompt)}
            source={editingId && selectedEntry?.source === 'devotional' ? 'devotional' : editingId && selectedEntry?.source === 'playbook' ? 'playbook' : (newEntry.type === 'guided' || newEntry.type === 'devotional') && Boolean(selectedPrompt) ? 'guided' : 'freeform'}
            // Pass devotional/playbook metadata for existing entries
            devotionalTitle={editingId && selectedEntry && selectedEntry.source === 'devotional' ? selectedEntry.devotional_title : undefined}
            playbookTitle={editingId && selectedEntry && selectedEntry.source === 'playbook' ? selectedEntry.playbook_title : undefined}
            dayNumber={editingId && selectedEntry ? selectedEntry.day_number : undefined}
            dayTitle={editingId && selectedEntry ? selectedEntry.day_title : undefined}
            totalDays={editingId && selectedEntry ? selectedEntry.total_days : undefined}
            questionNumber={editingId && selectedEntry ? selectedEntry.question_number : undefined}
            styles={reflectionLogStyles}
            dateString={(() => {
              const now = new Date();
              const year = now.getFullYear();
              const todayString = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
              const todayStringWithYear = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
              return year === new Date().getFullYear() ? todayString : todayStringWithYear;
            })()}
          />
      </Modal>

      {/* Prompt Picker Modal */}
      {renderPromptPicker()}
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  editButton: {
    padding: 4,
    borderRadius: 4,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    marginTop: 4,
    marginBottom: 4,
  },
  showMoreText: {
    marginLeft: 2,
    fontSize: 11,
    fontFamily: Fonts.medium,
    lineHeight: 14,
    color: Colors.alertCoral,
  },
  entryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    color: Colors.hopeWhite,
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 8,
    paddingLeft: 16,
    marginLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(136, 158, 187, 0.2)',
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
    borderRadius: 14,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  guidedEntry: {
    borderRadius: 14,
    padding: 20,
  },
  freeFormEntry: {
    borderRadius: 14,
    padding: 20,
  },
  guidedPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  devotionalPromptContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
  // Devotional metadata styles
  devotionalMetadata: {
    marginTop: 8,
    marginBottom: 4,
  },
  devotionalTitle: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.faithGold,
    marginBottom: 2,
  },
  devotionalDayInfo: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontStyle: 'italic',
  },
  // Empty state styles
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 12,
    width: '100%',
  },
  emptyStateIcon: {
    marginBottom: 8,
    opacity: 0.8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    fontSize: 12,
    color: Colors.mediumGray,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 6,
    opacity: 0.9,
  },
  titleContainer: {
    width: '100%',
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  emptyStateSubtext: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  emptyStateButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonIcon: {
    marginRight: 8,
  },
  emptyStateButtonText: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
});



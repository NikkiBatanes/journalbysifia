import React, { useState, useRef, useCallback, useEffect } from 'react';
import { isToday as isTodayFn, isYesterday as isYesterdayFn, isAfter, startOfDay, startOfToday } from 'date-fns';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { View, TouchableOpacity, Alert, Modal, ScrollView, StyleSheet } from 'react-native';

import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import ThemedText from '../common/ThemedText';
import { NotebookPen as LuNotebookPen, X, Pencil } from 'lucide-react-native';

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
import NewSuccessModal from '../NewSuccessModal';
import { useSuccessModal } from '../../hooks/useSuccessModal';
import { triggerLightHaptic } from '../../utils/haptics';

// Define styles at the top to avoid hoisting issues
const styles = StyleSheet.create({
  editButton: {
    padding: 4,
    borderRadius: 4,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 16,
    color: Colors.darkGray,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: Colors.textGray,
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
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  spinning: {
    opacity: 0.7,
  },
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
    fontWeight: '600',
    fontSize: 12,
    color: Colors.textGray,
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
    fontWeight: '600',
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textGray,
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
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
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
    lineHeight: 14,
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
  showLessButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  showLessText: {
    color: Colors.textGray,
  },
  entryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  devotionalEntry: {
    borderRadius: 14,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    backgroundColor: 'rgba(242, 245, 247, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  freeFormPromptText: {
    fontSize: 8,
    color: 'rgba(242, 245, 247, 0.8)',
    fontFamily: Fonts.medium,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  playbookPromptContainer: {
    backgroundColor: 'rgba(76, 184, 144, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  playbookPromptText: {
    fontSize: 8,
    color: Colors.growthGreen,
    fontFamily: Fonts.medium,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 10,
    color: Colors.textGray,
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
    color: Colors.textGray,
    fontStyle: 'italic',
  },
});

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
  onPencilTap?: () => void; // Handler for pencil icon tap in carousel
}

export const ReflectionLogReactQuery: React.FC<ReflectionLogProps> = ({ selectedDate = new Date(), viewMode, expanded, onExpand, onPencilTap }) => {
  // Global edit mode context (only for inline view)
  // Global edit mode context - safe version that handles missing provider
  const globalEditMode = useEditModeSafe();

  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);

  // Debug logging for date handling

  const isSelectedToday = isTodayFn(selectedDate);
  const isSelectedYesterday = isYesterdayFn(selectedDate);
  const future = isAfter(startOfDay(selectedDate), startOfToday());

  // Success modal system
  const successModal = useSuccessModal(
    () => {
      resetForm();
      // Editor is already closed, just reset form
    }, // onDone: just reset form since editor is already closed
    () => {
      // onEdit: success modal will hide automatically, main modal stays open
    } // onEdit: keep modal open for editing
  );

  // Generate a meaningful subtitle based on the number of entries and date bucket
  const getReflectionSubtitle = (count: number): string | undefined => {
    if (count <= 0) {return undefined;}
    if (isSelectedToday) {
      if (count === 1) {return '1 reflection today';}
      if (count < 5) {return `${count} reflections today`;}
      return `You’ve shared ${count} reflections today`;
    }
    if (isSelectedYesterday) {
      if (count === 1) {return '1 reflection yesterday';}
      if (count < 5) {return `${count} reflections yesterday`;}
      return `You shared ${count} reflections yesterday`;
    }
    // Earlier past
    if (count === 1) {return '1 reflection on this day';}
    return `${count} reflections on this day`;
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

  // Helpers to normalize HTML <br> to real newlines for RN Text/TextInput
  const normalizeIncoming = useCallback((text: string): string => {
    if (!text) {return '';}
    return text.replace(/<br\s*\/?\s*>/gi, '\n');
  }, []);

  const normalizeOutgoing = useCallback((text: string): string => {
    if (!text) {return '';}
    return text.replace(/<br\s*\/?\s*>/gi, '\n').replace(/\r\n/g, '\n');
  }, []);

  // Transform API data to local format with memoization
  const entries: ReflectionLogEntry[] = React.useMemo(() => {

    return reflectionEntries.map(entry => ({
      id: entry.id,
      title: entry.title || '', // Handle optional title from API
      content: normalizeIncoming(entry.content),
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
    }));
  }, [reflectionEntries, normalizeIncoming]);

  // Determine if there's content for the selected date
  const hasContentForSelectedDate = React.useMemo(() => {
    const filteredEntries = entries.filter(e => {
      const entryDate = e.selected_date?.split('T')[0] || e.selected_date;
      const compareDate = dateStr?.split('T')[0] || dateStr;
      const matches = entryDate === compareDate;

      return matches;
    });

    return filteredEntries.length > 0;
  }, [entries, dateStr]);

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
            triggerLightHaptic();

            try {
              await deleteMutation.mutateAsync(entryId);

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
    triggerLightHaptic();
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

  // Prompt modal styles defined inline to avoid hoisting issues
  const promptModalStyles = StyleSheet.create({
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
  });

  const renderPromptPicker = () => (
    <Modal
      visible={showPromptPicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowPromptPicker(false)}
    >
      <View style={promptModalStyles.promptModalContainer}>
        <View style={promptModalStyles.promptModalContent}>
          <View style={promptModalStyles.promptModalHeader}>
            <ThemedText style={promptModalStyles.promptModalTitle}>Select a Prompt</ThemedText>
            <TouchableOpacity onPress={() => { triggerLightHaptic(); setShowPromptPicker(false); }}>
              <X size={24} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>
          <ScrollView style={promptModalStyles.promptList}>
            {GUIDED_PROMPTS.map((prompt, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  promptModalStyles.promptOption,
                  selectedPrompt === prompt && promptModalStyles.selectedPromptOption,
                ]}
                onPress={() => handlePromptSelection(prompt)}
              >
                <ThemedText style={promptModalStyles.promptOptionText}>{prompt}</ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Handle entry press for editing
  const handleEntryPress = (entry: ReflectionLogEntry) => {

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
      content: normalizeIncoming(entry.content),
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
          <ThemedText weight="semiBold" style={styles.errorTitle}>Failed to load reflections</ThemedText>
          <ThemedText style={styles.errorMessage}>
            {error.message || 'Something went wrong. Please try again.'}
          </ThemedText>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              triggerLightHaptic();

              analytics.trackReflectionEvent('reflection_error', {
                error_type: error.message || 'Unknown error',
                operation: 'fetch',
                date: dateStr,
              });
              refetch();
            }}
          >
            <Ionicons name="refresh" size={16} color={Colors.hopeWhite} style={styles.spinning} />
            <ThemedText weight="medium" style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    // Debug logging

    // Filter entries to only show those from the current date
    const filteredEntries = entries.filter(entry => {
      // Normalize both dates to ensure consistent comparison
      const entryDate = entry.selected_date?.split('T')[0] || entry.selected_date;
      const compareDate = dateStr?.split('T')[0] || dateStr;
      const matches = entryDate === compareDate;

      return matches;
    });

    // Show only entries for the selected date
    const entriesToShow = filteredEntries;

    // Return empty state when there are no entries to show
    if (entriesToShow.length === 0) {
      // Do not show empty state for future dates
      if (future) {
        return null;
      }
      // Hide empty states in inline view
      if (viewMode === 'inline') {
        return null;
      }

      // Date-aware empty-state copy
      const emptyEyebrow = 'REFLECTION';
      let emptyTitle = 'Open Your Heart';
      let emptySubtitle = 'Reflect on your emotions and faith to grow closer to God';
      let emptyCTA = 'Begin';

      if (isSelectedYesterday) {
        emptyTitle = 'Revisit God’s Lessons';
        emptySubtitle = 'Reflect on what you\nfelt and learned yesterday';
        emptyCTA = 'Revisit';
      } else if (!isSelectedToday && !isSelectedYesterday && !future) {
        emptyTitle = 'Revisit God’s Lessons';
        emptySubtitle = 'Capture any thoughts you want to remember from this day';
        emptyCTA = 'Reflect';
      }

      return (
        <View style={styles.emptyStateContainer}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="head-dots-horizontal-outline"
              size={32}
              color={Colors.textGray}
              style={styles.emptyStateIcon}
            />
            <ThemedText weight="medium" style={styles.sectionLabel} accessibilityRole="text">{emptyEyebrow}</ThemedText>
          </View>
          <View style={styles.titleContainer}>
            <ThemedText
              style={styles.emptyStateTitle}
              accessibilityRole="header"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {emptyTitle}
            </ThemedText>
          </View>
          <ThemedText style={styles.emptyStateSubtext} accessibilityRole="text">{emptySubtitle}</ThemedText>
          {!globalEditMode?.isGlobalEditMode && (
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => {
                // Use carousel handler if provided (matching dashboard behavior)
                if (onPencilTap) {
                  onPencilTap();
                  return;
                }

                // Default behavior for non-carousel mode
                triggerLightHaptic();
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
              accessibilityLabel={`${emptyCTA} reflection`}
            >
              <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
              <ThemedText weight="medium" style={styles.emptyStateButtonText}>{emptyCTA}</ThemedText>
            </TouchableOpacity>
          )}
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
                  onPress={() => { triggerLightHaptic(); setVisibleCount(prev => Math.min(prev + 3, entriesToShow.length)); }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Show more reflections. ${entriesToShow.length - visibleCount} remaining`}
                  accessibilityHint="Loads 3 more reflection items to the list"
                >
                  <Ionicons name="chevron-down" size={12} color={Colors.alertCoral} />
                  <ThemedText style={[styles.paginationButtonText, styles.showMoreText]}>
                    Show more
                  </ThemedText>
                </TouchableOpacity>
              )}
              {visibleCount > 3 && (
                <TouchableOpacity
                  style={[styles.paginationButton, styles.showLessButton]}
                  onPress={() => { triggerLightHaptic(); setVisibleCount(3); }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Show less reflections"
                  accessibilityHint="Collapses the list to show only the first 3 reflections"
                >
                  <Ionicons name="chevron-up" size={12} color={Colors.textGray} />
                  <ThemedText style={[styles.paginationButtonText, styles.showLessText]}>
                    Show less
                  </ThemedText>
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
      onPress={() => { triggerLightHaptic(); handleEntryPress(entry); }}
      activeOpacity={0.8}
    >
      {entry.source === 'devotional' || entry.type === 'devotional' ? (
        <View style={styles.guidedPromptRow}>
          <View style={styles.devotionalPromptContainer}>
            <ThemedText style={styles.devotionalPromptText}>DEVOTIONAL</ThemedText>
          </View>
          <ThemedText style={styles.timeText}>
            {new Date(entry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </ThemedText>
        </View>
      ) : entry.source === 'playbook' || entry.type === 'playbook' ? (
        <View style={styles.guidedPromptRow}>
          <View style={styles.playbookPromptContainer}>
            <ThemedText style={styles.playbookPromptText}>PLAYBOOK</ThemedText>
          </View>
          <ThemedText style={styles.timeText}>
            {new Date(entry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </ThemedText>
        </View>
      ) : entry.type === 'guided' ? (
        <View style={styles.guidedPromptRow}>
          <View style={styles.guidedPromptContainer}>
            <ThemedText style={styles.guidedPromptText}>GUIDED PROMPT</ThemedText>
          </View>
          <ThemedText style={styles.timeText}>
            {new Date(entry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.freeFormPromptRow}>
          <View style={styles.freeFormPromptContainer}>
            <ThemedText style={styles.freeFormPromptText}>FREE FORM</ThemedText>
          </View>
          <ThemedText style={styles.timeText}>
            {new Date(entry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </ThemedText>
        </View>
      )}

      {entry.source === 'devotional' || entry.type === 'devotional' ? (
        <ThemedText style={styles.promptCardText}>{entry.prompt || entry.title || 'Devotional Reflection'}</ThemedText>
      ) : entry.type === 'guided' ? (
        <ThemedText style={styles.promptCardText}>{entry.prompt || entry.title || 'Guided Reflection'}</ThemedText>
      ) : entry.title ? (
        <ThemedText style={[styles.promptCardText, styles.normalTitleText]}>{entry.title}</ThemedText>
      ) : null}

      <ThemedText
        style={styles.entryContent}
        numberOfLines={3}
        ellipsizeMode="tail"
      >
        {typeof entry.content === 'string' ? normalizeIncoming(entry.content) : JSON.stringify(entry.content)}
      </ThemedText>

      {/* Removed lower right tags - only show upper left type tags (FREE FORM, PLAYBOOK, GUIDED PROMPT) */}
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
          <ThemedText style={styles.errorTitle}>Failed to load reflections</ThemedText>
          <ThemedText style={styles.errorMessage}>
            {error.message || 'Something went wrong. Please try again.'}
          </ThemedText>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              triggerLightHaptic();

              analytics.trackReflectionEvent('reflection_error', {
                error_type: error.message || 'Unknown error',
                operation: 'retry',
                date: dateStr,
              });
              refetch();
            }}
          >
            <Ionicons name="refresh" size={16} color={Colors.hopeWhite} style={styles.spinning} />
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      </JournalCard>
    );
  }

// ...

return (
  <>
    <JournalCard
      icon={!hasContentForSelectedDate ? undefined : <MaterialCommunityIcons name="head-dots-horizontal-outline" size={24} color={Colors.alertCoral} />}
      title={!hasContentForSelectedDate ? undefined : 'HEART JOURNAL'}
      subtitle={!hasContentForSelectedDate ? undefined : getReflectionSubtitle(entries.filter(e => {
        const entryDate = e.selected_date?.split('T')[0] || e.selected_date;
        const compareDate = dateStr?.split('T')[0] || dateStr;
        return entryDate === compareDate;
      }).length)}
      showAddButton={hasContentForSelectedDate && !globalEditMode?.isGlobalEditMode}
      onAdd={() => {
        // Use carousel handler if provided (matching dashboard behavior)
        if (onPencilTap) {
          onPencilTap();
          return;
        }

        // Default behavior for non-carousel mode
        triggerLightHaptic();
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
            // Use carousel handler if provided (matching dashboard behavior)
            if (onPencilTap) {
              onPencilTap();
              return;
            }

            // Default behavior for non-carousel mode
            triggerLightHaptic();
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
          <Pencil
            size={16}
            color={Colors.textGray}
            strokeWidth={2}
          />
        </TouchableOpacity>
      ) : undefined}
      viewMode={viewMode}
      expanded={expanded}
      onExpand={onExpand}
    >
      {/* Entries List */}
      {renderEntries()}

      {/* Add/Edit Entry Modal - Show for adding new entries (when not in carousel mode) or editing existing entries */}
      {(!onPencilTap || selectedEntry) && (
        <Modal
          visible={(() => {
            const shouldShow = isAdding || !!selectedEntry;

            return shouldShow;
          })()}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            setIsAdding(false);
            setSelectedEntry(null);
            setEditingId(null);
          }}
        >
        <ReflectionLogEditor
            onSave={async (entryData: any) => {
              triggerLightHaptic();
              if (!user) {
                console.error('User not authenticated');
                return;
              }

              try {
                // Only include fields that exist in the database schema
                const saveData = {
                  title: entryData.title || '',
                  content: normalizeOutgoing(entryData.content || ''),
                  type: editingId ? (selectedEntry?.type || newEntry.type || 'free') : (entryData.type || newEntry.type || 'free'),
                  user_id: user.id,
                  selected_date: dateStr,
                  // Include additional fields if they exist
                  ...(entryData.prompt && { prompt: entryData.prompt }),
                  ...(entryData.tags && entryData.tags.length > 0 && { tags: entryData.tags }),
                  ...(entryData.source && { source: entryData.source }),
                };

                let result;
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
                  await createMutation.mutateAsync(saveData);

                  // Track creation analytics
                  analytics.trackReflectionEvent('reflection_created', {
                    title_length: saveData.title.length,
                    content_length: saveData.content.length,
                    type: saveData.type,
                    has_prompt: Boolean(entryData.prompt || selectedPrompt),
                    date: dateStr,
                  }, user.id);
                }

                // Wait a moment for the mutation to complete before refetching
                setTimeout(async () => {
                  await refetch();

                }, 100);

                // Close editor modal first, then show success modal to avoid layering conflicts
                setSelectedEntry(null);
                setEditingId(null);
                setIsAdding(false);

                // Small delay to ensure editor modal closes before showing success modal
                setTimeout(() => {
                  successModal.showSuccess({
                    title: editingId ? 'Reflection Updated' : 'Reflection Saved',
                    message: editingId ? 'Your reflection has been updated in your journal.' : 'Your reflection has been saved to your journal.',
                    showEditButton: false, // Don't show edit button since we're closing the editor
                  });
                }, 100);

                // Keep the main modal open - success modal will handle closing via callbacks
              } catch (saveError) {
                console.error('🔍 ReflectionLog: Save failed:', saveError);
                Alert.alert('Error', 'Failed to save reflection entry. Please try again.');
                return; // Don't close the modal if save failed
              }

              // Close global edit mode if active
              if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
                globalEditMode.setGlobalEditMode(false);
              }
            }}
            onCancel={() => {
              triggerLightHaptic();
              resetForm();
              setIsAdding(false);
              setSelectedEntry(null);
              setEditingId(null);
            }}
            onDelete={editingId ? async (id: string) => {
              triggerLightHaptic();
              try {
                await deleteMutation.mutateAsync(id);
                await refetch();

              } catch (deleteError) {
                console.error('Failed to delete reflection:', deleteError);
                Alert.alert('Error', 'Failed to delete reflection. Please try again.');
              }
            } : undefined}
            entryId={editingId || undefined}
            initialEntry={selectedEntry ? {
              title: selectedEntry.title,
              content: selectedEntry.content,
              tags: selectedEntry.tags || [],
              type: selectedEntry.type === 'free' ? 'free-form' : selectedEntry.type === 'devotional' ? 'guided' : selectedEntry.type === 'playbook' ? 'free-form' : selectedEntry.type,
              source: selectedEntry.source,
              prompt: selectedEntry.prompt,
            } : {
              title: newEntry.title,
              content: newEntry.content,
              tags: newEntry.tags || [],
              type: newEntry.type === 'free' ? 'free-form' : newEntry.type === 'devotional' ? 'guided' : newEntry.type === 'playbook' ? 'free-form' : newEntry.type,
              source: newEntry.source,
              prompt: newEntry.prompt,
            }}
            initialMode={selectedEntry ?
              ((selectedEntry.type === 'guided' || selectedEntry.type === 'devotional') ? 'guided' : 'free-form') :
              ((newEntry.type === 'guided' || newEntry.type === 'devotional') ? 'guided' : 'free-form')
            }
            initialPrompt={selectedEntry ?
              ((selectedEntry.type === 'guided' || selectedEntry.type === 'devotional') ? (selectedEntry.prompt || selectedEntry.title || '') : '') :
              ((newEntry.type === 'guided' || newEntry.type === 'devotional') ? (selectedPrompt || newEntry.prompt || newEntry.title || '') : '')
            }
            initialTitle={selectedEntry ?
              selectedEntry.title :
              ((newEntry.type === 'guided' || newEntry.type === 'devotional') && Boolean(selectedPrompt) ? (selectedPrompt || newEntry.prompt || newEntry.title || '') : '')
            }
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
            dateString={selectedDate.toISOString()} // Pass ISO string for proper date parsing
          />

      </Modal>
      )}

      {/* Prompt Picker Modal */}
      {!onPencilTap && renderPromptPicker()}
    </JournalCard>

    {/* Success Modal - Outside JournalCard and after editor modal to ensure it appears on top */}
    {!onPencilTap && (
      <NewSuccessModal
        visible={successModal.isVisible}
        config={successModal.config}
        onDone={successModal.handleDone}
        onEdit={successModal.handleEdit}
      />
    )}
    </>
  );
};


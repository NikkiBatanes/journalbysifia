import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import { isToday as isTodayFn, isYesterday as isYesterdayFn, isAfter, startOfDay, startOfToday } from 'date-fns';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { View, TouchableOpacity, Alert, Modal, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import ThemedText from '../common/ThemedText';
import { NotebookPen as LuNotebookPen, X, Pencil } from 'lucide-react-native';

import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';

import { styles as reflectionLogStyles } from './reflectionStyles';
import { GUIDED_PROMPTS } from './reflectionConstants';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useGuidedPromptGating } from '../../hooks/useGuidedPromptGating';
import {
  useReflectionData,
  useDeleteReflection,
} from '../../services/hooks/useReflectionData';
import { ReflectionSkeleton } from '../SkeletonLoader/ReflectionSkeleton';
import { toLocalDateString } from '../../utils/date';
import { analytics } from '../../utils/analytics';
import { triggerLightHaptic } from '../../utils/haptics';
import { useScroll } from '../../context/ScrollContext';

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
  const navigation = useNavigation();

  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);
  const { scrollToSection } = useScroll();

  // Guided prompt gating for consistent lock state
  const guidedPromptGating = useGuidedPromptGating({
    context: 'inApp',
  });

  // Date handling logic
  const isSelectedToday = isTodayFn(selectedDate);
  const isSelectedYesterday = isYesterdayFn(selectedDate);
  const future = isAfter(startOfDay(selectedDate), startOfToday());


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

  const deleteMutation = useDeleteReflection();

  // Helpers to normalize HTML <br> to real newlines for RN Text/TextInput
  const normalizeIncoming = useCallback((text: string): string => {
    if (!text) {return '';}
    return text.replace(/<br\s*\/?\s*>/gi, '\n');
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
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState('');

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
              Logger.error('ReflectionLog: Error deleting reflection entry', deleteError as Error, {
  component: 'ReflectionLogReactQuery',
});

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

  // Handle prompt selection with analytics
  const handlePromptSelection = useCallback((prompt: string) => {
    triggerLightHaptic();
    setSelectedPrompt(prompt);
    setShowPromptPicker(false);

    // Track prompt selection analytics
    if (user) {
      analytics.trackReflectionEvent('reflection_prompt_selected', {
        prompt_text: prompt,
        date: dateStr,
      }, user.id);
    }
  }, [user, dateStr]);

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
    promptOptionContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    promptOptionText: {
      fontFamily: Fonts.regular,
      fontSize: 14,
      color: Colors.darkGray,
      flex: 1,
    },
    lockedPromptText: {
      color: Colors.trustGrey,
      opacity: 0.7,
    },
    lockIcon: {
      marginLeft: 8,
    },
  });

  const renderPromptPicker = () => {
    // Get gated prompts from the editor component
    const lockedPrompts = guidedPromptGating.lockedPrompts || [];

    return (
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
              {GUIDED_PROMPTS.map((prompt, index) => {
                const isLocked = lockedPrompts.includes(prompt);
                const isSelected = selectedPrompt === prompt;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      promptModalStyles.promptOption,
                      isSelected && promptModalStyles.selectedPromptOption,
                    ]}
                    onPress={() => handlePromptSelection(prompt)}
                    disabled={isLocked}
                  >
                    <View style={promptModalStyles.promptOptionContent}>
                      <ThemedText style={[
                        promptModalStyles.promptOptionText,
                        isLocked && promptModalStyles.lockedPromptText,
                      ]}>
                        {prompt}
                      </ThemedText>
                      {isLocked && (
                        <Ionicons
                          name="lock-closed"
                          size={16}
                          color={Colors.trustGrey}
                          style={promptModalStyles.lockIcon}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Handle entry press for editing
  const handleEntryPress = (entry: ReflectionLogEntry) => {
    // For guided and devotional entries, determine the prompt
    const promptToUse = entry.type === 'guided' || entry.type === 'devotional'
      ? (entry.prompt || (entry.title && GUIDED_PROMPTS.includes(entry.title) ? entry.title : ''))
      : '';

    // Determine the form type
    const getFormType = (): 'free-form' | 'guided' => {
      if (entry.type === 'free' || entry.type === 'playbook') {return 'free-form';}
      if (entry.type === 'devotional') {return 'guided';}
      return 'free-form'; // fallback
    };

    // Navigate to full screen editor
    (navigation as any).navigate('ReflectionEditor', {
      selectedDate: selectedDate.toISOString(),
      existingReflection: entry,
      initialMode: getFormType(),
      initialPrompt: promptToUse,
      initialTitle: entry.title || '',
      lockTitle: entry.type === 'guided' || entry.type === 'devotional',
      source: entry.source || (entry.type === 'free' ? 'freeform' : undefined),
      devotionalTitle: entry.devotional_title,
      playbookTitle: entry.playbook_title,
      dayNumber: entry.day_number,
      dayTitle: entry.day_title,
      totalDays: entry.total_days,
      questionNumber: entry.question_number,
    });
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

                // Default behavior for non-carousel mode - navigate to full screen editor
                triggerLightHaptic();
                (navigation as any).navigate('ReflectionEditor', {
                  selectedDate: selectedDate.toISOString(),
                  initialMode: 'free-form',
                  source: 'freeform',
                });
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
                  onPress={() => {
                    triggerLightHaptic();
                    setVisibleCount(3);
                    // Scroll to the Reflect & Grow header when showing less
                    setTimeout(() => {
                      scrollToSection('reflect-carousel', 1300); // Scroll to reflect section with small offset
                    }, 100);
                  }}
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
            <ThemedText style={styles.freeFormPromptText}>THOUGHTS</ThemedText>
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

  // Handle errors silently - no annoying alerts
  React.useEffect(() => {
    if (error) {
      Logger.error('Failed to load reflection entries', error as Error, {
        component: 'ReflectionLogReactQuery',
        dateStr,
        userId: user?.id,
      });
    }
  }, [error, dateStr, user?.id]);

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

        // Default behavior for non-carousel mode - navigate to full screen editor
        triggerLightHaptic();
        (navigation as any).navigate('ReflectionEditor', {
          selectedDate: selectedDate.toISOString(),
          initialMode: 'free-form',
          source: 'freeform',
        });
      }}
      headerRight={globalEditMode?.isGlobalEditMode ? (
        <TouchableOpacity
          onPress={() => {
            // Use carousel handler if provided (matching dashboard behavior)
            if (onPencilTap) {
              onPencilTap();
              return;
            }

            // Default behavior for non-carousel mode - navigate to full screen editor
            triggerLightHaptic();
            (navigation as any).navigate('ReflectionEditor', {
              selectedDate: selectedDate.toISOString(),
              initialMode: 'free-form',
              source: 'freeform',
            });
          }}
          style={styles.editButton}
          accessibilityRole="button"
          accessibilityLabel="Add new reflection"
        >
          <Pencil
            size={16}
            color={Colors.alertCoral}
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

      {/* Prompt Picker Modal */}
      {!onPencilTap && renderPromptPicker()}
    </JournalCard>
    </>
  );
};


import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { View, TextInput, TouchableOpacity, StyleSheet, Alert, DeviceEventEmitter } from 'react-native';
import type { NavigationProp } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';

import { SwipeableTodoItem } from '../SwipeableTodoItem';
import { Colors } from '../../theme/colors';
// Fonts removed; dynamic fonts handled via ThemedText and getFontFamily
import { JournalCard } from './JournalCard';
import { Check, X, Pencil } from 'lucide-react-native';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  useTodaysFocusData,
  useCreateJournalEntry,
  useUpdateJournalEntry,
} from '../../services/hooks/useJournalData';
import { ErrorBoundary } from '../ErrorBoundary';
import { TodaysFocusSkeleton } from '../SkeletonLoader/TodaysFocusSkeleton';
import { analytics } from '../../utils/analytics';
import { faithPointsService } from '../../services/faithPointsService';
import { visibleStreakService } from '../../services/visibleStreakService';
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';
import { isToday, isYesterday, isAfter, startOfDay, startOfToday } from 'date-fns';
import { triggerLightHaptic } from '../../utils/haptics';
import ThemedText from '../common/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import { usePlanningGating } from '../../hooks/usePlanningGating';
import PlanningLockIcon from '../PlanningLockIcon';

interface PriorityItem {
  id: string;
  text: string;
  completed: boolean;
}

interface TodayFocusData {
  focus: string;
  personalText: string;
  priorities: PriorityItem[];
}

interface TodaysFocusProps {
  selectedDate?: Date;
  refreshKey?: number;
  variant?: 'carousel' | 'inline';
  viewMode?: 'carousel' | 'inline' | 'moments';
  expanded?: boolean;
  onExpand?: () => void;
  planningEnabled?: boolean;
  navigation?: NavigationProp<any>;
}

type FocusCTA = 'begin' | 'update' | 'revisit' | 'plan' | 'editPlan';

interface FocusCardState {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaAction: FocusCTA;
}

export const TodaysFocusReactQuery: React.FC<TodaysFocusProps> = ({ selectedDate = new Date(), refreshKey, variant = 'carousel', viewMode, expanded, onExpand, planningEnabled = true, navigation }) => {
  // Global edit mode context (only for inline view)
  // Global edit mode context - safe version that handles missing provider
  const globalEditMode = useEditModeSafe();

  // Planning gating state
  const planningGating = usePlanningGating(selectedDate, 'inApp');

  // Theme-driven fonts
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontRegular = getFontFamily(fontKey, 'regular');

  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);

  // React Query hooks with performance tracking
  const loadStartTime = useRef<number>(Date.now());
  const { data: focusEntries = [], error, isLoading, refetch } = useTodaysFocusData(user?.id || '', dateStr, refreshKey);

  const createMutation = useCreateJournalEntry();
  const updateMutation = useUpdateJournalEntry();

  // Refetch data when screen comes back into focus (after saving in walkthrough)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Transform API data to local format
  const existingEntry = focusEntries.length > 0 ? focusEntries[0] : null;

  const initialData: TodayFocusData = useMemo(() => {
    const result = existingEntry ? (() => {
      try {
        const parsedContent = typeof existingEntry.content === 'string' ? JSON.parse(existingEntry.content) : existingEntry.content;
        const existingPriorities = parsedContent.priorities || [];

        // Ensure we always have exactly 3 priorities with unique IDs
        const priorities: PriorityItem[] = [];

        // Add existing priorities first
        for (let i = 0; i < 3; i++) {
          if (existingPriorities[i]) {
            priorities.push(existingPriorities[i]);
          } else {
            // Generate unique ID that doesn't conflict with existing ones
            const existingIds = existingPriorities.map((p: PriorityItem) => p.id);
            const allCurrentIds = priorities.map((p: PriorityItem) => p.id);
            let newId = `priority_${i + 1}_${Date.now()}`;
            let counter = 1;
            while (existingIds.includes(newId) || allCurrentIds.includes(newId)) {
              newId = `priority_${i + 1}_${Date.now()}_${counter}`;
              counter++;
            }
            priorities.push({ id: newId, text: '', completed: false });
          }
        }

        return {
          focus: parsedContent.focus || '',
          personalText: parsedContent.personalText || '',
          priorities,
        };
      } catch (parseError) {
        return {
          focus: '',
          personalText: '',
          priorities: [
            { id: 'fallback_1', text: '', completed: false },
            { id: 'fallback_2', text: '', completed: false },
            { id: 'fallback_3', text: '', completed: false },
          ],
        };
      }
    })() : {
      focus: '',
      personalText: '',
      priorities: [
        { id: 'default_1', text: '', completed: false },
        { id: 'default_2', text: '', completed: false },
        { id: 'default_3', text: '', completed: false },
      ],
    };

    return result;
  }, [existingEntry]);

  const [data, setData] = useState<TodayFocusData>(initialData);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPriorityId, setEditingPriorityId] = useState<string | null>(null);
  const [editingPriorityText, setEditingPriorityText] = useState('');
  const [wasDeleted, setWasDeleted] = useState(false);
  const swipeableRefs = useRef<{[key: string]: any}>({});
  const originalData = useRef<TodayFocusData>({ ...data });

  // Determine if we should be in editing mode
  const shouldShowEditingMode = isEditing || (globalEditMode?.isGlobalEditMode && viewMode === 'inline');

  // Reset state when date changes or data loads
  React.useEffect(() => {
    setData({ ...initialData });
    originalData.current = { ...initialData };
    setWasDeleted(false);
    setIsEditing(false);
  }, [dateStr, initialData]);

  // Determine whether an entry has meaningful content (used for copy/CTA)
  const hasEntry: boolean = useMemo(() => {
    if (!existingEntry) {return false;}
    try {
      const content = typeof existingEntry.content === 'string' ? JSON.parse(existingEntry.content || '{}') : (existingEntry.content || {});
      const hasFocus = typeof content.focus === 'string' && content.focus.trim().length > 0;
      const hasPriorities = Array.isArray(content.priorities) && content.priorities.some((p: any) => typeof p?.text === 'string' && p.text.trim().length > 0);
      return hasFocus || hasPriorities;
    } catch {
      return false;
    }
  }, [existingEntry]);

  const today = startOfToday();
  const day = startOfDay(selectedDate);
  const future = isAfter(day, today);

  const hasPlan = future && hasEntry; // treat any existing future entry as a saved plan

  const focusState: FocusCardState = useMemo(() => {
    if (isToday(day)) {
      return {
        eyebrow: 'Today’s Focus',
        title: 'Get Ready for a Great Day',
        subtitle: shouldShowEditingMode
          ? (hasEntry ? 'Update your focus and priorities' : 'Set your focus and priorities')
          : (hasEntry
              ? 'Stay focused on what matters'
              : 'Set your focus and priorities to make today count in faith and action. Then begin.'),
        ctaLabel: hasEntry ? 'Update Focus' : 'Begin',
        ctaAction: hasEntry ? 'update' : 'begin',
      };
    }
    if (isYesterday(day)) {
      return hasEntry
        ? {
            eyebrow: 'Yesterday’s Focus',
            title: 'What I Focused On',
            subtitle: 'How God led you and what counted',
            ctaLabel: 'Revisit',
            ctaAction: 'revisit',
          }
        : {
          eyebrow: 'Yesterday’s Focus',
          title: 'Revisit Yesterday',
          subtitle: shouldShowEditingMode ? 'Reflect on what counted' : 'Reflect on how you made this day count in faith and action',
          ctaLabel: 'Revisit',
          ctaAction: 'revisit',
        };
    }
    if (future) {
      // Check if planning is locked for this tier
      if (planningGating.isLocked) {
        return {
          eyebrow: 'Upcoming Focus',
          title: 'Plan in Faith Ahead',
          subtitle: shouldShowEditingMode ? 'Set your focus and priorities' : 'Prayerfully set what matters so this day can count',
          ctaLabel: 'Pray & Set',
          ctaAction: 'plan',
        };
      }
      if (!planningEnabled) {
        return {
          eyebrow: 'Upcoming Focus',
          title: 'Plan Ahead in Faith',
          subtitle: 'Planning is currently disabled',
          ctaLabel: 'Plan Focus',
          ctaAction: 'plan',
        };
      }
      return hasPlan
        ? {
            eyebrow: 'Upcoming Focus',
            title: 'Planned Focus',
            subtitle: shouldShowEditingMode ? 'Edit your focus and priorities' : 'Planned in faith, ready to begin',
            ctaLabel: 'Edit Plan',
            ctaAction: 'editPlan',
          }
        : {
            eyebrow: 'Upcoming Focus',
            title: 'Plan in Faith Ahead',
            subtitle: shouldShowEditingMode ? 'Set your focus and priorities' : 'Prayerfully set what matters so this day can count',
            ctaLabel: 'Pray & Set',
            ctaAction: 'plan',
          };
    }
    // Earlier past (before yesterday)
    return hasEntry
      ? {
          eyebrow: 'Previous Focus',
          title: 'What I Focused On',
          subtitle: 'What counted in faith on this day',
          ctaLabel: 'Revisit',
          ctaAction: 'revisit',
        }
      : {
          eyebrow: 'Previous Focus',
          title: 'Revisit This Day',
          subtitle: shouldShowEditingMode ? 'Capture what mattered' : 'Capture what mattered and how God was at work',
          ctaLabel: 'Revisit',
          ctaAction: 'revisit',
        };
  }, [day, hasEntry, hasPlan, planningEnabled, planningGating.isLocked, future, shouldShowEditingMode]);

  // Handle global edit mode activation
  React.useEffect(() => {
    if (viewMode === 'inline' && globalEditMode?.isGlobalEditMode && !isEditing) {
      // Check if there's existing focus content
      const hasExistingContent = existingEntry && existingEntry.content && (() => {
        try {
          if (typeof existingEntry.content === 'string') {
            return existingEntry.content !== '{}';
          } else {
            const content = existingEntry.content as any;
            return content.focus || content.priorities?.some((p: any) => p.text);
          }
        } catch {
          return false;
        }
      })();

      if (hasExistingContent) {
        // Start editing existing content
        setIsEditing(true);
      } else {
        // Start adding new content
        setIsEditing(true);
      }
    }
  }, [globalEditMode?.isGlobalEditMode, existingEntry, viewMode, isEditing]);

  // Track loading performance
  React.useEffect(() => {
    if (!isLoading && focusEntries.length >= 0) {
      const loadTime = Date.now() - loadStartTime.current;
      const completedPriorities = initialData.priorities.filter(p => p.completed).length;

      analytics.trackFocusEvent('focus_loaded', {
        has_focus: Boolean(initialData.focus),
        priorities_count: initialData.priorities.length,
        completed_priorities: completedPriorities,
        load_time_ms: loadTime,
        date: dateStr,
      }, user?.id);
    }
  }, [isLoading, focusEntries.length, initialData, dateStr, user?.id]);

  // Handle loading and error states
  React.useEffect(() => {
    if (error) {
      analytics.trackFocusEvent('focus_error', {
        error_type: error.message || 'unknown',
        operation: 'load',
        date: dateStr,
      }, user?.id);
    }
  }, [error, dateStr, user?.id]);

  // Save Today's Focus to storage and cloud
  const saveFocus = useCallback(async (focusData: TodayFocusData) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save today\'s focus.');
      return;
    }

    try {
      const contentToSave = JSON.stringify(focusData);

      if (existingEntry && !wasDeleted) {
        // Update existing entry (only if not deleted)
        await updateMutation.mutateAsync({
          id: existingEntry.id,
          updates: {
            content: contentToSave,
          },
        });
      } else {
        // Create new entry (if no existing entry or was deleted)
        await createMutation.mutateAsync({
          user_id: user.id,
          selected_date: dateStr,
          content_type: 'todays_focus',
          content: contentToSave,
        });
        // Reset wasDeleted flag after creating new entry
        setWasDeleted(false);

        // Check if streak celebration should show for journal focus set
        const shouldShowStreak = user?.id
          ? await visibleStreakService.shouldShowCelebration(user.id, 'journal_focus_set')
          : false;

        if (shouldShowStreak && user?.id) {
          await visibleStreakService.markShownToday(user.id);
          if (navigation) {
            (navigation as any).navigate('StreakPlan', {
              userId: user.id,
              source: 'journal_focus_set',
            });
          }
        }
      }

      // Track successful focus update
      analytics.trackFocusEvent('focus_updated', {
        focus_length: focusData.focus.length,
        has_priorities: focusData.priorities.some(p => p.text.trim() !== ''),
        priorities_count: focusData.priorities.filter(p => p.text.trim() !== '').length,
        date: dateStr,
      }, user.id);

      setIsEditing(false);

      // Emit event for Moments screen (which uses direct Supabase, not React Query)
      DeviceEventEmitter.emit('reflection_saved', {
        type: 'todays_focus',
        date: dateStr,
        userId: user.id,
      });
    } catch (saveError) {
      Alert.alert('Error', 'Failed to save today\'s focus. Please try again.');
      throw saveError;
    }
  }, [user, dateStr, existingEntry, wasDeleted, createMutation, updateMutation]);

  const toggleEditing = () => {
    // Check if planning is locked for future dates
    if (planningGating.isLocked && !isEditing) {
      planningGating.handleLockedAction();
      return;
    }

    if (isEditing) {
      // Save when exiting edit mode (for global edit mode compatibility)
      const hasContent = data.focus.trim() || data.priorities.some(p => p.text.trim());
      if (hasContent) {
        saveFocus(data).then(() => {
          setIsEditing(false);
          // Close global edit mode if active
          if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
            globalEditMode.setGlobalEditMode(false);
          }
        }).catch(() => {
          // Error already handled in saveFocus
        });
      } else {
        setIsEditing(false);
        // Close global edit mode if active
        if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
          globalEditMode.setGlobalEditMode(false);
        }
      }
    } else {
      // Navigate to walkthrough screen instead of inline editor
      if (navigation) {
        triggerLightHaptic();
        navigation.navigate('TodaysFocusWalkthrough' as any, {
          selectedDate: selectedDate.toISOString(),
          existingEntry,
        });
      }
    }
  };

  const handleCancel = () => {
    setData({ ...originalData.current });
    setIsEditing(false);
  };

  const updateFocus = (text: string) => {
    setData(prev => ({ ...prev, focus: text }));
  };

  const updatePriority = (index: number, text: string) => {
    setData(prev => ({
      ...prev,
      priorities: prev.priorities.map((p, i) => i === index ? { ...p, text } : p),
    }));
  };

  const togglePriority = async (index: number) => {
    const currentData = data;
    const newPriorities = currentData.priorities.map((p, i) => {
      if (i === index) {
        const newCompleted = !p.completed;

        // Track priority completion
        if (newCompleted && p.text.trim()) {
          analytics.trackFocusEvent('focus_priority_completed', {
            priority_index: index,
            priority_text_length: p.text.length,
            date: dateStr,
          }, user?.id);

          if (user?.id) {
            faithPointsService.awardPoints(user.id, 'focus_priority_marked', {
              suppressNotification: true,
              source: 'todays_focus',
              priority_index: index,
            }).catch(error => {
              Logger.warn('Failed to award faith points for completed focus priority', {
                component: 'TodaysFocusReactQuery',
                error: error as Error,
              });
            });
          }
        }

        return { ...p, completed: newCompleted };
      }
      return p;
    });

    const updated = {
      ...currentData,
      priorities: newPriorities,
    };

    // Update local state immediately for UI responsiveness
    setData(updated);

    // Persist to database and wait for completion before emitting event
    // This ensures Moments screen fetches updated data
    await saveFocus(updated).catch(() => {});
  };

  // Individual priority edit handlers
  // editPriority removed - was defined but never called

  const saveEditedPriority = async () => {
    if (!editingPriorityId || !editingPriorityText.trim()) {return;}

    // Update local state
    setData(prev => ({
      ...prev,
      priorities: prev.priorities.map(p =>
        p.id === editingPriorityId ? { ...p, text: editingPriorityText.trim() } : p
      ),
    }));

    // Save to backend
    const updatedData = {
      ...data,
      priorities: data.priorities.map(p =>
        p.id === editingPriorityId ? { ...p, text: editingPriorityText.trim() } : p
      ),
    };

    try {
      await saveFocus(updatedData);

      // Reset edit state
      setEditingPriorityId(null);
      setEditingPriorityText('');

      // Event is emitted by saveFocus after database write completes
    } catch (saveError) {
      Logger.error('Failed to save edited priority', saveError as Error, {
        component: 'TodaysFocusReactQuery',
      });
      Alert.alert('Error', 'Failed to save priority. Please try again.');
    }
  };

  const cancelEditPriority = () => {
    setEditingPriorityId(null);
    setEditingPriorityText('');
  };

  const hasContent = data.focus.trim() || data.priorities.some(p => p.text.trim());
  const canSave = hasContent && (createMutation.isPending || updateMutation.isPending) === false;

  // Hide empty component in inline view for all date buckets
  if (viewMode === 'inline' && !isLoading && !hasContent) {
    return null;
  }

  // Handle loading state with skeleton loader
  // Handle loading state
  if (isLoading) {
    return (
      <ErrorBoundary name="TodaysFocusReactQuery">
        <JournalCard
          icon={
            <MaterialIcons
              name="filter-center-focus"
              size={24}
              color={Colors.alertCoral}
            />
          }
          title="TODAY'S FOCUS"
          subtitle="Your daily focus and priorities"
          showAddButton={true}
          onAdd={() => {}} // Disabled during loading
          variant={variant}
          viewMode={viewMode}
        >
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Loading today's focus"
            accessibilityHint="Please wait while your focus and priorities are being loaded"
          >
            <TodaysFocusSkeleton />
          </View>
        </JournalCard>
      </ErrorBoundary>
    );
  }

  // Handle error state
  if (error) {
    return (
      <ErrorBoundary name="TodaysFocusReactQuery">
        <JournalCard
          icon={
            <MaterialIcons
              name="filter-center-focus"
              size={24}
              color={Colors.alertCoral}
            />
          }
          title="TODAY'S FOCUS"
          subtitle="Your daily focus and priorities"
          showAddButton={false}
          variant={variant}
          viewMode={viewMode}
        >
          <View
            style={styles.errorContainer}
            accessibilityRole="alert"
            accessibilityLabel="Error loading today's focus"
          >
            <ThemedText style={styles.errorText}>Failed to load today's focus. Please try again.</ThemedText>
            <TouchableOpacity
              onPress={() => {
                triggerLightHaptic();
                // Trigger a refetch by calling the query again
                // In React Native, we don't have window.location.reload

              }}
              style={styles.retryButton}
              accessibilityRole="button"
              accessibilityLabel="Retry loading today's focus"
              accessibilityHint="Attempts to reload your focus and priorities"
            >
              <ThemedText weight="medium" style={styles.retryText}>Retry</ThemedText>
            </TouchableOpacity>
          </View>
        </JournalCard>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary name="TodaysFocusReactQuery">
      <JournalCard
        icon={hasContent || shouldShowEditingMode ? (
          <MaterialIcons
            name="filter-center-focus"
            size={24}
            color={Colors.alertCoral}
          />
        ) : undefined}
        title={(hasContent || shouldShowEditingMode) ? focusState.eyebrow.toUpperCase() : undefined}
        subtitle={(hasContent || shouldShowEditingMode) ? focusState.subtitle : undefined}
        showAddButton={(hasContent || shouldShowEditingMode) ? !shouldShowEditingMode : false}
        onAdd={toggleEditing}
        isAdding={shouldShowEditingMode}
        headerRight={planningGating.lockIconVisible ? (
          <PlanningLockIcon
            tier={planningGating.currentTier}
            context="inApp"
            onLockTap={planningGating.handleLockedAction}
            size={16}
          />
        ) : undefined}
        variant={variant}
        viewMode={viewMode}
        expanded={expanded}
        onExpand={onExpand}
      >
        {shouldShowEditingMode
          ? (
            <View style={styles.editContainer}>
              {!globalEditMode?.isGlobalEditMode && (
                <ThemedText weight="semiBold" style={styles.sectionHeaderWithBottomMargin}>{focusState.eyebrow.toUpperCase()}</ThemedText>
              )}
              <SwipeableTodoItem
                key="swipeable-focus"
                item={{
                  id: 'main-focus',
                  text: data.focus || ' ',
                  completed: false,
                }}
                onToggle={() => {}}
                onDelete={() => {}}
                disableSwipe={true}
                hideCheckbox={true}
                variant="gratitude"
              >
                <TextInput
                  style={[styles.input, styles.focusInput, { fontFamily: fontRegular }]}
                  value={data.focus}
                  onChangeText={updateFocus}
                  placeholder={isToday(day) ? "What's your main focus today?" : focusState.title}
                  placeholderTextColor={Colors.textGray}
                  autoFocus
                  accessibilityLabel="Today's focus input"
                  accessibilityHint="Enter your main focus for today"
                />
              </SwipeableTodoItem>
              <ThemedText weight="semiBold" style={styles.sectionHeaderWithTopMargin}>TOP 3 PRIORITIES</ThemedText>
              {data.priorities.map((priority, index) => (
                <View key={`priority-${index}`} style={styles.priorityRow}>
                  <ThemedText style={styles.priorityNumber}>{index + 1}.</ThemedText>
                  <TextInput
                    style={[styles.input, styles.priorityInput, { fontFamily: fontRegular }]}
                    value={priority.text}
                    onChangeText={(text) => updatePriority(index, text)}
                    placeholder={`Priority ${index + 1}...`}
                    placeholderTextColor={Colors.textGray}
                    onSubmitEditing={toggleEditing}
                    accessibilityLabel={`Priority ${index + 1} input`}
                    accessibilityHint={`Enter your ${index === 0 ? 'first' : index === 1 ? 'second' : 'third'} priority for today`}
                  />
                </View>
              ))}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  onPress={() => {
                    triggerLightHaptic();
                    handleCancel();
                  }}
                  style={[styles.button, styles.cancelButton]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing focus"
                  accessibilityHint="Cancels your changes and closes the edit form"
                >
                  <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    triggerLightHaptic();
                    toggleEditing();
                  }}
                  style={[
                    styles.button,
                    styles.saveButton,
                    !canSave && styles.disabledButton,
                  ]}
                  disabled={!canSave}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Save focus and priorities"
                  accessibilityHint="Saves your focus and priorities and closes the edit form"
                  accessibilityState={{ disabled: !canSave }}
                >
                  <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
                </TouchableOpacity>
              </View>
            </View>
          )
          : (
            ((data.focus || '').trim() || data.priorities.some(p => p.text.trim() !== ''))
              ? (
                <View style={styles.viewContainer}>
                  {data.focus && <ThemedText weight="semiBold" style={styles.focusText}>{data.focus}</ThemedText>}
                  {data.personalText && <ThemedText style={styles.personalText}>{data.personalText}</ThemedText>}
                  <View style={styles.prioritiesList}>
                    {data.priorities.some(p => p.text.trim() !== '') && (() => {
                      const priorityCount = data.priorities.filter(p => p.text.trim() !== '').length;
                      const priorityText = priorityCount === 1 ? 'TOP PRIORITY' : `TOP ${priorityCount} PRIORITIES`;
                      return <ThemedText weight="medium" style={styles.prioritiesTitle}>{priorityText}</ThemedText>;
                    })()}
                    {data.priorities
// ...
                      .filter(p => p.text.trim() !== '')
                      .map((priority, index) => (
                        <SwipeableTodoItem
                          key={`swipeable-priority-${index}`}
                          item={{
                            id: priority.id,
                            text: priority.text,
                            completed: priority.completed,
                          }}
                          onToggle={() => togglePriority(index)}
                          onDelete={() => {}}
                          disableSwipe={true}
                          containerStyle={styles.priorityItemWrapper}
                          ref={ref => {
                            if (ref) {
                              swipeableRefs.current[priority.id] = ref;
                            } else {
                              delete swipeableRefs.current[priority.id];
                            }
                          }}
                        >
                          {editingPriorityId === priority.id ? (
                            <View style={styles.editPriorityContainer}>
                              <TextInput
                                style={[styles.editPriorityInput, { fontFamily: fontRegular }]}
                                value={editingPriorityText}
                                onChangeText={setEditingPriorityText}
                                autoFocus
                                multiline
                                onSubmitEditing={saveEditedPriority}
                                returnKeyType="done"
                                blurOnSubmit={false}
                              />
                              <View style={styles.editPriorityButtons}>
                                <TouchableOpacity
                                  onPress={() => {
                                    triggerLightHaptic();
                                    cancelEditPriority();
                                  }}
                                  style={[styles.editPriorityActionButton, styles.editPriorityCancelButton]}
                                >
                                  <Ionicons name="close" size={16} color={Colors.hopeWhite} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => {
                                    triggerLightHaptic();
                                    saveEditedPriority();
                                  }}
                                  style={[styles.editPriorityActionButton, styles.editPrioritySaveButton]}
                                  disabled={!editingPriorityText.trim()}
                                >
                                  <Ionicons name="checkmark" size={16} color={Colors.hopeWhite} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <ThemedText
                              style={[
                                styles.priorityText,
                                priority.completed && styles.completedText,
                              ]}
                            >
                              {priority.text}
                            </ThemedText>
                          )}
                        </SwipeableTodoItem>
                      ))
                    }
                  </View>
                </View>
              )
              : (
                <View style={styles.emptyStateContainer}>
                  <View style={styles.iconContainer}>
                    <MaterialIcons
                      name="filter-center-focus"
                      size={32}
                      color={Colors.textGray}
                      style={styles.emptyStateIcon}
                    />
                    <ThemedText weight="semiBold" style={styles.sectionLabel} accessibilityRole="text">{focusState.eyebrow.toUpperCase()}</ThemedText>
                  </View>
                  <View style={styles.titleContainer}>
                    <ThemedText
                      weight="semiBold"
                      style={styles.emptyStateTitle}
                      accessibilityRole="header"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {focusState.title}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.emptyStateSubtext} accessibilityRole="text">{focusState.subtitle}</ThemedText>
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={() => {
                      triggerLightHaptic();
                      toggleEditing();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={focusState.ctaLabel}
                  >
                    <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
                    <ThemedText weight="medium" style={styles.emptyStateButtonText}>{focusState.ctaLabel}</ThemedText>
                  </TouchableOpacity>
                </View>
              )
          )
        }
    </JournalCard>
  </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  // Container styles
  editContainer: {
    padding: 0,
  },
  editButton: {
    padding: 4,
    borderRadius: 4,
  },
  viewContainer: {
    padding: 0,
  },
  focusContainer: {
    marginBottom: 8,
  },
  prioritiesList: {
    marginTop: 0,
  },
  priorityItemWrapper: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    padding: 20,
    width: '100%',
    marginBottom: 4,
  },
  prioritiesContainer: {
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 16,
    padding: 12,
    backgroundColor: Colors.hopeWhite,
  },

  // Text styles
  label: {
    // weight handled by ThemedText when used
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 8,
  },
  sectionHeader: {
    // weight handled by ThemedText
    fontSize: 12,
    color: Colors.hopeWhite,
    marginBottom: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionHeaderWithBottomMargin: {
    // weight handled by ThemedText
    fontSize: 12,
    color: Colors.hopeWhite,
    marginBottom: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionHeaderWithTopMargin: {
    // weight handled by ThemedText
    fontSize: 12,
    color: Colors.hopeWhite,
    marginTop: 12,
    marginBottom: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  focusText: {
    // weight handled by ThemedText
    fontSize: 20,
    color: Colors.hopeWhite,
    marginBottom: 8,
    lineHeight: 26,
    textAlign: 'center',
  },
  personalText: {
    // weight handled by ThemedText
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
    lineHeight: 20,
    textAlign: 'center',
  },
  placeholderText: {
    // weight handled by ThemedText if used
    fontSize: 14,
    color: Colors.textGray,
    fontStyle: 'italic',
    marginBottom: 8,
    textDecorationLine: 'none',
  },
  hintText: {
    // weight handled by ThemedText if used
    fontSize: 12,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 8,
  },
  input: {
    flex: 1,
    height: 40,
    // fontFamily applied from theme at usage
    fontSize: 13,
    color: Colors.hopeWhite,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 0,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
  },
  focusInput: {
    fontSize: 14,
    marginBottom: 12,
    height: 48,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    textAlign: 'left',
    color: Colors.hopeWhite,
  },
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    marginBottom: 4,
    width: '100%',
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    padding: 0,
    minHeight: 36,
  },
  priorityBullet: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: Colors.alertCoral,
    marginRight: 12,
  },
  priorityText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    flex: 1,
    lineHeight: 22,
    opacity: 1,
    textAlign: 'left',
  },

  // Edit priority styles
  editPriorityContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editPriorityInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    color: Colors.hopeWhite,
  },
  editPriorityButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  editPriorityActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editPriorityCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editPrioritySaveButton: {
    backgroundColor: Colors.growthGreen,
  },

  priorityNumber: {
    fontSize: 16,
    color: Colors.textGray,
    width: 24,
  },
  priorityInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 6,
    marginBottom: 0,
    height: 40,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    textAlign: 'left',
    color: Colors.hopeWhite,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    padding: 0,
    gap: 8,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  disabledButton: {
    opacity: 0.5,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: Colors.textGray,
    opacity: 0.7,
  },
  buttonSpacing: {
    marginRight: 0,
  },
  prioritiesTitle: {
    fontSize: 11,
    color: Colors.hopeWhite,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 16,
    textAlign: 'left',
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textGray,
    textAlign: 'center',
    padding: 16,
  },

  // Error state styles
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 8,
  },
  errorText: {
    color: Colors.alertCoral,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
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
    fontSize: 12,
    color: Colors.textGray,
    letterSpacing: 1.2,
    opacity: 0.9,
    textTransform: 'uppercase',
  },
  titleContainer: {
    width: '100%',
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  emptyStateButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  emptyStateButtonText: {
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  retryButton: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'center',
  },
  retryText: {
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    fontSize: 12,
  },
});

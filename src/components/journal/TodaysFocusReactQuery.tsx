import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SwipeableTodoItem } from '../SwipeableTodoItem';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
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
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';

interface PriorityItem {
  id: string;
  text: string;
  completed: boolean;
}

interface TodayFocusData {
  focus: string;
  priorities: PriorityItem[];
}

interface TodaysFocusProps {
  selectedDate?: Date;
  refreshKey?: number;
  variant?: 'carousel' | 'inline';
  viewMode?: 'carousel' | 'inline' | 'moments';
  expanded?: boolean;
  onExpand?: () => void;
}

export const TodaysFocusReactQuery: React.FC<TodaysFocusProps> = ({ selectedDate = new Date(), variant = 'carousel', viewMode, expanded, onExpand }) => {
  // Global edit mode context (only for inline view)
  // Global edit mode context - safe version that handles missing provider
  const globalEditMode = useEditModeSafe();


  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);

  // React Query hooks with performance tracking
  const loadStartTime = useRef<number>(Date.now());
  const { data: focusEntries = [], error, isLoading } = useTodaysFocusData(user?.id || '', dateStr);

  const createMutation = useCreateJournalEntry();
  const updateMutation = useUpdateJournalEntry();



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
          priorities,
        };
      } catch (parseError) {
        return {
          focus: '',
          priorities: [
            { id: 'fallback_1', text: '', completed: false },
            { id: 'fallback_2', text: '', completed: false },
            { id: 'fallback_3', text: '', completed: false },
          ],
        };
      }
    })() : {
      focus: '',
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
  const swipeableRefs = useRef<{[key: string]: any}>({});
  const originalData = useRef<TodayFocusData>({ ...data });

  // Determine if we should be in editing mode
  const shouldShowEditingMode = isEditing || (globalEditMode?.isGlobalEditMode && viewMode === 'inline');

  // Reset state when date changes or data loads
  React.useEffect(() => {
    setData({ ...initialData });
    originalData.current = { ...initialData };
    setIsEditing(false);
  }, [dateStr, initialData]);

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

      if (existingEntry) {
        // Update existing entry
        await updateMutation.mutateAsync({
          id: existingEntry.id,
          updates: {
            content: contentToSave,
          },
        });
      } else {
        // Create new entry
        await createMutation.mutateAsync({
          user_id: user.id,
          selected_date: dateStr,
          content_type: 'todays_focus',
          content: contentToSave,
        });
      }

      // Track successful focus update
      analytics.trackFocusEvent('focus_updated', {
        focus_length: focusData.focus.length,
        has_priorities: focusData.priorities.some(p => p.text.trim() !== ''),
        priorities_count: focusData.priorities.filter(p => p.text.trim() !== '').length,
        date: dateStr,
      }, user.id);

      setIsEditing(false);
    } catch (saveError) {
      Alert.alert('Error', 'Failed to save today\'s focus. Please try again.');
      throw saveError;
    }
  }, [user, dateStr, existingEntry, createMutation, updateMutation]);

  const toggleEditing = () => {
    if (isEditing) {
      // Save when exiting edit mode
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
      // Enter edit mode - ensure we have exactly 3 priorities
      const currentPriorities = data.priorities;
      const ensuredPriorities = [
        currentPriorities[0] || { id: '1', text: '', completed: false },
        currentPriorities[1] || { id: '2', text: '', completed: false },
        currentPriorities[2] || { id: '3', text: '', completed: false },
      ];

      const editData = {
        ...data,
        priorities: ensuredPriorities,
      };

      originalData.current = { ...editData };
      setData(editData);
      setIsEditing(true);
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

  const togglePriority = (index: number) => {
    setData(prev => {
      const newPriorities = prev.priorities.map((p, i) => {
        if (i === index) {
          const newCompleted = !p.completed;

          // Track priority completion
          if (newCompleted && p.text.trim()) {
            analytics.trackFocusEvent('focus_priority_completed', {
              priority_index: index,
              priority_text_length: p.text.length,
              date: dateStr,
            }, user?.id);
          }

          return { ...p, completed: newCompleted };
        }
        return p;
      });

      return {
        ...prev,
        priorities: newPriorities,
      };
    });
  };

  const removePriority = (priorityId: string) => {
    Alert.alert(
      'Remove Priority',
      'Are you sure you want to remove this priority?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setData(prev => ({
              ...prev,
              priorities: prev.priorities.filter(p => p.id !== priorityId),
            }));
          },
        },
      ]
    );
  };

  // Individual priority edit handlers
  const editPriority = (priorityId: string) => {
    const priority = data.priorities.find(p => p.id === priorityId);
    if (!priority) {return;}

    setEditingPriorityId(priorityId);
    setEditingPriorityText(priority.text);
    // Close all swipeables
    Object.values(swipeableRefs.current).forEach(ref => {
      if (ref?.close) {ref.close();}
    });
  };

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
    } catch (saveError) {
      console.error('Failed to save edited priority:', saveError);
      Alert.alert('Error', 'Failed to save priority. Please try again.');
    }
  };

  const cancelEditPriority = () => {
    setEditingPriorityId(null);
    setEditingPriorityText('');
  };

  const hasContent = data.focus.trim() || data.priorities.some(p => p.text.trim());
  const canSave = hasContent && (createMutation.isPending || updateMutation.isPending) === false;

  // Hide empty component in inline and moments view, but always show in carousel
  if ((viewMode === 'inline' || viewMode === 'moments') && !isLoading && !hasContent) {
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
            <Text style={styles.errorText}>
              Failed to load today's focus. Please try again.
            </Text>
            <TouchableOpacity
              onPress={() => {
                // Trigger a refetch by calling the query again
                // In React Native, we don't have window.location.reload
                console.log('Retry loading focus data');
              }}
              style={styles.retryButton}
              accessibilityRole="button"
              accessibilityLabel="Retry loading today's focus"
              accessibilityHint="Attempts to reload your focus and priorities"
            >
              <Text style={styles.retryText}>Retry</Text>
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
        title={hasContent || shouldShowEditingMode ? "TODAY'S FOCUS" : undefined}
        subtitle={hasContent || shouldShowEditingMode ? 'Your daily focus and priorities' : undefined}
        showAddButton={(hasContent || shouldShowEditingMode) ? !shouldShowEditingMode : false}
        onAdd={toggleEditing}
        isAdding={shouldShowEditingMode}
        headerRight={undefined}
        variant={variant}
        viewMode={viewMode}
        expanded={expanded}
        onExpand={onExpand}
      >
        {shouldShowEditingMode
          ? (
            <View style={styles.editContainer}>
              {!globalEditMode?.isGlobalEditMode && (
                <Text style={styles.sectionHeaderWithBottomMargin}>TODAY'S FOCUS</Text>
              )}
              <TextInput
                style={[styles.input, styles.focusInput]}
                value={data.focus}
                onChangeText={updateFocus}
                placeholder="What's your main focus today?"
                placeholderTextColor={Colors.mediumGray}
                autoFocus
                accessibilityLabel="Today's focus input"
                accessibilityHint="Enter your main focus for today"
              />
              <Text style={styles.sectionHeaderWithTopMargin}>TOP 3 PRIORITIES</Text>
              {data.priorities.map((priority, index) => (
                <View key={`priority-${index}`} style={styles.priorityRow}>
                  <Text style={styles.priorityNumber}>{index + 1}.</Text>
                  <TextInput
                    style={[styles.input, styles.priorityInput]}
                    value={priority.text}
                    onChangeText={(text) => updatePriority(index, text)}
                    placeholder={`Priority ${index + 1}...`}
                    placeholderTextColor={Colors.mediumGray}
                    onSubmitEditing={toggleEditing}
                    accessibilityLabel={`Priority ${index + 1} input`}
                    accessibilityHint={`Enter your ${index === 0 ? 'first' : index === 1 ? 'second' : 'third'} priority for today`}
                  />
                </View>
              ))}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  onPress={handleCancel}
                  style={[styles.button, styles.cancelButton]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing focus"
                  accessibilityHint="Cancels your changes and closes the edit form"
                >
                  <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleEditing}
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
                  {data.focus && <Text style={styles.focusText}>{data.focus}</Text>}
                  <View style={styles.prioritiesList}>
                    {data.priorities.some(p => p.text.trim() !== '') && (() => {
                      const priorityCount = data.priorities.filter(p => p.text.trim() !== '').length;
                      const priorityText = priorityCount === 1 ? 'TOP PRIORITY' : `TOP ${priorityCount} PRIORITIES`;
                      return <Text style={styles.prioritiesTitle}>{priorityText}</Text>;
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
                          onDelete={() => removePriority(priority.id)}
                          onEdit={() => editPriority(priority.id)}
                          hideCheckbox={true}
                          disableSwipe={viewMode === 'carousel' && !expanded}
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
                                style={styles.editPriorityInput}
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
                                  onPress={cancelEditPriority}
                                  style={[styles.editPriorityActionButton, styles.editPriorityCancelButton]}
                                >
                                  <Ionicons name="close" size={16} color={Colors.hopeWhite} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={saveEditedPriority}
                                  style={[styles.editPriorityActionButton, styles.editPrioritySaveButton]}
                                  disabled={!editingPriorityText.trim()}
                                >
                                  <Ionicons name="checkmark" size={16} color={Colors.hopeWhite} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <>
                              <View style={[styles.tickBox, priority.completed && styles.tickBoxCompleted]}>
                                {priority.completed && (
                                  <Check size={10} color={Colors.hopeWhite} strokeWidth={3.5} />
                                )}
                              </View>
                              <Text
                                style={[
                                  styles.priorityText,
                                  priority.completed && styles.completedText,
                                ]}>
                                {priority.text}
                              </Text>
                            </>
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
                      color={Colors.mediumGray}
                      style={styles.emptyStateIcon}
                    />
                    <Text style={styles.sectionLabel} accessibilityRole="text">TODAY'S FOCUS</Text>
                  </View>
                  <View style={styles.titleContainer}>
                    <Text
                      style={styles.emptyStateTitle}
                      accessibilityRole="header"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      Get Ready for a Great Day
                    </Text>
                  </View>
                  <Text style={styles.emptyStateSubtext} accessibilityRole="text">
                    Set your focus and priorities to make today count in faith and action.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={toggleEditing}
                    accessibilityRole="button"
                    accessibilityLabel="Begin setting today's focus"
                  >
                    <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
                    <Text style={styles.emptyStateButtonText}>Begin</Text>
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
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 8,
  },
  sectionHeader: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.hopeWhite,
    marginBottom: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  sectionHeaderWithBottomMargin: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.hopeWhite,
    marginBottom: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  sectionHeaderWithTopMargin: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.hopeWhite,
    marginTop: 12,
    marginBottom: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  focusText: {
    fontFamily: Fonts.semiBold,
    fontSize: 20,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 8,
    lineHeight: 26,
    textAlign: 'center',
  },
  placeholderText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.mediumGray,
    fontStyle: 'italic',
    marginBottom: 8,
    textDecorationLine: 'none',
  },
  hintText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginTop: 8,
  },
  input: {
    flex: 1,
    height: 40,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.darkGray,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 0,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
  },
  focusInput: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 12,
    fontFamily: Fonts.medium,
    height: 48,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    textAlign: 'center',
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
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    fontFamily: Fonts.medium,
    fontSize: 16,
    color: Colors.mediumGray,
    width: 24,
  },
  priorityInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    fontSize: 16,
    marginLeft: 6,
    marginBottom: 0,
    height: 40,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    textAlign: 'left',
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
    color: Colors.mediumGray,
    opacity: 0.7,
  },
  buttonSpacing: {
    marginRight: 0,
  },
  tickBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.trustGrey,
    backgroundColor: 'rgba(176, 184, 193, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tickBoxCompleted: {
    backgroundColor: Colors.growthGreen,
    borderColor: Colors.growthGreen,
  },
  prioritiesTitle: {
    fontFamily: Fonts.medium,
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
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 13,
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
    fontFamily: Fonts.regular,
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
  retryButton: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'center',
  },
  retryText: {
    fontFamily: Fonts.medium,
    color: Colors.hopeWhite,
    fontSize: 12,
  },
});

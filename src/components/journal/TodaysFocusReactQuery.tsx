import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SwipeableTodoItem } from '../SwipeableTodoItem';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { JournalCard } from './JournalCard';
import { Check, Goal as LuGoal, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  useTodaysFocusData,
  useCreateJournalEntry,
  useUpdateJournalEntry,
} from '../../services/hooks/useJournalData';
import { ComponentErrorBoundary } from '../ErrorBoundary';
import { TodaysFocusSkeleton } from '../SkeletonLoader/TodaysFocusSkeleton';
import { analytics } from '../../utils/analytics';

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
}

export const TodaysFocusReactQuery: React.FC<TodaysFocusProps> = ({ selectedDate = new Date() }) => {
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
        return {
          focus: parsedContent.focus || '',
          priorities: parsedContent.priorities || [
            { id: '1', text: '', completed: false },
            { id: '2', text: '', completed: false },
            { id: '3', text: '', completed: false },
          ],
        };
      } catch (parseError) {
        return {
          focus: '',
          priorities: [
            { id: '1', text: '', completed: false },
            { id: '2', text: '', completed: false },
            { id: '3', text: '', completed: false },
          ],
        };
      }
    })() : {
      focus: '',
      priorities: [
        { id: '1', text: '', completed: false },
        { id: '2', text: '', completed: false },
        { id: '3', text: '', completed: false },
      ],
    };

    return result;
  }, [existingEntry]);

  const [data, setData] = useState<TodayFocusData>(initialData);
  const [isEditing, setIsEditing] = useState(false);
  const swipeableRefs = useRef<{[key: string]: any}>({});
  const originalData = useRef<TodayFocusData>({ ...data });

  // Reset state when date changes or data loads
  React.useEffect(() => {
    setData({ ...initialData });
    originalData.current = { ...initialData };
    setIsEditing(false);
  }, [dateStr, initialData]);

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
      
      Alert.alert('Error', 'Failed to load today\'s focus.');
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
        }).catch(() => {
          // Error already handled in saveFocus
        });
      } else {
        setIsEditing(false);
      }
    } else {
      // Enter edit mode
      originalData.current = { ...data };
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



  const hasContent = data.focus.trim() || data.priorities.some(p => p.text.trim());
  const canSave = hasContent && (createMutation.isPending || updateMutation.isPending) === false;

  // Handle loading state with skeleton loader
  if (isLoading) {
    return (
      <ComponentErrorBoundary name="TodaysFocusReactQuery">
        <JournalCard
          icon={
            <LuGoal
              size={24}
              color={Colors.alertCoral}
              strokeWidth={2.5}
            />
          }
          title="Today's Focus"
          subtitle="Your daily focus and priorities"
          showAddButton={true}
          onAdd={() => {}} // Disabled during loading
        >
          <TodaysFocusSkeleton />
        </JournalCard>
      </ComponentErrorBoundary>
    );
  }

  return (
    <ComponentErrorBoundary name="TodaysFocusReactQuery">
      <JournalCard
      icon={
        <LuGoal
          size={24}
          color={Colors.alertCoral}
          strokeWidth={2.5}
        />
      }
      title="Today's Focus"
      subtitle="Your daily focus and priorities"
      showAddButton={!isEditing}
      onAdd={toggleEditing}
      isAdding={isEditing}
    >
      {isEditing
        ? (
          <View style={styles.editContainer}>
            <Text style={styles.sectionHeaderWithBottomMargin}>Today's Focus</Text>
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
            <Text style={styles.sectionHeaderWithTopMargin}>TOP PRIORITIES</Text>
            {data.priorities.map((priority, index) => (
              <View key={priority.id} style={styles.priorityRow}>
                <Text style={styles.priorityNumber}>{index + 1}.</Text>
                <TextInput
                  style={[styles.input, styles.priorityInput]}
                  value={priority.text}
                  onChangeText={(text) => updatePriority(index, text)}
                  placeholder={`Priority ${index + 1}`}
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
                  {data.priorities.some(p => p.text.trim() !== '') && (
                    <Text style={styles.prioritiesTitle}>TOP PRIORITIES</Text>
                  )}
                  {data.priorities
                    .filter(p => p.text.trim() !== '')
                    .map((priority, index) => (
                      <SwipeableTodoItem
                        key={priority.id}
                        item={{
                          id: priority.id,
                          text: priority.text,
                          completed: priority.completed,
                        }}
                        onToggle={() => togglePriority(index)}
                        onDelete={() => removePriority(priority.id)}
                        hideCheckbox={true}
                        ref={ref => {
                          if (ref) {
                            swipeableRefs.current[priority.id] = ref;
                          } else {
                            delete swipeableRefs.current[priority.id];
                          }
                        }}
                      >
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
                      </SwipeableTodoItem>
                    ))
                  }
                </View>
              </View>
            )
            : null
        )
      }
    </JournalCard>
    </ComponentErrorBoundary>
  );
};

const styles = StyleSheet.create({
  // Container styles
  editContainer: {
    padding: 0,
  },
  viewContainer: {
    padding: 0,
  },
  prioritiesList: {
    marginTop: 4,
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
    borderRadius: 8,
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
    color: Colors.anchorBlue,
    marginBottom: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  sectionHeaderWithBottomMargin: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.anchorBlue,
    marginBottom: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  sectionHeaderWithTopMargin: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.anchorBlue,
    marginTop: 24,
    marginBottom: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  focusText: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.darkerGray,
    marginBottom: 8,
    lineHeight: 24,
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
    marginBottom: 8,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
  },
  focusInput: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 12,
    fontFamily: Fonts.medium,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: '#ebeef2',
    borderRadius: 6,
    paddingVertical: 8,
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
    borderRadius: 4,
    backgroundColor: Colors.alertCoral,
    marginRight: 12,
  },
  priorityText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.darkGray,
    flex: 1,
    lineHeight: 18,
    opacity: 0.9,
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
    color: Colors.darkGray,
    fontSize: 14,
    marginLeft: 6,
    marginBottom: 4,
    height: 36,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 6,
    paddingHorizontal: 8,
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
    borderRadius: 3,
    borderWidth: 1.5,
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
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: Colors.anchorBlue,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
    marginBottom: 4,
    fontWeight: '600',
  },
  loadingText: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 13,
    textAlign: 'center',
    padding: 16,
  },
});

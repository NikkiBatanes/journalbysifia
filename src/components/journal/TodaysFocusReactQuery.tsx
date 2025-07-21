import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SwipeableTodoItem } from '../SwipeableTodoItem';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { JournalCard } from './JournalCard';
import { Check, Goal as LuGoal, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { toLocalDateString } from '../../utils/date';
import { 
  useTodaysFocusData, 
  useCreateTodaysFocusEntry, 
  useUpdateTodaysFocusEntry, 
  useDeleteTodaysFocusEntry 
} from '../../services/hooks/useJournalData';

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

export const TodaysFocusReactQuery: React.FC<TodaysFocusProps> = ({ 
  selectedDate = new Date(), 
  refreshKey = 0 
}) => {
  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);
  const userId = user?.id || '';

  // React Query hooks
  const { data: entries = [], isLoading, error } = useTodaysFocusData(userId, dateStr);
  const createMutation = useCreateTodaysFocusEntry();
  const updateMutation = useUpdateTodaysFocusEntry();
  const deleteMutation = useDeleteTodaysFocusEntry();

  // Get the first entry (TodaysFocus typically has one entry)
  const entry = entries.length > 0 ? entries[0] : null;
  
  // Memoize focusData to prevent infinite loops
  const focusData = useMemo(() => {
    if (!entry) return null;
    
    try {
      const content = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
      return {
        focus: content?.focus || '',
        priorities: content?.priorities || [
          { id: '1', text: '', completed: false },
          { id: '2', text: '', completed: false },
          { id: '3', text: '', completed: false },
        ]
      };
    } catch {
      return {
        focus: '',
        priorities: [
          { id: '1', text: '', completed: false },
          { id: '2', text: '', completed: false },
          { id: '3', text: '', completed: false },
        ]
      };
    }
  }, [entry]);

  // Local state for editing
  const [data, setData] = useState<TodayFocusData>({
    focus: '',
    priorities: [
      { id: '1', text: '', completed: false },
      { id: '2', text: '', completed: false },
      { id: '3', text: '', completed: false },
    ],
  });
  const [isEditing, setIsEditing] = useState(false);
  const swipeableRefs = useRef<{[key: string]: any}>({});
  const originalData = useRef<TodayFocusData>({ ...data });

  // Immediately reset state to default when date changes (prevents stale data)
  React.useEffect(() => {
    setData({
      focus: '',
      priorities: [
        { id: '1', text: '', completed: false },
        { id: '2', text: '', completed: false },
        { id: '3', text: '', completed: false },
      ],
    });
    setIsEditing(false);
    console.log('Resetting Today\'s Focus state to default for date:', dateStr);
  }, [dateStr]);

  // Initialize data when focusData changes (only when not editing)
  React.useEffect(() => {
    if (focusData && !isEditing) {
      // Only update if the data is actually different to prevent unnecessary re-renders
      const isDifferent = 
        focusData.focus !== data.focus ||
        JSON.stringify(focusData.priorities) !== JSON.stringify(data.priorities);
      
      if (isDifferent) {
        console.log('📝 TodaysFocus: Updating data from server for date:', dateStr);
        setData(focusData);
      }
    }
  }, [focusData, isEditing, dateStr]); // Removed data.focus and data.priorities to prevent loops

  // Save focus data
  const saveFocus = useCallback(async (focusData: TodayFocusData) => {
    if (!user) return;

    if (entry) {
      // Update existing entry
      updateMutation.mutate({
        id: entry.id,
        updates: {
          content: JSON.stringify(focusData)
        }
      });
    } else {
      // Create new entry
      createMutation.mutate({
        user_id: userId,
        selected_date: dateStr,
        content: JSON.stringify(focusData)
      });
    }
  }, [user, entry, updateMutation, createMutation, userId, dateStr]);

  const toggleEditing = () => {
    if (isEditing) {
      // Save changes
      saveFocus(data);
      setIsEditing(false);
    } else {
      // Start editing
      originalData.current = { ...data };
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setData(originalData.current);
    setIsEditing(false);
  };

  const updateFocus = (text: string) => {
    setData(prev => ({ ...prev, focus: text }));
  };

  const updatePriority = (index: number, text: string) => {
    setData(prev => ({
      ...prev,
      priorities: prev.priorities.map((priority, i) => 
        i === index ? { ...priority, text } : priority
      )
    }));
  };

  const togglePriority = useCallback((index: number) => {
    console.log('🔄 Toggle priority clicked for index:', index);
    
    // Optimistically update the UI immediately
    setData(prev => {
      const newPriorities = prev.priorities.map((priority, i) => 
        i === index ? { ...priority, completed: !priority.completed } : priority
      );
      
      const newData = { ...prev, priorities: newPriorities };
      console.log('✅ Local state updated optimistically:', newData.priorities[index]);
      
      // Save to database
      if (entry) {
        console.log('💾 Saving to database via update mutation');
        updateMutation.mutate({
          id: entry.id,
          updates: { content: JSON.stringify(newData) }
        }, {
          onSuccess: () => {
            console.log('✅ Database update successful');
          },
          onError: (error) => {
            // Revert on error
            console.error('❌ Failed to update priority:', error);
            setData(prev => ({
              ...prev,
              priorities: prev.priorities.map((p, i) => 
                i === index ? { ...p, completed: !p.completed } : p
              )
            }));
          }
        });
      } else if (user) {
        console.log('💾 Creating new entry via create mutation');
        createMutation.mutate({
          user_id: user.id,
          selected_date: dateStr,
          content: JSON.stringify(newData)
        });
      }
      
      return newData;
    });
  }, [entry, user, dateStr, updateMutation, createMutation]);

  const removePriority = useCallback((priorityId: string) => {
    // Close any open swipeable
    if (swipeableRefs.current[priorityId]) {
      swipeableRefs.current[priorityId].close();
    }
    
    // Store the current state for potential rollback
    const previousState = { ...data };
    
    // Optimistically update the UI
    setData(prev => {
      // Create new priorities array without the removed item
      const newPriorities = prev.priorities.filter(priority => priority.id !== priorityId);
      
      // Ensure we always have at least 3 priorities
      while (newPriorities.length < 3) {
        newPriorities.push({
          id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          text: '',
          completed: false
        });
      }
      
      return { ...prev, priorities: newPriorities };
    });
    
    // Update database in the background
    const updateDatabase = async () => {
      try {
        const newData = { ...data, 
          priorities: data.priorities
            .filter(p => p.id !== priorityId)
            .concat(Array(3 - (data.priorities.length - 1) > 0 ? 3 - (data.priorities.length - 1) : 0).fill(0).map(() => ({
              id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              text: '',
              completed: false
            })))
        };
        
        if (entry) {
          await updateMutation.mutateAsync({
            id: entry.id,
            updates: { content: JSON.stringify(newData) }
          });
        } else if (user) {
          await createMutation.mutateAsync({
            user_id: user.id,
            selected_date: dateStr,
            content: JSON.stringify(newData)
          });
        }
      } catch (error) {
        console.error('Failed to update priority:', error);
        // Revert on error
        setData(previousState);
      }
    };
    
    // Don't wait for the database update to complete
    updateDatabase();
  }, [data, entry, user, dateStr, updateMutation, createMutation]);

  // Check if data has meaningful content
  const hasContent = (data.focus || '').trim() || 
    data.priorities.some(p => (p.text || '').trim());

  // Loading state
  if (isLoading) {
    return (
      <JournalCard
        title="Today's Focus"
        subtitle="What's your main focus and top 3 priorities?"
        icon={<LuGoal size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
        showAddButton={false}
        onAdd={() => {}}
        isAdding={false}
        onCancelAdd={() => {}}
      >
        <View style={styles.container}>
          <Text style={[styles.focusText, { opacity: 0.5 }]}>Loading...</Text>
        </View>
      </JournalCard>
    );
  }

  // Error state
  if (error) {
    return (
      <JournalCard
        title="Today's Focus"
        subtitle="What's your main focus and top 3 priorities?"
        icon={<LuGoal size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
        showAddButton={false}
        onAdd={() => {}}
        isAdding={false}
        onCancelAdd={() => {}}
      >
        <View style={styles.container}>
          <Text style={[styles.focusText, { color: Colors.alertCoral }]}>
            Error loading focus. Tap to retry.
          </Text>
        </View>
      </JournalCard>
    );
  }

  return (
    <JournalCard
      title="Today's Focus"
      subtitle="Your daily focus and priorities"
      icon={<LuGoal size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
      showAddButton={!isEditing}
      onAdd={toggleEditing}
      isAdding={isEditing}
      onCancelAdd={handleCancel}
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
                />
              </View>
            ))}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, styles.buttonSpacing]}
                activeOpacity={1}
                onPress={handleCancel}
              >
                <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button, 
                  styles.saveButton, 
                  (!(data.focus || '').trim() && data.priorities.every(p => !p.text.trim())) && styles.disabledButton
                ]}
                activeOpacity={1}
                onPress={toggleEditing}
                disabled={!(data.focus || '').trim() && data.priorities.every(p => !p.text.trim())}
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
                        onToggle={() => togglePriority(data.priorities.findIndex(p => p.id === priority.id))}
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
                    ))}
                </View>
              </View>
            )
            : null
        )
      }
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 16,
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
  editHint: {
    alignItems: 'center',
    paddingVertical: 8,
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
    paddingHorizontal: 12,
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
  editContainer: {
    flex: 1,
  },
  viewContainer: {
    flex: 1,
  },
  prioritiesList: {
    marginTop: 8,
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
  completedText: {
    textDecorationLine: 'line-through',
    color: Colors.mediumGray,
    opacity: 0.7,
  },
});

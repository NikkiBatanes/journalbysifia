import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SwipeableTodoItem } from '../SwipeableTodoItem';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { JournalCard } from './JournalCard';
import { Check, Goal as LuGoal, X } from 'lucide-react-native';
import { getJournalKey, getLocalEntry, saveLocalEntry, syncToCloud, syncFromCloud, checkSession } from '../../storage/journalStorage';
import { useAuth } from '../../context/AuthContext';
import { toLocalDateString } from '../../utils/date';

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
}

export const TodaysFocus: React.FC<TodaysFocusProps> = ({ selectedDate = new Date() }) => {
  // Log for robust debugging
  const debugDate = selectedDate instanceof Date ? selectedDate.toISOString() : String(selectedDate);
  const dateStr = toLocalDateString(selectedDate);
  const contentType = 'todays_focus';
  const { user, loading: authLoading } = useAuth();
  const key = React.useMemo(() => user ? getJournalKey(contentType, dateStr, user.id) : '', [user, dateStr]);
  console.log('[TODAYS FOCUS] Render: user:', user, 'authLoading:', authLoading, 'dateStr:', dateStr, 'key:', key);

  const [data, setData] = useState<TodayFocusData>({
    focus: '',
    priorities: [
      { id: '1', text: '', completed: false },
      { id: '2', text: '', completed: false },
      { id: '3', text: '', completed: false },
    ],
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const swipeableRefs = useRef<{[key: string]: any}>({});

  // Store original data for cancel functionality
  const originalData = useRef<TodayFocusData>({ ...data });

  // Prevent save on first hydration after date change
  const hydratedRef = useRef(false);

  // Immediately reset state to default when date changes (prevents stale data)
  useEffect(() => {
    setData({
      focus: '',
      priorities: [
        { id: '1', text: '', completed: false },
        { id: '2', text: '', completed: false },
        { id: '3', text: '', completed: false },
      ],
    });
    hydratedRef.current = false;
    console.log('Resetting Today\'s Focus state to default for date:', dateStr);
  }, [dateStr]);

  // Hydrate Today's Focus from storage and cloud
  useEffect(() => {
    let isMounted = true;
    console.log('[TODAYS FOCUS] Hydration effect: user:', user, 'authLoading:', authLoading, 'dateStr:', dateStr, 'key:', key);
    
    const hydrateFocus = async () => {
      console.log('[TODAYS FOCUS] hydrateFocus running for date:', dateStr, 'key:', key);
      if (!user) {
        console.log('No user, skipping focus hydration');
        return;
      }
      
      console.log('Hydrating focus for date:', dateStr, 'with key:', key);
      
      // Immediately reset to default state when date changes
      const defaultData = {
        focus: '',
        priorities: [
          { id: '1', text: '', completed: false },
          { id: '2', text: '', completed: false },
          { id: '3', text: '', completed: false },
        ],
      };
      
      if (isMounted) {
        setData(defaultData);
        setLoading(true);
      }
      
      try {
        const { session: currentSession } = await checkSession();
        
        // Try to load local data
        console.log('Loading local focus...');
        const localEntry = await getLocalEntry(key);
        console.log('[TODAYS FOCUS] hydrateFocus: Local entry loaded:', localEntry);
        
        if (!isMounted) return;
        
        if (localEntry?.content) {
          console.log('Setting local data:', localEntry.content);
          setData(localEntry.content);
        } else {
          console.log('No local data found, using default');
          setData(defaultData);
        }
        
        // Sync from cloud (if newer, will update local)
        console.log('Syncing from cloud...');
        await syncFromCloud(user.id, dateStr, contentType);
        
        if (!isMounted) return;
        
        // Reload local after sync
        console.log('Reloading local data after sync...');
        const syncedEntry = await getLocalEntry(key);
        console.log('[TODAYS FOCUS] hydrateFocus: Synced entry loaded:', syncedEntry);
        
        if (!isMounted) return;
        
        if (syncedEntry?.content) {
          console.log('Setting synced data:', syncedEntry.content);
          setData(syncedEntry.content);
        } else {
          console.log('No synced data found, using default');
          setData(defaultData);
        }
        // Hydration complete, allow save effect to run
        hydratedRef.current = true;
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to hydrate today\'s focus:', err);
        Alert.alert('Error', 'Failed to load today\'s focus.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (!authLoading) {
      console.log('Auth loaded, starting hydration for date:', dateStr);
      hydrateFocus();
    }
    
    return () => {
      isMounted = false;
    };
  }, [user, authLoading, dateStr, key]); // Matches Todos pattern: always hydrate on date change to storage and cloud

  // Save Today's Focus to storage and cloud
  const saveFocus = async (focusData: TodayFocusData) => {
    if (!user) {
      console.error('No user found when trying to save today\'s focus');
      Alert.alert('Error', 'You must be logged in to save today\'s focus.');
      return Promise.reject('No user found');
    }
    setData(focusData);
    setSyncing(true);
    try {
      // Ensure the date is in the correct format (YYYY-MM-DD) and always local
      const formattedDate = toLocalDateString(selectedDate);
      
      const entryData = {
        content_type: contentType,
        content: focusData,
        selected_date: formattedDate,
        user_id: user.id,
      };
      
      console.log('Saving entry with data:', {
        key,
        dateStr,
        formattedDate,
        entryData
      });
      
      await saveLocalEntry(key, entryData, user.id)
      .then(() => {
        console.log('[TODAYS FOCUS] Successfully saved to local storage.');
      })
      .catch((err) => {
        console.error('[TODAYS FOCUS] Error saving to local storage:', err);
        Alert.alert('Error', 'Failed to save Today\'s Focus to local storage.');
        throw err;
      });
    
    // Use the formatted date for cloud sync as well (local date string)
    await syncToCloud(user.id, formattedDate, contentType)
      .then(() => {
        console.log('[TODAYS FOCUS] Background sync to cloud completed successfully');
      })
      .catch(err => {
        console.error('[TODAYS FOCUS] Background sync to cloud failed:', err);
        Alert.alert('Error', 'Failed to sync Today\'s Focus to the cloud.');
      });
    } catch (err) {
      console.error('Background save/sync error:', err);
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  // Save on data change (except during initial hydration)
  useEffect(() => {
    console.log('[TODAYS FOCUS] Save effect: hydratedRef:', hydratedRef.current, 'loading:', loading, 'user:', user);
    if (!hydratedRef.current) {
      // Block save if hydration is not complete
      return;
    }
    if (!loading && user) {
      console.log('[TODAYS FOCUS] Save effect running for date:', dateStr, 'with data:', data);
      saveFocus(data).catch((err) => {
        console.error('[TODAYS FOCUS] Save effect error:', err);
        Alert.alert('Error', 'Failed to save Today\'s Focus.');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const toggleEditing = () => {
    if (!isEditing) {
      // When starting to edit, save current state
      originalData.current = {
        focus: data.focus,
        priorities: data.priorities.map(p => ({ ...p })),
      };
    }
    setIsEditing(!isEditing);
  };

  const handleCancel = () => {
    // Reset to original data when canceling
    setData(prevData => ({
      ...prevData,
      focus: originalData.current.focus,
      priorities: [...originalData.current.priorities],
    }));
    setIsEditing(false);
  };

  const updateFocus = (text: string) => {
    setData(prev => ({ ...prev, focus: text }));
  };

  const updatePriority = (index: number, text: string) => {
    const newPriorities = [...data.priorities];
    newPriorities[index] = { ...newPriorities[index], text };
    setData(prev => ({ ...prev, priorities: newPriorities }));
  };

  const togglePriority = (index: number) => {
    const newPriorities = [...data.priorities];
    newPriorities[index] = {
      ...newPriorities[index],
      completed: !newPriorities[index].completed,
    };
    setData(prev => ({ ...prev, priorities: newPriorities }));
  };

  const removePriority = (priorityId: string) => {
    const priorityIndex = data.priorities.findIndex(p => p.id === priorityId);
    if (priorityIndex === -1) {return;}

    const newPriorities = [...data.priorities];
    newPriorities.splice(priorityIndex, 1);

    // Always maintain exactly 3 priorities
    while (newPriorities.length < 3) {
      newPriorities.push({
        id: Date.now() + Math.random().toString(),
        text: '',
        completed: false,
      });
    }

    setData(prev => ({ ...prev, priorities: newPriorities }));
  };


  return (
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
                style={[styles.button, styles.saveButton, (!data.focus.trim() && data.priorities.every(p => !p.text.trim())) && styles.disabledButton]}
                activeOpacity={1}
                onPress={toggleEditing}
                disabled={!data.focus.trim() && data.priorities.every(p => !p.text.trim())}
              >
                <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
            </View>
          </View>
        )
        : (
          (data.focus.trim() || data.priorities.some(p => p.text.trim() !== ''))
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
    color: Colors.darkerGray, // Using theme color for consistency
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

  // Input styles
  input: {
    flex: 1,
    height: 40, // Adjusted for better text alignment
    fontFamily: Fonts.regular,
    fontSize: 13, // Match priority item size
    color: Colors.darkGray,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Slightly transparent white
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)', // Subtle blue border
  },
  focusInput: {
    fontSize: 14, // Slightly larger than other inputs
    fontWeight: '400',
    marginBottom: 12,
    fontFamily: Fonts.medium,
    height: 44, // Slightly taller for main focus input
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // More opaque for main input
  },

  // Priority item styles
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: '#ebeef2', // Match todo items background
    borderRadius: 6,
    paddingVertical: 8,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    padding: 0,
    minHeight: 36, // Ensure consistent row height
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
    opacity: 0.9, // Slightly transparent for softer look
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
    height: 36, // Fixed height for priority inputs
    backgroundColor: Colors.hopeWhite,
    borderRadius: 6,
    paddingHorizontal: 8,
  },

  // Button styles
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    padding: 0,
    gap: 8,
  },
  buttonSpacing: {
    marginRight: 0,
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
  removeButton: {
    padding: 4,
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
  tickBoxText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 16,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: Colors.mediumGray,
    opacity: 0.7,
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
});

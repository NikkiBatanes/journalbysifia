import React, { useState, useRef, useCallback } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Modal, TouchableWithoutFeedback, FlatList } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Check, CalendarClock as LuCalendarClock, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  useTimeBlockData,
  useCreateTimeBlock,
  useUpdateTimeBlock,
  useDeleteTimeBlock,
} from '../../services/hooks/useTimeBlockData';

type RepeatFrequency = 'never' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';

interface TimeBlockItem {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  category: string;
  notes?: string;
  location?: string;
  isAllDay: boolean;
  repeat: {
    frequency: RepeatFrequency;
    endDate?: Date;
    customDays?: number[]; // For custom repeat
    customFrequency?: {
      value: number;
      unit: string;
    };
  };
}

const CATEGORIES = [
  { name: 'Appointments', icon: 'calendar' },
  { name: 'Break Time', icon: 'cafe' },
  { name: 'Career Growth', icon: 'rocket' },
  { name: 'Church Activities', icon: 'people' },
  { name: 'Deep Work', icon: 'code-working' },
  { name: 'Events', icon: 'calendar-number' },
  { name: 'Family Time', icon: 'people-circle' },
  { name: 'Life Admin', icon: 'document-text' },
  { name: 'Mental Health', icon: 'heart' },
  { name: 'Ministry', icon: 'hand-left' },
  { name: 'Personal Growth', icon: 'person' },
  { name: 'Physical Health', icon: 'barbell' },
  { name: 'Projects', icon: 'folder' },
  { name: 'Quiet Time', icon: 'book' },
  { name: 'Recreation', icon: 'airplane' },
  { name: 'Sleep & Recovery', icon: 'moon' },
  { name: 'Work Meetings', icon: 'briefcase' },
  { name: 'Others', icon: 'ellipsis-horizontal' },
];

const formatDuration = (start: Date, end: Date): string => {
  const diffInMs = end.getTime() - start.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffInHours > 0) {
    return diffInMinutes > 0 ? `${diffInHours}h ${diffInMinutes}m` : `${diffInHours}h`;
  }
  return `${diffInMinutes}m`;
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Helper function to format repeat text
const formatRepeatText = (frequency: RepeatFrequency, customDays?: number[], customFrequency?: { value: number, unit: string }): string => {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  switch (frequency) {
    case 'never':
      return 'Does not repeat';
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Bi-weekly';
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
    case 'custom':
      if (customFrequency) {
        const unit = customFrequency.unit.charAt(0).toUpperCase() + customFrequency.unit.slice(1) + (customFrequency.value > 1 ? 's' : '');
        if (customDays && customDays.length > 0 && customFrequency.unit === 'week') {
          const days = customDays.map(day => dayNames[day]).join(', ');
          return `Every ${customFrequency.value} ${unit} on ${days}`;
        }
        return `Every ${customFrequency.value} ${unit}`;
      }
      return 'Custom';
    default:
      return '';
  }
};

const getCategoryColor = (categoryName: string): string => {
  const colors = [Colors.alertCoral, Colors.anchorBlue, Colors.growthGreen, '#FF6B6B', '#4ECDC4', '#45B7D1'];
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash * 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

interface TimeBlockProps {
  selectedDate?: Date;
}

export const TimeBlockReactQuery: React.FC<TimeBlockProps> = ({ selectedDate = new Date() }) => {
  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);

  // React Query hooks
  const { data: timeBlockEntries = [], isLoading, error } = useTimeBlockData(user?.id || '', dateStr);
  const createMutation = useCreateTimeBlock();
  const updateMutation = useUpdateTimeBlock();
  const deleteMutation = useDeleteTimeBlock();

  // Transform API data to local format
  const timeBlocks: TimeBlockItem[] = timeBlockEntries.map(block => ({
    id: block.id,
    title: block.title,
    startTime: new Date(`${block.selected_date}T${block.start_time}`),
    endTime: new Date(`${block.selected_date}T${block.end_time}`),
    category: block.category,
    notes: block.notes,
    location: block.location,
    isAllDay: block.all_day,
    repeat: block.repeat_rule ? {
      frequency: (block.repeat_rule.frequency || 'never') as RepeatFrequency,
      endDate: block.repeat_until ? new Date(block.repeat_until) : undefined,
      customDays: block.repeat_rule.customDays,
      customFrequency: block.repeat_rule.customFrequency,
    } : {
      frequency: 'never' as RepeatFrequency,
      endDate: undefined,
      customDays: undefined,
      customFrequency: undefined,
    },
  }));

  // Local state
  const [expandedNotes, setExpandedNotes] = useState<{[key: string]: boolean}>({});
  const [isAdding, setIsAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5);
  const [showTitleError, setShowTitleError] = useState(false);
  const [showCategoryError, setShowCategoryError] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState<{start: boolean, end: boolean, id: string | null}>({ start: false, end: false, id: null });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showRepeatOptions, setShowRepeatOptions] = useState(false);
  const [_showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [_showFrequencySelector, setShowFrequencySelector] = useState(false);
  const [customFrequency, setCustomFrequency] = useState({ value: 1, unit: 'week' });
  const [_inputValue, setInputValue] = useState('1');

  const [newBlock, setNewBlock] = useState<{
    title: string;
    startTime: Date;
    endTime: Date;
    category: string;
    notes: string;
    location: string;
    isAllDay: boolean;
    repeat: {
      frequency: RepeatFrequency;
      endDate?: Date;
      customDays?: number[];
      customFrequency?: {
        value: number;
        unit: string;
      };
    };
  }>({
    title: '',
    startTime: new Date(),
    endTime: new Date(new Date().getTime() + 60 * 60 * 1000),
    category: '',
    notes: '',
    location: '',
    isAllDay: false,
    repeat: {
      frequency: 'never',
      endDate: undefined,
      customDays: undefined,
      customFrequency: undefined,
    },
  });

  const swipeableRefs = useRef<{[key: string]: any}>({});

  const toggleNotes = (id: string) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const closeAllSwipeables = useCallback(() => {
    Object.values(swipeableRefs.current).forEach(ref => {
      if (ref?.close) {ref.close();}
    });
  }, []);

  const handleEditBlock = (block: TimeBlockItem) => {
    setIsAdding(true);
    setEditId(block.id);
    setNewBlock({
      title: block.title,
      startTime: new Date(block.startTime),
      endTime: new Date(block.endTime),
      category: block.category,
      notes: block.notes || '',
      location: block.location || '',
      isAllDay: block.isAllDay,
      repeat: block.repeat,
    });
  };

  const handleDeleteBlock = async (id: string) => {
    Alert.alert('Delete Time Block', 'Are you sure you want to delete this time block?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync(id);
          } catch (deleteError) {
            Alert.alert('Error', 'Failed to delete time block');
          }
        },
      },
    ]);
  };

  const addTimeBlock = async () => {
    if (!user) {return;}

    if (!newBlock.title.trim()) {
      setShowTitleError(true);
      return;
    }
    if (!newBlock.category) {
      setShowCategoryError(true);
      return;
    }

    setShowTitleError(false);
    setShowCategoryError(false);

    try {
      const timeBlockData = {
        user_id: user.id,
        selected_date: dateStr,
        title: newBlock.title.trim(),
        start_time: newBlock.isAllDay ? '00:00:00' : newBlock.startTime.toTimeString().slice(0, 8),
        end_time: newBlock.isAllDay ? '23:59:59' : newBlock.endTime.toTimeString().slice(0, 8),
        category: newBlock.category,
        notes: newBlock.notes.trim() || undefined,
        location: newBlock.location.trim() || undefined,
        all_day: newBlock.isAllDay,
      };

      if (editId) {
        await updateMutation.mutateAsync({ id: editId, updates: timeBlockData });
      } else {
        await createMutation.mutateAsync(timeBlockData);
      }

      // Reset form
      setNewBlock({
        title: '',
        startTime: new Date(),
        endTime: new Date(new Date().getTime() + 60 * 60 * 1000),
        category: '',
        notes: '',
        location: '',
        isAllDay: false,
        repeat: {
          frequency: 'never',
          endDate: undefined,
          customDays: undefined,
          customFrequency: undefined,
        },
      });
      setIsAdding(false);
      setEditId(null);

    } catch (saveError) {
      Alert.alert('Error', 'Failed to save time block. Please try again.');
    }
  };

  const startAdding = () => {
    setNewBlock({
      title: '',
      startTime: new Date(),
      endTime: new Date(new Date().getTime() + 60 * 60 * 1000),
      category: '',
      notes: '',
      location: '',
      isAllDay: false,
      repeat: {
        frequency: 'never',
        endDate: undefined,
        customDays: undefined,
        customFrequency: undefined,
      },
    });
    setEditId(null);
    setIsAdding(true);
    setShowTitleError(false);
    setShowCategoryError(false);
    setShowCategoryPicker(false);
    setShowRepeatOptions(false);
    setShowEndDatePicker(false);
    setShowFrequencySelector(false);
    setCustomFrequency({ value: 1, unit: 'week' });
    setInputValue('1');
  };

  const onTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    if (event.type === 'dismissed') {
      setShowTimePicker({ start: false, end: false, id: null });
      return;
    }
    if (selectedTime) {
      if (showTimePicker.start) {
        setNewBlock(prev => ({ ...prev, startTime: selectedTime }));
      } else if (showTimePicker.end) {
        setNewBlock(prev => ({ ...prev, endTime: selectedTime }));
      }
    }
    setShowTimePicker({ start: false, end: false, id: null });
  };

  const toggleAllDay = () => {
    setNewBlock(prev => ({ ...prev, isAllDay: !prev.isAllDay }));
  };

  React.useEffect(() => {
    if (error) {
      Alert.alert('Error', 'Failed to load time blocks.');
    }
  }, [error]);

  const renderTimeBlock = (block: TimeBlockItem) => {
    const categoryColor = getCategoryColor(block.category);
    const isExpanded = expandedNotes[block.id];

    return (
      <View key={block.id} style={styles.swipeableContainer}>
        <Swipeable
          ref={(ref: any) => {
            if (ref) {
              swipeableRefs.current[block.id] = ref;
            } else {
              delete swipeableRefs.current[block.id];
            }
          }}
        renderRightActions={() => (
          <View style={styles.timeblockSwipeActions}>
            <TouchableOpacity
              style={styles.editActionBtn}
              onPress={() => {
                closeAllSwipeables();
                handleEditBlock(block);
              }}
            >
              <Ionicons name="pencil" size={16} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteActionBtn}
              onPress={() => {
                closeAllSwipeables();
                handleDeleteBlock(block.id);
              }}
            >
              <Ionicons name="trash" size={16} color="white" />
            </TouchableOpacity>
          </View>
        )}
        onSwipeableWillOpen={closeAllSwipeables}
      >
        <View style={[styles.timeBlockCard, { borderLeftColor: categoryColor }]}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{block.title}</Text>
            <Text style={styles.category}>{block.category}</Text>
          </View>
          <Text style={styles.timeText}>
            {block.isAllDay ? 'All day' :
              `${formatTime(block.startTime)} - ${formatTime(block.endTime)} (${formatDuration(block.startTime, block.endTime)})`
            }
          </Text>

          {block.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={Colors.mediumGray} />
              <Text style={styles.locationText}>{block.location}</Text>
            </View>
          )}

          {block.notes && (
            <TouchableOpacity style={styles.notesRow} onPress={() => toggleNotes(block.id)}>
              <Ionicons name="document-text-outline" size={12} color={Colors.mediumGray} />
              <Text style={styles.notesText} numberOfLines={isExpanded ? undefined : 1}>
                {block.notes}
              </Text>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={Colors.mediumGray}
              />
            </TouchableOpacity>
          )}
        </View>
        </Swipeable>
      </View>
    );
  };

  if (isLoading) {
    return (
      <JournalCard
        icon={<LuCalendarClock size={24} color={Colors.anchorBlue} strokeWidth={2.5} />}
        title="Time Blocks"
        subtitle="Schedule and organize your day"
        showAddButton={false}
        onAdd={() => {}}
        isAdding={false}
      >
        <Text style={styles.loadingText}>Loading time blocks...</Text>
      </JournalCard>
    );
  }

  return (
    <JournalCard
      icon={<LuCalendarClock size={24} color={Colors.anchorBlue} strokeWidth={2.5} />}
      title="Time Blocks"
      subtitle="Schedule and organize your day"
      showAddButton={!isAdding}
      onAdd={startAdding}
      isAdding={isAdding}
    >
      {timeBlocks.length > 0 ? (
        <View style={styles.timeBlocksContainer}>
          {timeBlocks.slice(0, visibleCount).map(renderTimeBlock)}
          {timeBlocks.length > visibleCount && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setVisibleCount(prev => prev + 5)}
            >
              <Text style={styles.showMoreText}>Show {Math.min(5, timeBlocks.length - visibleCount)} more</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {isAdding && (
        <View style={styles.addBlockContainer}>
          {/* 1. Time Range / All Day */}
          <View style={styles.editTimeContainer}>
            <View style={styles.editTimeRow}>
              {newBlock.isAllDay ? (
                <View style={styles.allDayBadge}>
                  <Text style={styles.allDayText}>ALL DAY</Text>
                </View>
              ) : (
                <View style={styles.timeRangeEdit}>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowTimePicker({ start: true, end: false, id: null })}
                  >
                    <Text style={styles.timeText}>{formatTime(newBlock.startTime)}</Text>
                  </TouchableOpacity>
                  <View style={styles.timeSeparatorContainer}>
                    <Text style={styles.timeSeparatorText}>TO</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowTimePicker({ start: false, end: true, id: null })}
                  >
                    <Text style={styles.timeText}>{formatTime(newBlock.endTime)}</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.allDayToggle}>
                <TouchableOpacity
                  style={styles.rowCenter}
                  onPress={toggleAllDay}
                >
                  <View style={styles.checkboxContainer}>
                    <View style={[styles.checkbox, newBlock.isAllDay && styles.checkboxActive]}>
                      {newBlock.isAllDay && <Check size={10} color={Colors.hopeWhite} strokeWidth={2.5} />}
                    </View>
                  </View>
                  <Text style={styles.allDayLabel}>All Day</Text>
                </TouchableOpacity>
              </View>
            </View>
            {(showTimePicker.start || showTimePicker.end) && !showTimePicker.id && (
              <View style={styles.timePickerContainer}>
                <DateTimePicker
                  value={showTimePicker.start ? newBlock.startTime : newBlock.endTime}
                  mode="time"
                  display="spinner"
                  onChange={onTimeChange}
                  themeVariant="light"
                  minuteInterval={5}
                />
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => setShowTimePicker({ start: false, end: false, id: null })}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 2. Activity Title */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, styles.fullWidth, showTitleError && styles.inputError]}
              value={newBlock.title}
              onChangeText={(text) => {
                setNewBlock({...newBlock, title: text});
                if (showTitleError && text.trim()) {
                  setShowTitleError(false);
                }
              }}
              placeholder="Enter a title"
              placeholderTextColor={Colors.mediumGray}
            />
            {showTitleError && <Text style={styles.errorText}>Title is required</Text>}
          </View>

          {/* 3. Location */}
          <View style={styles.locationContainer}>
            <Ionicons
              name="location-outline"
              size={18}
              color={Colors.darkGray}
              style={styles.locationIcon}
            />
            <TextInput
              style={[styles.input, styles.locationInput]}
              value={newBlock.location}
              onChangeText={(text) => setNewBlock({...newBlock, location: text})}
              placeholder="Add location (optional)"
              placeholderTextColor={Colors.mediumGray}
            />
          </View>

          {/* 4. Category */}
          <View style={styles.categorySelectorContainer}>
            <TouchableOpacity
              style={[
                styles.categorySelector,
                !newBlock.category && showCategoryError && styles.categorySelectorError,
                newBlock.category && [
                  { backgroundColor: getCategoryColor(newBlock.category) },
                  styles.categorySelected,
                ],
              ]}
              onPress={() => setShowCategoryPicker(true)}
            >
              <Ionicons
                name={newBlock.category ? CATEGORIES.find(cat => cat.name === newBlock.category)?.icon || 'square-outline' : 'add-circle-outline'}
                size={16}
                color={newBlock.category ? Colors.anchorBlue : Colors.darkGray}
              />
              <Text style={[
                styles.categorySelectorText,
                !newBlock.category && styles.placeholderText,
                !newBlock.category && showCategoryError && { color: Colors.alertCoral },
              ]}>
                {newBlock.category || 'Select a category'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={(!newBlock.category && showCategoryError) ? Colors.alertCoral : Colors.darkGray}
              />
            </TouchableOpacity>
            {showCategoryError && !newBlock.category && (
              <Text style={styles.errorText}>Please select a category</Text>
            )}
          </View>

          {/* 5. Repeat Options */}
          <View style={styles.repeatContainer}>
            <TouchableOpacity
              style={styles.repeatButton}
              onPress={() => setShowRepeatOptions(!showRepeatOptions)}
            >
              <Ionicons
                name="repeat-outline"
                size={18}
                color={Colors.darkGray}
                style={styles.repeatIcon}
              />
              <Text style={styles.repeatText}>
                {formatRepeatText(newBlock.repeat.frequency, newBlock.repeat.customDays, customFrequency)}{newBlock.repeat.endDate ? ` until ${newBlock.repeat.endDate.toLocaleDateString()}` : ''}
              </Text>
              <Ionicons
                name={showRepeatOptions ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.darkGray}
              />
            </TouchableOpacity>

            {showRepeatOptions && (
              <View style={styles.repeatOptions}>
                {['never', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly', 'custom'].map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    style={[
                      styles.repeatOption,
                      newBlock.repeat.frequency === freq && styles.selectedRepeatOption,
                    ]}
                    onPress={() => {
                      const newFrequency = freq as RepeatFrequency;
                      const updatedBlock = {
                        ...newBlock,
                        repeat: {
                          ...newBlock.repeat,
                          frequency: newFrequency,
                          ...(newFrequency === 'never' && { endDate: undefined }),
                          ...(newFrequency === 'custom' && {
                            customFrequency: { value: 1, unit: 'week' },
                            customDays: newBlock.repeat.customDays || [],
                          }),
                        },
                      };
                      setNewBlock(updatedBlock);
                      if (newFrequency === 'custom') {
                        setCustomFrequency({ value: 1, unit: 'day' });
                        setInputValue('1');
                      } else {
                        setShowRepeatOptions(false);
                      }
                    }}
                  >
                    <Text style={styles.repeatOptionText}>
                      {freq === 'never' ? 'Never' :
                       freq === 'daily' ? 'Every Day' :
                       freq === 'weekly' ? 'Every Week' :
                       freq === 'biweekly' ? 'Every 2 Weeks' :
                       freq === 'monthly' ? 'Every Month' :
                       freq === 'yearly' ? 'Every Year' : 'Custom...'}
                    </Text>
                    {newBlock.repeat.frequency === freq && (
                      <Ionicons name="checkmark" size={16} color={Colors.alertCoral} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Custom Repeat Options */}
            {newBlock.repeat.frequency === 'custom' && (
              <View style={styles.customRepeatContainer}>
                <Text style={styles.customRepeatLabel}>Custom repeat options coming soon...</Text>
              </View>
            )}
          </View>

          {/* 6. Notes */}
          <View style={styles.notesContainer}>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={newBlock.notes}
              onChangeText={(text) => setNewBlock({...newBlock, notes: text})}
              placeholder="Add notes (optional)"
              placeholderTextColor={Colors.mediumGray}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          {/* Category Picker Modal */}
          <Modal
            visible={showCategoryPicker}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowCategoryPicker(false)}
          >
            <TouchableWithoutFeedback onPress={() => setShowCategoryPicker(false)}>
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <FlatList
                    data={CATEGORIES}
                    numColumns={2}
                    keyExtractor={(item) => item.name}
                    contentContainerStyle={styles.gridContainer}
                    columnWrapperStyle={styles.columnWrapper}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.gridItem,
                          { backgroundColor: getCategoryColor(item.name) },
                          newBlock.category === item.name && styles.selectedPickerItem,
                        ]}
                        onPress={() => {
                          setNewBlock({...newBlock, category: item.name});
                          setShowCategoryPicker(false);
                        }}
                      >
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={Colors.anchorBlue}
                          style={styles.categoryIcon}
                        />
                        <Text
                          style={styles.gridItemText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          <View style={styles.buttonRow}>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setIsAdding(false)}
              >
                <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton, !newBlock.title.trim() && styles.disabledButton]}
                onPress={addTimeBlock}
                disabled={!newBlock.title.trim()}
              >
                <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  swipeableContainer: {
    marginBottom: 8, // Match the card's marginBottom
    overflow: 'hidden',
  },
  timeblockSwipeActions: {
    flexDirection: 'row',
    width: 160, // Make the total swipe area smaller
    height: '100%', // Match the card height
    marginLeft: -10, // Align with card edge
    overflow: 'hidden', // Ensure rounded corners are respected
    borderRadius: 6, // Match card border radius
  },
  editActionBtn: {
    flex: 1, // Fill all space left of delete button
    height: '100%',
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 12, // Add padding to move icon to the right
  },
  deleteActionBtn: {
    width: 75, // Make delete button smaller
    height: '100%',
    backgroundColor: '#f87171',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 13,
    textAlign: 'center',
    padding: 16,
  },
  emptyText: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 16,
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
  timeBlockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 0, // Remove margin from card as it's now on the container
    borderRadius: 6,
    backgroundColor: '#ebeef2',
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    minHeight: 60,
    overflow: 'hidden',
  },
  timeBlocksContainer: {
    marginBottom: 8,
    padding: 0,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.darkGray,
    flex: 1,
    marginRight: 8,
  },
  category: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.mediumGray,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeText: {
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
    fontSize: 13,
    minWidth: 40,
    lineHeight: 18,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
    marginLeft: 4,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  notesText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
    flex: 1,
    marginLeft: 4,
    marginRight: 4,
  },
  swipeActions: {
    flexDirection: 'row',
    width: 120,
  },
  swipeAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addForm: {
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    padding: 10,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    minHeight: 40,
    fontSize: 14,
  },
  inputError: {
    borderColor: Colors.alertCoral,
  },
  errorText: {
    color: Colors.alertCoral,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    minHeight: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: '100%',
  },
  categorySelectorText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
  },
  placeholderText: {
    color: Colors.mediumGray,
    fontStyle: 'italic',
  },
  categoryList: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 6,
    marginTop: 4,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  categoryIcon: {
    marginRight: 8,
  },
  categoryOptionText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
  },
  allDayToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  allDayLabel: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.darkGray,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.lightGray,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: Colors.alertCoral,
  },
  toggleIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.hopeWhite,
    alignSelf: 'flex-end',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  timeButton: {
    padding: 4,
  },
  timeLabel: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.darkGray,
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    padding: 8,
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
  // Original TimeBlock styles
  addBlockContainer: {
    marginTop: 8,
  },
  editTimeContainer: {
    marginBottom: 12,
  },
  editTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  allDayBadge: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  allDayText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 12,
    textAlign: 'center',
  },
  timeRangeEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeSeparatorContainer: {
    paddingHorizontal: 8,
  },
  timeSeparatorText: {
    color: Colors.mediumGray,
    fontFamily: Fonts.medium,
    fontSize: 10,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    marginRight: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: Colors.mediumGray,
    backgroundColor: Colors.hopeWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
  },
  timePickerContainer: {
    marginTop: 12,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 16,
  },
  doneButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'center',
    marginTop: 12,
  },
  doneButtonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 12,
  },
  fullWidth: {
    width: '100%',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    paddingHorizontal: 10,
    minHeight: 40,
  },
  locationIcon: {
    marginRight: 8,
  },
  locationInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    color: Colors.darkGray,
    fontFamily: Fonts.regular,
    fontSize: 14,
    height: '100%',
  },
  categorySelectorContainer: {
    marginBottom: 12,
  },
  categorySelectorError: {
    borderColor: Colors.alertCoral,
    borderWidth: 1,
  },
  categorySelected: {
    borderWidth: 1,
    borderColor: Colors.anchorBlue,
  },
  repeatContainer: {
    marginBottom: 12,
  },
  repeatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  repeatIcon: {
    marginRight: 8,
  },
  repeatText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
  },
  repeatOptions: {
    marginTop: 8,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  repeatOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  selectedRepeatOption: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  repeatOptionText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
  },
  notesContainer: {
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxWidth: 285,
    padding: 16,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  gridContainer: {
    padding: 4,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 4,
  },
  gridItem: {
    flex: 1,
    minWidth: 0,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
    maxWidth: 120,
  },
  selectedPickerItem: {
    borderWidth: 2,
    borderColor: Colors.alertCoral,
  },
  gridItemText: {
    color: Colors.darkGray,
    fontFamily: Fonts.medium,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  customRepeatContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  customRepeatLabel: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
  },
});

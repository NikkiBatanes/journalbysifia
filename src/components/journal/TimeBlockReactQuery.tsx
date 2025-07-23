import React, { useState, useRef, useCallback } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
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

interface TimeBlockItem {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  category: string;
  notes?: string;
  location?: string;
  isAllDay: boolean;
}

const CATEGORIES = [
  'Appointments', 'Break Time', 'Career Growth', 'Church Activities', 'Deep Work',
  'Events', 'Family Time', 'Life Admin', 'Mental Health', 'Ministry',
  'Personal Growth', 'Physical Health', 'Projects', 'Quiet Time',
  'Recreation', 'Sleep & Recovery', 'Work Meetings', 'Others',
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
  }));

  // Local state
  const [expandedNotes, setExpandedNotes] = useState<{[key: string]: boolean}>({});
  const [isAdding, setIsAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showTitleError, setShowTitleError] = useState(false);
  const [showCategoryError, setShowCategoryError] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState<{start: boolean, end: boolean}>({ start: false, end: false });
  const [newBlock, setNewBlock] = useState({
    title: '',
    startTime: new Date(),
    endTime: new Date(new Date().getTime() + 60 * 60 * 1000),
    category: '',
    notes: '',
    location: '',
    isAllDay: false,
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
    });
    setEditId(null);
    setIsAdding(true);
    setShowTitleError(false);
    setShowCategoryError(false);
  };

  const onTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    if (event.type === 'dismissed') {
      setShowTimePicker({ start: false, end: false });
      return;
    }
    if (selectedTime) {
      if (showTimePicker.start) {
        setNewBlock(prev => ({ ...prev, startTime: selectedTime }));
      } else if (showTimePicker.end) {
        setNewBlock(prev => ({ ...prev, endTime: selectedTime }));
      }
    }
    setShowTimePicker({ start: false, end: false });
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
      <Swipeable
        key={block.id}
        ref={(ref: any) => {
          if (ref) {
            swipeableRefs.current[block.id] = ref;
          } else {
            delete swipeableRefs.current[block.id];
          }
        }}
        renderRightActions={() => (
          <View style={styles.swipeActions}>
            <TouchableOpacity
              style={[styles.swipeAction, { backgroundColor: Colors.anchorBlue }]}
              onPress={() => {
                closeAllSwipeables();
                handleEditBlock(block);
              }}
            >
              <Ionicons name="pencil" size={16} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.swipeAction, { backgroundColor: Colors.alertCoral }]}
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
        <View>
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
      ) : (
        !isAdding && (
          <Text style={styles.emptyText}>
            No time blocks scheduled for today. Tap the + button to add one.
          </Text>
        )
      )}

      {isAdding && (
        <View style={styles.addForm}>
          <View style={styles.inputGroup}>
            <TextInput
              style={[styles.input, showTitleError && styles.inputError]}
              value={newBlock.title}
              onChangeText={(text) => {
                setNewBlock(prev => ({ ...prev, title: text }));
                if (showTitleError && text.trim()) {setShowTitleError(false);}
              }}
              placeholder="Event title"
              placeholderTextColor={Colors.mediumGray}
              autoFocus
            />
            {showTitleError && <Text style={styles.errorText}>Title is required</Text>}
          </View>

          <View style={styles.inputGroup}>
            <TouchableOpacity
              style={[styles.categorySelector, showCategoryError && styles.inputError]}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            >
              <Text style={[styles.categorySelectorText, !newBlock.category && styles.placeholderText]}>
                {newBlock.category || 'Select category'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={Colors.mediumGray} />
            </TouchableOpacity>
            {showCategoryError && <Text style={styles.errorText}>Category is required</Text>}

            {showCategoryPicker && (
              <View style={styles.categoryList}>
                {CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={styles.categoryOption}
                    onPress={() => {
                      setNewBlock(prev => ({ ...prev, category }));
                      setShowCategoryPicker(false);
                      if (showCategoryError) {setShowCategoryError(false);}
                    }}
                  >
                    <Text style={styles.categoryOptionText}>{category}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.allDayToggle}
            onPress={() => setNewBlock(prev => ({ ...prev, isAllDay: !prev.isAllDay }))}
          >
            <Text style={styles.allDayLabel}>All day</Text>
            <View style={[styles.toggle, newBlock.isAllDay && styles.toggleActive]}>
              {newBlock.isAllDay && <View style={styles.toggleIndicator} />}
            </View>
          </TouchableOpacity>

          {!newBlock.isAllDay && (
            <View style={styles.timeContainer}>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowTimePicker({ start: true, end: false })}
              >
                <Text style={styles.timeLabel}>Start: {formatTime(newBlock.startTime)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowTimePicker({ start: false, end: true })}
              >
                <Text style={styles.timeLabel}>End: {formatTime(newBlock.endTime)}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TextInput
            style={styles.input}
            value={newBlock.location}
            onChangeText={(text) => setNewBlock(prev => ({ ...prev, location: text }))}
            placeholder="Location (optional)"
            placeholderTextColor={Colors.mediumGray}
          />

          <TextInput
            style={[styles.input, styles.notesInput]}
            value={newBlock.notes}
            onChangeText={(text) => setNewBlock(prev => ({ ...prev, notes: text }))}
            placeholder="Notes (optional)"
            placeholderTextColor={Colors.mediumGray}
            multiline
            numberOfLines={3}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={() => {
                setIsAdding(false);
                setEditId(null);
                setShowTitleError(false);
                setShowCategoryError(false);
              }}
              style={[styles.button, styles.cancelButton]}
            >
              <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={addTimeBlock}
              style={[
                styles.button,
                styles.saveButton,
                (createMutation.isPending || updateMutation.isPending) && styles.disabledButton,
              ]}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {(showTimePicker.start || showTimePicker.end) && (
        <DateTimePicker
          value={showTimePicker.start ? newBlock.startTime : newBlock.endTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={onTimeChange}
        />
      )}
    </JournalCard>
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
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
    marginBottom: 4,
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
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
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
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    minHeight: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  timeLabel: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.darkGray,
  },
  notesInput: {
    minHeight: 60,
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
});

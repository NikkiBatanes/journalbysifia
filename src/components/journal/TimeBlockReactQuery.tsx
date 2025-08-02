import React, { useState, useRef, useEffect } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Modal, TouchableWithoutFeedback, FlatList } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Check, X, Pencil } from 'lucide-react-native';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import { ErrorBoundary } from '../ErrorBoundary';
import { TimeBlockSkeleton } from '../SkeletonLoader/TimeBlockSkeleton';
import { analytics } from '../../utils/analytics';
import {
  useTimeBlockData,
  useCreateTimeBlock,
  useUpdateTimeBlock,
  useDeleteTimeBlock,
} from '../../services/hooks/useTimeBlockData';
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';

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
  variant?: 'carousel' | 'inline';
  viewMode?: 'carousel' | 'inline' | 'moments';
  expanded?: boolean;
  onExpand?: () => void;
}

export const TimeBlockReactQuery: React.FC<TimeBlockProps> = ({ selectedDate = new Date(), variant = 'carousel', viewMode: providedViewMode, expanded, onExpand }) => {
  // Use provided viewMode or fall back to variant for backward compatibility
  const viewMode = providedViewMode || variant;
  // Global edit mode context (only for inline view)
  // Global edit mode context - safe version that handles missing provider
  const globalEditMode = useEditModeSafe();

  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);

  console.log('🔍 TimeBlockReactQuery: Fetching for date:', dateStr, 'user:', user?.id);

  // Performance monitoring
  const loadStartTime = useRef<number>(Date.now());

  // React Query hooks
  const { data: timeBlockEntries = [], isLoading, error } = useTimeBlockData(user?.id || '', dateStr);

  console.log('📊 TimeBlockReactQuery: Received data:', timeBlockEntries.length, 'entries');
  const createMutation = useCreateTimeBlock();
  const updateMutation = useUpdateTimeBlock();
  const deleteMutation = useDeleteTimeBlock();

  // Transform API data to local format
  const timeBlocks: TimeBlockItem[] = timeBlockEntries.map(block => ({
    id: block.id,
    title: block.title,
    startTime: new Date(block.start_time), // Now expects ISO timestamp
    endTime: new Date(block.end_time), // Now expects ISO timestamp
    category: block.category,
    notes: block.description, // Map description field to notes
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

  // Determine if we should be in adding mode
  const shouldShowAddingMode = isAdding;
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

  // Auto-cancel edit mode when date changes (carousel swipe to different date)
  // Track previous date to detect changes
  const prevDateRef = useRef(dateStr);

  useEffect(() => {
    // Cancel any active editing when date changes
    if (prevDateRef.current !== dateStr && isAdding) {
      setIsAdding(false);
      setEditId(null);
    }
    if (prevDateRef.current !== dateStr && globalEditMode?.isGlobalEditMode && globalEditMode?.setGlobalEditMode) {
      globalEditMode.setGlobalEditMode(false);
    }
    prevDateRef.current = dateStr;
  }, [dateStr, globalEditMode, isAdding]);

  // Auto-cancel edit mode when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      if (isAdding) {
        setIsAdding(false);
        setEditId(null);
      }
    };
  }, [isAdding]);

  const closeAllSwipeActions = () => {
    Object.values(swipeableRefs.current).forEach(ref => {
      if (ref && ref.close) {
        ref.close();
      }
    });
  };

  const toggleNotes = (id: string) => {
    closeAllSwipeActions();
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEditBlock = (block: TimeBlockItem) => {
    closeAllSwipeActions();
    setIsAdding(true);
    setEditId(block.id);
    setNewBlock({
      ...block,
      notes: block.notes || '',
      location: block.location || '',
      startTime: new Date(block.startTime),
      endTime: new Date(block.endTime),
    });
    setInputValue(block.repeat.customFrequency?.value?.toString() || '1');
    setCustomFrequency(block.repeat.customFrequency || { value: 1, unit: 'week' });
    // Always start with repeat options closed when editing
    setShowRepeatOptions(false);
  };

  const handleDeleteBlock = async (id: string) => {
    Alert.alert('Delete Time Block', 'Are you sure you want to delete this time block?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // Get block data for analytics before deletion
            const blockToDelete = timeBlocks.find(block => block.id === id);
            const durationMinutes = blockToDelete ?
              Math.round((blockToDelete.endTime.getTime() - blockToDelete.startTime.getTime()) / (1000 * 60)) : 0;

            await deleteMutation.mutateAsync(id);

            // Track delete analytics
            analytics.trackTimeBlockEvent('timeblock_deleted', {
              timeblock_id: id,
              category: blockToDelete?.category || 'unknown',
              duration_minutes: durationMinutes,
              was_all_day: blockToDelete?.isAllDay || false,
              date: dateStr,
            }, user?.id);
          } catch (deleteError) {
            // Track delete error analytics
            analytics.trackTimeBlockEvent('timeblock_error', {
              error_type: deleteError instanceof Error ? deleteError.message : 'unknown_error',
              operation: 'delete_timeblock',
              date: dateStr,
            }, user?.id);

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
      // Create full datetime objects for the selected date
      let startDateTime: Date;
      let endDateTime: Date;

      try {
        startDateTime = newBlock.isAllDay
          ? new Date(`${dateStr}T00:00:00`)
          : new Date(`${dateStr}T${newBlock.startTime.toTimeString().slice(0, 8)}`);

        endDateTime = newBlock.isAllDay
          ? new Date(`${dateStr}T23:59:59`)
          : new Date(`${dateStr}T${newBlock.endTime.toTimeString().slice(0, 8)}`);

        // Validate the created dates
        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
          throw new Error('Invalid date/time values');
        }

        // Validate that start time is before end time
        if (startDateTime >= endDateTime) {
          Alert.alert('Invalid Time Range', 'Start time must be before end time. Please adjust your time selection.');
          return;
        }
      } catch (dateError) {
        console.error('Error creating date objects:', dateError);
        Alert.alert('Error', 'Invalid date or time values. Please check your input.');
        return;
      }

      const timeBlockData = {
        user_id: user?.id || '',
        selected_date: dateStr,
        title: newBlock.title.trim(),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        category: newBlock.category,
        description: newBlock.notes.trim() || undefined,
        location: newBlock.location.trim() || undefined,
        all_day: newBlock.isAllDay,
        // Repeat fields
        repeat_rule: newBlock.repeat.frequency !== 'never' ? {
          frequency: newBlock.repeat.frequency,
          customDays: newBlock.repeat.customDays,
          customFrequency: newBlock.repeat.customFrequency,
        } : undefined,
        repeat_until: newBlock.repeat.frequency !== 'never' && newBlock.repeat.endDate ? newBlock.repeat.endDate.toISOString() : undefined,
      };

      // Calculate duration for analytics
      const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60));

      if (editId) {
        // Track update analytics
        const existingBlock = timeBlocks.find(block => block.id === editId);
        const previousDuration = existingBlock ?
          Math.round((existingBlock.endTime.getTime() - existingBlock.startTime.getTime()) / (1000 * 60)) : 0;

        await updateMutation.mutateAsync({ id: editId, updates: timeBlockData });

        analytics.trackTimeBlockEvent('timeblock_updated', {
          timeblock_id: editId,
          title_length: newBlock.title.trim().length,
          category: newBlock.category,
          duration_minutes: durationMinutes,
          previous_duration_minutes: previousDuration,
          is_all_day: newBlock.isAllDay,
          has_location: !!newBlock.location.trim(),
          has_notes: !!newBlock.notes.trim(),
          repeat_frequency: newBlock.repeat.frequency,
          date: dateStr,
        }, user?.id);
      } else {
        await createMutation.mutateAsync(timeBlockData);

        analytics.trackTimeBlockEvent('timeblock_created', {
          title_length: newBlock.title.trim().length,
          category: newBlock.category,
          duration_minutes: durationMinutes,
          is_all_day: newBlock.isAllDay,
          has_location: !!newBlock.location.trim(),
          has_notes: !!newBlock.notes.trim(),
          repeat_frequency: newBlock.repeat.frequency,
          date: dateStr,
        }, user?.id);
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

      globalEditMode?.setGlobalEditMode(false);

    } catch (saveError) {
      console.error('Time block save error:', saveError);

      // Track error analytics
      analytics.trackTimeBlockEvent('timeblock_error', {
        error_type: saveError instanceof Error ? saveError.message : 'unknown_error',
        operation: editId ? 'update_timeblock' : 'create_timeblock',
        date: dateStr,
      }, user?.id);

      // Provide more specific error messages
      let errorMessage = 'Failed to save time block. Please try again.';

      if (saveError instanceof Error) {
        if (saveError.message.includes('duplicate')) {
          errorMessage = 'A time block already exists at this time. Please choose a different time.';
        } else if (saveError.message.includes('constraint')) {
          errorMessage = 'Invalid data provided. Please check your inputs and try again.';
        } else if (saveError.message.includes('network') || saveError.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = `Error: ${saveError.message}`;
        }
      }

      Alert.alert('Error', errorMessage);
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
        setNewBlock(prev => {
          const newStartTime = selectedTime;
          // If new start time is after current end time, adjust end time
          const newEndTime = newStartTime >= prev.endTime
            ? new Date(newStartTime.getTime() + 60 * 60 * 1000) // Add 1 hour
            : prev.endTime;
          return { ...prev, startTime: newStartTime, endTime: newEndTime };
        });
      } else if (showTimePicker.end) {
        setNewBlock(prev => {
          const newEndTime = selectedTime;
          // If new end time is before current start time, adjust start time
          const newStartTime = newEndTime <= prev.startTime
            ? new Date(newEndTime.getTime() - 60 * 60 * 1000) // Subtract 1 hour
            : prev.startTime;
          return { ...prev, startTime: newStartTime, endTime: newEndTime };
        });
      }
    }
    // Don't auto-close the picker - let user manually close with Done button
  };

  const toggleAllDay = () => {
    setNewBlock(prev => ({ ...prev, isAllDay: !prev.isAllDay }));
  };

  // Analytics and error tracking
  useEffect(() => {
    if (!isLoading && !error && timeBlockEntries) {
      // Track successful load with performance metrics
      const loadTime = Date.now() - loadStartTime.current;
      analytics.trackTimeBlockEvent('timeblock_loaded', {
        blocks_count: timeBlockEntries.length,
        load_time_ms: loadTime,
        date: dateStr,
      }, user?.id);
    }
  }, [isLoading, error, timeBlockEntries, dateStr, user?.id]);

  useEffect(() => {
    if (error) {
      // Track error with analytics
      analytics.trackTimeBlockEvent('timeblock_error', {
        error_type: 'load_failed',
        operation: 'fetch_timeblocks',
        date: dateStr,
      }, user?.id);

      Alert.alert('Error', 'Failed to load time blocks.');
    }
  }, [error, dateStr, user?.id]);

  const renderTimeBlock = (block: TimeBlockItem) => {
    const isExpanded = expandedNotes[block.id] || false; // Collapsed by default, expandable on tap

    return (
      <View key={block.id} style={[styles.swipeableContainer, styles.swipeableContainerInline]}>
        <Swipeable
          ref={(ref: any) => {
            if (ref) {
              swipeableRefs.current[block.id] = ref;
            } else {
              delete swipeableRefs.current[block.id];
            }
          }}
          renderRightActions={viewMode === 'carousel' && !expanded ? undefined : () => (
            <View style={styles.timeblockSwipeActions}>
              <TouchableOpacity
                style={styles.editActionBtn}
                onPress={() => handleEditBlock(block)}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={22} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteActionBtn}
                onPress={() => handleDeleteBlock(block.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={22} color="white" />
              </TouchableOpacity>
            </View>
          )}
          rightThreshold={viewMode === 'carousel' && !expanded ? 0 : 40}
          friction={2}
          overshootRight={false}
          enabled={!(viewMode === 'carousel' && !expanded)}
      >
        <View style={[styles.timeBlockCard, styles.timeBlockCardInline]}>
          <View style={[styles.timeColumn, styles.timeColumnInline]}>
            {block.isAllDay ? (
              <View style={styles.allDayBadge}>
                <Text style={styles.allDayText}>ALL DAY</Text>
              </View>
            ) : (
              <View style={styles.timeRangeStacked}>
                <Text style={[styles.timeText, styles.timeTextInline]}>{formatTime(block.startTime)}</Text>
                <Text style={[styles.timeSeparatorText, styles.timeSeparatorTextInline]}>TO</Text>
                <Text style={[styles.timeText, styles.timeTextInline]}>{formatTime(block.endTime)}</Text>
                <View style={[styles.durationContainer, styles.durationContainerInline]}>
                  <Text style={[styles.durationText, styles.durationTextInline]}>
                    {formatDuration(block.startTime, block.endTime)}
                  </Text>
                </View>
              </View>
            )}
          </View>
          <View style={styles.detailsColumn}>
            <View style={styles.detailsRow}>
              <Text style={[styles.blockTitle, styles.blockTitleInline]}>{block.title}</Text>
            </View>
            <View style={styles.detailsContent}>
              <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(block.category) }]}>
                <View style={styles.categoryContent}>
                  <Ionicons
                    name={CATEGORIES.find(cat => cat.name === block.category)?.icon || 'square-outline'}
                    size={12}
                    color={Colors.anchorBlue}
                    style={styles.categoryIcon}
                  />
                  <Text style={styles.categoryLabel} numberOfLines={1} ellipsizeMode="tail">
                    {block.category}
                  </Text>
                </View>
              </View>
              {(block.location || block.repeat.frequency !== 'never') && (
                <View style={styles.metaInfoContainer}>
                  {block.location && (
                    <View style={styles.metaInfoRow}>
                      <Ionicons name="location-outline" size={12} color={Colors.hopeWhite} style={styles.metaIcon} />
                      <Text style={styles.metaText} numberOfLines={1} ellipsizeMode="tail">
                        {block.location}
                      </Text>
                    </View>
                  )}
                  {block.repeat.frequency !== 'never' && (
                    <View style={styles.metaInfoRow}>
                      <Ionicons name="repeat-outline" size={12} color={Colors.hopeWhite} style={styles.metaIcon} />
                      <Text style={styles.metaText}>
                        {formatRepeatText(block.repeat.frequency, block.repeat.customDays, block.repeat.customFrequency)}
                        {block.repeat.endDate ? ` until ${block.repeat.endDate.toLocaleDateString()}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {block.notes && (
  <NotesWithChevron
    notes={block.notes}
    isExpanded={isExpanded}
    onToggle={() => toggleNotes(block.id)}
  />
)}
            </View>
          </View>
        </View>
        </Swipeable>
      </View>
    );
  };

  if (isLoading) {
    return (
      <JournalCard
        icon={<MaterialCommunityIcons name="timeline-text-outline" size={24} color={Colors.anchorBlue} />}
        title={timeBlocks.length === 1 ? 'TIME BLOCK' : 'TIME BLOCKS'}
        subtitle="Schedule and organize your day"
        showAddButton={false}
        onAdd={() => {}}
        isAdding={false}
        variant={variant}
        viewMode={viewMode}
      >
        <TimeBlockSkeleton count={3} />
      </JournalCard>
    );
  }

  // Hide empty component in inline and moments view
  if ((viewMode === 'inline' || viewMode === 'moments') && !isLoading && timeBlocks.length === 0) {
    return null;
  }

  return (
    <JournalCard
      icon={timeBlocks.length > 0 ? <MaterialCommunityIcons name="timeline-text-outline" size={24} color={Colors.alertCoral} /> : undefined}
      title={timeBlocks.length > 0 ? (timeBlocks.length === 1 ? 'TIME BLOCK' : 'TIME BLOCKS') : undefined}
      subtitle={timeBlocks.length > 0 ? 'Schedule and organize your day' : undefined}
      showAddButton={timeBlocks.length > 0 && !shouldShowAddingMode}
      onAdd={startAdding}
      isAdding={shouldShowAddingMode}
      variant={variant}
      viewMode={viewMode}
      expanded={expanded}
      onExpand={onExpand}
      headerRight={
        globalEditMode?.isGlobalEditMode && timeBlocks.length > 0 ? (
          <TouchableOpacity
            onPress={startAdding}
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel="Add time block"
          >
            <Ionicons name="add" size={16} color={Colors.trustGrey} />
          </TouchableOpacity>
        ) : null
      }
    >
      {/* Show empty state or time blocks */}
      {timeBlocks.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="timeline-text-outline"
              size={32}
              color={Colors.mediumGray}
              style={styles.emptyStateIcon}
            />
            <Text style={styles.sectionLabel}>TIME BLOCKS</Text>
          </View>
          <Text style={styles.emptyStateTitle}>Plan Your Day with Purpose</Text>
          <Text style={styles.emptyStateText}>Schedule timeblocks to align your time with God's calling</Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={startAdding}
            accessibilityRole="button"
            accessibilityLabel="Begin planning your day"
          >
            <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
            <Text style={styles.emptyStateButtonText}>Begin</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={styles.timeBlocksContainer}
          accessibilityRole="list"
          accessibilityLabel={`Time blocks for ${dateStr}`}
          accessibilityHint={`${timeBlocks.length} time block${timeBlocks.length === 1 ? '' : 's'} scheduled for this day`}
        >
          {timeBlocks.slice(0, visibleCount).map((block, index) => (
            <React.Fragment key={`${block.id}-${index}`}>
              {renderTimeBlock(block)}
            </React.Fragment>
          ))}
          {timeBlocks.length > visibleCount && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setVisibleCount(prev => prev + 5)}
              accessibilityRole="button"
              accessibilityLabel={`Show ${Math.min(5, timeBlocks.length - visibleCount)} more time blocks`}
              accessibilityHint={`Reveals ${Math.min(5, timeBlocks.length - visibleCount)} additional time blocks from your ${timeBlocks.length} total blocks`}
            >
              <Text style={styles.showMoreText}>Show more</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Show add form at bottom when adding */}
      {shouldShowAddingMode && (
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
                    accessibilityRole="button"
                    accessibilityLabel={`Start time: ${formatTime(newBlock.startTime)}`}
                    accessibilityHint="Tap to change the start time for this time block"
                  >
                    <Text style={styles.timeText}>{formatTime(newBlock.startTime)}</Text>
                  </TouchableOpacity>
                  <View style={styles.timeSeparatorContainer}>
                    <Text style={styles.timeSeparatorText}>TO</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowTimePicker({ start: false, end: true, id: null })}
                    accessibilityRole="button"
                    accessibilityLabel={`End time: ${formatTime(newBlock.endTime)}`}
                    accessibilityHint="Tap to change the end time for this time block"
                  >
                    <Text style={styles.timeText}>{formatTime(newBlock.endTime)}</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.allDayToggle}>
                <TouchableOpacity
                  style={styles.rowCenter}
                  onPress={toggleAllDay}
                  accessibilityRole="checkbox"
                  accessibilityLabel="All day event"
                  accessibilityHint={newBlock.isAllDay ? 'Currently enabled. Tap to disable all-day mode.' : 'Currently disabled. Tap to enable all-day mode.'}
                  accessibilityState={{ checked: newBlock.isAllDay }}
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
                  themeVariant="dark"
                  textColor={Colors.hopeWhite}
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
              accessibilityLabel="Time block title"
              accessibilityHint="Enter a descriptive title for your time block. This field is required."
              accessibilityRole="text"
            />
            {showTitleError && <Text style={styles.errorText}>Title is required</Text>}
          </View>

          {/* 3. Location */}
          <View style={styles.locationContainer}>
            <Ionicons
              name="location-outline"
              size={18}
              color={Colors.hopeWhite}
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
              accessibilityRole="button"
              accessibilityLabel={newBlock.category ? `Selected category: ${newBlock.category}` : 'Select category'}
              accessibilityHint="Tap to open category selection menu. This field is required."
            >
              <Ionicons
                name={newBlock.category ? CATEGORIES.find(cat => cat.name === newBlock.category)?.icon || 'square-outline' : 'add-circle-outline'}
                size={16}
                color={newBlock.category ? Colors.hopeWhite : Colors.hopeWhite}
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
                color={(!newBlock.category && showCategoryError) ? Colors.alertCoral : Colors.hopeWhite}
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
                color={Colors.hopeWhite}
                style={styles.repeatIcon}
              />
              <Text style={styles.repeatText}>
                {formatRepeatText(newBlock.repeat.frequency, newBlock.repeat.customDays, customFrequency)}{newBlock.repeat.endDate ? ` until ${newBlock.repeat.endDate.toLocaleDateString()}` : ''}
              </Text>
              <Ionicons
                name={showRepeatOptions ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.hopeWhite}
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
                {/* Frequency Selector */}
                <View style={styles.frequencySelector}>
                  <Text style={styles.frequencyLabel}>Repeat every:</Text>
                  <View style={styles.frequencyInputs}>
                    <TextInput
                      style={styles.frequencyInput}
                      value={_inputValue}
                      onChangeText={(text) => {
                        setInputValue(text);
                        if (text === '') {
                          const newFreq = { ...customFrequency, value: 1 };
                          setCustomFrequency(newFreq);
                          setNewBlock(prev => ({
                            ...prev,
                            repeat: {
                              ...prev.repeat,
                              customFrequency: newFreq,
                            },
                          }));
                        } else if (/^\d+$/.test(text)) {
                          const num = parseInt(text, 10);
                          if (num >= 1) {
                            const newFreq = { ...customFrequency, value: num };
                            setCustomFrequency(newFreq);
                            setNewBlock(prev => ({
                              ...prev,
                              repeat: {
                                ...prev.repeat,
                                customFrequency: newFreq,
                              },
                            }));
                          }
                        }
                      }}
                      onBlur={() => {
                        if (!_inputValue || !/^\d+$/.test(_inputValue)) {
                          setInputValue('1');
                          const newFreq = { ...customFrequency, value: 1 };
                          setCustomFrequency(newFreq);
                          setNewBlock(prev => ({
                            ...prev,
                            repeat: {
                              ...prev.repeat,
                              customFrequency: newFreq,
                            },
                          }));
                        }
                      }}
                      keyboardType="number-pad"
                      maxLength={2}
                      returnKeyType="done"
                      selectTextOnFocus={true}
                    />
                    <TouchableOpacity
                      style={styles.frequencyUnitButton}
                      onPress={() => setShowFrequencySelector(!_showFrequencySelector)}
                    >
                      <Text style={styles.frequencyUnitText}>
                        {customFrequency.unit.charAt(0).toUpperCase() + customFrequency.unit.slice(1)}{customFrequency.value > 1 ? 's' : ''}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color={Colors.hopeWhite} />
                    </TouchableOpacity>
                  </View>

                  {_showFrequencySelector && (
                    <View style={styles.frequencyOptions}>
                      {['day', 'week', 'month', 'year'].map((unit) => (
                        <TouchableOpacity
                          key={unit}
                          style={styles.frequencyOption}
                          onPress={() => {
                            const newFreq = { ...customFrequency, unit };
                            setCustomFrequency(newFreq);
                            setNewBlock(prev => ({
                              ...prev,
                              repeat: {
                                ...prev.repeat,
                                customFrequency: newFreq,
                              },
                            }));
                            setShowFrequencySelector(false);
                          }}
                        >
                          <Text style={styles.frequencyOptionText}>
                            {unit.charAt(0).toUpperCase() + unit.slice(1)}
                          </Text>
                          {customFrequency.unit === unit && (
                            <Ionicons name="checkmark" size={16} color={Colors.alertCoral} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Days of Week Selector (only shown for weekly frequency) */}
                {customFrequency.unit === 'week' && (
                  <View style={styles.customDaysContainer}>
                    <Text style={styles.customDaysLabel}>On days:</Text>
                    <View style={styles.daysOfWeekContainer}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
                        const isSelected = newBlock.repeat.customDays?.includes(index);
                        return (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.dayButton,
                              isSelected && styles.dayButtonSelected,
                            ]}
                            onPress={() => {
                              const updatedDays = newBlock.repeat.customDays || [];
                              const newDays = updatedDays.includes(index)
                                ? updatedDays.filter(d => d !== index)
                                : [...updatedDays, index];

                              setNewBlock({
                                ...newBlock,
                                repeat: {
                                  ...newBlock.repeat,
                                  customDays: newDays.sort((a, b) => a - b),
                                },
                              });
                            }}
                          >
                            <Text style={[
                              styles.dayButtonText,
                              isSelected && styles.dayButtonTextSelected,
                            ]}>
                              {day}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* End Repeat Options */}
          {newBlock.repeat.frequency !== 'never' && (
            <View style={styles.endRepeatContainer}>
              <Text style={styles.endRepeatLabel}>End Repeat:</Text>
              <View style={styles.endRepeatOptions}>
                <TouchableOpacity
                  style={[
                    styles.endRepeatOption,
                    !newBlock.repeat.endDate && styles.selectedEndRepeatOption,
                  ]}
                  onPress={() => {
                    setNewBlock({
                      ...newBlock,
                      repeat: {
                        ...newBlock.repeat,
                        endDate: undefined,
                      },
                    });
                  }}
                >
                  <Text style={styles.endRepeatOptionText}>Never</Text>
                  {!newBlock.repeat.endDate && (
                    <Ionicons name="checkmark" size={16} color={Colors.alertCoral} />
                  )}
                </TouchableOpacity>
                <View style={styles.dateDropdownContainer}>
                  <TouchableOpacity
                    style={[
                      styles.endRepeatOption,
                      newBlock.repeat.endDate && styles.selectedEndRepeatOption,
                    ]}
                    onPress={() => {
                      setShowEndDatePicker(!_showEndDatePicker);
                    }}
                  >
                    <Text style={styles.endRepeatOptionText}>
                      {newBlock.repeat.endDate
                        ? newBlock.repeat.endDate.toLocaleDateString()
                        : 'Select End Date'}
                    </Text>
                    <View style={styles.dropdownIconContainer}>
                      {newBlock.repeat.endDate && (
                        <Ionicons name="checkmark" size={16} color={Colors.alertCoral} style={styles.checkmarkIcon} />
                      )}
                      <Ionicons
                        name={_showEndDatePicker ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={Colors.hopeWhite}
                      />
                    </View>
                  </TouchableOpacity>

                </View>
              </View>

            </View>
          )}

          {/* End Date Picker Modal */}
          {_showEndDatePicker && (
            <Modal
              visible={_showEndDatePicker}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowEndDatePicker(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.datePickerModalContent}>
                  <Text style={styles.datePickerTitle}>Select End Date</Text>
                  <DateTimePicker
                    value={newBlock.repeat.endDate || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={(event: DateTimePickerEvent, newSelectedDate?: Date) => {
                      if (event.type === 'dismissed') {
                        setShowEndDatePicker(false);
                        return;
                      }
                      if (event.type === 'set' && newSelectedDate) {
                        setNewBlock(prev => ({
                          ...prev,
                          repeat: {
                            ...prev.repeat,
                            endDate: newSelectedDate,
                          },
                        }));
                      }
                      // Don't auto-close - let user manually close
                    }}
                    minimumDate={new Date()}
                    themeVariant="dark"
                    textColor={Colors.hopeWhite}
                  />
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={() => setShowEndDatePicker(false)}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          )}

          {/* 6. Notes */}
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

                          // Track category selection analytics
                          analytics.trackTimeBlockEvent('timeblock_category_selected', {
                            category: item.name,
                            date: dateStr,
                          }, user?.id);
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
                accessibilityRole="button"
                accessibilityLabel="Cancel adding time block"
                accessibilityHint="Discards the current time block and returns to the main view"
              >
                <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton, !newBlock.title.trim() && styles.disabledButton]}
                onPress={addTimeBlock}
                disabled={!newBlock.title.trim()}
                accessibilityRole="button"
                accessibilityLabel={editId ? 'Update time block' : 'Save time block'}
                accessibilityHint={!newBlock.title.trim() ? 'Button is disabled. Please enter a title first.' : 'Saves the time block to your schedule'}
                accessibilityState={{ disabled: !newBlock.title.trim() }}
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

// Export with error boundary wrapper
export const TimeBlockReactQueryWithErrorBoundary: React.FC<TimeBlockProps> = (props) => (
  <ErrorBoundary name="TimeBlockReactQuery">
    <TimeBlockReactQuery {...props} />
  </ErrorBoundary>
);

// Export both versions for flexibility
// --- Helper: NotesWithChevron ---
const NotesWithChevron = ({ notes, isExpanded, onToggle }: { notes: string; isExpanded: boolean; onToggle: () => void }) => {
  const showChevron = !isExpanded;
  return (
    <TouchableOpacity style={styles.notesContainer} onPress={onToggle} activeOpacity={0.7}>
      <Ionicons name="document-text-outline" size={12} color={Colors.hopeWhite} style={styles.notesIcon} />
      <Text
        style={styles.notesText}
        numberOfLines={isExpanded ? undefined : 2}
        ellipsizeMode="tail"
      >
        {notes}
      </Text>
      {showChevron && (
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={Colors.mediumGray}
          style={styles.notesChevron}
        />
      )}
    </TouchableOpacity>
  );
};
// --- END Helper ---

// Update Playbook label
// Replace all occurrences of 'FROM PLAYBOOK' with 'From Playbook'

export { TimeBlockReactQuery as TimeBlockReactQueryComponent };

const styles = StyleSheet.create({
  swipeableContainer: {
    marginBottom: 8, // Match the card's marginBottom
    overflow: 'hidden',
  },
  swipeableContainerInline: {
    borderRadius: 16, // Match the inline card border radius
  },
  swipeableContainerMoments: {
    borderRadius: 16, // Match the moments card border radius
  },
  timeblockSwipeActions: {
    flexDirection: 'row',
    width: 160, // Make the total swipe area smaller
    height: '100%', // Match the card height
    marginLeft: -10, // Align with card edge
    overflow: 'hidden', // Ensure rounded corners are respected
    borderRadius: 12, // Match card border radius
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
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 24,
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
  emptyStateTitle: {
    marginTop: 2,
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    fontSize: 18,
    letterSpacing: 0.2,
    color: Colors.hopeWhite,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyStateText: {
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
  addButton: {
    padding: 4,
    marginLeft: 12,
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
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#ebeef2',
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    minHeight: 60,
    overflow: 'hidden',
  },
  timeBlockCardInline: {
    borderRadius: 16,
    backgroundColor: Colors.anchorBlue,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 12,
  },
  timeBlockCardMoments: {
    borderRadius: 16,
    backgroundColor: Colors.anchorBlue,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 12,
  },
  timeBlocksContainer: {
    marginBottom: 8,
    padding: 0,
  },
  timeColumn: {
    width: 90,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
    paddingVertical: 0,
    alignSelf: 'stretch',
    minHeight: 0,
  },
  timeColumnInline: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 0,
  },
  timeRangeStacked: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  timeSeparatorText: {
    fontFamily: Fonts.regular,
    fontSize: 8,
    color: Colors.hopeWhite,
    marginVertical: 2,
    letterSpacing: 0.5,
  },
  timeSeparatorTextInline: {
    color: Colors.hopeWhite,
  },
  timeSeparatorTextMoments: {
    color: Colors.hopeWhite,
  },
  allDayBadge: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allDayText: {
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    fontSize: 10,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  durationContainer: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 16,
    borderWidth: 0.3,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  durationContainerInline: {
    borderColor: Colors.hopeWhite,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  durationText: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: Colors.mediumGray,
    textAlign: 'center',
  },
  durationTextInline: {
    color: Colors.hopeWhite,
  },
  durationTextMoments: {
    color: Colors.hopeWhite,
  },
  detailsColumn: {
    flex: 1,
    paddingLeft: 12,
    paddingVertical: 0,
    justifyContent: 'center',
    minHeight: 0,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailsContent: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: 3,
  },
  blockTitle: {
    fontFamily: Fonts.bold,
    fontWeight: '400',
    fontSize: 14,
    color: Colors.hopeWhite,
    flex: 1,
    marginRight: 6,
    lineHeight: 18,
    letterSpacing: 0.2,
    marginBottom: 1,
  },
  blockTitleInline: {
    color: Colors.hopeWhite,
  },
  blockTitleMoments: {
    color: Colors.hopeWhite,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    marginRight: 4,
  },
  categoryLabel: {
    fontFamily: Fonts.medium,
    fontWeight: '600',
    fontSize: 11,
    color: Colors.anchorBlue,
    maxWidth: 100,
  },
  metaInfoContainer: {
    marginTop: 6,
    gap: 2,
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 18,
  },
  metaIcon: {
    marginRight: 4,
    width: 12,
  },
  metaText: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    flex: 1,
    lineHeight: 16,
    marginTop: 0,
  },
  notesContainer: {
    width: '100%',
    marginTop: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center', // Center vertically
    minHeight: 24, // Ensure enough height for icon, text, chevron
  },
  notesIcon: {
    marginRight: 4,
    marginTop: 1,
    width: 12,
  },
  notesChevron: {
    marginLeft: 4,
    marginTop: 1,
    flexShrink: 0,
  },
  timeText: {
    fontFamily: Fonts.semiBold,
    color: Colors.hopeWhite,
    fontSize: 13,
    minWidth: 40,
    lineHeight: 18,
    fontWeight: '600',
  },
  timeTextInline: {
    color: Colors.hopeWhite,
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
    borderRadius: 8,
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
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    flex: 1,
    marginLeft: 4,
    marginRight: 4,
    lineHeight: 16,
    letterSpacing: 0.1,
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
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 10,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    minHeight: 40,
    backgroundColor: 'transparent',
    width: '100%',
  },
  categorySelectorText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.hopeWhite,
    marginLeft: 8,
    flex: 1,
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
  categoryOptionText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.darkGray,
  },
  allDayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    paddingVertical: 4,
  },
  allDayLabel: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 20,
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
    borderRadius: 18,
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
    color: Colors.hopeWhite,
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 8,
    backgroundColor: 'transparent',
    borderRadius: 12,
    width: '100%',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    padding: 8,
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
    fontSize: 14,
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
  timeRangeEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeSeparatorContainer: {
    paddingHorizontal: 8,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    position: 'relative',
    marginRight: 10,
  },
  checkbox: {
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
  checkboxActive: {
    backgroundColor: Colors.growthGreen,
    borderColor: Colors.growthGreen,
  },
  timePickerContainer: {
    marginTop: 12,
    backgroundColor: 'transparent',
    borderRadius: 24,
    padding: 12,
    // overflow: 'hidden', // allow highlight to show round corners
    maxWidth: '130%',
    alignSelf: 'center',
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
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
    color: Colors.hopeWhite,
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
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  repeatIcon: {
    marginRight: 8,
  },
  repeatText: {
    color: Colors.hopeWhite,
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 14,
  },
  repeatOptions: {
    marginTop: 8,
    backgroundColor: Colors.anchorBlue,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  repeatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  selectedRepeatOption: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  repeatOptionText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
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
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  customRepeatLabel: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
  },
  frequencySelector: {
    marginBottom: 12,
  },
  frequencyLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    marginBottom: 8,
  },
  frequencyInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  frequencyInput: {
    width: 50,
    height: 36,
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 8,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    textAlign: 'center',
    fontSize: 14,
  },
  frequencyUnitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 10,
    height: 36,
    minWidth: 100,
  },
  frequencyUnitText: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    fontSize: 14,
    lineHeight: 20,
  },
  frequencyOptions: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    backgroundColor: Colors.anchorBlue,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 1000,
    elevation: 5,
  },
  frequencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  frequencyOptionText: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  customDaysContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  customDaysLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    marginBottom: 8,
  },
  daysOfWeekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  dayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    margin: 1,
  },
  dayButtonSelected: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
  },
  dayButtonText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
  },
  dayButtonTextSelected: {
    color: 'white',
  },
  endRepeatContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  endRepeatLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    marginBottom: 8,
  },
  endRepeatOptions: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    alignItems: 'stretch',
  },
  endRepeatOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    minHeight: 48,
  },
  endRepeatOptionText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.hopeWhite,
    flex: 1,
  },
  selectedEndRepeatOption: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderColor: Colors.alertCoral,
  },
  datePickerModalContent: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    margin: 0,
    alignItems: 'center',
    // Removed border for compact modal
  },
  datePickerTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 16,
    textAlign: 'center',
  },
  repeatOptionsModal: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxHeight: '70%',
  },
  repeatModalTitle: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 16,
    textAlign: 'center',
  },
  datePickerCompact: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dateDropdownContainer: {
    position: 'relative',
    flex: 1,
  },
  dropdownIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkmarkIcon: {
    marginRight: 4,
  },
});

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Swipeable } from 'react-native-gesture-handler';
import { View, TextInput, StyleSheet, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';

import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Check, X, Pencil } from 'lucide-react-native';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import { ErrorBoundary } from '../ErrorBoundary';
import { TimeBlockSkeleton } from '../SkeletonLoader/TimeBlockSkeleton';
import { analytics } from '../../utils/analytics';
import { isToday as isTodayFn, isYesterday as isYesterdayFn, isAfter, startOfDay, startOfToday } from 'date-fns';
import {
  useTimeBlockData,
  useCreateTimeBlock,
  useUpdateTimeBlock,
  useDeleteTimeBlock,
} from '../../services/hooks/useTimeBlockData';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/queryKeys';
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';
import { getCategoryColor, getCategoryIcon } from './TimeBlockCategories';
import TimeBlockCategoryModal from './TimeBlockCategoryModal';
import { triggerLightHaptic, triggerSelectionHaptic } from '../../utils/haptics';
import { usePlanningGating } from '../../hooks/usePlanningGating';
import PlanningLockIcon from '../PlanningLockIcon';
import { useCalendarGating } from '../../hooks/useCalendarGating';
import { LocationSelector } from '../LocationSelector';
import { DeleteTimeBlockModal, DeleteOptions } from '../DeleteTimeBlockModal';
import { CalendarSyncButton } from '../CalendarSyncButton';
import { syncTimeBlockToCalendar, removeTimeBlockFromCalendar } from '../../services/calendarSyncService';
import { useScroll } from '../../context/ScrollContext';

type RepeatFrequency = 'never' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';

interface TimeBlockItem {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  selectedDate: string;
  category: string;
  notes?: string;
  location?: string;
  isAllDay: boolean;
  calendarEventId?: string; // For calendar sync
  alert?: 'none' | 'at-time' | '5-min' | '10-min' | '15-min' | '30-min' | '1-hour' | '2-hours' | '1-day' | '2-days' | '1-week'; // Alert/reminder
  alarmMinutes?: number;
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

// Helper function to convert alert string to minutes for calendar alarm
const alertToMinutes = (alert: string): number | undefined => {
  switch (alert) {
    case 'at-time': return 0;
    case '5-min': return 5;
    case '10-min': return 10;
    case '15-min': return 15;
    case '30-min': return 30;
    case '1-hour': return 60;
    case '2-hours': return 120;
    case '1-day': return 1440;
    case '2-days': return 2880;
    case '1-week': return 10080;
    case 'none':
    default: return undefined;
  }
};

// Helper function to format repeat text
const formatRepeatText = (
  frequency: RepeatFrequency,
  customDays?: number[],
  customFrequency?: { value: number, unit: string },
  weekStart: number = 0,
): string => {
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
          const ordered = customDays
            .slice()
            .sort((a, b) => ((a - weekStart + 7) % 7) - ((b - weekStart + 7) % 7));
          const days = ordered.map(day => dayNames[day]).join(', ');
          return `Every ${customFrequency.value} ${unit} on ${days}`;
        }
        return `Every ${customFrequency.value} ${unit}`;
      }
      return 'Custom';
    default:
      return '';
  }
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

  // Planning gating state
  const planningGating = usePlanningGating(selectedDate, 'inApp');

  // Calendar gating state
  const calendarGating = useCalendarGating();

  // Dynamic theming
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  const { user } = useAuth();
  // Respect user auto-sync preference from profile
  const autoSyncEnabled = ((user as any)?.user_metadata?.preferences?.calendar?.autoSync ?? false) as boolean;
  const weekStartsOn = useMemo(() => {
    const key = (user as any)?.user_metadata?.preferences?.weekStart as
      | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | undefined;
    const map: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    return key ? map[key] ?? 0 : 0;
  }, [user]);
  const dateStr = toLocalDateString(selectedDate);
  const { scrollToTop } = useScroll();

  // Performance monitoring
  const loadStartTime = useRef<number>(Date.now());

  // React Query hooks
  const { data: timeBlockEntries = [], isLoading, error } = useTimeBlockData(user?.id || '', dateStr);
  const queryClient = useQueryClient();

  const createMutation = useCreateTimeBlock();
  const updateMutation = useUpdateTimeBlock();
  const deleteMutation = useDeleteTimeBlock();

  // Transform API data to local format
  const timeBlocks: TimeBlockItem[] = timeBlockEntries.map(block => ({
    id: block.id,
    title: block.title,
    startTime: new Date(block.start_time), // Now expects ISO timestamp
    endTime: new Date(block.end_time), // Now expects ISO timestamp
    selectedDate: block.selected_date,
    category: block.category,
    notes: block.description, // Map description field to notes
    location: block.location,
    isAllDay: block.all_day,
    calendarEventId: (block as any).calendar_event_id,
    alert: block.alert || 'none', // Map alert field
    alarmMinutes: (block as any).alarm_minutes ?? alertToMinutes(block.alert || 'none'),
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
  const [visibleCount, setVisibleCount] = useState(3);
  const [showTitleError, setShowTitleError] = useState(false);
  const [showCategoryError, setShowCategoryError] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState<{start: boolean, end: boolean, id: string | null}>({ start: false, end: false, id: null });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<{
    visible: boolean;
    timeBlock?: TimeBlockItem;
  }>({ visible: false });

  // Determine if we should be in adding mode
  const shouldShowAddingMode = isAdding;
  const [showRepeatOptions, setShowRepeatOptions] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [_showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [_showFrequencySelector, setShowFrequencySelector] = useState(false);
  const [customFrequency, setCustomFrequency] = useState({ value: 1, unit: 'week' });
  const [_inputValue, setInputValue] = useState('1');

  // Track if we're editing a virtual (expanded) instance of a repeating block
  const [editIsVirtualInstance, setEditIsVirtualInstance] = useState<boolean>(false);
  const [editInstanceDate, setEditInstanceDate] = useState<string | null>(null);

  const [newBlock, setNewBlock] = useState<{
    title: string;
    startTime: Date;
    endTime: Date;
    category: string;
    notes: string;
    location: string;
    isAllDay: boolean;
    alert: 'none' | 'at-time' | '5-min' | '10-min' | '15-min' | '30-min' | '1-hour' | '2-hours' | '1-day' | '2-days' | '1-week';
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
    alert: 'none',
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

    // Check if this is a virtual instance (repeated occurrence)
    const datePattern = /\d{4}-\d{2}-\d{2}$/;
    const isVirtualInstance = datePattern.test(block.id);

    // If it's a virtual instance, extract the original ID to edit the source event
    let editIdToUse = block.id;
    if (isVirtualInstance) {
      const parts = block.id.split('-');
      editIdToUse = parts.slice(0, 5).join('-'); // Get original UUID
      Logger.info('EDIT: Editing virtual instance, using original ID', { editId: editIdToUse });
    }

    // Remember whether this edit came from a virtual instance (and which date)
    setEditIsVirtualInstance(isVirtualInstance);
    try {
      const instanceDateStr = toLocalDateString(block.startTime);
      setEditInstanceDate(isVirtualInstance ? instanceDateStr : null);
    } catch {
      setEditInstanceDate(isVirtualInstance ? dateStr : null);
    }

    setEditId(editIdToUse);
    setNewBlock({
      ...block,
      notes: block.notes || '',
      location: block.location || '',
      startTime: new Date(block.startTime),
      endTime: new Date(block.endTime),
      alert: block.alert || 'none',
    });
    setInputValue(block.repeat.customFrequency?.value?.toString() || '1');
    setCustomFrequency(block.repeat.customFrequency || { value: 1, unit: 'week' });
    // Always start with repeat options closed when editing
    setShowRepeatOptions(false);
  };

  const handleDeleteBlock = (timeBlock: TimeBlockItem) => {

    try { triggerSelectionHaptic(); } catch {}
    setShowDeleteModal({ visible: true, timeBlock });
  };

  const handleDeleteConfirm = async (options: DeleteOptions) => {
    const timeBlock = showDeleteModal.timeBlock;
    if (!timeBlock) {return;}

    setShowDeleteModal({ visible: false });

    try {

      // Check if this is a virtual TimeBlock (repeated instance)
      // Virtual instances have format: uuid-YYYY-MM-DD (date at the end)
      const datePattern = /\d{4}-\d{2}-\d{2}$/;
      const isVirtualInstance = datePattern.test(timeBlock.id);

      if (isVirtualInstance) {
        // This is a virtual TimeBlock - handle differently based on delete option
        if (options.type === 'single') {
          // For virtual instances, create an exception record to hide this specific occurrence
          const parts = timeBlock.id.split('-');
          const originalId = parts.slice(0, 5).join('-'); // Reconstruct UUID
          const instanceDate = toLocalDateString(timeBlock.startTime); // Use startTime date in local timezone

          // Remove only this instance from native calendar
          if (timeBlock.calendarEventId) {

            await removeTimeBlockFromCalendar(timeBlock.calendarEventId, { type: 'single' });
          }

          // Add exception to original recurring event

          // Get existing metadata and merge exceptions
          const originalApiEntry = timeBlockEntries.find(entry => entry.id === originalId);
          const existingMetadata = originalApiEntry?.metadata || {};
          const existingExceptions = existingMetadata.exceptions || [];

          // Only add if not already in exceptions
          const newExceptions = existingExceptions.includes(instanceDate)
            ? existingExceptions
            : [...existingExceptions, instanceDate];

          // Update the original event to add this date as an exception
          await updateMutation.mutateAsync({
            id: originalId,
            updates: {
              metadata: {
                ...existingMetadata,
                exceptions: newExceptions,
              },
            },
          });

        } else if (options.type === 'future') {
          // For 'future' deletion on virtual instances, set end date on original event
          const parts = timeBlock.id.split('-');
          const originalId = parts.slice(0, 5).join('-');
          Logger.info('DELETE FUTURE VIRTUAL: Virtual instance detected');
          Logger.info('DELETE FUTURE VIRTUAL: Virtual ID', { virtualId: timeBlock.id });
          Logger.info('DELETE FUTURE VIRTUAL: Original ID', { originalId });

          // Set the end date to the day before the selected date
          const instanceDate = new Date(timeBlock.startTime);
          const currentDateStr = toLocalDateString(instanceDate);
          const endDate = new Date(instanceDate);
          endDate.setDate(endDate.getDate() - 1); // End the day before the selected date

          const endDateStr = toLocalDateString(endDate);
          Logger.info('DELETE FUTURE VIRTUAL: Setting end date', { endDate: endDateStr });
          Logger.info('DELETE FUTURE VIRTUAL: Adding current date to exceptions', { currentDate: currentDateStr });

          // Get current metadata from original event
          const originalApiEntry = timeBlockEntries.find(entry => entry.id === originalId);
          const existingMetadata = originalApiEntry?.metadata || {};
          const existingExceptions = existingMetadata.exceptions || [];
          Logger.info('DELETE FUTURE VIRTUAL: Existing metadata', { metadata: existingMetadata });

          // Add current date to exceptions to hide "this" instance
          const newExceptions = existingExceptions.includes(currentDateStr)
            ? existingExceptions
            : [...existingExceptions, currentDateStr];

          const newMetadata = {
            ...existingMetadata,
            endDate: endDateStr, // Store as YYYY-MM-DD
            exceptions: newExceptions, // Add current date to exceptions
          };
          Logger.info('DELETE FUTURE VIRTUAL: New metadata to save', { metadata: newMetadata });

          await updateMutation.mutateAsync({
            id: originalId,
            updates: {
              metadata: newMetadata,
            },
          });

          Logger.info('DELETE FUTURE VIRTUAL: Update mutation completed successfully');

          // Force cache invalidation for the current date to update UI immediately

          if (user?.id) {
            await queryClient.invalidateQueries({
              queryKey: queryKeys.timeBlocks.byDate(user.id, dateStr),
            });

            // Also invalidate broader queries to ensure consistency
            await queryClient.invalidateQueries({
              queryKey: [queryKeys.timeBlocks.all[0]],
            });
          }
        } else {
          // For 'all' deletions on virtual instances, delete the original event
          const parts = timeBlock.id.split('-');
          const originalId = parts.slice(0, 5).join('-');

          await deleteMutation.mutateAsync(originalId);
        }
      } else {

        // Check if this is a recurring event
        if (timeBlock.repeat.frequency !== 'never' && options.type === 'single') {

          // For original recurring event, "single" means add exception for this date
          const instanceDate = toLocalDateString(timeBlock.startTime);

          // Remove only this instance from native calendar
          if (timeBlock.calendarEventId) {

            await removeTimeBlockFromCalendar(timeBlock.calendarEventId, { type: 'single' });
          }

          // Add exception to this recurring event

          // Update the event to add this date as an exception
          try {
            // Find the original API entry to get existing metadata
            const originalApiEntry = timeBlockEntries.find(entry => entry.id === timeBlock.id);
            const existingMetadata = originalApiEntry?.metadata || {};
            const existingExceptions = existingMetadata.exceptions || [];
            // Only add the date if it's not already in exceptions
            const newExceptions = existingExceptions.includes(instanceDate)
              ? existingExceptions
              : [...existingExceptions, instanceDate];

            await updateMutation.mutateAsync({
              id: timeBlock.id,
              updates: {
                metadata: {
                  ...existingMetadata,
                  exceptions: newExceptions,
                },
              },
            });

            // Force cache invalidation for the current date to update UI immediately

            if (user?.id) {
              await queryClient.invalidateQueries({
                queryKey: queryKeys.timeBlocks.byDate(user.id, dateStr),
              });

              // Also invalidate broader queries to ensure consistency
              await queryClient.invalidateQueries({
                queryKey: [queryKeys.timeBlocks.all[0]],
              });
            }

          } catch (updateError) {
            Logger.error('🗓️ Error updating metadata', updateError as Error, {
        component: 'TimeBlockReactQuery',
      });
            Logger.error('🗓️ Error details', undefined, {
        component: 'TimeBlockReactQuery',
        data: updateError,
      });
            throw updateError;
          }
        } else if (options.type === 'future') {
          Logger.info('DELETE FUTURE: Starting future deletion for non-recurring event');

          // For "This entry & future entries", set the end date to the day before the selected date
          const instanceDate = new Date(timeBlock.startTime);
          const currentDateStr = toLocalDateString(instanceDate);
          const endDate = new Date(instanceDate);
          endDate.setDate(endDate.getDate() - 1); // End the day before the selected date

          const endDateStr = toLocalDateString(endDate);
          Logger.info('DELETE FUTURE: Setting end date', { endDate: endDateStr });
          Logger.info('DELETE FUTURE: Adding current date to exceptions', { currentDate: currentDateStr });
          Logger.info('DELETE FUTURE: Time block ID', { timeBlockId: timeBlock.id });

          // Get current metadata
          const originalApiEntry = timeBlockEntries.find(entry => entry.id === timeBlock.id);
          const existingMetadata = originalApiEntry?.metadata || {};
          const existingExceptions = existingMetadata.exceptions || [];
          Logger.info('DELETE FUTURE: Existing metadata', { metadata: existingMetadata });

          // Add current date to exceptions to hide "this" instance
          const newExceptions = existingExceptions.includes(currentDateStr)
            ? existingExceptions
            : [...existingExceptions, currentDateStr];

          const newMetadata = {
            ...existingMetadata,
            endDate: endDateStr, // Store as YYYY-MM-DD
            exceptions: newExceptions, // Add current date to exceptions
          };
          Logger.info('DELETE FUTURE: New metadata to save', { metadata: newMetadata });

          await updateMutation.mutateAsync({
            id: timeBlock.id,
            updates: {
              metadata: newMetadata,
            },
          });

          Logger.info('DELETE FUTURE: Update mutation completed successfully');

          // Force cache invalidation for the current date to update UI immediately

          if (user?.id) {
            await queryClient.invalidateQueries({
              queryKey: queryKeys.timeBlocks.byDate(user.id, dateStr),
            });

            // Also invalidate broader queries to ensure consistency
            await queryClient.invalidateQueries({
              queryKey: [queryKeys.timeBlocks.all[0]],
            });
          }
        } else {

          // Delete from calendar first if synced
          if (timeBlock.calendarEventId) {

            await removeTimeBlockFromCalendar(timeBlock.calendarEventId, options);
          }

          // Delete entire event from database
          await deleteMutation.mutateAsync(timeBlock.id);
        }
      }

      // Invalidate queries to refresh UI

      // Query invalidation will happen automatically via React Query mutation

      try { triggerLightHaptic(); } catch {}

      // Track delete analytics
      const durationMinutes = Math.round(
        (timeBlock.endTime.getTime() - timeBlock.startTime.getTime()) / (1000 * 60)
      );

      analytics.trackTimeBlockEvent('timeblock_deleted', {
        timeblock_id: timeBlock.id,
        category: timeBlock.category || 'unknown',
        duration_minutes: durationMinutes,
        was_all_day: timeBlock.isAllDay || false,
        date: dateStr,
      }, user?.id);
    } catch (deleteError) {
      Logger.error('Delete error', deleteError as Error, {
        component: 'TimeBlockReactQuery',
      });

      // Track delete error analytics
      analytics.trackTimeBlockEvent('timeblock_error', {
        error_type: deleteError instanceof Error ? deleteError.message : 'unknown_error',
        operation: 'delete_timeblock',
        date: dateStr,
      }, user?.id);

      Alert.alert('Error', 'Failed to delete time block');
    }
  };

  // Pagination controls for Time Blocks (match Todos design)
  const loadMoreBlocks = () => {
    setVisibleCount(prev => Math.min(prev + 5, timeBlocks.length));
  };

  const showLessBlocks = () => {
    setVisibleCount(3);
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
        Logger.error('Error creating date objects', dateError as Error, {
        component: 'TimeBlockReactQuery',
      });
        Alert.alert('Error', 'Invalid date or time values. Please check your input.');
        return;
      }

      // Calculate duration for analytics
      const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60));

      if (editId) {
        // Special case: editing a virtual instance while repeat features are gated
        // Instead of clearing the recurrence on the original event (which makes the instance disappear),
        // we add an exception for this date and create a one-off block for the edited instance.
        if (editIsVirtualInstance && !calendarGating.canUseRepeat) {
          try {
            const instanceDateStr = editInstanceDate || dateStr;

            // 1) Hide this date from the original recurring event by adding an exception (append)
            const originalApiEntry = timeBlockEntries.find(entry => entry.id === editId);
            const existingExceptions = (originalApiEntry?.metadata?.exceptions || []) as string[];
            const newExceptions = existingExceptions.includes(instanceDateStr)
              ? existingExceptions
              : [...existingExceptions, instanceDateStr];

            await updateMutation.mutateAsync({
              id: editId,
              updates: {
                metadata: {
                  exceptions: newExceptions,
                },
              },
            });

            // 2) Create a one-off time block for this date with the edited values
            const createData = {
              user_id: user?.id || '',
              selected_date: dateStr,
              title: newBlock.title.trim(),
              start_time: startDateTime.toISOString(),
              end_time: endDateTime.toISOString(),
              category: newBlock.category,
              description: newBlock.notes.trim() || undefined,
              location: newBlock.location.trim() || undefined,
              all_day: newBlock.isAllDay,
              repeat_rule: undefined,
              repeat_until: undefined,
            } as const;

            const created = await createMutation.mutateAsync(createData as any);

            // Optional: sync to calendar for the one-off instance (only if autoSync is enabled)
            if (calendarGating.canSyncToCalendar && autoSyncEnabled) {
              try {
                const timeBlockForSync = {
                  id: created.id,
                  title: newBlock.title.trim(),
                  startTime: startDateTime,
                  endTime: endDateTime,
                  location: newBlock.location.trim(),
                  notes: newBlock.notes.trim(),
                  isAllDay: newBlock.isAllDay,
                  alarmMinutes: alertToMinutes(newBlock.alert),
                  repeat: { frequency: 'never' as const },
                  calendarEventId: undefined,
                };
                const syncResult = await syncTimeBlockToCalendar(timeBlockForSync);
                if (syncResult.success && syncResult.eventId) {
                  await updateMutation.mutateAsync({ id: created.id, updates: { calendar_event_id: syncResult.eventId } });
                }
              } catch (calendarError) {
                Logger.warn('Calendar sync failed for one-off edit instance', {
      component: 'TimeBlockReactQuery',
      data: calendarError,
    });
              }
            }

            // Invalidate caches to refresh UI
            if (user?.id) {
              await queryClient.invalidateQueries({ queryKey: [queryKeys.timeBlocks.all[0]] });
            }

            const prevDurationMins = originalApiEntry
              ? Math.round((new Date(originalApiEntry.end_time).getTime() - new Date(originalApiEntry.start_time).getTime()) / 60000)
              : durationMinutes;

            analytics.trackTimeBlockEvent('timeblock_updated', {
              timeblock_id: editId,
              title_length: newBlock.title.trim().length,
              category: newBlock.category,
              duration_minutes: durationMinutes,
              previous_duration_minutes: prevDurationMins,
              is_all_day: newBlock.isAllDay,
              has_location: !!newBlock.location.trim(),
              has_notes: !!newBlock.notes.trim(),
              repeat_frequency: String(newBlock.repeat.frequency),
              date: dateStr,
            }, user?.id);

            return; // Done with special-case flow

          } catch (specialEditError) {
            Logger.error('Error editing virtual instance without repeat access', specialEditError as Error, {
        component: 'TimeBlockReactQuery',
      });
            // Fall through to regular edit handling as a fallback
          }
        }
        // Track update analytics
        const existingBlock = timeBlocks.find(block => block.id === editId);
        const previousDuration = existingBlock ?
          Math.round((existingBlock.endTime.getTime() - existingBlock.startTime.getTime()) / (1000 * 60)) : 0;

        // When editing, preserve the original event's selected_date.
        // For virtual instance edits, the original block is not in timeBlocks.
        // Look up the API entry to get the true original selected_date; fallback to existing block/dateStr.
        const originalApiEntry = timeBlockEntries.find(entry => entry.id === editId);
        const originalSelectedDate = originalApiEntry?.selected_date
          || (existingBlock?.startTime ? existingBlock.startTime.toISOString().split('T')[0] : dateStr);

        const timeBlockData = {
          user_id: user?.id || '',
          selected_date: originalSelectedDate, // Use original date, not current view date
          title: newBlock.title.trim(),
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          category: newBlock.category,
          description: newBlock.notes.trim() || undefined,
          location: newBlock.location.trim() || undefined,
          all_day: newBlock.isAllDay,
          alert: newBlock.alert || 'none',
          alarm_minutes: alertToMinutes(newBlock.alert), // TODO: Uncomment after running database migration
          // Repeat fields (only if user can use repeat)
          repeat_rule: (newBlock.repeat.frequency !== 'never' && calendarGating.canUseRepeat) ? {
            frequency: newBlock.repeat.frequency,
            customDays: newBlock.repeat.customDays,
          } : undefined,
        };

        const updateResult = await updateMutation.mutateAsync({ id: editId, updates: timeBlockData });

        // Sync updated time block to calendar (before cache invalidation) when autoSync is enabled
        let calendarEventIdToSave: string | undefined;
        if (calendarGating.canSyncToCalendar && autoSyncEnabled) {
          try {
            // Convert repeat frequency for calendar sync compatibility
            const calendarRepeat = {
              ...newBlock.repeat,
              frequency: newBlock.repeat.frequency === 'biweekly' ? 'weekly' :
                        (newBlock.repeat.frequency === 'custom' ? 'never' : newBlock.repeat.frequency),
            };

            const timeBlockForSync = {
              id: editId,
              title: newBlock.title.trim(),
              startTime: startDateTime,
              endTime: endDateTime,
              location: newBlock.location.trim(),
              notes: newBlock.notes.trim(),
              isAllDay: newBlock.isAllDay,
              alarmMinutes: alertToMinutes(newBlock.alert),
              repeat: calendarRepeat,
              calendarEventId: existingBlock?.calendarEventId || updateResult.calendar_event_id,
            };

            console.log('📆 [EDIT] Syncing to calendar with event ID:', timeBlockForSync.calendarEventId);

            // Sync to calendar (update or create)
            const syncResult = await syncTimeBlockToCalendar(timeBlockForSync);

            // Save calendar event ID if it's new
            if (syncResult.success && syncResult.eventId && !timeBlockForSync.calendarEventId) {
              calendarEventIdToSave = syncResult.eventId;
              console.log('📆 [EDIT] New calendar event ID to save:', calendarEventIdToSave);
            }
          } catch (calendarError) {
            Logger.warn('Calendar sync failed during update', {
      component: 'TimeBlockReactQuery',
      data: calendarError,
    });
          }
        }

        // Save calendar event ID if needed (single update)
        if (calendarEventIdToSave) {
          await updateMutation.mutateAsync({
            id: editId,
            updates: { calendar_event_id: calendarEventIdToSave },
          });
          Logger.info('EDIT: Saved calendar event ID to database');
        }

        // Force cache invalidation AFTER all operations complete
        // This is critical for recurring events where changes affect multiple dates
        if (user?.id) {
          await queryClient.invalidateQueries({
            queryKey: [queryKeys.timeBlocks.all[0]],
          });
          Logger.info('EDIT: Cache invalidated for all time blocks');
        }

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
        // Create new time block
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
          alert: newBlock.alert || 'none',
          alarm_minutes: alertToMinutes(newBlock.alert), // TODO: Uncomment after running database migration
          // Repeat fields (only if user can use repeat)
          repeat_rule: (newBlock.repeat.frequency !== 'never' && calendarGating.canUseRepeat) ? {
            frequency: newBlock.repeat.frequency,
            customDays: newBlock.repeat.customDays,
            customFrequency: newBlock.repeat.customFrequency,
          } : undefined,
          repeat_until: (newBlock.repeat.frequency !== 'never' && newBlock.repeat.endDate && calendarGating.canUseRepeat) ? newBlock.repeat.endDate.toISOString() : undefined,
        };

        const createResult = await createMutation.mutateAsync(timeBlockData);

        // Sync new time block to calendar when autoSync is enabled
        if (calendarGating.canSyncToCalendar && autoSyncEnabled) {
          try {
            Logger.info('CREATE: Starting calendar sync for new time block');
            // Convert repeat frequency for calendar sync compatibility
            const calendarRepeat = {
              ...newBlock.repeat,
              frequency: newBlock.repeat.frequency === 'biweekly' ? 'weekly' :
                        (newBlock.repeat.frequency === 'custom' ? 'never' : newBlock.repeat.frequency),
            };

            const timeBlockForSync = {
              id: createResult.id,
              title: newBlock.title.trim(),
              startTime: startDateTime,
              endTime: endDateTime,
              location: newBlock.location.trim(),
              notes: newBlock.notes.trim(),
              isAllDay: newBlock.isAllDay,
              alarmMinutes: alertToMinutes(newBlock.alert),
              repeat: calendarRepeat,
              calendarEventId: undefined, // No existing event ID for new time blocks
            };

            Logger.info('CREATE: Calling syncTimeBlockToCalendar...');
            const syncResult = await syncTimeBlockToCalendar(timeBlockForSync);
            Logger.info('CREATE: Sync result', { syncResult });

            if (syncResult.success && syncResult.eventId) {
              Logger.info('CREATE: Saving calendar event ID to database', { eventId: syncResult.eventId });
              // Update the time block with the calendar event ID (single update)
              await updateMutation.mutateAsync({
                id: createResult.id,
                updates: { calendar_event_id: syncResult.eventId },
              });
              Logger.info('CREATE: Calendar event ID saved successfully');
            } else {
              Logger.info('CREATE: ⚠️ Sync failed or no event ID returned', { error: syncResult.error });
            }
          } catch (calendarError) {
            Logger.error('CREATE: Calendar sync error', calendarError as Error, { component: 'TimeBlockReactQuery' });
            Logger.warn('Calendar sync failed during creation', {
      component: 'TimeBlockReactQuery',
      data: calendarError,
    });
          }
        } else {
          Logger.info('CREATE: ⚠️ Calendar sync disabled by gating');
        }

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

        // After creating a new time block, scroll the page to top
        try { scrollToTop(true); } catch {}
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
        alert: 'none',
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
      Logger.error('Time block save error', saveError as Error, {
        component: 'TimeBlockReactQuery',
      });

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
    // Check if planning is locked for future dates
    if (planningGating.isLocked) {
      planningGating.handleLockedAction();
      return;
    }

    setNewBlock({
      title: '',
      startTime: new Date(),
      endTime: new Date(Date.now() + 60 * 60 * 1000), // Default 1 hour duration
      category: '',
      notes: '',
      location: '',
      isAllDay: false,
      alert: 'none',
      repeat: {
        frequency: 'never',
      },
    });
    setIsAdding(true);
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
    triggerLightHaptic();
    setNewBlock(prev => ({ ...prev, isAllDay: !prev.isAllDay }));
  };

  // Date bucket logic
  const isToday = isTodayFn(selectedDate);
  const isYesterday = isYesterdayFn(selectedDate);
  const future = isAfter(startOfDay(selectedDate), startOfToday());
  const hasItems = timeBlocks.length > 0;

  // Determine if the JournalCard header should be shown
  // Show header when there are existing items OR when editing an existing block
  // Do NOT show header when the list is empty and user is adding a new block
  const showHeader = useMemo(() => {
    return hasItems || (!!editId && shouldShowAddingMode);
  }, [hasItems, editId, shouldShowAddingMode]);

  // Singular/plural helper
  const sp = (singular: string, plural: string, count: number) => (count === 1 ? singular : plural);

  // Header copy (shown when there are items, or when editing an existing item)
  const headerTitle = useMemo(() => {
    if (!showHeader) {return undefined;}
    if (future) {return sp('PLANNED TIME BLOCK', 'PLANNED TIME BLOCKS', timeBlocks.length);}
    if (isToday) {return sp('TIME BLOCK', 'TIME BLOCKS', timeBlocks.length);}
    if (isYesterday) {return sp('YESTERDAY’S TIME BLOCK', 'YESTERDAY’S TIME BLOCKS', timeBlocks.length);}
    return sp('TIME BLOCK ON THIS DAY', 'TIME BLOCKS ON THIS DAY', timeBlocks.length);
  }, [showHeader, future, isToday, isYesterday, timeBlocks.length]);

  const headerSubtitle = useMemo(() => {
    if (!showHeader) {return undefined;}
    if (future) {return 'Planned in faith, ready to begin';}
    if (isToday) {return 'Align your time with what matters';}
    if (isYesterday) {return 'How you spent your time';}
    return 'What filled your time on this day';
  }, [showHeader, future, isToday, isYesterday]);

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

  // Reset pagination when date changes
  useEffect(() => {
    setVisibleCount(3);
  }, [dateStr]);

  const renderTimeBlock = (block: TimeBlockItem) => {
    const isExpanded = expandedNotes[block.id] || false; // Collapsed by default, expandable on tap

    return (
// ...
      <View key={block.id} style={[styles.swipeableContainer, styles.swipeableContainerInline]}>
        <Swipeable
          ref={(ref: any) => {
            if (ref) {
              swipeableRefs.current[block.id] = ref;
            } else {
              delete swipeableRefs.current[block.id];
            }
          }}
          onSwipeableWillOpen={() => { try { triggerSelectionHaptic(); } catch {} }}
          renderRightActions={() => (
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
                onPress={() => {

                  try { triggerSelectionHaptic(); } catch {}
                  handleDeleteBlock(block);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={22} color="white" />
              </TouchableOpacity>
            </View>
          )}
          rightThreshold={40}
          friction={2}
          overshootRight={false}
          enabled={true}
      >
        <View style={[styles.timeBlockCard, styles.timeBlockCardInline]}>
          <View style={[styles.timeColumn, styles.timeColumnInline]}>
            {/* Calendar Sync (inline above time) - hidden when auto-sync is enabled */}
            {(!autoSyncEnabled && (calendarGating.canSyncToCalendar || !!block.calendarEventId)) && (
              <View style={styles.calendarSyncInline}>
                <CalendarSyncButton
                  timeBlock={block}
                  calendarEventId={block.calendarEventId}
                  onSyncComplete={async (eventId) => {
                    try {
                      // For repeating instances, block.id is virtual: `${originalId}-${date}`
                      // Persist to the original record ID so it survives refresh
                      const persistId = (block.id.includes('-')
                        ? block.id.split('-').slice(0, 5).join('-')
                        : block.id);

                      await updateMutation.mutateAsync({
                        id: persistId,
                        updates: { calendar_event_id: (eventId || null) as string | undefined }, // Cast to satisfy TypeScript, null clears the field
                      });

                      // Optimistically patch cache for current date so UI stays updated
                      // Don't invalidate immediately - let the mutation's onSuccess handle it
                      // to avoid race condition where refetch happens before DB update completes
                      try {
                        const qk = queryKeys.timeBlocks.byDate(user?.id || '', dateStr);
                        queryClient.setQueryData<any[]>(qk, (old) => {
                          if (!Array.isArray(old)) { return old; }
                          return old.map((tb) => {
                            if (tb.id === block.id || tb.id === persistId) {
                              return { ...tb, calendar_event_id: eventId || null }; // Use null to clear
                            }
                            return tb;
                          });
                        });
                      } catch {}
                    } catch (catchError) {
                      Logger.error('🟢 [onSyncComplete] ❌ Failed to update time block with calendar event ID', catchError as Error, {
        component: 'TimeBlockReactQuery',
      });
                    }
                  }}
                  compact
                />
              </View>
            )}
            {block.isAllDay ? (
              <View style={styles.allDayBadge}>
                <ThemedText weight="semiBold" style={styles.allDayText}>ALL DAY</ThemedText>
              </View>
            ) : (
              <View style={styles.timeRangeStacked}>
                <ThemedText weight="semiBold" style={[styles.timeText, styles.timeTextInline]}>{formatTime(block.startTime)}</ThemedText>
                <ThemedText weight="semiBold" style={[styles.timeSeparatorText, styles.timeSeparatorTextInline]}>TO</ThemedText>
                <ThemedText weight="semiBold" style={[styles.timeText, styles.timeTextInline]}>{formatTime(block.endTime)}</ThemedText>
                <View style={[styles.durationContainer, styles.durationContainerInline]}>
                  <ThemedText style={[styles.durationText, styles.durationTextInline]}>
                    {formatDuration(block.startTime, block.endTime)}
                  </ThemedText>
                </View>
              </View>
            )}
          </View>
          <View style={styles.detailsColumn}>
            <View style={styles.detailsRow}>
              <ThemedText weight="semiBold" style={[styles.blockTitle, styles.blockTitleInline]}>{block.title}</ThemedText>
            </View>
            <View style={styles.detailsContent}>
              <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(block.category) }]}>
                <View style={styles.categoryContent}>
                  <Ionicons
                    name={getCategoryIcon(block.category)}
                    size={12}
                    color={Colors.anchorBlue}
                    style={styles.categoryIcon}
                  />
                  <ThemedText weight="medium" style={styles.categoryLabel} numberOfLines={1} ellipsizeMode="tail">
                    {block.category || 'Others'}
                  </ThemedText>
                </View>
              </View>
              {(block.location || block.repeat.frequency !== 'never' || (block.alert && block.alert !== 'none')) && (
                <View style={styles.metaInfoContainer}>
                  {block.location && (
                    <View style={styles.metaInfoRow}>
                      <Ionicons name="location-outline" size={12} color={Colors.hopeWhite} style={styles.metaIcon} />
                      <ThemedText style={styles.metaText} numberOfLines={1} ellipsizeMode="tail">
                        {block.location}
                      </ThemedText>
                    </View>
                  )}
                  {block.repeat.frequency !== 'never' && (
                    <View style={styles.metaInfoRow}>
                      <Ionicons name="repeat-outline" size={12} color={Colors.hopeWhite} style={styles.metaIcon} />
                      <ThemedText style={styles.metaText}>
                        {formatRepeatText(block.repeat.frequency, block.repeat.customDays, block.repeat.customFrequency)}
                        {block.repeat.endDate ? ` until ${block.repeat.endDate.toLocaleDateString()}` : ''}
                      </ThemedText>
                    </View>
                  )}
                  {block.alert && block.alert !== 'none' && (
                    <View style={styles.metaInfoRow}>
                      <Ionicons name="notifications-outline" size={12} color={Colors.hopeWhite} style={styles.metaIcon} />
                      <ThemedText style={styles.metaText}>
                        {block.alert === 'at-time' ? 'At time of event' :
                         block.alert === '5-min' ? '5 min before' :
                         block.alert === '10-min' ? '10 min before' :
                         block.alert === '15-min' ? '15 min before' :
                         block.alert === '30-min' ? '30 min before' :
                         block.alert === '1-hour' ? '1 hour before' :
                         block.alert === '2-hours' ? '2 hours before' :
                         block.alert === '1-day' ? '1 day before' :
                         block.alert === '2-days' ? '2 days before' :
                         block.alert === '1-week' ? '1 week before' : ''}
                      </ThemedText>
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
        icon={<MaterialCommunityIcons name="timeline-text-outline" size={24} color={Colors.alertCoral} />}
        title={timeBlocks.length === 1 ? 'TIME BLOCK' : 'TIME BLOCKS'}
        subtitle="Schedule and organize your day"
        showAddButton={false}
        onAdd={() => {}}
        isAdding={false}
        variant={variant}
        viewMode={viewMode}
      >
        <TimeBlockSkeleton count={2} />
      </JournalCard>
    );
  }

  // Hide empty component in inline view for all date buckets
  if (viewMode === 'inline' && !isLoading && timeBlocks.length === 0) {
    return null;
  }

  return (
    <JournalCard
      icon={showHeader ? <MaterialCommunityIcons name="timeline-text-outline" size={24} color={Colors.alertCoral} /> : undefined}
      title={headerTitle}
      subtitle={headerSubtitle}
      showAddButton={hasItems && !shouldShowAddingMode}
      onAdd={startAdding}
      isAdding={shouldShowAddingMode}
      variant={variant}
      viewMode={viewMode}
      expanded={expanded}
      onExpand={onExpand}
      headerRight={planningGating.lockIconVisible ? (
        <PlanningLockIcon
          tier={planningGating.currentTier}
          context="inApp"
          onLockTap={planningGating.handleLockedAction}
          size={16}
        />
      ) : undefined}
    >
      {/* Show empty state or time blocks */}
      {timeBlocks.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="timeline-text-outline"
              size={32}
              color={Colors.textGray}
              style={styles.emptyStateIcon}
            />
            <ThemedText weight="semiBold" style={styles.sectionLabel}>TIME BLOCKS</ThemedText>
          </View>
          {/* Empty state copy varies by date bucket */}
          {isToday && (
            <>
              <ThemedText weight="semiBold" style={styles.emptyStateTitle}>Plan Your Day with Purpose</ThemedText>
              <ThemedText style={styles.emptyStateText}>Schedule timeblocks to align your time with God's calling</ThemedText>
              {!shouldShowAddingMode && (
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => {
                    triggerLightHaptic();
                    startAdding();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Begin planning your day"
                >
                  <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
                  <ThemedText weight="medium" style={styles.emptyStateButtonText}>Begin</ThemedText>
                </TouchableOpacity>
              )}
            </>
          )}
          {isYesterday && (
            <>
              <ThemedText weight="semiBold" style={styles.emptyStateTitle}>Revisit Yesterday</ThemedText>
              <ThemedText style={styles.emptyStateText}>Capture how you spent your time yesterday</ThemedText>
              {!shouldShowAddingMode && (
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => {
                    triggerLightHaptic();
                    startAdding();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Revisit yesterday's time blocks"
                >
                  <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
                  <ThemedText weight="medium" style={styles.emptyStateButtonText}>Revisit</ThemedText>
                </TouchableOpacity>
              )}
            </>
          )}
          {!isToday && !isYesterday && !future && (
            <>
              <ThemedText weight="semiBold" style={styles.emptyStateTitle}>Revisit This Day</ThemedText>
              <ThemedText style={styles.emptyStateText}>Note what filled your time on this day</ThemedText>
              {!shouldShowAddingMode && (
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => {
                    triggerLightHaptic();
                    startAdding();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Revisit this day's time blocks"
                >
                  <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
                  <ThemedText weight="medium" style={styles.emptyStateButtonText}>Revisit</ThemedText>
                </TouchableOpacity>
              )}
            </>
          )}
          {future && (
            <>
              <ThemedText weight="semiBold" style={styles.emptyStateTitle}>Plan Schedule Ahead</ThemedText>
              <ThemedText style={styles.emptyStateText}>Prayerfully plan how you’ll spend this day</ThemedText>
              {!shouldShowAddingMode && (
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => {
                    triggerLightHaptic();
                    startAdding();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Plan time blocks for this future day"
                >
                  <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
                  <ThemedText weight="medium" style={styles.emptyStateButtonText}>Pray & Plan</ThemedText>
                </TouchableOpacity>
              )}
            </>
          )}
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
          {/* Pagination controls matching Todos */}
          {!shouldShowAddingMode && timeBlocks.length > 0 && (
            <View style={styles.paginationContainer}>
              <View style={styles.paginationButtonGroup}>
                {timeBlocks.length > visibleCount && (
                  <TouchableOpacity
                    style={[styles.paginationButton, styles.showMoreButton]}
                    onPress={loadMoreBlocks}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${Math.min(5, timeBlocks.length - visibleCount)} more time blocks`}
                    accessibilityHint="Loads 5 more time blocks"
                  >
                    <Ionicons name="chevron-down" size={12} color={Colors.alertCoral} />
                    <ThemedText weight="medium" style={[styles.paginationButtonText, styles.showMoreText]}>Show more</ThemedText>
                  </TouchableOpacity>
                )}
                {visibleCount > 3 && timeBlocks.length > 3 && (
                  <TouchableOpacity
                    style={[styles.paginationButton, styles.showLessButton]}
                    onPress={showLessBlocks}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Show less time blocks"
                    accessibilityHint="Collapses the list to show only the first 3 time blocks"
                  >
                    <Ionicons name="chevron-up" size={12} color={Colors.textGray} />
                    <ThemedText weight="medium" style={[styles.paginationButtonText, styles.showLessText]}>Show less</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
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
                  <ThemedText weight="semiBold" style={styles.allDayText}>ALL DAY</ThemedText>
                </View>
              ) : (
                <View style={styles.timeRangeEdit}>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => { triggerLightHaptic(); setShowTimePicker({ start: true, end: false, id: null }); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Start time: ${formatTime(newBlock.startTime)}`}
                    accessibilityHint="Tap to change the start time for this time block"
                  >
                    <ThemedText weight="semiBold" style={styles.timeText}>{formatTime(newBlock.startTime)}</ThemedText>
                  </TouchableOpacity>
                  <View style={styles.timeSeparatorContainer}>
                    <ThemedText weight="semiBold" style={styles.timeSeparatorText}>TO</ThemedText>
                  </View>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => { triggerLightHaptic(); setShowTimePicker({ start: false, end: true, id: null }); }}
                    accessibilityRole="button"
                    accessibilityLabel={`End time: ${formatTime(newBlock.endTime)}`}
                    accessibilityHint="Tap to change the end time for this time block"
                  >
                    <ThemedText weight="semiBold" style={styles.timeText}>{formatTime(newBlock.endTime)}</ThemedText>
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
                  <ThemedText style={styles.allDayLabel}>All Day</ThemedText>
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
                  onPress={() => { triggerLightHaptic(); setShowTimePicker({ start: false, end: false, id: null }); }}
                >
                  <ThemedText weight="medium" style={styles.doneButtonText}>Done</ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 2. Activity Title */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                styles.fullWidth,
                showTitleError && styles.inputError,
                { fontFamily: getFontFamily(fontKey, 'regular') },
              ]}
              value={newBlock.title}
              onChangeText={(text) => {
                setNewBlock({...newBlock, title: text});
                if (showTitleError && text.trim()) {
                  setShowTitleError(false);
                }
              }}
              placeholder="Enter a title"
              placeholderTextColor={Colors.textGray}
              accessibilityLabel="Time block title"
              accessibilityHint="Enter a descriptive title for your time block. This field is required."
              accessibilityRole="text"
            />
            {showTitleError && <ThemedText style={styles.errorText}>Title is required</ThemedText>}
          </View>

          {/* 3. Location */}
          <View style={styles.inputContainer}>
            <LocationSelector
              currentLocation={newBlock.location || ''}
              onLocationSelect={(location) => {
                setNewBlock({...newBlock, location});
              }}
              placeholder="Add location"
            />
          </View>

          {/* 4. Category */}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={[
                styles.categorySelector,
                !newBlock.category && showCategoryError && styles.categorySelectorError,
                newBlock.category && [
                  { backgroundColor: getCategoryColor(newBlock.category) },
                  styles.categorySelected,
                ],
              ]}
              onPress={() => { triggerLightHaptic(); setShowCategoryPicker(true); }}
              accessibilityRole="button"
              accessibilityLabel={newBlock.category ? `Selected category: ${newBlock.category}` : 'Select category'}
              accessibilityHint="Tap to open category selection menu. This field is required."
            >
              <Ionicons
                name={newBlock.category ? getCategoryIcon(newBlock.category) : 'add-circle-outline'}
                size={16}
                color={newBlock.category ? Colors.anchorBlue : Colors.hopeWhite}
              />
              <ThemedText style={[
                styles.categorySelectorText,
                !newBlock.category && styles.placeholderText,
                newBlock.category && { color: Colors.anchorBlue },
                !newBlock.category && showCategoryError && { color: Colors.alertCoral },
              ]}>
                {newBlock.category || 'Select a Category'}
              </ThemedText>
              <Ionicons
                name="chevron-down"
                size={16}
                color={newBlock.category ? Colors.anchorBlue : ((!newBlock.category && showCategoryError) ? Colors.alertCoral : Colors.hopeWhite)}
              />
            </TouchableOpacity>
            {showCategoryError && !newBlock.category && (
              <ThemedText style={styles.errorText}>Please select a category</ThemedText>
            )}
          </View>

          {/* 5. Repeat Options */}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.repeatButton}
              onPress={() => {
                triggerLightHaptic();
                setShowRepeatOptions(!showRepeatOptions);
              }}
            >
              <Ionicons
                name="repeat-outline"
                size={18}
                color={Colors.hopeWhite}
                style={styles.repeatIcon}
              />
              <ThemedText style={styles.repeatText}>
                {formatRepeatText(newBlock.repeat.frequency, newBlock.repeat.customDays, customFrequency, weekStartsOn) +
                 (newBlock.repeat.endDate ? ` until ${newBlock.repeat.endDate.toLocaleDateString()}` : '')}
              </ThemedText>
              <Ionicons
                name={showRepeatOptions ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.hopeWhite}
              />
            </TouchableOpacity>

            {showRepeatOptions && (
              <View style={styles.repeatOptions}>
                {['never', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly', 'custom'].map((freq, idx, arr) => {
                  const isPremiumFeature = freq !== 'never' && !calendarGating.canUseRepeat;
                  // Compute conditional border style to avoid inline styles
                  const borderStyle = idx === arr.length - 1 ? { borderBottomWidth: 0 } : {};

                  return (
                    <TouchableOpacity
                      key={freq}
                      style={[
                        styles.repeatOption,
                        newBlock.repeat.frequency === freq && styles.selectedRepeatOption,
                        borderStyle,
                      ]}
                      onPress={() => {
                        if (isPremiumFeature) {
                          calendarGating.handleRepeatLockTap();
                          return;
                        }

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
                      <ThemedText style={[
                        styles.repeatOptionText,
                        isPremiumFeature && styles.lockedRepeatText,
                      ]}>
                        {freq === 'never' ? 'Never' :
                         freq === 'daily' ? 'Every Day' :
                         freq === 'weekly' ? 'Every Week' :
                         freq === 'biweekly' ? 'Every 2 Weeks' :
                         freq === 'monthly' ? 'Every Month' :
                         freq === 'yearly' ? 'Every Year' : 'Custom...'}
                      </ThemedText>
                      {isPremiumFeature && (
                        <MaterialCommunityIcons
                          name="lock"
                          size={14}
                          color={Colors.textGray}
                        />
                      )}
                      {newBlock.repeat.frequency === freq && !isPremiumFeature && (
                        <Ionicons name="checkmark" size={16} color={Colors.alertCoral} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Custom Repeat Options */}
            {newBlock.repeat.frequency === 'custom' && (
              <View style={styles.customRepeatContainer}>
                {/* Frequency Selector */}
                <View style={styles.frequencySelector}>
                  <ThemedText style={styles.frequencyLabel}>Repeat every:</ThemedText>
                  <View style={styles.frequencyInputs}>
                    <TextInput
                      style={[styles.frequencyInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
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
                      onPress={() => { triggerLightHaptic(); setShowFrequencySelector(!_showFrequencySelector); }}
                    >
                      <ThemedText style={styles.frequencyUnitText}>
                        {customFrequency.unit.charAt(0).toUpperCase() + customFrequency.unit.slice(1)}{customFrequency.value > 1 ? 's' : ''}
                      </ThemedText>
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
                            triggerSelectionHaptic();
                            setShowFrequencySelector(false);
                          }}
                        >
                          <ThemedText style={styles.frequencyOptionText}>
                            {unit.charAt(0).toUpperCase() + unit.slice(1)}
                          </ThemedText>
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
                    <ThemedText style={styles.customDaysLabel}>On days:</ThemedText>
                    <View style={styles.daysOfWeekContainer}>
                      {Array.from({ length: 7 }).map((_, i) => {
                        const dayIndex = (i + weekStartsOn) % 7; // 0=Sun..6=Sat, rotated by preference
                        const label = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dayIndex];
                        const isSelected = newBlock.repeat.customDays?.includes(dayIndex);
                        return (
                          <TouchableOpacity
                            key={dayIndex}
                            style={[
                              styles.dayButton,
                              isSelected && styles.dayButtonSelected,
                            ]}
                            onPress={() => {
                              const updatedDays = newBlock.repeat.customDays || [];
                              const newDays = updatedDays.includes(dayIndex)
                                ? updatedDays.filter(d => d !== dayIndex)
                                : [...updatedDays, dayIndex];

                              setNewBlock({
                                ...newBlock,
                                repeat: {
                                  ...newBlock.repeat,
                                  // Keep stored indices in natural 0=Sun..6 order; sort numerically
                                  customDays: newDays.sort((a, b) => a - b),
                                },
                              });
                            }}
                          >
                            <ThemedText style={[
                              styles.dayButtonText,
                              isSelected && styles.dayButtonTextSelected,
                            ]}>
                              {label}
                            </ThemedText>
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
              <ThemedText style={styles.endRepeatLabel}>End Repeat:</ThemedText>
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
                  <ThemedText style={styles.endRepeatOptionText}>Never</ThemedText>
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
                      triggerLightHaptic();
                      setShowEndDatePicker(!_showEndDatePicker);
                    }}
                  >
                    <ThemedText style={styles.endRepeatOptionText}>
                      {newBlock.repeat.endDate
                        ? newBlock.repeat.endDate.toLocaleDateString()
                        : 'Select End Date'}
                    </ThemedText>
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
                  <ThemedText weight="semiBold" style={styles.datePickerTitle}>Select End Date</ThemedText>
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
                    onPress={() => { triggerLightHaptic(); setShowEndDatePicker(false); }}
                  >
                    <ThemedText weight="medium" style={styles.doneButtonText}>Done</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          )}

          {/* 6. Alert */}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.repeatButton}
              onPress={() => {
                triggerLightHaptic();
                setShowAlertModal(true);
              }}
            >
              <Ionicons
                name="notifications-outline"
                size={18}
                color={Colors.hopeWhite}
                style={styles.repeatIcon}
              />
              <ThemedText style={styles.repeatText}>
                {newBlock.alert === 'none' ? 'None' :
                 newBlock.alert === 'at-time' ? 'At time of event' :
                 newBlock.alert === '5-min' ? '5 minutes before' :
                 newBlock.alert === '10-min' ? '10 minutes before' :
                 newBlock.alert === '15-min' ? '15 minutes before' :
                 newBlock.alert === '30-min' ? '30 minutes before' :
                 newBlock.alert === '1-hour' ? '1 hour before' :
                 newBlock.alert === '2-hours' ? '2 hours before' :
                 newBlock.alert === '1-day' ? '1 day before' :
                 newBlock.alert === '2-days' ? '2 days before' :
                 newBlock.alert === '1-week' ? '1 week before' : 'None'}
              </ThemedText>
              <Ionicons
                name="chevron-down"
                size={16}
                color={Colors.hopeWhite}
              />
            </TouchableOpacity>
          </View>

          {/* 7. Notes */}
          <TextInput
            style={[styles.input, styles.notesInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
            value={newBlock.notes}
            onChangeText={(text) => setNewBlock({...newBlock, notes: text})}
            placeholder="Add notes (optional)"
            placeholderTextColor={Colors.textGray}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />

          {/* Category Picker Modal */}
          <TimeBlockCategoryModal
            visible={showCategoryPicker}
            selectedCategory={newBlock.category}
            onSelect={(category) => {
              setNewBlock({...newBlock, category: category.name});
              setShowCategoryPicker(false);

              // Track category selection analytics
              analytics.trackTimeBlockEvent('timeblock_category_selected', {
                category: category.name,
                date: dateStr,
              }, user?.id);
            }}
            onCancel={() => setShowCategoryPicker(false)}
          />

          {/* Alert Modal */}
          <Modal
            visible={showAlertModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowAlertModal(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowAlertModal(false)}
            >
              <TouchableOpacity
                style={styles.alertModalContent}
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
              >
                <ThemedText weight="semiBold" style={styles.alertModalTitle}>Alert</ThemedText>
                <ScrollView style={styles.alertOptions}>
                  {[
                    { value: 'none', label: 'None' },
                    { value: 'at-time', label: 'At time of event' },
                    { value: '5-min', label: '5 minutes before' },
                    { value: '10-min', label: '10 minutes before' },
                    { value: '15-min', label: '15 minutes before' },
                    { value: '30-min', label: '30 minutes before' },
                    { value: '1-hour', label: '1 hour before' },
                    { value: '2-hours', label: '2 hours before' },
                    { value: '1-day', label: '1 day before' },
                    { value: '2-days', label: '2 days before' },
                    { value: '1-week', label: '1 week before' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.alertOption,
                        newBlock.alert === option.value && styles.selectedAlertOption,
                      ]}
                      onPress={() => {
                        triggerLightHaptic();
                        setNewBlock({...newBlock, alert: option.value as any});
                        setShowAlertModal(false);
                      }}
                    >
                      <ThemedText
                        weight={newBlock.alert === option.value ? 'semiBold' : 'medium'}
                        style={[
                          styles.alertOptionText,
                          newBlock.alert === option.value && styles.selectedAlertOptionText,
                        ]}
                      >
                        {option.label}
                      </ThemedText>
                      {newBlock.alert === option.value && (
                        <Ionicons name="checkmark" size={20} color={Colors.alertCoral} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          <View style={styles.buttonRow}>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  triggerLightHaptic();
                  setIsAdding(false);
                  setEditId(null);
                  // Scroll to top when canceling, same as when saving
                  try { scrollToTop(true); } catch {}
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel adding time block"
                accessibilityHint="Discards the current time block and returns to the main view"
              >
                <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton, !newBlock.title.trim() && styles.disabledButton]}
                onPress={() => {
                  triggerLightHaptic();
                  addTimeBlock();
                }}
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

      {/* Delete Modal - Always available regardless of edit mode */}
      <DeleteTimeBlockModal
        visible={showDeleteModal.visible}
        isRecurring={showDeleteModal.timeBlock?.repeat.frequency !== 'never'}
        eventDate={showDeleteModal.timeBlock?.startTime || new Date()}
        eventTitle={showDeleteModal.timeBlock?.title || ''}
        onDelete={handleDeleteConfirm}
        onCancel={() => setShowDeleteModal({ visible: false })}
        canDeleteSeries={calendarGating.canDeleteSeries}
      />
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
      <ThemedText
        style={styles.notesText}
        numberOfLines={isExpanded ? undefined : 2}
        ellipsizeMode="tail"
      >
        {notes}
      </ThemedText>
      {showChevron && (
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={Colors.textGray}
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
    width: 168, // Match Todos swipe area width for consistency
    height: '100%', // Match the card height
    marginLeft: 8, // Add consistent gap like Todos
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
    backgroundColor: Colors.alertCoral,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  loadingText: {
    color: Colors.textGray,
    fontSize: 13,
    textAlign: 'center',
    padding: 16,
  },
  emptyText: {
    color: Colors.textGray,
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
    fontWeight: '600',
    fontSize: 12,
    color: Colors.textGray,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 6,
    opacity: 0.9,
  },
  emptyStateTitle: {
    marginTop: 2,
    fontWeight: '600',
    fontSize: 18,
    letterSpacing: 0.2,
    color: Colors.hopeWhite,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyStateText: {
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
  addButton: {
    padding: 4,
    marginLeft: 12,
  },
  showMoreButtonLegacy: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  showMoreTextLegacy: {
    color: Colors.anchorBlue,
    fontSize: 13,
  },
  timeBlockCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: Colors.actionBackground,
    borderWidth: 0.5,
    borderColor: Colors.lightBorder,
    minHeight: 60,
    overflow: 'hidden',
  },
  timeBlockCardInline: {
    borderRadius: 16,
    backgroundColor: Colors.anchorBlue,
    borderWidth: 1,
    borderColor: Colors.mediumBorder,
    paddingVertical: 12,
  },
  timeBlockCardMoments: {
    borderRadius: 16,
    backgroundColor: Colors.anchorBlue,
    borderWidth: 1,
    borderColor: Colors.mediumBorder,
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
    borderColor: Colors.quietReflection,
    backgroundColor: Colors.restfulShadow,
  },
  durationContainerInline: {
    borderColor: Colors.hopeWhite,
    backgroundColor: Colors.lightOverlay,
  },
  durationText: {
    fontSize: 10,
    color: Colors.textGray,
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
    paddingRight: 12,
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
    marginBottom: 4,
    borderWidth: 0.5,
    borderColor: Colors.lightOverlay,
    backgroundColor: Colors.subtleOverlay,
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    marginRight: 4,
  },
  categoryLabel: {
    fontWeight: '600',
    fontSize: 11,
    color: Colors.anchorBlue,
    maxWidth: 100,
  },
  metaInfoContainer: {
    marginTop: 6,
    gap: 4,
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 20,
  },
  metaIcon: {
    marginRight: 4,
    width: 12,
  },
  metaText: {
    fontSize: 11,
    color: Colors.tertiaryText,
    flex: 1,
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 16,
    marginTop: 0,
    paddingRight: 4,
  },
  notesContainer: {
    width: '100%',
    marginTop: 3,
    backgroundColor: Colors.whisperOverlay,
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
    fontSize: 14,
    color: Colors.darkGray,
    flex: 1,
    marginRight: 8,
  },
  category: {
    fontSize: 11,
    color: Colors.textGray,
    backgroundColor: Colors.restfulShadow,
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
    fontSize: 12,
    color: Colors.textGray,
    marginLeft: 4,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  notesText: {
    fontSize: 11,
    color: Colors.holyGlow,
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
    color: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: Colors.mediumBorder,
    height: 44,
    fontSize: 14,
  },
  // Pagination styles (match Todos)
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
    borderRadius: 18,
    backgroundColor: Colors.mediumOverlay,
  },
  paginationButtonText: {
    marginLeft: 2,
    fontSize: 11,
    lineHeight: 14,
  },
  showMoreButton: {
    backgroundColor: Colors.lightOverlay,
  },
  showMoreText: {
    color: Colors.alertCoral,
  },
  showLessButton: {
    backgroundColor: Colors.restfulShadow,
  },
  showLessText: {
    color: Colors.textGray,
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
    borderColor: Colors.mediumBorder,
    height: 44,
    backgroundColor: 'transparent',
    width: '100%',
  },
  categorySelectorText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginLeft: 8,
    flex: 1,
  },
  placeholderText: {
    color: Colors.textGray,
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
    borderColor: Colors.mediumBorder,
    padding: 8,
    color: Colors.hopeWhite,
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
    backgroundColor: Colors.mediumOverlay,
    borderWidth: 1,
    borderColor: Colors.mediumBorder,
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
    backgroundColor: Colors.lightOverlay,
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
    borderRadius: 30,
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
    borderColor: Colors.mediumBorder,
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
    borderColor: Colors.mediumBorder,
  },
  repeatIcon: {
    marginRight: 8,
  },
  repeatText: {
    color: Colors.hopeWhite,
    flex: 1,
    fontSize: 14,
  },
  repeatOptions: {
    marginTop: 8,
    backgroundColor: Colors.anchorBlue,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.mediumBorder,
  },
  repeatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.mediumOverlay,
  },
  selectedRepeatOption: {
    backgroundColor: Colors.lightOverlay,
  },
  repeatOptionText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 20,
    width: '90%',
    maxWidth: 285,
    padding: 16,
    margin: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  alertModalContent: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 30,
    width: '85%',
    maxWidth: 320,
    maxHeight: '70%',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  alertModalTitle: {
    fontSize: 18,
    color: Colors.alertCoral,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  alertOptions: {
    maxHeight: 400,
  },
  alertOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedAlertOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  alertOptionText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  selectedAlertOptionText: {
    color: Colors.hopeWhite,
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
    borderColor: Colors.mediumBorder,
  },
  customRepeatLabel: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
  },
  frequencySelector: {
    marginBottom: 12,
  },
  frequencyLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
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
    color: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: Colors.mediumBorder,
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
    borderColor: Colors.mediumBorder,
    paddingHorizontal: 10,
    height: 36,
    minWidth: 100,
  },
  frequencyUnitText: {
    flex: 1,
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
    borderColor: Colors.mediumBorder,
    zIndex: 1000,
    elevation: 5,
  },
  frequencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.mediumOverlay,
  },
  frequencyOptionText: {
    flex: 1,
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  customDaysContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.restfulShadow,
  },
  customDaysLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
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
    borderColor: Colors.mediumBorder,
    margin: 1,
  },
  dayButtonSelected: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
  },
  dayButtonText: {
    fontSize: 12,
    color: Colors.hopeWhite,
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
    borderColor: Colors.mediumBorder,
    minHeight: 48,
  },
  endRepeatOptionText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    flex: 1,
  },
  selectedEndRepeatOption: {
    backgroundColor: Colors.lightOverlay,
    borderColor: Colors.alertCoral,
  },
  datePickerModalContent: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 16,
    margin: 0,
    alignItems: 'center',
    // Removed border for compact modal
  },
  datePickerTitle: {
    fontSize: 18,
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
  calendarSyncInline: {
    alignSelf: 'center',
    marginBottom: 6,
    backgroundColor: 'transparent',
  },
  calendarSyncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.lightOverlay,
    borderRadius: 8,
    marginTop: 8,
  },
  locationInputTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.lightOverlay,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
  },
  locationSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.lightOverlay,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
    marginLeft: 8,
  },
  lockedRepeatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.subtleOverlay,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.lightOverlay,
    opacity: 0.6,
  },
  lockedRepeatText: {
    fontSize: 14,
    color: Colors.textGray,
    marginLeft: 8,
    fontStyle: 'italic',
  },
});

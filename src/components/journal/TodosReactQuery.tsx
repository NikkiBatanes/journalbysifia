import React, { useMemo, useState, useRef, useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Entypo from 'react-native-vector-icons/Entypo';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, Alert, Modal, Platform } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

import { Check, ListTodo as LuListTodo, X, Pencil } from 'lucide-react-native';
import { SwipeableTodoItem } from '../SwipeableTodoItem';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import { ErrorBoundary } from '../ErrorBoundary';
import { TodoSkeleton } from '../SkeletonLoader/TodoSkeleton';
import { analytics } from '../../utils/analytics';
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';

// React Query hooks
import {
  useTodosData,
  useCreateTodoEntry,
  useUpdateTodoEntry,
  useDeleteTodoEntry,
} from '../../services/hooks/useJournalData';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  priority?: boolean;
  completedAt?: number;
}

interface TodosProps {
  selectedDate?: Date;
  refreshKey?: number;
  variant?: 'carousel' | 'inline';
  viewMode?: 'carousel' | 'inline' | 'moments';
  expanded?: boolean;
  onExpand?: () => void;
}

// Helper to categorize the selected date
const getDateCategory = (
  targetDate: Date
): 'today' | 'yesterday' | 'earlier' | 'future' => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const diffMs = startOfToday.getTime() - startOfTarget.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {return 'today';}
  if (diffDays === 1) {return 'yesterday';}
  if (diffDays > 1) {return 'earlier';}
  return 'future';
};

// Date-aware empty state copy for Todos (Today remains unchanged in render)
const TODOS_EMPTY_COPY: Record<'yesterday' | 'earlier' | 'future', { title: string; subtitle: string }> = {
  yesterday: {
    title: 'Tasks from Yesterday',
    subtitle: 'What tasks were you intending to do yesterday?',
  },
  earlier: {
    title: 'Tasks from This Day',
    subtitle: 'Recall the tasks\nyou intended to do then',
  },
  future: {
    title: 'Tasks for This Day',
    subtitle: 'Plan your steps and trust His leading',
  },
};

const TodosReactQueryComponent: React.FC<TodosProps> = ({ selectedDate = new Date(), refreshKey = 0, variant = 'carousel', viewMode, expanded, onExpand }) => {
  // Global edit mode context (only for inline view)
  // Global edit mode context - safe version that handles missing provider
  const globalEditMode = useEditModeSafe();

  // Local UI state
  const [newTodo, setNewTodo] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [visibleCount, setVisibleCount] = useState<number>(5);
  const [showCompletedAtBottom, setShowCompletedAtBottom] = useState(false);
  const [showOnlyPriorities, setShowOnlyPriorities] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [copyTargetDate, setCopyTargetDate] = useState<Date>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  const swipeableRefs = React.useRef<{[key: string]: any}>({});
  const inputRef = useRef<TextInput>(null);

  const toggleCalendar = () => {
    setShowCalendar(!showCalendar);
  };

  const handleDayPress = (day: any) => {
    const targetDate = new Date(day.timestamp);
    setCopyTargetDate(targetDate);
    setShowCalendar(false);
  };

  // Determine if we should be in adding mode
  const shouldShowAddingMode = isAdding || (globalEditMode?.isGlobalEditMode && viewMode === 'inline');

  // Auth and date context
  const { user } = useAuth();
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
  }, [(user as any)?.user_metadata?.preferences?.weekStart]);
  const dateStr = toLocalDateString(selectedDate); // 'YYYY-MM-DD'

  // React Query hooks with enhanced retry logic
  const loadStartTime = useRef<number>(Date.now());
  const { data: todosData = [], isLoading, error, refetch } = useTodosData(
    user?.id || '',
    dateStr
  );

  // Track loading performance
  useEffect(() => {
    if (!isLoading && todosData.length >= 0) {
      const loadTime = Date.now() - loadStartTime.current;
      analytics.trackTodoEvent('todos_loaded', {
        count: todosData.length,
        load_time_ms: loadTime,
        date: dateStr,
      }, user?.id);
    }
  }, [isLoading, todosData.length, dateStr, user?.id]);

  // Track errors
  useEffect(() => {
    if (error) {
      analytics.trackTodoEvent('todo_error', {
        error_type: error.message || 'unknown',
        operation: 'load',
        date: dateStr,
      }, user?.id);
    }
  }, [error, dateStr, user?.id]);

  const createTodoMutation = useCreateTodoEntry();
  const updateTodoMutation = useUpdateTodoEntry();
  const deleteTodoMutation = useDeleteTodoEntry();

  // Transform API data to local TodoItem format
  const todos: TodoItem[] = todosData.map(entry => {
    let parsedContent;
    try {
      parsedContent = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
    } catch {
      parsedContent = { text: entry.content, completed: entry.completed || false };
    }

    return {
      id: entry.id,
      text: parsedContent.text || entry.content,
      completed: parsedContent.completed || entry.completed || false,
      priority: parsedContent.priority || false,
      completedAt: parsedContent.completedAt,
    };
  });

  // Reset UI state when date changes or refreshKey changes
  useEffect(() => {
    setNewTodo('');
    setIsAdding(false);
    setVisibleCount(5);
    setShowCompletedAtBottom(false);
    setShowOnlyPriorities(false);
  }, [dateStr, refreshKey]);

  // Handle loading and error states
  useEffect(() => {
    if (error) {
      console.error('Failed to load todos:', error);
    }
  }, [error]);

  const closeAllSwipeables = () => {
    Object.values(swipeableRefs.current).forEach(ref => {
      if (ref?.close) {ref.close();}
    });
  };

  const startAdding = () => {
    closeAllSwipeables();
    setVisibleCount(5);
    setIsAdding(true);
    // Focus input after state update
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const cancelAdding = () => {
    closeAllSwipeables();
    setVisibleCount(5);
    setIsAdding(false);
    setNewTodo('');
  };

  const handleSave = async () => {
    const todoText = newTodo.trim();
    if (!todoText || !user) {return;}

    closeAllSwipeables();

    // Clear input immediately for better UX
    setNewTodo('');
    setIsAdding(false);
    setVisibleCount(5);

    // Close global edit mode if active
    if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
      globalEditMode.setGlobalEditMode(false);
    }

    try {
      await createTodoMutation.mutateAsync({
        user_id: user.id,
        selected_date: dateStr,
        content_type: 'todo',
        content: JSON.stringify({
          text: todoText,
          completed: false,
          priority: false,
        }),
        completed: false,
      });

      // Track successful todo creation
      analytics.trackTodoEvent('todo_created', {
        text_length: todoText.length,
        has_priority: false,
        date: dateStr,
      }, user.id);
    } catch (saveError) {
      // Restore input if there was an error and reopen adding mode
      setNewTodo(todoText);
      setIsAdding(true);
      console.error('Failed to save todo:', saveError);
      Alert.alert('Error', 'Failed to save todo. Please try again.');
    }
  };

  // Remove a todo
  const removeTodo = async (id: string) => {
    const todo = todos.find(t => t.id === id);

    try {
      await deleteTodoMutation.mutateAsync(id);

      // Track successful todo deletion
      if (todo) {
        analytics.trackTodoEvent('todo_deleted', {
          todo_id: id,
          was_completed: todo.completed,
          date: dateStr,
        }, user?.id);
      }
    } catch (deleteError) {
      console.error('Failed to delete todo:', deleteError);
      Alert.alert('Error', 'Failed to delete todo. Please try again.');
    }
  };

  // Edit a todo
  const editTodo = (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) {return;}

    setEditingId(id);
    setEditingText(todo.text);
    closeAllSwipeables();
  };

  // Save edited todo
  const saveEditedTodo = async () => {
    if (!editingId || !editingText.trim()) {return;}

    const todo = todos.find(t => t.id === editingId);
    if (!todo) {return;}

    try {
      await updateTodoMutation.mutateAsync({
        id: editingId,
        updates: {
          content: JSON.stringify({
            text: editingText.trim(),
            completed: todo.completed,
            priority: todo.priority || false,
          }),
        },
      });

      // Track analytics
      analytics.trackTodoEvent('todo_created', {
        text_length: editingText.trim().length,
        has_priority: todo.priority || false,
        date: dateStr,
      }, user?.id);

      // Reset edit state
      setEditingId(null);
      setEditingText('');
    } catch (editError) {
      console.error('Failed to update todo:', editError);
      Alert.alert('Error', 'Failed to update todo. Please try again.');
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  // Add a todo
  const addTodo = async (value: string): Promise<boolean> => {
    if (!user || !value.trim()) {
      return false;
    }

    try {
      await createTodoMutation.mutateAsync({
        user_id: user.id,
        selected_date: dateStr,
        content_type: 'todo',
        content: JSON.stringify({
          text: value.trim(),
          completed: false,
          priority: false,
        }),
        completed: false,
      });
      return true;
    } catch (addError) {
      console.error('Failed to add todo:', addError);
      return false;
    }
  };

  const handleAddInput = async () => {
    const todoText = newTodo.trim();
    if (!todoText) {return;}

    closeAllSwipeables();

    // Clear input immediately for better UX
    const originalText = newTodo;
    setNewTodo('');

    try {
      const wasAdded = await addTodo(todoText);
      if (!wasAdded) {
        // If add failed, restore the input text
        setNewTodo(originalText);
      }
    } catch (inputError) {
      // Restore input if there was an error
      setNewTodo(originalText);
      console.error('Failed to add todo input:', inputError);
    }
  };

  const toggleTodo = async (id: string, isPriorityToggle = false) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) {return;}

    try {
      let updatedContent;

      if (isPriorityToggle) {
        updatedContent = {
          text: todo.text,
          completed: todo.completed,
          priority: !todo.priority,
          completedAt: todo.completedAt,
        };
      } else {
        const newCompleted = !todo.completed;
        updatedContent = {
          text: todo.text,
          completed: newCompleted,
          priority: todo.priority,
          completedAt: newCompleted ? Date.now() : undefined,
        };
      }

      await updateTodoMutation.mutateAsync({
        id,
        updates: {
          content: JSON.stringify(updatedContent),
          completed: updatedContent.completed,
        },
      });

      // Track analytics based on operation type
      if (isPriorityToggle) {
        analytics.trackTodoEvent('todo_priority_toggled', {
          todo_id: id,
          new_priority: updatedContent.priority || false,
          date: dateStr,
        }, user?.id);
      } else if (updatedContent.completed && !todo.completed) {
        analytics.trackTodoEvent('todo_completed', {
          todo_id: id,
          completion_time_ms: Date.now() - (todo.completedAt || Date.now()),
          date: dateStr,
        }, user?.id);
      }
    } catch (toggleError) {
      console.error('Failed to toggle todo:', toggleError);
      Alert.alert('Error', 'Failed to update todo. Please try again.');
    }
  };

  const loadMore = () => {
    closeAllSwipeables();
    setVisibleCount((prev: number) => Math.min(prev + 5, todos.length));
  };

  const showLess = () => {
    closeAllSwipeables();
    setVisibleCount(5);
  };

  // Format selected date for display
  const formatSelectedDate = (date: Date) => {
    const currentYear = new Date().getFullYear();
    const dateYear = date.getFullYear();

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    };

    // Only include year if it's different from current year
    if (dateYear !== currentYear) {
      options.year = 'numeric';
    }

    return date.toLocaleDateString('en-US', options);
  };

  // Copy incomplete todos to another date
  const copyIncompleteTodos = async (targetDate: Date) => {
    if (!user) {return;}

    const incompleteTodos = todos.filter(t => !t.completed);
    if (incompleteTodos.length === 0) {
      Alert.alert('No Incomplete Todos', 'There are no incomplete todos to copy.');
      return;
    }

    try {
      const targetDateStr = toLocalDateString(targetDate);
      let successCount = 0;

      for (const todo of incompleteTodos) {
        try {
          await createTodoMutation.mutateAsync({
            user_id: user.id,
            selected_date: targetDateStr,
            content_type: 'todo',
            content: JSON.stringify({
              text: todo.text,
              completed: false,
              priority: todo.priority || false,
            }),
            completed: false,
          });
          successCount++;
        } catch (copyError) {
          console.error('Failed to copy todo:', todo.text, copyError);
        }
      }

      if (successCount > 0) {
        Alert.alert(
          'Todos Copied',
          `Successfully copied ${successCount} incomplete todo${successCount === 1 ? '' : 's'} to ${targetDate.toLocaleDateString()}.`
        );
        analytics.trackTodoEvent('todo_created', {
          text_length: incompleteTodos.reduce((sum, t) => sum + t.text.length, 0),
          has_priority: incompleteTodos.some(t => t.priority),
          date: targetDateStr,
        }, user.id);
      } else {
        Alert.alert('Copy Failed', 'Failed to copy todos. Please try again.');
      }
    } catch (copyError) {
      console.error('Failed to copy todos:', copyError);
      Alert.alert('Error', 'Failed to copy todos. Please try again.');
    }
  };

  const handleCopyTodos = () => {
    const incompleteTodos = todos.filter(t => !t.completed);
    if (incompleteTodos.length === 0) {
      Alert.alert('No Incomplete Todos', 'There are no incomplete todos to copy.');
      return;
    }
    setShowCopyModal(true);
  };

  // Sort todos: incomplete first, then completed
  const sortedTodos = [...todos].sort((a, b) => {
    if (showCompletedAtBottom) {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
    }

    if (showOnlyPriorities) {
      if (a.priority !== b.priority) {
        return a.priority ? -1 : 1;
      }
    }

    return 0;
  });

  // Filter todos if showing only priorities
  const filteredTodos = showOnlyPriorities
    ? sortedTodos.filter(todo => todo.priority)
    : sortedTodos;

  // In edit mode, show all todos so user can see what they've added
  const effectiveVisibleCount = shouldShowAddingMode ? filteredTodos.length : visibleCount;
  const visibleTodos = filteredTodos.slice(0, effectiveVisibleCount);
  const hasMore = filteredTodos.length > visibleCount && !shouldShowAddingMode;
  const canShowLess = visibleCount > 5 && filteredTodos.length > 5 && !shouldShowAddingMode;

  // Count stats (for potential future use)
  // const totalTodos = todos.length;
  // const completedTodos = todos.filter(t => t.completed).length;
  // const priorityTodos = todos.filter(t => t.priority).length;

  // Handle loading state
  if (isLoading) {
    return (
      <JournalCard
        title="TO-DOS"
        subtitle="Track your daily tasks"
        icon={<LuListTodo size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
        showAddButton={true}
        onAdd={() => {}} // Disabled during loading
        variant={variant}
        viewMode={viewMode}
      >
        <View
          style={styles.todosContainer}
          accessibilityRole="progressbar"
          accessibilityLabel="Loading todos"
          accessibilityHint="Please wait while your todos are being loaded"
        >
          <TodoSkeleton count={3} />
        </View>
      </JournalCard>
    );
  }

  // Handle error state
  if (error) {
    return (
      <JournalCard
        title="TO-DOS"
        subtitle="Track your daily tasks"
        icon={<LuListTodo size={16} color={Colors.hopeWhite} strokeWidth={2.5} />}
        showAddButton={true}
        onAdd={() => {}} // Disabled during error
      >
        <View
          style={styles.todosContainer}
          accessibilityRole="alert"
          accessibilityLabel="Error loading todos"
        >
          <Text
            style={styles.errorText}
            accessibilityRole="text"
            accessibilityLabel="Failed to load todos"
          >
            Failed to load todos
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Retry loading todos"
            accessibilityHint="Attempts to reload the todo list"
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </JournalCard>
    );
  }

  // Hide empty component in inline and moments view
  if ((viewMode === 'inline' || viewMode === 'moments') && !isLoading && !error && todos.length === 0) {
    return null;
  }

  // Custom empty state for Todos - show header and input when empty and not adding
  if (!isLoading && !error && todos.length === 0 && !shouldShowAddingMode) {
    const dateCategory = getDateCategory(selectedDate);
    const emptyTitle =
      dateCategory === 'today'
        ? 'Live Your Faith Through Action'
        : TODOS_EMPTY_COPY[dateCategory as 'yesterday' | 'earlier' | 'future'].title;
    const emptySubtitle =
      dateCategory === 'today'
        ? 'Add tasks to organize your day and walk in purpose.'
        : TODOS_EMPTY_COPY[dateCategory as 'yesterday' | 'earlier' | 'future'].subtitle;
    const buttonLabel =
      dateCategory === 'future' ? 'Pray & List' :
      (dateCategory === 'yesterday' || dateCategory === 'earlier') ? 'Revisit' :
      'Begin';
    return (
      <JournalCard
        // Hide header icon/title/subtitle in empty state
        icon={null}
        title={undefined}
        subtitle={undefined}
        showAddButton={false}
        variant={variant}
        viewMode={viewMode}
        expanded={expanded}
        onExpand={onExpand}
      >
        <View style={styles.emptyStateContainer}>
          <View style={styles.iconContainer}>
            <Entypo
              name="list"
              size={32}
              color={Colors.mediumGray}
              style={styles.emptyStateIcon}
            />
            <Text style={styles.sectionLabel} accessibilityRole="text">TO-DOS</Text>
          </View>
          <View style={styles.titleContainer}>
            <Text
              style={styles.emptyStateTitle}
              accessibilityRole="header"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {emptyTitle}
            </Text>
          </View>
          <Text style={styles.emptyStateSubtext} accessibilityRole="text">{emptySubtitle}</Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={startAdding}
            accessibilityRole="button"
            accessibilityLabel={`${buttonLabel} adding todos`}
          >
            <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
            <Text style={styles.emptyStateButtonText}>{buttonLabel}</Text>
          </TouchableOpacity>
        </View>
      </JournalCard>
    );
  }

  const hasContent = todos.length > 0;
  const showHeader = variant === 'carousel' || variant === 'inline' || hasContent || shouldShowAddingMode; // Always show header in carousel and inline views

  // Calculate todo stats for carousel view
  const completedCount = todos.filter(t => t.completed).length;
  const uncompletedCount = todos.length - completedCount;
  const getSubtitle = () => {
    console.log('getSubtitle called', { variant, showHeader, todosLength: todos.length });
    if (!showHeader) {return undefined;}
    if (variant === 'carousel' || variant === 'inline') {
      const category = getDateCategory(selectedDate);
      if (todos.length === 0) {
        if (shouldShowAddingMode) {
          if (category === 'yesterday') {return 'Revisit tasks you intended to do';}
          if (category === 'earlier') {return 'Revisit tasks from this day';}
          if (category === 'future') {return 'Pray & list tasks for this day';}
        }
        return 'Track your daily tasks';
      }
      // Build the count phrase, respecting Today's existing wording
      const countOnlyIncomplete = () =>
        category === 'today'
          ? `${todos.length} to-do${todos.length === 1 ? '' : 's'}`
          : `${todos.length} task${todos.length === 1 ? '' : 's'}`;

      const countAllCompleted = () =>
        category === 'today'
          ? `${completedCount} completed`
          : `${completedCount} completed`;

      const countMixed = () =>
        category === 'today'
          ? `${uncompletedCount} pending • ${completedCount} done`
          : `${uncompletedCount} pending • ${completedCount} done`;

      let base = '';
      if (completedCount === 0) {
        base = countOnlyIncomplete();
      } else if (uncompletedCount === 0) {
        base = countAllCompleted();
      } else {
        base = countMixed();
      }

      // Prefix category label for non-today
      if (category === 'yesterday') {return `Yesterday • ${base}`;}
      if (category === 'earlier') {return `This day • ${base}`;}
      if (category === 'future') {return `Future • ${base}`;}
      return base;
    }
    return 'Track your daily tasks';
  };

  return (
    <>
    <JournalCard
      icon={showHeader ? (
        <Entypo name="list" size={24} color={Colors.alertCoral} />
      ) : undefined}
      title={showHeader ? 'TO-DOS' : undefined}
      subtitle={getSubtitle()}
      componentType="Todos"
      showAddButton={hasContent ? !shouldShowAddingMode : false}
      onAdd={startAdding}
      isAdding={shouldShowAddingMode}
      variant={variant}
      viewMode={viewMode}
      expanded={expanded}
      onExpand={onExpand}
    >
      {hasContent && (
        <View style={styles.filtersContainer}>
          {todos.some(t => t.priority && !t.completed) && (
            <TouchableOpacity
              onPress={() => {
                if (showCompletedAtBottom) {
                  setShowCompletedAtBottom(false);
                  setShowOnlyPriorities(true);
                } else {
                  setShowOnlyPriorities(!showOnlyPriorities);
                }
              }}
              style={[styles.sortButton, showOnlyPriorities && styles.activeFilterButton]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={showOnlyPriorities ? 'Show all todos' : 'Show only priority todos'}
              accessibilityHint="Filters the todo list to show only priority items"
              accessibilityState={{ selected: showOnlyPriorities }}
            >
              <Ionicons
                name="star"
                size={14}
                color={showOnlyPriorities ? Colors.alertCoral : Colors.mediumGray}
              />
            </TouchableOpacity>
          )}
          {todos.some(t => t.completed) && !todos.every(t => t.completed) && (
            <TouchableOpacity
              onPress={() => {
                if (showOnlyPriorities) {
                  setShowOnlyPriorities(false);
                  setShowCompletedAtBottom(true);
                } else {
                  setShowCompletedAtBottom(!showCompletedAtBottom);
                }
              }}
              style={[styles.sortButton, showCompletedAtBottom && styles.activeFilterButton]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={showCompletedAtBottom ? 'Show todos in normal order' : 'Move completed todos to bottom'}
              accessibilityHint="Changes the order of completed todos in the list"
              accessibilityState={{ selected: showCompletedAtBottom }}
            >
              <Ionicons
                name="filter"
                size={16}
                color={showCompletedAtBottom ? Colors.alertCoral : Colors.mediumGray}
              />
            </TouchableOpacity>
          )}
          {/* Copy incomplete todos button */}
          {todos.some(t => !t.completed) && (
            <TouchableOpacity
              onPress={handleCopyTodos}
              style={styles.sortButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Copy incomplete todos to another date"
              accessibilityHint="Opens date picker to copy all incomplete todos"
            >
              <Ionicons
                name="copy-outline"
                size={16}
                color={Colors.mediumGray}
              />
            </TouchableOpacity>
          )}
        </View>
      )}
      <View
        style={styles.todosContainer}
        accessibilityRole="list"
        accessibilityLabel={`Todo list with ${visibleTodos.length} visible items out of ${todos.length} total`}
      >
        {visibleTodos.map((item, index) => (
          <View
            key={item.id}
            accessibilityRole="text"
            accessibilityLabel={`Todo ${index + 1} of ${visibleTodos.length}: ${item.text}`}
            accessibilityHint={`${item.completed ? 'Completed' : 'Not completed'}${item.priority ? ', Priority item' : ''}. Tap to toggle completion, long press to toggle priority, swipe for more options`}
            accessibilityState={{
              checked: item.completed,
              selected: item.priority,
            }}
          >
            <SwipeableTodoItem
              item={item}
              onToggle={(id, isPriority) => {
                toggleTodo(id, isPriority);
                closeAllSwipeables();
              }}
              onLongPress={(id) => toggleTodo(id, true)}
              onDelete={removeTodo}
              onEdit={editTodo}
              disableSwipe={viewMode === 'carousel' && !expanded}
              ref={ref => {
                if (ref) {
                  swipeableRefs.current[item.id] = ref;
                } else {
                  delete swipeableRefs.current[item.id];
                }
              }}
            >
              {editingId === item.id ? (
                <View style={styles.editContainer}>
                  <TextInput
                    style={styles.editInput}
                    value={editingText}
                    onChangeText={setEditingText}
                    autoFocus
                    multiline
                    onSubmitEditing={saveEditedTodo}
                    returnKeyType="done"
                    blurOnSubmit={false}
                  />
                  <View style={styles.editButtons}>
                    <TouchableOpacity
                      onPress={cancelEdit}
                      style={[styles.editActionButton, styles.editCancelButton]}
                    >
                      <Ionicons name="close" size={16} color={Colors.hopeWhite} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={saveEditedTodo}
                      style={[styles.editActionButton, styles.editSaveButton]}
                      disabled={!editingText.trim()}
                    >
                      <Ionicons name="checkmark" size={16} color={Colors.hopeWhite} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text
                  style={[
                    styles.todoText,
                    item.completed && styles.completedText,
                  ]}
                  accessibilityElementsHidden={true}
                >
                  {item.text}
                </Text>
              )}
            </SwipeableTodoItem>
          </View>
        ))}

        {!shouldShowAddingMode && todos.length > 0 && (
          <View style={styles.paginationContainer}>
            <View style={styles.paginationButtonGroup}>
              {hasMore && (
                <TouchableOpacity
                  style={[styles.paginationButton, styles.showMoreButton]}
                  onPress={loadMore}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Show more todos. ${filteredTodos.length - visibleCount} remaining`}
                  accessibilityHint="Loads 5 more todo items to the list"
                >
                  <Ionicons name="chevron-down" size={12} color={Colors.alertCoral} />
                  <Text style={[styles.paginationButtonText, styles.showMoreText]}>
                    Show more
                  </Text>
                </TouchableOpacity>
              )}
              {canShowLess && (
                <TouchableOpacity
                  style={[styles.paginationButton, styles.showLessButton]}
                  onPress={showLess}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Show less todos"
                  accessibilityHint="Collapses the list to show only the first 5 todos"
                >
                  <Ionicons name="chevron-up" size={12} color={Colors.mediumGray} />
                  <Text style={[styles.paginationButtonText, styles.showLessText]}>
                    Show less
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

      </View>
      {shouldShowAddingMode && (
        <>
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={newTodo}
              onChangeText={setNewTodo}
              placeholder="Add a task..."
              placeholderTextColor={Colors.mediumGray}
              onSubmitEditing={handleAddInput}
              returnKeyType="next"
              blurOnSubmit={false}
              autoFocus
              accessibilityRole="none"
              accessibilityLabel="Add new todo"
              accessibilityHint="Enter text for a new todo item and press next to add it"
              importantForAccessibility="yes"
            />
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={handleAddInput}
              style={[styles.button, styles.addAnotherButton]}
              accessibilityRole="button"
              accessibilityLabel="Add another todo"
              accessibilityHint="Adds the current todo and allows you to add another one"
            >
              <View style={[styles.plusIcon, { transform: [{ rotate: '45deg' }] }]}>
                <Ionicons name="close" size={13} color={Colors.alertCoral} style={styles.closeIcon} />
              </View>
            </TouchableOpacity>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={cancelAdding}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Cancel adding todo"
                accessibilityHint="Cancels the current todo input and closes the add form"
              >
                <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={[
                  styles.button,
                  styles.saveButton,
                  !newTodo.trim() && styles.disabledButton,
                ]}
                disabled={!newTodo.trim()}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Save todo"
                accessibilityHint="Saves the current todo and closes the add form"
                accessibilityState={{ disabled: !newTodo.trim() }}
              >
                <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </JournalCard>

    {/* Copy Todos Modal */}
    <Modal
      visible={showCopyModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowCopyModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalTitleRow}>
            <Ionicons style={styles.modalTitleIcon} name="copy-outline" size={18} color={Colors.hopeWhite} />
            <Text style={styles.modalTitle}>Copy Incomplete To-Dos</Text>
          </View>
          <Text style={styles.modalSubtitle}>
            Copy {todos.filter(t => !t.completed).length} incomplete to-do{todos.filter(t => !t.completed).length === 1 ? '' : 's'} to a new date. Original to-dos will remain.
          </Text>

          <Text style={styles.chooseDateLabel}>Choose a date</Text>
          <View style={styles.datePickerContainer}>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => {
                // Simple date picker - tomorrow
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setCopyTargetDate(tomorrow);
              }}
            >
              <Text style={styles.datePickerText}>Tomorrow</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => {
                // Simple date picker - next week
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                setCopyTargetDate(nextWeek);
              }}
            >
              <Text style={styles.datePickerText}>Next Week</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.calendarContainer}>
            <TouchableOpacity
              style={styles.selectedDateContainer}
              onPress={toggleCalendar}
            >
              <Text style={styles.selectedDateText}>
                {formatSelectedDate(copyTargetDate)}
              </Text>
              <Text style={styles.tapToChangeText}>
                {showCalendar ? 'Hide calendar' : 'Tap to change'}
              </Text>
            </TouchableOpacity>

            {showCalendar && (
              <View style={styles.calendarWrapper}>
                <Calendar
                  current={`${copyTargetDate.getFullYear()}-${String(copyTargetDate.getMonth() + 1).padStart(2,'0')}-${String(copyTargetDate.getDate()).padStart(2,'0')}`}
                  minDate={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`}
                  onDayPress={handleDayPress}
                  renderHeader={(date) => {
                    const d = new Date(date as any);
                    const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase();
                    return <Text style={styles.monthHeaderText}>{label}</Text>;
                  }}
                  hideArrows={false}
                  firstDay={weekStartsOn}
                  onPressArrowLeft={subtractMonth => subtractMonth()}
                  onPressArrowRight={addMonth => addMonth()}
                  theme={{
                    backgroundColor: Colors.anchorBlue,
                    calendarBackground: Colors.anchorBlue,
                    textSectionTitleColor: Colors.hopeWhite,
                    selectedDayBackgroundColor: Colors.alertCoral,
                    selectedDayTextColor: Colors.hopeWhite,
                    todayTextColor: Colors.alertCoral,
                    dayTextColor: Colors.hopeWhite,
                    textDisabledColor: 'rgba(255, 255, 255, 0.3)',
                    dotColor: Colors.alertCoral,
                    selectedDotColor: Colors.hopeWhite,
                    arrowColor: Colors.hopeWhite,
                    monthTextColor: Colors.hopeWhite,
                    textDayFontFamily: Fonts.regular,
                    textMonthFontFamily: Fonts.semiBold,
                    textDayHeaderFontFamily: Fonts.medium,
                    textDayFontSize: 14,
                    textMonthFontSize: 16,
                    textDayHeaderFontSize: 13,
                  }}
                  markingType="custom"
                  markedDates={(function(){
                    const y = copyTargetDate.getFullYear();
                    const m = String(copyTargetDate.getMonth() + 1).padStart(2,'0');
                    const d = String(copyTargetDate.getDate()).padStart(2,'0');
                    const selectedStr = `${y}-${m}-${d}`;
                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                    const marked: any = {
                      [selectedStr]: {
                        selected: true,
                        customStyles: {
                          text: { fontFamily: Fonts.bold, fontWeight: '800', color: Colors.hopeWhite },
                        },
                      },
                    };
                    if (todayStr !== selectedStr) {
                      marked[todayStr] = {
                        customStyles: {
                          text: { color: Colors.alertCoral, fontFamily: Fonts.bold, fontWeight: '700' },
                        },
                      };
                    }
                    return marked;
                  })()}
                />
              </View>
            )}
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowCopyModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.copyButton]}
              onPress={async () => {
                setShowCopyModal(false);
                await copyIncompleteTodos(copyTargetDate);
              }}
            >
              <Text style={styles.copyButtonText}>Add to Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
};

// Export with error boundary wrapper
export const TodosReactQuery: React.FC<TodosProps> = (props) => (
  <ErrorBoundary name="TodosReactQuery">
    <TodosReactQueryComponent {...props} />
  </ErrorBoundary>
);

const styles = StyleSheet.create({
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
  // Container styles
  todosContainer: {
    width: '100%',
  },

  // Header styles
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filtersContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 0,
    paddingHorizontal: 4,
    paddingBottom: 8,
    marginTop: -4,
  },
  activeFilterButton: {
    // No background, just color change for active state
  },

  // Pagination styles
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
  buttonDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginVertical: 8,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  paginationButtonText: {
    marginLeft: 2,
    fontSize: 11,
    fontFamily: Fonts.medium,
    lineHeight: 14,
  },
  showMoreButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  showMoreText: {
    color: Colors.alertCoral,
  },
  showLessButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  showLessText: {
    color: Colors.mediumGray,
  },
  sortButton: {
    marginLeft: 8,
    padding: 2,
  },

  // Todo item styles
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 40,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    marginBottom: 4,
    width: '100%',
  },
  closeIcon: {
    fontWeight: 'bold',
  },
  todoText: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.9,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: Colors.mediumGray,
    opacity: 0.7,
  },

  // Edit styles
  editContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    fontSize: 13,
    lineHeight: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  editActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editSaveButton: {
    backgroundColor: Colors.growthGreen,
  },

  // Input styles
  inputContainer: {
    marginBottom: 8,
    width: '100%',
  },
  input: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 12,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    width: '100%',
    alignSelf: 'stretch',
  },
  addAnotherButton: {
    backgroundColor: 'transparent',
    width: 24,
    height: 24,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  plusIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    padding: 0,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Loading and error states
  errorText: {
    fontFamily: Fonts.regular,
    color: Colors.alertCoral,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'center',
  },
  retryText: {
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    fontSize: 12,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 30,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'left',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-start',
  },
  modalTitleIcon: {
    marginTop: -10,
  },
  modalSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.hopeWhite,
    textAlign: 'left',
    marginBottom: 24,
    opacity: 0.9,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  chooseDateLabel: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'left',
    marginBottom: 12,
    opacity: 0.8,
  },
  datePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  datePickerButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  datePickerText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  calendarContainer: {
    width: '100%',
    marginBottom: 24,
  },
  selectedDateContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 12,
  },
  calendarWrapper: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  selectedDateText: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 4,
    opacity: 0.9,
  },
  tapToChangeText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.6,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  copyButton: {
    backgroundColor: Colors.alertCoral,
  },
  cancelButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  copyButtonText: {
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    fontSize: 15,
    color: Colors.hopeWhite,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  monthHeaderText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: 4,
  },
});

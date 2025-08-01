import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, Alert } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check, ListTodo as LuListTodo, X } from 'lucide-react-native';
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
}

const TodosReactQueryComponent: React.FC<TodosProps> = ({ selectedDate = new Date(), refreshKey = 0, variant = 'carousel', viewMode }) => {
  // Global edit mode context (only for inline view)
  // Global edit mode context - safe version that handles missing provider
  const globalEditMode = useEditModeSafe();


  // Local UI state
  const [newTodo, setNewTodo] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(5);
  const [showCompletedAtBottom, setShowCompletedAtBottom] = useState(false);
  const [showOnlyPriorities, setShowOnlyPriorities] = useState(false);
  const swipeableRefs = React.useRef<{[key: string]: any}>({});
  const inputRef = useRef<TextInput>(null);

  // Determine if we should be in adding mode
  const shouldShowAddingMode = isAdding || (globalEditMode?.isGlobalEditMode && viewMode === 'inline');

  // Auth and date context
  const { user } = useAuth();
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

  const visibleTodos = filteredTodos.slice(0, visibleCount);
  const hasMore = filteredTodos.length > visibleCount;
  const canShowLess = visibleCount > 5 && filteredTodos.length > 5;

  // Count stats (for potential future use)
  // const totalTodos = todos.length;
  // const completedTodos = todos.filter(t => t.completed).length;
  // const priorityTodos = todos.filter(t => t.priority).length;

  // Handle loading state
  if (isLoading) {
    return (
      <JournalCard
        title="To-Dos"
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
        title="To-Dos"
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

  // Hide empty component in inline view
  if (viewMode === 'inline' && !isLoading && !error && todos.length === 0) {
    return null;
  }

  return (
    <JournalCard
      icon={
        <LuListTodo
          size={24}
          color={Colors.alertCoral}
          strokeWidth={2.5}
        />
      }
      title="To-Dos"
      subtitle="Track your daily tasks"
      showAddButton={!shouldShowAddingMode}
      onAdd={startAdding}
      isAdding={shouldShowAddingMode}

      headerRight={
        <View style={styles.headerRightContainer}>
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
        </View>
      }
      variant={variant}
      viewMode={viewMode}
    >
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
              ref={ref => {
                if (ref) {
                  swipeableRefs.current[item.id] = ref;
                } else {
                  delete swipeableRefs.current[item.id];
                }
              }}
            >
              <Text
                style={[
                  styles.todoText,
                  item.completed && styles.completedText,
                ]}
                accessibilityElementsHidden={true}
              >
                {item.text}
              </Text>
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
  );
};

// Export with error boundary wrapper
export const TodosReactQuery: React.FC<TodosProps> = (props) => (
  <ErrorBoundary name="TodosReactQuery">
    <TodosReactQueryComponent {...props} />
  </ErrorBoundary>
);

const styles = StyleSheet.create({
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

  // Input styles
  inputContainer: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    padding: 8,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  addAnotherButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 24,
    height: 24,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
    fontFamily: Fonts.medium,
    color: Colors.hopeWhite,
    fontSize: 12,
  },
});

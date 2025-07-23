import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, Alert } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check, ListTodo as LuListTodo, X } from 'lucide-react-native';
import { SwipeableTodoItem } from '../SwipeableTodoItem';
import { useAuth } from '../../context/AuthContext';
import { toLocalDateString } from '../../utils/date';

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
}

export const TodosReactQuery: React.FC<TodosProps> = ({ selectedDate = new Date(), refreshKey = 0 }) => {
  // Local UI state
  const [newTodo, setNewTodo] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(5);
  const [showCompletedAtBottom, setShowCompletedAtBottom] = useState(false);
  const [showOnlyPriorities, setShowOnlyPriorities] = useState(false);
  const swipeableRefs = React.useRef<{[key: string]: any}>({});
  const inputRef = useRef<TextInput>(null);

  // Auth and date context
  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate); // 'YYYY-MM-DD'

  // React Query hooks
  const { data: todosData = [], isLoading, error, refetch } = useTodosData(
    user?.id || '',
    dateStr
  );
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

  const closeAllSwipeables = () => {
    Object.values(swipeableRefs.current).forEach(ref => {
      if (ref?.close) {ref.close();}
    });
  };

  const startAdding = () => {
    closeAllSwipeables();
    setVisibleCount(5);
    setIsAdding(true);
  };

  const cancelAdding = () => {
    closeAllSwipeables();
    setVisibleCount(5);
    setIsAdding(false);
    setNewTodo('');
  };

  const handleSave = async () => {
    console.log('💾 handleSave called with:', newTodo);

    const todoText = newTodo.trim();
    if (!todoText || !user) {return;}

    closeAllSwipeables();

    // Clear input immediately for better UX
    setNewTodo('');
    setIsAdding(false);
    setVisibleCount(5);

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
      console.log('✅ handleSave completed, input should be clear');
    } catch (saveError) {
      // Restore input if there was an error and reopen adding mode
      setNewTodo(todoText);
      setIsAdding(true);
      console.error('❌ handleSave error:', saveError);
      Alert.alert('Error', 'Failed to save todo. Please try again.');
    }
  };

  // Remove a todo
  const removeTodo = async (id: string) => {
    try {
      await deleteTodoMutation.mutateAsync(id);
    } catch (deleteError) {
      console.error('❌ removeTodo error:', deleteError);
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
      console.error('❌ addTodo error:', addError);
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
      console.error('❌ handleAddInput error:', inputError);
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
    } catch (toggleError) {
      console.error('❌ toggleTodo error:', toggleError);
      Alert.alert('Error', 'Failed to update todo. Please try again.');
    }
  };

  const loadMore = () => {
    setVisibleCount(prev => prev + 10);
  };

  const showLess = () => {
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
        title="Todos"
        icon={<LuListTodo size={16} color={Colors.hopeWhite} strokeWidth={2.5} />}
        headerRight={
          <View style={styles.headerRightContainer}>
            <TouchableOpacity
              style={styles.addAnotherButton}
              onPress={startAdding}
              activeOpacity={0.7}
            >
              <View style={styles.plusIcon}>
                <Ionicons name="add" size={14} color={Colors.hopeWhite} />
              </View>
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.todosContainer}>
          <Text style={styles.loadingText}>Loading todos...</Text>
        </View>
      </JournalCard>
    );
  }

  // Handle error state
  if (error) {
    return (
      <JournalCard
        title="Todos"
        icon={<LuListTodo size={16} color={Colors.hopeWhite} strokeWidth={2.5} />}
        headerRight={
          <View style={styles.headerRightContainer}>
            <TouchableOpacity
              style={styles.addAnotherButton}
              onPress={startAdding}
              activeOpacity={0.7}
            >
              <View style={styles.plusIcon}>
                <Ionicons name="add" size={14} color={Colors.hopeWhite} />
              </View>
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.todosContainer}>
          <Text style={styles.errorText}>Failed to load todos</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </JournalCard>
    );
  }

  return (
    <JournalCard
      title="Todos"
      icon={<LuListTodo size={16} color={Colors.hopeWhite} strokeWidth={2.5} />}
      headerRight={
        <View style={styles.headerRightContainer}>
          <TouchableOpacity
            style={[styles.sortButton, showOnlyPriorities && styles.activeFilterButton]}
            onPress={() => setShowOnlyPriorities(!showOnlyPriorities)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="star"
              size={14}
              color={showOnlyPriorities ? Colors.alertCoral : Colors.hopeWhite}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, showCompletedAtBottom && styles.activeFilterButton]}
            onPress={() => setShowCompletedAtBottom(!showCompletedAtBottom)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="checkmark-done"
              size={14}
              color={showCompletedAtBottom ? Colors.alertCoral : Colors.hopeWhite}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addAnotherButton}
            onPress={startAdding}
            activeOpacity={0.7}
          >
            <View style={styles.plusIcon}>
              <Ionicons name="add" size={14} color={Colors.hopeWhite} />
            </View>
          </TouchableOpacity>
        </View>
      }
    >
      <View style={styles.todosContainer}>
        {/* Todo Items */}
        {visibleTodos.map((todo) => (
          <SwipeableTodoItem
            key={todo.id}
            ref={(ref) => {
              if (ref) {
                swipeableRefs.current[todo.id] = ref;
              }
            }}
            item={{
              id: todo.id,
              text: todo.text,
              completed: todo.completed,
              priority: todo.priority || false,
            }}
            onToggle={(id: string, isPriority?: boolean) => {
              if (isPriority) {
                toggleTodo(id, true);
              } else {
                toggleTodo(id, false);
              }
            }}
            onDelete={removeTodo}
          >
            <Text style={[
              styles.todoText,
              todo.completed && styles.completedText,
            ]}>
              {todo.text}
            </Text>
          </SwipeableTodoItem>
        ))}

        {/* Pagination */}
        {(hasMore || canShowLess) && (
          <View style={styles.paginationContainer}>
            <View style={styles.buttonDivider} />
            <View style={styles.paginationButtonGroup}>
              {hasMore && (
                <TouchableOpacity
                  style={[styles.paginationButton, styles.showMoreButton]}
                  onPress={loadMore}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-down" size={12} color={Colors.alertCoral} />
                  <Text style={[styles.paginationButtonText, styles.showMoreText]}>
                    Show More ({filteredTodos.length - visibleCount})
                  </Text>
                </TouchableOpacity>
              )}
              {canShowLess && (
                <TouchableOpacity
                  style={[styles.paginationButton, styles.showLessButton]}
                  onPress={showLess}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-up" size={12} color={Colors.mediumGray} />
                  <Text style={[styles.paginationButtonText, styles.showLessText]}>
                    Show Less
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Add Todo Input */}
        {isAdding && (
          <>
            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={newTodo}
                onChangeText={setNewTodo}
                placeholder="Add a new todo..."
                placeholderTextColor={Colors.mediumGray}
                multiline
                autoFocus
                onSubmitEditing={handleAddInput}
                blurOnSubmit={false}
              />
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.addAnotherButton}
                onPress={handleAddInput}
                activeOpacity={0.7}
              >
                <View style={styles.plusIcon}>
                  <Ionicons name="add" size={14} color={Colors.hopeWhite} />
                </View>
              </TouchableOpacity>
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={cancelAdding}
                  activeOpacity={0.8}
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
                >
                  <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
    </JournalCard>
  );
};

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
    borderRadius: 10,
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
    marginLeft: 4,
    padding: 2,
  },

  // Todo item styles
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
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
    color: Colors.darkGray,
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
    borderRadius: 6,
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
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
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
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Loading and error states
  loadingText: {
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    fontSize: 13,
    textAlign: 'center',
    padding: 16,
  },
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
    borderRadius: 6,
    alignSelf: 'center',
  },
  retryText: {
    fontFamily: Fonts.medium,
    color: Colors.hopeWhite,
    fontSize: 12,
  },
});

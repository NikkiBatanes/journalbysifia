import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check, ListTodo as LuListTodo } from 'lucide-react-native';
import { SwipeableTodoItem } from '../SwipeableTodoItem';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  priority?: boolean;
  completedAt?: number;
}

export const Todos: React.FC = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(5);
  const [showCompletedAtBottom, setShowCompletedAtBottom] = useState(false);
  const [showOnlyPriorities, setShowOnlyPriorities] = useState(false);
  const swipeableRefs = React.useRef<{[key: string]: any}>({});
  const inputRef = useRef<TextInput>(null);

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

  const addTodo = (value: string) => {
    if (value.trim()) {
      setTodos([...todos, {
        id: Date.now().toString(),
        text: value,
        completed: false,
        priority: false,
      }]);
      return true;
    }
    return false;
  };

  const handleAddInput = () => {
    if (newTodo.trim()) {
      closeAllSwipeables();
      addTodo(newTodo);
      setNewTodo('');
      setVisibleCount(5);
      // Focus the input after adding a task
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Auto-focus when starting to add a new task
  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  // Track recently completed items to keep them visible briefly
  const [recentlyCompleted, setRecentlyCompleted] = useState<{[key: string]: boolean}>({});

  // Automatically turn off filters when they become irrelevant
  useEffect(() => {
    if (todos.length === 0) {return;}

    // Only handle non-priority completion cases here
    // Priority completion is now handled in toggleTodo
    if (showOnlyPriorities) {
      const hasUncompletedPriorities = todos.some(todo => todo.priority && !todo.completed);
      if (!hasUncompletedPriorities) {
        // This is a fallback in case the toggleTodo handler misses something
        const timer = setTimeout(() => {
          setShowOnlyPriorities(false);
        }, 100);
        return () => clearTimeout(timer);
      }
    }

    // Turn off completed filter when all items are completed or no items are completed
    if (showCompletedAtBottom && (todos.every(t => t.completed) || todos.every(t => !t.completed))) {
      setShowCompletedAtBottom(false);
    }
  }, [todos, showCompletedAtBottom, showOnlyPriorities]);

  // Clear recently completed items after a delay
  useEffect(() => {
    if (Object.keys(recentlyCompleted).length > 0) {
      const timer = setTimeout(() => {
        setRecentlyCompleted({});
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [recentlyCompleted]);

  const toggleTodo = (id: string, isPriorityToggle = false) => {
    setTodos(prevTodos => {
      const todoToUpdate = prevTodos.find(t => t.id === id);
      const isCompletingPriority = !isPriorityToggle && todoToUpdate?.priority && !todoToUpdate.completed;

      // First update the todo's completed state
      const updatedTodos = prevTodos.map(todo => {
        if (todo.id === id) {
          if (isPriorityToggle) {
            return {
              ...todo,
              priority: !todo.priority,
            };
          } else {
            const completed = !todo.completed;
            return {
              ...todo,
              completed,
              completedAt: completed ? Date.now() : undefined,
              // Keep priority initially when marking as completed (we'll clear it after delay)
              priority: todo.priority,
            };
          }
        }
        return todo;
      });

      // If we're completing a priority item, handle the delay
      if (isCompletingPriority) {
        // Add to recentlyCompleted to keep it visible
        setRecentlyCompleted(prev => ({ ...prev, [id]: true }));

        // After delay, remove priority and check if we should turn off the filter
        setTimeout(() => {
          setTodos(currentTodos => {
            // First remove the priority from the completed item
            const todosWithoutPriority = currentTodos.map(t =>
              t.id === id ? { ...t, priority: false } : t
            );

            // Check if there are any remaining uncompleted priorities
            const hasUncompletedPriorities = todosWithoutPriority.some(
              t => t.priority && !t.completed
            );

            // If no more uncompleted priorities, turn off the filter
            if (!hasUncompletedPriorities) {
              setShowOnlyPriorities(false);
            }

            return todosWithoutPriority;
          });

          // Clear from recentlyCompleted
          setRecentlyCompleted(prev => {
            const newState = {...prev};
            delete newState[id];
            return newState;
          });
        }, 300);
      }

      return updatedTodos;
    });
  };

  const removeTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const sortedTodos = React.useMemo(() => {
    // If no filters are active, return the original order
    if (!showOnlyPriorities && !showCompletedAtBottom) {
      return [...todos];
    }

    let filteredTodos = [...todos];

    // Filter by priority if needed, but keep recently completed items visible
    if (showOnlyPriorities) {
      filteredTodos = filteredTodos.filter(todo =>
        (todo.priority && !todo.completed) || recentlyCompleted[todo.id]
      );
    }

    // If only priority filter is active, maintain the original order of priority items
    if (!showCompletedAtBottom) {return filteredTodos;}

    // Only sort by completion time if showCompletedAtBottom is true
    const completed: (TodoItem & { completedAt?: number })[] = [];
    const notCompleted: TodoItem[] = [];
    const now = Date.now();

    // First pass: separate completed and not completed
    filteredTodos.forEach(todo => {
      if (todo.completed) {
        completed.push({
          ...todo,
          // @ts-ignore - Adding completedAt property to track completion time
          completedAt: todo.completedAt || now,
        });
      } else {
        notCompleted.push(todo);
      }
    });

    // Sort completed items by completion time (oldest first)
    completed.sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

    return [...notCompleted, ...completed];
  }, [todos, showCompletedAtBottom, showOnlyPriorities, recentlyCompleted]);

  const visibleTodos = isAdding ? sortedTodos : sortedTodos.slice(0, visibleCount);
  // Only show pagination if not in priority mode or there are more priority items to show
  const showPagination = !showOnlyPriorities ||
    (showOnlyPriorities && todos.filter(t => t.priority && !t.completed).length > 5);
  const hasMore = showPagination && !isAdding && todos.length > visibleCount;
  const showLessOption = showPagination && !isAdding && visibleCount > 5;

  const loadMore = () => {
    closeAllSwipeables();
    setVisibleCount((prev: number) => Math.min(prev + 5, todos.length));
  };

  const showLess = () => {
    closeAllSwipeables();
    setVisibleCount(5);
  };

  return (
    <JournalCard
      icon={
        <LuListTodo
          size={24}
          color={Colors.alertCoral}
          strokeWidth={2.5}
        />
      }
      title="Todos"
      subtitle="Track your daily tasks"
      showAddButton={!isAdding}
      onAdd={startAdding}
      isAdding={isAdding}
      onCancelAdd={cancelAdding}
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
    >
      <View style={styles.todosContainer}>
        {visibleTodos.map((item) => (
          <SwipeableTodoItem
            key={item.id}
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
            >
              {item.text}
            </Text>
          </SwipeableTodoItem>
        ))}
        {!isAdding && todos.length > 0 && (
          <View style={styles.paginationContainer}>
            <View style={styles.paginationButtonGroup}>
              {hasMore && (
                <TouchableOpacity
                  style={[styles.paginationButton, styles.showMoreButton]}
                  onPress={loadMore}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-down" size={12} color={Colors.alertCoral} />
                  <Text style={[styles.paginationButtonText, styles.showMoreText]}>
                    Show more
                  </Text>
                </TouchableOpacity>
              )}
              {showLessOption && (
                <TouchableOpacity
                  style={[styles.paginationButton, styles.showLessButton]}
                  onPress={showLess}
                  activeOpacity={0.7}
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
      {isAdding && (
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
            />
          </View>
          <View style={styles.buttonsRow}>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                onPress={handleAddInput}
                style={[styles.button, styles.addAnotherButton]}
              >
                <View style={[styles.plusIcon, { transform: [{ rotate: '45deg' }] }]}>
                  <Ionicons name="close" size={13} color={Colors.alertCoral} style={styles.closeIcon} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (newTodo.trim()) {
                    closeAllSwipeables();
                    addTodo(newTodo);
                    setNewTodo('');
                    setIsAdding(false);
                  }
                }}
                style={[
                  styles.button,
                  styles.saveButton,
                  !newTodo.trim() && styles.disabledButton,
                ]}
                disabled={!newTodo.trim()}
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
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    display: 'flex',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addAnotherButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
    width: 24,
    height: 24,
    shadowOpacity: 0,
    elevation: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  disabledButton: {
    opacity: 0.5,
  },
  plusIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    display: 'flex',
  },
});

import React, { useState, useRef } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check, ListTodo as LuListTodo, X } from 'lucide-react-native';
import { SwipeableTodoItem } from '../SwipeableTodoItem';
// React Query imports
import { useAuth } from '../../context/AuthContext';
import { useTodosData, useCreateJournalEntry, useUpdateJournalEntry, useDeleteJournalEntry } from '../../services/hooks/useJournalData';
import { toLocalDateString } from '../../utils/date';

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

export const Todos: React.FC<TodosProps> = ({ selectedDate = new Date(), refreshKey = 0 }) => {
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
  const {
    data: todoEntries = [],
    isLoading,
    error,
    refetch,
    isFetching
  } = useTodosData(user?.id || '', dateStr);

  const createTodoMutation = useCreateJournalEntry();
  const updateTodoMutation = useUpdateJournalEntry();
  const deleteTodoMutation = useDeleteJournalEntry();

  // Convert API entries to TodoItem format
  const todos: TodoItem[] = todoEntries.map(entry => ({
    id: entry.id,
    text: entry.content,
    completed: entry.metadata?.completed || false,
    priority: entry.metadata?.priority || false,
    completedAt: entry.metadata?.completedAt,
  }));

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

  const handleSave = () => {
    if (newTodo.trim()) {
      closeAllSwipeables();
      addTodo(newTodo);
      setNewTodo('');
      setIsAdding(false);
    }
  };

  // Remove a todo
  const removeTodo = (id: string) => {
    const newItems = todos.filter(todo => todo.id !== id);
    saveTodos(newItems);
  };

  // Save todos to local storage and sync to cloud
  const saveTodos = async (items: TodoItem[]): Promise<void> => {
    console.log('!!! saveTodos CALLED !!!', { user, items });
    if (!user) {
      console.error('No user found when trying to save todos');
      Alert.alert('Error', 'You must be logged in to save todos.');
      return Promise.reject('No user found');
    }

    // Update UI immediately
    setTodos(items);

    // Start sync indicator
    setSyncing(true);

    // Return a promise that resolves when all operations are complete
    return new Promise(async (resolve, reject) => {
      try {
        const localEntry = await getLocalEntry(key);

        if (items.length === 0) {
          // If there are no items, delete the entry
          if (localEntry) {
            await deleteLocalEntry(key);
            if (localEntry.id) {
              // If we have an ID, delete from cloud
              await deleteCloudEntry(user.id, localEntry.id);
            } else {
              // Try to find a cloud entry for this date/user and delete it
              const maybeCloudEntry = await getCloudEntry(user.id, key.split('_').pop() || '', dateStr);
              if (maybeCloudEntry?.id) {
                await deleteCloudEntry(user.id, maybeCloudEntry.id);
              }
            }
          } else {
            // Try to find a cloud entry for this date/user and delete it
            const maybeCloudEntry = await getCloudEntry(user.id, key.split('_').pop() || '', dateStr);
            if (maybeCloudEntry?.id) {
              await deleteCloudEntry(user.id, maybeCloudEntry.id);
            }
          }
          resolve();
          return;
        }

        // Save/update local entry
        const entryData = {
          content_type: contentType,
          content: { items },
          selected_date: dateStr,
          user_id: user.id,
        };

        if (localEntry) {
          await updateLocalEntry(key, { ...localEntry, content: { items } });
        } else {
          await saveLocalEntry(key, { ...entryData, user_id: user.id }, user.id);
        }

        // Sync to cloud in the background (don't await)
        syncToCloud(user.id, dateStr, contentType)
          .then(() => {
            console.log('Background sync completed successfully');
          })
          .catch(err => {
            console.error('Background sync failed:', err);
            // Could add retry logic here if needed
          });

        resolve();
      } catch (err) {
        console.error('Background save/sync error:', err);
        reject(err);
      } finally {
        setSyncing(false);
      }
    });
  };

  // Add a todo
  const addTodo = async (value: string): Promise<boolean> => {
    if (!value.trim()) {return false;}

    const todoToAdd = {
      id: Date.now().toString(),
      text: value.trim(),
      completed: false,
      priority: false,
    };

    // Optimistically update the UI
    setTodos(prevTodos => [...prevTodos, todoToAdd]);

    try {
      // Save to storage
      await saveTodos([...todos, todoToAdd]);
      return true;
    } catch (error) {
      console.error('Failed to save new todo:', error);
      // Revert UI on error
      setTodos(prevTodos => prevTodos.filter(t => t.id !== todoToAdd.id));
      Alert.alert('Error', 'Failed to save todo. Please try again.');
      return false;
    }
  };

  const handleAddInput = async () => {
    const todoText = newTodo.trim();
    if (!todoText) {return;}

    closeAllSwipeables();

    // Clear input immediately for better UX
    const currentInput = todoText;
    setNewTodo('');
    setVisibleCount(5);

    try {
      const wasAdded = await addTodo(currentInput);
      if (wasAdded) {
        // Focus the input after adding a task
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        // If add failed, restore the input text
        setNewTodo(currentInput);
      }
    } catch (error) {
      // Restore input if there was an error
      setNewTodo(currentInput);
    }
  };

  // Hydrate todos from local storage  // TimeBlock-style hydration with caching
  const hydrateTodos = useCallback(async () => {
    if (!user) {
      console.log('No user, skipping todo hydration');
      return;
    }

    if (isSyncingRef.current) {
      console.log('Already syncing, skipping hydration');
      return;
    }

    console.log(' Hydrating todos for date:', dateStr);
    setLoading(true);
    isSyncingRef.current = true;

    try {
      // 1. Load local data immediately (cache-first)
      console.log(' Loading local todos...');
      const localEntry = await getLocalEntry(key);
      
      if (localEntry?.content?.items) {
        console.log(' Found local todos, setting immediately:', localEntry.content.items.length);
        setTodos(localEntry.content.items);
      } else {
        console.log(' No local todos found');
        setTodos([]);
      }

      // 2. Only sync from cloud on first hydration or force refresh
      if (!hydratedRef.current || refreshKeyRef.current !== refreshKey) {
        console.log(' First hydration - syncing from cloud...');
        setSyncing(true);
        
        try {
          await syncFromCloud(user.id, dateStr, contentType);
          
          // Reload local after sync
          const syncedEntry = await getLocalEntry(key);
          if (syncedEntry?.content?.items) {
            console.log(' Updated todos after cloud sync:', syncedEntry.content.items.length);
            setTodos(syncedEntry.content.items);
          }
        } catch (syncError) {
          console.error('Cloud sync failed:', syncError);
          // Continue with local data
        } finally {
          setSyncing(false);
        }
        
        hydratedRef.current = true;
        refreshKeyRef.current = refreshKey;
      } else {
        console.log(' Using cached todos (no cloud sync needed)');
      }
    } catch (err) {
      console.error('Failed to hydrate todos:', err);
      Alert.alert('Error', 'Failed to load todos.');
    } finally {
      setLoading(false);
      isSyncingRef.current = false;
    }
  }, [user, dateStr, key, contentType, refreshKey]);

  // Main hydration effect
  useEffect(() => {
    if (!authLoading && user) {
      // Reset hydration when date changes
      hydratedRef.current = false;
      hydrateTodos();
    }
  }, [user, authLoading, dateStr, hydrateTodos]);

  // Auto-focus when starting to add a new task
  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  // Handle refresh key changes (pull-to-refresh)
  useEffect(() => {
    if (user && refreshKey > 0 && refreshKey !== refreshKeyRef.current) {
      console.log('🔄 Refresh key changed, forcing refresh:', refreshKey);
      refreshKeyRef.current = refreshKey;
      // Force refresh by resetting hydration and reloading
      hydratedRef.current = false;
      hydrateTodos();
    }
  }, [refreshKey, user, hydrateTodos]);

  // Reset adding state when date changes or when switching tabs
  useEffect(() => {
    setIsAdding(false);
    setNewTodo('');
    closeAllSwipeables();
    // Clear todos state when date changes for clean slate
    setTodos([]);
  }, [dateStr]);

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

  const toggleTodo = async (id: string, isPriorityToggle = false) => {
    // Optimistically update the UI
    setTodos(currentTodos => {
      const updatedTodos = currentTodos.map(todo => {
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
            };
          }
        }
        return todo;
      });

      // Save to storage in the background
      saveTodos(updatedTodos).catch(err => {
        console.error('Failed to save todo update:', err);
        // Revert UI on error
        setTodos(currentTodos);
      });

      return updatedTodos;
    });
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
      // Removed onCancelAdd to remove the cancel button from header
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
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={handleAddInput}
              style={[styles.button, styles.addAnotherButton]}
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
});

import React, { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check } from 'lucide-react-native';
import { SwipeableTodoItem } from '../SwipeableTodoItem';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export const Todos: React.FC = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(5);

  const startAdding = () => {
    setIsAdding(true);
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setNewTodo('');
  };

  const addTodo = (value: string) => {
    if (value.trim()) {
      setTodos([...todos, { id: Date.now().toString(), text: value, completed: false }]);
      return true;
    }
    return false;
  };

  const handleAddInput = () => {
    if (newTodo.trim()) {
      addTodo(newTodo);
      setNewTodo('');
      setVisibleCount(5);
    }
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const removeTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
    setVisibleCount(5);
  };

  const visibleTodos = isAdding ? todos : todos.slice(0, visibleCount);
  const hasMore = !isAdding && todos.length > visibleCount;
  const showLessOption = !isAdding && visibleCount > 5;

  const loadMore = () => {
    setVisibleCount((prev: number) => Math.min(prev + 5, todos.length));
  };

  const showLess = () => {
    setVisibleCount(5);
  };

  return (
    <JournalCard
      icon="list-outline"
      title="Todos"
      subtitle="Track your daily tasks"
      showAddButton={!isAdding}
      onAdd={startAdding}
      isAdding={isAdding}
      onCancelAdd={cancelAdding}
    >
      <View style={styles.todosContainer}>
        {visibleTodos.map((item) => (
          <SwipeableTodoItem
            key={item.id}
            item={item}
            onToggle={toggleTodo}
            onDelete={removeTodo}
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
              style={styles.input}
              value={newTodo}
              onChangeText={setNewTodo}
              placeholder="Add a task..."
              placeholderTextColor={Colors.mediumGray}
              onSubmitEditing={handleAddInput}
              autoFocus
            />
          </View>
          <View style={styles.buttonsRow}>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                onPress={handleAddInput}
                style={[styles.button, styles.addAnotherButton]}
              >
                <View style={styles.plusIcon}>
                  <Ionicons name="close" size={16} color={Colors.alertCoral} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (newTodo.trim()) {
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
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addAnotherButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  disabledButton: {
    opacity: 0.5,
  },
  plusIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

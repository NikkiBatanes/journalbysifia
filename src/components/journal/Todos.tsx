import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export const Todos: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');

  const addTodo = () => {
    if (newTodo.trim()) {
      setTodos([...todos, { id: Date.now().toString(), text: newTodo, completed: false }]);
      setNewTodo('');
    }
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const removeTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const renderTodo = ({ item }: { item: TodoItem }) => (
    <View style={styles.todoItem}>
      <TouchableOpacity
        onPress={() => toggleTodo(item.id)}
        style={styles.checkbox}
      >
        <Ionicons
          name={item.completed ? 'checkbox' : 'square-outline'}
          size={24}
          color={item.completed ? Colors.alertCoral : Colors.mediumGray}
        />
      </TouchableOpacity>
      <TextInput
        style={[styles.todoInput, item.completed && styles.completedText]}
        value={item.text}
        onChangeText={(text) => {
          const updated = todos.map(t =>
            t.id === item.id ? { ...t, text } : t
          );
          setTodos(updated);
        }}
        placeholder="Add a task..."
        placeholderTextColor={Colors.mediumGray}
      />
      <TouchableOpacity
        onPress={() => removeTodo(item.id)}
        style={styles.removeButton}
      >
        <Ionicons name="close" size={20} color={Colors.mediumGray} />
      </TouchableOpacity>
    </View>
  );

  return (
    <JournalCard
      icon="list-outline"
      title="Todos"
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      showAddButton={true}
      onAdd={addTodo}
    >
      {todos.length > 0 ? (
        <FlatList
          data={todos}
          renderItem={renderTodo}
          keyExtractor={item => item.id}
          style={styles.todosList}
        />
      ) : (
        <Text style={styles.emptyText}>No tasks yet. Add one to get started!</Text>
      )}

      {isExpanded && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newTodo}
            onChangeText={setNewTodo}
            placeholder="Add a task..."
            placeholderTextColor={Colors.mediumGray}
            onSubmitEditing={addTodo}
          />
        </View>
      )}
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  todosList: {
    maxHeight: 200,
    marginBottom: 8,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 8,
  },
  checkbox: {
    marginRight: 12,
  },
  todoInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: Colors.mediumGray,
  },
  removeButton: {
    padding: 4,
  },
  inputContainer: {
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  emptyText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginVertical: 8,
  },
});

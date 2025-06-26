import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface PriorityItem {
  id: string;
  text: string;
}

export const TodaysFocus: React.FC = () => {
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [newPriority, setNewPriority] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const startAdding = () => {
    if (priorities.length < 3) {
      setIsAdding(true);
    }
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setNewPriority('');
  };

  const addPriority = () => {
    if (newPriority.trim() && priorities.length < 3) {
      setPriorities([...priorities, { id: Date.now().toString(), text: newPriority }]);
      setNewPriority('');
      setIsAdding(false);
    }
  };

  const removePriority = (id: string) => {
    setPriorities(priorities.filter(item => item.id !== id));
  };

  return (
    <JournalCard
      icon="flag-outline"
      title="Today's Focus"
      subtitle="What's your main priority today?"
      showAddButton={!isAdding && priorities.length < 3}
      onAdd={startAdding}
      isAdding={isAdding}
      onCancelAdd={cancelAdding}
    >
      <View style={styles.prioritiesContainer}>
        {priorities.map((item) => (
          <View key={item.id} style={styles.priorityItem}>
            <View style={styles.priorityBullet} />
            <TextInput
              style={styles.priorityInput}
              value={item.text}
              onChangeText={(text) => {
                const updated = priorities.map(p =>
                  p.id === item.id ? { ...p, text } : p
                );
                setPriorities(updated);
              }}
              placeholder="Enter priority"
              placeholderTextColor={Colors.mediumGray}
            />
            <TouchableOpacity
              onPress={() => removePriority(item.id)}
              style={styles.removeButton}
            >
              <Ionicons name="close" size={20} color={Colors.mediumGray} />
            </TouchableOpacity>
          </View>
        ))}

        {isAdding && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={newPriority}
              onChangeText={setNewPriority}
              placeholder="Add a priority..."
              placeholderTextColor={Colors.mediumGray}
              onSubmitEditing={addPriority}
              autoFocus
            />
            {newPriority.trim() && (
              <TouchableOpacity onPress={addPriority} style={styles.saveButton}>
                <Ionicons name="checkmark" size={24} color={Colors.alertCoral} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {priorities.length === 0 && !isAdding && (
          <Text style={styles.hintText}>
            Tap the + button to add up to 3 priorities for today
          </Text>
        )}
      </View>
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  prioritiesContainer: {
    marginBottom: 8,
  },
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 8,
  },
  priorityBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.alertCoral,
    marginRight: 12,
  },
  priorityInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
  },
  removeButton: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: Colors.hopeWhite,
  },
  saveButton: {
    padding: 4,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    paddingRight: 8,
    backgroundColor: 'transparent',
  },
  hintText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginTop: 8,
  },
});

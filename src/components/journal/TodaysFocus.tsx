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
  const [isExpanded, setIsExpanded] = useState(false);
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [newPriority, setNewPriority] = useState('');

  const addPriority = () => {
    if (newPriority.trim() && priorities.length < 3) {
      setPriorities([...priorities, { id: Date.now().toString(), text: newPriority }]);
      setNewPriority('');
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
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      showAddButton={priorities.length < 3}
      onAdd={addPriority}
    >
      {priorities.length > 0 && (
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
        </View>
      )}

      {priorities.length < 3 && isExpanded && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newPriority}
            onChangeText={setNewPriority}
            placeholder="Add a priority..."
            placeholderTextColor={Colors.mediumGray}
            onSubmitEditing={addPriority}
          />
        </View>
      )}

      {priorities.length === 0 && isExpanded && (
        <Text style={styles.hintText}>
          Add up to 3 priorities for today
        </Text>
      )}
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
  hintText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginTop: 8,
  },
});

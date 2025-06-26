import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface TimeBlockItem {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  category: string;
}

const CATEGORIES = [
  'Work',
  'Appointment',
  'Exercise',
  'Meal',
  'Study',
  'Break',
  'Other',
];

export const TimeBlock: React.FC = () => {
  const [isAdding, setIsAdding] = useState(false);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlockItem[]>([]);
  const [showTimePicker, setShowTimePicker] = useState<{start: boolean, end: boolean, id: string | null}>({ start: false, end: false, id: null });
  const [newBlock, setNewBlock] = useState<{
    title: string;
    startTime: Date;
    endTime: Date;
    category: string;
  }>({
    title: '',
    startTime: new Date(),
    endTime: new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour later
    category: CATEGORIES[0],
  });

  const addTimeBlock = () => {
    if (newBlock.title.trim()) {
      setTimeBlocks([...timeBlocks, { ...newBlock, id: Date.now().toString() }]);
      setIsAdding(false);
    }
  };

  const startAdding = () => {
    setIsAdding(true);
    setNewBlock({
      title: '',
      startTime: new Date(),
      endTime: new Date(new Date().getTime() + 60 * 60 * 1000),
      category: CATEGORIES[0],
    });
  };

  const cancelAdding = () => {
    setIsAdding(false);
  };

  const removeTimeBlock = (id: string) => {
    setTimeBlocks(timeBlocks.filter(block => block.id !== id));
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const onTimeChange = (event: DateTimePickerEvent, selectedDate: Date | undefined, type: 'start' | 'end', id?: string) => {
    const currentDate = selectedDate || (type === 'start' ? newBlock.startTime : newBlock.endTime);

    if (id) {
      // Update existing time block
      setTimeBlocks(timeBlocks.map(block =>
        block.id === id
          ? {
              ...block,
              startTime: type === 'start' ? currentDate : block.startTime,
              endTime: type === 'end' ? currentDate : block.endTime,
            }
          : block
      ));
    } else {
      // Update new time block
      setNewBlock({
        ...newBlock,
        [type === 'start' ? 'startTime' : 'endTime']: currentDate,
      });
    }

    setShowTimePicker({ start: false, end: false, id: null });
  };

  const renderTimeBlock = (block: TimeBlockItem) => (
    <View key={block.id} style={styles.timeBlockItem}>
      <View style={styles.timeContainer}>
        <TouchableOpacity
          style={styles.timeButton}
          onPress={() => setShowTimePicker({ start: true, end: false, id: block.id })}
        >
          <Text style={styles.timeText}>{formatTime(block.startTime)}</Text>
        </TouchableOpacity>
        <Text style={styles.timeSeparator}>-</Text>
        <TouchableOpacity
          style={styles.timeButton}
          onPress={() => setShowTimePicker({ start: false, end: true, id: block.id })}
        >
          <Text style={styles.timeText}>{formatTime(block.endTime)}</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.blockTitle}
        value={block.title}
        onChangeText={(text) => {
          const updated = timeBlocks.map(b =>
            b.id === block.id ? { ...b, title: text } : b
          );
          setTimeBlocks(updated);
        }}
        placeholder="Activity"
        placeholderTextColor={Colors.mediumGray}
      />
      <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(block.category) }]}>
        <Text style={styles.categoryText}>{block.category}</Text>
      </View>
      <TouchableOpacity
        onPress={() => removeTimeBlock(block.id)}
        style={styles.removeButton}
      >
        <Ionicons name="close" size={20} color={Colors.mediumGray} />
      </TouchableOpacity>
    </View>
  );

  const getCategoryColor = (category: string) => {
    // Simple hash function to generate consistent colors for categories
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      // Using Math.pow instead of bitwise operator
      hash = category.charCodeAt(i) + ((hash * 32 - hash) + 0);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 90%)`;
  };

  // Create a function to get category option styles with dynamic border color
  const getCategoryOptionStyle = (isSelected: boolean) => ({
    ...styles.categoryOption,
    borderColor: isSelected ? Colors.alertCoral : 'transparent',
  });

  return (
    <JournalCard
      icon="time-outline"
      title="Time Blocks"
      subtitle="Schedule your day efficiently"
      showAddButton={!isAdding}
      onAdd={startAdding}
      isAdding={isAdding}
      onCancelAdd={cancelAdding}
    >
      <ScrollView style={styles.timeBlocksContainer}>
        {timeBlocks.length > 0 ? (
          timeBlocks.map(block => renderTimeBlock(block))
        ) : !isAdding ? (
          <Text style={styles.emptyText}>No time blocks scheduled yet</Text>
        ) : null}
      </ScrollView>

      {isAdding && (
        <View style={styles.addBlockContainer}>
          <View style={styles.timeContainer}>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setShowTimePicker({ start: true, end: false, id: null })}
            >
              <Text style={styles.timeText}>{formatTime(newBlock.startTime)}</Text>
            </TouchableOpacity>
            <Text style={styles.timeSeparator}>-</Text>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setShowTimePicker({ start: false, end: true, id: null })}
            >
              <Text style={styles.timeText}>{formatTime(newBlock.endTime)}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.flexTwo]}
              value={newBlock.title}
              onChangeText={(text) => setNewBlock({...newBlock, title: text})}
              placeholder="Activity title"
              placeholderTextColor={Colors.mediumGray}
            />
            <View style={[styles.categorySelector, { backgroundColor: getCategoryColor(newBlock.category) }]}>
              <Text style={styles.categoryText}>{newBlock.category}</Text>
              <Ionicons name="chevron-down" size={16} color={Colors.darkGray} />
            </View>
          </View>

          <View style={styles.categoriesContainer}>
            {CATEGORIES.map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  getCategoryOptionStyle(newBlock.category === category),
                  { backgroundColor: getCategoryColor(category) },
                ]}
                onPress={() => setNewBlock({...newBlock, category})}
              >
                <Text style={styles.categoryText}>{category}</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={cancelAdding}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, !newBlock.title.trim() && styles.disabledButton]}
              onPress={addTimeBlock}
              disabled={!newBlock.title.trim()}
            >
              <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {(showTimePicker.start || showTimePicker.end) && (
        <DateTimePicker
          value={showTimePicker.id
            ? showTimePicker.start
              ? timeBlocks.find(b => b.id === showTimePicker.id)?.startTime || new Date()
              : timeBlocks.find(b => b.id === showTimePicker.id)?.endTime || new Date()
            : showTimePicker.start
              ? newBlock.startTime
              : newBlock.endTime}
          mode="time"
          display="default"
          onChange={(event, date) => onTimeChange(event, date, showTimePicker.start ? 'start' : 'end', showTimePicker.id || undefined)}
        />
      )}
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  timeBlocksContainer: {
    maxHeight: 200,
    marginBottom: 8,
  },
  timeBlockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  timeButton: {
    padding: 4,
  },
  timeText: {
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
    fontSize: 14,
  },
  timeSeparator: {
    marginHorizontal: 4,
    color: Colors.mediumGray,
  },
  blockTitle: {
    flex: 2,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
    marginRight: 8,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
  },
  removeButton: {
    padding: 4,
  },
  addBlockContainer: {
    marginTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginRight: 8,
  },
  categorySelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  categoryOption: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
  },
  emptyText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginVertical: 8,
  },
  flexTwo: {
    flex: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: Colors.trustGrey,
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  saveButtonText: {
    color: Colors.hopeWhite,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

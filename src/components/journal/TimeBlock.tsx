import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Modal, TouchableWithoutFeedback } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Check, CalendarClock as LuCalendarClock } from 'lucide-react-native';

interface TimeBlockItem {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  category: string;
  notes?: string;
  isAllDay: boolean;
}

const CATEGORIES = [
  'Appointments',
  'Break Time',
  'Career Growth',
  'Church Activities',
  'Deep Work',
  'Events',
  'Family Time',
  'Life Admin',
  'Mental Health',
  'Ministry',
  'Personal Growth',
  'Physical Health',
  'Projects',
  'Quiet Time',
  'Recreation',
  'Sleep & Recovery',
  'Work Meetings'
];

export const TimeBlock: React.FC = () => {
  const [isAdding, setIsAdding] = useState(false);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlockItem[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState<{start: boolean, end: boolean, id: string | null}>({ start: false, end: false, id: null });
  const [newBlock, setNewBlock] = useState<{
    title: string;
    startTime: Date;
    endTime: Date;
    category: string;
    notes: string;
    isAllDay: boolean;
  }>({
    title: '',
    startTime: new Date(),
    endTime: new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour later
    category: CATEGORIES[0],
    notes: '',
    isAllDay: false,
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
      notes: '',
      isAllDay: false,
    });
  };

  const toggleAllDay = () => {
    setNewBlock(prev => ({
      ...prev,
      isAllDay: !prev.isAllDay,
      startTime: new Date(prev.startTime.setHours(0, 0, 0, 0)),
      endTime: new Date(prev.startTime.setHours(23, 59, 59, 999))
    }));
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

  const onTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // On iOS, the picker doesn't close automatically, so we need to close it after selection
    if (event.type === 'set' || event.type === 'dismissed') {
      if (selectedDate) {
        const type = showTimePicker.start ? 'start' : 'end';
        const id = showTimePicker.id;
        
        // Create a new date object to ensure reactivity
        const newDate = new Date(selectedDate);
        
        if (id) {
          // Update existing time block
          setTimeBlocks(timeBlocks.map(block =>
            block.id === id
              ? {
                  ...block,
                  startTime: type === 'start' ? newDate : block.startTime,
                  endTime: type === 'end' ? newDate : block.endTime,
                }
              : block
          ));
        } else {
          // Update new time block
          setNewBlock(prev => ({
            ...prev,
            [type === 'start' ? 'startTime' : 'endTime']: newDate,
          }));
        }
      }
      
      // Close the picker
      setShowTimePicker({ start: false, end: false, id: null });
    }
  };

  const renderTimeBlock = (block: TimeBlockItem) => (
    <View key={block.id} style={styles.timeBlockItem}>
      <View style={styles.timeColumn}>
        {block.isAllDay ? (
          <View style={styles.allDayBadge}>
            <Text style={styles.allDayText}>ALL DAY</Text>
          </View>
        ) : (
          <View style={styles.timeRangeContainer}>
            <Text style={styles.timeText}>
              {formatTime(block.startTime)} - {formatTime(block.endTime)}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.detailsColumn}>
        <View style={styles.detailsRow}>
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
        </View>
        <View style={styles.detailsContent}>
          <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(block.category) }]}>
            <Text style={styles.categoryText} numberOfLines={1} ellipsizeMode="tail">
              {block.category}
            </Text>
          </View>
          {block.notes ? (
            <Text style={styles.notesText} numberOfLines={2} ellipsizeMode="tail">
              {block.notes}
            </Text>
          ) : null}
        </View>
      </View>
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
      icon={
        <LuCalendarClock 
          size={24}
          color={Colors.alertCoral}
          strokeWidth={2.5}
        />
      }
      title="Time Blocks"
      subtitle="Schedule your day efficiently"
      showAddButton={!isAdding}
      onAdd={startAdding}
      isAdding={isAdding}
      onCancelAdd={cancelAdding}
    >
      {(timeBlocks.length > 0 || isAdding) ? (
        <>
          {timeBlocks.length > 0 && (
            <ScrollView style={styles.timeBlocksContainer}>
              {timeBlocks.map(block => renderTimeBlock(block))}
            </ScrollView>
          )}
          {isAdding && (
            <View style={styles.addBlockContainer}>
              <View style={styles.editTimeContainer}>
                <View style={styles.editTimeRow}>
                  {newBlock.isAllDay ? (
                    <View style={styles.allDayBadge}>
                      <Text style={styles.allDayText}>ALL DAY</Text>
                    </View>
                  ) : (
                    <View style={styles.timeRangeEdit}>
                      <TouchableOpacity
                        style={styles.timeButton}
                        onPress={() => setShowTimePicker({ start: true, end: false, id: null })}
                      >
                        <Text style={styles.timeText}>{formatTime(newBlock.startTime)}</Text>
                      </TouchableOpacity>
                      <Text style={styles.timeSeparator}>TO</Text>
                      <TouchableOpacity
                        style={styles.timeButton}
                        onPress={() => setShowTimePicker({ start: false, end: true, id: null })}
                      >
                        <Text style={styles.timeText}>{formatTime(newBlock.endTime)}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <TouchableOpacity 
                    style={styles.allDayToggle}
                    onPress={toggleAllDay}
                  >
                    <View style={[styles.checkbox, newBlock.isAllDay && styles.checkboxChecked]}>
                      {newBlock.isAllDay && <Check size={10} color={Colors.hopeWhite} strokeWidth={2.5} />}
                    </View>
                    <Text style={styles.allDayLabel}>All Day</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, styles.fullWidth]}
                  value={newBlock.title}
                  onChangeText={(text) => setNewBlock({...newBlock, title: text})}
                  placeholder="Activity title"
                  placeholderTextColor={Colors.mediumGray}
                />
                <View style={styles.categorySelectorContainer}>
                  <TouchableOpacity 
                    style={[styles.categorySelector, { backgroundColor: getCategoryColor(newBlock.category) }]}
                    onPress={() => setShowCategoryPicker(true)}
                  >
                    <Text style={styles.categoryText} numberOfLines={1} ellipsizeMode="tail">
                      {newBlock.category}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.darkGray} />
                  </TouchableOpacity>
                </View>
              </View>

              <TextInput
                style={[styles.input, styles.notesInput]}
                value={newBlock.notes}
                onChangeText={(text) => setNewBlock({...newBlock, notes: text})}
                placeholder="Add notes (optional)"
                placeholderTextColor={Colors.mediumGray}
                multiline
                numberOfLines={2}
              />

              {/* Category Picker Modal */}
              <Modal
                visible={showCategoryPicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowCategoryPicker(false)}
              >
                <TouchableWithoutFeedback onPress={() => setShowCategoryPicker(false)}>
                  <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                      <ScrollView style={styles.pickerScroll}>
                        {CATEGORIES.map((category) => (
                          <TouchableOpacity
                            key={category}
                            style={[
                              styles.pickerItem,
                              { backgroundColor: getCategoryColor(category) },
                              newBlock.category === category && styles.selectedPickerItem
                            ]}
                            onPress={() => {
                              setNewBlock({...newBlock, category});
                              setShowCategoryPicker(false);
                            }}
                          >
                            <Text style={styles.pickerItemText}>{category}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </Modal>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton, !newBlock.title.trim() && styles.disabledButton]}
                  onPress={addTimeBlock}
                  disabled={!newBlock.title.trim()}
                >
                  <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
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
              display="spinner"
              onChange={onTimeChange}
              themeVariant="light"
              minuteInterval={5}
            />
          )}
        </>
      ) : null}
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  timeBlocksContainer: {
    maxHeight: 300,
    marginBottom: 8,
    padding: 0,
  },
  inputContainer: {
    marginBottom: 10,
    marginTop: 4,
  },
  input: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    minHeight: 40,
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: 6,
    marginBottom: 6,
    fontSize: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    padding: 10,
  },
  fullWidth: {
    width: '100%',
  },
  categorySelectorContainer: {
    marginTop: 10,
    marginBottom: 4,
    width: '100%',
  },
  addBlockContainer: {
    marginTop: 6,
    marginBottom: 4,
  },
  timeBlockItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    minHeight: 70,
  },
  timeColumn: {
    width: 90,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: 'rgba(26, 60, 109, 0.1)',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  timeRangeContainer: {
    flexDirection: 'column',
  },
  editTimeContainer: {
    width: '100%',
    marginBottom: 12,
  },
  editTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeRangeEdit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsColumn: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  detailsContent: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  timeButton: {
    padding: 4,
  },
  timeText: {
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
    fontSize: 13,
    minWidth: 40,
    lineHeight: 18,
  },
  allDayBadge: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  allDayText: {
    color: Colors.alertCoral,
    fontSize: 10,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  allDayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: Colors.trustGrey,
    backgroundColor: 'rgba(176, 184, 193, 0.1)',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.growthGreen,
    borderColor: Colors.growthGreen,
  },
  allDayLabel: {
    fontSize: 13,
    color: Colors.darkGray,
    fontFamily: Fonts.regular,
    marginLeft: 0,
    opacity: 0.9,
  },
  timeSeparator: {
    marginHorizontal: 6,
    color: Colors.mediumGray,
    fontSize: 8,
    fontFamily: Fonts.bold,
    opacity: 0.8,
  },
  blockTitle: {
    flex: 2,
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
    fontSize: 14,
    marginRight: 8,
    fontWeight: '600',
  },
  categoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
  },
  notesText: {
    fontSize: 12,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 16,
  },
  removeButton: {
    color: Colors.darkGray,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    marginRight: 8,
    minHeight: 40,
    flex: 2,
  },
  categorySelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    minHeight: 40,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 0,
  },
  categoryOption: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  emptyText: {
    display: 'none',
  },
  flexTwo: {
    flex: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '100%',
    maxHeight: '60%',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pickerScroll: {
    width: '100%',
  },
  pickerItem: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  selectedPickerItem: {
    borderWidth: 2,
    borderColor: Colors.alertCoral,
  },
  pickerItemText: {
    color: Colors.darkGray,
    fontFamily: Fonts.regular,
    fontSize: 16,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

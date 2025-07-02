import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, Modal, TouchableWithoutFeedback } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Check, CalendarClock as LuCalendarClock, X } from 'lucide-react-native';

type RepeatFrequency = 'never' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';

interface TimeBlockItem {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  category: string;
  notes?: string;
  location?: string;
  isAllDay: boolean;
  repeat: {
    frequency: RepeatFrequency;
    endDate?: Date;
    customDays?: number[]; // For custom repeat
  };
}

// Helper function to format time duration
const formatDuration = (start: Date, end: Date): string => {
  const diffInMs = end.getTime() - start.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffInHours > 0) {
    return diffInMinutes > 0 ? `${diffInHours}h ${diffInMinutes}m` : `${diffInHours}h`;
  }
  return `${diffInMinutes}m`;
};

// Helper function to format repeat text
const formatRepeatText = (frequency: RepeatFrequency, customDays?: number[]): string => {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  switch (frequency) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Bi-weekly';
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
    case 'custom':
      if (customDays && customDays.length > 0) {
        const days = customDays.map(day => dayNames[day]).join(', ');
        return `Custom (${days})`;
      }
      return 'Custom';
    default:
      return '';
  }
};

const CATEGORIES = [
  { name: 'Appointments', icon: 'calendar' },
  { name: 'Break Time', icon: 'cafe' },
  { name: 'Career Growth', icon: 'rocket' },
  { name: 'Church Activities', icon: 'people' },
  { name: 'Deep Work', icon: 'code-working' },
  { name: 'Events', icon: 'calendar-number' },
  { name: 'Family Time', icon: 'people-circle' },
  { name: 'Life Admin', icon: 'document-text' },
  { name: 'Mental Health', icon: 'heart' },
  { name: 'Ministry', icon: 'hand-left' },
  { name: 'Personal Growth', icon: 'person' },
  { name: 'Physical Health', icon: 'barbell' },
  { name: 'Projects', icon: 'folder' },
  { name: 'Quiet Time', icon: 'book' },
  { name: 'Recreation', icon: 'airplane' },
  { name: 'Sleep & Recovery', icon: 'moon' },
  { name: 'Work Meetings', icon: 'briefcase' },
  { name: 'Others', icon: 'ellipsis-horizontal' },
];

export const TimeBlock: React.FC = () => {
  const [isAdding, setIsAdding] = useState(false);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlockItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(5);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showCategoryError, setShowCategoryError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFrequencySelector, setShowFrequencySelector] = useState(false);
  const [customFrequency, setCustomFrequency] = useState({ value: 1, unit: 'week' });
  const [inputValue, setInputValue] = useState('1');
  const [showTimePicker, setShowTimePicker] = useState<{start: boolean, end: boolean, id: string | null}>({ start: false, end: false, id: null });
  const [showRepeatOptions, setShowRepeatOptions] = useState(false);
  const [newBlock, setNewBlock] = useState<{
    title: string;
    startTime: Date;
    endTime: Date;
    category: string;
    notes: string;
    location: string;
    isAllDay: boolean;
    repeat: {
      frequency: RepeatFrequency;
      endDate?: Date;
      customDays?: number[];
    };
  }>({
    title: '',
    startTime: new Date(),
    endTime: new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour later
    category: '',
    notes: '',
    location: '',
    isAllDay: false,
    repeat: {
      frequency: 'never',
      endDate: undefined,
      customDays: [],
    },
  });

  const addTimeBlock = () => {
    if (!newBlock.category) {
      setShowCategoryError(true);
      return;
    }

    if (newBlock.title.trim()) {
      setTimeBlocks([...timeBlocks, {
        ...newBlock,
        id: Date.now().toString(),
        category: selectedCategory || newBlock.category,
        repeat: {
          frequency: newBlock.repeat.frequency,
          endDate: newBlock.repeat.endDate,
          customDays: newBlock.repeat.customDays || [],
        },
      }]);
      setShowCategoryError(false);
      setSelectedCategory('');
      setIsAdding(false);
    }
  };

  const startAdding = () => {
    setIsAdding(true);
    setShowRepeatOptions(false);
    setShowEndDatePicker(false);
    setShowCategoryPicker(false);
    setShowFrequencySelector(false);
    setInputValue('1');
    setCustomFrequency({ value: 1, unit: 'week' });
    setNewBlock({
      title: '',
      startTime: new Date(),
      endTime: new Date(new Date().getTime() + 60 * 60 * 1000),
      category: '',
      notes: '',
      location: '',
      isAllDay: false,
      repeat: {
        frequency: 'never',
        endDate: undefined,
        customDays: [],
      },
    });
  };

  const toggleAllDay = () => {
    // Close any open time pickers when toggling All Day
    if (showTimePicker.start || showTimePicker.end) {
      setShowTimePicker({ start: false, end: false, id: null });
    }
    setNewBlock(prev => ({
      ...prev,
      isAllDay: !prev.isAllDay,
      startTime: new Date(prev.startTime.setHours(0, 0, 0, 0)),
      endTime: new Date(prev.startTime.setHours(23, 59, 59, 999)),
    }));
  };


  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const onTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // Only update the time if a date was selected
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

    // Only close the picker if the user explicitly dismissed it
    if (event.type === 'dismissed') {
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
          <View style={styles.timeRangeStacked}>
            <Text style={styles.timeText}>{formatTime(block.startTime)}</Text>
            <Text style={styles.timeSeparatorCentered}>TO</Text>
            <Text style={styles.timeText}>{formatTime(block.endTime)}</Text>
            <View style={styles.durationContainer}>
              <Text style={styles.durationText}>
                {formatDuration(block.startTime, block.endTime)}
              </Text>
            </View>
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
            <View style={styles.categoryContent}>
              <Ionicons
                name={CATEGORIES.find(cat => cat.name === block.category)?.icon || 'square-outline'}
                size={12}
                color={Colors.anchorBlue}
                style={styles.categoryIcon}
              />
              <Text style={styles.categoryLabel} numberOfLines={1} ellipsizeMode="tail">
                {block.category}
              </Text>
            </View>
          </View>
          {(block.location || block.repeat.frequency !== 'never') && (
            <View style={styles.metaInfoContainer}>
              {block.location && (
                <View style={styles.metaInfoRow}>
                  <Ionicons name="location-outline" size={12} color={Colors.mediumGray} style={styles.metaIcon} />
                  <Text style={styles.metaText} numberOfLines={1} ellipsizeMode="tail">
                    {block.location}
                  </Text>
                </View>
              )}
              {block.repeat.frequency !== 'never' && (
                <View style={styles.metaInfoRow}>
                  <Ionicons name="repeat-outline" size={12} color={Colors.mediumGray} style={styles.metaIcon} />
                  <Text style={styles.metaText}>
                    {formatRepeatText(block.repeat.frequency, block.repeat.customDays)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {block.notes && (
            <View style={styles.notesContainer}>
              <Ionicons name="document-text-outline" size={12} color={Colors.mediumGray} style={styles.notesIcon} />
              <Text style={styles.notesText} numberOfLines={2} ellipsizeMode="tail">
                {block.notes}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  const getCategoryColor = (categoryName: string): string => {
    const colorMap: {[key: string]: string} = {
      'Appointments': '#FFEBEE', // Soft Pink
      'Break Time': '#FFF3E0', // Light Orange
      'Career Growth': '#E3F2FD', // Pale Blue
      'Church Activities': '#F3E5F5', // Light Lavender
      'Deep Work': '#E8F5E9', // Mint Green
      'Events': '#FFEBEE', // Soft Pink
      'Family Time': '#FFF8E1', // Light Yellow
      'Life Admin': '#E0F7FA', // Ice Blue
      'Mental Health': '#F3E5F5', // Pale Lilac
      'Ministry': '#E3F2FD', // Light Blue
      'Personal Growth': '#F1F8E9', // Pale Green
      'Physical Health': '#E8F5E9', // Mint Green
      'Projects': '#FFECB3', // Soft Yellow
      'Quiet Time': '#F3E5F5', // Pale Lilac
      'Recreation': '#FFE0B2', // Light Orange
      'Sleep & Recovery': '#E1F5FE', // Light Blue
      'Work Meetings': '#EDE7F6', // Light Purple
      'Others': '#F0F0F0', // Light Gray
    };
    return colorMap[categoryName] || '#F5F5F5'; // Default very light gray if not found
  };


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
    >
      {(timeBlocks.length > 0 || isAdding) ? (
        <>
          {timeBlocks.length > 0 && !isAdding && (
            <View style={styles.timeBlocksContainer}>
              {[...timeBlocks]
                .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
                .slice(0, visibleCount)
                .map(block => renderTimeBlock(block))}
              {timeBlocks.length > 5 && !isAdding && (
                <View style={styles.paginationContainer}>
                  <View style={styles.paginationButtonGroup}>
                    {timeBlocks.length > visibleCount ? (
                      <TouchableOpacity
                        style={[styles.paginationButton, styles.showMoreButton]}
                        onPress={() => setVisibleCount(prev => Math.min(prev + 5, timeBlocks.length))}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="chevron-down" size={12} color={Colors.alertCoral} />
                        <Text style={[styles.paginationButtonText, styles.showMoreText]}>
                          Show more
                        </Text>
                      </TouchableOpacity>
                    ) : visibleCount > 5 && (
                      <TouchableOpacity
                        style={[styles.paginationButton, styles.showLessButton]}
                        onPress={() => setVisibleCount(5)}
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
          )}
          {isAdding && (
            <View style={styles.addBlockContainer}>
              {/* 1. Time Range / All Day */}
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
                  <View style={styles.allDayToggle}>
                    <TouchableOpacity
                      style={styles.rowCenter}
                      onPress={toggleAllDay}
                    >
                      <View style={styles.checkboxContainer}>
                        <View style={[styles.checkbox, newBlock.isAllDay && styles.checkboxActive]}>
                          {newBlock.isAllDay && <Check size={10} color={Colors.hopeWhite} strokeWidth={2.5} />}
                        </View>
                      </View>
                      <Text style={styles.allDayLabel}>All Day</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {(showTimePicker.start || showTimePicker.end) && !showTimePicker.id && (
                  <View style={styles.timePickerContainer}>
                    <DateTimePicker
                      value={showTimePicker.start ? newBlock.startTime : newBlock.endTime}
                      mode="time"
                      display="spinner"
                      onChange={onTimeChange}
                      themeVariant="light"
                      minuteInterval={5}
                    />
                    <TouchableOpacity
                      style={styles.doneButton}
                      onPress={() => setShowTimePicker({ start: false, end: false, id: null })}
                    >
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* 2. Activity Title */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, styles.fullWidth]}
                  value={newBlock.title}
                  onChangeText={(text) => setNewBlock({...newBlock, title: text})}
                  placeholder="Enter a title"
                  placeholderTextColor={Colors.mediumGray}
                />
              </View>

              {/* 3. Location */}
              <View style={styles.locationContainer}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={Colors.darkGray}
                  style={styles.locationIcon}
                />
                <TextInput
                  style={[styles.input, styles.locationInput]}
                  value={newBlock.location}
                  onChangeText={(text) => setNewBlock({...newBlock, location: text})}
                  placeholder="Add location (optional)"
                  placeholderTextColor={Colors.mediumGray}
                />
              </View>

              {/* 4. Category */}
              <View style={styles.categorySelectorContainer}>
                <TouchableOpacity
                  style={[
                    styles.categorySelector,
                    !newBlock.category && showCategoryError && styles.categorySelectorError,
                    newBlock.category && [
                      { backgroundColor: getCategoryColor(newBlock.category) },
                      styles.categorySelected,
                    ],
                  ]}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <Ionicons
                    name={newBlock.category ? CATEGORIES.find(cat => cat.name === newBlock.category)?.icon || 'square-outline' : 'add-circle-outline'}
                    size={16}
                    color={newBlock.category ? Colors.anchorBlue : Colors.mediumGray}
                  />
                  <Text style={[
                    styles.categorySelectorText,
                    !newBlock.category && styles.placeholderText,
                    !newBlock.category && showCategoryError && { color: Colors.alertCoral },
                  ]}>
                    {newBlock.category || 'Select a category'}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={(!newBlock.category && showCategoryError) ? Colors.alertCoral : Colors.mediumGray}
                  />
                </TouchableOpacity>
                {showCategoryError && !newBlock.category && (
                  <Text style={styles.errorText}>Please select a category</Text>
                )}
              </View>

              {/* 5. Repeat Options */}
              <View style={styles.repeatContainer}>
                <TouchableOpacity
                  style={styles.repeatButton}
                  onPress={() => setShowRepeatOptions(!showRepeatOptions)}
                >
                  <Ionicons
                    name="repeat-outline"
                    size={18}
                    color={Colors.darkGray}
                    style={styles.repeatIcon}
                  />
                  <Text style={styles.repeatText}>
                    {newBlock.repeat.frequency === 'never' ? 'Does not repeat' :
                     `Repeats ${newBlock.repeat.frequency}${newBlock.repeat.endDate ? ` until ${newBlock.repeat.endDate.toLocaleDateString()}` : ''}`}
                  </Text>
                  <Ionicons
                    name={showRepeatOptions ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={Colors.darkGray}
                  />
                </TouchableOpacity>

                {showRepeatOptions && (
                  <View style={styles.repeatOptions}>
                    {['never', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly', 'custom'].map((freq) => (
                      <TouchableOpacity
                        key={freq}
                        style={[
                          styles.repeatOption,
                          newBlock.repeat.frequency === freq && styles.selectedRepeatOption,
                        ]}
                        onPress={() => {
                          const newFrequency = freq as RepeatFrequency;
                          const updatedBlock = {
                            ...newBlock,
                            repeat: {
                              ...newBlock.repeat,
                              frequency: newFrequency,
                              ...(newFrequency === 'never' && { endDate: undefined }),
                            },
                          };
                          setNewBlock(updatedBlock);
                          if (newFrequency !== 'custom') {
                            setShowRepeatOptions(false);
                          }
                        }}
                      >
                        <Text style={styles.repeatOptionText}>
                          {freq === 'never' ? 'Never' :
                           freq === 'daily' ? 'Every Day' :
                           freq === 'weekly' ? 'Every Week' :
                           freq === 'biweekly' ? 'Every 2 Weeks' :
                           freq === 'monthly' ? 'Every Month' :
                           freq === 'yearly' ? 'Every Year' : 'Custom...'}
                        </Text>
                        {newBlock.repeat.frequency === freq && (
                          <Ionicons name="checkmark" size={16} color={Colors.alertCoral} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Custom Repeat Options */}
                {newBlock.repeat.frequency === 'custom' && (
                  <View style={styles.customRepeatContainer}>
                    {/* Frequency Selector */}
                    <View style={styles.frequencySelector}>
                      <Text style={styles.frequencyLabel}>Repeat every:</Text>
                      <View style={styles.frequencyInputs}>
                        <TextInput
                          style={styles.frequencyInput}
                          value={inputValue}
                          onChangeText={(text) => {
                            // Update the input value
                            setInputValue(text);

                            // Only update the frequency if we have a valid number
                            if (text === '') {
                              setCustomFrequency(prev => ({
                                ...prev,
                                value: 1,
                              }));
                            } else if (/^\d+$/.test(text)) {
                              const num = parseInt(text, 10);
                              if (num >= 1) {
                                setCustomFrequency(prev => ({
                                  ...prev,
                                  value: num,
                                }));
                              }
                            }
                          }}
                          onBlur={() => {
                            // Ensure we have a valid number when leaving the field
                            if (!inputValue || !/^\d+$/.test(inputValue)) {
                              setInputValue('1');
                              setCustomFrequency(prev => ({
                                ...prev,
                                value: 1,
                              }));
                            }
                          }}
                          keyboardType="number-pad"
                          maxLength={2}
                          returnKeyType="done"
                          selectTextOnFocus={true}
                        />
                        <TouchableOpacity
                          style={styles.frequencyUnitButton}
                          onPress={() => setShowFrequencySelector(!showFrequencySelector)}
                        >
                          <Text style={styles.frequencyUnitText}>
                            {customFrequency.unit.charAt(0).toUpperCase() + customFrequency.unit.slice(1)}{customFrequency.value > 1 ? 's' : ''}
                          </Text>
                          <Ionicons name="chevron-down" size={14} color={Colors.darkGray} />
                        </TouchableOpacity>
                      </View>

                      {showFrequencySelector && (
                        <View style={styles.frequencyOptions}>
                          {['day', 'week', 'month', 'year'].map((unit) => (
                            <TouchableOpacity
                              key={unit}
                              style={styles.frequencyOption}
                              onPress={() => {
                                setCustomFrequency(prev => ({
                                  ...prev,
                                  unit,
                                }));
                                setShowFrequencySelector(false);
                              }}
                            >
                              <Text style={styles.frequencyOptionText}>
                                {unit.charAt(0).toUpperCase() + unit.slice(1)}
                              </Text>
                              {customFrequency.unit === unit && (
                                <Ionicons name="checkmark" size={16} color={Colors.alertCoral} />
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    {/* Days of Week Selector (only shown for weekly frequency) */}
                    {customFrequency.unit === 'week' && (
                      <View style={styles.customDaysContainer}>
                        <Text style={styles.customDaysLabel}>On days:</Text>
                        <View style={styles.daysOfWeekContainer}>
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
                            const isSelected = newBlock.repeat.customDays?.includes(index);
                            return (
                              <TouchableOpacity
                                key={index}
                                style={[
                                  styles.dayButton,
                                  isSelected && styles.dayButtonSelected,
                                ]}
                                onPress={() => {
                                  const updatedDays = newBlock.repeat.customDays || [];
                                  const newDays = updatedDays.includes(index)
                                    ? updatedDays.filter(d => d !== index)
                                    : [...updatedDays, index];

                                  setNewBlock({
                                    ...newBlock,
                                    repeat: {
                                      ...newBlock.repeat,
                                      customDays: newDays.sort((a, b) => a - b),
                                    },
                                  });
                                }}
                              >
                                <Text style={[
                                  styles.dayButtonText,
                                  isSelected && styles.dayButtonTextSelected,
                                ]}>
                                  {day}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* End Repeat Options */}
                {newBlock.repeat.frequency !== 'never' && (
                  <View style={styles.endRepeatContainer}>
                    <Text style={styles.endRepeatLabel}>End Repeat:</Text>
                    <View style={styles.endRepeatOptions}>
                      <TouchableOpacity
                        style={[
                          styles.endRepeatOption,
                          !newBlock.repeat.endDate && styles.selectedEndRepeatOption,
                        ]}
                        onPress={() => {
                          setNewBlock({
                            ...newBlock,
                            repeat: {
                              ...newBlock.repeat,
                              endDate: undefined,
                            },
                          });
                        }}
                      >
                        <Text style={styles.endRepeatOptionText}>Never</Text>
                        {!newBlock.repeat.endDate && (
                          <Ionicons name="checkmark" size={16} color={Colors.alertCoral} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.endRepeatOption,
                          newBlock.repeat.endDate && styles.selectedEndRepeatOption,
                        ]}
                        onPress={() => {
                          setShowEndDatePicker(true);
                          // Don't set a default date, just show the picker
                        }}
                      >
                        <Text style={styles.endRepeatOptionText}>
                          {newBlock.repeat.endDate
                            ? newBlock.repeat.endDate.toLocaleDateString()
                            : 'Select Date'}
                        </Text>
                        {newBlock.repeat.endDate && (
                          <Ionicons name="checkmark" size={16} color={Colors.alertCoral} />
                        )}
                      </TouchableOpacity>
                    </View>
                    {showEndDatePicker && (
                      <View style={styles.datePickerContainer}>
                        <DateTimePicker
                          value={newBlock.repeat.endDate || new Date()}
                          mode="date"
                          display="default"
                          onChange={(event, selectedDate) => {
                            setShowEndDatePicker(false);
                            if (selectedDate) {
                              setNewBlock({
                                ...newBlock,
                                repeat: {
                                  ...newBlock.repeat,
                                  endDate: selectedDate,
                                },
                              });
                            }
                          }}
                          minimumDate={new Date()}
                        />
                        <TouchableOpacity
                          style={styles.cancelDateButton}
                          onPress={() => setShowEndDatePicker(false)}
                        >
                          <Text style={styles.cancelDateButtonText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* 6. Notes */}
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={newBlock.notes}
                onChangeText={(text) => setNewBlock({...newBlock, notes: text})}
                placeholder="Add notes (optional)"
                placeholderTextColor={Colors.mediumGray}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
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
                      <FlatList
                        data={CATEGORIES}
                        numColumns={2}
                        keyExtractor={(item) => item.name}
                        contentContainerStyle={styles.gridContainer}
                        columnWrapperStyle={styles.columnWrapper}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={[
                              styles.gridItem,
                              { backgroundColor: getCategoryColor(item.name) },
                              newBlock.category === item.name && styles.selectedPickerItem,
                            ]}
                            onPress={() => {
                              setNewBlock({...newBlock, category: item.name});
                              setShowCategoryPicker(false);
                            }}
                          >
                            <Ionicons
                              name={item.icon}
                              size={18}
                              color={Colors.anchorBlue}
                              style={styles.categoryIcon}
                            />
                            <Text
                              style={styles.gridItemText}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {item.name}
                            </Text>
                          </TouchableOpacity>
                        )}
                      />
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </Modal>

              <View style={styles.buttonRow}>
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => setIsAdding(false)}
                  >
                    <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.saveButton, !newBlock.title.trim() && styles.disabledButton]}
                    onPress={addTimeBlock}
                    disabled={!newBlock.title.trim()}
                  >
                    <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          {/* Time picker for existing time blocks */}
          {showTimePicker.id && (showTimePicker.start || showTimePicker.end) && (
            <DateTimePicker
              value={
                showTimePicker.start
                  ? timeBlocks.find(b => b.id === showTimePicker.id)?.startTime || new Date()
                  : timeBlocks.find(b => b.id === showTimePicker.id)?.endTime || new Date()
              }
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
    marginBottom: 8,
    padding: 0,
  },
  repeatContainer: {
    marginBottom: 8,
  },
  timePickerContainer: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  doneButton: {
    backgroundColor: Colors.anchorBlue,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  doneButtonText: {
    color: 'white',
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  errorText: {
    color: Colors.alertCoral,
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 4,
  },
  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 8,
    marginBottom: 16,
  },
  repeatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    minHeight: 40,
  },
  repeatIcon: {
    marginRight: 8,
  },
  repeatText: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
  },
  repeatOptions: {
    marginTop: 2,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    overflow: 'hidden',
  },
  repeatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26, 60, 109, 0.1)',
  },
  selectedRepeatOption: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  repeatOptionText: {
    fontSize: 14,
    color: Colors.darkGray,
    fontFamily: Fonts.regular,
    flex: 1,
    lineHeight: 20,
    marginVertical: 1,
  },
  endRepeatContainer: {
    marginTop: 4,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
  },
  endRepeatLabel: {
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
    fontSize: 13,
    marginBottom: 8,
  },
  endRepeatOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  endRepeatOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    marginHorizontal: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  selectedEndRepeatOption: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  endRepeatOptionText: {
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 13,
  },
  datePickerContainer: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelDateButton: {
    marginTop: 10,
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  cancelDateButtonText: {
    color: Colors.darkGray,
    fontFamily: Fonts.medium,
  },
  inputContainer: {
    marginBottom: 8,
  },
  editTimeContainer: {
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
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    padding: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    paddingLeft: 12,
    paddingRight: 8,
    height: 40,
    minHeight: 40, // Ensure minimum height
    overflow: 'hidden',
    width: '100%', // Ensure full width
  },
  locationIcon: {
    marginRight: 8,
    width: 18,
    height: 18,
    textAlign: 'center',
  },
  locationInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    margin: 0,
    padding: 0,
    color: Colors.darkGray,
    fontFamily: Fonts.regular,
  },
  fullWidth: {
    width: '100%',
  },
  categorySelectorContainer: {
    marginBottom: 8,
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
    alignItems: 'center',
    paddingLeft: 4,
  },
  timeRangeContainer: {
    flexDirection: 'column',
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
  timeRangeStacked: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    width: '100%',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeButton: {
    padding: 4,
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
  allDayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    paddingVertical: 4,
  },
  checkboxContainer: {
    position: 'relative',
    marginRight: 10,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: Colors.trustGrey,
    backgroundColor: 'rgba(176, 184, 193, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
  },
  checkboxCompleted: {
    backgroundColor: Colors.growthGreen,
    borderColor: Colors.growthGreen,
  },
  timeText: {
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
    fontSize: 13,
    minWidth: 40,
    lineHeight: 18,
  },
  durationContainer: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  durationText: {
    fontSize: 10,
    color: Colors.mediumGray,
    fontFamily: Fonts.medium,
    textAlign: 'center',
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
  allDayBadge: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  allDayText: {
    color: Colors.alertCoral,
    fontSize: 11,
    fontFamily: Fonts.medium,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allDayLabel: {
    color: Colors.darkGray,
    fontSize: 13,
    fontFamily: Fonts.regular,
    marginLeft: 0,
    opacity: 0.9,
  },
  timeSeparator: {
    color: Colors.mediumGray,
    fontSize: 8,
    fontFamily: Fonts.medium,
    textTransform: 'uppercase',
    marginVertical: 2,
    marginHorizontal: 6,
  },
  timeSeparatorCentered: {
    color: Colors.mediumGray,
    fontSize: 8,
    fontFamily: Fonts.medium,
    textTransform: 'uppercase',
    marginVertical: 2,
    marginHorizontal: 0,
    width: '100%',
    textAlign: 'center',
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
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    marginRight: 4,
  },
  categoryLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
  },
  metaInfoContainer: {
    marginTop: 6,
    marginBottom: 2,
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    minHeight: 16,
  },
  metaIcon: {
    marginRight: 4,
  },
  metaText: {
    fontSize: 11,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
    flex: 1,
    lineHeight: 14,
    marginVertical: 1,
  },

  customRepeatContainer: {
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
    padding: 10,
  },
  frequencySelector: {
    marginBottom: 12,
  },
  frequencyLabel: {
    fontSize: 14,
    color: Colors.darkGray,
    fontFamily: Fonts.medium,
    marginBottom: 8,
  },
  frequencyInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frequencyInput: {
    width: 60,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    padding: 8,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginRight: 8,
    textAlign: 'center',
  },
  frequencyUnitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    paddingHorizontal: 12,
    height: 40,
    minWidth: 100,
  },
  frequencyUnitText: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
  },
  frequencyOptions: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    zIndex: 1000,
    elevation: 5,
  },
  frequencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  frequencyOptionText: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 14,
  },
  customDaysContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  customDaysLabel: {
    fontSize: 14,
    color: Colors.darkGray,
    fontFamily: Fonts.medium,
    marginBottom: 8,
  },
  daysOfWeekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    margin: 2,
  },
  dayButtonSelected: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
  },
  dayButtonText: {
    fontSize: 14,
    color: Colors.darkGray,
    fontFamily: Fonts.medium,
  },
  dayButtonTextSelected: {
    color: 'white',
  },
  notesContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  notesIcon: {
    marginTop: 1,
    marginRight: 4,
  },
  notesText: {
    fontSize: 12,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
    fontStyle: 'italic',
    flex: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    minHeight: 40,
  },
  categorySelectorError: {
    borderColor: Colors.alertCoral,
  },
  categorySelected: {
    borderColor: 'rgba(26, 60, 109, 0.3)',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
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
    padding: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    padding: 0,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxWidth: 285,
    padding: 16,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pickerScroll: {
    width: '100%',
  },
  gridContainer: {
    padding: 4,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 4,
  },
  gridItem: {
    flex: 1,
    minWidth: 0,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
    maxWidth: 120,
  },
  categorySelectorText: {
    color: Colors.darkGray,
    fontFamily: Fonts.regular,
    fontSize: 14,
    flex: 1,
    marginLeft: 8,
  },
  placeholderText: {
    color: Colors.mediumGray,
    fontStyle: 'italic',
  },
  selectedPickerItem: {
    borderWidth: 2,
    borderColor: Colors.alertCoral,
  },
  gridItemText: {
    color: Colors.darkGray,
    fontFamily: Fonts.medium,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
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
});

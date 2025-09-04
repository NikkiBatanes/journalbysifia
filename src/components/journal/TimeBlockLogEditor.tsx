import React, { useRef, useEffect, useState, useImperativeHandle } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import TimeBlockCategoryModal from './TimeBlockCategoryModal';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Alert, ActivityIndicator, Modal } from 'react-native';

import { Pencil } from 'lucide-react-native';
import { triggerLightHaptic } from '../../utils/haptics';
import { Colors } from '../../theme/colors';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getCategoryIcon } from './TimeBlockCategories';

interface TimeBlockLogEditorProps {
  onSave: (data: {
    title: string;
    startTime: Date;
    endTime: Date;
    category: string;
    notes?: string;
    location?: string;
    isAllDay: boolean;
    date: Date;
    isEditing?: boolean;
    existingId?: string;
  }) => void;
  onCancel: () => void;
  initialContent?: string;
  subtaskTitle?: string;
  _subtaskId?: string;
  _stepId?: string;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  isLoading?: boolean;
  styles?: any;
  dateString?: string;
  // Existing time block data for editing
  existingTimeBlock?: {
    id?: string;
    title?: string;
    start_time?: string;
    end_time?: string;
    category?: string;
    description?: string;
    location?: string;
    all_day?: boolean;
  };
}

export interface TimeBlockLogEditorRef {
  focusInput: () => void;
}

// Styles matching other log editors
const defaultStyles = {
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  backgroundContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.anchorBlue,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 4,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 0,
    zIndex: 10,
    backgroundColor: Colors.hopeWhite,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.anchorBlue,
  },
  modeIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 4,
  },
  modeButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 0,
  },
  activeModeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  iconSeparator: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 0,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  contentCard: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  entryInput: {
    color: Colors.hopeWhite,
    fontSize: 18,
    marginBottom: 8,
  },
  titleInput: {
    fontWeight: 'bold',
    fontSize: 22,
    paddingVertical: 8,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  transparentInput: {},
  lockedTitleText: {
    color: Colors.hopeWhite,
    opacity: 0.9,
    includeFontPadding: false,
    textAlignVertical: 'center',
    marginBottom: 20,
    fontWeight: '700',
  },
  formContainer: {
    padding: 20,
  },
  inputLabel: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  formInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    color: Colors.hopeWhite,
    fontSize: 16,
    minHeight: 50,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  multilineInput: {
    minHeight: 120,
  },

  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeButton: {
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  timeLabel: {
    color: Colors.hopeWhite,
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  timeSeparator: {
    color: Colors.hopeWhite,
    fontSize: 14,
    marginHorizontal: 8,
    opacity: 0.6,
    fontWeight: '500',
  },
  timeSeparatorSmall: {
    fontSize: 10,
    color: Colors.hopeWhite,
  },
  repeatOptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  repeatTextWithMargin: {
    opacity: 0.7,
    marginRight: 8,
  },
  categoryContainer: {
    marginTop: 16,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  selectedCategoryButton: {
    // No background styling
  },
  categoryIcon: {
    marginRight: 8,
  },
  categoryText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '500',
  },
  allDayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  allDayText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  switchContainer: {
    padding: 4,
  },
  switchTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.hopeWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  metadataContainer: {
    marginTop: 32,
    marginBottom: 24,
    flexDirection: 'row',
  },
  verticalLine: {
    width: 1,
    backgroundColor: Colors.hopeWhite,
    opacity: 0.3,
    marginRight: 12,
    borderRadius: 2,
  },
  fromText: {
    fontSize: 8,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 4,
    letterSpacing: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  metadataText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 4,
    lineHeight: 12,
  },
  fabWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    pointerEvents: 'box-none',
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  addFab: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  cancelFab: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  saveFab: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
  },
  fabDisabled: {
    opacity: 0.4,
  },
  categoryButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  chevronIcon: {
    marginLeft: 'auto',
  },
  switchTrackActive: {
    backgroundColor: Colors.alertCoral,
  },
  switchTrackInactive: {
    backgroundColor: '#E0E0E0',
  },
  // FAB styles - matching reflection editor
  fabContainer: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8, // Add padding around the container
  },
  leftFabContainer: {
    left: 16,
  },
  rightFabContainer: {
    right: 16,
  },
  fabDefaultPosition: {
    bottom: 16,
  },
  fabRow: {
    flexDirection: 'row',
    gap: 16, // Increased spacing between FABs
  },

  addMenu: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  addMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  addMenuText: {
    color: Colors.hopeWhite,
    marginLeft: 8,
  },
  sectionLabel: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.8,
  },
  timeRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  timeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
  },
  repeatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  repeatText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '500',
  },
  timePickerModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  timePickerContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 20,
    padding: 20,
    margin: 20,
    alignItems: 'center',
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 20,
  },
  timePickerButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  timePickerButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  timePickerCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  timePickerConfirmButton: {
    backgroundColor: Colors.alertCoral,
  },
  timePickerButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  timePickerCancelText: {
    color: Colors.hopeWhite,
  },
  timePickerConfirmText: {
    color: Colors.hopeWhite,
  },
  repeatModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  repeatModalContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 20,
    padding: 20,
    margin: 20,
    minWidth: 280,
  },

  allDaySection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allDayLabel: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontWeight: '500',
    marginRight: 8,
  },
  customRepeatContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  customRepeatLabel: {
    color: Colors.hopeWhite,
    fontSize: 16,
    marginBottom: 12,
  },
  frequencySelector: {
    marginBottom: 16,
  },
  frequencyInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frequencyInput: {
    width: 50,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    padding: 8,
    color: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    textAlign: 'center',
    fontSize: 14,
    marginRight: 8,
  },
  frequencyUnitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  frequencyUnitText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    marginRight: 4,
  },
  customModalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'space-between',
  },
  customModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  customModalCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  customModalConfirmButton: {
    backgroundColor: Colors.primary,
  },
  customModalButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
};

const TimeBlockLogEditor = React.forwardRef<TimeBlockLogEditorRef, TimeBlockLogEditorProps>((
  {
    onSave,
    onCancel: _onCancel,
    initialContent: _initialContent = '',
    subtaskTitle: _subtaskTitle,
    _subtaskId,
    _stepId,
    playbookTitle,
    actionStepNumber,
    actionStepTitle,
    isLoading = false,
    styles,
    dateString, // kept for backward-compat but not used for header formatting
    existingTimeBlock,
  },
  ref
) => {
  const s = { ...defaultStyles, ...styles };
  const inputRef = useRef<TextInput>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Position cursor at the end of the text
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.setSelection(title.length, title.length);
          }
        }, 100);
      }
    },
  }));

  // State management
  const [title, setTitle] = React.useState(existingTimeBlock?.title || '');
  const [startTime, setStartTime] = React.useState(() => {
    if (existingTimeBlock?.start_time) {
      return new Date(existingTimeBlock.start_time);
    }
    return new Date();
  });
  const [endTime, setEndTime] = React.useState(() => {
    if (existingTimeBlock?.end_time) {
      return new Date(existingTimeBlock.end_time);
    }
    const end = new Date();
    end.setHours(end.getHours() + 1);
    return end;
  });
  const [category, setCategory] = React.useState(existingTimeBlock?.category || 'Others');
  const [notes, setNotes] = React.useState(existingTimeBlock?.description || '');
  const [location, setLocation] = React.useState(existingTimeBlock?.location || '');
  const [isAllDay, setIsAllDay] = React.useState(existingTimeBlock?.all_day || false);
  const [showStartTimePicker, setShowStartTimePicker] = React.useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = React.useState(false);
  const [repeatOption, setRepeatOption] = React.useState('Never');
  const [tempStartTime, setTempStartTime] = React.useState(startTime);
  const [tempEndTime, setTempEndTime] = React.useState(endTime);
  const [showAddMenu, setShowAddMenu] = React.useState(false);
  const [_hasUserMadeChanges, _setHasUserMadeChanges] = React.useState(false);
  const [_isFirstLoad, _setIsFirstLoad] = React.useState(true);

  // Tab management
  const [_activeTab, _setActiveTab] = React.useState<'quick' | 'detailed'>('quick');

  // Category modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Repeat modal state
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [showCustomRepeatModal, setShowCustomRepeatModal] = useState(false);
  const [customFrequency, setCustomFrequency] = useState({ value: 1, unit: 'week' });

  // Check if this is an edit session
  const isEditing = !!existingTimeBlock;

  // Sync temp time values when actual times change
  useEffect(() => {
    setTempStartTime(startTime);
  }, [startTime]);

  useEffect(() => {
    setTempEndTime(endTime);
  }, [endTime]);

  // Removed draft functionality

  // Removed draft saving functionality

  const handleSave = async () => {
    try {
      if (!title.trim()) {
        Alert.alert('Missing Title', 'Please enter a title for your time block.');
        return;
      }

      const metadata = formatMetadata();
      const notesWithMetadata = notes.trim() ?
        (metadata ? `${notes.trim()}\n\n${metadata}` : notes.trim()) :
        metadata;

      // If editing an existing time block, pass a flag to indicate it should be unmarked/deleted
      onSave({
        title: title.trim(),
        startTime,
        endTime,
        category,
        notes: notesWithMetadata,
        location: location.trim(),
        isAllDay,
        date: new Date(),
        isEditing: isEditing, // Pass editing state to parent
        existingId: existingTimeBlock?.id, // Pass existing ID for deletion/unmarking
      });
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'Failed to save time block. Please try again.');
    }
  };

  const onCancel = () => {
    _onCancel();
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatMetadata = (): string => {
    const metadata = [];
    if (playbookTitle || actionStepTitle || _subtaskTitle) {
      metadata.push('From Playbook');
      if (playbookTitle) {
        metadata.push(playbookTitle);
      }
      if (actionStepNumber && actionStepTitle) {
        metadata.push(`Step ${actionStepNumber}: ${actionStepTitle}`);
      }
      if (_subtaskTitle) {
        metadata.push(_subtaskTitle);
      }
    }
    return metadata.length > 0 ? metadata.join('\n') : '';
  };

  const handleContentChange = (field: string, value: any) => {
    _setHasUserMadeChanges(true);
    switch (field) {
      case 'title': setTitle(value); break;
      case 'notes': setNotes(value); break;
      case 'location': setLocation(value); break;
      case 'category': setCategory(value); break;
      case 'isAllDay': setIsAllDay(value); break;
      case 'startTime': setStartTime(value); break;
      case 'endTime': setEndTime(value); break;
      case 'repeat': setRepeatOption(value); break;
    }
  };

  // Header date: Day, Month Day (and Year only if not current year)
  const headerDate = React.useMemo(() => {
    // If a specific date needs to be shown in the future, wire it here.
    const d = new Date();
    const nowYear = new Date().getFullYear();
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    };
    if (d.getFullYear() !== nowYear) {
      opts.year = 'numeric';
    }
    return d.toLocaleDateString('en-US', opts);
  }, []);

  return (
    <View style={s.container}>

      <StatusBar hidden />
      <View style={s.backgroundContainer} />
      <View style={s.header}>
        <Text style={s.title}>{headerDate}</Text>
        <View style={s.modeToggle}>
          <TouchableOpacity style={s.modeButton}>
            <Pencil
              size={22}
              color={Colors.alertCoral}
              fill={Colors.alertCoral}
              strokeWidth={1.5}
            />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={s.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}>

        <View style={s.contentCard}>
          <ScrollView style={s.content} contentContainerStyle={s.scrollContent} scrollEnabled={false}>
            {/* Title section */}
            <Text style={[s.entryInput, s.titleInput, s.transparentInput, s.lockedTitleText]}>
              {_subtaskTitle || 'Time Block Entry'}
            </Text>

            {/* Form content based on active tab */}
            <View style={s.formContainer}>
              {/* Time and All Day Row */}
              <View style={s.timeRowContainer}>
                <View style={s.timeSection}>
                  {!isAllDay && (
                    <>
                      <TouchableOpacity
                        style={s.timeButton}
                        onPress={() => setShowStartTimePicker(true)}
                      >
                        <Text style={s.timeText}>{formatTime(startTime)}</Text>
                      </TouchableOpacity>

                      <Text style={[s.timeSeparator, s.timeSeparatorSmall]}>TO</Text>

                      <TouchableOpacity
                        style={s.timeButton}
                        onPress={() => setShowEndTimePicker(true)}
                      >
                        <Text style={s.timeText}>{formatTime(endTime)}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {isAllDay && (
                    <Text style={s.timeText}>All Day</Text>
                  )}
                </View>

                <View style={s.allDaySection}>
                  {!isAllDay && <Text style={s.allDayLabel}>All Day</Text>}
                  <TouchableOpacity
                    onPress={() => handleContentChange('isAllDay', !isAllDay)}
                    style={s.switchContainer}
                  >
                    <View style={[
                      s.switchTrack,
                      isAllDay ? s.switchTrackActive : s.switchTrackInactive,
                    ]}>
                      <View style={[
                        s.switchThumb,
                        { transform: [{ translateX: isAllDay ? 20 : 0 }] },
                      ]} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Title Input */}
              <TextInput
                ref={inputRef}
                style={s.formInput}
                placeholder="Title"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={title}
                onChangeText={(text) => handleContentChange('title', text)}
              />

              {/* Repeat Section */}
              <TouchableOpacity
                style={s.repeatButton}
                onPress={() => {
                  triggerLightHaptic();
                  setShowRepeatModal(true);
                }}
              >
                <Text style={s.repeatText}>Repeat</Text>
                <View style={s.repeatOptionContainer}>
                  <Text style={[s.repeatText, s.repeatTextWithMargin]}>{repeatOption}</Text>
                  <Ionicons name="chevron-down" size={18} color={Colors.hopeWhite} />
                </View>
              </TouchableOpacity>

              {/* Category Selection */}
              <TouchableOpacity
                style={[
                  s.categoryButton,
                  s.selectedCategoryButton,
                  s.categoryButtonRow,
                ]}
                onPress={() => setShowCategoryModal(true)}
                accessibilityLabel="Select Category"
              >
                <Ionicons
                  name={getCategoryIcon(category) as any}
                  size={16}
                  color={Colors.hopeWhite}
                  style={s.categoryIcon}
                />
                <Text style={s.categoryText}>{category}</Text>
                <Ionicons name="chevron-down" size={18} color={Colors.hopeWhite} style={s.chevronIcon} />
              </TouchableOpacity>

              <TimeBlockCategoryModal
                visible={showCategoryModal}
                selectedCategory={category}
                onSelect={(cat) => {
                  setShowCategoryModal(false);
                  handleContentChange('category', cat.name);
                }}
                onCancel={() => setShowCategoryModal(false)}
              />

              {/* Repeat Modal */}
              <Modal
                visible={showRepeatModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowRepeatModal(false)}
              >
                <View style={s.repeatModal}>
                  <View style={s.repeatModalContainer}>
                    <Text style={s.repeatModalTitle}>Repeat</Text>
                    {['Never', 'Daily', 'Weekly', 'Monthly', 'Custom'].map((option, index, array) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          s.repeatOption,
                          index === array.length - 1 && s.repeatOptionLast,
                          repeatOption === option && s.repeatOptionSelected,
                        ]}
                        onPress={async () => {
                          // Trigger haptic feedback first
                          await triggerLightHaptic();
                          
                          // Then handle the action
                          if (option === 'Custom') {
                            setShowRepeatModal(false);
                            setShowCustomRepeatModal(true);
                          } else {
                            handleContentChange('repeat', option);
                            setShowRepeatModal(false);
                          }
                        }}
                      >
                        <Text style={[
                          s.repeatOptionText,
                          repeatOption === option && s.repeatOptionSelectedText,
                        ]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </Modal>

              {/* Custom Repeat Modal */}
              <Modal
                visible={showCustomRepeatModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowCustomRepeatModal(false)}
              >
                <View style={s.repeatModal}>
                  <View style={s.repeatModalContainer}>
                    <Text style={s.repeatModalTitle}>Custom Repeat</Text>

                    <View style={s.customRepeatContainer}>
                      <Text style={s.customRepeatLabel}>Repeat every</Text>

                      <View style={s.frequencySelector}>
                        <View style={s.frequencyInputs}>
                          <TextInput
                            style={s.frequencyInput}
                            value={customFrequency.value.toString()}
                            onChangeText={(text) => {
                              const num = parseInt(text, 10) || 1;
                              setCustomFrequency({ ...customFrequency, value: num });
                            }}
                            keyboardType="numeric"
                            maxLength={2}
                            placeholderTextColor="rgba(255, 255, 255, 0.6)"
                          />

                          <TouchableOpacity
                            style={s.frequencyUnitButton}
                            onPress={() => {
                              const units = ['day', 'week', 'month', 'year'];
                              const currentIndex = units.indexOf(customFrequency.unit);
                              const nextIndex = (currentIndex + 1) % units.length;
                              setCustomFrequency({ ...customFrequency, unit: units[nextIndex] });
                            }}
                          >
                            <Text style={s.frequencyUnitText}>
                              {customFrequency.unit.charAt(0).toUpperCase() + customFrequency.unit.slice(1)}{customFrequency.value > 1 ? 's' : ''}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color={Colors.hopeWhite} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    <View style={s.customModalButtons}>
                      <TouchableOpacity
                        style={[s.customModalButton, s.customModalCancelButton]}
                        onPress={() => setShowCustomRepeatModal(false)}
                      >
                        <Text style={s.customModalButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.customModalButton, s.customModalConfirmButton]}
                        onPress={() => {
                          handleContentChange('repeat', `Every ${customFrequency.value} ${customFrequency.unit}${customFrequency.value > 1 ? 's' : ''}`);
                          setShowCustomRepeatModal(false);
                        }}
                      >
                        <Text style={s.customModalButtonText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>

              {/* Location Input */}
              <TextInput
                style={s.formInput}
                placeholder="Location"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={location}
                onChangeText={(text) => handleContentChange('location', text)}
              />

              {/* Notes Input */}
              <TextInput
                style={[s.formInput, s.multilineInput]}
                placeholder="Notes"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={notes}
                onChangeText={(text) => handleContentChange('notes', text)}
                multiline
                textAlignVertical="top"
              />

              {/* Metadata section */}
              {(playbookTitle || _subtaskTitle) && (
                <View style={s.metadataContainer}>
                  <View style={s.verticalLine} />
                  <View>
                    <Text style={s.fromText}>From Playbook</Text>
                    {playbookTitle && (
                      <Text style={s.metadataText}>{playbookTitle}</Text>
                    )}
                    {actionStepNumber && actionStepTitle && (
                      <Text style={s.metadataText}>
                        Step {actionStepNumber}: {actionStepTitle}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Start Time Picker Modal */}
      <Modal
        visible={showStartTimePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStartTimePicker(false)}
      >
        <View style={s.timePickerModal}>
          <View style={s.timePickerContainer}>
            <Text style={s.timePickerTitle}>Select Start Time</Text>
            <DateTimePicker
              value={tempStartTime}
              mode="time"
              is24Hour={false}
              display="spinner"
              onChange={(event, selectedTime) => {
                if (selectedTime) {
                  setTempStartTime(selectedTime);
                }
              }}
            />
            <View style={s.timePickerButtons}>
              <TouchableOpacity
                style={[s.timePickerButton, s.timePickerCancelButton]}
                onPress={() => {
                  setShowStartTimePicker(false);
                  setTempStartTime(startTime); // Reset to original
                }}
              >
                <Text style={[s.timePickerButtonText, s.timePickerCancelText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.timePickerButton, s.timePickerConfirmButton]}
                onPress={() => {
                  handleContentChange('startTime', tempStartTime);
                  // Auto-adjust end time to be 1 hour later
                  const newEndTime = new Date(tempStartTime);
                  newEndTime.setHours(newEndTime.getHours() + 1);
                  handleContentChange('endTime', newEndTime);
                  setTempEndTime(newEndTime);
                  setShowStartTimePicker(false);
                }}
              >
                <Text style={[s.timePickerButtonText, s.timePickerConfirmText]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Time Picker Modal */}
      <Modal
        visible={showEndTimePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEndTimePicker(false)}
      >
        <View style={s.timePickerModal}>
          <View style={s.timePickerContainer}>
            <Text style={s.timePickerTitle}>Select End Time</Text>
            <DateTimePicker
              value={tempEndTime}
              mode="time"
              is24Hour={false}
              display="spinner"
              onChange={(event, selectedTime) => {
                if (selectedTime) {
                  setTempEndTime(selectedTime);
                }
              }}
            />
            <View style={s.timePickerButtons}>
              <TouchableOpacity
                style={[s.timePickerButton, s.timePickerCancelButton]}
                onPress={() => {
                  setShowEndTimePicker(false);
                  setTempEndTime(endTime); // Reset to original
                }}
              >
                <Text style={[s.timePickerButtonText, s.timePickerCancelText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.timePickerButton, s.timePickerConfirmButton]}
                onPress={() => {
                  handleContentChange('endTime', tempEndTime);
                  setShowEndTimePicker(false);
                }}
              >
                <Text style={[s.timePickerButtonText, s.timePickerConfirmText]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Action Buttons - Standard Layout */}
      <View style={s.fabWrapper}>
        {/* Left Add FAB with Menu */}
        <View style={[s.fabContainer, s.leftFabContainer, s.fabDefaultPosition]}>
          {showAddMenu && (
            <View style={s.addMenu}>
              <TouchableOpacity style={s.addMenuItem}>
                <Ionicons name="pricetag" size={20} color={Colors.hopeWhite} />
                <Text style={s.addMenuText}>Tags</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.addMenuItem}>
                <Ionicons name="image" size={20} color={Colors.hopeWhite} />
                <Text style={s.addMenuText}>Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.addMenuItem}>
                <Ionicons name="camera" size={20} color={Colors.hopeWhite} />
                <Text style={s.addMenuText}>Camera</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={[s.fab, s.addFab]}
            onPress={() => setShowAddMenu(!showAddMenu)}
          >
            <Ionicons
              name={showAddMenu ? 'close' : 'add'}
              size={24}
              color="rgba(255, 255, 255, 0.6)"
            />
          </TouchableOpacity>
        </View>

        {/* Right Action Buttons */}
        <View style={[s.fabContainer, s.fabDefaultPosition, s.rightFabContainer]}>
          <View style={s.fabRow}>
            {/* Cancel FAB */}
            <TouchableOpacity
              style={[s.fab, s.cancelFab]}
              onPress={onCancel}
            >
              <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.6)" />
            </TouchableOpacity>

            {/* Save FAB */}
            <TouchableOpacity
              style={[
                s.fab,
                s.saveFab,
                (!title.trim() || isLoading) && s.fabDisabled,
              ]}
              disabled={!title.trim() || isLoading}
              onPress={handleSave}
            >
              {isLoading ? (
                <ActivityIndicator size={20} color={Colors.hopeWhite} />
              ) : (
                <Ionicons name="checkmark" size={20} color={Colors.hopeWhite} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

    </View>
  );
});

export default TimeBlockLogEditor;

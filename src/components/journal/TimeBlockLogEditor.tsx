import React, { useRef, useEffect, useCallback, useState } from 'react';
import TimeBlockCategoryModal from './TimeBlockCategoryModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Alert, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import DateTimePicker from '@react-native-community/datetimepicker';

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
  }) => void;
  onCancel: () => void;
  initialContent?: string;
  subtaskTitle?: string;
  subtaskId?: string;
  stepId?: string;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  isLoading?: boolean;
  styles?: any;
  dateString?: string;
}

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
  draftNotification: {
    position: 'absolute',
    top: 100,
    left: '50%',
    transform: [{ translateX: -100 }],
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    width: 200,
  },
  draftIcon: {
    marginRight: 8,
  },
  draftText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '500',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  timeButton: {
    flex: 1,
    alignItems: 'center',
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
    fontSize: 18,
    fontWeight: '600',
  },
  timeSeparator: {
    color: Colors.hopeWhite,
    fontSize: 14,
    marginHorizontal: 16,
    opacity: 0.6,
    fontWeight: '500',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  selectedCategoryButton: {
    backgroundColor: Colors.alertCoral,
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
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
    marginLeft: 8,
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
};

const TimeBlockLogEditor: React.FC<TimeBlockLogEditorProps> = ({
  onSave,
  onCancel: _onCancel,
  initialContent = '',
  subtaskTitle: _subtaskTitle,
  subtaskId,
  stepId,
  playbookTitle,
  actionStepNumber,
  actionStepTitle,
  isLoading = false,
  styles,
  dateString,
}) => {
  const s = { ...defaultStyles, ...styles };
  const inputRef = useRef<TextInput>(null);

  // State management
  const [title, setTitle] = React.useState(_subtaskTitle || '');
  const [startTime, setStartTime] = React.useState(new Date());
  const [endTime, setEndTime] = React.useState(() => {
    const end = new Date();
    end.setHours(end.getHours() + 1);
    return end;
  });
  const [category, setCategory] = React.useState('Others');
  const [notes, setNotes] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [isAllDay, setIsAllDay] = React.useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = React.useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = React.useState(false);
  const [showAddMenu, setShowAddMenu] = React.useState(false);
  const [hasUserMadeChanges, setHasUserMadeChanges] = React.useState(false);
  const [isFirstLoad, setIsFirstLoad] = React.useState(true);
  const [showDraftNotification, setShowDraftNotification] = React.useState(false);

  // Tab management
  const [activeTab, setActiveTab] = React.useState<'quick' | 'detailed'>('quick');

  // Category modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Check if this is an edit session
  const isEditing = !!(initialContent && initialContent.trim());

  // Helper function to get unique draft key
  const getDraftKey = React.useCallback(() => {
    const currentDate = new Date().toISOString().split('T')[0];
    if (subtaskId && stepId) {
      return `@timeblock_editor_draft_${stepId}_${subtaskId}_${currentDate}`;
    }
    if (_subtaskTitle && playbookTitle) {
      const playbookName = playbookTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const stepNum = actionStepNumber || 0;
      const taskTitle = _subtaskTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      return `@timeblock_editor_draft_playbook_${playbookName}_step${stepNum}_${taskTitle}_${currentDate}`;
    }
    return `@timeblock_editor_draft_${currentDate}`;
  }, [subtaskId, stepId, _subtaskTitle, playbookTitle, actionStepNumber]);

  // Load draft when component mounts
  useEffect(() => {
    if (isFirstLoad && !isEditing) {
      const loadDraft = async () => {
        try {
          const draftKey = getDraftKey();
          const draft = await AsyncStorage.getItem(draftKey);
          if (draft) {
            const draftData = JSON.parse(draft);
            if (draftData.title) {setTitle(draftData.title);}
            if (draftData.notes) {setNotes(draftData.notes);}
            if (draftData.location) {setLocation(draftData.location);}
            if (draftData.category) {setCategory(draftData.category);}
            if (draftData.isAllDay !== undefined) {setIsAllDay(draftData.isAllDay);}
            if (draftData.startTime) {setStartTime(new Date(draftData.startTime));}
            if (draftData.endTime) {setEndTime(new Date(draftData.endTime));}
            if (draftData.activeTab) {setActiveTab(draftData.activeTab);}

            setShowDraftNotification(true);
            setTimeout(() => setShowDraftNotification(false), 3000);
          }
        } catch (error) {
          console.error('Error loading draft:', error);
        }
      };
      loadDraft();
    }
    setIsFirstLoad(false);
  }, [getDraftKey, isEditing, isFirstLoad]);

  // Helper function to save draft
  const saveDraftHelper = useCallback(async () => {
    try {
      const hasContent = !!(title.trim() || notes.trim() || location.trim());
      if (hasContent) {
        const draftData = {
          title,
          notes,
          location,
          category,
          isAllDay,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          activeTab,
          timestamp: new Date().toISOString(),
          subtaskTitle: _subtaskTitle,
          playbookTitle,
          actionStepNumber,
        };
        await AsyncStorage.setItem(getDraftKey(), JSON.stringify(draftData));
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [title, notes, location, category, isAllDay, startTime, endTime, activeTab, _subtaskTitle, playbookTitle, actionStepNumber, getDraftKey]);

  // Auto-save draft when content changes
  useEffect(() => {
    if (!isFirstLoad && hasUserMadeChanges && !isEditing) {
      const timeoutId = setTimeout(saveDraftHelper, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [title, notes, location, category, isAllDay, startTime, endTime, isFirstLoad, hasUserMadeChanges, isEditing, saveDraftHelper]);

  const handleSave = async () => {
    try {
      // Clear draft
      try {
        await AsyncStorage.removeItem(getDraftKey());
      } catch (error) {
        console.error('Error clearing draft:', error);
      }

      if (!title.trim()) {
        Alert.alert('Missing Title', 'Please enter a title for your time block.');
        return;
      }

      onSave({
        title: title.trim(),
        startTime,
        endTime,
        category,
        notes: notes.trim(),
        location: location.trim(),
        isAllDay,
        date: new Date(),
      });
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'Failed to save time block. Please try again.');
    }
  };

  const onCancel = async () => {
    try {
      if (hasUserMadeChanges && !isEditing) {
        await saveDraftHelper();
      }
      _onCancel();
    } catch (error) {
      console.error('Error saving draft before cancel:', error);
      _onCancel();
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleContentChange = (field: string, value: any) => {
    setHasUserMadeChanges(true);
    switch (field) {
      case 'title': setTitle(value); break;
      case 'notes': setNotes(value); break;
      case 'location': setLocation(value); break;
      case 'category': setCategory(value); break;
      case 'isAllDay': setIsAllDay(value); break;
      case 'startTime': setStartTime(value); break;
      case 'endTime': setEndTime(value); break;
    }
  };

  return (
    <View style={s.container}>
      {showDraftNotification && (
        <View style={s.draftNotification}>
          <Ionicons name="time-outline" size={20} color={Colors.hopeWhite} style={s.draftIcon} />
          <Text style={s.draftText}>Draft Restored</Text>
        </View>
      )}
      <StatusBar hidden />
      <View style={s.backgroundContainer} />
      <View style={s.header}>
        <Text style={s.title}>{dateString?.replace(/,\s*\d{4}$/, '')}</Text>
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
          <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
            {/* Title section */}
            <Text style={[s.entryInput, s.titleInput, s.transparentInput, s.lockedTitleText]}>
              {_subtaskTitle || 'Time Block Entry'}
            </Text>

            {/* Form content based on active tab */}
            <View style={s.formContainer}>
              {/* Title Input */}
              <TextInput
                ref={inputRef}
                style={s.formInput}
                placeholder="Title"
                placeholderTextColor="rgba(46, 82, 149, 0.5)"
                value={title}
                onChangeText={(text) => handleContentChange('title', text)}
              />

              {/* Time Selection */}
              {!isAllDay && (
                <View style={s.timeContainer}>
                  <TouchableOpacity
                    style={s.timeButton}
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <Text style={s.timeText}>{formatTime(startTime)}</Text>
                  </TouchableOpacity>

                  <Text style={s.timeSeparator}>TO</Text>

                  <TouchableOpacity
                    style={s.timeButton}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <Text style={s.timeText}>{formatTime(endTime)}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* All Day Toggle */}
              <View style={s.allDayContainer}>
                <Text style={s.allDayText}>All Day</Text>
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

              {/* Category Selection */}
              <Text style={s.inputLabel}>Category</Text>
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
                  name={CATEGORIES.find((cat) => cat.name === category)?.icon as any}
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

              {/* Location Input */}
              <TextInput
                style={s.formInput}
                placeholder="Location"
                placeholderTextColor="rgba(46, 82, 149, 0.5)"
                value={location}
                onChangeText={(text) => handleContentChange('location', text)}
              />

              {/* Notes Input */}
              <TextInput
                style={[s.formInput, s.multilineInput]}
                placeholder="Notes"
                placeholderTextColor="rgba(46, 82, 149, 0.5)"
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
                    <Text style={s.fromText}>FROM PLAYBOOK</Text>
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

      {/* Time Pickers */}
      {showStartTimePicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={(event, selectedTime) => {
            setShowStartTimePicker(false);
            if (selectedTime) {
              handleContentChange('startTime', selectedTime);
              // Auto-adjust end time to be 1 hour later
              const newEndTime = new Date(selectedTime);
              newEndTime.setHours(newEndTime.getHours() + 1);
              handleContentChange('endTime', newEndTime);
            }
          }}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={endTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={(event, selectedTime) => {
            setShowEndTimePicker(false);
            if (selectedTime) {
              handleContentChange('endTime', selectedTime);
            }
          }}
        />
      )}

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
};

export default TimeBlockLogEditor;

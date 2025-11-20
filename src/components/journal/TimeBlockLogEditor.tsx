import React, { useRef, useEffect, useState, useImperativeHandle, useMemo } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { Pencil } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
// import { toLocalDateString } from '../../utils/date'; // Unused
import { triggerLightHaptic } from '../../utils/haptics';
import ThemedText from '../common/ThemedText';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getCategoryIcon } from './TimeBlockCategories';
import TimeBlockCategoryModal from './TimeBlockCategoryModal';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import { LocationSelector } from '../LocationSelector';
import { useSmartJournalingGating } from '../../hooks/useSmartJournalingGating';
import { useNavigation } from '@react-navigation/native';
import { useSubscription } from '../../hooks/useSubscription';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

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
    alert?: 'none' | 'at-time' | '5-min' | '10-min' | '15-min' | '30-min' | '1-hour' | '2-hours' | '1-day' | '2-days' | '1-week';
    // Repeat information to mirror journal TimeBlock component
    repeatFrequency?: 'never' | 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'yearly' | 'custom';
    repeatEndDate?: Date | null;
    repeatCustomDays?: number[]; // 0-6 (Sun-Sat)
    repeatCustomFrequency?: { value: number; unit: 'day' | 'week' | 'month' | 'year' } | null;
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
    alert?: 'none' | 'at-time' | '5-min' | '10-min' | '15-min' | '30-min' | '1-hour' | '2-hours' | '1-day' | '2-days' | '1-week';
  };
}

export interface TimeBlockLogEditorRef {
  focusInput: () => void;
}

// Styles matching other log editors
const createDefaultStyles = (fonts: any) => ({
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
    // Typography handled by ThemedText weight="bold"
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
    // Typography handled by ThemedText weight="bold"
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
    // fontWeight handled by ThemedText weight="bold",
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleTextFlex: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  inputLabel: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: fonts.semiBold,
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
  locationInputContainer: {
    marginBottom: 12,
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
    fontFamily: fonts.semiBold,
  },
  timeSeparator: {
    color: Colors.hopeWhite,
    fontSize: 14,
    marginHorizontal: 8,
    opacity: 0.6,
    fontFamily: fonts.medium,
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
    fontFamily: fonts.medium,
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
    fontFamily: fonts.semiBold,
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
    fontFamily: fonts.medium,
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
    fontFamily: fonts.medium,
    marginLeft: 8,
  },
  sectionLabel: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontFamily: fonts.semiBold,
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
    fontFamily: fonts.medium,
  },
  timePickerModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  timePickerContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 30,
    padding: 20,
    margin: 20,
    alignItems: 'center',
  },
  timePickerTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
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
    fontFamily: fonts.medium,
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
    borderRadius: 30,
    padding: 30,
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
    fontFamily: fonts.medium,
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
    backgroundColor: Colors.anchorBlue,
  },
  customModalButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  repeatModalTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 20,
  },
  repeatOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  repeatOptionLast: {
  },
  repeatOptionSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  repeatOptionText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  repeatOptionSelectedText: {
    fontFamily: fonts.semiBold,
  },
  customRepeatLabel: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: fonts.medium,
    marginBottom: 12,
  },
  frequencyUnitText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontFamily: fonts.medium,
    marginRight: 4,
  },
  endRepeatContainer: {
    marginTop: 8,
  },
  endRepeatRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  endRepeatButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  endRepeatButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: Colors.anchorBlue,
  },
  endRepeatButtonText: {
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  marginTop12: {
    marginTop: 12,
  },
  daySelectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  dayButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dayButtonText: {
    color: Colors.hopeWhite,
  },
});

function TimeBlockLogEditorInner(
  props: TimeBlockLogEditorProps,
  ref: React.Ref<TimeBlockLogEditorRef>
) {
  const {
    onSave,
    onCancel: _onCancel,
    subtaskTitle: _subtaskTitle,
    playbookTitle,
    actionStepNumber,
    actionStepTitle,
    isLoading = false,
    styles,
    existingTimeBlock,
    // Unused props: initialContent, _subtaskId, _stepId, dateString
  } = props;
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const navigation = useNavigation();
  const { subscription } = useSubscription();
  const smartJournalingGating = useSmartJournalingGating();

  const fonts = useMemo(() => {
    return {
      regular: getFontFamily(fontKey, 'regular'),
      medium: getFontFamily(fontKey, 'medium'),
      semiBold: getFontFamily(fontKey, 'semiBold'),
      bold: getFontFamily(fontKey, 'bold'),
    };
  }, [fontKey]);

  const s = useMemo(() => ({ ...createDefaultStyles(fonts), ...styles }), [fonts, styles]);
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
  const [category, setCategory] = React.useState(existingTimeBlock?.category || 'Select a category');
  const [notes, setNotes] = React.useState(existingTimeBlock?.description || '');
  const [location, setLocation] = React.useState(existingTimeBlock?.location || '');
  const [isAllDay, setIsAllDay] = React.useState(existingTimeBlock?.all_day || false);
  const [alert, setAlert] = React.useState<'none' | 'at-time' | '5-min' | '10-min' | '15-min' | '30-min' | '1-hour' | '2-hours' | '1-day' | '2-days' | '1-week'>(existingTimeBlock?.alert || 'none');
  const [showAlertModal, setShowAlertModal] = React.useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = React.useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = React.useState(false);
  const [repeatOption, setRepeatOption] = React.useState('Never');
  const [tempStartTime, setTempStartTime] = React.useState(startTime);
  const [tempEndTime, setTempEndTime] = React.useState(endTime);
  // Commenting out add menu for MVP; keep state preserving future functionality
  // const [showAddMenu, setShowAddMenu] = React.useState(false);

  // Category modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Repeat modal state
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [showCustomRepeatModal, setShowCustomRepeatModal] = useState(false);
  const [customFrequency, setCustomFrequency] = useState<{ value: number; unit: 'day' | 'week' | 'month' | 'year' }>({ value: 1, unit: 'week' });
  const [customDays, setCustomDays] = useState<number[]>([]); // For weekly custom selection
  const [endRepeatMode, setEndRepeatMode] = useState<'never' | 'date'>('never');
  const [endRepeatDate, setEndRepeatDate] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

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
      // Check if feature is gated for seeker accounts
      if (smartJournalingGating.isLocked) {
        try { triggerLightHaptic(); } catch {}
        // Navigate to sales offer with trial eligibility check
        (navigation as any).navigate('OnboardingSalesOffer', {
          source: 'smart_journaling_lock',
          feature: 'smart_journaling',
          tier: subscription?.tier || 'seeker',
          upgradeMode: false,
          skipNotificationPreference: true,
        });
        return;
      }

      if (!title.trim()) {
        Alert.alert('Missing Title', 'Please enter a title for your time block.');
        return;
      }

      // Format notes with metadata (TODO: implement formatMetadata function)
      const notesWithMetadata = notes.trim();

      // If editing an existing time block, pass a flag to indicate it should be unmarked/deleted
      onSave({
        title: title.trim(),
        startTime,
        endTime,
        category,
        notes: notesWithMetadata,
        location: location.trim(),
        isAllDay,
        alert,
        date: new Date(),
        // Provide repeat info mirroring journal screen
        repeatFrequency: ((): any => {
          const lower = repeatOption.toLowerCase();
          if (lower === 'never') {return 'never';}
          if (lower === 'daily') {return 'daily';}
          if (lower === 'weekly') {return 'weekly';}
          if (lower === 'bi-weekly' || lower === 'biweekly') {return 'biweekly';}
          if (lower === 'monthly') {return 'monthly';}
          if (lower === 'yearly') {return 'yearly';}
          return 'custom';
        })(),
        repeatEndDate: endRepeatMode === 'date' ? endRepeatDate : null,
        repeatCustomDays: customFrequency.unit === 'week' ? customDays : undefined,
        repeatCustomFrequency: repeatOption === 'Custom' ? { value: customFrequency.value, unit: customFrequency.unit } : null,
        isEditing: isEditing, // Pass editing state to parent
        existingId: existingTimeBlock?.id, // Pass existing ID for deletion/unmarking
      });
    } catch (error) {
      Logger.error('Error in handleSave', error as Error, { component: 'TimeBlockLogEditor' });
      Alert.alert('Error', 'Failed to save time block. Please try again.');
    }
  };

  const onCancel = () => {
    _onCancel();
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleContentChange = (field: string, value: any) => {
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
        <ThemedText weight="bold" style={s.title}>{headerDate}</ThemedText>
        <View style={s.modeToggle}>
          <View style={s.modeButton} pointerEvents="none">
            <Pencil
              size={22}
              color={Colors.alertCoral}
              fill={Colors.alertCoral}
              strokeWidth={1.5}
            />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={s.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        enabled={Platform.OS === 'ios'}>

        <View style={s.contentCard}>
          <ScrollView
            style={s.content}
            contentContainerStyle={s.scrollContent}
            scrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title section with lock icon */}
            <View style={s.titleRow}>
              <ThemedText weight="bold" style={[s.entryInput, s.titleInput, s.transparentInput, s.lockedTitleText, s.titleTextFlex]}>
                {_subtaskTitle || 'Time Block Entry'}
              </ThemedText>
              {smartJournalingGating.isLocked && (
                <TouchableOpacity
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    (navigation as any).navigate('OnboardingSalesOffer', {
                      source: 'smart_journaling_lock',
                      feature: 'smart_journaling',
                      tier: subscription?.tier || 'seeker',
                      upgradeMode: false,
                      skipNotificationPreference: true,
                    });
                  }}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <MaterialCommunityIcons name="lock" size={20} color={Colors.alertCoral} />
                </TouchableOpacity>
              )}
            </View>

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
                        <ThemedText weight="semiBold" style={s.timeText}>{formatTime(startTime)}</ThemedText>
                      </TouchableOpacity>

                      <ThemedText weight="medium" style={[s.timeSeparator, s.timeSeparatorSmall]}>TO</ThemedText>

                      <TouchableOpacity
                        style={s.timeButton}
                        onPress={() => setShowEndTimePicker(true)}
                      >
                        <ThemedText weight="semiBold" style={s.timeText}>{formatTime(endTime)}</ThemedText>
                      </TouchableOpacity>
                    </>
                  )}
                  {isAllDay && (
                    <ThemedText weight="semiBold" style={s.timeText}>All Day</ThemedText>
                  )}
                </View>

                <View style={s.allDaySection}>
                  {!isAllDay && <ThemedText weight="medium" style={s.allDayLabel}>All Day</ThemedText>}
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
                style={[s.formInput, { fontFamily: fonts.regular }]}
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
                <ThemedText weight="medium" style={s.repeatText}>Repeat</ThemedText>
                <View style={s.repeatOptionContainer}>
                  <ThemedText weight="medium" style={[s.repeatText, s.repeatTextWithMargin]}>{repeatOption}</ThemedText>
                  <Ionicons name="chevron-down" size={18} color={Colors.hopeWhite} />
                </View>
              </TouchableOpacity>

              {/* End Repeat Section - Below Repeat in main form */}
              {repeatOption !== 'Never' && (
                <View style={s.endRepeatContainer}>
                  <ThemedText weight="medium" style={s.inputLabel}>End Repeat</ThemedText>
                  <View style={s.endRepeatRow}>
                    <TouchableOpacity
                      onPress={() => { setEndRepeatMode('never'); setEndRepeatDate(null); }}
                      style={[
                        s.endRepeatButton,
                        endRepeatMode === 'never' && s.endRepeatButtonActive,
                      ]}
                    >
                      <ThemedText weight="medium" style={s.endRepeatButtonText}>Never</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setShowEndDatePicker(true); }}
                      style={[
                        s.endRepeatButton,
                        (endRepeatMode === 'date' && endRepeatDate) && s.endRepeatButtonActive,
                      ]}
                    >
                      <ThemedText weight="medium" style={s.endRepeatButtonText}>
                        {endRepeatDate ? endRepeatDate.toLocaleDateString() : 'Select End Date'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Alert Section */}
              <TouchableOpacity
                style={s.repeatButton}
                onPress={() => {
                  triggerLightHaptic();
                  setShowAlertModal(true);
                }}
              >
                <ThemedText weight="medium" style={s.repeatText}>Alert</ThemedText>
                <View style={s.repeatOptionContainer}>
                  <ThemedText weight="medium" style={[s.repeatText, s.repeatTextWithMargin]}>
                    {alert === 'none' ? 'None' :
                     alert === 'at-time' ? 'At time of event' :
                     alert === '5-min' ? '5 minutes before' :
                     alert === '10-min' ? '10 minutes before' :
                 alert === '15-min' ? '15 minutes before' :
                     alert === '30-min' ? '30 minutes before' :
                     alert === '1-hour' ? '1 hour before' :
                     alert === '2-hours' ? '2 hours before' :
                     alert === '1-day' ? '1 day before' :
                     alert === '2-days' ? '2 days before' :
                     alert === '1-week' ? '1 week before' : 'None'}
                  </ThemedText>
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
                <ThemedText weight="medium" style={s.categoryText}>{category}</ThemedText>
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
                    <ThemedText weight="semiBold" style={s.repeatModalTitle}>Repeat</ThemedText>
                    {['Never', 'Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Yearly', 'Custom'].map((option, index, array) => (
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
                            setRepeatOption(option);
                            setShowRepeatModal(false);
                          }
                        }}
                      >
                        <ThemedText weight="medium" style={[
                          s.repeatOptionText,
                          repeatOption === option && s.repeatOptionSelectedText,
                        ]}>
                          {option}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}

                  </View>
                </View>
              </Modal>

              {/* Alert Modal */}
              <Modal
                visible={showAlertModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowAlertModal(false)}
              >
                <View style={s.repeatModal}>
                  <View style={s.repeatModalContainer}>
                    <ThemedText weight="semiBold" style={s.repeatModalTitle}>Alert</ThemedText>
                    {[
                      { value: 'none', label: 'None' },
                      { value: 'at-time', label: 'At time of event' },
                      { value: '5-min', label: '5 minutes before' },
                      { value: '10-min', label: '10 minutes before' },
                      { value: '15-min', label: '15 minutes before' },
                      { value: '30-min', label: '30 minutes before' },
                      { value: '1-hour', label: '1 hour before' },
                      { value: '2-hours', label: '2 hours before' },
                      { value: '1-day', label: '1 day before' },
                      { value: '2-days', label: '2 days before' },
                      { value: '1-week', label: '1 week before' },
                    ].map((option, index, array) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          s.repeatOption,
                          index === array.length - 1 && s.repeatOptionLast,
                          alert === option.value && s.repeatOptionSelected,
                        ]}
                        onPress={async () => {
                          await triggerLightHaptic();
                          setAlert(option.value as any);
                          setShowAlertModal(false);
                        }}
                      >
                        <ThemedText weight="medium" style={[
                          s.repeatOptionText,
                          alert === option.value && s.repeatOptionSelectedText,
                        ]}>
                          {option.label}
                        </ThemedText>
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
                    <ThemedText weight="semiBold" style={s.repeatModalTitle}>Custom Repeat</ThemedText>

                    <View style={s.customRepeatContainer}>
                      <ThemedText weight="medium" style={s.customRepeatLabel}>Repeat every</ThemedText>

                      <View style={s.frequencySelector}>
                        <View style={s.frequencyInputs}>
                          <TextInput
                            style={[s.frequencyInput, { fontFamily: fonts.regular }]}
                            value={customFrequency.value.toString()}
                            onChangeText={(text) => {
                              const num = parseInt(text, 10) || 1;
                              setCustomFrequency({ ...customFrequency, value: Math.max(1, num) });
                            }}
                            keyboardType="numeric"
                            maxLength={2}
                            placeholderTextColor="rgba(255, 255, 255, 0.6)"
                          />

                          <TouchableOpacity
                            style={s.frequencyUnitButton}
                            onPress={async () => {
                              await triggerLightHaptic();
                              const units: Array<'day'|'week'|'month'|'year'> = ['day', 'week', 'month', 'year'];
                              const currentIndex = units.indexOf(customFrequency.unit);
                              const nextIndex = (currentIndex + 1) % units.length;
                              const nextUnit = units[nextIndex];
                              setCustomFrequency({ ...customFrequency, unit: nextUnit });
                              if (nextUnit !== 'week') { setCustomDays([]); }
                            }}
                          >
                            <ThemedText weight="medium" style={s.frequencyUnitText}>
                              {customFrequency.unit.charAt(0).toUpperCase() + customFrequency.unit.slice(1)}{customFrequency.value > 1 ? 's' : ''}
                            </ThemedText>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {customFrequency.unit === 'week' && (
                        <View style={s.marginTop12}>
                          <ThemedText weight="medium" style={s.customRepeatLabel}>On days:</ThemedText>
                          <View style={s.daySelectionRow}>
                            {['S','M','T','W','T','F','S'].map((label, idx) => (
                              <TouchableOpacity
                                key={idx}
                                onPress={async () => {
                                  await triggerLightHaptic();
                                  setCustomDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]);
                                }}
                                style={[
                                  s.dayButton,
                                  customDays.includes(idx) && s.dayButtonActive,
                                ]}
                              >
                                <ThemedText weight="medium" style={s.dayButtonText}>{label}</ThemedText>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}

                    </View>

                    <View style={s.customModalButtons}>
                      <TouchableOpacity
                        style={[s.customModalButton, s.customModalCancelButton]}
                        onPress={async () => {
                          await triggerLightHaptic();
                          setShowCustomRepeatModal(false);
                        }}
                      >
                        <ThemedText weight="semiBold" style={s.customModalButtonText}>Cancel</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.customModalButton, s.customModalConfirmButton]}
                        onPress={async () => {
                          await triggerLightHaptic();
                          const unitLabel = customFrequency.unit.charAt(0).toUpperCase() + customFrequency.unit.slice(1) + (customFrequency.value > 1 ? 's' : '');
                          let label = `Every ${customFrequency.value} ${unitLabel}`;
                          if (customFrequency.unit === 'week' && customDays.length > 0) {
                            const dayNames = ['S','M','T','W','T','F','S'];
                            label += ` on ${customDays.sort().map(d => dayNames[d]).join(', ')}`;
                          }
                          if (endRepeatMode === 'date' && endRepeatDate) {
                            label += ` until ${endRepeatDate.toLocaleDateString()}`;
                          }
                          handleContentChange('repeat', label);
                          setShowCustomRepeatModal(false);
                        }}
                      >
                        <ThemedText weight="semiBold" style={s.customModalButtonText}>Done</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>

              {/* End Date Picker Modal for Custom Repeat */}
              <Modal
                visible={showEndDatePicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowEndDatePicker(false)}
              >
                <View style={s.timePickerModal}>
                  <View style={s.timePickerContainer}>
                    <ThemedText weight="semiBold" style={s.timePickerTitle}>Select End Date</ThemedText>
                    <DateTimePicker
                      value={endRepeatDate || new Date()}
                      mode="date"
                      display="spinner"
                      textColor={Colors.hopeWhite}
                      themeVariant="dark"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setEndRepeatDate(selectedDate);
                        }
                      }}
                    />
                    <View style={s.timePickerButtons}>
                      <TouchableOpacity
                        style={[s.timePickerButton, s.timePickerCancelButton]}
                        onPress={async () => {
                          await triggerLightHaptic();
                          setShowEndDatePicker(false);
                        }}
                      >
                        <Text style={[s.timePickerButtonText, s.timePickerCancelText]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.timePickerButton, s.timePickerConfirmButton]}
                        onPress={async () => {
                          await triggerLightHaptic();
                          setEndRepeatMode('date');
                          setShowEndDatePicker(false);
                        }}
                      >
                        <Text style={[s.timePickerButtonText, s.timePickerConfirmText]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>

              {/* Location Input */}
              <View style={s.locationInputContainer}>
                <LocationSelector
                  currentLocation={location}
                  onLocationSelect={(loc) => handleContentChange('location', loc)}
                  placeholder="Add location"
                />
              </View>

              {/* Notes Input */}
              <TextInput
                style={[s.formInput, s.multilineInput, { fontFamily: fonts.regular }]}
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
                    <ThemedText weight="medium" style={s.fromText}>From Playbook</ThemedText>
                    {playbookTitle && (
                      <ThemedText style={s.metadataText}>{playbookTitle}</ThemedText>
                    )}
                    {actionStepNumber && actionStepTitle && (
                      <ThemedText style={s.metadataText}>
                        Step {actionStepNumber}: {actionStepTitle}
                      </ThemedText>
                    )}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>

        {/* Floating Action Buttons - Standard Layout */}
        <View style={s.fabWrapper}>
          {/* Right Action Buttons */}
          <View style={[s.fabContainer, s.rightFabContainer, s.fabDefaultPosition]}>
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
            <ThemedText weight="semiBold" style={s.timePickerTitle}>Select Start Time</ThemedText>
            <DateTimePicker
              value={tempStartTime}
              mode="time"
              is24Hour={false}
              display="spinner"
              themeVariant="dark"
              textColor={Colors.hopeWhite}
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
            <ThemedText weight="semiBold" style={s.timePickerTitle}>Select End Time</ThemedText>
            <DateTimePicker
              value={tempEndTime}
              mode="time"
              is24Hour={false}
              display="spinner"
              themeVariant="dark"
              textColor={Colors.hopeWhite}
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

    </View>
  );
}

const TimeBlockLogEditor = React.forwardRef(TimeBlockLogEditorInner);

export default TimeBlockLogEditor;

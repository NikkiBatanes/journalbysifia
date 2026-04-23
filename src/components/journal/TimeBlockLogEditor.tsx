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
  Keyboard,
  Animated,
} from 'react-native';

import { Colors, Fonts } from '../../theme';
// import { toLocalDateString } from '../../utils/date'; // Unused
import { triggerLightHaptic } from '../../utils/haptics';
import ThemedText from '../common/ThemedText';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getCategoryIcon } from './TimeBlockCategories';
import TimeBlockCategoryModal from './TimeBlockCategoryModal';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import { LocationSelector } from '../LocationSelector';
import { useNavigation } from '@react-navigation/native';
import { useSubscription } from '../../hooks/useSubscription';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/IndustryStandardAuthContext';

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
    alarmMinutes?: number; // Minutes before event for calendar sync
    // Repeat information to mirror journal TimeBlock component
    repeatFrequency?: 'never' | 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'yearly' | 'custom';
    repeatEndDate?: Date | null;
    repeatCustomDays?: number[]; // 0-6 (Sun-Sat)
    repeatCustomFrequency?: { value: number; unit: 'day' | 'week' | 'month' | 'year' } | null;
    isEditing?: boolean;
    existingId?: string;
  }) => void;
  onCancel: () => void;
  onUpgradeRequired?: () => void; // Callback to close modal before navigating to upgrade
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
  // Context to determine title/subtext: 'journal' for general journal, 'faithful-actions' for playbook action steps
  context?: 'journal' | 'faithful-actions';
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

// Styles matching app design (PlaybookListScreen & PlaybookWalkthroughScreen)
const createDefaultStyles = (fonts: any) => ({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  keyboardAvoidingView: {
    flex: 1,
    overflow: 'visible',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    overflow: 'visible',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  entryInput: {
    color: Colors.hopeWhite,
    fontSize: 18,
    marginBottom: 8,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: 'bold',
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
    marginBottom: 0,
  },
  subtext: {
    color: Colors.hopeWhite,
    opacity: 0.6,
    fontSize: 14,
    fontFamily: Fonts.regular,
    includeFontPadding: false,
    textAlignVertical: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 48,
    width: 320,
    alignSelf: 'center',
  },
  titleTextFlex: {
    flex: 1,
  },
  formContainer: {
    padding: 0,
    width: 320,
    alignSelf: 'center',
    overflow: 'visible',
  },
  inputLabel: {
    color: Colors.hopeWhite,
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    marginBottom: 8,
    marginTop: 16,
    opacity: 0.6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  allDayLabel: {
    color: Colors.hopeWhite,
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    marginBottom: 0,
    marginTop: 0,
    marginRight: 8,
    opacity: 0.6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  formInput: {
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: Fonts.regular,
    minHeight: 40,
    marginBottom: 16,
    width: '100%',
  },
  multilineInput: {
    minHeight: 100,
    borderRadius: 16,
    paddingTop: 10,
  },
  locationInputContainer: {
    marginBottom: 16,
    overflow: 'visible',
  },

  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeButton: {
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  timeLabel: {
    color: Colors.hopeWhite,
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    marginBottom: 8,
    marginTop: 16,
    opacity: 0.6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  timeText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
  timeSeparator: {
    color: Colors.hopeWhite,
    fontSize: 14,
    marginHorizontal: 8,
    opacity: 0.6,
    fontFamily: Fonts.medium,
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
    marginRight: 8,
  },
  selectedOptionText: {
    color: Colors.alertCoral,
  },
  categoryContainer: {
    marginTop: 0,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    minHeight: 40,
    width: '100%',
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
    fontFamily: Fonts.semiBold,
    flex: 1,
  },
  categoryTextRequired: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  allDayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  allDayText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontFamily: Fonts.semiBold,
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
    fontFamily: Fonts.medium,
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
    width: 42,
    height: 42,
    borderRadius: 21,
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
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
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
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    paddingRight: 16,
  },
  leftFabContainer: {
    left: 16,
  },
  rightFabContainer: {
    right: 16,
  },
  fabDefaultPosition: {
    bottom: 350,
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
    fontFamily: Fonts.medium,
    marginLeft: 8,
  },
  sectionLabel: {
    color: Colors.hopeWhite,
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    marginBottom: 8,
    opacity: 0.6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  timeRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    minHeight: 40,
    width: '100%',
  },
  repeatText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  notesIcon: {
    marginRight: 12,
    marginTop: 10,
  },
  notesInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  notesInputIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  notesInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 20,
    minHeight: 100,
    paddingTop: 0,
    textAlignVertical: 'top',
    fontFamily: Fonts.medium,
  },
  titleInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    minHeight: 40,
  },
  titleInputIcon: {
    marginRight: 8,
  },
  titleInputField: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: Fonts.medium,
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
    fontFamily: Fonts.semiBold,
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
    fontFamily: Fonts.medium,
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
    width: '100%',
  },
  repeatModalContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 24,
    padding: 20,
    maxWidth: 280,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },

  allDaySection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customRepeatContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: Colors.inputBackground,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
  },
  frequencySelector: {
    marginBottom: 16,
  },
  frequencyInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frequencyInput: {
    width: 56,
    height: 40,
    backgroundColor: Colors.inputBackground,
    borderRadius: 50,
    paddingHorizontal: 10,
    color: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    textAlign: 'center',
    fontSize: 16,
    marginRight: 8,
  },
  frequencyUnitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  customModalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'space-between',
  },
  customModalButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 50,
    alignItems: 'center',
    marginHorizontal: 5,
    minHeight: 40,
  },
  customModalCancelButton: {
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  customModalConfirmButton: {
    backgroundColor: Colors.alertCoral,
  },
  customModalButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
  repeatModalTitle: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: Colors.hopeWhite,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  repeatOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  repeatOptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  repeatOptionPillActive: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
  },
  repeatOptionPillCustom: {
    width: '100%',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  repeatOptionPillText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  repeatOptionPillTextActive: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
  },
  repeatOptionPillIcon: {
    marginLeft: 4,
  },
  customRepeatLabel: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    marginBottom: 12,
  },
  frequencyUnitText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    marginRight: 4,
  },
  endRepeatContainer: {
    marginTop: 0,
    marginBottom: 16,
  },
  endRepeatRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  endRepeatButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderRadius: 50,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    minHeight: 40,
  },
  endRepeatButtonActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: 'rgba(255, 107, 107, 0.6)',
  },
  endRepeatButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
  endRepeatButtonNeverActive: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
  },
  endRepeatButtonNeverText: {
    color: Colors.hopeWhite,
  },
  marginTop12: {
    marginTop: 12,
  },
  daySelectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  dayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  dayButtonActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: 'rgba(255, 107, 107, 0.6)',
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
    onUpgradeRequired,
    subtaskTitle: _subtaskTitle,
    playbookTitle,
    actionStepNumber,
    actionStepTitle,
    isLoading = false,
    styles,
    existingTimeBlock,
    context = 'journal',
    // Unused props: initialContent, _subtaskId, _stepId, dateString
  } = props;
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const navigation = useNavigation();
  const { subscription } = useSubscription();
  const { user } = useAuth();

  // Get user's week start preference from metadata (default to Sunday/0)
  const weekStartDay = useMemo(() => {
    const weekStartsOnPref = (user as any)?.user_metadata?.preferences?.weekStartsOn
      ?? (user as any)?.user_metadata?.weekStartsOn
      ?? (user as any)?.user_metadata?.preferences?.week_start
      ?? (user as any)?.user_metadata?.preferences?.weekStart
      ?? (user as any)?.user_metadata?.preferences?.week_start_on
      ?? (user as any)?.user_metadata?.preferences?.week_start_day;

    if (typeof weekStartsOnPref === 'number' && weekStartsOnPref >= 0 && weekStartsOnPref <= 6) {
      return weekStartsOnPref;
    }
    if (typeof weekStartsOnPref === 'string') {
      const val = weekStartsOnPref.trim().toLowerCase();
      const map: Record<string, number> = {
        '0': 0, 'sun': 0, 'sunday': 0,
        '1': 1, 'mon': 1, 'monday': 1,
        '2': 2, 'tue': 2, 'tuesday': 2,
        '3': 3, 'wed': 3, 'wednesday': 3,
        '4': 4, 'thu': 4, 'thursday': 4,
        '5': 5, 'fri': 5, 'friday': 5,
        '6': 6, 'sat': 6, 'saturday': 6,
      };
      if (val in map) {
        return map[val];
      }
    }
    return 0; // Default to Sunday
  }, [user]);

  // Reorder day labels based on week start preference
  const dayLabels = useMemo(() => {
    const allDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const allDayIndices = [0, 1, 2, 3, 4, 5, 6];
    
    // Reorder arrays based on week start day
    const reorderedLabels = [];
    const reorderedIndices = [];
    for (let i = 0; i < 7; i++) {
      const dayIndex = (weekStartDay + i) % 7;
      reorderedLabels.push(allDays[dayIndex]);
      reorderedIndices.push(dayIndex);
    }
    
    return { labels: reorderedLabels, indices: reorderedIndices };
  }, [weekStartDay]);

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
  const scrollViewRef = useRef<ScrollView | null>(null);

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

  // Keyboard position state for FAB
  const fabBottomPosition = useRef(new Animated.Value(80)).current;

  // Keyboard listeners to update FAB position with smooth animation
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', (event) => {
      Animated.timing(fabBottomPosition, {
        toValue: event.endCoordinates.height + 16,
        duration: event.duration || 250,
        useNativeDriver: false,
      }).start();
    });

    const keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
      Animated.timing(fabBottomPosition, {
        toValue: 80,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [fabBottomPosition]);

  // Calculate estimated line count based on text length and newlines
  const calculateLineCount = (text: string, charsPerLine: number = 30): number => {
    if (!text || text.trim().length === 0) {return 1;}
    const newlineCount = (text.match(/\n/g) || []).length;
    const textWithoutNewlines = text.replace(/\n/g, '');
    const wrappedLines = Math.ceil(textWithoutNewlines.length / charsPerLine);
    return newlineCount + wrappedLines;
  };

  // Dynamic title font sizing - fixed size based on line count
  // Header title: Original 22px, reduce to 18px if > 3 lines
  // Input title: Original 18px (consistent with other editors)
  const headerTitleFontSize = calculateLineCount(_subtaskTitle || '', 30) > 3 ? 18 : 22;
  const inputTitleFontSize = 18; // Input field uses 18px (consistent with other editors)

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

      if (!category || category === 'Select a category') {
        Alert.alert('Missing Category', 'Please select a category for your time block.');
        return;
      }

      // Format notes with metadata (TODO: implement formatMetadata function)
      const notesWithMetadata = notes.trim();

      // Convert alert string to alarmMinutes number for calendar sync
      const alertToAlarmMinutes = (alertType: string): number | undefined => {
        switch (alertType) {
          case 'at-time': return 0;
          case '5-min': return 5;
          case '10-min': return 10;
          case '15-min': return 15;
          case '30-min': return 30;
          case '1-hour': return 60;
          case '2-hours': return 120;
          case '1-day': return 1440; // 24 * 60
          case '2-days': return 2880; // 48 * 60
          case '1-week': return 10080; // 7 * 24 * 60
          case 'none':
          default: return undefined;
        }
      };

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
        alarmMinutes: alertToAlarmMinutes(alert), // Add converted alarm minutes for calendar sync
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
    console.log('[TBEditor] local onCancel - calling _onCancel prop', typeof _onCancel);
    _onCancel();
    console.log('[TBEditor] _onCancel prop returned');
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

  return (
    <View style={s.container}>
      <StatusBar hidden />
      <KeyboardAvoidingView
        style={s.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        enabled={Platform.OS === 'ios'}>
          <ScrollView
            ref={scrollViewRef}
            style={s.content}
            contentContainerStyle={s.scrollContent}
            scrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Title section with lock icon */}
            <View style={s.titleRow}>
              <View style={s.titleTextFlex}>
                <ThemedText weight="bold" style={[s.entryInput, s.titleInput, s.transparentInput, s.lockedTitleText]}>
                  {context === 'faithful-actions' ? 'Set a time' : 'Time Block'}
                </ThemedText>
                <ThemedText style={s.subtext}>
                  {context === 'faithful-actions' 
                    ? 'Choose when you want to come back to this.' 
                    : 'Schedule and organize your day.'}
                </ThemedText>
              </View>
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
                        onPress={() => {
                          triggerLightHaptic();
                          setShowStartTimePicker(true);
                        }}
                      >
                        <ThemedText weight="semiBold" style={s.timeText}>{formatTime(startTime)}</ThemedText>
                      </TouchableOpacity>

                      <ThemedText weight="medium" style={[s.timeSeparator, s.timeSeparatorSmall]}>TO</ThemedText>

                      <TouchableOpacity
                        style={s.timeButton}
                        onPress={() => {
                          triggerLightHaptic();
                          setShowEndTimePicker(true);
                        }}
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
                    onPress={() => {
                      triggerLightHaptic();
                      handleContentChange('isAllDay', !isAllDay);
                    }}
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
              <View style={s.titleInputContainer}>
                <Ionicons name="text" size={18} color={Colors.hopeWhite} style={s.titleInputIcon} />
                <View style={{ flex: 1, position: 'relative' }}>
                  <TextInput
                    ref={inputRef}
                    style={s.titleInputField}
                    placeholder=""
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    value={title}
                    onChangeText={(text) => handleContentChange('title', text)}
                    multiline={false}
                    keyboardAppearance="dark"
                  />
                  {!title && (
                    <View style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                      <ThemedText style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 16, fontFamily: Fonts.medium, lineHeight: 20 }}>
                        Title <ThemedText style={{ color: Colors.alertCoral, fontSize: 16, fontFamily: Fonts.medium, lineHeight: 20 }}>*</ThemedText>
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>

              {/* Repeat Section */}
              <TouchableOpacity
                style={s.repeatButton}
                onPress={() => {
                  triggerLightHaptic();
                  setShowRepeatModal(true);
                }}
              >
                <View style={s.buttonContent}>
                  <Ionicons name="repeat" size={18} color={Colors.hopeWhite} style={s.buttonIcon} />
                  <ThemedText weight="medium" style={s.repeatText}>Repeat</ThemedText>
                </View>
                <View style={s.repeatOptionContainer}>
                  <ThemedText weight="medium" style={[s.repeatText, s.repeatTextWithMargin, repeatOption !== 'Never' && s.selectedOptionText]}>{repeatOption}</ThemedText>
                  <Ionicons name="chevron-down" size={16} color={Colors.hopeWhite} />
                </View>
              </TouchableOpacity>

              {/* End Repeat Section - Below Repeat in main form */}
              {repeatOption !== 'Never' && (
                <View style={s.endRepeatContainer}>
                  <ThemedText weight="medium" style={s.inputLabel}>End Repeat</ThemedText>
                  <View style={s.endRepeatRow}>
                    <TouchableOpacity
                      onPress={() => {
                        triggerLightHaptic();
                        setEndRepeatMode('never');
                        setEndRepeatDate(null);
                      }}
                      style={[
                        s.endRepeatButton,
                        endRepeatMode === 'never' && s.endRepeatButtonActive,
                      ]}
                    >
                      <ThemedText style={s.repeatText}>Never</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        triggerLightHaptic();
                        setShowEndDatePicker(true);
                      }}
                      style={[
                        s.endRepeatButton,
                        (endRepeatMode === 'date' && endRepeatDate) && s.endRepeatButtonActive,
                      ]}
                    >
                      <ThemedText style={s.repeatText}>
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
                <View style={s.buttonContent}>
                  <Ionicons name="notifications" size={18} color={Colors.hopeWhite} style={s.buttonIcon} />
                  <ThemedText weight="medium" style={s.repeatText}>Alert</ThemedText>
                </View>
                <View style={s.repeatOptionContainer}>
                  <ThemedText weight="medium" style={[s.repeatText, s.repeatTextWithMargin, alert !== 'none' && s.selectedOptionText]}>
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
                  <Ionicons name="chevron-down" size={16} color={Colors.hopeWhite} />
                </View>
              </TouchableOpacity>

              {/* Category Selection */}
              <TouchableOpacity
                style={[
                  s.categoryButton,
                  s.selectedCategoryButton,
                ]}
                onPress={() => {
                  triggerLightHaptic();
                  setShowCategoryModal(true);
                }}
                accessibilityLabel="Select Category"
              >
                <Ionicons
                  name={getCategoryIcon(category) as any}
                  size={16}
                  color={Colors.hopeWhite}
                  style={s.categoryIcon}
                />
                <ThemedText
                  weight="medium"
                  style={[
                    s.repeatText,
                    category === 'Select a category' && s.categoryTextRequired,
                  ]}
                >
                  {category === 'Select a category' ? (
                    <>
                      Category <ThemedText weight="medium" style={{ color: Colors.alertCoral }}>*</ThemedText>
                    </>
                  ) : (
                    category
                  )}
                </ThemedText>
                <Ionicons name="chevron-down" size={16} color={Colors.hopeWhite} style={s.chevronIcon} />
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
                <TouchableOpacity
                  style={s.repeatModal}
                  activeOpacity={1}
                  onPress={() => setShowRepeatModal(false)}
                >
                  <View style={s.repeatModalContainer}>
                    <ThemedText weight="semiBold" style={s.repeatModalTitle}>Repeat</ThemedText>
                    <View style={s.repeatOptionsGrid}>
                      {[
                        { value: 'Never', label: 'Never' },
                        { value: 'Daily', label: 'Daily' },
                        { value: 'Weekly', label: 'Weekly' },
                        { value: 'Monthly', label: 'Monthly' },
                      ].map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            s.repeatOptionPill,
                            repeatOption === option.value && s.repeatOptionPillActive,
                          ]}
                          onPress={async () => {
                            await triggerLightHaptic();
                            if (option.value === 'Custom') {
                              setRepeatOption(option.value);
                              setShowRepeatModal(false);
                              setShowCustomRepeatModal(true);
                            } else {
                              setRepeatOption(option.value);
                              setShowRepeatModal(false);
                            }
                          }}
                        >
                          <ThemedText weight={repeatOption === option.value ? 'semiBold' : 'medium'} style={[
                            s.repeatOptionPillText,
                            repeatOption === option.value && s.repeatOptionPillTextActive,
                          ]}>
                            {option.label}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={[
                        s.repeatOptionPill,
                        s.repeatOptionPillCustom,
                        repeatOption === 'Custom' && s.repeatOptionPillActive,
                      ]}
                      onPress={async () => {
                        await triggerLightHaptic();
                        setRepeatOption('Custom');
                        setShowRepeatModal(false);
                        setShowCustomRepeatModal(true);
                      }}
                    >
                      <ThemedText weight={repeatOption === 'Custom' ? 'semiBold' : 'medium'} style={[
                        s.repeatOptionPillText,
                        repeatOption === 'Custom' && s.repeatOptionPillTextActive,
                      ]}>
                        Custom
                      </ThemedText>
                      <Ionicons name="chevron-forward" size={14} color={repeatOption === 'Custom' ? Colors.hopeWhite : 'rgba(255,255,255,0.5)'} style={s.repeatOptionPillIcon} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Modal>

              {/* Alert Modal */}
              <Modal
                visible={showAlertModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowAlertModal(false)}
                supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
              >
                <TouchableOpacity
                  style={s.repeatModal}
                  activeOpacity={1}
                  onPress={() => setShowAlertModal(false)}
                >
                  <View style={s.repeatModalContainer}>
                    <ThemedText weight="medium" style={s.repeatModalTitle}>Alert</ThemedText>
                    <View style={s.repeatOptionsGrid}>
                      {[
                        { value: 'none', label: 'None' },
                        { value: 'at-time', label: 'At time' },
                        { value: '5-min', label: '5 min' },
                        { value: '10-min', label: '10 min' },
                        { value: '15-min', label: '15 min' },
                        { value: '30-min', label: '30 min' },
                      ].map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            s.repeatOptionPill,
                            alert === option.value && s.repeatOptionPillActive,
                          ]}
                          onPress={async () => {
                            await triggerLightHaptic();
                            setAlert(option.value as any);
                            setShowAlertModal(false);
                          }}
                        >
                          <ThemedText weight={alert === option.value ? 'semiBold' : 'medium'} style={[
                            s.repeatOptionPillText,
                            alert === option.value && s.repeatOptionPillTextActive,
                          ]}>
                            {option.label}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={s.repeatOptionsGrid}>
                      {[
                        { value: '1-hour', label: '1 hour' },
                        { value: '2-hours', label: '2 hours' },
                        { value: '1-day', label: '1 day' },
                        { value: '2-days', label: '2 days' },
                        { value: '1-week', label: '1 week' },
                      ].map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            s.repeatOptionPill,
                            alert === option.value && s.repeatOptionPillActive,
                          ]}
                          onPress={async () => {
                            await triggerLightHaptic();
                            setAlert(option.value as any);
                            setShowAlertModal(false);
                          }}
                        >
                          <ThemedText weight={alert === option.value ? 'semiBold' : 'medium'} style={[
                            s.repeatOptionPillText,
                            alert === option.value && s.repeatOptionPillTextActive,
                          ]}>
                            {option.label}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </TouchableOpacity>
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
                            keyboardAppearance="dark"
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
                            {dayLabels.labels.map((label, idx) => {
                              const actualDayIndex = dayLabels.indices[idx];
                              return (
                                <TouchableOpacity
                                  key={actualDayIndex}
                                  onPress={async () => {
                                    await triggerLightHaptic();
                                    setCustomDays(prev => prev.includes(actualDayIndex) ? prev.filter(d => d !== actualDayIndex) : [...prev, actualDayIndex]);
                                  }}
                                  style={[
                                    s.dayButton,
                                    customDays.includes(actualDayIndex) && s.dayButtonActive,
                                  ]}
                                >
                                  <ThemedText weight="medium" style={s.dayButtonText}>{label}</ThemedText>
                                </TouchableOpacity>
                              );
                            })}
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
                  placeholder="Location"
                />
              </View>

              {/* Notes Input */}
              <View style={s.notesInputContainer}>
                <Ionicons name="document-text" size={18} color={Colors.hopeWhite} style={s.notesInputIcon} />
                <TextInput
                  style={s.notesInput}
                  placeholder="Notes"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={notes}
                  onChangeText={(text) => handleContentChange('notes', text)}
                  multiline
                  textAlignVertical="top"
                  keyboardAppearance="dark"
                  onFocus={() => {
                    // Give the keyboard a moment to appear, then nudge scroll so Notes is above it
                    setTimeout(() => {
                      if (scrollViewRef.current) {
                        scrollViewRef.current.scrollTo({ y: 360, animated: true });
                      }
                    }, 250);
                  }}
                />
              </View>

              {/* Metadata section
                 Only show when there is a real playbook title. This keeps
                 dashboard-triggered time blocks (scripture/declarations) from
                 being labeled as From Playbook. */}
              {playbookTitle && (
                <View style={s.metadataContainer}>
                  <View style={s.verticalLine} />
                  <View>
                    <ThemedText weight="medium" style={s.fromText}>From Playbook</ThemedText>
                    <ThemedText style={s.metadataText}>{playbookTitle}</ThemedText>
                    {actionStepNumber && actionStepTitle && (
                      <ThemedText style={s.metadataText}>
                        Action {actionStepNumber}: {actionStepTitle}
                      </ThemedText>
                    )}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

      {/* Floating Action Buttons - Standard Layout */}
      {/* Wrapping in a non-scrollable ScrollView with keyboardShouldPersistTaps='always' fixes the iOS
          quirk where tapping a button while the keyboard is visible requires two taps (first to dismiss
          keyboard, second to trigger). See: https://github.com/facebook/react-native/issues/9447 */}
      <Animated.View style={[s.fabWrapper, { bottom: fabBottomPosition }]}>
        <View style={s.fabContainer}>
          <View style={s.fabRow}>
            {/* Cancel FAB */}
            <TouchableOpacity
              style={[s.fab, s.cancelFab]}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              onPressIn={() => { console.log('[TimeBlockFAB] Cancel onPressIn'); }}
              onPress={() => {
                console.log('[TimeBlockFAB] Cancel onPress - firing onCancel');
                triggerLightHaptic();
                onCancel();
              }}
            >
              <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>

            {/* Save FAB */}
            <TouchableOpacity
              style={[
                s.fab,
                s.saveFab,
                (!title.trim() || !category || category === 'Select a category' || isLoading) && s.fabDisabled,
              ]}
              disabled={!title.trim() || !category || category === 'Select a category' || isLoading}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              onPressIn={() => { console.log('[TimeBlockFAB] Save onPressIn, disabled=', !title.trim() || !category || category === 'Select a category' || isLoading); }}
              onPress={() => {
                console.log('[TimeBlockFAB] Save onPress - firing handleSave');
                triggerLightHaptic();
                handleSave();
              }}
            >
              {isLoading ? (
                <ActivityIndicator size={17} color={Colors.hopeWhite} />
              ) : (
                <Ionicons name="checkmark" size={17} color={Colors.hopeWhite} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
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
                  triggerLightHaptic();
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
                  triggerLightHaptic();
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

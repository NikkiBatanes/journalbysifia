import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  useCallback,
} from 'react';
import {Logger} from '../../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Keyboard,
  Alert,
  Animated,
  Easing,
} from 'react-native';

import {Trash2} from 'lucide-react-native';
import {Colors} from '../../theme/colors';
// import { GUIDED_PROMPTS } from './reflectionConstants'; // Unused
import {triggerLightHaptic, triggerMediumHaptic} from '../../utils/haptics';
import ThemedText from '../common/ThemedText';
import {useTheme} from '../../hooks/useTheme';
import {getFontFamily} from '../../theme/fonts';
import {useGuidedPromptGating} from '../../hooks/useGuidedPromptGating';
import PlaybookMetaSection from './PlaybookMetaSection';
import {
  HEART_JOURNAL_CLASSIFICATIONS,
  heartJournalWritingCopy,
  heartJournalClassificationLabel,
  type HeartJournalClassification,
} from '../../types/heartJournal';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFloatingKeyboardButton} from '../../hooks/useFloatingKeyboardButton';
import {JournalComposerBar, JournalPickerMenu} from './shared/JournalComposer';
import {JournalInlineBlock} from './shared/JournalInlineBlock';
import {JOURNAL_BLOCKS} from './shared/journalBlocks';
import {
  GUIDED_NOTE_TYPES,
  createGuidedNoteId,
  type GuidedReflectionNote,
} from '../../types/guidedReflection';

type ViewMode = 'free-form' | 'guided';

const reflectionBlocksToText = (blocks: GuidedReflectionNote[]) =>
  blocks
    .map(block => {
      const text = block.text.trim();
      const reference = block.reference?.trim();
      if (block.kind === 'text') return text;
      const label = JOURNAL_BLOCKS[block.kind].label;
      return [label, reference, text].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n\n');

interface ReflectionLogEditorProps {
  onSave: (entry: {
    title: string;
    content: string;
    tags: string[];
    date: Date;
    type: ViewMode;
    prompt?: string;
    source?: 'freeform' | 'guided' | 'playbook' | string;
    journalClassification?: HeartJournalClassification;
    journalBlocks?: GuidedReflectionNote[];
  }) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  onUpgradeRequired?: () => void; // Callback to close modal before navigating to upgrade
  entryId?: string;
  playbookTitle?: string;
  totalDays?: number;
  dayNumber?: number;
  dayTitle?: string;
  questionNumber?: number;
  initialEntry?: {
    title?: string;
    content?: string;
    tags?: string[];
    type?: ViewMode;
    prompt?: string;
    source?: string;
    journalClassification?: HeartJournalClassification;
    journalBlocks?: GuidedReflectionNote[];
  };
  initialMode?: ViewMode;
  initialPrompt?: string;
  dateString?: string;
  initialTitle?: string;
  lockTitle?: boolean;
  source?: 'freeform' | 'guided' | 'playbook' | string;
  initialJournalClassification?: HeartJournalClassification;
  subtaskId?: string;
  styles?: any;
  isLoading?: boolean;
  hideGuidedPromptButton?: boolean;
  fromCarousel?: boolean; // Indicate if navigation is from carousel
  hidePencilIcon?: boolean;
  autoOpenGuidedPrompt?: boolean;
  stepBody?: string;
  stepExample?: string | null;
}

export interface ReflectionLogEditorRef {
  focusInput: () => void;
  blurInputs: () => void;
  triggerCancel: () => void;
}

// Fallback styles in case styles prop is not provided
const fallbackStyles = {
  container: {
    flex: 1,
    backgroundColor: Colors.sage,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  backgroundContainer: {},
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
    lineHeight: 16,
  },
  metadataTextWithLineHeight: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 4,
    lineHeight: 16,
  },
  metadataTextSmall: {
    fontSize: 10,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 4,
    lineHeight: 14,
  },
  lastMetadataText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 0,
    lineHeight: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 10,
    backgroundColor: Colors.sage,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 8,
  },

  keyboardAvoidingView: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    backgroundColor: Colors.sage,
  },
  contentCard: {
    flex: 1,
    backgroundColor: 'rgba(26,60,109,0.08)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 16,
    padding: 16,
  },
  content: {flex: 1},
  scrollContent: {flexGrow: 1},
  entryInput: {color: Colors.hopeWhite, fontSize: 18, marginBottom: 8},
  titleInput: {
    fontWeight: 'bold',
    fontSize: 22,
    paddingVertical: 8, // Moved from lockedTitleText to apply to both
    includeFontPadding: false, // Prevents platform-specific padding
    textAlignVertical: 'center', // Ensures consistent vertical alignment
  },
  transparentInput: {},
  entryContentInput: {minHeight: 100, fontSize: 16},
  freeText: {
    minHeight: 44,
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
    paddingVertical: 6,
    marginBottom: 6,
  },
  capture: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 9,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  textCapture: {backgroundColor: 'rgba(255,255,255,0.1)'},
  scriptureCapture: {backgroundColor: 'rgba(255,255,255,0.12)'},
  quoteCapture: {backgroundColor: 'rgba(255,255,255,0.1)'},
  keyCapture: {backgroundColor: 'rgba(255,255,255,0.14)'},
  rememberCapture: {backgroundColor: 'rgba(255,255,255,0.12)'},
  questionCapture: {backgroundColor: 'rgba(255,255,255,0.08)'},
  responseCapture: {backgroundColor: 'rgba(255,255,255,0.14)'},
  captureHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  captureLabelRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  captureLabel: {fontSize: 10, letterSpacing: 1.2, color: Colors.hopeWhite},
  captureInput: {minHeight: 54, paddingTop: 9, fontSize: 14, color: Colors.hopeWhite, textAlignVertical: 'top'},
  scriptureReferenceInline: {minHeight: 38, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)'},
  // Split view styles
  splitViewContainer: {
    flexDirection: 'row',
    flex: 1,
    minHeight: 200,
  },
  inputContainer: {
    flex: 1,
    marginRight: 4,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
    paddingRight: 8,
  },

  previewLabel: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 8,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  guidedContainer: {},
  promptGrid: {flexDirection: 'row', flexWrap: 'wrap'},
  promptCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    margin: 4,
    padding: 12,
    flex: 1,
    minWidth: 120,
  },
  promptCardText: {color: Colors.hopeWhite, fontSize: 16},
  // Reflect button styled to match Reflect carousel empty state button
  reflectLabel: {
    marginTop: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row',
    alignSelf: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  headerLockIcon: {
    marginLeft: 12,
  },
  reflectLabelText: {fontSize: 15, color: Colors.hopeWhite, letterSpacing: 0.5},
  lockedTitleText: {
    color: Colors.hopeWhite,
    opacity: 0.9,
    includeFontPadding: false, // Match TextInput behavior
    textAlignVertical: 'center', // Ensure consistent alignment
  },
  editableTitle: {
    opacity: 0.9, // Moved from inline style to fix lint warning
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonContainer: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    elevation: 30,
    backgroundColor: 'transparent',
  },
  fabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftFabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  androidFabWithKeyboard: {},
  fabDefaultPosition: {},
  addMenu: {
    backgroundColor: Colors.sage,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  // Draft notification styles
  draftNotification: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{translateX: -100}, {translateY: -25}],
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    width: 200,
    shadowColor: '#29342E',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  draftIcon: {
    marginRight: 8,
  },
  draftText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '500',
  },
  addMenuItem: {flexDirection: 'row', alignItems: 'center', padding: 8},
  addMenuText: {color: Colors.hopeWhite, marginLeft: 8},
  fab: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    padding: 12,
    margin: 8,
  },
  addFab: {},
  formatFab: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 12,
  },
  formatFabText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  fabRow: {flexDirection: 'row'},
  cancelFab: {backgroundColor: 'rgba(255, 255, 255, 0.15)'},
  saveFab: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  fabDisabled: {opacity: 0.4},
  modalView: {
    backgroundColor: Colors.hopeWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 0,
    width: '100%',
    height: '100%',
    shadowColor: '#29342E',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  // Text formatting modal styles
  formattingModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  formattingModal: {
    backgroundColor: Colors.sage,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    width: '100%',
  },
  formattingCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 8,
    zIndex: 1,
  },
  formattingGrid: {
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  formattingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  formattingButton: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formattingButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  previewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  modeButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 0,
  },
  activeModeButton: {
    backgroundColor: 'rgba(82, 106, 91, 0.12)',
  },
  headerSaveButton: {
    fontSize: 12,
    color: Colors.hopeWhite,
    marginLeft: 6,
    fontWeight: '500',
  },
  previewToggleText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    marginLeft: 6,
    fontWeight: '500',
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  lockIconContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  promptTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  lockedTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },

  editorModeToggle: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 2,
  },
  modeToggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  modeToggleButtonActive: {
    backgroundColor: Colors.hopeWhite,
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.hopeWhite,
    opacity: 0.7,
  },
  modeToggleTextActive: {
    color: Colors.sage,
    opacity: 1,
  },
  editModeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 16,
    textAlignVertical: 'top',
  },
  previewMode: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 16,
  },
  // Metadata styles moved to inline styles to prevent override
};

const ReflectionLogEditor = React.forwardRef<
  ReflectionLogEditorRef,
  ReflectionLogEditorProps
>(
  (
    {
      onSave,
      onCancel,
      onDelete,
      onUpgradeRequired: _onUpgradeRequired,
      entryId,
      playbookTitle,
      totalDays,
      dayNumber,
      dayTitle,
      questionNumber,
      initialEntry = {},
      initialMode = 'free-form',
      initialPrompt = '',
      dateString,
      initialTitle = '',
      lockTitle = false,
      source = 'freeform',
      initialJournalClassification,
      subtaskId,
      styles,
      isLoading = false,
      stepBody,
      stepExample,
    },
    ref,
  ) => {
    // Add mounting state to prevent state updates after unmount
    const isMountedRef = useRef(true);
    // Track all pending timeouts to clear them on cancel
    const pendingTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

    // Debug: Track all focus calls
    const logFocus = (_source: string, _target: 'title' | 'content') => {
      // Debug logging removed for production
    };

    // Helper to manage timeouts
    const createManagedTimeout = (callback: () => void, delay: number) => {
      const timeoutId = setTimeout(() => {
        pendingTimeoutsRef.current.delete(timeoutId as any);
        if (isMountedRef.current) {
          callback();
        }
      }, delay);
      pendingTimeoutsRef.current.add(timeoutId as any);
      return timeoutId;
    };

    // Clear all pending timeouts
    const clearAllTimeouts = useCallback(() => {
      pendingTimeoutsRef.current.forEach(timeoutId =>
        clearTimeout(timeoutId as any),
      );
      pendingTimeoutsRef.current.clear();
    }, []);

    const {currentFont} = useTheme();
    const fontKey = currentFont || 'lexend';
    const fontFamilyRegular = getFontFamily(fontKey, 'regular');
    const fontFamilyBold = getFontFamily(fontKey, 'bold');

    // Guided prompt gating
    const guidedPromptGating = useGuidedPromptGating({context: 'inApp'});

    // Merge styles prop with fallbackStyles
    const s = {...fallbackStyles, ...styles};
    const blockStyles = {
      ...s,
      freeText: [s.freeText, {fontFamily: fontFamilyRegular}],
      captureInput: [s.captureInput, {fontFamily: fontFamilyRegular}],
    };

    // Prompt selection now lives in GuidedReflectionExperience. This editor
    // only presents the writer for either a free-form entry or a prompt that
    // has already been selected there.
    const [viewMode, setViewMode] = React.useState<'free-form' | 'guided'>(
      'free-form',
    );

    // Debug logging for initialization
    React.useEffect(() => {
      // Debug logging removed for production
    }, [initialMode, initialPrompt, source, initialTitle, viewMode]);

    // Check if we're editing an existing entry (has content)
    const isEditing = Boolean(entryId);

    // Route changes can replace the selected prompt, but this legacy editor
    // must never reopen its retired prompt-picker screen.
    React.useEffect(() => {
      setViewMode('free-form');
    }, [source, initialPrompt, initialMode, initialEntry.content]);

    // Normalize any stored HTML <br> tags to real newlines for native TextInput
    const normalizeIncoming = (text: string): string => {
      if (!text) {
        return '';
      }
      return text.replace(/<br\s*\/?\s*>/gi, '\n');
    };

    // Ensure we save plain text with real newlines (never HTML <br>)
    const normalizeOutgoing = (text: string): string => {
      if (!text) {
        return '';
      }
      // Convert any accidental <br> back to newlines and normalize CRLF
      return text.replace(/<br\s*\/?\s*>/gi, '\n').replace(/\r\n/g, '\n');
    };

    const [newEntry, setNewEntry] = React.useState<{
      title: string;
      content: string;
      tags: string[];
    }>({
      title: initialEntry.title || initialTitle || '',
      content: initialEntry.content
        ? normalizeIncoming(initialEntry.content)
        : '',
      tags: initialEntry.tags || [],
    });
    const [journalBlocks, setJournalBlocks] = React.useState<GuidedReflectionNote[]>(
      () =>
        initialEntry.journalBlocks?.length
          ? initialEntry.journalBlocks
          : initialEntry.content
          ? [{id: createGuidedNoteId(), kind: 'text', text: normalizeIncoming(initialEntry.content)}]
          : [],
    );
    const [notePickerOpen, setNotePickerOpen] = React.useState(false);
    const notePickerAnimations = useRef(
      GUIDED_NOTE_TYPES.map(() => new Animated.Value(0)),
    ).current;
    const notePlusRotation = useRef(new Animated.Value(0)).current;
    const notePickerColorAnim = useRef(new Animated.Value(0)).current;
    const composerActionAnimations = useRef(
      [0, 1, 2, 3].map(() => new Animated.Value(1)),
    ).current;
    const blockInputRefs = useRef(new Map<string, TextInput>());
    const pendingFocusBlockIdRef = useRef<string | null>(null);
    const blockFocusRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [selectedPrompt, setSelectedPrompt] = React.useState<string>(() =>
      initialEntry.prompt ||
      (source === 'guided' ? initialPrompt || initialTitle || '' : ''),
    );
    const [journalClassification, setJournalClassification] = React.useState<
      HeartJournalClassification | undefined
    >(initialEntry.journalClassification || initialJournalClassification);
    const [isClassificationPickerOpen, setIsClassificationPickerOpen] =
      React.useState(false);
    const isDirectHeartJournal =
      source === 'freeform' &&
      initialEntry.type !== 'guided' &&
      !selectedPrompt;
    // Commenting out add menu for MVP; keep state preserving future functionality
    // const [showAddMenu, setShowAddMenu] = React.useState(false);
    const [showFormattingModal] = React.useState(false);
    const insets = useSafeAreaInsets();
    const {bottom: fabAnimatedValue, keyboardVisible: isKeyboardVisible} =
      useFloatingKeyboardButton(insets.bottom);
    // Set to true at the START of handleCancel so any auto-focus timers that
    // fire during prop-change-driven re-renders (source: guided→thoughts etc.)
    // know to abort instead of re-opening the keyboard.
    const isClosingRef = useRef(false);

    const slideAnim = useRef(new Animated.Value(300)).current; // Start 300px below screen

    // Calculate estimated line count based on text length and newlines
    const calculateLineCount = (
      text: string,
      charsPerLine: number = 30,
    ): number => {
      if (!text || text.trim().length === 0) {
        return 1;
      }
      const newlineCount = (text.match(/\n/g) || []).length;
      const textWithoutNewlines = text.replace(/\n/g, '');
      const wrappedLines = Math.ceil(textWithoutNewlines.length / charsPerLine);
      return newlineCount + wrappedLines;
    };

    // Dynamic title font sizing - fixed size based on line count
    // For editable title (TextInput): Based on user's input
    const titleFontSize = calculateLineCount(newEntry.title, 30) > 3 ? 18 : 22;
    // For locked header title (ThemedText): Based on initialTitle
    const lockedTitleFontSize =
      calculateLineCount(initialTitle || '', 30) > 3 ? 18 : 22;

    // Refs
    const titleInputRef = useRef<TextInput>(null);
    const contentInputRef = useRef<TextInput>(null);
    const editorScrollRef = useRef<ScrollView>(null);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      focusInput: () => {
        // Reopen — clear the closing guard so auto-focus timers work again
        isClosingRef.current = false;

        // For dashboard smart journaling (thoughts source), always focus content input
        if (source === 'thoughts' && contentInputRef.current) {
          logFocus('focusInput method', 'content');
          contentInputRef.current.focus();
          // Position cursor at the end of the text
          createManagedTimeout(() => {
            if (contentInputRef.current) {
              contentInputRef.current.setSelection(
                newEntry.content.length,
                newEntry.content.length,
              );
            }
          }, 100);
        }
        // For freeform mode with unlocked title, focus title input first only if title is empty
        else if (
          source === 'freeform' &&
          !lockTitle &&
          titleInputRef.current &&
          !newEntry.title.trim()
        ) {
          logFocus('focusInput method', 'title');
          titleInputRef.current.focus();
          // Position cursor at the end of the title
          createManagedTimeout(() => {
            if (titleInputRef.current) {
              const titleLength = newEntry.title.length;
              titleInputRef.current.setSelection(titleLength, titleLength);
            }
          }, 100);
        } else if (contentInputRef.current) {
          logFocus('focusInput method', 'content');
          // For other modes, focus content input
          contentInputRef.current.focus();
          // Position cursor at the end of the text
          createManagedTimeout(() => {
            if (contentInputRef.current) {
              contentInputRef.current.setSelection(
                newEntry.content.length,
                newEntry.content.length,
              );
            }
          }, 100);
        }
      },
      blurInputs: () => {
        if (titleInputRef.current) {
          titleInputRef.current.blur();
        }
        if (contentInputRef.current) {
          contentInputRef.current.blur();
        }
      },
      triggerCancel: () => {
        handleCancel();
      },
    }));

    // Mobile WYSIWYG state

    // State for showing draft notification
    const [showDraftNotification, setShowDraftNotification] =
      React.useState(false);

    // No cleanup needed for Apple Notes style
    // Track if this is the first load to control draft notification display
    const [isFirstLoad, setIsFirstLoad] = React.useState(true);
    // Track if user has made any changes from initial state
    const [hasUserMadeChanges, setHasUserMadeChanges] = React.useState(false);
    // Store initial state to compare against
    const [initialState, setInitialState] = React.useState({
      content: initialEntry?.content || '',
      title: initialEntry?.title || initialTitle || '',
    });

    // Function to check if user has made changes from initial state
    const checkForChanges = React.useCallback(
      (content: string, title: string) => {
        const hasChanges =
          content !== initialState.content || title !== initialState.title;
        setHasUserMadeChanges(hasChanges);
      },
      [initialState],
    );

    const commitJournalBlocks = React.useCallback(
      (nextBlocks: GuidedReflectionNote[]) => {
        const content = reflectionBlocksToText(nextBlocks);
        setJournalBlocks(nextBlocks);
        setNewEntry(current => ({...current, content}));
        checkForChanges(content, newEntry.title);
      },
      [checkForChanges, newEntry.title],
    );

    const addJournalBlock = React.useCallback(
      (kind: GuidedReflectionNote['kind']) => {
        const block = {id: createGuidedNoteId(), kind, text: ''};
        pendingFocusBlockIdRef.current = block.id;
        commitJournalBlocks([...journalBlocks, block]);
      },
      [commitJournalBlocks, journalBlocks],
    );

    useEffect(() => {
      const blockId = pendingFocusBlockIdRef.current;
      if (!blockId) return;
      const frame = requestAnimationFrame(() => {
        blockInputRefs.current.get(blockId)?.focus();
        editorScrollRef.current?.scrollToEnd({animated: true});
        if (blockFocusRetryTimerRef.current) {
          clearTimeout(blockFocusRetryTimerRef.current);
        }
        blockFocusRetryTimerRef.current = setTimeout(() => {
          blockInputRefs.current.get(blockId)?.focus();
          editorScrollRef.current?.scrollToEnd({animated: true});
          blockFocusRetryTimerRef.current = null;
        }, 320);
        pendingFocusBlockIdRef.current = null;
      });
      return () => cancelAnimationFrame(frame);
    }, [journalBlocks]);

    useEffect(
      () => () => {
        if (blockFocusRetryTimerRef.current) {
          clearTimeout(blockFocusRetryTimerRef.current);
        }
      },
      [],
    );

    const openNotePicker = () => {
      Keyboard.dismiss();
      notePickerAnimations.forEach(animation => {
        animation.stopAnimation();
        animation.setValue(0);
      });
      setNotePickerOpen(true);
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(notePickerColorAnim, {
            toValue: 1,
            duration: 240,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.spring(notePlusRotation, {
            toValue: 1,
            tension: 90,
            friction: 12,
            useNativeDriver: true,
          }),
          Animated.stagger(
            38,
            [...notePickerAnimations].reverse().map(animation =>
              Animated.spring(animation, {
                toValue: 1,
                tension: 90,
                friction: 12,
                useNativeDriver: true,
              }),
            ),
          ),
        ]).start();
      }, 80);
    };

    const closeNotePicker = (onComplete?: () => void) => {
      Animated.parallel([
        Animated.timing(notePickerColorAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.spring(notePlusRotation, {
          toValue: 0,
          tension: 90,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.stagger(
          28,
          notePickerAnimations.map(animation =>
            Animated.timing(animation, {
              toValue: 0,
              duration: 130,
              useNativeDriver: true,
            }),
          ),
        ),
      ]).start(() => {
        setNotePickerOpen(false);
        onComplete?.();
      });
    };

    // Helper function to get draft key (unique for each playbook question)
    const getDraftKey = React.useCallback(() => {
      if (source === 'playbook') {
        // Create unique key for each playbook subtask reflection
        const playbookName = playbookTitle
          ? playbookTitle.replace(/[^a-zA-Z0-9]/g, '_')
          : 'unknown';
        const stepNum = dayNumber !== undefined ? dayNumber : 'unknown';
        const taskId = subtaskId
          ? subtaskId.replace(/[^a-zA-Z0-9]/g, '_')
          : 'unknown';
        const key = `@reflection_editor_draft_playbook_${playbookName}_step${stepNum}_task${taskId}`;
        return key;
      }

      // Fallback key for other sources - use date string instead of timestamp for consistency
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const sourceType = source
        ? source.replace(/[^a-zA-Z0-9]/g, '_')
        : 'freeform';
      return `@reflection_editor_draft_${sourceType}_${currentDate}`;
    }, [source, dayNumber, questionNumber, playbookTitle, subtaskId]);

    // Load draft when component mounts (only for new entries, not when editing)
    useEffect(() => {
      // Only load drafts when creating new entries, not when editing existing ones
      if (!isEditing) {
        const loadDraft = async () => {
          try {
            const draftKey = getDraftKey();
            const draft = await AsyncStorage.getItem(draftKey);
            if (draft) {
              const {content, title, journalBlocks: draftBlocks} = JSON.parse(draft);

              // Only load draft if there's actual meaningful content
              if ((content && content.trim()) || (title && title.trim())) {
                // Check if component is still mounted before state updates
                if (!isMountedRef.current) {
                  return;
                }

                setNewEntry(prev => ({
                  ...prev,
                  content: content || prev.content,
                  title: title || prev.title,
                }));
                if (Array.isArray(draftBlocks) && draftBlocks.length) {
                  setJournalBlocks(draftBlocks);
                } else if (content) {
                  setJournalBlocks([
                    {id: createGuidedNoteId(), kind: 'text', text: content},
                  ]);
                }

                // Update initial state to the loaded draft so changes are tracked from this point
                setInitialState({
                  content: content || '',
                  title: title || '',
                });

                // Focus the appropriate input after a short delay
                createManagedTimeout(() => {
                  // For dashboard smart journaling (thoughts source), always focus content input
                  if (source === 'thoughts' && contentInputRef.current) {
                    logFocus('draft loading', 'content');
                    contentInputRef.current.focus();
                  }
                  // For freeform mode with unlocked title, focus title input only if title is empty
                  else if (
                    source === 'freeform' &&
                    !lockTitle &&
                    titleInputRef.current &&
                    !title
                  ) {
                    logFocus('draft loading', 'title');
                    titleInputRef.current.focus();
                  } else if (content && contentInputRef.current) {
                    // For other modes, focus content input only if there's content
                    logFocus('draft loading', 'content');
                    contentInputRef.current.focus();
                  }
                }, 100);

                // Only show notification when draft is actually loaded (not in edit mode)
                if (isFirstLoad && !isEditing) {
                  // Delay showing notification until modal is fully open
                  createManagedTimeout(() => {
                    setShowDraftNotification(true);
                  }, 500);

                  // Hide notification after 4 seconds
                  createManagedTimeout(() => {
                    setShowDraftNotification(false);
                  }, 4500); // 500ms delay + 4000ms display
                }

                // Mark that first load is complete
                if (isMountedRef.current) {
                  setIsFirstLoad(false);
                }
              }
            }
          } catch (error) {
            // Graceful fallback - continue without draft
            setIsFirstLoad(false);
          }
        };

        // Add error boundary for async operation
        loadDraft().catch(_error => {
          setIsFirstLoad(false); // Ensure component doesn't get stuck
        });
      }
    }, [getDraftKey, isEditing, isFirstLoad, lockTitle, source]);

    // Helper function to save draft
    const saveDraftHelper = async () => {
      try {
        // Only save draft if there's actual meaningful content (not just whitespace)
        const hasContent = newEntry.content.trim().length > 0;
        const hasTitle = newEntry.title.trim().length > 0;

        if (hasContent || hasTitle) {
          const draftData = {
            content: newEntry.content,
            title: newEntry.title,
            journalBlocks,
            // Include playbook metadata if available
            ...(dayNumber !== undefined && {dayNumber}),
            ...(dayTitle && {dayTitle}),
            ...(totalDays !== undefined && {totalDays}),
            ...(questionNumber !== undefined && {questionNumber}),
            // Include other metadata
            ...(source && {source}),
          };

          await AsyncStorage.setItem(getDraftKey(), JSON.stringify(draftData));
        }
      } catch (error) {
        // Error silently handled - draft saving is not critical
      }
    };

    // Clear draft when component unmounts (cleanup)
    useEffect(() => {
      return () => {
        // Mark component as unmounted to prevent state updates
        isMountedRef.current = false;
        // Clear all pending timeouts
        clearAllTimeouts();
        // Only clear draft if the entry was saved (not cancelled)
        // This cleanup runs when component unmounts
      };
    }, [clearAllTimeouts]);

    // Update title when initialTitle changes and focus content if title is locked
    React.useEffect(() => {
      if (initialTitle && (newEntry.title !== initialTitle || !newEntry.title)) {
        // Check if component is still mounted before state updates
        if (!isMountedRef.current) {
          return;
        }

        setNewEntry(prev => ({...prev, title: initialTitle}));
      }

      // Prompt identity is independent from whether the title field already
      // contains the same text. A freshly selected question often arrives as
      // both initialTitle and initialPrompt, so always synchronize it.
      const guidedPrompt = initialPrompt || initialTitle;
      const allGuidedPrompts = guidedPromptGating.allPrompts || [];
      if (
        guidedPrompt &&
        (source === 'guided' || allGuidedPrompts.includes(guidedPrompt)) &&
        isMountedRef.current
      ) {
        setSelectedPrompt(guidedPrompt);
        if (newEntry.title !== guidedPrompt) {
          setNewEntry(prev => ({...prev, title: guidedPrompt}));
        }
      }
    }, [initialPrompt, initialTitle, source, guidedPromptGating.allPrompts, newEntry.title]);

    // Animation for formatting modal
    React.useEffect(() => {
      if (showFormattingModal) {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          // Animation completion callback with safety check
          if (!isMountedRef.current) {
            return;
          }
        });
      } else {
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          // Animation completion callback with safety check
          if (!isMountedRef.current) {
            return;
          }
        });
      }
    }, [showFormattingModal, slideAnim]);

    // Auto-focus appropriate input for new entries
    useEffect(() => {
      // Never schedule focus while the component is closing — source prop changes
      // during the cancel/done teardown can re-trigger this effect.
      if (isClosingRef.current) {
        return;
      }
      // A Guided Question arrives with a locked title after the chooser
      // transition. Focus its response field explicitly once it is mounted.
      if (
        !isEditing &&
        source === 'guided' &&
        (initialPrompt || selectedPrompt)
      ) {
        createManagedTimeout(() => {
          if (isClosingRef.current || !contentInputRef.current) {
            return;
          }
          contentInputRef.current.focus();
        }, 350);
      }
      // For dashboard smart journaling (thoughts source), always focus content input
      else if (!isEditing && source === 'thoughts' && contentInputRef.current) {
        createManagedTimeout(() => {
          if (isClosingRef.current) {
            return;
          }
          if (contentInputRef.current) {
            logFocus('auto-focus effect', 'content');
            contentInputRef.current.focus();
          }
        }, 300);
      }
      // For freeform mode with unlocked title, focus title input only if title is empty
      else if (
        !isEditing &&
        !lockTitle &&
        titleInputRef.current &&
        !newEntry.title.trim()
      ) {
        createManagedTimeout(() => {
          if (isClosingRef.current) {
            return;
          }
          if (titleInputRef.current && !newEntry.title.trim()) {
            logFocus('auto-focus effect', 'title');
            titleInputRef.current.focus();
          }
        }, 300);
      }
    }, [
      initialPrompt,
      isEditing,
      lockTitle,
      newEntry.title,
      selectedPrompt,
      source,
    ]);

    // Refresh guided prompt gating state when component mounts
    const hasRefreshedRef = useRef(false);
    useEffect(() => {
      // Refresh to ensure we have the latest free prompts list (only on mount)
      if (!hasRefreshedRef.current) {
        hasRefreshedRef.current = true;
        const refreshGating = async () => {
          try {
            await guidedPromptGating.refreshAccess();
          } catch (error) {
            // Silently handle refresh errors
          }
        };
        refreshGating();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array - only run on mount

    // Save handler - check for guided prompt restrictions
    const handleSave = async () => {
      // Haptic feedback for save action
      triggerLightHaptic();

      // Check if this is a guided prompt and if user has access
      // Check both selectedPrompt and title to prevent loopholes
      const promptToCheck =
        selectedPrompt ||
        (guidedPromptGating.allPrompts.includes(newEntry.title)
          ? newEntry.title
          : null);

      if (promptToCheck) {
        // Use async canUsePrompt method
        // Retain completion/analytics compatibility without using the result
        // as an entitlement decision.
        await guidedPromptGating.canUsePrompt(promptToCheck);
      }

      // Clear any existing draft since we're saving the entry
      try {
        await AsyncStorage.removeItem(getDraftKey());
        setShowDraftNotification(false); // Hide "Draft Restored" banner immediately
        setHasUserMadeChanges(false); // Prevent handleCancel from re-saving the draft
      } catch (error) {
        // Error silently handled - draft clearing is not critical
      }

      // If it's a guided prompt and user has access, mark it as used
      if (promptToCheck) {
        const canUse = await guidedPromptGating.canUsePrompt(promptToCheck);
        if (canUse) {
          await guidedPromptGating.markPromptUsed(promptToCheck);
        }
      }

      // Determine the entry type - if there's a guided prompt, it's a guided entry
      const entryType: ViewMode = promptToCheck ? 'guided' : effectiveViewMode;

      const entry = {
        title: newEntry.title.trim(),
        content: normalizeOutgoing(newEntry.content).trim(),
        tags: newEntry.tags,
        date: dateString ? new Date(dateString) : new Date(), // Use dateString if provided, fallback to current date
        type: entryType, // Use the determined type
        ...(promptToCheck && {prompt: promptToCheck}),
        ...(source && {source}),
        ...(journalClassification && {journalClassification}),
        journalBlocks,
        // Include playbook metadata if available
        ...(dayNumber !== undefined && {dayNumber}),
        ...(dayTitle && {dayTitle}),
        ...(totalDays !== undefined && {totalDays}),
        ...(questionNumber !== undefined && {questionNumber}),
      };

      // NOTE: Do NOT call Keyboard.dismiss() here - it should remain open for user convenience
      // The keyboard dismissal behavior differs between dashboard and journal contexts
      onSave(entry);
    };

    // Prompt selection belongs to GuidedReflectionExperience; this legacy
    // editor is now always the focused writer.
    const effectiveViewMode = 'free-form' as const;
    const editorEntranceAnims = useRef([
      new Animated.Value(0),
      new Animated.Value(0),
      new Animated.Value(0),
    ]).current;
    const writerItemEntrances = useRef(
      Array.from({length: 4}, () => new Animated.Value(0)),
    ).current;
    const editorEntranceKey = `writer:${selectedPrompt || 'free-form'}`;
    React.useEffect(() => {
      editorEntranceAnims.forEach(animation => {
        animation.stopAnimation();
        animation.setValue(0);
      });
      writerItemEntrances.forEach(animation => {
        animation.stopAnimation();
        animation.setValue(0);
      });
      requestAnimationFrame(() => {
        Animated.sequence([
          Animated.timing(editorEntranceAnims[0], {
            toValue: 1,
            duration: 140,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.spring(editorEntranceAnims[1], {
              toValue: 1,
              tension: 82,
              friction: 11,
              useNativeDriver: true,
            }),
            Animated.spring(editorEntranceAnims[2], {
              toValue: 1,
              tension: 88,
              friction: 12,
              useNativeDriver: true,
            }),
            Animated.stagger(
              55,
              writerItemEntrances.map(animation =>
                Animated.spring(animation, {
                  toValue: 1,
                  tension: 74,
                  friction: 9,
                  useNativeDriver: true,
                }),
              ),
            ),
          ]),
        ]).start();
      });
    }, [editorEntranceAnims, editorEntranceKey, writerItemEntrances]);
    const editorHeaderEntranceStyle = {opacity: editorEntranceAnims[0]};
    const editorContentEntranceStyle = {
      opacity: editorEntranceAnims[1],
      transform: [
        {
          translateY: editorEntranceAnims[1].interpolate({
            inputRange: [0, 1],
            outputRange: [14, 0],
          }),
        },
      ],
    };
    const editorActionsEntranceStyle = {
      opacity: editorEntranceAnims[2],
      transform: [
        {
          translateY: editorEntranceAnims[2].interpolate({
            inputRange: [0, 1],
            outputRange: [10, 0],
          }),
        },
      ],
    };
    const writerItemEntranceStyle = (index: number) => ({
      opacity: writerItemEntrances[index].interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
        extrapolate: 'clamp' as const,
      }),
      transform: [
        {
          translateY: writerItemEntrances[index].interpolate({
            inputRange: [0, 1],
            outputRange: [12, 0],
          }),
        },
        {
          scale: writerItemEntrances[index].interpolate({
            inputRange: [0, 1],
            outputRange: [0.975, 1],
          }),
        },
      ],
    });
    const classificationCopy = journalClassification
      ? heartJournalWritingCopy(journalClassification)
      : null;
    const titlePlaceholder =
      classificationCopy?.title || 'Name Your Reflection...';
    const bodyPlaceholder =
      classificationCopy?.body || 'Pour out your thoughts...';
    const canSaveWithoutTitle = journalClassification === 'brain_dump';
    const saveDisabled =
      (!canSaveWithoutTitle && !newEntry.title.trim()) ||
      !newEntry.content.trim() ||
      !hasUserMadeChanges ||
      isLoading;

    // Cancel handler
    const handleCancel = async (withHaptic = true) => {
      // Mark as closing IMMEDIATELY — before anything else — so any auto-focus
      // timers that get scheduled during prop-change re-renders (e.g. source
      // flipping from guided→thoughts after onCancel resets parent state) will
      // check this flag and abort instead of re-opening the keyboard.
      isClosingRef.current = true;

      // Haptic feedback for cancel/close
      if (withHaptic) triggerLightHaptic();
      try {
        // Save draft before canceling (only if user made changes)
        if (hasUserMadeChanges) {
          await saveDraftHelper();
        }

        // Clear all pending timeouts FIRST — prevents any delayed focus() calls
        // from firing mid-close-animation and causing keyboard to reappear
        clearAllTimeouts();

        // Always dismiss unconditionally — safe when keyboard is already hidden.
        // Must happen before blur() so the keyboard hide animation starts
        // before the responder is released.
        Keyboard.dismiss();

        if (titleInputRef.current?.isFocused()) {
          titleInputRef.current.blur();
        }
        if (contentInputRef.current?.isFocused()) {
          contentInputRef.current.blur();
        }

        if (isKeyboardVisible) {
          // Give the keyboard hide animation a head start before the modal
          // starts its own close animation
          setTimeout(() => {
            onCancel();
          }, 200);
        } else {
          onCancel();
        }
      } catch (error) {
        clearAllTimeouts();
        Keyboard.dismiss();
        titleInputRef.current?.blur();
        contentInputRef.current?.blur();
        onCancel();
      }
    };

    // Delete handler for saved entries
    const handleDelete = () => {
      // Light haptic on opening delete confirmation
      triggerLightHaptic();
      if (!onDelete || !entryId) {
        return;
      }

      Alert.alert(
        'Delete Reflection',
        'Are you sure you want to delete this reflection? This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              // Haptic on confirmed delete
              triggerLightHaptic();
              onDelete(entryId);
            },
          },
        ],
      );
    };

    return (
      <View style={s.container}>
        {showDraftNotification && (
          <View style={s.draftNotification}>
            <Ionicons
              name="time-outline"
              size={20}
              color={Colors.hopeWhite}
              style={s.draftIcon}
            />
            <ThemedText weight="medium" style={s.draftText}>
              Draft Restored
            </ThemedText>
          </View>
        )}
        <StatusBar hidden />
        <View style={s.header}>
          {!!dateString && (
            <ThemedText weight="bold" style={s.title}>
              {dateString}
            </ThemedText>
          )}
          <Animated.View style={[s.modeToggle, editorHeaderEntranceStyle]}>
            <TouchableOpacity
              style={s.headerCloseButton}
              accessibilityRole="button"
              accessibilityLabel="Close reflection editor"
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              activeOpacity={0.7}
              onPress={() => handleCancel()}>
              <Ionicons name="close" size={17} color={Colors.sage} />
            </TouchableOpacity>
            {/* Delete icon - only visible in edit mode and when onDelete is provided */}
            {isEditing && onDelete && (
              <TouchableOpacity
                style={s.modeButton}
                accessibilityRole="button"
                accessibilityLabel="Delete reflection"
                hitSlop={8}
                onPress={handleDelete}>
                <View>
                  <Trash2 size={22} color={Colors.sage} strokeWidth={1.5} />
                </View>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>

        <View style={{flex: 1}}>
          <View style={s.backgroundContainer} />
          <KeyboardAvoidingView
            style={s.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            enabled={Platform.OS === 'ios'}>
          <View style={s.contentCard}>
                <ScrollView
                  ref={editorScrollRef}
                  style={s.content}
                  contentContainerStyle={[
                    s.scrollContent,
                    {paddingBottom: notePickerOpen ? 410 : 180},
                  ]}
                  scrollIndicatorInsets={{bottom: notePickerOpen ? 300 : 120}}
                  keyboardShouldPersistTaps="handled">
              <Animated.View style={editorContentEntranceStyle}>
                  {isDirectHeartJournal && (
                    <Animated.View style={[{marginBottom: 14}, writerItemEntranceStyle(0)]}>
                      <TouchableOpacity
                        testID="heart-journal-classification-control"
                        accessibilityRole="button"
                        accessibilityLabel={`Classification: ${
                          heartJournalClassificationLabel(
                            journalClassification,
                          ) || 'Thoughts'
                        }`}
                        accessibilityState={{
                          expanded: isClassificationPickerOpen,
                        }}
                        onPress={() => {
                          triggerLightHaptic();
                          setIsClassificationPickerOpen(open => !open);
                        }}
                        style={{
                          alignSelf: 'flex-start',
                          minHeight: 36,
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.32)',
                          borderRadius: 18,
                          paddingHorizontal: 13,
                          paddingVertical: 7,
                        }}>
                        <ThemedText
                          weight="semiBold"
                          style={{
                            color: Colors.hopeWhite,
                            fontSize: 11,
                            letterSpacing: 0.8,
                          }}>
                          {(
                            heartJournalClassificationLabel(
                              journalClassification,
                            ) || 'Thoughts'
                          ).toUpperCase()}
                        </ThemedText>
                        <Ionicons
                          name={
                            isClassificationPickerOpen
                              ? 'chevron-up'
                              : 'chevron-down'
                          }
                          size={14}
                          color={Colors.hopeWhite}
                          style={{marginLeft: 6}}
                        />
                      </TouchableOpacity>
                      {isClassificationPickerOpen && (
                        <View
                          testID="heart-journal-classification-picker"
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            rowGap: 8,
                            marginTop: 10,
                          }}>
                          {HEART_JOURNAL_CLASSIFICATIONS.map(item => {
                            const selected =
                              journalClassification === item.value ||
                              (item.value === 'other' && journalClassification?.startsWith('other:'));
                            return (
                              <TouchableOpacity
                                key={item.value}
                                accessibilityRole="button"
                                accessibilityState={{selected}}
                                onPress={() => {
                                  triggerLightHaptic();
                                  setJournalClassification(item.value);
                                  setHasUserMadeChanges(true);
                                  setIsClassificationPickerOpen(false);
                                }}
                                style={{
                                  width: '48.5%',
                                  minHeight: 42,
                                  borderWidth: 1,
                                  borderColor: selected
                                    ? Colors.hopeWhite
                                    : 'rgba(255,255,255,0.25)',
                                  backgroundColor: selected
                                    ? 'rgba(255,255,255,0.14)'
                                    : 'transparent',
                                  borderRadius: 12,
                                  paddingHorizontal: 12,
                                  paddingVertical: 9,
                                  justifyContent: 'center',
                                }}>
                                <ThemedText
                                  weight={selected ? 'semiBold' : 'regular'}
                                  style={{
                                    color: Colors.hopeWhite,
                                    fontSize: 12,
                                  }}>
                                  {item.label}
                                </ThemedText>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </Animated.View>
                  )}
                  <Animated.View style={writerItemEntranceStyle(isDirectHeartJournal ? 1 : 0)}>
                  {(() => {
                    // Lock title if:
                    // 1. Explicit lock flag is set, OR
                    // 2. Source is playbook AND we have content, OR
                    // 3. There's a selected prompt, OR
                    // 4. Title matches a guided prompt
                    const shouldLockTitle =
                      lockTitle ||
                      (source === 'playbook' &&
                        (newEntry.title || newEntry.content)) ||
                      selectedPrompt ||
                      (guidedPromptGating.allPrompts || []).includes(
                        newEntry.title,
                      );

                    return shouldLockTitle;
                  })() ? (
                    <View style={s.lockedTitleContainer}>
                      <View style={s.titleWithLockContainer}>
                        <ThemedText
                          weight="bold"
                          style={[
                            s.entryInput,
                            s.titleInput,
                            s.transparentInput,
                            s.lockedTitleText,
                            s.titleWithLock,
                            {fontSize: lockedTitleFontSize},
                          ]}>
                          {initialTitle || newEntry.title}
                        </ThemedText>
                      </View>
                    </View>
                  ) : (
                    <View style={s.titleWithLockContainer}>
                      <TextInput
                        ref={titleInputRef}
                        style={[
                          s.entryInput,
                          s.titleInput,
                          s.transparentInput,
                          s.editableTitle, // Match locked title opacity
                          s.titleWithLock, // Add flex styling
                          {fontFamily: fontFamilyBold, fontSize: titleFontSize},
                        ]}
                        placeholder={titlePlaceholder}
                        placeholderTextColor="rgba(255, 255, 255, 0.6)"
                        value={newEntry.title}
                        onChangeText={(text: string) => {
                          setNewEntry({...newEntry, title: text});
                          checkForChanges(newEntry.content, text);
                        }}
                        keyboardAppearance="light"
                        onFocus={() => {
                          // In edit mode, position cursor at end instead of selecting all
                          if (isEditing && titleInputRef.current) {
                            createManagedTimeout(() => {
                              const textLength = newEntry.title.length;
                              titleInputRef.current?.setNativeProps({
                                selection: {start: textLength, end: textLength},
                              });
                            }, 10);
                          }
                        }}
                        underlineColorAndroid="transparent"
                        multiline={true}
                      />
                    </View>
                  )}
                  </Animated.View>

                  <Animated.View style={writerItemEntranceStyle(isDirectHeartJournal ? 2 : 1)}>
                  {journalBlocks.map((block, index) => {
                    const updateBlock = (changes: Partial<GuidedReflectionNote>) =>
                      commitJournalBlocks(
                        journalBlocks.map(item =>
                          item.id === block.id ? {...item, ...changes} : item,
                        ),
                      );
                    return (
                      <JournalInlineBlock
                        key={block.id}
                        block={{id: block.id, kind: block.kind, text: block.text}}
                        configOverride={block.kind === 'text' ? undefined : JOURNAL_BLOCKS[block.kind]}
                        tone="onDark"
                        textPlaceholder={bodyPlaceholder}
                        styles={blockStyles}
                        registerInput={input => {
                          if (input) {
                            blockInputRefs.current.set(block.id, input);
                            if (index === 0) contentInputRef.current = input;
                          } else {
                            blockInputRefs.current.delete(block.id);
                          }
                        }}
                        onChangeText={text => updateBlock({text})}
                        onDelete={() =>
                          commitJournalBlocks(
                            journalBlocks.filter(item => item.id !== block.id),
                          )
                        }
                        renderScripture={
                          block.kind === 'scripture'
                            ? () => (
                                <View>
                                  <TextInput
                                    style={[blockStyles.captureInput, s.scriptureReferenceInline]}
                                    value={block.reference || ''}
                                    onChangeText={reference => updateBlock({reference})}
                                    placeholder="Scripture reference"
                                    placeholderTextColor="rgba(255,255,255,0.45)"
                                  />
                                  <TextInput
                                    ref={input => {
                                      if (input) blockInputRefs.current.set(block.id, input);
                                    }}
                                    style={blockStyles.captureInput}
                                    value={block.text}
                                    onChangeText={text => updateBlock({text})}
                                    placeholder="What stands out to you?"
                                    placeholderTextColor="rgba(255,255,255,0.45)"
                                    multiline
                                  />
                                </View>
                              )
                            : undefined
                        }
                      />
                    );
                  })}
                  </Animated.View>
                  {(source === 'playbook' ||
                    (playbookTitle &&
                      (source === 'thoughts' || source !== 'freeform'))) && (
                    <Animated.View style={writerItemEntranceStyle(isDirectHeartJournal ? 3 : 2)}>
                    <PlaybookMetaSection
                      playbookTitle={playbookTitle}
                      actionLabel={
                        dayNumber && dayTitle
                          ? dayTitle === 'Suggestion'
                            ? 'SUGGESTION'
                            : `Action ${dayNumber}: ${dayTitle}`
                          : undefined
                      }
                      stepBody={stepBody}
                      stepExample={stepExample}
                    />
                    </Animated.View>
                  )}
              </Animated.View>
            </ScrollView>
          </View>
          </KeyboardAvoidingView>

          <Animated.View
            pointerEvents="box-none"
            style={[s.fabWrapper, editorActionsEntranceStyle]}>
            <Animated.View style={[{marginHorizontal: 18}, {bottom: fabAnimatedValue}]}>
              {notePickerOpen && (
                <JournalPickerMenu
                  items={GUIDED_NOTE_TYPES.map(item => ({
                    key: item.kind,
                    label: item.label,
                    icon: <Ionicons name={item.icon as any} size={13} color={Colors.sage} />,
                  }))}
                  animations={notePickerAnimations}
                  onSelect={kind => {
                    triggerMediumHaptic();
                    closeNotePicker(() => addJournalBlock(kind));
                  }}
                />
              )}
              <JournalComposerBar
                onBack={() => {
                  if (notePickerOpen) closeNotePicker(() => handleCancel(false));
                  else handleCancel(false);
                }}
                onWrite={() => {
                  triggerLightHaptic();
                  if (notePickerOpen) closeNotePicker(() => addJournalBlock('text'));
                  else addJournalBlock('text');
                }}
                onAdd={() => {
                  triggerLightHaptic();
                  if (notePickerOpen) closeNotePicker();
                  else openNotePicker();
                }}
                onNext={() => {
                  triggerLightHaptic();
                  if (notePickerOpen) closeNotePicker(() => handleSave());
                  else handleSave();
                }}
                addOpen={notePickerOpen}
                plusRotation={notePlusRotation}
                pickerColorAnim={notePickerColorAnim}
                actionAnimations={composerActionAnimations}
                nextIcon={isLoading ? 'hourglass-outline' : 'checkmark'}
                backLabel="Close reflection"
                nextLabel="Save reflection"
                nextDisabled={saveDisabled}
                tone="onDark"
              />
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    );
  },
);

export default ReflectionLogEditor;

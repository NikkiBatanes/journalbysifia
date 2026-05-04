import React, { useEffect, useRef, useImperativeHandle, useState, useCallback } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Keyboard, Alert, ActivityIndicator, Animated } from 'react-native';

import { Pencil, Trash2, X } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
// import { GUIDED_PROMPTS } from './reflectionConstants'; // Unused
import { triggerLightHaptic } from '../../utils/haptics';
import ThemedText from '../common/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import { useSubscription } from '../../hooks/useSubscription';
import { useGuidedPromptGating } from '../../hooks/useGuidedPromptGating';
import GuidedPromptLockIcon from '../GuidedPromptLockIcon';
import { useNavigation } from '@react-navigation/native';
import PlaybookMetaSection from './PlaybookMetaSection';

type ViewMode = 'free-form' | 'guided';

interface ReflectionLogEditorProps {
  onSave: (entry: {
    title: string;
    content: string;
    tags: string[];
    date: Date;
    type: ViewMode;
    prompt?: string;
    source?: 'freeform' | 'guided' | 'devotional' | 'playbook' | string;
  }) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  onUpgradeRequired?: () => void; // Callback to close modal before navigating to upgrade
  entryId?: string;
  devotionalTitle?: string;
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
  };
  initialMode?: ViewMode;
  initialPrompt?: string;
  dateString?: string;
  initialTitle?: string;
  lockTitle?: boolean;
  source?: 'freeform' | 'guided' | 'devotional' | 'playbook' | string;
  subtaskId?: string;
  styles?: any;
  isLoading?: boolean;
  hideGuidedPromptButton?: boolean;
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
  container: { flex: 1, backgroundColor: Colors.anchorBlue, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
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
    backgroundColor: Colors.anchorBlue,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: Colors.hopeWhite, marginBottom: 8 },

  keyboardAvoidingView: { flex: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden', backgroundColor: Colors.anchorBlue },
  contentCard: { flex: 1, backgroundColor: 'rgba(26,60,109,0.08)', borderTopLeftRadius: 30, borderTopRightRadius: 30, marginHorizontal: 0, marginTop: 0, marginBottom: 16, padding: 16 },
  content: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  entryInput: { color: Colors.hopeWhite, fontSize: 18, marginBottom: 8 },
  titleInput: {
    fontWeight: 'bold',
    fontSize: 22,
    paddingVertical: 8, // Moved from lockedTitleText to apply to both
    includeFontPadding: false, // Prevents platform-specific padding
    textAlignVertical: 'center', // Ensures consistent vertical alignment
  },
  transparentInput: {},
  entryContentInput: { minHeight: 100, fontSize: 16 },
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
  promptGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  promptCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, margin: 4, padding: 12, flex: 1, minWidth: 120 },
  promptCardText: { color: Colors.hopeWhite, fontSize: 16 },
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
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    alignSelf: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  headerLockIcon: {
    marginLeft: 12,
  },
  reflectLabelText: { fontSize: 15, color: Colors.hopeWhite, letterSpacing: 0.5 },
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
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: Colors.alertCoral,
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
  fabWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.anchorBlue },
  fabContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  leftFabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  androidFabWithKeyboard: {},
  fabDefaultPosition: {},
  addMenu: { backgroundColor: Colors.anchorBlue, borderRadius: 8, padding: 8, marginBottom: 8 },
  // Draft notification styles
  draftNotification: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -25 }],
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
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
  addMenuItem: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  addMenuText: { color: Colors.hopeWhite, marginLeft: 8 },
  fab: { backgroundColor: Colors.alertCoral, borderRadius: 24, padding: 12, margin: 8 },
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
  fabRow: { flexDirection: 'row' },
  cancelFab: { backgroundColor: Colors.alertCoral },
  saveFab: { backgroundColor: Colors.growthGreen },
  fabDisabled: { opacity: 0.4 },
  modalView: {
    backgroundColor: Colors.hopeWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 0,
    width: '100%',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
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
    backgroundColor: Colors.anchorBlue,
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    color: Colors.anchorBlue,
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

const ReflectionLogEditor = React.forwardRef<ReflectionLogEditorRef, ReflectionLogEditorProps>((
  {
    onSave,
    onCancel,
    onDelete,
    onUpgradeRequired,
    entryId,
    devotionalTitle,
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
    subtaskId,
    styles,
    isLoading = false,
    hideGuidedPromptButton = false,
    hidePencilIcon = false,
    autoOpenGuidedPrompt = false,
    stepBody,
    stepExample,
  },
  ref
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
    pendingTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId as any));
    pendingTimeoutsRef.current.clear();
  }, []);

  const { currentFont } = useTheme();
  const { subscription } = useSubscription();
  const navigation = useNavigation();
  const fontKey = currentFont || 'lexend';
  const fontFamilyRegular = getFontFamily(fontKey, 'regular');
  const fontFamilyBold = getFontFamily(fontKey, 'bold');

  // Guided prompt gating
  const guidedPromptGating = useGuidedPromptGating({
    context: 'inApp',
    onUpgradeRequired: () => {
      // Navigate directly to sales offer screen
      (navigation as any).navigate('OnboardingSalesOffer', {
        source: 'guided_prompts_lock',
        feature: 'guided_prompts',
        tier: subscription?.tier || 'seeker',
        upgradeMode: false,
        skipNotificationPreference: true,
      });
    },
  });


  const sortedGuidedPrompts = React.useMemo(() => {
    // Use new simplified API - free prompts first, then locked
    const freePrompts = guidedPromptGating.freePrompts || [];
    const lockedPrompts = guidedPromptGating.lockedPrompts || [];
    return [...freePrompts, ...lockedPrompts];
  }, [guidedPromptGating.freePrompts, guidedPromptGating.lockedPrompts]);

  // Merge styles prop with fallbackStyles
  const s = { ...fallbackStyles, ...styles };

  // Animation for close button in guided mode
  const closeButtonAnim = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = visible
  // Animation for sliding icons left when close button appears
  const iconsSlideAnim = useRef(new Animated.Value(0)).current; // 0 = normal position (far right), 1 = slid left

  // Internal state - manage view mode
  const [viewMode, setViewMode] = React.useState<'free-form' | 'guided'>(
    initialMode || 'free-form'
  );

  // Debug logging for initialization
  React.useEffect(() => {
    // Debug logging removed for production
  }, [initialMode, initialPrompt, source, initialTitle, viewMode]);

  // Check if we're editing an existing entry (has content)
  const isEditing = !!(initialEntry.content && initialEntry.content.trim() !== '');

  // Update view mode when initialMode or source changes
  React.useEffect(() => {
    if (source === 'devotional') {
      setViewMode('free-form');
    } else if (source === 'guided' && initialPrompt && !initialEntry.content) {
      setViewMode('guided');
    } else if (initialPrompt) {
      setViewMode('free-form');
    } else {
      setViewMode(initialMode || 'free-form');
    }
  }, [source, initialPrompt, initialMode, initialEntry.content]);

  // Animate close button and icons when entering/exiting guided mode
  React.useEffect(() => {
    if (viewMode === 'guided') {
      // Show close button, slide icons left
      Animated.parallel([
        Animated.spring(closeButtonAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(iconsSlideAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide close button, slide icons back to normal position
      Animated.parallel([
        Animated.spring(closeButtonAnim, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(iconsSlideAnim, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [viewMode, closeButtonAnim, iconsSlideAnim]);

  // Normalize any stored HTML <br> tags to real newlines for native TextInput
  const normalizeIncoming = (text: string): string => {
    if (!text) {return '';}
    return text.replace(/<br\s*\/?\s*>/gi, '\n');
  };

  // Ensure we save plain text with real newlines (never HTML <br>)
  const normalizeOutgoing = (text: string): string => {
    if (!text) {return '';}
    // Convert any accidental <br> back to newlines and normalize CRLF
    return text.replace(/<br\s*\/?\s*>/gi, '\n').replace(/\r\n/g, '\n');
  };

  const [newEntry, setNewEntry] = React.useState<{ title: string; content: string; tags: string[] }>(
    {
      title: initialEntry.title || initialTitle || '',
      content: initialEntry.content ? normalizeIncoming(initialEntry.content) : '',
      tags: initialEntry.tags || [],
    }
  );

  React.useEffect(() => {
    if (autoOpenGuidedPrompt && !isEditing && source !== 'devotional' && source !== 'playbook') {
      setViewMode('guided');
      setNewEntry(prev => ({
        ...prev,
        content: '',
        title: prev.title || '',
      }));
      Keyboard.dismiss();
    }
  }, [autoOpenGuidedPrompt, isEditing, source]);

  const [selectedPrompt, setSelectedPrompt] = React.useState<string>('');
  // Commenting out add menu for MVP; keep state preserving future functionality
  // const [showAddMenu, setShowAddMenu] = React.useState(false);
  const [showFormattingModal] = React.useState(false);
  const [_keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible] = useState(false);
  const fabAnimatedValue = useRef(new Animated.Value(16)).current; // Start at default position (16px from bottom)

  const isSelectedPromptLocked = React.useMemo(() => {
    // Check both selectedPrompt and title to catch all cases
    const promptToCheck = selectedPrompt || newEntry.title;
    if (!promptToCheck) {return false;}

    // Check if prompt is in the locked prompts list
    const lockedPrompts = guidedPromptGating.lockedPrompts || [];
    const isLocked = lockedPrompts.includes(promptToCheck);

    return isLocked;
  }, [selectedPrompt, newEntry.title, guidedPromptGating.lockedPrompts]);

  const slideAnim = useRef(new Animated.Value(300)).current; // Start 300px below screen

  // Calculate estimated line count based on text length and newlines
  const calculateLineCount = (text: string, charsPerLine: number = 30): number => {
    if (!text || text.trim().length === 0) {return 1;}
    const newlineCount = (text.match(/\n/g) || []).length;
    const textWithoutNewlines = text.replace(/\n/g, '');
    const wrappedLines = Math.ceil(textWithoutNewlines.length / charsPerLine);
    return newlineCount + wrappedLines;
  };

  // Dynamic title font sizing - fixed size based on line count
  // For editable title (TextInput): Based on user's input
  const titleFontSize = calculateLineCount(newEntry.title, 30) > 3 ? 18 : 22;
  // For locked header title (ThemedText): Based on initialTitle
  const lockedTitleFontSize = calculateLineCount(initialTitle || '', 30) > 3 ? 18 : 22;

  // Refs
  const titleInputRef = useRef<TextInput>(null);
  const contentInputRef = useRef<TextInput>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    focusInput: () => {

      // For dashboard smart journaling (thoughts source), always focus content input
      if (source === 'thoughts' && contentInputRef.current) {
        logFocus('focusInput method', 'content');
        contentInputRef.current.focus();
        // Position cursor at the end of the text
        createManagedTimeout(() => {
          if (contentInputRef.current) {
            contentInputRef.current.setSelection(newEntry.content.length, newEntry.content.length);
          }
        }, 100);
      }
      // For freeform mode with unlocked title, focus title input first only if title is empty
      else if (source === 'freeform' && !lockTitle && titleInputRef.current && !newEntry.title.trim()) {
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
            contentInputRef.current.setSelection(newEntry.content.length, newEntry.content.length);
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
  const [showDraftNotification, setShowDraftNotification] = React.useState(false);

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
  const checkForChanges = React.useCallback((content: string, title: string) => {
    const hasChanges = content !== initialState.content || title !== initialState.title;
    setHasUserMadeChanges(hasChanges);
  }, [initialState]);

  // Helper function to get draft key (unique for each devotional question)
  const getDraftKey = React.useCallback(() => {
    if (source === 'devotional' && devotionalTitle && dayNumber !== undefined && questionNumber !== undefined) {
      // Create unique key for each devotional question
      const key = `@reflection_editor_draft_${devotionalTitle.replace(/[^a-zA-Z0-9]/g, '_')}_day${dayNumber}_q${questionNumber}`;
      return key;
    }

    if (source === 'playbook') {
      // Create unique key for each playbook subtask reflection
      const playbookName = playbookTitle ? playbookTitle.replace(/[^a-zA-Z0-9]/g, '_') : 'unknown';
      const stepNum = dayNumber !== undefined ? dayNumber : 'unknown';
      const taskId = subtaskId ? subtaskId.replace(/[^a-zA-Z0-9]/g, '_') : 'unknown';
      const key = `@reflection_editor_draft_playbook_${playbookName}_step${stepNum}_task${taskId}`;
      return key;
    }

    // Fallback key for other sources - use date string instead of timestamp for consistency
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const sourceType = source ? source.replace(/[^a-zA-Z0-9]/g, '_') : 'freeform';
    return `@reflection_editor_draft_${sourceType}_${currentDate}`;
  }, [source, devotionalTitle, dayNumber, questionNumber, playbookTitle, subtaskId]);

  // Load draft when component mounts (only for new entries, not when editing)
  useEffect(() => {
    // Only load drafts when creating new entries, not when editing existing ones
    if (!isEditing) {
      const loadDraft = async () => {
        try {
          const draftKey = getDraftKey();
          const draft = await AsyncStorage.getItem(draftKey);
          if (draft) {
            const { content, title } = JSON.parse(draft);

            // Only load draft if there's actual meaningful content
            if ((content && content.trim()) || (title && title.trim())) {
              // Check if component is still mounted before state updates
              if (!isMountedRef.current) {return;}

              setNewEntry(prev => ({
                ...prev,
                content: content || prev.content,
                title: title || prev.title,
              }));

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
                else if (source === 'freeform' && !lockTitle && titleInputRef.current && !title) {
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
      loadDraft().catch((_error) => {
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
          // Include devotional metadata if available
          ...(devotionalTitle && { devotionalTitle }),
          ...(dayNumber !== undefined && { dayNumber }),
          ...(dayTitle && { dayTitle }),
          ...(totalDays !== undefined && { totalDays }),
          ...(questionNumber !== undefined && { questionNumber }),
          // Include other metadata
          ...(source && { source }),
        };

        await AsyncStorage.setItem(
          getDraftKey(),
          JSON.stringify(draftData)
        );
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
      if (!isMountedRef.current) {return;}

      setNewEntry(prev => ({ ...prev, title: initialTitle }));

      // If this is a guided prompt, set selectedPrompt
      // Check both source and if the title matches a guided prompt
      const allGuidedPrompts = guidedPromptGating.allPrompts || [];
      if ((source === 'guided' || allGuidedPrompts.includes(initialTitle)) && initialTitle) {
        if (isMountedRef.current) {
          setSelectedPrompt(initialTitle);
        }
      }
    }
  }, [initialTitle, source, guidedPromptGating.allPrompts, newEntry.title]);

  // Keep FABs at fixed initial position - no keyboard animation
  React.useEffect(() => {
    // Set FAB to fixed initial position and keep it there
    fabAnimatedValue.setValue(16);

    // Still track keyboard height for other potential uses, but don't move FABs
    const showSub = Keyboard.addListener('keyboardDidShow', (e: any) => {
      if (isMountedRef.current) {
        setKeyboardHeight(e.endCoordinates.height);
        // FABs stay at initial position - no animation
      }
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      if (isMountedRef.current) {
        setKeyboardHeight(0);
        // FABs stay at initial position - no animation
      }
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [fabAnimatedValue]);

  // Animation for formatting modal
  React.useEffect(() => {
    if (showFormattingModal) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Animation completion callback with safety check
        if (!isMountedRef.current) {return;}
      });
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        // Animation completion callback with safety check
        if (!isMountedRef.current) {return;}
      });
    }
  }, [showFormattingModal, slideAnim]);

  // Auto-focus appropriate input for new entries
  useEffect(() => {
    // For dashboard smart journaling (thoughts source), always focus content input
    if (!isEditing && source === 'thoughts' && contentInputRef.current) {
      createManagedTimeout(() => {
        if (contentInputRef.current) {
          logFocus('auto-focus effect', 'content');
          contentInputRef.current.focus();
        }
      }, 300);
    }
    // For freeform mode with unlocked title, focus title input only if title is empty
    else if (!isEditing && !lockTitle && titleInputRef.current && !newEntry.title.trim()) {
      // Add a small delay to ensure the component is fully rendered
      createManagedTimeout(() => {
        if (titleInputRef.current && !newEntry.title.trim()) {
          logFocus('auto-focus effect', 'title');
          titleInputRef.current.focus();
        }
      }, 300);
    }
  }, [isEditing, lockTitle, source, newEntry.title]);

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
    const promptToCheck = selectedPrompt || (guidedPromptGating.allPrompts.includes(newEntry.title) ? newEntry.title : null);


    if (promptToCheck) {
      // Use async canUsePrompt method
      const canUseResult = await guidedPromptGating.canUsePrompt(promptToCheck);

      if (!canUseResult) {
        // Close the reflection modal first so the sales offer shows in front
        if (onUpgradeRequired) {
          try { onUpgradeRequired(); } catch {}
        }
        // Wait briefly for modal animation before navigating
        setTimeout(() => {
          (navigation as any).navigate('OnboardingSalesOffer', {
            source: 'guided_prompts_lock',
            feature: 'guided_prompts',
            tier: subscription?.tier || 'seeker',
            upgradeMode: false,
            skipNotificationPreference: true,
            returnToReflection: true,
          });
        }, 300);
        return; // Block the save
      }
    }

    // Clear any existing draft since we're saving the entry
    try {
      await AsyncStorage.removeItem(getDraftKey());
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
    const entryType = promptToCheck ? 'guided' : viewMode;


    const entry = {
      title: newEntry.title.trim(),
      content: normalizeOutgoing(newEntry.content).trim(),
      tags: newEntry.tags,
      date: dateString ? new Date(dateString) : new Date(), // Use dateString if provided, fallback to current date
      type: entryType,  // Use the determined type
      ...(promptToCheck && { prompt: promptToCheck }),
      ...(source && { source }),
      // Include devotional metadata if available
      ...(devotionalTitle && { devotionalTitle }),
      ...(dayNumber !== undefined && { dayNumber }),
      ...(dayTitle && { dayTitle }),
      ...(totalDays !== undefined && { totalDays }),
      ...(questionNumber !== undefined && { questionNumber }),
    };

    // NOTE: Do NOT call Keyboard.dismiss() here - it should remain open for user convenience
    // The keyboard dismissal behavior differs between dashboard and journal contexts
    onSave(entry);
  };

  // Always show free-form editor if we have a prompt or source is devotional
  const effectiveViewMode = viewMode;

  // Cancel handler
  const handleCancel = async () => {
    // Haptic feedback for cancel/close
    triggerLightHaptic();
    try {
      // Save draft before canceling (only if user made changes)
      if (hasUserMadeChanges) {
        await saveDraftHelper();
      }

      // Clear all pending timeouts to prevent delayed focus
      clearAllTimeouts();

      // Ensure text inputs release focus so keyboard doesn't reappear
      // Only blur if the input is currently focused to avoid unnecessary focus/blur cycle
      if (titleInputRef.current && titleInputRef.current.isFocused()) {
        titleInputRef.current.blur();
      }
      if (contentInputRef.current && contentInputRef.current.isFocused()) {
        contentInputRef.current.blur();
      }

      if (isKeyboardVisible) {
        Keyboard.dismiss();
        // Longer delay to ensure keyboard is fully dismissed before closing modal
        setTimeout(() => {
          onCancel();
        }, 200);
      } else {
        onCancel();
      }
    } catch (error) {
      // Clear all pending timeouts to prevent delayed focus
      clearAllTimeouts();

      if (titleInputRef.current) {
        titleInputRef.current.blur();
      }
      if (contentInputRef.current) {
        contentInputRef.current.blur();
      }
      if (isKeyboardVisible) {
        Keyboard.dismiss();
      }
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
            onCancel(); // Close the modal after deletion
          },
        },
      ],
    );
  };

  return (
    <View style={s.container}>
      {showDraftNotification && (
        <View style={s.draftNotification}>
          <Ionicons name="time-outline" size={20} color={Colors.hopeWhite} style={s.draftIcon} />
          <ThemedText weight="medium" style={s.draftText}>Draft Restored</ThemedText>
        </View>
      )}
      <StatusBar hidden />
    <View style={s.backgroundContainer} />
      <View style={s.header}>
      {!!dateString && (
        <ThemedText weight="bold" style={s.title}>{dateString}</ThemedText>
      )}
      <View style={s.modeToggle}>
        {/* Show pencil icon for playbook/devotional sources (display only), hide for guided when hidePencilIcon is true */}
        {((source === 'devotional' || source === 'playbook') || (source === 'guided' && !hidePencilIcon)) && (
          <View style={s.modeButton} pointerEvents="none">
            <Animated.View
              style={{
                transform: [
                  {
                    translateX: iconsSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -40],
                    }),
                  },
                ],
              }}
            >
              <Pencil
                size={22}
                color={Colors.alertCoral}
                fill={Colors.alertCoral}
                strokeWidth={1.5}
              />
            </Animated.View>
          </View>
        )}
        {/* Always show pencil toggle for freeform switching */}
        {source !== 'devotional' && source !== 'playbook' && source !== 'guided' && (
          <TouchableOpacity
            style={s.modeButton}
            disabled={viewMode === 'free-form' && !selectedPrompt} // Only disable when already in true free-form mode (no selected prompt)
            onPress={async () => {
            // Haptic for switching to free-form mode
            triggerLightHaptic();

            // If already in free-form mode, check if this is actually a guided prompt
            if (viewMode === 'free-form') {
              // If this is a guided prompt that was opened in free-form mode, convert to true free-form
              if (selectedPrompt || (guidedPromptGating.allPrompts || []).includes(newEntry.title)) {

                // Clear everything to create true free-form mode
                setNewEntry(prev => ({
                  ...prev,
                  content: '',
                  title: '',
                }));
                setSelectedPrompt('');

                // Focus title input
                createManagedTimeout(() => {
                  titleInputRef.current?.focus();
                }, 100);
                return;
              } else {

                return;
              }
            }

            // If coming from guided mode (based on current viewMode, not selectedPrompt)
            const switchingFromGuided = viewMode === 'guided';
            if (switchingFromGuided) {
              // If there's content, show confirmation
              if (newEntry.content.trim()) {
                const shouldProceed = await new Promise<boolean>((resolve) => {
                  Alert.alert(
                    'Switch to Free-Form Mode',
                    'Switching to free-form mode will clear your current reflection. Your work will be saved as a draft.',
                    [
                      {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => resolve(false),
                      },
                      {
                        text: 'Save Draft',
                        style: 'default',
                        onPress: async () => {
                          try {
                            await saveDraftHelper();
                            resolve(true);
                          } catch (error) {
                            Logger.error('Error saving draft', error as Error, { component: 'ReflectionLogEditor' });
                            resolve(false);
                          }
                        },
                      },
                      {
                        text: 'Discard',
                        style: 'destructive',
                        onPress: () => resolve(true),
                      },
                    ]
                  );
                });

                if (!shouldProceed) {
                  return; // User cancelled or saved draft
                }
              }

              // Switching from guided to true free-form: clear both title and content
              setNewEntry(prev => ({
                ...prev,
                content: '',
                title: '', // Clear title for true free-form mode
              }));
            }

            setViewMode('free-form');
            // Clear selectedPrompt to create true free-form mode (no gating, no locks)
            setSelectedPrompt('');

            // Also clear the source to prevent title locking
            // Note: This is a local state change, doesn't affect the original source prop

            // Focus the title input for true free-form mode
            createManagedTimeout(() => {
              titleInputRef.current?.focus();
            }, 100);
          }}
        >
          <Animated.View
            style={{
              transform: [
                {
                  translateX: iconsSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -40],
                  }),
                },
              ],
            }}
          >
            <Pencil
              size={22}
              color={viewMode === 'free-form' && !selectedPrompt ? Colors.alertCoral : Colors.trustGrey}
              fill={viewMode === 'free-form' && !selectedPrompt ? Colors.alertCoral : Colors.trustGrey}
              strokeWidth={1.5}
            />
          </Animated.View>
        </TouchableOpacity>
        )}
        {/* Delete icon - only visible in edit mode and when onDelete is provided */}
        {isEditing && onDelete && (
          <TouchableOpacity
            style={s.modeButton}
            onPress={handleDelete}
          >
            <Animated.View
              style={{
                transform: [
                  {
                    translateX: iconsSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -40],
                    }),
                  },
                ],
              }}
            >
              <Trash2
                size={22}
                color={Colors.trustGrey}
                strokeWidth={1.5}
              />
            </Animated.View>
          </TouchableOpacity>
        )}
        {/* Show guided prompt icon for new entries only (not when editing) */}
        {(() => {
          return !isEditing && source !== 'devotional' && source !== 'playbook' && !hideGuidedPromptButton;
        })() && (
          <TouchableOpacity
            style={[s.modeButton, (selectedPrompt || viewMode === 'guided') && s.activeModeButton]}
            disabled={!!selectedPrompt || viewMode === 'guided'} // Disable when active
            onPress={() => {
              // Haptic for switching to guided mode
              triggerLightHaptic();
              // Always reset to show the prompt selection
              setViewMode('guided');
              // Don't clear selectedPrompt - keep track of the original prompt to prevent loophole
              // setSelectedPrompt(''); // REMOVED - this was causing the gating loophole

              // Reset the entry content but keep any existing title
              setNewEntry(prev => ({
                ...prev,
                content: '',
                title: prev.title || '',
              }));

              // Hide keyboard when switching to guided mode
              Keyboard.dismiss();
            }}
          >
            <Animated.View
              style={{
                transform: [
                  {
                    translateX: iconsSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -40],
                    }),
                  },
                ],
              }}
            >
              <Ionicons
                name="heart"
                size={24}
                color={selectedPrompt || viewMode === 'guided' ? Colors.alertCoral : Colors.trustGrey}
              />
            </Animated.View>
          </TouchableOpacity>
        )}
        {/* Close button for guided mode - animates in from right beside heart icon */}
        <Animated.View
          style={[
            s.closeButtonContainer,
            {
              opacity: closeButtonAnim,
              transform: [
                {
                  translateX: closeButtonAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
                {
                  scale: closeButtonAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              onCancel();
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(255, 107, 107, 0.2)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <X
              size={16}
              color={Colors.alertCoral}
              strokeWidth={3}
            />
          </TouchableOpacity>
        </Animated.View>
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
          keyboardShouldPersistTaps="handled"
        >
          {effectiveViewMode === 'free-form' ? (
            <>
              {(() => {
                // Lock title if:
                // 1. Explicit lock flag is set, OR
                // 2. Source is devotional/playbook AND we have content, OR
                // 3. There's a selected prompt, OR
                // 4. Title matches a guided prompt
                const shouldLockTitle = lockTitle ||
                                       ((source === 'devotional' || source === 'playbook') && (newEntry.title || newEntry.content)) ||
                                       selectedPrompt ||
                                       (guidedPromptGating.allPrompts || []).includes(newEntry.title);

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
                        { fontSize: lockedTitleFontSize },
                      ]}
                    >
                      {initialTitle || newEntry.title}
                    </ThemedText>
                    {isSelectedPromptLocked && (
                      <GuidedPromptLockIcon
                        tier={subscription?.tier || 'seeker'}
                        usedPrompts={guidedPromptGating.usedPrompts}
                        context="inApp"
                        onLockTap={() => {
                          if (onUpgradeRequired) {
                            onUpgradeRequired();
                          }
                          setTimeout(() => {
                            (navigation as any).navigate('OnboardingSalesOffer', {
                              source: 'guided_prompts_lock',
                              feature: 'guided_prompts',
                              tier: subscription?.tier || 'seeker',
                              upgradeMode: false,
                              skipNotificationPreference: true,
                              returnToReflection: true,
                            });
                          }, 300);
                        }}
                        size={20}
                        position="right"
                        prompt={selectedPrompt}
                        forceShow={true}
                        style={s.titleLockIcon}
                      />
                    )}
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
                      { fontFamily: fontFamilyBold, fontSize: titleFontSize },
                    ]}
                    placeholder="Name Your Reflection..."
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    value={newEntry.title}
                    onChangeText={(text: string) => {
                      setNewEntry({ ...newEntry, title: text });
                      checkForChanges(newEntry.content, text);
                    }}
                    keyboardAppearance="dark"
                    onFocus={() => {
                      // In edit mode, position cursor at end instead of selecting all
                      if (isEditing && titleInputRef.current) {
                        createManagedTimeout(() => {
                          const textLength = newEntry.title.length;
                          titleInputRef.current?.setNativeProps({
                            selection: { start: textLength, end: textLength },
                          });
                        }, 10);
                      }
                    }}
                    underlineColorAndroid="transparent"
                    multiline={true}
                  />
                  {isSelectedPromptLocked && (
                    <GuidedPromptLockIcon
                      tier={subscription?.tier || 'seeker'}
                      usedPrompts={guidedPromptGating.usedPrompts}
                      context="inApp"
                      onLockTap={() => {
                        if (onUpgradeRequired) {
                          onUpgradeRequired();
                        }
                        setTimeout(() => {
                          (navigation as any).navigate('OnboardingSalesOffer', {
                            source: 'guided_prompts_lock',
                            feature: 'guided_prompts',
                            tier: subscription?.tier || 'seeker',
                            upgradeMode: false,
                            skipNotificationPreference: true,
                            returnToReflection: true,
                          });
                        }, 300);
                      }}
                      size={20}
                      position="right"
                      prompt={selectedPrompt}
                      forceShow={true}
                      style={s.titleLockIcon}
                    />
                  )}
                </View>
              )}

              {/* Simple Text Input */}
              <TextInput
                ref={contentInputRef}
                style={[
                  s.entryInput,
                  s.entryContentInput,
                  { fontFamily: fontFamilyRegular },
                ]}
                placeholder="Pour out your thoughts..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={newEntry.content}
                onChangeText={(text) => {
                  setNewEntry({ ...newEntry, content: text });
                  checkForChanges(text, newEntry.title);
                }}
                multiline
                keyboardAppearance="dark"
                textAlignVertical="top"
                autoFocus={!isEditing}
              />
              {(source === 'devotional' || (devotionalTitle && source !== 'thoughts')) && (
                <View style={s.metadataContainer}>
                  <View style={s.verticalLine} />
                  <View>
                  <ThemedText weight="medium" style={s.fromText}>
                    FROM
                  </ThemedText>
                  {totalDays && (
                    <ThemedText style={s.metadataText}>
                      {totalDays}-day {totalDays > 1 ? 'Devotional Series' : 'Devotional'}
                    </ThemedText>
                  )}
                  {devotionalTitle && (
                    <ThemedText style={s.metadataText}>
                      {devotionalTitle}
                    </ThemedText>
                  )}
                  {dayNumber && dayTitle && totalDays !== 1 && (
                    <ThemedText style={s.metadataTextWithLineHeight}>
                      Day {dayNumber}: {(() => {
                        // Check if title includes "Bible verse" or "bible verse"
                        const lowerTitle = dayTitle.toLowerCase();
                        const bibleVerseIndex = lowerTitle.indexOf('bible verse');

                        if (bibleVerseIndex !== -1) {
                          // Split the title into parts
                          const beforeBibleVerse = dayTitle.substring(0, bibleVerseIndex);
                          const bibleVersePart = dayTitle.substring(bibleVerseIndex, bibleVerseIndex + 11); // "Bible verse" is 11 chars
                          const afterBibleVerse = dayTitle.substring(bibleVerseIndex + 11);

                          return (
                            <>
                              {beforeBibleVerse}
                              <ThemedText style={s.metadataTextSmall}>
                                {bibleVersePart}
                              </ThemedText>
                              {afterBibleVerse}
                            </>
                          );
                        }
                        return dayTitle;
                      })()}
                    </ThemedText>
                  )}
                  {questionNumber && (
                    <ThemedText style={s.metadataText}>
                      Question to Ponder #{questionNumber}
                    </ThemedText>
                  )}
                  </View>
                </View>
              )}
              {(source === 'playbook' || (playbookTitle && (source === 'thoughts' || source !== 'freeform'))) && (
                <PlaybookMetaSection
                  playbookTitle={playbookTitle}
                  actionLabel={dayNumber && dayTitle
                    ? (dayTitle === 'Suggestion' ? 'SUGGESTION' : `Action ${dayNumber}: ${dayTitle}`)
                    : undefined}
                  stepBody={stepBody}
                  stepExample={stepExample}
                />
              )}
            </>
          ) : (
            <View style={s.guidedContainer}>
              <View style={s.promptGrid}>
                {sortedGuidedPrompts.map((prompt: string, index: number) => {
                  return (
                    <View
                      key={index}
                      style={s.promptCard}
                    >
                      {/* Lock icon in upper right corner */}
                      <View style={s.lockIconContainer}>
                        <GuidedPromptLockIcon
                          tier={subscription?.tier || 'seeker'}
                          usedPrompts={guidedPromptGating.usedPrompts}
                          context="inApp"
                          onLockTap={() => {
                            if (onUpgradeRequired) {
                              onUpgradeRequired();
                            }
                            setTimeout(() => {
                              (navigation as any).navigate('OnboardingSalesOffer', {
                                source: 'guided_prompts_lock',
                                feature: 'guided_prompts',
                                tier: subscription?.tier || 'seeker',
                                upgradeMode: false,
                                skipNotificationPreference: true,
                                returnToReflection: true,
                              });
                            }, 300);
                          }}
                          size={16}
                          position="right"
                          prompt={prompt}
                          forceShow={!(guidedPromptGating.freePrompts || []).includes(prompt)} // Show lock for non-free prompts
                        />
                      </View>

                      <View style={s.promptTextContainer}>
                        <ThemedText style={s.promptCardText}>{prompt}</ThemedText>
                      </View>
                      <TouchableOpacity
                        style={s.reflectLabel}
                        onPress={async () => {
                          // Haptic on selecting a guided prompt
                          triggerLightHaptic();

                          // Always allow selecting any prompt - gating happens on save
                          setSelectedPrompt(prompt);
                          setViewMode('free-form');

                          // Force a state update to ensure the view mode is applied
                          requestAnimationFrame(() => {
                            setNewEntry(prev => ({
                              ...prev,
                              title: prompt,
                              content: prev.content || '',
                              tags: prev.tags || [],
                            }));

                            // Focus the content input after the view switches
                            createManagedTimeout(() => {
                              contentInputRef.current?.focus();
                            }, 50);
                          });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Reflect"
                      >
                        <Pencil size={16} color={Colors.hopeWhite} style={s.buttonIcon} />
                        <ThemedText weight="medium" style={s.reflectLabelText}>Reflect</ThemedText>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Floating Action Buttons - Only show in free-form mode */}
      {effectiveViewMode === 'free-form' && (
        <View style={s.fabWrapper}>
          {/* Right Action Buttons */}
          <Animated.View style={[
            s.fabContainer,
            { bottom: fabAnimatedValue },
          ]}>
            <View style={s.fabRow}>
              {/* Cancel FAB */}
              <TouchableOpacity
                style={[s.fab, s.cancelFab]}
                onPress={() => {
                  triggerLightHaptic();
                  handleCancel();
                }}
              >
                <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>

              {/* Save FAB */}
              <TouchableOpacity
                style={[
                  s.fab,
                  s.saveFab,
                  (!newEntry.title.trim() || !newEntry.content.trim() || !hasUserMadeChanges || isLoading) && s.fabDisabled,
                ]}
                disabled={!newEntry.title.trim() || !newEntry.content.trim() || !hasUserMadeChanges || isLoading}
                onPress={() => {
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
          </Animated.View>
        </View>
      )}
    </KeyboardAvoidingView>

  </View>
  );
});

export default ReflectionLogEditor;

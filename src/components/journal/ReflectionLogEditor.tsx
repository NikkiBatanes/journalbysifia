import React, { useEffect, useRef, useImperativeHandle } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Keyboard, Alert, ActivityIndicator, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil, Trash2 } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { GUIDED_PROMPTS } from './reflectionConstants';



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
}

export interface ReflectionLogEditorRef {
  focusInput: () => void;
}

// Fallback styles in case styles prop is not provided
const fallbackStyles = {
  container: { flex: 1, backgroundColor: Colors.anchorBlue },
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
    lineHeight: 12,
  },
  lastMetadataText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 4,
    lineHeight: 12,
  },
  header: { padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', color: Colors.hopeWhite, marginBottom: 8 },

  keyboardAvoidingView: { flex: 1 },
  contentCard: { flex: 1, backgroundColor: 'rgba(26,60,109,0.08)', borderRadius: 12, margin: 16, padding: 16 },
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
  reflectLabel: { marginTop: 8, backgroundColor: Colors.growthGreen, borderRadius: 8, padding: 6, alignItems: 'center' },
  reflectLabelText: { color: Colors.hopeWhite, fontWeight: 'bold' },
  lockedTitleText: {
    color: Colors.hopeWhite,
    opacity: 0.9,
    includeFontPadding: false, // Match TextInput behavior
    textAlignVertical: 'center', // Ensure consistent alignment
  },
  editableTitle: {
    opacity: 0.9, // Moved from inline style to fix lint warning
  },
  fabWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
  previewToggleText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    marginLeft: 6,
    fontWeight: '500',
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
  },
  ref
) => {
  // Merge styles prop with fallbackStyles
  const s = { ...fallbackStyles, ...styles };
  // Internal state - manage view mode
  const [viewMode, setViewMode] = React.useState<'free-form' | 'guided'>(
    (source === 'devotional' || initialPrompt) ? 'free-form' : (initialMode || 'free-form')
  );

  // Update view mode when initialMode or source changes
  React.useEffect(() => {
    if (source === 'devotional' || initialPrompt) {
      setViewMode('free-form');
    } else {
      setViewMode(initialMode || 'free-form');
    }
  }, [initialMode, source, initialPrompt]);

  // Helper function to convert markdown to HTML for Quill
  const markdownToHtml = (markdown: string): string => {
    if (!markdown) {return '';}

    // Simple markdown to HTML conversion for basic formatting
    return markdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/^# (.*$)/gim, '<h1>$1</h1>') // H1
      .replace(/^## (.*$)/gim, '<h2>$1</h2>') // H2
      .replace(/^### (.*$)/gim, '<h3>$1</h3>') // H3
      .replace(/^- (.*$)/gim, '<li>$1</li>') // List items
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>') // Blockquotes
      .replace(/\n/g, '<br>'); // Line breaks
  };


  const [newEntry, setNewEntry] = React.useState<{ title: string; content: string; tags: string[] }>(
    {
      title: initialEntry.title || initialTitle || '',
      content: initialEntry.content ? markdownToHtml(initialEntry.content) : '',
      tags: initialEntry.tags || [],
    }
  );

  // Check if we're editing an existing entry (has content)
  const isEditing = !!initialEntry.content;
  const [selectedPrompt, setSelectedPrompt] = React.useState<string>('');
  const [showAddMenu, setShowAddMenu] = React.useState(false);
  const [showFormattingModal, _setShowFormattingModal] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const slideAnim = useRef(new Animated.Value(300)).current; // Start 300px below screen

  // Refs
  const titleInputRef = useRef<TextInput>(null);
  const contentInputRef = useRef<TextInput>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      if (contentInputRef.current) {
        contentInputRef.current.focus();
        // Position cursor at the end of the text
        setTimeout(() => {
          if (contentInputRef.current) {
            contentInputRef.current.setSelection(newEntry.content.length, newEntry.content.length);
          }
        }, 100);
      }
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
    console.log('[ReflectionLogEditor] getDraftKey:', { source, devotionalTitle, dayNumber, questionNumber });

    if (source === 'devotional' && devotionalTitle && dayNumber !== undefined && questionNumber !== undefined) {
      // Create unique key for each devotional question
      const key = `@reflection_editor_draft_${devotionalTitle.replace(/[^a-zA-Z0-9]/g, '_')}_day${dayNumber}_q${questionNumber}`;
      console.log('[ReflectionLogEditor] Devotional draft key:', key);
      return key;
    }

    if (source === 'playbook') {
      // Create unique key for each playbook subtask reflection
      const playbookName = playbookTitle ? playbookTitle.replace(/[^a-zA-Z0-9]/g, '_') : 'unknown';
      const stepNum = dayNumber !== undefined ? dayNumber : 'unknown';
      const taskId = subtaskId ? subtaskId.replace(/[^a-zA-Z0-9]/g, '_') : 'unknown';
      const key = `@reflection_editor_draft_playbook_${playbookName}_step${stepNum}_task${taskId}`;
      console.log('[ReflectionLogEditor] Playbook draft key:', key);
      return key;
    }

    // Default key for other reflections
    const key = '@reflection_editor_draft';
    console.log('[ReflectionLogEditor] Default draft key:', key);
    return key;
  }, [source, devotionalTitle, playbookTitle, dayNumber, questionNumber, subtaskId]);

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

              // Focus the content input after a short delay
              setTimeout(() => {
                if (content && contentInputRef.current) {
                  contentInputRef.current.focus();
                }
              }, 100);

              // Only show notification when draft is actually loaded (not in edit mode)
              let timer: NodeJS.Timeout | undefined;
              if (isFirstLoad && !isEditing) {
                // Delay showing notification until modal is fully open
                setTimeout(() => {
                  setShowDraftNotification(true);
                }, 500);

                // Hide notification after 4 seconds
                timer = setTimeout(() => {
                  setShowDraftNotification(false);
                }, 4500); // 500ms delay + 4000ms display
              }

              // Mark that first load is complete
              setIsFirstLoad(false);

              return timer ? () => clearTimeout(timer) : undefined;
            }
          }
        } catch (error) {
          console.error('Error loading draft:', error);
        }
      };

      loadDraft();
    }
  }, [getDraftKey, isEditing, isFirstLoad]);

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
      console.error('Error saving draft:', error);
    }
  };

  // Clear draft when component unmounts (cleanup)
  useEffect(() => {
    return () => {
      // Only clear draft if the entry was saved (not cancelled)
      // This cleanup runs when component unmounts
    };
  }, []);

  // Update title when initialTitle changes and focus content if title is locked
  React.useEffect(() => {
    console.log('initialTitle changed:', initialTitle);
    if (initialTitle && (newEntry.title !== initialTitle || !newEntry.title)) {
      console.log('Updating title to:', initialTitle);
      setNewEntry(prev => ({ ...prev, title: initialTitle }));
    }
  }, [initialTitle, newEntry.title]);

  // Removed automatic focus when in locked title mode to prevent cursor from appearing automatically

  // Keyboard listeners for FAB
  React.useEffect(() => {
    const showSub = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillShow', (e: any) => setKeyboardHeight(e.endCoordinates.height))
      : Keyboard.addListener('keyboardDidShow', (e: any) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0))
      : Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Animation for formatting modal
  React.useEffect(() => {
    if (showFormattingModal) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showFormattingModal, slideAnim]);

  // Save handler - directly call onSave
  const handleSave = async () => {
    // Clear any existing draft since we're saving the entry
    try {
      await AsyncStorage.removeItem(getDraftKey());
    } catch (error) {
      console.error('Error clearing draft:', error);
    }

    // Determine the entry type - if there's a selected prompt, it's a guided entry
    const entryType = selectedPrompt ? 'guided' : viewMode;

    const entry = {
      title: newEntry.title.trim(),
      content: newEntry.content.trim(),
      tags: newEntry.tags,
      date: new Date(),
      type: entryType,  // Use the determined type
      ...(selectedPrompt && { prompt: selectedPrompt }),
      ...(source && { source }),
      // Include devotional metadata if available
      ...(devotionalTitle && { devotionalTitle }),
      ...(dayNumber !== undefined && { dayNumber }),
      ...(dayTitle && { dayTitle }),
      ...(totalDays !== undefined && { totalDays }),
      ...(questionNumber !== undefined && { questionNumber }),
    };

    console.log('📝 ReflectionLogEditor: Calling onSave directly');
    onSave(entry);
  };

  // Always show free-form editor if we have a prompt or source is devotional
  const effectiveViewMode = (source === 'devotional' || selectedPrompt) ? 'free-form' : viewMode;

  // Cancel handler
  const handleCancel = async () => {
    try {
      // Save draft before canceling (only if user made changes)
      if (hasUserMadeChanges) {
        await saveDraftHelper();
      }

      Keyboard.dismiss();
      // Small delay to ensure keyboard is fully dismissed before closing
      setTimeout(() => {
        onCancel();
      }, 10);
    } catch (error) {
      console.error('Error saving draft before cancel:', error);
      Keyboard.dismiss();
      onCancel();
    }
  };

  // Delete handler for saved entries
  const handleDelete = () => {
    if (!onDelete || !entryId) {
      console.warn('Delete function or entry ID not available');
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
          <Text style={s.draftText}>Draft Restored</Text>
        </View>
      )}
      <StatusBar hidden />
    <View style={s.backgroundContainer} />
    <View style={s.header}>
      <Text style={s.title}>{dateString}</Text>
      <View style={s.modeToggle}>
        {/* Always show pencil icon for free-form mode */}
        <TouchableOpacity
          style={s.modeButton}
          onPress={async () => {
            // If coming from guided mode
            if (selectedPrompt) {
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
                            console.error('Error saving draft:', error);
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

              // Always reset title and clear content when switching from guided mode
              setNewEntry(prev => ({
                ...prev,
                content: '',
                title: initialTitle || '',
              }));
            }

            setViewMode('free-form');
            setSelectedPrompt('');

            // Focus the title input after a short delay
            setTimeout(() => {
              titleInputRef.current?.focus();
            }, 100);
          }}
        >
          <Pencil
            size={22}
            color={viewMode === 'free-form' && !selectedPrompt ? Colors.alertCoral : Colors.inactiveIcon}
            fill={viewMode === 'free-form' && !selectedPrompt ? Colors.alertCoral : Colors.inactiveIcon}
            strokeWidth={1.5}
          />
        </TouchableOpacity>
        {/* Delete icon - only visible in edit mode and when onDelete is provided */}
        {isEditing && onDelete && (
          <TouchableOpacity
            style={s.modeButton}
            onPress={handleDelete}
          >
            <Trash2
              size={22}
              color={Colors.inactiveIcon}
              strokeWidth={1.5}
            />
          </TouchableOpacity>
        )}
        {/* Hide guided prompt icon for devotional and playbook sources */}
        {!isEditing && source !== 'devotional' && source !== 'playbook' && (
          <TouchableOpacity
            style={[s.modeButton, (selectedPrompt || viewMode === 'guided') && s.activeModeButton]}
            onPress={() => {
              // Always reset to show the prompt selection
              setViewMode('guided');
              setSelectedPrompt('');

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
            <Ionicons
              name="heart"
              size={24}
              color={selectedPrompt || viewMode === 'guided' ? Colors.alertCoral : Colors.inactiveIcon}
            />
          </TouchableOpacity>
        )}
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
              {lockTitle || (source && source !== 'freeform') ? (
                <Text
                  style={[
                    s.entryInput,
                    s.titleInput,
                    s.transparentInput,
                    s.lockedTitleText,
                  ]}
                >
                  {initialTitle || newEntry.title}
                </Text>
              ) : (
                <TextInput
                  ref={titleInputRef}
                  style={[
                    s.entryInput,
                    s.titleInput,
                    s.transparentInput,
                    s.editableTitle, // Match locked title opacity
                  ]}
                  placeholder="Name Your Reflection..."
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={newEntry.title}
                  onChangeText={(text: string) => {
                    setNewEntry({ ...newEntry, title: text });
                    checkForChanges(newEntry.content, text);
                  }}
                  onFocus={() => {
                    // In edit mode, position cursor at end instead of selecting all
                    if (isEditing && titleInputRef.current) {
                      setTimeout(() => {
                        const textLength = newEntry.title.length;
                        titleInputRef.current?.setNativeProps({
                          selection: { start: textLength, end: textLength },
                        });
                      }, 10);
                    }
                  }}
                  underlineColorAndroid="transparent"
                  selectionColor={Colors.hopeWhite}
                  multiline={true}
                />
              )}

              {/* Simple Text Input */}
              <TextInput
                ref={contentInputRef}
                style={[styles.entryInput, styles.entryContentInput]}
                placeholder="Write your reflection..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={newEntry.content}
                onChangeText={(text) => {
                  setNewEntry({ ...newEntry, content: text });
                  checkForChanges(text, newEntry.title);
                }}
                multiline
                textAlignVertical="top"
                autoFocus={!isEditing}
              />
              {(source === 'devotional') && (
                <View style={s.metadataContainer}>
                  <View style={s.verticalLine} />
                  <View>
                  <Text style={s.fromText}>
                    FROM
                  </Text>
                  {totalDays && (
                    <Text style={s.metadataText}>
                      {totalDays}-day {totalDays > 1 ? 'Devotional Series' : 'Devotional'}
                    </Text>
                  )}
                  {devotionalTitle && (
                    <Text style={s.metadataText}>
                      {devotionalTitle}
                    </Text>
                  )}
                  {dayNumber && dayTitle && totalDays !== 1 && (
                    <Text style={s.metadataText}>
                      Day {dayNumber}: {dayTitle}
                    </Text>
                  )}
                  {questionNumber && (
                    <Text style={s.metadataText}>
                      Question to Ponder #{questionNumber}
                    </Text>
                  )}
                  </View>
                </View>
              )}
              {(source === 'playbook') && (
                <View style={s.metadataContainer}>
                  <View style={s.verticalLine} />
                  <View>
                  <Text style={s.fromText}>
                    FROM PLAYBOOK
                  </Text>
                  {playbookTitle && (
                    <Text style={s.metadataText}>
                      {playbookTitle}
                    </Text>
                  )}
                  {dayNumber && dayTitle && (
                    <Text style={s.metadataText}>
                      Step {dayNumber}: {dayTitle}
                    </Text>
                  )}
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={s.guidedContainer}>
              <View style={s.promptGrid}>
                {GUIDED_PROMPTS.map((prompt: string, index: number) => (
                  <View
                    key={index}
                    style={s.promptCard}
                  >
                    <Text style={s.promptCardText}>{prompt}</Text>
                    <TouchableOpacity
                      style={s.reflectLabel}
                      onPress={async () => {
                        // First update the view mode
                        await setViewMode('free-form');

                        // Then update the prompt and entry
                        await setSelectedPrompt(prompt);

                        // Force a state update to ensure the view mode is applied
                        requestAnimationFrame(() => {
                          setNewEntry(prev => ({
                            ...prev,
                            title: prompt,
                            content: prev.content || '',
                            tags: prev.tags || [],
                          }));

                          // Focus the content input
                          setTimeout(() => {
                            contentInputRef.current?.focus();
                          }, 50);
                        });
                      }}
                    >
                      <Text style={s.reflectLabelText}>REFLECT ON IT</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Floating Action Buttons - Only show in free-form mode */}
      {effectiveViewMode === 'free-form' && (
        <View style={s.fabWrapper}>
          {/* Left Add FAB with Menu */}
          <View style={[
            s.fabContainer,
            s.leftFabContainer,
            Platform.OS === 'android' && keyboardHeight > 0
              ? [s.androidFabWithKeyboard, { bottom: keyboardHeight + 4 }]
              : s.fabDefaultPosition,
          ]}>
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
          <View style={[
            s.fabContainer,
            Platform.OS === 'android' && keyboardHeight > 0
              ? [s.androidFabWithKeyboard, { bottom: keyboardHeight + 4 }]
              : s.fabDefaultPosition,
          ]}>
            <View style={s.fabRow}>
              {/* Cancel FAB */}
              <TouchableOpacity
                style={[s.fab, s.cancelFab]}
                onPress={handleCancel}
              >
                <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.6)" />
              </TouchableOpacity>

              {/* Save FAB */}
              <TouchableOpacity
                style={[
                  s.fab,
                  s.saveFab,
                  (!newEntry.title.trim() || !newEntry.content.trim() || !hasUserMadeChanges || isLoading) && s.fabDisabled,
                ]}
                disabled={!newEntry.title.trim() || !newEntry.content.trim() || !hasUserMadeChanges || isLoading}
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
      )}
    </KeyboardAvoidingView>


  </View>
  );
});

export default ReflectionLogEditor;

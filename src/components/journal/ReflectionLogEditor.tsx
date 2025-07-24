import React, { useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Keyboard, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { GUIDED_PROMPTS } from './ReflectionLog';

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
  devotionalTitle?: string;
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
  styles?: any;
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
  modeToggle: { flexDirection: 'row', marginBottom: 16 },
  modeButton: { marginRight: 12 },
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
  leftFabContainer: {},
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
  // Metadata styles moved to inline styles to prevent override
};

const ReflectionLogEditor: React.FC<ReflectionLogEditorProps> = ({
  onSave,
  onCancel,
  devotionalTitle,
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
  styles,
}) => {
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
  const [newEntry, setNewEntry] = React.useState<{ title: string; content: string; tags: string[] }>(
    {
      title: initialEntry.title || initialTitle || '',
      content: initialEntry.content || '',
      tags: initialEntry.tags || [],
    }
  );

  // Check if we're editing an existing entry (has content)
  const isEditing = !!initialEntry.content;
  const [selectedPrompt, setSelectedPrompt] = React.useState<string>('');
  const [showAddMenu, setShowAddMenu] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);

  // Refs
  const titleInputRef = useRef<TextInput>(null);
  const contentInputRef = useRef<TextInput>(null);

  // State for showing draft notification
  const [showDraftNotification, setShowDraftNotification] = React.useState(false);

  // Helper function to get draft key (unique for each devotional question)
  const getDraftKey = React.useCallback(() => {
    if (source === 'devotional' && devotionalTitle && dayNumber !== undefined && questionNumber !== undefined) {
      // Create unique key for each devotional question
      return `@reflection_editor_draft_${devotionalTitle}_day${dayNumber}_q${questionNumber}`;
    }
    // Default key for non-devotional reflections
    return '@reflection_editor_draft';
  }, [source, devotionalTitle, dayNumber, questionNumber]);

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

            // Only load draft if there's actual content
            if (content || title) {
              setNewEntry(prev => ({
                ...prev,
                content: content || prev.content,
                title: title || prev.title,
              }));

              // Show notification
              setShowDraftNotification(true);

              // Hide notification after 4 seconds
              const timer = setTimeout(() => {
                setShowDraftNotification(false);
              }, 4000);

              // Clear the draft after loading it
              await AsyncStorage.removeItem(draftKey);

              return () => clearTimeout(timer);
            }
          }
        } catch (error) {
          console.error('Error loading draft:', error);
        }
      };

      loadDraft();
    }
  }, [getDraftKey, isEditing]);

  // Helper function to save draft
  const saveDraftHelper = async () => {
    try {
      // Only save draft if there's actual content
      if (newEntry.content.trim() || newEntry.title.trim()) {
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

  // Save handler
  const handleSave = async () => {
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

    // Clear any existing draft since we're saving the entry
    try {
      await AsyncStorage.removeItem(getDraftKey());
    } catch (error) {
      console.error('Error clearing draft:', error);
    }

    onSave(entry);
  };

  // Always show free-form editor if we have a prompt or source is devotional
  const effectiveViewMode = (source === 'devotional' || selectedPrompt) ? 'free-form' : viewMode;

  // Cancel handler
  const handleCancel = async () => {
    try {
      // Save draft before canceling (only if there's content)
      await saveDraftHelper();

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
        {/* Hide guided prompt icon for devotional source */}
        {!isEditing && source !== 'devotional' && (
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
                  onChangeText={(text: string) => setNewEntry({ ...newEntry, title: text })}
                  underlineColorAndroid="transparent"
                  selectionColor={Colors.hopeWhite}
                  multiline={true}
                />
              )}
              <TextInput
                ref={contentInputRef}
                style={[s.entryInput, s.entryContentInput, s.transparentInput]}
                placeholder="Pour out your thoughts..."
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                multiline
                value={newEntry.content}
                onChangeText={(text: string) => setNewEntry({ ...newEntry, content: text })}
                underlineColorAndroid="transparent"
                selectionColor={Colors.hopeWhite}
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
                  (!newEntry.title.trim() || !newEntry.content.trim()) && s.fabDisabled,
                ]}
                disabled={!newEntry.title.trim() || !newEntry.content.trim()}
                onPress={handleSave}
              >
                <Ionicons name="checkmark" size={20} color={Colors.hopeWhite} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  </View>
  );
};

export default ReflectionLogEditor;

import React, { useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Alert, ActivityIndicator, Keyboard } from 'react-native';

import { Pencil } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import { toLocalDateString } from '../../utils/date';
import { useNavigation } from '@react-navigation/native';
import { useSubscription } from '../../hooks/useSubscription';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { triggerLightHaptic } from '../../utils/haptics';
import PlaybookMetaSection from './PlaybookMetaSection';

interface PrayerLogEditorProps {
  onSave: (data: {
    content: string;
    date: Date;
    activeTab: 'freeform' | 'people';
    prayerForPerson?: string;
    prayerRequest?: string;
  }) => void;
  onCancel: () => void;
  onUpgradeRequired?: () => void; // Callback to close modal before navigating to upgrade
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
  // New: allow parent to preselect People tab and prefill fields
  initialActiveTab?: 'freeform' | 'people';
  initialPersonName?: string;
  initialPrayerRequest?: string;
  stepBody?: string;
  stepExample?: string | null;
}

export interface PrayerLogEditorRef {
  focusInput: () => void;
}

// Styles matching reflection log editor pattern
const defaultStyles = {
  // Main container styles (matching reflection editor)
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.anchorBlue,
    zIndex: -2,
  },
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },

  // Header styles
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
  headerLeft: {
    flex: 1,
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.anchorBlue,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.anchorBlue,
    opacity: 0.7,
    marginTop: 2,
  },

  // FAB styles
  fabWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.anchorBlue,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1000,
  },
  fabDefaultPosition: {
    bottom: 20,
    right: 20,
  },
  fabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fab: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  saveFab: {
    backgroundColor: Colors.anchorBlue,
  },
  cancelFab: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  fabDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    opacity: 0.5,
  },

  // Date and metadata styles
  dateContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.anchorBlue,
  },
  dateText: {
    color: Colors.hopeWhite,
    fontSize: 12,
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 8,
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
  entryContentInput: {
    minHeight: 200,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  lockedTitleText: {
    color: Colors.hopeWhite,
    opacity: 0.9,
    includeFontPadding: false,
    textAlignVertical: 'center',
    marginBottom: 20, // Space below title
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleTextFlex: {
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
    backgroundColor: Colors.anchorBlue,
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

  // Compact view styles (for card view)
  compactCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginBottom: 12,
  },
  compactHeader: {
    width: '100%',
  },
  compactDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  compactDate: {
    color: Colors.hopeWhite,
    fontSize: 14,
    opacity: 0.8,
  },
  compactTitle: {
    color: Colors.hopeWhite,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  compactSubtitle: {
    color: Colors.hopeWhite,
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  compactContent: {
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.9,
  },
  compactActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  compactButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  compactButtonText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '500',
  },

  // Mode toggle styles (matching reflection editor)
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 4,
    alignItems: 'center',
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

  // Structured prayer styles
  structuredContainer: {
    padding: 20,
  },
  inputLabel: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  structuredInput: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    paddingBottom: 8,
    color: Colors.hopeWhite,
    fontSize: 16,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  multilineInput: {
    minHeight: 120,
  },
  gap: {
    height: 16,
  },
};

const PrayerLogEditor = React.forwardRef<PrayerLogEditorRef, PrayerLogEditorProps>((
  {
    onSave,
    onCancel: _onCancel,
    onUpgradeRequired,
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
    initialActiveTab,
    initialPersonName,
    initialPrayerRequest,
    stepBody,
    stepExample,
  },
  ref
) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const regularFont = getFontFamily(fontKey, 'regular');

  // Calculate estimated line count based on text length and newlines
  const calculateLineCount = (text: string, charsPerLine: number = 30): number => {
    if (!text || text.trim().length === 0) {return 1;}
    const newlineCount = (text.match(/\n/g) || []).length;
    const textWithoutNewlines = text.replace(/\n/g, '');
    const wrappedLines = Math.ceil(textWithoutNewlines.length / charsPerLine);
    return newlineCount + wrappedLines;
  };

  // Dynamic title font sizing - fixed size based on line count
  // Original: 22px, reduce to 18px if > 3 lines
  const titleFontSize = calculateLineCount(_subtaskTitle || '', 30) > 3 ? 18 : 22;
  const navigation = useNavigation();
  const { subscription } = useSubscription();
  const s = {
    ...defaultStyles,
    ...styles,
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
      },
  };
  const inputRef = useRef<TextInput>(null);
  const personInputRef = useRef<TextInput>(null);
  const requestInputRef = useRef<TextInput>(null);
  // Debug logging

  // State management
  const [prayerContent, setPrayerContent] = React.useState(initialContent);
  const [hasUserMadeChanges, setHasUserMadeChanges] = React.useState(false);
  const [isFirstLoad, setIsFirstLoad] = React.useState(true);
  // Commenting out add menu for MVP; keep state preserving future functionality
  // const [showAddMenu, setShowAddMenu] = React.useState(false);
  const [showDraftNotification, setShowDraftNotification] = React.useState(false);

  // Tab management
  const [activeTab, setActiveTab] = React.useState<'freeform' | 'people'>(initialActiveTab === 'people' ? 'people' : 'freeform');

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      if (activeTab === 'freeform') {
        // Focus the main prayer content input for freeform tab
        if (inputRef.current) {
          inputRef.current.focus();
          // Position cursor at the end of the text
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.setSelection(prayerContent.length, prayerContent.length);
            }
          }, 100);
        }
      } else {
        // Focus the first input (person name) for people tab
        if (personInputRef.current) {
          personInputRef.current.focus();
          // Position cursor at the end of the text
          setTimeout(() => {
            if (personInputRef.current) {
              personInputRef.current.setSelection(prayerForPerson.length, prayerForPerson.length);
            }
          }, 100);
        }
      }
    },
  }));

  // Structured prayer data for "Prayers for People" tab
  const [prayerForPerson, setPrayerForPerson] = React.useState(initialPersonName || '');
  const [prayerRequest, setPrayerRequest] = React.useState(initialPrayerRequest || '');

  const handlePersonChange = (text: string) => {
    setPrayerForPerson(text);
    if (!hasUserMadeChanges) {
      setHasUserMadeChanges(true);
    }
  };

  const handleRequestChange = (text: string) => {
    setPrayerRequest(text);
    if (!hasUserMadeChanges) {
      setHasUserMadeChanges(true);
    }
  };

  // Check if this is an edit session (has existing content)
  const isEditing = !!(initialContent && initialContent.trim());

  // Helper function to get unique draft key for each prayer and tab
  const getDraftKey = React.useCallback(() => {
    // Get current date for uniqueness
    const currentDate = toLocalDateString(new Date()); // Use local date format
    // Include active tab in the key
    const tabSuffix = `_${activeTab}`;

    if (subtaskId && stepId) {
      // Use subtaskId and stepId for maximum uniqueness
      const key = `@prayer_editor_draft_${stepId}_${subtaskId}_${currentDate}${tabSuffix}`;

      return key;
    }

    if (_subtaskTitle && playbookTitle) {
      // Fallback to title-based key with date
      const playbookName = playbookTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const stepNum = actionStepNumber || 0;
      const taskTitle = _subtaskTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      const key = `@prayer_editor_draft_${playbookName}_${stepNum}_${taskTitle}_${currentDate}${tabSuffix}`;

      return key;
    }

    // Default key with date and tab
    const key = `@prayer_editor_draft_${currentDate}${tabSuffix}`;

    return key;
  }, [subtaskId, stepId, _subtaskTitle, playbookTitle, actionStepNumber, activeTab]);

  // Load draft when component mounts or when active tab changes (only for new entries, not when editing)
  useEffect(() => {
    // Only load drafts when creating new entries, not when editing existing ones
    if (!isEditing) {
      const loadDraft = async () => {
        try {
          const draftKey = getDraftKey();
          const draft = await AsyncStorage.getItem(draftKey);
          if (draft) {
            const draftData = JSON.parse(draft);
            const { content, activeTab: savedTab } = draftData;

            // Only load draft if there's actual meaningful content
            if (content && content.trim()) {

              // Set the active tab first
              if (savedTab && (savedTab === 'freeform' || savedTab === 'people')) {
                setActiveTab(savedTab);
              }

              // Set the appropriate content based on the tab
              if (savedTab === 'freeform') {
                setPrayerContent(content);
              } else if (savedTab === 'people') {
                try {
                  const structuredData = JSON.parse(content);
                  setPrayerForPerson(structuredData.prayerForPerson || '');
                  setPrayerRequest(structuredData.prayerRequest || '');
                } catch (e) {
                  Logger.error('Error parsing structured prayer data', e as Error, { component: 'PrayerLogEditor' });
                }
              } else {
                // Fallback for old drafts without tab info
                setPrayerContent(content);
              }

              // Show notification when draft is loaded
              setTimeout(() => {
                setShowDraftNotification(true);
                setTimeout(() => {
                  setShowDraftNotification(false);
                }, 3000);
              }, 100);

            }
          }
        } catch (error) {
          Logger.error('Error loading draft', error as Error, {
      component: 'PrayerLogEditor',
    });
        } finally {
          if (isFirstLoad) {
            setIsFirstLoad(false);
          }
        }
      };

      loadDraft();
    } else if (isFirstLoad) {
      setIsFirstLoad(false);
    }
  }, [getDraftKey, isEditing, isFirstLoad]);

  // Focus the appropriate input when switching tabs (only in edit mode)
  useEffect(() => {
    if (!isEditing) {return;} // Skip focus if not in edit mode

    // Small timeout to ensure the tab animation completes
    const timer = setTimeout(() => {
      if (activeTab === 'people' && personInputRef.current) {
        // Focus the person input when switching to People tab
        personInputRef.current.focus();
      } else if (activeTab === 'freeform' && inputRef.current) {
        // Focus the main input when switching to Freeform tab
        inputRef.current.focus();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeTab, isEditing]);

  // Helper function to save draft
  const saveDraftHelper = useCallback(async () => {
    try {
      let hasContent = false;
      let contentToSave = '';

      if (activeTab === 'freeform') {
        hasContent = !!(prayerContent && prayerContent.trim());
        contentToSave = prayerContent;
      } else {
        hasContent = !!((prayerForPerson && prayerForPerson.trim()) || (prayerRequest && prayerRequest.trim()));
        // Save structured data as JSON for drafts
        contentToSave = JSON.stringify({ prayerForPerson, prayerRequest });
      }

      // Only save draft if there's actual meaningful content
      if (hasContent) {
        const draftData = {
          content: contentToSave,
          activeTab: activeTab,
          timestamp: new Date().toISOString(),
          subtaskTitle: _subtaskTitle,
          playbookTitle: playbookTitle,
          actionStepNumber: actionStepNumber,
        };

        await AsyncStorage.setItem(
          getDraftKey(),
          JSON.stringify(draftData)
        );
      }
    } catch (error) {
      Logger.error('Error saving draft', error as Error, {
      component: 'PrayerLogEditor',
    });
    }
  }, [prayerContent, prayerForPerson, prayerRequest, activeTab, _subtaskTitle, playbookTitle, actionStepNumber, getDraftKey]);

  const handleContentChange = (text: string) => {
    setPrayerContent(text);
    if (!hasUserMadeChanges) {
      setHasUserMadeChanges(true);
    }
  };

  // Helper function to check if there's content in the current tab
  const hasContentInCurrentTab = () => {
    if (activeTab === 'freeform') {
      return !!(prayerContent && prayerContent.trim());
    } else {
      return !!((prayerForPerson && prayerForPerson.trim()) || (prayerRequest && prayerRequest.trim()));
    }
  };

  // Auto-save draft when content changes (debounced)
  useEffect(() => {
    if (!isFirstLoad && hasUserMadeChanges && !isEditing) {
      const timeoutId = setTimeout(saveDraftHelper, 1000); // 1 second debounce
      return () => clearTimeout(timeoutId);
    }
  }, [prayerContent, prayerForPerson, prayerRequest, isFirstLoad, hasUserMadeChanges, isEditing, saveDraftHelper]);

  const handleSave = async () => {
    try {
      // Clear any existing draft since we're saving the entry
      try {
        await AsyncStorage.removeItem(getDraftKey());
      } catch (error) {
        Logger.error('Error clearing draft', error as Error, {
      component: 'PrayerLogEditor',
    });
      }

      let contentToSave = '';

      if (activeTab === 'freeform') {
        contentToSave = prayerContent.trim();
      } else {
        // Format structured prayer for people
        if (prayerForPerson.trim() && prayerRequest.trim()) {
          contentToSave = `🙏🏼 Prayer for ${prayerForPerson.trim()}\n\n${prayerRequest.trim()}`;
        } else if (prayerForPerson.trim()) {
          contentToSave = `🙏🏼 Prayer for ${prayerForPerson.trim()}`;
        } else {
          contentToSave = prayerRequest.trim();
        }
      }

      if (!hasContentInCurrentTab()) {
        if (activeTab === 'freeform') {
          Alert.alert('Empty Prayer', 'Please enter some content before saving.');
        } else {
          Alert.alert('Empty Prayer', 'Please enter who you are praying for or what you would like to pray for.');
        }
        return;
      }

      onSave({
        content: contentToSave,
        date: new Date(),
        activeTab: activeTab,
        prayerForPerson: activeTab === 'people' ? prayerForPerson : undefined,
        prayerRequest: activeTab === 'people' ? prayerRequest : undefined,
      });
    } catch (error) {
      Logger.error('Error in handleSave', error as Error, {
      component: 'PrayerLogEditor',
    });
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    }
  };

  const handleSavePress = () => {
    Keyboard.dismiss();
    setTimeout(() => {
      handleSave();
    }, 50);
  };

  const onCancel = async () => {
    try {
      // Save draft before canceling (only if user made changes)
      if (hasUserMadeChanges && !isEditing) {
        await saveDraftHelper();
      }

      Keyboard.dismiss();
      // Small delay to ensure keyboard is fully dismissed before closing
      setTimeout(() => {
        _onCancel();
      }, 10);
    } catch (error) {
      Logger.error('Error saving draft before cancel', error as Error, {
      component: 'PrayerLogEditor',
    });
      // Still proceed with cancel even if draft save fails
      Keyboard.dismiss();
      _onCancel();
    }
  };

  // Main render - exactly matching reflection editor layout
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

      {/* Header - matching reflection editor structure */}
      <View style={s.header}>
        <ThemedText weight="bold" style={s.title}>{dateString}</ThemedText>
        <View style={s.modeToggle}>
          {/* Prayer mode icons - compact layout */}
          <TouchableOpacity
            style={[s.modeButton, activeTab === 'freeform' && s.activeModeButton]}
            onPress={() => {
              triggerLightHaptic();
              setActiveTab('freeform');
            }}
            accessibilityLabel="Switch to Free Form Prayer"
          >
            <Pencil
              size={22}
              color={activeTab === 'freeform' ? Colors.alertCoral : Colors.trustGrey}
              fill={activeTab === 'freeform' ? Colors.alertCoral : Colors.trustGrey}
              strokeWidth={1.5}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeButton, activeTab === 'people' && s.activeModeButton]}
            onPress={() => {
              triggerLightHaptic();
              setActiveTab('people');
              // Focus the person input after switching tabs
              setTimeout(() => {
                personInputRef.current?.focus();
              }, 100);
            }}
            accessibilityLabel="Switch to Prayers for People"
          >
            <Ionicons
              name="people"
              size={22}
              color={activeTab === 'people' ? Colors.alertCoral : Colors.trustGrey}
            />
          </TouchableOpacity>
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
              {/* Title section with lock icon */}
              <View style={s.titleRow}>
                <ThemedText weight="semiBold" style={[s.entryInput, s.titleInput, s.transparentInput, s.lockedTitleText, s.titleTextFlex, { fontSize: titleFontSize }]}>
                  {_subtaskTitle || ''}
                </ThemedText>
              </View>

              {/* Conditional content based on active tab */}
              {activeTab === 'freeform' ? (
                /* Free Form Prayer Tab */
                <TextInput
                  ref={inputRef}
                  style={[s.entryInput, s.entryContentInput, { fontFamily: regularFont }]}
                  placeholder="Share your thoughts, prayers, and reflections..."
                  placeholderTextColor={Colors.trustGrey}
                  value={prayerContent}
                  onChangeText={handleContentChange}
                  multiline
                  textAlignVertical="top"
                  keyboardAppearance="dark"
                />
              ) : (
                /* Prayers for People Tab */
                <View style={s.structuredContainer}>
                  <TextInput
                    ref={personInputRef}
                    style={[s.structuredInput, { fontFamily: regularFont }]}
                    placeholder="Who are you praying for?"
                    placeholderTextColor={Colors.trustGrey}
                    value={prayerForPerson}
                    onChangeText={handlePersonChange}
                    keyboardAppearance="dark"
                  />
                  <View style={s.gap} />
                  <TextInput
                    ref={requestInputRef}
                    style={[s.structuredInput, s.multilineInput, { fontFamily: regularFont }]}
                    placeholder="What would you like to pray for this person?"
                    placeholderTextColor={Colors.trustGrey}
                    value={prayerRequest}
                    onChangeText={handleRequestChange}
                    multiline
                    textAlignVertical="top"
                    keyboardAppearance="dark"
                  />
                </View>
              )}

              {/* Metadata section for playbook context
                 Only show when we have a real playbook title. This keeps dashboard-triggered
                 prayers (scripture/declarations) from being labeled as FROM PLAYBOOK. */}
              {playbookTitle && (
                <PlaybookMetaSection
                  playbookTitle={playbookTitle}
                  actionLabel={actionStepNumber && actionStepTitle
                    ? `Action ${actionStepNumber}: ${actionStepTitle}`
                    : undefined}
                  stepBody={stepBody}
                  stepExample={stepExample}
                />
              )}
            </ScrollView>
          </View>

          {/* Right Action Buttons */}
          <View style={s.fabWrapper}>
            <View style={[s.fabContainer, s.fabDefaultPosition]}>
              <View style={s.fabRow}>
              {/* Cancel FAB */}
              <TouchableOpacity
                style={[s.fab, s.cancelFab]}
                onPress={() => {
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
                  (!hasContentInCurrentTab() || !hasUserMadeChanges || isLoading) && s.fabDisabled,
                ]}
                disabled={!hasContentInCurrentTab() || !hasUserMadeChanges || isLoading}
                onPress={() => {
                  triggerLightHaptic();
                  handleSavePress();
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
          </View>
        </KeyboardAvoidingView>

    </View>
  );
});

export default PrayerLogEditor;

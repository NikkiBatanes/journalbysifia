import React, { useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Alert, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil } from 'lucide-react-native';
import { Colors } from '../../theme/colors';

interface PrayerLogEditorProps {
  onSave: (data: {
    content: string;
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

export interface PrayerLogEditorRef {
  focusInput: () => void;
}

// Styles matching reflection log editor pattern
const defaultStyles = {
  // Main container styles (matching reflection editor)
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
  keyboardAvoidingView: {
    flex: 1,
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
    paddingBottom: 0,
    zIndex: 10,
    backgroundColor: Colors.hopeWhite,
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
    width: 56,
    height: 56,
    borderRadius: 28,
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
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
  },
  ref
) => {
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
      fontWeight: '500',
    },
  };
  const inputRef = useRef<TextInput>(null);
  const personInputRef = useRef<TextInput>(null);
  const requestInputRef = useRef<TextInput>(null);

  // Debug logging
  console.log('🙏 PrayerLogEditor: _subtaskTitle value:', _subtaskTitle);
  console.log('🙏 PrayerLogEditor: playbookTitle:', playbookTitle);
  console.log('🙏 PrayerLogEditor: actionStepTitle:', actionStepTitle);

  // State management
  const [prayerContent, setPrayerContent] = React.useState(initialContent);
  const [hasUserMadeChanges, setHasUserMadeChanges] = React.useState(false);
  const [isFirstLoad, setIsFirstLoad] = React.useState(true);
  const [showAddMenu, setShowAddMenu] = React.useState(false);
  const [showDraftNotification, setShowDraftNotification] = React.useState(false);

  // Tab management
  const [activeTab, setActiveTab] = React.useState<'freeform' | 'people'>('freeform');

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
  const [prayerForPerson, setPrayerForPerson] = React.useState('');
  const [prayerRequest, setPrayerRequest] = React.useState('');

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
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    // Include active tab in the key
    const tabSuffix = `_${activeTab}`;

    if (subtaskId && stepId) {
      // Use subtaskId and stepId for maximum uniqueness
      const key = `@prayer_editor_draft_${stepId}_${subtaskId}_${currentDate}${tabSuffix}`;
      console.log('[PrayerLogEditor] Unique draft key with IDs:', key);
      return key;
    }

    if (_subtaskTitle && playbookTitle) {
      // Fallback to title-based key with date
      const playbookName = playbookTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const stepNum = actionStepNumber || 0;
      const taskTitle = _subtaskTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      const key = `@prayer_editor_draft_${playbookName}_${stepNum}_${taskTitle}_${currentDate}${tabSuffix}`;
      console.log('[PrayerLogEditor] Title-based draft key:', key);
      return key;
    }

    // Default key with date and tab
    const key = `@prayer_editor_draft_${currentDate}${tabSuffix}`;
    console.log('[PrayerLogEditor] Default draft key with date and tab:', key);
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
              console.log('[PrayerLogEditor] Loading draft for tab:', savedTab, 'content:', content.substring(0, 50) + '...');

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
                  console.error('Error parsing structured prayer data:', e);
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

              console.log('[PrayerLogEditor] Draft loaded and notification shown');
            }
          }
        } catch (error) {
          console.error('Error loading draft:', error);
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

  // Focus the appropriate input when switching tabs
  useEffect(() => {
    // Small timeout to ensure the tab animation completes
    const timer = setTimeout(() => {
      if (activeTab === 'people') {
        // Focus the person input when switching to People tab
        if (personInputRef.current) {
          personInputRef.current.focus();
        }
      } else if (activeTab === 'freeform' && inputRef.current) {
        // Focus the main input when switching to Freeform tab
        inputRef.current.focus();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeTab]);

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

        console.log('[PrayerLogEditor] Saving draft for tab:', activeTab);
        await AsyncStorage.setItem(
          getDraftKey(),
          JSON.stringify(draftData)
        );
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [prayerContent, prayerForPerson, prayerRequest, activeTab, _subtaskTitle, playbookTitle, actionStepNumber, getDraftKey]);

  const handleContentChange = (text: string) => {
    setPrayerContent(text);
    if (!hasUserMadeChanges) {
      setHasUserMadeChanges(true);
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
        console.error('Error clearing draft:', error);
      }

      let contentToSave = '';

      if (activeTab === 'freeform') {
        contentToSave = prayerContent.trim();
      } else {
        // Format structured prayer for people
        if (prayerForPerson.trim() && prayerRequest.trim()) {
          contentToSave = `🙏 Prayer for ${prayerForPerson.trim()}\n\n${prayerRequest.trim()}`;
        } else if (prayerForPerson.trim()) {
          contentToSave = `🙏 Prayer for ${prayerForPerson.trim()}`;
        } else {
          contentToSave = prayerRequest.trim();
        }
      }

      if (!contentToSave) {
        Alert.alert('Empty Prayer', 'Please enter some content before saving.');
        return;
      }

      onSave({
        content: contentToSave,
        date: new Date(),
      });
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    }
  };

  const onCancel = async () => {
    try {
      // Save draft before canceling (only if user made changes)
      if (hasUserMadeChanges && !isEditing) {
        await saveDraftHelper();
      }

      console.log('🙏 PrayerLogEditor: onCancel called');
      _onCancel();
    } catch (error) {
      console.error('Error saving draft before cancel:', error);
      // Still proceed with cancel even if draft save fails
      _onCancel();
    }
  };

  // Main render - exactly matching reflection editor layout
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

      {/* Header - matching reflection editor structure */}
      <View style={s.header}>
        <Text style={s.title}>{dateString}</Text>
        <View style={s.modeToggle}>
          {/* Prayer mode icons - compact layout */}
          <TouchableOpacity
            style={[s.modeButton, activeTab === 'freeform' && s.activeModeButton]}
            onPress={() => setActiveTab('freeform')}
            accessibilityLabel="Switch to Free Form Prayer"
          >
            <Pencil
              size={22}
              color={activeTab === 'freeform' ? Colors.alertCoral : Colors.inactiveIcon}
              fill={activeTab === 'freeform' ? Colors.alertCoral : Colors.inactiveIcon}
              strokeWidth={1.5}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeButton, activeTab === 'people' && s.activeModeButton]}
            onPress={() => setActiveTab('people')}
            accessibilityLabel="Switch to Prayers for People"
          >
            <Ionicons
              name="people"
              size={22}
              color={activeTab === 'people' ? Colors.alertCoral : Colors.inactiveIcon}
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
              {/* Title section */}
              <Text style={[s.entryInput, s.titleInput, s.transparentInput, s.lockedTitleText]}>
                {_subtaskTitle || ''}
              </Text>

              {/* Conditional content based on active tab */}
              {activeTab === 'freeform' ? (
                /* Free Form Prayer Tab */
                <TextInput
                  ref={inputRef}
                  style={[s.entryInput, s.entryContentInput]}
                  placeholder="Share your thoughts, prayers, and reflections..."
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={prayerContent}
                  onChangeText={handleContentChange}
                  multiline
                  textAlignVertical="top"
                />
              ) : (
                /* Prayers for People Tab */
                <View style={s.structuredContainer}>
                  <TextInput
                    ref={personInputRef}
                    style={s.structuredInput}
                    placeholder="Who are you praying for?"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={prayerForPerson}
                    onChangeText={handlePersonChange}
                  />
                  <View style={s.gap} />
                  <TextInput
                    ref={requestInputRef}
                    style={[s.structuredInput, s.multilineInput]}
                    placeholder="What would you like to pray for this person?"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={prayerRequest}
                    onChangeText={handleRequestChange}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              )}

              {/* Metadata section for playbook context */}
              {(playbookTitle || _subtaskTitle) && (
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
                    {actionStepNumber && actionStepTitle && (
                      <Text style={s.metadataText}>
                        Step {actionStepNumber}: {actionStepTitle}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* Left Add FAB */}
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
        <View style={[s.fabContainer, s.fabDefaultPosition]}>
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
                (!prayerContent.trim() || !hasUserMadeChanges || isLoading) && s.fabDisabled,
              ]}
              disabled={!prayerContent.trim() || !hasUserMadeChanges || isLoading}
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
  );
});

export default PrayerLogEditor;

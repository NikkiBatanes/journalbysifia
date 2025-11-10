import React, { useRef, useEffect, useImperativeHandle } from 'react';
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
  Alert,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Pencil, X } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { useSmartJournalingGating } from '../../hooks/useSmartJournalingGating';
import { useNavigation } from '@react-navigation/native';
import { useSubscription } from '../../hooks/useSubscription';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { triggerLightHaptic } from '../../utils/haptics';

interface GratitudeLogEditorProps {
  onSave: (data: {
    items: string[];
    date: Date;
  }) => void;
  onCancel: () => void;
  initialItems?: string[];
  subtaskTitle?: string;
  subtaskId?: string;
  stepId?: string;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  isLoading?: boolean;
  styles?: any;
}

export interface GratitudeLogEditorRef {
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

  // Title and content styles
  titleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.hopeWhite,
  },
  mainTitle: {
    fontSize: 24,
    // Typography handled by ThemedText weight="bold"
    color: Colors.anchorBlue,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.anchorBlue,
    opacity: 0.7,
  },

  // Metadata styles - matching reflection editor exactly
  metadataContainer: {
    marginTop: 32,
    marginBottom: 24,
    flexDirection: 'row',
  },
  verticalLine: {
    width: 1,
    height: '100%',
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
    // fontWeight handled by ThemedText weight="medium"
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
    // Typography handled by ThemedText weight="bold"
    color: Colors.hopeWhite,
    marginBottom: 8,
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
  entryContentInput: {
    minHeight: 100,
    fontSize: 16,
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  lockedTitleText: {
    color: Colors.hopeWhite,
    opacity: 0.9,
    includeFontPadding: false,
    textAlignVertical: 'center',
    marginBottom: 20, // Increased from 2 to 20 for better spacing
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
  subtitleText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    opacity: 0.7,
    marginTop: 0,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  addMoreContainer: {
    alignItems: 'flex-end',
    marginTop: 16,
    marginBottom: 20,
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
  previewContainer: {
    marginBottom: 16,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  previewNumber: {
    color: Colors.hopeWhite,
    fontSize: 14,
    // fontWeight handled by ThemedText weight="semiBold"
    marginRight: 8,
    opacity: 0.8,
  },
  previewText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    opacity: 0.6,
    flex: 1,
    fontStyle: 'italic',
  },
  compactMetadata: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  compactMetadataText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },

  // Draft notification styles (matching reflection editor)
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

  gratitudeItemContainer: {
    marginBottom: 4,
    width: '100%',
  },
  gratitudeItemLabel: {
    color: Colors.hopeWhite,
    fontSize: 16,
    // fontWeight handled by ThemedText weight="semiBold"
    marginBottom: 8,
    opacity: 0.9,
  },
  gratitudeItemInput: {
    color: Colors.hopeWhite,
    fontSize: 16,
    minHeight: 60,
    marginBottom: 8,
    textAlignVertical: 'top',
  },
  removeButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '500',
  },
  addMoreButton: {
    width: 24,
    height: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  addMoreText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    marginLeft: 8,
    opacity: 0.8,
  },
  // FAB styles (matching reflection editor)
  fabWrapper: {
    position: 'relative',
    width: '100%',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 10,
  },
  fabRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fab: {
    width: 24,
    height: 24,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveFab: {
    backgroundColor: Colors.alertCoral,
  },
  fabDisabled: {
    opacity: 0.5,
  },
  leftFabContainer: {
    left: 16,
    right: 'auto',
    alignItems: 'flex-start',
  },
  fabDefaultPosition: {
    bottom: 16,
  },
  addFab: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  cancelFab: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  itemMarginBottom: {
    marginBottom: 8,
  },
  lastItemMarginBottom: {
    marginBottom: 0,
  },
  rotateIcon: {
    transform: [{ rotate: '45deg' }],
  },
  boldIcon: {
    // fontWeight handled by ThemedText weight="bold"
  },
};

const GratitudeLogEditorInner = (
  props: GratitudeLogEditorProps,
  ref: React.Ref<GratitudeLogEditorRef>
) => {
  const {
    onSave,
    onCancel,
    initialItems = [],
    subtaskTitle,
    subtaskId,
    stepId,
    playbookTitle,
    actionStepNumber,
    actionStepTitle,
    isLoading = false,
    styles,
  } = props;
  const navigation = useNavigation();
  const { subscription } = useSubscription();
  const smartJournalingGating = useSmartJournalingGating();

  const s = { ...defaultStyles, ...styles };

  // Helper function to ensure items have proper numbering
  const addNumbersToItems = (items: string[]): string[] => {
    return items.map((item, index) => {
      if (!item.trim()) {
        return item; // Keep empty items as is
      }
      const expectedPrefix = `${index + 1}. `;
      // If item doesn't start with the expected number, add it
      if (!item.startsWith(expectedPrefix)) {
        // Remove any existing number prefix first
        const cleanItem = item.replace(/^\d+\. /, '');
        return expectedPrefix + cleanItem;
      }
      return item;
    });
  };

  // Process initial items to ensure they have numbers
  const processedInitialItems = initialItems.length > 0 ? addNumbersToItems(initialItems) : ['', '', ''];

  // State for gratitude items
  const [gratitudeItems, setGratitudeItems] = React.useState<string[]>(processedInitialItems);
  const [hasUserMadeChanges, setHasUserMadeChanges] = React.useState(false);
  const [showDraftNotification, setShowDraftNotification] = React.useState(false);
  const [isFirstLoad, setIsFirstLoad] = React.useState(true);

  // Refs for inputs
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      // Focus the first input and position cursor at the end
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
        // Position cursor at the end of the text
        setTimeout(() => {
          if (inputRefs.current[0]) {
            const text = gratitudeItems[0] || '';
            inputRefs.current[0].setSelection(text.length, text.length);
          }
        }, 100);
      }
    },
  }));

  // Helper function to get unique draft key for each gratitude
  const getDraftKey = React.useCallback(() => {
    // Get current date for uniqueness
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    if (subtaskId && stepId) {
      // Use subtaskId and stepId for maximum uniqueness
      const key = `@gratitude_editor_draft_${stepId}_${subtaskId}_${currentDate}`;
      return key;
    }

    if (subtaskTitle && playbookTitle) {
      // Fallback to title-based key with date
      const playbookName = playbookTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const stepNum = actionStepNumber || 0;
      const taskTitle = subtaskTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      const key = `@gratitude_editor_draft_playbook_${playbookName}_step${stepNum}_${taskTitle}_${currentDate}`;
      return key;
    }

    // Default key with date
    const key = `@gratitude_editor_draft_${currentDate}`;
    return key;
  }, [subtaskId, stepId, subtaskTitle, playbookTitle, actionStepNumber]);

  // Load draft on component mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        // Don't load draft if we already have meaningful initialItems (existing data)
        const hasExistingData = initialItems && initialItems.some((item: string) => item.trim());

        if (hasExistingData) {
          setIsFirstLoad(false);
          return;
        }

        const draftKey = getDraftKey();
        const draft = await AsyncStorage.getItem(draftKey);
        if (draft && isFirstLoad) {
          const parsedDraft = JSON.parse(draft);
          if (parsedDraft.items && parsedDraft.items.some((item: string) => item.trim())) {
            // Apply numbering to draft items as well
            const numberedDraftItems = addNumbersToItems(parsedDraft.items);
            setGratitudeItems(numberedDraftItems);
            setShowDraftNotification(true);
            setTimeout(() => setShowDraftNotification(false), 3000);
          }
        }
      } catch (error) {
        // Error silently handled - draft loading is not critical
      } finally {
        setIsFirstLoad(false);
      }
    };

    loadDraft();
  }, [getDraftKey, isFirstLoad, initialItems]);

  // Update gratitude items when initialItems changes (for React Query data loading)
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      const hasExistingData = initialItems.some((item: string) => item.trim());
      if (hasExistingData && !hasUserMadeChanges) {
        const numberedItems = addNumbersToItems(initialItems);
        setGratitudeItems(numberedItems);
      }
    }
  }, [initialItems, hasUserMadeChanges]);

  // Auto-save draft when items change
  useEffect(() => {
    if (!isFirstLoad && hasUserMadeChanges) {
      const saveDraft = async () => {
        try {
          // Save clean items without numbers to draft
          const cleanItems = gratitudeItems.map(item => item.replace(/^\d+\. /, ''));
          const draftKey = getDraftKey();
          await AsyncStorage.setItem(draftKey, JSON.stringify({ items: cleanItems }));
        } catch (error) {
          // Error silently handled - draft saving is not critical
        }
      };
      saveDraft();
    }
  }, [gratitudeItems, getDraftKey, isFirstLoad, hasUserMadeChanges]);

  // Clear draft on successful save
  const clearDraft = async () => {
    try {
      const draftKey = getDraftKey();
      await AsyncStorage.removeItem(draftKey);
    } catch (error) {
      // Error silently handled - draft clearing is not critical
    }
  };

  const handleItemChange = (index: number, text: string) => {
    const newItems = [...gratitudeItems];
    newItems[index] = text;
    setGratitudeItems(newItems);
    setHasUserMadeChanges(true);
  };

  const addGratitudeItem = () => {
    setGratitudeItems([...gratitudeItems, '']);
    setHasUserMadeChanges(true);
  };

  const getCurrentDate = () => {
    const today = new Date();
    const currentYear = new Date().getFullYear();
    const todayYear = today.getFullYear();

    // Don't show year if it's the current year
    if (todayYear === currentYear) {
      return today.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    } else {
      return today.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const handleSave = async () => {
    // Check if feature is gated for seeker accounts
    if (smartJournalingGating.isLocked) {
      try { triggerLightHaptic(); } catch {}
      (navigation as any).navigate('OnboardingSalesOffer', {
        source: 'smart_journaling_lock',
        feature: 'smart_journaling',
        tier: subscription?.tier || 'seeker',
        upgradeMode: false,
        skipNotificationPreference: true,
      });
      return;
    }

    const filledItems = gratitudeItems.filter((item: string) => item.trim());

    if (filledItems.length === 0) {
      Alert.alert(
        'Empty Gratitude',
        'Please add at least one thing you\'re grateful for.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Clear draft before saving
    await clearDraft();

    // Remove numbers from items before saving to database
    const cleanItems = filledItems.map(item => item.replace(/^\d+\. /, ''));

    // Call onSave synchronously like ReflectionLogEditor
    onSave({
      items: cleanItems,
      date: new Date(),
    });
  };

  // Check if form is valid (has content) AND user has made changes
  const isFormValid = gratitudeItems.some(item => item.trim()) && hasUserMadeChanges;

  // Main render - exactly matching reflection editor layout
  return (
    <View style={s.container}>
      {/* Draft notification */}
      {showDraftNotification && (
        <View style={s.draftNotification}>
          <Ionicons name="time-outline" size={20} color={Colors.hopeWhite} style={s.draftIcon} />
          <ThemedText weight="medium" style={s.draftText}>Draft Restored</ThemedText>
        </View>
      )}
      <StatusBar hidden />
      <View style={s.backgroundContainer} />
      <View style={s.header}>
        <ThemedText weight="bold" style={s.title}>{getCurrentDate()}</ThemedText>
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
        enabled={Platform.OS === 'ios'}
      >
        <View style={s.contentCard}>
          <ScrollView
            style={s.content}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title section with lock icon */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <ThemedText weight="bold" style={[s.entryInput, s.titleInput, s.transparentInput, s.lockedTitleText, { flex: 1 }]}>
                What are you grateful for today?
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
            {/* Gratitude items */}
            {gratitudeItems.map((item, index) => (
              <View
                key={index}
                style={[
                  s.gratitudeItemContainer,
                  index !== gratitudeItems.length - 1 && s.itemMarginBottom,
                  index === gratitudeItems.length - 1 && s.lastItemMarginBottom,
                ]}
              >
                <TextInput
                  ref={(inputRef) => { inputRefs.current[index] = inputRef; }}
                  style={[s.entryInput, s.entryContentInput]}
                  placeholder={`${index + 1}. I'm grateful for...`}
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={item}
                  onChangeText={(text) => {
                    // Allow complete erasure - if text is empty or just the prefix, keep it empty
                    if (text.length === 0) {
                      handleItemChange(index, '');
                      return;
                    }

                    const expectedPrefix = `${index + 1}. `;

                    // If user tries to delete the prefix (text is just the number and dot), clear completely
                    if (text === `${index + 1}.` || text === `${index + 1}`) {
                      handleItemChange(index, '');
                      return;
                    }

                    // Auto-add numbering when user starts typing
                    let formattedText = text;

                    // If user is typing and doesn't have the number prefix, add it
                    if (!text.startsWith(expectedPrefix)) {
                      // Check if text starts with any number pattern (e.g., "1.", "2.", etc.)
                      const numberPattern = /^\d+\. /;
                      if (!numberPattern.test(text)) {
                        formattedText = expectedPrefix + text;
                      } else {
                        // Replace existing number with correct one
                        formattedText = text.replace(/^\d+\. /, expectedPrefix);
                      }
                    }

                    handleItemChange(index, formattedText);
                  }}
                  multiline
                  textAlignVertical="top"
                  returnKeyType={index < gratitudeItems.length - 1 ? 'next' : 'done'}
                  onSubmitEditing={() => {
                    if (index < gratitudeItems.length - 1) {
                      inputRefs.current[index + 1]?.focus();
                    } else {
                      Keyboard.dismiss();
                    }
                  }}
                  blurOnSubmit={index === gratitudeItems.length - 1}
                />

              </View>
            ))}

            {/* Add more button - positioned to the right - only show if first 3 are filled */}
            {gratitudeItems.slice(0, 3).every(item => item.trim().length > 0) && (
              <View style={s.addMoreContainer}>
                <TouchableOpacity style={s.addMoreButton} onPress={addGratitudeItem}>
                  <View style={s.rotateIcon}>
                    <Ionicons name="close" size={13} color={Colors.alertCoral} style={s.boldIcon} />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Metadata section - matching reflection editor format */}
            {(subtaskTitle || playbookTitle) && (
              <View style={s.metadataContainer}>
                <View style={s.verticalLine} />
                <View>
                  <ThemedText weight="medium" style={s.fromText}>
                    FROM PLAYBOOK
                  </ThemedText>
                  {playbookTitle && (
                    <ThemedText style={s.metadataText}>
                      {playbookTitle}
                    </ThemedText>
                  )}
                  {actionStepNumber && actionStepTitle && (
                    <ThemedText style={s.metadataText}>
                      Step {actionStepNumber}: {actionStepTitle}
                    </ThemedText>
                  )}
                  {subtaskTitle && (
                    <ThemedText style={s.metadataText}>
                      {subtaskTitle}
                    </ThemedText>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Floating Action Buttons - matching reflection editor */}
      <View style={s.fabWrapper}>
        {/* Right Action Buttons */}
        <View style={[s.fabContainer, s.fabDefaultPosition]}>
          <View style={s.fabRow}>
            {/* Cancel FAB */}
            <TouchableOpacity
              style={[s.fab, s.cancelFab]}
              onPress={onCancel}
            >
              <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
            </TouchableOpacity>

            {/* Save FAB */}
            <TouchableOpacity
              style={[
                s.fab,
                s.saveFab,
                (!isFormValid || isLoading) && s.fabDisabled,
              ]}
              disabled={!isFormValid || isLoading}
              onPress={() => {
                handleSave();
              }}
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

const GratitudeLogEditor = React.forwardRef(GratitudeLogEditorInner);

export default GratitudeLogEditor;

import React, { useRef, useEffect, useImperativeHandle, useCallback } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';

interface GratitudeLogEditorProps {
  onSave: (data: {
    items: string[];
    date: Date;
  }) => void;
  onCancel: () => void;
  onUpgradeRequired?: () => void; // Callback to close modal before navigating to upgrade
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
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
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
    lineHeight: 16,
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.anchorBlue,
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
    onCancel: _onCancel,
    onUpgradeRequired,
    initialItems = [],
    subtaskTitle: _subtaskTitle,
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
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontRegular = getFontFamily(fontKey, 'regular');

  const s = { ...defaultStyles, ...styles };

  // Helper function to ensure items have proper numbering (optimized)
  const addNumbersToItems = useCallback((items: string[]): string[] => {
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
  }, []);

  // Process initial items to ensure they have numbers
  const processedInitialItems = initialItems.length > 0 ? addNumbersToItems(initialItems) : ['', '', ''];

  // State for gratitude items
  const [gratitudeItems, setGratitudeItems] = React.useState<string[]>(processedInitialItems);
  const [hasUserMadeChanges, setHasUserMadeChanges] = React.useState(false);

  // Refs for inputs
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      // Ensure input refs array is properly initialized
      if (!inputRefs.current || inputRefs.current.length === 0) {
        // Initialize refs array if not already done
        inputRefs.current = Array(gratitudeItems.length).fill(null);
      }

      // Find the first empty input field
      let firstEmptyIndex = -1;
      for (let i = 0; i < gratitudeItems.length; i++) {
        if (gratitudeItems[i].trim().length === 0) {
          firstEmptyIndex = i;
          break;
        }
      }

      // If all fields have content, focus on the last field and position cursor at the end
      const targetIndex = firstEmptyIndex >= 0 ? firstEmptyIndex : gratitudeItems.length - 1;

      console.log('[GratitudeLogEditor] Focusing input at index:', targetIndex, 'gratitudeItems:', gratitudeItems);

      if (inputRefs.current[targetIndex]) {
        inputRefs.current[targetIndex]!.focus();
        // Position cursor at the end of the text (or start if empty)
        setTimeout(() => {
          if (inputRefs.current[targetIndex]) {
            const text = gratitudeItems[targetIndex] || '';
            inputRefs.current[targetIndex]!.setSelection(text.length, text.length);
          }
        }, 100);
      } else {
        console.warn('[GratitudeLogEditor] Input ref not available at index:', targetIndex);
        // Retry focus after a short delay
        setTimeout(() => {
          if (inputRefs.current[targetIndex]) {
            inputRefs.current[targetIndex]!.focus();
          }
        }, 200);
      }
    },
  }));



  // Update gratitude items when initialItems changes (for React Query data loading)
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      const hasExistingData = initialItems.some((item: string) => item.trim());
      if (hasExistingData && !hasUserMadeChanges) {
        const numberedItems = addNumbersToItems(initialItems);
        setGratitudeItems(numberedItems);
      }
    }
  }, [initialItems, hasUserMadeChanges, addNumbersToItems]);



  // Optimized text formatting function
  const formatText = useCallback((text: string, index: number): string => {
    // Allow complete erasure - if text is empty or just the prefix, keep it empty
    if (text.length === 0) {
      return '';
    }

    const expectedPrefix = `${index + 1}. `;

    // If user tries to delete the prefix (text is just the number and dot), clear completely
    if (text === `${index + 1}.` || text === `${index + 1}`) {
      return '';
    }

    // Auto-add numbering when user starts typing (optimized logic)
    if (!text.startsWith(expectedPrefix)) {
      // Check if text starts with any number pattern (e.g., "1.", "2.", etc.)
      const numberPattern = /^\d+\. /;
      if (!numberPattern.test(text)) {
        return expectedPrefix + text;
      } else {
        // Replace existing number with correct one
        return text.replace(/^\d+\. /, expectedPrefix);
      }
    }

    return text;
  }, []);

  // Optimized item change handler with batched state updates
  const handleItemChange = useCallback((index: number, text: string) => {
    const formattedText = formatText(text, index);
    setGratitudeItems(prev => {
      const newItems = [...prev];
      newItems[index] = formattedText;
      return newItems;
    });
    setHasUserMadeChanges(true);
  }, [formatText]);

  const addGratitudeItem = useCallback(() => {
    triggerLightHaptic(); // Add haptic feedback
    const newIndex = gratitudeItems.length;
    setGratitudeItems(prev => [...prev, '']);
    setHasUserMadeChanges(true);

    // Focus the new input after it's rendered
    setTimeout(() => {
      if (inputRefs.current[newIndex]) {
        inputRefs.current[newIndex]?.focus();
      }
    }, 100);
  }, [gratitudeItems.length]);

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

  const handleSave = useCallback(() => {
    const startTime = Date.now();

    // Check if feature is gated for seeker accounts
    if (smartJournalingGating.isLocked) {
      try { triggerLightHaptic(); } catch {}
      // Close modal first before navigating
      if (onUpgradeRequired) {
        try { onUpgradeRequired(); } catch {}
      }
      setTimeout(() => {
        (navigation as any).navigate('OnboardingSalesOffer', {
          source: 'smart_journaling_lock',
          feature: 'smart_journaling',
          tier: subscription?.tier || 'seeker',
          upgradeMode: false,
          skipNotificationPreference: true,
        });
      }, 300);
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

    // Remove numbers from items before saving to database
    const cleanItems = filledItems.map(item => item.replace(/^\d+\. /, ''));

    // Call onSave synchronously for immediate UI response
    onSave({
      items: cleanItems,
      date: new Date(),
    });


    const endTime = Date.now();
    console.log(`[GratitudeLogEditor] Save completed in ${endTime - startTime}ms`);
  }, [smartJournalingGating, onUpgradeRequired, navigation, subscription?.tier, gratitudeItems, onSave]);

  // Check if form is valid (has content) AND user has made changes
  const isFormValid = gratitudeItems.some(item => item.trim()) && hasUserMadeChanges;

  // Main render - exactly matching reflection editor layout
  return (
    <View style={s.container}>
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
            <View style={s.titleRow}>
              <ThemedText weight="bold" style={[s.entryInput, s.titleInput, s.transparentInput, s.lockedTitleText, s.titleTextFlex]}>
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
                  style={[s.entryInput, s.entryContentInput, { fontFamily: fontRegular }]}
                  placeholder={`${index + 1}. I'm grateful for...`}
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={item}
                  onChangeText={(text) => {
                    // Use optimized text formatting
                    handleItemChange(index, text);
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
            {(_subtaskTitle || playbookTitle) && (
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
                  {_subtaskTitle && (
                    <ThemedText style={s.metadataText}>
                      {_subtaskTitle}
                    </ThemedText>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Floating Action Buttons - matching reflection editor */}
        <View style={s.fabWrapper}>
          {/* Right Action Buttons */}
          <View style={[s.fabContainer, s.fabDefaultPosition]}>
            <View style={s.fabRow}>
              {/* Cancel FAB */}
              <TouchableOpacity
                style={[s.fab, s.cancelFab]}
                onPress={() => {
                  triggerLightHaptic(); // Add haptic feedback for FAB
                  _onCancel();
                }}
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
                  triggerLightHaptic(); // Add haptic feedback for FAB
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
      </KeyboardAvoidingView>

    </View>
  );
};

// Add display name for debugging
GratitudeLogEditorInner.displayName = 'GratitudeLogEditorInner';

// Apply React.memo with proper forwardRef pattern
const GratitudeLogEditor = React.memo(React.forwardRef(GratitudeLogEditorInner));

export default GratitudeLogEditor;

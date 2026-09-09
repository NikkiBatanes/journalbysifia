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
  Animated,
} from 'react-native';
import { Pencil } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { triggerLightHaptic } from '../../utils/haptics';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import PlaybookMetaSection from './PlaybookMetaSection';
import { isToday, isYesterday, startOfDay } from 'date-fns';

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
  stepBody?: string;
  stepExample?: string | null;
  selectedDate?: Date;
}

type DateContext = 'today' | 'yesterday' | 'earlier';

// Helper to compute date context from selected date
const getDateContext = (selectedDate: Date): DateContext => {
  const day = startOfDay(selectedDate);

  if (isToday(day)) {return 'today';}
  if (isYesterday(day)) {return 'yesterday';}
  return 'earlier';
};

export interface GratitudeLogEditorRef {
  focusInput: (skipScroll?: boolean) => void;
  reset: () => void;
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
    // Blue background so that when iOS fires spurious keyboard-lifecycle events
    // on app resume and KAV briefly adds bottom padding, the gap below
    // contentCard shows blue — not the white container behind it.
    backgroundColor: Colors.anchorBlue,
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
  gratitudeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gratitudeNumberContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gratitudeNumber: {
    fontSize: 14,
    color: Colors.alertCoral,
    textAlign: 'center',
    lineHeight: 16,
  },
  gratitudeItemInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    padding: 16,
    fontSize: 18,
    color: Colors.hopeWhite,
    minHeight: 50,
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
    color: '#D97872',
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
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#29342E',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        overflow: 'hidden',
        elevation: 0,
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
      },
    }),
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
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 0,
    borderColor: 'transparent',
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  cancelFab: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  itemMarginBottom: {
    marginBottom: 8,
  },
  lastItemMarginBottom: {
    marginBottom: 0,
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
    initialItems = [],
    subtaskTitle: _subtaskTitle,
    playbookTitle,
    actionStepNumber,
    actionStepTitle,
    isLoading = false,
    styles,
    stepBody,
    stepExample,
    selectedDate = new Date(),
  } = props;

  const dateContext = getDateContext(selectedDate);
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontRegular = getFontFamily(fontKey, 'regular');

  const s = { ...defaultStyles, ...styles };

  // Dynamic labels based on date context
  const getTitle = () => {
    switch (dateContext) {
      case 'today': return 'What are you grateful for today?';
      case 'yesterday': return 'What were you grateful for yesterday?';
      case 'earlier': return 'What were you grateful for on this day?';
    }
  };

  const getPlaceholder = () => {
    switch (dateContext) {
      case 'today': return "I'm grateful for...";
      case 'yesterday': return 'I was grateful for...';
      case 'earlier': return 'I was grateful for...';
    }
  };

  // Helper function to remove number prefixes from items (for backward compatibility)
  const removeNumbersFromItems = useCallback((items: string[]): string[] => {
    return items.map((item) => {
      // Remove any existing number prefix
      return item.replace(/^\d+\. /, '');
    });
  }, []);

  // Process initial items to remove any number prefixes (for backward compatibility)
  const processedInitialItems = initialItems.length > 0 ? removeNumbersFromItems(initialItems) : ['', '', ''];

  // State for gratitude items
  const [gratitudeItems, setGratitudeItems] = React.useState<string[]>(processedInitialItems);
  const [hasUserMadeChanges, setHasUserMadeChanges] = React.useState(false);

  // Add button: show only when the 3rd input (index 2) is non-empty
  const shouldShowAddButton = (gratitudeItems[2] ?? '').trim().length > 0;

  // Add button spring animation — conditionally mounted so it never takes layout space when hidden
  const buttonGroupAnim = useRef(new Animated.Value(0)).current;
  const addButtonScale = useRef(buttonGroupAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })).current;
  const [addButtonMounted, setAddButtonMounted] = React.useState(false);

  // Refs for inputs and scrollview
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    focusInput: (skipScroll = false) => {
      // Ensure input refs array is properly initialized
      if (!inputRefs.current || inputRefs.current.length === 0) {
        inputRefs.current = [null, null, null];
      }

      // Focus the first non-empty input
      const targetIndex = gratitudeItems.findIndex(item => item.trim().length === 0);
      if (targetIndex === -1) {
        // All inputs have text, add a new one and focus it
        setGratitudeItems(prev => [...prev, '']);
        setTimeout(() => {
          if (inputRefs.current[inputRefs.current.length - 1]) {
            inputRefs.current[inputRefs.current.length - 1]!.focus();
            // Scroll to the bottom of the content (always scroll when adding new item)
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        }, 200);
      } else {
        // Focus the first empty input
        setTimeout(() => {
          if (inputRefs.current[targetIndex]) {
            inputRefs.current[targetIndex]!.focus();
            // Only scroll to bottom if skipScroll is false
            if (!skipScroll) {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }
          }
        }, 200);
      }
    },
    reset: () => {
      setGratitudeItems(['', '', '']);
      setHasUserMadeChanges(false);
    },
  }));



  // Update gratitude items when initialItems changes (for React Query data loading)
  useEffect(() => {
    if (initialItems && initialItems.length > 0 && !hasUserMadeChanges) {
      const hasExistingData = initialItems.some((item: string) => item.trim());
      if (hasExistingData) {
        const cleanItems = removeNumbersFromItems(initialItems);
        setGratitudeItems(cleanItems);
      }
    }
  }, [initialItems, removeNumbersFromItems, hasUserMadeChanges]);



  // Mount add button before animating in, unmount after animating out
  useEffect(() => {
    if (shouldShowAddButton) {
      setAddButtonMounted(true);
      buttonGroupAnim.setValue(0);
      Animated.spring(buttonGroupAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 14,
      }).start();
    } else {
      Animated.spring(buttonGroupAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 120,
        friction: 14,
      }).start(({ finished }) => {
        if (finished) { setAddButtonMounted(false); }
      });
    }
  }, [shouldShowAddButton, buttonGroupAnim]);

  // Optimized text formatting function - no longer adds numbers since they're displayed separately
  const formatText = useCallback((text: string): string => {
    // Just return the text as-is since numbering is handled separately
    return text;
  }, []);

  // Optimized item change handler with batched state updates
  const handleItemChange = useCallback((index: number, text: string) => {
    const formattedText = formatText(text);
    setGratitudeItems(prev => {
      const newItems = [...prev];
      newItems[index] = formattedText;
      return newItems;
    });
    setHasUserMadeChanges(true);
  }, [formatText]);

  const addGratitudeItem = useCallback(() => {
    triggerLightHaptic(); // Add haptic feedback
    setGratitudeItems(prev => {
      const newIndex = prev.length;
      const newItems = [...prev, ''];
      // Focus the new input after state update
      setTimeout(() => {
        if (inputRefs.current[newIndex]) {
          inputRefs.current[newIndex]?.focus();
          // Scroll to the bottom of the content
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }, 150);
      return newItems;
    });
    setHasUserMadeChanges(true);
  }, []);

  const getCurrentDate = () => {
    const date = selectedDate;
    const currentYear = new Date().getFullYear();
    const dateYear = date.getFullYear();

    // Don't show year if it's the current year
    if (dateYear === currentYear) {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const handleSave = useCallback(() => {
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

  }, [gratitudeItems, onSave]);

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
            ref={scrollViewRef}
            style={s.content}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title section with lock icon */}
            <View style={s.titleRow}>
              <ThemedText weight="bold" style={[s.entryInput, s.titleInput, s.transparentInput, s.lockedTitleText, s.titleTextFlex]}>
                {getTitle()}
              </ThemedText>
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
                <View style={s.gratitudeItemRow}>
                  <View style={s.gratitudeNumberContainer}>
                    <ThemedText weight="semiBold" style={s.gratitudeNumber}>{index + 1}</ThemedText>
                  </View>
                  <TextInput
                    ref={(inputRef) => { inputRefs.current[index] = inputRef; }}
                    style={[s.gratitudeItemInput, { fontFamily: fontRegular }]}
                    placeholder={getPlaceholder()}
                    placeholderTextColor={Colors.textGray}
                    value={item}
                    onChangeText={(text) => {
                      // Use optimized text formatting
                      handleItemChange(index, text);
                    }}
                    multiline
                    keyboardAppearance="dark"
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
              </View>
            ))}

            {/* Metadata section - matching reflection editor format */}
            {(_subtaskTitle || playbookTitle) && (
              <PlaybookMetaSection
                playbookTitle={playbookTitle}
                actionLabel={actionStepNumber && actionStepTitle
                  ? `Action ${actionStepNumber}: ${actionStepTitle}`
                  : (_subtaskTitle && !actionStepTitle ? _subtaskTitle : undefined)}
                stepBody={stepBody}
                stepExample={stepExample}
              />
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
                  triggerLightHaptic();
                  _onCancel();
                }}
              >
                <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>

              {/* Add More FAB — only mounted when 3rd field is filled, springs in/out */}
              {addButtonMounted && (
                <Animated.View
                  style={{ opacity: buttonGroupAnim, transform: [{ scale: addButtonScale }] }}
                >
                  <TouchableOpacity
                    style={[s.fab, s.addFab]}
                    onPress={() => {
                      triggerLightHaptic();
                      addGratitudeItem();
                    }}
                  >
                    <Ionicons name="add" size={22} color="rgba(255,255,255,0.65)" />
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Save FAB — always at its natural position */}
              <TouchableOpacity
                style={[
                  s.fab,
                  s.saveFab,
                  (!isFormValid || isLoading) && s.fabDisabled,
                ]}
                disabled={!isFormValid || isLoading}
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
          </View>
        </View>
      </KeyboardAvoidingView>

    </View>
  );
};

// Component display name
GratitudeLogEditorInner.displayName = 'GratitudeLogEditorInner';

// Apply React.memo with proper forwardRef pattern
const GratitudeLogEditor = React.memo(React.forwardRef(GratitudeLogEditorInner));

export default GratitudeLogEditor;

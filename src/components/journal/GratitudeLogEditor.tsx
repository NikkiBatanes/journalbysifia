import React, { useRef, useEffect, useImperativeHandle, useCallback, useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { triggerLightHaptic } from '../../utils/haptics';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import PlaybookMetaSection from './PlaybookMetaSection';
import StepFadeIn from '../common/StepFadeIn';
import { isToday, isYesterday, startOfDay } from 'date-fns';

interface GratitudeLogEditorProps {
  onSave: (data: {
    items: string[];
    date: Date;
  }) => void;
  onCancel: () => void;
  onUpgradeRequired?: () => void;
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

const getDateContext = (selectedDate: Date): DateContext => {
  const day = startOfDay(selectedDate);
  if (isToday(day)) { return 'today'; }
  if (isYesterday(day)) { return 'yesterday'; }
  return 'earlier';
};

export interface GratitudeLogEditorRef {
  focusInput: (skipScroll?: boolean) => void;
  reset: () => void;
}

const defaultStyles = {
  container: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  contentCard: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  stepScroll: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 20,
    paddingBottom: 320,
  },
  focusLabelContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginBottom: 8,
    marginTop: 32,
  },
  labelIcon: {
    marginTop: 1,
  },
  focusLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.sageMuted,
  },
  titleRow: {
    marginBottom: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepTitle: {
    fontSize: 24,
    color: Colors.text,
    lineHeight: 30,
    marginBottom: 0,
    textAlign: 'center' as const,
  },
  stepSubtitle: {
    fontSize: 16,
    color: Colors.textGray,
    lineHeight: 24,
    marginBottom: 12,
  },
  prioritiesContainer: {
    gap: 12,
  },
  priorityInputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  priorityNumberContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.sage,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  priorityNumber: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
    lineHeight: 16,
  },
  priorityInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    padding: 16,
    fontSize: 18,
    color: Colors.text,
  },
  primaryButton: {
    height: 42,
    backgroundColor: Colors.sage,
    borderRadius: 21,
    shadowColor: Colors.sage,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 20,
  },
  saveButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  buttonContainer: {
    position: 'absolute' as const,
    right: 20,
    flexDirection: 'row' as const,
    gap: 12,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.lightGray,
  },
  saveButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.sage,
  },
  closeButton: {
    position: 'absolute' as const,
    right: 20,
    width: 42,
    height: 42,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.cardBackground,
    borderRadius: 999,
    zIndex: 100,
  },
  fabWrapper: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  metadataContainer: {
    marginTop: 32,
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
  const insets = useSafeAreaInsets();

  const s = { ...defaultStyles, ...styles };

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

  const removeNumbersFromItems = useCallback((items: string[]): string[] => {
    return items.map((item) => item.replace(/^\d+\. /, ''));
  }, []);

  const processedInitialItems = initialItems.length > 0 ? removeNumbersFromItems(initialItems) : ['', '', ''];

  const [gratitudeItems, setGratitudeItems] = React.useState<string[]>(processedInitialItems);
  const [hasUserMadeChanges, setHasUserMadeChanges] = React.useState(false);

  const saveButtonOpacity = useRef(new Animated.Value(0)).current;
  const saveButtonScale = useRef(new Animated.Value(0.8)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const buttonPosition = useRef(new Animated.Value(insets.bottom + 20)).current;

  useImperativeHandle(ref, () => ({
    focusInput: (skipScroll = false) => {
      if (!inputRefs.current || inputRefs.current.length === 0) {
        inputRefs.current = [null, null, null];
      }
      const targetIndex = gratitudeItems.findIndex(item => item.trim().length === 0);
      if (targetIndex === -1) {
        setGratitudeItems(prev => [...prev, '']);
        setTimeout(() => {
          if (inputRefs.current[inputRefs.current.length - 1]) {
            inputRefs.current[inputRefs.current.length - 1]!.focus();
            if (!skipScroll) {
              setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: scrollY.current + 80, animated: true });
              }, 100);
            }
          }
        }, 200);
      } else {
        setTimeout(() => {
          if (inputRefs.current[targetIndex]) {
            inputRefs.current[targetIndex]!.focus();
            if (!skipScroll) {
              setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: scrollY.current + 80, animated: true });
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

  useEffect(() => {
    if (initialItems && initialItems.length > 0 && !hasUserMadeChanges) {
      const hasExistingData = initialItems.some((item: string) => item.trim());
      if (hasExistingData) {
        const cleanItems = removeNumbersFromItems(initialItems);
        setGratitudeItems(cleanItems);
      }
    }
  }, [initialItems, removeNumbersFromItems, hasUserMadeChanges]);

  useEffect(() => {
    const shouldShow = gratitudeItems.some(item => item.trim() !== '');
    Animated.spring(saveButtonOpacity, {
      toValue: shouldShow ? 1 : 0,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
    Animated.spring(saveButtonScale, {
      toValue: shouldShow ? 1 : 0.8,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, [gratitudeItems, saveButtonOpacity, saveButtonScale]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setIsKeyboardVisible(true);
      Animated.timing(buttonPosition, {
        toValue: insets.bottom + ((e.endCoordinates.height || 325) * 0.95),
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
      Animated.timing(buttonPosition, {
        toValue: insets.bottom + 20,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [insets.bottom, buttonPosition]);

  const handleItemChange = useCallback((index: number, text: string) => {
    setGratitudeItems(prev => {
      const newItems = [...prev];
      newItems[index] = text;
      return newItems;
    });
    setHasUserMadeChanges(true);
  }, []);

  const addGratitudeItem = useCallback(() => {
    triggerLightHaptic();
    setGratitudeItems(prev => {
      const newIndex = prev.length;
      const newItems = [...prev, ''];
      setTimeout(() => {
        if (inputRefs.current[newIndex]) {
          if (newIndex >= 3) {
            scrollViewRef.current?.scrollTo({ y: scrollY.current + 80, animated: true });
          }
          inputRefs.current[newIndex]?.focus();
        }
      }, 150);
      return newItems;
    });
    setHasUserMadeChanges(true);
  }, []);

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
    const cleanItems = filledItems.map(item => item.replace(/^\d+\. /, ''));
    onSave({
      items: cleanItems,
      date: selectedDate || new Date(),
    });
  }, [gratitudeItems, onSave, selectedDate]);

  return (
    <View style={s.container}>
      <KeyboardAvoidingView
        style={s.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        enabled={Platform.OS === 'ios'}
      >
        <View style={s.contentCard}>
          <ScrollView
            ref={scrollViewRef}
            style={s.stepScroll}
            contentContainerStyle={[
              s.stepContent,
              { paddingTop: insets.top + 8, paddingBottom: isKeyboardVisible ? 320 : 30 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={true}
            onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
          >
            <StepFadeIn delay={0}>
              <View style={s.focusLabelContainer}>
                <Ionicons name="moon" size={16} color={Colors.sage} style={s.labelIcon} />
                <ThemedText weight="semiBold" style={[s.focusLabel, { color: Colors.sageMuted }]}>EVENING CHECK IN</ThemedText>
              </View>
            </StepFadeIn>

            <StepFadeIn delay={40}>
              <View style={s.titleRow}>
                <ThemedText weight="semiBold" style={[s.stepTitle, { color: Colors.text }]}>
                  {getTitle()}
                </ThemedText>
              </View>
            </StepFadeIn>

            <StepFadeIn delay={120} style={[s.prioritiesContainer, { marginTop: 32 }]}>
              <StepFadeIn delay={0}>
                <ThemedText style={[s.stepSubtitle, { color: Colors.textGray }]}>
                  Add a few things you are grateful for today.
                </ThemedText>
              </StepFadeIn>
              {gratitudeItems.map((item, index) => (
                <View key={index} style={s.priorityInputRow}>
                  <View style={s.priorityNumberContainer}>
                    <ThemedText weight="semiBold" style={s.priorityNumber}>{index + 1}</ThemedText>
                  </View>
                  <TextInput
                    ref={(inputRef) => { inputRefs.current[index] = inputRef; }}
                    style={[s.priorityInput, { fontFamily: fontRegular }]}
                    placeholder={getPlaceholder()}
                    placeholderTextColor={Colors.textGray}
                    value={item}
                    onChangeText={(text) => handleItemChange(index, text)}
                    onSubmitEditing={() => {
                      if (index < gratitudeItems.length - 1) {
                        inputRefs.current[index + 1]?.focus();
                      } else {
                        Keyboard.dismiss();
                      }
                    }}
                    returnKeyType={index < gratitudeItems.length - 1 ? 'next' : 'done'}
                    autoFocus={index === 0}
                    keyboardAppearance="light"
                  />
                </View>
              ))}
            </StepFadeIn>

            {(_subtaskTitle || playbookTitle) && (
              <View style={s.metadataContainer}>
                <PlaybookMetaSection
                  playbookTitle={playbookTitle}
                  actionLabel={actionStepNumber && actionStepTitle
                    ? `Action ${actionStepNumber}: ${actionStepTitle}`
                    : (_subtaskTitle && !actionStepTitle ? _subtaskTitle : undefined)}
                  stepBody={stepBody}
                  stepExample={stepExample}
                />
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        </View>

        <View style={s.fabWrapper}>
          <Animated.View style={[s.buttonContainer, { bottom: buttonPosition }]}>
            <TouchableOpacity
              onPress={addGratitudeItem}
              activeOpacity={0.7}
              style={[s.addButton, { backgroundColor: Colors.lightGray }]}
            >
              <Ionicons name="add" size={22} color={Colors.textGray} />
            </TouchableOpacity>
            <Animated.View
              style={{
                opacity: saveButtonOpacity,
                transform: [{ scale: saveButtonScale }],
              }}
            >
              <TouchableOpacity
                onPress={handleSave}
                activeOpacity={0.7}
                style={s.saveButton}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.hopeWhite} />
                ) : (
                  <Ionicons name="chevron-forward" size={22} color={Colors.hopeWhite} />
                )}
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      <View style={[s.closeButton, { top: insets.top + 8 }]}>
        <TouchableOpacity
        onPress={_onCancel}
        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={17} color={Colors.sage} />
      </TouchableOpacity>
      </View>
    </View>
  );
};

GratitudeLogEditorInner.displayName = 'GratitudeLogEditorInner';
const GratitudeLogEditor = React.memo(React.forwardRef(GratitudeLogEditorInner));
export default GratitudeLogEditor;

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Keyboard,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Entypo from 'react-native-vector-icons/Entypo';

import { toLocalDateString } from '../../utils/date';
import {
  createLocalJournalEntry,
  deleteLocalJournalEntriesForDate,
  getLocalJournalEntries,
  LocalJournalEntry,
} from '../../storage/journalStorage';
import { triggerLightHaptic, triggerMediumHaptic } from '../../utils/haptics';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { isToday, isYesterday, startOfDay } from 'date-fns';
import StepFadeIn from '../common/StepFadeIn';

const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;

type DateContext = 'today' | 'yesterday' | 'earlier';

const getDateContext = (selectedDate: Date): DateContext => {
  const day = startOfDay(selectedDate);

  if (isToday(day)) {return 'today';}
  if (isYesterday(day)) {return 'yesterday';}
  return 'earlier';
};

interface TodosExperienceProps {
  selectedDate: Date;
  initialItems?: string[];
  onClose?: () => void;
  onComplete: (result: { record: LocalJournalEntry | null; items: LocalJournalEntry[] }) => void | Promise<void>;
}

const TodosExperience: React.FC<TodosExperienceProps> = ({
  selectedDate,
  initialItems,
  onClose,
  onComplete,
}) => {
  const insets = useSafeAreaInsets();
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const dateStr = toLocalDateString(selectedDate);
  const dateContext = getDateContext(selectedDate);

  const [todos, setTodos] = useState<string[]>(['', '', '']);
  const [showSaveButton, setShowSaveButton] = useState(false);
  const hasLoadedInitialTodos = useRef(false);

  const inputRefs = useRef<(TextInput | null)[]>([]).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const getTitle = () => {
    switch (dateContext) {
      case 'today': return 'What needs to get done today?';
      case 'yesterday': return 'What needed to get done yesterday?';
      case 'earlier': return 'What needed to get done on this day?';
    }
  };

  useEffect(() => {
    if (hasLoadedInitialTodos.current) {return;}
    hasLoadedInitialTodos.current = true;
    (async () => {
      let loaded: string[] = [];
      if (initialItems && initialItems.length > 0) {
        loaded = initialItems;
      } else {
        try {
          const entries = await getLocalJournalEntries('todo', dateStr);
          loaded = entries
            .map(entry => {
              const parsed = typeof entry.content === 'string'
                ? JSON.parse(entry.content)
                : entry.content;
              return parsed.text || '';
            })
            .filter(text => text.trim() !== '');
        } catch (error) {
          console.warn('Error loading local to-dos:', error);
        }
      }

      const paddedTodos = [...loaded];
      while (paddedTodos.length < 3) {
        paddedTodos.push('');
      }

      const allFilled = paddedTodos.every(todo => todo.trim() !== '');
      if (allFilled) {
        paddedTodos.push('');
      }

      setTodos(paddedTodos);

      setTimeout(() => {
        const firstEmptyIndex = paddedTodos.findIndex(todo => todo.trim() === '');
        if (firstEmptyIndex !== -1 && inputRefs[firstEmptyIndex]) {
          inputRefs[firstEmptyIndex]?.focus();
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }
      }, 100);
    })();
  }, [dateStr, initialItems, inputRefs, scrollViewRef]);

  const saveButtonOpacity = useRef(new Animated.Value(showSaveButton ? 1 : 0)).current;
  const saveButtonScale = useRef(new Animated.Value(showSaveButton ? 1 : 0.8)).current;
  const saveButtonTranslateX = useRef(new Animated.Value(0)).current;
  const addButtonOpacity = useRef(new Animated.Value(todos[2]?.trim() !== '' ? 1 : 0)).current;
  const addButtonScale = useRef(new Animated.Value(todos[2]?.trim() !== '' ? 1 : 0.8)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const shouldShow = todos.some((todo: string) => todo.trim() !== '');
    setShowSaveButton(shouldShow);

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
  }, [todos, saveButtonOpacity, saveButtonScale]);

  useEffect(() => {
    const shouldShow = todos[2]?.trim() !== '';

    Animated.spring(addButtonOpacity, {
      toValue: shouldShow ? 1 : 0,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();

    Animated.spring(addButtonScale, {
      toValue: shouldShow ? 1 : 0.8,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();

    Animated.spring(saveButtonTranslateX, {
      toValue: shouldShow ? 0 : 54,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, [todos, addButtonOpacity, addButtonScale, saveButtonTranslateX]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const buttonPosition = useRef(new Animated.Value(insets.bottom + 20)).current;
  const [_keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      Animated.timing(buttonPosition, {
        toValue: insets.bottom + ((e.endCoordinates.height || 325) * 0.95),
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
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

  const handleSave = async () => {
    try {
      const validTodos = todos.filter((t: string) => t.trim() !== '');

      if (validTodos.length === 0) {
        Alert.alert('No Tasks', 'Please add at least one task before saving.');
        return;
      }

      await deleteLocalJournalEntriesForDate('todo', dateStr);
      const created: LocalJournalEntry[] = [];
      for (const todo of validTodos) {
        const record = await createLocalJournalEntry({
          server_id: null,
          content_type: 'todo',
          selected_date: dateStr,
          content: JSON.stringify({
            text: todo,
            completed: false,
            priority: false,
          }),
          completed: false,
        });
        created.push(record);
      }

      triggerMediumHaptic();

      const record = created[0] || null;
      await onComplete({ record, items: created });
    } catch (saveError) {
      console.error('Error saving to-dos:', saveError);
      Alert.alert('Error', 'Failed to save to-dos. Please try again.');
    }
  };

  const handleAddField = () => {
    triggerLightHaptic();
    const newTodos = [...todos, ''];
    setTodos(newTodos);
    setTimeout(() => {
      const newIndex = newTodos.length - 1;
      if (inputRefs[newIndex]) {
        inputRefs[newIndex]?.focus();
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  const handleClose = () => {
    if (onClose) {onClose();}
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.lightBackground }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: isKeyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={true}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <Entypo name="list" size={16} color={Colors.sage} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={[styles.focusLabel, { color: Colors.sageMuted }]}>TO-DOS</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={[styles.stepTitle, { color: Colors.text }]}>
              {getTitle()}
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={120} style={[styles.prioritiesContainer, { marginTop: 32 }]}>
          <StepFadeIn delay={0}>
            <ThemedText style={[styles.stepSubtitle, { color: Colors.textGray }]}>
              Add the tasks you do not want to forget.
            </ThemedText>
          </StepFadeIn>
          {todos.map((todo: string, index: number) => (
            <View key={index} style={styles.priorityInputRow}>
              <View style={[styles.priorityNumberContainer, { backgroundColor: Colors.sage }]}>
                <ThemedText weight="semiBold" style={[styles.priorityNumber, { color: Colors.hopeWhite }]}>{index + 1}</ThemedText>
              </View>
              <TextInput
                ref={(ref) => {
                  inputRefs[index] = ref;
                }}
                style={[
                  styles.priorityInput,
                  { fontFamily: getFontFamily(fontKey, 'regular') },
                  { color: Colors.text },
                ]}
                value={todo}
                onChangeText={(text) => {
                  const newTodos = [...todos];
                  newTodos[index] = text;
                  setTodos(newTodos);
                }}
                onFocus={() => {
                  if (!inputRefs[index]) {
                    inputRefs[index] = null;
                  }
                }}
                onSubmitEditing={() => {
                  if (index < todos.length - 1 && inputRefs[index + 1]) {
                    inputRefs[index + 1]?.focus();
                  }
                }}
                returnKeyType={index < todos.length - 1 ? 'next' : 'done'}
                autoFocus={index === 0}
                keyboardAppearance="default"
              />
            </View>
          ))}
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.buttonContainer, IS_IPAD && styles.buttonContainerPad, { bottom: buttonPosition }]}>
        <Animated.View
          style={{
            opacity: saveButtonOpacity,
            transform: [{ scale: saveButtonScale }, { translateX: saveButtonTranslateX }],
          }}
        >
          <TouchableOpacity
            onPress={handleSave}
            activeOpacity={0.7}
            style={[styles.primaryButton, { backgroundColor: Colors.sage, shadowColor: Colors.sage }]}
          >
            <ThemedText weight="semiBold" style={styles.saveButtonText}>Save To-dos</ThemedText>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View
          style={{
            opacity: addButtonOpacity,
            transform: [{ scale: addButtonScale }],
          }}
        >
          <TouchableOpacity
            onPress={handleAddField}
            activeOpacity={0.7}
            style={[styles.addButton, { backgroundColor: Colors.lightGray }]}
          >
            <Ionicons name="add" size={22} color={Colors.textGray} />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {onClose && (
        <View style={[styles.closeButton, { top: insets.top + 8, backgroundColor: Colors.cardBackground }]}>
          <TouchableOpacity
            onPress={handleClose}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={17} color={Colors.sage} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
  },
  stepScroll: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 20,
    paddingBottom: 320,
  },
  stepContentPad: {
    paddingHorizontal: 160,
  },
  focusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 24,
    color: Colors.text,
    lineHeight: 30,
    marginBottom: 0,
    textAlign: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priorityNumberContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.sage,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityNumber: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: 'bold',
    textAlign: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  saveButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  buttonContainer: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    gap: 12,
  },
  buttonContainerPad: {
    right: 48,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.lightGray,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 999,
    zIndex: 100,
  },
});

export default TodosExperience;

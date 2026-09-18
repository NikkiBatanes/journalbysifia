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
  deleteLocalJournalEntry,
  getLocalTodosForDate,
  updateLocalJournalEntry,
  LocalJournalEntry,
} from '../../storage/journalStorage';
import { triggerLightHaptic, triggerMediumHaptic } from '../../utils/haptics';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { useRoutineDraft } from '../../hooks/useRoutineDraft';
import { refreshMorningWidgetSnapshot } from '../../services/morningWidgetService';
import { isAfter, isToday, isYesterday, startOfDay } from 'date-fns';
import StepFadeIn from '../common/StepFadeIn';

const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;

type DateContext = 'today' | 'yesterday' | 'earlier' | 'upcoming';

const getDateContext = (selectedDate: Date): DateContext => {
  const day = startOfDay(selectedDate);

  if (isToday(day)) {return 'today';}
  if (isYesterday(day)) {return 'yesterday';}
  if (isAfter(day, startOfDay(new Date()))) {return 'upcoming';}
  return 'earlier';
};

interface TodoItem {
  id?: string;
  text: string;
}

interface TodosExperienceProps {
  selectedDate: Date;
  initialItems?: string[];
  onClose?: () => void;
  onComplete: (result: { record: LocalJournalEntry | null; items: LocalJournalEntry[] }) => void | Promise<void>;
  routineDraft?: { routine: 'morning' | 'evening'; selectedDate: string; step: string };
  planningContext?: 'tomorrow' | 'later';
  skipCompletionPage?: boolean;
}

const emptyTodo = (): TodoItem => ({ text: '' });

// Saved summary shown at the end of the standalone walkthrough — embedded
// routine/planning flows pass skipCompletionPage and advance via onComplete.
const TodosCompletionStep: React.FC<{
  items: string[];
  onDone: () => void;
  insets: { top: number; bottom: number };
  dateContext: DateContext;
}> = ({ items, onDone, insets, dateContext }) => {
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconRotation = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef(items.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const checkmarkAnim = Animated.spring(checkmarkScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      delay: 400,
      useNativeDriver: true,
    });
    const iconAnim = Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 80,
        friction: 8,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(iconRotation, {
        toValue: 1,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
    ]);
    const itemAnim = Animated.stagger(80, itemAnims.map(anim =>
      Animated.spring(anim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      })
    ));

    checkmarkAnim.start();
    iconAnim.start();
    itemAnim.start();

    return () => {
      checkmarkAnim.stop();
      iconAnim.stop();
      itemAnim.stop();
    };
  }, [checkmarkScale, iconScale, iconRotation, itemAnims]);

  const iconRotateInterpolate = iconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getEyebrowLabel = () => {
    switch (dateContext) {
      case 'today': return "TODAY'S TO-DOS";
      case 'yesterday': return "YESTERDAY'S TO-DOS";
      case 'upcoming': return 'UPCOMING TO-DOS';
      default: return 'TO-DOS';
    }
  };

  const getSubtext = () => {
    switch (dateContext) {
      case 'today': return 'Your to-dos are set for today';
      case 'yesterday': return 'Your to-dos from yesterday';
      case 'upcoming': return 'Your to-dos for this day';
      default: return 'Your to-dos from this day';
    }
  };

  const getFooterText = () => {
    switch (dateContext) {
      case 'today': return 'You can check these off throughout the day.';
      case 'yesterday': return 'A record of what you needed to do yesterday.';
      case 'upcoming': return 'A plan set ahead — you can update it any time.';
      default: return 'A record of what you needed to do this day.';
    }
  };

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <Entypo name="list" size={16} color={Colors.sage} />
          <ThemedText weight="semiBold" style={[styles.stepLabelWhite, { color: Colors.sageMuted }]}>
            {getEyebrowLabel()}
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={80} style={[styles.completionCard, { backgroundColor: Colors.cardBackground }]}>
          <View style={styles.completionHeader}>
            <Animated.View style={[
              styles.completionIconContainer,
              {
                backgroundColor: Colors.sage,
                transform: [
                  { scale: iconScale },
                  { rotate: iconRotateInterpolate },
                ],
              },
            ]}>
              <Entypo name="list" size={22} color={Colors.hopeWhite} />
            </Animated.View>
            <View style={styles.completionHeaderContent}>
              <ThemedText weight="semiBold" style={styles.completionCategory}>To-dos</ThemedText>
              <ThemedText style={styles.completionSubtext}>{getSubtext()}</ThemedText>
            </View>
            <Animated.View style={[
              styles.completionCheckmark,
              { transform: [{ scale: checkmarkScale }] },
            ]}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.sage} />
            </Animated.View>
          </View>

          <View style={[styles.completionSection, { borderTopColor: Colors.inputBorder }]}>
            <ThemedText weight="medium" style={styles.completionSectionLabel}>To-dos</ThemedText>
            <View style={styles.prioritiesList}>
              {items.map((item: string, index: number) => (
                <View key={index} style={styles.priorityItem}>
                  <Animated.View style={[
                    styles.priorityBullet,
                    { backgroundColor: Colors.sage },
                    { transform: [{ scale: itemAnims[index] || 0 }] },
                  ]}>
                    <ThemedText weight="semiBold" style={styles.priorityBulletText}>{index + 1}</ThemedText>
                  </Animated.View>
                  <ThemedText style={styles.priorityText}>{item}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.completionFooter, { borderTopColor: Colors.inputBorder }]}>
            <ThemedText style={styles.completionFooterText}>
              {getFooterText()}
            </ThemedText>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.completionButtonContainer, IS_IPAD && styles.completionButtonContainerPad, { bottom: insets.bottom + 20, backgroundColor: Colors.lightBackground }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onDone();
          }}
          activeOpacity={0.85}
          style={[styles.completionButton, { backgroundColor: Colors.sage }]}
        >
          <ThemedText weight="semiBold" style={styles.completionButtonText}>Done</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const TodosExperience: React.FC<TodosExperienceProps> = ({
  selectedDate,
  initialItems,
  onClose,
  onComplete,
  routineDraft,
  planningContext,
  skipCompletionPage,
}) => {
  const insets = useSafeAreaInsets();
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const dateStr = toLocalDateString(selectedDate);
  const dateContext = getDateContext(selectedDate);

  const [todos, setTodos] = useState<TodoItem[]>([emptyTodo(), emptyTodo(), emptyTodo()]);
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const pendingResultRef = useRef<{ record: LocalJournalEntry | null; items: LocalJournalEntry[] } | null>(null);
  const clearDraft = useRoutineDraft(
    routineDraft?.routine ?? 'morning',
    routineDraft?.selectedDate ?? dateStr,
    routineDraft?.step ?? 'disabled-todos',
    todos,
    draft => { if (routineDraft) {setTodos(draft);} },
    Boolean(routineDraft),
  );
  const loadedDateRef = useRef<string | null>(null);

  const inputRefs = useRef<(TextInput | null)[]>([]).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const getTitle = () => {
    if (planningContext) {
      return planningContext === 'tomorrow' ? 'What needs your attention tomorrow?' : 'What needs your attention on this day?';
    }
    switch (dateContext) {
      case 'today': return 'What needs to get done today?';
      case 'yesterday': return 'What needed to get done yesterday?';
      case 'earlier': return 'What needed to get done on this day?';
      case 'upcoming': return 'What needs to get done on this day?';
    }
  };

  useEffect(() => {
    if (loadedDateRef.current === dateStr) {return;}
    loadedDateRef.current = dateStr;
    (async () => {
      let loaded: TodoItem[] = [];
      if (initialItems && initialItems.length > 0) {
        loaded = initialItems.map(text => ({ text }));
      } else {
        try {
          const entries = await getLocalTodosForDate(dateStr);
          loaded = entries
            .map(entry => {
              const parsed = typeof entry.content === 'string'
                ? JSON.parse(entry.content)
                : entry.content;
              return {
                id: entry.id,
                text: parsed.text || '',
              };
            })
            .filter(item => item.text.trim() !== '');
        } catch (error) {
          console.warn('Error loading local to-dos:', error);
        }
      }

      const paddedTodos = [...loaded];
      while (paddedTodos.length < 3) {
        paddedTodos.push(emptyTodo());
      }

      const allFilled = paddedTodos.every(todo => todo.text.trim() !== '');
      if (allFilled) {
        paddedTodos.push(emptyTodo());
      }

      setTodos(paddedTodos);

      setTimeout(() => {
        const firstEmptyIndex = paddedTodos.findIndex(todo => todo.text.trim() === '');
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
  const addButtonOpacity = useRef(new Animated.Value(todos[2]?.text?.trim() !== '' ? 1 : 0)).current;
  const addButtonScale = useRef(new Animated.Value(todos[2]?.text?.trim() !== '' ? 1 : 0.8)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const shouldShow = Boolean(planningContext) || todos.some((todo: TodoItem) => todo.text.trim() !== '');
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
  }, [todos, planningContext, saveButtonOpacity, saveButtonScale]);

  useEffect(() => {
    const shouldShow = todos[2]?.text?.trim() !== '';

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
      const validTodos = todos.filter((t: TodoItem) => t.text.trim() !== '');

      if (validTodos.length === 0 && !planningContext) {
        Alert.alert('No Tasks', 'Please add at least one task before saving.');
        return;
      }

      const existingEntries = await getLocalTodosForDate(dateStr);
      const existingById = new Map<string, LocalJournalEntry>();
      for (const entry of existingEntries) {
        existingById.set(entry.id, entry);
      }

      const keptIds = new Set<string>();
      const saved: LocalJournalEntry[] = [];

      for (const todo of validTodos) {
        const trimmedText = todo.text.trim();

        if (todo.id && existingById.has(todo.id)) {
          const existing = existingById.get(todo.id)!;
          const parsed = typeof existing.content === 'string'
            ? JSON.parse(existing.content)
            : existing.content;
          const updated = await updateLocalJournalEntry({
            ...existing,
            content: JSON.stringify({
              text: trimmedText,
              completed: parsed.completed ?? false,
              priority: parsed.priority ?? false,
            }),
          });
          saved.push(updated);
          keptIds.add(todo.id);
        } else {
          const record = await createLocalJournalEntry({
            server_id: null,
            content_type: 'todo',
            selected_date: dateStr,
            content: JSON.stringify({
              text: trimmedText,
              completed: false,
              priority: false,
            }),
            completed: false,
          });
          todo.id = record.id;
          saved.push(record);
        }
      }

      for (const existing of existingEntries) {
        if (!keptIds.has(existing.id)) {
          await deleteLocalJournalEntry(existing.id, 'todo', dateStr);
        }
      }

      setTodos([...todos]);

      if (routineDraft) {await clearDraft();}
      triggerMediumHaptic();

      const record = saved[0] || null;
      void refreshMorningWidgetSnapshot();

      if (skipCompletionPage) {
        await onComplete({ record, items: saved });
        return;
      }

      pendingResultRef.current = { record, items: saved };
      setCompletedItems(validTodos.map(todo => todo.text.trim()));
      Keyboard.dismiss();
      setShowCompletion(true);
    } catch (saveError) {
      console.error('Error saving to-dos:', saveError);
      Alert.alert('Error', 'Failed to save to-dos. Please try again.');
    }
  };

  const handleAddField = () => {
    triggerLightHaptic();
    const newTodos = [...todos, emptyTodo()];
    setTodos(newTodos);
    setTimeout(() => {
      const newIndex = newTodos.length - 1;
      if (inputRefs[newIndex]) {
        inputRefs[newIndex]?.focus();
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  const handleDone = async () => {
    const result = pendingResultRef.current;
    pendingResultRef.current = null;
    await onComplete(result ?? { record: null, items: [] });
  };

  const handleClose = () => {
    triggerLightHaptic();
    if (onClose) {onClose();}
  };

  const updateTodoText = (index: number, text: string) => {
    const newTodos = [...todos];
    newTodos[index] = { ...newTodos[index], text };
    setTodos(newTodos);
  };

  if (showCompletion) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.lightBackground }]}>
        <TodosCompletionStep
          items={completedItems}
          onDone={handleDone}
          insets={insets}
          dateContext={dateContext}
        />
      </View>
    );
  }

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
          {todos.map((todo: TodoItem, index: number) => (
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
                value={todo.text}
                onChangeText={(text) => updateTodoText(index, text)}
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
                keyboardAppearance="light"
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
            <ThemedText weight="semiBold" style={styles.saveButtonText}>{planningContext ? 'Done' : 'Save To-dos'}</ThemedText>
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
  stepContainer: {
    flex: 1,
  },
  stepScroll: {
    flex: 1,
  },
  stepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    marginTop: 48,
  },
  stepLabelWhite: {
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  completionCard: {
    borderRadius: 26,
    padding: 24,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  completionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionHeaderContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  completionCategory: {
    fontSize: 18,
    color: Colors.text,
  },
  completionSubtext: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 2,
  },
  completionCheckmark: {
    width: 32,
    alignItems: 'flex-end',
  },
  completionSection: {
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  completionSectionLabel: {
    fontSize: 11,
    color: Colors.textGray,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  prioritiesList: {
    gap: 8,
  },
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priorityBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityBulletText: {
    fontSize: 12,
    color: Colors.hopeWhite,
  },
  priorityText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  completionFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
  },
  completionFooterText: {
    fontSize: 13,
    color: Colors.textGray,
    lineHeight: 20,
  },
  completionButtonContainer: {
    position: 'absolute',
    left: 20,
    right: 18,
    padding: 12,
    borderRadius: 26,
  },
  completionButtonContainerPad: {
    left: 160,
    right: 160,
  },
  completionButton: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
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

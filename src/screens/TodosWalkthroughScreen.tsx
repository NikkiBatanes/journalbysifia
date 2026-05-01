import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Keyboard,
  StatusBar,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Entypo from 'react-native-vector-icons/Entypo';

import { useAuth } from '../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../utils/date';
import { useCreateTodoEntry, useDeleteTodoEntry, useTodosData } from '../services/hooks/useJournalData';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';
import ThemedText from '../components/common/ThemedText';
import { Colors } from '../theme/colors';
import { getFontFamily } from '../theme/fonts';
import { useTheme } from '../hooks/useTheme';
import { isToday, isYesterday, startOfDay } from 'date-fns';

import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TodosWalkthrough'>;

type DateContext = 'today' | 'yesterday' | 'earlier';

// Helper to compute date context from selected date
const getDateContext = (selectedDate: Date): DateContext => {
  const day = startOfDay(selectedDate);

  if (isToday(day)) {return 'today';}
  if (isYesterday(day)) {return 'yesterday';}
  return 'earlier';
};

// StepFadeIn component
interface StepFadeInProps {
  delay?: number;
  children: React.ReactNode;
  style?: any;
}

const StepFadeIn: React.FC<StepFadeInProps> = ({ delay = 0, children, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(t);
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

// Main Screen Component
const TodosWalkthroughScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = { top: 50, bottom: 34 }; // Use safe area insets in production
  const { user } = useAuth();
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const { selectedDate: selectedDateStr } = route.params || {};
  const selectedDate = selectedDateStr ? new Date(selectedDateStr) : new Date();

  // Parse existing entry content to initialize state
  const getInitialState = () => {
    if (existingTodos && existingTodos.length > 0) {
      try {
        // Extract text from individual todo entries
        const savedTodos = existingTodos.map(entry => {
          const parsedContent = typeof entry.content === 'string'
            ? JSON.parse(entry.content)
            : entry.content;
          return parsedContent.text || '';
        }).filter(text => text.trim() !== '');

        // Ensure we always have at least 3 task slots
        const paddedTodos = [...savedTodos];
        while (paddedTodos.length < 3) {
          paddedTodos.push('');
        }

        return {
          todos: paddedTodos,
        };
      } catch (error) {
        console.error('Error parsing existing entry content:', error);
      }
    }
    return {
      todos: ['', '', ''],
    };
  };

  const initialState = getInitialState();
  const [todos, setTodos] = useState(initialState.todos);
  const [showSaveButton, setShowSaveButton] = useState(todos.some((todo: string) => todo.trim() !== ''));
  const hasLoadedInitialTodos = useRef(false);

  const dateStr = toLocalDateString(selectedDate);
  const dateContext = getDateContext(selectedDate);

  const createMutation = useCreateTodoEntry();
  const deleteMutation = useDeleteTodoEntry();
  const { data: existingTodos } = useTodosData(user?.id || '', dateStr);

  const inputRefs = useRef<(TextInput | null)[]>([]).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Dynamic title based on date context
  const getTitle = () => {
    switch (dateContext) {
      case 'today': return 'What needs to get done today?';
      case 'yesterday': return 'What needed to get done yesterday?';
      case 'earlier': return 'What needed to get done on this day?';
    }
  };

  // Update todos when existingTodos data loads
  useEffect(() => {
    if (existingTodos && existingTodos.length > 0 && !hasLoadedInitialTodos.current) {
      const savedTodos = existingTodos.map(entry => {
        const parsedContent = typeof entry.content === 'string'
          ? JSON.parse(entry.content)
          : entry.content;
        return parsedContent.text || '';
      }).filter(text => text.trim() !== '');

      const paddedTodos = [...savedTodos];
      while (paddedTodos.length < 3) {
        paddedTodos.push('');
      }

      // Check if all fields are filled out
      const allFilled = paddedTodos.every(todo => todo.trim() !== '');

      if (allFilled) {
        // Add a new empty field if all are filled
        paddedTodos.push('');
      }

      setTodos(paddedTodos);
      hasLoadedInitialTodos.current = true;

      // Focus the first empty field and scroll to it
      setTimeout(() => {
        const firstEmptyIndex = paddedTodos.findIndex(todo => todo.trim() === '');
        if (firstEmptyIndex !== -1 && inputRefs[firstEmptyIndex]) {
          inputRefs[firstEmptyIndex]?.focus();
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }
      }, 100);
    }
  }, [existingTodos, inputRefs, scrollViewRef]);

  const saveButtonOpacity = useRef(new Animated.Value(showSaveButton ? 1 : 0)).current;
  const saveButtonScale = useRef(new Animated.Value(showSaveButton ? 1 : 0.8)).current;
  const saveButtonTranslateX = useRef(new Animated.Value(0)).current;
  const addButtonOpacity = useRef(new Animated.Value(todos[2]?.trim() !== '' ? 1 : 0)).current;
  const addButtonScale = useRef(new Animated.Value(todos[2]?.trim() !== '' ? 1 : 0.8)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Animate save button visibility
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

  // Animate add button visibility based on 3rd field
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

    // Move save button to add button position when add button is hidden
    Animated.spring(saveButtonTranslateX, {
      toValue: shouldShow ? 0 : 54, // 42px button + 12px gap
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, [todos, addButtonOpacity, addButtonScale, saveButtonTranslateX]);

  // Keyboard visibility tracking
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      'keyboardWillShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardWillHideListener = Keyboard.addListener(
      'keyboardWillHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Hide status bar for translucent scrolling effect
  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setHidden(true, 'slide');
      StatusBar.setBarStyle('light-content');
      return () => {
        StatusBar.setHidden(false, 'slide');
        StatusBar.setBarStyle('light-content');
      };
    }, [])
  );

  const verticalLineHeight = useRef(new Animated.Value(0)).current;
  const [_keyboardVisible, setKeyboardVisible] = useState(false);
  const buttonPosition = useRef(new Animated.Value(insets.bottom + 20)).current;

  useEffect(() => {
    Animated.timing(verticalLineHeight, {
      toValue: 75,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [verticalLineHeight]);

  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', () => {
      setKeyboardVisible(true);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 325,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });
    const keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardVisible(false);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 20,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [insets.bottom, buttonPosition]);

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save todos.');
      return;
    }

    try {
      const validTodos = todos.filter((t: string) => t.trim() !== '');

      if (validTodos.length === 0) {
        Alert.alert('No Tasks', 'Please add at least one task before saving.');
        return;
      }

      // Delete all existing todo entries for this date in parallel
      if (existingTodos && existingTodos.length > 0) {
        await Promise.all(
          existingTodos.map(entry => deleteMutation.mutateAsync(entry.id))
        );
      }

      // Create new individual entries for each todo in parallel
      await Promise.all(
        validTodos.map(todo =>
          createMutation.mutateAsync({
            user_id: user.id,
            selected_date: dateStr,
            content_type: 'todo',
            content: JSON.stringify({
              text: todo,
              completed: false,
              priority: false,
            }),
            completed: false,
          })
        )
      );

      triggerMediumHaptic();
      navigation.goBack();
    } catch (saveError) {
      console.error('Error saving todos:', saveError);
      Alert.alert('Error', 'Failed to save todos. Please try again.');
    }
  };

  const handleAddField = () => {
    triggerLightHaptic();
    const newTodos = [...todos, ''];
    setTodos(newTodos);
    // Focus the newly added input field
    setTimeout(() => {
      const newIndex = newTodos.length - 1;
      if (inputRefs[newIndex]) {
        inputRefs[newIndex]?.focus();
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: isKeyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={true}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <Entypo name="list" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>TO-DOS</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={styles.stepTitle}>
              {getTitle()}
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={120} style={[styles.prioritiesContainer, { marginTop: 32 }]}>
          <StepFadeIn delay={0}>
            <ThemedText style={styles.stepSubtitle}>
              Add the tasks you do not want to forget.
            </ThemedText>
          </StepFadeIn>
          {todos.map((todo: string, index: number) => (
            <View key={index} style={styles.priorityInputRow}>
              <View style={styles.priorityNumberContainer}>
                <ThemedText weight="semiBold" style={styles.priorityNumber}>{index + 1}</ThemedText>
              </View>
              <TextInput
                ref={(ref) => {
                  inputRefs[index] = ref;
                }}
                style={[styles.priorityInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
                value={todo}
                onChangeText={(text) => {
                  const newTodos = [...todos];
                  newTodos[index] = text;
                  setTodos(newTodos);
                }}
                onFocus={() => {
                  // Ensure input refs are updated when todos array changes
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
                keyboardAppearance="dark"
              />
            </View>
          ))}
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.buttonContainer, { bottom: buttonPosition }]}>
        <Animated.View
          style={{
            opacity: saveButtonOpacity,
            transform: [{ scale: saveButtonScale }, { translateX: saveButtonTranslateX }],
          }}
        >
          <TouchableOpacity
            onPress={handleSave}
            activeOpacity={0.7}
            style={styles.primaryButton}
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
            style={styles.addButton}
          >
            <Ionicons name="add" size={22} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* Close button - top right */}
      <View style={[styles.closeButton, { top: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            navigation.goBack();
          }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  stepScroll: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 20,
    paddingBottom: 320,
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
    color: Colors.hopeWhite,
  },
  titleRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 30,
    marginBottom: 0,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
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
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityNumber: {
    fontSize: 14,
    color: Colors.alertCoral,
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
    color: Colors.hopeWhite,
  },
  metadataContainer: {
    flexDirection: 'row',
    marginTop: 32,
    paddingLeft: 8,
  },
  verticalLine: {
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 16,
  },
  metadataContent: {
    flex: 1,
  },
  metadataIcon: {
    marginBottom: 8,
  },
  fromText: {
    fontSize: 11,
    color: Colors.alertCoral,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  metadataText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 20,
  },
  primaryButton: {
    height: 42,
    backgroundColor: Colors.alertCoral,
    borderRadius: 21,
    shadowColor: Colors.alertCoral,
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
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 999,
    zIndex: 100,
  },
});

export default TodosWalkthroughScreen;

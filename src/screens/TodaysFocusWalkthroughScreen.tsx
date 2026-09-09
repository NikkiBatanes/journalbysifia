import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  TextInput,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  Keyboard,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { Colors } from '../theme/colors';
import ThemedText from '../components/common/ThemedText';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../utils/date';
import { useCreateJournalEntry, useUpdateJournalEntry } from '../services/hooks/useJournalData';
import { analytics } from '../utils/analytics';
import { isToday, isYesterday, isAfter, startOfDay } from 'date-fns';

import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TodaysFocusWalkthrough'>;

const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;

type DateContext = 'today' | 'yesterday' | 'earlier' | 'upcoming';

// Helper to compute date context from selected date
const getDateContext = (selectedDate: Date): DateContext => {
  const today = startOfDay(new Date());
  const day = startOfDay(selectedDate);

  if (isToday(day)) {return 'today';}
  if (isYesterday(day)) {return 'yesterday';}
  if (isAfter(day, today)) {return 'upcoming';}
  return 'earlier';
};

// Focus Category Data
interface FocusCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconType: 'ionicons' | 'material' | 'fontawesome';
}

const FOCUS_CATEGORIES: FocusCategory[] = [
  // First 12 - Core spiritual & life priorities for Christians
  { id: 'prayer', name: 'Prayer', description: 'Returning to God with honesty and stillness.', icon: 'hands-pray', iconType: 'material' },
  { id: 'bible-reading', name: 'Bible Reading', description: 'Making space to read, listen, and stay rooted in Scripture.', icon: 'script-text', iconType: 'material' },
  { id: 'church', name: 'Church', description: 'Serving, worship, fellowship, and church activities.', icon: 'church', iconType: 'material' },
  { id: 'sabbath', name: 'Sabbath', description: 'A holy day of rest, worship, and spiritual renewal.', icon: 'weather-night', iconType: 'material' },
  { id: 'discipleship', name: 'Discipleship', description: 'Showing up faithfully for the people God has entrusted to you.', icon: 'people-circle-outline', iconType: 'ionicons' },
  { id: 'family', name: 'Family', description: 'Quality time with your loved ones and family responsibilities.', icon: 'home-heart', iconType: 'material' },
  { id: 'finances', name: 'Finances', description: 'Managing money wisely as stewardship of God\'s provision.', icon: 'cash', iconType: 'material' },
  { id: 'self-care', name: 'Self Care', description: 'Mental health, personal care, and taking care of yourself.', icon: 'spa', iconType: 'material' },
  { id: 'work', name: 'Work', description: 'Tasks, decisions, output, and follow-through.', icon: 'briefcase', iconType: 'ionicons' },
  { id: 'school', name: 'School', description: 'For studying, assignments, exams, and academic responsibilities.', icon: 'school', iconType: 'material' },
  { id: 'workout', name: 'Workout', description: 'For movement, exercise, training, and caring for your body.', icon: 'dumbbell', iconType: 'fontawesome' },
  { id: 'rest', name: 'Rest', description: 'Slowing down, resetting, and not carrying everything.', icon: 'bed', iconType: 'material' },

  // Second 12 - Practical life categories
  { id: 'health', name: 'Health', description: 'Your body, energy, and what needs attention.', icon: 'heart-pulse', iconType: 'material' },
  { id: 'relationships', name: 'Relationships', description: 'Conversations, boundaries, and care for others.', icon: 'heart', iconType: 'material' },
  { id: 'volunteer', name: 'Volunteer', description: 'Serving others and giving your time to help those in need.', icon: 'hand-heart', iconType: 'material' },
  { id: 'prayer-fasting', name: 'Prayer & Fasting', description: 'Setting aside time to seek God with focus and surrender.', icon: 'water', iconType: 'material' },
  { id: 'nutrition', name: 'Nutrition', description: 'For eating with care, planning meals, and staying attentive to your health.', icon: 'utensils', iconType: 'fontawesome' },
  { id: 'study', name: 'Study', description: 'Personal learning, skill development, and growing your knowledge.', icon: 'book-open-page-variant', iconType: 'material' },
  { id: 'business', name: 'Business', description: 'For building, deciding, leading, and carrying what your work requires today.', icon: 'building', iconType: 'fontawesome' },
  { id: 'home', name: 'Home', description: 'The responsibilities and tensions of daily life.', icon: 'home', iconType: 'material' },
  { id: 'motherhood', name: 'Motherhood', description: 'For caring for your children, guiding your home, and handling what needs you today.', icon: 'baby', iconType: 'material' },
  { id: 'creative', name: 'Creative', description: 'Creative work, writing, art, and artistic projects.', icon: 'palette', iconType: 'material' },
  { id: 'worship', name: 'Worship', description: 'Music, praise, and creative expression of faith.', icon: 'music', iconType: 'material' },
  { id: 'ministry', name: 'Ministry', description: 'Serving, leading, preparing, or carrying what needs care.', icon: 'cross', iconType: 'fontawesome' },

  // Last 9 - Specific/niche categories
  { id: 'travel', name: 'Travel', description: 'Trips, travel planning, and being on the move.', icon: 'airplane', iconType: 'material' },
  { id: 'events', name: 'Events', description: 'For planning, preparing for, or showing up well to what is coming.', icon: 'calendar', iconType: 'material' },
  { id: 'reading', name: 'Reading', description: 'For learning, slowing down, and giving attention to what you want to take in.', icon: 'reader', iconType: 'ionicons' },
  { id: 'pet-care', name: 'Pet Care', description: 'For caring for your pet, handling practical needs, and showing steady attention.', icon: 'paw', iconType: 'material' },
  { id: 'decision', name: 'Decision', description: 'A next step that still feels unclear.', icon: 'help-circle', iconType: 'material' },
  { id: 'follow-through', name: 'Follow-through', description: 'Doing what you already know is yours to do.', icon: 'check-circle', iconType: 'material' },
  { id: 'groceries', name: 'Groceries', description: 'Planning and handling practical needs for the day or week.', icon: 'cart', iconType: 'material' },
  { id: 'errands', name: 'Errands', description: 'Ordinary responsibilities that still need peace and follow-through.', icon: 'store', iconType: 'material' },
  { id: 'other', name: 'Other', description: 'Something else that needs your attention today.', icon: 'plus-circle', iconType: 'material' },
];

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
          duration: 340,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 55,
          friction: 10,
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

// Step 1: Category Selection
const CategorySelectionStep: React.FC<{
  selectedCategory: FocusCategory | null;
  onSelect: (category: FocusCategory) => void;
  onNext: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  customFocus: string;
  setCustomFocus: (text: string) => void;
  fontKey: string;
  dateContext: DateContext;
  morningFlow?: boolean;
}> = ({ selectedCategory, onSelect, onNext, insets, navigation, customFocus, setCustomFocus, fontKey, dateContext, morningFlow }) => {
  const isMorning = !!morningFlow;
  const [showAllCategories, setShowAllCategories] = React.useState(false);
  const [isOtherSelected, setIsOtherSelected] = React.useState(false);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const buttonOpacity = React.useRef(new Animated.Value(1)).current;
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;
  const buttonScale = React.useRef(new Animated.Value(0)).current;
  const chooseAgainScale = React.useRef(new Animated.Value(0)).current;

  // Enable LayoutAnimation for Android
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const displayedCategories = showAllCategories ? FOCUS_CATEGORIES : FOCUS_CATEGORIES.slice(0, 12);

  React.useEffect(() => {
    if (selectedCategory) {
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: false,
      }).start();
    } else {
      buttonScale.setValue(0);
    }
  }, [selectedCategory, buttonScale]);

  React.useEffect(() => {
    LayoutAnimation.configureNext({
      duration: 300,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
    });
    if (selectedCategory?.id === 'other') {
      setIsOtherSelected(true);
    } else {
      setIsOtherSelected(false);
    }
  }, [selectedCategory]);

  React.useEffect(() => {
    if (isOtherSelected) {
      Animated.spring(chooseAgainScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: false,
      }).start();
    } else {
      chooseAgainScale.setValue(0);
    }
  }, [isOtherSelected, chooseAgainScale]);

  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + ((e.endCoordinates.height || 325) * 0.95),
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 20,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [insets.bottom, buttonPosition]);

  const handleChooseAgain = () => {
    triggerLightHaptic();
    LayoutAnimation.configureNext({
      duration: 300,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
    });
    onSelect(null as any);
  };

  const handleToggleShowAll = () => {
    triggerLightHaptic();
    LayoutAnimation.configureNext({
      duration: 300,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
    });
    Animated.timing(buttonOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setShowAllCategories(!showAllCategories);
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  // Dynamic labels based on date context
  const getEyebrowLabel = () => {
    switch (dateContext) {
      case 'today': return "TODAY'S FOCUS";
      case 'yesterday': return "YESTERDAY'S FOCUS";
      case 'earlier': return 'PREVIOUS FOCUS';
      case 'upcoming': return 'UPCOMING FOCUS';
    }
  };

  const getMainTitle = () => {
    if (isOtherSelected) {
      switch (dateContext) {
        case 'today': return 'What is your focus today?';
        case 'yesterday': return 'What was your focus yesterday?';
        case 'earlier': return 'What was your focus on this day?';
        case 'upcoming': return 'What will your focus be?';
      }
    } else {
      switch (dateContext) {
        case 'today': return 'Choose your focus for today';
        case 'yesterday': return 'What was your focus yesterday?';
        case 'earlier': return 'What was your focus on this day?';
        case 'upcoming': return 'What will your focus be?';
      }
    }
  };

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialIcons name="filter-center-focus" size={16} color={isMorning ? Colors.sage : Colors.alertCoral} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={[styles.focusLabel, { color: isMorning ? Colors.sageMuted : Colors.hopeWhite }]}>{getEyebrowLabel()}</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={[styles.stepTitle, { color: isMorning ? Colors.text : Colors.hopeWhite }]}>
              {getMainTitle()}
            </ThemedText>
          </View>
        </StepFadeIn>

        {isOtherSelected && (
          <StepFadeIn delay={160}>
            <View style={styles.customInputContainer}>
              <TextInput
                style={[styles.customInput, { fontFamily: getFontFamily(fontKey, 'regular'), color: isMorning ? Colors.text : Colors.hopeWhite }, isMorning && { borderBottomWidth: 1, borderBottomColor: Colors.inputBorder }]}
                placeholder="Type your focus"
                placeholderTextColor={isMorning ? Colors.textGray : 'rgba(255, 255, 255, 0.5)'}
                value={customFocus}
                onChangeText={setCustomFocus}
                multiline
                autoFocus
                keyboardAppearance="dark"
              />
            </View>
          </StepFadeIn>
        )}

        {!isOtherSelected && (
          <StepFadeIn delay={160} style={styles.categoriesGrid}>
          {displayedCategories.map((category) => {
            const isSelected = selectedCategory?.id === category.id;
            return (
              <TouchableOpacity
                key={category.id}
                style={[styles.categoryCard, isMorning && styles.categoryCardMorning, isSelected && (isMorning ? styles.categoryCardSelectedMorning : styles.categoryCardSelected)]}
                onPress={() => {
                  triggerLightHaptic();
                  onSelect(category);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.categoryIconContainer}>
                  <View style={[
                    styles.categoryIconCircle,
                    isSelected && (isMorning ? { backgroundColor: Colors.sage } : styles.categoryIconCircleSelected),
                  ]}>
                    {category.iconType === 'ionicons' && (
                      <Ionicons
                        name={category.icon as any}
                        size={18}
                        color={Colors.hopeWhite}
                      />
                    )}
                    {category.iconType === 'material' && (
                      <MaterialCommunityIcons
                        name={category.icon as any}
                        size={18}
                        color={Colors.hopeWhite}
                      />
                    )}
                    {category.iconType === 'fontawesome' && (
                      <FontAwesome6
                        name={category.icon as any}
                        size={18}
                        color={Colors.hopeWhite}
                      />
                    )}
                  </View>
                </View>
                <ThemedText
                  weight="semiBold"
                  style={[styles.categoryName, { color: isSelected ? Colors.hopeWhite : (isMorning ? Colors.text : Colors.hopeWhite) }]}
                >
                  {category.name}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </StepFadeIn>
        )}

        {FOCUS_CATEGORIES.length > 12 && (
          <StepFadeIn delay={240}>
            <Animated.View style={{ opacity: buttonOpacity }}>
              <Animated.View
                style={{
                  transform: [{ scale: isOtherSelected ? chooseAgainScale : 1 }],
                }}
              >
                <TouchableOpacity
                  style={[styles.showMoreButton, { alignSelf: isOtherSelected ? 'flex-end' : 'center', borderColor: isMorning ? Colors.sage : 'rgba(255, 255, 255, 0.3)' }]}
                  onPress={isOtherSelected ? handleChooseAgain : handleToggleShowAll}
                  activeOpacity={0.75}
                >
                  <ThemedText style={[styles.showMoreButtonText, { color: isMorning ? Colors.sage : Colors.hopeWhite }]}>
                    {isOtherSelected ? 'Choose again' : (showAllCategories ? 'Show Less' : 'Show More')}
                  </ThemedText>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </StepFadeIn>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom buttons */}
      {selectedCategory && (!isOtherSelected || customFocus.trim() !== '') && (
        <Animated.View style={[styles.primaryButton, IS_IPAD && styles.primaryButtonPad, { bottom: buttonPosition, transform: [{ scale: buttonScale }], backgroundColor: isMorning ? Colors.sage : Colors.alertCoral }]}>
          <TouchableOpacity
            onPress={() => {
              triggerMediumHaptic();
              onNext();
            }}
            activeOpacity={0.7}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Close button - top right */}
      <View style={[styles.closeButton, { top: insets.top + 8, backgroundColor: isMorning ? Colors.lightGray : 'rgba(255, 255, 255, 0.09)' }]}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            if (morningFlow) {
              navigation.getParent()?.goBack();
            } else {
              navigation.goBack();
            }
          }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={17} color={isMorning ? Colors.textGray : 'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 2: Personal Text Input
const PersonalTextInputStep: React.FC<{
  category: FocusCategory;
  personalText: string;
  onChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  icon: string;
  iconType: 'ionicons' | 'material' | 'fontawesome';
  customFocus: string;
  fontKey: string;
  dateContext: DateContext;
  morningFlow?: boolean;
}> = ({ category, personalText, onChange, onNext, onBack: _onBack, insets, navigation, icon, iconType, customFocus, fontKey, dateContext, morningFlow }) => {
  const isMorning = !!morningFlow;
  const verticalLineHeight = React.useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;

  React.useEffect(() => {
    Animated.timing(verticalLineHeight, {
      toValue: 75,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [verticalLineHeight]);

  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + ((e.endCoordinates.height || 325) * 0.95),
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 20,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [insets.bottom, buttonPosition]);

  // Dynamic labels based on date context
  const getEyebrowLabel = () => {
    switch (dateContext) {
      case 'today': return "TODAY'S FOCUS";
      case 'yesterday': return "YESTERDAY'S FOCUS";
      case 'earlier': return 'PREVIOUS FOCUS';
      case 'upcoming': return 'UPCOMING FOCUS';
    }
  };

  const getTitle = () => {
    const categoryText = category.id === 'other' ? 'this' : category.name.toLowerCase();
    switch (dateContext) {
      case 'today': return `What matters most in ${categoryText} today?`;
      case 'yesterday': return `What mattered most in ${categoryText} yesterday?`;
      case 'earlier': return `What mattered most in ${categoryText} on this day?`;
      case 'upcoming': return `What will matter most in ${categoryText}?`;
    }
  };

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialIcons name="filter-center-focus" size={16} color={isMorning ? Colors.sage : Colors.alertCoral} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={[styles.focusLabel, { color: isMorning ? Colors.sageMuted : Colors.hopeWhite }]}>{getEyebrowLabel()}</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={[styles.stepTitle, { color: isMorning ? Colors.text : Colors.hopeWhite }]}>
              {getTitle()}
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <TextInput
            style={[styles.personalInput, { fontFamily: getFontFamily(fontKey, 'regular'), color: isMorning ? Colors.text : Colors.hopeWhite, backgroundColor: 'transparent', borderWidth: 0 }]}
            value={personalText}
            onChangeText={onChange}
            placeholder={'Bring this before God first...'}
            placeholderTextColor={isMorning ? Colors.textGray : 'rgba(255, 255, 255, 0.4)'}
            multiline
            textAlignVertical="top"
            autoFocus
            keyboardAppearance="dark"
          />
        </StepFadeIn>

        <StepFadeIn delay={120}>
          <View style={styles.metadataContainer}>
            <Animated.View style={[styles.verticalLine, { height: verticalLineHeight, backgroundColor: isMorning ? Colors.text : Colors.hopeWhite }]} />
            <View style={styles.metadataContent}>
              {iconType === 'ionicons' && (
                <Ionicons name={icon as any} size={18} color={isMorning ? Colors.sage : Colors.alertCoral} style={styles.metadataIcon} />
              )}
              {iconType === 'material' && (
                <MaterialCommunityIcons name={icon as any} size={18} color={isMorning ? Colors.sage : Colors.alertCoral} style={styles.metadataIcon} />
              )}
              {iconType === 'fontawesome' && (
                <FontAwesome6 name={icon as any} size={18} color={isMorning ? Colors.sage : Colors.alertCoral} style={styles.metadataIcon} />
              )}
              <ThemedText weight="medium" style={[styles.fromText, { color: isMorning ? Colors.textGray : Colors.hopeWhite }]}>
                FOCUS
              </ThemedText>
              <ThemedText style={[styles.metadataText, { color: isMorning ? Colors.textGray : Colors.hopeWhite }]}>
                {category.id === 'other' && customFocus.trim() ? (
                  <ThemedText weight="semiBold">Other: {customFocus.trim()}</ThemedText>
                ) : (
                  <>You chose <ThemedText weight="semiBold">{category.name}</ThemedText></>
                )}
              </ThemedText>
              <ThemedText style={styles.metadataText}>
                Add one short sentence if you want to make it personal.
              </ThemedText>
            </View>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.primaryButton, { bottom: buttonPosition, backgroundColor: isMorning ? Colors.sage : Colors.alertCoral }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onNext();
          }}
          activeOpacity={0.7}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </Animated.View>

      {/* Close button - top right */}
      <View style={[styles.closeButton, { top: insets.top + 8, backgroundColor: isMorning ? Colors.lightGray : 'rgba(255, 255, 255, 0.09)' }]}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            if (morningFlow) {
              navigation.getParent()?.goBack();
            } else {
              navigation.goBack();
            }
          }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={17} color={isMorning ? Colors.textGray : 'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 3: Priorities Input
const PrioritiesInputStep: React.FC<{
  priorities: string[];
  onChange: (index: number, text: string) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  icon: string;
  iconType: 'ionicons' | 'material' | 'fontawesome';
  category: FocusCategory;
  customFocus: string;
  fontKey: string;
  dateContext: DateContext;
  morningFlow?: boolean;
}> = ({ priorities, onChange, onNext, onBack: _onBack, insets, navigation, icon, iconType, category, customFocus, fontKey, dateContext, morningFlow }) => {
  const isMorning = !!morningFlow;
  const verticalLineHeight = React.useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;

  React.useEffect(() => {
    Animated.timing(verticalLineHeight, {
      toValue: 75,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [verticalLineHeight]);

  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + ((e.endCoordinates.height || 325) * 0.95),
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 20,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [insets.bottom, buttonPosition]);

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialIcons name="filter-center-focus" size={16} color={isMorning ? Colors.sage : Colors.alertCoral} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={[styles.focusLabel, { color: isMorning ? Colors.sageMuted : Colors.hopeWhite }]}>TOP PRIORITIES</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={240} style={[styles.prioritiesContainer, { marginTop: 32 }]}>
          {priorities.map((priority: string, index: number) => (
            <View key={index} style={styles.priorityInputRow}>
              <View style={[styles.priorityNumberContainer, { backgroundColor: isMorning ? Colors.sage : 'rgba(255, 107, 107, 0.2)' }]}>
                <ThemedText weight="semiBold" style={[styles.priorityNumber, { color: isMorning ? Colors.hopeWhite : Colors.alertCoral }]}>{index + 1}</ThemedText>
              </View>
              <TextInput
                style={[styles.priorityInput, { fontFamily: getFontFamily(fontKey, 'regular'), color: isMorning ? Colors.text : Colors.hopeWhite }]}
                value={priority}
                onChangeText={(text) => onChange(index, text)}
                placeholder=""
                placeholderTextColor={Colors.textGray}
                autoFocus={index === 0}
                keyboardAppearance="dark"
              />
            </View>
          ))}
        </StepFadeIn>

        <StepFadeIn delay={320}>
          <View style={styles.metadataContainer}>
            <Animated.View style={[styles.verticalLine, { height: verticalLineHeight, backgroundColor: isMorning ? Colors.text : Colors.hopeWhite }]} />
            <View style={styles.metadataContent}>
              {iconType === 'ionicons' && (
                <Ionicons name={icon as any} size={18} color={isMorning ? Colors.sage : Colors.alertCoral} style={styles.metadataIcon} />
              )}
              {iconType === 'material' && (
                <MaterialCommunityIcons name={icon as any} size={18} color={isMorning ? Colors.sage : Colors.alertCoral} style={styles.metadataIcon} />
              )}
              {iconType === 'fontawesome' && (
                <FontAwesome6 name={icon as any} size={18} color={isMorning ? Colors.sage : Colors.alertCoral} style={styles.metadataIcon} />
              )}
              <ThemedText weight="medium" style={[styles.fromText, { color: isMorning ? Colors.textGray : Colors.hopeWhite }]}>
                FOCUS
              </ThemedText>
              <ThemedText style={[styles.metadataText, { color: isMorning ? Colors.textGray : Colors.hopeWhite }]}>
                {category.id === 'other' && customFocus.trim() ? (
                  <ThemedText weight="semiBold" style={{ color: isMorning ? Colors.textGray : Colors.hopeWhite }}>Other: {customFocus.trim()}</ThemedText>
                ) : (
                  <ThemedText weight="semiBold" style={{ color: isMorning ? Colors.textGray : Colors.hopeWhite }}>{category.name}</ThemedText>
                )}
              </ThemedText>
              <ThemedText style={[styles.metadataText, { color: isMorning ? Colors.textGray : Colors.hopeWhite }]}>
                {dateContext === 'today'
                  ? 'Add up to 3 priorities for today.'
                  : dateContext === 'yesterday'
                  ? 'Add up to 3 priorities from yesterday.'
                  : dateContext === 'upcoming'
                  ? 'Add up to 3 priorities for this day.'
                  : 'Add up to 3 priorities from this day.'}
              </ThemedText>
            </View>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.primaryButton, { bottom: buttonPosition, backgroundColor: isMorning ? Colors.sage : Colors.alertCoral }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onNext();
          }}
          activeOpacity={0.7}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </Animated.View>

      {/* Close button - top right */}
      <View style={[styles.closeButton, { top: insets.top + 8, backgroundColor: isMorning ? Colors.lightGray : 'rgba(255, 255, 255, 0.09)' }]}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            if (morningFlow) {
              navigation.getParent()?.goBack();
            } else {
              navigation.goBack();
            }
          }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={17} color={isMorning ? Colors.textGray : 'rgba(255,255,255,0.65)'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 4: Completion Screen
const CompletionStep: React.FC<{
  category: FocusCategory;
  personalText: string;
  priorities: string[];
  onDone: () => void;
  insets: { top: number; bottom: number };
  icon: string;
  iconType: 'ionicons' | 'material' | 'fontawesome';
  customFocus: string;
  dateContext: DateContext;
  morningFlow?: boolean;
}> = ({ category, personalText, priorities, onDone, insets, icon, iconType, customFocus, dateContext, morningFlow }) => {
  const isMorning = !!morningFlow;
  const validPriorities = priorities.filter((p: string) => p.trim() !== '');

  // Animation refs
  const checkmarkScale = React.useRef(new Animated.Value(0)).current;
  const iconScale = React.useRef(new Animated.Value(0)).current;
  const iconRotation = React.useRef(new Animated.Value(0)).current;
  // Create stable array of Animated.Value refs (max 3 priorities)
  const priorityAnims = React.useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  React.useEffect(() => {
    // Animate checkmark
    const checkmarkAnim = Animated.spring(checkmarkScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      delay: 400,
      useNativeDriver: true,
    });

    // Animate icon container with rotation
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

    // Stagger animate priority bullets (only animate valid priorities)
    const priorityAnim = Animated.stagger(100, priorityAnims.slice(0, validPriorities.length).map(anim =>
      Animated.spring(anim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      })
    ));

    // Start all animations
    checkmarkAnim.start();
    iconAnim.start();
    priorityAnim.start();

    // Cleanup: stop all animations on unmount
    return () => {
      checkmarkAnim.stop();
      iconAnim.stop();
      priorityAnim.stop();
    };
  }, [checkmarkScale, iconScale, iconRotation, priorityAnims, validPriorities.length]);

  const iconRotateInterpolate = iconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Dynamic labels based on date context
  const getEyebrowLabel = () => {
    switch (dateContext) {
      case 'today': return "TODAY'S FOCUS";
      case 'yesterday': return "YESTERDAY'S FOCUS";
      case 'earlier': return 'PREVIOUS FOCUS';
      case 'upcoming': return 'UPCOMING FOCUS';
    }
  };

  const getSubtext = () => {
    switch (dateContext) {
      case 'today': return 'Your focus is set for today';
      case 'yesterday': return 'Your focus from yesterday';
      case 'earlier': return 'Your focus from this day';
      case 'upcoming': return 'Your focus for this day';
    }
  };

  const getSaveButtonText = () => {
    if (morningFlow) {
      return 'Continue';
    }
    switch (dateContext) {
      case 'today': return 'Save for today';
      case 'yesterday': return 'Save for yesterday';
      case 'earlier': return 'Save for this day';
      case 'upcoming': return 'Save this plan';
    }
  };

  const getFooterText = () => {
    if (morningFlow) {
      return 'A simple morning anchor before you move into the rest of your day.';
    }
    switch (dateContext) {
      case 'today': return 'A simple daily anchor before you move into the rest of your day.';
      case 'yesterday': return 'A reflection on what you focused on yesterday.';
      case 'earlier': return 'A reflection on what you focused on this day.';
      case 'upcoming': return 'A plan set ahead in faith.';
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
          <MaterialIcons name="filter-center-focus" size={18} color={isMorning ? Colors.sage : Colors.alertCoral} />
          <ThemedText weight="semiBold" style={[styles.stepLabelWhite, { color: isMorning ? Colors.sageMuted : Colors.hopeWhite }]}>
            {getEyebrowLabel()}
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={80} style={[styles.completionCard, { backgroundColor: isMorning ? Colors.cardBackground : 'transparent' }]}>
          <View style={styles.completionHeader}>
            <Animated.View style={[
              styles.completionIconContainer,
              { backgroundColor: isMorning ? Colors.sage : 'rgba(255, 107, 107, 0.15)' },
              {
                transform: [
                  { scale: iconScale },
                  { rotate: iconRotateInterpolate },
                ],
              },
            ]}>
              {iconType === 'ionicons' && (
                <Ionicons name={icon as any} size={24} color={isMorning ? Colors.hopeWhite : Colors.alertCoral} />
              )}
              {iconType === 'material' && (
                <MaterialCommunityIcons name={icon as any} size={24} color={isMorning ? Colors.hopeWhite : Colors.alertCoral} />
              )}
              {iconType === 'fontawesome' && (
                <FontAwesome6 name={icon as any} size={24} color={isMorning ? Colors.hopeWhite : Colors.alertCoral} />
              )}
            </Animated.View>
            <View style={styles.completionHeaderContent}>
              <ThemedText weight="semiBold" style={[styles.completionCategory, { color: isMorning ? Colors.text : Colors.hopeWhite }]}>
                {category.id === 'other' && customFocus.trim() ? customFocus.trim() : category.name}
              </ThemedText>
              <ThemedText style={[styles.completionSubtext, { color: isMorning ? Colors.textGray : 'rgba(255, 255, 255, 0.6)' }]}>{getSubtext()}</ThemedText>
            </View>
            <Animated.View style={[
              styles.completionCheckmark,
              { transform: [{ scale: checkmarkScale }] },
            ]}>
              <Ionicons name="checkmark-circle" size={28} color={isMorning ? Colors.sage : Colors.hopeWhite} />
            </Animated.View>
          </View>

          {personalText.trim() && (
            <View style={[styles.completionSection, { borderTopColor: isMorning ? Colors.inputBorder : 'rgba(255, 255, 255, 0.1)' }]}>
              <ThemedText weight="medium" style={[styles.completionSectionLabel, { color: isMorning ? Colors.textGray : 'rgba(255, 255, 255, 0.5)' }]}>Focus Note</ThemedText>
              <ThemedText style={[styles.completionSectionText, { color: isMorning ? Colors.text : Colors.hopeWhite }]}>{personalText}</ThemedText>
            </View>
          )}

          {validPriorities.length > 0 && (
            <View style={[styles.completionSection, { borderTopColor: isMorning ? Colors.inputBorder : 'rgba(255, 255, 255, 0.1)' }]}>
              <ThemedText weight="medium" style={[styles.completionSectionLabel, { color: isMorning ? Colors.textGray : 'rgba(255, 255, 255, 0.5)' }]}>Top Priorities</ThemedText>
              <View style={styles.prioritiesList}>
                {validPriorities.map((priority: string, index: number) => (
                  <View key={index} style={styles.priorityItem}>
                    <Animated.View style={[
                      styles.priorityBullet,
                      { backgroundColor: isMorning ? Colors.sage : 'rgba(255, 107, 107, 0.2)' },
                      { transform: [{ scale: priorityAnims[index] || 0 }] },
                    ]}>
                      <ThemedText weight="semiBold" style={[styles.priorityBulletText, { color: isMorning ? Colors.hopeWhite : Colors.alertCoral }]}>{index + 1}</ThemedText>
                    </Animated.View>
                    <ThemedText style={[styles.priorityText, { color: isMorning ? Colors.text : Colors.hopeWhite }]}>{priority}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={[styles.completionFooter, { borderTopColor: isMorning ? Colors.inputBorder : 'rgba(255, 255, 255, 0.1)' }]}>
            <ThemedText style={[styles.completionFooterText, { color: isMorning ? Colors.textGray : 'rgba(255, 255, 255, 0.6)' }]}>
              {getFooterText()}
            </ThemedText>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.completionButtonContainer, IS_IPAD && styles.completionButtonContainerPad, { bottom: insets.bottom + 20, backgroundColor: isMorning ? Colors.lightBackground : Colors.sage }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onDone();
          }}
          activeOpacity={0.85}
          style={[styles.completionButton, { backgroundColor: isMorning ? Colors.sage : Colors.alertCoral }]}
        >
          <ThemedText weight="semiBold" style={[styles.completionButtonText, { color: isMorning ? Colors.hopeWhite : Colors.hopeWhite }]}>
            {getSaveButtonText()}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main Screen Component
const TodaysFocusWalkthroughScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectedDate: selectedDateStr, existingEntry } = route.params || {};
  const selectedDate = selectedDateStr ? new Date(selectedDateStr) : new Date();

  // Theme-driven fonts
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  // Parse existing entry content to initialize state
  const getInitialState = () => {
    if (existingEntry?.content) {
      try {
        const parsedContent = typeof existingEntry.content === 'string'
          ? JSON.parse(existingEntry.content)
          : existingEntry.content;

        // Handle backward compatibility for old entries without focusCategory
        const categoryId = parsedContent.focusCategory || null;
        // Find the full category object from the category list
        const categoryObj = categoryId ? FOCUS_CATEGORIES.find(cat => cat.id === categoryId) : null;

        const savedPriorities = parsedContent.priorities?.map((p: any) => p.text) || [];
        // Ensure we always have exactly 3 priority slots
        const paddedPriorities = [...savedPriorities];
        while (paddedPriorities.length < 3) {
          paddedPriorities.push('');
        }

        return {
          category: categoryObj || null,
          customFocus: parsedContent.customFocus || '',
          personalText: parsedContent.personalText || '',
          priorities: paddedPriorities,
        };
      } catch (error) {
        console.error('Error parsing existing entry content:', error);
      }
    }
    return {
      category: null,
      customFocus: '',
      personalText: '',
      priorities: ['', '', ''],
    };
  };

  const initialState = getInitialState();

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<FocusCategory | null>(initialState.category);
  const [customFocus, setCustomFocus] = useState(initialState.customFocus);
  const [personalText, setPersonalText] = useState(initialState.personalText);
  const [priorities, setPriorities] = useState(initialState.priorities);

  // Morning flow passes data through instead of saving at the end of this screen.
  const { morningFlow, feeling, underneath } = (route.params as any) || {};
  const isMorning = !!morningFlow;

  const createMutation = useCreateJournalEntry();
  const updateMutation = useUpdateJournalEntry();

  const dateStr = toLocalDateString(selectedDate);
  const dateContext = getDateContext(selectedDate);

  // Hide status bar for full-screen walkthrough effect, matching bar style to the theme
  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, 'slide');
      StatusBar.setBarStyle(isMorning ? 'dark-content' : 'light-content');
      return () => {
        StatusBar.setHidden(false, 'slide');
        StatusBar.setBarStyle(isMorning ? 'dark-content' : 'light-content');
      };
    }, [isMorning])
  );

  const handleDone = useCallback(async () => {
    const focusToSave = selectedCategory ? (selectedCategory.id === 'other' ? customFocus.trim() : selectedCategory.name) : '';
    const focusCategoryToSave = selectedCategory?.id || '';
    const customFocusToSave = selectedCategory?.id === 'other' ? customFocus.trim() : '';
    const personalTextToSave = personalText.trim() !== '' ? personalText.trim() : '';

    const prioritiesToSave = priorities.filter((p: string) => p.trim()).length > 0
      ? priorities.map((text: string, index: number) => ({
          id: `priority_${index + 1}`,
          text: text.trim(),
          completed: false,
        }))
      : [];

    const contentToSave = JSON.stringify({
      focus: focusToSave,
      focusCategory: focusCategoryToSave,
      customFocus: customFocusToSave,
      personalText: personalTextToSave,
      priorities: prioritiesToSave,
    });

    if (!user) {
      Alert.alert('Error', 'You must be logged in to save today\'s focus.');
      return;
    }

    try {
      if (existingEntry?.id) {
        await updateMutation.mutateAsync({
          id: existingEntry.id,
          updates: { content: contentToSave },
        });

        queryClient.setQueryData(['journal', 'todaysFocus', user.id, dateStr], (oldData: any) => {
          if (oldData && Array.isArray(oldData) && oldData.length > 0) {
            return [{
              ...oldData[0],
              content: contentToSave,
            }];
          }
          return oldData;
        });
      } else {
        await createMutation.mutateAsync({
          user_id: user.id,
          selected_date: dateStr,
          content_type: 'todays_focus',
          content: contentToSave,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['journal', 'todaysFocus', user.id, dateStr] });
      await queryClient.invalidateQueries({ queryKey: ['journal', 'all'] });

      analytics.trackFocusEvent('focus_updated', {
        focus_length: selectedCategory?.name.length || 0,
        has_priorities: priorities.filter((p: string) => p.trim()).length > 0,
        priorities_count: priorities.filter((p: string) => p.trim()).length,
        date: dateStr,
      }, user.id);

      if (morningFlow) {
        (navigation as any).navigate('Todos', {
          morningFlow: true,
          selectedDate: selectedDate.toISOString(),
          feeling,
          underneath,
          focus: focusToSave,
          focusCategory: focusCategoryToSave,
          customFocus: customFocusToSave,
          personalText: personalTextToSave,
          priorities: prioritiesToSave,
        });
        return;
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save today\'s focus. Please try again.');
    }
  }, [
    selectedCategory,
    customFocus,
    personalText,
    priorities,
    user,
    existingEntry,
    dateStr,
    updateMutation,
    createMutation,
    queryClient,
    analytics,
    morningFlow,
    feeling,
    underneath,
    selectedDate,
    navigation,
  ]);

  const handleNext = useCallback(() => {
    if (isMorning && currentStep === 2) {
      // Skip the standalone closing step and save + continue inside the morning flow.
      handleDone();
      return;
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, isMorning, handleDone]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  }, [currentStep, navigation]);

  // Swipe gesture handlers
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
          const isForwardSwipe = gestureState.dx < -14;
          const isLocalBackSwipe = currentStep > 0 && gestureState.dx > 14;
          return isHorizontal && (isForwardSwipe || isLocalBackSwipe);
        },
        onPanResponderRelease: (_, gestureState) => {
          const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
          const hasEnoughDistance = Math.abs(gestureState.dx) > screenWidth * 0.15;
          const hasEnoughVelocity = Math.abs(gestureState.vx) > 0.45;

          if (!isHorizontalSwipe || (!hasEnoughDistance && !hasEnoughVelocity)) {
            return;
          }

          if (gestureState.dx > 0) {
            handleBack();
            triggerMediumHaptic();
          } else if (gestureState.dx < 0) {
            if (currentStep === 0 && !selectedCategory) {
              return;
            }
            if (currentStep < 3) {
              handleNext();
              triggerMediumHaptic();
            }
          }
        },
      }),
    [currentStep, handleBack, handleNext, screenWidth, selectedCategory]
  );

  return (
    <View style={[styles.container, isMorning && { backgroundColor: Colors.lightBackground }]} {...panResponder.panHandlers}>
      {currentStep === 0 && (
        <CategorySelectionStep
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
          onNext={handleNext}
          insets={insets}
          navigation={navigation}
          customFocus={customFocus}
          setCustomFocus={setCustomFocus}
          fontKey={fontKey}
          dateContext={dateContext}
          morningFlow={isMorning}
        />
      )}

      {currentStep === 1 && selectedCategory && (
        <PersonalTextInputStep
          category={selectedCategory}
          personalText={personalText}
          onChange={setPersonalText}
          onNext={handleNext}
          onBack={handleBack}
          insets={insets}
          navigation={navigation}
          icon={selectedCategory.icon}
          iconType={selectedCategory.iconType}
          customFocus={customFocus}
          fontKey={fontKey}
          dateContext={dateContext}
          morningFlow={isMorning}
        />
      )}

      {currentStep === 2 && selectedCategory && (
        <PrioritiesInputStep
          priorities={priorities}
          onChange={(index, text) => {
            const newPriorities = [...priorities];
            newPriorities[index] = text;
            setPriorities(newPriorities);
          }}
          onNext={handleNext}
          onBack={handleBack}
          insets={insets}
          navigation={navigation}
          icon={selectedCategory.icon}
          iconType={selectedCategory.iconType}
          category={selectedCategory}
          customFocus={customFocus}
          fontKey={fontKey}
          dateContext={dateContext}
          morningFlow={isMorning}
        />
      )}

      {currentStep === 3 && selectedCategory && (
        <CompletionStep
          category={selectedCategory}
          personalText={personalText}
          priorities={priorities}
          onDone={handleDone}
          insets={insets}
          icon={selectedCategory.icon}
          iconType={selectedCategory.iconType}
          customFocus={customFocus}
          dateContext={dateContext}
          morningFlow={morningFlow}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.sage,
  },
  stepContainer: {
    flex: 1,
  },
  stepScroll: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 24,
  },
  stepContentPad: {
    paddingHorizontal: 160,
  },
  stepTitle: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 30,
    marginBottom: 32,
    textAlign: 'center',
  },
  stepTitleLeft: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 30,
    marginBottom: 16,
    textAlign: 'left',
  },
  stepSubtitle: {
    fontSize: 20,
    color: Colors.hopeWhite,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  titleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  iconBelowTitle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  titleIcon: {
    marginTop: 2,
  },
  focusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 32,
  },
  focusLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.hopeWhite,
  },
  labelIcon: {
    marginTop: 1,
  },
  stepDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 24,
    marginBottom: 24,
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  descriptionIcon: {
    marginTop: 2,
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
  metadataContent: {
    flex: 1,
  },
  metadataIcon: {
    marginBottom: 4,
    opacity: 0.8,
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
    lineHeight: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  showMoreButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  showMoreButtonText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  customInputContainer: {
    marginTop: 16,
    paddingHorizontal: 24,
  },
  customInputTitle: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 8,
    fontWeight: '500',
  },
  customInput: {
    backgroundColor: 'transparent',
    fontSize: 18,
    color: Colors.hopeWhite,
    minHeight: 80,
    textAlignVertical: 'top',
    paddingHorizontal: 0,
    paddingVertical: 16,
  },
  categoryCard: {
    width: '31%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 12,
    marginBottom: 0,
    minHeight: 100,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardMorning: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
  },
  categoryCardSelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.18)',
    borderColor: Colors.alertCoral,
  },
  categoryCardSelectedMorning: {
    backgroundColor: Colors.sageMuted,
    borderColor: Colors.sage,
  },
  categoryIconContainer: {
    marginBottom: 8,
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconCircleSelected: {
    backgroundColor: Colors.alertCoral,
  },
  categoryName: {
    fontSize: 12,
    color: Colors.hopeWhite,
    marginBottom: 4,
    textAlign: 'center',
  },
  categoryNameSelected: {
    color: Colors.hopeWhite,
  },
  categoryDescription: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 14,
  },
  categoryDescriptionSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  personalInput: {
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontSize: 18,
    color: Colors.hopeWhite,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  prioritiesContainer: {
    gap: 16,
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
    minHeight: 50,
    textAlignVertical: 'top',
  },
  completionTitle: {
    fontSize: 32,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  completionSubtitle: {
    fontSize: 24,
    color: Colors.hopeWhite,
    marginBottom: 12,
  },
  completionDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 24,
    marginBottom: 32,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 24,
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 18,
    color: Colors.hopeWhite,
    marginBottom: 16,
    lineHeight: 24,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 16,
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
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  completionCard: {
    borderRadius: 50,
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
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  completionHeaderContent: {
    flex: 1,
  },
  completionCategory: {
    fontSize: 20,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  completionSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  completionCheckmark: {
    marginLeft: 12,
  },
  completionSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  completionSectionLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  completionSectionText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  prioritiesList: {
    gap: 12,
  },
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  priorityBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  priorityBulletText: {
    fontSize: 12,
    color: Colors.alertCoral,
  },
  priorityText: {
    flex: 1,
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  completionFooter: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  completionFooterText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
  },
  completionButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
    backgroundColor: Colors.sage,
    zIndex: 100,
  },
  completionButtonContainerPad: {
    paddingHorizontal: 160,
  },
  completionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    width: '100%',
  },
  completionButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  bottomButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: Colors.sage,
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
  primaryButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 20,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  primaryButtonPad: {
    right: 48,
  },
  primaryButtonDisabled: {
    backgroundColor: Colors.alertCoral,
  },
  primaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
});

export default withErrorBoundary(TodaysFocusWalkthroughScreen, 'TodaysFocusWalkthroughScreen');

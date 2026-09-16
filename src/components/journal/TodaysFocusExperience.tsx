import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
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
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import StepFadeIn from '../common/StepFadeIn';
import { triggerLightHaptic, triggerMediumHaptic } from '../../utils/haptics';
import { toLocalDateString } from '../../utils/date';
import { getLocalJournalSingleton, saveLocalJournalSingleton, LocalJournalEntry } from '../../storage/journalStorage';
import { isToday, isYesterday, isAfter, startOfDay } from 'date-fns';

type DateContext = 'today' | 'yesterday' | 'earlier' | 'upcoming';

interface FocusCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconType: 'ionicons' | 'material' | 'fontawesome';
}

export const FOCUS_CATEGORIES: FocusCategory[] = [
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

const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;

const getDateContext = (selectedDate: Date): DateContext => {
  const today = startOfDay(new Date());
  const day = startOfDay(selectedDate);

  if (isToday(day)) {return 'today';}
  if (isYesterday(day)) {return 'yesterday';}
  if (isAfter(day, today)) {return 'upcoming';}
  return 'earlier';
};

interface TodaysFocusExperienceProps {
  selectedDate: Date;
  insets?: { top: number; bottom: number };
  onClose?: () => void;
  onComplete: (record: LocalJournalEntry) => void | Promise<void>;
  completionButtonText?: string;
  footerText?: string;
}

const CategorySelectionStep: React.FC<{
  selectedCategory: FocusCategory | null;
  onSelect: (category: FocusCategory) => void;
  onNext: () => void;
  insets: { top: number; bottom: number };
  customFocus: string;
  setCustomFocus: (text: string) => void;
  fontKey: string;
  dateContext: DateContext;
}> = ({ selectedCategory, onSelect, onNext, insets, customFocus, setCustomFocus, fontKey, dateContext }) => {
  const [showAllCategories, setShowAllCategories] = React.useState(false);
  const [isOtherSelected, setIsOtherSelected] = React.useState(false);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const buttonOpacity = React.useRef(new Animated.Value(1)).current;
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;
  const buttonScale = React.useRef(new Animated.Value(0)).current;
  const chooseAgainScale = React.useRef(new Animated.Value(0)).current;

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
            <MaterialIcons name="filter-center-focus" size={16} color={Colors.sage} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={[styles.focusLabel, { color: Colors.sageMuted }]}>{getEyebrowLabel()}</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={styles.stepTitle}>
              {getMainTitle()}
            </ThemedText>
          </View>
        </StepFadeIn>

        {isOtherSelected && (
          <StepFadeIn delay={160}>
            <View style={styles.customInputContainer}>
              <TextInput
                style={[styles.customInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
                placeholder="Type your focus"
                placeholderTextColor={Colors.textGray}
                value={customFocus}
                onChangeText={setCustomFocus}
                multiline
                autoFocus
                keyboardAppearance="light"
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
                style={[styles.categoryCard, isSelected && styles.categoryCardSelectedMorning]}
                onPress={() => {
                  triggerLightHaptic();
                  onSelect(category);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.categoryIconContainer}>
                  <View style={[
                    styles.categoryIconCircle,
                    isSelected && styles.categoryIconCircleSelected,
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
                  style={[styles.categoryName, { color: isSelected ? Colors.hopeWhite : Colors.text }]}
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
                  style={[styles.showMoreButton, { alignSelf: 'center' }]}
                  onPress={isOtherSelected ? handleChooseAgain : handleToggleShowAll}
                  activeOpacity={0.75}
                >
                  <ThemedText style={[styles.showMoreButtonText, { color: Colors.sage }]}>
                    {isOtherSelected ? 'Choose again' : (showAllCategories ? 'Show Less' : 'Show More')}
                  </ThemedText>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </StepFadeIn>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {selectedCategory && (!isOtherSelected || customFocus.trim() !== '') && (
        <Animated.View style={[styles.primaryButton, IS_IPAD && styles.primaryButtonPad, { bottom: buttonPosition, transform: [{ scale: buttonScale }], backgroundColor: Colors.sage }]}>
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
    </View>
  );
};

const PersonalTextInputStep: React.FC<{
  category: FocusCategory;
  personalText: string;
  onChange: (text: string) => void;
  onNext: () => void;
  insets: { top: number; bottom: number };
  icon: string;
  iconType: 'ionicons' | 'material' | 'fontawesome';
  customFocus: string;
  fontKey: string;
  dateContext: DateContext;
}> = ({ category, personalText, onChange, onNext, insets, icon, iconType, customFocus, fontKey, dateContext }) => {
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
            <MaterialIcons name="filter-center-focus" size={16} color={Colors.sage} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={[styles.focusLabel, { color: Colors.sageMuted }]}>{getEyebrowLabel()}</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={styles.stepTitle}>
              {getTitle()}
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <TextInput
            style={[styles.personalInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
            value={personalText}
            onChangeText={onChange}
            placeholder={'Bring this before God first...'}
            placeholderTextColor={Colors.textGray}
            multiline
            textAlignVertical="top"
            autoFocus
            keyboardAppearance="light"
          />
        </StepFadeIn>

        <StepFadeIn delay={120}>
          <View style={styles.metadataContainer}>
            <Animated.View style={[styles.verticalLine, { height: verticalLineHeight, backgroundColor: Colors.text }]} />
            <View style={styles.metadataContent}>
              {iconType === 'ionicons' && (
                <Ionicons name={icon as any} size={18} color={Colors.sage} style={styles.metadataIcon} />
              )}
              {iconType === 'material' && (
                <MaterialCommunityIcons name={icon as any} size={18} color={Colors.sage} style={styles.metadataIcon} />
              )}
              {iconType === 'fontawesome' && (
                <FontAwesome6 name={icon as any} size={18} color={Colors.sage} style={styles.metadataIcon} />
              )}
              <ThemedText weight="medium" style={[styles.fromText, { color: Colors.textGray }]}>
                FOCUS
              </ThemedText>
              <ThemedText style={[styles.metadataText, { color: Colors.textGray }]}>
                {category.id === 'other' && customFocus.trim() ? (
                  <ThemedText weight="semiBold">Other: {customFocus.trim()}</ThemedText>
                ) : (
                  <>You chose <ThemedText weight="semiBold">{category.name}</ThemedText></>
                )}
              </ThemedText>
              <ThemedText style={[styles.metadataText, { color: Colors.textGray }]}>
                Add one short sentence if you want to make it personal.
              </ThemedText>
            </View>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.primaryButton, { bottom: buttonPosition, backgroundColor: Colors.sage }]}>
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
    </View>
  );
};

const PrioritiesInputStep: React.FC<{
  priorities: string[];
  onChange: (index: number, text: string) => void;
  onNext: () => void;
  insets: { top: number; bottom: number };
  icon: string;
  iconType: 'ionicons' | 'material' | 'fontawesome';
  category: FocusCategory;
  customFocus: string;
  fontKey: string;
  dateContext: DateContext;
}> = ({ priorities, onChange, onNext, insets, icon, iconType, category, customFocus, fontKey, dateContext }) => {
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
            <MaterialIcons name="filter-center-focus" size={16} color={Colors.sage} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={[styles.focusLabel, { color: Colors.sageMuted }]}>TOP PRIORITIES</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={240} style={[styles.prioritiesContainer, { marginTop: 32 }]}>
          {priorities.map((priority: string, index: number) => (
            <View key={index} style={styles.priorityInputRow}>
              <View style={[styles.priorityNumberContainer, { backgroundColor: Colors.sage }]}>
                <ThemedText weight="semiBold" style={[styles.priorityNumber, { color: Colors.hopeWhite }]}>{index + 1}</ThemedText>
              </View>
              <TextInput
                style={[styles.priorityInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
                value={priority}
                onChangeText={(text) => onChange(index, text)}
                placeholder=""
                placeholderTextColor={Colors.textGray}
                autoFocus={index === 0}
                keyboardAppearance="light"
              />
            </View>
          ))}
        </StepFadeIn>

        <StepFadeIn delay={320}>
          <View style={styles.metadataContainer}>
            <Animated.View style={[styles.verticalLine, { height: verticalLineHeight, backgroundColor: Colors.text }]} />
            <View style={styles.metadataContent}>
              {iconType === 'ionicons' && (
                <Ionicons name={icon as any} size={18} color={Colors.sage} style={styles.metadataIcon} />
              )}
              {iconType === 'material' && (
                <MaterialCommunityIcons name={icon as any} size={18} color={Colors.sage} style={styles.metadataIcon} />
              )}
              {iconType === 'fontawesome' && (
                <FontAwesome6 name={icon as any} size={18} color={Colors.sage} style={styles.metadataIcon} />
              )}
              <ThemedText weight="medium" style={[styles.fromText, { color: Colors.textGray }]}>
                FOCUS
              </ThemedText>
              <ThemedText style={[styles.metadataText, { color: Colors.textGray }]}>
                {category.id === 'other' && customFocus.trim() ? (
                  <ThemedText weight="semiBold" style={{ color: Colors.textGray }}>Other: {customFocus.trim()}</ThemedText>
                ) : (
                  <ThemedText weight="semiBold" style={{ color: Colors.textGray }}>{category.name}</ThemedText>
                )}
              </ThemedText>
              <ThemedText style={[styles.metadataText, { color: Colors.textGray }]}>
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

      <Animated.View style={[styles.primaryButton, { bottom: buttonPosition, backgroundColor: Colors.sage }]}>
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
    </View>
  );
};

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
  completionButtonText?: string;
  footerText?: string;
}> = ({ category, personalText, priorities, onDone, insets, icon, iconType, customFocus, dateContext, completionButtonText, footerText }) => {
  const validPriorities = priorities.filter((p: string) => p.trim() !== '');
  const checkmarkScale = React.useRef(new Animated.Value(0)).current;
  const iconScale = React.useRef(new Animated.Value(0)).current;
  const iconRotation = React.useRef(new Animated.Value(0)).current;
  const priorityAnims = React.useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  React.useEffect(() => {
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

    const priorityAnim = Animated.stagger(100, priorityAnims.slice(0, validPriorities.length).map(anim =>
      Animated.spring(anim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      })
    ));

    checkmarkAnim.start();
    iconAnim.start();
    priorityAnim.start();

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
    return completionButtonText ?? (() => {
      switch (dateContext) {
        case 'today': return 'Save for today';
        case 'yesterday': return 'Save for yesterday';
        case 'earlier': return 'Save for this day';
        case 'upcoming': return 'Save this plan';
      }
    })();
  };

  const getFooterText = () => {
    return footerText ?? (() => {
      switch (dateContext) {
        case 'today': return 'A simple daily anchor before you move into the rest of your day.';
        case 'yesterday': return 'A reflection on what you focused on yesterday.';
        case 'earlier': return 'A reflection on what you focused on this day.';
        case 'upcoming': return 'A plan set ahead in faith.';
      }
    })();
  };

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <MaterialIcons name="filter-center-focus" size={18} color={Colors.sage} />
          <ThemedText weight="semiBold" style={[styles.stepLabelWhite, { color: Colors.sageMuted }]}>
            {getEyebrowLabel()}
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={80} style={[styles.completionCard, { backgroundColor: Colors.cardBackground }]}>
          <View style={styles.completionHeader}>
            <Animated.View style={[
              styles.completionIconContainer,
              { backgroundColor: Colors.sage },
              {
                transform: [
                  { scale: iconScale },
                  { rotate: iconRotateInterpolate },
                ],
              },
            ]}>
              {iconType === 'ionicons' && (
                <Ionicons name={icon as any} size={24} color={Colors.hopeWhite} />
              )}
              {iconType === 'material' && (
                <MaterialCommunityIcons name={icon as any} size={24} color={Colors.hopeWhite} />
              )}
              {iconType === 'fontawesome' && (
                <FontAwesome6 name={icon as any} size={24} color={Colors.hopeWhite} />
              )}
            </Animated.View>
            <View style={styles.completionHeaderContent}>
              <ThemedText weight="semiBold" style={styles.completionCategory}>
                {category.id === 'other' && customFocus.trim() ? customFocus.trim() : category.name}
              </ThemedText>
              <ThemedText style={styles.completionSubtext}>{getSubtext()}</ThemedText>
            </View>
            <Animated.View style={[
              styles.completionCheckmark,
              { transform: [{ scale: checkmarkScale }] },
            ]}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.sage} />
            </Animated.View>
          </View>

          {personalText.trim() && (
            <View style={[styles.completionSection, { borderTopColor: Colors.inputBorder }]}>
              <ThemedText weight="medium" style={styles.completionSectionLabel}>Focus Note</ThemedText>
              <ThemedText style={styles.completionSectionText}>{personalText}</ThemedText>
            </View>
          )}

          {validPriorities.length > 0 && (
            <View style={[styles.completionSection, { borderTopColor: Colors.inputBorder }]}>
              <ThemedText weight="medium" style={styles.completionSectionLabel}>Top Priorities</ThemedText>
              <View style={styles.prioritiesList}>
                {validPriorities.map((priority: string, index: number) => (
                  <View key={index} style={styles.priorityItem}>
                    <Animated.View style={[
                      styles.priorityBullet,
                      { backgroundColor: Colors.sage },
                      { transform: [{ scale: priorityAnims[index] || 0 }] },
                    ]}>
                      <ThemedText weight="semiBold" style={styles.priorityBulletText}>{index + 1}</ThemedText>
                    </Animated.View>
                    <ThemedText style={styles.priorityText}>{priority}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}

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
          <ThemedText weight="semiBold" style={styles.completionButtonText}>
            {getSaveButtonText()}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const TodaysFocusExperience: React.FC<TodaysFocusExperienceProps> = ({
  selectedDate,
  insets: insetsProp,
  onClose,
  onComplete,
  completionButtonText,
  footerText,
}) => {
  const insets = useSafeAreaInsets();
  const safeInsets = insetsProp ?? { top: insets.top, bottom: insets.bottom };
  const { width: screenWidth } = useWindowDimensions();
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<FocusCategory | null>(null);
  const [customFocus, setCustomFocus] = useState('');
  const [personalText, setPersonalText] = useState('');
  const [priorities, setPriorities] = useState(['', '', '']);

  const dateStr = toLocalDateString(selectedDate);
  const dateContext = getDateContext(selectedDate);

  const hasLoadedLocalRef = useRef(false);

  useEffect(() => {
    if (hasLoadedLocalRef.current) {return;}
    hasLoadedLocalRef.current = true;
    (async () => {
      try {
        const local = await getLocalJournalSingleton('todays_focus', dateStr);
        if (local && local.content) {
          const parsed = typeof local.content === 'string'
            ? JSON.parse(local.content)
            : local.content;
          const categoryId = parsed.focusCategory || null;
          const categoryObj = categoryId ? FOCUS_CATEGORIES.find(cat => cat.id === categoryId) : null;
          const savedPriorities = (parsed.priorities || []).map((p: any) => p.text || '');
          while (savedPriorities.length < 3) {
            savedPriorities.push('');
          }
          setSelectedCategory(categoryObj || null);
          setCustomFocus(parsed.customFocus || '');
          setPersonalText(parsed.personalText || '');
          setPriorities(savedPriorities);
        }
      } catch (error) {
        console.warn('Error loading local today\'s focus:', error);
      }
    })();
  }, [dateStr]);

  const handleDone = useCallback(async () => {
    if (!selectedCategory) {
      Alert.alert('Choose a focus', 'Select a focus category to continue.');
      return;
    }

    const focusToSave = selectedCategory.id === 'other' ? customFocus.trim() : selectedCategory.name;
    const focusCategoryToSave = selectedCategory.id;
    const focusIconToSave = selectedCategory.icon;
    const focusIconTypeToSave = selectedCategory.iconType;
    const customFocusToSave = selectedCategory.id === 'other' ? customFocus.trim() : '';
    const personalTextToSave = personalText.trim();

    const prioritiesToSave = priorities
      .map((text: string, index: number) => ({
        id: `priority_${index + 1}`,
        text: text.trim(),
        completed: false,
      }))
      .filter((p: any) => p.text);

    const contentToSave = JSON.stringify({
      focus: focusToSave,
      focusCategory: focusCategoryToSave,
      focusIcon: focusIconToSave,
      focusIconType: focusIconTypeToSave,
      customFocus: customFocusToSave,
      personalText: personalTextToSave,
      priorities: prioritiesToSave,
    });

    try {
      const record = await saveLocalJournalSingleton('todays_focus', dateStr, contentToSave);
      await onComplete(record);
    } catch (error) {
      console.error('Error saving local today\'s focus:', error);
      Alert.alert('Error', 'Failed to save today\'s focus. Please try again.');
    }
  }, [selectedCategory, customFocus, personalText, priorities, dateStr, onComplete]);

  const handleNext = useCallback(() => {
    if (!selectedCategory) {return;}
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    } else if (completionButtonText) {
      handleDone();
    } else {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, selectedCategory, completionButtonText, handleDone]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else if (onClose) {
      onClose();
    }
  }, [currentStep, onClose]);

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
            if (currentStep <= 2) {
              handleNext();
              triggerMediumHaptic();
            }
          }
        },
      }),
    [currentStep, handleBack, handleNext, screenWidth, selectedCategory]
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors.lightBackground }]} {...panResponder.panHandlers}>
      {onClose && (
        <View style={[styles.closeButton, { top: safeInsets.top + 8 }]}>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              onClose();
            }}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={17} color={Colors.sage} />
          </TouchableOpacity>
        </View>
      )}
      {currentStep === 0 && (
        <CategorySelectionStep
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
          onNext={handleNext}
          insets={safeInsets}
          customFocus={customFocus}
          setCustomFocus={setCustomFocus}
          fontKey={fontKey}
          dateContext={dateContext}
        />
      )}

      {currentStep === 1 && selectedCategory && (
        <PersonalTextInputStep
          category={selectedCategory}
          personalText={personalText}
          onChange={setPersonalText}
          onNext={handleNext}
          insets={safeInsets}
          icon={selectedCategory.icon}
          iconType={selectedCategory.iconType}
          customFocus={customFocus}
          fontKey={fontKey}
          dateContext={dateContext}
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
          insets={safeInsets}
          icon={selectedCategory.icon}
          iconType={selectedCategory.iconType}
          category={selectedCategory}
          customFocus={customFocus}
          fontKey={fontKey}
          dateContext={dateContext}
        />
      )}

      {currentStep === 3 && selectedCategory && (
        <CompletionStep
          category={selectedCategory}
          personalText={personalText}
          priorities={priorities}
          onDone={handleDone}
          insets={safeInsets}
          icon={selectedCategory.icon}
          iconType={selectedCategory.iconType}
          customFocus={customFocus}
          dateContext={dateContext}
          completionButtonText={completionButtonText}
          footerText={footerText}
        />
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
  stepContent: {
    paddingHorizontal: 24,
  },
  stepContentPad: {
    paddingHorizontal: 160,
  },
  stepTitle: {
    fontSize: 24,
    color: Colors.text,
    lineHeight: 30,
    marginBottom: 32,
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  categoryCard: {
    width: '31%',
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    padding: 12,
    marginBottom: 0,
    minHeight: 100,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: Colors.sage,
  },
  categoryName: {
    fontSize: 12,
    color: Colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  showMoreButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.sage,
  },
  showMoreButtonText: {
    fontSize: 14,
    color: Colors.sage,
    fontWeight: '600',
  },
  customInputContainer: {
    marginTop: 16,
    paddingHorizontal: 24,
  },
  customInput: {
    backgroundColor: 'transparent',
    fontSize: 18,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    paddingHorizontal: 0,
    paddingVertical: 16,
  },
  personalInput: {
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontSize: 18,
    color: Colors.text,
    backgroundColor: 'transparent',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  metadataContainer: {
    marginTop: 32,
    marginBottom: 24,
    flexDirection: 'row',
  },
  verticalLine: {
    width: 1,
    backgroundColor: Colors.text,
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
    color: Colors.textGray,
    opacity: 0.6,
    marginBottom: 4,
    letterSpacing: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  metadataText: {
    fontSize: 12,
    color: Colors.textGray,
    opacity: 0.6,
    marginBottom: 4,
    lineHeight: 16,
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
    color: Colors.text,
    minHeight: 50,
    textAlignVertical: 'top',
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
  completionSectionText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 23,
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
    right: 20,
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
  primaryButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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

export default TodaysFocusExperience;

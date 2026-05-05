import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  TextInput,
  Alert,
  Platform,
  UIManager,
  LayoutAnimation,
  Keyboard,
  Dimensions,
  PanResponder,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';

import { Colors } from '../theme/colors';
import { Fonts } from '../theme';
import ThemedText from '../components/common/ThemedText';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../utils/date';
import { useCreateTodayWinEntry, useUpdateTodayWinEntry, useTodayWinData } from '../services/hooks/useJournalData';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';
import { isToday, isYesterday, startOfDay } from 'date-fns';
import { visibleStreakService } from '../services/visibleStreakService';

import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TodaysWinWalkthrough'>;

type DateContext = 'today' | 'yesterday' | 'earlier';

// Helper to compute date context from selected date
const getDateContext = (selectedDate: Date): DateContext => {
  const day = startOfDay(selectedDate);

  if (isToday(day)) {return 'today';}
  if (isYesterday(day)) {return 'yesterday';}
  return 'earlier';
};

// Win Type Data
interface WinType {
  id: string;
  name: string;
  category: string;
}

const WIN_TYPES: WinType[] = [
  // Core 7 (shown by default)
  { id: 'followed-through', name: 'I followed through', category: 'Practical' },
  { id: 'chose-peace', name: 'I chose peace', category: 'Inner Life' },
  { id: 'told-truth', name: 'I told the truth', category: 'Relationships' },
  { id: 'showed-up', name: 'I showed up', category: 'Work' },
  { id: 'shared-jesus', name: 'I shared Jesus', category: 'Faith' },
  { id: 'kept-going', name: 'I kept going', category: 'Inner Life' },
  { id: 'other', name: 'Other', category: 'Other' },

  // Faith
  { id: 'chose-trust', name: 'I chose trust', category: 'Faith' },
  { id: 'stayed-faithful', name: 'I stayed faithful', category: 'Faith' },
  { id: 'obeyed-hard', name: 'I obeyed when it was hard', category: 'Faith' },
  { id: 'brought-to-god', name: 'I brought it to God', category: 'Faith' },
  { id: 'prayed-panicking', name: 'I prayed instead of panicking', category: 'Faith' },
  { id: 'shared-gospel', name: 'I shared the gospel', category: 'Faith' },
  { id: 'god-made-way', name: 'God made a way', category: 'Faith' },

  // Inner Life
  { id: 'let-go', name: 'I let go', category: 'Inner Life' },
  { id: 'asked-for-help', name: 'I asked for help', category: 'Inner Life' },
  { id: 'rested-needed', name: 'I rested when I needed to', category: 'Inner Life' },
  { id: 'stayed-steady', name: 'I stayed steady', category: 'Inner Life' },
  { id: 'made-space-breathe', name: 'I made space to breathe', category: 'Inner Life' },

  // Relationships
  { id: 'forgave', name: 'I forgave', category: 'Relationships' },
  { id: 'apologized', name: 'I apologized', category: 'Relationships' },
  { id: 'set-boundary', name: 'I set a boundary', category: 'Relationships' },
  { id: 'was-patient', name: 'I was patient', category: 'Relationships' },
  { id: 'showed-kindness', name: 'I showed kindness', category: 'Relationships' },
  { id: 'reached-out', name: 'I reached out', category: 'Relationships' },
  { id: 'encouraged-someone', name: 'I encouraged someone', category: 'Relationships' },

  // Marriage
  { id: 'honored-spouse', name: 'I honored my spouse', category: 'Marriage' },
  { id: 'spoke-gentleness', name: 'I spoke with gentleness', category: 'Marriage' },
  { id: 'listened-care', name: 'I listened with care', category: 'Marriage' },
  { id: 'apologized-marriage', name: 'I apologized', category: 'Marriage' },
  { id: 'forgave-marriage', name: 'I forgave', category: 'Marriage' },
  { id: 'chose-unity', name: 'I chose unity', category: 'Marriage' },
  { id: 'reached-out-first', name: 'I reached out first', category: 'Marriage' },
  { id: 'served-love', name: 'I served with love', category: 'Marriage' },

  // Practical
  { id: 'finished-hard', name: 'I finished something hard', category: 'Practical' },
  { id: 'got-ready', name: 'I got ready for the day', category: 'Practical' },
  { id: 'cared-home', name: 'I cared for my home', category: 'Practical' },
  { id: 'handled-needed-care', name: 'I handled what needed care', category: 'Practical' },
  { id: 'did-needed', name: 'I did what needed to be done', category: 'Practical' },
  { id: 'made-progress', name: 'I made progress today', category: 'Practical' },
  { id: 'took-care-avoiding', name: 'I took care of what I was avoiding', category: 'Practical' },

  // Home
  { id: 'handled-family-home', name: 'I handled what my family needed', category: 'Home' },
  { id: 'cleaned-needed', name: 'I cleaned what needed cleaning', category: 'Home' },
  { id: 'stayed-on-top', name: 'I stayed on top of things', category: 'Home' },
  { id: 'followed-through-home', name: 'I followed through at home', category: 'Home' },
  { id: 'kept-order', name: 'I kept things in order', category: 'Home' },
  { id: 'took-care-needed', name: 'I took care of what was needed', category: 'Home' },

  // Family
  { id: 'handled-family', name: 'I handled what my family needed', category: 'Family' },
  { id: 'showed-kindness-family', name: 'I showed kindness', category: 'Family' },
  { id: 'was-patient-family', name: 'I was patient', category: 'Family' },
  { id: 'reached-out-family', name: 'I reached out', category: 'Family' },
  { id: 'stayed-present', name: 'I stayed present', category: 'Family' },
  { id: 'served-love-family', name: 'I served with love', category: 'Family' },
  { id: 'listened-care-family', name: 'I listened with care', category: 'Family' },
  { id: 'followed-through-family', name: 'I followed through for my family', category: 'Family' },

  // Motherhood
  { id: 'cared-child', name: 'I cared for my child', category: 'Motherhood' },
  { id: 'stayed-present-motherhood', name: 'I stayed present in motherhood', category: 'Motherhood' },
  { id: 'handled-family-motherhood', name: 'I handled what my family needed', category: 'Motherhood' },
  { id: 'showed-kindness-motherhood', name: 'I showed kindness', category: 'Motherhood' },
  { id: 'was-patient-motherhood', name: 'I was patient', category: 'Motherhood' },
  { id: 'stayed-steady-child', name: 'I stayed steady for my child', category: 'Motherhood' },
  { id: 'met-need-love', name: 'I met a need with love', category: 'Motherhood' },
  { id: 'kept-showing-up', name: 'I kept showing up as a mother', category: 'Motherhood' },

  // Health
  { id: 'took-care-body', name: 'I took care of my body', category: 'Health' },
  { id: 'worked-out', name: 'I worked out', category: 'Health' },
  { id: 'ate-well', name: 'I ate well today', category: 'Health' },
  { id: 'took-care-skin', name: 'I took care of my skin', category: 'Health' },
  { id: 'drank-water', name: 'I drank water', category: 'Health' },
  { id: 'listened-body', name: 'I listened to my body', category: 'Health' },
  { id: 'made-healthy-choice', name: 'I made a healthy choice', category: 'Health' },

  // School
  { id: 'passed-exam', name: 'I passed the exam', category: 'School' },
  { id: 'finished-assignment', name: 'I finished my assignment', category: 'School' },
  { id: 'studied-needed', name: 'I studied when I needed to', category: 'School' },
  { id: 'stayed-focused-school', name: 'I stayed focused', category: 'School' },
  { id: 'prepared-well', name: 'I prepared well', category: 'School' },
  { id: 'followed-through-school', name: 'I followed through in school', category: 'School' },
  { id: 'kept-going-school', name: 'I kept going', category: 'School' },

  // Work
  { id: 'showed-up-work', name: 'I showed up for my work', category: 'Work' },
  { id: 'followed-through-work', name: 'I followed through in work', category: 'Work' },
  { id: 'finished-hard-work', name: 'I finished something hard', category: 'Work' },
  { id: 'took-next-step', name: 'I took the next step', category: 'Work' },
  { id: 'stayed-focused-work', name: 'I stayed focused', category: 'Work' },
  { id: 'handled-attention', name: 'I handled what needed my attention', category: 'Work' },
  { id: 'completed-important', name: 'I completed an important task', category: 'Work' },
  { id: 'made-progress-work', name: 'I made progress in my work', category: 'Work' },

  // Business
  { id: 'made-progress-business', name: 'I made progress in business', category: 'Business' },
  { id: 'made-hard-decision', name: 'I made a hard decision', category: 'Business' },
  { id: 'showed-up-business', name: 'I showed up for my work', category: 'Business' },
  { id: 'followed-through-business', name: 'I followed through in business', category: 'Business' },
  { id: 'handled-attention-business', name: 'I handled what needed my attention', category: 'Business' },
  { id: 'took-next-step-business', name: 'I took the next step', category: 'Business' },
  { id: 'stayed-consistent', name: 'I stayed consistent', category: 'Business' },
  { id: 'moved-forward', name: 'I moved something forward', category: 'Business' },

  // Ministry
  { id: 'showed-up-ministry', name: 'I showed up in ministry', category: 'Ministry' },
  { id: 'served-faithfulness', name: 'I served with faithfulness', category: 'Ministry' },
  { id: 'followed-through-ministry', name: 'I followed through in ministry', category: 'Ministry' },
  { id: 'encouraged-ministry', name: 'I encouraged someone', category: 'Ministry' },
  { id: 'led-care', name: 'I led with care', category: 'Ministry' },
  { id: 'helped-needed', name: 'I helped where needed', category: 'Ministry' },
  { id: 'prayed-someone', name: 'I prayed for someone', category: 'Ministry' },
  { id: 'stayed-faithful-serving', name: 'I stayed faithful in serving', category: 'Ministry' },

  // Discipleship
  { id: 'showed-up-discipleship', name: 'I showed up in discipleship', category: 'Discipleship' },
  { id: 'reached-out-faith', name: 'I reached out in faith', category: 'Discipleship' },
  { id: 'encouraged-faith', name: 'I encouraged someone in faith', category: 'Discipleship' },
  { id: 'listened-care-discipleship', name: 'I listened with care', category: 'Discipleship' },
  { id: 'spoke-truth-love', name: 'I spoke truth with love', category: 'Discipleship' },
  { id: 'followed-through-someone', name: 'I followed through with someone', category: 'Discipleship' },
  { id: 'pointed-jesus', name: 'I pointed someone to Jesus', category: 'Discipleship' },
  { id: 'prayed-with', name: 'I prayed with someone', category: 'Discipleship' },
];

const CORE_WIN_TYPES = WIN_TYPES.slice(0, 7);

const CATEGORIES = [
  'Faith',
  'Inner Life',
  'Relationships',
  'Marriage',
  'Practical',
  'Home',
  'Family',
  'Motherhood',
  'Health',
  'School',
  'Work',
  'Business',
  'Ministry',
  'Discipleship',
  'Other',
];

const COMPLETION_MESSAGES = [
  'Faithfulness is often quiet.',
  'Small faithfulness still matters.',
  'God sees what was faithful today.',
  'Even small steps matter to God.',
  'What was quiet still mattered.',
  'A small win is still worth naming.',
  'God was present in this too.',
  'This matters more than it looks.',
  'God was at work in this too.',
  'Faithfulness still counts today.',
  'Grace was present here too.',
  'This quiet step still mattered.',
  'God sees what others may not.',
  'Obedience is worth noticing.',
  'Even this small step mattered.',
  'God did not overlook this.',
  'This was not nothing.',
  'Faith showed up here too.',
  'What was faithful still matters.',
  'God was near in this moment.',
  'This was a real step forward.',
  'Even quiet obedience matters.',
  'This is worth thanking God for.',
];

const FOOTER_MESSAGES = [
  'A small moment named with gratitude.',
  'Every step of faith matters.',
  'God sees your faithfulness.',
  'Your obedience matters to God.',
  'Faithfulness in small things.',
  'God is with you in this.',
  'A moment worth remembering.',
  'Grace in the ordinary.',
  'Faithfulness counts today.',
  'God honors your steps.',
  'This moment matters to God.',
  'Your faithfulness is seen.',
  'A step of faith taken.',
  'God is at work here.',
  'Every faithful act counts.',
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

// Step 1: Win Type Selection
const WinTypeSelectionStep: React.FC<{
  selectedWinType: WinType | null;
  onSelect: (winType: WinType) => void;
  onNext: () => void;
  onOtherStateChange: (isOtherSelected: boolean) => void;
  insets: { top: number; bottom: number };
  navigation: any;
  customWin: string;
  setCustomWin: (text: string) => void;
  dateContext: DateContext;
}> = ({ selectedWinType, onSelect, onNext, onOtherStateChange, insets, navigation, customWin, setCustomWin, dateContext }) => {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Faith');
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const buttonPosition = useRef(new Animated.Value(insets.bottom + 20)).current;
  const buttonScale = useRef(new Animated.Value(0)).current;
  const chooseAgainScale = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;

  // Enable LayoutAnimation for Android
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  useEffect(() => {
    if (selectedWinType && (selectedWinType.id !== 'other' || customWin.trim() !== '')) {
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: false,
      }).start();
    } else {
      buttonScale.setValue(0);
    }
  }, [selectedWinType, customWin, buttonScale]);

  useEffect(() => {
    if (selectedWinType?.id === 'other') {
      setIsOtherSelected(true);
      onOtherStateChange(true);
    } else {
      setIsOtherSelected(false);
      onOtherStateChange(false);
    }
  }, [onOtherStateChange, selectedWinType]);

  useEffect(() => {
    // When "Other" category is selected in expanded view, automatically select the "other" win type
    if (selectedCategory === 'Other' && isExpanded) {
      const otherWinType = WIN_TYPES.find(wt => wt.id === 'other');
      if (otherWinType && selectedWinType?.id !== 'other') {
        onSelect(otherWinType);
      }
    }
  }, [selectedCategory, isExpanded, selectedWinType, onSelect]);

  useEffect(() => {
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

  useEffect(() => {
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
      case 'today': return "TODAY'S WIN";
      case 'yesterday': return "YESTERDAY'S WIN";
      case 'earlier': return 'EARLIER WIN';
    }
  };

  const getTitle = () => {
    if (isOtherSelected) {
      switch (dateContext) {
        case 'today': return 'What was your win today?';
        case 'yesterday': return 'What was your win yesterday?';
        case 'earlier': return 'What was your win on this day?';
      }
    } else {
      switch (dateContext) {
        case 'today': return 'What kind of win did\ntoday hold?';
        case 'yesterday': return 'What kind of win did\nyesterday hold?';
        case 'earlier': return 'What kind of win did\nthis day hold?';
      }
    }
  };

  return (
    <View style={styles.stepContainer}>
      <GestureScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialIcons name="emoji-events" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>{getEyebrowLabel()}</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={styles.stepTitle}>
              {getTitle()}
            </ThemedText>
          </View>
        </StepFadeIn>

        {isOtherSelected ? (
          <StepFadeIn delay={160}>
            <View style={styles.customInputContainer}>
              <TextInput
                style={styles.customInput}
                placeholder="Type your win"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={customWin}
                onChangeText={setCustomWin}
                multiline
                autoFocus
                keyboardAppearance="dark"
              />
            </View>
          </StepFadeIn>
        ) : (
          <>
            {/* Category filter row - shown when expanded */}
            {isExpanded && (
              <StepFadeIn delay={100}>
                <View style={styles.categoryFilterScroll}>
                  <View style={styles.categoryFilterContent}>
                    {CATEGORIES.map((category) => (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryFilterChip,
                          selectedCategory === category && styles.categoryFilterChipSelected,
                        ]}
                        onPress={() => {
                          triggerLightHaptic();
                          setSelectedCategory(category);
                        }}
                        activeOpacity={0.75}
                      >
                        <ThemedText
                          style={[
                            styles.categoryFilterText,
                            selectedCategory === category && styles.categoryFilterTextSelected,
                          ]}
                        >
                          {category}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </StepFadeIn>
            )}

            {/* Win type grid */}
            <StepFadeIn delay={140}>
              <View style={styles.winTypesGrid}>
                {!isExpanded ? (
                  // Collapsed state: Show core 7
                  CORE_WIN_TYPES.map((winType) => {
                    const isSelected = selectedWinType?.id === winType.id;
                    return (
                      <TouchableOpacity
                        key={winType.id}
                        style={[styles.winTypeCard, isSelected && styles.winTypeCardSelected]}
                        onPress={() => {
                          triggerLightHaptic();
                          onSelect(winType);
                        }}
                        activeOpacity={0.75}
                      >
                        <ThemedText
                          style={[styles.winTypeName, isSelected && styles.winTypeNameSelected]}
                          numberOfLines={2}
                        >
                          {winType.name}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  // Expanded state: Show filtered win types
                  selectedCategory === 'Other' ? (
                    // When Other category is selected, automatically select the "other" win type
                    null
                  ) : (
                    WIN_TYPES.filter(
                      (winType) => winType.category === selectedCategory
                    ).map((winType) => {
                      const isSelected = selectedWinType?.id === winType.id;
                      return (
                        <TouchableOpacity
                          key={winType.id}
                          style={[styles.winTypeCard, isSelected && styles.winTypeCardSelected]}
                          onPress={() => {
                            triggerLightHaptic();
                            onSelect(winType);
                          }}
                          activeOpacity={0.75}
                        >
                          <ThemedText
                            style={[styles.winTypeName, isSelected && styles.winTypeNameSelected]}
                            numberOfLines={2}
                          >
                            {winType.name}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })
                  )
                )}
              </View>
            </StepFadeIn>
          </>
        )}

        {/* Show more/less / Choose again button */}
        <StepFadeIn delay={240}>
          <Animated.View style={{ opacity: buttonOpacity }}>
            <Animated.View
              style={{
                transform: [{ scale: isOtherSelected ? chooseAgainScale : 1 }],
              }}
            >
              <TouchableOpacity
                style={[styles.showMoreButton, { alignSelf: isOtherSelected ? 'flex-end' : 'center' }]}
                onPress={isOtherSelected ? () => {
                  triggerLightHaptic();
                  setIsOtherSelected(false);
                  onOtherStateChange(false);
                  setCustomWin('');
                } : () => {
                  triggerLightHaptic();
                  setIsExpanded(!isExpanded);
                  if (!isExpanded) {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  }
                }}
                activeOpacity={0.75}
              >
                <ThemedText style={styles.showMoreButtonText}>
                  {isOtherSelected ? 'Choose again' : (isExpanded ? 'Show less' : 'Show more')}
                </ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </StepFadeIn>

        {!isOtherSelected && (
          <StepFadeIn delay={200}>
            <View style={styles.metadataContainer}>
              <View style={styles.verticalLine} />
              <View style={styles.metadataContent}>
                <ThemedText weight="medium" style={styles.fromText}>
                  TIP
                </ThemedText>
                <ThemedText style={styles.metadataText}>
                  Choose the one that feels closest, then continue.
                </ThemedText>
              </View>
            </View>
          </StepFadeIn>
        )}

        <View style={{ height: 100 }} />
      </GestureScrollView>

      {/* Bottom button */}
      {selectedWinType && (!isOtherSelected || customWin.trim() !== '') && (
        <Animated.View style={[styles.primaryButton, { bottom: buttonPosition, transform: [{ scale: buttonScale }] }]}>
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

// Step 2: Kind of Win Description
const QuietWinStep: React.FC<{
  quietWin: string;
  onChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  selectedWinType: WinType | null;
  customWin: string;
  dateContext: DateContext;
}> = ({ quietWin, onChange, onNext, onBack: _onBack, insets, navigation, selectedWinType, customWin, dateContext }) => {
  const verticalLineHeight = useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const buttonPosition = useRef(new Animated.Value(insets.bottom + 20)).current;

  const getQuietWinTitle = () => {
    switch (dateContext) {
      case 'today': return 'What felt like a quiet win today?';
      case 'yesterday': return 'What felt like a quiet win yesterday?';
      case 'earlier': return 'What felt like a quiet win this day?';
    }
  };

  useEffect(() => {
    Animated.timing(verticalLineHeight, {
      toValue: 60,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [verticalLineHeight]);

  useEffect(() => {
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
      case 'today': return "TODAY'S WIN";
      case 'yesterday': return "YESTERDAY'S WIN";
      case 'earlier': return 'EARLIER WIN';
    }
  };

  const getPlaceholder = () => {
    switch (dateContext) {
      case 'today': return 'Name one moment from today and thank God for it...';
      case 'yesterday': return 'Name one moment from yesterday...';
      case 'earlier': return 'Name one moment from this day...';
    }
  };

  return (
    <View style={styles.stepContainer}>
      <GestureScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialIcons name="emoji-events" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>{getEyebrowLabel()}</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRowLeft}>
            <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
              {getQuietWinTitle()}
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <TextInput
            style={styles.quietWinInput}
            value={quietWin}
            onChangeText={onChange}
            placeholder={getPlaceholder()}
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            multiline
            textAlignVertical="top"
            autoFocus
            keyboardAppearance="dark"
          />
        </StepFadeIn>

        <StepFadeIn delay={160}>
          <View style={styles.metadataContainer}>
            <Animated.View style={[styles.verticalLine, { height: verticalLineHeight }]} />
            <View style={styles.metadataContent}>
              <MaterialCommunityIcons name="trophy" size={18} color={Colors.alertCoral} style={styles.metadataIcon} />
              <ThemedText weight="medium" style={styles.fromText}>
                KIND OF WIN
              </ThemedText>
              <ThemedText style={styles.metadataText}>
                {selectedWinType?.id === 'other' && customWin.trim() ? (
                  <ThemedText weight="semiBold">Other: {customWin.trim()}</ThemedText>
                ) : (
                  <ThemedText weight="semiBold">{selectedWinType?.name}</ThemedText>
                )}
              </ThemedText>
            </View>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </GestureScrollView>

      <Animated.View style={[styles.primaryButton, { bottom: buttonPosition }]}>
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

// Step 3: Completion
const CompletionStep: React.FC<{
  winType: WinType;
  quietWin: string;
  onDone: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  customWin: string;
  dateContext: DateContext;
}> = ({ winType, quietWin, onDone, insets, navigation: _navigation, customWin, dateContext }) => {
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconRotation = useRef(new Animated.Value(0)).current;
  const [, setCompletionMessage] = useState('');
  const [footerMessage, setFooterMessage] = useState('');

  useEffect(() => {
    // Get rotating completion message
    const getCompletionMessage = async () => {
      try {
        const currentIndex = await AsyncStorage.getItem('winCompletionIndex');
        const index = currentIndex ? parseInt(currentIndex, 10) : 0;
        setCompletionMessage(COMPLETION_MESSAGES[index % COMPLETION_MESSAGES.length]);
      } catch (error) {
        console.error('Error getting completion message:', error);
        setCompletionMessage(COMPLETION_MESSAGES[0]);
      }
    };

    // Get rotating footer message
    const getFooterMessage = async () => {
      try {
        const currentIndex = await AsyncStorage.getItem('winFooterIndex');
        const index = currentIndex ? parseInt(currentIndex, 10) : 0;
        setFooterMessage(FOOTER_MESSAGES[index % FOOTER_MESSAGES.length]);
      } catch (error) {
        console.error('Error getting footer message:', error);
        setFooterMessage(FOOTER_MESSAGES[0]);
      }
    };

    getCompletionMessage();
    getFooterMessage();

    // Animate checkmark
    Animated.spring(checkmarkScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      delay: 400,
      useNativeDriver: true,
    }).start();

    // Animate icon container with rotation
    Animated.parallel([
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
    ]).start();
  }, [checkmarkScale, iconRotation, iconScale]);

  const iconRotateInterpolate = iconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Dynamic labels based on date context
  const getEyebrowLabel = () => {
    switch (dateContext) {
      case 'today': return "TODAY'S WIN";
      case 'yesterday': return "YESTERDAY'S WIN";
      case 'earlier': return 'EARLIER WIN';
    }
  };

  const getSaveButtonText = () => {
    switch (dateContext) {
      case 'today': return 'Save for today';
      case 'yesterday': return 'Save for yesterday';
      case 'earlier': return 'Save for this day';
    }
  };

  return (
    <View style={styles.stepContainer}>
      <GestureScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <MaterialIcons name="emoji-events" size={18} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            {getEyebrowLabel()}
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={80} style={styles.completionCard}>
          <View style={styles.completionHeader}>
            <Animated.View style={[
              styles.completionIconContainer,
              {
                transform: [
                  { scale: iconScale },
                  { rotate: iconRotateInterpolate },
                ],
              },
            ]}>
              <MaterialIcons name="emoji-events" size={24} color={Colors.alertCoral} />
            </Animated.View>
            <View style={styles.completionHeaderContent}>
              <ThemedText weight="semiBold" style={styles.completionTitle}>
                {winType.id === 'other' && customWin.trim() ? customWin.trim() : winType.name}
              </ThemedText>
            </View>
            <Animated.View style={[
              styles.completionCheckmark,
              { transform: [{ scale: checkmarkScale }] },
            ]}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.growthGreen} />
            </Animated.View>
          </View>

          {quietWin.trim() && (
            <View style={styles.completionSection}>
              <ThemedText weight="medium" style={styles.completionSectionLabel}>KIND OF WIN</ThemedText>
              <ThemedText style={styles.completionSectionText}>{quietWin}</ThemedText>
            </View>
          )}

          <View style={styles.completionFooter}>
            <ThemedText style={styles.completionFooterText}>
              {footerMessage}
            </ThemedText>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </GestureScrollView>

      <View style={[styles.completionButtonContainer, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onDone();
          }}
          activeOpacity={0.85}
          style={styles.completionButton}
        >
          <ThemedText weight="semiBold" style={styles.completionButtonText}>
            {getSaveButtonText()}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main Screen Component
const TodaysWinWalkthroughScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = { top: 50, bottom: 34 };
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectedDate: selectedDateStr } = route.params || {};
  const selectedDate = selectedDateStr ? new Date(selectedDateStr) : new Date();
  const screenWidth = Dimensions.get('window').width;

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedWinType, setSelectedWinType] = useState<WinType | null>(null);
  const [quietWin, setQuietWin] = useState('');
  const [customWin, setCustomWin] = useState('');
  const [existingEntryId, setExistingEntryId] = useState<string | null>(null);
  const [isOtherStateActive, setIsOtherStateActive] = useState(false);

  const dateStr = toLocalDateString(selectedDate);
  const dateContext = getDateContext(selectedDate);

  const createMutation = useCreateTodayWinEntry();
  const updateMutation = useUpdateTodayWinEntry();

  // Fetch existing Today's Win data when component mounts
  const { data: existingEntries } = useTodayWinData(user?.id || '', dateStr);
  const existingEntry = existingEntries?.[0] || null;

  React.useEffect(() => {
    if (existingEntry) {
      try {
        const content = typeof existingEntry.content === 'string' ? JSON.parse(existingEntry.content) : existingEntry.content;
        if (content.winType) {
          const winType = WIN_TYPES.find(wt => wt.id === content.winType);
          if (winType) {
            setSelectedWinType(winType);
          }
        }
        if (content.winType === 'other' && content.winTypeName) {
          setCustomWin(content.winTypeName);
        }
        if (content.quietWin) {
          setQuietWin(content.quietWin);
        }
        setExistingEntryId(existingEntry.id);
      } catch (error) {
        console.error('Error parsing existing win data:', error);
      }
    }
  }, [existingEntry]);

  const handleNext = useCallback(() => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep === 1 && isOtherStateActive) {
      setSelectedWinType(null);
      setCustomWin('');
      setIsOtherStateActive(false);
      return;
    }

    if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(1);
    }
  }, [currentStep, isOtherStateActive]);

  // Swipe gesture handlers
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          const isHorizontalSwipe = Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
          return isHorizontalSwipe;
        },
        onPanResponderRelease: (_, gestureState) => {
          const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
          const hasEnoughDistance = Math.abs(gestureState.dx) > screenWidth * 0.15;
          const hasEnoughVelocity = Math.abs(gestureState.vx) > 0.45;

          if (!isHorizontalSwipe || (!hasEnoughDistance && !hasEnoughVelocity)) {
            return;
          }

          if (gestureState.dx > 0) {
            if (currentStep > 1) {
              handleBack();
              triggerMediumHaptic();
            }
          } else if (gestureState.dx < 0) {
            if (currentStep === 1 && !selectedWinType) {
              return;
            }
            if (currentStep < 3) {
              handleNext();
              triggerMediumHaptic();
            }
          }
        },
      }),
    [currentStep, handleBack, handleNext, screenWidth, selectedWinType]
  );

  const handleDone = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save your win.');
      return;
    }

    try {
      // Use new values if changed, otherwise keep existing values
      // If user selected a new win type, use it. Otherwise keep existing.
      const winTypeId = selectedWinType?.id === 'other' ? 'other' : (selectedWinType?.id || '');
      const winTypeName = selectedWinType?.id === 'other' ? customWin.trim() : (selectedWinType?.name || '');

      // If user entered new text, use it and clear win type. If win type was selected, clear text.
      const quietWinToSave = quietWin.trim() !== '' ? quietWin.trim() : '';

      const contentToSave = JSON.stringify({ winType: winTypeId, winTypeName, quietWin: quietWinToSave });

      if (existingEntryId) {
        await updateMutation.mutateAsync({ id: existingEntryId, updates: { content: contentToSave } });
      } else {
        await createMutation.mutateAsync({ user_id: user.id, selected_date: dateStr, content: contentToSave });
      }

      // Invalidate cache and refetch to ensure UI updates with new data
      await queryClient.invalidateQueries({ queryKey: queryKeys.journal.todayWin(user.id, dateStr) });
      await queryClient.refetchQueries({ queryKey: queryKeys.journal.todayWin(user.id, dateStr) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.journal.all });

      // Check if streak celebration should show for today's win
      const shouldShowStreak = await visibleStreakService.shouldShowCelebration(user.id, 'journal_today_win');
      if (shouldShowStreak) {
        await visibleStreakService.markShownToday(user.id);
        (navigation as any).navigate('StreakPlan', {
          userId: user.id,
          source: 'journal_today_win',
        });
      }

      // Increment completion message index for next time
      try {
        const currentIndex = await AsyncStorage.getItem('winCompletionIndex');
        const index = currentIndex ? parseInt(currentIndex, 10) : 0;
        await AsyncStorage.setItem('winCompletionIndex', String((index + 1) % COMPLETION_MESSAGES.length));
      } catch (error) {
        console.error('Error incrementing completion message index:', error);
      }

      // Increment footer message index for next time
      try {
        const currentIndex = await AsyncStorage.getItem('winFooterIndex');
        const index = currentIndex ? parseInt(currentIndex, 10) : 0;
        await AsyncStorage.setItem('winFooterIndex', String((index + 1) % FOOTER_MESSAGES.length));
      } catch (error) {
        console.error('Error incrementing footer message index:', error);
      }

      triggerMediumHaptic();
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save your win. Please try again.');
    }
  };

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

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {currentStep === 1 && (
        <WinTypeSelectionStep
          selectedWinType={selectedWinType}
          onSelect={setSelectedWinType}
          onNext={handleNext}
          insets={insets}
          navigation={navigation}
          customWin={customWin}
          setCustomWin={setCustomWin}
          onOtherStateChange={setIsOtherStateActive}
          dateContext={dateContext}
        />
      )}

      {currentStep === 2 && selectedWinType && (
        <QuietWinStep
          quietWin={quietWin}
          onChange={setQuietWin}
          onNext={handleNext}
          onBack={handleBack}
          insets={insets}
          navigation={navigation}
          selectedWinType={selectedWinType}
          customWin={customWin}
          dateContext={dateContext}
        />
      )}

      {currentStep === 3 && selectedWinType && (
        <CompletionStep
          winType={selectedWinType}
          quietWin={quietWin}
          onDone={handleDone}
          insets={insets}
          navigation={navigation}
          customWin={customWin}
          dateContext={dateContext}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  titleRowLeft: {
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 32,
    textAlign: 'center',
  },
  stepTitleLeft: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 24,
    marginBottom: 32,
  },
  winTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginTop: 48,
  },
  winTypeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  winTypeCardSelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: 'rgba(255, 107, 107, 0.4)',
  },
  winTypeName: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  winTypeNameSelected: {
    color: Colors.hopeWhite,
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
    marginBottom: 20,
  },
  completionSectionLabel: {
    fontSize: 12,
    color: Colors.alertCoral,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: '500',
  },
  completionSectionText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  completionFooter: {
    marginTop: 24,
    paddingTop: 24,
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
    shadowColor: '#000',
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
  quietWinInput: {
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontSize: 18,
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  metadataContainer: {
    marginTop: 48,
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
  categoryFilterScroll: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  categoryFilterContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoryFilterChipSelected: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
  },
  categoryFilterText: {
    fontSize: 13,
    color: Colors.hopeWhite,
    fontWeight: '500',
  },
  categoryFilterTextSelected: {
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  showMoreButtonIcon: {
    marginLeft: 4,
  },
  customInputContainer: {
    marginTop: 16,
    paddingHorizontal: 24,
  },
  customInput: {
    backgroundColor: 'transparent',
    fontSize: 18,
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
    minHeight: 80,
    textAlignVertical: 'top',
    paddingHorizontal: 0,
    paddingVertical: 16,
  },
  completionContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  checkmarkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.alertCoral,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  completionTitle: {
    fontSize: 28,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  completionSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  summaryContainer: {
    gap: 24,
  },
  summarySection: {
    gap: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.alertCoral,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  summaryText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  doneButton: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.alertCoral,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  doneButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
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

export default withErrorBoundary(TodaysWinWalkthroughScreen, 'TodaysWinWalkthrough');

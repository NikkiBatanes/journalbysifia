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
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import ThemedText from '../components/common/ThemedText';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../utils/date';
import { useCreateLookingForwardEntry, useUpdateLookingForwardEntry } from '../services/hooks/useJournalData';
import { analytics } from '../utils/analytics';
import { isToday, isYesterday, startOfDay } from 'date-fns';
import { visibleStreakService } from '../services/visibleStreakService';

import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TomorrowInHisHandsWalkthrough'>;

const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;

type DateContext = 'today' | 'yesterday' | 'earlier';

// Helper to compute date context from selected date
const getDateContext = (selectedDate: Date): DateContext => {
  const day = startOfDay(selectedDate);

  if (isToday(day)) {return 'today';}
  if (isYesterday(day)) {return 'yesterday';}
  return 'earlier';
};

// Emotion Data
interface Emotion {
  id: string;
  name: string;
  icon: string;
}

const EMOTIONS: Emotion[] = [
  { id: 'hopeful', name: 'Hopeful', icon: 'heart' },
  { id: 'trusting', name: 'Trusting', icon: 'shield-check-outline' },
  { id: 'anxious', name: 'Anxious', icon: 'alert-circle-outline' },
  { id: 'frustrated', name: 'Frustrated', icon: 'emoticon-angry-outline' },
  { id: 'reluctant', name: 'Reluctant', icon: 'pause-circle-outline' },
  { id: 'tired', name: 'Tired', icon: 'bed-outline' },
  { id: 'unprepared', name: 'Unprepared', icon: 'book-open-page-variant-outline' },
  { id: 'open-handed', name: 'Open-handed', icon: 'hand-coin' },
  { id: 'surrendered', name: 'Surrendered', icon: 'white-balance-sunny' },
  { id: 'excited', name: 'Excited', icon: 'star-face' },
  { id: 'expectant', name: 'Expectant', icon: 'clock-outline' },
  { id: 'ready', name: 'Ready', icon: 'check-circle-outline' },
  { id: 'prayerful', name: 'Prayerful', icon: 'hands-pray' },
  { id: 'calm', name: 'Calm', icon: 'weather-sunny' },
  { id: 'steady', name: 'Steady', icon: 'anchor' },
  { id: 'overwhelmed', name: 'Overwhelmed', icon: 'wave' },
  { id: 'nervous', name: 'Nervous', icon: 'lightning-bolt-outline' },
  { id: 'hesitant', name: 'Hesitant', icon: 'dots-horizontal-circle-outline' },
  { id: 'heavy', name: 'Heavy', icon: 'weight' },
  { id: 'cautious', name: 'Cautious', icon: 'shield-outline' },
  { id: 'curious', name: 'Curious', icon: 'lightbulb-outline' },
  { id: 'thankful', name: 'Thankful', icon: 'flower' },
  { id: 'eager', name: 'Eager', icon: 'rocket-launch-outline' },
  { id: 'stretched', name: 'Stretched', icon: 'arrow-expand-horizontal' },
  { id: 'unsure', name: 'Unsure', icon: 'help-circle-outline' },
  { id: 'waiting', name: 'Waiting', icon: 'timer-outline' },
  { id: 'other', name: 'Other', icon: 'plus-circle-outline' },
];

const COMPLETION_MESSAGES = [
  'A small act of trust for what is ahead.',
  'You do not have to carry tomorrow alone.',
  'What is ahead is still in God\'s hands.',
  'Trust can begin before tomorrow arrives.',
  'You can face what is ahead with God.',
  'Tomorrow can be held with open hands.',
  'God is already present in what is ahead.',
  'What is ahead can be entrusted to God.',
  'You can bring tomorrow before God today.',
  'Peace can begin before the moment arrives.',
  'God is already there before you arrive.',
  'What is coming can still be met with trust.',
  'You can hold what is ahead with steady faith.',
  'What is next can be placed before God.',
  'God\'s presence reaches into what is ahead.',
  'What is ahead does not have to be figured out alone.',
  'You can meet tomorrow with open hands.',
  'You can walk toward tomorrow with God.',
  'What is ahead can be held with peace.',
  'You can release tomorrow before it arrives.',
  'The next step can be taken with trust.',
  'God is able to hold what you cannot yet see.',
  'What lies ahead can still be met in faith.',
  'You are not alone in what is coming.',
  'Even now, tomorrow can be placed in God\'s hands.',
  'Jesus is already present in what is ahead.',
  'What is ahead can be entrusted to Jesus.',
  'You do not have to face tomorrow without Jesus.',
  'Jesus is already there before you arrive.',
  'You can bring tomorrow before Jesus today.',
  'What is ahead can be held before Jesus.',
  'You can walk toward what is ahead with Jesus.',
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

// Step 1: Emotion Selection
const EmotionSelectionStep: React.FC<{
  selectedEmotion: Emotion | null;
  onSelect: (emotion: Emotion) => void;
  onNext: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  customEmotion: string;
  setCustomEmotion: (text: string) => void;
  dateContext: DateContext;
}> = ({ selectedEmotion, onSelect, onNext, insets, navigation, customEmotion, setCustomEmotion, dateContext }) => {
  const [isOtherSelected, setIsOtherSelected] = React.useState(false);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const [showAllEmotions, setShowAllEmotions] = React.useState(false);
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;
  const buttonScale = React.useRef(new Animated.Value(0)).current;
  const chooseAgainScale = React.useRef(new Animated.Value(0)).current;
  const showMoreScale = React.useRef(new Animated.Value(0)).current;

  const INITIAL_EMOTION_COUNT = 12; // 4x3 grid

  // Enable LayoutAnimation for Android
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  React.useEffect(() => {
    if (selectedEmotion) {
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: false,
      }).start();
    } else {
      buttonScale.setValue(0);
    }
  }, [selectedEmotion, buttonScale]);

  React.useEffect(() => {
    LayoutAnimation.configureNext({
      duration: 300,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
    });
    if (selectedEmotion?.id === 'other') {
      setIsOtherSelected(true);
    } else {
      setIsOtherSelected(false);
    }
  }, [selectedEmotion]);

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
    if (!isOtherSelected && EMOTIONS.length > INITIAL_EMOTION_COUNT) {
      Animated.spring(showMoreScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: false,
      }).start();
    } else {
      showMoreScale.setValue(0);
    }
  }, [isOtherSelected, showMoreScale]);

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
      case 'today': return 'LOOKING FORWARD TO';
      case 'yesterday': return 'LOOKED FORWARD TO';
      case 'earlier': return 'LOOKED FORWARD TO';
    }
  };

  const getTitle = () => {
    if (isOtherSelected) {
      switch (dateContext) {
        case 'today': return 'How does tomorrow feel?';
        case 'yesterday': return 'How did yesterday feel?';
        case 'earlier': return 'How did this day feel?';
      }
    } else {
      switch (dateContext) {
        case 'today': return 'How does tomorrow feel right now?';
        case 'yesterday': return 'How did yesterday feel?';
        case 'earlier': return 'How did this day feel?';
      }
    }
  };

  const handleChooseAgain = () => {
    triggerLightHaptic();
    LayoutAnimation.configureNext({
      duration: 300,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
    });
    onSelect(null as any);
  };

  const handleShowMore = () => {
    triggerLightHaptic();
    LayoutAnimation.configureNext({
      duration: 300,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
    });
    setShowAllEmotions(!showAllEmotions);
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
            <MaterialIcons name="wb-sunny" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
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

        {isOtherSelected && (
          <StepFadeIn delay={240}>
            <View style={styles.customInputContainer}>
              <TextInput
                style={styles.customInput}
                placeholder="Type your emotion"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={customEmotion}
                onChangeText={setCustomEmotion}
                multiline
                autoFocus
                keyboardAppearance="dark"
              />
            </View>
          </StepFadeIn>
        )}

        {!isOtherSelected && (
          <StepFadeIn delay={240} style={styles.emotionsGrid}>
          {EMOTIONS.slice(0, showAllEmotions ? EMOTIONS.length : INITIAL_EMOTION_COUNT).map((emotion, _index) => {
            const isSelected = selectedEmotion?.id === emotion.id;
            return (
              <TouchableOpacity
                key={emotion.id}
                style={[styles.emotionCard, isSelected && styles.emotionCardSelected]}
                onPress={() => {
                  triggerLightHaptic();
                  onSelect(emotion);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.emotionIconContainer}>
                  <View style={[
                    styles.emotionIconCircle,
                    isSelected && styles.emotionIconCircleSelected,
                  ]}>
                    <MaterialCommunityIcons
                      name={emotion.icon as any}
                      size={18}
                      color={isSelected ? Colors.hopeWhite : Colors.alertCoral}
                    />
                  </View>
                </View>
                <ThemedText
                  weight="semiBold"
                  style={[styles.emotionName, isSelected && styles.emotionNameSelected]}
                >
                  {emotion.name}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </StepFadeIn>
        )}

        {!isOtherSelected && EMOTIONS.length > INITIAL_EMOTION_COUNT && (
          <StepFadeIn delay={320}>
            <Animated.View style={{
              transform: [{ scale: showMoreScale }],
            }}>
              <TouchableOpacity
                style={[styles.showMoreButton, { alignSelf: 'center' }]}
                onPress={handleShowMore}
                activeOpacity={0.75}
              >
                <ThemedText style={styles.showMoreButtonText}>
                  {showAllEmotions ? 'Show less' : 'Show more'}
                </ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </StepFadeIn>
        )}

        {isOtherSelected && (
          <StepFadeIn delay={320}>
            <Animated.View style={{
              transform: [{ scale: chooseAgainScale }],
            }}>
              <TouchableOpacity
                style={[styles.showMoreButton, { alignSelf: 'flex-end' }]}
                onPress={handleChooseAgain}
                activeOpacity={0.75}
              >
                <ThemedText style={styles.showMoreButtonText}>
                  Choose again
                </ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </StepFadeIn>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom buttons */}
      {selectedEmotion && (!isOtherSelected || customEmotion.trim() !== '') && (
        <Animated.View style={[styles.primaryButton, IS_IPAD && styles.primaryButtonPad, { bottom: buttonPosition, transform: [{ scale: buttonScale }] }]}>
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

// Step 2: Looking Ahead Text Input
const LookingAheadInputStep: React.FC<{
  emotion: Emotion;
  lookingAheadText: string;
  onChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  icon: string;
  customEmotion: string;
  dateContext: DateContext;
}> = ({ emotion, lookingAheadText, onChange, onNext, insets, navigation, icon, customEmotion, dateContext }) => {
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
      case 'today': return 'LOOKING FORWARD TO';
      case 'yesterday': return 'LOOKED FORWARD TO';
      case 'earlier': return 'LOOKED FORWARD TO';
    }
  };

  const getTitle = () => {
    switch (dateContext) {
      case 'today': return 'What are you looking ahead to?';
      case 'yesterday': return 'What were you looking forward to?';
      case 'earlier': return 'What were you looking forward to?';
    }
  };

  const getPlaceholder = () => {
    switch (dateContext) {
      case 'today': return 'I am looking forward to...';
      case 'yesterday': return 'I was looking forward to...';
      case 'earlier': return 'I was looking forward to...';
    }
  };

  const getMetadataNote = () => {
    switch (dateContext) {
      case 'today': return 'Name what tomorrow holds, and place it before God.';
      case 'yesterday': return 'Name what yesterday held, and place it before God.';
      case 'earlier': return 'Name what this day held, and place it before God.';
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
            <MaterialIcons name="wb-sunny" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>{getEyebrowLabel()}</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRowLeft}>
            <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
              {getTitle()}
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <TextInput
            style={styles.personalInput}
            value={lookingAheadText}
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
              <MaterialCommunityIcons name={icon as any} size={18} color={Colors.alertCoral} style={styles.metadataIcon} />
              <ThemedText weight="medium" style={styles.fromText}>
                HOW YOU'RE HOLDING IT
              </ThemedText>
              <ThemedText style={styles.metadataText}>
                {emotion.id === 'other' && customEmotion.trim() ? (
                  <ThemedText weight="semiBold">Other: {customEmotion.trim()}</ThemedText>
                ) : (
                  <ThemedText weight="semiBold">{emotion.name}</ThemedText>
                )}
              </ThemedText>
              <ThemedText style={styles.metadataText}>
                {getMetadataNote()}
              </ThemedText>
            </View>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.primaryButton, IS_IPAD && styles.primaryButtonPad, { bottom: buttonPosition }]}>
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

// Step 3: Completion Screen
const CompletionStep: React.FC<{
  emotion: Emotion;
  lookingAheadText: string;
  onDone: () => void;
  insets: { top: number; bottom: number };
  customEmotion: string;
  dateContext: DateContext;
}> = ({ emotion, lookingAheadText, onDone, insets, customEmotion, dateContext }) => {
  // Animation refs
  const checkmarkScale = React.useRef(new Animated.Value(0)).current;
  const iconScale = React.useRef(new Animated.Value(0)).current;
  const iconRotation = React.useRef(new Animated.Value(0)).current;
  const [completionMessage, setCompletionMessage] = React.useState('');

  React.useEffect(() => {
    // Get rotating completion message
    const getCompletionMessage = async () => {
      try {
        const currentIndex = await AsyncStorage.getItem('lookingForwardCompletionIndex');
        const index = currentIndex ? parseInt(currentIndex, 10) : 0;
        setCompletionMessage(COMPLETION_MESSAGES[index % COMPLETION_MESSAGES.length]);
      } catch (error) {
        console.error('Error getting completion message:', error);
        setCompletionMessage(COMPLETION_MESSAGES[0]);
      }
    };
    getCompletionMessage();

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

    // Start animations
    checkmarkAnim.start();
    iconAnim.start();

    // Cleanup: stop animations on unmount
    return () => {
      checkmarkAnim.stop();
      iconAnim.stop();
    };
  }, [checkmarkScale, iconScale, iconRotation]);

  const iconRotateInterpolate = iconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Dynamic labels based on date context
  const getEyebrowLabel = () => {
    switch (dateContext) {
      case 'today': return 'LOOKING FORWARD TO';
      case 'yesterday': return 'LOOKED FORWARD TO';
      case 'earlier': return 'LOOKED FORWARD TO';
    }
  };

  const getSaveButtonText = () => {
    switch (dateContext) {
      case 'today': return 'Save this';
      case 'yesterday': return 'Save this';
      case 'earlier': return 'Save this';
    }
  };

  const displayEmotion = emotion.id === 'other' && customEmotion.trim() ? customEmotion.trim() : emotion.name;

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <MaterialIcons name="wb-sunny" size={18} color={Colors.alertCoral} />
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
              <MaterialCommunityIcons name={emotion.icon as any} size={24} color={Colors.alertCoral} />
            </Animated.View>
            <View style={styles.completionHeaderContent}>
              <ThemedText style={styles.completionSubtext}>{completionMessage}</ThemedText>
            </View>
            <Animated.View style={[
              styles.completionCheckmark,
              { transform: [{ scale: checkmarkScale }] },
            ]}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.growthGreen} />
            </Animated.View>
          </View>

          {lookingAheadText.trim() && (
            <View style={styles.completionSection}>
              <ThemedText weight="medium" style={styles.completionSectionLabel}>LOOKING FORWARD TO</ThemedText>
              <ThemedText style={styles.completionSectionText}>
                {lookingAheadText}
              </ThemedText>
            </View>
          )}

          <View style={styles.completionSection}>
            <ThemedText weight="medium" style={styles.completionSectionLabel}>HOW YOU'RE HOLDING IT</ThemedText>
            <ThemedText style={styles.completionSectionText}>{displayEmotion}</ThemedText>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.completionButtonContainer, IS_IPAD && styles.completionButtonContainerPad, { bottom: insets.bottom + 20 }]}>
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
const TomorrowInHisHandsWalkthroughScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedDate: selectedDateStr, existingEntry } = route.params || {};
  const selectedDate = selectedDateStr ? new Date(selectedDateStr) : new Date();

  // Parse existing entry content to initialize state
  const getInitialState = () => {
    if (existingEntry?.content) {
      try {
        const parsedContent = typeof existingEntry.content === 'string'
          ? JSON.parse(existingEntry.content)
          : existingEntry.content;

        const emotionId = parsedContent.emotionId || null;
        const emotionObj = emotionId ? EMOTIONS.find(emo => emo.id === emotionId) : null;

        return {
          emotion: emotionObj || null,
          customEmotion: parsedContent.customEmotion || '',
          lookingAheadText: parsedContent.entry?.text || parsedContent.lookingAheadText || '',
        };
      } catch (error) {
        console.error('Error parsing existing entry content:', error);
      }
    }
    return {
      emotion: null,
      customEmotion: '',
      lookingAheadText: '',
    };
  };

  const initialState = getInitialState();

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(initialState.emotion);
  const [customEmotion, setCustomEmotion] = useState(initialState.customEmotion);
  const [lookingAheadText, setLookingAheadText] = useState(initialState.lookingAheadText);

  const dateStr = toLocalDateString(selectedDate);
  const dateContext = getDateContext(selectedDate);

  const createMutation = useCreateLookingForwardEntry();
  const updateMutation = useUpdateLookingForwardEntry();

  // Hide status bar for translucent scrolling effect
  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, 'slide');
      StatusBar.setBarStyle('light-content');
      return () => {
        StatusBar.setHidden(false, 'slide');
        StatusBar.setBarStyle('light-content');
      };
    }, [])
  );

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save.');
      return;
    }

    try {
      // Use new values if changed, otherwise keep existing values
      // If user selected a new emotion, clear the text. If user entered text, clear the emotion.
      const emotionIdToSave = selectedEmotion ? selectedEmotion.id : '';
      const emotionNameToSave = selectedEmotion?.id === 'other'
        ? customEmotion.trim()
        : (selectedEmotion?.name || '');
      const customEmotionToSave = selectedEmotion?.id === 'other'
        ? customEmotion.trim()
        : '';

      // If user entered new text, use it and clear emotion. If emotion was selected, clear text.
      const textToSave = lookingAheadText.trim() !== '' ? lookingAheadText.trim() : '';

      const contentToSave = JSON.stringify({
        entry: {
          id: `looking_forward_${Date.now()}`,
          text: textToSave,
          date: selectedDate,
        },
        emotionId: emotionIdToSave,
        emotionName: emotionNameToSave,
        customEmotion: customEmotionToSave,
      });

      if (existingEntry?.id) {
        await updateMutation.mutateAsync({
          id: existingEntry.id,
          updates: { content: contentToSave },
        });

        // Manually update cache to ensure UI reflects changes immediately
        queryClient.setQueryData(['journal', 'lookingForward', user.id, dateStr], (oldData: any) => {
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
          content: contentToSave,
        });
      }

      // Invalidate cache to ensure UI updates with new data
      await queryClient.invalidateQueries({ queryKey: ['journal', 'lookingForward', user.id, dateStr] });
      await queryClient.invalidateQueries({ queryKey: ['journal', 'all'] });

      // Check if streak celebration should show for looking forward
      const shouldShowStreak = await visibleStreakService.shouldShowCelebration(user.id, 'journal_looking_forward_added');
      let navigatedToStreak = false;
      if (shouldShowStreak) {
        await visibleStreakService.markShownToday(user.id);
        (navigation as any).navigate('StreakPlan', {
          userId: user.id,
          source: 'journal_looking_forward_added',
          dismissRouteCount: 2,
        });
        navigatedToStreak = true;
      }

      // Increment completion message index for next time
      try {
        const currentIndex = await AsyncStorage.getItem('lookingForwardCompletionIndex');
        const index = currentIndex ? parseInt(currentIndex, 10) : 0;
        await AsyncStorage.setItem('lookingForwardCompletionIndex', String((index + 1) % COMPLETION_MESSAGES.length));
      } catch (error) {
        console.error('Error incrementing completion message index:', error);
      }

      analytics.trackFocusEvent('tomorrow_saved', {
        emotion: selectedEmotion?.id || '',
        has_text: lookingAheadText.trim().length > 0,
        date: dateStr,
      }, user.id);

      if (!navigatedToStreak) {
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save. Please try again.');
    }
  };

  const handleNext = useCallback(() => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep]);

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
          return Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
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
            if (currentStep === 0 && !selectedEmotion) {
              return;
            }
            if (currentStep < 2) {
              handleNext();
              triggerMediumHaptic();
            }
          }
        },
      }),
    [currentStep, handleBack, handleNext, screenWidth, selectedEmotion]
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {currentStep === 0 && (
        <EmotionSelectionStep
          selectedEmotion={selectedEmotion}
          onSelect={setSelectedEmotion}
          onNext={handleNext}
          insets={insets}
          navigation={navigation}
          customEmotion={customEmotion}
          setCustomEmotion={setCustomEmotion}
          dateContext={dateContext}
        />
      )}

      {currentStep === 1 && selectedEmotion && (
        <LookingAheadInputStep
          emotion={selectedEmotion}
          lookingAheadText={lookingAheadText}
          onChange={setLookingAheadText}
          onNext={handleNext}
          onBack={handleBack}
          insets={insets}
          navigation={navigation}
          icon={selectedEmotion.icon}
          customEmotion={customEmotion}
          dateContext={dateContext}
        />
      )}

      {currentStep === 2 && selectedEmotion && (
        <CompletionStep
          emotion={selectedEmotion}
          lookingAheadText={lookingAheadText}
          onDone={handleSave}
          insets={insets}
          customEmotion={customEmotion}
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
  stepDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
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
  emotionsGrid: {
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
  emotionCard: {
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
  emotionCardSelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.18)',
    borderColor: Colors.alertCoral,
  },
  emotionIconContainer: {
    marginBottom: 8,
  },
  emotionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.anchorBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emotionIconCircleSelected: {
    backgroundColor: Colors.alertCoral,
  },
  emotionName: {
    fontSize: 12,
    color: Colors.hopeWhite,
    marginBottom: 4,
    textAlign: 'center',
  },
  emotionNameSelected: {
    color: Colors.hopeWhite,
  },
  personalInput: {
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontSize: 18,
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
    minHeight: 120,
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
  completionTitle: {
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
  completionDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 20,
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
  completionButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
    backgroundColor: Colors.anchorBlue,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  primaryButtonPad: {
    right: 48,
  },
});

export default withErrorBoundary(TomorrowInHisHandsWalkthroughScreen, 'TomorrowInHisHandsWalkthroughScreen');

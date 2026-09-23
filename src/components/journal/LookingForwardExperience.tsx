import { LOOKING_FORWARD_EMOTIONS as EMOTIONS, type Emotion } from '../../data/lookingForwardEmotions';
import { useFloatingKeyboardButton } from '../../hooks/useFloatingKeyboardButton';
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  TextInput,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoutineDraft } from '../../hooks/useRoutineDraft';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { Colors } from '../../theme/colors';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import ThemedText from '../../components/common/ThemedText';
import StepFadeIn from '../../components/common/StepFadeIn';
import { triggerLightHaptic, triggerMediumHaptic } from '../../utils/haptics';
import { toLocalDateString, getDateContext, type DateContext } from '../../utils/date';
import { saveLocalJournalSingleton, getLocalJournalSingleton } from '../../storage/journalStorage';

const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;

export interface LookingForwardExperienceProps {
  selectedDate: Date;
  insets?: { top: number; bottom: number };
  onClose?: () => void;
  onComplete: (record: any) => void | Promise<void>;
  completionButtonText?: string;
  skipCompletionPage?: boolean;
  routineDraft?: { routine: 'morning' | 'evening'; selectedDate: string; step: string };
}

// Emotion Data

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

// Step 1: Emotion Selection
export const LookingForwardEmotionStep: React.FC<{
  selectedEmotion: Emotion | null;
  onSelect: (emotion: Emotion | null) => void;
  onNext: () => void;
  insets: { top: number; bottom: number };
  onClose?: () => void;
  customEmotion: string;
  setCustomEmotion: (text: string) => void;
  dateContext: DateContext;
  weekly?: boolean;
  embedded?: boolean;
}> = ({ selectedEmotion, onSelect, onNext, insets, onClose, customEmotion, setCustomEmotion, dateContext, weekly = false, embedded = false }) => {
  const [isOtherSelected, setIsOtherSelected] = React.useState(false);
  const [showAllEmotions, setShowAllEmotions] = React.useState(false);
  const { bottom: buttonPosition, keyboardVisible } = useFloatingKeyboardButton(insets.bottom);
  const buttonScale = React.useRef(new Animated.Value(0)).current;
  const chooseAgainScale = React.useRef(new Animated.Value(0)).current;
  const showMoreScale = React.useRef(new Animated.Value(0)).current;

  const INITIAL_EMOTION_COUNT = 12; // 4x3 grid
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  // Enable LayoutAnimation for Android
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  React.useEffect(() => {
    if (selectedEmotion) {
      const animation = Animated.spring(buttonScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: false,
      });
      animation.start();
      return () => animation.stop();
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
      const animation = Animated.spring(chooseAgainScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: false,
      });
      animation.start();
      return () => animation.stop();
    } else {
      chooseAgainScale.setValue(0);
    }
  }, [isOtherSelected, chooseAgainScale]);

  React.useEffect(() => {
    if (!isOtherSelected && EMOTIONS.length > INITIAL_EMOTION_COUNT) {
      const animation = Animated.spring(showMoreScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: false,
      });
      animation.start();
      return () => animation.stop();
    } else {
      showMoreScale.setValue(0);
    }
  }, [isOtherSelected, showMoreScale]);



  // Dynamic labels based on date context
  const getEyebrowLabel = () => {
    if (weekly) {return 'LOOKING FORWARD TO THIS WEEK';}
    switch (dateContext) {
      case 'today': return 'LOOKING FORWARD TO';
      case 'yesterday': return 'LOOKED FORWARD TO';
      case 'earlier': return 'LOOKED FORWARD TO';
    }
  };

  const getTitle = () => {
    if (weekly) {return isOtherSelected ? 'How does this week feel?' : 'How does this week feel right now?';}
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
    onSelect(null);
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
            <MaterialIcons name="wb-sunny" size={16} color={Colors.sage} style={styles.labelIcon} />
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
                style={[styles.customInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
                placeholder="Type your emotion"
                accessibilityLabel="Your own feeling"
                placeholderTextColor={Colors.textGray}
                value={customEmotion}
                onChangeText={setCustomEmotion}
                multiline
                autoFocus
                keyboardAppearance="light"
              />
            </View>
          </StepFadeIn>
        )}

        {!isOtherSelected && (
          <StepFadeIn delay={240} style={styles.emotionsGrid}>
          {EMOTIONS.slice(0, showAllEmotions ? EMOTIONS.length : INITIAL_EMOTION_COUNT).map((emotion) => {
            const isSelected = selectedEmotion?.id === emotion.id;
            return (
              <TouchableOpacity
                key={emotion.id}
                accessibilityRole="button"
                accessibilityLabel={emotion.name}
                accessibilityState={{selected: isSelected}}
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
                      color={Colors.hopeWhite}
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
                style={[styles.showMoreButton, { alignSelf: 'center' }]}
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
      {!embedded && selectedEmotion && (!isOtherSelected || customEmotion.trim() !== '') && (
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
      {!embedded && <View style={[styles.closeButton, { top: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            onClose?.();
          }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </View>}
    </View>
  );
};

// Step 2: Looking Ahead Text Input
export const LookingForwardWritingStep: React.FC<{
  emotion: Emotion | null;
  lookingAheadText: string;
  onChange: (text: string) => void;
  onNext: () => void;
  insets: { top: number; bottom: number };
  onClose?: () => void;
  customEmotion: string;
  dateContext: DateContext;
  weekly?: boolean;
  embedded?: boolean;
}> = ({ emotion, lookingAheadText, onChange, onNext, insets, onClose, customEmotion, dateContext, weekly = false, embedded = false }) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const verticalLineHeight = React.useRef(new Animated.Value(0)).current;
  const { bottom: buttonPosition, keyboardVisible } = useFloatingKeyboardButton(insets.bottom);

  React.useEffect(() => {
    const animation = Animated.timing(verticalLineHeight, {
      toValue: 75,
      duration: 400,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [verticalLineHeight]);



  // Dynamic labels based on date context
  const getEyebrowLabel = () => {
    if (weekly) {return 'LOOKING FORWARD TO THIS WEEK';}
    switch (dateContext) {
      case 'today': return 'LOOKING FORWARD TO';
      case 'yesterday': return 'LOOKED FORWARD TO';
      case 'earlier': return 'LOOKED FORWARD TO';
    }
  };

  const getTitle = () => {
    if (weekly) {return 'What are you looking forward to this week?';}
    switch (dateContext) {
      case 'today': return 'What are you looking ahead to?';
      case 'yesterday': return 'What were you looking forward to?';
      case 'earlier': return 'What were you looking forward to?';
    }
  };

  const getPlaceholder = () => {
    if (weekly) {return 'This week, I am looking forward to…';}
    switch (dateContext) {
      case 'today': return 'I am looking forward to...';
      case 'yesterday': return 'I was looking forward to...';
      case 'earlier': return 'I was looking forward to...';
    }
  };

  const getMetadataNote = () => {
    if (weekly) {return 'Name what this week holds, and place it before God.';}
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
            <MaterialIcons name="wb-sunny" size={16} color={Colors.sage} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>{getEyebrowLabel()}</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={[styles.stepTitleLeft, { textAlign: 'center' }]}>
              {getTitle()}
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <TextInput
            style={[styles.personalInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
            value={lookingAheadText}
            onChangeText={onChange}
            placeholder={getPlaceholder()}
            accessibilityLabel={getTitle()}
            underlineColorAndroid="transparent"
            placeholderTextColor={Colors.textGray}
            multiline
            textAlignVertical="top"
            autoFocus
            keyboardAppearance="light"
          />
        </StepFadeIn>

        {emotion && <StepFadeIn delay={160}>
          <View style={styles.metadataContainer}>
            <Animated.View style={[styles.verticalLine, { height: verticalLineHeight }]} />
            <View style={styles.metadataContent}>
              <MaterialCommunityIcons name={emotion.icon as any} size={18} color={Colors.sage} style={styles.metadataIcon} />
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
        </StepFadeIn>}

        <View style={{ height: 100 }} />
      </ScrollView>

      {!embedded && <Animated.View style={[styles.primaryButton, { bottom: buttonPosition }]}>
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
      </Animated.View>}

      {/* Close button - top right */}
      {!embedded && <View style={[styles.closeButton, { top: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            onClose?.();
          }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </View>}
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
  completionButtonText?: string;
}> = ({ emotion, lookingAheadText, onDone, insets, customEmotion, dateContext, completionButtonText }) => {
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

  const displayEmotion = emotion.id === 'other' && customEmotion.trim() ? customEmotion.trim() : emotion.name;
  const buttonText = completionButtonText ?? 'Save this';

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <MaterialIcons name="wb-sunny" size={18} color={Colors.sage} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
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
              <MaterialCommunityIcons name={emotion.icon as any} size={24} color={Colors.hopeWhite} />
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
            <View style={[styles.completionSection, { borderTopColor: Colors.inputBorder }]}>
              <ThemedText weight="medium" style={styles.completionSectionLabel}>LOOKING FORWARD TO</ThemedText>
              <ThemedText style={styles.completionSectionText}>
                {lookingAheadText}
              </ThemedText>
            </View>
          )}

          <View style={[styles.completionSection, { borderTopColor: Colors.inputBorder }]}>
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
            {buttonText}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const LookingForwardExperience: React.FC<LookingForwardExperienceProps> = ({
  selectedDate,
  insets: insetsProp,
  onClose,
  onComplete,
  completionButtonText,
  skipCompletionPage,
  routineDraft,
}) => {
  const insets = insetsProp ?? { top: 50, bottom: 34 };
  const { width: screenWidth } = useWindowDimensions();

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [customEmotion, setCustomEmotion] = useState('');
  const [lookingAheadText, setLookingAheadText] = useState('');
  const clearDraft = useRoutineDraft(
    routineDraft?.routine ?? 'evening',
    routineDraft?.selectedDate ?? toLocalDateString(selectedDate),
    routineDraft?.step ?? 'disabled-looking-forward',
    { selectedEmotionId: selectedEmotion?.id, customEmotion, lookingAheadText },
    draft => {
      if (!routineDraft) {return;}
      setSelectedEmotion(draft.selectedEmotionId ? EMOTIONS.find(emotion => emotion.id === draft.selectedEmotionId) ?? null : null);
      setCustomEmotion(draft.customEmotion ?? '');
      setLookingAheadText(draft.lookingAheadText ?? '');
    },
    Boolean(routineDraft),
  );

  const dateStr = toLocalDateString(selectedDate);
  const dateContext = getDateContext(selectedDate);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const existing = await getLocalJournalSingleton('looking_forward', dateStr);
      if (!existing || !mounted) {return;}
      try {
        const parsed = typeof existing.content === 'string'
          ? JSON.parse(existing.content)
          : existing.content;

        const emotionId = parsed.emotionId || null;
        const emotionObj = emotionId ? EMOTIONS.find(emo => emo.id === emotionId) : null;

        if (emotionObj) {
          setSelectedEmotion(emotionObj);
        }
        if (parsed.customEmotion) {
          setCustomEmotion(parsed.customEmotion);
        }
        if (parsed.entry?.text) {
          setLookingAheadText(parsed.entry.text);
        }
      } catch (error) {
        console.error('Error loading looking forward:', error);
      }
    })();
    return () => { mounted = false; };
  }, [dateStr]);

  const handleDone = async () => {
    try {
      const emotionIdToSave = selectedEmotion ? selectedEmotion.id : '';
      const emotionNameToSave = selectedEmotion?.id === 'other'
        ? customEmotion.trim()
        : (selectedEmotion?.name || '');
      const customEmotionToSave = selectedEmotion?.id === 'other'
        ? customEmotion.trim()
        : '';
      const textToSave = lookingAheadText.trim();

      const contentToSave = JSON.stringify({
        entry: { text: textToSave },
        emotionId: emotionIdToSave,
        emotionIcon: selectedEmotion?.icon || '',
        emotionName: emotionNameToSave,
        customEmotion: customEmotionToSave,
      });

      const record = await saveLocalJournalSingleton('looking_forward', dateStr, contentToSave);

      try {
        const currentIndex = await AsyncStorage.getItem('lookingForwardCompletionIndex');
        const index = currentIndex ? parseInt(currentIndex, 10) : 0;
        await AsyncStorage.setItem('lookingForwardCompletionIndex', String((index + 1) % COMPLETION_MESSAGES.length));
      } catch (error) {
        console.error('Error incrementing completion message index:', error);
      }

      triggerMediumHaptic();
      if (routineDraft) {await clearDraft();}
      await onComplete(record);
    } catch (error) {
      Alert.alert('Error', 'Failed to save. Please try again.');
    }
  };

  const handleDoneRef = React.useRef<() => Promise<void>>(handleDone);
  handleDoneRef.current = handleDone;

  const handleNext = useCallback(() => {
    if (currentStep === 0) {
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (skipCompletionPage) {
        handleDoneRef.current();
      } else {
        setCurrentStep(2);
      }
    }
  }, [currentStep, skipCompletionPage]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      onClose?.();
    }
  }, [currentStep, onClose]);

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
        <LookingForwardEmotionStep
          selectedEmotion={selectedEmotion}
          onSelect={setSelectedEmotion}
          onNext={handleNext}
          insets={insets}
          onClose={onClose}
          customEmotion={customEmotion}
          setCustomEmotion={setCustomEmotion}
          dateContext={dateContext}
        />
      )}

      {currentStep === 1 && selectedEmotion && (
        <LookingForwardWritingStep
          emotion={selectedEmotion}
          lookingAheadText={lookingAheadText}
          onChange={setLookingAheadText}
          onNext={handleNext}
          insets={insets}
          onClose={onClose}
          customEmotion={customEmotion}
          dateContext={dateContext}
        />
      )}

      {currentStep === 2 && selectedEmotion && (
        <CompletionStep
          emotion={selectedEmotion}
          lookingAheadText={lookingAheadText}
          onDone={handleDone}
          insets={insets}
          customEmotion={customEmotion}
          dateContext={dateContext}
          completionButtonText={completionButtonText}
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
  stepTitleLeft: {
    fontSize: 24,
    color: Colors.text,
    lineHeight: 30,
    marginBottom: 16,
    textAlign: 'left',
  },
  stepDescription: {
    fontSize: 16,
    color: Colors.text,
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
    color: Colors.sageMuted,
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
  emotionCard: {
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
  emotionCardSelected: {
    backgroundColor: Colors.sageMuted,
    borderColor: Colors.sage,
  },
  emotionIconContainer: {
    marginBottom: 8,
  },
  emotionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emotionIconCircleSelected: {
    backgroundColor: Colors.sage,
  },
  emotionName: {
    fontSize: 12,
    color: Colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  emotionNameSelected: {
    color: Colors.hopeWhite,
  },
  personalInput: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontSize: 18,
    color: Colors.text,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  completionHeaderContent: {
    flex: 1,
  },
  completionTitle: {
    fontSize: 20,
    color: Colors.text,
    marginBottom: 4,
  },
  completionSubtext: {
    fontSize: 14,
    color: Colors.textGray,
  },
  completionCheckmark: {
    marginLeft: 12,
  },
  completionDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 20,
  },
  completionSection: {
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  completionSectionLabel: {
    fontSize: 11,
    color: Colors.textGray,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  completionSectionText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  completionButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
    backgroundColor: Colors.lightBackground,
    zIndex: 100,
  },
  completionButtonContainerPad: {
    paddingHorizontal: 160,
  },
  completionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
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
  primaryButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.sage,
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
});

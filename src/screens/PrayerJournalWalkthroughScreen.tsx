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
  Keyboard,
  PanResponder,
  useWindowDimensions,
  DeviceEventEmitter,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { useTheme } from '../hooks/useTheme';
import ThemedText from '../components/common/ThemedText';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerMediumHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../utils/date';
import { useCreatePrayer, useUpdatePrayer, useACTSPrayerData, useDeletePrayer, useMarkSupplicationAnswered } from '../services/hooks/usePrayerData';
import { analytics } from '../utils/analytics';
import { isToday, isYesterday, startOfDay } from 'date-fns';
import PlaybookMetaSection from '../components/journal/PlaybookMetaSection';
import NewSuccessModal from '../components/NewSuccessModal';
import { useSuccessModal } from '../hooks/useSuccessModal';
import { visibleStreakService } from '../services/visibleStreakService';
import { clearPrayerDraft, getPrayerDraft, getPrayerDraftKey, savePrayerDraft } from '../storage/prayerDraftStorage';

import type { RootStackParamList } from '../navigation/types';
import { exitPrayerFlow } from '../navigation/exitPrayerFlow';

type DateContext = 'today' | 'yesterday' | 'earlier';

// Helper to compute date context from selected date
const getDateContext = (selectedDate: Date): DateContext => {
  const day = startOfDay(selectedDate);

  if (isToday(day)) {return 'today';}
  if (isYesterday(day)) {return 'yesterday';}
  return 'earlier';
};

type Props = NativeStackScreenProps<RootStackParamList, 'PrayerJournalWalkthrough'>;

const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;

// Prayer Path Data
interface PrayerPath {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const PRAYER_PATHS: PrayerPath[] = [
  {
    id: 'acts',
    name: 'CAST Method',
    description: 'Confession · Adoration · Supplication · Thanksgiving',
    icon: 'layers',
  },
  {
    id: 'open',
    name: 'Open Prayer',
    description: 'Pray in your own words without a fixed structure.',
    icon: 'chatbubble-ellipses-outline',
  },
];

// ACTS Prayer Steps
const ACTS_STEPS = [
  { key: 'confession', label: 'CONFESSION', title: 'Confession', description: 'Bring before God what you need to confess, release, or lay down.', placeholder: 'I confess that...' },
  { key: 'adoration', label: 'ADORATION', title: 'Adoration', description: 'Turn your eyes to who God is, and praise Him for who He is even in the middle of this.', placeholder: 'I praise You...' },
  { key: 'supplication', label: 'SUPPLICATION', title: 'Supplication', description: 'Bring your needs and the needs of others before God, and ask for His help.', placeholder: 'I ask for Your help with...' },
  { key: 'thanksgiving', label: 'THANKSGIVING', title: 'Thanksgiving', description: 'Pause and thank God for what is true, good, and already in His hands.', placeholder: 'I thank You for...' },
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

// Step 1: Prayer Path Selection
const PrayerPathSelectionStep: React.FC<{
  selectedPath: PrayerPath | null;
  onSelect: (path: PrayerPath) => void;
  onNext: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  dateContext: DateContext;
}> = ({ selectedPath, onSelect, onNext, insets, navigation, dateContext }) => {
  const buttonScale = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (selectedPath) {
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: false,
      }).start();
    } else {
      buttonScale.setValue(0);
    }
  }, [selectedPath, buttonScale]);

  // Dynamic labels based on date context
  const getTitle = () => {
    switch (dateContext) {
      case 'today': return 'How would you\nlike to pray?';
      case 'yesterday': return 'How did you\nlike to pray?';
      case 'earlier': return 'How did you\nlike to pray?';
    }
  };

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.sage} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>PRAYER JOURNAL</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={styles.stepTitle}>
              {getTitle()}
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={160} style={styles.categoriesGrid}>
          {PRAYER_PATHS.map((path) => {
            const isSelected = selectedPath?.id === path.id;
            return (
              <TouchableOpacity
                key={path.id}
                style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                onPress={() => {
                  triggerLightHaptic();
                  onSelect(path);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.categoryIconContainer}>
                  <View style={[
                    styles.categoryIconCircle,
                    isSelected && styles.categoryIconCircleSelected,
                  ]}>
                    <Ionicons
                      name={path.icon as any}
                      size={18}
                      color={isSelected ? Colors.hopeWhite : Colors.sage}
                    />
                  </View>
                </View>
                <ThemedText
                  weight="semiBold"
                  style={[styles.categoryName, isSelected && styles.categoryNameSelected]}
                >
                  {path.name}
                </ThemedText>
                <ThemedText style={[styles.categoryDescription, isSelected && styles.categoryDescriptionSelected]}>
                  {path.description}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom button */}
      {selectedPath && (
        <Animated.View style={[styles.primaryButton, { bottom: insets.bottom + 20 }]}>
          <Animated.View style={[
            styles.primaryButtonInner,
            { transform: [{ scale: buttonScale }] },
          ]}>
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
          <Ionicons name="close" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 2: CAST Prayer Description
const CASTDescriptionStep: React.FC<{
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ onNext, onBack: _onBack, insets, navigation }) => {
  const fadeAnims = React.useRef([...Array(4)].map(() => new Animated.Value(0))).current;
  const dotScaleAnims = React.useRef([...Array(4)].map(() => new Animated.Value(0.5))).current;
  const timelineHeight = React.useRef(new Animated.Value(0)).current;
  const castTimelineTargetHeight = Platform.OS === 'android'
    ? 410
    : IS_IPAD ? 300 : 380;

  React.useEffect(() => {
    Animated.timing(timelineHeight, {
      toValue: 1,
      duration: 2000,
      delay: 200,
      useNativeDriver: false,
    }).start();

    const animations = dotScaleAnims.map((anim, index) =>
      Animated.sequence([
        Animated.delay(100 + index * 280),
        Animated.parallel([
          Animated.spring(anim, {
            toValue: 1,
            tension: 40,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnims[index], {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    Animated.stagger(298, animations).start();
  }, [fadeAnims, dotScaleAnims, timelineHeight]);

  const prayerSteps = [
    { label: 'Confession', description: 'Bring before God what you need to confess, release, or lay down.', icon: 'hand-right' },
    { label: 'Adoration', description: 'Turn your eyes to who God is, and praise Him for who He is even in the middle of this.', icon: 'sparkles' },
    { label: 'Supplication', description: 'Bring your needs and the needs of others before God, and ask for His help.', icon: 'gift' },
    { label: 'Thanksgiving', description: 'Pause and thank God for what is true, good, and already in His hands.', icon: 'heart' },
  ];

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.sage} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>CAST PRAYER</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={styles.stepTitle}>
              CAST Prayer
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={120}>
          <ThemedText style={styles.stepDescription}>
            Move slowly through each part before going to the next.
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={160}>
          <View style={[styles.focusLabelContainer, { justifyContent: 'flex-start', marginLeft: 24 }]}>
            <ThemedText weight="semiBold" style={[styles.focusLabel, { color: Colors.sage }]}>PRAYER FLOW</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={160}>
          <View style={styles.timelineContainer}>
            <Animated.View style={[
              styles.timelineThickBar,
              IS_IPAD && styles.timelineThickBarPad,
              { height: timelineHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, castTimelineTargetHeight],
              }) },
            ]} />

            {prayerSteps.map((step, index) => (
              <Animated.View
                key={step.label}
                style={[
                  styles.timelineStep,
                  {
                    opacity: fadeAnims[index],
                  },
                ]}
              >
                <Animated.View style={[
                  styles.timelineDot,
                  { transform: [{ scale: dotScaleAnims[index] }] },
                ]}>
                  {step.icon === 'hand-right' ? (
                    <Ionicons
                      name={step.icon as any}
                      size={16}
                      color={Colors.hopeWhite}
                      style={{ transform: [{ rotate: '30deg' }] }}
                    />
                  ) : (
                    <Ionicons name={step.icon as any} size={16} color={Colors.hopeWhite} />
                  )}
                </Animated.View>
                <Animated.View style={[
                  styles.timelineContentContainer,
                  { opacity: fadeAnims[index] },
                ]}>
                  <ThemedText weight="semiBold" style={styles.timelineLabel}>{step.label}</ThemedText>
                  <ThemedText style={styles.timelineDescription}>{step.description}</ThemedText>
                </Animated.View>
              </Animated.View>
            ))}
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.completionButtonContainer, IS_IPAD && styles.completionButtonContainerPad, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onNext();
          }}
          activeOpacity={0.85}
          style={styles.completionButton}
        >
          <ThemedText weight="semiBold" style={styles.completionButtonText}>
            Begin Prayer
          </ThemedText>
        </TouchableOpacity>
      </View>

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
          <Ionicons name="close" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 3: Open Prayer Description
const OpenPrayerDescriptionStep: React.FC<{
  onNext: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ onNext, insets, navigation }) => {
  const fadeAnims = React.useRef([...Array(4)].map(() => new Animated.Value(0))).current;
  const dotScaleAnims = React.useRef([...Array(4)].map(() => new Animated.Value(0.5))).current;
  const timelineHeight = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(timelineHeight, {
      toValue: 1,
      duration: 2000,
      delay: 200,
      useNativeDriver: false,
    }).start();

    const animations = dotScaleAnims.map((anim, index) =>
      Animated.sequence([
        Animated.delay(100 + index * 280),
        Animated.parallel([
          Animated.spring(anim, {
            toValue: 1,
            tension: 40,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnims[index], {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    Animated.stagger(298, animations).start();
  }, [fadeAnims, dotScaleAnims, timelineHeight]);

  const prayerSteps = [
    { label: 'Come honestly', description: 'Come honestly before God.', icon: 'heart' },
    { label: 'Speak your heart', description: 'Say what is on your heart.', icon: 'chatbubble-ellipses-outline' },
    { label: 'Ask boldly', description: 'Ask for what you need.', icon: 'gift' },
    { label: 'End in trust', description: 'End in trust.', icon: 'sparkles' },
  ];

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.sage} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>OPEN PRAYER</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={styles.stepTitle}>
              Open Prayer
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={120}>
          <ThemedText style={styles.stepDescription}>
            Bring your heart before Jesus honestly and in your own words.
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={160}>
          <View style={[styles.focusLabelContainer, { justifyContent: 'flex-start', marginLeft: 24 }]}>
            <ThemedText weight="semiBold" style={[styles.focusLabel, { color: Colors.sage }]}>PRAYER FLOW</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={160}>
          <View style={styles.timelineContainer}>
            <Animated.View style={[
              styles.timelineThickBar,
              { height: timelineHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 300],
              }) },
            ]} />

            {prayerSteps.map((step, index) => (
              <Animated.View
                key={step.label}
                style={[
                  styles.timelineStep,
                  {
                    opacity: fadeAnims[index],
                  },
                ]}
              >
                <Animated.View style={[
                  styles.timelineDot,
                  { transform: [{ scale: dotScaleAnims[index] }] },
                ]}>
                  <Ionicons name={step.icon as any} size={16} color={Colors.hopeWhite} />
                </Animated.View>
                <Animated.View style={[
                  styles.timelineContentContainer,
                  { opacity: fadeAnims[index] },
                ]}>
                  <ThemedText weight="semiBold" style={styles.timelineLabel}>{step.label}</ThemedText>
                  <ThemedText style={styles.timelineDescription}>{step.description}</ThemedText>
                </Animated.View>
              </Animated.View>
            ))}
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.completionButtonContainer, IS_IPAD && styles.completionButtonContainerPad, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onNext();
          }}
          activeOpacity={0.85}
          style={styles.completionButton}
        >
          <ThemedText weight="semiBold" style={styles.completionButtonText}>
            Begin Prayer
          </ThemedText>
        </TouchableOpacity>
      </View>

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
          <Ionicons name="close" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 2: ACTS Prayer Slides
const ACTSPrayerSlidesStep: React.FC<{
  prayerTexts: { [key: string]: string };
  onChange: (key: string, text: string) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  castOpening: string;
  castClosing: string;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  stepBody?: string;
  stepExample?: string | null;
  readOnly?: boolean;
  actionLabel?: string;
  initialActsStepIndex?: number;
}> = ({
  prayerTexts,
  onChange,
  onNext,
  onBack,
  insets,
  navigation,
  castOpening,
  castClosing,
  playbookTitle,
  actionStepNumber,
  actionStepTitle,
  stepBody,
  stepExample,
  readOnly = false,
  actionLabel,
  initialActsStepIndex = 0,
}) => {
  const [actsStepIndex, setActsStepIndex] = useState(initialActsStepIndex);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const buttonPosition = useRef(new Animated.Value(insets.bottom + 20)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const cardTranslateY = useRef(new Animated.Value(0)).current;

  const currentStep = ACTS_STEPS[actsStepIndex];
  const isNotificationMode = !!actionLabel;
  const isLastStep = isNotificationMode || actsStepIndex >= ACTS_STEPS.length - 1;

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

  const animateToNext = useCallback(
    (callback: () => void, direction: 'forward' | 'backward' = 'forward') => {
      const exitOffset = direction === 'forward' ? -14 : 14;
      const enterOffset = direction === 'forward' ? 22 : -22;

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(cardTranslateY, { toValue: exitOffset, duration: 160, useNativeDriver: true }),
      ]).start(() => {
        callback();
        cardTranslateY.setValue(enterOffset);
        Animated.parallel([
          Animated.spring(fadeAnim, { toValue: 1, tension: 75, friction: 8, useNativeDriver: true }),
          Animated.spring(cardTranslateY, { toValue: 0, tension: 75, friction: 8, useNativeDriver: true }),
        ]).start();
      });
    },
    [fadeAnim, cardTranslateY]
  );

  const handleNext = useCallback(() => {
    triggerMediumHaptic();
    if (isLastStep) {
      onNext();
      return;
    }

    animateToNext(() => {
      setActsStepIndex(prev => prev + 1);
    });
  }, [isLastStep, onNext, animateToNext]);

  const handleBack = useCallback(() => {
    triggerMediumHaptic();
    if (actsStepIndex <= 0) {
      onBack();
      return;
    }

    animateToNext(() => {
      setActsStepIndex(prev => prev - 1);
    }, 'backward');
  }, [actsStepIndex, animateToNext, onBack]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
        },
        onPanResponderRelease: (_, gestureState) => {
          const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
          const hasEnoughDistance = Math.abs(gestureState.dx) > 48;
          const hasEnoughVelocity = Math.abs(gestureState.vx) > 0.45;

          if (!isHorizontalSwipe || (!hasEnoughDistance && !hasEnoughVelocity)) {
            return;
          }

          if (gestureState.dx > 0) {
            handleBack();
          } else if (gestureState.dx < 0) {
            handleNext();
          }
        },
      }),
    [handleBack, handleNext]
  );

  return (
    <View style={styles.stepContainer} {...panResponder.panHandlers}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.sage} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            CAST PRAYER
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <ThemedText style={styles.actionCounter}>
            {isNotificationMode ? 'Supplication' : `${actsStepIndex + 1} of ${ACTS_STEPS.length}`}
          </ThemedText>
        </StepFadeIn>

        {!isNotificationMode && (
          <StepFadeIn delay={100}>
            <View style={styles.actionProgressBar}>
              <View style={[
                styles.actionProgressFill,
                { width: `${((actsStepIndex + 1) / ACTS_STEPS.length) * 100}%` },
              ]} />
            </View>
          </StepFadeIn>
        )}

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: cardTranslateY }] }}>
          <StepFadeIn delay={120}>
            <View style={styles.actsCard}>
              {/* Display suggested opening on confession step */}
              {actsStepIndex === 0 && (
                <View style={styles.suggestedTextContainer}>
                  <ThemedText style={styles.suggestedText}>{castOpening}</ThemedText>
                </View>
              )}

              <View style={styles.actsCardHeader}>
                <ThemedText weight="semiBold" style={styles.actsCardTitle}>{currentStep.label}</ThemedText>
                <ThemedText style={styles.actsCardDescription}>{currentStep.description}</ThemedText>
              </View>

              <TextInput
                style={styles.personalInput}
                value={prayerTexts[currentStep.key] || ''}
                onChangeText={(text) => onChange(currentStep.key, text)}
                placeholder={currentStep.placeholder || 'Begin your prayer here...'}
                placeholderTextColor={Colors.placeholderText}
                multiline
                textAlignVertical="top"
                autoFocus={!readOnly}
                keyboardAppearance="light"
                editable={!readOnly}
              />

              {/* Display metadata below input field for all ACTS steps */}
              {playbookTitle && (
                <PlaybookMetaSection
                  light
                  playbookTitle={playbookTitle}
                  actionLabel={actionStepNumber && actionStepTitle
                    ? `Action ${actionStepNumber}: ${actionStepTitle}`
                    : undefined}
                  stepBody={stepBody}
                  stepExample={stepExample}
                />
              )}

              {/* Display suggested closing on thanksgiving step */}
              {isLastStep && (
                <View style={styles.suggestedTextContainer}>
                  <ThemedText style={styles.suggestedText}>{castClosing}</ThemedText>
                </View>
              )}
            </View>
          </StepFadeIn>

        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {actionLabel ? (
        <Animated.View style={[styles.completionButtonContainer, IS_IPAD && styles.completionButtonContainerPad, { bottom: buttonPosition }]}>
          <Animated.View style={[
            styles.primaryButtonPill,
            { opacity: prayerTexts[currentStep.key]?.trim() ? 1 : 0 },
          ]}>
            <TouchableOpacity
              onPress={() => { triggerLightHaptic(); return (handleNext)(); }}
              activeOpacity={0.7}
              style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            >
              <ThemedText weight="semiBold" style={styles.primaryButtonText}>
                {actionLabel}
              </ThemedText>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      ) : (
        <Animated.View style={[
          styles.primaryButton,
          { bottom: buttonPosition },
        ]}>
          <Animated.View style={[
            styles.primaryButtonInner,
            { opacity: prayerTexts[currentStep.key]?.trim() ? 1 : 0 },
          ]}>
            <TouchableOpacity
              onPress={() => { triggerLightHaptic(); return (handleNext)(); }}
              activeOpacity={0.7}
              style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-forward" size={20} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

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
          <Ionicons name="close" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 3: Open Prayer
const OpenPrayerStep: React.FC<{
  prayerText: string;
  onChange: (text: string) => void;
  onNext: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  stepBody?: string;
  stepExample?: string | null;
  readOnly?: boolean;
  actionLabel?: string;
}> = ({ prayerText, onChange, onNext, insets, navigation, playbookTitle, actionStepNumber, actionStepTitle, stepBody, stepExample, readOnly = false, actionLabel }) => {
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;

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
        <StepFadeIn delay={0} style={[styles.stepLabelRow, { justifyContent: 'flex-start', paddingHorizontal: 24 }]}>
          <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.sage} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            OPEN PRAYER
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={0}>
          <View style={styles.actsCard}>
            <TextInput
              style={styles.personalInput}
              value={prayerText || ''}
              onChangeText={onChange}
              placeholder="Begin your prayer here..."
              placeholderTextColor={Colors.placeholderText}
              multiline
              textAlignVertical="top"
              autoFocus={!readOnly}
              keyboardAppearance="light"
              editable={!readOnly}
            />

            {/* Display metadata below input field */}
            {playbookTitle && (
              <PlaybookMetaSection
                  light
                playbookTitle={playbookTitle}
                actionLabel={actionStepNumber && actionStepTitle
                  ? `Action ${actionStepNumber}: ${actionStepTitle}`
                  : undefined}
                stepBody={stepBody}
                stepExample={stepExample}
              />
            )}
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      {actionLabel ? (
        <Animated.View style={[styles.completionButtonContainer, IS_IPAD && styles.completionButtonContainerPad, { bottom: buttonPosition }]}>
          <Animated.View style={[
            styles.primaryButtonPill,
            { opacity: prayerText?.trim() ? 1 : 0 },
          ]}>
            <TouchableOpacity
              onPress={() => {
                triggerMediumHaptic();
                onNext();
              }}
              activeOpacity={0.7}
              style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
              disabled={!prayerText}
            >
              <ThemedText weight="semiBold" style={styles.primaryButtonText}>
                {actionLabel}
              </ThemedText>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.primaryButton, { bottom: buttonPosition }]}>
          <Animated.View style={[
            styles.primaryButtonInner,
            { opacity: prayerText?.trim() ? 1 : 0 },
          ]}>
            <TouchableOpacity
              onPress={() => {
                triggerMediumHaptic();
                onNext();
              }}
              activeOpacity={0.7}
              style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
              disabled={!prayerText}
            >
              <Ionicons name="chevron-forward" size={20} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

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
          <Ionicons name="close" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 4: Completion Screen
const CompletionStep: React.FC<{
  prayerPath: PrayerPath;
  prayerTexts: { [key: string]: string };
  openPrayerText: string;
  onDone: () => void;
  insets: { top: number; bottom: number };
  onSupplicationTrackingChange: (value: boolean) => void;
  onOpenTrackingChange: (value: boolean) => void;
  supplicationTrackAnswered: boolean;
  openPrayerTrackAnswered: boolean;
  isEditing?: boolean;
  castOpening: string;
  castClosing: string;
  onCastOpeningChange: (value: string) => void;
  onCastClosingChange: (value: string) => void;
}> = ({ prayerPath, prayerTexts, openPrayerText, onDone, insets, supplicationTrackAnswered, openPrayerTrackAnswered, onSupplicationTrackingChange, onOpenTrackingChange, isEditing = false, castOpening, castClosing, onCastOpeningChange, onCastClosingChange }) => {
  const theme = useTheme();
  const checkmarkScale = React.useRef(new Animated.Value(0)).current;
  const iconScale = React.useRef(new Animated.Value(0)).current;
  const iconRotation = React.useRef(new Animated.Value(0)).current;

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

    checkmarkAnim.start();
    iconAnim.start();

    return () => {
      checkmarkAnim.stop();
      iconAnim.stop();
    };
  }, [checkmarkScale, iconScale, iconRotation]);

  const iconRotateInterpolate = iconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderACTSPrayer = () => {
    const validSteps = ACTS_STEPS.filter(step => prayerTexts[step.key]);
    if (validSteps.length === 0) {return null;}

    return (
      <>
        <View style={styles.completionSection}>
          <ThemedText weight="medium" style={styles.completionSectionLabel}>OPENING</ThemedText>
          <TextInput
            style={[styles.completionInput, { fontFamily: theme.currentFont }]}
            value={castOpening}
            onChangeText={onCastOpeningChange}
            placeholder="e.g., Heavenly Father,"
            placeholderTextColor={Colors.placeholderText}
            keyboardAppearance="light"
          />
        </View>

        {validSteps.map((step, index) => {
          const text = prayerTexts[step.key];
          const isLast = index === validSteps.length - 1;

          return (
            <View key={step.key} style={[styles.completionSection, isLast && { borderBottomWidth: 0 }]}>
              <ThemedText weight="medium" style={styles.completionSectionLabel}>{step.label}</ThemedText>
              <ThemedText style={styles.completionSectionText}>{text}</ThemedText>
              {step.key === 'supplication' && <TouchableOpacity style={[styles.trackingBadgeContainer, { marginTop: 12 }]} onPress={() => onSupplicationTrackingChange(!supplicationTrackAnswered)}><Ionicons name={supplicationTrackAnswered ? 'checkbox-outline' : 'square-outline'} size={18} color={Colors.sage} /><ThemedText style={styles.trackingBadgeText}>{supplicationTrackAnswered ? 'Keep praying about this' : 'Just save this prayer'}</ThemedText></TouchableOpacity>}
              {step.key === 'supplication' && supplicationTrackAnswered && (
                <View style={[styles.completionSection, styles.completionSectionSmall]}>
                  <View style={styles.trackingRow}>
                    <ThemedText weight="medium" style={styles.completionSectionLabel}>TRACKING</ThemedText>
                    <View style={styles.trackingBadgeContainer}>
                      <Ionicons name="notifications-outline" size={16} color={Colors.sage} />
                      <ThemedText style={styles.trackingBadgeText}>Enabled</ThemedText>
                    </View>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.completionSection}>
          <ThemedText weight="medium" style={styles.completionSectionLabel}>CLOSING</ThemedText>
          <TextInput
            style={[styles.completionInput, { fontFamily: theme.currentFont }]}
            value={castClosing}
            onChangeText={onCastClosingChange}
            placeholder="e.g., In Jesus' Name,\nAmen"
            placeholderTextColor={Colors.placeholderText}
            keyboardAppearance="light"
            multiline
          />
        </View>
      </>
    );
  };

  const renderOpenPrayer = () => {
    if (!openPrayerText || openPrayerText.trim() === '') {return null;}

    return (
      <View style={[styles.completionSection, { borderBottomWidth: 0 }]}>
        <ThemedText weight="medium" style={styles.completionSectionLabel}>PRAYER</ThemedText>
        <ThemedText style={styles.completionSectionText}>{openPrayerText}</ThemedText>
        <TouchableOpacity style={[styles.trackingBadgeContainer, { marginTop: 12 }]} onPress={() => onOpenTrackingChange(!openPrayerTrackAnswered)}><Ionicons name={openPrayerTrackAnswered ? 'checkbox-outline' : 'square-outline'} size={18} color={Colors.sage} /><ThemedText style={styles.trackingBadgeText}>{openPrayerTrackAnswered ? 'Keep praying about this' : 'Just save this prayer'}</ThemedText></TouchableOpacity>
        {openPrayerTrackAnswered && (
          <View style={[styles.completionSection, styles.completionSectionSmall]}>
            <View style={styles.trackingRow}>
              <ThemedText weight="medium" style={styles.completionSectionLabel}>TRACKING</ThemedText>
              <View style={styles.trackingBadgeContainer}>
                <Ionicons name="notifications-outline" size={16} color={Colors.sage} />
                <ThemedText style={styles.trackingBadgeText}>Enabled</ThemedText>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <MaterialCommunityIcons name="hands-pray" size={18} color={Colors.sage} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            PRAYER JOURNAL
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
              <MaterialCommunityIcons name="hands-pray" size={24} color={Colors.sage} />
            </Animated.View>
            <View style={styles.completionHeaderContent}>
              <ThemedText weight="semiBold" style={styles.completionCategory}>{isEditing ? 'Updated Prayer' : 'Saved Prayer'}</ThemedText>
              <ThemedText style={styles.completionSubtext}>A place to return to what you placed before God.</ThemedText>
            </View>
            <Animated.View style={[
              styles.completionCheckmark,
              { transform: [{ scale: checkmarkScale }] },
            ]}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.growthGreen} />
            </Animated.View>
          </View>

          <View style={styles.completionSection}>
            <ThemedText weight="medium" style={styles.completionSectionLabel}>PRAYER PATH</ThemedText>
            <ThemedText style={styles.completionSectionText}>{prayerPath.name}</ThemedText>
          </View>

          {prayerPath.id === 'acts' ? renderACTSPrayer() : renderOpenPrayer()}
        </StepFadeIn>

        <View style={{ height: 40 }} />
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
            {isEditing ? 'Update Prayer' : 'Save Prayer'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main Screen Component
const PrayerJournalWalkthroughScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectedDate: selectedDateStr, initialPrayerType, showDescription, editingPrayerId, subtaskId, stepId, playbookId, playbookTitle, playbookStatus, actionStepNumber, actionStepTitle, stepBody, stepExample, fromPlaybook, fromNotificationAnsweredCheck } = route.params || {};
  const selectedDate = selectedDateStr ? new Date(selectedDateStr) : new Date();
  const dateContext = getDateContext(selectedDate);

  // Skip intro/description steps when coming from PlaybookWalkthroughScreen
  const [currentStep, setCurrentStep] = useState(editingPrayerId || fromPlaybook ? 2 : 0);
  const [selectedPath, setSelectedPath] = useState<PrayerPath | null>(fromPlaybook ? (initialPrayerType === 'acts' ? PRAYER_PATHS[0] : initialPrayerType === 'open' ? PRAYER_PATHS[1] : null) : null);
  const [prayerTexts, setPrayerTexts] = useState<{ [key: string]: string }>({});
  const [openPrayerText, setOpenPrayerText] = useState('');
  const [openPrayerTrackAnswered, setOpenPrayerTrackAnswered] = useState(true);
  const [supplicationTrackAnswered, setSupplicationTrackAnswered] = useState(true);
  const [castOpening, setCastOpening] = useState('Heavenly Father,');
  const [castClosing, setCastClosing] = useState('In Jesus\' Name,\nAmen');
  const [existingPrayerIds, setExistingPrayerIds] = useState<{ [key: string]: string }>({});
  const editLoaded = useRef(false);
  const saveInFlight = useRef(false);
  const saveCompleted = useRef(false);
  const savedPrayerIds = useRef<Record<string, string>>({});
  const prayerSessionId = useRef(`prayer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const hasAppliedInitialPrayerType = useRef(false);

  const dateStr = toLocalDateString(selectedDate);
  const createMutation = useCreatePrayer();
  const updateMutation = useUpdatePrayer();
  const deletePrayerMutation = useDeletePrayer();
  const markSupplicationAnsweredMutation = useMarkSupplicationAnswered();
  const { data: prayerEntries = [] } = useACTSPrayerData(user?.id || '', dateStr);
  const draftType = selectedPath?.id === 'acts' || selectedPath?.id === 'open' ? selectedPath.id : null;
  const draftKey = draftType ? getPrayerDraftKey(draftType, dateStr, subtaskId) : null;
  const loadedDraftKey = useRef<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    if (!draftKey || editingPrayerId || fromNotificationAnsweredCheck || loadedDraftKey.current === draftKey) {return;}
    loadedDraftKey.current = draftKey;
    setDraftReady(false);
    getPrayerDraft(draftKey).then((draft) => {
      if (draft?.type === 'acts') {
        setPrayerTexts(draft.data.prayerTexts || {});
        setSupplicationTrackAnswered(draft.data.supplicationTrackAnswered !== false);
        setCurrentStep(draft.data.currentStep || 2);
      } else if (draft?.type === 'open') {
        setOpenPrayerText(draft.data.openPrayerText || '');
        setOpenPrayerTrackAnswered(draft.data.openPrayerTrackAnswered !== false);
        setCurrentStep(draft.data.currentStep || 2);
      }
      setDraftReady(true);
    });
  }, [draftKey, editingPrayerId, fromNotificationAnsweredCheck]);

  useEffect(() => {
    if (!draftKey || !draftType || !draftReady || editingPrayerId || fromNotificationAnsweredCheck) {return;}
    const hasContent = draftType === 'acts'
      ? Object.values(prayerTexts).some((text) => text.trim())
      : !!openPrayerText.trim();
    if (!hasContent) {return;}
    const timeout = setTimeout(() => {
      savePrayerDraft({
        key: draftKey,
        type: draftType,
        selectedDate: dateStr,
        data: { currentStep, prayerTexts, openPrayerText, openPrayerTrackAnswered, supplicationTrackAnswered },
      });
    }, 800);
    return () => clearTimeout(timeout);
  }, [currentStep, dateStr, draftKey, draftReady, draftType, editingPrayerId, fromNotificationAnsweredCheck, openPrayerText, prayerTexts, openPrayerTrackAnswered, supplicationTrackAnswered]);

  const successModal = useSuccessModal(
    () => {
      if (fromPlaybook) {
        // Return to PlaybookWalkthroughScreen and signal step completion
        navigation.pop(2);
        setTimeout(() => {
          DeviceEventEmitter.emit('playbookPrayerSaved', {
            playbookId,
            stepId,
            subtaskId,
            actionStepNumber,
            isEditing: !!editingPrayerId,
          });
        }, 300);
      } else {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'MainTabs' as any,
              params: {
                screen: 'Journal',
                params: {
                  screen: 'JournalMain',
                  params: fromNotificationAnsweredCheck ? {
                    selectedDate: selectedDateStr,
                    targetSection: 'prayer',
                    targetPrayerCarouselIndex: initialPrayerType === 'open' ? 0 : 0,
                    targetPrayerId: editingPrayerId,
                  } : {
                    selectedDate: selectedDateStr,
                  },
                },
              },
            },
          ],
        });
      }
    },
    undefined
  );

  // Pre-select prayer path and load existing data when editing
  useEffect(() => {
    if (initialPrayerType) {
      const path = PRAYER_PATHS.find(p => p.id === initialPrayerType);
      if (path) {
        if (!hasAppliedInitialPrayerType.current) {
          setSelectedPath(path);
          setCurrentStep(showDescription ? 1 : 2);
          hasAppliedInitialPrayerType.current = true;
        }

        // Load existing prayer data if editingPrayerId is provided
        if (editingPrayerId && prayerEntries && !editLoaded.current) {
          const prayerData = prayerEntries as any;

          if (initialPrayerType === 'acts') {
            // Load CAST prayer data
            const allPrayers = [
              ...(prayerData.confession || []),
              ...(prayerData.adoration || []),
              ...(prayerData.thanksgiving || []),
              ...(prayerData.supplication || []),
            ];
            const editingPrayer = allPrayers.find((p: any) => p.id === editingPrayerId);
            if (editingPrayer) {
              const existingSessionId = editingPrayer.metadata?.prayer_session_id;
              const editingTimestamp = new Date(editingPrayer.created_at).getTime();
              const sessionPrayers = existingSessionId
                ? allPrayers.filter((p: any) => p.metadata?.prayer_session_id === existingSessionId)
                : allPrayers.filter((p: any) => Math.abs(new Date(p.created_at).getTime() - editingTimestamp) < 5 * 60 * 1000);
              const texts: { [key: string]: string } = {};
              const ids: { [key: string]: string } = {};
              prayerSessionId.current = existingSessionId || prayerSessionId.current;
              sessionPrayers.sort((a: any, b: any) =>
                (a.updated_at || a.created_at).localeCompare(b.updated_at || b.created_at)
                || a.created_at.localeCompare(b.created_at)
              ).forEach((p: any) => {
                texts[p.journal_category] = p.content;
                ids[p.journal_category] = p.id;
              });
              savedPrayerIds.current = { ...ids };
              editLoaded.current = true;
              setPrayerTexts(texts);
              setExistingPrayerIds(ids);
              setSupplicationTrackAnswered(sessionPrayers.find((p: any) => p.id === ids.supplication)?.metadata?.track_answered !== false);
            }
          } else if (initialPrayerType === 'open') {
            // Load open prayer data
            const openPrayers = prayerData.freeform || [];
            const editingPrayer = openPrayers.find((p: any) => p.id === editingPrayerId);
            if (editingPrayer) {
              savedPrayerIds.current = { freeform: editingPrayer.id };
              editLoaded.current = true;
              setOpenPrayerText(editingPrayer.content);
              setExistingPrayerIds({ freeform: editingPrayer.id });
              setOpenPrayerTrackAnswered(editingPrayer.metadata?.track_answered !== false);
            }
          }
        }
      }
    }
  }, [initialPrayerType, showDescription, editingPrayerId, prayerEntries]);

  // Hide status bar for translucent scrolling effect
  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, 'slide');
      StatusBar.setBarStyle('dark-content');
      return () => {
        StatusBar.setHidden(false, 'slide');
        StatusBar.setBarStyle('dark-content');
      };
    }, [])
  );

  const handleSave = async () => {
    if (saveInFlight.current || saveCompleted.current) return;
    if (editingPrayerId && !editLoaded.current) {
      Alert.alert('Prayer is still loading', 'Please wait for your saved prayer before saving changes.');
      return;
    }
    saveInFlight.current = true;
    try {
      const isEditing = !!editingPrayerId;

      if (selectedPath?.id === 'acts') {
        // Save each ACTS prayer as separate entries
        for (const step of ACTS_STEPS) {
          const text = prayerTexts[step.key];
          const existingId = savedPrayerIds.current[step.key] || existingPrayerIds[step.key];

          if (text && text.trim()) {
            if (existingId) {
              // Update existing prayer
              await updateMutation.mutateAsync({
                id: existingId,
                updates: {
                  content: text.trim(),
                  status: step.key === 'supplication' ? Object.values(prayerEntries).flat().find(p => p.id === existingId)?.status || 'pending' : undefined,
                  metadata: { ...Object.values(prayerEntries).flat().find(p => p.id === existingId)?.metadata, prayer_style: 'cast', prayer_session_id: prayerSessionId.current, track_answered: step.key === 'supplication' ? supplicationTrackAnswered : false },
                },
                _userId: user?.id ?? 'local',
                _dateStr: dateStr,
              });
            } else {
              // Remember successful sections so a retry updates them instead of creating duplicates.
              const created = await createMutation.mutateAsync({
                user_id: user?.id ?? 'local',
                selected_date: dateStr,
                prayer_type: 'journal',
                journal_category: step.key as 'adoration' | 'confession' | 'thanksgiving' | 'supplication',
                content: text.trim(),
                prayed: true,
                prayer_count: 1,
                last_prayed_at: new Date().toISOString(),
                status: step.key === 'supplication' ? 'pending' : undefined,
                metadata: { ...Object.values(prayerEntries).flat().find(p => p.id === existingId)?.metadata, prayer_style: 'cast', prayer_session_id: prayerSessionId.current, track_answered: step.key === 'supplication' ? supplicationTrackAnswered : false },
              });
              savedPrayerIds.current[step.key] = created.id;
            }
          } else if (existingId) {
            // Delete empty prayer if editing
            await deletePrayerMutation.mutateAsync({
              id: existingId,
              _userId: user?.id ?? 'local',
              _dateStr: dateStr,
            });
          }
        }
      } else if (selectedPath?.id === 'open' && openPrayerText.trim()) {
        const existingId = savedPrayerIds.current.freeform || existingPrayerIds.freeform;

        if (existingId) {
          // Update existing open prayer
          await updateMutation.mutateAsync({
            id: existingId,
            updates: {
              content: openPrayerText.trim(),
              status: Object.values(prayerEntries).flat().find(p => p.id === existingId)?.status || 'pending',
              metadata: { ...Object.values(prayerEntries).flat().find(p => p.id === existingId)?.metadata, prayer_style: 'open', track_answered: openPrayerTrackAnswered },
            },
            _userId: user?.id ?? 'local',
            _dateStr: dateStr,
          });
        } else {
          // Create new open prayer
          const created = await createMutation.mutateAsync({
            user_id: user?.id ?? 'local',
            selected_date: dateStr,
            prayer_type: 'journal',
            journal_category: 'personal_prayer',
            content: openPrayerText.trim(),
            prayed: true,
            prayer_count: 1,
            last_prayed_at: new Date().toISOString(),
            status: 'pending',
            metadata: { ...Object.values(prayerEntries).flat().find(p => p.id === existingId)?.metadata, prayer_style: 'open', track_answered: openPrayerTrackAnswered },
          });
          savedPrayerIds.current.freeform = created.id;
        }
      }

      // Invalidate cache to ensure UI updates with new data
      await queryClient.invalidateQueries({ queryKey: ['prayers', 'acts', user?.id ?? 'local', dateStr] });
      await queryClient.invalidateQueries({ queryKey: ['journal', 'all'] });
      if (draftKey) {await clearPrayerDraft(draftKey);}

      // Check if streak celebration should show for prayer journal.
      // Use the correct activity type: ACTS/CAST → prayer_journal_acts, Open → prayer_journal_open.
      // When opened from faithful actions (fromPlaybook), only trigger if the
      // playbook is already completed — not mid-walkthrough.
      const prayerActivityType = selectedPath?.id === 'acts' ? 'prayer_journal_acts' : 'prayer_journal_open';
      const shouldCheckPrayerStreak = !fromPlaybook || playbookStatus === 'completed';
      let navigatedToStreak = false;
      if (shouldCheckPrayerStreak) {
        const shouldShowStreak = await visibleStreakService.shouldShowCelebration(user?.id ?? 'local', prayerActivityType);
        if (shouldShowStreak) {
          await visibleStreakService.markShownToday(user?.id ?? 'local');
          if (fromPlaybook) {
            DeviceEventEmitter.emit('playbookPrayerSaved', {
              playbookId,
              stepId,
              subtaskId,
              actionStepNumber,
              isEditing: !!editingPrayerId,
            });
          }
          (navigation as any).navigate('StreakPlan', {
            userId: user?.id ?? 'local',
            source: prayerActivityType,
            dismissRouteCount: 2,
          });
          navigatedToStreak = true;
        }
      }

      analytics.trackPrayerEvent(isEditing ? 'prayer_updated' : 'prayer_created', {
        prayer_type: selectedPath?.id === 'acts' ? 'supplication' : 'adoration',
        content_length: selectedPath?.id === 'acts'
          ? Object.values(prayerTexts).join('').length
          : openPrayerText.length,
        date: dateStr,
      }, user?.id ?? 'local');

      if (fromPlaybook && !navigatedToStreak) {
        // Show success modal inside this screen; Done handler will pop + emit
        triggerSuccessHaptic();
        successModal.showSuccess({
          title: isEditing ? 'Prayer Updated' : 'Prayer Saved',
          message: isEditing ? 'Your prayer has been updated.' : 'Your prayer has been saved to your journal.',
          showEditButton: false,
        });
      } else if (!navigatedToStreak) {
        triggerSuccessHaptic();
        DeviceEventEmitter.emit('prayerSaved');
        exitPrayerFlow(navigation as any);
      }
      saveCompleted.current = true;
    } catch (error) {
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    } finally {
      saveInFlight.current = false;
    }
  };

  const handleNext = useCallback(() => {
    if (currentStep === 0) {
      if (selectedPath?.id === 'acts') {
        setCurrentStep(1); // Go to CAST description
      } else if (selectedPath?.id === 'open') {
        setCurrentStep(1); // Go to Open prayer description
      }
    } else if (currentStep === 1) {
      if (selectedPath?.id === 'acts') {
        setCurrentStep(2); // Go to ACTS flow
      } else if (selectedPath?.id === 'open') {
        setCurrentStep(2); // Go to Open prayer input
      }
    } else if (currentStep === 2 && selectedPath?.id === 'acts') {
      const hasAnyPrayerText = ACTS_STEPS.some(step => prayerTexts[step.key]?.trim());
      if (!hasAnyPrayerText) {
        return;
      }
      void handleSave();
    } else if (currentStep === 2 && selectedPath?.id === 'open') {
      if (!openPrayerText.trim()) {
        return;
      }
      void handleSave();
    } else {
      navigation.goBack();
    }
  }, [currentStep, selectedPath, prayerTexts, openPrayerText, navigation]);

  const handleMarkAnsweredFromNotification = useCallback(() => {
    if (!user?.id || !editingPrayerId) {
      return;
    }

    if (initialPrayerType === 'acts') {
      markSupplicationAnsweredMutation.mutateAsync({
        id: editingPrayerId,
        isAnswered: true,
        _userId: user?.id ?? 'local',
        _dateStr: dateStr,
      }).catch(() => {
        Alert.alert('Error', 'Failed to mark prayer as answered. Please try again.');
      });
    } else {
      updateMutation.mutateAsync({
        id: editingPrayerId,
        updates: {
          status: 'answered' as const,
          answered_date: new Date().toISOString(),
        },
        _userId: user?.id ?? 'local',
        _dateStr: dateStr,
      }).catch(() => {
        Alert.alert('Error', 'Failed to mark prayer as answered. Please try again.');
      });
    }

    successModal.showSuccess({
      title: 'Prayer Marked Answered',
      message: 'This prayer has been marked as answered in your journal.',
      showEditButton: false,
    });
  }, [user?.id, editingPrayerId, initialPrayerType, markSupplicationAnsweredMutation, updateMutation, dateStr, successModal]);

  const handleBack = useCallback(() => {
    // When coming from PlaybookWalkthroughScreen, go back directly without showing intro steps
    if (fromPlaybook) {
      navigation.goBack();
      return;
    }

    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  }, [currentStep, navigation, fromPlaybook]);

  // Swipe gesture handlers
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (currentStep === 2 && selectedPath?.id === 'acts') {
            return false;
          }

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
            if (currentStep === 0 && !selectedPath) {
              return;
            }
            handleNext();
            triggerMediumHaptic();
          }
        },
      }),
    [currentStep, handleBack, handleNext, screenWidth, selectedPath]
  );

  return (
    <>
    <View style={styles.container} {...panResponder.panHandlers}>
        {currentStep === 0 && (
          <PrayerPathSelectionStep
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
            onNext={handleNext}
            insets={insets}
            navigation={navigation}
            dateContext={dateContext}
          />
        )}

        {currentStep === 1 && selectedPath?.id === 'acts' && (
          <CASTDescriptionStep
            onNext={handleNext}
            onBack={handleBack}
            insets={insets}
            navigation={navigation}
          />
        )}

        {currentStep === 1 && selectedPath?.id === 'open' && (
          <OpenPrayerDescriptionStep
            onNext={handleNext}
            insets={insets}
            navigation={navigation}
          />
        )}

        {currentStep === 2 && selectedPath?.id === 'acts' && (
          <ACTSPrayerSlidesStep
            prayerTexts={prayerTexts}
            onChange={(key: string, text: string) => {
              setPrayerTexts(prev => ({ ...prev, [key]: text }));
            }}
            onNext={fromNotificationAnsweredCheck ? handleMarkAnsweredFromNotification : handleNext}
            onBack={handleBack}
            insets={insets}
            navigation={navigation}
            castOpening={castOpening}
            castClosing={castClosing}
            playbookTitle={playbookTitle}
            actionStepNumber={actionStepNumber}
            actionStepTitle={actionStepTitle}
            stepBody={stepBody}
            stepExample={stepExample}
            readOnly={fromNotificationAnsweredCheck}
            actionLabel={fromNotificationAnsweredCheck ? 'Mark Answered' : undefined}
            initialActsStepIndex={fromNotificationAnsweredCheck ? 2 : 0}
          />
        )}

        {currentStep === 2 && selectedPath?.id === 'open' && (
          <OpenPrayerStep
            prayerText={openPrayerText}
            onChange={setOpenPrayerText}
            onNext={fromNotificationAnsweredCheck ? handleMarkAnsweredFromNotification : handleNext}
            insets={insets}
            navigation={navigation}
            playbookTitle={playbookTitle}
            actionStepNumber={actionStepNumber}
            actionStepTitle={actionStepTitle}
            stepBody={stepBody}
            stepExample={stepExample}
            readOnly={fromNotificationAnsweredCheck}
            actionLabel={fromNotificationAnsweredCheck ? 'Mark Answered' : undefined}
          />
        )}

        {currentStep === 3 && selectedPath && (
          <CompletionStep
            prayerPath={selectedPath}
            prayerTexts={prayerTexts}
            openPrayerText={openPrayerText}
            onDone={handleSave}
            insets={insets}
            onSupplicationTrackingChange={setSupplicationTrackAnswered}
            onOpenTrackingChange={setOpenPrayerTrackAnswered}
            supplicationTrackAnswered={supplicationTrackAnswered}
            openPrayerTrackAnswered={openPrayerTrackAnswered}
            isEditing={!!editingPrayerId}
            castOpening={castOpening}
            castClosing={castClosing}
            onCastOpeningChange={setCastOpening}
            onCastClosingChange={setCastClosing}
          />
        )}
        <NewSuccessModal
          visible={successModal.isVisible}
          config={successModal.config}
          onDone={successModal.handleDone}
          onEdit={successModal.handleEdit}
        />
      </View>
    </>
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
    color: Colors.text,
  },
  labelIcon: {
    marginTop: 1,
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 24,
    paddingHorizontal: 8,
  },
  verticalLineContainer: {
    alignItems: 'center',
    paddingTop: 4,
  },
  verticalLine: {
    width: 2,
    height: 40,
    backgroundColor: Colors.sage,
    borderRadius: 1,
  },
  metadataContent: {
    flex: 1,
    gap: 4,
  },
  metadataLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.sage,
    textTransform: 'uppercase',
  },
  metadataText: {
    fontSize: 14,
    color: Colors.textGray,
    lineHeight: 20,
    textAlign: 'left',
  },
  metadataTitle: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 2,
  },
  metadataDescription: {
    fontSize: 13,
    color: Colors.textGray,
    lineHeight: 18,
    marginTop: 2,
  },
  pathsGrid: {
    gap: 16,
  },
  categoryCard: {
    width: '100%',
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    minHeight: 80,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  categoryCardSelected: {
    backgroundColor: Colors.actionBackground,
    borderColor: Colors.sage,
  },
  categoryIconContainer: {
    marginBottom: 8,
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.actionBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconCircleSelected: {
    backgroundColor: Colors.sage,
  },
  categoryName: {
    fontSize: 18,
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  categoryNameSelected: {
    color: Colors.text,
  },
  categoryDescription: {
    fontSize: 15,
    color: Colors.textGray,
    lineHeight: 20,
    textAlign: 'center',
  },
  categoryDescriptionSelected: {
    color: Colors.text,
  },
  categoriesGrid: {
    gap: 12,
  },
  actsStepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  actsStepLabel: {
    fontSize: 12,
    letterSpacing: 2,
    color: Colors.sage,
  },
  actsStepNumber: {
    fontSize: 13,
    color: Colors.textGray,
  },
  personalInput: {
    fontFamily: Fonts.regular,
    color: Colors.text,
    fontSize: 18,
    paddingTop: 16,
    paddingBottom: 16,
    minHeight: 200,
    textAlignVertical: 'top',
    lineHeight: 24,
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
    borderRadius: 20,
  },
  primaryButtonInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.sage,
    borderRadius: 20,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  finishButton: {
    marginTop: 32,
    justifyContent: 'center',
  },
  primaryButtonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    marginTop: 'auto',
  },
  primaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
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
    height: 50,
  },
  completionButtonText: {
    fontSize: 16,
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
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.text,
  },
  actionCounter: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
    textAlign: 'center' as const,
  },
  actionProgressBar: {
    height: 6,
    width: 120,
    backgroundColor: Colors.cardBackground,
    borderRadius: 3,
    marginBottom: 24,
    overflow: 'hidden' as const,
    alignSelf: 'center' as const,
  },
  actionProgressFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 2,
  },
  actsCard: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  actsCardHeader: {
    marginBottom: 16,
  },
  actsCardTitle: {
    fontSize: 17,
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  suggestedTextContainer: {
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  suggestedText: {
    fontSize: 15,
    color: Colors.textGray,
    fontStyle: 'italic',
  },
  actsCardDescription: {
    fontSize: 14,
    color: Colors.textGray,
    lineHeight: 20,
  },
  prayerStepsContainer: {
    marginTop: 24,
    gap: 16,
  },
  prayerStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  prayerStepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.actionBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  prayerStepContent: {
    flex: 1,
  },
  prayerStepLabel: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 4,
  },
  prayerStepDescription: {
    fontSize: 13,
    color: Colors.textGray,
    lineHeight: 18,
  },
  timelineContainer: {
    marginTop: 8,
    paddingLeft: 20,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 27,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.actionBackground,
    borderRadius: 1,
  },
  timelineThickBar: {
    position: 'absolute',
    left: 32,
    top: 0,
    width: 5,
    backgroundColor: Colors.sage,
    borderRadius: 2.5,
  },
  timelineThickBarPad: {
    height: 300,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    position: 'relative',
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.sage,
    borderWidth: 2,
    borderColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
    zIndex: 1,
  },
  timelineNumber: {
    fontSize: 12,
    color: Colors.hopeWhite,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  timelineContentContainer: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
    marginLeft: 0,
  },
  timelineLabel: {
    fontSize: 18,
    color: Colors.text,
    marginBottom: 6,
  },
  timelineDescription: {
    fontSize: 14,
    color: Colors.textGray,
    lineHeight: 20,
  },
  completionCard: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
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
    backgroundColor: Colors.actionBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionHeaderContent: {
    flex: 1,
    marginLeft: 16,
  },
  completionCategory: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  completionSubtext: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 2,
  },
  completionCheckmark: {
    marginLeft: 12,
  },
  completionSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  completionSectionLabel: {
    fontSize: 12,
    color: Colors.textGray,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  completionSectionText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  completionInput: {
    color: Colors.text,
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
  },
  completionSectionSmall: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
    marginTop: 8,
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackingBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.actionBackground,
    alignSelf: 'flex-start',
  },
  trackingBadgeText: {
    fontSize: 14,
    color: Colors.sage,
    fontWeight: '600',
  },
  trackingFloatingButton: {
    position: 'absolute',
    right: 65,
    height: 40,
    alignSelf: 'flex-start',
    borderRadius: 20,
  },
  trackingFloatingButtonInner: {
    borderRadius: 20,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  markAnsweredButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  markAnsweredButtonText: {
    fontSize: 12,
    color: '#B99562',
  },
  trackAnsweredToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 12,
  },
  trackAnsweredCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trackAnsweredCheckboxChecked: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  trackAnsweredText: {
    fontSize: 15,
    color: Colors.text,
  },
});

export default withErrorBoundary(PrayerJournalWalkthroughScreen, 'PrayerJournalWalkthroughScreen');

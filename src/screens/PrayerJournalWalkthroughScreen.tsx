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
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../utils/date';
import { useCreatePrayer, useUpdatePrayer, useACTSPrayerData, useDeletePrayer } from '../services/hooks/usePrayerData';
import { analytics } from '../utils/analytics';
import { isToday, isYesterday, startOfDay } from 'date-fns';
import PlaybookMetaSection from '../components/journal/PlaybookMetaSection';

import type { RootStackParamList } from '../navigation/types';

type DateContext = 'today' | 'yesterday' | 'earlier';

// Helper to compute date context from selected date
const getDateContext = (selectedDate: Date): DateContext => {
  const day = startOfDay(selectedDate);

  if (isToday(day)) {return 'today';}
  if (isYesterday(day)) {return 'yesterday';}
  return 'earlier';
};

type Props = NativeStackScreenProps<RootStackParamList, 'PrayerJournalWalkthrough'>;

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
      case 'today': return 'Which prayer path\ndo you want today?';
      case 'yesterday': return 'Which prayer path\ndid you want yesterday?';
      case 'earlier': return 'Which prayer path\ndid you want on this day?';
    }
  };

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
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
                      color={isSelected ? Colors.hopeWhite : Colors.alertCoral}
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

        <StepFadeIn delay={240}>
          <View style={styles.metadataContainer}>
            <View style={styles.metadataContent}>
              <ThemedText style={styles.metadataText}>
                Choose a structure if it helps, or pray openly.
              </ThemedText>
            </View>
          </View>
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
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
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
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
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
            <ThemedText weight="semiBold" style={[styles.focusLabel, { color: Colors.alertCoral }]}>PRAYER FLOW</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={160}>
          <View style={styles.timelineContainer}>
            <Animated.View style={[
              styles.timelineThickBar,
              { height: timelineHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 380],
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

      <View style={[styles.completionButtonContainer, { bottom: insets.bottom + 20 }]}>
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
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
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
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
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
            <ThemedText weight="semiBold" style={[styles.focusLabel, { color: Colors.alertCoral }]}>PRAYER FLOW</ThemedText>
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

      <View style={[styles.completionButtonContainer, { bottom: insets.bottom + 20 }]}>
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
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
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
  supplicationTrackAnswered: boolean;
  onSupplicationTrackAnsweredChange: (value: boolean) => void;
  castOpening: string;
  castClosing: string;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  stepBody?: string;
  stepExample?: string | null;
}> = ({
  prayerTexts,
  onChange,
  onNext,
  onBack,
  insets,
  navigation,
  supplicationTrackAnswered,
  onSupplicationTrackAnsweredChange,
  castOpening,
  castClosing,
  playbookTitle,
  actionStepNumber,
  actionStepTitle,
  stepBody,
  stepExample,
}) => {
  const [actsStepIndex, setActsStepIndex] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const buttonPosition = useRef(new Animated.Value(insets.bottom + 20)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const cardTranslateY = useRef(new Animated.Value(0)).current;
  const trackingOpacity = useRef(new Animated.Value(0)).current;
  const trackingScale = useRef(new Animated.Value(0.8)).current;

  const currentStep = ACTS_STEPS[actsStepIndex];
  const isLastStep = actsStepIndex >= ACTS_STEPS.length - 1;

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

  useEffect(() => {
    const shouldShowTracking = currentStep.key === 'supplication' && prayerTexts[currentStep.key]?.trim();

    if (shouldShowTracking) {
      Animated.parallel([
        Animated.timing(trackingOpacity, {
          toValue: 1,
          duration: 300,
          delay: 100,
          useNativeDriver: true,
        }),
        Animated.spring(trackingScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(trackingOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(trackingScale, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [currentStep.key, prayerTexts, trackingOpacity, trackingScale]);

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

    // Animate tracking button out if on supplication step
    if (currentStep.key === 'supplication') {
      Animated.parallel([
        Animated.timing(trackingOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(trackingScale, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        animateToNext(() => {
          setActsStepIndex(prev => prev + 1);
        });
      });
    } else {
      animateToNext(() => {
        setActsStepIndex(prev => prev + 1);
      });
    }
  }, [isLastStep, onNext, animateToNext, currentStep.key, trackingOpacity, trackingScale]);

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
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            CAST PRAYER
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <ThemedText style={styles.actionCounter}>
            {actsStepIndex + 1} of {ACTS_STEPS.length}
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={100}>
          <View style={styles.actionProgressBar}>
            <View style={[
              styles.actionProgressFill,
              { width: `${((actsStepIndex + 1) / ACTS_STEPS.length) * 100}%` },
            ]} />
          </View>
        </StepFadeIn>

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
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                multiline
                textAlignVertical="top"
                autoFocus
                keyboardAppearance="dark"
              />

              {/* Display metadata below input field for all ACTS steps */}
              {playbookTitle && (
                <PlaybookMetaSection
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

      <Animated.View style={[
        styles.trackingFloatingButton,
        { bottom: buttonPosition },
      ]}>
        <Animated.View style={[
          styles.trackingFloatingButtonInner,
          {
            opacity: trackingOpacity,
            transform: [{ scale: trackingScale }],
          },
        ]}>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              onSupplicationTrackAnsweredChange(!supplicationTrackAnswered);
            }}
            activeOpacity={0.7}
            style={{ paddingHorizontal: 6, height: 40, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: -4 }}
          >
            <View style={[styles.trackAnsweredCheckbox, supplicationTrackAnswered && styles.trackAnsweredCheckboxChecked]}>
              {supplicationTrackAnswered && <Ionicons name="checkmark" size={14} color={Colors.hopeWhite} />}
            </View>
            <ThemedText style={[styles.trackAnsweredText, { marginLeft: -8 }]}>
              Track if answered
            </ThemedText>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[
        styles.primaryButton,
        { bottom: buttonPosition },
      ]}>
        <Animated.View style={[
          styles.primaryButtonInner,
          { opacity: prayerTexts[currentStep.key]?.trim() ? 1 : 0 },
        ]}>
          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.7}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-forward" size={20} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

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

// Step 3: Open Prayer
const OpenPrayerStep: React.FC<{
  prayerText: string;
  onChange: (text: string) => void;
  onNext: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  trackAnswered: boolean;
  onTrackAnsweredChange: (value: boolean) => void;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  stepBody?: string;
  stepExample?: string | null;
}> = ({ prayerText, onChange, onNext, insets, navigation, trackAnswered, onTrackAnsweredChange, playbookTitle, actionStepNumber, actionStepTitle, stepBody, stepExample }) => {
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;
  const trackingOpacity = React.useRef(new Animated.Value(0)).current;
  const trackingScale = React.useRef(new Animated.Value(0.8)).current;

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

  React.useEffect(() => {
    const hasText = !!prayerText?.trim();
    if (hasText) {
      Animated.parallel([
        Animated.timing(trackingOpacity, {
          toValue: 1,
          duration: 300,
          delay: 100,
          useNativeDriver: true,
        }),
        Animated.spring(trackingScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(trackingOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(trackingScale, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [prayerText, trackingOpacity, trackingScale]);

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0} style={[styles.stepLabelRow, { justifyContent: 'flex-start', paddingHorizontal: 24 }]}>
          <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} />
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
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              multiline
              textAlignVertical="top"
              autoFocus
              keyboardAppearance="dark"
            />

            {/* Display metadata below input field */}
            {playbookTitle && (
              <PlaybookMetaSection
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

      <Animated.View style={[styles.trackingFloatingButton, { bottom: buttonPosition }]}>
        <Animated.View style={[
          styles.trackingFloatingButtonInner,
          { opacity: trackingOpacity, transform: [{ scale: trackingScale }] },
        ]}>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              onTrackAnsweredChange(!trackAnswered);
            }}
            activeOpacity={0.7}
            style={{ paddingHorizontal: 6, height: 40, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: -4 }}
          >
            <View style={[styles.trackAnsweredCheckbox, trackAnswered && styles.trackAnsweredCheckboxChecked]}>
              {trackAnswered && <Ionicons name="checkmark" size={14} color={Colors.hopeWhite} />}
            </View>
            <ThemedText style={[styles.trackAnsweredText, { marginLeft: -8 }]}>
              Track if answered
            </ThemedText>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

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

// Step 4: Completion Screen
const CompletionStep: React.FC<{
  prayerPath: PrayerPath;
  prayerTexts: { [key: string]: string };
  openPrayerText: string;
  onDone: () => void;
  insets: { top: number; bottom: number };
  supplicationTrackAnswered: boolean;
  openPrayerTrackAnswered: boolean;
  isEditing?: boolean;
  castOpening: string;
  castClosing: string;
  onCastOpeningChange: (value: string) => void;
  onCastClosingChange: (value: string) => void;
}> = ({ prayerPath, prayerTexts, openPrayerText, onDone, insets, supplicationTrackAnswered, openPrayerTrackAnswered, isEditing = false, castOpening, castClosing, onCastOpeningChange, onCastClosingChange }) => {
  const theme = useTheme();
  const checkmarkScale = React.useRef(new Animated.Value(0)).current;
  const iconScale = React.useRef(new Animated.Value(0)).current;
  const iconRotation = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(checkmarkScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      delay: 400,
      useNativeDriver: true,
    }).start();

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
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            keyboardAppearance="dark"
          />
        </View>

        {validSteps.map((step, index) => {
          const text = prayerTexts[step.key];
          const isLast = index === validSteps.length - 1;

          return (
            <View key={step.key} style={[styles.completionSection, isLast && { borderBottomWidth: 0 }]}>
              <ThemedText weight="medium" style={styles.completionSectionLabel}>{step.label}</ThemedText>
              <ThemedText style={styles.completionSectionText}>{text}</ThemedText>
              {step.key === 'supplication' && supplicationTrackAnswered && (
                <View style={[styles.completionSection, styles.completionSectionSmall]}>
                  <View style={styles.trackingRow}>
                    <ThemedText weight="medium" style={styles.completionSectionLabel}>TRACKING</ThemedText>
                    <View style={styles.trackingBadgeContainer}>
                      <Ionicons name="notifications-outline" size={16} color={Colors.alertCoral} />
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
            placeholder="e.g., In Jesus' Name, Amen"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            keyboardAppearance="dark"
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
        {openPrayerTrackAnswered && (
          <View style={[styles.completionSection, styles.completionSectionSmall]}>
            <View style={styles.trackingRow}>
              <ThemedText weight="medium" style={styles.completionSectionLabel}>TRACKING</ThemedText>
              <View style={styles.trackingBadgeContainer}>
                <Ionicons name="notifications-outline" size={16} color={Colors.alertCoral} />
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
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <MaterialCommunityIcons name="hands-pray" size={18} color={Colors.alertCoral} />
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
              <MaterialCommunityIcons name="hands-pray" size={24} color={Colors.alertCoral} />
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
  const { selectedDate: selectedDateStr, initialPrayerType, editingPrayerId, subtaskId, stepId, playbookId, playbookTitle, actionStepNumber, actionStepTitle, stepBody, stepExample, fromPlaybook } = route.params || {};
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
  const [castClosing, setCastClosing] = useState('In Jesus\' Name, Amen');
  const [existingPrayerIds, setExistingPrayerIds] = useState<{ [key: string]: string }>({});
  const hasAppliedInitialPrayerType = useRef(false);

  const dateStr = toLocalDateString(selectedDate);
  const createMutation = useCreatePrayer();
  const updateMutation = useUpdatePrayer();
  const deletePrayerMutation = useDeletePrayer();
  const { data: prayerEntries = [] } = useACTSPrayerData(user?.id || '', dateStr);

  // Pre-select prayer path and load existing data when editing
  useEffect(() => {
    if (initialPrayerType) {
      const path = PRAYER_PATHS.find(p => p.id === initialPrayerType);
      if (path) {
        if (!hasAppliedInitialPrayerType.current) {
          setSelectedPath(path);
          // Skip to step 2 (prayer entry) for both CAST and open prayer
          setCurrentStep(2);
          hasAppliedInitialPrayerType.current = true;
        }

        // Load existing prayer data if editingPrayerId is provided
        if (editingPrayerId && prayerEntries) {
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
              const texts: { [key: string]: string } = {};
              const ids: { [key: string]: string } = {};
              allPrayers.forEach((p: any) => {
                texts[p.journal_category] = p.content;
                ids[p.journal_category] = p.id;
                if (p.journal_category === 'supplication' && p.metadata?.track_answered) {
                  setSupplicationTrackAnswered(true);
                }
              });
              setPrayerTexts(texts);
              setExistingPrayerIds(ids);
            }
          } else if (initialPrayerType === 'open') {
            // Load open prayer data
            const openPrayers = prayerData.freeform || [];
            const editingPrayer = openPrayers.find((p: any) => p.id === editingPrayerId);
            if (editingPrayer) {
              setOpenPrayerText(editingPrayer.content);
              setExistingPrayerIds({ freeform: editingPrayer.id });
              if (editingPrayer.metadata?.track_answered) {
                setOpenPrayerTrackAnswered(true);
              }
            }
          }
        }
      }
    }
  }, [initialPrayerType, editingPrayerId, prayerEntries]);

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
      Alert.alert('Error', 'You must be logged in to save your prayer.');
      return;
    }

    try {
      const isEditing = !!editingPrayerId;

      if (selectedPath?.id === 'acts') {
        // Save each ACTS prayer as separate entries
        for (const step of ACTS_STEPS) {
          const text = prayerTexts[step.key];
          const existingId = existingPrayerIds[step.key];

          if (text && text.trim()) {
            if (isEditing && existingId) {
              // Update existing prayer
              await updateMutation.mutateAsync({
                id: existingId,
                updates: {
                  content: text.trim(),
                  status: step.key === 'supplication' && supplicationTrackAnswered ? 'pending' : undefined,
                  metadata: step.key === 'supplication' ? { track_answered: supplicationTrackAnswered } : undefined,
                },
                _userId: user.id,
                _dateStr: dateStr,
              });
            } else {
              // Create new prayer
              await createMutation.mutateAsync({
                user_id: user.id,
                selected_date: dateStr,
                prayer_type: 'journal',
                journal_category: step.key as 'adoration' | 'confession' | 'thanksgiving' | 'supplication',
                content: text.trim(),
                status: step.key === 'supplication' && supplicationTrackAnswered ? 'pending' : undefined,
                metadata: step.key === 'supplication' ? { track_answered: supplicationTrackAnswered } : undefined,
              });
            }
          } else if (isEditing && existingId) {
            // Delete empty prayer if editing
            await deletePrayerMutation.mutateAsync({
              id: existingId,
              _userId: user.id,
              _dateStr: dateStr,
            });
          }
        }
      } else if (selectedPath?.id === 'open' && openPrayerText.trim()) {
        const existingId = existingPrayerIds.freeform;

        if (isEditing && existingId) {
          // Update existing open prayer
          await updateMutation.mutateAsync({
            id: existingId,
            updates: {
              content: openPrayerText.trim(),
              status: openPrayerTrackAnswered ? 'pending' : undefined,
              metadata: { track_answered: openPrayerTrackAnswered },
            },
            _userId: user.id,
            _dateStr: dateStr,
          });
        } else {
          // Create new open prayer
          await createMutation.mutateAsync({
            user_id: user.id,
            selected_date: dateStr,
            prayer_type: 'journal',
            journal_category: 'personal_prayer',
            content: openPrayerText.trim(),
            status: openPrayerTrackAnswered ? 'pending' : undefined,
            metadata: { track_answered: openPrayerTrackAnswered },
          });
        }
      }

      // Invalidate cache to ensure UI updates with new data
      await queryClient.invalidateQueries({ queryKey: ['prayers', 'acts', user.id, dateStr] });
      await queryClient.invalidateQueries({ queryKey: ['journal', 'all'] });

      analytics.trackPrayerEvent(isEditing ? 'prayer_updated' : 'prayer_created', {
        prayer_type: selectedPath?.id === 'acts' ? 'supplication' : 'adoration',
        content_length: selectedPath?.id === 'acts'
          ? Object.values(prayerTexts).join('').length
          : openPrayerText.length,
        date: dateStr,
      }, user.id);

      if (fromPlaybook) {
        navigation.pop(2);
        setTimeout(() => {
          DeviceEventEmitter.emit('playbookPrayerSaved', {
            playbookId,
            stepId,
            subtaskId,
            actionStepNumber,
            isEditing,
          });
        }, 300);
      } else {
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
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
      setCurrentStep(3); // Go to completion (handled by ACTSPrayerSlidesStep)
    } else if (currentStep === 2 && selectedPath?.id === 'open') {
      if (!openPrayerText.trim()) {
        return;
      }
      setCurrentStep(3); // Go to completion for open prayer
    } else {
      navigation.goBack();
    }
  }, [currentStep, selectedPath, prayerTexts, openPrayerText, navigation]);

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
            onNext={handleNext}
            onBack={handleBack}
            insets={insets}
            navigation={navigation}
            supplicationTrackAnswered={supplicationTrackAnswered}
            onSupplicationTrackAnsweredChange={setSupplicationTrackAnswered}
            castOpening={castOpening}
            castClosing={castClosing}
            playbookTitle={playbookTitle}
            actionStepNumber={actionStepNumber}
            actionStepTitle={actionStepTitle}
            stepBody={stepBody}
            stepExample={stepExample}
          />
        )}

        {currentStep === 2 && selectedPath?.id === 'open' && (
          <OpenPrayerStep
            prayerText={openPrayerText}
            onChange={setOpenPrayerText}
            onNext={handleNext}
            insets={insets}
            navigation={navigation}
            trackAnswered={openPrayerTrackAnswered}
            onTrackAnsweredChange={setOpenPrayerTrackAnswered}
            playbookTitle={playbookTitle}
            actionStepNumber={actionStepNumber}
            actionStepTitle={actionStepTitle}
            stepBody={stepBody}
            stepExample={stepExample}
          />
        )}

        {currentStep === 3 && selectedPath && (
          <CompletionStep
            prayerPath={selectedPath}
            prayerTexts={prayerTexts}
            openPrayerText={openPrayerText}
            onDone={handleSave}
            insets={insets}
            supplicationTrackAnswered={supplicationTrackAnswered}
            openPrayerTrackAnswered={openPrayerTrackAnswered}
            isEditing={!!editingPrayerId}
            castOpening={castOpening}
            castClosing={castClosing}
            onCastOpeningChange={setCastOpening}
            onCastClosingChange={setCastClosing}
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
    color: Colors.hopeWhite,
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
    backgroundColor: Colors.alertCoral,
    borderRadius: 1,
  },
  metadataContent: {
    flex: 1,
    gap: 4,
  },
  metadataLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.alertCoral,
    textTransform: 'uppercase',
  },
  metadataText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    textAlign: 'left',
  },
  metadataTitle: {
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 20,
    marginBottom: 2,
  },
  metadataDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 18,
    marginTop: 2,
  },
  pathsGrid: {
    gap: 16,
  },
  categoryCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    minHeight: 80,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardSelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.18)',
    borderColor: Colors.alertCoral,
  },
  categoryIconContainer: {
    marginBottom: 8,
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.anchorBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconCircleSelected: {
    backgroundColor: Colors.alertCoral,
  },
  categoryName: {
    fontSize: 18,
    color: Colors.hopeWhite,
    marginBottom: 6,
    textAlign: 'center',
  },
  categoryNameSelected: {
    color: Colors.hopeWhite,
  },
  categoryDescription: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    textAlign: 'center',
  },
  categoryDescriptionSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
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
    color: Colors.alertCoral,
  },
  actsStepNumber: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  personalInput: {
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
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
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
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
    backgroundColor: Colors.alertCoral,
    borderRadius: 20,
    shadowColor: '#000',
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
    backgroundColor: Colors.alertCoral,
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
    color: Colors.hopeWhite,
  },
  actionCounter: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
    textAlign: 'center' as const,
  },
  actionProgressBar: {
    height: 6,
    width: 120,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    color: Colors.hopeWhite,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  suggestedTextContainer: {
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  suggestedText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
  },
  actsCardDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  prayerStepsContainer: {
    marginTop: 24,
    gap: 16,
  },
  prayerStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  prayerStepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  prayerStepContent: {
    flex: 1,
  },
  prayerStepLabel: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  prayerStepDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
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
    backgroundColor: 'rgba(255, 107, 107, 0.3)',
    borderRadius: 1,
  },
  timelineThickBar: {
    position: 'absolute',
    left: 32,
    top: 0,
    width: 5,
    backgroundColor: Colors.alertCoral,
    borderRadius: 2.5,
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
    backgroundColor: Colors.alertCoral,
    borderWidth: 2,
    borderColor: Colors.alertCoral,
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    marginLeft: 0,
  },
  timelineLabel: {
    fontSize: 18,
    color: Colors.hopeWhite,
    marginBottom: 6,
  },
  timelineDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 20,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionHeaderContent: {
    flex: 1,
    marginLeft: 16,
  },
  completionCategory: {
    fontSize: 16,
    color: Colors.hopeWhite,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  completionSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  completionCheckmark: {
    marginLeft: 12,
  },
  completionSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  completionSectionLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  completionSectionText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  completionInput: {
    color: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    alignSelf: 'flex-start',
  },
  trackingBadgeText: {
    fontSize: 14,
    color: Colors.alertCoral,
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    color: '#FF9500',
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
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trackAnsweredCheckboxChecked: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
  },
  trackAnsweredText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default withErrorBoundary(PrayerJournalWalkthroughScreen, 'PrayerJournalWalkthroughScreen');

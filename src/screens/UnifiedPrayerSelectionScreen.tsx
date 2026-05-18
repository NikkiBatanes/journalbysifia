import * as React from 'react';
import { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors } from '../theme/colors';
import ThemedText from '../components/common/ThemedText';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';

import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'UnifiedPrayerSelection'>;

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
  {
    id: 'pray-for-someone',
    name: 'Pray for Someone',
    description: 'You feel nudged to pray for someone on your own.',
    icon: 'heart',
  },
];

// Helper to compute date context from selected date
const getDateContext = (selectedDate?: string): 'today' | 'yesterday' | 'earlier' => {
  if (!selectedDate) {
    return 'today';
  }
  const date = new Date(selectedDate);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  if (isSameDay(date, today)) {
    return 'today';
  }
  if (isSameDay(date, yesterday)) {
    return 'yesterday';
  }
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

  React.useEffect(() => {
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

// CAST Prayer Description Step
const CASTDescriptionStep: React.FC<{
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
              IS_IPAD && styles.timelineThickBarPad,
              { height: timelineHeight.interpolate({
                inputRange: [0, 1],
                outputRange: IS_IPAD ? [0, 280] : [0, 380],
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
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Open Prayer Description Step
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
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const UnifiedPrayerSelectionScreen: React.FC<Props> = ({ route, navigation }) => {
  const { metadata, fromPlaybook } = route.params || {};
  const insets = useSafeAreaInsets();
  const buttonScale = React.useRef(new Animated.Value(0)).current;

  const dateContext = getDateContext(metadata?.selectedDate);

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPath, setSelectedPath] = useState<PrayerPath | null>(null);

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

  const handleSelect = (path: PrayerPath) => {
    setSelectedPath(path);
  };

  const handleNext = useCallback(() => {
    if (!selectedPath) {
      return;
    }

    triggerMediumHaptic();

    // Show description step for CAST and Open Prayer, direct navigation for Pray for Someone
    if (currentStep === 0) {
      if (selectedPath.id === 'pray-for-someone') {
        // Direct navigation for Pray for Someone
        navigation.navigate('PrayersForPeopleWalkthrough', {
          selectedDate: metadata?.selectedDate,
          initialPrayerType: 'pray-for-someone',
          subtaskTitle: metadata?.subtaskTitle,
          subtaskId: metadata?.subtaskId,
          stepId: metadata?.stepId,
          playbookId: metadata?.playbookId,
          playbookTitle: metadata?.playbookTitle,
          playbookStatus: metadata?.playbookStatus,
          actionStepNumber: metadata?.actionStepNumber,
          actionStepTitle: metadata?.actionStepTitle,
          stepBody: metadata?.stepBody,
          stepExample: metadata?.stepExample,
          fromPlaybook,
        });
      } else {
        // Show description step for CAST and Open Prayer
        setCurrentStep(1);
      }
    } else {
      // Navigate to appropriate walkthrough from description step
      switch (selectedPath.id) {
        case 'acts':
          navigation.navigate('PrayerJournalWalkthrough', {
            selectedDate: metadata?.selectedDate,
            initialPrayerType: 'acts',
            subtaskTitle: metadata?.subtaskTitle,
            subtaskId: metadata?.subtaskId,
            stepId: metadata?.stepId,
            playbookId: metadata?.playbookId,
            playbookTitle: metadata?.playbookTitle,
            playbookStatus: metadata?.playbookStatus,
            actionStepNumber: metadata?.actionStepNumber,
            actionStepTitle: metadata?.actionStepTitle,
            stepBody: metadata?.stepBody,
            stepExample: metadata?.stepExample,
            fromPlaybook,
          });
          break;
        case 'open':
          navigation.navigate('PrayerJournalWalkthrough', {
            selectedDate: metadata?.selectedDate,
            initialPrayerType: 'open',
            subtaskTitle: metadata?.subtaskTitle,
            subtaskId: metadata?.subtaskId,
            stepId: metadata?.stepId,
            playbookId: metadata?.playbookId,
            playbookTitle: metadata?.playbookTitle,
            playbookStatus: metadata?.playbookStatus,
            actionStepNumber: metadata?.actionStepNumber,
            actionStepTitle: metadata?.actionStepTitle,
            stepBody: metadata?.stepBody,
            stepExample: metadata?.stepExample,
            fromPlaybook,
          });
          break;
      }
    }
  }, [selectedPath, metadata, navigation, currentStep, fromPlaybook]);

  const handleBack = useCallback(() => {
    triggerLightHaptic();
    if (currentStep === 1) {
      setCurrentStep(0);
    } else {
      navigation.goBack();
    }
  }, [navigation, currentStep]);

  // Swipe gesture handlers
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

  // Dynamic labels based on date context
  const getTitle = () => {
    switch (dateContext) {
      case 'today': return 'Which prayer path\ndo you want today?';
      case 'yesterday': return 'Which prayer path\ndid you want yesterday?';
      case 'earlier': return 'Which prayer path\ndid you want on this day?';
    }
  };

  return (
    <View style={styles.stepContainer} {...panResponder.panHandlers}>
      {currentStep === 0 && (
        <ScrollView
          style={styles.stepScroll}
          contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 30 }]}
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
            {PRAYER_PATHS.map((path, index) => {
              const isSelected = selectedPath?.id === path.id;
              return (
                <React.Fragment key={path.id}>
                  <TouchableOpacity
                    style={[styles.categoryCard, IS_IPAD && styles.categoryCardPad, isSelected && styles.categoryCardSelected]}
                    onPress={() => {
                      triggerLightHaptic();
                      handleSelect(path);
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
                  {index === 1 && (
                    <View style={styles.orDivider}>
                      <View style={styles.orDividerLine} />
                      <ThemedText style={styles.orDividerText}>OR</ThemedText>
                      <View style={styles.orDividerLine} />
                    </View>
                  )}
                </React.Fragment>
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
      )}

      {currentStep === 1 && selectedPath?.id === 'acts' && (
        <CASTDescriptionStep
          onNext={handleNext}
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

      {currentStep === 0 && (
        <>
          {/* Bottom button */}
          {selectedPath && (
            <Animated.View style={[styles.primaryButton, { bottom: insets.bottom + 20 }]}>
              <Animated.View style={[
                styles.primaryButtonInner,
                { transform: [{ scale: buttonScale }] },
              ]}>
                <TouchableOpacity
                  onPress={handleNext}
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
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  stepContainer: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
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
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 30,
    textAlign: 'center',
  },
  categoriesGrid: {
    gap: 12,
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
  },
  categoryCardPad: {
    maxWidth: '100%',
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
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 24,
    paddingHorizontal: 8,
  },
  metadataContent: {
    flex: 1,
    gap: 4,
  },
  metadataText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    textAlign: 'left',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 8,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  orDividerText: {
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    fontWeight: '300',
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
  stepDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 24,
    marginBottom: 12,
  },
  timelineContainer: {
    marginTop: 8,
    paddingLeft: 20,
    position: 'relative',
  },
  timelineThickBar: {
    position: 'absolute',
    left: 32,
    top: 0,
    width: 5,
    backgroundColor: Colors.alertCoral,
    borderRadius: 2.5,
  },
  timelineThickBarPad: {
    height: 280,
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
    height: 50,
  },
  completionButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
});

export default withErrorBoundary(UnifiedPrayerSelectionScreen, 'UnifiedPrayerSelectionScreen');

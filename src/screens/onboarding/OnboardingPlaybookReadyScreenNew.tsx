import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Animated,
  StatusBar,
  ScrollView,
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import AnimatedRe, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../../theme';
import { Typography } from '../../theme/typography';
import { BorderRadii } from '../../theme/styles';
import { notificationService } from '../../services/notificationService';
import { faithPointsService } from '../../services/faithPointsService';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import { usePlaybookStoreReactQuery } from '../../store/usePlaybookStoreReactQuery';
import AnimatedProgressBar from '../../components/ui/AnimatedProgressBar';

import { ActionStepsProvider, useActionSteps } from '../../context/ActionStepsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
 import { useAuth } from '../../context/IndustryStandardAuthContext';
 import { getPlaybook } from '../../services/apiIntegration';

// Import individual card components for carousel
import TruthInLoveCard from '../../components/TruthInLoveCard';
import ActionStepsCard from '../../components/ActionStepsCard';
// AffirmationCard import removed as it's not used
import BibleVerseCard from '../../components/BibleVerseCard';
import DirectChallengeCard from '../../components/DirectChallengeCard';
import DevotionalModal from '../../components/DevotionalModal';

const { width, height } = Dimensions.get('window');

interface PlaybookCard {
  id: string;
  type: string;
  component: React.ReactElement;
  backgroundColor?: string; // optional override for outer card background
}

// Inner component that can access ActionStepsContext
const PlaybookContent: React.FC<{ playbook: any; challengeCategory: string; specificChallenge: string; userInput: string }> = ({
  playbook, challengeCategory: _challengeCategory, specificChallenge: _specificChallenge, userInput,
}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { getCompletedStepsCount, actionSteps, setActionSteps, saveActionSteps } = useActionSteps(); // Use context for dynamic progress
  const { user } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set(['action']));
  const [dismissedHints, setDismissedHints] = useState<Set<string>>(new Set());
  const [showUserInput, setShowUserInput] = useState(false);
  const [showDevotionalModal, setShowDevotionalModal] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(true);
  const [progressData, setProgressData] = useState({ completed: 0, total: 0, percentage: 0 });
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  // Delayed & persistent devotional CTA visibility
  const [devotionalVisible, setDevotionalVisible] = useState(false);
  const devotionalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Heights for sticky header and fixed footer to vertically center carousel area
  const [headerH, setHeaderH] = useState(0);
  const [footerH, setFooterH] = useState(0);
  const availableHeight = Math.max(0, height - headerH - footerH);
  // Measured intrinsic heights for each card's content
  const [contentHeights, setContentHeights] = useState<Record<string, number>>({});
  // Animation for in-card expand hint (icon-only): stronger pulse + opacity
  const hintPulse = useRef(new Animated.Value(1)).current; // scale
  const hintOpacity = useRef(new Animated.Value(0.6)).current;

  // Read Aloud state for affirmations (consistent with Playbook Detail)
  const hasRead = usePlaybookStoreReactQuery(state => playbook?.id ? !!state.readAloudMap[playbook.id] : false);
  const setReadAloud = usePlaybookStoreReactQuery(state => state.setReadAloud);
  const readCooldownRef = useRef<number>(0);
  const readAwardedRef = useRef<boolean>(false);
  // Particle burst (match dashboard)
  const [particles, setParticles] = useState<{ id: number; progress: Animated.Value; dx: number; dy: number; size: number; rotate: number; color: string; delay: number;}[]>([]);
  const particleIdRef = useRef(0);
  // Timers to coordinate multi-pulse read haptics (match dashboard)
  const readHapticTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startBurst = () => {
    const NUM = 8;
    const colors = [Colors.alertCoral, '#ff7a7a', '#ff9aa2', '#ff6b6b'];
    const newParticles = Array.from({ length: NUM }).map((_, i) => {
      const id = particleIdRef.current++;
      return {
        id,
        progress: new Animated.Value(0),
        dx: (Math.random() * 80 - 40),
        dy: 60 + Math.random() * 60,
        size: 10 + Math.random() * 8,
        rotate: Math.random() * 60 - 30,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: i * 35,
      };
    });
    setParticles(prev => [...prev, ...newParticles]);
    newParticles.forEach(p => {
      Animated.timing(p.progress, { toValue: 1, duration: 900, delay: p.delay, useNativeDriver: true }).start();
    });
    setTimeout(() => {
      setParticles(prev => prev.filter(h => !newParticles.find(n => n.id === h.id)));
    }, 1200);
  };

  // Four light haptic pulses over ~750ms to match dashboard experience
  const startReadBurstHaptics = () => {
    try {
      // Clear any existing scheduled pulses first
      readHapticTimersRef.current.forEach(t => clearTimeout(t));
      readHapticTimersRef.current = [];
      const schedule = [0, 250, 500, 750];
      schedule.forEach(delay => {
        const t = setTimeout(() => {
          try { triggerLightHaptic(); } catch {}
        }, delay);
        readHapticTimersRef.current.push(t);
      });
    } catch {}
  };

  // Carousel sizing: modern center-snap with spacing and narrower cards
  const ITEM_SPACING = 16;
  const ITEM_WIDTH = Math.round(width * 0.80); // slimmer card for better centering
  const ITEM_SIZE = ITEM_WIDTH + ITEM_SPACING;
  const sidePadding = Math.round((width - ITEM_WIDTH) / 2); // center first/last (rounded to avoid half-pixel drift)

  // Cleanup on unmount
  useEffect(() => {
    // Enable LayoutAnimation on Android
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    // Start a more obvious pulsing animation for the hint (only visible when needed)
    const scalePulse = Animated.loop(
      Animated.sequence([
        Animated.timing(hintPulse, { toValue: 1.18, duration: 650, useNativeDriver: true }),
        Animated.timing(hintPulse, { toValue: 1.0, duration: 650, useNativeDriver: true }),
        Animated.delay(200),
      ])
    );
    const opacityPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(hintOpacity, { toValue: 1.0, duration: 650, useNativeDriver: true }),
        Animated.timing(hintOpacity, { toValue: 0.6, duration: 650, useNativeDriver: true }),
        Animated.delay(200),
      ])
    );
    scalePulse.start();
    opacityPulse.start();
    return () => {
      hintPulse.stopAnimation();
      hintOpacity.stopAnimation();
      if (devotionalTimerRef.current) {clearTimeout(devotionalTimerRef.current);}
      // Ensure any pending read haptic timers are cleared on unmount
      try {
        readHapticTimersRef.current.forEach(t => clearTimeout(t));
        readHapticTimersRef.current = [];
      } catch {}
    };
  }, [hintOpacity, hintPulse]);

  // Chevron animation (match PlaybookDetail rotation behavior)
  const chevronAnim = useSharedValue(0);
  useEffect(() => {
    chevronAnim.value = withTiming(showUserInput ? 1 : 0, { duration: 200 });
  }, [showUserInput, chevronAnim]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAnim.value * 180}deg` }],
  }));

  // Show only the user's freeform input for the challenge
  const resolvedChallengeDetails = (userInput && userInput.trim().length > 0)
    ? userInput.trim()
    : '—';

  const onboardingData = {
    name: 'Friend', // You could get this from user context
    challengeDetails: resolvedChallengeDetails,
  };

  // Bursting stars animation for Intro Modal
  const starPositions = React.useMemo(
    () => [
      { top: 20, left: '20%' },
      { top: 10, right: '18%' },
      { top: 60, left: '8%' },
      { top: 55, right: '6%' },
      { top: 30, left: '60%' },
      { top: 75, left: '40%' },
      { top: -5, right: '40%' },
    ] as Array<{ top: number; left?: number | `${number}%` | 'auto'; right?: number | `${number}%` | 'auto' }>,
    []
  );
  const starAnims = useRef(
    starPositions.map(() => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;
  // Timers to sync light haptics with each sparkle
  const sparkleHapticTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Clear any pending haptic timers when modal toggles or unmounts
    const clearTimers = () => {
      sparkleHapticTimers.current.forEach(t => clearTimeout(t));
      sparkleHapticTimers.current = [];
    };

    if (showIntroModal) {
      // Subtle haptic when the sparkle animation starts
      try { triggerLightHaptic(); } catch {}
      // Staggered burst of stars with synchronized light haptics per star
      starAnims.forEach((anim, i) => {
        anim.scale.setValue(0);
        anim.opacity.setValue(0);
        const delay = i * 90;
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.spring(anim.scale, { toValue: 1.4, useNativeDriver: true, speed: 18, bounciness: 8 }),
            Animated.timing(anim.opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
          ]),
          Animated.timing(anim.opacity, { toValue: 0, duration: 500, delay: 150, useNativeDriver: true }),
        ]).start();
        // Schedule a light haptic at the same moment this star pops
        const t = setTimeout(() => { try { triggerLightHaptic(); } catch {} }, delay);
        sparkleHapticTimers.current.push(t);
      });
    } else {
      clearTimers();
    }

    return () => clearTimers();
  }, [showIntroModal, starAnims]);

  // Issue #3 fix: Calculate progress using ActionStepsContext for real-time updates
  const calculateProgress = useCallback(() => {
    let completed = 0;
    let total = 0;

    // Get dynamic action steps progress from context - ONLY count action steps (not other sections)
    const actionStepsProgress = getCompletedStepsCount();
    if (actionStepsProgress.total > 0) {
      total = actionStepsProgress.total;
      completed = actionStepsProgress.completed;
    }

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    // Guard to prevent infinite re-render loop
    setProgressData((prev) => {
      if (
        prev.completed === completed &&
        prev.total === total &&
        prev.percentage === percentage
      ) {
        return prev;
      }
      return { completed, total, percentage };
    });
  }, [getCompletedStepsCount]);

  // Initialize action steps from playbook data (similar to PlaybookDetailScreen)
  useEffect(() => {
    if (playbook?.actionSteps) {
      console.log('[OnboardingPlaybookReady] Syncing action steps from playbook:', playbook.actionSteps.length, 'steps');
      setActionSteps(playbook.actionSteps);
    }
  }, [playbook?.actionSteps, setActionSteps]);

  // Update progress data when action steps change
  useEffect(() => {
    calculateProgress();
  }, [actionSteps, calculateProgress]);

  const toggleUserInput = () => {
    try { triggerLightHaptic(); } catch {}
    setShowUserInput(!showUserInput);
  };

  const handleCreateDevotional = () => {
    try { triggerLightHaptic(); } catch {}
    setShowDevotionalModal(true);
  };

  const handleContinueJourney = async () => {
    // Save action steps in the background before continuing onboarding (fire-and-forget)
    if (playbook?.id) {
      try {
        console.log('[OnboardingPlaybookReady] Queuing action steps save before continuing journey');
        // Do not await here to avoid blocking navigation
        Promise.resolve(saveActionSteps(playbook.id))
          .then(() => console.log('[OnboardingPlaybookReady] Action steps saved successfully'))
          .catch((error) => console.warn('[OnboardingPlaybookReady] Background saveActionSteps failed:', error));
      } catch (error) {
        console.warn('[OnboardingPlaybookReady] Failed to start background saveActionSteps:', error);
      }
    }
    navigation.navigate('OnboardingSalesOffer' as any);
  };

  // Create carousel cards data
  const createCarouselCards = (): PlaybookCard[] => {
    const cards: PlaybookCard[] = [];

    // Truth in Love card
    if (playbook.truthInLove) {
      const truthData = typeof playbook.truthInLove === 'string'
        ? { text: playbook.truthInLove, summary: '' }
        : playbook.truthInLove;

      cards.push({
        id: 'truth',
        type: 'Truth in Love',
        component: (
          <View style={[styles.carouselCard, styles.cardContainerLarge]}>
            <TruthInLoveCard
              key="truth"
              truth={truthData.text}
              summary={truthData.summary}
              // expanded controlled at render time via cloneElement
              expanded={false}
              style={styles.transparentBackground}
              currentUser={{ displayName: onboardingData.name }}
            />
          </View>
        ),
        backgroundColor: undefined,
      });
    }

    // Action Steps card
    console.log('[OnboardingPlaybookReady] Action Steps Check:', {
      hasActionSteps: !!(playbook.actionSteps && playbook.actionSteps.length > 0),
      actionStepsLength: playbook?.actionSteps?.length || 0,
      actionStepsData: playbook?.actionSteps || [],
      firstStep: playbook?.actionSteps?.[0] || null,
    });
    
    if (playbook.actionSteps && playbook.actionSteps.length > 0) {
      try {
        // Debug: log subtask counts for steps 3-5 (0-based indices 2-4)
        const dbg = (playbook.actionSteps || []).slice(0, 5).map((s: any, i: number) => ({
          stepIndex: i,
          id: s?.id,
          title: s?.title,
          subTasksCount: Array.isArray(s?.subTasks) ? s.subTasks.length : 0,
          lastSubtaskText: Array.isArray(s?.subTasks) && s.subTasks.length > 0 ? (s.subTasks[s.subTasks.length - 1]?.text) : undefined,
        }));
        console.log('[OnboardingPlaybookReady] Action steps pre-render debug (first 5 steps):', dbg);
      } catch (e) {
        console.warn('[OnboardingPlaybookReady] Debug logging failed:', e);
      }
      cards.push({
        id: 'action',
        type: 'Action Steps',
        component: (
          <View style={[styles.carouselCard, styles.cardContainerMedium]}>
            <ActionStepsCard
              key="action"
              steps={playbook.actionSteps || []}
              style={styles.transparentBackground}
              playbookTitle={playbook.title}
              playbookId={playbook.id}
              navigation={navigation as any}
              showExampleSubtasksInline={true}
              preferPropSteps={false}
            />
          </View>
        ),
        backgroundColor: undefined,
      });
    } else {
      console.log('[OnboardingPlaybookReady] No action steps found - card will not be created');
    }

    // Affirmations card - single card with all affirmations
    if (playbook.affirmations && playbook.affirmations.length > 0) {
      cards.push({
        id: 'affirmations',
        type: 'Affirmations',
        component: (
          <View
            key="affirmations"
            style={[styles.carouselCard, styles.cardContainerMinimal]}
          >
            <View style={styles.affirmationsHeader}>
              <MaterialCommunityIcons
                name="format-quote-close"
                size={24}
                color={Colors.alertCoral}
                style={[styles.quoteIcon, { transform: [{ scaleX: -1 }] }]}
              />
              <Text style={styles.affirmationsTitle}>Affirmations</Text>
            </View>
            <View style={styles.affirmationsList}>
              {playbook.affirmations.map((affirmation: any, index: number) => (
                <View
                  key={index}
                  style={[
                    styles.affirmationCard,
                    index === playbook.affirmations.length - 1 && styles.lastAffirmationCard,
                  ]}
                >
                  <View style={styles.affirmationContent}>
                    <Text style={styles.affirmationText}>
                      {typeof affirmation === 'string' ? affirmation : affirmation?.text || ''}
                    </Text>
                  </View>
                </View>
              ))}
              {/* Read Aloud button with burst animation (matches dashboard) */}
              <View pointerEvents="box-none" style={styles.readButtonWrapper}>
                {particles.length > 0 && (
                  <View pointerEvents="none" style={styles.readBurstLayer}>
                    {particles.map((p) => {
                      const translateY = p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -p.dy] });
                      const translateX = p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
                      const scale = p.progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.1, 0.8] });
                      const opacity = p.progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 0] });
                      return (
                        <Animated.View key={p.id} style={[styles.readParticle, { opacity, transform: [{ translateX }, { translateY }, { scale }, { rotate: `${p.rotate}deg` }] }]}> 
                          <Ionicons name="book" size={p.size} color={p.color} />
                        </Animated.View>
                      );
                    })}
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.readButton, hasRead && styles.readButtonActive]}
                  activeOpacity={0.85}
                  onPress={() => {
                    const now = Date.now();
                    if (now - readCooldownRef.current < 800) { return; }
                    readCooldownRef.current = now;

                    const nextIsRead = !hasRead;
                    if (nextIsRead) {
                      try { triggerSuccessHaptic(); } catch {}
                      // Match dashboard: celebratory burst + multi-pulse light haptics
                      startReadBurstHaptics();
                      startBurst();
                      // Award once per day per playbook
                      if (!readAwardedRef.current && user?.id && playbook?.id) {
                        readAwardedRef.current = true;
                        (async () => {
                          try {
                            const already = await faithPointsService.hasActivityTodayForPlaybook(user.id, 'affirmation_read_aloud', playbook.id);
                            if (!already) {
                              await faithPointsService.awardPoints(user.id, 'affirmation_read_aloud', { playbookId: playbook.id, playbookTitle: playbook.title, source: 'onboarding' });
                            }
                          } catch (e) {
                            readAwardedRef.current = false; // allow retry
                          }
                        })();
                      }
                    } else {
                      try { triggerLightHaptic(); } catch {}
                    }
                    if (playbook?.id) { setReadAloud(playbook.id, nextIsRead); }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={hasRead ? 'Read' : 'Read aloud'}
                  accessibilityHint="Tap when you have read the affirmations aloud"
                >
                  <Ionicons name="book-outline" size={16} color={hasRead ? Colors.alertCoral : Colors.hopeWhite} style={styles.readIcon} />
                  <Text style={[styles.readButtonText, hasRead && styles.readButtonTextActive]}>{hasRead ? 'Read' : 'Read Aloud'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ),
        backgroundColor: undefined,
      });
    }

    // Bible Verse card
    if (playbook.bibleVerse) {
      cards.push({
        id: 'bible',
        type: 'Bible Verse',
        component: (
          <BibleVerseCard
            key="bible"
            verse={playbook.bibleVerse}
            style={[styles.carouselCard]}
            backgroundColor="#274674"
          />
        ),
        backgroundColor: undefined,
      });
    }

    // Challenge card
    if (playbook.directChallenge) {
      const challengeText = typeof playbook.directChallenge === 'string'
        ? playbook.directChallenge
        : playbook.directChallenge.text;

      cards.push({
        id: 'challenge',
        type: 'Challenge',
        component: (
          // Inner card is now transparent; outer background will be alert coral
          <DirectChallengeCard
            key="challenge"
            challenge={challengeText}
          />
        ),
        backgroundColor: Colors.alertCoral,
      });
    }

    return cards;
  };

  const carouselCards = createCarouselCards();

  // Stable ItemSeparator component to avoid react/no-unstable-nested-components warning
  const ItemSeparator = React.useCallback(() => (
    <View style={styles.itemSpacing} />
  ), []);

  // When user reaches the last card, start a delay then reveal the CTA.
  // Once revealed, keep it visible even if the user navigates away from the last card.
  useEffect(() => {
    const isLast = currentIndex === carouselCards.length - 1;
    if (isLast && !devotionalVisible && !devotionalTimerRef.current) {
      devotionalTimerRef.current = setTimeout(() => {
        setDevotionalVisible(true);
        devotionalTimerRef.current = null;
      }, 800); // delay in ms; adjust as desired
    }
  }, [currentIndex, carouselCards.length, devotionalVisible]);

  const toggleCardExpansion = (cardId: string) => {
    try { triggerLightHaptic(); } catch {}
    // Smooth slow expand/collapse
    LayoutAnimation.configureNext({
      duration: 700,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
    // Once the user taps to expand, permanently dismiss the hint for this card
    setDismissedHints(prev => {
      const d = new Set(prev);
      d.add(cardId);
      return d;
    });
  };

  const renderCarouselCard = ({ item, index }: { item: PlaybookCard; index: number }) => {
    const isExpanded = expandedCards.has(item.id);
    const COLLAPSED_HEIGHT = 400;
    const measured = contentHeights[item.id] || 0;
    const isTruthCard = item.id === 'truth';
    const isActionCard = item.id === 'action';
    // Truth and Action cards can expand/collapse. Only allow tap-to-expand when currently collapsed and overflowing.
    const needsExpansionTruth = isTruthCard && (measured > COLLAPSED_HEIGHT + 1) && !isExpanded;
    const needsExpansionAction = isActionCard && (measured > COLLAPSED_HEIGHT + 1) && !isExpanded;
    const needsExpansion = needsExpansionTruth || needsExpansionAction;

    const inputRange = [
      (index - 1) * (ITEM_WIDTH + ITEM_SPACING),
      index * (ITEM_WIDTH + ITEM_SPACING),
      (index + 1) * (ITEM_WIDTH + ITEM_SPACING),
    ];
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.94, 1, 0.94],
      extrapolate: 'clamp',
    });
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.85, 1, 0.85],
      extrapolate: 'clamp',
    });
    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [8, 0, 8],
      extrapolate: 'clamp',
    });

    // Avoid inline-style object directly in JSX to satisfy lint
    const cardDynamicStyle = { width: ITEM_WIDTH };

    // Wrapper: make card tappable when it can expand OR when it's expanded (for collapse)
    const canToggle = (isTruthCard || isActionCard) && (measured > COLLAPSED_HEIGHT + 1);
    const Wrapper: React.ComponentType<any> = canToggle ? TouchableOpacity : View;

    return (
      <Wrapper
        style={[styles.cardContainer, styles.centeredContent, cardDynamicStyle]}
        {...(canToggle ? {
          onPress: () => toggleCardExpansion(item.id),
          disabled: false,
          activeOpacity: 0.9,
          accessibilityRole: 'button',
          accessibilityHint: isExpanded ? 'Tap to collapse content' : 'Tap to expand and read full content',
        } : {})}
      >
        {/* Hidden measurement: render content unconstrained to capture intrinsic height once */}
        {measured === 0 && (
          <View
            style={styles.hiddenOffscreen}
            onLayout={({ nativeEvent }) => {
              const h = nativeEvent.layout.height;
              if (h > 0 && h !== measured) {
                setContentHeights((prev) => ({ ...prev, [item.id]: h }));
              }
            }}
          >

            <View style={{ width: ITEM_WIDTH }}>{item.component}</View>
          </View>
        )}

        <Animated.View
          style={[
            styles.cardContent,
            // eslint-disable-next-line react-native/no-inline-styles
            {
              // Collapse by default; expand when toggled
              height: isExpanded ? 'auto' : COLLAPSED_HEIGHT,
              width: ITEM_WIDTH,
              backgroundColor: item.backgroundColor ?? 'rgba(255, 255, 255, 0.1)',
            },
            {
              transform: [{ scale }, { translateY }],
              opacity,
            },
          ]}
        >
          {item.id === 'truth'
            ? (
                <View style={[styles.carouselCard, styles.cardContainerLarge]}>
                  <TruthInLoveCard
                    key="truth"
                    truth={typeof playbook.truthInLove === 'string' ? playbook.truthInLove : playbook.truthInLove.text}
                    summary={typeof playbook.truthInLove === 'string' ? '' : playbook.truthInLove.summary}
                    expanded={isExpanded}
                    style={styles.transparentBackground}
                    currentUser={{ displayName: onboardingData.name }}
                    onToggleExpand={() => toggleCardExpansion('truth')}
                  />
                </View>
              )
            : item.component}

          {/* In-card expand hint overlay */}
          {(isTruthCard || isActionCard) && needsExpansion && !isExpanded && !dismissedHints.has(item.id) && (
            <TouchableOpacity
              style={styles.expandHintIcon}
              onPress={() => toggleCardExpansion(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Expand card"
            >
              { }
              { }
              { }
              <Animated.View style={{ transform: [{ scale: hintPulse }], opacity: hintOpacity }}>
                <MaterialCommunityIcons name="arrow-expand" size={18} color={Colors.hopeWhite} style={styles.iconOpacity} />
              </Animated.View>
            </TouchableOpacity>
          )}
        </Animated.View>
        { }
      </Wrapper>
    );
  };

  const onViewableItemsChanged = ({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index || 0;
      setCurrentIndex(newIndex);
      // Auto-collapse all cards when scrolling to a new card
      setExpandedCards(new Set());
    }
  };

  return (
    <>
      {/* Intro Modal */}
      <Modal visible={showIntroModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Bursting Stars */}
            <View style={styles.starsLayer} pointerEvents="none">
              {starPositions.map((pos, idx) => (
                <Animated.View
                  key={idx}
                  style={[
                    styles.starItem,
                    pos,
                    {
                      transform: [{ scale: starAnims[idx].scale }],
                      opacity: starAnims[idx].opacity,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name="star-four-points" size={14} color={Colors.hopeWhite} />
                </Animated.View>
              ))}
            </View>
            <Text style={styles.modalTitle}>Your Personalized{'\n'}Playbook is Ready</Text>
            <Text style={styles.modalSubtitle}>Here's your first step toward clarity.</Text>
            <View style={styles.warningContainer}>
              <Ionicons name="heart" size={16} color={Colors.alertCoral} />
              <Text style={styles.warningText}>
                Some truths may be hard to hear, but they are shared in love to help you grow.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalButton}
              activeOpacity={0.9}
              onPress={() => {
                try { triggerLightHaptic(); } catch {}
                // Close modal first, then show notification slightly after so it's not under the modal layer
                setShowIntroModal(false);
                setTimeout(async () => {
                  try {
                    // Award faith points to user's account during onboarding
                    if (user?.id) {
                      console.log('[OnboardingPlaybookReady] Awarding faith points for playbook generation');
                      await faithPointsService.awardPoints(user.id, 'playbook_generated', { 
                        isOnboarding: true,
                        suppressNotification: false 
                      });
                      console.log('[OnboardingPlaybookReady] Faith points awarded successfully');
                    } else {
                      console.warn('[OnboardingPlaybookReady] No user ID available for faith points');
                      // Still show notification even if we can't award points
                      const points = faithPointsService.getPointsForActivity('playbook_generated');
                      notificationService.showPointsNotification(points, 'playbook_generated', 'center');
                    }
                  } catch (e) {
                    // Non-blocking: if anything fails, proceed silently
                    console.warn('[OnboardingPlaybookReady] Failed to award faith points:', e);
                    // Show notification anyway
                    try {
                      const points = faithPointsService.getPointsForActivity('playbook_generated');
                      notificationService.showPointsNotification(points, 'playbook_generated', 'center');
                    } catch (notificationError) {
                      console.warn('[OnboardingPlaybookReady] Failed to show points notification:', notificationError);
                    }
                  }
                }, 150);
              }}
            >
              <Text style={styles.modalButtonText}>Explore My First Playbook</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <View style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={[
            styles.scrollContent,
            // Ensure content sits above fixed footer; top padding handled by sticky header to avoid sliding under status bar
            // eslint-disable-next-line react-native/no-inline-styles
            { paddingBottom: insets.bottom + (expandedCards.size > 0 ? 160 : 80), paddingTop: 0 },
          ]}
          showsVerticalScrollIndicator={expandedCards.size > 0}
          scrollEnabled={expandedCards.size > 0}
          bounces
          alwaysBounceVertical
          overScrollMode="always"
          contentInsetAdjustmentBehavior="never"
          // Make the first child (header) sticky so content scrolls underneath it when expanded
          stickyHeaderIndices={[0]}
          // Match bottom inset to footer height; dynamic with expansion
          scrollIndicatorInsets={{ top: insets.top, bottom: insets.bottom + (expandedCards.size > 0 ? 160 : 80) }}
        >
        {/* ONBOARDING-SPECIFIC HEADER REMOVED (moved to intro modal) */}

        {/* PLAYBOOK HEADER WITH CHEVRON TOGGLE */}
        {/* eslint-disable react-native/no-inline-styles */}
        <View onLayout={({ nativeEvent }) => setHeaderH(nativeEvent.layout.height)} style={[
          styles.playbookHeaderContainer,
          {
            zIndex: 2,
            elevation: 2,
            backgroundColor: Colors.anchorBlue,
            // Respect safe area so sticky header doesn't move under the status bar
            paddingTop: insets.top + 4,
            // Make header background span edge-to-edge while keeping inner content aligned
            marginLeft: -16 - insets.left,
            marginRight: -16 - insets.right,
            paddingLeft: 16 + insets.left,
            paddingRight: 16 + insets.right,
          },
        ]}>
          <TouchableOpacity style={styles.playbookTitleRow} onPress={toggleUserInput} activeOpacity={0.8}>
            <Text style={styles.playbookLabel}>PLAYBOOK</Text>
            <AnimatedRe.View style={[styles.chevronIcon, chevronStyle]}>
              <Ionicons
                name={'chevron-down'}
                size={16}
                color={Colors.hopeWhite}
              />
            </AnimatedRe.View>
          </TouchableOpacity>

          {/* User Input Display - Between PLAYBOOK and Title */}
          {showUserInput && (
            <View style={styles.userInputContainer}>
              <Text style={styles.userInputLabel}>Your Challenge:</Text>
              <Text style={styles.userInputText}>{onboardingData.challengeDetails}</Text>
            </View>
          )}

          <Text style={styles.playbookTitle}>{playbook.title || 'Your Personalized Journey'}</Text>

          <View style={styles.progressContainer}>
            <AnimatedProgressBar
              percentage={progressData.percentage}
              height={12}
              containerStyle={{ flex: 1 }}
              trackStyle={styles.progressBar}
              fillStyle={styles.progressFill}
            />
            <Text style={styles.progressText}>{progressData.completed}/{progressData.total} Steps</Text>
          </View>

          {/* CAROUSEL INDICATORS moved out of header to sit above carousel */}
        </View>



        {/* Dot pagination moved into carousel container to sit just above cards */}

        {/* CAROUSEL CARDS */}
        <View style={[styles.centeredJustified, { minHeight: availableHeight }] }>
        <View style={[
          styles.carouselContainer,
          {
            backgroundColor: Colors.anchorBlue,
            // bleed past ScrollView and safe-area paddings for true edge-to-edge
            marginLeft: -16 - insets.left,
            marginRight: -16 - insets.right,
          },
        ]}>
          {/* Dots just above the cards, outside the card area */}
          <View style={styles.dotsContainer}>
            {carouselCards.map((_, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dot,
                  currentIndex === index && styles.activeDot,
                ]}
                onPress={() => {
                  flatListRef.current?.scrollToIndex({ index, animated: true });
                  setCurrentIndex(index);
                }}
              />
            ))}
          </View>
          <Animated.FlatList
            ref={flatListRef}
            data={carouselCards}
            renderItem={renderCarouselCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled={false}
            snapToAlignment="center"
            snapToInterval={ITEM_SIZE}
            decelerationRate="fast"
            bounces={false}
            // Center items precisely: use exact sidePadding (no extra compensation)
            contentContainerStyle={{ paddingHorizontal: Math.round(sidePadding) }}
            ItemSeparatorComponent={ItemSeparator}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
            snapToOffsets={carouselCards.map((_, i) => i * ITEM_SIZE)}
            removeClippedSubviews={false}
            onViewableItemsChanged={onViewableItemsChanged}
            onMomentumScrollEnd={(e) => {
              const offsetX = e.nativeEvent.contentOffset.x;
              const index = Math.round(offsetX / (ITEM_WIDTH + ITEM_SPACING));
              const target = index * (ITEM_WIDTH + ITEM_SPACING);
              if (Math.abs(target - offsetX) > 1) {
                flatListRef.current?.scrollToOffset({ offset: target, animated: true });
              }
            }}
            getItemLayout={(_, index) => ({ length: ITEM_WIDTH + ITEM_SPACING, offset: (ITEM_WIDTH + ITEM_SPACING) * index, index })}
            viewabilityConfig={{
              itemVisiblePercentThreshold: 50,
            }}
          />
        </View>

        {/* DEVOTIONAL BUTTON - delayed reveal and persistent */}
        {devotionalVisible && (
          <TouchableOpacity
            style={[styles.devotionalButton, styles.centeredSelfContent, { width: ITEM_WIDTH }]}
            onPress={handleCreateDevotional}
            activeOpacity={0.8}
          >
            <Text style={styles.devotionalButtonText}>Create a Devotional</Text>
          </TouchableOpacity>
        )}

        </View>

        {/* Helper text moved back to footer to live with the CTA */}
        </ScrollView>

        {/* FIXED FOOTER (translucent so cards scroll behind) - Button only */}
        {/* eslint-disable react-native/no-inline-styles */}
        <View onLayout={({ nativeEvent }) => setFooterH(nativeEvent.layout.height)} style={[
          styles.footer,
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            // Collapse top padding when helper text is hidden (cards expanded)
            paddingTop: expandedCards.size === 0 ? 8 : 0,
            paddingBottom: insets.bottom + 8,
            backgroundColor: 'rgba(26, 60, 109, 0.85)', // translucent anchorBlue
          },
        ]}>
          {/* Helper text inside the footer, above the button (hidden when a card is expanded) */}
          {expandedCards.size === 0 && (
            <Text style={[styles.bottomText, styles.bottomTextCentered]}>This first playbook is yours! Picture walking daily with God, growing stronger through personalized guidance.</Text>
          )}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => { try { triggerLightHaptic(); } catch {}; handleContinueJourney(); }}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continue My Journey</Text>
          </TouchableOpacity>
        </View>

        {/* DEVOTIONAL MODAL */}
        <DevotionalModal
          visible={showDevotionalModal}
          onClose={() => setShowDevotionalModal(false)}
          playbookId={playbook.id}
          userInput={userInput}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.anchorBlue,
    borderRadius: BorderRadii.cardXL,
    padding: 24,
    borderWidth: 0,
    borderColor: 'transparent',
    position: 'relative',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  modalSubtitle: {
    fontSize: 15,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 14,
    lineHeight: 22,
  },
  modalBody: {
    fontSize: 14,
    color: Colors.hopeWhite,
    opacity: 0.9,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  // Stars animation layer in modal
  starsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  starItem: {
    position: 'absolute',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 0,
    minHeight: 48,
    position: 'relative',
  },
  mainTitleInline: {
    marginLeft: 8,
    textAlign: 'center',
    flex: 0,
    width: '100%',
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: 0.3,
  },
  logoSmall: {
    width: 44,
    height: 44,
    marginTop: 0,
    position: 'absolute',
    left: 0,
  },
  headerTextBlock: {
    paddingBottom: 6,
    marginTop: 4,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 4,
    paddingHorizontal: 0,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 8,
    opacity: 0.9,
    paddingHorizontal: 12,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.alertCoral}20`,
    borderWidth: 0.4,
    borderColor: Colors.alertCoral,
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 0,
    marginTop: 2,
    marginBottom: 14,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: Colors.hopeWhite,
    marginLeft: 8,
    lineHeight: 18,
  },
  playbookHeaderContainer: {
    marginBottom: 6,
  },
  playbookTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    marginBottom: 0,
  },
  playbookLabel: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.7,
    fontWeight: '600',
  },
  chevronIcon: {
    marginLeft: 6,
  },
  playbookTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    overflow: 'hidden', // clip inner fill so left edge appears rounded
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    // Ensure left edge is rounded; right edge will round when 100%
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  progressText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.7,
  },
  userInputContainer: {
    backgroundColor: '#264776',
    borderWidth: 1,
    borderColor: '#385886',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 10,
  },
  userInputLabel: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.7,
    marginBottom: 4,
  },
  userInputText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  carouselContainer: {
    // keep content visually centered within screen width
    marginHorizontal: 0,
    alignItems: 'center',
    marginBottom: 20,
  },
  carouselContent: {
    paddingHorizontal: 16,
  },
  carouselContentPeek: {
    paddingHorizontal: 30,
    paddingRight: 100,
    alignItems: 'center',
  },
  cardContainer: {
    width: width - 80,
    marginHorizontal: 10,
  },
  cardContent: {
    borderRadius: BorderRadii.cardXL,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'center',
  },
  carouselCard: {
    borderRadius: BorderRadii.cardXL,
    minHeight: 400,
  },
  affirmationsHeader: {
    padding: 16,
    paddingBottom: 10,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  affirmationsTitle: {
    ...Typography.interBold,
    fontSize: 20,
    color: Colors.hopeWhite,
    textAlign: 'left',
    letterSpacing: 0.5,
  },
  quoteIcon: {
    marginRight: 8,
  },
  affirmationsList: {
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  affirmationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 10,
  },
  lastAffirmationCard: {
    marginBottom: 4,
  },
  affirmationContent: {
    padding: 14,
  },
  affirmationText: {
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 24,
    fontWeight: '500',
  },
  readButtonWrapper: {
    marginTop: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  readBurstLayer: {
    position: 'absolute',
    bottom: 22,
    alignSelf: 'center',
    width: 140,
    height: 120,
  },
  readParticle: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
  },
  // Read Aloud button styles
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginTop: 4,
  },
  readButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  readIcon: {
    marginRight: 6,
  },
  readButtonText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  readButtonTextActive: {
    color: Colors.alertCoral,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: Colors.hopeWhite,
    width: 20,
  },
  devotionalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    height: 56,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  devotionalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  footer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  bottomText: {
    fontSize: 13,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 10,
    opacity: 0.9,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  continueButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    height: 56,
    alignSelf: 'stretch',
    marginHorizontal: 16,
  },
  continueButtonText: {
    color: Colors.hopeWhite,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  expandHintButton: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  expandHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  expandHintText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  expandHintIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  expandHintChip: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  transparentBackground: {
    backgroundColor: 'transparent',
  },
  hiddenOffscreen: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
    left: -10000,
    right: 0,
  },
  iconOpacity: {
    opacity: 0.9,
  },
  footerDynamic: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 60, 109, 0.85)',
  },
  bottomTextCentered: {
    marginBottom: 10,
    textAlign: 'center',
  },
  cardContainerLarge: {
    backgroundColor: '#274674',
    padding: 24,
  },
  cardContainerMedium: {
    backgroundColor: '#274674',
    padding: 16,
  },
  cardContainerMinimal: {
    backgroundColor: '#274674',
  },
  centeredContent: {
    alignItems: 'center',
    marginHorizontal: 0,
  },
  noPaddingTop: {
    paddingTop: 0,
  },
  elevatedContent: {
    zIndex: 2,
    elevation: 2,
  },
  centeredJustified: {
    justifyContent: 'center',
  },
  centeredSelfContent: {
    alignSelf: 'center',
    marginHorizontal: 0,
  },
  itemSpacing: {
    // Using literal to avoid out-of-scope constant in StyleSheet; matches ITEM_SPACING
    width: 16,
  },
  cardContentDynamic: {
    // Dynamic styles will be applied inline for height, width, backgroundColor, transform, opacity
  },
});

// Main component wrapper that provides ActionStepsContext
const OnboardingPlaybookReadyScreenNew: React.FC = () => {
  const route = useRoute();
  const { user } = useAuth();

  const {
    playbook: routePlaybook,
    challengeCategory,
    specificChallenge,
    userInput,
  } = route.params as any;

  const userId = user?.id;
  const playbookId = routePlaybook?.id;
  const isFullPlaybook = !!routePlaybook && typeof routePlaybook === 'object' && 'title' in routePlaybook && 'actionSteps' in routePlaybook;

  // Determine if the route playbook has complete subtasks data
  const routeHasFullSubtasks = Array.isArray((routePlaybook as any)?.actionSteps)
    ? (routePlaybook as any).actionSteps.every((s: any) => Array.isArray(s?.subTasks) && s.subTasks.length > 0)
    : false;

  // Fetch if route object isn't full OR its subtasks are incomplete
  const shouldFetchFromDB = !!playbookId && !!userId && (!isFullPlaybook || !routeHasFullSubtasks);

  const { data: fetchedPlaybook, isLoading, error } = useQuery<any | null>({
    queryKey: ['playbook', playbookId],
    queryFn: async () => {
      try {
        return await getPlaybook(userId || '', playbookId);
      } catch (err) {
        console.error('[OnboardingPlaybookReady] getPlaybook failed:', err);
        throw err;
      }
    },
    enabled: shouldFetchFromDB,
    staleTime: 0,
    gcTime: 0,
  });

  // Prefer fetched data when available (we may have fetched due to incomplete subtasks
  // even if the route object looked "full").
  const playbook = fetchedPlaybook ?? (isFullPlaybook ? routePlaybook : routePlaybook);
  const dataSource = fetchedPlaybook ? 'fetched' : (isFullPlaybook ? 'route-full' : 'route-partial');

  // Ensure Read Aloud state persists if the playbook ID differs between route object and fetched DB object
  // Example: onboarding may pass a temporary or partial object; after fetch, the canonical ID might differ.
  const getReadAloud = usePlaybookStoreReactQuery(state => state.getReadAloud);
  const setReadAloud = usePlaybookStoreReactQuery(state => state.setReadAloud);
  useEffect(() => {
    const routeId = routePlaybook?.id;
    const finalId = (playbook as any)?.id;
    if (routeId && finalId && routeId !== finalId) {
      try {
        const wasRead = getReadAloud(routeId);
        const isSetOnFinal = getReadAloud(finalId);
        if (wasRead && !isSetOnFinal) {
          setReadAloud(finalId, true);
          console.log('[OnboardingPlaybookReady] Migrated Read Aloud state from', routeId, 'to', finalId);
        }
      } catch (e) {
        console.warn('[OnboardingPlaybookReady] Read Aloud migration failed:', e);
      }
    }
  }, [routePlaybook?.id, (playbook as any)?.id, getReadAloud, setReadAloud]);

  // Debug logging to check action steps data
  console.log('[OnboardingPlaybookReady] Debug Info:', {
    isFullPlaybook,
    routeHasFullSubtasks,
    shouldFetchFromDB,
    isLoading,
    error: (error as any)?.message || error,
    dataSource,
    hasPlaybook: !!playbook,
    playbookKeys: playbook ? Object.keys(playbook) : [],
    actionStepsLength: playbook?.actionSteps?.length || 0,
    actionStepsData: playbook?.actionSteps || [],
    truthInLoveData: playbook?.truthInLove || null,
    fullPlaybookData: playbook,
  });

  return (
    <ActionStepsProvider initialSteps={playbook?.actionSteps || []}>
      <PlaybookContent
        playbook={playbook}
        challengeCategory={challengeCategory}
        specificChallenge={specificChallenge}
        userInput={userInput}
      />
    </ActionStepsProvider>
  );
};

export default OnboardingPlaybookReadyScreenNew;

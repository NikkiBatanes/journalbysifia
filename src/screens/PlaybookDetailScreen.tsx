// React & React Native
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Dimensions,
  ScrollView,
  StatusBar,
  Platform,
  ViewStyle,
  TextStyle,
  ImageStyle,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated as RNAnimated,
} from 'react-native';

// Navigation & Gestures
import { PanGestureHandler } from 'react-native-gesture-handler';

// Animation
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  withTiming,
  runOnJS,
  withSequence,
} from 'react-native-reanimated';

// Icons
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// Theme & Styling
import { Colors, Fonts } from '../theme';

// Components
import TruthInLoveCard from '../components/TruthInLoveCard';
import ActionStepsCard from '../components/ActionStepsCard';
import DocumentCardView from '../components/DocumentCardView';
import AffirmationCard from '../components/AffirmationCard';
import BibleVerseCard from '../components/BibleVerseCard';
import DirectChallengeCard from '../components/DirectChallengeCard';
import SwipeUpIndicator from '../components/SwipeUpIndicator';
import PlaybookHeader from '../components/PlaybookHeader';
import DocumentCards from '../components/DocumentCards';
import CompactHeader from '../components/CompactHeader';

// Types & Context
import { Playbook, ActionStep, Affirmation } from '../interfaces/playbook';
import { useActionSteps } from '../context/ActionStepsContext';
import DevotionalButton from '../components/DevotionalButton';
import DevotionalModal from '../components/DevotionalModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Gesture context type
type GestureContext = { startY: number; startX: number };

// Types
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types'; // Adjust path if needed

type PlaybookScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'PlaybookDetail'>;
  route: { params: { playbook: Playbook } };
};


// Types
type CardType = 'truth' | 'action' | 'affirmation' | 'bible' | 'challenge';

interface CardData {
  type: CardType;
  truth?: string;
  summary?: string;
  steps?: ActionStep[];
  affirmations?: Affirmation[];
  verse?: { text: string; reference: string };
  challenge?: string | { text: string; summary: string };
  challengeCTA?: string;
  tappable: boolean;
}

export default function PlaybookDetailScreen({ route, navigation }: PlaybookScreenProps) {
  // ...existing hooks
  const [hasReachedLastCard, setHasReachedLastCard] = useState(false);
  // ...rest of hooks
  const {
    actionSteps,
    setActionSteps,
    handleToggleStep,
    getCompletedStepsCount,
    saveActionSteps,
  } = useActionSteps();
  const playbook = route.params.playbook;
  const [isSaving, setIsSaving] = useState(false);

  // Scroll position tracking for compact header
  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const [showCompactHeader, setShowCompactHeader] = useState(false);

  // Set navigation options based on scroll state
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '',
      headerLeft: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 8, paddingLeft: 0 }}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.anchorBlue} />
          </TouchableOpacity>
          {showCompactHeader && (
            <Text
              style={{
                fontSize: 18,
                fontWeight: '800',
                color: Colors.anchorBlue,
                marginLeft: 4,
                maxWidth: 260, // Adjusted to allow more space before profile photo
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {playbook.title.split('\n')[0]}
            </Text>
          )}
        </View>
      ),
    });
  }, [navigation, showCompactHeader, playbook.title]);
  const lastScrollY = useRef(0);
  const scrollThreshold = 100; // Pixels to scroll before showing compact header
  const scrollViewRef = useRef<ScrollView>(null);

  // Debug: Log the playbook data when it's received
  useEffect(() => {
    console.log('[DEBUG] Playbook data received in PlaybookDetailScreen:', JSON.stringify({
      id: playbook?.id,
      title: playbook?.title,
      affirmations: playbook?.affirmations,
      affirmationsCount: playbook?.affirmations?.length,
      hasAffirmations: Array.isArray(playbook?.affirmations) && playbook.affirmations.length > 0,
      playbookKeys: playbook ? Object.keys(playbook) : [],
    }, null, 2));
  }, [playbook]);
  const [hasSeenSwipeUp, setHasSeenSwipeUp] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Save action steps when they change or when navigating away
  useEffect(() => {
    // Don't save if we haven't initialized yet or if we're currently saving
    if (!isInitialized || isSaving) {return;}

    const saveProgress = async () => {
      try {
        if (!playbook?.id) {
          console.warn('Cannot save progress: No playbook ID available');
          return;
        }
        setIsSaving(true);
        console.log('Saving progress for playbook ID:', playbook.id);
        await saveActionSteps(playbook.id);
      } catch (error) {
        console.error('Error saving progress:', error);
        // Consider showing an error message to the user
      } finally {
        setIsSaving(false);
      }
    };

    // Save when the component unmounts
    return () => {
      saveProgress().catch(console.error);
    };
  }, [actionSteps, playbook?.id, playbook?.user_id, isInitialized, isSaving, saveActionSteps]);

  // Initialize action steps when playbook loads
  useEffect(() => {
    console.log('[DEBUG] PlaybookDetailScreen - Playbook data structure:', JSON.stringify(playbook, null, 2));
    console.log('[DEBUG] PlaybookDetailScreen - Playbook actionSteps:', JSON.stringify(playbook?.actionSteps, null, 2));

    // Log detailed structure of action steps
    if (playbook?.actionSteps) {
      console.log('[DEBUG] PlaybookDetailScreen - Action steps structure:', {
        count: playbook.actionSteps.length,
        hasSubTasks: playbook.actionSteps.some(step => step.subTasks && step.subTasks.length > 0),
        stepsWithSubTasks: playbook.actionSteps
          .filter(step => step.subTasks && step.subTasks.length > 0)
          .map(step => ({
            id: step.id,
            title: step.title,
            subTasksCount: step.subTasks?.length || 0,
            subTasksSample: step.subTasks?.slice(0, 2), // Show first 2 subtasks for inspection
          })),
      });
    }

    if (playbook?.actionSteps && !isInitialized) {
      console.log('[DEBUG] Initializing action steps from playbook');
      setActionSteps(playbook.actionSteps);
      setIsInitialized(true);
    }
  }, [playbook, setActionSteps, isInitialized]);

  // Log action steps changes
  useEffect(() => {
    console.log('[DEBUG] PlaybookDetailScreen - Context actionSteps updated:', JSON.stringify(actionSteps, null, 2));
  }, [actionSteps]);

  console.log('[DEBUG] PlaybookDetailScreen - Current context actionSteps:', actionSteps);
  console.log('[DEBUG] PlaybookDetailScreen - Playbook actionSteps:', playbook?.actionSteps);

  // Calculate progress
  const stepsToCalculate = actionSteps.length > 0 ? actionSteps : (Array.isArray(playbook.actionSteps) ? playbook.actionSteps : []);
  const { completed, total } = getCompletedStepsCount();

  // Ensure we don't show more than 100% progress
  const safeCompleted = Math.min(completed, total);
  const progress = total > 0 ? (safeCompleted / total) * 100 : 0;

  // Calculate completed tasks count for display
  const completedTasksCount = safeCompleted;
  const totalTasksCount = total;

  // Debug log the progress calculation
  console.log('[DEBUG] Progress calculation:', {
    completed: safeCompleted,
    total,
    progress,
    actionStepsCount: actionSteps.length,
    playbookStepsCount: playbook.actionSteps?.length || 0,
    completedTasksCount,
    totalTasksCount,
  });

  // Handle scroll events for compact header
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;

    // Show/hide compact header based on scroll direction and position
    if (currentScrollY > scrollThreshold && currentScrollY > lastScrollY.current) {
      setShowCompactHeader(true);
    } else if (currentScrollY < lastScrollY.current - 10 || currentScrollY <= 0) {
      setShowCompactHeader(false);
    }

    lastScrollY.current = currentScrollY;

    // Also update the animated value for any other animations
    scrollY.setValue(currentScrollY);
  };

  if (!playbook) {
    return (
      <>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <Text>Loading playbook...</Text>
        </View>
      </>
    );
  }

  // --- Animated swipe logic for top card ---
  const gestureHandlerRef = useRef(null);
  const SWIPE_THRESHOLD = 120; // px, for iOS-like swipe
  const translateY = useSharedValue(0);
  const isTransitioning = useSharedValue(false);

  // View state
  const [viewMode, setViewMode] = useState<'stack' | 'document'>('stack');
  const [currentCard, setCurrentCard] = useState(0);

  // Hide SwipeUpIndicator after leaving the first card
  useEffect(() => {
    if (currentCard > 0 && !hasSeenSwipeUp) {
      setHasSeenSwipeUp(true);
    }
  }, [currentCard, hasSeenSwipeUp]);

  // Card data with explicit typing and null checks
  const cardData: CardData[] = [
    {
      type: 'truth' as const,
      truth: playbook.truthInLove?.text ?? '',
      summary: playbook.truthInLove?.summary ?? '',
      tappable: false,
    },
    {
      type: 'action' as const,
      steps: Array.isArray(actionSteps) && actionSteps.length > 0 ? actionSteps :
            (Array.isArray(playbook.actionSteps) ? playbook.actionSteps : []),
      tappable: false,
    },
    {
      type: 'affirmation' as const,
      affirmations: Array.isArray(playbook.affirmations)
        ? playbook.affirmations.filter((a): a is Required<Affirmation> =>
            a?.id !== undefined &&
            a?.text !== undefined &&
            a?.completed !== undefined
          )
        : [],
      tappable: false,
    },
    {
      type: 'bible' as const,
      verse: {
        text: playbook.bibleVerse?.text ?? 'No verse text available',
        reference: playbook.bibleVerse?.reference ?? 'Unknown',
      },
      tappable: false,
    },
    {
      type: 'challenge' as const,
      challenge: typeof playbook.directChallenge === 'string'
        ? playbook.directChallenge
        : playbook.directChallenge?.text ?? '',
      challengeCTA: playbook.challengeCTA ?? '',
      tappable: false,
    },
  ];

  const onSwipeComplete = (direction: 'up' | 'down') => {
    if (direction === 'up') {
      goToNextCard();
      headerOpacity.value = withTiming(1, { duration: 200 });
      headerHeight.value = 1;
      headerFaded.value = false;
    } else {
      goToPrevCard();
      headerOpacity.value = withTiming(1, { duration: 200 });
      headerHeight.value = 1;
      headerFaded.value = false;
    }
    requestAnimationFrame(() => {
      translateY.value = 0;
      isTransitioning.value = false;
    });
  };

  // Shared values for worklet access
  const cardCount = useSharedValue(cardData.length);
  const currentCardShared = useSharedValue(currentCard);

  useEffect(() => {
    cardCount.value = cardData.length;
  }, [cardData.length]);

  useEffect(() => {
    currentCardShared.value = currentCard;
  }, [currentCard]);

  const headerFaded = useSharedValue(false);
  const headerOpacity = useSharedValue(1);
  const headerHeight = useSharedValue(1); // 1 = fully expanded, 0 = fully collapsed

  const animatedHeaderStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    height: withTiming(headerHeight.value ? 60 : 0, { duration: 250 }),
    marginBottom: withTiming(headerHeight.value ? 0 : -10, { duration: 250 }),
    overflow: 'hidden',
  }));

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: GestureContext) => {
      ctx.startY = translateY.value;
      ctx.startX = 0;
    },
    onActive: (event, ctx: GestureContext) => {
      if (!isTransitioning.value) {
        if (Math.abs(event.translationY) > Math.abs(event.translationX)) {
          translateY.value = ctx.startY + event.translationY;
          const threshold = -SWIPE_THRESHOLD / 2;
          // Calculate fade and collapse based on scroll position
          const fadeThreshold = -SWIPE_THRESHOLD / 2;
          const collapseThreshold = -SWIPE_THRESHOLD * 0.8;

          if (translateY.value < fadeThreshold) {
            // Start fading and collapsing header
            const fadeProgress = Math.min(1, Math.abs(translateY.value - fadeThreshold) / (SWIPE_THRESHOLD - fadeThreshold));
            headerOpacity.value = withTiming(1 - fadeProgress * 0.8, { duration: 100 });
            headerHeight.value = 1 - fadeProgress * 0.8;

            if (translateY.value < collapseThreshold && !headerFaded.value) {
              headerFaded.value = true;
            }
          } else if (translateY.value >= fadeThreshold && headerFaded.value) {
            // Expand and show header
            headerFaded.value = false;
            headerOpacity.value = withTiming(1, { duration: 200 });
            headerHeight.value = 1;
          }
        }
      }
    },
    onEnd: (event, ctx: GestureContext) => {
      if (isTransitioning.value) {return;}

      const isVerticalSwipe = Math.abs(event.translationY) > Math.abs(event.translationX);
      if (isVerticalSwipe) {
        if (event.translationY < -SWIPE_THRESHOLD && currentCardShared.value < cardCount.value - 1) {
          isTransitioning.value = true;
          translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 250 }, (finished) => {
            if (finished) {
              runOnJS(onSwipeComplete)('up');
            }
          });
        } else if (event.translationY > SWIPE_THRESHOLD && currentCardShared.value > 0) {
          isTransitioning.value = true;
          translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, (finished) => {
            if (finished) {
              runOnJS(onSwipeComplete)('down');
            }
          });
        } else {
          translateY.value = withSpring(0, { damping: 10, stiffness: 150 });
        }
      } else {
        translateY.value = withSpring(0, { damping: 10, stiffness: 150 });
      }
    },
  });

  // Nudge animation for the first card and bounce for new front cards
  const nudgeY = useSharedValue(0);
  const bounceY = useSharedValue(0);
  const prevCardRef = useRef(currentCard);

  // Animation for card press
  const cardScale = useSharedValue(1);
  const shadowElevation = useSharedValue(4);
  const shadowOpacity = useSharedValue(0.15);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          translateY.value +
          (currentCard === 0 ? nudgeY.value : 0) +
          (currentCard > 0 ? bounceY.value : 0),
      },
      { scale: cardScale.value },
    ],
    shadowOpacity: shadowOpacity.value,
    elevation: shadowElevation.value,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    shadowColor: '#000',
  }));

  useEffect(() => {
    if (currentCard === 0) {
      nudgeY.value = withSequence(
        withTiming(-24, { duration: 350 }),
        withTiming(0, { duration: 350 }),
        withTiming(-14, { duration: 250 }),
        withTiming(0, { duration: 250 }),
        withTiming(-8, { duration: 180 }),
        withTiming(0, { duration: 180 })
      );
    }

    if (currentCard !== prevCardRef.current) {
      bounceY.value = withSequence(
        withTiming(-15, { duration: 100 }),
        withSpring(0, {
          damping: 12,
          stiffness: 100,
          mass: 1.5,
          overshootClamping: false,
        })
      );
      prevCardRef.current = currentCard;
    }
  }, [currentCard]);

  const goToNextCard = () => {
    if (currentCard < cardData.length - 1) {
      setCurrentCard(prevCard => {
        const newCard = prevCard + 1;
        setCurrentCardIndex(newCard);
        return newCard;
      });
    }
  };

  const goToPrevCard = () => {
    if (currentCard > 0) {
      setCurrentCard(prevCard => {
        const newCard = prevCard - 1;
        setCurrentCardIndex(newCard);
        return newCard;
      });
    }
  };

  const handleCreateDevotional = (days: number) => {
    console.log(`Creating ${days}-day devotional`);
    // TODO: Implement actual devotional creation logic
    setHasCreatedDevotional(true);
    setShowDevotionalModal(false);
  };

  const handleCardPress = (cardType: CardType, cardData: CardData) => {
    const { tappable, ...serializableCardData } = cardData;
    const { completed: completedTasks, total: totalTasks } = getCompletedStepsCount();
    navigation.navigate('CardDetail', {
      cardType,
      cardData: serializableCardData,
      playbook,
      progress,
      completedTasks,
      totalTasks,
      viewMode,
    });
  };

  const [showUserInput, setShowUserInput] = useState(false);
  const [showDevotionalModal, setShowDevotionalModal] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [hasCreatedDevotional, setHasCreatedDevotional] = useState(false);

  const titleStyle: TextStyle[] = [
    styles.playbookTitle,
    {
      fontSize: 26,
      color: Colors.anchorBlue,
      ...Platform.select({
        ios: {
          fontFamily: 'Georgia-Bold',
          fontWeight: '900',
        },
        android: {
          fontFamily: 'serif',
          fontWeight: 'bold',
          includeFontPadding: false,
        },
      }),
      textShadowColor: 'rgba(0, 0, 0, 0.1)',
      textShadowOffset: { width: 0.5, height: 0.5 },
      textShadowRadius: 1,
      letterSpacing: 0.3,
    },
  ];

  const chevronAnim = useSharedValue(0);
  useEffect(() => {
    chevronAnim.value = withTiming(showUserInput ? 1 : 0, { duration: 200 });
  }, [showUserInput]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAnim.value * 180}deg` }],
    marginLeft: 4,
  }));

  const renderContent = () => {
    return (
      <View style={styles.contentContainer}>
        {/* Main Header - Only show when not scrolled or in stack view */}
        {(!showCompactHeader || viewMode === 'stack') && (
          <PlaybookHeader
            title={playbook.title}
            subtitle={
              playbook.createdAt
                ? new Date(playbook.createdAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : ''
            }
            progress={progress}
            completedTasks={completedTasksCount}
            totalTasks={totalTasksCount}
            showToggle={true}
            viewMode={viewMode}
            onToggleView={(mode: 'stack' | 'document') => setViewMode(mode)}
            onPlaybookLabelPress={() => setShowUserInput(!showUserInput)}
            showUserInput={showUserInput}
            userInput={playbook.userInput}
            chevronAnimatedStyle={chevronStyle}
            showTitle={false}
          />
        )}

        {/* Compact Header - Only show when scrolled in document view */}
        {showCompactHeader && viewMode === 'document' && (
          <View style={styles.compactHeaderContainer}>
            <CompactHeader
              title={playbook.title}
              progress={progress}
              completedTasks={completedTasksCount}
              totalTasks={totalTasksCount}
            />
          </View>
        )}

        <View style={styles.mainContainer}>
          {viewMode === 'stack' ? (
            renderStackCards()
          ) : (
            <DocumentCards
              playbook={playbook}
              actionSteps={actionSteps}
              styles={styles}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onLastCardVisible={setHasReachedLastCard}
            />
          )}
        </View>
      </View>
    );
  };

  const renderPlaybookInfo = () => {
    // Handle two-line title format from the playbook
    const titleLines = playbook.title.split('\n').map(line => line.trim()).filter(line => line);
    const firstLine = titleLines[0] || '';
    const secondLine = titleLines[1] || '';

    return (
      <View style={styles.playbookInfoContainer}>
        <View style={styles.playbookHeader}>
          <TouchableOpacity
            style={styles.playbookLabelRow}
            onPress={() => setShowUserInput(!showUserInput)}
            activeOpacity={0.7}
          >
            <Text style={styles.playbookLabel}>PLAYBOOK</Text>
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-down" size={15} color={Colors.anchorBlue} />
            </Animated.View>
          </TouchableOpacity>

          {showUserInput && playbook.userInput && (
            <View style={styles.userInputCard}>
              <Text style={styles.userInputText}>{playbook.userInput}</Text>
            </View>
          )}

          <Text style={styles.playbookTitle}>{firstLine}</Text>
          {secondLine ? (
            <Text style={[styles.playbookTitle, { marginTop: -8 }]}>{secondLine}</Text>
          ) : null}

          <Text style={styles.creationDate}>
            {new Date(playbook.createdAt || new Date()).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }).toUpperCase()}
          </Text>

          <View style={styles.progressAndViewRow}>
            <View style={styles.progressContainer}>
              <View style={styles.progressRow}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progress}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {actionSteps.filter((step) => step.completed).length}/{actionSteps.length} Steps
                </Text>
              </View>
            </View>

            <View style={styles.viewToggleContainer}>
              <TouchableOpacity style={styles.viewToggle} onPress={() => setViewMode('stack')}>
                <View style={[styles.iconContainer, viewMode === 'stack' && styles.iconContainerActive]}>
                  <Ionicons
                    name="albums"
                    size={20}
                    color={viewMode === 'stack' ? Colors.hopeWhite : Colors.trustGrey}
                    style={{ transform: [{ rotate: '180deg' }] }}
                  />
                </View>
              </TouchableOpacity>
              <View style={styles.viewToggleDivider} />
              <TouchableOpacity style={styles.viewToggle} onPress={() => setViewMode('document')}>
                <View style={[styles.iconContainer, viewMode === 'document' && styles.iconContainerActive]}>
                  <MaterialCommunityIcons
                    name="view-agenda"
                    size={20}
                    color={viewMode === 'document' ? Colors.hopeWhite : Colors.trustGrey}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderStackCards = () => {
    if (cardData.length === 0) {return null;}

    const visibleCardCount = Math.min(5, cardData.length - currentCard);

    const getCardColor = (index: number) => {
      // Return the same color for all cards to remove the gradient effect
      return Colors.anchorBlue;
    };

    const renderCard = (cardIndex: number, stackIndex: number, onToggleView: (mode: 'stack' | 'document') => void) => {
      const card = cardData[cardIndex];
      if (!card) {return null;}

      const scaleY = 1 - stackIndex * 0.01;
      const scaleX = 1 - stackIndex * 0.03;
      const translateY = stackIndex * 8;
      const zIndex = 100 - stackIndex;
      const isLastCard = cardIndex === cardData.length - 1;
      const isCurrentCard = cardIndex === currentCard;
      const opacity = isLastCard && !isCurrentCard ? 0.7 : 1;
      const isTopCard = stackIndex === 0;
      const CardContainer = isTopCard ? Animated.View : View;
      const extraStyle = isTopCard ? animatedCardStyle : {};

      return (
        <TouchableOpacity
          key={`${cardIndex}-${stackIndex}`}
          activeOpacity={1}
          onPress={() => isTopCard && handleCardPress(card.type, card)}
          onPressIn={() => {
            if (isTopCard) {
              cardScale.value = withTiming(0.98, { duration: 100 });
              shadowElevation.value = withTiming(8, { duration: 100 });
              shadowOpacity.value = withTiming(0.25, { duration: 100 });
            }
          }}
          onPressOut={() => {
            if (isTopCard) {
              cardScale.value = withTiming(1, { duration: 100 });
              shadowElevation.value = withTiming(4, { duration: 100 });
              shadowOpacity.value = withTiming(0.15, { duration: 100 });
            }
          }}
          style={[
            styles.stackCard,
            card.type === 'affirmation'
              ? {
                  backgroundColor: 'transparent',
                  borderRadius: 28,
                  elevation: 0,
                  shadowColor: 'transparent',
                  transform: !isTopCard ? [{ scaleX }, { scaleY }, { translateY }] : undefined,
                  zIndex,
                  opacity: !isTopCard ? opacity : 1,
                  position: stackIndex === 0 ? 'relative' : 'absolute',
                  top: 0,
                  alignSelf: 'center',
                }
              : {
                  backgroundColor: getCardColor(stackIndex),
                  transform: !isTopCard ? [{ scaleX }, { scaleY }, { translateY }] : undefined,
                  zIndex,
                  opacity: !isTopCard ? opacity : 1,
                  position: stackIndex === 0 ? 'relative' : 'absolute',
                  top: 0,
                  alignSelf: 'center',
                  elevation: 5 - stackIndex,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                },
            extraStyle,
          ]}
        >
          <DocumentCardView card={card} styles={styles} />
        </TouchableOpacity>
      );
    };

    const backCards = Array.from({ length: visibleCardCount - 1 }).map((_, i, arr) => {
      const stackIndex = arr.length - 1 - i + 1;
      const cardIndex = currentCard + stackIndex;
      return renderCard(cardIndex, stackIndex, (mode: 'stack' | 'document') => setViewMode(mode));
    });

    return (
      <View style={styles.cardStackContainer}>
        {backCards}
        <PanGestureHandler ref={gestureHandlerRef} onGestureEvent={gestureHandler}>
          <Animated.View style={[animatedCardStyle, { width: '100%', position: 'relative', zIndex: 200 }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={{ flex: 1 }}
              onPress={() => {
                const card = cardData[currentCard];
                handleCardPress(card.type, card);
              }}
            >
              {renderCard(currentCard, 0, (mode: 'stack' | 'document') => setViewMode(mode))}
            </TouchableOpacity>
          </Animated.View>
        </PanGestureHandler>
      </View>
    );
  };

  const renderDocumentCards = () => {
    // Add ref for ScrollView
    const scrollRef = useRef<ScrollView>(null);

    // Detect if challenge card is visible
    const handleScroll = (event: any) => {
      // Get layout of challenge card
      // We'll use a ref to the challenge card view
      if (challengeCardRef.current && scrollRef.current) {
        challengeCardRef.current.measureLayout(
          scrollRef.current.getInnerViewNode(),
          (x, y, width, height) => {
            // y is the distance from the top of the ScrollView content
            // If y is within the visible area, the card is visible
            const scrollY = event.nativeEvent.contentOffset.y;
            const visibleHeight = event.nativeEvent.layoutMeasurement.height;
            if (y < scrollY + visibleHeight && y + height > scrollY) {
              setHasReachedLastCard(true);
            }
          },
          () => {}
        );
      }
    };
    const challengeCardRef = useRef<View>(null);

    return (
      <ScrollView
        ref={scrollRef}
        style={styles.docContainer}
        contentContainerStyle={styles.docContentContainer}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <TruthInLoveCard
          key="truth"
          truth={playbook.truthInLove?.text ?? ''}
          summary={playbook.truthInLove?.summary ?? ''}
          expanded={true}
          style={[styles.docCard, styles.truthCard]}
        />
        <ActionStepsCard
          key="action"
          style={[styles.docCard, styles.actionCard]}
        />
        <View key="affirmation" style={[styles.docCard, styles.affirmationsCard]}>
          <View style={styles.affirmationsHeader}>
            <MaterialCommunityIcons
              name="format-quote-close"
              size={24}
              color="white"
              style={[styles.icon, { transform: [{ scaleX: -1 }] }]}
            />
            <Text style={styles.affirmationsTitle}>Affirmations</Text>
          </View>
          {(() => {
            // Debug: log affirmations right before rendering
            console.log('[DEBUG] Rendering affirmations:', {
              affirmations: playbook.affirmations,
              isArray: Array.isArray(playbook.affirmations),
              length: playbook.affirmations?.length,
              filtered: Array.isArray(playbook.affirmations)
                ? playbook.affirmations.filter((affirmation) =>
                    affirmation !== undefined &&
                    affirmation.id !== undefined &&
                    affirmation.text !== undefined &&
                    affirmation.completed !== undefined
                  )
                : undefined,
            });
            return (
              <View style={styles.affirmationsList}>
                {Array.isArray(playbook.affirmations) && playbook.affirmations.length > 0 ? (
                  playbook.affirmations
                    .filter((affirmation): affirmation is Required<Affirmation> =>
                      affirmation !== undefined &&
                      affirmation.id !== undefined &&
                      affirmation.text !== undefined &&
                      affirmation.completed !== undefined
                    )
                    .map((affirmation) => (
                      <AffirmationCard
                        key={affirmation.id}
                        id={affirmation.id}
                        text={affirmation.text}
                        completed={affirmation.completed}
                      />
                    ))
                ) : (
                  <Text style={styles.noAffirmationsText}>No affirmations</Text>
                )}
              </View>
            );
          })()}

        </View>
        <BibleVerseCard
          key="bible"
          verse={playbook.bibleVerse ?? { text: '', reference: '' }}
          style={[styles.docCard, styles.bibleCard]}
        />
        <View key="challenge" style={[styles.docCard, styles.challengeCard]} ref={challengeCardRef}>
          <DirectChallengeCard
            challenge={typeof playbook.directChallenge === 'string'
              ? playbook.directChallenge
              : playbook.directChallenge?.text ?? ''}
            challengeCTA={playbook.challengeCTA ?? ''}
          />
        </View>
      </ScrollView>
    );
  };

  // Check if we're on the challenge card (last card in the array)
  const isChallengeCardVisible = currentCard === cardData.length - 1;
  useEffect(() => {
    if (viewMode === 'stack' && isChallengeCardVisible) {
      setHasReachedLastCard(true);
    } else if (viewMode === 'document') {
      setHasReachedLastCard(false); // Reset when switching to document view
    }
  }, [viewMode, isChallengeCardVisible]);

  return (
    <View style={styles.container}>
      {renderContent()}
      {viewMode === 'stack' && currentCard === 0 && !showUserInput && !hasSeenSwipeUp && (
        <View style={styles.swipeUpIndicatorContainer}>
          <SwipeUpIndicator />
        </View>
      )}

      <View style={[styles.bottomButtonContainer, showUserInput && styles.bottomButtonExpanded]}>
        {/* Devotional Button - Show if last card reached in either view and not already created */}
        {hasReachedLastCard && !hasCreatedDevotional && (
          <View style={styles.devotionalButtonWrapper}>
            <DevotionalButton
              onPress={() => setShowDevotionalModal(true)}
              visible={hasReachedLastCard}
            />
          </View>
        )}
      </View>

      {/* Devotional Creation Modal */}
      <DevotionalModal
        visible={showDevotionalModal}
        onClose={() => setShowDevotionalModal(false)}
        onSelectDuration={handleCreateDevotional}
        userStruggle={playbook.userInput}
        playbookInfo={playbook.userInput}
      />
    </View>
  );
}

// Define proper types for styles
interface PlaybookDetailStyles {
  stackCard: ViewStyle;
  noAffirmationsText: TextStyle;
  headerSafeArea: ViewStyle;
  headerContainer: ViewStyle;
  backButton: ViewStyle;
  headerRight: ViewStyle;
  docContainer: ViewStyle;
  docContentContainer: ViewStyle;
  docCard: ViewStyle;
  container: ViewStyle;
  contentContainer: ViewStyle;
  loadingContainer: ViewStyle;
  playbookInfoContainer: ViewStyle;
  playbookHeader: ViewStyle;
  headerTitleContainer: ViewStyle;
  headerTitle: TextStyle;
  playbookLabelRow: ViewStyle;
  playbookLabel: TextStyle;
  cardStackContainer: ViewStyle;
  swipeUpIndicatorContainer: ViewStyle;
  playbookTitle: TextStyle;
  creationDate: TextStyle;
  progressAndViewRow: ViewStyle;
  progressContainer: ViewStyle;
  progressRow: ViewStyle;
  progressBarBg: ViewStyle;
  progressBarFill: ViewStyle;
  progressText: TextStyle;
  userInputCard: ViewStyle;
  userInputText: TextStyle;
  viewToggleContainer: ViewStyle;
  viewToggle: ViewStyle;
  iconContainer: ViewStyle;
  iconContainerActive: ViewStyle;
  viewToggleDivider: ViewStyle;
  mainContainer: ViewStyle;
  truthCard: ViewStyle;
  actionCard: ViewStyle;
  affirmationsCard: ViewStyle;
  bibleCard: ViewStyle;
  challengeCard: ViewStyle;
  cardNavigation: ViewStyle;
  navButton: ViewStyle;
  navButtonDisabled: ViewStyle;
  navButtonText: TextStyle;
  cardIndicator: ViewStyle;
  cardIndicatorText: TextStyle;
  affirmationsHeader: ViewStyle;
  icon: ImageStyle;
  affirmationsList: ViewStyle;
  affirmationsTitle: TextStyle;
  compactHeaderContainer: ViewStyle;
  bottomButtonContainer: ViewStyle;
  bottomButtonExpanded: ViewStyle;
  devotionalButtonWrapper: ViewStyle;
}

const styles = StyleSheet.create<PlaybookDetailStyles>({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
    position: 'relative',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
  },
  headerSafeArea: {
    backgroundColor: Colors.hopeWhite,
    width: '100%',
    marginBottom: -10,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.trustGrey,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerRight: {
    width: 40,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.anchorBlue,
    textAlign: 'center',
  },
  playbookInfoContainer: {
    backgroundColor: '#f2f5f7',
    paddingHorizontal: 20,
    paddingTop: 8,  // Reduced from 12
    paddingBottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  playbookHeader: {
    marginBottom: 8,
  },
  playbookLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  playbookLabel: {
    fontSize: 14,
    color: Colors.trustGrey,
    marginRight: 8,
  },
  playbookTitle: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '700',
    color: Colors.anchorBlue,
    marginBottom: 2,
    lineHeight: 34,
    textAlign: 'center',
  },
  creationDate: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: Colors.trustGrey,
    marginTop: 2,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    opacity: 0.8,
    textAlign: 'center',
  },
  progressAndViewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressContainer: {
    flex: 1,
    marginRight: 16,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBg: {
    flex: 1,
    height: 12,
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 6,
  },
  progressText: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.anchorBlue,
    marginRight: 4,
  },
  userInputCard: {
    backgroundColor: 'rgba(26, 60, 109, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  userInputText: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: Colors.anchorBlue,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    height: 36,
    alignItems: 'center',
  },
  viewToggle: {
    padding: 4,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: Colors.faithGold,
  },
  viewToggleDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 0, // Reduced from 6 to decrease space between header and cards
  },
  cardStackContainer: {
    flex: 1,
    position: 'relative',
    marginBottom: 20,
  },
  swipeUpIndicatorContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  bottomButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    zIndex: 100,
    paddingHorizontal: 20,
  },
  bottomButtonExpanded: {
    bottom: 'auto',
    top: '100%',
    marginTop: -24, // Adjust this value to position the button relative to the expanded content
  },
  devotionalButtonWrapper: {
    marginTop: 20, // Add some space between the expanded content and the button
  },
  stackCard: {
    width: SCREEN_WIDTH - 80,
    height: 450,
    alignSelf: 'center',
    borderRadius: 28,
    backgroundColor: Colors.anchorBlue,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    padding: 0,
    overflow: 'hidden',
  },
  truthCard: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 28,
    padding: 32,
    marginBottom: 16,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    width: '100%',
    alignSelf: 'center',
  },
  actionCard: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    width: '100%',
    alignSelf: 'center',
  },
  affirmationsCard: {
    backgroundColor: Colors.anchorBlue,
    padding: 24,
    marginBottom: 0,
    borderRadius: 28,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    width: '100%',
    alignSelf: 'center',
    flex: 1,
  },
  bibleCard: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 24,
    padding: 24,
    marginTop: 16,
    marginBottom: 16,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    width: '100%',
    alignSelf: 'center',
  },
  challengeCard: {
    backgroundColor: Colors.alertCoral,
    borderRadius: 24,
    padding: 2,
    marginBottom: 16,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    width: '100%',
    alignSelf: 'center',
  },
  cardNavigation: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 57, 104, 0.7)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  navButtonDisabled: {
    backgroundColor: 'rgba(25, 57, 104, 0.3)',
    opacity: 0.5,
  },
  navButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  cardIndicator: {
    backgroundColor: 'rgba(25, 57, 104, 0.7)',
    borderRadius: 15,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  cardIndicatorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  affirmationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  icon: {
    marginRight: 8,
  },
  affirmationsList: {
    gap: 12,
  },
  affirmationsTitle: {
    fontFamily: 'Inter-Black',
    fontSize: 20,
    color: Colors.hopeWhite,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  noAffirmationsText: {
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  docContainer: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  docContentContainer: {
    paddingTop: 0, // Reduced from 60 to decrease space between header and cards
    paddingBottom: 32,
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  compactHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: Colors.hopeWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  docCard: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    marginBottom: 16,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
});

// React & React Native
import React, { useState, useRef, useEffect } from 'react';
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
import AffirmationCard from '../components/AffirmationCard';
import BibleVerseCard from '../components/BibleVerseCard';
import DirectChallengeCard from '../components/DirectChallengeCard';
import SwipeUpIndicator from '../components/SwipeUpIndicator';
import PlaybookHeader from '../components/PlaybookHeader';
import DocumentCards from '../components/DocumentCards';

// Types & Context
import { Playbook, ActionStep, Affirmation } from '../interfaces/playbook';
import { useActionSteps } from '../context/ActionStepsContext';

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
  const [hasSeenSwipeUp, setHasSeenSwipeUp] = useState(false);
  const { actionSteps, handleToggleStep, getCompletedStepsCount } = useActionSteps();
  const playbook = route.params.playbook;

  // Calculate progress
  const { completed, total } = getCompletedStepsCount();
  const progress = total > 0 ? (completed / total) * 100 : 0;

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

  // Card data
  const cardData: CardData[] = [
    {
      type: 'truth',
      truth: playbook.truthInLove?.text ?? '',
      summary: playbook.truthInLove?.summary ?? '',
      tappable: false,
    },
    {
      type: 'action',
      steps: actionSteps ?? [],
      tappable: false,
    },
    {
      type: 'affirmation',
      affirmations: playbook.affirmations ?? [],
      tappable: false,
    },
    {
      type: 'bible',
      verse: {
        text: playbook.bibleVerse?.text ?? '',
        reference: playbook.bibleVerse?.reference ?? ''
      },
      tappable: false,
    },
    {
      type: 'challenge',
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
      headerFaded.value = false;
    } else {
      goToPrevCard();
      headerOpacity.value = withTiming(1, { duration: 200 });
      headerFaded.value = false;
    }
    requestAnimationFrame(() => {
      translateY.value = 0;
      isTransitioning.value = false;
    });
  };

  // Shared values for worklet access
  const cardCount = useSharedValue(cardData.length);
  const currentCardIndex = useSharedValue(currentCard);

  useEffect(() => {
    cardCount.value = cardData.length;
  }, [cardData.length]);

  useEffect(() => {
    currentCardIndex.value = currentCard;
  }, [currentCard]);

  const headerFaded = useSharedValue(false);
  const headerOpacity = useSharedValue(1);
  const animatedHeaderStyle = useAnimatedStyle(() => ({ opacity: headerOpacity.value }));

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
          if (translateY.value < threshold && !headerFaded.value) {
            headerFaded.value = true;
            headerOpacity.value = withTiming(0, { duration: 200 });
          } else if (translateY.value >= threshold && headerFaded.value) {
            headerFaded.value = false;
            headerOpacity.value = withTiming(1, { duration: 200 });
          }
        }
      }
    },
    onEnd: (event, ctx: GestureContext) => {
      if (isTransitioning.value) return;

      const isVerticalSwipe = Math.abs(event.translationY) > Math.abs(event.translationX);
      if (isVerticalSwipe) {
        if (event.translationY < -SWIPE_THRESHOLD && currentCardIndex.value < cardCount.value - 1) {
          isTransitioning.value = true;
          translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 250 }, (finished) => {
            if (finished) {
              runOnJS(onSwipeComplete)('up');
            }
          });
        } else if (event.translationY > SWIPE_THRESHOLD && currentCardIndex.value > 0) {
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
      setCurrentCard(currentCard + 1);
    }
  };

  const goToPrevCard = () => {
    if (currentCard > 0) {
      setCurrentCard(currentCard - 1);
    }
  };

  const handleCardPress = (cardType: CardType, cardData: CardData) => {
    const { tappable, ...serializableCardData } = cardData;
    navigation.navigate('CardDetail', {
      cardType,
      cardData: serializableCardData,
      playbook,
      progress,
      totalTasks: actionSteps.length,
      viewMode,
      onToggleView: (mode: 'stack' | 'document') => setViewMode(mode),
    });
  };

  const [showUserInput, setShowUserInput] = useState(false);

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

  const renderContent = () => (
    <View style={styles.contentContainer}>
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
        totalTasks={actionSteps.length}
        showToggle={true}
        viewMode={viewMode}
        onToggleView={(mode: 'stack' | 'document') => setViewMode(mode)}
        onPlaybookLabelPress={() => setShowUserInput(!showUserInput)}
        showUserInput={showUserInput}
        userInput={playbook.userInput}
        chevronAnimatedStyle={chevronStyle}
        showTitle={false}
      />
      <View style={styles.mainContainer}>
        {viewMode === 'stack' ? renderStackCards() : <DocumentCards playbook={playbook} actionSteps={actionSteps} styles={styles} />}
      </View>
    </View>
  );

  const renderPlaybookInfo = () => {
    const titleMatch = playbook.title.match(/^(.+?)(?::\s|$)([^:]*)$/);
    const firstLine = titleMatch ? titleMatch[1] + (titleMatch[2] ? ':' : '') : playbook.title;
    const secondLine = titleMatch ? titleMatch[2].trim() : '';

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
    if (cardData.length === 0) return null;

    const visibleCardCount = Math.min(5, cardData.length - currentCard);

    const getCardColor = (index: number) => {
      if (index >= cardData.length - 1) {
        return Colors.anchorBlue;
      }
      const lightenAmount = index * 0.15;
      const color = Colors.anchorBlue;
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const lighten = (value: number) => Math.min(255, Math.floor(value + (255 - value) * lightenAmount));
      const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');
      return `#${toHex(lighten(r))}${toHex(lighten(g))}${toHex(lighten(b))}`;
    };

    const renderCard = (cardIndex: number, stackIndex: number, onToggleView: (mode: 'stack' | 'document') => void) => {
      const card = cardData[cardIndex];
      if (!card) return null;

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
          {card.type === 'truth' ? (
            <TruthInLoveCard
              truth={card.truth ?? ''}
              summary={card.summary ?? ''}
              style={{ flex: 1, padding: 32 }}
            />
          ) : card.type === 'action' ? (
            <ActionStepsCard steps={card.steps ?? []} style={{ flex: 1, padding: 24 }} />
          ) : card.type === 'affirmation' ? (
            <View style={[styles.affirmationsCard, { flex: 1, width: '100%' }]}>
              <View style={styles.affirmationsHeader}>
                <MaterialCommunityIcons
                  name="format-quote-close"
                  size={24}
                  color="white"
                  style={[styles.icon, { transform: [{ scaleX: -1 }] }]}
                />
                <Text style={styles.affirmationsTitle}>Affirmations</Text>
              </View>
              <View style={styles.affirmationsList}>
                {Array.isArray(card.affirmations) && card.affirmations.length > 0 ? (
                  card.affirmations.map((affirmation) => (
                    <AffirmationCard
                      key={affirmation?.id ?? ''}
                      id={affirmation?.id ?? ''}
                      text={affirmation?.text ?? ''}
                      completed={affirmation?.completed ?? false}
                    />
                  ))
                ) : (
                  <Text style={styles.noAffirmationsText}>No affirmations</Text>
                )}
              </View>
            </View>
          ) : card.type === 'bible' ? (
            <BibleVerseCard verse={card.verse} />
          ) : card.type === 'challenge' ? (
            <View style={{ flex: 1, backgroundColor: Colors.alertCoral, borderRadius: 24 }}>
              <DirectChallengeCard
                challenge={typeof card.challenge === 'string' ? card.challenge : card.challenge?.text ?? ''}
                challengeCTA={card.challengeCTA ?? ''}
              />
            </View>
          ) : (
            <View style={{ flex: 1, padding: 24 }} />
          )}
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

  const renderDocumentCards = () => (
    <ScrollView style={styles.docContainer} contentContainerStyle={styles.docContentContainer}>
      <TruthInLoveCard
        key="truth"
        truth={playbook.truthInLove?.text ?? ''}
        summary={playbook.truthInLove?.summary ?? ''}
        expanded={true}
        style={[styles.docCard, styles.truthCard]}
      />
      <ActionStepsCard
        key="action"
        steps={actionSteps ?? []}
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
      </View>
      <BibleVerseCard
        key="bible"
        verse={playbook.bibleVerse ?? { text: '', reference: '' }}
        style={[styles.docCard, styles.bibleCard]}
      />
      <View key="challenge" style={[styles.docCard, styles.challengeCard]}>
        <DirectChallengeCard
          challenge={typeof playbook.directChallenge === 'string'
            ? playbook.directChallenge
            : playbook.directChallenge?.text ?? ''}
          challengeCTA={playbook.challengeCTA ?? ''}
        />
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      
      {renderContent()}
      {viewMode === 'stack' && currentCard === 0 && !showUserInput && !hasSeenSwipeUp && (
        <View style={styles.swipeUpIndicatorContainer}>
          <SwipeUpIndicator />
        </View>
      )}
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
    paddingTop: 12,
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
    paddingTop: 6,
  },
  cardStackContainer: {
    flex: 1,
    position: 'relative',
    marginBottom: 20,
  },
  swipeUpIndicatorContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
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
    paddingTop: 4,
    paddingBottom: 60,
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
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
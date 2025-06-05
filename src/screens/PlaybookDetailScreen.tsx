import React, { useState, useEffect, useRef } from 'react';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedGestureHandler, withSpring, withTiming, runOnJS, withSequence } from 'react-native-reanimated';
import {
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Text,
  View,
  Image,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Platform
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Fonts, FontWeights } from '../theme';
import TruthInLoveCard from '../components/TruthInLoveCard';
import ActionStepsCard from '../components/ActionStepsCard';
import { useActionSteps } from '../context/ActionStepsContext';
import AffirmationCard from '../components/AffirmationCard';
import BibleVerseCard from '../components/BibleVerseCard';
import DirectChallengeCard from '../components/DirectChallengeCard';
import SwipeUpIndicator from '../components/SwipeUpIndicator';
import { Playbook } from '../interfaces/playbook';
import { getMockPlaybook } from '../mocks/playbookMocks';
import PlaybookHeader from '../components/PlaybookHeader';

// Types
type PlaybookScreenProps = {
  route: {
    params: {
      playbook: Playbook;
    };
  };
  navigation: any;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Types
const CARD_TYPES = [
  'truth',
  'action',
  'affirmation',
  'bible',
  'challenge',
] as const;
type CardType = typeof CARD_TYPES[number];

// Get playbook data from route params


export default function PlaybookDetailScreen({ route, navigation }: PlaybookScreenProps) {
  // ...existing hooks and logic
  const [hasSeenSwipeUp, setHasSeenSwipeUp] = useState(false);
  const { actionSteps, handleToggleStep, getCompletedStepsCount } = useActionSteps();
  const playbook = route.params.playbook;
  
  // Calculate progress
  const { completed, total } = getCompletedStepsCount();
  const progress = total > 0 ? (completed / total) * 100 : 0;


  if (!playbook) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading playbook...</Text>
      </View>
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
  // Only include serializable data for each card
  const cardData = [
    {
      type: 'truth' as CardType,
      truth: playbook.truthInLove.text,
      summary: playbook.truthInLove.summary,
      tappable: false,
    },
    {
      type: 'action' as CardType,
      steps: actionSteps,
      tappable: false,
    },
    {
      type: 'affirmation' as CardType,
      affirmations: playbook.affirmations,
      tappable: false,
    },
    {
      type: 'bible' as CardType,
      verse: playbook.bibleVerse || { text: '', reference: '' },
      tappable: false,
    },
    {
      type: 'challenge' as CardType,
      challenge: playbook.directChallenge,
      challengeCTA: playbook.challengeCTA,
      tappable: false,
    },
  ];

  const onSwipeComplete = (direction: 'up' | 'down') => {
    if (direction === 'up') {
      goToNextCard();
    } else {
      goToPrevCard();
    }
    // Reset the position after a small delay to allow the card to animate out
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

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startY = translateY.value;
      ctx.startX = 0; // Track X position for potential horizontal swipes
    },
    onActive: (event, ctx: any) => {
      if (!isTransitioning.value) {
        // Only allow vertical swipes by ignoring horizontal movement
        if (Math.abs(event.translationY) > Math.abs(event.translationX)) {
          translateY.value = ctx.startY + event.translationY;
        }
      }
    },
    onEnd: (event, ctx: any) => {
      if (isTransitioning.value) return;
      
      // Check if it's primarily a vertical swipe
      const isVerticalSwipe = Math.abs(event.translationY) > Math.abs(event.translationX);
      
      if (isVerticalSwipe) {
        if (event.translationY < -SWIPE_THRESHOLD && currentCardIndex.value < cardCount.value - 1) {
          // Swipe up - go to next card
          isTransitioning.value = true;
          translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 250 }, (finished) => {
            if (finished) {
              runOnJS(onSwipeComplete)('up');
            }
          });
        } else if (event.translationY > SWIPE_THRESHOLD && currentCardIndex.value > 0) {
          // Swipe down - go to previous card
          isTransitioning.value = true;
          translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, (finished) => {
            if (finished) {
              runOnJS(onSwipeComplete)('down');
            }
          });
        } else {
          // Not enough swipe, bounce back
          translateY.value = withSpring(0, { 
            damping: 10, 
            stiffness: 150 
          });
        }
      } else {
        // If not a vertical swipe, reset position
        translateY.value = withSpring(0, { 
          damping: 10, 
          stiffness: 150 
        });
      }
    },
  });

  // Nudge animation for the first card and bounce for new front cards
  const nudgeY = useSharedValue(0);
  const bounceY = useSharedValue(0);
  const prevCardRef = useRef(currentCard);

  // Animation for card press with scale and shadow
  const cardScale = useSharedValue(1);
  const shadowElevation = useSharedValue(4);
  const shadowOpacity = useSharedValue(0.15);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { 
        translateY: translateY.value + 
          (currentCard === 0 ? nudgeY.value : 0) + 
          (currentCard > 0 ? bounceY.value : 0)
      },
      { scale: cardScale.value },
    ],
    shadowOpacity: shadowOpacity.value,
    elevation: shadowElevation.value,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    shadowColor: '#000',
  }));

  // Handle card change animations
  React.useEffect(() => {
    // First card nudge animation
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

    // Slower, more deliberate bounce animation when a new card becomes the front card
    if (currentCard !== prevCardRef.current) {
      bounceY.value = withSequence(
        withTiming(-15, { duration: 100 }), // Slower upward movement
        withSpring(0, { 
          damping: 12,  // Slightly reduced damping for a more fluid motion
          stiffness: 100, // Reduced stiffness for slower movement
          mass: 1.5, // Increased mass for more weight
          overshootClamping: false
        })
      );
      prevCardRef.current = currentCard;
    }
  }, [currentCard]);

  

  // Define card data with access to playbook


  if (!playbook) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading playbook...</Text>
      </View>
    );
  }
  
  // Navigation handlers for card stack
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

  // Handle card press to navigate to detail view
  const handleCardPress = (cardType: string, cardData: any) => {
    // Remove non-serializable properties (like 'component') before navigating
    const { component, ...serializableCardData } = cardData;
    navigation.navigate('CardDetail', {
      cardType,
      cardData: serializableCardData,
      playbook,
      progress: playbook.progress,
      totalTasks: playbook.totalTasks,
      viewMode,
      // Do NOT pass onToggleView/setViewMode in navigation params
    });
  };

  // State for toggling user input card
  const [showUserInput, setShowUserInput] = useState(false);
  
  // Title style with enhanced boldness
  const titleStyle = [
    styles.playbookTitle,
    {
      fontSize: 26, // Slightly larger for better presence
      color: Colors.anchorBlue,
      ...Platform.select({
        ios: {
          fontFamily: 'Georgia-Bold', // Direct bold variant for iOS
          fontWeight: '900', // Maximum boldness
        },
        android: {
          fontFamily: 'serif',
          fontWeight: 'bold',
          includeFontPadding: false, // Remove extra padding
        },
      }),
      textShadowColor: 'rgba(0, 0, 0, 0.1)', // Subtle shadow for depth
      textShadowOffset: { width: 0.5, height: 0.5 },
      textShadowRadius: 1,
      letterSpacing: 0.3 // Slight letter spacing for better readability
    }
  ];

  // Header with safe area for status bar
  const renderHeader = () => (
    <SafeAreaView style={styles.headerSafeArea}>
      <View style={styles.headerContainer} />
    </SafeAreaView>
  );
  
  // Main content container with proper spacing
  const renderContent = () => (
    <View style={styles.contentContainer}>
      <View>
        <PlaybookHeader
          title={playbook.title}
          subtitle={playbook.createdAt ? new Date(playbook.createdAt).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          }) : ''}
          progress={playbook.progress}
          totalTasks={playbook.totalTasks}
          showToggle={true}
          viewMode={viewMode}
          onToggleView={(mode: 'stack' | 'document') => setViewMode(mode)}
          onPlaybookLabelPress={() => setShowUserInput((prev) => !prev)}
          showUserInput={showUserInput}
          userInput={playbook.userInput}
          chevronAnimatedStyle={chevronStyle}
        />
      </View>
      <View style={styles.mainContainer}>
        {viewMode === 'stack' ? renderStackCards() : renderDocumentCards()}
      </View>
    </View>
  );

  // Playbook info section with collapsible user input
  // Animation for chevron rotation (reanimated)

  // --- MOVE THESE TO THE TOP LEVEL, NOT INSIDE renderPlaybookInfo ---
  // Place after all useState/useEffect hooks, before any render functions
  // (This is the main fix for the animation bug)
  const chevronAnim = useSharedValue(0);
  useEffect(() => {
    chevronAnim.value = withTiming(showUserInput ? 1 : 0, { duration: 200 });
  }, [showUserInput]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAnim.value * 180}deg` }],
    marginLeft: 4,
  }));

  const renderPlaybookInfo = () => {
    // Split title at first colon followed by space or end of string (but not for Bible verses like John 3:15)
    const titleMatch = playbook.title.match(/^(.+?)(?::\s|$)([^:]*)$/);
    const firstLine = titleMatch ? titleMatch[1] + (titleMatch[2] ? ':' : '') : playbook.title;
    const secondLine = titleMatch ? titleMatch[2].trim() : '';
    
    return (
      <View style={styles.playbookInfoContainer}>
        {/* Playbook header with toggle */}
        <View style={styles.playbookHeader}>
          <TouchableOpacity 
            style={styles.playbookLabelRow}
            onPress={() => setShowUserInput(!showUserInput)}
            activeOpacity={0.7}
          >
            <Text style={styles.playbookLabel}>PLAYBOOK</Text>
            <Animated.View style={chevronStyle}>
              <Ionicons 
                name="chevron-down"
                size={15} 
                color={Colors.anchorBlue}
              />
            </Animated.View>
          </TouchableOpacity>

          {/* User Input Card - Collapsible */}
          {showUserInput && playbook.userInput && (
            <View style={styles.userInputCard}>
              <Text style={styles.userInputText}>{playbook.userInput}</Text>
            </View>
          )}
          
          {/* Title with line break */}
          <Text style={styles.playbookTitle}>
            {firstLine}
          </Text>
          {secondLine ? (
            <Text style={[styles.playbookTitle, { marginTop: -8 }]}>
              {secondLine}
            </Text>
          ) : null}
          
          {/* Creation Date */}
          <Text style={styles.creationDate}>
            {new Date(playbook.createdAt || new Date()).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }).toUpperCase()}
          </Text>
          
          {/* Progress and View Toggle Row */}
          <View style={styles.progressAndViewRow}>
            <View style={styles.progressContainer}>
              <View style={styles.progressRow}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill, 
                      { width: `${(actionSteps.length > 0 ? (actionSteps.filter(step => step.completed).length / actionSteps.length) * 100 : 0)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {actionSteps.filter(step => step.completed).length}/{actionSteps.length} Steps
                </Text>
              </View>
            </View>
            
            {/* View Toggle Icons */}
            <View style={styles.viewToggleContainer}>
              <TouchableOpacity
                style={styles.viewToggle}
                onPress={() => setViewMode('stack')}
              >
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
              <TouchableOpacity
                style={styles.viewToggle}
                onPress={() => setViewMode('document')}
              >
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

  // Stack Card View with fan-out effect
  const renderStackCards = () => {
    if (cardData.length === 0) return null;
    
    // Number of cards to show in the stack (all cards)
    const visibleCardCount = Math.min(5, cardData.length - currentCard);
    
    // Helper to calculate color based on card type
    const getCardColor = (index: number) => {
      // For the last card, return the original color
      if (index >= cardData.length - 1) {
        return Colors.anchorBlue;
      }
      
      // Lighten the anchor blue color for cards in the back (except last)
      const lightenAmount = index * 0.15; // 15% lighter per card
      const color = Colors.anchorBlue;
      // Convert hex to RGB
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      // Lighten the color by moving towards white
      const lighten = (value: number) => Math.min(255, Math.floor(value + (255 - value) * lightenAmount));
      // Convert back to hex
      const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');
      return `#${toHex(lighten(r))}${toHex(lighten(g))}${toHex(lighten(b))}`;
    };
    
    // Render a single card
    const renderCard = (cardIndex: number, stackIndex: number) => {
      const card = cardData[cardIndex];
      if (!card) return null;
      
      // Calculate scale and offset for the fan-out effect
      // Scale width more than height for a better visual effect
      const scaleY = 1 - (stackIndex * 0.01); // Very subtle vertical scaling
      const scaleX = 1 - (stackIndex * 0.03); // More pronounced horizontal scaling
      const translateY = stackIndex * 8;
      const zIndex = 100 - stackIndex;
      // Gradually fade all back cards lighter (not just the last one)
      const isCurrentCard = cardIndex === currentCard;
      const isTopCard = stackIndex === 0;
      // For back cards, fade lighter the further back they are: 0.85 (just behind top), 0.8, ..., 0.7 (furthest back)
      const opacity = isTopCard ? 1 : Math.max(0.7, 0.85 - (stackIndex - 1) * 0.075);
      
      // Only the top card animates. Back cards are static.
      const CardContainer = isTopCard ? Animated.View : View;
      // Only apply animatedCardStyle to the top card
      const extraStyle = isTopCard ? animatedCardStyle : {};
      // For back cards, use only static transforms and opacity (not tied to animation)
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
                  // keep transforms for stacking effect
                  transform: !isTopCard ? [
                    { scaleX },
                    { scaleY },
                    { translateY },
                  ] : undefined,
                  zIndex,
                  opacity: !isTopCard ? opacity : 1,
                  position: stackIndex === 0 ? 'relative' : 'absolute',
                  top: 0,
                  left: undefined,
                  right: undefined,
                  bottom: 0,
                  alignSelf: 'center',
                }
              : {
                  backgroundColor: getCardColor(stackIndex),
                  transform: !isTopCard ? [
                    { scaleX },
                    { scaleY },
                    { translateY },
                  ] : undefined,
                  zIndex,
                  opacity: !isTopCard ? opacity : 1,
                  position: stackIndex === 0 ? 'relative' : 'absolute',
                  top: 0,
                  left: undefined,
                  right: undefined,
                  bottom: 0,
                  alignSelf: 'center',
                  elevation: 5 - stackIndex, // for Android shadow
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
              truth={playbook.truthInLove.text}
              summary={playbook.truthInLove.summary}
              style={{ flex: 1, padding: 32 }}
            />
          ) : card.type === 'action' ? (
            <ActionStepsCard 
              steps={actionSteps}
              style={{ flex: 1, padding: 24 }}
            />
          ) : card.type === 'affirmation' ? (
            <View style={[styles.affirmationsCard, { flex: 1, width: '100%' }]}> 
  <View style={styles.affirmationsHeader}>
    <MaterialCommunityIcons name="format-quote-close" size={24} color="white" style={[styles.icon, { transform: [{ scaleX: -1 }] }]} />
    <Text style={styles.affirmationsTitle}>Affirmations</Text>
  </View>
  <View style={styles.affirmationsList}>
    {Array.isArray(card.affirmations) && card.affirmations.length > 0 ? (
      card.affirmations.map((affirmation) => (
        <AffirmationCard
          key={affirmation.id}
          id={affirmation.id}
          text={affirmation.text}
          completed={affirmation.completed}
        />
      ))
    ) : (
      <Text style={{ color: '#fff', textAlign: 'center' }}>No affirmations</Text>
    )}
  </View>
</View>
          ) : card.type === 'bible' ? (
            <BibleVerseCard verse={card.verse} />
          ) : card.type === 'challenge' ? (
            <View style={{ flex: 1, backgroundColor: Colors.alertCoral, borderRadius: 24 }}>
              <DirectChallengeCard challenge={playbook.directChallenge} challengeCTA={playbook.challengeCTA} />
            </View>
          ) : (
            <View style={{ flex: 1, padding: 24 }}>
              {/* Render fallback for unknown type, or nothing */}
            </View>
          )}
        </TouchableOpacity>
      );
    };
    
    // Generate the stack of cards
    const cardStack = [];
    // Render back cards (static, never re-render or animate)
    const backCards = Array.from({ length: visibleCardCount - 1 }).map((_, i, arr) => {
      const stackIndex = arr.length - 1 - i + 1; // +1 to skip top card
      const cardIndex = currentCard + stackIndex;
      return renderCard(cardIndex, stackIndex);
    });

    return (
      <View style={styles.cardStackContainer}>
        {/* Back cards (static) */}
        {backCards}
        {/* Top card (animated, only one re-renders/animates) */}
        <PanGestureHandler
          ref={gestureHandlerRef}
          onGestureEvent={gestureHandler}
        >
          <Animated.View style={[animatedCardStyle, { width: '100%', position: 'relative', zIndex: 200 }]}> 
            {/* Tap-to-expand: always enable for demonstration; refine with truncation logic if needed */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={{ flex: 1 }}
                onPress={() => {
                  let cardType = cardData[currentCard].type;
                  let cardDataForDetail: any = {};
                  if (cardType === 'truth') {
                    cardDataForDetail = {
                      truth: playbook.truthInLove.text,
                      summary: playbook.truthInLove.summary
                    };
                  } else if (cardType === 'action') {
                    cardDataForDetail = {
                      steps: playbook.actionSteps
                    };
                  } else if (cardType === 'affirmation') {
                    cardDataForDetail = {
                      affirmations: playbook.affirmations
                    };
                  } else if (cardType === 'bible') {
                    cardDataForDetail = {
                      verse: playbook.bibleVerse
                    };
                  } else if (cardType === 'challenge') {
                    cardDataForDetail = {
                      challenge: playbook.directChallenge,
  challengeCTA: playbook.challengeCTA
                    };
                  }
                  navigation.navigate('CardDetail', {
                    cardType,
                    cardData: cardDataForDetail,
                    playbook,
                    progress: currentCard + 1,
                    totalTasks: cardData.length,
                    viewMode,
                    onToggleView: undefined // Optionally pass if needed
                  });
                }}
              >
                {renderCard(currentCard, 0)}
              </TouchableOpacity>
          </Animated.View>
        </PanGestureHandler>
      </View>
    );
  };

  // Document Card View
  const renderDocumentCards = () => (
    <ScrollView 
      style={styles.docContainer}
      contentContainerStyle={styles.docContentContainer}
    >
      <TruthInLoveCard 
        key="truth"
        truth={playbook.truthInLove?.text} 
        summary={playbook.truthInLove?.summary}
        expanded={true}
        style={[styles.docCard, styles.truthCard]}
      />
      <ActionStepsCard 
        key="action"
        steps={actionSteps}
        style={[styles.docCard, styles.actionCard]}
      />
      <View key="affirmation" style={[styles.docCard, styles.affirmationsCard]}> 
  <View style={styles.affirmationsHeader}>
    <MaterialCommunityIcons name="format-quote-close" size={24} color="white" style={[styles.icon, { transform: [{ scaleX: -1 }] }]} />
    <Text style={styles.affirmationsTitle}>Affirmations</Text>
  </View>
  <View style={styles.affirmationsList}>
    {playbook.affirmations?.map((affirmation) => (
      <AffirmationCard 
        key={affirmation.id}
        id={affirmation.id}
        text={affirmation.text} 
        completed={affirmation.completed} 
      />
    ))}
  </View>
  </View>
  <BibleVerseCard 
    key="bible"
    verse={playbook.bibleVerse} 
    style={[styles.docCard, styles.bibleCard, { marginTop: 16 }]}
  />
<View key="challenge" style={styles.challengeCard}>
  <DirectChallengeCard challenge={playbook.directChallenge} challengeCTA={playbook.challengeCTA} />
</View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderContent()}
      {/* SwipeUpIndicator only in stack view */}
      {viewMode === 'stack' && currentCard === 0 && !showUserInput && !hasSeenSwipeUp && (
        <View style={styles.swipeUpIndicatorContainer}>
          <SwipeUpIndicator />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Document view styles
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
    maxWidth: 500, // Constrain max width for better readability
    alignSelf: 'center',
  },
  docCard: {
    width: '100%',
    maxWidth: 380, // Slightly narrower for better aesthetics
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
  // Base container styles
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
    position: 'relative',
  },
  
  // Swipe indicator
  swipeUpIndicatorContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  
  // Card stack container
  cardStackContainer: {
    flex: 1,
    position: 'relative',
    marginBottom: 20,
  },
  
  // Main content container with max width
  contentContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 600, // Set a max-width for larger screens
    alignSelf: 'center',
  },
  headerSafeArea: {
    backgroundColor: '#f2f5f7',
    marginBottom: -10, // Reduce space below header
  },
  headerContainer: {
    height: 0, // No visible header, just safe area
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
  },
  
  // Playbook info styles
  playbookInfoContainer: {
    backgroundColor: '#f2f5f7',
    paddingHorizontal: 20,
    paddingTop: 12, // Reduced top padding
    paddingBottom: 0, // Reduced bottom padding
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 0, // Reset negative margin
    marginBottom: 0,
  },
  playbookHeader: {
    marginBottom: 8,
  },

  playbookLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  playbookLabel: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.anchorBlue,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 0,
  },
  chevronIcon: {
    marginLeft: 6,
  },
  playbookTitle: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '700',
    color: Colors.anchorBlue,
    marginTop: 0,
    marginBottom: 2,
    lineHeight: 34,
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
  },
  progressAndViewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12, // Reduced margin to bring cards up
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
    height: 12,  // Increased from 8 to 12
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
    borderRadius: 6,  // Increased from 4 to 6 to match the new height
    overflow: 'hidden',
    marginRight: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 6,  // Increased from 4 to 6 to match the new height
  },
  progressText: {
    fontFamily: 'System', // Default system font
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.anchorBlue,
    marginRight: 4,
  },
  
  // User input card
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
  viewToggleText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 13,
    color: Colors.trustGrey,
    marginLeft: 6,
  },
  viewToggleTextActive: {
    color: Colors.anchorBlue,
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  stackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    paddingBottom: 60,
    position: 'relative',
    overflow: 'visible',
  },
  stackCard: {
    position: 'absolute',
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

playbookLabelRow: {
flexDirection: 'row',
alignItems: 'center',
marginBottom: 2,
},
playbookLabel: {
fontFamily: 'System',
fontWeight: '600',
fontSize: 12,
lineHeight: 16,
color: Colors.anchorBlue,
textTransform: 'uppercase',
letterSpacing: 1,
marginBottom: 0,
},
chevronIcon: {
marginLeft: 6,
},
playbookTitle: {
fontFamily: 'System',
fontSize: 24,
fontWeight: '700',
color: Colors.anchorBlue,
marginTop: 0,
marginBottom: 2,
lineHeight: 34,
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
},
progressAndViewRow: {
flexDirection: 'row',
alignItems: 'center',
justifyContent: 'space-between',
marginBottom: 12, // Reduced margin to bring cards up
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
height: 12,  // Increased from 8 to 12
backgroundColor: 'rgba(26, 60, 109, 0.1)',
borderRadius: 6,  // Increased from 4 to 6 to match the new height
overflow: 'hidden',
marginRight: 8,
},
progressBarFill: {
height: '100%',
backgroundColor: Colors.growthGreen,
borderRadius: 6,  // Increased from 4 to 6 to match the new height
},
progressText: {
fontFamily: 'System', // Default system font
fontWeight: '500',
fontSize: 12,
lineHeight: 16,
color: Colors.anchorBlue,
marginRight: 4,
},

// User input card
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
viewToggleText: {
fontFamily: 'System',
fontWeight: '600',
fontSize: 13,
color: Colors.trustGrey,
position: 'relative',
overflow: 'visible',
},
stackCard: {
position: 'absolute',
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
borderWidth: 0,
transformOrigin: 'bottom center',
},
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 }, // Match stack card shadow
    shadowOpacity: 0.2, // Match stack card shadow
    shadowRadius: 12, // Match stack card shadow
    elevation: 8, // Match stack card elevation
    overflow: 'hidden',
    alignSelf: 'center',
  },
  truthCard: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 28,
    padding: 32,
    marginTop: 0, // Remove top margin to match stack view
    marginBottom: 16, // Keep bottom margin for spacing
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    width: '100%', // Full width of parent
    maxWidth: '100%', // Use percentage for valid DimensionValue
    alignSelf: 'center',
  },
  actionCard: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 28,
    padding: 24, // Standardized to match TruthInLoveCard
    marginBottom: 16,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    width: '100%',
    alignSelf: 'center',
  },
  defaultCard: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 28,
    padding: 0, // Remove default padding to handle it in the card content
    marginBottom: 16,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    width: '100%',
    alignSelf: 'center',
  },
  affirmationsCard: {
    backgroundColor: Colors.anchorBlue, // fully opaque
    padding: 24, // Standardized to match TruthInLoveCard
    marginBottom: 0, // Remove bottom margin since we'll handle spacing with marginTop on bibleCard
    borderRadius: 28,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    width: '100%',
    alignSelf: 'center',
    flex: 1, // fill parent for full coverage
  },
  bibleCard: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 24,
    padding: 24, // Standardized to match TruthInLoveCard
    marginTop: 16, // Add space above BibleVerse card
    marginBottom: 16, // Consistent bottom margin
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowColor: '#000',
    elevation: 8,
    width: '100%',
    alignSelf: 'center',
  },
  challengeCard: {
    backgroundColor: Colors.alertCoral,
    borderRadius: 24, // Match bibleCard/document card corners
    padding: 2, // Match all document card paddings
    marginBottom: 16,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    width: '100%', // Same as bibleCard
    alignSelf: 'center',
  },

  // New navigation controls
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
  affirmationsContainer: {
    width: '100%',
    flex: 1,
  },
  affirmationsList: {
    gap: 12,
  },
  affirmationsTitle: {
    fontFamily: 'Inter-Black',
    fontSize: 20,
    color: 'white',
    fontWeight: '900',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
});

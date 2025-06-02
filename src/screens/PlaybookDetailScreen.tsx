import React, { useState, useEffect, useRef } from 'react';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedGestureHandler, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
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
import AffirmationCard from '../components/AffirmationCard';
import BibleVerseCard from '../components/BibleVerseCard';
import DirectChallengeCard from '../components/DirectChallengeCard';
import { Playbook } from '../interfaces/playbook';
import { getMockPlaybook } from '../mocks/playbookMocks';

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
const usePlaybook = (playbook: Playbook) => {
  const [loading, setLoading] = useState(false);
  // If we need to fetch additional data in the future, we can do it here
  return { playbook, loading };
};



export default function PlaybookDetailScreen({ route, navigation }: PlaybookScreenProps) {
  // --- Animated swipe logic for top card ---
  const gestureHandlerRef = useRef(null);
  const SWIPE_THRESHOLD = 120; // px, for iOS-like swipe
  const translateY = useSharedValue(0);
  const isTransitioning = useSharedValue(false);

  // View state
  const [viewMode, setViewMode] = useState<'stack' | 'document'>('stack');
  const [currentCard, setCurrentCard] = useState(0);

  // Card data
  const cardData = [
    {
      type: 'truth' as CardType,
      component: () => (
        <TruthInLoveCard
          truth={playbook.truthInLove.truth}
          summary={playbook.truthInLove.summary}
        />
      ),
      tappable: false,
    },
    {
      type: 'action' as CardType,
      component: () => (
        <ActionStepsCard steps={playbook.actionSteps} />
      ),
      tappable: false,
    },
    {
      type: 'affirmation' as CardType,
      component: () => (
        <View style={styles.affirmationsContainer}>
          <View style={styles.affirmationsHeader}>
            <MaterialCommunityIcons
              name="format-quote-open"
              size={24}
              color={Colors.growthGreen}
              style={styles.icon}
            />
            <Text style={styles.affirmationsTitle}>Affirmations</Text>
          </View>
          <View style={styles.affirmationsList}>
            {playbook.affirmations.map(affirmation => (
              <AffirmationCard
                key={affirmation.id}
                id={affirmation.id}
                text={affirmation.text}
                completed={affirmation.completed}
              />
            ))}
          </View>
        </View>
      ),
      tappable: false,
    },
    {
      type: 'bible' as CardType,
      component: () => (
        <BibleVerseCard verse={playbook.bibleVerse} />
      ),
      tappable: false,
    },
    {
      type: 'challenge' as CardType,
      component: () => (
        <DirectChallengeCard challenge={playbook.directChallenge} />
      ),
      tappable: false,
    },
  ];

  const onSwipeComplete = (direction: 'up' | 'down') => {
    if (direction === 'up') {
      goToNextCard();
    } else {
      goToPrevCard();
    }
    translateY.value = 0;
    isTransitioning.value = false;
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
    },
    onActive: (event, ctx: any) => {
      if (!isTransitioning.value) {
        translateY.value = ctx.startY + event.translationY;
      }
    },
    onEnd: (event, ctx: any) => {
      if (isTransitioning.value) return;
      if (event.translationY < -SWIPE_THRESHOLD && currentCardIndex.value < cardCount.value - 1) {
        // Only allow swipe up if not on last card
        isTransitioning.value = true;
        translateY.value = withTiming(-700, { duration: 250 }, (finished) => {
          if (finished) {
            runOnJS(onSwipeComplete)('up');
          }
        });
      } else if (event.translationY > SWIPE_THRESHOLD && currentCardIndex.value > 0) {
        // Only allow swipe down if not on first card
        isTransitioning.value = true;
        translateY.value = withTiming(700, { duration: 250 }, (finished) => {
          if (finished) {
            runOnJS(onSwipeComplete)('down');
          }
        });
      } else {
        // Not enough swipe, bounce back
        translateY.value = withSpring(0, { damping: 10, stiffness: 150 });
      }
    },
  });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const { playbook: routePlaybook } = route.params;
  const { playbook: initialPlaybook, loading } = usePlaybook(routePlaybook);
  const [playbook, setPlaybook] = useState(initialPlaybook);
  
  // Update playbook when initialPlaybook changes
  useEffect(() => {
    if (initialPlaybook) {
      setPlaybook(initialPlaybook);
    }
  }, [initialPlaybook]);
  
  // Handle step completion toggle
  const toggleStepCompletion = (stepId: string) => {
    setPlaybook(prev => {
      const updatedSteps = prev.actionSteps.map(step => 
        step.id === stepId ? { ...step, completed: !step.completed } : step
      );
      
      const completedCount = updatedSteps.filter(step => step.completed).length;
      
      return {
        ...prev,
        actionSteps: updatedSteps,
        progress: completedCount,
        totalTasks: updatedSteps.length,
      };
    });
  };
  
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
      {renderPlaybookInfo()}
      <View style={styles.mainContainer}>
        {viewMode === 'stack' ? renderStackCards() : renderDocumentCards()}
      </View>
    </View>
  );

  // Playbook info section with collapsible user input
  const renderPlaybookInfo = () => {
    // Split title at first colon for two-line display
    const titleParts = playbook.title.split(':');
    const firstLine = titleParts[0] + (titleParts.length > 1 ? ':' : '');
    const secondLine = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : '';
    
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
            <Ionicons 
              name={showUserInput ? 'chevron-up' : 'chevron-down'}
              size={15} 
              color={Colors.anchorBlue}
              style={{ marginLeft: 4 }}
            />
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
                      { width: `${(playbook.progress / playbook.totalTasks) * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  {playbook.progress}/{playbook.totalTasks} Tasks
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
      // Reduce opacity for the last card when it's in the stack, but not when it's the current card
      const isLastCard = cardIndex === cardData.length - 1;
      const isCurrentCard = cardIndex === currentCard;
      const opacity = isLastCard && !isCurrentCard ? 0.7 : 1;
      
      // Only the top card animates. Back cards are static.
      const isTopCard = stackIndex === 0;
      const CardContainer = isTopCard ? Animated.View : View;
      // Only apply animatedCardStyle to the top card
      const extraStyle = isTopCard ? animatedCardStyle : {};
      // For back cards, use only static transforms and opacity (not tied to animation)
      return (
        <CardContainer
          key={`${cardIndex}-${stackIndex}`}
          style={[
            styles.stackCard,
            {
              backgroundColor: getCardColor(stackIndex),
              // Only apply transform/opacity for the static stack effect
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
              truth={playbook.truthInLove.truth} 
              summary={playbook.truthInLove.summary}
              style={{ flex: 1, padding: 32 }}
            />
          ) : card.type === 'action' ? (
            <ActionStepsCard 
              steps={playbook.actionSteps}
              onToggleStep={toggleStepCompletion}
              style={{ padding: 24 }}
            />
          ) : card.type === 'affirmation' ? (
            <View style={{ flex: 1, padding: 24 }}>
              <View style={styles.affirmationsContainer}>
                <View style={styles.affirmationsHeader}>
                  <MaterialCommunityIcons 
                    name="format-quote-open" 
                    size={24} 
                    color={Colors.growthGreen} 
                    style={styles.icon}
                  />
                  <Text style={styles.affirmationsTitle}>Affirmations</Text>
                </View>
                <View style={styles.affirmationsList}>
                  {playbook.affirmations?.slice(0, 3).map(affirmation => (
                    <AffirmationCard 
                      key={affirmation.id}
                      id={affirmation.id}
                      text={affirmation.text} 
                      completed={affirmation.completed} 
                    />
                  ))}
                </View>
              </View>
            </View>
          ) : card.type === 'bible' ? (
            <BibleVerseCard verse={playbook.bibleVerse} style={{ flex: 1, backgroundColor: getCardColor(stackIndex) }} />
          ) : card.type === 'challenge' ? (
            <DirectChallengeCard challenge={playbook.directChallenge} />
          ) : (
            <View style={{ flex: 1, padding: 24 }}>
              {card.component()}
            </View>
          )}
        </CardContainer>
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
            {renderCard(currentCard, 0)}
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
      {cardData.map((card) => {
        if (card.type === 'truth') {
          return (
            <TruthInLoveCard 
              key={card.type}
              truth={playbook.truthInLove.truth} 
              summary={playbook.truthInLove.summary}
              expanded={true}
              style={[styles.docCard, styles.truthCard]}
            />
          );
        } else if (card.type === 'action') {
          return (
            <ActionStepsCard 
              key={card.type}
              steps={playbook.actionSteps}
              onToggleStep={toggleStepCompletion}
              style={[styles.docCard, styles.actionCard]}
            />
          );
        } else if (card.type === 'affirmation') {
          // Show only the first 3 affirmations in document view
          const affirmations = playbook.affirmations || [];
          const limitedAffirmations = affirmations.slice(0, 3);
          return (
            <View key={card.type} style={[styles.docCard, styles.truthCard]}>
              <View style={{ flex: 1 }}>
                <View style={styles.affirmationsContainer}>
                  <View style={styles.affirmationsHeader}>
                    <MaterialCommunityIcons 
                      name="format-quote-open" 
                      size={24} 
                      color={Colors.growthGreen} 
                      style={styles.icon}
                    />
                    <Text style={styles.affirmationsTitle}>Affirmations</Text>
                  </View>
                  <View style={styles.affirmationsList}>
                    {limitedAffirmations.map(affirmation => (
                      <AffirmationCard 
                        key={affirmation.id}
                        id={affirmation.id}
                        text={affirmation.text} 
                        completed={affirmation.completed} 
                      />
                    ))}
                  </View>
                </View>
              </View>
            </View>
          );
        } else {
          return (
            <View key={card.type} style={[styles.docCard, styles.defaultCard]}>
              {card.component()}
            </View>
          );
        }
      })}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  cardStackContainer: {
    flex: 1,
    position: 'relative',
    marginBottom: 20,
  },
  contentContainer: {
    flex: 1,
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
    height: 8,
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 4,
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
    borderWidth: 0,
    transformOrigin: 'bottom center',
  },


  docContainer: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  docContentContainer: {
    paddingTop: 4, // Match stack view's paddingTop
    paddingBottom: 60, // Match stack view's paddingBottom
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  docCard: {
    width: SCREEN_WIDTH - 80, // Match stack card width
    backgroundColor: Colors.hopeWhite,
    borderRadius: 28, // Match stack card border radius
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
    padding: 24,
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

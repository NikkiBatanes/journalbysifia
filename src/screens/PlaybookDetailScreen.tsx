import React, { useCallback, useState, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
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
  const { playbook: routePlaybook } = route.params;
  const { playbook, loading } = usePlaybook(routePlaybook);
  
  // Define card data with access to playbook
  const cardData = [
    {
      type: 'truth' as CardType,
      component: (expanded: boolean) => (
        <TruthInLoveCard
          truth={playbook.truthInLove.truth}
          summary={playbook.truthInLove.summary}
        />
      ),
      tappable: true,
    },
    {
      type: 'action' as CardType,
      component: (expanded: boolean) => (
        <ActionStepsCard steps={playbook.actionSteps} />
      ),
      tappable: true,
    },
    {
      type: 'affirmation' as CardType,
      component: (expanded: boolean) => (
        <AffirmationCard affirmation={playbook.affirmation} />
      ),
      tappable: false,
    },
    {
      type: 'bible' as CardType,
      component: (expanded: boolean) => (
        <BibleVerseCard verse={playbook.bibleVerse} />
      ),
      tappable: false,
    },
    {
      type: 'challenge' as CardType,
      component: (expanded: boolean) => (
        <DirectChallengeCard challenge={playbook.directChallenge} />
      ),
      tappable: false,
    },
  ];

  if (!playbook) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading playbook...</Text>
      </View>
    );
  }
  // View state
  const [viewMode, setViewMode] = useState<'stack' | 'document'>('stack');
  const [currentCard, setCurrentCard] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // Animation refs
  const pan = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const nextCardScale = useRef(new Animated.Value(0.95)).current;

  // Derived animations
  const rotateInterpolate = rotate.interpolate({
    inputRange: [-100, 0, 100],
    outputRange: ['2deg', '0deg', '-2deg'],
  });

  // PanResponder for modern swipe up/down
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (viewMode !== 'stack') return false;
        // Only allow vertical swipes
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx * 2);
        return isVerticalSwipe && Math.abs(gestureState.dy) > 10;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        // Don't allow swipe up on first card (to go to previous)
        if (currentCard === 0 && gestureState.dy < 0) {
          pan.setValue(gestureState.dy / 3); // Reduced movement to indicate restriction
          return;
        }
        
        // Don't allow swipe down on last card (to go to next)
        if (currentCard === cardData.length - 1 && gestureState.dy > 0) {
          pan.setValue(gestureState.dy / 3); // Reduced movement to indicate restriction
          return;
        }

        // Normal swipe behavior - follow finger movement
        pan.setValue(gestureState.dy);
        
        // Add subtle rotation based on swipe distance
        rotate.setValue(gestureState.dy / 20);
        
        // Scale the card slightly when swiping
        const scaleFactor = Math.max(0.96, 1 - Math.abs(gestureState.dy) / 1000);
        scale.setValue(scaleFactor);
        
        // Scale up the next card as current card moves
        if (gestureState.dy > 0 && currentCard < cardData.length - 1) {
          const nextScaleFactor = Math.min(0.98, 0.95 + Math.abs(gestureState.dy) / 500);
          nextCardScale.setValue(nextScaleFactor);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (expanded) {
          // Only allow swipe down to collapse
          if (gestureState.dy > 60) {
            setExpanded(false);
            Animated.parallel([
              Animated.spring(pan, { toValue: 0, useNativeDriver: true, friction: 6 }),
              Animated.spring(rotate, { toValue: 0, useNativeDriver: true, friction: 6 }),
              Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
            ]).start();
          } else {
            // Return to center
            Animated.parallel([
              Animated.spring(pan, { toValue: 0, useNativeDriver: true, friction: 6 }),
              Animated.spring(rotate, { toValue: 0, useNativeDriver: true, friction: 6 }),
              Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
            ]).start();
          }
        } else {
          // Swipe down to next card - more sensitive
          if (gestureState.dy > 40 && currentCard < cardData.length - 1) {
            // Animate card off screen down
            Animated.spring(pan, {
              toValue: SCREEN_HEIGHT * 0.8,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }).start(() => {
              setCurrentCard(currentCard + 1);
              pan.setValue(0);
              rotate.setValue(0);
              scale.setValue(1);
              nextCardScale.setValue(0.95);
            });
          } 
          // Swipe up to previous card - more sensitive
          else if (gestureState.dy < -40 && currentCard > 0) {
            // Animate card off screen up
            Animated.spring(pan, {
              toValue: -SCREEN_HEIGHT * 0.8,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }).start(() => {
              setCurrentCard(currentCard - 1);
              pan.setValue(0);
              rotate.setValue(0);
              scale.setValue(1);
              nextCardScale.setValue(0.95);
            });
          } 
          // Return to center
          else {
            Animated.parallel([
              Animated.spring(pan, { 
                toValue: 0, 
                useNativeDriver: true, 
                tension: 50,
                friction: 8,
              }),
              Animated.spring(rotate, { 
                toValue: 0, 
                useNativeDriver: true, 
                tension: 50,
                friction: 8,
              }),
              Animated.spring(scale, { 
                toValue: 1, 
                useNativeDriver: true, 
                tension: 50,
                friction: 8,
              }),
              Animated.spring(nextCardScale, { 
                toValue: 0.95, 
                useNativeDriver: true, 
                tension: 50,
                friction: 8,
              }),
            ]).start();
          }
        }
      },
    })
  ).current;

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

  // Stack Card View
  const renderStackCards = () => {
    const TOTAL_CARDS = cardData.length;
    const SCALE_DECREMENT = 0.05; // How much smaller each card gets
    const BOTTOM_OFFSET = 15; // How much each card peeks out from the bottom
    
    return (
      <View style={styles.stackContainer}>
        {cardData.map((card, idx) => {
          if (idx < currentCard) return null; // Hide previous cards
          // Show all remaining cards in the stack
          
          const isActive = idx === currentCard;
          const isExpanded = isActive && expanded;
          const zIndex = cardData.length - idx;
          const cardPosition = idx - currentCard;
          
          // Calculate scale and offset for stacked effect
          const scale = 1 - (cardPosition * SCALE_DECREMENT);
          const bottomOffset = cardPosition * BOTTOM_OFFSET;
          
          // Calculate color fade based on card position
          const getCardColor = (position: number) => {
            if (isActive) return Colors.anchorBlue; // Base color for active card
            // Lighter shades for cards behind
            switch(position) {
              case 1: return '#2a4c7d'; // Slightly lighter
              case 2: return '#3a5c8c'; // Lighter
              case 3: return '#4a6c9b'; // Even lighter
              case 4: return '#5a7caa'; // Lightest
              default: return Colors.anchorBlue;
            }
          };
          
          const cardColor = isActive ? Colors.anchorBlue : getCardColor(cardPosition);
          
          const cardStyle = [
            styles.stackCard,
            {
              zIndex,
              // Position cards to create bottom fan-out effect
              transform: isActive ? [
                { translateY: pan },
                { rotate: rotateInterpolate },
                { scale: scale },
              ] : [
                { translateY: bottomOffset },
                { scale: cardPosition === 1 ? nextCardScale : 1 - (cardPosition * SCALE_DECREMENT) },
              ],
              // Adjust shadow and elevation based on position
              opacity: 1, // Keep cards fully opaque
              elevation: isActive ? 12 : 3 + cardPosition,
              shadowOpacity: isActive ? 0.25 : 0.15,
              backgroundColor: cardColor, // Solid color based on position
            },
            isExpanded && styles.expandedCard,
          ];
          return (
            <Animated.View
              key={card.type}
              style={cardStyle}
              {...(isActive ? panResponder.panHandlers : {})}
            >
              {isActive && currentCard === 0 && (
                <View style={styles.swipeIndicator} />
              )}
              {isActive && currentCard === cardData.length - 1 && (
                <View style={styles.swipeIndicator}>
                  <Ionicons name="arrow-up" size={16} color="rgba(255, 255, 255, 0.6)" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  activeOpacity={card.tappable && isActive && !expanded ? 0.8 : 1}
                  onPress={() => {
                    if (card.tappable && isActive && !expanded) setExpanded(true);
                  }}
                  disabled={!card.tappable || !isActive || expanded}
                  style={{ flex: 1 }}
                >
                  {/* Card content */}
                  {card.component(isExpanded)}
                </TouchableOpacity>
                {/* Drag handle for expanded */}
                {isExpanded && (
                  <View style={styles.dragHandle} />
                )}
              </View>
            </Animated.View>
          );
        })}
      </View>
    );
  };

  // Document Card View
  const renderDocumentCards = () => (
    <View style={styles.docContainer}>
      {cardData.map((card, idx) => (
        <View key={card.type} style={styles.docCard}>
          {card.component(false)}
        </View>
      ))}
    </View>
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
    paddingTop: 16, // Increased top padding for better spacing
    paddingBottom: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 0, // Reset negative margin
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
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.anchorBlue,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  chevronIcon: {
    marginLeft: 6,
  },
  playbookTitle: {
    fontFamily: 'System',
    fontWeight: '900',
    fontSize: 24,
    lineHeight: 26,
    color: Colors.anchorBlue,
    marginBottom: 12,
    letterSpacing: 0.3,
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
    fontFamily: 'System', // Default system font
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: Colors.anchorBlue,
  },
  
  // View toggle styles
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
    justifyContent: 'flex-start', // Changed to flex-start to move cards up
    paddingTop: 4, // Further reduced top padding
    paddingBottom: 60,
    position: 'relative',
    overflow: 'visible',
  },
  stackCard: {
    position: 'absolute',
    width: SCREEN_WIDTH - 80,
    height: 450, // Fixed height to match design
    alignSelf: 'center',
    borderRadius: 28,
    backgroundColor: Colors.anchorBlue, // Base color (will be overridden by inline style)
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    padding: 0,
    overflow: 'hidden',
    borderWidth: 0,
    transformOrigin: 'bottom center', // Changed to bottom for fan-out effect
  },
  expandedCard: {
    minHeight: SCREEN_HEIGHT * 0.65,
    width: SCREEN_WIDTH - 40,
    zIndex: 100,
    transform: [{ translateY: 0 }],
    shadowOpacity: 0.3,
    shadowRadius: 24,
    left: 20,
    borderRadius: 32, // Increased for more rounded corners in expanded state
  },
  dragHandle: {
    alignSelf: 'center',
    width: 40,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.hopeWhite,
    marginVertical: 8,
    opacity: 0.5,
  },
  docContainer: {
    flex: 1,
    paddingTop: 4, // Reduced to match stack view top padding
  },
  docCard: {
    marginBottom: 12, // Slightly reduced for better spacing
    marginHorizontal: 20, // Add horizontal margin to match card width
  },
  swipeIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    zIndex: 10,
  },
  swipeIndicatorText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.8,
  },
});




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

  // PanResponder for swipe up/down
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (viewMode !== 'stack') return false;
        // Only allow vertical swipes
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        pan.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (expanded) {
          // Only allow swipe down to collapse
          if (gestureState.dy > 60) {
            setExpanded(false);
            Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
          } else {
            Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
          }
        } else {
          // Only allow swipe up to next card
          if (gestureState.dy < -60 && currentCard < cardData.length - 1) {
            setCurrentCard(currentCard + 1);
            Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
          } else if (gestureState.dy > 60 && currentCard > 0) {
            setCurrentCard(currentCard - 1);
            Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
          } else {
            Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
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
    return (
      <View style={styles.stackContainer}>
        {cardData.map((card, idx) => {
          if (idx < currentCard) return null; // Hide previous cards
          const isActive = idx === currentCard;
          const isExpanded = isActive && expanded;
          const zIndex = cardData.length - idx;
          const cardStyle = [
            styles.stackCard,
            {
              top: isActive ? 0 : (idx - currentCard) * 16,
              zIndex,
              transform: isActive
                ? [{ translateY: pan }]
                : [{ scale: 1 - (idx - currentCard) * 0.03 }],
              elevation: isActive ? 6 : 2,
            },
            isExpanded && styles.expandedCard,
          ];
          return (
            <Animated.View
              key={card.type}
              style={cardStyle}
              {...(isActive ? panResponder.panHandlers : {})}
            >
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
                {/* Drag handle for expanded */}
                {isExpanded && (
                  <View style={styles.dragHandle} />
                )}
              </TouchableOpacity>
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
    paddingTop: 24, // Increased top padding for better spacing
    paddingBottom: 16,
    borderTopLeftRadius: 20, // Added top radius since we removed the header
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
    marginBottom: 24, // Increased margin bottom for better spacing
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
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  stackCard: {
    position: 'absolute',
    width: SCREEN_WIDTH - 32,
    minHeight: 260,
    alignSelf: 'center',
    borderRadius: 18,
    backgroundColor: Colors.anchorBlue,
    shadowColor: Colors.anchorBlue,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    padding: 0,
    overflow: 'hidden',
  },
  expandedCard: {
    minHeight: SCREEN_HEIGHT * 0.6,
    width: SCREEN_WIDTH - 18,
    zIndex: 100,
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
    paddingTop: 18,
  },
  docCard: {
    marginBottom: 18,
  },
});




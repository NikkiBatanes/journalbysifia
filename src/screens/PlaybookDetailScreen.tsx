import React, { useState, useEffect } from 'react';
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
  const cardData = [
    {
      type: 'truth' as CardType,
      component: () => (
        <TruthInLoveCard
          truth={playbook.truthInLove.truth}
          summary={playbook.truthInLove.summary}
        />
      ),
      tappable: true,
    },
    {
      type: 'action' as CardType,
      component: () => (
        <ActionStepsCard steps={playbook.actionSteps} />
      ),
      tappable: true,
    },
    {
      type: 'affirmation' as CardType,
      component: () => (
        <AffirmationCard affirmation={playbook.affirmation} />
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

  // Stack Card View
  const renderStackCards = () => {
    if (cardData.length === 0) return null;
    
    // Helper to calculate color based on card type
    const getCardColor = () => {
      // Return the anchor blue color for all cards
      return Colors.anchorBlue;
    };
    
    // Current card to display
    const card = cardData[currentCard];
    
    return (
      <View style={styles.stackContainer}>
        {/* Current card */}
        <View style={[styles.stackCard, { backgroundColor: getCardColor() }]}>
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
              style={{ flex: 1, padding: 24 }}
            />
          ) : (
            <View style={{ flex: 1, padding: 24 }}>
              {card.component()}
            </View>
          )}
        </View>
        
        {/* Navigation controls */}
        <View style={styles.cardNavigation}>
          <TouchableOpacity 
            style={[styles.navButton, currentCard === 0 && styles.navButtonDisabled]} 
            onPress={goToPrevCard}
            disabled={currentCard === 0}
          >
            <Ionicons name="arrow-up" size={24} color={currentCard === 0 ? "#ccc" : "#fff"} />
            <Text style={styles.navButtonText}>Previous</Text>
          </TouchableOpacity>
          
          <View style={styles.cardIndicator}>
            <Text style={styles.cardIndicatorText}>
              {currentCard + 1} / {cardData.length}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.navButton, currentCard === cardData.length - 1 && styles.navButtonDisabled]} 
            onPress={goToNextCard}
            disabled={currentCard === cardData.length - 1}
          >
            <Text style={styles.navButtonText}>Next</Text>
            <Ionicons name="arrow-down" size={24} color={currentCard === cardData.length - 1 ? "#ccc" : "#fff"} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Document Card View
  const renderDocumentCards = () => (
    <ScrollView 
      style={styles.docContainer}
      contentContainerStyle={styles.docContentContainer}
    >
      {cardData.map((card) => (
        card.type === 'truth' ? (
          <TruthInLoveCard 
            key={card.type}
            truth={playbook.truthInLove.truth} 
            summary={playbook.truthInLove.summary}
            expanded={true}
            style={[styles.docCard, styles.truthCard]}
          />
        ) : card.type === 'action' ? (
          <ActionStepsCard 
            key={card.type}
            steps={playbook.actionSteps}
            onToggleStep={toggleStepCompletion}
            style={[styles.docCard, styles.actionCard]}
          />
        ) : (
          <View key={card.type} style={[styles.docCard, styles.defaultCard]}>
            {card.component()}
          </View>
        )
      ))}
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
    padding: 32,
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
  }
});




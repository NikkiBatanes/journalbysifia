import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AnimatedRe, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme';
import { BorderRadii } from '../../theme/styles';
import { Playbook } from '../../interfaces/playbook';
import { ActionStepsProvider, useActionSteps } from '../../context/ActionStepsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import individual card components for carousel
import TruthInLoveCard from '../../components/TruthInLoveCard';
import ActionStepsCard from '../../components/ActionStepsCard';
import AffirmationCard from '../../components/AffirmationCard';
import BibleVerseCard from '../../components/BibleVerseCard';
import DirectChallengeCard from '../../components/DirectChallengeCard';
import DevotionalButton from '../../components/DevotionalButton';
import DevotionalModal from '../../components/DevotionalModal';

const { width } = Dimensions.get('window');

interface RouteParams {
  playbook: Playbook;
  onboardingData: {
    name: string;
    ageGroup: string;
    faithJourney: string;
    challenge: string;
    challengeDetails: string;
  };
}

interface PlaybookCard {
  id: string;
  type: string;
  component: React.ReactElement;
  backgroundColor?: string; // optional override for outer card background
}

// Inner component that can access ActionStepsContext
const PlaybookContent: React.FC<{ playbook: any; challengeCategory: string; specificChallenge: string; userInput: string }> = ({
  playbook, challengeCategory, specificChallenge, userInput
}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { getCompletedStepsCount, actionSteps } = useActionSteps(); // Use context for dynamic progress

  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showUserInput, setShowUserInput] = useState(false);
  const [showDevotionalModal, setShowDevotionalModal] = useState(false);
  const [progressData, setProgressData] = useState({ completed: 0, total: 0, percentage: 0 });
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  
  // Carousel sizing: modern center-snap with spacing and narrower cards
  const ITEM_SPACING = 16;
  const ITEM_WIDTH = Math.round(width * 0.80); // slimmer card for better centering
  const ITEM_SIZE = ITEM_WIDTH + ITEM_SPACING;
  const sidePadding = Math.round((width - ITEM_WIDTH) / 2); // center first/last (rounded to avoid half-pixel drift)

  // Chevron animation (match PlaybookDetail rotation behavior)
  const chevronAnim = useSharedValue(0);
  useEffect(() => {
    chevronAnim.value = withTiming(showUserInput ? 1 : 0, { duration: 200 });
  }, [showUserInput, chevronAnim]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAnim.value * 180}deg` }],
  }));

  const onboardingData = {
    name: 'Friend', // You could get this from user context
    challengeDetails: `${challengeCategory}: ${specificChallenge}`,
  };

  // Issue #3 fix: Calculate progress using ActionStepsContext for real-time updates
  const calculateProgress = () => {
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
  };

  // Update progress data when action steps change
  useEffect(() => {
    calculateProgress();
  }, [actionSteps]);

  const toggleUserInput = () => {
    setShowUserInput(!showUserInput);
  };

  const handleCreateDevotional = () => {
    setShowDevotionalModal(true);
  };

  const handleContinueJourney = () => {
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
          <View style={[styles.carouselCard, { backgroundColor: '#274674', padding: 24 }]}>
            <TruthInLoveCard
              key="truth"
              truth={truthData.text}
              summary={truthData.summary}
              expanded={true}
              style={{ backgroundColor: 'transparent' }}
              currentUser={{ displayName: onboardingData.name }}
            />
          </View>
        ),
        backgroundColor: undefined,
      });
    }

    // Action Steps card
    if (playbook.actionSteps && playbook.actionSteps.length > 0) {
      cards.push({
        id: 'action',
        type: 'Action Steps',
        component: (
          <View style={[styles.carouselCard, { backgroundColor: '#274674', padding: 16 }]}>
            <ActionStepsCard
              key="action"
              steps={playbook.actionSteps}
              style={{ backgroundColor: 'transparent' }}
              playbookTitle={playbook.title}
              playbookId={playbook.id}
              navigation={navigation as any}
            />
          </View>
        ),
        backgroundColor: undefined,
      });
    }

    // Affirmations card - single card with all affirmations
    if (playbook.affirmations && playbook.affirmations.length > 0) {
      cards.push({
        id: 'affirmations',
        type: 'Affirmations',
        component: (
          <View
            key="affirmations"
            style={[styles.carouselCard, { backgroundColor: '#274674' }]}
          >
            <View style={styles.affirmationsHeader}>
              <Text style={styles.affirmationsTitle}>Affirmations</Text>
            </View>
            <View style={styles.affirmationsList}>
              {playbook.affirmations.map((affirmation: any, index: number) => (
                <View key={index} style={styles.affirmationCard}>
                  <View style={styles.affirmationContent}>
                    <Text style={styles.affirmationText}>{affirmation.text}</Text>
                  </View>
                </View>
              ))}
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

  const toggleCardExpansion = (cardId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const renderCarouselCard = ({ item, index }: { item: PlaybookCard; index: number }) => {
    const isExpanded = expandedCards.has(item.id);

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

    return (
      <TouchableOpacity
        style={[styles.cardContainer, { width: ITEM_WIDTH, alignItems: 'center', marginHorizontal: 0 }]}
        onPress={() => toggleCardExpansion(item.id)}
        activeOpacity={0.9}
      >
        <Animated.View
          style={[
            styles.cardContent,
            {
              height: isExpanded ? 'auto' : 380,
              width: ITEM_WIDTH,
              backgroundColor: item.backgroundColor ?? 'rgba(255, 255, 255, 0.1)',
              transform: [{ scale }, { translateY }],
              opacity,
            },
          ]}
        >
          {item.component}
        </Animated.View>
      </TouchableOpacity>
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
      <View style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 140, paddingTop: insets.top + 4 },
          ]}
          showsVerticalScrollIndicator={false}
          bounces
          alwaysBounceVertical
          overScrollMode="always"
          contentInsetAdjustmentBehavior="never"
          scrollIndicatorInsets={{ top: insets.top, bottom: insets.bottom }}
        >
        {/* ONBOARDING-SPECIFIC HEADER */}
        <View style={styles.headerRow}>
          <Image
            source={require('../../../assets/images/siFiaAppIcon.png')}
            style={styles.logoSmall}
            resizeMode="contain"
          />
          <Text style={[styles.mainTitle, styles.mainTitleInline]}>Your Personalized{"\n"}Playbook is Ready</Text>
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.subtitle}>Here's your first step toward clarity.</Text>
          <View style={styles.warningContainer}>
            <Ionicons name="warning-outline" size={16} color={Colors.faithGold} />
            <Text style={styles.warningText}>
              This may be hard to hear, but truth spoken in love can set you free. Here's your personalized guide for the days ahead.
            </Text>
          </View>
        </View>

        {/* PLAYBOOK HEADER WITH CHEVRON TOGGLE */}
        <View style={styles.playbookHeaderContainer}>
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
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressData.percentage}%` }]} />
            </View>
            <Text style={styles.progressText}>{progressData.completed}/{progressData.total} Steps</Text>
          </View>
        </View>

        {/* CAROUSEL INDICATORS - Moved to top */}
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

        {/* CAROUSEL CARDS */}
        <View style={[
          styles.carouselContainer,
          {
            backgroundColor: Colors.anchorBlue,
            // bleed past ScrollView and safe-area paddings for true edge-to-edge
            marginLeft: -16 - insets.left,
            marginRight: -16 - insets.right,
          }
        ]}>
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
            // compensate for the negative margins so items still center on screen
            contentContainerStyle={{ paddingHorizontal: Math.round(sidePadding) + 16 }}
            ItemSeparatorComponent={() => <View style={{ width: ITEM_SPACING }} />}
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

        {/* DEVOTIONAL BUTTON - Only show on last card */}
        {currentIndex === carouselCards.length - 1 && (
          <TouchableOpacity
            style={styles.devotionalButton}
            onPress={handleCreateDevotional}
            activeOpacity={0.8}
          >
            <Text style={styles.devotionalButtonText}>Create a Devotional</Text>
          </TouchableOpacity>
        )}

        {/* SCROLLING HELPER TEXT */}
        <Text style={styles.bottomText}>
          This first playbook is yours! Picture walking daily with God, growing stronger through personalized guidance.
        </Text>
        </ScrollView>

        {/* FIXED FOOTER (translucent so cards scroll behind) - Button only */}
        <View style={[
          styles.footer,
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingTop: 0,
            paddingBottom: insets.bottom + 8,
            backgroundColor: 'rgba(26, 60, 109, 0.85)', // translucent anchorBlue
          }
        ]}>
          <TouchableOpacity 
            style={styles.continueButton}
            onPress={handleContinueJourney}
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
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: `${Colors.faithGold}20`,
    borderWidth: .4,
    borderColor: Colors.faithGold,
    padding: 8,
    borderRadius: 12,
    marginHorizontal: 0,
    marginTop: 2,
    marginBottom: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    color: Colors.hopeWhite,
    marginLeft: 8,
    lineHeight: 14,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 2,
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
    minHeight: 380,
  },
  affirmationsHeader: {
    padding: 16,
    paddingBottom: 10,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  affirmationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  affirmationsList: {
    padding: 14,
  },
  affirmationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
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
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 0,
    height: 56,
    alignSelf: 'stretch',
    marginHorizontal: 16,
  },
  continueButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
});

// Main component wrapper that provides ActionStepsContext
const OnboardingPlaybookReadyScreenNew: React.FC = () => {
  const route = useRoute();
  const { playbook, challengeCategory, specificChallenge, userInput } = route.params as any;

  return (
    <ActionStepsProvider initialSteps={playbook.actionSteps || []}>
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

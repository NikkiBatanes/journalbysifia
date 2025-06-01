

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Image,
  SafeAreaView,
} from 'react-native';
import { Colors, Fonts } from '../theme';
import TruthInLoveCard from '../components/TruthInLoveCard';
import ActionStepsCard from '../components/ActionStepsCard';
import AffirmationCard from '../components/AffirmationCard';
import BibleVerseCard from '../components/BibleVerseCard';
import DirectChallengeCard from '../components/DirectChallengeCard';
import Ionicons from 'react-native-vector-icons/Ionicons';
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

  // Header
  const renderHeader = () => (
    <SafeAreaView style={styles.headerSafeArea}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.anchorBlue} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Image
          source={{ uri: playbook.profileImage }}
          style={styles.profilePic}
        />
      </View>
    </SafeAreaView>
  );

  // Title and progress
  const renderTitleBar = () => (
    <View style={styles.titleBarContainer}>
      <TouchableOpacity style={styles.playbookLabel}>
        <Text style={styles.playbookText}>Playbook</Text>
        <Ionicons name="chevron-down" size={18} color={Colors.faithGold} style={{ marginLeft: 2 }} />
      </TouchableOpacity>
      <Text style={styles.screenTitle}>{playbook.title}</Text>
      <View style={styles.progressRow}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${(playbook.progress / playbook.totalTasks) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {playbook.progress}/{playbook.totalTasks} Tasks
        </Text>
      </View>
      <View style={styles.viewIconRow}>
        <TouchableOpacity
          style={[styles.iconCircle, viewMode === 'stack' && styles.iconActive]}
          onPress={() => setViewMode('stack')}
        >
          <Ionicons name="layers" size={22} color={viewMode === 'stack' ? Colors.anchorBlue : Colors.trustGrey} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconCircle, viewMode === 'document' && styles.iconActive]}
          onPress={() => setViewMode('document')}
        >
          <Ionicons name="document-text" size={22} color={viewMode === 'document' ? Colors.anchorBlue : Colors.trustGrey} />
        </TouchableOpacity>
      </View>
    </View>
  );

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
    <View style={{ flex: 1, backgroundColor: Colors.hopeWhite }}>
      {renderHeader()}
      {renderTitleBar()}
      <View style={styles.mainContainer}>
        {viewMode === 'stack' ? renderStackCards() : renderDocumentCards()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
  },
  headerSafeArea: {
    backgroundColor: Colors.hopeWhite,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 4,
  },
  profilePic: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: Colors.anchorBlue,
  },
  titleBarContainer: {
    paddingHorizontal: 22,
    marginBottom: 6,
  },
  playbookLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  playbookText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.trustGrey,
    marginRight: 2,
  },
  screenTitle: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: Colors.anchorBlue,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 10,
  },
  progressBarFill: {
    height: 12,
    backgroundColor: Colors.growthGreen,
    borderRadius: 8,
  },
  progressText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.trustGrey,
    marginRight: 10,
  },
  viewIconRow: {
    flexDirection: 'row',
    gap: 6,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f0f4fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  iconActive: {
    backgroundColor: Colors.faithGold,
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




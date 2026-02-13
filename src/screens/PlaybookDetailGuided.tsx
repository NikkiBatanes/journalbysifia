// React & React Native
import * as React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Animated,
  Dimensions,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

// Navigation
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/types';

// Theme & Styling
import { Colors } from '../theme/colors';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import { triggerLightHaptic } from '../utils/haptics';

// Components
import ThemedText from '../components/common/ThemedText';
import TruthInLoveCard from '../components/TruthInLoveCard';
import ActionStepsCard from '../components/ActionStepsCard';
import BibleVerseCard from '../components/BibleVerseCard';
import DirectChallengeCard from '../components/DirectChallengeCard';
import PlaybookSkeletonLoader from '../components/PlaybookSkeletonLoader';
import PlaybookHeader from '../components/PlaybookHeader';

// Types & Context
import { Playbook, ActionStep } from '../interfaces/playbook';
import { getCompletedStepsCount as getTaskStats } from '../utils/taskUtils';

// Data & API
import { useQuery } from '@tanstack/react-query';
import { getPlaybook } from '../services/apiIntegration';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useUpdateSubTask } from '../services/hooks/usePlaybookData';
import { replaceAllNamePlaceholders } from '../utils/nameReplacement';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types
interface PlaybookGuidedProps {
  navigation: StackNavigationProp<RootStackParamList, 'PlaybookDetail'>;
  route: { params: { playbookId?: string; playbook?: { id: string } } };
}

type CardType = 'truth' | 'action' | 'affirmation' | 'bible' | 'challenge';

interface CardData {
  id: string;
  type: CardType;
  truth?: string;
  summary?: string;
  steps?: ActionStep[];
  verse?: { text: string; reference: string };
  challenge?: string | { text: string; summary: string };
  challengeCTA?: string;
}

const PlaybookDetailGuided: React.FC<PlaybookGuidedProps> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();

  useScreenStatusBar('dark', Colors.anchorBlue);

  // UI state
  const [showUserInput, setShowUserInput] = useState(false);
  const chevronRotation = useRef(new Animated.Value(0)).current;

  // Animate chevron rotation
  React.useEffect(() => {
    Animated.timing(chevronRotation, {
      toValue: showUserInput ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showUserInput, chevronRotation]);

  const chevronStyle = {
    transform: [
      {
        rotate: chevronRotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '180deg'],
        }),
      },
    ],
  };

  // Route and navigation data
  const playbookId = route.params?.playbook?.id || (route.params as any)?.playbookId;
  const { user } = useAuth();
  const userId = user?.id;

  // Data fetching
  const routePlaybook = route.params?.playbook;
  const isFullPlaybook = routePlaybook &&
    typeof routePlaybook === 'object' &&
    'title' in routePlaybook &&
    'actionSteps' in routePlaybook &&
    'truthInLove' in routePlaybook &&
    routePlaybook.truthInLove &&
    typeof routePlaybook.truthInLove === 'object' &&
    (routePlaybook.truthInLove as any).text &&
    (routePlaybook.truthInLove as any).text.length > 0;
  const shouldFetchFromDB = !isFullPlaybook && !!playbookId && !!userId;

  const { data: fetchedPlaybook, isLoading } = useQuery<Playbook | null>({
    queryKey: ['playbook', playbookId, userId],
    queryFn: async () => {
      try {
        const result = await getPlaybook(userId || '', playbookId);
        if (result && (!result.title || !result.actionSteps || !result.bibleVerse)) {
          return null;
        }
        return result;
      } catch (err) {
        throw err;
      }
    },
    enabled: shouldFetchFromDB,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const playbook = isFullPlaybook ? (routePlaybook as Playbook) : fetchedPlaybook;

  // Context hooks
  const updateSubTaskMutation = useUpdateSubTask();

  // State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const cardTranslateX = useRef(new Animated.Value(0)).current;

  // Swipe gesture handlers
  const goToPreviousCard = useCallback(() => {
    if (currentCardIndex > 0) {
      triggerLightHaptic();
      const prevIndex = currentCardIndex - 1;

      Animated.sequence([
        Animated.timing(cardTranslateX, {
          toValue: SCREEN_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateX, {
          toValue: -SCREEN_WIDTH,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateX, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      setCurrentCardIndex(prevIndex);
    }
  }, [currentCardIndex, cardTranslateX]);

  // Pan gesture for swiping
  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      const swipeThreshold = 50;
      if (event.translationX > swipeThreshold) {
        runOnJS(goToPreviousCard)();
      } else if (event.translationX < -swipeThreshold) {
        runOnJS(goToNextCard)();
      }
    });

  // Build cards array
  const cards: CardData[] = React.useMemo(() => {
    if (!playbook) {
      return [];
    }

    const result: CardData[] = [];

    // Truth card
    if (playbook.truthInLove?.text) {
      result.push({
        id: 'truth',
        type: 'truth',
        truth: playbook.truthInLove.text,
        summary: playbook.truthInLove.summary,
      });
    }

    // Action steps card
    if (playbook.actionSteps && playbook.actionSteps.length > 0) {
      result.push({
        id: 'action',
        type: 'action',
        steps: playbook.actionSteps,
      });
    }

    // Bible verse card
    if (playbook.bibleVerse?.text) {
      result.push({
        id: 'bible',
        type: 'bible',
        verse: {
          text: playbook.bibleVerse.text,
          reference: playbook.bibleVerse.reference || 'Scripture',
        },
      });
    }

    // Challenge card
    if (playbook.directChallenge) {
      result.push({
        id: 'challenge',
        type: 'challenge',
        challenge: playbook.directChallenge,
        challengeCTA: playbook.challengeCTA,
      });
    }

    return result;
  }, [playbook]);

  // Handle subtask toggle
  const handleToggleSubTask = useCallback(async (stepId: string, subTaskId: string, completed: boolean) => {
    if (!playbook?.id || !userId) {return;}

    await updateSubTaskMutation.mutateAsync({
      playbookId: playbook.id,
      stepId,
      subTaskId,
      completed,
      userId,
    });
  }, [playbook?.id, userId, updateSubTaskMutation]);

  // Navigation handlers
  const goToNextCard = useCallback(() => {
    if (currentCardIndex < cards.length - 1) {
      triggerLightHaptic();
      const nextIndex = currentCardIndex + 1;

      Animated.sequence([
        Animated.timing(cardTranslateX, {
          toValue: -SCREEN_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateX, {
          toValue: SCREEN_WIDTH,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateX, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      setCurrentCardIndex(nextIndex);
    }
  }, [currentCardIndex, cards.length, cardTranslateX]);

  // Calculate progress
  const completedTasksCount = playbook ? getTaskStats(playbook.actionSteps || []).completed : 0;
  const totalTasksCount = playbook ? getTaskStats(playbook.actionSteps || []).total : 0;

  if (isLoading) {
    return <PlaybookSkeletonLoader />;
  }

  if (!playbook) {
    return (
      <View style={styles.errorContainer}>
        <ThemedText weight="medium" style={styles.errorText}>
          Playbook not found
        </ThemedText>
      </View>
    );
  }

  const currentCard = cards[currentCardIndex];
  const isLastCard = currentCardIndex === cards.length - 1;

  return (
    <View style={styles.container}>
      {/* Close Button */}
      <TouchableOpacity
        onPress={() => {
          triggerLightHaptic();
          navigation.goBack();
        }}
        style={[styles.closeButton, { top: insets.top + 10 }]}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={28} color={Colors.hopeWhite} />
      </TouchableOpacity>

      {/* PLAYBOOK Label with Chevron */}
      <View style={[styles.playbookLabelContainer, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            setShowUserInput(!showUserInput);
          }}
          style={styles.playbookLabelButton}
          activeOpacity={0.7}
        >
          <ThemedText weight="semiBold" style={styles.playbookLabelText}>PLAYBOOK</ThemedText>
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-down" size={15} color={Colors.hopeWhite} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Share/PDF Button */}
      <TouchableOpacity
        onPress={() => {
          triggerLightHaptic();
          // TODO: Implement share/PDF export
        }}
        style={[styles.shareButton, { top: insets.top + 10 }]}
        activeOpacity={0.7}
      >
        <Ionicons name="share-outline" size={20} color={Colors.hopeWhite} />
      </TouchableOpacity>

      {/* Header */}
      <PlaybookHeader
        title={replaceAllNamePlaceholders(playbook.title, user as any || {})}
        progress={(completedTasksCount / totalTasksCount) * 100}
        completedTasks={completedTasksCount}
        totalTasks={totalTasksCount}
        showToggle={false}
        showUserInput={showUserInput}
        userInput={playbook.userInput}
      />

      {/* Pagination Dots */}
      <View style={styles.paginationContainer}>
        <View style={styles.progressDots}>
          {cards.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentCardIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Card Container */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.cardContainer}>
          <Animated.View
            style={[
              styles.cardWrapper,
              { transform: [{ translateX: cardTranslateX }] },
            ]
          }
          >
            {currentCard && (
              <>
                {currentCard.type === 'truth' && (
                  <TruthInLoveCard
                    truth={currentCard.truth || ''}
                    summary={currentCard.summary || ''}
                    expanded={true}
                    showCloseButton={false}
                  />
                )}

                {currentCard.type === 'action' && (
                  <ActionStepsCard
                    steps={currentCard.steps || []}
                    onToggleSubTaskMutation={handleToggleSubTask}
                    expanded={true}
                    showCloseButton={false}
                  />
                )}

                {currentCard.type === 'bible' && currentCard.verse && (
                  <BibleVerseCard
                    verse={currentCard.verse}
                    expanded={true}
                    showCloseButton={false}
                  />
                )}

                {currentCard.type === 'challenge' && (
                  <DirectChallengeCard
                    challenge={typeof currentCard.challenge === 'string' ? currentCard.challenge : currentCard.challenge?.text || ''}
                    challengeCTA={currentCard.challengeCTA}
                    expanded={true}
                    showCloseButton={false}
                  />
                )}
              </>
            )}
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Next Button - Right Bottom Corner */}
      {!isLastCard && (
        <TouchableOpacity
          onPress={goToNextCard}
          style={[styles.nextButton, { bottom: insets.bottom + 20 }]}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  paginationContainer: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.anchorBlue,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  cardContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  cardWrapper: {
    width: '100%',
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dotActive: {
    backgroundColor: Colors.growthGreen,
    width: 24,
  },
  closeButton: {
    position: 'absolute',
    left: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  playbookLabelContainer: {
    alignItems: 'center',
    paddingBottom: 8,
    backgroundColor: Colors.anchorBlue,
  },
  playbookLabelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playbookLabelText: {
    fontSize: 11,
    color: Colors.hopeWhite,
    letterSpacing: 1,
  },
  shareButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  nextButton: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.alertCoral,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: Colors.hopeWhite,
    fontSize: 16,
  },
});

export default withErrorBoundary(PlaybookDetailGuided, 'PlaybookDetailGuided');

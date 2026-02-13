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
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => {
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color={Colors.hopeWhite} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <ThemedText weight="bold" style={styles.headerTitle} numberOfLines={1}>
            {replaceAllNamePlaceholders(playbook.title, user as any || {})}
          </ThemedText>
          <ThemedText weight="medium" style={styles.headerSubtitle}>
            {completedTasksCount}/{totalTasksCount} Steps Explored
          </ThemedText>
        </View>

        <View style={styles.headerRight} />
      </View>

      {/* Card Container */}
      <View style={styles.cardContainer}>
        <Animated.View
          style={[
            styles.cardWrapper,
            { transform: [{ translateX: cardTranslateX }] },
          ]}
        >
          {currentCard && (
            <>
              {currentCard.type === 'truth' && (
                <TruthInLoveCard
                  truth={currentCard.truth || ''}
                  summary={currentCard.summary || ''}
                  expanded={true}
                />
              )}

              {currentCard.type === 'action' && (
                <ActionStepsCard
                  steps={currentCard.steps || []}
                  onToggleSubTaskMutation={handleToggleSubTask}
                  expanded={true}
                />
              )}

              {currentCard.type === 'bible' && currentCard.verse && (
                <BibleVerseCard
                  verse={currentCard.verse}
                  expanded={true}
                />
              )}

              {currentCard.type === 'challenge' && (
                <DirectChallengeCard
                  challenge={typeof currentCard.challenge === 'string' ? currentCard.challenge : currentCard.challenge?.text || ''}
                  challengeCTA={currentCard.challengeCTA}
                  expanded={true}
                />
              )}
            </>
          )}
        </Animated.View>
      </View>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 20 }]}>
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

        {!isLastCard && (
          <TouchableOpacity
            onPress={goToNextCard}
            style={styles.nextButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Colors.anchorBlue,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  headerTitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  bottomNav: {
    paddingHorizontal: 20,
    paddingTop: 20,
    alignItems: 'center',
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dotActive: {
    backgroundColor: Colors.hopeWhite,
    width: 24,
  },
  nextButton: {
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

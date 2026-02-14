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
  ScrollView,
  StatusBar,
} from 'react-native';
import { PanResponder } from 'react-native';

// Navigation
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/types';
import { useFocusEffect } from '@react-navigation/native';

// Theme & Styling
import { Colors } from '../theme/colors';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';

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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Types
interface PlaybookGuidedProps {
  navigation: StackNavigationProp<RootStackParamList, 'PlaybookDetail'>;
  route: { params: { playbookId?: string; playbook?: { id: string } } };
}

type CardType = 'truth' | 'truth-summary' | 'action' | 'affirmation' | 'bible' | 'challenge';

interface CardData {
  id: string;
  type: CardType;
  truth?: string;
  summary?: string;
  steps?: ActionStep[];
  affirmations?: Array<{ id: string; text: string; completed: boolean }>;
  verse?: { text: string; reference: string };
  challenge?: string | { text: string; summary: string };
  challengeCTA?: string;
}

const splitSummaryAndCue = (raw: string): { summaryText: string; cueText: string } => {
  if (!raw) {
    return { summaryText: '', cueText: '' };
  }

  const trimmed = raw.trim();
  const cueMatch = trimmed.match(/\s*\(([^)]+)\)\s*$/);

  if (cueMatch && cueMatch.index !== undefined) {
    return {
      summaryText: trimmed.slice(0, cueMatch.index).trim(),
      cueText: cueMatch[1].trim(),
    };
  }

  return { summaryText: trimmed, cueText: '' };
};

const PlaybookDetailGuided: React.FC<PlaybookGuidedProps> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();

  useScreenStatusBar('light', Colors.anchorBlue);
  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setHidden(true, 'slide');
      return () => StatusBar.setHidden(false, 'slide');
    }, [])
  );

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

  // Build cards array
  const cards: CardData[] = React.useMemo(() => {
    if (!playbook) {
      return [];
    }


    const result: CardData[] = [];

    // Truth summary card (first page split)
    const truthText = playbook.truthInLove?.text;
    const truthSummaryText = (playbook.truthInLove?.summary?.trim().length ? playbook.truthInLove.summary : truthText)
      ?.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join(' ');

    if (truthSummaryText) {
      result.push({
        id: 'truth-summary',
        type: 'truth-summary',
        summary: replaceAllNamePlaceholders(truthSummaryText, (user as any) || {}),
        truth: truthText,
      });
    }

    if (truthText) {
      result.push({
        id: 'truth-detail',
        type: 'truth',
        truth: replaceAllNamePlaceholders(truthText, (user as any) || {}),
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

    // Affirmation card
    if (playbook.affirmations && playbook.affirmations.length > 0) {
      result.push({
        id: 'affirmations',
        type: 'affirmation',
        affirmations: playbook.affirmations,
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

      Animated.timing(cardTranslateX, {
        toValue: -SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentCardIndex(currentCardIndex + 1);
        cardTranslateX.setValue(SCREEN_WIDTH);
        Animated.timing(cardTranslateX, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [currentCardIndex, cards.length, cardTranslateX]);

  const goToPreviousCard = useCallback(() => {
    if (currentCardIndex > 0) {
      triggerLightHaptic();

      Animated.timing(cardTranslateX, {
        toValue: SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentCardIndex(currentCardIndex - 1);
        cardTranslateX.setValue(-SCREEN_WIDTH);
        Animated.timing(cardTranslateX, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [currentCardIndex, cardTranslateX]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
          const hasMovedEnough = Math.abs(gestureState.dx) > 10;
          return isHorizontal && hasMovedEnough;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_evt, gestureState) => {
          const swipeThreshold = 50;
          if (gestureState.dx > swipeThreshold) {
            goToPreviousCard();
          } else if (gestureState.dx < -swipeThreshold) {
            goToNextCard();
          }
        },
      }),
    [goToPreviousCard, goToNextCard]
  );

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
  const isFirstScreen = currentCardIndex === 0;

  return (
    <View style={styles.container}>
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

      <TouchableOpacity
        onPress={() => {
          triggerLightHaptic();
          triggerMediumHaptic();
          navigation.goBack();
        }}
        style={[styles.closeButton, { top: insets.top + 10 }]}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={28} color={Colors.hopeWhite} />
      </TouchableOpacity>

      {currentCard?.type === 'action' && (
        <View
          style={[
            styles.progressFab,
            { top: insets.top + 5 },
          ]}
        >
          <View style={styles.progressBarBgFab}>
            <View
              style={[
                styles.progressBarFillGuided,
                {
                  width: `${Math.max(0, Math.min(100, (completedTasksCount / totalTasksCount) * 100))}%`,
                },
              ]}
            />
          </View>
          <ThemedText weight="regular" style={styles.progressSummaryTextFab}>
            {completedTasksCount}/{totalTasksCount} Steps Explored
          </ThemedText>
        </View>
      )}

      {isFirstScreen && (
        <>
          <View style={[styles.playbookLabelContainer, { paddingTop: insets.top + 10 }, styles.playbookLabelOffset]}
          >
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

          <PlaybookHeader
            title={replaceAllNamePlaceholders(playbook.title, user as any || {})}
            progress={(completedTasksCount / totalTasksCount) * 100}
            completedTasks={completedTasksCount}
            totalTasks={totalTasksCount}
            showToggle={false}
            showUserInput={showUserInput}
            userInput={playbook.userInput}
            showProgressRow={false}
          />
        </>
      )}

      {/* Card Container */}
      <View
        style={styles.cardContainer}
        {...panResponder.panHandlers}
      >
        <ScrollView
          contentContainerStyle={[
            styles.cardScrollContent,
            currentCard?.type === 'truth-summary' || currentCard?.type === 'bible' || currentCard?.type === 'challenge' || currentCard?.type === 'affirmation'
              ? styles.cardScrollContentCentered
              : currentCard?.type === 'action'
                ? styles.cardScrollContentAction
                : undefined,
          ]}
          showsVerticalScrollIndicator={currentCard?.type !== 'truth-summary'}
          scrollEnabled={currentCard?.type !== 'truth-summary'}
        >
          <Animated.View
            style={[
              styles.cardWrapper,
              currentCard?.type === 'truth-summary' || currentCard?.type === 'bible' || currentCard?.type === 'challenge' || currentCard?.type === 'affirmation'
                ? styles.cardWrapperCentered
                : undefined,
              { transform: [{ translateX: cardTranslateX }] },
            ]}
          >
            {currentCard && (
              <>
                {currentCard.type === 'truth-summary' && (
                  <View
                    style={[
                      styles.truthSummaryCard,
                      {
                        minHeight: Math.max(
                          0,
                          SCREEN_HEIGHT
                            - (insets.top + 10 + 40)
                            - (insets.bottom + 20 + 56)
                        ),
                        paddingTop: insets.top + 10,
                        paddingBottom: insets.bottom + 60,
                        justifyContent: 'flex-start',
                      } as const,
                    ]}
                  >
                    {(() => {
                      const { summaryText, cueText } = splitSummaryAndCue(currentCard.summary || '');
                      return (
                        <>
                          <ThemedText weight="bold" style={styles.truthSummaryText}>
                            {summaryText}
                          </ThemedText>
                          {cueText ? (
                            <ThemedText weight="regular" style={styles.truthSummaryCue}>
                              {cueText}
                            </ThemedText>
                          ) : null}
                        </>
                      );
                    })()}
                  </View>
                )}

                {currentCard.type === 'truth' && (
                  <TruthInLoveCard
                    truth={currentCard.truth || ''}
                    summary={currentCard.summary || ''}
                    expanded={true}
                    showCloseButton={false}
                    headingStyle={styles.truthHeadingOffset}
                  />
                )}

                {currentCard.type === 'action' && (
                  <View
                    style={[
                      styles.actionCardWrapper,
                      {
                        paddingTop: insets.top + 40,
                        paddingBottom: insets.bottom + 160,
                      } as const,
                    ]}
                  >
                    <ActionStepsCard
                      steps={currentCard.steps || []}
                      onToggleSubTaskMutation={handleToggleSubTask}
                      expanded={true}
                      showCloseButton={false}
                    />
                  </View>
                )}
                {currentCard.type === 'affirmation' && currentCard.affirmations && (
                  <View
                    style={[
                      styles.affirmationCardWrapper,
                      {
                        paddingTop: insets.top + 80,
                        paddingBottom: insets.bottom + 140,
                      } as const,
                    ]}
                  >
                    <View style={styles.affirmationsHeader}>
                      <Ionicons name="heart" size={24} color={Colors.alertCoral} style={styles.affirmationIcon} />
                      <ThemedText weight="semiBold" style={styles.affirmationsTitle}>Words to Reflect On</ThemedText>
                    </View>
                    <View style={styles.affirmationsList}>
                      {currentCard.affirmations.map((affirmation) => (
                        <View key={affirmation.id} style={styles.affirmationItem}>
                          <ThemedText weight="regular" style={styles.affirmationText}>
                            {affirmation.text}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {currentCard.type === 'bible' && currentCard.verse && (
                  <View
                    style={[
                      styles.scriptureCardWrapper,
                      {
                        paddingTop: insets.top + 60,
                        paddingBottom: insets.bottom + 120,
                      } as const,
                    ]}
                  >
                    <BibleVerseCard
                      verse={currentCard.verse}
                      expanded={true}
                      showCloseButton={false}
                      backgroundColor="transparent"
                      style={styles.scriptureCard}
                    />
                  </View>
                )}

                {currentCard.type === 'challenge' && (
                  <View
                    style={[
                      styles.challengeCardWrapper,
                      {
                        paddingTop: insets.top + 80,
                        paddingBottom: insets.bottom + 140,
                      } as const,
                    ]}
                  >
                    <DirectChallengeCard
                      challenge={typeof currentCard.challenge === 'string' ? currentCard.challenge : currentCard.challenge?.text || ''}
                      challengeCTA={currentCard.challengeCTA}
                      expanded={true}
                      showCloseButton={false}
                    />
                  </View>
                )}
              </>
            )}
          </Animated.View>
        </ScrollView>
      </View>

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
  },
  cardScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 100,
  },
  cardScrollContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 40,
  },
  cardScrollContentAction: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 60,
  },
  cardWrapper: {
    width: '100%',
  },
  cardWrapperCentered: {
    justifyContent: 'center',
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
  progressSummaryContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    width: '100%',
  },
  progressBarBgGuided: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    overflow: 'hidden',
    height: 10,
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: 6,
  },
  progressBarFillGuided: {
    backgroundColor: Colors.growthGreen,
    height: '100%',
  },
  progressSummaryText: {
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    fontSize: 12,
    marginBottom: 12,
  },
  actionCardWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  truthSummaryCard: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    flex: 1,
    justifyContent: 'center',
  },
  truthSummaryText: {
    color: Colors.hopeWhite,
    fontSize: 28,
    lineHeight: 38,
    opacity: 0.95,
  },
  truthSummaryCue: {
    color: Colors.hopeWhite,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.65,
    marginTop: 8,
    letterSpacing: 0.2,
  },
  truthHeadingOffset: {
    marginTop: 110,
  },
  scriptureCardWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 20,
  },
  challengeCardWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  affirmationCardWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  affirmationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  affirmationIcon: {
    marginRight: 8,
  },
  affirmationsTitle: {
    fontSize: 20,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  affirmationsList: {
    gap: 16,
  },
  affirmationItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  affirmationText: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    opacity: 0.95,
  },
  scriptureCard: {
    backgroundColor: 'transparent',
    alignSelf: 'stretch',
  },
  progressFab: {
    position: 'absolute',
    left: 20,
    width: 160,
    padding: 12,
    borderRadius: 999,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBgFab: {
    width: '100%',
    height: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  progressSummaryTextFab: {
    color: Colors.hopeWhite,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
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
  playbookLabelOffset: {
    marginTop: 40,
  },
  shareButton: {
    position: 'absolute',
    right: 58,
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

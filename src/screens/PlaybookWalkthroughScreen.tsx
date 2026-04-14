// src/screens/PlaybookWalkthroughScreen.tsx
import * as React from 'react';
import { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors } from '../theme/colors';
import ThemedText from '../components/common/ThemedText';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';
import { replaceAllNamePlaceholders } from '../utils/nameReplacement';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useUpdateSubTask } from '../services/hooks/usePlaybookData';

import { useQuery } from '@tanstack/react-query';
import { getPlaybook } from '../services/apiIntegration';

import type { RootStackParamList } from '../navigation/types';
import type { ActionStep } from '../interfaces/playbook';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'PlaybookWalkthrough'>;

const TOTAL_STEPS = 7;
const PRAYER_FALLBACK = 'Lord, meet me here. I bring this to You.';

// ─── Helpers ────────────────────────────────────────────────────────────────

const getDirectChallengeText = (
  dc: string | { text: string; summary: string } | undefined
): string => {
  if (!dc) { return ''; }
  if (typeof dc === 'string') { return dc; }
  return dc.text || dc.summary || '';
};

const splitParagraphs = (text: string): string[] =>
  text
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean);

// ─── Step 0: Enter the Moment ────────────────────────────────────────────────

interface EnterMomentProps {
  title: string;
  userInput: string;
  summary: string;
  userName: string;
  onContinue: () => void;
}

const EnterMomentStep: React.FC<EnterMomentProps> = ({
  title,
  userInput,
  summary,
  userName,
  onContinue,
}) => {
  const [showUserInput, setShowUserInput] = useState(false);
  const chevronAnim = useRef(new Animated.Value(0)).current;

  const toggleUserInput = () => {
    triggerLightHaptic();
    Animated.timing(chevronAnim, {
      toValue: showUserInput ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setShowUserInput(prev => !prev);
  };

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const personalized = replaceAllNamePlaceholders(summary, userName);
  const paragraphs = splitParagraphs(personalized);

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Centered PLAYBOOK label + animated chevron — matches PlaybookDetailGuided header */}
      <TouchableOpacity
        style={styles.playbookLabelContainer}
        onPress={toggleUserInput}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
      >
        <ThemedText weight="semiBold" style={styles.playbookLabel}>
          PLAYBOOK
        </ThemedText>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.7)" />
        </Animated.View>
      </TouchableOpacity>

      {/* User input card — revealed when chevron is tapped */}
      {showUserInput && (
        <View style={styles.userInputCard}>
          <ThemedText style={styles.userInputText}>{userInput}</ThemedText>
        </View>
      )}

      <ThemedText weight="bold" style={styles.title}>
        {title}
      </ThemedText>

      <View style={styles.summaryBlock}>
        {paragraphs.map((para, i) =>
          i === 0 ? (
            <ThemedText key={i} weight="bold" style={styles.summaryLead}>
              {para}
            </ThemedText>
          ) : (
            <ThemedText key={i} style={styles.summaryMuted}>
              {para}
            </ThemedText>
          )
        )}
      </View>

      {/* No inline button — floating coral next button handles navigation */}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
};

// ─── Step 1: Truth in Love ───────────────────────────────────────────────────

interface TruthStepProps {
  text: string;
  userName: string;
  onNext: () => void;
}

const TruthInLoveStep: React.FC<TruthStepProps> = ({ text, userName, onNext }) => {
  const personalized = replaceAllNamePlaceholders(text, userName);
  const paragraphs = splitParagraphs(personalized);

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stepLabelRow}>
        <Ionicons name="heart-outline" size={18} color={Colors.hopeWhite} />
        <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
          Truth in Love
        </ThemedText>
      </View>

      <View style={styles.textBlock}>
        {paragraphs.map((para, i) => (
          <ThemedText key={i} style={styles.bodyText}>
            {para}
          </ThemedText>
        ))}
      </View>

      {/* No inline button — floating coral next button handles navigation */}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
};

// ─── Step 2: Scripture Anchor ────────────────────────────────────────────────

interface ScriptureStepProps {
  reference: string;
  text: string;
  onNext: () => void;
}

const ScriptureAnchorStep: React.FC<ScriptureStepProps> = ({ reference, text, onNext }) => {
  // Extract a closing reflection note if the verse text ends with a short sentence
  const sentences = text.split(/(?<=[.!?])\s+/);
  const lastSentence = sentences[sentences.length - 1]?.trim() ?? '';
  const verseText =
    lastSentence.length > 0 && lastSentence.length < 60 && sentences.length > 1
      ? sentences.slice(0, -1).join(' ')
      : text;
  const reflectionNote =
    lastSentence.length > 0 && lastSentence.length < 60 && sentences.length > 1
      ? lastSentence
      : 'Sit with that.';

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <ThemedText weight="bold" style={styles.stepLabel}>
        Scripture Anchor
      </ThemedText>

      <ThemedText weight="semiBold" style={styles.scriptureRef}>
        {reference}
      </ThemedText>

      <ThemedText weight="medium" style={styles.scriptureText}>
        "{verseText}"
      </ThemedText>

      <ThemedText style={styles.reflectionNote}>
        {reflectionNote}
      </ThemedText>

      {/* No inline button — floating coral next button handles navigation */}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
};

// ─── Step 3: Faithful Actions ────────────────────────────────────────────────

interface FaithfulActionsStepProps {
  steps: ActionStep[];
  playbookId: string;
  userId: string;
  onNext: () => void;
}

const FaithfulActionsStep: React.FC<FaithfulActionsStepProps> = ({
  steps,
  playbookId,
  userId,
  onNext,
}) => {
  const [actionStepIndex, setActionStepIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const updateSubTask = useUpdateSubTask();

  const currentStep = steps[actionStepIndex];
  const isLastStep = actionStepIndex >= steps.length - 1;

  const advanceStep = useCallback(
    (markDone: boolean) => {
      if (markDone && currentStep) {
        // Mark all subtasks of this step complete
        if (currentStep.subTasks?.length) {
          currentStep.subTasks.forEach(sub => {
            if (!sub.completed) {
              updateSubTask.mutate({
                playbookId,
                stepId: currentStep.id,
                subTaskId: sub.id,
                completed: true,
                userId,
              });
            }
          });
        }
        triggerMediumHaptic();
      }

      if (isLastStep) {
        onNext();
        return;
      }

      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setActionStepIndex(i => i + 1);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    },
    [currentStep, isLastStep, fadeAnim, onNext, playbookId, updateSubTask]
  );

  if (!currentStep) {
    return (
      <View style={[styles.stepScroll, styles.stepContent]}>
        <TouchableOpacity style={styles.primaryButton} onPress={onNext} activeOpacity={0.85}>
          <ThemedText weight="semiBold" style={styles.primaryButtonText}>Next</ThemedText>
          <Ionicons name="arrow-forward" size={18} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>
    );
  }

  const stepNumber = actionStepIndex + 1;
  const totalSteps = steps.length;
  const subText = currentStep.subTasks?.length
    ? currentStep.subTasks.map(s => s.text).join('\n')
    : currentStep.description || '';

  return (
    <View style={styles.stepScroll}>
      <ScrollView
        contentContainerStyle={styles.stepContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText weight="bold" style={styles.stepLabel}>
          Faithful Actions
        </ThemedText>

        <ThemedText style={styles.actionCounter}>
          Step {stepNumber} of {totalSteps}
        </ThemedText>

        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.actionStepCard}>
            <View style={styles.actionBadge}>
              <ThemedText weight="bold" style={styles.actionBadgeText}>
                {stepNumber}
              </ThemedText>
            </View>

            <ThemedText weight="semiBold" style={styles.actionTitle}>
              {currentStep.title}
            </ThemedText>

            {subText.length > 0 && (
              <ThemedText style={styles.actionBody}>
                {subText}
              </ThemedText>
            )}
          </View>
        </Animated.View>

        <View style={styles.doneSkipRow}>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => advanceStep(true)}
            activeOpacity={0.8}
          >
            <ThemedText weight="semiBold" style={styles.doneButtonText}>
              {isLastStep ? 'Done' : 'Done'}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => advanceStep(false)}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.skipButtonText}>
              {isLastStep ? 'Next →' : 'Skip'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Step 4: Prayer ──────────────────────────────────────────────────────────

interface PrayerStepProps {
  prayer: string;
  onNext: () => void;
}

const PrayerStep: React.FC<PrayerStepProps> = ({ prayer, onNext }) => {
  const handlePrayed = () => {
    triggerLightHaptic();
    setTimeout(onNext, 300);
  };

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <ThemedText weight="bold" style={styles.stepLabel}>
        Prayer
      </ThemedText>

      <View style={styles.prayerBlock}>
        {splitParagraphs(prayer).map((line, i) => (
          <ThemedText key={i} style={styles.prayerText}>
            {line}
          </ThemedText>
        ))}
      </View>

      <TouchableOpacity
        style={styles.confirmButton}
        onPress={handlePrayed}
        activeOpacity={0.85}
      >
        <ThemedText weight="semiBold" style={styles.confirmButtonText}>
          I prayed this
        </ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
};

// ─── Step 5: Word to Speak ───────────────────────────────────────────────────

interface WordToSpeakStepProps {
  word: string;
  onNext: () => void;
}

const WordToSpeakStep: React.FC<WordToSpeakStepProps> = ({ word, onNext }) => {
  const handleRead = () => {
    triggerLightHaptic();
    setTimeout(onNext, 300);
  };

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <ThemedText weight="bold" style={styles.stepLabel}>
        Word to Speak
      </ThemedText>

      <View style={styles.wordBlock}>
        {splitParagraphs(word).map((line, i) => (
          <ThemedText key={i} weight="medium" style={styles.wordText}>
            {line}
          </ThemedText>
        ))}
      </View>

      <TouchableOpacity
        style={styles.confirmButton}
        onPress={handleRead}
        activeOpacity={0.85}
      >
        <ThemedText weight="semiBold" style={styles.confirmButtonText}>
          I've read this aloud
        </ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
};

// ─── Step 6: Completion ──────────────────────────────────────────────────────

interface CompletionStepProps {
  title: string;
  closingText: string;
  onFinish: () => void;
}

const CompletionStep: React.FC<CompletionStepProps> = ({
  title,
  closingText,
  onFinish,
}) => {
  const paragraphs = splitParagraphs(closingText);

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <ThemedText weight="bold" style={styles.completionLabel}>
        You completed:
      </ThemedText>

      <ThemedText weight="bold" style={styles.completionTitle}>
        {title}
      </ThemedText>

      {paragraphs.map((para, i) => (
        <ThemedText key={i} style={styles.completionBody}>
          {para}
        </ThemedText>
      ))}

      <TouchableOpacity
        style={[styles.primaryButton, styles.finishButton]}
        onPress={onFinish}
        activeOpacity={0.85}
      >
        <ThemedText weight="semiBold" style={styles.primaryButtonText}>
          Save &amp; Finish
        </ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const PlaybookWalkthroughScreen: React.FC<Props> = ({ route, navigation }) => {
  const routePlaybook = route.params?.playbook;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);

  const userName: string =
    (user as any)?.user_metadata?.full_name?.split(' ')[0] ||
    (user as any)?.email?.split('@')[0] ||
    '';
  const userId: string = user?.id || '';

  // Detect if the route playbook is a lightweight list object (missing full content)
  const isFullPlaybook =
    routePlaybook &&
    'truthInLove' in routePlaybook &&
    routePlaybook.truthInLove &&
    typeof routePlaybook.truthInLove === 'object' &&
    (routePlaybook.truthInLove as any).text &&
    (routePlaybook.truthInLove as any).text.length > 0;

  const playbookId = routePlaybook?.id;
  const shouldFetch = !isFullPlaybook && !!playbookId && !!userId;

  const { data: fetchedPlaybook, isLoading } = useQuery({
    queryKey: ['playbook', playbookId, userId],
    queryFn: async () => {
      const result = await getPlaybook(userId, playbookId!);
      return result;
    },
    enabled: shouldFetch,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const playbook = (isFullPlaybook ? routePlaybook : fetchedPlaybook) as typeof routePlaybook;

  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, 'slide');
      return () => StatusBar.setHidden(false, 'slide');
    }, [])
  );

  const goNext = useCallback(() => {
    setStepIndex(i => Math.min(i + 1, TOTAL_STEPS - 1));
  }, []);

  const goBack = useCallback(() => {
    if (stepIndex === 0) {
      navigation.goBack();
    } else {
      setStepIndex(i => i - 1);
    }
  }, [stepIndex, navigation]);

  const handleFinish = useCallback(() => {
    triggerMediumHaptic();
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          state: { routes: [{ name: 'Home' }, { name: 'PlaybookList' }], index: 1 },
        },
      ],
    });
  }, [navigation]);

  // Show loading state while fetching the full playbook from DB
  if (isLoading || (shouldFetch && !playbook)) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ThemedText style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>
          Loading…
        </ThemedText>
      </View>
    );
  }

  if (!playbook) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ThemedText style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>
          Could not load playbook.
        </ThemedText>
      </View>
    );
  }

  // Derive data
  const prayerText =
    playbook.prayer ||
    PRAYER_FALLBACK;

  const wordToSpeak =
    playbook.wordToSpeak ||
    (playbook.affirmations?.length
      ? playbook.affirmations[playbook.affirmations.length - 1]?.text
      : '') ||
    getDirectChallengeText(playbook.directChallenge);

  const closingText =
    playbook.challengeCTA ||
    getDirectChallengeText(playbook.directChallenge) ||
    'Carry what God has shown you into the room.';

  // Progress bar width: 0–1 per step
  const progressFraction = stepIndex / (TOTAL_STEPS - 1);

  // Steps where the CTA is inline (Prayer/Word) — no floating next button
  const hasFloatingNext = stepIndex !== 4 && stepIndex !== 5 && stepIndex !== 6;

  return (
    <View style={styles.container}>
      {/* Thin progress bar — full width at very top, above safe area */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressFraction * 100}%` }]} />
      </View>

      {/* Dots row — matches original pagination style */}
      <View style={[styles.dotsRow, { paddingTop: insets.top + 8 }]}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === stepIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Step content */}
      <View style={styles.stepContainer}>
        {stepIndex === 0 && (
          <EnterMomentStep
            title={playbook.title}
            userInput={playbook.userInput}
            summary={playbook.truthInLove?.summary || ''}
            userName={userName}
            onContinue={goNext}
          />
        )}

        {stepIndex === 1 && (
          <TruthInLoveStep
            text={playbook.truthInLove?.text || ''}
            userName={userName}
            onNext={goNext}
          />
        )}

        {stepIndex === 2 && (
          <ScriptureAnchorStep
            reference={playbook.bibleVerse?.reference || ''}
            text={playbook.bibleVerse?.text || ''}
            onNext={goNext}
          />
        )}

        {stepIndex === 3 && (
          <FaithfulActionsStep
            steps={playbook.actionSteps || []}
            playbookId={playbook.id}
            userId={userId}
            onNext={goNext}
          />
        )}

        {stepIndex === 4 && (
          <PrayerStep
            prayer={prayerText}
            onNext={goNext}
          />
        )}

        {stepIndex === 5 && (
          <WordToSpeakStep
            word={wordToSpeak}
            onNext={goNext}
          />
        )}

        {stepIndex === 6 && (
          <CompletionStep
            title={playbook.title}
            closingText={closingText}
            onFinish={handleFinish}
          />
        )}
      </View>

      {/* Floating close / back button — top right, matches original */}
      <TouchableOpacity
        onPress={goBack}
        style={[styles.closeButton, { top: insets.top + 8 }]}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={stepIndex === 0 ? 'close' : 'chevron-back'}
          size={22}
          color={Colors.hopeWhite}
        />
      </TouchableOpacity>

      {/* Floating coral next button — bottom right, matches original */}
      {hasFloatingNext && (
        <TouchableOpacity
          onPress={goNext}
          style={[styles.nextButton, { bottom: insets.bottom + 20 }]}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    width: '100%',
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.faithGold,
  },
  // Dots — matches original PlaybookDetailGuided pagination style
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 10,
    backgroundColor: Colors.anchorBlue,
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
  // Close/back — matches original: absolute, top-right, circular
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
  // Next — matches original: absolute, bottom-right, coral circle
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
    zIndex: 100,
  },
  stepContainer: {
    flex: 1,
  },
  stepScroll: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 40,
    minHeight: SCREEN_HEIGHT * 0.7,
    justifyContent: 'flex-start',
  },
  stepLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Colors.faithGold,
    marginBottom: 20,
  },

  // Enter the Moment
  playbookLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  playbookLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.hopeWhite,
  },
  userInputCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 14,
    marginBottom: 24,
  },
  userInputText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
  },
  title: {
    fontSize: 18,
    color: Colors.hopeWhite,
    lineHeight: 26,
    marginBottom: 24,
  },
  summaryBlock: {
    gap: 16,
    marginTop: 'auto',
    marginBottom: 36,
  },
  // Line 0: personalized sentence — large + bold, like the hero title
  summaryLead: {
    fontSize: 26,
    color: Colors.hopeWhite,
    lineHeight: 34,
    marginBottom: 36,
  },
  // Lines 1+: pause + Jesus line — smaller, muted, centered
  summaryMuted: {
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 22,
    textAlign: 'center',
  },

  // Shared label row (icon + text)
  stepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  stepLabelWhite: {
    fontSize: 16,
    letterSpacing: 0.8,
    color: Colors.hopeWhite,
  },

  // Truth in Love
  textBlock: {
    gap: 14,
    marginBottom: 36,
  },
  bodyText: {
    fontSize: 18,
    color: Colors.hopeWhite,
    lineHeight: 28,
    opacity: 0.95,
  },

  // Scripture
  scriptureRef: {
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.faithGold,
    marginBottom: 20,
  },
  scriptureText: {
    fontSize: 20,
    color: Colors.hopeWhite,
    lineHeight: 30,
    marginBottom: 24,
  },
  reflectionNote: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
    marginBottom: 40,
  },

  // Faithful Actions
  actionCounter: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  actionStepCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 22,
    marginBottom: 32,
    gap: 12,
  },
  actionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.faithGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: {
    fontSize: 14,
    color: Colors.anchorBlue,
  },
  actionTitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  actionBody: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 23,
  },
  doneSkipRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  doneButton: {
    flex: 1,
    backgroundColor: Colors.faithGold,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 15,
    color: Colors.anchorBlue,
  },
  skipButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },

  // Prayer
  prayerBlock: {
    gap: 10,
    marginBottom: 40,
  },
  prayerText: {
    fontSize: 17,
    color: Colors.hopeWhite,
    lineHeight: 27,
  },

  // Word to Speak
  wordBlock: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 40,
    gap: 8,
  },
  wordText: {
    fontSize: 20,
    color: Colors.hopeWhite,
    lineHeight: 30,
    textAlign: 'center',
  },

  // Completion
  completionLabel: {
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.faithGold,
    marginBottom: 12,
  },
  completionTitle: {
    fontSize: 28,
    color: Colors.hopeWhite,
    lineHeight: 34,
    marginBottom: 28,
  },
  completionBody: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 25,
    marginBottom: 10,
  },
  finishButton: {
    marginTop: 32,
    justifyContent: 'center',
  },

  // Shared buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.faithGold,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    marginTop: 'auto',
  },
  primaryButtonText: {
    fontSize: 16,
    color: Colors.anchorBlue,
  },
  confirmButton: {
    borderWidth: 1.5,
    borderColor: Colors.faithGold,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 'auto',
  },
  confirmButtonText: {
    fontSize: 16,
    color: Colors.faithGold,
  },
});

export default withErrorBoundary(PlaybookWalkthroughScreen, 'PlaybookWalkthroughScreen');

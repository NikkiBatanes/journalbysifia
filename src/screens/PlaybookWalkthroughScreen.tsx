// src/screens/PlaybookWalkthroughScreen.tsx
import * as React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  Dimensions,
  TextInput,
  Alert,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GestureDetector, Gesture, Directions } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { Colors } from '../theme/colors';
import ThemedText from '../components/common/ThemedText';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';
import { replaceAllNamePlaceholders } from '../utils/nameReplacement';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useCreateJournalEntry } from '../services/hooks/useJournalData';

import { useQuery } from '@tanstack/react-query';
import { getPlaybook } from '../services/apiIntegration';
import { BibleCopyrightModal } from '../components/BibleCopyrightModal';

import type { RootStackParamList } from '../navigation/types';
import type { ActionStep } from '../interfaces/playbook';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'PlaybookWalkthrough'>;

const TOTAL_STEPS = 7;

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

// ─── StepFadeIn — fades + slides content up on mount ────────────────────────

interface StepFadeInProps {
  delay?: number;
  children: React.ReactNode;
  style?: any;
}

const StepFadeIn: React.FC<StepFadeInProps> = ({ delay = 0, children, style }) => {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 340,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 55,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

// ─── Step 0: Enter the Moment ────────────────────────────────────────────────

interface EnterMomentProps {
  title: string;
  userInput: string;
  summary: string;
  userName: string;
  transitionLine?: string;
  onContinue: () => void;
  insets: { top: number };
}

const EnterMomentStep: React.FC<EnterMomentProps> = ({
  title,
  userInput,
  summary,
  userName,
  transitionLine,
  onContinue: _onContinue,
  insets,
}) => {
  console.log('[EnterMomentStep] transitionLine:', transitionLine);
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

  const personalized = replaceAllNamePlaceholders(summary, { displayName: userName });
  // Cap to 2 paragraphs — this is an entry moment, not the full truth section
  const paragraphs = splitParagraphs(personalized).slice(0, 2);

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Centered PLAYBOOK label + animated chevron */}
      <StepFadeIn delay={0}>
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
      </StepFadeIn>

      <StepFadeIn delay={80}>
        <ThemedText weight="semiBold" style={styles.title}>{title}</ThemedText>
      </StepFadeIn>

      <StepFadeIn delay={160} style={{ marginTop: 40 }}>
        {paragraphs.map((paragraph, index) => (
          <ThemedText key={index} style={[styles.summaryLead, (index === 1 || index === 2) && { fontSize: 16 }, index === 1 && { marginBottom: 4 }]} weight={index === 0 ? 'semiBold' : undefined}>
            {paragraph}
          </ThemedText>
        ))}
      </StepFadeIn>

      {transitionLine ? (
        <StepFadeIn delay={320} style={styles.transitionLineContainer}>
          <ThemedText style={styles.transitionLineText}>{transitionLine}</ThemedText>
        </StepFadeIn>
      ) : null}
    </ScrollView>
  );
};

// ─── Step 1: Truth in Love ───────────────────────────────────────────────────

interface TruthStepProps {
  text: string;
  userName: string;
  onNext: () => void;
  insets: { top: number };
}

const TruthInLoveStep: React.FC<TruthStepProps> = ({ text, userName, onNext: _onNext, insets }) => {
  const personalized = replaceAllNamePlaceholders(text, { displayName: userName });
  const paragraphs = splitParagraphs(personalized);

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}
    >
      <StepFadeIn delay={0} style={styles.stepLabelRow}>
        <Ionicons name="heart" size={18} color={Colors.alertCoral} />
        <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
          Truth in Love
        </ThemedText>
      </StepFadeIn>

      <StepFadeIn delay={100} style={styles.textBlock}>
        {paragraphs.map((para, i) => (
          <ThemedText key={i} style={styles.bodyText}>
            {para}
          </ThemedText>
        ))}
      </StepFadeIn>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
};

// ─── Step 2: Scripture Anchor ────────────────────────────────────────────────

interface ScriptureStepProps {
  reference: string;
  text: string;
  version?: string;
  reflection?: string;
  onNext: () => void;
  insets: { top: number };
}

const ScriptureAnchorStep: React.FC<ScriptureStepProps> = ({ reference, text, version, reflection, onNext: _onNext, insets }) => {
  const [showCopyright, setShowCopyright] = useState(false);
  const reflectionLines = reflection ? splitParagraphs(reflection) : [];

  return (
    <View style={[styles.stepScroll, styles.stepContent, { paddingTop: insets.top + 8 }]}>
      <StepFadeIn delay={0} style={styles.stepLabelRow}>
        <MaterialCommunityIcons name="book" size={18} color={Colors.alertCoral} />
        <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
          Scripture to Anchor
        </ThemedText>
      </StepFadeIn>

      {/* Verse card */}
      <StepFadeIn delay={100} style={styles.verseCard}>
        <View style={styles.verseRefRow}>
          <Ionicons name="book-outline" size={13} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.scriptureRef}>
            {reference}
          </ThemedText>
          <View style={styles.versionAndInfoRow}>
            {version ? (
              <View style={styles.versionBadge}>
                <ThemedText weight="semiBold" style={styles.versionText}>
                  {version.toUpperCase()}
                </ThemedText>
              </View>
            ) : null}
            <TouchableOpacity
              onPress={() => { triggerLightHaptic(); setShowCopyright(true); }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginLeft: -4 }}
            >
              <Ionicons name="information-circle-outline" size={12} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
        </View>
        <ThemedText weight="medium" style={styles.scriptureText}>
          "{text}"
        </ThemedText>
      </StepFadeIn>

      <BibleCopyrightModal
        visible={showCopyright}
        onClose={() => setShowCopyright(false)}
        bibleVersion={version || 'NASB'}
      />

      <StepFadeIn delay={190} style={styles.reflectionBlock}>
        {reflectionLines.map((line, i) => (
          <ThemedText key={i} style={styles.reflectionNote}>
            {line}
          </ThemedText>
        ))}
      </StepFadeIn>

      <View style={{ height: 80 }} />
    </View>
  );
};

// ─── Step 3: Faithful Actions ────────────────────────────────────────────────

// ─── Smart body-line detection ───────────────────────────────────────────────

type BodyLineType = 'intro' | 'quote' | 'choice' | 'punch' | 'body';

interface BodyLine {
  text: string;
  type: BodyLineType;
}

function detectBodyLines(lines: string[], actionType: string): BodyLine[] {
  return lines.map((raw, idx) => {
    const line = raw.trim();

    // Quoted text (starts with any quote char)
    if (/^[""\u201C\u201D\u2018\u2019']/.test(line)) {
      return { text: line, type: 'quote' };
    }

    // Intro / label line ending with colon (e.g. "Is it:", "Ask yourself:")
    if (line.endsWith(':') && line.length < 55) {
      return { text: line, type: 'intro' };
    }

    // For 'choose' type: candidate list items are short, not the first line, no trailing period
    if (
      actionType === 'choose' &&
      idx > 0 &&
      line.length < 42 &&
      !line.endsWith('.') &&
      !line.endsWith('?') &&
      !line.endsWith(':')
    ) {
      return { text: line, type: 'choice' };
    }

    // Short punchy imperatives (single clause, < 38 chars)
    if (line.length < 38 && !line.endsWith('?')) {
      return { text: line, type: 'punch' };
    }

    return { text: line, type: 'body' };
  });
}

interface FaithfulActionsStepProps {
  steps: ActionStep[];
  intro?: string;
  playbookId: string;
  userId: string;
  onNext: () => void;
  insets: { top: number };
}

const FaithfulActionsStep: React.FC<FaithfulActionsStepProps> = ({
  steps,
  intro,
  playbookId: _playbookId,
  userId,
  onNext,
  insets,
}) => {
  const [actionStepIndex, setActionStepIndex] = useState(0);
  const [journalText, setJournalText] = useState('');
  const [journalSaved, setJournalSaved] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const createJournalEntry = useCreateJournalEntry();

  const currentStep = steps[actionStepIndex];
  const isLastStep = actionStepIndex >= steps.length - 1;

  // Reset journal + choice state when step changes
  useEffect(() => {
    setJournalText('');
    setJournalSaved(false);
    setSelectedChoice(null);
  }, [actionStepIndex]);

  const animateToNext = useCallback(
    (callback: () => void) => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        callback();
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    },
    [fadeAnim]
  );

  const advanceStep = useCallback(
    (markDone: boolean) => {
      if (markDone) {
        triggerMediumHaptic();
      } else {
        triggerLightHaptic();
      }

      if (isLastStep) {
        onNext();
        return;
      }

      animateToNext(() => setActionStepIndex(i => i + 1));
    },
    [isLastStep, onNext, animateToNext]
  );

  const handleSaveJournal = useCallback(() => {
    const trimmed = journalText.trim();
    if (!trimmed) {
      advanceStep(false);
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    createJournalEntry.mutate(
      {
        user_id: userId,
        content_type: 'todays_focus',
        content: trimmed,
        selected_date: today,
      },
      {
        onSuccess: () => {
          triggerMediumHaptic();
          setJournalSaved(true);
          setTimeout(() => advanceStep(true), 600);
        },
        onError: () => {
          Alert.alert('Oops', 'Could not save to journal. Try again.');
        },
      }
    );
  }, [journalText, userId, createJournalEntry, advanceStep]);

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

  // Button labels from actionType
  const actionType = currentStep.actionType ?? 'done_skip';

  // Strip leftover markdown bold/italic markers (** or *) from any field
  const stripMd = (s: string) => s.replace(/\*\*|__|\*/g, '').trim();

  // Body text: description (new format) or subtasks joined (legacy format)
  const rawBodyLines: string[] = currentStep.description
    ? currentStep.description.split('\n').map(l => stripMd(l)).filter(Boolean)
    : (currentStep.subTasks?.map(s => stripMd(s.text)) ?? []);

  const smartBodyLines = detectBodyLines(rawBodyLines, actionType);
  const primaryLabel = currentStep.primaryButton ?? (
    actionType === 'commit' ? "I've committed" :
    actionType === 'choose' ? "I've chosen" :
    actionType === 'text_input' ? 'Save to Journal' :
    'Done'
  );
  const secondaryLabel = currentStep.secondaryButton ?? (
    actionType === 'commit' ? 'Not yet' :
    actionType === 'choose' ? "I'm still unsure" :
    actionType === 'text_input' ? 'Skip' :
    isLastStep ? 'Next →' : 'Skip'
  );

  return (
    <View style={[styles.stepScroll, styles.stepContent, { paddingTop: insets.top + 8 }]}>
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <FontAwesome6 name="list-check" size={16} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            Faithful Actions
          </ThemedText>
        </StepFadeIn>

        {/* Intro framing line (shown only on first step) */}
        {intro && actionStepIndex === 0 && (
          <StepFadeIn delay={60}>
            <ThemedText style={styles.actionIntro}>{intro}</ThemedText>
          </StepFadeIn>
        )}

        <StepFadeIn delay={80}>
          <ThemedText style={styles.actionCounter}>
            Action {stepNumber} of {totalSteps}
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={130}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.actionStepCard}>
            {/* Step number circle — matches ActionStepsCard design */}
            <View style={styles.stepNumberContainer}>
              <View style={styles.stepCircle}>
                <ThemedText weight="bold" style={styles.stepNumber}>
                  {stepNumber}
                </ThemedText>
              </View>
            </View>

            {/* Step title */}
            <ThemedText weight="semiBold" style={styles.actionTitle}>
              {stripMd(currentStep.title)}
            </ThemedText>

            {/* Smart body lines */}
            {smartBodyLines.map((item, idx) => {
              if (item.type === 'quote') {
                return (
                  <ThemedText key={idx} style={styles.bodyLineQuote}>
                    {item.text}
                  </ThemedText>
                );
              }
              if (item.type === 'intro') {
                return (
                  <ThemedText key={idx} style={styles.bodyLineIntro}>
                    {item.text}
                  </ThemedText>
                );
              }
              if (item.type === 'choice') {
                const isSelected = selectedChoice === item.text;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.choicePill, isSelected && styles.choicePillSelected]}
                    onPress={() => { triggerLightHaptic(); setSelectedChoice(item.text); }}
                    activeOpacity={0.75}
                  >
                    <ThemedText
                      weight={isSelected ? 'semiBold' : undefined}
                      style={[styles.choicePillText, isSelected && styles.choicePillTextSelected]}
                    >
                      {item.text}
                    </ThemedText>
                  </TouchableOpacity>
                );
              }
              if (item.type === 'punch') {
                return (
                  <ThemedText key={idx} weight="medium" style={styles.bodyLinePunch}>
                    {item.text}
                  </ThemedText>
                );
              }
              return (
                <ThemedText key={idx} style={styles.actionBodyLine}>
                  {item.text}
                </ThemedText>
              );
            })}

            {/* TextInput for text_input type */}
            {actionType === 'text_input' && (
              <View style={styles.journalInputWrapper}>
                <TextInput
                  style={styles.journalInput}
                  value={journalText}
                  onChangeText={setJournalText}
                  placeholder="Write your response here…"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                {journalSaved && (
                  <ThemedText style={styles.journalSavedLabel}>✓ Saved to Journal</ThemedText>
                )}
              </View>
            )}
          </View>
        </Animated.View>
        </StepFadeIn>

        {/* Action buttons */}
        <StepFadeIn delay={200}>
        <View style={styles.doneSkipRow}>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => {
              if (actionType === 'text_input') {
                handleSaveJournal();
              } else {
                advanceStep(true);
              }
            }}
            activeOpacity={0.8}
          >
            <ThemedText weight="semiBold" style={styles.doneButtonText}>
              {isLastStep && actionType !== 'text_input' ? primaryLabel : primaryLabel}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => advanceStep(false)}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.skipButtonText}>
              {isLastStep && actionType === 'done_skip' ? 'Next →' : secondaryLabel}
            </ThemedText>
          </TouchableOpacity>
        </View>
        </StepFadeIn>
    </View>
  );
};

// ─── Step 4: Prayer ──────────────────────────────────────────────────────────

interface PrayerStepProps {
  prayer: string;
  onNext: () => void;
  insets: { top: number; bottom: number };
}

const PrayerStep: React.FC<PrayerStepProps> = ({ prayer, insets }) => {
  const [hasPrayed, setHasPrayed] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowButton(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 1500);
    return () => clearTimeout(timer);
  }, [fadeAnim]);

  const handlePrayed = () => {
    triggerLightHaptic();
    setHasPrayed(prev => !prev);
  };

  // Always end with "In Jesus' Name, Amen." — strip any existing closing first
  const prayerBody = prayer
    .replace(/\n*In Jesus'? [Nn]ame,?\s*[Aa]men\.?/gi, '')
    .replace(/\n*[Aa]men\.?$/gi, '')
    .trimEnd();

  // Ensure "Heavenly Father," is always on its own line
  const fullPrayer = prayerBody.replace(
    /^(Heavenly Father,)\s+(.)/i,
    'Heavenly Father,\n$2'
  );

  return (
    <>
      <View style={[styles.stepScroll, styles.prayerStepOuter, { paddingTop: insets.top + 8 }]}>
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <MaterialCommunityIcons name="hands-pray" size={18} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            Prayer
          </ThemedText>
        </StepFadeIn>

        {/* Vertically centered prayer block — sits in the space between label and floating button */}
        <StepFadeIn delay={100} style={styles.prayerBlock}>
          {splitParagraphs(fullPrayer).map((line, i) => (
            <View key={i}>
              <ThemedText style={styles.prayerText}>{line}</ThemedText>
              {i === 0 && <View style={{ height: 16 }} />}
            </View>
          ))}
          <ThemedText style={[styles.prayerText, { marginTop: 4 }]}>
            In Jesus' name, Amen.
          </ThemedText>
        </StepFadeIn>

        {/* Spacer so prayer text isn't hidden behind the floating button */}
        <View style={{ height: 80 }} />
      </View>

      {/* Floating action button — bottom-left, aligned with Next button */}
      {showButton && (
        <Animated.View style={{ opacity: fadeAnim }}>
          <TouchableOpacity
            style={[styles.prayerActionButtonFloating, { bottom: insets.bottom + 20 }, hasPrayed && styles.prayerActionButtonActive]}
            onPress={handlePrayed}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="hands-pray"
              size={18}
              color={hasPrayed ? Colors.alertCoral : Colors.hopeWhite}
            />
            <ThemedText
              weight="bold"
              style={[styles.prayerActionText, hasPrayed && styles.prayerActionTextActive]}
            >
              {hasPrayed ? 'Prayed' : 'I prayed this'}
            </ThemedText>
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );
};

// ─── Step 5: Word to Speak ───────────────────────────────────────────────────

interface WordToSpeakStepProps {
  word: string;
  onNext: () => void;
  insets: { top: number; bottom: number };
}

const WordToSpeakStep: React.FC<WordToSpeakStepProps> = ({ word, insets }) => {
  const [hasRead, setHasRead] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowButton(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 1500);
    return () => clearTimeout(timer);
  }, [fadeAnim]);

  const handleRead = () => {
    triggerLightHaptic();
    setHasRead(prev => !prev);
  };

  return (
    <>
      <View style={[styles.stepScroll, styles.prayerStepOuter, { paddingTop: insets.top + 8 }]}>
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            Words to Speak over Myself
          </ThemedText>
        </StepFadeIn>

        {/* Word card */}
        <StepFadeIn delay={100} style={[styles.wordBlock, { marginTop: 32 }]}>
          {splitParagraphs(word).map((line, i) => (
            <ThemedText key={i} weight="medium" style={styles.wordText}>
              {line}
            </ThemedText>
          ))}
        </StepFadeIn>

        {/* Space for floating button */}
        <View style={{ height: 80 }} />
      </View>

      {/* Floating action button — bottom-left, aligned with Next button */}
      {showButton && (
        <Animated.View style={{ opacity: fadeAnim }}>
          <TouchableOpacity
            style={[styles.prayerActionButtonFloating, { bottom: insets.bottom + 20 }, hasRead && styles.prayerActionButtonActive]}
            onPress={handleRead}
            activeOpacity={0.8}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={16}
              color={hasRead ? Colors.alertCoral : Colors.hopeWhite}
            />
            <ThemedText
              weight="bold"
              style={[styles.prayerActionText, hasRead && styles.prayerActionTextActive]}
            >
              {hasRead ? 'Read aloud' : "I've read this aloud"}
            </ThemedText>
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );
};

// ─── Step 6: Completion ──────────────────────────────────────────────────────

interface CompletionStepProps {
  title: string;
  closingText: string;
  onFinish: () => void;
  insets: { top: number };
}

const CompletionStep: React.FC<CompletionStepProps> = ({
  title,
  closingText,
  onFinish,
  insets,
}) => {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  // Parse completion text to extract question and action lines
  const parseCompletionText = (text: string) => {
    // Normalize old challenge format — strip section labels, remove opener line
    const normalized = text
      .replace(/^.+?,\s+complete\s+this\s+.+?challenge:\s*/gim, '')
      .replace(/^SPIRITUAL:\s*/gim, '')
      .replace(/^TACTICAL(?:\s*\([^)]*\))?:\s*/gim, '')
      .replace(/^TACTICAL\s+DEADLINE:\s*/gim, '')
      .replace(/\*\*|__|\*/g, '');

    const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

    // Always show "Before you close:" — inject if not already present
    const hasContext = lines.some(l => /^before you/i.test(l));
    if (!hasContext) lines.unshift('Before you close:');

    const contextLine = lines.find(l => /^before you/i.test(l));
    const questionLine = lines.find(l => l.endsWith('?'));
    const actionLines = lines.filter(l =>
      l.length > 0 && !/^before you/i.test(l) && !l.endsWith('?')
    );

    // Choice pills: 2-4 very short lines (under 6 words) with choice language
    const isChoicePills = actionLines.length >= 2 && actionLines.length <= 4 &&
                          actionLines.every(l => l.split(' ').length <= 6) &&
                          actionLines.some(l => l.toLowerCase().includes('or') || l.toLowerCase().includes('choose'));

    return { contextLine, questionLine, actionLines, isChoicePills };
  };

  const { contextLine, questionLine, actionLines, isChoicePills } = parseCompletionText(closingText);

  return (
    <View style={[styles.stepScroll, styles.stepContent, { paddingTop: insets.top + 8 }]}>
      <StepFadeIn delay={0}>
        <View style={styles.completionHeaderContainer}>
          <View style={styles.stepLabelRow}>
            <Ionicons name="flash" size={18} color={Colors.alertCoral} />
            <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
              You've completed
            </ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.completionTitle}>
            {title}
          </ThemedText>
          <ThemedText style={styles.completionPlaybookLabel}>PLAYBOOK</ThemedText>
        </View>
      </StepFadeIn>

      <StepFadeIn delay={100}>
        <>
          {contextLine && (
            <ThemedText style={styles.completionContext}>{contextLine}</ThemedText>
          )}
          {questionLine && (
            <ThemedText style={styles.completionQuestion}>{questionLine}</ThemedText>
          )}
        </>
      </StepFadeIn>

      <StepFadeIn delay={160}>
        <>
          {isChoicePills && actionLines.length > 0 ? (
            <View style={styles.completionChoicesContainer}>
              {actionLines.map((choice, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.completionChoicePill,
                    selectedChoice === choice && styles.completionChoicePillActive,
                  ]}
                  onPress={() => {
                    triggerLightHaptic();
                    setSelectedChoice(choice);
                  }}
                  activeOpacity={0.8}
                >
                  <ThemedText
                    weight={selectedChoice === choice ? 'semiBold' : undefined}
                    style={[
                      styles.completionChoiceText,
                      selectedChoice === choice && styles.completionChoiceTextActive,
                    ]}
                  >
                    {choice}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          ) : actionLines.length > 0 && (
            <View style={styles.completionActionsContainer}>
              {actionLines.map((line, index) => (
                <View key={index} style={styles.completionActionItem}>
                  <View style={styles.completionActionCircle}>
                    <ThemedText weight="bold" style={styles.completionActionNumber}>
                      {index + 1}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.completionActionLine}>
                    {line}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </>
      </StepFadeIn>

      <StepFadeIn delay={220}>
        <>
          <ThemedText style={styles.completionStayNote}>
            Need to stay with this a little longer?
          </ThemedText>

          <TouchableOpacity
            style={[styles.primaryButton, styles.finishButton]}
            onPress={onFinish}
            activeOpacity={0.85}
          >
            <ThemedText weight="semiBold" style={styles.primaryButtonText}>
              Save &amp; Finish
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, styles.devotionalButton]}
            onPress={() => {
              // TODO: Navigate to devotional creation screen
              console.log('Turn into devotional');
            }}
            activeOpacity={0.85}
          >
            <ThemedText weight="semiBold" style={styles.secondaryButtonText}>
              Turn this into a devotional
            </ThemedText>
          </TouchableOpacity>
        </>
      </StepFadeIn>
    </View>
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

  // ── Slide animation between steps ──────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(0)).current;
  // Share button scales + fades in when completion page is reached
  const shareButtonAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, 'slide');
      return () => StatusBar.setHidden(false, 'slide');
    }, [])
  );

  // Animate share button in when we hit step 6
  useEffect(() => {
    if (stepIndex === 6) {
      shareButtonAnim.setValue(0);
      Animated.spring(shareButtonAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        delay: 350,
        useNativeDriver: true,
      }).start();
    } else {
      shareButtonAnim.setValue(0);
    }
  }, [stepIndex, shareButtonAnim]);

  const animateStep = useCallback(
    (nextStep: number, direction: 'forward' | 'back') => {
      const exitX = direction === 'forward' ? -SCREEN_WIDTH * 0.25 : SCREEN_WIDTH * 0.25;
      const entryX = direction === 'forward' ? SCREEN_WIDTH : -SCREEN_WIDTH;

      // 1. Slide current content out
      Animated.timing(slideAnim, {
        toValue: exitX,
        duration: 160,
        useNativeDriver: true,
      }).start(() => {
        // 2. Snap animated value to entry side, THEN update step
        //    so the new content is mounted already off-screen
        slideAnim.setValue(entryX);
        setStepIndex(nextStep);

        // 3. One frame later: new content is painted — spring it in
        requestAnimationFrame(() => {
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 65,
            friction: 11,
            useNativeDriver: true,
          }).start();
        });
      });
    },
    [slideAnim]
  );

  const handleShare = useCallback(async () => {
    try {
      triggerLightHaptic();
      await Share.share({
        message: `I just completed the "${playbook?.title}" playbook on siFia — walking it out one step at a time. 🙏`,
      });
    } catch (_error) {
      // User cancelled share — silent
    }
  }, [playbook?.title]);

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

  const goNext = useCallback(() => {
    triggerLightHaptic();
    if (stepIndex < TOTAL_STEPS - 1) {
      // Skip prayer step (4) if this playbook has no prayer
      const hasPrayer = (playbook?.prayer || '').length > 0;
      const next = !hasPrayer && stepIndex === 3 ? 5 : stepIndex + 1;
      animateStep(next, 'forward');
    }
  }, [stepIndex, animateStep, playbook?.prayer]);

  const goBack = useCallback(() => {
    triggerLightHaptic();
    if (stepIndex === 0) {
      navigation.goBack();
    } else {
      // Skip back over prayer step (4) if this playbook has no prayer
      const hasPrayer = (playbook?.prayer || '').length > 0;
      const prev = !hasPrayer && stepIndex === 5 ? 3 : stepIndex - 1;
      animateStep(prev, 'back');
    }
  }, [stepIndex, animateStep, navigation, playbook?.prayer]);

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
  const prayerText = playbook.prayer || '';

  // If no prayer exists (old playbooks), skip step 4 entirely
  const hasPrayer = prayerText.length > 0;

  // Gentle transition phrases — rotate based on playbook id so each playbook gets a
  // consistent phrase, but it varies across different playbooks.
  const TRANSITION_PHRASES = [
    'Sit with that before you go further.',
    'Take a breath. Then continue.',
    'Let that settle before you move on.',
    'Stay here for a moment before you read on.',
    'Pause before you continue.',
    'Read that again if you need to.',
    'Let that land before moving forward.',
    'Do not rush past this.',
  ];
  const transitionLine: string =
    (playbook.transitionLine && playbook.transitionLine.trim().length > 0
      ? playbook.transitionLine
      : (() => {
          const id = playbook.id || '';
          const idx = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % TRANSITION_PHRASES.length;
          return TRANSITION_PHRASES[idx];
        })());

  console.log('[PlaybookWalkthroughScreen] playbook.transitionLine:', playbook.transitionLine);
  console.log('[PlaybookWalkthroughScreen] computed transitionLine:', transitionLine);
  console.log('[PlaybookWalkthroughScreen] full playbook keys:', Object.keys(playbook));

  const wordToSpeak =
    playbook.wordToSpeak ||
    (Array.isArray((playbook as any).wordsToSpeak) && (playbook as any).wordsToSpeak.length > 0
      ? (playbook as any).wordsToSpeak.join('\n')
      : (playbook.affirmations && playbook.affirmations.length > 0
          ? playbook.affirmations.map((a: any) => a.text).join('\n')
          : ''));

  const closingText =
    playbook.challengeCTA ||
    getDirectChallengeText(playbook.directChallenge) ||
    'Carry what God has shown you into the room.';

  // Only Completion (step 6) handles its own CTA — all other steps get the floating next
  const hasFloatingNext = stepIndex !== 6;

  return (
    <View style={styles.container}>
      {/* Step content */}
      <GestureDetector
        gesture={Gesture.Fling()
          .direction(Directions.LEFT)
          .onEnd(() => {
            if (stepIndex < TOTAL_STEPS - 1) {
              runOnJS(goNext)();
            }
          })}
      >
        <GestureDetector
          gesture={Gesture.Fling()
            .direction(Directions.RIGHT)
            .onEnd(() => {
              if (stepIndex > 0) {
                runOnJS(goBack)();
              }
            })}
        >
          {/* Animated slide container */}
          <Animated.View
            style={[styles.stepContainer, { transform: [{ translateX: slideAnim }] }]}
          >
            {stepIndex === 0 && (
              <EnterMomentStep
                title={playbook.title}
                userInput={playbook.userInput}
                summary={playbook.truthInLove?.summary || ''}
                userName={userName}
                transitionLine={transitionLine}
                onContinue={goNext}
                insets={insets}
              />
            )}

            {stepIndex === 1 && (
              <TruthInLoveStep
                text={playbook.truthInLove?.text || ''}
                userName={userName}
                onNext={goNext}
                insets={insets}
              />
            )}

            {stepIndex === 2 && (
              <ScriptureAnchorStep
                reference={playbook.bibleVerse?.reference || ''}
                text={playbook.bibleVerse?.text || ''}
                version={playbook.bibleVerse?.version}
                reflection={playbook.bibleVerseReflection}
                onNext={goNext}
                insets={insets}
              />
            )}

            {stepIndex === 3 && (
              <FaithfulActionsStep
                steps={playbook.actionSteps || []}
                intro={playbook.faithfulActionsIntro}
                playbookId={playbook.id}
                userId={userId}
                onNext={goNext}
                insets={insets}
              />
            )}

            {stepIndex === 4 && (
              <PrayerStep
                prayer={prayerText}
                onNext={goNext}
                insets={insets}
              />
            )}

            {stepIndex === 5 && (
              <WordToSpeakStep
                word={wordToSpeak}
                onNext={goNext}
                insets={insets}
              />
            )}

            {stepIndex === 6 && (
              <CompletionStep
                title={playbook.title}
                closingText={closingText}
                onFinish={handleFinish}
                insets={insets}
              />
            )}
          </Animated.View>
        </GestureDetector>
      </GestureDetector>

      {/* Floating close button — top left (steps 0–5), always closes the screen */}
      {stepIndex !== 6 && (
        <TouchableOpacity
          onPress={navigation.goBack}
          style={[styles.closeButton, { top: insets.top + 8 }]}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>
      )}

      {/* Animated share button — top left, completion page only */}
      {stepIndex === 6 && (
        <Animated.View
          style={[
            styles.closeButton,
            { top: insets.top + 8 },
            {
              opacity: shareButtonAnim,
              transform: [
                {
                  scale: shareButtonAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.4, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleShare}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="share-outline" size={17} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Floating coral next button — bottom right */}
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
  // Close/share — top-right circle
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 999,
    zIndex: 100,
  },
  // Next — matches original: absolute, bottom-right, coral circle
  nextButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
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

  // Enter the Moment
  playbookLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
    marginTop: 16,
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
    marginBottom: 20,
  },
  userInputText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  title: {
    fontSize: 18,
    color: Colors.hopeWhite,
    lineHeight: 26,
    marginBottom: 24,
    textAlign: 'center',
  },
  summaryBlock: {
    gap: 16,
    marginTop: 'auto',
    marginBottom: 36,
  },
  // Line 0: personalized sentence — large + bold, like the hero title
  summaryLead: {
    fontSize: 22,
    color: Colors.hopeWhite,
    lineHeight: 30,
    marginBottom: 36,
  },
  // Lines 1+: pause + Jesus line — smaller, muted, left-aligned
  summaryMuted: {
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 22,
  },

  // Shared label row (icon + text)
  stepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 48,
  },
  stepLabelWhite: {
    fontSize: 12,
    letterSpacing: 1,
    color: Colors.hopeWhite,
    textTransform: 'uppercase',
  },

  // Truth in Love
  textBlock: {
    gap: 14,
    marginTop: 28,
    marginBottom: 36,
  },
  bodyText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 26,
    opacity: 0.9,
  },

  // Scripture
  // alertCoral vertical bar on the left — blockquote style
  verseCard: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.alertCoral,
    borderRadius: 2,
    paddingLeft: 18,
    paddingVertical: 4,
    marginTop: 28,
    marginBottom: 28,
  },
  verseRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  scriptureRef: {
    fontSize: 14,
    letterSpacing: 0.5,
    color: Colors.alertCoral,
  },
  versionBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  versionAndInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  versionText: {
    fontSize: 10,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.5)',
  },
  scriptureText: {
    fontSize: 19,
    color: Colors.hopeWhite,
    lineHeight: 28,
  },
  reflectionBlock: {
    gap: 8,
    marginBottom: 40,
    paddingHorizontal: 4,
  },
  reflectionNote: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },

  // Faithful Actions
  actionIntro: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  stepNumberContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 14,
    color: Colors.alertCoral,
    lineHeight: 18,
  },
  // Body line styles — smart rendering
  actionBodyLine: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 23,
  },
  bodyLineQuote: {
    fontSize: 16,
    color: Colors.faithGold,
    lineHeight: 24,
    fontStyle: 'italic',
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: Colors.faithGold,
  },
  bodyLineIntro: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  bodyLinePunch: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 23,
  },
  // Choice pills — for 'choose' type steps
  choicePill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignSelf: 'flex-start',
    marginVertical: 3,
  },
  choicePillSelected: {
    backgroundColor: 'rgba(255,107,107,0.18)',
    borderColor: Colors.alertCoral,
  },
  choicePillText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 21,
  },
  choicePillTextSelected: {
    color: Colors.hopeWhite,
  },
  journalInputWrapper: {
    marginTop: 8,
    gap: 6,
  },
  journalInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    color: Colors.hopeWhite,
    fontSize: 15,
    lineHeight: 22,
    padding: 14,
    minHeight: 100,
    maxHeight: 200,
  },
  journalSavedLabel: {
    fontSize: 13,
    color: Colors.faithGold,
    alignSelf: 'flex-start',
  },
  actionCounter: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  actionStepCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    padding: 22,
    marginBottom: 32,
    gap: 12,
  },
  actionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.alertCoral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: {
    fontSize: 14,
    color: Colors.hopeWhite,
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
    backgroundColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 15,
    color: Colors.hopeWhite,
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

  // Outer container for Prayer + Word to Speak — flex column so content can center
  prayerStepOuter: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 0,
  },

  // Prayer
  prayerBlock: {
    marginTop: 28,
  },
  prayerText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 26,
    opacity: 0.9,
  },
  // "I prayed this" — devotional-style toggleable pill
  prayerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(26,60,109,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 8,
  },
  prayerActionButtonActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderColor: 'rgba(255, 107, 107, 0.4)',
  },
  prayerActionButtonFloating: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(26,60,109,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  prayerActionText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  prayerActionTextActive: {
    color: Colors.alertCoral,
  },

  // Word to Speak
  wordBlock: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    padding: 36,
    gap: 14,
  },
  wordText: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.hopeWhite,
    lineHeight: 32,
    textAlign: 'left',
  },

  // Completion
  completionHeaderContainer: {
    gap: 8,
    marginBottom: 28,
    alignItems: 'center',
    marginTop: 40,
  },
  completionPlaybookLabel: {
    fontSize: 12,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 24,
  },
  completionTitle: {
    fontSize: 28,
    color: Colors.hopeWhite,
    lineHeight: 34,
    textAlign: 'center',
  },
  completionContext: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.hopeWhite,
    lineHeight: 24,
    marginBottom: 16,
  },
  completionQuestion: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.hopeWhite,
    lineHeight: 28,
    marginBottom: 20,
  },
  completionChoicesContainer: {
    gap: 12,
    marginBottom: 32,
  },
  completionActionsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  completionActionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  completionActionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  completionActionNumber: {
    fontSize: 14,
    color: Colors.alertCoral,
    lineHeight: 18,
  },
  completionActionLine: {
    flex: 1,
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  completionStayNote: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: -4,
    marginTop: 32,
  },
  completionChoicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(26,60,109,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  completionChoicePillActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderColor: 'rgba(255, 107, 107, 0.4)',
  },
  completionChoiceText: {
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  completionChoiceTextActive: {
    color: Colors.alertCoral,
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
    backgroundColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    marginTop: 'auto',
  },
  primaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  devotionalButton: {
    marginTop: 8,
  },

  // Transition line — calm bridge shown at bottom of Step 0
  transitionLineContainer: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  transitionLineText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  confirmButton: {
    borderWidth: 1.5,
    borderColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 'auto',
  },
  confirmButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
});

export default withErrorBoundary(PlaybookWalkthroughScreen, 'PlaybookWalkthroughScreen');

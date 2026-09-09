
// src/screens/PlaybookWalkthroughScreen.tsx
import * as React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlaybookReadingMinutes } from '../utils/playbookReadingTime';
import TruthScreenElement from '../components/TruthScreenElement';
import ShareableSelectableText from '../components/ShareableSelectableText';
import { normalizeTruthScreenEnhancement } from '../../supabase/functions/_shared/truthScreenEnhancement';
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
  DeviceEventEmitter,
  Platform,
  LayoutAnimation,
  UIManager,
  Clipboard,
  PanResponder,
  Keyboard,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors } from '../theme/colors';
import ThemedText from '../components/common/ThemedText';
import ThemedTextInput from '../components/common/ThemedTextInput';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import PlaybookSkeletonLoader from '../components/PlaybookSkeletonLoader';
import SmartJournalingReflectionModal from './SmartJournalingReflectionModal';
import SmartJournalingGratitudeModal from './SmartJournalingGratitudeModal';
import SmartJournalingTimeBlockModal from './SmartJournalingTimeBlockModal';
import HowToModal from '../components/HowToModal';
import { getActionWisdom } from '../services/actionWisdomService';
import { NewSubscriptionService } from '../services/NewSubscriptionService';
import { triggerLightHaptic, triggerMediumHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { parseCanonicalQuotedInstructionLine } from '../utils/actionWisdomParsing';
import { buildTruthPostText } from '../utils/truthSharing';
import { replaceAllNamePlaceholders } from '../utils/nameReplacement';
import { normalizePrayerText } from '../utils/prayerFormatting';
import { pdfExportService } from '../utils/pdfExportService';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useCreateJournalEntry } from '../services/hooks/useJournalData';
import { useCreateGuidedPrayer } from '../services/hooks/usePrayerData';
import { faithPointsService } from '../services/faithPointsService';
import { visibleStreakService } from '../services/visibleStreakService';
import { toLocalDateString } from '../utils/date';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { PDF_EXPORT_UPGRADE_PROMPT } from '../services/tierRestrictionService';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPlaybook } from '../services/apiIntegration';
import { updatePlaybookStatus, updateWalkthroughProgress, updateActionStepCompleted, updatePlaybookPrayerPrayed } from '../services/supabaseApiNormalized';
import { BibleCopyrightModal } from '../components/BibleCopyrightModal';
import PlaybookReadyOverlay from '../components/PlaybookReadyOverlay';
import ShareDropdownModal from '../components/ShareDropdownModal';
import TruthToCarryShareComposer from '../components/TruthToCarryShareComposer';
import ScriptureReaderModal from '../components/ScriptureReaderModal';
import { refinePlaybook, type PlaybookCorrectionType } from '../services/playbookRefinementService';

import type { RootStackParamList } from '../navigation/types';
import type { ActionStep, PlaybookCover, TruthBeat } from '../interfaces/playbook';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;

type Props = NativeStackScreenProps<RootStackParamList, 'PlaybookWalkthrough'>;

const COVER_STEP_INDEX = -1;
const TOTAL_STEPS = 7;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const REFINEMENT_OPTIONS: Array<{ id: string; type: PlaybookCorrectionType; label: string }> = [
  { id: 'not_what_i_meant', type: 'wrong_assumption', label: "That's not what I meant" },
  { id: 'more_to_situation', type: 'missing_detail', label: "There's more to the situation" },
  { id: 'wrong_focus', type: 'wrong_assumption', label: "This isn't what I'm struggling with most" },
  { id: 'something_else', type: 'explain_more', label: 'Something else' },
];

type RefinementUpgradeTier = 'growth' | 'transformation';

const getRefinementUpgradeTier = (subscription: any): RefinementUpgradeTier | null => {
  const storedTier = String(subscription?.tier || 'seeker').replace(/_annual$/, '');
  const effectiveTier = storedTier === 'free_trial'
    ? String(subscription?.trial_chosen_tier || 'growth').replace(/_annual$/, '')
    : storedTier;
  if (effectiveTier === 'transformation') { return null; }
  return effectiveTier === 'growth' ? 'transformation' : 'growth';
};

const getRefinementResetLabel = (subscription: any): string => {
  const now = new Date();
  const storedTier = String(subscription?.tier || 'seeker').replace(/_annual$/, '');
  let resetDate: Date;

  if (storedTier === 'free_trial' && subscription?.trial_end_date) {
    resetDate = new Date(subscription.trial_end_date);
  } else if (storedTier === 'seeker') {
    const anchor = new Date(subscription?.last_usage_reset || subscription?.created_at || now);
    resetDate = new Date(anchor.getTime() + 30 * 24 * 60 * 60 * 1000);
    while (resetDate <= now) {
      resetDate = new Date(resetDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  } else {
    const anchor = new Date(subscription?.subscription_start_date || subscription?.created_at || now);
    const anchorDay = anchor.getDate();
    const thisMonthDay = Math.min(anchorDay, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
    resetDate = new Date(now.getFullYear(), now.getMonth(), thisMonthDay);
    if (resetDate <= now) {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextMonthDay = Math.min(anchorDay, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate());
      resetDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextMonthDay);
    }
  }

  if (Number.isNaN(resetDate.getTime()) || resetDate <= now) {
    resetDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  return resetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
};

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

const SELF_HARM_CRISIS_REGEX = /\b(?:suicid(?:e|al)|self[-\s]?harm|kill\s+myself|end(?:ing)?\s+my\s+life|want\s+to\s+die|thoughts?\s+of\s+(?:suicide|self[-\s]?harm|ending\s+my\s+life)|hurt\s+myself|harm\s+myself|cannot\s+stay\s+safe|can't\s+stay\s+safe|means\s+of\s+self[-\s]?harm)\b/i;

const isSelfHarmCrisisPlaybook = (parts: Array<string | undefined | null>): boolean =>
  SELF_HARM_CRISIS_REGEX.test(parts.filter(Boolean).join('\n'));

const CRISIS_HELP_ITEMS: Array<{ icon: string; label: string }> = [
  { icon: 'chatbubbles-outline', label: 'Tell someone now' },
  { icon: 'people-outline', label: 'Do not stay alone' },
  { icon: 'shield-checkmark-outline', label: 'Remove harm access' },
  { icon: 'call-outline', label: 'Emergency help if danger is immediate' },
];

const CrisisHelpPills: React.FC = () => (
  <View style={styles.crisisHelpContainer}>
    <View style={styles.crisisHelpHeader}>
      <Ionicons name="heart-circle-outline" size={15} color={Colors.alertCoral} />
      <ThemedText weight="semiBold" style={styles.crisisHelpHeaderText}>
        Safety first
      </ThemedText>
    </View>
    <View style={styles.crisisHelpPillRow}>
      {CRISIS_HELP_ITEMS.map(item => (
        <View key={item.label} style={styles.crisisHelpPill}>
          <Ionicons name={item.icon as any} size={13} color={Colors.alertCoral} />
          <ThemedText weight="medium" style={styles.crisisHelpPillText}>
            {item.label}
          </ThemedText>
        </View>
      ))}
    </View>
  </View>
);

const stripVerseQuotes = (text: string): string => {
  // Check if the verse contains actual speech attribution
  const hasSpeechAttribution = /(Jesus|Peter|Paul|they) said/i.test(text);

  // If no speech attribution, remove wrapping quotes
  if (!hasSpeechAttribution) {
    // Remove wrapping quotes if they exist
    if (text.startsWith('"') && text.endsWith('"')) {
      return text.slice(1, -1);
    }
    if (text.startsWith("'") && text.endsWith("'")) {
      return text.slice(1, -1);
    }
  }

  return text;
};

const USER_NAME_PLACEHOLDER_REGEX = /\[(?:User's Name|Name|First Name|Last Name)\](?:'s|’s)?/gi;

const nameReplacementFor = (match: string): string =>
  match.endsWith("'s") || match.endsWith('’s') ? 'your' : 'you';

const capitalizeFirstLetter = (text: string): string =>
  text.replace(/^(\s*)([a-z])/, (_match, space, letter) => `${space}${letter.toUpperCase()}`);

const firstWord = (value?: string | null): string => String(value || '').trim().split(/\s+/)[0] || '';

const getUserFirstName = (rawUser: any): string => {
  const metadata = rawUser?.user_metadata || {};
  const candidates = [
    metadata.first_name,
    rawUser?.firstName,
    metadata.given_name,
    firstWord(metadata.full_name),
    firstWord(metadata.name),
    firstWord(rawUser?.displayName),
    rawUser?.email?.split('@')[0],
  ];

  return candidates
    .map(candidate => String(candidate || '').trim())
    .find(Boolean) || '';
};

const getUserDisplayName = (rawUser: any): string => {
  const metadata = rawUser?.user_metadata || {};
  const joinedName = [metadata.first_name, metadata.last_name].filter(Boolean).join(' ').trim();
  const candidates = [
    metadata.full_name,
    joinedName,
    metadata.name,
    rawUser?.displayName,
    getUserFirstName(rawUser),
  ];

  return candidates
    .map(candidate => String(candidate || '').trim())
    .find(Boolean) || '';
};

const OPENING_NAME_COMMON_WORDS = new Set([
  'A', 'An', 'And', 'As', 'At', 'But', 'By', 'For', 'From', 'God', 'He', 'Here',
  'His', 'I', 'In', 'It', 'Jesus', 'Lord', 'Now', 'Of', 'On', 'Or', 'She',
  'So', 'That', 'The', 'Then', 'There', 'They', 'This', 'Today', 'Tomorrow',
  'We', 'When', 'Where', 'While', 'With', 'Without', 'You', 'Your',
]);

const isOpeningNameCandidate = (value: string): boolean => {
  const candidate = value.trim();
  if (!candidate || OPENING_NAME_COMMON_WORDS.has(candidate)) {
    return false;
  }

  return /^[A-Z][A-Za-z'’-]*(?:\s+[A-Z][A-Za-z'’-]*){0,2}$/.test(candidate);
};

const replaceOpeningHardcodedName = (
  text: string,
  userName: string,
  options: { replaceCommaAddress?: boolean } = {}
): string => {
  const cleanName = userName.trim();
  if (!text || cleanName.length < 2) {
    return text;
  }

  const replaceCandidate = (
    match: string,
    leading: string,
    detectedName: string,
    possessive?: string
  ) => {
    if (
      detectedName.toLowerCase() === cleanName.toLowerCase() ||
      !isOpeningNameCandidate(detectedName)
    ) {
      return match;
    }

    return `${leading}${cleanName}${possessive || ''}`;
  };

  const processed = text.replace(
    /^(\s*)([A-Z][A-Za-z'’-]*(?:\s+[A-Z][A-Za-z'’-]*){0,2})(?:(['’]s)|(?=\s+you\b))/,
    (match, leading: string, detectedName: string, possessive: string | undefined) => {
      return replaceCandidate(match, leading, detectedName, possessive);
    }
  );

  if (options.replaceCommaAddress === false) {
    return processed;
  }

  return processed.replace(
    /^(\s*)([A-Z][A-Za-z'’-]*(?:\s+[A-Z][A-Za-z'’-]*){0,2})(?=,\s*)/,
    (match, leading: string, detectedName: string) => replaceCandidate(match, leading, detectedName)
  );
};

const replaceNamePlaceholdersWith = (text: string, userName: string): string =>
  text.replace(USER_NAME_PLACEHOLDER_REGEX, (match) =>
    match.endsWith("'s") || match.endsWith('’s') ? `${userName}'s` : userName
  );

const personalizeTruthContent = <T,>(value: T, userName: string): T => {
  const cleanName = userName.trim();
  if (!cleanName || /^unknown$/i.test(cleanName)) {
    return value;
  }
  if (typeof value === 'string') {
    return replaceNamePlaceholdersWith(value, cleanName)
      .replace(/\bUnknown\b('s|’s)?/gi, (_match, possessive) => `${cleanName}${possessive || ''}`) as T;
  }
  if (Array.isArray(value)) {
    return value.map(item => personalizeTruthContent(item, cleanName)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, personalizeTruthContent(item, cleanName)])
    ) as T;
  }
  return value;
};

const personalizeEntryTitle = (text: string, userName: string): string => {
  const cleanName = userName.trim();
  let processed = replaceAllNamePlaceholders(
    text,
    { displayName: cleanName, firstName: cleanName },
    { replaceHardcodedNames: false }
  );

  if (cleanName.length < 2) {
    return processed;
  }

  processed = replaceNamePlaceholdersWith(processed, cleanName);
  return replaceOpeningHardcodedName(processed, cleanName, { replaceCommaAddress: false });
};

const userNameRegex = (userName: string): RegExp | null => {
  const cleanName = userName.trim();
  if (cleanName.length < 2) {
    return null;
  }

  const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}('s|’s)?\\b`, 'gi');
};

const removeUserNameReferences = (text: string, userName: string): string => {
  let processed = text.replace(USER_NAME_PLACEHOLDER_REGEX, nameReplacementFor);
  const regex = userNameRegex(userName);
  if (!regex) {
    return capitalizeFirstLetter(processed.replace(/^you,\s+/i, '').replace(/^you\b/i, 'you'));
  }

  processed = processed.replace(new RegExp(`\\b${userName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\s+you\\b`, 'gi'), 'you');
  processed = processed.replace(regex, nameReplacementFor);
  return capitalizeFirstLetter(processed.replace(/^you,\s+/i, '').replace(/^you\b/i, 'you'));
};

const keepOnlyOpeningUserName = (text: string, userName: string): string => {
  const cleanName = userName.trim();
  let processed = replaceAllNamePlaceholders(
    text,
    { displayName: cleanName, firstName: cleanName },
    { replaceHardcodedNames: false }
  );

  if (cleanName.length < 2) {
    return processed.replace(USER_NAME_PLACEHOLDER_REGEX, nameReplacementFor);
  }

  processed = replaceOpeningHardcodedName(processed, cleanName);

  // Simple approach: replace all occurrences of the name after the first one with "you"
  // First, find the first occurrence and keep it
  const nameRegex = new RegExp(`\\b${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  let firstMatchFound = false;

  processed = processed.replace(nameRegex, (match, _offset) => {
    if (!firstMatchFound) {
      firstMatchFound = true;
      return match; // Keep the first occurrence
    }
    return 'you'; // Replace all subsequent occurrences with "you"
  });

  processed = processed.replace(USER_NAME_PLACEHOLDER_REGEX, (match, offset) =>
    offset <= 2 ? cleanName : nameReplacementFor(match)
  );

  return processed;
};

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

const getPlaybookCover = (playbook: any): PlaybookCover | null => {
  const cover = playbook?.cover;
  if (!cover || typeof cover !== 'object') {
    return null;
  }

  const title = String(cover.title || '').trim();
  const subtitle = String(cover.subtitle || '').trim();
  if (!title || !subtitle) {
    return null;
  }

  return {
    title,
    subtitle,
    estimatedMinutes: getPlaybookReadingMinutes(playbook),
  };
};

const stripGeneratedListMarker = (value: string): string =>
  String(value || '')
    .replace(/^\s*[-•+*]+\s*/, '')
    .replace(/\s*[-•+*]+\s*$/g, '')
    .replace(/\s+[-•+]\s+/g, ' ')
    .trim();

const getCleanOptionalText = (value: unknown): string | undefined => {
  const text = stripGeneratedListMarker(String(value || '').trim());
  return text || undefined;
};

const getCleanTextArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 4);
  return items.length > 0 ? items : undefined;
};

const normalizeScriptureBackingForClient = (raw: any): TruthBeat['scriptureBacking'] => {
  if (!raw || typeof raw !== 'object') return undefined;
  const rawPassages = Array.isArray(raw.passages)
    ? raw.passages
    : raw.reference && raw.significance
      ? [{ reference: raw.reference, connection: raw.significance }]
      : [];
  const passages = rawPassages
    .map((passage: any) => {
      const reference = getCleanOptionalText(passage?.reference)
        ?.replace(/^in\s+/i, '')
        .replace(/[\s:—–-]+$/, '')
        .trim();
      const connection = getCleanOptionalText(passage?.connection ?? passage?.significance);
      return reference && connection ? { reference, connection } : null;
    })
    .filter(Boolean)
    .slice(0, 2) as Array<{ reference: string; connection: string }>;
  return passages.length > 0 ? { passages } : undefined;
};

const normalizeHoldEntrustForClient = (raw: any): TruthBeat['holdEntrust'] => {
  if (!raw || typeof raw !== 'object') return undefined;
  const holdLabel = getCleanOptionalText(raw.holdLabel ?? raw.hold_label) || 'What will you hold?';
  const holdStatement = getCleanOptionalText(raw.holdStatement ?? raw.hold_statement);
  const entrustLabel = getCleanOptionalText(raw.entrustLabel ?? raw.entrust_label) || 'What will you entrust?';
  const entrustStatement = getCleanOptionalText(raw.entrustStatement ?? raw.entrust_statement);
  if (!holdStatement || !entrustStatement) return undefined;
  return {
    holdLabel,
    holdStatement,
    entrustLabel,
    entrustStatement,
    handoffLabel: getCleanOptionalText(raw.handoffLabel ?? raw.handoff_label) || 'Now anchor this in Scripture',
    handoffBody: getCleanOptionalText(raw.handoffBody ?? raw.handoff_body) || 'You\'ve reflected on what you\'re carrying. Now bring what you\'ve seen under the authority of God\'s Word.',
    cta: getCleanOptionalText(raw.cta ?? raw.ctaLabel) || 'Continue to Scripture',
  };
};

const normalizePathForClient = (raw: any): TruthBeat['path'] => {
  if (!raw || typeof raw !== 'object') return undefined;
  const fromSteps = Array.isArray(raw.fromSteps ?? raw.from_steps)
    ? (raw.fromSteps ?? raw.from_steps).map(getCleanOptionalText).filter(Boolean).slice(0, 6)
    : [];
  const toSteps = Array.isArray(raw.toSteps ?? raw.to_steps)
    ? (raw.toSteps ?? raw.to_steps).map(getCleanOptionalText).filter(Boolean).slice(0, 6)
    : [];
  if (fromSteps.length < 2 || toSteps.length < 2) return undefined;
  return {
    fromTitle: getCleanOptionalText(raw.fromTitle ?? raw.from_title) || 'Notice where this leads',
    toTitle: getCleanOptionalText(raw.toTitle ?? raw.to_title) || 'See another direction',
    fromSteps,
    toSteps,
    isLoop: Boolean(raw.isLoop ?? raw.is_loop),
    selfRecognition: getCleanOptionalText(raw.selfRecognition ?? raw.self_recognition) || '',
  };
};

const normalizeTruthBeat = (beat: any): TruthBeat | null => {
  if (!beat || typeof beat !== 'object') {
    return null;
  }

  const label = getCleanOptionalText(beat.label) || '';
  const primaryTruth = getCleanOptionalText(beat.primaryTruth ?? beat.primary_truth) || '';
  if (!primaryTruth) {
    return null;
  }

  const revealLabel = getCleanOptionalText(beat.reveal?.label ?? beat.reveal_label);
  const revealContent = getCleanOptionalText(beat.reveal?.content ?? beat.reveal_content);
  const truthOneLabel = getCleanOptionalText(beat.twoTruths?.[0]?.label ?? beat.truth_one_label);
  const truthOne = getCleanOptionalText(beat.twoTruths?.[0]?.text ?? beat.truth_one);
  const truthTwoLabel = getCleanOptionalText(beat.twoTruths?.[1]?.label ?? beat.truth_two_label);
  const truthTwo = getCleanOptionalText(beat.twoTruths?.[1]?.text ?? beat.truth_two);
  const rawUntangleItems = beat.untangle?.items ?? beat.untangle_items;
  const untangleItems = Array.isArray(rawUntangleItems)
    ? rawUntangleItems
        .map((item: any) => ({
          label: getCleanOptionalText(item?.label) || '',
          text: getCleanOptionalText(item?.text) || '',
        }))
        .filter((item: { label: string; text: string }) => item.label && item.text)
        .slice(0, 4)
    : [];
  const rawUntangleStyle = String(beat.untangle?.style ?? beat.untangle_style ?? '').toLowerCase();
  const untangleStyle: 'compare' | 'stack' | 'collapsible' =
    rawUntangleStyle === 'compare' || rawUntangleStyle === 'stack' || rawUntangleStyle === 'collapsible'
      ? rawUntangleStyle
      : untangleItems.length === 2 ? 'compare' : untangleItems.length >= 4 ? 'collapsible' : 'stack';

  return {
    label,
    primaryTruth,
    supportingTruth: getCleanOptionalText(beat.supportingTruth ?? beat.supporting_truth),
    enhancement: normalizeTruthScreenEnhancement(beat.enhancement),
    scriptureBacking: normalizeScriptureBackingForClient(beat.scriptureBacking ?? beat.scripture_backing),
    reveal: revealLabel && revealContent ? { label: revealLabel, content: revealContent } : undefined,
    presentation: getCleanOptionalText(beat.presentation) as TruthBeat['presentation'],
    contrast: {
      notThis: getCleanOptionalText(beat.contrast?.notThis ?? beat.contrast_not),
      butThis: getCleanOptionalText(beat.contrast?.butThis ?? beat.contrast_but),
    },
    boundary: {
      clear: getCleanOptionalText(beat.boundary?.clear ?? beat.boundary_clear),
      caution: getCleanOptionalText(beat.boundary?.caution ?? beat.boundary_caution),
    },
    twoTruths: truthOne && truthTwo
      ? [
          { label: truthOneLabel || 'Truth one', text: truthOne },
          { label: truthTwoLabel || 'Truth two', text: truthTwo },
        ]
      : undefined,
    untangle: untangleItems.length >= 2 ? { style: untangleStyle, items: untangleItems } : undefined,
    path: normalizePathForClient(beat.path),
    holdEntrust: normalizeHoldEntrustForClient(beat.holdEntrust ?? beat.hold_entrust),
    reflectionQuestions: getCleanTextArray(beat.reflectionQuestions ?? beat.reflection_questions),
  };
};

const getTruthBeats = (playbook: any, userName = ''): TruthBeat[] => {
  const rawBeats = playbook?.truthInLove?.beats ?? playbook?.truthInLove?.truth_beats ?? playbook?.truthBeats;
  if (!Array.isArray(rawBeats)) {
    return [];
  }

  const hasSummary = typeof playbook?.truthInLove === 'object' && !!playbook?.truthInLove?.summary;
  const beatLimit = hasSummary ? 5 : 6;
  const normalizedBeats = rawBeats
    .map(normalizeTruthBeat)
    .filter(Boolean)
    .slice(0, beatLimit) as TruthBeat[];

  if (!hasSummary) {
    return normalizedBeats;
  }

  const rawSummaryText = getCleanOptionalText(playbook.truthInLove.summary);
  if (!rawSummaryText) {
    return normalizedBeats;
  }
  const summaryText = userName
    ? replaceOpeningHardcodedName(personalizeTruthContent(rawSummaryText, userName), userName)
    : rawSummaryText;

  const firstPeriod = summaryText.indexOf('.');
  const hasSupportingText = firstPeriod > 0 && firstPeriod < summaryText.length - 1;
  const primaryTruth = hasSupportingText ? summaryText.slice(0, firstPeriod + 1).trim() : summaryText;
  const supportingTruth = hasSupportingText ? summaryText.slice(firstPeriod + 1).trim() : '';

  const summaryBeat: TruthBeat = {
    label: '',
    primaryTruth,
    enhancement: normalizeTruthScreenEnhancement(playbook.truthInLove.summaryEnhancement),
    scriptureBacking: normalizeScriptureBackingForClient(
      playbook.truthInLove.summaryScriptureBacking ?? playbook.truthInLove.summary_scripture_backing
    ),
    ...(supportingTruth ? { supportingTruth } : {}),
  };

  return [summaryBeat, ...normalizedBeats];
};

const getTruthToCarry = (playbook: any): string | undefined => {
  return getCleanOptionalText(
    playbook?.truthInLove?.truthToCarry ??
    playbook?.truthInLove?.truth_to_carry ??
    playbook?.truthToCarry
  );
};

interface PlaybookInputToggleProps {
  userInput: string;
  refinementNote?: string | null;
  onEditUserInput?: () => void;
  style?: any;
}

const PlaybookInputToggle: React.FC<PlaybookInputToggleProps> = ({
  userInput,
  refinementNote,
  onEditUserInput,
  style,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const [showUserInput, setShowUserInput] = useState(false);
  const chevronAnim = useRef(new Animated.Value(0)).current;
  const cleanRefinementNote = String(refinementNote || '').trim();
  const momentCopyText = cleanRefinementNote
    ? `${userInput}\n\nRefined:\n${cleanRefinementNote}`
    : userInput;

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

  return (
    <StepFadeIn delay={0} style={style}>
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

      {showUserInput && (
        <TouchableOpacity
          style={styles.userInputCard}
          onLongPress={() => {
            triggerLightHaptic();
            Alert.alert(
              'Moment you shared',
              'What would you like to do?',
              [
                {
                  text: 'Copy',
                  onPress: () => {
                    triggerLightHaptic();
                    Clipboard.setString(momentCopyText);
                    Alert.alert('Copied', 'Moment copied to clipboard');
                  },
                },
                {
                  text: 'Edit',
                  onPress: () => {
                    triggerLightHaptic();
                    onEditUserInput?.();
                  },
                },
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
              ],
              { cancelable: true }
            );
          }}
          activeOpacity={0.7}
        >
          {Platform.OS === 'ios' ? (
            <TextInput
              value={userInput}
              editable={false}
              multiline={true}
              scrollEnabled={false}
              contextMenuHidden={true}
              selectTextOnFocus={false}
              pointerEvents="none"
              textAlignVertical="top"
              style={[styles.userInputText, { fontFamily, padding: 0, margin: 0 }]}
            />
          ) : (
            <ThemedText style={styles.userInputText} selectable={false}>{userInput}</ThemedText>
          )}

          {cleanRefinementNote ? (
            <View style={styles.refinedInputBlock}>
              <View style={styles.refinedInputLabelRow}>
                <Ionicons name="refresh-outline" size={12} color="rgba(255,255,255,0.72)" />
                <ThemedText weight="semiBold" style={styles.refinedInputLabel}>REFINED</ThemedText>
              </View>
              {Platform.OS === 'ios' ? (
                <TextInput
                  value={cleanRefinementNote}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  contextMenuHidden={true}
                  selectTextOnFocus={false}
                  pointerEvents="none"
                  textAlignVertical="top"
                  style={[styles.refinedInputText, { fontFamily, padding: 0, margin: 0 }]}
                />
              ) : (
                <ThemedText style={styles.refinedInputText} selectable={false}>{cleanRefinementNote}</ThemedText>
              )}
            </View>
          ) : null}
        </TouchableOpacity>
      )}
    </StepFadeIn>
  );
};

interface CoverStepProps {
  cover: PlaybookCover;
  userInput: string;
  refinementNote?: string | null;
  onBegin: () => void;
  onEditUserInput?: () => void;
  insets: { top: number; bottom: number };
}

const CoverStep: React.FC<CoverStepProps> = ({
  cover,
  userInput,
  refinementNote,
  onBegin,
  onEditUserInput,
  insets,
}) => {
  const estimatedMinutes = cover.estimatedMinutes ?? 1;

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={[
        styles.coverContent,
        IS_IPAD && styles.stepContentPad,
        {
          paddingTop: insets.top + (IS_IPAD ? 34 : 18),
          paddingBottom: insets.bottom + 28,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.coverCenter}>
        <PlaybookInputToggle
          userInput={userInput}
          refinementNote={refinementNote}
          onEditUserInput={onEditUserInput}
          style={styles.coverInputToggle}
        />

        <StepFadeIn delay={90} style={styles.coverTextBlock}>
          <ThemedText weight="bold" style={styles.coverTitle} selectable={true}>
            {cover.title}
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={180} style={styles.coverTextBlock}>
          <ThemedText style={styles.coverSubtitle} selectable={true}>
            {cover.subtitle}
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={260}>
          <View style={styles.coverTimePill}>
            <Ionicons name="time-outline" size={15} color="rgba(255,255,255,0.72)" />
            <ThemedText weight="medium" style={styles.coverTimeText}>
              about {estimatedMinutes} min read
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={340} style={styles.coverButtonBlock}>
          <TouchableOpacity
            style={[styles.primaryButton, styles.finishButton, styles.coverBeginButton]}
            onPress={onBegin}
            activeOpacity={0.85}
          >
            <ThemedText weight="semiBold" style={styles.primaryButtonText}>
              Begin
            </ThemedText>
          </TouchableOpacity>
        </StepFadeIn>
      </View>
    </ScrollView>
  );
};

// ─── Step 0: Enter the Moment ────────────────────────────────────────────────

interface EnterMomentProps {
  title: string;
  userInput: string;
  refinementNote?: string | null;
  summary: string;
  userName: string;
  transitionLine?: string;
  showSafetyHelp?: boolean;
  showInputToggle?: boolean;
  showSummary?: boolean;
  onContinue: () => void;
  onEditUserInput?: () => void;
  insets: { top: number };
}

const EnterMomentStep: React.FC<EnterMomentProps> = ({
  title,
  userInput,
  refinementNote,
  summary,
  userName,
  transitionLine,
  showSafetyHelp = false,
  showInputToggle = true,
  showSummary = true,
  onContinue: _onContinue,
  onEditUserInput: _onEditUserInput,
  insets,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const personalizedTitle = personalizeEntryTitle(title, userName);
  const personalized = keepOnlyOpeningUserName(summary, userName);
  // Cap to 2 paragraphs — this is an entry moment, not the full truth section
  const paragraphs = splitParagraphs(personalized).slice(0, 2);

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8) }]}
      showsVerticalScrollIndicator={false}
    >
      {showInputToggle ? (
        <PlaybookInputToggle
          userInput={userInput}
          refinementNote={refinementNote}
          onEditUserInput={_onEditUserInput}
        />
      ) : null}

      <StepFadeIn delay={80}>
        {Platform.OS === 'ios' ? (
          <TextInput
            value={personalizedTitle}
            editable={false}
            multiline={true}
            scrollEnabled={false}
            style={[styles.title, { fontWeight: '500' as any, fontFamily }]}
          />
        ) : (
          <ThemedText weight="medium" style={styles.title} selectable={true}>{personalizedTitle}</ThemedText>
        )}
      </StepFadeIn>

      {showSummary && paragraphs.length > 0 ? (
        <StepFadeIn delay={160} style={{ marginTop: 40 }}>
          {paragraphs.map((paragraph, index) => (
            Platform.OS === 'ios' ? (
              <TextInput
                key={index}
                value={paragraph}
                editable={false}
                multiline={true}
                scrollEnabled={false}
                style={[styles.summaryLead, (index === 1 || index === 2) && { fontSize: 16 }, index === 1 && { marginBottom: 4 }, index === 0 && { fontWeight: '600' as any }, { fontFamily }]}
              />
            ) : (
              <ThemedText key={index} style={[styles.summaryLead, (index === 1 || index === 2) && { fontSize: 16 }, index === 1 && { marginBottom: 4 }]} weight={index === 0 ? 'semiBold' : undefined} selectable={true}>
                {paragraph}
              </ThemedText>
            )
          ))}
        </StepFadeIn>
      ) : null}

      {showSafetyHelp ? (
        <StepFadeIn delay={420} style={styles.crisisHelpOnMoment}>
          <CrisisHelpPills />
        </StepFadeIn>
      ) : null}

      {transitionLine ? (
        <StepFadeIn delay={500} style={styles.transitionLineContainer}>
          {Platform.OS === 'ios' ? (
            <TextInput
              value={transitionLine}
              editable={false}
              multiline={true}
              scrollEnabled={false}
              style={[styles.transitionLineText, { fontFamily }]}
            />
          ) : (
            <ThemedText style={styles.transitionLineText} selectable={true}>{transitionLine}</ThemedText>
          )}
        </StepFadeIn>
      ) : null}

    </ScrollView>
  );
};

// ─── Step 1: Truth in Love ───────────────────────────────────────────────────

interface TruthStepProps {
  text: string;
  userName: string;
  beats?: TruthBeat[];
  truthToCarry?: string;
  beatIndex?: number;
  showSafetyHelp?: boolean;
  onNext: () => void;
  onBeatNext?: () => void;
  onBeatBack?: () => void;
  onGoToScripture?: () => void;
  bibleVersion?: string;
  onOpenRefinement?: () => void;
  onShareReflection?: (text: string, options?: { noSplit?: boolean }) => void;
  onShareScripture?: (text: string) => void;
  insets: { top: number; bottom: number };
}

const TRUTH_PREVIEW_COUNT = 2; // paragraphs visible before "Read more"
const MAX_PARAGRAPH_LENGTH = 300; // Maximum characters for paragraphs when collapsed

const PathArrow: React.FC<{ name: string; phase?: number; style?: any; size?: number; color?: string }> = ({
  name,
  phase = 0,
  style,
  size = 14,
  color = 'rgba(255,255,255,0.35)',
}) => {
  const arrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(arrowAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [arrowAnim]);

  const translateY = Animated.modulo(Animated.add(arrowAnim, phase), 1).interpolate({
    inputRange: [0, 1],
    outputRange: [0, 14],
  });

  return (
    <Animated.View style={[style, { transform: [{ translateY }] }]}>
      <Ionicons name={name as any} size={size} color={color} />
    </Animated.View>
  );
};

interface TruthBeatStepProps extends TruthStepProps {
  beats: TruthBeat[];
  beatIndex: number;
  onBeatNext: () => void;
  onBeatBack: () => void;
  onGoToScripture?: () => void;
}

const TruthBeatStep: React.FC<TruthBeatStepProps> = ({
  beats,
  truthToCarry,
  userName: _userName,
  beatIndex,
  showSafetyHelp = false,
  onBeatNext,
  onBeatBack,
  onGoToScripture,
  bibleVersion,
  onOpenRefinement,
  onShareReflection,
  onShareScripture,
  insets,
}) => {
  const [revealedBeats, setRevealedBeats] = useState<Record<number, boolean>>({});
  const [openScriptureBackings, setOpenScriptureBackings] = useState<Record<number, boolean>>({});
  const [openUntangleItems, setOpenUntangleItems] = useState<Record<string, boolean>>({});
  const [selectedPathStep, setSelectedPathStep] = useState<string | null>(null);
  const [selectedHoldEntrust, setSelectedHoldEntrust] = useState<{ hold: boolean; entrust: boolean }>({ hold: false, entrust: false });
  const [scriptureConfirmOpen, setScriptureConfirmOpen] = useState(false);
  const [scriptureReaderIndex, setScriptureReaderIndex] = useState<number | null>(null);
  const scriptureConfirmAnim = useRef(new Animated.Value(0)).current;
  const truthNavCollapseAnim = useRef(new Animated.Value(0)).current;
  const lastTruthScrollYRef = useRef(0);
  const truthNavHiddenRef = useRef(false);
  const truthContentHeightRef = useRef(0);
  const truthViewportHeightRef = useRef(0);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [truthNavCollapsed, setTruthNavCollapsed] = useState(false);
  const currentIndex = Math.min(Math.max(beatIndex, 0), beats.length - 1);

  useEffect(() => {
    setOpenScriptureBackings({});
  }, [currentIndex]);

  const currentBeat = beats[currentIndex];
  const primaryText = currentBeat.primaryTruth;
  const supportingText = currentBeat.supportingTruth;
  const scriptureBacking = currentBeat.scriptureBacking;
  const scriptureBackingOpen = !!openScriptureBackings[currentIndex];
  const isLastBeat = currentIndex >= beats.length - 1;
  const presentation = currentBeat.presentation || 'statement';
  const reveal = currentBeat.reveal;
  const revealOpen = !!revealedBeats[currentIndex];
  const isExamineBeat = presentation === 'examine';
  const contrastNot = currentBeat.contrast?.notThis;
  const contrastBut = currentBeat.contrast?.butThis;
  const boundaryClear = currentBeat.boundary?.clear;
  const boundaryCaution = currentBeat.boundary?.caution;
  const twoTruths = currentBeat.twoTruths || [];
  const untangle = currentBeat.untangle;
  const untangleItems = untangle?.items || [];
  const showUntangle = untangleItems.length >= 2 && presentation === 'untangle';
  const path = currentBeat.path;
  const pathFrom = path?.fromSteps || [];
  const pathTo = path?.toSteps || [];
  const showPath = presentation === 'path' && pathFrom.length >= 2 && pathTo.length >= 2;
  const holdEntrust = currentBeat.holdEntrust;
  const showHoldEntrust = presentation === 'hold_entrust' && !!holdEntrust;
  const holdEntrustSelected = selectedHoldEntrust.hold && selectedHoldEntrust.entrust;
  const reflectionQuestions = currentBeat.reflectionQuestions || [];
  const hasExamineQuestions = isExamineBeat && reflectionQuestions.length > 0;
  const rawRevealLabel = String(reveal?.label || '').trim().replace(/:$/, '');
  const revealButtonLabel = hasExamineQuestions
    ? (/^consider these questions$/i.test(rawRevealLabel) || !rawRevealLabel ? 'Examine this gently' : rawRevealLabel)
    : rawRevealLabel || 'Reveal more';
  const shouldShowReveal = hasExamineQuestions || !!reveal?.content;
  const primaryButtonLabel = isLastBeat ? (holdEntrust?.cta || 'Anchor') : 'Continue';
  const TRUTH_NAV_PILL_WIDTH = SCREEN_WIDTH - 32;
  const TRUTH_NAV_CIRCLE_RATIO = 56 / TRUTH_NAV_PILL_WIDTH;
  const truthNavContentOpacity = truthNavCollapseAnim.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0], extrapolate: 'clamp' });
  const truthNavShapeOpacity = truthNavCollapseAnim.interpolate({ inputRange: [0, 0.7], outputRange: [1, 0], extrapolate: 'clamp' });
  const truthNavCircleOpacity = truthNavCollapseAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const truthNavShapeScaleX = truthNavCollapseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, TRUTH_NAV_CIRCLE_RATIO], extrapolate: 'clamp' });
  const truthNavShapeTranslateX = truthNavCollapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(TRUTH_NAV_PILL_WIDTH / 2) * (1 - TRUTH_NAV_CIRCLE_RATIO)],
    extrapolate: 'clamp',
  });


  useEffect(() => {
    if (scriptureConfirmOpen) {
      scriptureConfirmAnim.setValue(0);
      Animated.spring(scriptureConfirmAnim, {
        toValue: 1,
        tension: 80,
        friction: 9,
        useNativeDriver: true,
      }).start();
    }
  }, [scriptureConfirmOpen, scriptureConfirmAnim]);

  useEffect(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    truthNavHiddenRef.current = false;
    lastTruthScrollYRef.current = 0;
    truthContentHeightRef.current = 0;
    setTruthNavCollapsed(false);
    truthNavCollapseAnim.setValue(0);
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
    };
  }, [currentIndex, truthNavCollapseAnim]);

  const expandTruthNav = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    truthNavHiddenRef.current = false;
    setTruthNavCollapsed(false);
    Animated.spring(truthNavCollapseAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 13,
    }).start();
  }, [truthNavCollapseAnim]);

  const collapseTruthNav = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    truthNavHiddenRef.current = true;
    setTruthNavCollapsed(true);
    Animated.spring(truthNavCollapseAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 55,
      friction: 14,
    }).start();
  }, [truthNavCollapseAnim]);

  const handleTruthScroll = useCallback((event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const viewportHeight = event.nativeEvent.layoutMeasurement.height;
    const canScroll = contentHeight > viewportHeight + 8;
    const isScrollingUp = currentY < lastTruthScrollYRef.current;

    lastTruthScrollYRef.current = currentY;
    truthContentHeightRef.current = contentHeight;
    truthViewportHeightRef.current = viewportHeight;

    if (canScroll && currentY > 60 && !truthNavHiddenRef.current) {
      collapseTruthNav();
    } else if (isScrollingUp && currentY <= 0 && truthNavHiddenRef.current) {
      expandTruthNav();
    }
  }, [collapseTruthNav, expandTruthNav]);

  const autoCollapseTruthNavIfNeeded = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    const canScroll = truthContentHeightRef.current > truthViewportHeightRef.current + 8;
    if (canScroll && !truthNavHiddenRef.current) {
      collapseTimerRef.current = setTimeout(() => {
        collapseTimerRef.current = null;
        if (!truthNavHiddenRef.current) {
          collapseTruthNav();
        }
      }, 1200);
    }
  }, [collapseTruthNav]);

  const toggleReveal = () => {
    if (!revealOpen) {
      triggerLightHaptic();
    }
    LayoutAnimation.configureNext({
      duration: revealOpen ? 160 : 220,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    setRevealedBeats(prev => ({ ...prev, [currentIndex]: !prev[currentIndex] }));
  };

  const toggleScriptureBacking = () => {
    if (!scriptureBackingOpen) {
      triggerLightHaptic();
    }
    LayoutAnimation.configureNext({
      duration: scriptureBackingOpen ? 160 : 220,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    setOpenScriptureBackings(previous => ({
      ...previous,
      [currentIndex]: !previous[currentIndex],
    }));
  };

  const openScriptureConfirm = () => {
    triggerLightHaptic();
    setScriptureConfirmOpen(true);
  };

  const closeScriptureConfirm = () => {
    triggerLightHaptic();
    setScriptureConfirmOpen(false);
  };

  const confirmGoToScripture = () => {
    triggerLightHaptic();
    setScriptureConfirmOpen(false);
    onGoToScripture?.();
  };

  const toggleUntangleItem = (key: string) => {
    const isOpen = !!openUntangleItems[key];
    if (!isOpen) {
      triggerLightHaptic();
    }
    LayoutAnimation.configureNext({
      duration: isOpen ? 160 : 220,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    setOpenUntangleItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePathStep = (step: string) => {
    triggerLightHaptic();
    setSelectedPathStep(prev => (prev === step ? null : step));
  };

  const renderUntangle = () => {
    if (!showUntangle || !untangle) return null;
    if (untangle.style === 'compare') {
      return (
        <StepFadeIn delay={230} style={styles.truthBeatBlockGap}>
          {untangleItems.slice(0, 2).map((item, idx) => (
            <React.Fragment key={`${item.label}-${idx}`}>
              {idx === 1 ? (
                <View style={styles.truthUntangleVersusRow}>
                  <View style={styles.truthUntangleVersusLine} />
                  <ThemedText selectable weight="semiBold" style={styles.truthUntangleVersus}>versus</ThemedText>
                  <View style={styles.truthUntangleVersusLine} />
                </View>
              ) : null}
              <View style={[styles.truthUntangleCard, idx === 1 && styles.truthUntangleCardAlt]}>
                <ThemedText selectable weight="semiBold" style={[styles.truthUntangleLabel, idx === 1 && styles.truthUntangleLabelAlt]}>
                  {item.label}
                </ThemedText>
                <ShareableSelectableText text={item.text} style={styles.truthUntangleText} onShare={onShareReflection} />
              </View>
            </React.Fragment>
          ))}
        </StepFadeIn>
      );
    }
    if (untangle.style === 'collapsible') {
      return (
        <StepFadeIn delay={230} style={styles.truthBeatBlockGap}>
          {untangleItems.map((item, idx) => {
            const key = `${currentIndex}-${idx}`;
            const open = !!openUntangleItems[key];
            return (
              <View
                key={key}
                style={[styles.truthUntangleRow, open && styles.truthUntangleRowOpen]}
              >
                <TouchableOpacity
                  style={styles.truthUntangleRowHeader}
                  onPress={() => toggleUntangleItem(key)}
                  activeOpacity={0.8}
                >
                  <ThemedText selectable weight="semiBold" style={[styles.truthUntangleLabel, { marginBottom: open ? 6 : 0 }]}>{item.label}</ThemedText>
                  <Ionicons name={open ? 'remove' : 'add'} size={18} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
                {open ? (
                  <ShareableSelectableText text={item.text} style={styles.truthUntangleText} onShare={onShareReflection} />
                ) : null}
              </View>
            );
          })}
        </StepFadeIn>
      );
    }
    return (
      <StepFadeIn delay={230} style={styles.truthBeatBlockGap}>
        {untangleItems.map((item, idx) => (
          <View key={`${item.label}-${idx}`} style={[styles.truthUntangleCard, idx === untangleItems.length - 1 && untangleItems.length >= 3 && styles.truthUntangleCardAlt]}>
            <ThemedText selectable weight="semiBold" style={[styles.truthUntangleLabel, idx === untangleItems.length - 1 && untangleItems.length >= 3 && styles.truthUntangleLabelAlt]}>
              {item.label}
            </ThemedText>
            <ShareableSelectableText text={item.text} style={styles.truthUntangleText} onShare={onShareReflection} />
          </View>
        ))}
      </StepFadeIn>
    );
  };

  const renderPath = () => {
    if (!showPath || !path) return null;
    const { fromTitle, toTitle, selfRecognition } = path;
    const renderStep = (step: string, isAlt = false) => {
      const selected = selectedPathStep === step;
      return (
        <TouchableOpacity
          key={step}
          onPress={() => togglePathStep(step)}
          activeOpacity={0.7}
          style={[styles.truthPathStep, isAlt && styles.truthPathStepAlt, selected && styles.truthPathStepSelected]}
        >
          <ShareableSelectableText
            text={step}
            style={[styles.truthPathStepText, selected && styles.truthPathStepTextSelected]}
            onShare={onShareReflection}
          />
        </TouchableOpacity>
      );
    };
    return (
      <StepFadeIn delay={230} style={styles.truthBeatBlockGap}>
        <View style={styles.truthPathColumns}>
          <View style={styles.truthPathColumn}>
            <ThemedText selectable weight="semiBold" style={styles.truthPathColumnTitle}>{fromTitle || 'Notice where this leads'}</ThemedText>
            <View style={styles.truthPathSteps}>
              {pathFrom.map((step, i) => (
                <React.Fragment key={step}>
                  {renderStep(step)}
                  {i < pathFrom.length - 1 ? (
                    <PathArrow
                      name={path?.isLoop && i === pathFrom.length - 2 ? 'refresh' : 'arrow-down'}
                      phase={i / (pathFrom.length - 1)}
                      size={14}
                      color="rgba(255,255,255,0.35)"
                      style={styles.truthPathArrow}
                    />
                  ) : null}
                </React.Fragment>
              ))}
            </View>
          </View>
          <View style={styles.truthPathColumnSpacer} />
          <View style={styles.truthPathColumn}>
            <ThemedText selectable weight="semiBold" style={[styles.truthPathColumnTitle, styles.truthPathColumnTitleAlt]}>{toTitle || 'See another direction'}</ThemedText>
            <View style={styles.truthPathSteps}>
              {pathTo.map((step, i) => (
                <React.Fragment key={step}>
                  {renderStep(step, true)}
                  {i < pathTo.length - 1 ? (
                    <PathArrow
                      name="arrow-down"
                      phase={i / (pathTo.length - 1)}
                      size={14}
                      color="rgba(255,255,255,0.35)"
                      style={styles.truthPathArrow}
                    />
                  ) : null}
                </React.Fragment>
              ))}
            </View>
          </View>
        </View>
        {selfRecognition ? (
          <View style={styles.truthPathReflectBlock}>
            <ShareableSelectableText text={selfRecognition} weight="semiBold" style={styles.truthPathReflectLabel} onShare={onShareReflection} />
          </View>
        ) : null}
      </StepFadeIn>
    );
  };

  const toggleHold = () => {
    triggerLightHaptic();
    setSelectedHoldEntrust(prev => ({ ...prev, hold: !prev.hold }));
  };

  const toggleEntrust = () => {
    triggerLightHaptic();
    setSelectedHoldEntrust(prev => ({ ...prev, entrust: !prev.entrust }));
  };

  const renderHoldEntrust = () => {
    if (!showHoldEntrust || !holdEntrust) return null;
    const { holdLabel, holdStatement, entrustLabel, entrustStatement, handoffLabel, handoffBody } = holdEntrust;
    const bothSelected = holdEntrustSelected;
    return (
      <StepFadeIn delay={230} style={styles.truthBeatBlockGap}>
        <View style={styles.truthHoldEntrustRow}>
          <TouchableOpacity
            onPress={toggleHold}
            activeOpacity={0.7}
            style={[styles.truthHoldEntrustCard, selectedHoldEntrust.hold && styles.truthHoldEntrustCardSelected]}
          >
            <ThemedText selectable weight="semiBold" style={styles.truthHoldEntrustLabel}>{holdLabel}</ThemedText>
            <ShareableSelectableText text={holdStatement} style={[styles.truthHoldEntrustText, selectedHoldEntrust.hold && styles.truthHoldEntrustTextSelected]} onShare={onShareReflection} />
            {selectedHoldEntrust.hold ? (
              <View style={styles.truthHoldEntrustCheck}>
                <Ionicons name="checkmark" size={14} color={Colors.faithGold} />
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleEntrust}
            activeOpacity={0.7}
            style={[styles.truthHoldEntrustCard, styles.truthHoldEntrustCardAlt, selectedHoldEntrust.entrust && styles.truthHoldEntrustCardSelectedAlt]}
          >
            <ThemedText selectable weight="semiBold" style={[styles.truthHoldEntrustLabel, styles.truthHoldEntrustLabelAlt]}>{entrustLabel}</ThemedText>
            <ShareableSelectableText text={entrustStatement} style={[styles.truthHoldEntrustText, styles.truthHoldEntrustTextAlt, selectedHoldEntrust.entrust && styles.truthHoldEntrustTextSelectedAlt]} onShare={onShareReflection} />
            {selectedHoldEntrust.entrust ? (
              <View style={styles.truthHoldEntrustCheck}>
                <Ionicons name="checkmark" size={14} color={Colors.faithGold} />
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
        {bothSelected ? (
          <View style={styles.truthHandoffBlock}>
            <ThemedText selectable weight="semiBold" style={styles.truthHandoffLabel}>{handoffLabel}</ThemedText>
            <ShareableSelectableText text={handoffBody} style={styles.truthHandoffBody} onShare={onShareReflection} />
          </View>
        ) : null}
      </StepFadeIn>
    );
  };

  const renderSupportingText = () => (
    supportingText ? (
      <StepFadeIn key={`truth-supporting-${currentIndex}`} delay={190}>
        <ShareableSelectableText
          text={supportingText}
          style={styles.truthBeatSupporting}
          onShare={onShareReflection}
          showShareButton={false}
        />
      </StepFadeIn>
    ) : null
  );

  const scrollView = useRef<ScrollView>(null);

  return (
    <>
      <ScrollView
        ref={scrollView}
        style={styles.stepScroll}
        onScroll={handleTruthScroll}
        onContentSizeChange={(w, h) => {
          truthContentHeightRef.current = h;
          autoCollapseTruthNavIfNeeded();
        }}
        onLayout={(event) => {
          truthViewportHeightRef.current = event.nativeEvent.layout.height;
          autoCollapseTruthNavIfNeeded();
        }}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 150 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <Ionicons name="heart" size={18} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            Truth in Love
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={60}>
          <ThemedText style={styles.actionCounter} selectable={true}>
            {currentIndex + 1} of {beats.length}
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <View style={styles.actionProgressBar}>
            <View style={[styles.actionProgressFill, { width: `${((currentIndex + 1) / beats.length) * 100}%` }]} />
          </View>
        </StepFadeIn>

        {showSafetyHelp ? (
          <StepFadeIn delay={60} style={styles.crisisHelpOnTruth}>
            <CrisisHelpPills />
          </StepFadeIn>
        ) : null}

        {currentBeat.label ? (
          <StepFadeIn delay={130}>
            <View style={[styles.truthBeatShell, presentation === 'truth_card' && styles.truthBeatShellQuiet]}>
              <View style={styles.truthBeatIconCircle}>
                <Ionicons
                  name={
                    presentation === 'boundary' ? 'shield-checkmark-outline' :
                    presentation === 'contrast' ? 'swap-horizontal-outline' :
                    presentation === 'examine' ? 'search-outline' :
                    presentation === 'untangle' ? 'git-branch-outline' :
                    presentation === 'path' ? 'trail-sign-outline' :
                    presentation === 'hold_entrust' ? 'archive-outline' :
                    presentation === 'two_truths' ? 'git-compare-outline' :
                    presentation === 'grace_truth' ? 'heart-circle-outline' :
                    'sparkles-outline'
                  }
                  size={18}
                  color={Colors.alertCoral}
                />
              </View>
              <ThemedText weight="semiBold" style={styles.truthBeatLabel} selectable={true}>
                {currentBeat.label}
              </ThemedText>
            </View>
          </StepFadeIn>
        ) : null}

        <StepFadeIn key={`truth-primary-${currentIndex}`} delay={110}>
          <View style={styles.truthBeatPrimaryRow}>
            {primaryText ? (
              <ShareableSelectableText
                text={primaryText}
                weight="bold"
                style={styles.truthBeatPrimary}
                onShare={onShareReflection}
                showShareButton={false}
              />
            ) : null}
          </View>
        </StepFadeIn>

        {renderSupportingText()}

        {scriptureBacking ? (
          <StepFadeIn key={`truth-scripture-backing-${currentIndex}`} delay={240}>
            <View style={styles.truthScriptureBackingLayer}>
              <TouchableOpacity
                style={styles.truthScriptureBackingHeader}
                onPress={toggleScriptureBacking}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel="See this in Scripture"
                accessibilityState={{ expanded: scriptureBackingOpen }}
              >
                <View style={styles.truthScriptureBackingTitleRow}>
                  <Ionicons name="help-circle-outline" size={14} color={Colors.faithGold} />
                  <ThemedText weight="semiBold" style={styles.truthScriptureBackingTitle}>
                    See this in Scripture
                  </ThemedText>
                </View>
                <Ionicons
                  name={scriptureBackingOpen ? 'chevron-down' : 'chevron-forward'}
                  size={14}
                  color={Colors.faithGold}
                />
              </TouchableOpacity>
              {scriptureBackingOpen ? (
                <StepFadeIn delay={0} style={styles.truthScriptureBackingBody}>
                  {scriptureBacking.passages.map((passage, passageIndex) => (
                    <View
                      key={`${passage.reference}-${passageIndex}`}
                      style={[
                        styles.truthScripturePassage,
                        passageIndex > 0 && styles.truthScripturePassageDivider,
                      ]}
                    >
                      <View style={styles.truthScriptureReferenceRow}>
                        <ThemedText selectable weight="bold" style={styles.truthScriptureReference}>
                          {passage.reference}
                        </ThemedText>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <TouchableOpacity
                            style={styles.truthScriptureReadButton}
                            onPress={() => {
                              triggerLightHaptic();
                              setScriptureReaderIndex(passageIndex);
                            }}
                            activeOpacity={0.72}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Read ${passage.reference}`}
                          >
                            <MaterialCommunityIcons
                              name="script-text"
                              size={15}
                              color={Colors.faithGold}
                            />
                          </TouchableOpacity>
                          {onShareScripture ? (
                            <TouchableOpacity
                              style={styles.truthScriptureReadButton}
                              onPress={() => {
                                triggerLightHaptic();
                                onShareScripture(`${passage.connection}\n\n— ${passage.reference}`);
                              }}
                              activeOpacity={0.72}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              accessibilityRole="button"
                              accessibilityLabel={`Share ${passage.reference}`}
                            >
                              <Ionicons
                                name="paper-plane-outline"
                                size={15}
                                color={Colors.faithGold}
                              />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                      <ShareableSelectableText
                        text={passage.connection}
                        style={styles.truthScriptureBackingText}
                        showShareButton={false}
                        onShare={shareText => {
                          triggerLightHaptic();
                          onShareScripture?.(`${shareText}\n\n— ${passage.reference}`);
                        }}
                        shareIconColor={Colors.faithGold}
                      />
                    </View>
                  ))}
                </StepFadeIn>
              ) : null}
            </View>
          </StepFadeIn>
        ) : null}

        {currentBeat.enhancement ? (
          <StepFadeIn key={`truth-enhancement-${currentIndex}`} delay={280}>
            <TruthScreenElement element={currentBeat.enhancement} onShare={onShareReflection} />
          </StepFadeIn>
        ) : null}

        {renderUntangle()}

        {renderPath()}

        {renderHoldEntrust()}

        {presentation === 'contrast' && (contrastNot || contrastBut) ? (
          <StepFadeIn delay={230} style={styles.truthBeatBlockGap}>
            {contrastNot ? (
              <View style={styles.truthContrastCard}>
                <ThemedText selectable weight="semiBold" style={styles.truthContrastLabel}>Not this</ThemedText>
                <ShareableSelectableText text={contrastNot} style={styles.truthContrastText} onShare={onShareReflection} shareIconColor={Colors.faithGold} />
              </View>
            ) : null}
            {contrastBut ? (
              <View style={[styles.truthContrastCard, styles.truthContrastCardAffirm]}>
                <ThemedText selectable weight="semiBold" style={styles.truthContrastLabelAffirm}>But this</ThemedText>
                <ShareableSelectableText text={contrastBut} style={styles.truthContrastText} onShare={onShareReflection} shareIconColor={Colors.faithGold} />
              </View>
            ) : null}
          </StepFadeIn>
        ) : null}

        {presentation === 'boundary' && (boundaryClear || boundaryCaution) ? (
          <StepFadeIn delay={230} style={styles.truthBeatBlockGap}>
            {boundaryClear ? (
              <View style={styles.truthBoundaryCard}>
                <ThemedText selectable weight="semiBold" style={styles.truthBoundaryLabel}>Scripture makes clear</ThemedText>
                <ShareableSelectableText text={boundaryClear} style={styles.truthBoundaryText} onShare={onShareReflection} shareIconColor={Colors.faithGold} />
              </View>
            ) : null}
            {boundaryCaution ? (
              <View style={styles.truthBoundaryCard}>
                <ThemedText selectable weight="semiBold" style={styles.truthBoundaryLabel}>Do not overclaim</ThemedText>
                <ShareableSelectableText text={boundaryCaution} style={styles.truthBoundaryText} onShare={onShareReflection} shareIconColor={Colors.faithGold} />
              </View>
            ) : null}
          </StepFadeIn>
        ) : null}

        {presentation === 'two_truths' && twoTruths.length >= 2 ? (
          <StepFadeIn delay={230} style={styles.truthTwoCards}>
            {twoTruths.slice(0, 2).map(item => (
              <View key={`${item.label}-${item.text}`} style={styles.truthTwoCard}>
                <ThemedText selectable weight="semiBold" style={styles.truthTwoLabel}>{item.label}</ThemedText>
                <ShareableSelectableText text={item.text} style={styles.truthTwoText} onShare={onShareReflection} shareIconColor={Colors.faithGold} />
              </View>
            ))}
          </StepFadeIn>
        ) : null}

        {shouldShowReveal ? (
          <StepFadeIn delay={280}>
            <TouchableOpacity
              style={styles.truthRevealButton}
              onPress={toggleReveal}
              activeOpacity={0.78}
            >
              <ThemedText weight="semiBold" style={styles.truthRevealButtonText}>
                {revealOpen ? 'Show less' : revealButtonLabel}
              </ThemedText>
              <Ionicons
                name={revealOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="rgba(255,255,255,0.72)"
              />
            </TouchableOpacity>
            {revealOpen && hasExamineQuestions ? (
              <View style={styles.truthQuestionsBlock}>
                <ThemedText selectable weight="semiBold" style={styles.truthQuestionsLabel}>Examine this gently</ThemedText>
                {reflectionQuestions.map(question => (
                  <View key={question} style={styles.truthQuestionRow}>
                    <ThemedText weight="bold" style={styles.truthQuestionMark}>?</ThemedText>
                    <ShareableSelectableText text={question} style={styles.truthQuestionText} containerStyle={styles.truthQuestionTextContainer} onShare={onShareReflection} shareIconColor={Colors.faithGold} />
                  </View>
                ))}
              </View>
            ) : revealOpen && reveal?.content ? (
              <View style={styles.truthRevealCard}>
                <ShareableSelectableText text={reveal.content} style={styles.truthRevealText} onShare={onShareReflection} shareIconColor={Colors.faithGold} />
              </View>
            ) : null}
          </StepFadeIn>
        ) : null}

        {isLastBeat && truthToCarry ? (
          <StepFadeIn delay={360}>
            <View style={styles.truthCarryCard}>
              <View style={styles.truthCarryHeader}>
                <Ionicons name="bookmark-outline" size={14} color={Colors.faithGold} />
                <ThemedText selectable weight="semiBold" style={styles.truthCarryLabel}>Truth to Carry</ThemedText>
              </View>
              <ShareableSelectableText text={truthToCarry} weight="semiBold" style={styles.truthCarryText} onShare={onShareReflection} shareIconColor={Colors.faithGold} />
            </View>
          </StepFadeIn>
        ) : null}
      </ScrollView>



      <Animated.View style={[styles.truthBeatNav, { bottom: insets.bottom + 20 }]}>
        <Animated.View
          style={[
            styles.truthBeatNavRow,
            {
              opacity: truthNavShapeOpacity,
              transform: [{ translateX: truthNavShapeTranslateX }, { scaleX: truthNavShapeScaleX }],
            },
          ]}
          pointerEvents={truthNavCollapsed ? 'none' : 'box-none'}
        >
          <Animated.View style={[styles.truthBeatNavRowContent, { opacity: truthNavContentOpacity }]}>
            {onOpenRefinement ? (
              <TouchableOpacity
                style={styles.truthBeatRefineButton}
                onPress={onOpenRefinement}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="That’s not quite it"
              >
                <Ionicons name="sparkles" size={14} color={Colors.alertCoral} />
              </TouchableOpacity>
            ) : null}

            {currentIndex > 0 ? (
              <TouchableOpacity
                style={styles.truthBeatIconButton}
                onPress={onBeatBack}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Previous Truth in Love page"
              >
                <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.68)" />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.truthBeatPrimaryButton}
              onPress={onBeatNext}
              activeOpacity={0.85}
            >
              {isLastBeat ? (
                <MaterialCommunityIcons name="script-text" size={16} color={Colors.hopeWhite} />
              ) : (
                <Ionicons name="heart" size={15} color={Colors.hopeWhite} />
              )}
              <ThemedText weight="semiBold" style={styles.actionFABDoneText} numberOfLines={1}>
                {primaryButtonLabel}
              </ThemedText>
            </TouchableOpacity>

            {!isLastBeat && onGoToScripture ? (
              <TouchableOpacity
                style={styles.truthBeatScriptureLink}
                onPress={openScriptureConfirm}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
                accessibilityRole="button"
                accessibilityLabel="Go to Anchor"
              >
                <MaterialCommunityIcons name="script-text" size={15} color={Colors.hopeWhite} />
                <ThemedText weight="medium" style={styles.truthBeatScriptureLinkText}>Anchor</ThemedText>
              </TouchableOpacity>
            ) : null}
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[styles.truthBeatNavCollapsedCircle, { opacity: truthNavCircleOpacity }]}
          pointerEvents={truthNavCollapsed ? 'box-none' : 'none'}
        >
          <TouchableOpacity
            style={styles.truthBeatNavCollapsedTouchable}
            onPress={() => {
              triggerLightHaptic();
              expandTruthNav();
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Show Truth in Love actions"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      <ScriptureReaderModal
        visible={scriptureReaderIndex !== null}
        passages={scriptureBacking?.passages || []}
        initialIndex={scriptureReaderIndex || 0}
        version={bibleVersion}
        onClose={() => setScriptureReaderIndex(null)}
        onShareScripture={onShareScripture}
      />

      {scriptureConfirmOpen ? (
        <View style={styles.truthScriptureConfirmOverlay}>
          <TouchableOpacity
            style={styles.truthScriptureConfirmBackdrop}
            activeOpacity={1}
            onPress={closeScriptureConfirm}
          />
          <Animated.View
            style={[
              styles.truthScriptureConfirmSheet,
              {
                paddingBottom: insets.bottom + 18,
                opacity: scriptureConfirmAnim,
                transform: [
                  {
                    translateY: scriptureConfirmAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <ThemedText weight="bold" style={styles.truthScriptureConfirmTitle}>
              Ready to go to Scripture?
            </ThemedText>
            <ThemedText style={styles.truthScriptureConfirmText}>
              You can move to Scripture now and return to Truth in Love anytime.
            </ThemedText>
            <StepFadeIn delay={90}>
              <TouchableOpacity
                style={styles.truthScriptureConfirmPrimary}
                onPress={confirmGoToScripture}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="script-text" size={16} color={Colors.hopeWhite} />
                <ThemedText weight="semiBold" style={styles.truthScriptureConfirmPrimaryText}>
                  Go to Anchor
                </ThemedText>
              </TouchableOpacity>
            </StepFadeIn>
            <StepFadeIn delay={135}>
              <TouchableOpacity
                style={styles.truthScriptureConfirmSecondary}
                onPress={closeScriptureConfirm}
                activeOpacity={0.75}
              >
                <ThemedText weight="medium" style={styles.truthScriptureConfirmSecondaryText}>
                  Keep reflecting
                </ThemedText>
              </TouchableOpacity>
            </StepFadeIn>
          </Animated.View>
        </View>
      ) : null}
    </>
  );
};

const LegacyTruthInLoveStep: React.FC<TruthStepProps> = ({
  text,
  userName,
  showSafetyHelp = false,
  onNext: _onNext,
  onShareReflection,
  insets,
}) => {
  const personalized = removeUserNameReferences(
    replaceOpeningHardcodedName(personalizeTruthContent(text, userName), userName),
    userName
  );
  const paragraphs = splitParagraphs(personalized);
  const [expanded, setExpanded] = useState(false);
  const hasMore = !IS_IPAD && paragraphs.length > TRUTH_PREVIEW_COUNT;

  // Truncate paragraphs when collapsed to prevent overlap with buttons
  const visible = expanded || !hasMore ? paragraphs : paragraphs.slice(0, TRUTH_PREVIEW_COUNT).map((para, index) => {
    if (index === TRUTH_PREVIEW_COUNT - 1 && para.length > MAX_PARAGRAPH_LENGTH) {
      return para.substring(0, MAX_PARAGRAPH_LENGTH).trim() + '...';
    }
    return para;
  });

  const readMoreAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hasMore && !expanded) {
      Animated.spring(readMoreAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        delay: 600,
        useNativeDriver: true,
      }).start();
    } else {
      readMoreAnim.setValue(0);
    }
  }, [hasMore, expanded, readMoreAnim]);

  return (
    <>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <Ionicons name="heart" size={18} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            Truth in Love
          </ThemedText>
        </StepFadeIn>

        {showSafetyHelp ? (
          <StepFadeIn delay={80} style={styles.crisisHelpOnTruth}>
            <CrisisHelpPills />
          </StepFadeIn>
        ) : null}

        <View style={styles.textBlock}>
          {visible.map((para, i) => (
            <StepFadeIn key={i} delay={100 + (i * 80)}>
              <ShareableSelectableText text={para} style={styles.bodyText} onShare={onShareReflection} />
            </StepFadeIn>
          ))}
        </View>
      </ScrollView>

      {/* Floating "Read more" pill — only visible when collapsed */}
      {hasMore && !expanded && (
        <Animated.View
          style={[
            styles.prayerActionButtonFloating,
            { bottom: insets.bottom + 20 },
            {
              opacity: readMoreAnim,
              transform: [
                {
                  scale: readMoreAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => { triggerLightHaptic(); setExpanded(true); }}
            activeOpacity={0.8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Ionicons name="chevron-down" size={16} color={Colors.hopeWhite} />
            <ThemedText weight="medium" style={styles.prayerActionText}>
              Read more
            </ThemedText>
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );
};

const TruthInLoveStep: React.FC<TruthStepProps> = (props) => {
  const beats = (props.beats || []).filter(beat => beat.primaryTruth);
  if (beats.length > 0) {
    return (
      <TruthBeatStep
        {...props}
        beats={beats}
        beatIndex={props.beatIndex ?? 0}
        onBeatNext={props.onBeatNext || props.onNext}
        onBeatBack={props.onBeatBack || (() => {})}
        onGoToScripture={props.onGoToScripture}
        bibleVersion={props.bibleVersion}
      />
    );
  }

  return <LegacyTruthInLoveStep {...props} />;
};

interface FloatingRefinementControlProps {
  open: boolean;
  onClose: () => void;
  isRefining: boolean;
  refinementsRemaining: number;
  upgradeTier: RefinementUpgradeTier | null;
  resetDateLabel: string;
  insets: { bottom: number };
  onRefineSubmit: (correctionType: PlaybookCorrectionType, clarification: string) => Promise<boolean>;
  onUpgrade: () => void;
}

const FloatingRefinementControl: React.FC<FloatingRefinementControlProps> = ({
  open,
  onClose,
  isRefining,
  refinementsRemaining,
  upgradeTier,
  resetDateLabel,
  insets,
  onRefineSubmit,
  onUpgrade,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const [selectedRefinementOptionId, setSelectedRefinementOptionId] = useState<string | null>(null);
  const [refinementText, setRefinementText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const revealAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const refiningAnim = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const [dotIndex, setDotIndex] = useState(0);
  const selectedOption = REFINEMENT_OPTIONS.find(option => option.id === selectedRefinementOptionId);
  const selectedRefinementType = selectedOption?.type ?? null;
  const keyboardLift = keyboardHeight > 0 ? Math.max(0, keyboardHeight - insets.bottom) : 0;
  const panelMaxHeight = keyboardHeight > 0
    ? Math.max(260, SCREEN_HEIGHT - keyboardHeight - 42)
    : SCREEN_HEIGHT - 82;
  const noRefinementsLeft = refinementsRemaining === 0;
  const upgradeTierName = upgradeTier === 'transformation' ? 'Transformation' : 'Growth';

  useEffect(() => {
    if (open) {
      Animated.spring(revealAnim, {
        toValue: 1,
        tension: 80,
        friction: 9,
        useNativeDriver: true,
      }).start();
    }
  }, [open, revealAnim]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(refiningAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(refiningAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    if (isRefining) {
      animation.start();
    } else {
      animation.stop();
      refiningAnim.setValue(1);
    }

    return () => {
      animation.stop();
    };
  }, [isRefining, refiningAnim]);

  useEffect(() => {
    if (isRefining) {
      Animated.loop(
        Animated.timing(dotAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ).start();

      dotAnim.addListener(({ value }) => {
        setDotIndex(Math.floor(value * 3) % 3);
      });
    } else {
      dotAnim.stopAnimation();
      dotAnim.setValue(0);
      setDotIndex(0);
    }

    return () => {
      dotAnim.stopAnimation();
      dotAnim.removeAllListeners();
    };
  }, [isRefining, dotAnim]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, event => {
      setKeyboardHeight(event.endCoordinates?.height || 0);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (selectedRefinementOptionId && inputRef.current) {
      const timeout = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [selectedRefinementOptionId]);

  const handleCloseRefinement = () => {
    if (isRefining) {
      return;
    }

    triggerLightHaptic();
    Keyboard.dismiss();
    setSelectedRefinementOptionId(null);
    setRefinementText('');
    onClose();
  };

  const handleReasonPress = (optionId: string) => {
    triggerLightHaptic();
    setSelectedRefinementOptionId(optionId);
  };

  const handleSubmit = async () => {
    if (!selectedOption || !selectedRefinementType || isRefining) {
      return;
    }

    triggerMediumHaptic();
    const refined = await onRefineSubmit(
      selectedRefinementType,
      `${selectedOption.label}: ${refinementText.trim()}`
    );
    if (refined) {
      setSelectedRefinementOptionId(null);
      setRefinementText('');
      onClose();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.refinementBackdrop}
        activeOpacity={1}
        onPress={handleCloseRefinement}
        disabled={isRefining}
      />

      <Animated.View
        style={[
          styles.floatingRefinementPanel,
          {
            bottom: keyboardLift,
            maxHeight: panelMaxHeight,
            opacity: revealAnim,
            transform: [
              {
                translateY: revealAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          },
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom }}
        >
          <View style={styles.floatingRefinementHeader}>
            <View style={styles.refinementSheetTitleRow}>
              <ThemedText weight="bold" style={styles.refinementSheetTitle}>
                Help siFia understand
              </ThemedText>
              {noRefinementsLeft ? (
                <View style={styles.refinementCountBadge}>
                  <ThemedText weight="semiBold" style={styles.refinementCountBadgeText}>
                    No refinements left
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText style={styles.refinementSheetPrompt}>
              {noRefinementsLeft ? 'These are the parts you can refine.' : 'What did we miss?'}
            </ThemedText>
          </View>

          <View style={styles.floatingRefinementReasons}>
            {REFINEMENT_OPTIONS.map((option, index) => {
              const selected = selectedRefinementOptionId === option.id;
              return (
                <StepFadeIn key={option.id} delay={index * 45}>
                  <TouchableOpacity
                    style={[
                      styles.refinementReasonButton,
                      selected && styles.refinementReasonButtonSelected,
                      noRefinementsLeft && styles.refinementReasonButtonDisabled,
                    ]}
                    onPress={() => handleReasonPress(option.id)}
                    activeOpacity={0.82}
                    disabled={isRefining || noRefinementsLeft}
                    accessibilityState={{ disabled: isRefining || noRefinementsLeft }}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={selected ? Colors.alertCoral : 'rgba(255,255,255,0.42)'}
                      style={styles.refinementReasonRadio}
                    />
                    <ThemedText weight={selected ? 'semiBold' : 'regular'} style={[styles.refinementReasonText, selected && styles.refinementReasonTextSelected]}>
                      {option.label}
                    </ThemedText>
                  </TouchableOpacity>
                </StepFadeIn>
              );
            })}
          </View>

          {noRefinementsLeft ? (
            <View style={styles.refinementExhaustedActions}>
              {upgradeTier ? (
                <TouchableOpacity
                  style={styles.refinementUpgradeButton}
                  onPress={() => {
                    triggerLightHaptic();
                    onUpgrade();
                  }}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={`Upgrade to ${upgradeTierName}`}
                >
                  <MaterialCommunityIcons name="star-four-points" size={16} color={Colors.hopeWhite} />
                  <ThemedText weight="bold" style={styles.refinementUpgradeButtonText}>
                    Upgrade to {upgradeTierName}
                  </ThemedText>
                </TouchableOpacity>
              ) : null}
              <ThemedText style={styles.refinementResetText}>
                {upgradeTier ? 'Or wait until ' : 'Refinements reset on '}
                <ThemedText weight="semiBold" style={styles.refinementResetDateText}>
                  {resetDateLabel}
                </ThemedText>
                {upgradeTier ? ' for your refinements to reset.' : '.'}
              </ThemedText>
            </View>
          ) : null}

          {!noRefinementsLeft && selectedRefinementType ? (
            <StepFadeIn delay={260} style={styles.refinementFloatingInputBlock}>
              <TextInput
                ref={inputRef}
                value={refinementText}
                onChangeText={setRefinementText}
                editable={!isRefining}
                multiline
                placeholder="Tell siFia more..."
                placeholderTextColor="rgba(255,255,255,0.45)"
                keyboardAppearance="dark"
                textAlignVertical="top"
                autoFocus
                style={[styles.refinementInput, { fontFamily }]}
              />

              <TouchableOpacity
                style={[styles.refinementSubmitButton, (!refinementText.trim() || isRefining) && styles.refinementSubmitButtonDisabled]}
                onPress={handleSubmit}
                activeOpacity={0.82}
                disabled={!refinementText.trim() || isRefining}
              >
                {isRefining ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Animated.Text
                      style={[styles.refinementSubmitButtonText, { opacity: refiningAnim, fontFamily, fontWeight: '500' }]}
                    >
                      Refining
                    </Animated.Text>
                    <Animated.Text
                      style={[styles.refinementSubmitButtonText, { opacity: refiningAnim, fontFamily, width: 20, textAlign: 'left', fontWeight: '500' }]}
                    >
                      {'.'.repeat(dotIndex + 1)}
                    </Animated.Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={16} color={Colors.hopeWhite} />
                    <ThemedText weight="semiBold" style={styles.refinementSubmitButtonText}>Refine Playbook</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </StepFadeIn>
          ) : null}
        </ScrollView>
      </Animated.View>
    </>
  );
};

// ─── Step 2: Scripture Anchor ────────────────────────────────────────────────

interface ScriptureStepProps {
  reference: string;
  text: string;
  version?: string;
  reflection?: string;
  onNext: () => void;
  onShareScripture?: (text: string) => void;
  insets: { top: number };
}

const ScriptureAnchorStep: React.FC<ScriptureStepProps> = ({ reference, text, version, reflection, onNext: _onNext, onShareScripture, insets }) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const [showCopyright, setShowCopyright] = useState(false);
  const [showScriptureReader, setShowScriptureReader] = useState(false);
  const reflectionLines = reflection ? splitParagraphs(reflection) : [];

  return (
    <View style={[styles.stepScroll, styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8) }]}>
      <StepFadeIn delay={0} style={styles.stepLabelRow}>
        <MaterialCommunityIcons name="script-text" size={18} color={Colors.alertCoral} />
        <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
          Scripture to Anchor
        </ThemedText>
      </StepFadeIn>

      {/* Verse card */}
      <StepFadeIn delay={100} style={styles.verseCard}>
        <View style={styles.verseRail} />
        <View style={styles.verseRefRow}>
          {Platform.OS === 'ios' ? (
            <TextInput
              value={reference}
              editable={false}
              multiline={true}
              scrollEnabled={false}
              style={[styles.scriptureRef, { fontWeight: '600' as any, fontFamily }]}
            />
          ) : (
            <ThemedText weight="semiBold" style={styles.scriptureRef} selectable={true}>
              {reference}
            </ThemedText>
          )}
          <View style={styles.versionAndInfoRow}>
            {version ? (
              <View style={styles.versionBadge}>
                {Platform.OS === 'ios' ? (
                  <TextInput
                    value={version.toUpperCase()}
                    editable={false}
                    multiline={true}
                    scrollEnabled={false}
                    style={[styles.versionText, { fontWeight: '600' as any, fontFamily }]}
                  />
                ) : (
                  <ThemedText weight="semiBold" style={styles.versionText} selectable={true}>
                    {version.toUpperCase()}
                  </ThemedText>
                )}
              </View>
            ) : null}
            <TouchableOpacity
              onPress={() => { triggerLightHaptic(); setShowCopyright(true); }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginLeft: -4, alignSelf: 'center' }}
            >
              <Ionicons name="information-circle-outline" size={12} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
        </View>
        {Platform.OS === 'ios' ? (
          <TextInput
            value={stripVerseQuotes(text)}
            editable={false}
            multiline={true}
            scrollEnabled={false}
            style={[styles.scriptureText, { fontWeight: '500' as any, fontFamily }]}
          />
        ) : (
          <ThemedText weight="medium" style={styles.scriptureText} selectable={true}>
            {stripVerseQuotes(text)}
          </ThemedText>
        )}
      </StepFadeIn>

      <BibleCopyrightModal
        visible={showCopyright}
        onClose={() => setShowCopyright(false)}
        bibleVersion={version || 'NASB'}
      />

      <ScriptureReaderModal
        visible={showScriptureReader}
        passages={[{ reference }]}
        initialIndex={0}
        version={version || 'NASB'}
        onClose={() => setShowScriptureReader(false)}
        onShareScripture={onShareScripture}
      />

      <StepFadeIn delay={180} style={styles.notesActions}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            setShowScriptureReader(true);
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ alignSelf: 'center' }}
          accessibilityRole="button"
          accessibilityLabel={`Read ${reference}`}
        >
          <MaterialCommunityIcons name="script-text" size={15} color={Colors.alertCoral} />
        </TouchableOpacity>
        {onShareScripture ? (
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              onShareScripture(`${stripVerseQuotes(text)}\n\n— ${reference}`);
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ alignSelf: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Share this Scripture"
          >
            <Ionicons name="paper-plane-outline" size={15} color={Colors.alertCoral} />
          </TouchableOpacity>
        ) : null}
      </StepFadeIn>

      <View style={styles.reflectionBlock}>
        {reflectionLines.map((line, i) => (
          <StepFadeIn
            key={i}
            delay={190 + i * 60}
            style={[styles.scriptureNoteItem, i > 0 && styles.scriptureNoteDivider]}
          >
            <View style={styles.completionActionItem}>
              <View style={[styles.completionActionCircle, { width: 22, height: 22, borderRadius: 11 }]}>
                <Ionicons name="sparkles" size={11} color={Colors.alertCoral} />
              </View>
              <ShareableSelectableText
                text={line}
                style={[styles.completionActionLine, { flex: undefined }]}
                containerStyle={{ flex: 1 }}
                onShare={onShareScripture}
                showShareButton={false}
              />
            </View>
          </StepFadeIn>
        ))}
      </View>

      <View style={{ height: 80 }} />
    </View>
  );
};

// ─── Step 3: Faithful Actions ────────────────────────────────────────────────

// ─── Smart body-line detection ───────────────────────────────────────────────

type BodyLineType = 'intro' | 'quote' | 'script' | 'choice' | 'bullet' | 'checklistItem' | 'field' | 'check' | 'schedule' | 'hint' | 'resourceList' | 'columns' | 'scriptureRead' | 'lineMeaning' | 'ask' | 'question' | 'checklist' | 'body';
const ACTION_EXAMPLE_MARKER_REGEX = /Example(?:\s+(?:entry|prayer|message|text|words|script|sentence|phrase|loop|action|question|questions))?\s*[:：]\s*/i;

interface BodyLine {
  text: string;
  type: BodyLineType;
  label?: string;
  items?: string[];
  columns?: Array<{ title: string; items: string[] }>;
  reference?: string;
  summary?: string;
}

function ScriptRail(): React.ReactElement {
  return (
    <View style={styles.bodyScriptRail} pointerEvents="none">
      <View style={styles.bodyScriptRailLine} />
    </View>
  );
}

function scriptIconNameForBodyLine(item: BodyLine): string {
  const label = item.label || '';
  const text = stripBalancedActionQuotes(item.text || '');
  return /\?\s*$/.test(text) || /\b(?:ask|question)\b/i.test(label)
    ? 'help-circle-outline'
    : 'chatbubble-ellipses-outline';
}

function stripBalancedActionQuotes(text: string): string {
  let out = String(text || '').trim();
  const quotePairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
    ['“', '”'],
    ['‘', '’'],
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const [open, close] of quotePairs) {
      if (out.startsWith(open) && out.endsWith(close)) {
        out = out.slice(1, -1).trim();
        changed = true;
        break;
      }
    }
  }

  // Strip commas before periods, exclamation marks, or question marks
  out = out.replace(/,\s*([.!?])/g, '$1');

  return out;
}

function isActionApostrophe(text: string, index: number): boolean {
  const char = text[index];
  if (char !== "'" && char !== '‘' && char !== '’') { return false; }
  return /[A-Za-z0-9]/.test(text[index - 1] || '') && /[A-Za-z0-9]/.test(text[index + 1] || '');
}

function matchingCloseActionQuote(open: string): string {
  if (open === '“') { return '”'; }
  if (open === '‘') { return '’'; }
  return open;
}

function matchingOpenActionQuote(close: string): string {
  if (close === '”') { return '“'; }
  if (close === '’') { return '‘'; }
  return close;
}

function hasClosingActionQuoteAfter(text: string, open: string): boolean {
  const close = matchingCloseActionQuote(open);
  for (let i = 1; i < text.length; i++) {
    if (text[i] === close && !isActionApostrophe(text, i)) { return true; }
  }
  return false;
}

function hasOpeningActionQuoteBefore(text: string, close: string): boolean {
  const open = matchingOpenActionQuote(close);
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === open && !isActionApostrophe(text, i)) { return true; }
  }
  return false;
}

function stripDanglingActionQuotes(text: string): string {
  let out = String(text || '').trim();
  const firstQuote = out.match(/^["'`“”‘’]/)?.[0] || '';
  const lastQuote = out.match(/["'`“”‘’]$/)?.[0] || '';

  if (firstQuote && !hasClosingActionQuoteAfter(out, firstQuote)) {
    out = out.replace(/^["'`“”‘’]\s*/, '').trim();
  }
  if (lastQuote && !hasOpeningActionQuoteBefore(out, lastQuote)) {
    out = out.replace(/\s*["'`“”‘’]$/, '').trim();
  }

  return out;
}

function normalizeActionMarkup(text: string): string {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<p\s*>/gi, '')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\s+(?=\d+(?:\.\d+)?[.)]\s+(?:Find|Take|Say|Explain|Add|Continue|Practice|Write|Create|Make|Read|Ask|Use|Share|Tell|Send|Text|Call|Contact|Schedule|List|Choose|Start|Stop|Notice|Remember|Set|Decide|Track|Record|Note|Mark|Fill|Under|Each|Every|Then|Next|If|When|After|Pause)\b)/gi, '\n')
    .replace(/,\s*([.!?])/g, '$1');
}

function closeUnmatchedActionDoubleQuote(text: string): string {
  let straightCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"' && text[i - 1] !== '\\') { straightCount++; }
  }

  if (straightCount % 2 === 1) {
    return `${text}"`;
  }

  const openCurly = (text.match(/“/g) || []).length;
  const closeCurly = (text.match(/”/g) || []).length;
  return openCurly > closeCurly ? `${text}”` : text;
}

function stripWrappingQuotesUnlessList(text: string): string {
  const value = String(text || '').trim();
  const quotedSegments = value.match(/["“][^"”]+["”]/g) || [];
  if (quotedSegments.length >= 2 || /["”]\s*,\s*["“]/.test(value)) {
    return value;
  }
  return stripBalancedActionQuotes(value);
}

function stripContrastExampleBoundaryQuotes(text: string): string {
  return stripBalancedActionQuotes(String(text || '').trim())
    .replace(/^["“”]\s*/, '')
    .replace(/\s*["“”]\s*([.!?])$/, '$1')
    .replace(/\s*["“”]$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyContrastStatement(text: string): boolean {
  const cleaned = stripContrastExampleBoundaryQuotes(text);
  return cleaned.length >= 8 &&
    cleaned.length <= 180 &&
    /^(?:I|I'm|I’m|I'll|I’ll|I've|I’ve|We|We're|We’re|You|You're|You’re|My|This|That)\b/i.test(cleaned);
}

function normalizeQuotedContrastExample(value: string): string | null {
  const source = String(value || '').trim();
  const separatorMatch = source.match(/\s+(versus|vs\.?|instead of)\s+/i);
  if (!separatorMatch || separatorMatch.index === undefined) {
    return null;
  }

  const before = source.slice(0, separatorMatch.index).trim();
  const after = source.slice(separatorMatch.index + separatorMatch[0].length).trim();
  const hasBoundaryQuote =
    /^["“”]/.test(before) ||
    /["“”]$/.test(before) ||
    /^["“”]/.test(after) ||
    /["“”]$/.test(after);

  if (!before || !after) {
    return null;
  }

  const first = stripContrastExampleBoundaryQuotes(before);
  const second = stripContrastExampleBoundaryQuotes(after);
  if (!first || !second) {
    return null;
  }

  if (!hasBoundaryQuote && !(isLikelyContrastStatement(first) && isLikelyContrastStatement(second))) {
    return null;
  }

  const separator = /^vs/i.test(separatorMatch[1]) ? 'versus' : separatorMatch[1].toLowerCase();
  return `"${first}" ${separator} "${second}"`;
}

function removeDecorativeActionSingleQuotes(text: string): string {
  let out = '';
  const source = String(text || '');

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if ((char === "'" || char === '‘' || char === '’') && !isActionApostrophe(source, i)) {
      continue;
    }
    out += char;
  }

  return out;
}

function normalizeActionBulletMarkers(text: string): string {
  return String(text || '')
    .split('\n')
    .map(line => {
      if (/^\s*(?:\d+(?:\.\d+)?[.)]\s*)?(?:Scripture|Passage)\s+.{2,120}:\s*/i.test(line)) {
        return line;
      }

      return line
        .replace(/([^*\n]{1,90}:\s*)\*\s*/g, (_match, label) => `${String(label).trimEnd()}\n* `)
        .replace(/([^\n])\s*\*\s*(?=\S)/g, '$1\n* ')
        .replace(/([a-z)\]"”])\s*(Example(?:\s+(?:entry|prayer|message|text|words|script|sentence|phrase|loop|action|question|questions))?\s*[:：])/g, '$1\n$2')
        .replace(/^(\s*)[-•+]\s+/, '$1* ');
    })
    .join('\n');
}

function normalizeSingleQuotedActionScripts(text: string): string {
  return String(text || '').replace(
    /(\b(?:reach out(?: today)? with this message|with this message|pause and say aloud|say aloud|say plainly|say this(?: clearly| plainly)?|send(?: this)? message|message|text|write|ask|pray)\b[^:\n]{0,80}:\s*)['‘]([\s\S]*?)['’](?=(?:\s+(?:Repeat|Practice|Bring|Include|Ask|This|Do|Keep|Schedule|Share|Tell|Contact|Call|Message|Text|Example)\b)|\s*$|\n)/gi,
    (_match, intro, quote) => `${intro}"${String(quote).trim()}"`
  );
}

function unwrapQuotedMultilineActionScript(text: string): string {
  let out = String(text || '');
  out = out.replace(
    /^\s*["“]([\s\S]*?)["”]\s*(?:\n+|\s+)((?:Say|Repeat|Pray|Read)\b[\s\S]*)$/i,
    (_match, quote, rest) => {
      const script = String(quote).replace(/\s*\n+\s*/g, ' ').replace(/\s+/g, ' ').trim();
      const label = /^(?:Lord|Jesus|Father|Heavenly Father|God|Holy Spirit)\b/i.test(script)
        ? 'Prayer to say'
        : 'Words to say';
      return [label + ':', '"' + script + '"', String(rest).trim()].join('\n');
    }
  );
  out = out.replace(
    /['‘]\s*((?:Message|Text|Send|Write|Ask|Pray)[^:\n]{0,100}:\s*\n[\s\S]*?)\s*['’](?=\s*(?:\n|$))/gi,
    (_match, script) => String(script).trim()
  );
  out = out.replace(
    /((?:Message|Text|Send|Write|Ask|Pray)[^:\n]{0,100}:\s*\n)(["“][\s\S]*?["”])(?=\s*(?:Example|$))/gi,
    (_match, intro, script) => `${intro}${String(script).trim().replace(/\n+/g, '\n')}`
  );
  return out;
}

function normalizeActionInlineStructure(text: string): string {
  return String(text || '')
    .replace(/\s+(?=(?:Trigger|Lie|Temptation|Replacement response|Replacement|Practice):\s*)/gi, '\n')
    .replace(/(^|\n)\s*Replacement:\s*/gi, '$1Replacement response: ')
    .replace(/\s+(?=(?:Stop doing|Start doing)\b)/gi, '\n')
    .replace(/(^|\n)\s*Stop doing\s+/gi, '$1Stop: ')
    .replace(/(^|\n)\s*Start doing\s+/gi, '$1Start: ');
}

function normalizeActionPracticeLoopText(text: string): string {
  const source = String(text || '')
    .replace(/^Trigger\s*(?:→|->|>)\s*temptation\s*(?:→|->|>)\s*replacement response\s*practice:\s*/i, '')
    .trim();

  const match = source.match(/^(.+?)\s*(?:→|->|>)\s*temptation\s+is\s+(.+?)\s*(?:→|->|>)\s*replacement response\s+is\s+(.+?)(?:\s+Practice\s+(.+))?$/i);
  if (!match) {
    return text;
  }

  const trigger = match[1].trim();
  const temptation = match[2].trim();
  const response = match[3].trim();
  const practice = (match[4] || '').trim();
  const lines = [
    `Trigger: ${trigger}`,
    `Temptation: ${temptation}`,
    `Replacement response: ${response}`,
  ];

  if (practice) {
    lines.push(`Practice: Do this ${practice.replace(/^this\s+/i, '')}`);
  }

  return lines.join('\n');
}

function normalizeFaithfulActionDisplayText(value: string): string {
  return String(value || '')
    .replace(/\bwith spouse\/family member trusted for accountability\b/gi, 'with a spouse or family member you trust for accountability')
    .replace(/\bwith spouse\/family member\b/gi, 'with a spouse or family member')
    .replace(/\bWill you help me stick close\?/gi, 'Would you help me stay accountable to this plan?')
    .replace(/\bWould you help me stick close\?/gi, 'Would you help me stay accountable to this plan?');
}

function toInstructionPointOfView(text: string): string {
  return String(text || '')
    .replace(/\bmyself\b/gi, 'yourself')
    .replace(/\bmy\b/gi, 'your')
    .replace(/\bmine\b/gi, 'yours')
    .replace(/\bme\b/gi, 'you')
    .replace(/\bI\s+will\b/gi, 'you will')
    .replace(/\bI\s+would\b/gi, 'you would')
    .replace(/\bI\s+can\b/gi, 'you can')
    .replace(/\bI\s+need\b/gi, 'you need')
    .replace(/\bI\s+am\b/gi, 'you are')
    .replace(/\bI'm\b/gi, "you're")
    .replace(/\bI\s+(leave|call|ask|stop|remove|write|tell|send|go|pack|bring|keep|contact|message|text|document|share)\b/gi, 'you $1')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalizeInstruction(text: string): string {
  const trimmed = String(text || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : '';
}

function splitLeadingQuotedActionText(value: string): { quote: string; rest: string } {
  const source = String(value || '').trim();
  const open = source[0];
  if (open !== '"' && open !== '“' && open !== "'" && open !== '‘') {
    return { quote: source, rest: '' };
  }

  const close = open === '“' ? '”' : open === '‘' ? '’' : open;
  for (let i = 1; i < source.length; i++) {
    if (source[i] === close && source[i - 1] !== '\\' && !isActionApostrophe(source, i)) {
      const rawQuote = source.slice(0, i + 1).trim();
      const quote = open === "'" || open === '‘'
        ? `"${stripBalancedActionQuotes(rawQuote)}"`
        : rawQuote;
      return {
        quote,
        rest: source.slice(i + 1).trim(),
      };
    }
  }

  return { quote: source, rest: '' };
}

function splitQuestionPromptText(value: string): string[] {
  const questions = String(value || '')
    .split(/(?<=\?)\s+(?=\S)/)
    .map(part => part.trim())
    .filter(Boolean);
  return questions.length > 0 ? questions : [String(value || '').trim()].filter(Boolean);
}

function isAskPromptQualifierLine(line: string): boolean {
  return /^(?:for\s+each(?:\s+(?:one|declaration|item|thought|belief|sentence|step))?|for\s+every(?:\s+(?:one|declaration|item|thought|belief|sentence|step))?|for\s+each\s+of\s+them),\s*$/i.test(line.trim());
}

function askPromptQualifierLabel(line: string): string {
  return capitalizeFirstLetter(line.trim().replace(/,\s*$/, ''));
}

function combineAskPromptLabel(qualifier: string | null, label: string): string {
  if (!qualifier) {
    return label;
  }

  return `${qualifier}, ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

function isPromptQuestionLine(line: string): boolean {
  return /\?\s*$/.test(stripBalancedActionQuotes(line.trim()));
}

function collectPromptQuestions(lines: string[], startIndex: number): { questions: string[]; nextIndex: number } {
  const questions: string[] = [];
  let cursor = startIndex;

  while (cursor < lines.length) {
    const line = lines[cursor]?.trim() || '';
    if (!isPromptQuestionLine(line)) {
      break;
    }

    questions.push(stripBalancedActionQuotes(line));
    cursor++;
  }

  return { questions, nextIndex: cursor };
}

function splitHintTextFromTrailingInstruction(value: string): { hintText: string; trailingText: string } {
  const parts = String(value || '')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return { hintText: String(value || '').trim(), trailingText: '' };
  }

  const firstInstructionIndex = parts.findIndex((part, index) => {
    if (index === 0) {
      return false;
    }
    return /^(?:Evaluate|Decide|Choose|Compare|Review|Then|Next|After|Ask|Write|Use|Pick|Select|Note|Share|Bring|Schedule|Contact|Message|Practice|Repeat|Set)\b/i.test(part);
  });

  if (firstInstructionIndex < 1) {
    return { hintText: String(value || '').trim(), trailingText: '' };
  }

  return {
    hintText: parts.slice(0, firstInstructionIndex).join(' '),
    trailingText: parts.slice(firstInstructionIndex).join(' '),
  };
}

function parentheticalHintLabelForMain(main: string): string {
  return /\b(?:limit|limits|boundary|boundaries|off-limits|allowed|forbidden|rules?)\b/i.test(main)
    ? 'Possible limits'
    : 'Suggestions';
}

function displayHintLabel(label: string | undefined, itemCount = 2): string {
  const normalized = String(label || '').trim();
  const singular = itemCount === 1;

  if (/^(?:suggestions?|examples?)$/i.test(normalized)) {
    return singular ? 'Suggestion' : 'Suggestions';
  }
  if (/^(?:possible\s+limits?|limit\s+examples?)$/i.test(normalized)) {
    return singular ? 'Possible limit' : 'Possible limits';
  }
  if (/^daily\s+supports?$/i.test(normalized)) {
    return singular ? 'Daily support' : 'Daily supports';
  }

  return normalized || (singular ? 'Suggestion' : 'Suggestions');
}

function splitHintDisplayItems(text: string): string[] {
  const quotedItems = extractStandaloneQuotedHintItems(text);
  if (quotedItems.length >= 2) {
    return quotedItems;
  }

  return splitHintTextOnSeparators(text)
    .map(part => part.trim())
    .filter(Boolean);
}

function cleanHintItem(text: string): string {
  return stripBalancedActionQuotes(String(text || '')
    .trim()
    .replace(/^[,;]+/g, '')
    .replace(/[,;.!?]+$/g, '')
    .trim());
}

function splitHintTextOnSeparators(text: string): string[] {
  const items: string[] = [];
  let current = '';
  let parenDepth = 0;
  let quoteClose = '';
  const source = String(text || '').replace(/,\s*([.!?])/g, '$1');

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (quoteClose) {
      current += char;
      if (char === quoteClose && !isActionApostrophe(source, i)) {
        quoteClose = '';
      }
      continue;
    }

    if ((char === '"' || char === "'" || char === '“' || char === '‘') && !isActionApostrophe(source, i)) {
      quoteClose = char === '“' ? '”' : char === '‘' ? '’' : char;
      current += char;
      continue;
    }

    if (char === '(') {
      parenDepth++;
    } else if (char === ')' && parenDepth > 0) {
      parenDepth--;
    }

    if ((char === ',' || char === ';') && parenDepth === 0) {
      if (current.trim()) {
        items.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items;
}

function extractStandaloneQuotedHintItems(text: string): string[] {
  const source = String(text || '').trim();
  const items: string[] = [];
  let outside = '';

  for (let i = 0; i < source.length; i++) {
    const open = source[i];
    if ((open !== '"' && open !== "'" && open !== '“' && open !== '‘') || isActionApostrophe(source, i)) {
      outside += open;
      continue;
    }

    const close = open === '“' ? '”' : open === '‘' ? '’' : open;
    let end = -1;
    for (let cursor = i + 1; cursor < source.length; cursor++) {
      if (source[cursor] === close && source[cursor - 1] !== '\\' && !isActionApostrophe(source, cursor)) {
        end = cursor;
        break;
      }
    }

    if (end === -1) {
      outside += open;
      continue;
    }

    const item = cleanHintItem(source.slice(i + 1, end));
    if (item) {
      items.push(`"${item}"`);
    }
    i = end;
  }

  const nonSeparatorText = outside
    .replace(/\b(?:and|or)\b/gi, '')
    .replace(/[,;\s]+/g, '')
    .trim();

  return items.length >= 2 && !nonSeparatorText ? items : [];
}

function splitParentheticalActionHint(line: string): string[] | null {
  const trimmed = String(line || '').trim();
  const match = trimmed.match(/^(.+?)\s*\((?:e\.g\.,?\s*)?([^)]+)\)([.!?])?(?:\s+(.+))?$/i);
  if (!match) {
    return null;
  }

  const main = match[1].trim();
  const hintItems = splitListHintItems(match[2]);
  if (!main || hintItems.length === 0) {
    return null;
  }

  const trailingText = match[4]?.trim() || '';
  const trailingCompletesSentence = /^(?:so|to|because|while|without|with|and|but|or)\b/.test(trailingText);
  const combinedMain = trailingCompletesSentence ? `${main} ${trailingText}` : main;
  const mainLine = /[.!?]$/.test(combinedMain) ? combinedMain : `${combinedMain}${match[3] || '.'}`;
  const hintLabel = displayHintLabel(parentheticalHintLabelForMain(main), hintItems.length);
  const trailingLines = trailingText && !trailingCompletesSentence ? splitReadableActionLine(trailingText) : [];

  return [mainLine, `${hintLabel}: ${hintItems.join('; ')}`, ...trailingLines];
}

function splitListHintItems(value: string): string[] {
  const quotedItems = extractStandaloneQuotedHintItems(value);
  if (quotedItems.length >= 2) {
    return quotedItems;
  }

  return splitHintTextOnSeparators(String(value || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+plus\s+(?=(?:check-ins?|accountability|prayer|healthy|rest|meals|Bible|waking)\b)/gi, ', ')
    .replace(/\s+or\s+(?=(?:number|time|minutes?|hours?|comments?|items?|steps?|points?)\b)/gi, ', ')
    .replace(/\s+and\s+(?=(?:avoiding|avoid|no|prayer|healthy|rest|attending|meeting|meals|places|people)\b)/gi, ', '))
    .map(part => {
      const cleaned = cleanHintItem(part.replace(/^(?:and|or)\s+/i, ''));
      if (/^["“]/.test(cleaned)) {
        return `"${stripBalancedActionQuotes(cleaned)}"`;
      }
      return stripBalancedActionQuotes(cleaned);
    })
    .filter(Boolean);
}

function splitResourceListItems(value: string): string[] {
  const items: string[] = [];
  let current = '';
  let parenDepth = 0;
  let quoteClose = '';
  const source = String(value || '').trim().replace(/[.!?]+$/g, '');

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (quoteClose) {
      current += char;
      if (char === quoteClose && !isActionApostrophe(source, i)) {
        quoteClose = '';
      }
      continue;
    }

    if ((char === '"' || char === "'" || char === '“' || char === '‘') && !isActionApostrophe(source, i)) {
      quoteClose = char === '“' ? '”' : char === '‘' ? '’' : char;
      current += char;
      continue;
    }

    if (char === '(') {
      parenDepth++;
    } else if (char === ')' && parenDepth > 0) {
      parenDepth--;
    }

    if ((char === ',' || char === ';') && parenDepth === 0) {
      if (current.trim()) {
        items.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items
    .map(item => stripBalancedActionQuotes(item.replace(/^(?:and|or)\s+/i, '').trim()))
    .filter(Boolean);
}

function parseResourceListLine(line: string): BodyLine | null {
  const match = String(line || '').trim().match(/^(.{0,120}?\b(?:including|include|list|consider|choose from)\b[^:]{0,90}\b(?:materials?|resources?|studies|books|curricula|curriculum|options)\b[^:]*):\s*(.+)$/i);
  if (!match) {
    return null;
  }

  const items = splitResourceListItems(match[2]);
  if (items.length < 2) {
    return null;
  }

  return {
    label: /material/i.test(match[1]) ? 'Materials to consider' : 'Resources to consider',
    text: match[1].trim().replace(/:\s*$/, '.'),
    type: 'resourceList',
    items,
  };
}

function parseResourceHintLine(line: string): BodyLine | null {
  const match = String(line || '').trim().match(/^(?:Suggestion|Suggestions|Example|Examples):\s*(?:(?:these|the)\s+)?(materials?|resources?|studies|books|curricula|curriculum|options)\s*:\s*(.+)$/i);
  if (!match) {
    return null;
  }

  const items = splitResourceListItems(match[2]);
  if (items.length < 2) {
    return null;
  }

  return {
    label: /material/i.test(match[1]) ? 'Materials to consider' : 'Resources to consider',
    text: 'Make a list from these options.',
    type: 'resourceList',
    items,
  };
}

function splitComparisonColumnItems(value: string): string[] {
  const source = String(value || '').trim().replace(/[.!?]+$/g, '');

  // Try splitting by numbered format like "1) item; 2) item; 3) item"
  const numberedParts = source
    .split(/(?<=\))\s*;\s*/)
    .map(part => part.replace(/^\s*\d+\)\s*/, '').trim())
    .filter(Boolean);

  if (numberedParts.length >= 2) {
    return numberedParts;
  }

  // Try splitting by semicolons followed by numbers/bullets
  const semicolonNumberedParts = source
    .split(/\s*;\s*(?=\d+\)|[-*•]\s+)/)
    .map(part => part.replace(/^\s*(?:\d+\)|[-*•])\s*/, '').trim())
    .filter(Boolean);

  if (semicolonNumberedParts.length >= 2) {
    return semicolonNumberedParts;
  }

  // Fallback to simple semicolon split
  return source
    .split(/\s*;\s*/)
    .map(part => part.replace(/^\s*(?:\d+\)|[-*•])\s*/, '').trim())
    .filter(Boolean);
}

function parseUnderColumnLine(line: string): { title: string; rest: string } | null {
  const match = String(line || '').trim().match(/^Under\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const source = match[1].trim();
  const quotePairs: Record<string, string> = {
    '"': '"',
    "'": "'",
    '“': '”',
    '‘': '’',
  };
  const closeQuote = quotePairs[source[0]];
  if (closeQuote) {
    const endIndex = source.indexOf(closeQuote, 1);
    if (endIndex > 0) {
      const title = stripBalancedActionQuotes(source.slice(1, endIndex).trim().replace(/,\s*$/, ''));
      const rest = source.slice(endIndex + 1).replace(/^,\s*/, '').trim();
      return title && rest ? { title, rest } : null;
    }
  }

  const unquoted = source.match(/^([^,]+),?\s+(.+)$/);
  if (!unquoted) {
    return null;
  }

  const title = stripBalancedActionQuotes(unquoted[1].trim().replace(/,\s*$/, ''));
  const rest = unquoted[2].trim();
  return title && rest ? { title, rest } : null;
}

function parseComparisonColumnLine(line: string): { title: string; items: string[] } | null {
  const parsed = parseUnderColumnLine(line);
  const match = parsed?.rest.match(/^list\s+(?:(?:these|this)\s+)?(?:points?|items?|teachings?|truths?|beliefs?)(?:\s+with\s+[^:]+)?\s*:\s*(.+)$/i);
  if (!parsed || !match) {
    return null;
  }

  const items = splitComparisonColumnItems(match[1]);
  const title = parsed.title;
  return title && items.length > 0 ? { title, items } : null;
}

function splitColumnHeaderItems(value: string): string[] {
  return String(value || '')
    .replace(/[.!?]+$/g, '')
    .split(/\s*,\s*|\s+\band\b\s+/i)
    .map(item => stripBalancedActionQuotes(item.trim().replace(/,\s*$/g, '')))
    .filter(item => item.length > 0 && item.length <= 48);
}

function parseColumnHeaderLine(line: string): { label: string; headers: string[] } | null {
  const match = String(line || '').trim().match(/^(.{0,160}?\b(?:column\s+headers?|headers)\s*:\s*)(.+)$/i);
  if (!match) {
    return null;
  }

  const headers = splitColumnHeaderItems(match[2]);
  return headers.length >= 2 ? { label: 'Column guide', headers } : null;
}

function parseColumnDescriptionLine(line: string): { title: string; text: string } | null {
  const parsed = parseUnderColumnLine(line);
  if (!parsed) {
    return null;
  }

  const title = parsed.title;
  const text = capitalizeFirstLetter(parsed.rest.trim().replace(/\s+/g, ' '));
  if (/^list\s+(?:(?:these|this)\s+)?(?:points?|items?|teachings?|truths?|beliefs?)(?:\s+with\s+[^:]+)?\s*:/i.test(text)) {
    return null;
  }
  return title && text ? { title, text } : null;
}

function normalizeColumnTitle(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function titleForTwoColumnPhrase(phrase: string, fallback: string): string {
  const cleaned = stripBalancedActionQuotes(String(phrase || '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/g, '')
    .trim());
  const lower = cleaned.toLowerCase();

  if (/\b(?:speak|talk|say|voice)\b/.test(lower) && !/\b(?:silence|silent|quiet)\b/.test(lower)) {
    return 'Speak because';
  }
  if (/\b(?:silence|silent|quiet|hold back|stay silent)\b/.test(lower)) {
    return 'Stay silent because';
  }

  const title = cleaned
    .replace(/^(?:reasons?\s+(?:you\s+)?(?:feel\s+)?(?:compelled\s+to\s+)?|things?\s+that\s+|why\s+|for\s+)/i, '')
    .trim();
  return capitalizeFirstLetter(title || fallback);
}

function itemsForTwoColumnTitle(title: string, phrase: string): string[] {
  const lower = `${title} ${phrase}`.toLowerCase();
  if (/\b(?:speak|talk|say|voice)\b/.test(lower) && !/\b(?:silence|silent|quiet)\b/.test(lower)) {
    return [
      'I want peace restored',
      'I need to correct a misunderstanding',
      'I want truth to be clear without attacking',
    ];
  }
  if (/\b(?:silence|silent|quiet|hold back|stay silent)\b/.test(lower)) {
    return [
      'I am afraid of rejection',
      'I am avoiding discomfort',
      'Waiting may help me speak calmly later',
    ];
  }
  return [
    'Write one specific reason',
    'Add one honest motive',
    'Mark whether it is love, fear, pride, or control',
  ];
}

function splitTwoColumnInstructionLine(line: string): string[] | null {
  const match = String(line || '').trim().match(/^(.*?\b(?:write|make|create|draw|fill(?:\s+out)?)\s+(?:two|2)\s+columns?\s*:\s*)(?:one|first)\s+(?:column\s+)?(?:listing|for|called|with)?\s*(.+?)\s*;\s*(?:another|second)\s+(?:column\s+)?(?:listing|for|called|with)?\s*(.+?)(?:[.!?]\s*(.*)|$)/i);
  if (!match) {
    return null;
  }

  const leftPhrase = match[2].trim();
  const rightPhrase = match[3].trim();
  const leftTitle = titleForTwoColumnPhrase(leftPhrase, 'Column 1');
  const rightTitle = titleForTwoColumnPhrase(rightPhrase, 'Column 2');
  const makeColumnLine = (title: string, phrase: string) => {
    const items = itemsForTwoColumnTitle(title, phrase)
      .map((item, index) => `${index + 1}) ${item}`)
      .join('; ');
    return `Under "${title}," list these points: ${items}.`;
  };
  const trailingText = match[4]?.trim();

  return [
    makeColumnLine(leftTitle, leftPhrase),
    makeColumnLine(rightTitle, rightPhrase),
    ...(trailingText ? splitReadableActionLine(trailingText) : []),
  ];
}

function splitScriptureReferenceAndText(value: string): { reference: string; text: string } | null {
  const source = String(value || '').trim();
  const match = source.match(/^(.{2,160}\([^)]+\)):\s*(.+)$/)
    || source.match(/^(.+?\d+:\d+(?:-\d+)?):\s*(.+)$/)
    || source.match(/^(.{2,120}?):\s*(.+)$/);

  if (!match) {
    return null;
  }

  return {
    reference: match[1].trim(),
    text: match[2].trim(),
  };
}

function formatScriptureReadText(text: string): string {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length < 520) {
    return normalized;
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+(?=[A-Z"“])/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

  return sentences.length >= 4 ? sentences.join('\n\n') : normalized;
}

function parseScriptureReadLine(line: string): BodyLine | null {
  const trimmed = String(line || '').trim();
  const scriptureOnlyMatch = trimmed.match(/^(?:Scripture|Passage)\s+(.+)$/i);
  if (scriptureOnlyMatch) {
    const parsed = splitScriptureReferenceAndText(scriptureOnlyMatch[1]);
    if (!parsed) {
      return null;
    }

    const reference = parsed.reference;
    const verseText = stripBalancedActionQuotes(parsed.text);
    if (!reference || !verseText) {
      return null;
    }

    return {
      text: formatScriptureReadText(verseText),
      type: 'scriptureRead',
      reference,
    };
  }

  const match = trimmed.match(/^Read\s+(.{2,100}?):\s*["'“‘](.+?)["'”’]?\s+Write:\s*(.+)$/i)
    || trimmed.match(/^Read\s+(.{2,100}?):\s*(.+?)\s+Write:\s*(.+)$/i);
  if (!match) {
    return null;
  }

  const reference = match[1].trim();
  const verseText = stripBalancedActionQuotes(match[2].trim());
  const summary = match[3].trim();
  if (!reference || !verseText || !summary) {
    return null;
  }

  return {
    text: verseText,
    type: 'scriptureRead',
    reference,
    summary,
  };
}

function parseLineMeaningLine(line: string): BodyLine | null {
  const match = String(line || '').trim().match(/^(?:Line|Phrase|Verse\s*\d*)\s*:\s*["'“‘]?(.+?)["'”’]?\s+(?:Means|Meaning|Explanation)\s*:\s*(.+)$/i);
  if (!match) {
    return null;
  }

  const phrase = stripBalancedActionQuotes(match[1].trim());
  const meaning = match[2].trim();
  if (!phrase || !meaning) {
    return null;
  }

  return {
    text: phrase,
    type: 'lineMeaning',
    summary: meaning,
  };
}

function extractParentheticalActionHint(value: string): { main: string; hints: string[]; label: string } | null {
  const match = String(value || '').trim().match(/^(.+?)\s*\((?:e\.g\.,?\s*)?([^)]+)\)([.!?])?$/i);
  if (!match) {
    return null;
  }

  const main = match[1].trim();
  const hints = splitListHintItems(match[2]);
  if (!main || hints.length === 0) {
    return null;
  }

  return {
    main: /[.!?]$/.test(main) ? main : `${main}${match[3] || ''}`,
    hints,
    label: displayHintLabel(parentheticalHintLabelForMain(main), hints.length),
  };
}

function splitSuchAsActionHint(line: string): string[] | null {
  const trimmed = String(line || '').trim();
  const match = trimmed.match(/^(.+?)\s+(?:such as|including)\s+(.+?)([.!?])?$/i);
  if (!match) {
    return null;
  }

  const main = match[1].trim();
  const { hintText, trailingText } = splitHintTextFromTrailingInstruction(match[2]);
  const hintItems = splitListHintItems(hintText);
  if (!main || hintItems.length < 2) {
    return null;
  }

  const mainLine = /[.!?]$/.test(main) ? main : `${main}${match[3] || '.'}`;
  const rawHintLabel = /\b(?:daily|each day|sober|sobriety|recovery|habit|plan|schedule)\b/i.test(main)
    ? 'Daily supports'
    : 'Suggestions';
  const hintLabel = displayHintLabel(rawHintLabel, hintItems.length);

  return [mainLine, `${hintLabel}: ${hintItems.join('; ')}`, ...splitReadableActionLine(trailingText)];
}

function splitInlineQuotedExamples(line: string): string[] | null {
  const trimmed = String(line || '').trim();
  const likeMatch = trimmed.match(/^(.+?)\s+(?:like|such as)\s+["'“‘](.+?)["'”’]\s+(?:or|and)\s+["'“‘](.+?)["'”’]([.!?])?$/i);
  if (likeMatch) {
    const main = likeMatch[1].trim();
    return [
      /[.!?]$/.test(main) ? main : `${main}${likeMatch[4] || '.'}`,
      `Suggestions: ${likeMatch[2].trim()}; ${likeMatch[3].trim()}`,
    ];
  }

  const insteadMatch = trimmed.match(/^(.+?)\s+for example,\s+["'“‘](.+?)["'”’]\s+instead of\s+["'“‘](.+?)["'”’]([.!?])?$/i);
  if (insteadMatch) {
    const main = insteadMatch[1].trim();
    return [
      /[.!?]$/.test(main) ? main : `${main}${insteadMatch[4] || '.'}`,
      `Use this kind of goal: ${insteadMatch[2].trim()}`,
      `Avoid outcome pressure: ${insteadMatch[3].trim()}`,
    ];
  }

  return null;
}

function stripLeakedActionFieldFragments(value: string): string {
  let out = String(value || '');
  const leakedFieldIndex = out.search(/(?:^|[\s,}"'`])\\?["']?\s*(?:primary_button|secondary_button|primaryButton|secondaryButton)\s*\\?["']?\s*:/i);
  if (leakedFieldIndex >= 0) {
    out = out.slice(0, leakedFieldIndex);
  }

  return out
    .replace(/(?:\\?["']?\s*,\s*)+$/g, '')
    .replace(/(?:\\?["'`“”‘’]){2,}\s*$/g, '')
    .trim();
}

function cleanActionDisplaySegment(value: string, preserveBulletMarkers = false): string {
  const rawValue = String(value || '').trim().replace(
    /^["“]\s*((?:Message|Text|Send|Write|Ask|Pray)\b[^:\n]{0,140}:\s*['‘][\s\S]*['’])\s*["”]\s*$/i,
    '$1'
  );
  let out = normalizeActionBulletMarkers(normalizeActionMarkup(stripLeakedActionFieldFragments(rawValue)))
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\*\*|__/g, '');

  out = preserveBulletMarkers
    ? out.split('\n').map(line => line.trimStart().startsWith('* ') ? line : line.replace(/\*/g, '')).join('\n')
    : out.replace(/\*/g, '');

  out = normalizeActionInlineStructure(
    removeDecorativeActionSingleQuotes(
      normalizeSingleQuotedActionScripts(out).replace(/ +([,.;:!?])/g, '$1')
    ).trim()
  );
  const cleaned = closeUnmatchedActionDoubleQuote(stripDanglingActionQuotes(stripWrappingQuotesUnlessList(out)));
  return normalizeActionPracticeLoopText(cleaned);
}

function normalizeActionExampleDisplayText(example: string): string {
  let value = String(example || '')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/&quot;|&#34;/gi, '"')
    .trim();
  if (/^(?:send|use|repeat)\s+(?:the\s+)?(?:message|text|words?)\s+(?:like|from)\s+above\s+exactly\.?$/i.test(value)) {
    return '';
  }
  if (/^pray\s+(?:these|the)\s+words\s+during\b.+\.?$/i.test(value)) {
    return '';
  }
  const bareYesNoAnswers = value.replace(/[.!?]+$/g, '').match(/^(yes|no)(?:\s*,\s*(yes|no))+$/i);
  if (bareYesNoAnswers) {
    const answers = value
      .replace(/[.!?]+$/g, '')
      .split(/\s*,\s*/)
      .map(answer => capitalizeFirstLetter(answer.toLowerCase()));
    return answers
      .map((answer, index) => `Question ${index + 1}: ${answer}`)
      .join('\n');
  }

  const quotedContrast = normalizeQuotedContrastExample(value);
  if (quotedContrast) {
    return quotedContrast;
  }

  const quotedItems = [...value.matchAll(/["“]([^"”]+)["”]/g)].map(match => match[1].trim()).filter(Boolean);
  const quotedRemainder = value.replace(/["“][^"”]+["”]/g, '').replace(/[,\s]+/g, '');
  if (quotedItems.length >= 2 && !quotedRemainder) {
    return quotedItems.map(item => `"${item}"`).join('\n');
  }

  if (!value || /^["“]/.test(value)) {
    return value;
  }

  value = value.replace(/^(?:Today,\s+|Today\s+)I\s+/i, 'I ');

  const messageSent = value.match(/^Message sent to\s+(.+?)\.?$/i);
  if (messageSent) {
    return `Send this message to ${messageSent[1].trim()}.`;
  }

  const textedAsking = value.match(/^(?:I\s+)?Texted\s+(.+?)\s+asking\s+(.+?)\.?$/i);
  if (textedAsking) {
    return `Text ${textedAsking[1].trim()} asking ${textedAsking[2].trim()}.`;
  }

  if (/^(?:loop\s+written\s+out\s+clearly|practice\s+loop\s+written\s+out\s+clearly)\.?$/i.test(value)) {
    return 'Fill in each loop line with your real trigger, temptation, and replacement response.';
  }

  const catchThought = value.match(/^Catch\s+(?:the\s+)?thought\s+(.+?\?)\s+then\s+(.+)$/i);
  if (catchThought) {
    return `Catch the thought "${catchThought[1].trim()}" then ${catchThought[2].trim()}`;
  }

  const quotedQuestions = value.match(/["“][^"”]*\?["”]/g);
  if (quotedQuestions && quotedQuestions.length >= 2) {
    return quotedQuestions
      .map(question => stripBalancedActionQuotes(question))
      .map(question => `"${question}"`)
      .join('\n');
  }

  const sharedAndAsked = value.match(/^I\s+shared\s+with\s+(.+?)\s+who\s+agreed\s+to\s+(.+?)\.?$/i);
  if (sharedAndAsked) {
    return capitalizeInstruction(toInstructionPointOfView(`Share with ${sharedAndAsked[1].trim()} and ask them to ${sharedAndAsked[2].trim()}.`));
  }

  const instructionRules: Array<[RegExp, string]> = [
    [/^I\s+will\s+(.+)$/i, '$1'],
    [/^I\s+messaged\s+(.+)$/i, 'Message $1'],
    [/^I\s+sent\s+(.+)$/i, 'Send $1'],
    [/^I\s+texted\s+(.+)$/i, 'Text $1'],
    [/^I\s+called\s+(.+)$/i, 'Call $1'],
    [/^I\s+contacted\s+(.+)$/i, 'Contact $1'],
    [/^I\s+asked\s+(.+)$/i, 'Ask $1'],
    [/^I\s+told\s+(.+)$/i, 'Tell $1'],
    [/^I\s+shared\s+with\s+(.+)$/i, 'Share with $1'],
    [/^I\s+wrote\s+down\s+(.+)$/i, 'Write down $1'],
    [/^I\s+wrote\s+(.+)$/i, 'Write $1'],
    [/^I\s+listed\s+(.+)$/i, 'List $1'],
    [/^I\s+documented\s+(.+)$/i, 'Document $1'],
    [/^I\s+packed\s+(.+)$/i, 'Pack $1'],
    [/^I\s+removed\s+(.+)$/i, 'Remove $1'],
    [/^I\s+threw\s+(?:away|out)\s+(.+)$/i, 'Throw away $1'],
    [/^I\s+hid\s+(.+)$/i, 'Secure $1'],
    [/^I\s+secured\s+(.+)$/i, 'Secure $1'],
    [/^I\s+put\s+(.+)$/i, 'Put $1'],
    [/^I\s+placed\s+(.+)$/i, 'Place $1'],
    [/^I\s+set\s+(.+)$/i, 'Set $1'],
    [/^I\s+chose\s+(.+)$/i, 'Choose $1'],
    [/^I\s+planned\s+(.+)$/i, 'Plan $1'],
    [/^I\s+prayed\s+(.+)$/i, 'Pray $1'],
    [/^I\s+read\s+(.+)$/i, 'Read $1'],
    [/^I\s+confessed\s+(.+)$/i, 'Confess $1'],
    [/^I\s+apologized\s+(.+)$/i, 'Apologize $1'],
    [/^I\s+deleted\s+(.+)$/i, 'Delete $1'],
    [/^I\s+blocked\s+(.+)$/i, 'Block $1'],
    [/^I\s+avoided\s+(.+)$/i, 'Avoid $1'],
    [/^I\s+stopped\s+(.+)$/i, 'Stop $1'],
    [/^I\s+started\s+(.+)$/i, 'Start $1'],
    [/^I\s+created\s+(.+)$/i, 'Create $1'],
    [/^I\s+made\s+(.+)$/i, 'Make $1'],
    [/^I\s+brought\s+(.+)$/i, 'Bring $1'],
    [/^I\s+kept\s+(.+)$/i, 'Keep $1'],
  ];

  for (const [pattern, replacement] of instructionRules) {
    if (pattern.test(value)) {
      return capitalizeInstruction(toInstructionPointOfView(value.replace(pattern, replacement)));
    }
  }

  return value;
}

function getPrimaryActionExample(rawExamples: unknown, subTasks?: ActionStep['subTasks']): string | null {
  let candidates: string[] = [];

  if (typeof rawExamples === 'string') {
    const source = rawExamples.trim();
    if (ACTION_EXAMPLE_MARKER_REGEX.test(source)) {
      candidates = source
        .split(ACTION_EXAMPLE_MARKER_REGEX)
        .filter(part => part.trim().length > 0);
    } else if (source.includes(';')) {
      candidates = source.split(';');
    } else if (source) {
      candidates = [source];
    }
  } else if (Array.isArray(rawExamples)) {
    candidates = rawExamples.map(example => String(example || ''));
  } else if (subTasks && subTasks.length > 0) {
    candidates = subTasks
      .filter(subTask => typeof subTask.text === 'string' && subTask.text.toLowerCase().startsWith('example:'))
      .map(subTask => subTask.text);
  }

  const cleanedCandidates = candidates
    .map(candidate => candidate.replace(/^Example\s*[:：]\s*/i, '').trim())
    .filter(Boolean);
  const preferred =
    cleanedCandidates.find(candidate => normalizeQuotedContrastExample(candidate)) ||
    cleanedCandidates.find(candidate => /^["“]/.test(candidate)) ||
    cleanedCandidates[0];

  return preferred ? normalizeActionExampleDisplayText(preferred) : null;
}

function splitActionDescription(value: string): { body: string; example?: string } {
  const parts = String(value || '').split(ACTION_EXAMPLE_MARKER_REGEX);
  let body = cleanActionDisplaySegment(parts[0] || '', true);
  if (parts.length < 2) {
    return { body };
  }

  const exampleSegments = parts
    .slice(1)
    .map(part => cleanActionDisplaySegment(part))
    .filter(Boolean);
  let preferredExample = exampleSegments.find(part => /^["“]/.test(part.trim())) || exampleSegments[0] || '';
  const trailingGuidance = preferredExample.match(
    /^([\s\S]*?)\n+((?:Invite|Keep|Ask|Then|Next|Use|Discuss|Agree|Set)\b[\s\S]*)$/i
  );
  if (trailingGuidance) {
    preferredExample = trailingGuidance[1].trim();
    body = [body, trailingGuidance[2].trim()].filter(Boolean).join('\n');
  }
  const example = normalizeActionExampleDisplayText(
    preferredExample
  );
  return example ? { body, example } : { body };
}

function splitReadableActionLine(line: string): string[] {
  const trimmed = line
    .trim()
    .replace(/([.!?]["'”’])\s*,\s*["'“‘]\s*(?=(?:If|When|After|Then)\b)/gi, '$1 ')
    .replace(/(["”’])\s*,\s*["'“‘]\s*(?=(?:If|When|After|Then)\b)/gi, '$1 ');
  if (!trimmed) { return []; }
  if (parseScriptureReadLine(trimmed) || parseLineMeaningLine(trimmed)) { return [trimmed]; }
  if (/^(?:\*|-|•|\+) /.test(trimmed)) { return [trimmed.replace(/^(?:-|•|\+) /, '* ')]; }
  if (/^(?:Trigger|Lie|Temptation|Replacement response|Replacement|Practice|Stop|Start):\s+/i.test(trimmed)) { return [trimmed]; }
  if (parseComparisonColumnLine(trimmed)) { return [trimmed]; }
  const canonicalQuotedInstruction = parseCanonicalQuotedInstructionLine(trimmed);
  if (canonicalQuotedInstruction) {
    return [
      ...(canonicalQuotedInstruction.prefix ? splitReadableActionLine(canonicalQuotedInstruction.prefix) : []),
      `${canonicalQuotedInstruction.label}:`,
      canonicalQuotedInstruction.quote,
      ...(canonicalQuotedInstruction.rest ? splitReadableActionLine(canonicalQuotedInstruction.rest) : []),
    ];
  }
  const embeddedScript = trimmed.match(/^(.+?[.!?])\s+(.{0,140}?\b(?:reach out(?: today)? with this message|with this message|add this request|this request|answer honestly like this|for example,\s*write|add\s+(?:another|any\s+other)\s+(?:honest\s+)?reasons?(?:,\s*(?:such as|for example))?|say to yourself|pause and say aloud|say(?:\s+(?:aloud\s+)?or\s+write(?:\s+down)?)?|say aloud|say out loud|say plainly|say this(?: clearly| plainly)?|continue with|then say(?:\s+or\s+write)?|next say(?:\s+or\s+write)?|finish by saying|finish by praying|finish with|then pray|send(?: this)? message|message|text|write|ask|request|reply|pray(?:\s+(?:briefly|quietly))?(?:\s+with\s+these\s+words)?)\b[^:]{0,70}:\s*)(["'\u201C\u2018].+)$/i);
  if (embeddedScript) {
    const { quote, rest } = splitLeadingQuotedActionText(embeddedScript[3]);
    return [
      embeddedScript[1].trim(),
      embeddedScript[2].trim(),
      quote,
      ...splitReadableActionLine(rest),
    ];
  }
  const unquotedSpokenLine = trimmed.match(/^(.{0,140}?\b(?:say(?:\s+(?:aloud(?:\s+slowly\s+and\s+clearly)?|(?:aloud\s+)?or\s+write(?:\s+down)?))?|explain|add|continue\s+with|then\s+say(?:\s+or\s+write)?|next\s+say(?:\s+or\s+write)?|finish\s+by\s+saying|finish\s+by\s+praying|finish\s+with|then\s+pray|pray\s+quietly|practice\s+saying(?:\s+calmly)?|repeat\s+the\s+next\s+declaration|for example)\b[^:]{0,70}:\s*)([A-Z][^"'\u201C\u2018].+)$/i);
  if (unquotedSpokenLine) {
    const statement = unquotedSpokenLine[2].trim();
    return [
      unquotedSpokenLine[1].trim(),
      `"${statement.replace(/[.!?]$/g, '')}."`,
    ];
  }
  const inlineScript = trimmed.match(/^(.{0,170}?\b(?:reach out(?: today)? with this message|with this message|add this request|this request|answer honestly like this|for example,\s*write|add\s+(?:another|any\s+other)\s+(?:honest\s+)?reasons?(?:,\s*(?:such as|for example))?|say to yourself|pause and say aloud|say(?:\s+(?:aloud\s+)?or\s+write(?:\s+down)?)?|say aloud|say out loud|say plainly|say this(?: clearly| plainly)?|continue with|then say(?:\s+or\s+write)?|next say(?:\s+or\s+write)?|finish by saying|finish by praying|finish with|then pray|send(?: this)? message|message|text|write|ask|request|reply|pray(?:\s+(?:briefly|quietly))?(?:\s+with\s+these\s+words)?)\b[^:]{0,70}:\s*)(["'\u201C\u2018].+)$/i);
  if (inlineScript) {
    const { quote, rest } = splitLeadingQuotedActionText(inlineScript[2]);
    return [inlineScript[1].trim(), quote, ...splitReadableActionLine(rest)];
  }
  const embeddedQuestionPrompt = trimmed.match(/^(.+?[.!?])\s+((?:(?:read|rad)\s+what\s+you\s+wrote\s+out\s+loud\s+slow(?:ly|ely)\s+and\s+ask(?:\s+yourself)?|(?:read|rad)\s+slow(?:ly|ely)\s+and\s+ask|pause\s+and\s+ask|then\s+ask|[^:]{0,90}\bask\s+these\s+questions|ask(?:\s+(?:yourself|them))?(?:\s+these\s+questions)?|test|check)\s*:\s*)(.+)$/i);
  if (embeddedQuestionPrompt) {
    return [
      embeddedQuestionPrompt[1].trim(),
      capitalizeFirstLetter(embeddedQuestionPrompt[2].trim()),
      ...splitQuestionPromptText(embeddedQuestionPrompt[3]),
    ];
  }
  const embeddedLooseQuestionPrompt = trimmed.match(/^(.+?)\s+((?:(?:read|rad)\s+what\s+you\s+wrote\s+out\s+loud\s+slow(?:ly|ely)\s+and\s+ask(?:\s+yourself)?|(?:read|rad)\s+slow(?:ly|ely)\s+and\s+ask|pause\s+and\s+ask|then\s+ask|[^:]{0,90}\bask\s+these\s+questions|ask(?:\s+(?:yourself|them))?(?:\s+these\s+questions)?|test|check)\s*:\s*)(.+)$/i);
  if (embeddedLooseQuestionPrompt && embeddedLooseQuestionPrompt[1].trim().length > 8) {
    return [
      ...splitReadableActionLine(embeddedLooseQuestionPrompt[1].trim()),
      capitalizeFirstLetter(embeddedLooseQuestionPrompt[2].trim()),
      ...splitQuestionPromptText(embeddedLooseQuestionPrompt[3]),
    ];
  }
  const questionPrompt = trimmed.match(/^((?:(?:read|rad)\s+what\s+you\s+wrote\s+out\s+loud\s+slow(?:ly|ely)\s+and\s+ask(?:\s+yourself)?|(?:read|rad)\s+slow(?:ly|ely)\s+and\s+ask|pause\s+and\s+ask|then\s+ask|[^:]{0,90}\bask\s+these\s+questions|ask(?:\s+(?:yourself|them))?(?:\s+these\s+questions)?|test|check)\s*:\s*)(.+)$/i);
  if (questionPrompt) {
    return [
      capitalizeFirstLetter(questionPrompt[1].trim()),
      ...splitQuestionPromptText(questionPrompt[2]),
    ];
  }
  const followUpInstruction = trimmed.match(/^(.+?[.!?]["'"])\s+((?:If|When|After|Then|Repeat)\b.+)$/i);
  if (followUpInstruction) {
    return [
      ...splitReadableActionLine(followUpInstruction[1].trim()),
      ...splitReadableActionLine(followUpInstruction[2].trim()),
    ];
  }
  if (/^["\u201C]/.test(trimmed)) { return [trimmed]; }

  const sentenceParts = trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z"“])|(?<=[.!?]["'”’])\s+(?=[A-Z])/)
    .map(part => part.trim())
    .filter(Boolean);
  if (sentenceParts.length >= 2 && sentenceParts.some(part => isAskPromptIntroLine(part))) {
    return sentenceParts.flatMap(part => splitReadableActionLine(part));
  }
  if (sentenceParts.length >= 2 && isAskPromptQualifierLine(sentenceParts[sentenceParts.length - 1])) {
    return sentenceParts.flatMap(part => splitReadableActionLine(part));
  }
  if (sentenceParts.length >= 2 && sentenceParts.some(part => isChecklistIntroLine(part))) {
    return sentenceParts.flatMap(part => splitReadableActionLine(part));
  }
  if (sentenceParts.length >= 2 && sentenceParts.some(part => /^(?:If|When|After)\b/i.test(part))) {
    return sentenceParts.flatMap(part => splitReadableActionLine(part));
  }
  if (
    sentenceParts.length >= 2 &&
    sentenceParts.some(part => /\([^)]+\)/.test(part) || /^Then\b/i.test(part))
  ) {
    return sentenceParts.flatMap(part => splitReadableActionLine(part));
  }

  const parentheticalHint = splitParentheticalActionHint(trimmed);
  if (parentheticalHint) {
    return parentheticalHint;
  }

  const suchAsHint = splitSuchAsActionHint(trimmed);
  if (suchAsHint) {
    return suchAsHint;
  }

  const inlineExamples = splitInlineQuotedExamples(trimmed);
  if (inlineExamples) {
    return inlineExamples;
  }

  if (trimmed.length < 145) { return [trimmed]; }

  return sentenceParts.length >= 2 ? sentenceParts : [trimmed];
}

function splitReadableWisdomLine(line: string): string[] {
  const trimmed = String(line || '').trim();
  if (!trimmed) {
    return [];
  }

  const twoColumnInstruction = splitTwoColumnInstructionLine(trimmed);
  if (twoColumnInstruction) {
    return twoColumnInstruction;
  }

  return splitReadableActionLine(trimmed);
}

function isQuotedActionLine(line: string): boolean {
  return /^["\u201C\u201D]/.test(line.trim());
}

function isScriptIntroLine(line: string): boolean {
  const trimmed = line.trim();
  if (/^prayer(?:\s+to\s+say)?\s*:\s*$/i.test(trimmed)) {
    return true;
  }
  if (/^example\s+to\s+write\s*:\s*$/i.test(trimmed)) {
    return true;
  }
  if (/^call\s+script\s*:\s*$/i.test(trimmed)) {
    return true;
  }
  if (/^(?:call|contact|phone)\b.{0,100}\bsay\s*:\s*$/i.test(trimmed)) {
    return true;
  }
  if (/^(?:(?:then|next)\s+)?say(?:\s+(?:aloud\s+)?or\s+write(?:\s+down)?)?\s*:\s*$/i.test(trimmed)) {
    return true;
  }
  if (/^ask(?:\s+(?:him|her|them|your\s+(?:husband|wife|spouse|friend|pastor|leader)))?\s*:\s*$/i.test(trimmed)) {
    return true;
  }
  if (/^follow\s+with(?:\s+this\s+question)?\s*:\s*$/i.test(trimmed)) {
    return true;
  }
  if (/^question\s+to\s+ask\s*:\s*$/i.test(trimmed)) {
    return true;
  }
  if (/^tell\b.{0,100}\b(?:plainly|calmly|clearly|gently)?\s*:\s*$/i.test(trimmed)) {
    return true;
  }
  if (/^say\s+to\s+yourself\s*:\s*$/i.test(trimmed)) {
    return true;
  }
  if (/^(?:finish|end)\s+(?:by\s+)?(?:saying|praying|with)\s*:\s*$/i.test(trimmed)) {
    return true;
  }
  if (/^(?:if|when|after)\b.{0,100}\b(?:say|reply|respond|text|message)\s*:\s*$/i.test(trimmed)) {
    return true;
  }
  if (/^(?:say|explain|add|continue\s+with|then\s+say|then\s+pray|practice\s+saying(?:\s+calmly)?)\s*:\s*$/i.test(trimmed)) {
    return true;
  }
  if (/^(?:add\s+(?:another|any\s+other)\s+(?:honest\s+)?reasons?(?:,\s*(?:such as|for example))?|write\s+this\s+sentence|pray\s+quietly):\s*$/i.test(trimmed)) {
    return true;
  }
  return /^(?:(?:say|send|text|message|write|ask|pray|request|reply|continue)\b|.*\b(?:with this message|add this request|this request|reply|answer honestly like this|continue with|then say|next say|finish by saying|finish by praying|finish with|then pray|say to yourself|say or write|say aloud|say out loud|pause and say aloud|say plainly|say this(?: clearly| plainly)?|say this prayer|pray briefly with these words|pray quietly|for example,\s*(?:you\s+(?:might|can)\s+)?write)\b)[^:]{0,100}:\s*$/i.test(trimmed)
    && /\b(?:this|message|text|script|plainly|aloud|silently|yourself|example|words?|reply|sentence|prayer|pray|ask|request|reason|write)\b/i.test(trimmed);
}

function scriptLabelForIntro(line: string): string {
  if (/^call\s+script\s*:/i.test(line.trim())) {
    return 'Call script';
  }
  if (/^(?:call|contact|phone)\b.{0,100}\bsay\s*:/i.test(line.trim())) {
    return 'Call script';
  }
  if (/^prayer(?:\s+to\s+say)?\s*:/i.test(line.trim())) {
    return 'Prayer to say';
  }
  if (/^example\s+to\s+write\s*:/i.test(line.trim())) {
    return 'Example to write';
  }
  if (/^send(?:\s+this)?\s+message\b/i.test(line.trim())) {
    return 'Message to send';
  }
  if (/^ask(?:\s+(?:him|her|them|your\s+(?:husband|wife|spouse|friend|pastor|leader)))?\s*:/i.test(line.trim())) {
    return 'Ask';
  }
  if (/^follow\s+with(?:\s+this\s+question)?\s*:/i.test(line.trim())) {
    return 'Ask';
  }
  if (/^question\s+to\s+ask\s*:/i.test(line.trim())) {
    return 'Ask';
  }
  if (/^if\s+they\s+respond\b/i.test(line.trim())) {
    return 'If they respond';
  }
  if (/^if\s+they\s+ask\b/i.test(line.trim())) {
    return 'If they ask';
  }
  if (/^(?:if|when|after)\b/i.test(line.trim()) && /\b(?:pray|prayer)\b/i.test(line.trim())) {
    return 'Prayer to say';
  }
  if (/^(?:if|when|after)\b/i.test(line.trim()) && /\b(?:say|reply|respond|text|message)\b/i.test(line.trim())) {
    return 'Possible reply';
  }
  if (/\bsay(?:\s+aloud)?\s+or\s+write(?:\s+down)?\b/i.test(line.trim())) {
    return 'Say or write';
  }
  if (/^tell\b/i.test(line.trim())) {
    return 'Tell plainly';
  }
  if (/\bsay\s+to\s+yourself\b/i.test(line.trim())) {
    return 'Say to yourself';
  }
  if (/^write\s+this\s+sentence\b/i.test(line.trim())) {
    return 'Write this sentence';
  }
  if (/^add\s+(?:another|any\s+other)\s+(?:honest\s+)?reasons?\b/i.test(line.trim())) {
    return 'Another reason';
  }
  if (/^explain\s*:/i.test(line.trim())) {
    return 'Explain';
  }
  if (/^add\s*:/i.test(line.trim())) {
    return 'Add this point';
  }
  if (/^continue\s+with\s*:/i.test(line.trim())) {
    return 'Continue with';
  }
  if (/^then\s+say\s*:/i.test(line.trim())) {
    return 'Then say';
  }
  if (/^then\s+pray\s*:/i.test(line.trim())) {
    return 'Then pray';
  }
  if (/^(?:finish|end)\s+(?:by\s+)?(?:saying|with)\s*:/i.test(line.trim())) {
    return 'Finish with';
  }
  if (/^(?:finish|end)\s+(?:by\s+)?praying\s*:/i.test(line.trim())) {
    return 'Finish by praying';
  }
  if (/^practice\s+saying\s+calmly\s*:/i.test(line.trim())) {
    return 'Practice saying calmly';
  }
  if (/^say\s*:/i.test(line.trim())) {
    return 'Say';
  }
  if (/^ask\s*:/i.test(line.trim())) {
    return 'Ask';
  }
  if (/\brequest\b/i.test(line)) {
    return 'Request to add';
  }
  if (/\banswer\s+honestly\b/i.test(line)) {
    return 'Honest answer';
  }
  if (/\bfor\s+example\b/i.test(line) && /\bwrite\b/i.test(line)) {
    return 'Example to write';
  }
  if (/\bsay\s+to\s+yourself\b/i.test(line)) {
    return 'Say to yourself';
  }
  if (/\breply\b/i.test(line)) {
    return 'Reply';
  }
  if (/\bpray\b/i.test(line) && /\bbriefly\b/i.test(line)) {
    return 'Brief prayer';
  }
  if (/\bpray\s+quietly\b/i.test(line)) {
    return 'Quiet prayer';
  }
  if (/\bsay\s+plainly\b/i.test(line)) {
    return 'Say plainly';
  }
  if (/\bsay\s+(?:out\s+loud|aloud)\s+with\s+conviction\b/i.test(line)) {
    return 'Say with conviction';
  }
  if (/\bsay\s+aloud\s+clearly\b/i.test(line)) {
    return 'Say aloud clearly';
  }
  if (/\beach\s+morning\b/i.test(line) && /\bsay\s+aloud\b/i.test(line)) {
    return 'Each morning say aloud';
  }
  if (/\beach\s+(?:day|night|evening)\b/i.test(line) && /\bsay\s+aloud\b/i.test(line)) {
    return 'Say aloud daily';
  }
  if (/\bwhen\b/i.test(line) && /\bsay\s+aloud\b/i.test(line)) {
    return 'Say this when it rises';
  }
  if (/\bsay\s+aloud\b/i.test(line)) {
    return 'Say aloud';
  }
  if (/\b(?:message|text|send|reply)\b/i.test(line)) {
    return 'Message to send';
  }
  if (/\b(?:pray|prayer)\b/i.test(line)) {
    return 'Prayer to say';
  }
  return 'Words to say';
}

function parseBareSpokenScriptLine(line: string): BodyLine | null {
  const text = stripBalancedActionQuotes(String(line || '').trim());
  if (!text || text.length > 260) {
    return null;
  }

  if (looksLikeBareScriptureLine(text)) {
    return null;
  }

  const isQuestion = /\?\s*$/.test(text);
  const startsWithQuestion = /^(?:can|could|would|will|do|does|did|what|how|when|where|why|is|are|should|may)\b/i.test(text);
  const hasEmbeddedQuestion = /[.!]\s+(?:can|could|would|will|do|does|did|what|how|when|where|why|is|are|should|may)\b.+\?\s*$/i.test(text);
  const startsWithDirectSpeech = /^(?:i(?:['’]m| am| want| need| feel| felt| was| will| can| understand| regret| apologize| hope| would)|we(?: can| need| should| both| will)|thank you\b|please\b)/i.test(text);
  const looksLikeApology = /\b(?:sorry|apologize|apology|regret|that was wrong|i was wrong)\b/i.test(text);

  if (isQuestion && (startsWithQuestion || hasEmbeddedQuestion)) {
    return { label: 'Ask', text, type: 'script' };
  }

  if (startsWithDirectSpeech) {
    return {
      label: looksLikeApology ? 'Apology to say' : 'Words to say',
      text,
      type: 'script',
    };
  }

  return null;
}

function looksLikeBareScriptureLine(text: string): boolean {
  const normalized = String(text || '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return false;
  }

  if (/^(?:I will say to the Lord|I am the Lord\b|I am the way\b|I am the good shepherd\b)/i.test(normalized)) {
    return true;
  }

  return /^I\s+(?:will|am|have|can)\b/i.test(normalized)
    && /\b(?:the Lord|my refuge|my fortress|my God|the Almighty|Most High)\b/i.test(normalized)
    && !/\b(?:sorry|apologize|need|want|hope|feel|understand|please forgive)\b/i.test(normalized);
}

function parseScheduleLine(line: string): BodyLine | null {
  const match = String(line || '').trim().match(/^(?:(?:decide\s+on|plan|prepare|choose|set)\s+(?:a\s+)?)?([^:]{3,64}?):\s*(.+)$/i);
  if (!match) {
    return null;
  }

  const rawLabel = match[1].trim();
  if (!/\b(?:breakfast|lunch|dinner|supper|snack|meal)\b/i.test(rawLabel)) {
    return null;
  }

  const label = rawLabel
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
  const text = capitalizeFirstLetter(match[2].trim().replace(/^for example,\s*/i, ''));

  return label && text
    ? { label, text, type: 'schedule' }
    : null;
}

function isChecklistIntroLine(line: string): boolean {
  return /^(?:do this(?:\s+(?:each|every)\s+(?:day|morning|evening|night|week))?|steps to take|action steps):\s*$/i.test(line.trim());
}

function isAskPromptIntroLine(line: string): boolean {
  return /^(?:(?:read|rad)\s+what\s+you\s+wrote\s+out\s+loud\s+slow(?:ly|ely)\s+and\s+ask(?:\s+yourself)?|(?:read|rad) slow(?:ly|ely)(?:\s+(?:each day|daily))? and ask|pause and ask|[^:]{0,90}\bask\s+these\s+questions|ask(?:\s+(?:yourself|them))?(?:\s+(?:kindly|gently|honestly|plainly))?(?:\s+these\s+questions)?|then ask|test|check):\s*$/i.test(line.trim());
}

function askPromptLabel(line: string): string {
  const trimmed = line.trim();
  if (/^(?:read|rad)\s+what\s+you\s+wrote\s+out\s+loud\s+slow(?:ly|ely)\s+and\s+ask/i.test(trimmed)) {
    return 'Ask yourself';
  }
  if (/\bask\s+these\s+questions\b/i.test(trimmed)) {
    return 'Ask these questions';
  }
  if (/^(?:read|rad) slow(?:ly|ely)(?:\s+(?:each day|daily))? and ask/i.test(trimmed)) {
    return 'Read slowly and ask';
  }
  if (/^(?:read|rad) slow(?:ly|ely)\s+(?:each day|daily)/i.test(trimmed)) {
    return 'Read slowly each day';
  }
  if (/^pause and ask/i.test(trimmed)) {
    return 'Pause and ask';
  }
  if (/^ask\s+them/i.test(trimmed)) {
    return 'Ask them';
  }
  if (/^then ask/i.test(trimmed)) {
    return 'Then ask';
  }
  if (/^test/i.test(trimmed)) {
    return 'Test';
  }
  if (/^check/i.test(trimmed)) {
    return 'Check';
  }
  return 'Ask yourself';
}

function isCheckInLabelValueLine(line: string): { label: string; text: string } | null {
  const match = line.match(/^([^:\n]{3,72}):\s*(.+)$/);
  if (!match) {
    return null;
  }

  const label = match[1].trim();
  const text = match[2].trim();
  if (!label || !text || /^example$/i.test(label) || isScriptIntroLine(`${label}:`)) {
    return null;
  }

  const looksLikeCheckIn =
    /^(?:today|areas?|what|where|when|who|why|how|wins?|setbacks?|progress|notes?|action|fact|fear|obedience|lie|truth|helped|next|specifics?|journal|discipline|temptation|response|replacement)\b/i.test(label) ||
    /^(?:yes\s*\/\s*no|list\b|note\b|name\b|choose\b|write\b|fill\b|mark\b|track\b|specifics?\b)/i.test(text);

  return looksLikeCheckIn ? { label, text } : null;
}

function getWriteDownActionText(line: string): string | null {
  const match = String(line || '').trim().match(/^(?:write\s+(?:this\s+)?down|jot\s+(?:this\s+)?down|note\s+this):\s*(.+)$/i);
  const text = match?.[1]?.trim();
  return text || null;
}

function detectBodyLines(lines: string[], actionType: string): BodyLine[] {
  const out: BodyLine[] = [];
  let expectingPromptQuestion = false;
  let inChecklist = false;
  let inWriteDownList = false;
  let pendingAskPromptQualifier: string | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const line = raw.trim();
    const previousLine = lines[idx - 1]?.trim() || '';
    const nextLine = lines[idx + 1]?.trim() || '';
    const resourceList = parseResourceListLine(line) || parseResourceHintLine(line);
    const columnHeader = parseColumnHeaderLine(line);
    const comparisonColumn = parseComparisonColumnLine(line);
    const columnDescription = parseColumnDescriptionLine(line);
    const scriptureRead = parseScriptureReadLine(line);
    const lineMeaning = parseLineMeaningLine(line);
    const scheduleLine = parseScheduleLine(line);

    if (scriptureRead) {
      out.push(scriptureRead);
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (lineMeaning) {
      out.push(lineMeaning);
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (scheduleLine) {
      out.push(scheduleLine);
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (columnHeader) {
      const columns = columnHeader.headers.map(header => ({
        title: header,
        items: ['Fill this in each time you track it.'],
      }));
      let cursor = idx + 1;
      while (cursor < lines.length) {
        const description = parseColumnDescriptionLine(lines[cursor]?.trim() || '');
        if (!description) {
          break;
        }
        const matchingColumn = columns.find(column => normalizeColumnTitle(column.title) === normalizeColumnTitle(description.title));
        if (matchingColumn) {
          matchingColumn.items = [description.text];
        } else {
          columns.push({ title: description.title, items: [description.text] });
        }
        cursor++;
      }

      out.push({
        label: columnHeader.label,
        text: 'Use these columns to track the details clearly.',
        type: 'columns',
        columns,
      });
      idx = cursor - 1;
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (columnDescription) {
      const columns = [columnDescription];
      let cursor = idx + 1;
      while (cursor < lines.length) {
        const nextColumn = parseColumnDescriptionLine(lines[cursor]?.trim() || '');
        if (!nextColumn) {
          break;
        }
        columns.push(nextColumn);
        cursor++;
      }

      out.push({
        label: 'Column guide',
        text: 'Use these columns to track the details clearly.',
        type: 'columns',
        columns: columns.map(column => ({ title: column.title, items: [column.text] })),
      });
      idx = cursor - 1;
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (comparisonColumn) {
      const columns = [comparisonColumn];
      let cursor = idx + 1;
      while (cursor < lines.length) {
        const nextColumn = parseComparisonColumnLine(lines[cursor]?.trim() || '');
        if (!nextColumn) {
          break;
        }
        columns.push(nextColumn);
        cursor++;
      }

      out.push({
        text: 'Compare these side by side.',
        type: 'columns',
        columns,
      });
      idx = cursor - 1;
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (resourceList) {
      out.push(resourceList);
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (isAskPromptQualifierLine(line)) {
      if (isAskPromptIntroLine(nextLine)) {
        pendingAskPromptQualifier = askPromptQualifierLabel(line);
      } else {
        out.push({ text: `${askPromptQualifierLabel(line)}:`, type: 'intro' });
        pendingAskPromptQualifier = null;
      }
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (isAskPromptIntroLine(line)) {
      const { questions, nextIndex } = collectPromptQuestions(lines, idx + 1);
      const promptLabel = combineAskPromptLabel(pendingAskPromptQualifier, askPromptLabel(line));
      pendingAskPromptQualifier = null;

      if (questions.length > 0) {
        out.push({ label: promptLabel, text: questions.join('\n\n'), type: 'script' });
        idx = nextIndex - 1;
        expectingPromptQuestion = false;
      } else {
        out.push({
          label: promptLabel,
          text: '',
          type: 'ask',
        });
        expectingPromptQuestion = true;
      }
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (expectingPromptQuestion && isPromptQuestionLine(line)) {
      out.push({ label: 'Ask', text: stripBalancedActionQuotes(line), type: 'script' });
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (isScriptIntroLine(line) && isQuotedActionLine(nextLine)) {
      out.push({
        label: scriptLabelForIntro(line),
        text: stripBalancedActionQuotes(nextLine),
        type: 'script',
      });
      idx++;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    // A run of reflection questions is one prompt group, not a series of
    // speech scripts. This also keeps questions beginning with "Am" aligned
    // with neighboring "Do", "Is", and similar questions.
    const isReflectionQuestionGroup = isPromptQuestionLine(line) && (
      isPromptQuestionLine(previousLine) || isPromptQuestionLine(nextLine)
    );
    if (isReflectionQuestionGroup) {
      if (!isPromptQuestionLine(previousLine)) {
        out.push({ label: 'Ask yourself', text: '', type: 'ask' });
      }
      out.push({ text: stripBalancedActionQuotes(line), type: 'question' });
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    const bareSpokenScript = parseBareSpokenScriptLine(line);
    if (bareSpokenScript) {
      out.push(bareSpokenScript);
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    // Bullet items from Format B/D — lines starting with '* ', '- ', or '• '
    if (/^(?:\*|-|•) /.test(line)) {
      out.push({
        text: line.replace(/^(?:\*|-|•) /, '').trim(),
        type: inChecklist ? 'checklistItem' : 'bullet',
      });
      expectingPromptQuestion = false;
      inWriteDownList = false;
      continue;
    }

    if (isChecklistIntroLine(line)) {
      out.push({ label: 'Do this', text: '', type: 'checklist' });
      expectingPromptQuestion = false;
      inChecklist = true;
      inWriteDownList = false;
      continue;
    }

    const writeDownText = getWriteDownActionText(line);
    if (writeDownText) {
      if (!inWriteDownList) {
        out.push({ label: 'Write this down', text: '', type: 'checklist' });
      }
      out.push({ text: writeDownText, type: 'checklistItem' });
      expectingPromptQuestion = false;
      inChecklist = true;
      inWriteDownList = true;
      continue;
    }

    // Intro / label line ending with colon — check BEFORE quote detection
    // so lines like "'Stop' doing this:" are treated as intro, not quote
    if (line.endsWith(':') && line.length < 90) {
      out.push({ text: line, type: 'intro' });
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    // Quoted text — only double-quote chars, NOT single quotes.
    // Single quotes wrap emphasis words (e.g. 'Stop') and must not be treated as quotes.
    if (isQuotedActionLine(line)) {
      out.push({ text: line, type: 'quote' });
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    const hintMatch = line.match(/^(Suggestions|Examples|Possible limits?|Limit examples|Daily supports):\s*(.+)$/i);
    if (hintMatch) {
      const { hintText, trailingText } = splitHintTextFromTrailingInstruction(hintMatch[2]);
      out.push({ label: capitalizeFirstLetter(hintMatch[1].trim()), text: hintText, type: 'hint' });
      if (trailingText) {
        const trailingBodyLines = detectBodyLines(splitReadableActionLine(trailingText), actionType);
        out.push(...trailingBodyLines);
      }
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    const fieldMatch = line.match(/^(Trigger|Lie|Temptation|Replacement response|Replacement|Practice|Stop|Start|Declaration|Use this kind of goal|Avoid outcome pressure):\s*(.+)$/i);
    if (fieldMatch) {
      const label = fieldMatch[1]
        .replace(/\b\w/g, char => char.toUpperCase())
        .replace(/^Replacement(?: Response)?$/i, 'Response');
      out.push({ label, text: fieldMatch[2].trim(), type: 'field' });
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    const checkInLine = isCheckInLabelValueLine(line);
    if (checkInLine) {
      out.push({ label: checkInLine.label, text: checkInLine.text, type: 'check' });
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
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
      out.push({ text: line, type: 'choice' });
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    out.push({ text: line, type: 'body' });
    expectingPromptQuestion = false;
    inChecklist = false;
    inWriteDownList = false;
  }

  return out;
}

function parseExampleFieldLines(example: string): BodyLine[] {
  const rawLines = cleanActionDisplaySegment(example)
    .split('\n')
    .flatMap(line => splitReadableActionLine(line))
    .map(line => line.trim())
    .filter(Boolean);
  const parsed = detectBodyLines(rawLines, 'done_skip').filter(item => item.type === 'field');
  return parsed.length >= 2 ? parsed : [];
}

function cleanWisdomDisplayText(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/__([^_]+)__/g, '$1')
    .trim();
}

function renderResourceListBlock(item: BodyLine, key: string | number): React.ReactElement {
  return (
    <View key={key} style={styles.bodyResourceBlock}>
      {item.text ? (
        <ThemedText style={styles.bodyResourceIntro} selectable={true}>
          {item.text}
        </ThemedText>
      ) : null}
      <View style={styles.bodyResourceHeader}>
        <Ionicons name="library-outline" size={13} color="rgba(255,204,102,0.78)" />
        <ThemedText weight="semiBold" style={styles.bodyResourceLabel}>
          {item.label || 'Resources to consider'}
        </ThemedText>
      </View>
      <View style={styles.bodyResourceList}>
        {(item.items || []).map(resource => (
          <View key={resource} style={styles.bodyResourceItemRow}>
            <View style={styles.bodyResourceItemDot} />
            <ThemedText style={styles.bodyResourceItemText} selectable={true}>
              {resource}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

function renderComparisonColumnsBlock(item: BodyLine, key: string | number): React.ReactElement {
  const allColumns = item.columns || [];
  const isColumnGuide = item.label === 'Column guide' || allColumns.length > 3;
  const columns = isColumnGuide ? allColumns : allColumns.slice(0, 3);
  if (columns.length === 0 || columns.every(column => column.items.length === 0)) {
    return (
      <ThemedText key={key} style={styles.actionBodyLine} selectable={true}>
        {item.text}
      </ThemedText>
    );
  }

  if (isColumnGuide) {
    return (
      <View key={key} style={styles.bodyColumnGuideBlock}>
        <View style={styles.bodyColumnGuideHeader}>
          <Ionicons name="grid-outline" size={13} color="rgba(255,204,102,0.78)" />
          <ThemedText weight="semiBold" style={styles.bodyColumnGuideHeaderText}>
            {item.label || 'Column guide'}
          </ThemedText>
        </View>
        <View style={styles.bodyColumnGuideList}>
          {columns.map((column, itemIndex) => (
            <View key={`${column.title}-${itemIndex}`} style={styles.bodyColumnGuideRow}>
              <View style={styles.bodyColumnGuideTitlePill}>
                <ThemedText
                  weight="semiBold"
                  style={styles.bodyColumnGuideTitleText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {column.title}
                </ThemedText>
              </View>
              <ThemedText style={styles.bodyColumnGuideDescription} selectable={true}>
                {column.items[0]}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View key={key} style={styles.bodyColumnsBlock}>
      {columns.map(column => (
        <View key={column.title} style={styles.bodyColumnCard}>
          <View style={styles.bodyColumnHeader}>
            <ThemedText weight="semiBold" style={styles.bodyColumnHeaderText}>
              {column.title}
            </ThemedText>
          </View>
          <View style={styles.bodyColumnList}>
            {column.items.map((columnItem, itemIndex) => (
              <View key={`${column.title}-${itemIndex}`} style={styles.bodyColumnItemRow}>
                <View style={styles.bodyColumnItemNumber}>
                  <ThemedText weight="semiBold" style={styles.bodyColumnItemNumberText}>
                    {itemIndex + 1}
                  </ThemedText>
                </View>
                <ThemedText style={styles.bodyColumnItemText} selectable={true}>
                  {columnItem}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function renderScriptureReadBlock(item: BodyLine, key: string | number): React.ReactElement {
  return (
    <View key={key} style={styles.bodyScriptureReadBlock}>
      <View style={styles.bodyScriptureReadHeader}>
        <MaterialCommunityIcons name="script-text" size={14} color={Colors.faithGold} />
        <ThemedText weight="semiBold" style={styles.bodyScriptureReadReference}>
          {item.reference}
        </ThemedText>
      </View>
      <View style={styles.bodyScriptureReadQuoteRow}>
        <View style={styles.bodyScriptureReadRail} />
        <ThemedText style={styles.bodyScriptureReadText} selectable={true}>
          {item.text}
        </ThemedText>
      </View>
      {item.summary ? (
        <View style={styles.bodyScriptureReadSummary}>
          <ThemedText weight="semiBold" style={styles.bodyScriptureReadSummaryLabel}>
            Write
          </ThemedText>
          <ThemedText style={styles.bodyScriptureReadSummaryText} selectable={true}>
            {item.summary}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function renderLineMeaningBlock(item: BodyLine, key: string | number): React.ReactElement {
  return (
    <View key={key} style={styles.bodyLineMeaningBlock}>
      <View style={styles.bodyScriptureReadQuoteRow}>
        <View style={styles.bodyScriptureReadRail} />
        <ThemedText style={styles.bodyLineMeaningPhrase} selectable={true}>
          {item.text}
        </ThemedText>
      </View>
      {item.summary ? (
        <View style={styles.bodyLineMeaningSummary}>
          <ThemedText weight="semiBold" style={styles.bodyScriptureReadSummaryLabel}>
            Meaning
          </ThemedText>
          <ThemedText style={styles.bodyScriptureReadSummaryText} selectable={true}>
            {item.summary}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function isWisdomLeadInLine(value: string): boolean {
  return /^(?:here\s+(?:are|is)|these\s+are|some\s+(?:examples|actionable\s+steps)|actionable\s+steps|examples)(?:\s+are|\s+is)?[\w\s,'-]*:?$/i.test(value.trim());
}


function isWisdomOutroLine(value: string): boolean {
  return /^(?:remember|as you|this simple|these steps|by doing|through this|over time|with each|even small|start small|you can|may this|let this|trust that)\b/i.test(value.trim());
}

function splitWisdomItemTitle(value: string): { title: string; body: string } | null {
  const match = value.match(/^([^:]{3,64}):\s+(.+)$/);
  if (!match) {
    return null;
  }

  return {
    title: match[1].trim(),
    body: match[2].trim(),
  };
}

function parseWisdomText(text?: string): { intro: string; items: string[]; blocks: Array<{ intro: string; items: string[]; outro: string }> } {
  if (!text?.trim()) {
    return { intro: '', items: [], blocks: [] };
  }

  if (text.includes('--- siFia wisdom response ---')) {
    const parsedBlocks = text
      .split(/--- siFia wisdom response ---/g)
      .map(block => parseWisdomText(block.trim()).blocks)
      .flat()
      .filter(block => block.intro || block.items.length > 0 || block.outro);
    return {
      intro: parsedBlocks.map(block => block.intro).filter(Boolean).join('\n\n'),
      items: parsedBlocks.flatMap(block => block.items),
      blocks: parsedBlocks,
    };
  }

  const normalizedText = normalizeActionBulletMarkers(normalizeActionMarkup(text));
  const isDeclarationList = /(?:^|\n)\s*(?:here\s+(?:are|is)\s+)?\d+\s+(?:specific\s+)?(?:trust\s+)?declarations?\b/i.test(normalizedText);
  const lines = normalizedText
    .split(/\n+/)
    .map(line => cleanWisdomDisplayText(line))
    .filter(Boolean);
  const listStartIndex = lines.findIndex(line => /^(?:\d+(?:\.\d+)?[.)]|[-*•])\s+/.test(line));

  if (listStartIndex === -1) {
    const intro = cleanWisdomDisplayText(text);
    return { intro, items: [], blocks: intro ? [{ intro, items: [], outro: '' }] : [] };
  }

  const blocks: Array<{ intro: string; items: string[]; outro: string }> = [];
  let currentIntroLines = lines.slice(0, listStartIndex);
  let currentItems: string[] = [];
  let currentOutroLines: string[] = [];
  const items: string[] = [];

  const pushCurrentBlock = () => {
    const intro = currentIntroLines.join('\n\n');
    const outro = currentOutroLines.join('\n\n');
    if (intro || currentItems.length > 0 || outro) {
      blocks.push({ intro, items: currentItems, outro });
    }
    currentIntroLines = [];
    currentItems = [];
    currentOutroLines = [];
  };

  lines.slice(listStartIndex).forEach(line => {
    const isListLine = /^(?:\d+(?:\.\d+)?[.)]|[-*•])\s+/.test(line);

    if (!isListLine) {
      if (currentItems.length > 0) {
        currentOutroLines.push(line);
      } else {
        currentIntroLines.push(line);
      }
      return;
    }

    const item = cleanWisdomDisplayText(line.replace(/^(?:\d+(?:\.\d+)?[.)]|[-*•])\s+/, ''));
    if (!item) {
      return;
    }

    if (isWisdomLeadInLine(item)) {
      if (currentItems.length > 0) {
        currentOutroLines.push(item);
        return;
      }
      currentIntroLines.push(item);
      return;
    }
    if (currentItems.length > 0 && isWisdomOutroLine(item)) {
      currentOutroLines.push(item);
      return;
    }
    const isColumnGuideItem = Boolean(parseColumnHeaderLine(item) || parseColumnDescriptionLine(item));
    const isContinuingColumnGuide = currentItems.some(existing => parseColumnHeaderLine(existing));
    if (!isDeclarationList && currentItems.length >= 3 && !splitWisdomItemTitle(item) && !isColumnGuideItem && !isContinuingColumnGuide) {
      currentOutroLines.push(item);
      return;
    }
    const parsedItem = isDeclarationList ? `Declaration: ${item}` : item;
    currentItems.push(parsedItem);
    items.push(parsedItem);
  });
  pushCurrentBlock();

  return {
    intro: blocks.map(block => block.intro).filter(Boolean).join('\n\n'),
    items,
    blocks,
  };
}

interface FaithfulActionsStepProps {
  steps: ActionStep[];
  intro?: string;
  playbookId?: string;
  playbookTitle?: string;
  playbookStatus?: string;
  truthSummary?: string;
  truthInLove?: string;
  dateOfBirth?: string;
  preferredBibleTranslation?: string;
  isOnboarding?: boolean;
  userId: string;
  onNext: () => void;
  onGoBack?: () => void;
  insets: { top: number; bottom: number };
  actionStepIndex: number;
  setActionStepIndex: (index: number) => void;
  onStepCommit?: (stepIndex: number) => void;
  onJournalExpanded?: (expanded: boolean) => void;
  onJournalCollapseComplete?: () => void;
  navigation?: any;
  collapseAnimRef?: React.RefObject<Animated.Value>;
}

type JournalModalType = 'reflection' | 'prayer' | 'gratitude' | 'timeblock' | null;

type HowToJournalContext = {
  question: string;
  wisdom: string;
  actionTitle: string;
};

// Module-level flag — persists across remounts so the nudge only fires once per session
let journalNudgeFired = false;

// Module-level committed steps — persists across remounts within the same playbook session
let persistedCommittedSteps: Record<number, boolean> = {};
let persistedActionStepIndex = 0;
let persistedPlaybookId: string | undefined;
let persistedHasPrayed = false;
let persistedHasRead = false;
let persistedCompletionChoice: string | null = null;

// ─── AsyncStorage session persistence ───────────────────────────────────────
// Saves module-level vars to AsyncStorage so state survives Metro hot reloads
// and full navigation exits.

const getSessionKey = (id: string) => `playbook_session_${id}`;
const getPositionKey = (id: string) => `playbook_position_${id}`;

const saveCurrentSession = () => {
  if (!persistedPlaybookId) { return; }
  AsyncStorage.setItem(
    getSessionKey(persistedPlaybookId),
    JSON.stringify({
      committedSteps: persistedCommittedSteps,
      actionStepIndex: persistedActionStepIndex,
      hasPrayed: persistedHasPrayed,
      hasRead: persistedHasRead,
      completionChoice: persistedCompletionChoice,
    })
  ).catch(() => {});
};

const clearSessionStorage = (id: string) => {
  AsyncStorage.removeItem(getSessionKey(id)).catch(() => {});
};

const JOURNAL_ICONS: { type: Exclude<JournalModalType, null>; icon: string; color: string; label: string }[] = [
  { type: 'reflection', icon: 'feather', color: Colors.faithGold, label: 'Journal' },
  { type: 'prayer', icon: 'hands-pray', color: '#718476', label: 'Pray' },
  { type: 'gratitude', icon: 'heart', color: Colors.alertCoral, label: 'Gratitude' },
  { type: 'timeblock', icon: 'clock', color: Colors.growthGreen, label: 'Schedule' },
];

type WisdomThreadEntry = {
  question: string;
  wisdom: string;
};

let persistedWisdomThreads: Record<string, WisdomThreadEntry[]> = {};

const serializeWisdomThread = (thread: WisdomThreadEntry[]): string =>
  thread
    .filter(entry => entry.question.trim() && entry.wisdom.trim())
    .map(entry => `User: ${entry.question.trim()}\nsiFia: ${entry.wisdom.trim()}`)
    .join('\n\n');

const parseWisdomThread = (value: string): WisdomThreadEntry[] => {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  const matches = [...trimmed.matchAll(/User:\s*([\s\S]*?)\nsiFia:\s*([\s\S]*?)(?=\n\nUser:|$)/g)];
  if (!matches.length) {
    return [];
  }

  return matches
    .map(match => ({
      question: match[1].trim(),
      wisdom: match[2].trim(),
    }))
    .filter(entry => entry.question && entry.wisdom);
};

const getDisplayWisdomThread = (currentWisdom: string, restoredThread: WisdomThreadEntry[]): WisdomThreadEntry[] => {
  const parsedThread = parseWisdomThread(currentWisdom);
  if (parsedThread.length > 0) {
    return parsedThread;
  }

  if (restoredThread.length > 0) {
    return restoredThread;
  }

  const legacyWisdom = currentWisdom.trim();
  return legacyWisdom
    ? [{ question: '', wisdom: legacyWisdom }]
    : [];
};

const FaithfulActionsStep: React.FC<FaithfulActionsStepProps> = ({
  steps,
  intro,
  playbookId,
  playbookTitle,
  playbookStatus,
  truthSummary,
  truthInLove,
  dateOfBirth,
  preferredBibleTranslation,
  isOnboarding = false,
  userId,
  onNext,
  onGoBack,
  insets,
  actionStepIndex,
  setActionStepIndex,
  onStepCommit,
  onJournalExpanded,
  onJournalCollapseComplete,
  navigation,
  collapseAnimRef,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const [committedSteps, setCommittedSteps] = useState<Record<number, boolean>>(persistedCommittedSteps);
  const [journalText, setJournalText] = useState('');
  const [journalSaved, setJournalSaved] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [activeJournalModal, setActiveJournalModal] = useState<JournalModalType>(null);
  const [howToJournalContext, setHowToJournalContext] = useState<HowToJournalContext | null>(null);
  const [, setJournalExpanded] = useState(false);
  const [howToModalVisible, setHowToModalVisible] = useState(false);
  const [wisdomCount, setWisdomCount] = useState(0);
  const [wisdomLimit, setWisdomLimit] = useState(0);
  const [currentActionWisdom, setCurrentActionWisdom] = useState('');
  const [wisdomThread, setWisdomThread] = useState<WisdomThreadEntry[]>([]);
  const [wisdomExpanded, setWisdomExpanded] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const cardTranslateY = useRef(new Animated.Value(0)).current;
  const triggerRotation = useRef(new Animated.Value(0)).current;
  const triggerScale = useRef(new Animated.Value(1)).current;
  const iconAnims = useRef(JOURNAL_ICONS.map(() => new Animated.Value(0))).current;
  const rowHeight = useRef(new Animated.Value(0)).current;
  const rowOpacity = useRef(new Animated.Value(0)).current;
  const howToButtonAnim = useRef(new Animated.Value(0)).current;
  const wisdomChevronAnim = useRef(new Animated.Value(0)).current;
  // Ref tracks real expanded state to avoid stale closure in toggle
  const journalExpandedRef = useRef(false);
  // Tracks if journal icons were manually expanded by user (to prevent auto-collapse)
  const manuallyExpandedRef = useRef(false);
  // Tracks when journal icons were last manually toggled (to prevent scroll handler from immediately collapsing)
  const lastManualToggleRef = useRef(0);
  // Tracks if we're in the middle of a programmatic scroll (to prevent scroll handler from reacting)
  const isProgrammaticScrollRef = useRef(false);
  // Tracks all timers spawned by the auto-nudge so they can be cancelled on unmount
  const nudgeTimerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const collapseAnimFallback = useRef(new Animated.Value(0)).current;
  const collapseAnim = collapseAnimRef?.current || collapseAnimFallback;
  const lastScrollYRef = useRef(0);
  const fabBarHiddenRef = useRef(false);
  const scrollViewRef = useRef<any>(null);
  const [fabCollapsed, setFabCollapsed] = React.useState(false);

  const ICON_ROW_HEIGHT = 76; // circle 44 + label ~14 + gap 5 + padding 12

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const loadWisdomUsage = React.useCallback(() => {
    if (user?.id) {
      NewSubscriptionService.getUserSubscription(user.id).then(subscription => {
        const limits = NewSubscriptionService.getTierLimits(subscription.tier, subscription);
        setWisdomCount((subscription as any).wisdom_count || 0);
        setWisdomLimit(isOnboarding ? 1 : limits.wisdom_limit ?? 0);
      });
    }
  }, [isOnboarding, user?.id]);

  // Load wisdom counts
  React.useEffect(() => {
    loadWisdomUsage();
  }, [loadWisdomUsage]);

  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('wisdomUsageReset', (payload?: { wisdomCount?: number; wisdomLimit?: number }) => {
      setWisdomCount(payload?.wisdomCount ?? 0);
      if (typeof payload?.wisdomLimit === 'number') {
        setWisdomLimit(payload.wisdomLimit);
      } else {
        loadWisdomUsage();
      }
    });

    return () => subscription.remove();
  }, [loadWisdomUsage]);

  // Animate How to button appearance with 2 second delay
  React.useEffect(() => {
    // Reset animation to 0 when step changes
    howToButtonAnim.setValue(0);

    const timer = setTimeout(() => {
      Animated.spring(howToButtonAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }, 2000);

    return () => clearTimeout(timer);
  }, [actionStepIndex, howToButtonAnim]);

  const rotateInterpolate = triggerRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const toggleJournalIcons = useCallback(() => {
    // Use ref so we always read the real current value, not a stale closure
    const expanding = !journalExpandedRef.current;
    journalExpandedRef.current = expanding;
    manuallyExpandedRef.current = expanding; // Track if this was a manual expansion
    lastManualToggleRef.current = Date.now(); // Track when this was manually toggled
    setJournalExpanded(expanding);
    onJournalExpanded?.(expanding);
    triggerLightHaptic();

    Animated.parallel([
      Animated.timing(triggerRotation, {
        toValue: expanding ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(triggerScale, {
        toValue: expanding ? 1.15 : 1,
        useNativeDriver: true,
        tension: 200,
        friction: 7,
      }),
    ]).start();

    if (expanding) {
      isProgrammaticScrollRef.current = true;
      scrollViewRef.current?.scrollToEnd({ animated: true });
      setTimeout(() => { isProgrammaticScrollRef.current = false; }, 500);
      Animated.parallel([
        Animated.timing(rowHeight, { toValue: ICON_ROW_HEIGHT, duration: 260, useNativeDriver: false }),
        Animated.timing(rowOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
      ]).start(() => {
        Animated.stagger(50, iconAnims.map(anim =>
          Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 180, friction: 10 })
        )).start();
      });
    } else {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, lastScrollYRef.current - 82), animated: true });
      Animated.stagger(35, [...iconAnims].reverse().map(anim =>
        Animated.spring(anim, { toValue: 0, useNativeDriver: true, tension: 200, friction: 12 })
      )).start(() => {
        Animated.parallel([
          Animated.timing(rowHeight, { toValue: 0, duration: 220, useNativeDriver: false }),
          Animated.timing(rowOpacity, { toValue: 0, duration: 180, useNativeDriver: false }),
        ]).start(() => {
          // Notify parent that collapse is complete
          onJournalCollapseComplete?.();
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onJournalExpanded, onJournalCollapseComplete]);

  const createJournalEntry = useCreateJournalEntry();

  const currentStep = steps[actionStepIndex];

  React.useEffect(() => {
    const storedWisdom = currentStep?.wisdom_text || '';
    const parsedThread = parseWisdomThread(storedWisdom);
    const restoredThread = currentStep?.id
      ? persistedWisdomThreads[currentStep.id] || parsedThread
      : parsedThread;

    setCurrentActionWisdom(storedWisdom);
    setWisdomThread(restoredThread);
    setWisdomExpanded(false);
  }, [currentStep?.id, currentStep?.wisdom_text]);

  // Animate wisdom chevron rotation when expanded/collapsed
  React.useEffect(() => {
    Animated.timing(wisdomChevronAnim, {
      toValue: wisdomExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [wisdomExpanded, wisdomChevronAnim]);

  const wisdomChevronRotate = wisdomChevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const isLastStep = actionStepIndex >= steps.length - 1;

  useEffect(() => {
    if (activeJournalModal !== 'prayer') {
      return;
    }

    const rawDescription = currentStep.description ?? currentStep.subTasks?.map(s => s.text).join('\n') ?? '';
    const actionDescription = splitActionDescription(rawDescription);
    const stepBody = actionDescription.body || undefined;
    const stepExample = actionDescription.example;

    const metadata = {
      playbookId,
      playbookTitle,
      playbookStatus,
      actionStepNumber: actionStepIndex + 1,
      actionStepTitle: currentStep.title,
      subtaskTitle: currentStep.title,
      subtaskId: currentStep.id,
      selectedDate: toLocalDateString(new Date()),
      stepBody,
      stepExample,
    };

    setActiveJournalModal(null);
    (navigation as any).navigate('UnifiedPrayerSelection', { metadata, fromPlaybook: true });
  }, [activeJournalModal, actionStepIndex, currentStep, navigation, playbookId, playbookTitle, playbookStatus]);

  // Reset journal + choice state when step changes
  useEffect(() => {
    setJournalText('');
    setJournalSaved(false);
    setSelectedChoice(null);
  }, [actionStepIndex, ICON_ROW_HEIGHT, iconAnims, rowHeight, rowOpacity, triggerRotation, triggerScale]);

  // Reset FAB bar visibility when action step changes; animate expand on mount if not provided by parent
  useEffect(() => {
    fabBarHiddenRef.current = false;
    lastScrollYRef.current = 0;
    setFabCollapsed(false);
    if (!collapseAnimRef) {
      collapseAnim.setValue(1);
      Animated.spring(collapseAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 13 }).start();
    }
  }, [actionStepIndex, collapseAnim, collapseAnimRef]);

  // Auto-nudge: expand journal icons on first step, then collapse — one time only per session.
  // ALL inner timers are tracked in nudgeTimerRefs so they can be cancelled on unmount or
  // if the user interacts before the nudge completes (preventing stale state updates).
  useEffect(() => {
    if (actionStepIndex !== 0 || journalNudgeFired) {return;}
    journalNudgeFired = true;

    const t1 = setTimeout(() => {
      // Expand (auto-nudge, so mark as not manual)
      journalExpandedRef.current = true;
      manuallyExpandedRef.current = false; // Auto-nudge expansion, not manual
      setJournalExpanded(true);
      scrollViewRef.current?.scrollTo({ y: lastScrollYRef.current + 82, animated: true });
      Animated.parallel([
        Animated.timing(rowHeight, { toValue: ICON_ROW_HEIGHT, duration: 260, useNativeDriver: false }),
        Animated.timing(rowOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(triggerRotation, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(triggerScale, { toValue: 1.15, useNativeDriver: true, tension: 200, friction: 7 }),
      ]).start(() => {
        Animated.stagger(50, iconAnims.map(anim =>
          Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 180, friction: 10 })
        )).start(() => {
          // Hold 1.4s then auto-collapse
          const t2 = setTimeout(() => {
            nudgeTimerRefs.current = nudgeTimerRefs.current.filter(id => id !== t2);
            // Only auto-collapse if the user hasn't manually interacted
            if (!journalExpandedRef.current) { return; } // user already closed it
            journalExpandedRef.current = false;
            setJournalExpanded(false);
            Animated.parallel([
              Animated.timing(triggerRotation, { toValue: 0, duration: 220, useNativeDriver: true }),
              Animated.spring(triggerScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 7 }),
            ]).start();
            Animated.stagger(35, [...iconAnims].reverse().map(anim =>
              Animated.spring(anim, { toValue: 0, useNativeDriver: true, tension: 200, friction: 12 })
            )).start(() => {
              Animated.parallel([
                Animated.timing(rowHeight, { toValue: 0, duration: 220, useNativeDriver: false }),
                Animated.timing(rowOpacity, { toValue: 0, duration: 180, useNativeDriver: false }),
              ]).start();
            });
          }, 1400);
          nudgeTimerRefs.current.push(t2);
        });
      });
    }, 900);
    nudgeTimerRefs.current.push(t1);

    return () => {
      nudgeTimerRefs.current.forEach(id => clearTimeout(id));
      nudgeTimerRefs.current = [];
    };
  }, [actionStepIndex, ICON_ROW_HEIGHT, iconAnims, rowHeight, rowOpacity, triggerRotation, triggerScale]);

  const animateToNext = useCallback(
    (callback: () => void) => {
      // Exit: fade + slide up
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(cardTranslateY, { toValue: -14, duration: 160, useNativeDriver: true }),
      ]).start(() => {
        callback();
        // Enter from below with spring bounce
        cardTranslateY.setValue(22);
        Animated.parallel([
          Animated.spring(fadeAnim, { toValue: 1, tension: 75, friction: 8, useNativeDriver: true }),
          Animated.spring(cardTranslateY, { toValue: 0, tension: 75, friction: 8, useNativeDriver: true }),
        ]).start();
      });
    },
    [fadeAnim, cardTranslateY]
  );

  const commitCurrentStep = useCallback(() => {
    if (persistedCommittedSteps[actionStepIndex]) {
      return;
    }

    persistedCommittedSteps = { ...persistedCommittedSteps, [actionStepIndex]: true };
    setCommittedSteps({ ...persistedCommittedSteps });
    saveCurrentSession();
    onStepCommit?.(actionStepIndex);
  }, [actionStepIndex, onStepCommit]);

  const advanceStep = useCallback(
    (markDone: boolean) => {
      if (markDone) {
        commitCurrentStep();
        triggerMediumHaptic();
      } else {
        triggerLightHaptic();
      }

      if (isLastStep) {
        onNext();
        return;
      }

      animateToNext(() => {
        const next = actionStepIndex + 1;
        persistedActionStepIndex = next;
        setActionStepIndex(next);
        saveCurrentSession();
      });
    },
    [isLastStep, onNext, animateToNext, actionStepIndex, setActionStepIndex, commitCurrentStep]
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('playbookPrayerSaved', (payload: {
      playbookId?: string;
      actionStepNumber?: number;
      isEditing?: boolean;
    }) => {
      if (payload.playbookId && payload.playbookId !== playbookId) {
        return;
      }

      const completedIndex = payload.actionStepNumber !== undefined && payload.actionStepNumber > 0
        ? payload.actionStepNumber - 1
        : actionStepIndex;

      if (completedIndex === actionStepIndex) {
        commitCurrentStep();
      } else {
        persistedCommittedSteps = { ...persistedCommittedSteps, [completedIndex]: true };
        setCommittedSteps({ ...persistedCommittedSteps });
        saveCurrentSession();
        onStepCommit?.(completedIndex);
      }

      setActiveJournalModal(null);
      // Advance directly — no extra success modal needed (prayer screen already
      // showed its own confirmation before dismissing back here).
      setTimeout(() => advanceStep(true), 420);
    });

    return () => {
      subscription.remove();
    };
  }, [actionStepIndex, commitCurrentStep, onStepCommit, playbookId, advanceStep]);

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

  const handleActionScroll = useCallback((event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const isScrollingUp = currentY < lastScrollYRef.current;
    lastScrollYRef.current = currentY;
    // Skip scroll handling during programmatic scrolls (e.g., scrollToEnd when expanding journal icons)
    if (isProgrammaticScrollRef.current) {
      return;
    }
    if (currentY > 60 && !fabBarHiddenRef.current) {
      // Don't collapse FAB bar if journal icons are manually expanded
      if (journalExpandedRef.current && manuallyExpandedRef.current) {
        return;
      }
      fabBarHiddenRef.current = true;
      setFabCollapsed(true);
      Animated.spring(collapseAnim, { toValue: 1, useNativeDriver: true, tension: 55, friction: 14 }).start();
      // Auto-collapse journal icons on scroll, but only if they were NOT manually expanded by user
      if (journalExpandedRef.current && !manuallyExpandedRef.current && Date.now() - lastManualToggleRef.current > 2000) {
        toggleJournalIcons();
      }
    } else if (isScrollingUp && currentY <= 0 && fabBarHiddenRef.current) {
      fabBarHiddenRef.current = false;
      setFabCollapsed(false);
      Animated.spring(collapseAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 13 }).start();
    }
  }, [collapseAnim, toggleJournalIcons]);

  if (!currentStep) {
    return (
      <View style={[styles.stepScroll, styles.stepContent, IS_IPAD && styles.stepContentPad]}>
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

  // Strip bold/italic markdown markers only — bullet '* ' lines are handled separately below
  const stripMd = (s: string) => s.replace(/\*\*|__|\*/g, '').trim();

  // Split body into main text and example (split on "Example:" marker)
  const rawDescription = normalizeFaithfulActionDisplayText(
    currentStep.description ?? currentStep.subTasks?.map(s => s.text).join('\n') ?? ''
  );
  const actionDescription = splitActionDescription(rawDescription);
  const rawMainBody = actionDescription.body;
  const fallbackExample = getPrimaryActionExample((currentStep as any).examples, currentStep.subTasks);
  const resolvedExample = actionDescription.example || fallbackExample;
  const exampleText = resolvedExample ? capitalizeFirstLetter(normalizeActionExampleDisplayText(resolvedExample)) : null;
  const exampleFieldLines = exampleText ? parseExampleFieldLines(exampleText) : [];

  // Process lines individually — preserve '* ' bullet markers, strip inline markers from the rest
  const normalizedMainBody = unwrapQuotedMultilineActionScript(rawMainBody);
  const rawBodyLines: string[] = normalizedMainBody
    .split('\n')
    .flatMap(l => {
      const trimmed = l.trim();
      if (!trimmed) { return []; }
      // Bullet lines: preserve the marker so detectBodyLines can identify them
      if (/^(?:\*|-|•) /.test(trimmed)) {
        return [trimmed.replace(/^(?:-|•) /, '* ').replace(/\*\*/g, '').replace(/__/g, '')];
      }
      return unwrapQuotedMultilineActionScript(stripMd(trimmed))
        .split('\n')
        .flatMap(line => splitReadableActionLine(line.trim()))
        .filter(Boolean);
    })
    .filter(Boolean);

  // Full plain text for prayer saving and body-start detection (strips bullet markers)
  const mainBodyText = rawBodyLines.map(l => l.replace(/^(?:\*|-|•) /, '')).join(' ');
  const actionGuidanceBody = [
    mainBodyText,
    exampleText ? `Example: ${exampleText}` : '',
  ].filter(Boolean).join('\n\n');
  const reflectionJournalTitle = howToJournalContext
    ? `How To: ${howToJournalContext.actionTitle || currentStep.title || ''}`.trim()
    : currentStep.title ?? '';
  const reflectionJournalBody = howToJournalContext
    ? [
        howToJournalContext.question ? `Question:\n${howToJournalContext.question.trim()}` : '',
        howToJournalContext.wisdom ? `Wisdom:\n${howToJournalContext.wisdom.trim()}` : '',
      ].filter(Boolean).join('\n\n')
    : mainBodyText;
  const reflectionJournalExample = howToJournalContext ? undefined : exampleText || undefined;

  const smartBodyLines = detectBodyLines(rawBodyLines, actionType);
  const hasActionWisdom = Boolean(currentActionWisdom || wisdomThread.length > 0);
  const displayWisdomThread = getDisplayWisdomThread(currentActionWisdom, wisdomThread);
  const wisdomContext = wisdomThread.length > 0
    ? wisdomThread.map(entry => `User: ${entry.question}\nsiFia: ${entry.wisdom}`).join('\n\n')
    : currentActionWisdom;

  const generatedPrimaryLabel = currentStep.primaryButton ?? (
    actionType === 'choose' ? "I've chosen" :
    actionType === 'text_input' ? 'Save to Journal' :
    'Done'
  );
  const primaryLabel = /^I did (?:these actions?|it all)$/i.test(generatedPrimaryLabel.trim())
    ? /\b(?:share|tell|message)\b/i.test(currentStep.title || '') ? 'I shared it' : 'I did it'
    : generatedPrimaryLabel;

  const isCommitted = !!committedSteps[actionStepIndex];

  const secondaryLabel = isCommitted ? 'Next' : 'Not yet';

  // Detect special step types — check label, title, AND body content so old playbooks
  // without AI-generated primary_button still work correctly
  const stepTitle = (currentStep.title || '').toLowerCase();
  const isReadAloudStep =
    /aloud|read.*aloud/i.test(primaryLabel) ||
    /\b(speak|declare|say.*aloud|read.*aloud)\b/.test(stepTitle);

  const handlePrimaryPress = async () => {
    const nowCommitted = !isCommitted;
    persistedCommittedSteps = { ...persistedCommittedSteps, [actionStepIndex]: nowCommitted };
    setCommittedSteps({ ...persistedCommittedSteps });
    saveCurrentSession();
    triggerMediumHaptic();

    if (nowCommitted) {
      // Persist action step completion to DB so the list card reflects the count
      onStepCommit?.(actionStepIndex);

      // Read aloud step → award affirmation faith points
      if (isReadAloudStep) {
        try {
          await faithPointsService.awardPoints(userId, 'affirmation_read_aloud', {
            playbookId,
            playbookTitle,
            source: 'playbook_walkthrough',
          });

          // Check if streak celebration should show for affirmation read aloud
          // Only show streak if playbook is completed
          if (playbookStatus === 'completed') {
            const shouldShowStreak = await visibleStreakService.shouldShowCelebration(userId, 'affirmation_read_aloud');
            if (shouldShowStreak) {
              (navigation as any).navigate('StreakPlan', {
                userId,
                source: 'affirmation_read_aloud',
              });
            }
          }
        } catch (_) {}
      }

      // Brief pause so the committed (orange) state is visible, then advance
      setTimeout(() => advanceStep(true), 420);
    }
  };

  const FAB_PILL_WIDTH = SCREEN_WIDTH - 32;
  const FAB_CIRCLE_RATIO = 56 / FAB_PILL_WIDTH;
  const fabContentOpacity = collapseAnim.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0], extrapolate: 'clamp' });
  const fabShapeOpacity = collapseAnim.interpolate({ inputRange: [0, 0.7], outputRange: [1, 0], extrapolate: 'clamp' });
  const fabCircleOpacity = collapseAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const fabShapeScaleX = collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, FAB_CIRCLE_RATIO], extrapolate: 'clamp' });
  const fabShapeTranslateX = collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -(FAB_PILL_WIDTH / 2) * (1 - FAB_CIRCLE_RATIO)], extrapolate: 'clamp' });

  return (
    <>
    <ScrollView
      ref={scrollViewRef}
      style={styles.stepScroll}
      onScroll={handleActionScroll}
      scrollEventThrottle={16}
      contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 180 }]}
      scrollEnabled={true}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={false}
    >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <FontAwesome6 name="list-check" size={16} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            {steps.length} Faithful Actions
          </ThemedText>
        </StepFadeIn>

        {/* Intro framing line (shown only on first step) */}
        {intro && actionStepIndex === 0 && (
          <StepFadeIn delay={60}>
            {Platform.OS === 'ios' ? (
              <TextInput
                value={intro}
                editable={false}
                multiline={true}
                scrollEnabled={false}
                style={[styles.actionIntro, { fontFamily }]}
              />
            ) : (
              <ThemedText style={styles.actionIntro} selectable={true}>{intro}</ThemedText>
            )}
          </StepFadeIn>
        )}

        <StepFadeIn delay={80}>
          {Platform.OS === 'ios' ? (
            <TextInput
              value={`${Object.values(committedSteps).filter(v => v).length} of ${totalSteps} completed`}
              editable={false}
              multiline={true}
              scrollEnabled={false}
              style={[styles.actionCounter, { fontFamily }]}
            />
          ) : (
            <ThemedText style={styles.actionCounter} selectable={true}>
              {Object.values(committedSteps).filter(v => v).length} of {totalSteps} completed
            </ThemedText>
          )}
        </StepFadeIn>

        <StepFadeIn delay={100}>
          <View style={styles.actionProgressBar}>
            <View style={[
              styles.actionProgressFill,
              { width: `${(Object.values(committedSteps).filter(v => v).length / totalSteps) * 100}%` },
            ]} />
          </View>
        </StepFadeIn>

        <StepFadeIn delay={130}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: cardTranslateY }] }}>
          <View style={styles.actionStepCard}>
            <Animated.View
              style={[
                styles.actionHowToButton,
                {
                  opacity: howToButtonAnim,
                  transform: [{ scale: howToButtonAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  triggerLightHaptic();
                  setHowToModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.actionHowToButtonContent}>
                  <Ionicons name="help-circle-outline" size={14} color={Colors.hopeWhite} />
                  <ThemedText style={styles.actionHowToButtonText}>How to</ThemedText>
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* Step number circle — matches ActionStepsCard design */}
            <View style={styles.stepNumberContainer}>
              <View style={styles.stepCircle}>
                <ThemedText weight="bold" style={styles.stepNumber}>
                  {stepNumber}
                </ThemedText>
              </View>
            </View>

            {/* Step title */}
            <View style={styles.actionTitleContainer}>
              {Platform.OS === 'ios' ? (
                <TextInput
                  value={normalizeFaithfulActionDisplayText(stripMd(currentStep.title))}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={[styles.actionTitle, { fontWeight: '600' as any, fontFamily }]}
                />
              ) : (
                <ThemedText weight="semiBold" style={styles.actionTitle} selectable={true}>
                  {normalizeFaithfulActionDisplayText(stripMd(currentStep.title))}
                </ThemedText>
              )}
            </View>

            {/* Smart body lines */}
            {smartBodyLines.map((item, idx) => {
              if (item.type === 'script') {
                return (
                  <View key={idx} style={[styles.bodyScriptBlock, styles.bodyScriptBlockMessage]}>
                    <ScriptRail />
                    <View style={styles.bodyScriptHeader}>
                      <Ionicons
                        name={scriptIconNameForBodyLine(item)}
                        size={13}
                        color={Colors.faithGold}
                      />
                      <ThemedText weight="semiBold" style={styles.bodyScriptLabel}>
                        {item.label || 'Words to say'}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.bodyScriptText, styles.bodyScriptTextMessage]} selectable={true}>
                      {item.text}
                    </ThemedText>
                  </View>
                );
              }
              if (item.type === 'ask') {
                return (
                  <View key={idx} style={styles.bodyAskHeader}>
                    <Ionicons name="help-circle-outline" size={14} color="rgba(255,204,102,0.78)" />
                    <ThemedText weight="semiBold" style={styles.bodyAskLabel}>
                      {item.label || 'Ask yourself'}
                    </ThemedText>
                  </View>
                );
              }
              if (item.type === 'question') {
                if (smartBodyLines[idx - 1]?.type === 'question') {
                  return null;
                }
                const questions: BodyLine[] = [];
                for (let questionIndex = idx; questionIndex < smartBodyLines.length; questionIndex++) {
                  const question = smartBodyLines[questionIndex];
                  if (question.type !== 'question') { break; }
                  questions.push(question);
                }
                return (
                  <View key={idx} style={styles.actionQuestionGroup}>
                    {questions.map((question, questionIndex) => (
                      <View
                        key={`${question.text}-${questionIndex}`}
                        style={[
                          styles.actionQuestionRow,
                          questionIndex > 0 && styles.actionQuestionDivider,
                        ]}
                      >
                        <View style={styles.actionQuestionNumber}>
                          <ThemedText weight="semiBold" style={styles.actionQuestionNumberText}>
                            {questionIndex + 1}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.actionQuestionText} selectable={true}>
                          {question.text}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                );
              }
              if (item.type === 'checklist') {
                return (
                  <View key={idx} style={styles.bodyChecklistHeader}>
                    <FontAwesome6 name="list-check" size={13} color="rgba(255,204,102,0.78)" />
                    <ThemedText weight="semiBold" style={styles.bodyChecklistLabel}>
                      {item.label || 'Do this'}
                    </ThemedText>
                  </View>
                );
              }
              if (item.type === 'quote') {
                return (
                  <View key={idx} style={styles.bodyQuoteBubble}>
                    {Platform.OS === 'ios' ? (
                      <TextInput
                        value={stripBalancedActionQuotes(item.text)}
                        editable={false}
                        multiline={true}
                        scrollEnabled={false}
                        style={[styles.bodyQuoteBubbleText, { fontFamily }]}
                      />
                    ) : (
                      <ThemedText style={styles.bodyQuoteBubbleText} selectable={true}>
                        {stripBalancedActionQuotes(item.text)}
                      </ThemedText>
                    )}
                  </View>
                );
              }
              if (item.type === 'intro') {
                return Platform.OS === 'ios' ? (
                  <TextInput
                    key={idx}
                    value={item.text}
                    editable={false}
                    multiline={true}
                    scrollEnabled={false}
                    style={[styles.bodyLineIntro, { fontFamily }]}
                  />
                ) : (
                  <ThemedText key={idx} style={styles.bodyLineIntro} selectable={true}>
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
                    {Platform.OS === 'ios' ? (
                      <TextInput
                        value={item.text}
                        editable={false}
                        multiline={true}
                        scrollEnabled={false}
                        style={[styles.choicePillText, isSelected && styles.choicePillTextSelected, isSelected && { fontWeight: '600' as any }, { fontFamily }]}
                      />
                    ) : (
                      <ThemedText
                        weight={isSelected ? 'semiBold' : undefined}
                        style={[styles.choicePillText, isSelected && styles.choicePillTextSelected]}
                        selectable={true}
                      >
                        {item.text}
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                );
              }
              if (item.type === 'checklistItem') {
                const bulletHint = extractParentheticalActionHint(item.text);
                return (
                  <View key={idx} style={styles.bodyChecklistItemRow}>
                    <View style={styles.bodyChecklistItemIcon}>
                      <Ionicons name="checkmark" size={12} color={Colors.faithGold} />
                    </View>
                    <View style={styles.bodyChecklistItemContent}>
                      <ThemedText style={styles.bodyChecklistItemText} selectable={true}>
                        {bulletHint?.main || item.text}
                      </ThemedText>
                      {bulletHint && (
                        <View style={styles.bodyInlineHintBlock}>
                          <View style={styles.bodyHintHeader}>
                            <Ionicons
                              name={/limit/i.test(bulletHint.label) ? 'options-outline' : 'sparkles-outline'}
                              size={13}
                              color="rgba(255,204,102,0.72)"
                            />
                            <ThemedText weight="semiBold" style={styles.bodyHintLabel}>
                              {bulletHint.label}
                            </ThemedText>
                          </View>
                          <View style={styles.bodyLineBulletHintRow}>
                            {bulletHint.hints.map(hint => (
                              <View key={hint} style={styles.bodyLineBulletHintChip}>
                                <ThemedText style={styles.bodyLineBulletHintText}>
                                  {hint}
                                </ThemedText>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                );
              }
              if (item.type === 'bullet') {
                const bulletHint = extractParentheticalActionHint(item.text);
                return (
                  <View key={idx} style={styles.bodyLineBulletRow}>
                    <View style={styles.bodyLineBulletDot} />
                    <View style={styles.bodyLineBulletContent}>
                      {Platform.OS === 'ios' && !bulletHint ? (
                        <TextInput
                          value={item.text}
                          editable={false}
                          multiline={true}
                          scrollEnabled={false}
                          style={[styles.bodyLineBullet, { fontFamily }]}
                        />
                      ) : (
                        <ThemedText style={styles.bodyLineBullet} selectable={true}>
                          {bulletHint?.main || item.text}
                        </ThemedText>
                      )}
                      {bulletHint && (
                        <View style={styles.bodyInlineHintBlock}>
                          <View style={styles.bodyHintHeader}>
                            <Ionicons
                              name={/limit/i.test(bulletHint.label) ? 'options-outline' : 'sparkles-outline'}
                              size={13}
                              color="rgba(255,204,102,0.72)"
                            />
                            <ThemedText weight="semiBold" style={styles.bodyHintLabel}>
                              {bulletHint.label}
                            </ThemedText>
                          </View>
                          <View style={styles.bodyLineBulletHintRow}>
                            {bulletHint.hints.map(hint => (
                              <View key={hint} style={styles.bodyLineBulletHintChip}>
                                <ThemedText style={styles.bodyLineBulletHintText}>
                                  {hint}
                                </ThemedText>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                );
              }
              if (item.type === 'schedule') {
                return (
                  <View key={idx} style={styles.bodyScheduleRow}>
                    <View style={styles.bodyScheduleIcon}>
                      <Ionicons name="time-outline" size={13} color="rgba(255,204,102,0.78)" />
                    </View>
                    <View style={styles.bodyScheduleContent}>
                      <ThemedText weight="semiBold" style={styles.bodyScheduleLabel}>
                        {item.label}
                      </ThemedText>
                      <ThemedText style={styles.bodyScheduleValue} selectable={true}>
                        {item.text}
                      </ThemedText>
                    </View>
                  </View>
                );
              }
              if (item.type === 'check') {
                const isYesNo = /^yes\s*\/\s*no$/i.test(item.text);
                return (
                  <View key={idx} style={styles.bodyCheckRow}>
                    <ThemedText weight="semiBold" style={styles.bodyCheckLabel}>
                      {item.label}
                    </ThemedText>
                    {isYesNo ? (
                      <View style={styles.bodyCheckValuePill}>
                        <ThemedText weight="semiBold" style={styles.bodyCheckValuePillText}>
                          Yes / No
                        </ThemedText>
                      </View>
                    ) : (
                      <ThemedText style={styles.bodyCheckValue} selectable={true}>
                        {item.text}
                      </ThemedText>
                    )}
                  </View>
                );
              }
              if (item.type === 'resourceList') {
                return renderResourceListBlock(item, idx);
              }
              if (item.type === 'columns') {
                return renderComparisonColumnsBlock(item, idx);
              }
              if (item.type === 'scriptureRead') {
                return renderScriptureReadBlock(item, idx);
              }
              if (item.type === 'lineMeaning') {
                return renderLineMeaningBlock(item, idx);
              }
              if (item.type === 'hint') {
                const hintItems = splitHintDisplayItems(item.text);
                const showHintChips = hintItems.length > 1 &&
                  hintItems.every(part => part.length <= 72) &&
                  !hintItems.some(part => /:\s*/.test(part));
                return (
                  <View key={idx} style={styles.bodyHintRow}>
                    <View style={styles.bodyHintHeader}>
                      <Ionicons
                        name={/limit/i.test(item.label || '') ? 'options-outline' : /daily|support/i.test(item.label || '') ? 'calendar-outline' : 'sparkles-outline'}
                        size={13}
                        color="rgba(255,204,102,0.72)"
                      />
                      <ThemedText weight="semiBold" style={styles.bodyHintLabel}>
                        {displayHintLabel(item.label, hintItems.length)}
                      </ThemedText>
                    </View>
                    {showHintChips ? (
                      <View style={styles.bodyHintChipRow}>
                        {hintItems.map(part => (
                          <View key={part} style={styles.bodyHintChip}>
                            <ThemedText style={styles.bodyHintChipText}>
                              {part}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <ThemedText style={styles.bodyHintText} selectable={true}>
                        {item.text}
                      </ThemedText>
                    )}
                  </View>
                );
              }
              if (item.type === 'field') {
                return (
                  <View key={idx} style={styles.bodyFieldRow}>
                    <View style={styles.bodyFieldRail} />
                    <View style={styles.bodyFieldLabel}>
                      <ThemedText weight="semiBold" style={styles.bodyFieldLabelText}>
                        {item.label}
                      </ThemedText>
                    </View>
                    {Platform.OS === 'ios' ? (
                      <TextInput
                        value={item.text}
                        editable={false}
                        multiline={true}
                        scrollEnabled={false}
                        style={[styles.bodyFieldValue, { fontFamily }]}
                      />
                    ) : (
                      <ThemedText style={styles.bodyFieldValue} selectable={true}>
                        {item.text}
                      </ThemedText>
                    )}
                  </View>
                );
              }
              return Platform.OS === 'ios' ? (
                <TextInput
                  key={idx}
                  value={item.text}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={[styles.actionBodyLine, { fontFamily }]}
                />
              ) : (
                <ThemedText key={idx} style={styles.actionBodyLine} selectable={true}>
                  {item.text}
                </ThemedText>
              );
            })}

            {/* Example block — matches ActionStepsCard original design */}
            {exampleText && (
              <StepFadeIn key={`example-${actionStepIndex}`} delay={300}>
                <View style={styles.exampleContainer}>
                  <View style={styles.exampleRail} />
                  <View style={styles.exampleHeader}>
                    <MaterialCommunityIcons name="lightbulb-outline" size={14} color="rgba(255,255,255,0.6)" />
                    <ThemedText weight="semiBold" style={styles.exampleHeaderText}>Example</ThemedText>
                  </View>
                  {Platform.OS === 'ios' ? (
                    exampleFieldLines.length > 0 ? (
                      <View style={styles.exampleLoopList}>
                        {exampleFieldLines.map((line, idx) => (
                          <View key={`${line.label}-${idx}`} style={styles.exampleLoopRow}>
                            <View style={styles.exampleLoopLabelPill}>
                              <ThemedText weight="semiBold" style={styles.exampleLoopLabelText}>
                                {line.label}
                              </ThemedText>
                            </View>
                            <ThemedText style={styles.exampleLoopValue} selectable={true}>
                              {line.text}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <TextInput
                        value={exampleText}
                        editable={false}
                        multiline={true}
                        scrollEnabled={false}
                        style={[styles.exampleText, { fontFamily }]}
                      />
                    )
                  ) : (
                    exampleFieldLines.length > 0 ? (
                      <View style={styles.exampleLoopList}>
                        {exampleFieldLines.map((line, idx) => (
                          <View key={`${line.label}-${idx}`} style={styles.exampleLoopRow}>
                            <View style={styles.exampleLoopLabelPill}>
                              <ThemedText weight="semiBold" style={styles.exampleLoopLabelText}>
                                {line.label}
                              </ThemedText>
                            </View>
                            <ThemedText style={styles.exampleLoopValue} selectable={true}>
                              {line.text}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <ThemedText style={styles.exampleText} selectable={true}>{exampleText}</ThemedText>
                    )
                  )}
                </View>
              </StepFadeIn>
            )}

            {hasActionWisdom ? (
              <StepFadeIn key={`wisdom-${currentStep.id}`} delay={160}>
                <View style={styles.actionWisdomContainer}>
                  <TouchableOpacity
                    style={styles.actionWisdomHeader}
                    activeOpacity={0.75}
                    onPress={() => {
                      triggerLightHaptic();
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setWisdomExpanded(prev => !prev);
                    }}
                  >
                    <View style={styles.actionWisdomHeaderTitle}>
                      <ThemedText weight="semiBold" style={styles.actionWisdomLabel}>
                        Wisdom thread
                      </ThemedText>
                      {displayWisdomThread.length > 0 ? (
                        <ThemedText style={styles.actionWisdomCount}>
                          {displayWisdomThread.length}
                        </ThemedText>
                      ) : null}
                    </View>
                    <Animated.View style={{ transform: [{ rotate: wisdomChevronRotate }] }}>
                      <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.6)" />
                    </Animated.View>
                  </TouchableOpacity>

                  {wisdomExpanded ? (
                    <View style={styles.actionWisdomThreadList} collapsable={false}>
                      {(displayWisdomThread.length > 0 ? displayWisdomThread : [{ question: '', wisdom: currentActionWisdom }]).map((entry, threadIndex) => {
                        const entryWisdom = parseWisdomText(entry.wisdom);
                        return (
                          <View key={`wisdom-thread-${threadIndex}-${entry.question}-${entry.wisdom}`} style={styles.actionWisdomThreadItem} collapsable={false}>
                            <View style={styles.actionWisdomThreadRail}>
                              <View style={styles.actionWisdomThreadDot} />
                              {threadIndex < (displayWisdomThread.length > 0 ? displayWisdomThread.length : 1) - 1 ? (
                                <View style={styles.actionWisdomThreadLine} />
                              ) : null}
                            </View>

                            <View style={styles.actionWisdomThreadContent}>
                              {entry.question ? (
                                <View style={styles.actionWisdomUserRow}>
                                  <View style={styles.actionWisdomUserBubble} collapsable={false}>
                                    <ThemedText style={styles.actionWisdomUserText} selectable={true}>
                                      {entry.question}
                                    </ThemedText>
                                  </View>
                                </View>
                              ) : null}

                              <View style={styles.actionWisdomAssistantRow}>
                                <View style={styles.actionWisdomAssistantBubble} collapsable={false}>
                                <View style={styles.actionWisdomAssistantLabelRow}>
                                  <MaterialCommunityIcons name="head-heart-outline" size={14} color={Colors.alertCoral} />
                                </View>

                                {entryWisdom.blocks.map((block, blockIndex) => (
                            <View key={`wisdom-block-${blockIndex}`} collapsable={false}>
                              {block.intro ? (
                                <View style={styles.actionWisdomTextWrapper}>
                                  <ThemedText style={styles.actionWisdomIntro} selectable={true}>
                                    {block.intro}
                                  </ThemedText>
                                </View>
                              ) : null}

                              {blockIndex > 0 && block.intro && (
                                <View style={styles.actionWisdomBlockDivider} />
                              )}

                              {(() => {
                                const wisdomBodyLines = detectBodyLines(
                                  block.items.flatMap(item =>
                                    normalizeActionBulletMarkers(normalizeActionMarkup(item))
                                      .split(/\n+/)
                                      .flatMap(line => splitReadableWisdomLine(line))
                                  ),
                                  'done_skip'
                                );
                                return wisdomBodyLines.map((item, idx) => {
                                if (item.type === 'resourceList') {
                                  return renderResourceListBlock(item, `wisdom-item-${blockIndex}-${idx}-resources`);
                                }
                                if (item.type === 'columns') {
                                  return renderComparisonColumnsBlock(item, `wisdom-item-${blockIndex}-${idx}-columns`);
                                }
                                if (item.type === 'scriptureRead') {
                                  return renderScriptureReadBlock(item, `wisdom-item-${blockIndex}-${idx}-scripture-read`);
                                }
                                if (item.type === 'lineMeaning') {
                                  return renderLineMeaningBlock(item, `wisdom-item-${blockIndex}-${idx}-line-meaning`);
                                }
                                if (item.type === 'hint') {
                                  const hintItems = splitHintDisplayItems(item.text);
                                  const showHintChips = hintItems.length > 1 &&
                                    hintItems.every(part => part.length <= 72) &&
                                    !hintItems.some(part => /:\s*/.test(part));
                                  return (
                                    <View key={`wisdom-item-${blockIndex}-${idx}-${item.label}-${item.text}`} style={styles.bodyHintRow}>
                                      <View style={styles.bodyHintHeader}>
                                        <Ionicons
                                          name={/limit/i.test(item.label || '') ? 'options-outline' : /daily|support/i.test(item.label || '') ? 'calendar-outline' : 'sparkles-outline'}
                                          size={13}
                                          color="rgba(255,204,102,0.72)"
                                        />
                                        <ThemedText weight="semiBold" style={styles.bodyHintLabel}>
                                          {displayHintLabel(item.label, hintItems.length)}
                                        </ThemedText>
                                      </View>
                                      {showHintChips ? (
                                        <View style={styles.bodyHintChipRow}>
                                          {hintItems.map(part => (
                                            <View key={part} style={styles.bodyHintChip}>
                                              <ThemedText style={styles.bodyHintChipText}>
                                                {part}
                                              </ThemedText>
                                            </View>
                                          ))}
                                        </View>
                                      ) : (
                                        <ThemedText style={styles.bodyHintText} selectable={true}>
                                          {item.text}
                                        </ThemedText>
                                      )}
                                    </View>
                                  );
                                }
                                if (item.type === 'script') {
                                  return (
                                    <View
                                      key={`wisdom-item-${blockIndex}-${idx}-script`}
                                      style={[styles.bodyScriptBlock, styles.bodyScriptBlockMessage]}
                                    >
                                      <ScriptRail />
                                      <View style={styles.bodyScriptHeader}>
                                        <Ionicons
                                          name={scriptIconNameForBodyLine(item)}
                                          size={13}
                                          color={Colors.faithGold}
                                        />
                                        <ThemedText weight="semiBold" style={styles.bodyScriptLabel}>
                                          {item.label || 'Words to say'}
                                        </ThemedText>
                                      </View>
                                      <ThemedText
                                        style={[styles.bodyScriptText, styles.bodyScriptTextMessage]}
                                        selectable={true}
                                      >
                                        {item.text}
                                      </ThemedText>
                                    </View>
                                  );
                                }
                                if (item.type === 'ask') {
                                  return (
                                    <View key={`wisdom-item-${blockIndex}-${idx}-ask`} style={styles.bodyAskHeader}>
                                      <Ionicons name="help-circle-outline" size={14} color="rgba(255,204,102,0.78)" />
                                      <ThemedText weight="semiBold" style={styles.bodyAskLabel}>
                                        {item.label || 'Ask yourself'}
                                      </ThemedText>
                                    </View>
                                  );
                                }
                                if (item.type === 'question') {
                                  return (
                                    <View key={`wisdom-item-${blockIndex}-${idx}-question`} style={styles.bodyQuestionRow}>
                                      <ThemedText style={styles.bodyQuestionMark}>?</ThemedText>
                                      <ThemedText style={styles.bodyQuestionText} selectable={true}>
                                        {item.text}
                                      </ThemedText>
                                    </View>
                                  );
                                }
                                if (item.type === 'checklist') {
                                  return (
                                    <View key={`wisdom-item-${blockIndex}-${idx}-checklist`} style={styles.bodyChecklistHeader}>
                                      <FontAwesome6 name="list-check" size={13} color="rgba(255,204,102,0.78)" />
                                      <ThemedText weight="semiBold" style={styles.bodyChecklistLabel}>
                                        {item.label || 'Do this'}
                                      </ThemedText>
                                    </View>
                                  );
                                }
                                if (item.type === 'checklistItem') {
                                  const bulletHint = extractParentheticalActionHint(item.text);
                                  return (
                                    <View key={`wisdom-item-${blockIndex}-${idx}-checklist-item`} style={styles.bodyChecklistItemRow}>
                                      <View style={styles.bodyChecklistItemIcon}>
                                        <Ionicons name="checkmark" size={12} color={Colors.faithGold} />
                                      </View>
                                      <View style={styles.bodyChecklistItemContent}>
                                        <ThemedText style={styles.bodyChecklistItemText} selectable={true}>
                                          {bulletHint?.main || item.text}
                                        </ThemedText>
                                        {bulletHint && (
                                          <View style={styles.bodyInlineHintBlock}>
                                            <View style={styles.bodyHintHeader}>
                                              <Ionicons
                                                name={/limit/i.test(bulletHint.label) ? 'options-outline' : 'sparkles-outline'}
                                                size={13}
                                                color="rgba(255,204,102,0.72)"
                                              />
                                              <ThemedText weight="semiBold" style={styles.bodyHintLabel}>
                                                {bulletHint.label}
                                              </ThemedText>
                                            </View>
                                            <View style={styles.bodyLineBulletHintRow}>
                                              {bulletHint.hints.map(hint => (
                                                <View key={hint} style={styles.bodyLineBulletHintChip}>
                                                  <ThemedText style={styles.bodyLineBulletHintText}>
                                                    {hint}
                                                  </ThemedText>
                                                </View>
                                              ))}
                                            </View>
                                          </View>
                                        )}
                                      </View>
                                    </View>
                                  );
                                }
                                if (item.type === 'bullet') {
                                  const bulletHint = extractParentheticalActionHint(item.text);
                                  return (
                                    <View key={`wisdom-item-${blockIndex}-${idx}-bullet`} style={styles.bodyLineBulletRow}>
                                      <View style={styles.bodyLineBulletDot} />
                                      <View style={styles.bodyLineBulletContent}>
                                        <ThemedText style={styles.bodyLineBullet} selectable={true}>
                                          {bulletHint?.main || item.text}
                                        </ThemedText>
                                        {bulletHint && (
                                          <View style={styles.bodyInlineHintBlock}>
                                            <View style={styles.bodyHintHeader}>
                                              <Ionicons
                                                name={/limit/i.test(bulletHint.label) ? 'options-outline' : 'sparkles-outline'}
                                                size={13}
                                                color="rgba(255,204,102,0.72)"
                                              />
                                              <ThemedText weight="semiBold" style={styles.bodyHintLabel}>
                                                {bulletHint.label}
                                              </ThemedText>
                                            </View>
                                            <View style={styles.bodyLineBulletHintRow}>
                                              {bulletHint.hints.map(hint => (
                                                <View key={hint} style={styles.bodyLineBulletHintChip}>
                                                  <ThemedText style={styles.bodyLineBulletHintText}>
                                                    {hint}
                                                  </ThemedText>
                                                </View>
                                              ))}
                                            </View>
                                          </View>
                                        )}
                                      </View>
                                    </View>
                                  );
                                }
                                if (item.type === 'schedule') {
                                  return (
                                    <View key={`wisdom-item-${blockIndex}-${idx}-schedule`} style={styles.bodyScheduleRow}>
                                      <View style={styles.bodyScheduleIcon}>
                                        <Ionicons name="time-outline" size={13} color="rgba(255,204,102,0.78)" />
                                      </View>
                                      <View style={styles.bodyScheduleContent}>
                                        <ThemedText weight="semiBold" style={styles.bodyScheduleLabel}>
                                          {item.label}
                                        </ThemedText>
                                        <ThemedText style={styles.bodyScheduleValue} selectable={true}>
                                          {item.text}
                                        </ThemedText>
                                      </View>
                                    </View>
                                  );
                                }
                                if (item.type === 'check') {
                                  const isYesNo = /^yes\s*\/\s*no$/i.test(item.text);
                                  return (
                                    <View key={`wisdom-item-${blockIndex}-${idx}-check`} style={styles.bodyCheckRow}>
                                      <ThemedText weight="semiBold" style={styles.bodyCheckLabel}>
                                        {item.label}
                                      </ThemedText>
                                      {isYesNo ? (
                                        <View style={styles.bodyCheckValuePill}>
                                          <ThemedText weight="semiBold" style={styles.bodyCheckValuePillText}>
                                            Yes / No
                                          </ThemedText>
                                        </View>
                                      ) : (
                                        <ThemedText style={styles.bodyCheckValue} selectable={true}>
                                          {item.text}
                                        </ThemedText>
                                      )}
                                    </View>
                                  );
                                }
                                if (item.type === 'field') {
                                  return (
                                    <View key={`wisdom-item-${blockIndex}-${idx}-field`} style={styles.bodyFieldRow}>
                                      <View style={styles.bodyFieldRail} />
                                      <View style={styles.bodyFieldLabel}>
                                        <ThemedText weight="semiBold" style={styles.bodyFieldLabelText}>
                                          {item.label}
                                        </ThemedText>
                                      </View>
                                      <ThemedText style={styles.bodyFieldValue} selectable={true}>
                                        {item.text}
                                      </ThemedText>
                                    </View>
                                  );
                                }
                                if (item.type === 'quote') {
                                  return (
                                    <View key={`wisdom-item-${blockIndex}-${idx}-quote`} style={styles.bodyQuoteBubble}>
                                      <ThemedText style={styles.bodyQuoteBubbleText} selectable={true}>
                                        {stripBalancedActionQuotes(item.text)}
                                      </ThemedText>
                                    </View>
                                  );
                                }
                                if (item.type === 'intro') {
                                  return (
                                    <ThemedText key={`wisdom-item-${blockIndex}-${idx}-intro`} style={styles.bodyLineIntro} selectable={true}>
                                      {item.text}
                                    </ThemedText>
                                  );
                                }
                                const titledItem = splitWisdomItemTitle(item.text);
                                const plainText = item.text;

                                return (
                                  <React.Fragment key={`wisdom-item-${blockIndex}-${idx}-${item.label || ''}-${item.text}`}>
                                    <View style={styles.actionWisdomStepRow}>
                                      <View style={styles.actionWisdomStepTextWrapper}>
                                        {titledItem ? (
                                          <>
                                            {Platform.OS === 'ios' ? (
                                              <>
                                                <ThemedTextInput
                                                  value={titledItem.title}
                                                  weight="bold"
                                                  editable={false}
                                                  multiline={true}
                                                  scrollEnabled={false}
                                                  underlineColorAndroid="transparent"
                                                  pointerEvents="none"
                                                  contextMenuHidden={true}
                                                  caretHidden={true}
                                                  style={styles.actionWisdomStepTitleTextInput}
                                                />
                                                <ThemedTextInput
                                                  value={titledItem.body}
                                                  editable={false}
                                                  multiline={true}
                                                  scrollEnabled={false}
                                                  underlineColorAndroid="transparent"
                                                  pointerEvents="none"
                                                  contextMenuHidden={true}
                                                  caretHidden={true}
                                                  style={styles.actionWisdomStepTextInput}
                                                />
                                              </>
                                            ) : (
                                              <>
                                                <ThemedText weight="bold" style={styles.actionWisdomStepTitle} selectable={true}>
                                                  {titledItem.title}
                                                </ThemedText>
                                                <ThemedText style={styles.actionWisdomStepText} selectable={true}>
                                                  {titledItem.body}
                                                </ThemedText>
                                              </>
                                            )}
                                          </>
                                        ) : (
                                          Platform.OS === 'ios' ? (
                                            <ThemedTextInput
                                              value={plainText}
                                              editable={false}
                                              multiline={true}
                                              scrollEnabled={false}
                                              underlineColorAndroid="transparent"
                                              pointerEvents="none"
                                              contextMenuHidden={true}
                                              caretHidden={true}
                                              style={styles.actionWisdomStepTextInput}
                                            />
                                          ) : (
                                            <ThemedText style={styles.actionWisdomStepText} selectable={true}>
                                              {plainText}
                                            </ThemedText>
                                          )
                                        )}
                                      </View>
                                    </View>
                                  </React.Fragment>
                                );
                                });
                              })()}

                              {block.outro ? (
                                <View style={styles.actionWisdomOutroWrapper}>
                                  {Platform.OS === 'ios' ? (
                                    <ThemedTextInput
                                      value={block.outro}
                                      editable={false}
                                      multiline={true}
                                      scrollEnabled={false}
                                      underlineColorAndroid="transparent"
                                      pointerEvents="none"
                                      contextMenuHidden={true}
                                      caretHidden={true}
                                      style={styles.actionWisdomIntroTextInput}
                                    />
                                  ) : (
                                    <ThemedText style={styles.actionWisdomIntro} selectable={true}>
                                      {block.outro}
                                    </ThemedText>
                                  )}
                                </View>
                              ) : null}

                              {blockIndex < entryWisdom.blocks.length - 1 && (
                                <View style={styles.actionWisdomBlockDivider} />
                              )}
                            </View>
                                ))}
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                      <TouchableOpacity
                        style={styles.actionWisdomCollapseButton}
                        onPress={() => {
                          triggerLightHaptic();
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setWisdomExpanded(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <ThemedText weight="semiBold" style={styles.actionWisdomCollapseButtonText}>
                          Collapse
                        </ThemedText>
                        <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </StepFadeIn>
            ) : null}

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

    </ScrollView>

      {/* Floating action bar — collapses to circle on scroll, matches bottom nav behavior */}
      <Animated.View style={[styles.actionFABContainer, IS_IPAD && styles.actionFABContainerPad, { bottom: insets.bottom + 16 }]}>
        {/* Journal expanded icons — float above FAB row */}
        <Animated.View style={[styles.journalExpandedRow, { height: rowHeight, opacity: rowOpacity }]}>
          {JOURNAL_ICONS.map(({ type, icon, color, label }, idx) => (
            <Animated.View
              key={type}
              style={{
                opacity: iconAnims[idx],
                transform: [{ scale: iconAnims[idx] }],
                alignItems: 'center',
              }}
            >
              <TouchableOpacity
                style={styles.journalIconButton}
                onPress={() => {
                  journalExpandedRef.current = false;
                  setJournalExpanded(false);
                  setHowToJournalContext(null);
                  setActiveJournalModal(type);
                  triggerLightHaptic();
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.journalIconCircle, { backgroundColor: color + '28', borderColor: color + '20' }]}>
                  <MaterialCommunityIcons name={icon} size={20} color={color} />
                </View>
                <ThemedText style={[styles.journalIconLabel, { color }]}>{label}</ThemedText>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </Animated.View>

        {/* Full pill: shape contracts left→circle, content fades independently */}
        <Animated.View
          style={[
            styles.actionFABRow,
            {
              opacity: fabShapeOpacity,
              transform: [{ translateX: fabShapeTranslateX }, { scaleX: fabShapeScaleX }],
            },
          ]}
          pointerEvents="box-none"
        >
          <Animated.View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: fabContentOpacity }}>
            {/* Journal trigger FAB */}
            <TouchableOpacity
              style={styles.actionFABCircle}
              onPress={toggleJournalIcons}
              activeOpacity={0.8}
            >
              <Animated.View style={{ transform: [{ rotate: rotateInterpolate }, { scale: triggerScale }] }}>
                <MaterialCommunityIcons
                  name="pencil-plus-outline"
                  size={20}
                  color="rgba(255,255,255,0.55)"
                />
              </Animated.View>
            </TouchableOpacity>

            {/* Done FAB */}
            <TouchableOpacity
              style={[styles.actionFABDone, isCommitted && styles.doneButtonCommitted]}
              onPress={() => {
                if (actionType === 'text_input') {
                  handleSaveJournal();
                } else {
                  handlePrimaryPress();
                }
              }}
              activeOpacity={0.85}
            >
              <ThemedText weight="semiBold" style={[styles.actionFABDoneText, isCommitted && styles.doneButtonTextCommitted]} numberOfLines={1}>
                {primaryLabel}
              </ThemedText>
            </TouchableOpacity>

            {/* Skip FAB */}
            <TouchableOpacity
              onPress={() => advanceStep(false)}
              activeOpacity={0.7}
              style={styles.actionFABSkip}
            >
              <ThemedText style={styles.skipButtonText} numberOfLines={1}>
                {secondaryLabel}
              </ThemedText>
            </TouchableOpacity>

            {/* Back FAB — beside Skip, visible from step 2 onwards */}
            {actionStepIndex >= 1 && onGoBack && (
              <TouchableOpacity
                style={styles.actionFABCircle}
                onPress={onGoBack}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>
            )}
          </Animated.View>
        </Animated.View>

        {/* Collapsed circle — fades in as pill contracts; tap to re-expand */}
        <Animated.View
          style={[styles.actionFABCollapsedCircle, { opacity: fabCircleOpacity }]}
          pointerEvents={fabCollapsed ? 'box-none' : 'none'}
        >
          <TouchableOpacity
            style={styles.actionFABCollapsedCircleTouchable}
            activeOpacity={0.8}
            onPress={() => {
              triggerLightHaptic();
              setFabCollapsed(false);
              fabBarHiddenRef.current = false;
              Animated.spring(collapseAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 13 }).start();
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {activeJournalModal === 'reflection' && (
        <SmartJournalingReflectionModal
          visible={true}
          subtaskTitle={reflectionJournalTitle}
          playbookId={playbookId}
          playbookTitle={playbookTitle}
          playbookStatus={playbookStatus}
          actionStepNumber={stepNumber}
          actionStepTitle={reflectionJournalTitle}
          stepBody={reflectionJournalBody || undefined}
          stepExample={reflectionJournalExample}
          onSave={() => {
            setHowToJournalContext(null);
            setActiveJournalModal(null);
            advanceStep(true);
          }}
          onCancel={() => {
            setHowToJournalContext(null);
            setActiveJournalModal(null);
          }}
        />
      )}
      {activeJournalModal === 'gratitude' && (
        <SmartJournalingGratitudeModal
          visible={true}
          subtaskTitle={currentStep.title ?? ''}
          subtaskId={currentStep.id}
          stepId={currentStep.id}
          playbookId={playbookId}
          playbookTitle={playbookTitle}
          playbookStatus={playbookStatus}
          actionStepNumber={stepNumber}
          actionStepTitle={currentStep.title ?? ''}
          stepBody={mainBodyText || undefined}
          stepExample={exampleText || undefined}
          onSave={() => { setActiveJournalModal(null); advanceStep(true); }}
          onClose={() => setActiveJournalModal(null)}
        />
      )}
      {activeJournalModal === 'timeblock' && (
        <SmartJournalingTimeBlockModal
          visible={true}
          subtaskTitle={currentStep.title ?? ''}
          playbookId={playbookId}
          onSave={() => { setActiveJournalModal(null); advanceStep(true); }}
          onCancel={() => setActiveJournalModal(null)}
        />
      )}

      <HowToModal
        visible={howToModalVisible}
        actionTitle={currentStep.title || ''}
        actionNumber={stepNumber}
        onDismiss={() => setHowToModalVisible(false)}
        onJournalPress={(context) => {
          setHowToJournalContext(context);
          setHowToModalVisible(false);
          setActiveJournalModal(context.type);
        }}
        onSubmit={async (question) => {
          try {
            const response = await getActionWisdom({
              playbookId: playbookId || '',
              userId: userId,
              userName: getUserFirstName(user),
              actionId: currentStep.id || '',
              actionTitle: currentStep.title || '',
              actionBody: actionGuidanceBody || '',
              userQuestion: question,
              truthSummary: truthSummary || '',
              truthInLove: truthInLove || '',
              previousWisdom: wisdomContext,
              dateOfBirth,
              preferredBibleTranslation,
              isOnboarding,
            });

            if (response.success && response.wisdom) {
              const returnedWisdom = response.wisdom.trim();
              const threadEntry = { question: question.trim(), wisdom: returnedWisdom };
              const existingThread = currentStep.id
                ? persistedWisdomThreads[currentStep.id] || wisdomThread || parseWisdomThread(currentActionWisdom)
                : wisdomThread || parseWisdomThread(currentActionWisdom);
              const nextThread = response.wisdomThread?.length
                ? response.wisdomThread
                : [threadEntry, ...existingThread];
              const serializedThread = response.storedWisdom || serializeWisdomThread(nextThread);

              if (currentStep.id) {
                persistedWisdomThreads = {
                  ...persistedWisdomThreads,
                  [currentStep.id]: nextThread,
                };
              }
              setWisdomThread(nextThread);
              setCurrentActionWisdom(serializedThread);
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setWisdomExpanded(false);
              setWisdomCount(typeof response.wisdomCount === 'number' ? response.wisdomCount : wisdomCount + 1);
              if (typeof response.wisdomLimit === 'number') {
                setWisdomLimit(response.wisdomLimit);
              }
              if (playbookId && user?.id) {
                queryClient.setQueryData(['playbook', playbookId, user.id], (cachedPlaybook: any) => {
                  if (!cachedPlaybook?.actionSteps) {
                    return cachedPlaybook;
                  }

                  return {
                    ...cachedPlaybook,
                    actionSteps: cachedPlaybook.actionSteps.map((step: any) =>
                      step.id === currentStep.id
                        ? { ...step, wisdom_text: serializedThread }
                        : step
                    ),
                  };
                });
                queryClient.invalidateQueries({ queryKey: ['playbook', playbookId, user.id] });
                queryClient.invalidateQueries({ queryKey: ['subscription', user.id] });
              }
              triggerSuccessHaptic();
            }

            return response;
          } catch (error) {
            return {
              success: false,
              error: 'ERROR',
              message: 'Something went wrong. Please try again.',
            };
          }
        }}
        wisdomCount={wisdomCount}
        wisdomLimit={wisdomLimit}
        hideUsageCounter={isOnboarding}
      />

    </>
  );
};

// ─── Step 4: Prayer ──────────────────────────────────────────────────────────

interface PrayerStepProps {
  prayer: string;
  playbookTitle?: string;
  playbookId?: string;
  userId: string;
  onNext: () => void;
  onSharePrayer?: (text: string) => void;
  insets: { top: number; bottom: number };
}

const PrayerStep: React.FC<PrayerStepProps> = ({ prayer, playbookTitle, playbookId, userId, onSharePrayer, onNext: _onNext, insets }) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const [hasPrayed, setHasPrayed] = useState(persistedHasPrayed);
  const [showButton, setShowButton] = useState(persistedHasPrayed); // show immediately if already prayed
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shareFadeAnim = useRef(new Animated.Value(0)).current;
  const createPrayerMutation = useCreateGuidedPrayer();

  useEffect(() => {
    const animateIn = () => {
      setShowButton(true);
      Animated.stagger(220, [
        Animated.spring(fadeAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(shareFadeAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    };
    if (persistedHasPrayed) {
      animateIn(); // already prayed — still animate, just skip the delay
      return;
    }
    const timer = setTimeout(animateIn, 600);
    return () => clearTimeout(timer);
  }, [fadeAnim, shareFadeAnim]);

  // Ensure prayer always ends with the closing — append for old playbooks that don't have it
  const fullPrayer = /In Jesus'? [Nn]ame|[Aa]men/i.test(prayer)
    ? prayer
    : prayer.trimEnd() + "\n\nIn Jesus' Name,\nAmen";

  const handlePrayed = () => {
    const nowPrayed = !hasPrayed;
    if (nowPrayed) {
      triggerSuccessHaptic();
    } else {
      triggerLightHaptic();
    }
    persistedHasPrayed = nowPrayed;
    setHasPrayed(nowPrayed);
    saveCurrentSession();

    // Notify dashboard about prayer update
    DeviceEventEmitter.emit('playbookPrayerReadUpdated', {
      playbookId: playbookId,
      hasPrayed: nowPrayed,
      hasRead: persistedHasRead,
    });

    if (nowPrayed) {
      // Update prayer_prayed field in playbooks table
      if (playbookId) {
        updatePlaybookPrayerPrayed(playbookId, true).catch(error => {
          console.warn('Failed to update prayer_prayed in playbooks table', error);
        });
      }

      createPrayerMutation.mutate({
        content: fullPrayer,
        userId,
        dateStr: toLocalDateString(new Date()),
        playbookTitle: playbookTitle ?? '',
        dayNumber: 1,
        dayTitle: 'Prayer',
        totalDays: 1,
        prayer_type: 'guided_playbook',
      });

      faithPointsService.awardPoints(userId, 'prayer_playbook_prayed', {
        suppressNotification: true,
        source: 'playbook_prayer',
        playbookId,
        playbookTitle,
      }).catch(error => {
        console.warn('Failed to award faith points for playbook prayer', error);
      });
    }
  };

  // Split "In Jesus' Name, Amen" out so we can add a clear gap before it
  const jesusNameIdx = fullPrayer.search(/In Jesus'? [Nn]ame/i);
  const prayerBodyText = jesusNameIdx > 0 ? capitalizeFirstLetter(fullPrayer.slice(0, jesusNameIdx).trimEnd()) : capitalizeFirstLetter(fullPrayer);
  const prayerClosing = jesusNameIdx > 0 ? fullPrayer.slice(jesusNameIdx) : null;
  const prayerBodyParagraphs = splitParagraphs(prayerBodyText);
  const prayerClosingParagraphs = prayerClosing ? splitParagraphs(prayerClosing) : [];

  return (
    <>
      <View style={[styles.stepScroll, styles.prayerStepOuter, IS_IPAD && styles.prayerStepOuterPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8) }]}>
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <MaterialCommunityIcons name="hands-pray" size={18} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            Prayer
          </ThemedText>
        </StepFadeIn>

        {/* Vertically centered prayer block — sits in the space between label and floating button */}
        <StepFadeIn delay={100} style={styles.prayerBlock}>
          {prayerBodyParagraphs.map((line, i) => (
            <View
              key={i}
              style={i < prayerBodyParagraphs.length - 1 ? styles.prayerParagraph : undefined}
            >
              {Platform.OS === 'ios' ? (
                <TextInput
                  value={line}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={[styles.prayerText, { fontFamily }]}
                />
              ) : (
                <ThemedText style={styles.prayerText} selectable={true}>{line}</ThemedText>
              )}
            </View>
          ))}
          {prayerClosing && (
            <>
              <View style={{ height: 24 }} />
              {prayerClosingParagraphs.map((line, i) => (
                Platform.OS === 'ios' ? (
                  <TextInput
                    key={`closing-${i}`}
                    value={line}
                    editable={false}
                    multiline={true}
                    scrollEnabled={false}
                    style={[styles.prayerText, { fontFamily }]}
                  />
                ) : (
                  <ThemedText key={`closing-${i}`} style={styles.prayerText} selectable={true}>{line}</ThemedText>
                )
              ))}
            </>
          )}
        </StepFadeIn>

        {/* Spacer so prayer text isn't hidden behind the floating button */}
        <View style={{ height: 80 }} />
      </View>

      {/* Floating action button — bottom-left, aligned with Next button */}
      {showButton && (
        <Animated.View
          style={[
            styles.prayerActionRow,
            { bottom: insets.bottom + 20, opacity: fadeAnim },
            {
              transform: [
                {
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.prayerActionPill, hasPrayed && styles.prayerActionButtonActive]}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              onPress={handlePrayed}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="hands-pray"
                size={18}
                color={hasPrayed ? Colors.alertCoral : Colors.hopeWhite}
              />
              <ThemedText
                weight="medium"
                style={[styles.prayerActionText, hasPrayed && styles.prayerActionTextActive]}
              >
                {hasPrayed ? 'Prayed' : 'I prayed this'}
              </ThemedText>
            </TouchableOpacity>
          </View>
          {onSharePrayer ? (
            <Animated.View
              style={[
                styles.prayerActionSharePill,
                {
                  opacity: shareFadeAnim,
                  transform: [
                    {
                      scale: shareFadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => { triggerLightHaptic(); onSharePrayer(normalizePrayerText(fullPrayer).trim()); }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Share this prayer"
              >
                <Ionicons name="paper-plane-outline" size={17} color={Colors.hopeWhite} />
              </TouchableOpacity>
            </Animated.View>
          ) : null}
        </Animated.View>
      )}
    </>
  );
};

// ─── Step 5: Word to Speak ───────────────────────────────────────────────────

interface WordToSpeakStepProps {
  word: string;
  playbookId?: string;
  onNext: () => void;
  onShareWord?: (text: string) => void;
  insets: { top: number; bottom: number };
}

const WordToSpeakStep: React.FC<WordToSpeakStepProps> = ({ word, playbookId, onShareWord, onNext: _onNext, insets }) => {
  const [hasRead, setHasRead] = useState(persistedHasRead);
  const [showButton, setShowButton] = useState(persistedHasRead); // show immediately if already read
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shareFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateIn = () => {
      setShowButton(true);
      Animated.stagger(220, [
        Animated.spring(fadeAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(shareFadeAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    };
    if (persistedHasRead) {
      animateIn(); // already read — still animate, just skip the delay
      return;
    }
    const timer = setTimeout(animateIn, 600);
    return () => clearTimeout(timer);
  }, [fadeAnim, shareFadeAnim]);

  const wordLines = splitParagraphs(word);
  const wordShareText = `WORDS TO SPEAK OVER YOURSELF\n\n${wordLines.map((line, i) => `${i + 1}. ${line}`).join('\n\n')}`;

  const handleRead = () => {
    const nowRead = !hasRead;
    if (nowRead) {
      triggerSuccessHaptic();
    } else {
      triggerLightHaptic();
    }
    persistedHasRead = nowRead;
    setHasRead(nowRead);
    saveCurrentSession();

    // Notify dashboard about read update
    DeviceEventEmitter.emit('playbookPrayerReadUpdated', {
      playbookId: playbookId,
      hasPrayed: persistedHasPrayed,
      hasRead: nowRead,
    });
  };

  return (
    <>
      <View style={[styles.stepScroll, styles.prayerStepOuter, IS_IPAD && styles.prayerStepOuterPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8) }]}>
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            Words to Speak over Myself
          </ThemedText>
        </StepFadeIn>

        {/* Word card */}
        <StepFadeIn delay={100} style={[styles.wordBlock, { marginTop: 32 }]}>
          {wordLines.map((line, i) => (
            <View key={i} style={styles.wordLineRow}>
              <View style={styles.wordNumberContainer}>
                <View style={styles.wordNumberCircle}>
                  <ThemedText weight="bold" style={styles.wordNumber}>
                    {i + 1}
                  </ThemedText>
                </View>
              </View>
              <ShareableSelectableText
                text={line}
                weight="medium"
                style={[styles.wordText, { flex: undefined }]}
                containerStyle={{ flex: 1 }}
                onShare={onShareWord ? () => onShareWord(wordShareText) : undefined}
                showShareButton={false}
              />
            </View>
          ))}
        </StepFadeIn>

        {/* Space for floating button */}
        <View style={{ height: 80 }} />
      </View>

      {/* Floating action button — bottom-left, aligned with Next button */}
      {showButton && (
        <Animated.View
          style={[
            styles.prayerActionRow,
            { bottom: insets.bottom + 20, opacity: fadeAnim },
            {
              transform: [
                {
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.prayerActionPill, hasRead && styles.prayerActionButtonActive]}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              onPress={handleRead}
              activeOpacity={0.8}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={16}
                color={hasRead ? Colors.alertCoral : Colors.hopeWhite}
              />
              <ThemedText
                weight="medium"
                style={[styles.prayerActionText, hasRead && styles.prayerActionTextActive]}
              >
                {hasRead ? 'Read aloud' : "I've read this aloud"}
              </ThemedText>
            </TouchableOpacity>
          </View>
          {onShareWord ? (
            <Animated.View
              style={[
                styles.prayerActionSharePill,
                {
                  opacity: shareFadeAnim,
                  transform: [
                    {
                      scale: shareFadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => { triggerLightHaptic(); onShareWord(wordShareText); }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Share this declaration"
              >
                <Ionicons name="paper-plane-outline" size={17} color={Colors.hopeWhite} />
              </TouchableOpacity>
            </Animated.View>
          ) : null}
        </Animated.View>
      )}
    </>
  );
};

// ─── Step 6: Completion ──────────────────────────────────────────────────────

interface CompletionStepProps {
  title: string;
  closingText: string;
  pastoralClosing?: string;
  onFinish: () => void;
  insets: { top: number };
  isCompleted?: boolean;
  isOnboarding?: boolean;
  isBeatBased?: boolean;
  navigation: any;
  fromNotification?: boolean;
}

function stripLeadingCompletionPunctuation(text: string): string {
  return String(text || '').replace(/^\s*[.,;:!?]+\s*(?=[A-Za-z])/g, '').trim();
}

const CompletionStep: React.FC<CompletionStepProps> = ({
  title,
  closingText,
  pastoralClosing,
  onFinish,
  insets,
  isCompleted = false,
  isOnboarding = false,
  isBeatBased = false,
  navigation,
  fromNotification = false,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(persistedCompletionChoice);
  const headerAnim = useRef(new Animated.Value(40)).current;
  const buttonsAnim = useRef(new Animated.Value(30)).current;
  const iconAnim = useRef(new Animated.Value(0)).current;
  const cleanPastoralClosing = stripLeadingCompletionPunctuation(pastoralClosing || '');

  useEffect(() => {
    Animated.spring(headerAnim, {
      toValue: 0,
      tension: 60,
      friction: 10,
      delay: 100,
      useNativeDriver: true,
    }).start();
  }, [headerAnim]);

  useEffect(() => {
    Animated.spring(buttonsAnim, {
      toValue: 0,
      tension: 60,
      friction: 10,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, [buttonsAnim]);

  useEffect(() => {
    iconAnim.setValue(0);
    Animated.timing(iconAnim, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      delay: 160,
      useNativeDriver: true,
    }).start();
  }, [iconAnim]);

  // Parse completion text to extract question and action lines
  const parseCompletionText = (text: string) => {
    // Normalize old challenge format — strip section labels, remove opener line
    const normalized = text
      .replace(/^.+?,\s+complete\s+this\s+.+?challenge:\s*/gim, '')
      .replace(/^SPIRITUAL:\s*/gim, '')
      .replace(/^TACTICAL(?:\s*\([^)]*\))?:\s*/gim, '')
      .replace(/^TACTICAL\s+DEADLINE:\s*/gim, '')
      .replace(/\*\*|__|\*/g, '');

    const lines = normalized
      .split('\n')
      .map(l => stripLeadingCompletionPunctuation(l))
      .filter(Boolean);

    // Always show context line — inject if not already present
    // Use "Final reflection:" for completed playbooks, "Before you close:" for new ones
    // Hide context line if coming from notification
    const hasContext = lines.some(l => /^before you/i.test(l) || /^final reflection/i.test(l));
    const contextLine = fromNotification ? undefined : (
      hasContext ? lines.find(l => /^before you/i.test(l) || /^final reflection/i.test(l)) :
      (isCompleted ? 'Final reflection:' : 'Before you close:')
    );
    const questionLine = lines.find(l => l.endsWith('?'));
    const actionLines = lines.filter(l =>
      l.length > 0 && !/^before you/i.test(l) && !/^final reflection/i.test(l) && !l.endsWith('?')
    );

    // Choice pills: 2-4 short mutually-exclusive options.
    // Require the *question* to explicitly ask for a selection, OR the items to use "or"
    // as an explicit alternative connector — never trigger on imperative-step verbs like
    // "Choose patience…" which are sequential actions, not selectable options.
    const isChoicePills = actionLines.length >= 2 && actionLines.length <= 4 &&
                          actionLines.every(l => l.split(' ').length <= 6) &&
                          (
                            (questionLine !== undefined &&
                              /\bwhich\b|\bpick one\b|\bchoose one\b|\bwhat will you choose\b/i.test(questionLine)) ||
                            actionLines.some(l => /\bor\b/i.test(l))
                          );

    return { contextLine, questionLine, actionLines, isChoicePills };
  };

  const { contextLine, questionLine, actionLines, isChoicePills } = isBeatBased
    ? { contextLine: undefined, questionLine: undefined, actionLines: [] as string[], isChoicePills: false }
    : parseCompletionText(closingText);

  const content = (
    <>
      <StepFadeIn delay={0}>
        <Animated.View style={{ transform: [{ translateY: headerAnim }] }}>
          <View style={styles.completionHeaderContainer}>
            <View style={styles.stepLabelRow}>
              <Animated.View
                style={{
                  opacity: iconAnim,
                  transform: [
                    {
                      rotate: iconAnim.interpolate({
                        inputRange: [0, 0.45, 1],
                        outputRange: ['-25deg', '0deg', '0deg'],
                      }),
                    },
                    {
                      scale: iconAnim.interpolate({
                        inputRange: [0, 0.45, 0.65, 0.85, 1],
                        outputRange: [0.4, 0.4, 1.3, 1.1, 1],
                      }),
                    },
                  ],
                }}
              >
                <Ionicons name="flash" size={18} color={Colors.alertCoral} />
              </Animated.View>
              {!fromNotification && (
                Platform.OS === 'ios' ? (
                  <TextInput
                    value="You've completed"
                    editable={false}
                    multiline={true}
                    scrollEnabled={false}
                    style={[styles.stepLabelWhite, { fontWeight: '600' as any, fontFamily }]}
                  />
                ) : (
                  <ThemedText weight="semiBold" style={styles.stepLabelWhite} selectable={true}>
                    You've completed
                  </ThemedText>
                )
              )}
            </View>
            {Platform.OS === 'ios' ? (
              <TextInput
                value={title}
                editable={false}
                multiline={true}
                scrollEnabled={false}
                style={[styles.completionTitle, { fontWeight: '700' as any, fontFamily }]}
              />
            ) : (
              <ThemedText weight="bold" style={styles.completionTitle} selectable={true}>
                {title}
              </ThemedText>
            )}
            <ThemedText style={styles.completionPlaybookLabel}>PLAYBOOK</ThemedText>
          </View>
        </Animated.View>
      </StepFadeIn>

      {cleanPastoralClosing ? (
        <StepFadeIn delay={80}>
          {Platform.OS === 'ios' ? (
            <TextInput
              value={cleanPastoralClosing}
              editable={false}
              multiline={true}
              scrollEnabled={false}
              style={[
                styles.completionPastoralClosing,
                isBeatBased && styles.completionPastoralClosingBeat,
                { fontFamily },
              ]}
            />
          ) : (
            <ThemedText
              weight={isBeatBased ? 'bold' : undefined}
              style={[styles.completionPastoralClosing, isBeatBased && styles.completionPastoralClosingBeat]}
              selectable={true}
            >
              {cleanPastoralClosing}
            </ThemedText>
          )}
        </StepFadeIn>
      ) : null}

      {!isBeatBased && (
        <StepFadeIn delay={100}>
          <>
            {contextLine && (
              Platform.OS === 'ios' ? (
                <TextInput
                  value={contextLine}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={[styles.completionContext, { fontFamily }]}
                />
              ) : (
                <ThemedText style={styles.completionContext} selectable={true}>{contextLine}</ThemedText>
              )
            )}
            {questionLine && (
              Platform.OS === 'ios' ? (
                <TextInput
                  value={questionLine}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={[styles.completionQuestion, { fontFamily }]}
                />
              ) : (
                <ThemedText style={styles.completionQuestion} selectable={true}>{questionLine}</ThemedText>
              )
            )}
          </>
        </StepFadeIn>
      )}

      {!isBeatBased && (
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
                      persistedCompletionChoice = choice;
                      saveCurrentSession();
                    }}
                    activeOpacity={0.8}
                  >
                    {Platform.OS === 'ios' ? (
                      <TextInput
                        value={choice}
                        editable={false}
                        multiline={true}
                        scrollEnabled={false}
                        style={[
                          styles.completionChoiceText,
                          selectedChoice === choice && styles.completionChoiceTextActive,
                          selectedChoice === choice && { fontWeight: '600' as any },
                          { fontFamily },
                        ]}
                      />
                    ) : (
                      <ThemedText
                        weight={selectedChoice === choice ? 'semiBold' : undefined}
                        style={[
                          styles.completionChoiceText,
                          selectedChoice === choice && styles.completionChoiceTextActive,
                        ]}
                        selectable={true}
                      >
                        {choice}
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : actionLines.length > 0 && (
              <View style={styles.completionActionsContainer}>
                {actionLines.map((line, index) => (
                  <View key={index} style={styles.completionActionItem}>
                    <View style={styles.completionActionCircle}>
                      <Ionicons name="sparkles" size={14} color={Colors.alertCoral} />
                    </View>
                    {Platform.OS === 'ios' ? (
                      <TextInput
                        value={line}
                        editable={false}
                        multiline={true}
                        scrollEnabled={false}
                        style={[styles.completionActionLine, { fontFamily }]}
                      />
                    ) : (
                      <ThemedText style={styles.completionActionLine} selectable={true}>
                        {line}
                      </ThemedText>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        </StepFadeIn>
      )}

      <StepFadeIn delay={220}>
        <Animated.View style={{ transform: [{ translateY: buttonsAnim }] }}>
          {!fromNotification && (
            <TouchableOpacity
              style={[styles.primaryButton, styles.finishButton]}
              onPress={isCompleted ? () => {
                triggerLightHaptic();
                (navigation as any)?.goBack();
              } : onFinish}
              activeOpacity={0.85}
            >
              <ThemedText weight="semiBold" style={styles.primaryButtonText}>
                {isCompleted ? 'Done' : isOnboarding ? 'Continue' : 'Save & Finish'}
              </ThemedText>
            </TouchableOpacity>
          )}

        </Animated.View>
      </StepFadeIn>
    </>
  );

  return isBeatBased ? (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 20 : 0) }]}
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  ) : (
    <View style={[styles.stepScroll, styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 20 : 0) }]}>
      {content}
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const PlaybookWalkthroughScreen: React.FC<Props> = ({ route, navigation }) => {
  const routePlaybook = route.params?.playbook;
  const source = route.params?.source;
  const initialStep = route.params?.initialStep;
  const initialActionIndex = route.params?.initialActionIndex;
  const fromNotification = route.params?.fromNotification;
  const routeCoverPage = getPlaybookCover(routePlaybook);
  const routeHasTruthBeats = getTruthBeats(routePlaybook).length > 0;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const pdfExportAccess = useFeatureAccess({ feature: 'export_pdf' });
  const fabCollapseAnimRef = useRef(new Animated.Value(1));
  const [stepIndex, setStepIndex] = useState(() => {
    if (initialStep !== undefined && initialStep >= 0 && initialStep < TOTAL_STEPS) {
      return routeHasTruthBeats && initialStep === 0 ? 1 : initialStep;
    }
    if (routeCoverPage && routePlaybook?.status !== 'completed' && (routePlaybook.walkthroughProgress ?? -1) < 0 && !fromNotification) {
      return COVER_STEP_INDEX;
    }
    if (!routePlaybook || routePlaybook.status === 'completed') { return routeHasTruthBeats ? 1 : 0; }
    const wp = routePlaybook.walkthroughProgress ?? -1;
    if (wp < 0) { return routeHasTruthBeats ? 1 : 0; }
    // wp = last step where Next was pressed → resume at wp + 1, capped at step 5 (never auto-land on completion)
    return Math.min(Math.max(wp + 1, routeHasTruthBeats ? 1 : 0), TOTAL_STEPS - 2);
  });
  const [actionStepIndex, setActionStepIndex] = useState(() => {
    if (initialActionIndex !== undefined && initialActionIndex >= 0) {
      return initialActionIndex;
    }
    return persistedActionStepIndex;
  });
  const [truthBeatIndex, setTruthBeatIndex] = useState(0);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [showTruthShareComposer, setShowTruthShareComposer] = useState(false);
  const [shareReflectionText, setShareReflectionText] = useState('');
  const [shareTextColor, setShareTextColor] = useState<string | undefined>(undefined);
  const [shareLineHeightMultiplier, setShareLineHeightMultiplier] = useState<number | undefined>(undefined);
  const [shareNoSplit, setShareNoSplit] = useState<boolean | undefined>(undefined);
  const [refinedPlaybookOverride, setRefinedPlaybookOverride] = useState<typeof routePlaybook | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [refinementCount, setRefinementCount] = useState(0);
  const [refinementLimit, setRefinementLimit] = useState(0);
  const [refinementUpgradeTier, setRefinementUpgradeTier] = useState<RefinementUpgradeTier | null>('growth');
  const [refinementResetLabel, setRefinementResetLabel] = useState(() => getRefinementResetLabel(null));
  const [refinementCurrentTier, setRefinementCurrentTier] = useState('seeker');
  const [refinementTrialChosenTier, setRefinementTrialChosenTier] = useState<string | undefined>(undefined);
  const [refinementOpen, setRefinementOpen] = useState(false);
  const [positionLoadedFor, setPositionLoadedFor] = useState<string | null>(null);


  // ── Onboarding "playbook ready" overlay — shown for all onboarding users ──
  const [showReadyOverlay, setShowReadyOverlay] = useState(false);

  useEffect(() => {
    if (source === 'onboarding') {
      setShowReadyOverlay(true);
    }

  }, [source]);

  const handleDismissReadyOverlay = useCallback(() => {
    setShowReadyOverlay(false);
  }, []);

  const [journalExpanded, setJournalExpanded] = useState(false);
  const [, setJournalCollapseComplete] = useState(true);

  const userName: string = React.useMemo(() => getUserFirstName(user), [user]);
  const userId: string = user?.id || '';

  // Detect if the route playbook is a lightweight list object (missing full content).
  // Lightweight mode includes truth_in_love but NOT bible_verse text, prayer, wordToSpeak, etc.
  // So we check bibleVerse.text (empty string in lightweight, actual content in full).
  // Also accept if prayer key is a string (only set in full fetches).
  const isFullPlaybook =
    routePlaybook &&
    (
      (
        routePlaybook.bibleVerse &&
        typeof routePlaybook.bibleVerse === 'object' &&
        (routePlaybook.bibleVerse as any).text &&
        (routePlaybook.bibleVerse as any).text.length > 0
      ) ||
      typeof (routePlaybook as any).prayer === 'string'
    );

  const playbookId = routePlaybook?.id;
  const shouldFetch = !isFullPlaybook && !!playbookId && !!userId;

  const { data: fetchedPlaybook, isLoading } = useQuery({
    queryKey: ['playbook', playbookId, userId],
    queryFn: async () => {
      const result = await getPlaybook(userId, playbookId!);
      return result;
    },
    enabled: shouldFetch,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const playbook = (refinedPlaybookOverride || (isFullPlaybook ? routePlaybook : fetchedPlaybook)) as typeof routePlaybook;
  const coverPage = getPlaybookCover(playbook);
  const truthBeats = personalizeTruthContent(getTruthBeats(playbook, userName), userName);
  const truthToCarry = personalizeTruthContent(getTruthToCarry(playbook), userName);
  const currentTruthBeatForShare = truthBeats[Math.min(Math.max(truthBeatIndex, 0), truthBeats.length - 1)];
  const currentTruthBeatPrimary = currentTruthBeatForShare?.primaryTruth || '';
  const currentTruthBeatSupporting = currentTruthBeatForShare?.supportingTruth;
  const hasLoadedPlaybook = !!playbook;

  const refinementsRemaining = refinementLimit === -1
    ? Number.MAX_SAFE_INTEGER
    : Math.max(0, refinementLimit - refinementCount);

  useEffect(() => {
    if (!playbookId || !playbook) { return; }
    let cancelled = false;
    setPositionLoadedFor(null);

    const restorePosition = async () => {
      let saved: { stepIndex?: number; truthBeatIndex?: number } | null = null;
      try {
        const raw = await AsyncStorage.getItem(getPositionKey(playbookId));
        saved = raw ? JSON.parse(raw) : null;
      } catch (_) {
        // Missing or damaged local position falls back to database progress.
      }
      if (cancelled) { return; }

      const firstStep = truthBeats.length > 0 ? 1 : 0;
      const explicitStep = initialStep !== undefined && initialStep >= 0 && initialStep < TOTAL_STEPS;
      if (explicitStep) {
        setStepIndex(initialStep === 0 ? firstStep : initialStep);
        setTruthBeatIndex(0);
      } else if (!fromNotification) {
        const progress = playbook.walkthroughProgress ?? -1;
        let nextStep = playbook.status === 'completed'
          ? firstStep
          : progress >= 0
            ? Math.min(Math.max(progress + 1, firstStep), TOTAL_STEPS - 2)
            : coverPage ? COVER_STEP_INDEX : firstStep;
        const savedStep = saved?.stepIndex;
        if (playbook.status !== 'completed' && typeof savedStep === 'number' &&
          Number.isInteger(savedStep) && savedStep >= COVER_STEP_INDEX && savedStep < TOTAL_STEPS) {
          nextStep = savedStep === COVER_STEP_INDEX
            ? coverPage ? COVER_STEP_INDEX : firstStep
            : Math.min(Math.max(savedStep, firstStep), TOTAL_STEPS - 2);
        }
        setStepIndex(nextStep);
        const beat = saved?.truthBeatIndex;
        setTruthBeatIndex(playbook.status !== 'completed' && typeof beat === 'number' && Number.isInteger(beat)
          ? Math.max(0, Math.min(beat, truthBeats.length - 1)) : 0);
      }
      setPositionLoadedFor(playbookId);
    };
    restorePosition();
    return () => { cancelled = true; };
    // Restore once when this playbook's full content becomes available, not on
    // later query updates or refinement (which deliberately resets the position).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbookId, hasLoadedPlaybook]);

  useEffect(() => {
    if (!playbookId || positionLoadedFor !== playbookId) { return; }
    AsyncStorage.setItem(getPositionKey(playbookId), JSON.stringify({ stepIndex, truthBeatIndex })).catch(() => {});
  }, [playbookId, positionLoadedFor, stepIndex, truthBeatIndex]);

  useEffect(() => {
    if (!playbook || truthBeats.length === 0 || stepIndex !== 0) {
      return;
    }
    if (
      coverPage &&
      initialStep === undefined &&
      !fromNotification &&
      playbook.status !== 'completed' &&
      (playbook.walkthroughProgress ?? -1) < 0
    ) {
      return;
    }

    setStepIndex(1);
  }, [coverPage, fromNotification, initialStep, playbook, stepIndex, truthBeats.length]);

  useEffect(() => {
    if (truthBeats.length === 0) {
      setTruthBeatIndex(0);
      return;
    }

    setTruthBeatIndex(current => Math.min(current, truthBeats.length - 1));
  }, [truthBeats.length]);

  const loadRefinementUsage = useCallback(() => {
    if (!userId) {
      setRefinementCount(0);
      setRefinementLimit(0);
      setRefinementUpgradeTier('growth');
      setRefinementResetLabel(getRefinementResetLabel(null));
      setRefinementCurrentTier('seeker');
      setRefinementTrialChosenTier(undefined);
      return;
    }

    NewSubscriptionService.getUserSubscription(userId)
      .then(subscription => {
        const limits = NewSubscriptionService.getTierLimits(subscription.tier, subscription);
        setRefinementCount((subscription as any).refinement_count || 0);
        setRefinementLimit(source === 'onboarding' ? 1 : limits.refinement_limit ?? 0);
        setRefinementUpgradeTier(getRefinementUpgradeTier(subscription));
        setRefinementResetLabel(getRefinementResetLabel(subscription));
        setRefinementCurrentTier(String(subscription.tier || 'seeker'));
        setRefinementTrialChosenTier(subscription.trial_chosen_tier);
      })
      .catch(() => {
        setRefinementCount(0);
        setRefinementLimit(0);
        setRefinementUpgradeTier('growth');
        setRefinementResetLabel(getRefinementResetLabel(null));
        setRefinementCurrentTier('seeker');
        setRefinementTrialChosenTier(undefined);
      });
  }, [source, userId]);

  useEffect(() => {
    loadRefinementUsage();
  }, [loadRefinementUsage]);

  useEffect(() => {
    if (!userId || !playbookId || !playbook) {
      return;
    }

    const activity = playbook.status === 'completed' ? 'playbook_revisited_completed' : 'playbook_opened';

    faithPointsService.hasActivityTodayForPlaybook(userId, activity, playbookId)
      .then(alreadyAwarded => {
        if (alreadyAwarded) {
          return;
        }

        return faithPointsService.awardPoints(userId, activity as any, {
          suppressNotification: true,
          source: 'playbook_open',
          playbookId,
          playbookTitle: playbook.title,
          status: playbook.status,
        });
      })
      .catch(error => {
        console.warn('Failed to award playbook open faith points', error);
      });
  }, [userId, playbookId, playbook]);

  // Load session state from AsyncStorage on mount / playbook change.
  // We gate rendering on sessionLoaded so child components always initialize
  // from the correct (AsyncStorage-hydrated) module-level vars.
  useEffect(() => {
    if (!playbookId) {
      setSessionLoaded(true);
      return;
    }

    AsyncStorage.getItem(getSessionKey(playbookId))
      .then(raw => {
        if (raw) {
          try {
            const session = JSON.parse(raw);
            persistedPlaybookId = playbookId;
            persistedCommittedSteps = session.committedSteps ?? {};
            persistedActionStepIndex = session.actionStepIndex ?? 0;
            persistedHasPrayed = session.hasPrayed ?? false;
            persistedHasRead = session.hasRead ?? false;
            persistedCompletionChoice = session.completionChoice ?? null;
            // Don't restore journalNudgeFired — always let the nudge run fresh
            journalNudgeFired = false;
            // If we navigated here with a specific action index, honor it instead of session
            if (initialActionIndex !== undefined && initialActionIndex >= 0) {
              persistedActionStepIndex = initialActionIndex;
            }
            setActionStepIndex(persistedActionStepIndex);
          } catch (_) {
            // Corrupted data — fall through to reset below
          }
        } else if (playbookId !== persistedPlaybookId) {
          // Different (or new) playbook — clear all state
          persistedPlaybookId = playbookId;
          persistedCommittedSteps = {};
          persistedActionStepIndex = initialActionIndex !== undefined && initialActionIndex >= 0
            ? initialActionIndex
            : 0;
          persistedHasPrayed = false;
          persistedHasRead = false;
          persistedCompletionChoice = null;
          journalNudgeFired = false;
          setActionStepIndex(persistedActionStepIndex);
        }
        setSessionLoaded(true);
      })
      .catch(() => {
        // Storage failure — still render with whatever state we have
        setSessionLoaded(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbookId]);

  // ── Slide animation between steps ──────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(0)).current;
  // Share button scales + fades in when completion page is reached
  const shareButtonAnim = useRef(new Animated.Value(0)).current;
  // Screen 0 next button animates in with fade + scale
  const screen0NextAnim = useRef(new Animated.Value(0)).current;
  // Scripture anchor (step 2) next button animates out when pressed
  const scriptureNextAnim = useRef(new Animated.Value(1)).current;
  // Prayer (step 4) next button animates in
  const prayerNextAnim = useRef(new Animated.Value(0)).current;
  // Create-post pill: bounces in on step entry, then collapses to icon after a delay
  const [showCreatePostPill, setShowCreatePostPill] = useState(false);
  const createPostLabelAnim = useRef(new Animated.Value(1)).current;
  const createPostEntranceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (stepIndex !== 1 || truthBeats.length === 0) {
      Animated.timing(createPostEntranceAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) { setShowCreatePostPill(false); }
      });
      return;
    }
    const entranceDelay = truthBeatIndex === 0 ? 1500 : 600;
    setShowCreatePostPill(true);
    createPostLabelAnim.setValue(1);
    createPostEntranceAnim.setValue(0);
    const entranceAnimation = Animated.spring(createPostEntranceAnim, {
      toValue: 1,
      tension: 60,
      friction: 6,
      delay: entranceDelay,
      useNativeDriver: true,
    });
    entranceAnimation.start();
    const collapseTimer = setTimeout(() => {
      Animated.timing(createPostLabelAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, entranceDelay + 3600);
    return () => {
      entranceAnimation.stop();
      clearTimeout(collapseTimer);
    };
  // Keep the control mounted as the user moves between Truth in Love pages.
  // The page index is sampled only when entering this section to choose the initial delay.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, createPostLabelAnim, createPostEntranceAnim, truthBeats.length]);


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

  // Animate the cover/screen 0 next button
  useEffect(() => {
    if (stepIndex === COVER_STEP_INDEX || stepIndex === 0) {
      screen0NextAnim.setValue(0);
      Animated.parallel([
        Animated.spring(screen0NextAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          delay: 800,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      screen0NextAnim.setValue(0);
    }
  }, [stepIndex, screen0NextAnim]);


  // Reset journalCollapseComplete when journal expands
  useEffect(() => {
    if (journalExpanded) {
      setJournalCollapseComplete(false);
    }
  }, [journalExpanded]);

  // Reset scriptureNextAnim when not on step 2
  useEffect(() => {
    if (stepIndex !== 2) {
      scriptureNextAnim.setValue(1);
    }
  }, [stepIndex, scriptureNextAnim]);

  // Animate prayerNextAnim when entering step 4
  useEffect(() => {
    if (stepIndex === 4) {
      prayerNextAnim.setValue(0);
      Animated.spring(prayerNextAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        delay: 400,
        useNativeDriver: true,
      }).start();
    } else {
      prayerNextAnim.setValue(0);
    }
  }, [stepIndex, prayerNextAnim]);

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

  const handleExportPDF = useCallback(async () => {
    // Check feature access
    if (!pdfExportAccess.hasAccess) {
      const upgradePrompt = pdfExportAccess.accessResult?.upgradePrompt;
      const upgradeMessage = typeof upgradePrompt?.message === 'string'
        ? upgradePrompt.message
        : typeof upgradePrompt === 'object' && upgradePrompt?.message
          ? (upgradePrompt as any).message
          : PDF_EXPORT_UPGRADE_PROMPT;

      Alert.alert(
        'Upgrade Required',
        upgradeMessage,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Upgrade',
            onPress: () => {
              (navigation as any).navigate('OnboardingSalesOffer' as any, {
                upgradeMode: true,
                currentTier: pdfExportAccess.accessResult?.requiredTier,
                skipNotificationPreference: true,
                featureType: 'export_pdf',
                source: 'playbook_walkthrough',
              });
            },
          },
        ]
      );
      return;
    }

    if (!playbook) { return; }

    // Get user metadata for name replacement
    const metaFirstName = getUserFirstName(user);
    const metaDisplayName = getUserDisplayName(user);

    // Get bible version from user preferences or default to NASB
    const bibleVersion = (user as any)?.user_metadata?.preferences?.content?.bibleVersion || 'NASB';

    pdfExportService.exportPlaybookPDF({
      title: playbook.title,
      truthInLove: replaceAllNamePlaceholders(
        typeof playbook.truthInLove === 'string' ? playbook.truthInLove : playbook.truthInLove?.text || '',
        { firstName: metaFirstName, displayName: metaDisplayName },
        { replaceHardcodedNames: false }
      ),
      truthInLoveSummary: replaceAllNamePlaceholders(
        typeof playbook.truthInLove === 'string' ? '' : playbook.truthInLove?.summary || '',
        { firstName: metaFirstName, displayName: metaDisplayName },
        { replaceHardcodedNames: false }
      ),
      bibleVerse: {
        ...playbook.bibleVerse,
        version: bibleVersion,
      },
      bibleVerseReflection: playbook.bibleVerseReflection || '',
      actionSteps: playbook.actionSteps?.map(step => {
        // Derive examples similar to ActionStepsCard
        let examples: string[] = [];

        const rawExamples: any = (step as any).examples;

        if (rawExamples && typeof rawExamples === 'string') {
          if (ACTION_EXAMPLE_MARKER_REGEX.test(rawExamples)) {
            const exampleMatches = rawExamples
              .split(ACTION_EXAMPLE_MARKER_REGEX)
              .slice(1)
              .filter((text: string) => text.trim().length > 0);
            examples = exampleMatches.map((ex: string) => ex.trim());
            const preferredExample = examples.find((ex: string) => /^["“]/.test(ex.trim())) || examples[0];
            examples = preferredExample ? [preferredExample] : [];
          } else if (rawExamples.includes(';')) {
            examples = rawExamples
              .split(';')
              .map((ex: string) => ex.trim())
              .filter(Boolean);
          } else if (rawExamples.trim()) {
            examples = [rawExamples.trim()];
          }
        } else if (Array.isArray(rawExamples)) {
          examples = rawExamples.map((ex: string) => ex.replace(/^"+|"+$/g, '').replace(/^Example:\s*/i, '').trim());
        } else if (step.subTasks && step.subTasks.length > 0) {
          // Extract examples from subtasks that have is_example flag OR start with "example:"
          examples = step.subTasks
            .filter((st: any) =>
              (typeof st.text === 'string' && st.text.toLowerCase().startsWith('example:')) ||
              st.is_example === true ||
              st.isExample === true
            )
            .map((st: any) => st.text.replace(/^Example:\s*/i, '').trim());
        }

        return {
          title: step.title,
          description: step.description || '',
          subtasks: step.subTasks?.map((st: any) => st.text || st.title || st) || [],
          examples,
        };
      }),
      affirmations: playbook.affirmations?.map(a =>
        replaceAllNamePlaceholders(
          a.text,
          { firstName: metaFirstName, displayName: metaDisplayName },
          { replaceHardcodedNames: true }
        )
      ) || [],
      prayer: playbook.prayer || '',
      wordsToSpeak: playbook.wordToSpeak || '',
      directChallenge: replaceAllNamePlaceholders(
        typeof playbook.directChallenge === 'string' ? playbook.directChallenge : playbook.directChallenge?.text || '',
        { firstName: metaFirstName, displayName: metaDisplayName },
        { replaceHardcodedNames: true }
      ),
      createdAt: playbook.createdAt,
    });
  }, [playbook, user, pdfExportAccess, navigation]);

  const handleRefinePlaybook = useCallback(async (
    correctionType: PlaybookCorrectionType,
    clarificationInput: string
  ): Promise<boolean> => {
    if (!playbook?.id || !userId) {
      Alert.alert('Unable to refine', 'This playbook is still loading.');
      return false;
    }

    const clarification = clarificationInput.trim();
    if (clarification.length < 8) {
      Alert.alert('Add a little more', 'Share what siFia missed before refining this playbook.');
      return false;
    }

    setIsRefining(true);
    try {
      const metadata = (user as any)?.user_metadata || {};
      const dateOfBirth = metadata.birth_date || metadata.dateOfBirth || metadata.birthDate;
      const result = await refinePlaybook({
        playbookId: playbook.id,
        userId,
        userName: userName || 'Friend',
        correctionType,
        clarification,
        dateOfBirth,
        isOnboarding: source === 'onboarding',
        isBeatBased: truthBeats.length > 0,
      });

      setRefinedPlaybookOverride(result.playbook as any);
      setRefinementCount(result.refinementCount);
      setRefinementLimit(result.refinementLimit);
      setStepIndex(getPlaybookCover(result.playbook) ? COVER_STEP_INDEX : 0);
      setActionStepIndex(0);
      setTruthBeatIndex(0);

      persistedCommittedSteps = {};
      persistedActionStepIndex = 0;
      persistedHasPrayed = false;
      persistedHasRead = false;
      persistedCompletionChoice = null;
      if (playbook.id) {
        clearSessionStorage(playbook.id);
      }

      queryClient.invalidateQueries({ queryKey: ['playbook', playbook.id, userId] });
      queryClient.invalidateQueries({ queryKey: ['playbooks', userId, 'lightweight'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
      DeviceEventEmitter.emit('playbook_refined', { playbookId: playbook.id });
      DeviceEventEmitter.emit('playbookProgressUpdate', { playbookId: playbook.id });
      triggerSuccessHaptic();
      Alert.alert('Playbook refined', 'siFia revised this playbook with your clarification.');
      return true;
    } catch (error: any) {
      const message = error?.code === 'REFINEMENT_LIMIT_REACHED'
        ? error.message || 'You have used your playbook refinements this month.'
        : error?.message || 'siFia could not revise this playbook right now. Your current playbook is still here. Please try again in a moment.';
      Alert.alert('Could not refine playbook', message);
      return false;
    } finally {
      setIsRefining(false);
    }
  }, [playbook, userId, user, userName, queryClient, source, truthBeats]);

  const handleFinish = useCallback(async () => {
    triggerMediumHaptic();

    // Clear persisted state immediately
    if (persistedPlaybookId) { clearSessionStorage(persistedPlaybookId); }
    persistedPlaybookId = undefined;
    persistedCommittedSteps = {};
    persistedActionStepIndex = 0;
    persistedHasPrayed = false;
    persistedHasRead = false;
    journalNudgeFired = false;

    if (source === 'onboarding' && userId) {
      try {
        await NewSubscriptionService.resetOnboardingAssistCounters(userId);
        queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
        DeviceEventEmitter.emit('wisdomUsageReset', { wisdomCount: 0 });
      } catch (error) {
        console.warn('Failed to replenish onboarding assist counters after walkthrough', error);
      }
    }

    // Perform async operations in background without blocking navigation
    (async () => {
      // Mark the playbook as completed now that the user pressed Save & Finish
      if (playbookId) {
        updatePlaybookStatus(playbookId, 'completed').catch(() => {});
        try {
          const alreadyAwarded = await faithPointsService.hasActivityTodayForPlaybook(userId, 'playbook_completed', playbookId);
          if (!alreadyAwarded) {
            await faithPointsService.awardPoints(userId, 'playbook_completed', {
              suppressNotification: true,
              skipReviewPrompt: source === 'onboarding',
              source: 'playbook_completion',
              playbookId,
              playbookTitle: playbook?.title,
            });
          }
        } catch (error) {
          console.warn('Failed to award playbook completion faith points', error);
        }
        // Optimistically update query cache so list reflects completion immediately
        queryClient.invalidateQueries({ queryKey: ['playbooks', userId, 'lightweight'] });
      }
    })();

    // Navigate immediately without waiting for async operations
    const shouldShowStreakPlan = userId
      ? await visibleStreakService.shouldShowCelebration(userId, 'playbook_completed')
      : true;

    if (!shouldShowStreakPlan) {
      if (source === 'onboarding') {
        (navigation as any).navigate('OnboardingSalesOffer', {
          playbookId,
          source: 'playbook_walkthrough',
          onboardingFlow: true,
        });
      } else {
        navigation.goBack();
      }
      return;
    }

    if (source === 'onboarding') {
      // Onboarding flow: go to StreakPlanScreen with onboarding flag
      (navigation as any).navigate('StreakPlan', {
        playbookId,
        userId,
        source,
        onboarding: true,
      });
    } else {
      // Normal flow: StreakPlan Done should close both StreakPlan and this completed walkthrough.
      (navigation as any).navigate('StreakPlan', {
        playbookId,
        userId,
        source: 'playbook_walkthrough',
        dismissRouteCount: 2,
      });
    }
  }, [navigation, playbook?.title, playbookId, userId, queryClient, source]);

  const goNext = useCallback(() => {
    triggerLightHaptic();
    if (stepIndex === COVER_STEP_INDEX) {
      setTruthBeatIndex(0);
      animateStep(truthBeats.length > 0 ? 1 : 0, 'forward');
      return;
    }
    if (stepIndex === 1 && truthBeats.length > 0) {
      if (truthBeatIndex < truthBeats.length - 1) {
        setTruthBeatIndex(current => Math.min(current + 1, truthBeats.length - 1));
        return;
      }
      if (playbookId) {
        updateWalkthroughProgress(playbookId, stepIndex).catch(() => {});
      }
      animateStep(2, 'forward');
      return;
    }
    if (stepIndex < TOTAL_STEPS - 1) {
      // Record this step as completed (Next was pressed)
      if (playbookId && stepIndex >= 0) {
        updateWalkthroughProgress(playbookId, stepIndex).catch(() => {});
      }
      // Animate next button out on scripture anchor step (step 2)
      if (stepIndex === 2) {
        Animated.parallel([
          Animated.timing(scriptureNextAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Skip prayer step (4) if this playbook has no prayer
          const hasPrayer = (playbook?.prayer || '').length > 0;
          const next = !hasPrayer ? 3 : 3;
          animateStep(next, 'forward');
        });
      } else {
        // Collapse FAB when leaving Faithful Actions (step 3)
        if (stepIndex === 3) {
          Animated.spring(fabCollapseAnimRef.current, { toValue: 1, useNativeDriver: true, tension: 55, friction: 14 }).start();
        }
        // Skip prayer step (4) if this playbook has no prayer
        const hasPrayer = (playbook?.prayer || '').length > 0;
        const next = !hasPrayer && stepIndex === 3 ? 5 : stepIndex + 1;
        if (next === 1 && truthBeats.length > 0) {
          setTruthBeatIndex(0);
        }
        animateStep(next, 'forward');
      }
    }
  }, [stepIndex, animateStep, truthBeats.length, truthBeatIndex, playbookId, playbook?.prayer, scriptureNextAnim]);

  const goToScriptureFromTruth = useCallback(() => {
    if (playbookId) {
      updateWalkthroughProgress(playbookId, 1).catch(() => {});
    }
    animateStep(2, 'forward');
  }, [animateStep, playbookId]);

  const goBack = useCallback(() => {
    triggerLightHaptic();
    if (stepIndex === COVER_STEP_INDEX) {
      navigation.goBack();
    } else if (stepIndex === 0) {
      if (coverPage && initialStep === undefined && !fromNotification && playbook?.status !== 'completed') {
        animateStep(COVER_STEP_INDEX, 'back');
        return;
      }
      navigation.goBack();
    } else if (stepIndex === 1 && truthBeats.length > 0) {
      if (truthBeatIndex > 0) {
        setTruthBeatIndex(current => Math.max(0, current - 1));
        return;
      }
      if (coverPage && initialStep === undefined && !fromNotification && playbook?.status !== 'completed') {
        animateStep(COVER_STEP_INDEX, 'back');
        return;
      }
      navigation.goBack();
    } else {
      // Collapse FAB when leaving Faithful Actions (step 3) via back
      if (stepIndex === 3) {
        Animated.spring(fabCollapseAnimRef.current, { toValue: 1, useNativeDriver: true, tension: 55, friction: 14 }).start();
      }
      // Skip back over prayer step (4) if this playbook has no prayer
      const hasPrayer = (playbook?.prayer || '').length > 0;
      const prev = !hasPrayer && stepIndex === 5 ? 3 : stepIndex - 1;
      if (prev === 1 && truthBeats.length > 0) {
        setTruthBeatIndex(current => Math.min(current, truthBeats.length - 1));
      }
      animateStep(prev, 'back');
    }
  }, [stepIndex, animateStep, navigation, playbook?.prayer, coverPage, initialStep, fromNotification, playbook?.status, truthBeats.length, truthBeatIndex]);

  // Back within faithful actions sub-steps (or go to previous main step if at sub-step 0)
  const goBackActionStep = useCallback(() => {
    triggerLightHaptic();
    if (actionStepIndex > 0) {
      const prev = actionStepIndex - 1;
      persistedActionStepIndex = prev;
      setActionStepIndex(prev);
      saveCurrentSession();
    } else {
      goBack();
    }
  }, [actionStepIndex, goBack]);

  const prevStepIndexRef = useRef(stepIndex);
  useEffect(() => {
    const prevStep = prevStepIndexRef.current;
    // Expand FAB when entering Faithful Actions (step 3)
    if (stepIndex === 3 && prevStep !== 3) {
      Animated.spring(fabCollapseAnimRef.current, { toValue: 0, useNativeDriver: true, tension: 65, friction: 13 }).start();
    }
    prevStepIndexRef.current = stepIndex;
  }, [stepIndex]);

  // Animate FAB expansion on mount if starting on step 3
  useEffect(() => {
    if (stepIndex === 3) {
      const timer = setTimeout(() => {
        Animated.spring(fabCollapseAnimRef.current, { toValue: 0, useNativeDriver: true, tension: 65, friction: 13 }).start();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [stepIndex]);

  const handleSkipWalkthrough = useCallback(() => {
    if (source === 'onboarding') {
      triggerLightHaptic();
      // Skip walkthrough and go directly to trial offer
      (navigation as any).replace('OnboardingTrialOffer', {
        source: 'onboarding',
        skipNotificationPreference: true,
      });
    } else {
      // Normal flow: go back
      navigation.goBack();
    }
  }, [source, navigation]);

  // Swipe gesture handlers
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
        },
        onPanResponderRelease: (_, gestureState) => {
          const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
          const hasEnoughDistance = Math.abs(gestureState.dx) > SCREEN_WIDTH * 0.15;
          const hasEnoughVelocity = Math.abs(gestureState.vx) > 0.45;

          if (!isHorizontalSwipe || (!hasEnoughDistance && !hasEnoughVelocity)) {
            return;
          }

          if (gestureState.dx > 0) {
            // Swipe right - go back
            goBack();
            triggerMediumHaptic();
          } else if (gestureState.dx < 0) {
            // Swipe left - go next
            if (stepIndex < TOTAL_STEPS - 1) {
              goNext();
              triggerMediumHaptic();
            }
          }
        },
      }),
    [stepIndex, goBack, goNext]
  );

  // Show loading state while fetching the full playbook from DB or awaiting session load
  const loadingGatePassed = sessionLoaded && (!playbookId || positionLoadedFor === playbookId) && !isLoading && !(shouldFetch && !playbook);

  if (!loadingGatePassed) {
    return (
      <View style={{ flex: 1, backgroundColor: 'Colors.sage' }}>
        <StatusBar hidden={true} />
        <PlaybookSkeletonLoader
          variant={routeCoverPage ? 'cover' : 'legacy'}
          showClose={source !== 'onboarding'}
        />
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
  const userMetadata = (user as any)?.user_metadata || {};
  const dateOfBirth = userMetadata.birth_date || userMetadata.dateOfBirth || userMetadata.birthDate || '';
  const preferredBibleTranslation = userMetadata.preferences?.content?.bibleVersion || 'NASB';
  const truthInLoveText = personalizeTruthContent(
    typeof playbook.truthInLove === 'string'
      ? playbook.truthInLove
      : playbook.truthInLove?.text || '',
    userName
  );
  const truthInLoveSummary = personalizeTruthContent(
    typeof playbook.truthInLove === 'string'
      ? ''
      : playbook.truthInLove?.summary || '',
    userName
  );
  const prayerText = playbook.prayer || '';

  const transitionLine: string = playbook.transitionLine?.trim() || '';

  const wordToSpeak =
    playbook.wordToSpeak ||
    (Array.isArray((playbook as any).wordsToSpeak) && (playbook as any).wordsToSpeak.length > 0
      ? (playbook as any).wordsToSpeak.join('\n')
      : (playbook.affirmations && playbook.affirmations.length > 0
          ? playbook.affirmations.map((a: any) => a.text).join('\n')
          : ''));

  const isBeatBased = truthBeats.length > 0;
  const pastoralClosing = playbook.challengeCTA || '';
  const closingText = isBeatBased
    ? ''
    : getDirectChallengeText(playbook.directChallenge) ||
      'Carry what God has shown you into the room.';
  const showSafetyHelp = isSelfHarmCrisisPlaybook([
    playbook.title,
    playbook.category,
    playbook.userInput,
    truthInLoveSummary,
    truthInLoveText,
    playbook.bibleVerse?.reference,
    playbook.bibleVerse?.text,
    playbook.prayer,
    (playbook as any).closing,
    ...(playbook.actionSteps || []).flatMap((step: any) => [
      step?.title,
      step?.description,
      ...(step?.subTasks || []).map((subTask: any) => subTask?.text || subTask?.title || String(subTask || '')),
    ]),
  ]);

  // Completion, Faithful Actions, and beat-based Truth in Love handle their own CTAs.
  const hasFloatingNext =
    stepIndex !== COVER_STEP_INDEX &&
    stepIndex !== 6 &&
    stepIndex !== 3 &&
    !(stepIndex === 0 && truthBeats.length > 0) &&
    !(stepIndex === 1 && truthBeats.length > 0);

  return (
    <>
    <StatusBar hidden />
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Step content */}
      {/* Animated slide container */}
      <Animated.View
        style={[styles.stepContainer, { transform: [{ translateX: slideAnim }] }]}
      >
            {stepIndex === COVER_STEP_INDEX && coverPage && (
              <CoverStep
                cover={coverPage}
                userInput={playbook.userInput}
                refinementNote={playbook.latestRefinementNote}
                onBegin={goNext}
                onEditUserInput={() => {
                  navigation.navigate('UserInput' as any, { initialText: playbook.userInput });
                }}
                insets={insets}
              />
            )}

            {stepIndex === 0 && truthBeats.length === 0 && (
              <EnterMomentStep
                title={playbook.title}
                userInput={playbook.userInput}
                refinementNote={playbook.latestRefinementNote}
                summary={truthInLoveSummary}
                userName={userName}
                transitionLine={transitionLine}
                showSafetyHelp={showSafetyHelp}
                showInputToggle={!coverPage}
                showSummary={truthBeats.length === 0}
                onContinue={goNext}
                onEditUserInput={() => {
                  navigation.navigate('UserInput' as any, { initialText: playbook.userInput });
                }}
                insets={insets}
              />
            )}

            {stepIndex === 1 && (
              <TruthInLoveStep
                text={truthInLoveText}
                userName={userName}
                beats={truthBeats}
                truthToCarry={truthToCarry}
                beatIndex={truthBeatIndex}
                showSafetyHelp={showSafetyHelp}
                onNext={goNext}
                onBeatNext={goNext}
                onBeatBack={goBack}
                onGoToScripture={goToScriptureFromTruth}
                bibleVersion={preferredBibleTranslation}
                onOpenRefinement={() => {
                  triggerLightHaptic();
                  setRefinementOpen(true);
                }}
                onShareReflection={(reflectionText, options) => {
                  setShareReflectionText(reflectionText);
                  setShareTextColor(undefined);
                  setShareLineHeightMultiplier(undefined);
                  setShareNoSplit(options?.noSplit);
                  setShowTruthShareComposer(true);
                }}
                onShareScripture={scriptureText => {
                  setShareReflectionText(scriptureText);
                  setShareTextColor(Colors.alertCoral);
                  setShareLineHeightMultiplier(undefined);
                  setShareNoSplit(undefined);
                  setShowTruthShareComposer(true);
                }}
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
                onShareScripture={scriptureText => {
                  setShareReflectionText(scriptureText);
                  setShareTextColor(Colors.alertCoral);
                  setShareLineHeightMultiplier(undefined);
                  setShareNoSplit(undefined);
                  setShowTruthShareComposer(true);
                }}
                insets={insets}
              />
            )}

            {stepIndex === 3 && (
              <FaithfulActionsStep
                steps={playbook.actionSteps || []}
                intro={playbook.faithfulActionsIntro}
                playbookId={playbook.id}
                playbookTitle={playbook.title}
                playbookStatus={playbook.status}
                truthSummary={truthInLoveSummary}
                truthInLove={truthInLoveText}
                dateOfBirth={dateOfBirth}
                preferredBibleTranslation={preferredBibleTranslation}
                isOnboarding={source === 'onboarding'}
                userId={userId}
                onNext={goNext}
                onGoBack={goBackActionStep}
                insets={insets}
                actionStepIndex={actionStepIndex}
                setActionStepIndex={setActionStepIndex}
                onStepCommit={(stepIdx) => {
                  const stepId = playbook?.actionSteps?.[stepIdx]?.id;
                  if (!stepId) { return; }
                  updateActionStepCompleted(stepId).catch(() => {});
                  queryClient.invalidateQueries({ queryKey: ['playbooks', userId, 'lightweight'] });
                  queryClient.invalidateQueries({ queryKey: ['playbooks', userId] });
                  DeviceEventEmitter.emit('playbookProgressUpdate', { stepId, playbookId: playbook?.id });
                }}
                onJournalExpanded={setJournalExpanded}
                onJournalCollapseComplete={() => setJournalCollapseComplete(true)}
                navigation={navigation}
                collapseAnimRef={fabCollapseAnimRef}
              />
            )}

            {stepIndex === 4 && (
              <PrayerStep
                prayer={prayerText}
                playbookTitle={playbook.title}
                playbookId={playbook.id}
                userId={userId}
                onNext={goNext}
                onSharePrayer={prayerTextToShare => {
                  setShareReflectionText(prayerTextToShare);
                  setShareTextColor(Colors.hopeWhite);
                  setShareLineHeightMultiplier(undefined);
                  setShareNoSplit(true);
                  setShowTruthShareComposer(true);
                }}
                insets={insets}
              />
            )}

            {stepIndex === 5 && (
              <WordToSpeakStep
                word={wordToSpeak}
                playbookId={playbook.id}
                onNext={goNext}
                onShareWord={wordToShare => {
                  setShareReflectionText(wordToShare);
                  setShareTextColor(undefined);
                  setShareLineHeightMultiplier(undefined);
                  setShareNoSplit(true);
                  setShowTruthShareComposer(true);
                }}
                insets={insets}
              />
            )}

            {stepIndex === 6 && (
              <CompletionStep
                title={playbook.title}
                closingText={closingText}
                pastoralClosing={pastoralClosing}
                onFinish={handleFinish}
                insets={insets}
                isCompleted={routePlaybook?.status === 'completed'}
                isOnboarding={source === 'onboarding'}
                isBeatBased={isBeatBased}
                navigation={navigation}
                fromNotification={fromNotification}
              />
            )}
          </Animated.View>

      {/* Keep the close control visible independently of page entrance animations. */}
        <View
          style={[
            styles.closeButton,
            { top: insets.top + 8 },
          ]}
        >
          <TouchableOpacity
            onPress={source === 'onboarding' ? handleSkipWalkthrough : () => { triggerLightHaptic(); navigation.goBack(); }}
            accessibilityRole="button"
            accessibilityLabel="Close playbook walkthrough"
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={source === 'onboarding' ? 'close-outline' : 'close'} size={17} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>
        </View>

      {/* Create post — top right, Truth in Love beat pages only */}
      {showCreatePostPill && (
        <Animated.View
          style={[
            styles.truthCreatePostFloating,
            { top: insets.top + 8 },
            {
              opacity: createPostEntranceAnim,
              transform: [
                { translateX: createPostEntranceAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
                { scale: createPostEntranceAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
              ],
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Create post from primary and supporting truth"
            activeOpacity={0.72}
            style={styles.truthCreatePostPill}
            onPress={() => {
              triggerLightHaptic();
              setShareReflectionText(buildTruthPostText(currentTruthBeatPrimary, currentTruthBeatSupporting, userName));
              setShareTextColor(undefined);
              setShareLineHeightMultiplier(undefined);
              setShareNoSplit(undefined);
              setShowTruthShareComposer(true);
            }}
          >
            <MaterialCommunityIcons name="star-four-points" size={16} color={Colors.faithGold} />
            <Animated.View
              style={{
                overflow: 'hidden',
                opacity: createPostLabelAnim,
                maxWidth: createPostLabelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 90] }),
                marginLeft: createPostLabelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 7] }),
              }}
            >
              <ThemedText weight="semiBold" style={styles.truthCreatePostText} numberOfLines={1}>Create post</ThemedText>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Animated share button — top left, completion page only */}
      {stepIndex === 6 && (
        <>
          <Animated.View
            style={[
              styles.closeButton,
              { top: insets.top + 8, right: 70 },
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
              onPress={() => {
                triggerLightHaptic();
                setShowShareDropdown(true);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="paper-plane-outline" size={17} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>
          </Animated.View>
        </>
      )}


      <FloatingRefinementControl
        open={refinementOpen && stepIndex === 1}
        onClose={() => setRefinementOpen(false)}
        isRefining={isRefining}
        refinementsRemaining={refinementsRemaining}
        upgradeTier={refinementUpgradeTier}
        resetDateLabel={refinementResetLabel}
        insets={insets}
        onRefineSubmit={handleRefinePlaybook}
        onUpgrade={() => {
          if (!refinementUpgradeTier) { return; }
          setRefinementOpen(false);
          navigation.navigate('OnboardingSalesOffer' as any, {
            upgradeMode: true,
            source: 'refinement_limit',
            feature: 'refinement',
            featureType: 'refinement',
            currentTier: refinementCurrentTier,
            currentTrialChosenTier: refinementTrialChosenTier,
            selectedTier: refinementUpgradeTier,
            skipNotificationPreference: true,
            dismissBehavior: 'goBack',
          });
        }}
      />


      {/* Floating coral next button — bottom right */}
      {hasFloatingNext && (
        <Animated.View
          style={[
            styles.nextButton,
            { bottom: insets.bottom + 20 },
            {
              opacity: stepIndex === 0 ? screen0NextAnim : stepIndex === 2 ? scriptureNextAnim : stepIndex === 4 ? prayerNextAnim : 1,
              transform: [
                {
                  scale: stepIndex === 0 ? screen0NextAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }) : stepIndex === 2 ? scriptureNextAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }) : stepIndex === 4 ? prayerNextAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }) : 1,
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            onPress={goNext}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>

    <ShareDropdownModal
      visible={showShareDropdown}
      onClose={() => setShowShareDropdown(false)}
      onExportPDF={handleExportPDF}
      playbookTitle={playbook?.title}
    />

    <TruthToCarryShareComposer
      visible={showTruthShareComposer}
      text={shareReflectionText}
      textColor={shareTextColor}
      lineHeightMultiplier={shareLineHeightMultiplier}
      noSplit={shareNoSplit}
      userId={userId}
      onClose={() => setShowTruthShareComposer(false)}
      onUpgrade={() => {
        navigation.navigate('OnboardingSalesOffer', {
          upgradeMode: true,
          currentTier: 'seeker',
          selectedTier: 'growth',
          source: 'sifia_reflection_watermark',
          feature: 'remove_share_watermark',
          skipNotificationPreference: true,
          dismissBehavior: 'goBack',
        });
      }}
    />

    {/* Onboarding-only "Your playbook is ready" overlay — appears once */}
    <PlaybookReadyOverlay
      visible={showReadyOverlay}
      onDismiss={handleDismissReadyOverlay}
    />
    </>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.sage,
  },
  // Dots — matches original PlaybookDetailGuided pagination style
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 10,
    backgroundColor: Colors.sage,
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
  // Back button below skip button — aligned with close button
  backButtonBelowSkip: {
    position: 'absolute',
    right: -8,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 999,
    top: 56,
  },
  // Onboarding-specific UI
  onboardingTopBar: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 100,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  skipButtonText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  progressIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 20,
  },
  progressText: {
    fontSize: 14,
    color: Colors.alertCoral,
    fontWeight: '600',
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
    shadowColor: '#29342E',
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
  stepContentPad: {
    paddingHorizontal: 96,
  },

  // Cover
  coverContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    minHeight: SCREEN_HEIGHT,
    justifyContent: 'space-between',
  },
  coverCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 34,
  },
  coverInputToggle: {
    width: '100%',
    marginBottom: 14,
  },
  coverTextBlock: {
    width: '100%',
    alignItems: 'center',
  },
  coverKicker: {
    fontSize: 11,
    letterSpacing: 0,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
  },
  coverTitle: {
    width: '100%',
    fontSize: 31,
    color: Colors.hopeWhite,
    lineHeight: 39,
    textAlign: 'center',
    marginTop: 22,
    flexShrink: 1,
  },
  coverSubtitle: {
    width: '100%',
    fontSize: 17,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 25,
    textAlign: 'center',
    marginTop: 18,
    flexShrink: 1,
  },
  coverTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginTop: 24,
  },
  coverTimeText: {
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.72)',
  },
  coverButtonBlock: {
    width: '100%',
  },
  coverBeginButton: {
    alignSelf: 'stretch',
    minHeight: 54,
    marginTop: 28,
  },

  // Enter the Moment
  playbookLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 32,
  },
  playbookLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.hopeWhite,
  },
  userInputCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  userInputText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  refinedInputBlock: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    marginTop: 12,
    paddingTop: 12,
  },
  refinedInputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  refinedInputLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.72)',
  },
  refinedInputText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 20,
  },
  title: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 22,
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
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 34,
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
    fontSize: 18,
    color: Colors.hopeWhite,
    lineHeight: 26,
    opacity: 0.9,
  },
  truthBeatCounter: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 18,
    marginTop: 18,
  },
  truthBeatProgressBar: {
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 32,
  },
  truthBeatProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.alertCoral,
  },
  truthBeatShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  truthBeatShellQuiet: {
    opacity: 0.9,
  },
  truthBeatIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,107,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.22)',
  },
  truthBeatLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.74)',
  },
  truthBeatPrimary: {
    fontSize: 28,
    lineHeight: 36,
    color: Colors.hopeWhite,
  },
  truthBeatSupporting: {
    fontSize: 17,
    lineHeight: 25,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 22,
  },
  truthCreatePostFloating: {
    position: 'absolute',
    right: 70,
    height: 42,
    justifyContent: 'center',
    zIndex: 100,
  },
  truthCreatePostPill: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.28)',
    backgroundColor: 'rgba(232,184,109,0.10)',
  },
  truthCreatePostText: {
    color: Colors.faithGold,
    fontSize: 13,
    lineHeight: 18,
  },
  truthBeatBlockGap: {
    gap: 10,
    marginTop: 22,
  },
  truthContrastCard: {
    borderRadius: 8,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  truthContrastCardAffirm: {
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderColor: 'rgba(255,107,107,0.22)',
  },
  truthContrastLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.faithGold,
    marginBottom: 8,
  },
  truthContrastLabelAffirm: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.faithGold,
    marginBottom: 8,
  },
  truthContrastText: {
    fontSize: 16,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.84)',
  },
  truthBoundaryCard: {
    borderRadius: 8,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  truthBoundaryLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.faithGold,
    marginBottom: 8,
  },
  truthBoundaryText: {
    fontSize: 16,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.84)',
  },
  truthTwoCards: {
    gap: 10,
    marginTop: 22,
  },
  truthTwoCard: {
    borderRadius: 8,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  truthTwoLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.faithGold,
    marginBottom: 8,
  },
  truthTwoText: {
    fontSize: 16,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.84)',
  },
  truthQuestionsBlock: {
    gap: 10,
    marginTop: 22,
    borderRadius: 8,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  truthQuestionsLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.faithGold,
  },
  truthQuestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  truthQuestionMark: {
    width: 22,
    fontSize: 17,
    lineHeight: 23,
    color: Colors.alertCoral,
    textAlign: 'center',
  },
  truthQuestionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.84)',
  },
  truthQuestionTextContainer: {
    flex: 1,
    width: undefined,
  },
  truthScriptureBackingLayer: {
    marginTop: 18,
    alignSelf: 'stretch',
  },
  truthScriptureBackingHeader: {
    alignSelf: 'flex-start',
    minHeight: 32,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  truthScriptureBackingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  truthScriptureBackingTitle: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.faithGold,
    letterSpacing: 0.8,
  },
  truthScriptureBackingBody: {
    marginTop: 7,
    paddingLeft: 12,
    paddingRight: 4,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,204,102,0.38)',
  },
  truthScriptureBackingEyebrow: {
    marginBottom: 4,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.9,
    color: 'rgba(255,204,102,0.74)',
  },
  truthScripturePassage: {
    paddingVertical: 8,
  },
  truthScripturePassageDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  truthScriptureReference: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.faithGold,
  },
  truthScriptureReferenceRow: {
    minHeight: 28,
    marginBottom: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  truthScriptureReadButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  truthScriptureBackingText: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.74)',
  },
  truthRevealButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  truthRevealButtonText: {
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.74)',
  },
  truthRevealCard: {
    borderRadius: 8,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginTop: 12,
  },
  truthRevealText: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.78)',
  },
  truthBeatPrimaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
  },
  truthUntangleCard: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 10,
  },
  truthUntangleCardAlt: {
    backgroundColor: 'rgba(255,107,107,0.10)',
    borderColor: 'rgba(255,107,107,0.26)',
  },
  truthUntangleLabel: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(150,190,255,0.95)',
    marginBottom: 6,
  },
  truthUntangleLabelAlt: {
    color: 'rgba(255,140,140,0.95)',
  },
  truthUntangleText: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.86)',
  },
  truthUntangleVersusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    marginTop: -2,
  },
  truthUntangleVersusLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  truthUntangleVersus: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
  },
  truthPathColumns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  truthPathColumn: {
    flex: 1,
    alignItems: 'center',
  },
  truthPathColumnSpacer: {
    width: 10,
  },
  truthPathColumnTitle: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 10,
    textAlign: 'center',
  },
  truthPathColumnTitleAlt: {
    color: 'rgba(120,210,180,0.95)',
  },
  truthPathSteps: {
    width: '100%',
    alignItems: 'center',
  },
  truthPathStep: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    width: '100%',
    alignItems: 'center',
    marginBottom: 4,
  },
  truthPathStepAlt: {
    backgroundColor: 'rgba(120,210,180,0.10)',
    borderColor: 'rgba(120,210,180,0.22)',
  },
  truthPathStepSelected: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.40)',
  },
  truthPathStepText: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.84)',
    textAlign: 'center',
  },
  truthPathStepTextSelected: {
    color: 'rgba(255,255,255,1)',
    fontWeight: '600',
  },
  truthPathArrow: {
    marginVertical: 4,
  },
  truthPathReflectBlock: {
    marginTop: 18,
    borderRadius: 10,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  truthPathReflectLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.70)',
    textAlign: 'center',
  },
  truthHoldEntrustRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  truthHoldEntrustCard: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  truthHoldEntrustCardAlt: {
    backgroundColor: 'rgba(120,170,255,0.08)',
    borderColor: 'rgba(120,170,255,0.22)',
  },
  truthHoldEntrustCardSelected: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.45)',
  },
  truthHoldEntrustCardSelectedAlt: {
    backgroundColor: 'rgba(120,170,255,0.16)',
    borderColor: 'rgba(120,170,255,0.45)',
  },
  truthHoldEntrustLabel: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.60)',
    textAlign: 'center',
    marginBottom: 8,
  },
  truthHoldEntrustLabelAlt: {
    color: 'rgba(150,190,255,0.95)',
  },
  truthHoldEntrustText: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.84)',
    textAlign: 'center',
  },
  truthHoldEntrustTextAlt: {
    color: 'rgba(255,255,255,0.84)',
  },
  truthHoldEntrustTextSelected: {
    color: 'rgba(255,255,255,1)',
    fontWeight: '600',
  },
  truthHoldEntrustTextSelectedAlt: {
    color: 'rgba(255,255,255,1)',
    fontWeight: '600',
  },
  truthHoldEntrustCheck: {
    marginTop: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  truthHandoffBlock: {
    marginTop: 18,
    borderRadius: 10,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  truthHandoffLabel: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(150,190,255,0.95)',
    textAlign: 'center',
    marginBottom: 8,
  },
  truthHandoffBody: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
  },
  truthUntangleRow: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 8,
  },
  truthUntangleRowOpen: {
    backgroundColor: 'rgba(120,170,255,0.08)',
    borderColor: 'rgba(120,170,255,0.24)',
  },
  truthUntangleRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  truthCarryCard: {
    borderRadius: 8,
    padding: 16,
    marginTop: 26,
    backgroundColor: 'rgba(255,204,102,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,204,102,0.22)',
  },
  truthCarryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  truthCarryLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.faithGold,
  },
  truthCarryText: {
    fontSize: 18,
    lineHeight: 26,
    color: Colors.hopeWhite,
  },
  truthBeatNav: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 56,
    zIndex: 95,
  },
  truthBeatNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  truthBeatNavRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  truthBeatNavCollapsedCircle: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  truthBeatNavCollapsedTouchable: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(38, 71, 119, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  truthBeatRefineButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'Colors.sage',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  truthBeatRefineButtonText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.hopeWhite,
    opacity: 0.9,
  },
  truthBeatIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'Colors.sage',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  truthBeatPrimaryButton: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.alertCoral,
    borderRadius: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 0,
  },
  truthBeatScriptureLink: {
    minWidth: 104,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'Colors.sage',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  truthBeatScriptureLinkText: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.hopeWhite,
  },
  truthScriptureConfirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 115,
    justifyContent: 'flex-end',
  },
  truthScriptureConfirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  truthScriptureConfirmSheet: {
    marginHorizontal: 0,
    marginBottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: Colors.sage,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingTop: 22,
    paddingHorizontal: 18,
    gap: 12,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 12,
  },
  truthScriptureConfirmTitle: {
    fontSize: 19,
    lineHeight: 25,
    color: Colors.hopeWhite,
  },
  truthScriptureConfirmText: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.72)',
  },
  truthScriptureConfirmPrimary: {
    height: 46,
    borderRadius: 23,
    backgroundColor: 'Colors.sage',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 4,
  },
  truthScriptureConfirmPrimaryText: {
    fontSize: 15,
    lineHeight: 20,
    color: Colors.hopeWhite,
  },
  truthScriptureConfirmSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  truthScriptureConfirmSecondaryText: {
    fontSize: 14,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.68)',
  },
  crisisHelpOnMoment: {
    marginTop: 2,
    marginBottom: 6,
  },
  crisisHelpOnTruth: {
    marginTop: 18,
    marginBottom: 2,
  },
  crisisHelpContainer: {
    gap: 10,
  },
  crisisHelpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  crisisHelpHeaderText: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.7,
    color: Colors.alertCoral,
    textTransform: 'uppercase',
  },
  crisisHelpPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  crisisHelpPill: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,107,107,0.14)',
  },
  crisisHelpPillText: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.88)',
  },
  refinementBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  floatingRefinementButtonWrap: {
    position: 'absolute',
    right: 72,
    zIndex: 130,
  },
  floatingRefinementButton: {
    minHeight: 40,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'Colors.sage',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#29342E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.24,
        shadowRadius: 8,
      },
      android: {
        elevation: 7,
      },
    }),
  },
  floatingRefinementButtonOpen: {
    backgroundColor: 'rgba(230, 90, 70, 0.28)',
    borderColor: 'rgba(230, 90, 70, 0.48)',
  },
  floatingRefinementButtonText: {
    color: Colors.hopeWhite,
    fontSize: 13,
  },
  floatingRefinementPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 125,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: Colors.sage,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingTop: 18,
    paddingHorizontal: 20,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 10,
  },
  floatingRefinementHeader: {
    paddingHorizontal: 2,
    paddingBottom: 14,
  },
  refinementSheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  refinementSheetTitle: {
    flex: 1,
    fontSize: 19,
    lineHeight: 25,
    color: Colors.hopeWhite,
  },
  refinementSheetPrompt: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.68)',
    marginTop: 4,
  },
  floatingRefinementReasons: {
    gap: 8,
  },
  refinementCountBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexShrink: 0,
  },
  refinementCountBadgeText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    lineHeight: 14,
  },
  refinementExhaustedActions: {
    marginTop: 14,
  },
  refinementUpgradeButton: {
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.alertCoral,
  },
  refinementUpgradeButtonText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.hopeWhite,
  },
  refinementResetText: {
    marginTop: 12,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.62)',
  },
  refinementResetDateText: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.hopeWhite,
  },
  refinementReasonButton: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refinementReasonButtonSelected: {
    backgroundColor: 'rgba(230, 90, 70, 0.22)',
    borderColor: 'rgba(230, 90, 70, 0.58)',
  },
  refinementReasonButtonDisabled: {
    opacity: 0.62,
  },
  refinementReasonText: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  refinementReasonTextSelected: {
    color: Colors.hopeWhite,
  },
  refinementReasonRadio: {
    flexShrink: 0,
  },
  refinementFloatingInputBlock: {
    marginTop: 10,
  },
  refinementInput: {
    minHeight: 112,
    maxHeight: 170,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    color: Colors.hopeWhite,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  refinementSubmitButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: Colors.alertCoral,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  refinementSubmitButtonDisabled: {
    opacity: 0.52,
  },
  refinementSubmitButtonText: {
    color: Colors.hopeWhite,
    fontSize: 15,
  },

  // Scripture
  // alertCoral vertical bar on the left — blockquote style
  verseCard: {
    position: 'relative',
    paddingLeft: 18,
    paddingVertical: 4,
    marginTop: 28,
    marginBottom: 28,
  },
  verseRail: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 3,
    borderRadius: 999,
    backgroundColor: Colors.alertCoral,
  },
  verseRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
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
    marginHorizontal: 12,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 18,
    overflow: 'hidden',
  },
  notesActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: -8,
    marginBottom: 16,
  },
  scriptureNoteItem: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  scriptureNoteDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  reflectionNote: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
    opacity: 0.5,
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
    marginBottom: 2,
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
    fontSize: 16,
    color: 'rgba(255,255,255,0.80)',
    lineHeight: 24,
    marginBottom: 2,
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
  bodyScriptBlock: {
    position: 'relative',
    marginTop: 12,
    marginBottom: 14,
    paddingLeft: 18,
    paddingVertical: 10,
    paddingRight: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,204,102,0.06)',
  },
  bodyScriptBlockMessage: {
    marginTop: 6,
    marginBottom: 6,
    paddingLeft: 16,
    paddingVertical: 8,
    paddingRight: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,204,102,0.12)',
  },
  bodyScriptRail: {
    position: 'absolute',
    left: 3,
    top: 12,
    bottom: 12,
    width: 4,
    alignItems: 'center',
  },
  bodyScriptRailLine: {
    width: 2,
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.faithGold,
  },
  bodyScriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  bodyScriptLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: Colors.faithGold,
    letterSpacing: 0.4,
  },
  bodyScriptText: {
    fontSize: 16,
    color: Colors.faithGold,
    lineHeight: 24,
    paddingTop: 0,
    paddingBottom: 0,
  },
  bodyScriptTextMessage: {
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 23,
  },
  bodyQuoteBubble: {
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,204,102,0.12)',
  },
  bodyQuoteBubbleText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 23,
    paddingTop: 0,
    paddingBottom: 0,
  },
  bodyAskHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
    marginBottom: 2,
  },
  bodyAskLabel: {
    fontSize: 12,
    color: 'rgba(255,204,102,0.78)',
    lineHeight: 15,
    letterSpacing: 0.25,
  },
  actionQuestionGroup: {
    marginTop: 5,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,204,102,0.18)',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.045)',
    overflow: 'hidden',
  },
  actionQuestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 13,
  },
  actionQuestionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  actionQuestionNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,204,102,0.14)',
    flexShrink: 0,
  },
  actionQuestionNumberText: {
    fontSize: 11,
    lineHeight: 14,
    color: Colors.faithGold,
  },
  actionQuestionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.88)',
  },
  bodyQuestionRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    marginTop: 4,
    paddingLeft: 2,
  },
  bodyQuestionMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    overflow: 'hidden' as const,
    textAlign: 'center' as const,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.faithGold,
    backgroundColor: 'rgba(255,204,102,0.12)',
  },
  bodyQuestionText: {
    flex: 1,
    fontSize: 16,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 23,
  },
  bodyChecklistHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    marginTop: 8,
    marginBottom: 3,
  },
  bodyChecklistLabel: {
    fontSize: 12,
    color: 'rgba(255,204,102,0.78)',
    lineHeight: 15,
    letterSpacing: 0.25,
  },
  bodyChecklistItemRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    marginTop: 7,
    paddingVertical: 2,
  },
  bodyChecklistItemIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: 'rgba(255,204,102,0.12)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 1,
    flexShrink: 0,
  },
  bodyChecklistItemContent: {
    flex: 1,
    gap: 6,
  },
  bodyChecklistItemText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.86)',
    lineHeight: 23,
  },
  bodyLineIntro: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.90)',
    lineHeight: 25,
    letterSpacing: 0.1,
    marginTop: 4,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  bodyLineBulletRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginTop: 4,
    paddingLeft: 4,
  },
  bodyLineBulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,107,107,0.4)',
    marginTop: 8,
    marginRight: 10,
    flexShrink: 0,
  },
  bodyLineBullet: {
    flex: 1,
    fontSize: 16,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 23,
    paddingTop: 0,
    paddingBottom: 0,
  },
  bodyLineBulletContent: {
    flex: 1,
    gap: 6,
  },
  bodyInlineHintBlock: {
    gap: 5,
  },
  bodyLineBulletHintRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  bodyLineBulletHintChip: {
    maxWidth: '100%' as const,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  bodyLineBulletHintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.66)',
    lineHeight: 16,
  },
  bodyScheduleRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.075)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 9,
  },
  bodyScheduleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(255,204,102,0.1)',
    marginTop: 1,
  },
  bodyScheduleContent: {
    flex: 1,
    gap: 2,
  },
  bodyScheduleLabel: {
    fontSize: 12,
    color: 'rgba(255,204,102,0.76)',
    lineHeight: 15,
    letterSpacing: 0.2,
  },
  bodyScheduleValue: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 21,
  },
  bodyCheckRow: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    gap: 6,
  },
  bodyCheckLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.66)',
    lineHeight: 17,
  },
  bodyCheckValue: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 23,
  },
  bodyCheckValuePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,204,102,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,204,102,0.24)',
  },
  bodyCheckValuePillText: {
    fontSize: 12,
    color: Colors.faithGold,
    lineHeight: 16,
  },
  bodyHintRow: {
    marginTop: 2,
    marginBottom: 6,
    paddingLeft: 2,
    gap: 6,
  },
  bodyHintHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  bodyHintLabel: {
    fontSize: 11,
    color: 'rgba(255,204,102,0.72)',
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  bodyHintText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.64)',
    lineHeight: 21,
  },
  bodyHintChipRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 7,
  },
  bodyHintChip: {
    maxWidth: '100%' as const,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  bodyHintChipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 17,
  },
  bodyResourceBlock: {
    marginTop: 8,
    marginBottom: 8,
    gap: 9,
  },
  bodyResourceIntro: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.76)',
    lineHeight: 22,
  },
  bodyResourceHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  bodyResourceLabel: {
    fontSize: 12,
    color: Colors.faithGold,
    lineHeight: 15,
    letterSpacing: 0.25,
  },
  bodyResourceList: {
    gap: 8,
  },
  bodyResourceItemRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
  },
  bodyResourceItemDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: 8,
    backgroundColor: 'rgba(255,204,102,0.66)',
    flexShrink: 0,
  },
  bodyResourceItemText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  bodyColumnsBlock: {
    marginTop: 10,
    marginBottom: 12,
    gap: 12,
  },
  bodyColumnGuideBlock: {
    marginTop: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,204,102,0.14)',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.045)',
    overflow: 'hidden' as const,
  },
  bodyColumnGuideHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,204,102,0.10)',
  },
  bodyColumnGuideHeaderText: {
    fontSize: 12,
    color: Colors.faithGold,
    lineHeight: 16,
    letterSpacing: 0.25,
  },
  bodyColumnGuideList: {
    paddingVertical: 6,
  },
  bodyColumnGuideRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  bodyColumnGuideTitlePill: {
    width: 126,
    maxWidth: '42%' as const,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,204,102,0.11)',
  },
  bodyColumnGuideTitleText: {
    fontSize: 10.5,
    color: Colors.faithGold,
    lineHeight: 14,
    letterSpacing: 0.2,
    textAlign: 'center' as const,
  },
  bodyColumnGuideDescription: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 20,
  },
  bodyColumnCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.035)',
    overflow: 'hidden' as const,
  },
  bodyColumnHeader: {
    backgroundColor: 'rgba(255,204,102,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bodyColumnHeaderText: {
    fontSize: 12,
    color: Colors.faithGold,
    lineHeight: 16,
    letterSpacing: 0.25,
  },
  bodyColumnList: {
    paddingVertical: 6,
    gap: 2,
  },
  bodyColumnItemRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bodyColumnItemNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(255,204,102,0.12)',
    flexShrink: 0,
    marginTop: 1,
  },
  bodyColumnItemNumberText: {
    fontSize: 11,
    color: Colors.faithGold,
    lineHeight: 14,
  },
  bodyColumnItemText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 19,
  },
  bodyScriptureReadBlock: {
    marginTop: 8,
    marginBottom: 10,
    gap: 8,
  },
  bodyScriptureReadHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  bodyScriptureReadReference: {
    fontSize: 12,
    color: Colors.faithGold,
    lineHeight: 16,
    letterSpacing: 0.25,
  },
  bodyScriptureReadQuoteRow: {
    position: 'relative',
    paddingLeft: 12,
  },
  bodyScriptureReadRail: {
    position: 'absolute',
    left: 0,
    top: 3,
    bottom: 3,
    width: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,204,102,0.42)',
  },
  bodyScriptureReadText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 21,
  },
  bodyScriptureReadSummary: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  bodyScriptureReadSummaryLabel: {
    fontSize: 11,
    color: Colors.faithGold,
    lineHeight: 17,
  },
  bodyScriptureReadSummaryText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 18,
  },
  bodyLineMeaningBlock: {
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  bodyLineMeaningPhrase: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 21,
  },
  bodyLineMeaningSummary: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  bodyFieldRow: {
    position: 'relative',
    marginTop: 4,
    paddingVertical: 5,
    paddingLeft: 10,
    gap: 4,
  },
  bodyFieldRail: {
    position: 'absolute',
    left: 0,
    top: 5,
    bottom: 5,
    width: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,107,107,0.42)',
  },
  bodyFieldLabel: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(255,107,107,0.16)',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  bodyFieldLabelText: {
    fontSize: 11,
    lineHeight: 14,
    color: Colors.alertCoral,
    letterSpacing: 0.2,
  },
  bodyFieldValue: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.86)',
    lineHeight: 23,
    paddingTop: 0,
    paddingBottom: 0,
  },
  // Example block — matches ActionStepsCard original design
  exampleContainer: {
    position: 'relative',
    marginTop: 12,
    marginLeft: 28,
    paddingLeft: 12,
    paddingRight: 4,
  },
  exampleRail: {
    position: 'absolute',
    left: 0,
    top: 3,
    bottom: 3,
    width: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  exampleHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginBottom: 4,
  },
  exampleHeaderText: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.35,
    color: 'rgba(255,255,255,0.58)',
  },
  exampleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
  },
  exampleLoopList: {
    gap: 7,
  },
  exampleLoopRow: {
    gap: 4,
  },
  exampleLoopLabelPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  exampleLoopLabelText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.58)',
    lineHeight: 13,
    letterSpacing: 0.25,
  },
  exampleLoopValue: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.76)',
    lineHeight: 18,
  },
  actionWisdomContainer: {
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    gap: 10,
  },
  actionWisdomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionWisdomHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  actionWisdomLabel: {
    fontSize: 12,
    color: Colors.hopeWhite,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  actionWisdomCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    textAlign: 'center',
    textAlignVertical: 'center' as const,
    fontSize: 11,
    color: Colors.alertCoral,
    backgroundColor: 'rgba(255,107,107,0.16)',
    paddingHorizontal: 6,
    lineHeight: 20,
  },
  actionWisdomIntro: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 22,
  },
  actionWisdomThreadList: {
    gap: 16,
  },
  actionWisdomThreadItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  actionWisdomThreadRail: {
    width: 18,
    alignItems: 'center',
  },
  actionWisdomThreadDot: {
    width: 9,
    height: 9,
    backgroundColor: Colors.alertCoral,
    marginTop: 6,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  actionWisdomThreadLine: {
    flex: 1,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginTop: 6,
  },
  actionWisdomThreadContent: {
    flex: 1,
    paddingBottom: 2,
  },
  actionWisdomThreadMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionWisdomThreadMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.54)',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  actionWisdomQuestionBlock: {
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  actionWisdomResponseBlock: {
    paddingTop: 0,
  },
  actionWisdomUserRow: {
    alignItems: 'stretch',
    marginBottom: 14,
  },
  actionWisdomAssistantRow: {
    alignItems: 'stretch',
  },
  actionWisdomUserBubble: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  actionWisdomAssistantBubble: {
    paddingTop: 0,
  },
  actionWisdomAssistantLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  actionWisdomThreadLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.58)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  actionWisdomUserText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 21,
  },
  actionWisdomThreadDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 14,
  },
  actionWisdomCollapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
  },
  actionWisdomCollapseButtonText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  actionWisdomOutroWrapper: {
    alignSelf: 'stretch',
    overflow: 'visible',
  },
  actionWisdomTextWrapper: {
    minHeight: 22,
    overflow: 'visible',
  },
  actionWisdomIntroTextInput: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 22,
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
    minHeight: 22,
  },
  actionWisdomBlockDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 10,
  },
  actionWisdomStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  actionWisdomStepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionWisdomStepNumber: {
    fontSize: 10,
    color: Colors.alertCoral,
    lineHeight: 14,
  },
  actionWisdomStepTextWrapper: {
    flex: 1,
    paddingTop: 3,
  },
  actionWisdomStepTitle: {
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 21,
    marginBottom: 2,
  },
  actionWisdomStepTitleTextInput: {
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 21,
    padding: 0,
    margin: 0,
    marginBottom: 2,
    backgroundColor: 'transparent',
    minHeight: 21,
  },
  actionWisdomStepText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 22,
  },
  actionWisdomStepTextInput: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 22,
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
    minHeight: 22,
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
    marginTop: 32,
    marginBottom: 8,
    letterSpacing: 0.5,
    textAlign: 'center' as const,
  },
  actionProgressBar: {
    height: 6,
    width: 120,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginBottom: 24,
    overflow: 'hidden' as const,
    alignSelf: 'center' as const,
  },
  actionProgressFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 2,
  },
  actionStepCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    padding: 22,
    paddingTop: 14,
    marginBottom: 32,
    gap: 12,
    position: 'relative',
    overflow: 'visible',
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
    flex: 1,
  },
  actionTitleContainer: {
    marginBottom: 6,
  },
  actionHowToButton: {
    position: 'absolute',
    top: -15,
    right: 18,
    backgroundColor: 'Colors.sage',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 10,
    elevation: 10,
  },
  actionHowToButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionHowToButtonText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  actionBody: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 23,
  },
  buttonArea: {
    marginTop: 20,
  },
  backButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  actionFABContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 10,
  },
  actionFABContainerPad: {
    left: 160,
    right: 160,
  },
  actionFABRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
    maxWidth: 800,
    alignSelf: 'center',
  },
  actionFABCollapsedCircle: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionFABCollapsedCircleTouchable: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(38, 71, 119, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionFABCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'Colors.sage',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionFABDone: {
    flex: 1,
    height: 44,
    backgroundColor: 'Colors.sage',
    borderRadius: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionFABDoneText: {
    fontSize: 15,
    color: Colors.hopeWhite,
  },
  actionFABSkip: {
    height: 44,
    paddingHorizontal: 14,
    backgroundColor: 'Colors.sage',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  savedFeedbackRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  savedFeedbackText: {
    fontSize: 12,
    color: Colors.growthGreen,
    opacity: 0.9,
  },
  journalExpandedRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 4,
  },
  journalTrigger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  journalIconButton: {
    alignItems: 'center',
    gap: 5,
  },
  journalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  journalIconLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  doneSkipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doneButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  doneButtonCommitted: {
    backgroundColor: 'Colors.sage',
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  doneButtonTextCommitted: {
    color: Colors.alertCoral,
  },
  doneButtonText: {
    fontSize: 15,
    color: Colors.hopeWhite,
  },

  // Outer container for Prayer + Word to Speak — flex column so content can center
  prayerStepOuter: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 0,
  },
  prayerStepOuterPad: {
    paddingHorizontal: 160,
  },

  // Prayer
  prayerBlock: {
    marginTop: 28,
  },
  prayerParagraph: {
    marginBottom: 16,
  },
  prayerText: {
    fontSize: 18,
    color: Colors.hopeWhite,
    lineHeight: 26,
    opacity: 0.9,
  },
  // "I prayed this" — toggleable pill
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
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  prayerActionButtonFloating: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 13,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  prayerActionText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  prayerActionTextActive: {
    color: Colors.alertCoral,
  },
  prayerActionRow: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prayerActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  prayerActionSharePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },

  // Word to Speak
  wordBlock: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    padding: 36,
    gap: 14,
  },
  wordLineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  wordNumberContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  wordNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordNumber: {
    fontSize: 14,
    color: Colors.alertCoral,
    lineHeight: 18,
  },
  wordText: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.hopeWhite,
    lineHeight: 32,
    textAlign: 'left',
    flex: 1,
  },

  // Completion
  completionHeaderContainer: {
    gap: 8,
    marginBottom: 28,
    alignItems: 'center',
    marginTop: 22,
  },
  completionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  howToButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  howToButtonText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  completionPlaybookLabel: {
    fontSize: 12,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 0,
  },
  completionTitle: {
    fontSize: 22,
    color: Colors.hopeWhite,
    lineHeight: 28,
    textAlign: 'center',
  },
  completionPastoralClosing: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.hopeWhite,
    lineHeight: 24,
    marginTop: 28,
    marginBottom: 28,
    opacity: 0.88,
  },
  completionPastoralClosingBeat: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    textAlign: 'center',
    marginTop: 36,
    marginBottom: 36,
    opacity: 1,
  },
  completionContext: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.hopeWhite,
    lineHeight: 20,
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
    alignItems: 'center',
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
  },
  completionActionNumber: {
    fontSize: 14,
    color: Colors.alertCoral,
    lineHeight: 18,
  },
  completionActionLine: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  Keyboard,
  DeviceEventEmitter,
  AccessibilityInfo,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';

import ThemedText from '../components/common/ThemedText';
import ScriptureReaderModal from '../components/ScriptureReaderModal';
import BibleStudyDetailView from '../components/journal/BibleStudyDetailView';
import AnimatedBibleStudyTopics from '../components/journal/AnimatedBibleStudyTopics';
import { Colors } from '../theme/colors';
import { Fonts, FontFamily, getFontFamily } from '../theme/fonts';
import { triggerLightHaptic } from '../utils/haptics';
import { getScripturePassage } from '../services/scriptureReaderService';
import { BIBLE_STUDY_TOPICS, BibleStudyTopic } from '../data/bibleStudyTopics';
import { deleteLocalReflection, getLocalReflection, LocalReflectionEntry } from '../storage/reflectionStorage';
import { parseSavedBibleStudy } from '../storage/bibleStudyMomentsStorage';
import {
  BibleStudyContent,
  BibleStudyHighlight,
  BibleStudySession,
  BibleStudyStage,
  completeBibleStudySession,
  deleteBibleStudySession,
  createBibleStudySession,
  createEmptyBibleStudyContent,
  getActiveBibleStudySession,
  getBibleStudySession,
  loadBibleStudyContent,
  parsePassageReference,
  saveBibleStudyContent,
  updateBibleStudySession,
} from '../storage/bibleStudyStorage';

type ScriptureTextAlign = 'left' | 'center' | 'right' | 'justify';

const READER_FONTS: { key: FontFamily; label: string }[] = [
  { key: 'lora', label: 'Lora' },
  { key: 'lexend', label: 'Lexend' },
  { key: 'poppins', label: 'Poppins' },
  { key: 'nunito', label: 'Nunito' },
];

const READER_ALIGNMENTS: { key: ScriptureTextAlign; icon: string; label: string }[] = [
  { key: 'left', icon: 'format-align-left', label: 'Left' },
  { key: 'center', icon: 'format-align-center', label: 'Center' },
  { key: 'right', icon: 'format-align-right', label: 'Right' },
  { key: 'justify', icon: 'format-align-justify', label: 'Justify' },
];

const FONT_SIZES = [18, 20, 22, 24, 26, 28, 30, 32];
const LINE_SPACING = [0, 4, 8, 12];
const LETTER_SPACING = [0, 0.5, 1, 2];
const INDENTS = [0, 16, 32];

const HIGHLIGHT_COLORS = [
  'rgba(231,196,94,0.42)',
  'rgba(130,183,142,0.38)',
  'rgba(126,169,211,0.34)',
  'rgba(213,151,166,0.34)',
];

const STAGES: BibleStudyStage[] = [
  'home',
  'read',
  'observe',
  'understand',
  'respond',
  'saved',
  'detail',
];

const OBSERVE_PROMPTS = [
  'Repeated words',
  'Commands',
  'Promises',
  'Contrasts',
  'People',
  'Something surprising',
];

const OBSERVE_NOTE_PLACEHOLDERS: Record<string, string> = {
  'Repeated words': 'Which words repeat? What might they emphasize?',
  Commands: 'What command do you see? Who is it given to?',
  Promises: 'What is promised, and to whom?',
  Contrasts: 'What two things are being contrasted?',
  People: 'Who is present, and what do you notice about them?',
  'Something surprising': 'What surprised you, and why?',
};

const UNDERSTAND_PROMPTS = [
  'What does this show about God?',
  'What does this show about people?',
  'What seems to be the main point?',
  'What questions do I still have?',
  'What do I see about Jesus?',
];

const UNDERSTAND_NOTE_PLACEHOLDERS: Record<string, string> = {
  'What does this show about God?': 'What do you learn about God’s character, heart, or ways?',
  'What does this show about people?': 'What does this reveal about people, their needs, or their response to God?',
  'What seems to be the main point?': 'Summarize the central truth of this passage in your own words.',
  'What questions do I still have?': 'What needs more context, study, or careful thought?',
  'What do I see about Jesus?': 'What does this passage reveal about Jesus, his work, or his way?',
};

const RESPONSE_PROMPTS = [
  'Believe',
  'Obey',
  'Change',
  'Remember',
  'Thank God',
  'Other',
];

const RESPONSE_NOTE_PLACEHOLDERS: Record<string, string> = {
  Believe: 'What truth from this passage do you want to believe more deeply?',
  Obey: 'What is one faithful step of obedience you can take?',
  Change: 'What attitude, habit, or direction needs to change?',
  Remember: 'What do you want to carry with you from this passage?',
  'Thank God': 'What can you thank God for after reading this passage?',
  Other: 'Write your response in your own words...',
};

const generateUUID = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random % 4) + 8;
    return value.toString(16);
  });

const Eyebrow = ({ children }: { children: string }) => (
  <ThemedText weight="semiBold" style={styles.eyebrow}>{children}</ThemedText>
);

const PageTitle = ({ children }: { children: string }) => (
  <ThemedText weight="bold" style={styles.title}>{children}</ThemedText>
);

const PageLead = ({ children, style }: { children: string; style?: any }) => (
  <ThemedText style={[styles.lead, style]}>{children}</ThemedText>
);

const PrimaryButton = ({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
}) => (
  <TouchableOpacity
    style={[styles.primaryButton, style]}
    activeOpacity={0.8}
    onPress={onPress}
  >
    <ThemedText weight="semiBold" style={styles.primaryButtonText}>{children}</ThemedText>
  </TouchableOpacity>
);

const SecondaryButton = ({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={styles.secondaryButton}
    activeOpacity={0.8}
    onPress={onPress}
  >
    <ThemedText weight="semiBold" style={styles.secondaryButtonText}>{children}</ThemedText>
  </TouchableOpacity>
);

const Chip = ({
  label,
  on,
  onPress,
}: {
  label: string;
  on?: boolean;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    style={[styles.chip, on && styles.chipOn]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <ThemedText style={[styles.chipText, on && styles.chipTextOn]}>{label}</ThemedText>
  </TouchableOpacity>
);

const Card = ({
  soft,
  children,
  onPress,
  style,
}: {
  soft?: boolean;
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
}) => {
  const content = (
    <View style={[styles.card, soft && styles.cardSoft, style]}>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
};

const BibleStudyScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const creatingStudy = route.params?.openMode === 'create';
  const openRequestId = route.params?.openRequestId;
  const savedSessionId = creatingStudy ? undefined : route.params?.sessionId as string | undefined;
  const savedReflectionId = creatingStudy ? undefined : route.params?.reflectionId as string | undefined;
  const savedSelectedDate = creatingStudy ? undefined : route.params?.selectedDate as string | undefined;
  const [savedReflection, setSavedReflection] = useState<LocalReflectionEntry | null>(null);
  const { width: screenWidth } = useWindowDimensions();

  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<BibleStudySession | null>(null);
  const [stage, setStage] = useState<BibleStudyStage>('home');
  const [editingSavedStudy, setEditingSavedStudy] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<BibleStudyTopic | null>(null);
  const [topicsExpanded, setTopicsExpanded] = useState(false);
  const reduceMotion = useRef(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mounted) {reduceMotion.current = enabled;}
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      reduceMotion.current = enabled;
    });
    return () => { mounted = false; subscription.remove(); };
  }, []);
  const suggestedTopics = useMemo(() => {
    const shuffled = [...BIBLE_STUDY_TOPICS];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 4);
  }, []);

  const [highlights, setHighlights] = useState<BibleStudyHighlight[]>([]);
  const [observationText, setObservationText] = useState('');
  const [observationTags, setObservationTags] = useState<Set<string>>(new Set());
  const [highlightObservations, setHighlightObservations] = useState<Record<string, string>>({});
  const [highlightPromptSelections, setHighlightPromptSelections] = useState<Record<string, string[]>>({});
  const [highlightPromptNotes, setHighlightPromptNotes] = useState<Record<string, Record<string, string>>>({});
  const [pendingObservationFocus, setPendingObservationFocus] = useState<string | null>(null);
  const observationInputRefs = useRef<Record<string, TextInput | null>>({});
  const observationNoteLayouts = useRef<Record<string, number>>({});
  const screenScrollRef = useRef<ScrollView>(null);
  const activeObservationFocus = useRef<string | null>(null);
  const [observeHighlightIndex, setObserveHighlightIndex] = useState(0);
  const [understandingText, setUnderstandingText] = useState('');
  const [understandingPhase, setUnderstandingPhase] = useState<'main' | 'deeper'>('main');
  const [understandingPromptSelections, setUnderstandingPromptSelections] = useState<string[]>([]);
  const [understandingPromptNotes, setUnderstandingPromptNotes] = useState<Record<string, string>>({});
  const [pendingUnderstandingFocus, setPendingUnderstandingFocus] = useState<string | null>(null);
  const understandingInputRefs = useRef<Record<string, TextInput | null>>({});
  const [responseText, setResponseText] = useState('');
  const [responsePromptSelections, setResponsePromptSelections] = useState<string[]>([]);
  const [responsePromptNotes, setResponsePromptNotes] = useState<Record<string, string>>({});
  const [responsePhase, setResponsePhase] = useState<'journal' | 'prayer'>('journal');
  const [prayerText, setPrayerText] = useState('');
  const [saveToPrayerJournal, setSaveToPrayerJournal] = useState(true);
  const [trackAnsweredPrayer, setTrackAnsweredPrayer] = useState(false);

  const [passageVerses, setPassageVerses] = useState<{ n: string; text: string }[]>([]);
  const [passageLoading, setPassageLoading] = useState(false);
  const [passageRead, setPassageRead] = useState(false);
  const [showTextSettings, setShowTextSettings] = useState(false);
  const [scriptureFontSize, setScriptureFontSize] = useState(18);
  const [scriptureFont, setScriptureFont] = useState<FontFamily>('lora');
  const [scriptureBold, setScriptureBold] = useState(false);
  const [scriptureAlign, setScriptureAlign] = useState<ScriptureTextAlign>('left');
  const [scriptureLineSpacing, setScriptureLineSpacing] = useState(0);
  const [scriptureLetterSpacing, setScriptureLetterSpacing] = useState(0);
  const [scriptureIndent, setScriptureIndent] = useState(0);
  const [advancedTextSettings, setAdvancedTextSettings] = useState(false);
  const [passageSelection, setPassageSelection] = useState({ start: 0, end: 0 });
  const [highlightActionsVisible, setHighlightActionsVisible] = useState(false);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const ignoreSelectionEvents = useRef(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [scriptureReaderOpen, setScriptureReaderOpen] = useState(false);

  const stageIndex = STAGES.indexOf(stage);
  const progress = useMemo(() => {
    if (stage === 'home' || stage === 'saved' || stage === 'detail') {return 0;}
    return (stageIndex / (STAGES.length - 1));
  }, [stage, stageIndex]);

  const selectablePassageText = useMemo(
    () => passageVerses
      .map(verse => `${verse.n ? `${verse.n} ` : ''}${verse.text}`)
      .join('\n\n'),
    [passageVerses],
  );

  const buildContent = useCallback((): BibleStudyContent => ({
    format: 'bible_study_v1',
    passageRead,
    highlights,
    observation: {
      text: observationText || [
        ...Object.values(highlightObservations),
        ...Object.entries(highlightPromptNotes).flatMap(([highlightId, notes]) =>
          (highlightPromptSelections[highlightId] ?? []).map(prompt => notes[prompt] ?? ''),
        ),
      ].filter(value => value.trim()).join('\n\n'),
      tags: Array.from(observationTags),
      byHighlight: highlightObservations,
      promptsByHighlight: highlightPromptSelections,
      promptNotesByHighlight: highlightPromptNotes,
    },
    understanding: {
      text: understandingText || understandingPromptSelections
        .map(prompt => understandingPromptNotes[prompt] ?? '')
        .filter(value => value.trim())
        .join('\n\n'),
      prompts: understandingPromptSelections,
      byPrompt: understandingPromptNotes,
    },
    response: {
      text: responseText || responsePromptSelections
        .map(prompt => responsePromptNotes[prompt] ?? '')
        .filter(value => value.trim())
        .join('\n\n'),
      prompts: responsePromptSelections,
      byPrompt: responsePromptNotes,
    },
    prayer: { text: prayerText, saveToPrayerJournal, trackAnswered: trackAnsweredPrayer },
  }), [passageRead, highlights, observationText, observationTags, highlightObservations, highlightPromptSelections, highlightPromptNotes, understandingText, understandingPromptSelections, understandingPromptNotes, responseText, responsePromptSelections, responsePromptNotes, prayerText, saveToPrayerJournal, trackAnsweredPrayer]);

  const applyContent = useCallback((content: BibleStudyContent) => {
    setPassageRead(content.passageRead === true);
    setHighlights(content.highlights ?? []);
    setObservationText(content.observation?.text ?? '');
    setObservationTags(new Set(content.observation?.tags ?? []));
    setHighlightObservations(content.observation?.byHighlight ?? {});
    setHighlightPromptSelections(content.observation?.promptsByHighlight ?? {});
    setHighlightPromptNotes(content.observation?.promptNotesByHighlight ?? {});
    setUnderstandingText(content.understanding?.text ?? '');
    setUnderstandingPromptSelections(content.understanding?.prompts ?? []);
    setUnderstandingPromptNotes(content.understanding?.byPrompt ?? {});
    setResponseText(content.response?.text ?? '');
    setResponsePromptSelections(content.response?.prompts ?? []);
    setResponsePromptNotes(content.response?.byPrompt ?? {});
    setPrayerText(content.prayer?.text ?? '');
    setSaveToPrayerJournal(content.prayer?.saveToPrayerJournal ?? true);
    setTrackAnsweredPrayer(content.prayer?.trackAnswered ?? false);
  }, []);

  const loadPassageText = useCallback(async (reference: string, translation = 'NASB') => {
    setPassageLoading(true);
    try {
      const result = await getScripturePassage(reference, translation);
      if (result.verses && result.verses.length > 0) {
        setPassageVerses(result.verses.map(v => ({ n: v.number, text: v.lines.join('\n') })));
      } else {
        setPassageVerses([{ n: '', text: result.text }]);
      }
    } catch (e) {
      setPassageVerses([{ n: '', text: `${reference} could not be loaded. Please try again when you have a connection.` }]);
    } finally {
      setPassageLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setStage('home');
    setSession(null);
    setSavedReflection(null);
    setEditingSavedStudy(false);
    setSearch('');
    setSelectedTopic(null);
    setTopicsExpanded(false);
    setObserveHighlightIndex(0);
    setUnderstandingPhase('main');
    setResponsePhase('journal');
    setPassageRead(false);
    setPassageVerses([]);
    setPassageSelection({ start: 0, end: 0 });
    setHighlightActionsVisible(false);
    setActiveHighlightId(null);
    ignoreSelectionEvents.current = true;
    setScriptureReaderOpen(false);
    applyContent(createEmptyBibleStudyContent());
    if (debouncedSave.current) {clearTimeout(debouncedSave.current);}
    (async () => {
      if (savedReflectionId) {
        if (!savedSelectedDate) {throw new Error('Saved Bible Study date is missing.');}
        const reflection = await getLocalReflection(savedReflectionId, 'scripture', savedSelectedDate);
        if (!mounted) {return;}
        const content = reflection && parseSavedBibleStudy(reflection);
        if (!reflection || !content) {throw new Error('Saved Bible Study could not be loaded.');}
        setSavedReflection(reflection);
        applyContent(content);
        setStage('detail');
        const linkedId = reflection.metadata?.bibleStudySessionId;
        if (linkedId) {
          const linkedSession = await getBibleStudySession(linkedId);
          if (mounted) {setSession(linkedSession);}
        }
        if (mounted) {setIsLoading(false);}
        return;
      }
      const active = savedSessionId
        ? await getBibleStudySession(savedSessionId)
        : await getActiveBibleStudySession();
      if (!mounted) {return;}
      if (active) {
        setSession(active);
        const content = await loadBibleStudyContent(active);
        if (!mounted) {return;}
        applyContent(content);
        if (savedSessionId) {setStage('detail');}
        if (active.passage.reference) {
          await loadPassageText(active.passage.reference, active.passage.translation ?? 'NASB');
        }
      }
      setIsLoading(false);
    })().catch(error => {
      if (!mounted) {return;}
      setIsLoading(false);
      Alert.alert('Unable to open Bible Study', error.message, [{ text: 'Close', onPress: () => navigation.goBack() }]);
    });
    return () => { mounted = false; };
  }, [applyContent, creatingStudy, loadPassageText, navigation, openRequestId, savedReflectionId, savedSelectedDate, savedSessionId]);

  const debouncedSave = useRef<NodeJS.Timeout | null>(null);
  const saveDraft = useCallback(async () => {
    if (!session || stage === 'detail' || (session.completed && !editingSavedStudy)) {return;}
    const content = buildContent();
    try {
      const updated = await saveBibleStudyContent(session, content);
      setSession(updated);
    } catch (error) {
      console.warn('Bible Study draft save error:', error);
    }
  }, [session, buildContent, stage, editingSavedStudy]);

  const scheduleDraftSave = useCallback(() => {
    if (debouncedSave.current) {
      clearTimeout(debouncedSave.current);
    }
    debouncedSave.current = setTimeout(() => {
      saveDraft();
    }, 1200);
  }, [saveDraft]);

  const startStudy = useCallback(async (reference: string) => {
    triggerLightHaptic();
    const passage = parsePassageReference(reference);
    const newSession = await createBibleStudySession(passage);
    setSession(newSession);
    setPassageSelection({ start: 0, end: 0 });
    setHighlightActionsVisible(false);
    ignoreSelectionEvents.current = true;
    setPassageRead(false);
    setObserveHighlightIndex(0);
    setUnderstandingPhase('main');
    setResponsePhase('journal');
    applyContent(createEmptyBibleStudyContent());
    await loadPassageText(passage.reference);
    setStage('read');
  }, [applyContent, loadPassageText]);

  const advance = useCallback(async (next: BibleStudyStage) => {
    if (!session) {return;}
    if (debouncedSave.current) {clearTimeout(debouncedSave.current);}
    triggerLightHaptic();

    const content = buildContent();
    let updated = session;

    try {
      updated = await saveBibleStudyContent(session, content);

      const completedSteps = new Set(updated.completed_steps);
      if (stage === 'read') {completedSteps.add('read');}
      if (stage === 'observe') {completedSteps.add('observe');}
      if (stage === 'understand') {completedSteps.add('understand');}
      if (stage === 'respond') {completedSteps.add('respond');}

      let nextStep = updated.current_step;
      if (next === 'observe') {nextStep = 'observe';}
      if (next === 'understand') {nextStep = 'understand';}
      if (next === 'respond') {nextStep = 'respond';}

      if (next === 'saved') {
        updated = await completeBibleStudySession(updated, content);
        setEditingSavedStudy(false);
        DeviceEventEmitter.emit('bible_study_saved', updated.id);
      } else {
        updated = await updateBibleStudySession({
          ...updated,
          current_stage: next,
          current_step: nextStep,
          completed_steps: Array.from(completedSteps) as any,
        });
      }

      setSession(updated);
      setStage(next);
    } catch (error) {
      console.warn('Bible Study save error:', error);
    }
  }, [session, buildContent, stage]);

  const back = useCallback(() => {
    if (stage === 'home' || stage === 'saved' || stage === 'detail') {
      if (navigation.canGoBack()) {navigation.goBack();}
      return;
    }
    if (stage === 'observe' && observeHighlightIndex > 0) {
      triggerLightHaptic();
      setObserveHighlightIndex(index => index - 1);
      return;
    }
    if (stage === 'understand' && understandingPhase === 'deeper') {
      triggerLightHaptic();
      setUnderstandingPhase('main');
      return;
    }
    if (stage === 'respond' && responsePhase === 'prayer') {
      triggerLightHaptic();
      setResponsePhase('journal');
      return;
    }
    const prevIndex = stageIndex - 1;
    if (prevIndex >= 0) {
      setStage(STAGES[prevIndex]);
    }
  }, [navigation, observeHighlightIndex, responsePhase, stage, stageIndex, understandingPhase]);

  const toggleHighlightPrompt = (highlightId: string, prompt: string) => {
    triggerLightHaptic();
    const focusKey = `${highlightId}:${prompt}`;
    const isSelected = (highlightPromptSelections[highlightId] ?? []).includes(prompt);
    setHighlightPromptSelections(current => {
      const selected = current[highlightId] ?? [];
      return {
        ...current,
        [highlightId]: selected.includes(prompt)
          ? selected.filter(item => item !== prompt)
          : [...selected, prompt],
      };
    });
    if (!isSelected) {
      activeObservationFocus.current = focusKey;
      setPendingObservationFocus(focusKey);
    }
    scheduleDraftSave();
  };

  const toggleUnderstandingPrompt = (prompt: string) => {
    triggerLightHaptic();
    const isSelected = understandingPromptSelections.includes(prompt);
    setUnderstandingPromptSelections(current => current.includes(prompt)
      ? current.filter(item => item !== prompt)
      : [...current, prompt]);
    if (!isSelected) {
      setPendingUnderstandingFocus(prompt);
    }
    scheduleDraftSave();
  };

  const toggleResponsePrompt = (prompt: string) => {
    triggerLightHaptic();
    setResponsePromptSelections(current => current.includes(prompt)
      ? current.filter(item => item !== prompt)
      : [...current, prompt]);
    scheduleDraftSave();
  };

  useEffect(() => {
    if (!pendingUnderstandingFocus) {return;}
    const frame = requestAnimationFrame(() => {
      const input = understandingInputRefs.current[pendingUnderstandingFocus];
      input?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingUnderstandingFocus, understandingPromptSelections]);

  useEffect(() => {
    if (!pendingObservationFocus) {return;}
    let scrollTimeout: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      observationInputRefs.current[pendingObservationFocus]?.focus();
      scrollTimeout = setTimeout(() => {
        const noteY = observationNoteLayouts.current[pendingObservationFocus];
        if (typeof noteY === 'number') {
          screenScrollRef.current?.scrollTo({ y: Math.max(0, noteY - 96), animated: true });
        }
        setPendingObservationFocus(null);
      }, 260);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (scrollTimeout) {clearTimeout(scrollTimeout);}
    };
  }, [highlightPromptSelections, pendingObservationFocus]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', event => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const topTitle = useMemo(() => {
    if (stage === 'home' || stage === 'saved' || stage === 'detail') {return '';}
    return session?.passage.reference ?? '';
  }, [stage, session?.passage.reference]);

  const renderTop = () => stage === 'home' ? (
    <View style={[styles.homeTop, { top: insets.top + 8 }]} pointerEvents="box-none">
      {selectedTopic ? (
        <TouchableOpacity
          onPress={() => setSelectedTopic(null)}
          style={[styles.homeNavButton, styles.homeBackButton]}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.sage} />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        accessibilityLabel="Close Bible Study"
        onPress={() => {
          triggerLightHaptic();
          if (navigation.canGoBack()) {navigation.goBack();}
        }}
        style={[styles.homeNavButton, styles.homeCloseButton]}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={17} color={Colors.sage} />
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.top}>
      {stage === 'saved' ? (
        <View style={styles.topIcon} />
      ) : (
        <TouchableOpacity onPress={back} style={styles.topIcon} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
      )}
      {topTitle ? (
        <View style={styles.topTitleRow}>
          <ThemedText weight="semiBold" style={styles.topTitle}>{topTitle}</ThemedText>
          {(stage === 'observe' || stage === 'understand' || stage === 'respond') ? (
            <TouchableOpacity
              onPress={() => { triggerLightHaptic(); setScriptureReaderOpen(true); }}
              style={styles.topReaderIcon}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel="Open scripture reader"
            >
              <MaterialCommunityIcons name="script-text" size={18} color={Colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View />
      )}
      {stage === 'read' ? (
        <TouchableOpacity
          style={[styles.aaHeaderButton, showTextSettings && styles.aaHeaderButtonActive]}
          onPress={() => setShowTextSettings(value => !value)}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel="Text settings"
          accessibilityState={{ expanded: showTextSettings }}
        >
          <ThemedText weight="bold" style={[styles.aaHeaderButtonText, showTextSettings && styles.aaHeaderButtonTextActive]}>aA</ThemedText>
        </TouchableOpacity>
      ) : (
        <View style={styles.topIcon} />
      )}
    </View>
  );

  const renderProgress = () =>
    stage !== 'home' && stage !== 'saved' && stage !== 'detail' ? (
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    ) : null;

  const selectTopic = (topic: BibleStudyTopic) => {
    triggerLightHaptic();
    setSelectedTopic(topic);
  };

  const renderTopic = (topic: BibleStudyTopic) => (
    <View style={[styles.homePage, { paddingTop: insets.top + 8 }]}>
      <View style={styles.homeLabelContainer}>
        <MaterialCommunityIcons name="script-text" size={16} color={Colors.sage} />
        <ThemedText weight="semiBold" style={styles.homeEyebrow}>Bible Study</ThemedText>
      </View>
      <ThemedText weight="semiBold" style={styles.homeTitle}>{topic.title}</ThemedText>
      <ThemedText style={styles.homeLead}>{topic.description}</ThemedText>

      <ThemedText weight="semiBold" style={styles.sectionLabel}>Choose a passage</ThemedText>
      {topic.passages.map((passage) => (
        <TouchableOpacity
          key={passage.reference}
          style={styles.passageRow}
          activeOpacity={0.65}
          onPress={() => startStudy(passage.reference)}
        >
          <View style={styles.rowText}>
            <ThemedText weight="semiBold" style={styles.passageReference}>{passage.reference}</ThemedText>
            <ThemedText style={styles.passageContext}>{passage.context}</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textGray} />
        </TouchableOpacity>
      ))}

      <ThemedText style={styles.curatedNote}>These are curated starting points, not an exhaustive list.</ThemedText>
    </View>
  );

  const renderHome = () => selectedTopic ? renderTopic(selectedTopic) : (
    <View style={[styles.homePage, { paddingTop: insets.top + 8 }]}>
      <View style={styles.homeLabelContainer}>
        <MaterialCommunityIcons name="script-text" size={16} color={Colors.sage} />
        <ThemedText weight="semiBold" style={styles.homeEyebrow}>Bible Study</ThemedText>
      </View>
      <ThemedText weight="semiBold" style={styles.homeTitle}>What would you like to study?</ThemedText>
      <ThemedText style={styles.homeLead}>Choose a passage and take time to read, understand, and respond.</ThemedText>

      {session && !session.completed && !session.completed_at && session.current_stage !== 'saved' && session.current_stage !== 'detail' ? (
        <TouchableOpacity
          style={styles.resumeButton}
          activeOpacity={0.7}
          onPress={() => { triggerLightHaptic(); setStage(session.current_stage === 'home' ? 'read' : session.current_stage); }}
        >
          <View style={styles.rowText}>
            <ThemedText weight="semiBold" style={styles.resumeLabel}>CONTINUE</ThemedText>
            <ThemedText weight="semiBold" style={styles.resumeReference}>{session.passage.reference}</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textGray} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.passageInputRow}>
        <Ionicons name="search-outline" size={21} color={Colors.textGray} />
        <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Type a passage, like Romans 8:1–11"
        placeholderTextColor={Colors.placeholderText}
        style={styles.search}
        returnKeyType="go"
        onSubmitEditing={() => { if (search.trim()) {startStudy(search.trim());} }}
        />
        {search.trim() ? (
          <TouchableOpacity onPress={() => startStudy(search.trim())} activeOpacity={0.7}>
            <Ionicons name="arrow-forward-circle" size={29} color={Colors.sage} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ThemedText weight="semiBold" style={styles.sectionLabel}>Or browse by topic</ThemedText>
      <AnimatedBibleStudyTopics suggestions={suggestedTopics} topics={BIBLE_STUDY_TOPICS} expanded={topicsExpanded}
        reduceMotion={reduceMotion.current} onSelect={selectTopic} gridStyle={styles.topicGrid}
        buttonStyle={styles.topicButton} textStyle={styles.topicButtonText} />

      <TouchableOpacity
        style={styles.allTopicsButton}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: topicsExpanded }}
        onPress={() => {
          triggerLightHaptic();
          setTopicsExpanded(value => !value);
        }}
      >
        <ThemedText weight="semiBold" style={styles.allTopicsText}>
          {topicsExpanded ? 'Show less' : 'Show more'}
        </ThemedText>
      </TouchableOpacity>

    </View>
  );

  const stepReaderValue = (
    values: number[],
    current: number,
    direction: -1 | 1,
    update: (value: number) => void,
  ) => {
    const index = Math.max(0, values.indexOf(current));
    update(values[Math.max(0, Math.min(values.length - 1, index + direction))]);
    triggerLightHaptic();
  };

  const resetReaderSettings = () => {
    triggerLightHaptic();
    setScriptureFontSize(18);
    setScriptureFont('lora');
    setScriptureBold(false);
    setScriptureAlign('left');
    setScriptureLineSpacing(0);
    setScriptureLetterSpacing(0);
    setScriptureIndent(0);
  };

  const selectedPassageText = selectablePassageText
    .slice(passageSelection.start, passageSelection.end)
    .trim();

  const selectedHighlight = highlightActionsVisible ? highlights.find(highlight => highlight.id === activeHighlightId) ?? highlights.find(highlight => {
    const start = highlight.selectionStart ?? selectablePassageText.indexOf(highlight.text);
    const end = highlight.selectionEnd ?? (start + highlight.text.length);
    if (passageSelection.end > passageSelection.start) {
      return passageSelection.start < end && passageSelection.end > start;
    }
    return false; // A cursor alone must not automatically open highlight controls.
  }) : undefined;

  const dismissHighlightActions = () => {
    ignoreSelectionEvents.current = true;
    setHighlightActionsVisible(false);
    setActiveHighlightId(null);
    setPassageSelection({ start: 0, end: 0 });
  };

  const selectionActionTop = useMemo(() => {
    const textBeforeSelection = selectablePassageText.slice(0, passageSelection.start);
    const availableWidth = Math.max(160, screenWidth - 52 - scriptureIndent);
    const approximateCharactersPerLine = Math.max(12, Math.floor(availableWidth / (scriptureFontSize * 0.56)));
    const visualLines = textBeforeSelection.split('\n').reduce(
      (total, line) => total + Math.max(1, Math.ceil(line.length / approximateCharactersPerLine)),
      0,
    );
    const lineHeight = scriptureFontSize * 1.6 + scriptureLineSpacing;
    return Math.max(0, visualLines * lineHeight - lineHeight - 44);
  }, [passageSelection.start, screenWidth, scriptureFontSize, scriptureIndent, scriptureLineSpacing, selectablePassageText]);

  const highlightedPassageSegments = useMemo(() => {
    const ranges = highlights
      .map(highlight => {
        const start = highlight.selectionStart ?? selectablePassageText.indexOf(highlight.text);
        const end = highlight.selectionEnd ?? (start + highlight.text.length);
        return start >= 0 && end <= selectablePassageText.length
          ? { start, end, id: highlight.id }
          : null;
      })
      .filter((range): range is { start: number; end: number; id: string } => range !== null)
      .sort((a, b) => a.start - b.start);

    const segments: { text: string; color?: string; key: string }[] = [];
    let cursor = 0;
    ranges.forEach(range => {
      if (range.start < cursor) {return;}
      if (range.start > cursor) {
        segments.push({ text: selectablePassageText.slice(cursor, range.start), key: `plain-${cursor}` });
      }
      const highlight = highlights.find(item => item.id === range.id);
      segments.push({
        text: selectablePassageText.slice(range.start, range.end),
        color: highlight?.color ?? HIGHLIGHT_COLORS[0],
        key: range.id,
      });
      cursor = range.end;
    });
    if (cursor < selectablePassageText.length) {
      segments.push({ text: selectablePassageText.slice(cursor), key: `plain-${cursor}` });
    }
    return segments;
  }, [highlights, selectablePassageText]);

  const savePassageHighlight = (color: string) => {
    if (!selectedPassageText && !selectedHighlight) {return;}
    triggerLightHaptic();
    setHighlights(current => {
      if (selectedHighlight) {
        return current.map(highlight => highlight.id === selectedHighlight.id
          ? { ...highlight, color }
          : highlight);
      }
      return [
        ...current,
        {
          id: generateUUID(),
          verseNumber: session?.passage.reference ?? 'Passage',
          text: selectedPassageText,
          selectionStart: passageSelection.start,
          selectionEnd: passageSelection.end,
          color,
        },
      ];
    });
    dismissHighlightActions();
    scheduleDraftSave();
  };

  const removePassageHighlight = (id: string) => {
    triggerLightHaptic();
    setHighlights(current => current.filter(highlight => highlight.id !== id));
    dismissHighlightActions();
    scheduleDraftSave();
  };

  const confirmRemoveHighlight = (id: string) => {
    Alert.alert(
      'Remove highlight?',
      'This will remove the color from the selected passage.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removePassageHighlight(id) },
      ],
    );
  };

  const renderRead = () => (
    <View style={styles.page}>
      <Eyebrow>Read</Eyebrow>
      <PageTitle>Read slowly.</PageTitle>
      <PageLead>Press and hold, then drag to select the words you want to highlight.</PageLead>

      {showTextSettings ? (
        <View style={styles.textSettings}>
          <View style={styles.readerTopRow}>
            <View style={styles.readerQuickControls}>
              <View style={styles.textSizeControls}>
                <TouchableOpacity style={styles.textSizeButton} onPress={() => stepReaderValue(FONT_SIZES, scriptureFontSize, -1, setScriptureFontSize)} accessibilityLabel="Decrease text size">
                  <ThemedText weight="semiBold" style={styles.readerSmallA}>A</ThemedText>
                </TouchableOpacity>
                <ThemedText weight="semiBold" style={styles.textSizeValue}>{scriptureFontSize}</ThemedText>
                <TouchableOpacity style={styles.textSizeButton} onPress={() => stepReaderValue(FONT_SIZES, scriptureFontSize, 1, setScriptureFontSize)} accessibilityLabel="Increase text size">
                  <ThemedText weight="semiBold" style={styles.readerLargeA}>A</ThemedText>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={[styles.readerBoldButton, scriptureBold && styles.readerControlActive]} onPress={() => setScriptureBold(value => !value)}>
                <ThemedText weight="semiBold" style={[styles.readerBoldText, scriptureBold && styles.readerControlTextActive]}>Bold</ThemedText>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.readerResetButton} onPress={resetReaderSettings} accessibilityLabel="Reset reader settings">
              <Ionicons name="refresh-outline" size={15} color={Colors.sage} />
            </TouchableOpacity>
          </View>

          <View style={styles.readerOptionGroup}>
            <View style={styles.readerFontRow}>
              {READER_FONTS.map(option => {
                const active = scriptureFont === option.key;
                return (
                  <TouchableOpacity key={option.key} style={[styles.readerFontChip, active && styles.readerControlActive]} onPress={() => { triggerLightHaptic(); setScriptureFont(option.key); }}>
                    <ThemedText weight="semiBold" style={[styles.readerFontChipText, active && styles.readerControlTextActive]}>{option.label}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.readerDivider} />
            <View style={styles.readerAlignRow}>
              {READER_ALIGNMENTS.map(option => {
                const active = scriptureAlign === option.key;
                return (
                  <TouchableOpacity key={option.key} style={[styles.readerAlignButton, active && styles.readerControlActive]} onPress={() => { triggerLightHaptic(); setScriptureAlign(option.key); }} accessibilityLabel={`Align ${option.label}`}>
                    <MaterialCommunityIcons name={option.icon as any} size={16} color={active ? Colors.hopeWhite : Colors.textGray} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity style={styles.readerAdvancedButton} onPress={() => setAdvancedTextSettings(value => !value)}>
            <ThemedText style={styles.readerAdvancedText}>Advanced</ThemedText>
            <Ionicons name={advancedTextSettings ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textGray} />
          </TouchableOpacity>

          {advancedTextSettings ? (
            <View style={styles.readerAdvancedSettings}>
              {[
                { label: 'Lines', values: LINE_SPACING, value: scriptureLineSpacing, update: setScriptureLineSpacing },
                { label: 'Letters', values: LETTER_SPACING, value: scriptureLetterSpacing, update: setScriptureLetterSpacing },
                { label: 'Indent', values: INDENTS, value: scriptureIndent, update: setScriptureIndent },
              ].map(setting => (
                <View key={setting.label} style={styles.readerSettingRow}>
                  <ThemedText style={styles.textSettingsLabel}>{setting.label}</ThemedText>
                  <View style={styles.textSizeControls}>
                    <TouchableOpacity style={styles.textSizeButton} onPress={() => stepReaderValue(setting.values, setting.value, -1, setting.update)}>
                      <ThemedText weight="semiBold" style={styles.textSizeButtonText}>−</ThemedText>
                    </TouchableOpacity>
                    <ThemedText weight="semiBold" style={styles.textSizeValue}>{setting.value}</ThemedText>
                    <TouchableOpacity style={styles.textSizeButton} onPress={() => stepReaderValue(setting.values, setting.value, 1, setting.update)}>
                      <ThemedText weight="semiBold" style={styles.textSizeButtonText}>+</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.scripture}>
          {passageLoading ? (
            <ActivityIndicator color={Colors.sage} />
          ) : (
            <View style={styles.selectablePassageLayer} onTouchEnd={event => event.stopPropagation()}>
              <Text
                pointerEvents="box-none"
                style={[styles.highlightedPassageText, {
                  fontSize: scriptureFontSize,
                  lineHeight: scriptureFontSize * 1.6 + scriptureLineSpacing,
                  letterSpacing: scriptureLetterSpacing,
                  textAlign: scriptureAlign,
                  paddingLeft: scriptureIndent,
                  fontFamily: getFontFamily(scriptureFont, scriptureBold ? 'bold' : 'regular'),
                }]}
              >
                {highlightedPassageSegments.map(segment => (
                  <Text
                    key={segment.key}
                    pointerEvents={segment.color ? 'auto' : 'none'}
                    style={segment.color ? { backgroundColor: segment.color } : undefined}
                    onPress={segment.color ? () => {
                      const highlight = highlights.find(item => item.id === segment.key);
                      if (!highlight) {return;}
                      const start = highlight.selectionStart ?? selectablePassageText.indexOf(highlight.text);
                      if (start < 0) {return;}
                      setActiveHighlightId(segment.key);
                      setPassageSelection({ start, end: start });
                      setHighlightActionsVisible(true);
                    } : dismissHighlightActions}
                    accessibilityRole={segment.color ? 'button' : undefined}
                    accessibilityLabel={segment.color ? 'Edit highlight' : undefined}
                  >
                    {segment.text}
                  </Text>
                ))}
              </Text>
              <TextInput
                value={selectablePassageText}
                editable={false}
                multiline
                scrollEnabled={false}
                caretHidden
                showSoftInputOnFocus={false}
                selectionColor="rgba(82,106,91,0.28)"
                onTouchStart={() => {
                  ignoreSelectionEvents.current = false;
                  setHighlightActionsVisible(false);
                  setActiveHighlightId(null);
                }}
                onSelectionChange={({ nativeEvent }) => {
                  if (ignoreSelectionEvents.current) {return;}
                  setPassageSelection(nativeEvent.selection);
                  const { start, end } = nativeEvent.selection;
                  if (start === end) {
                    const tapped = highlights.find(highlight => {
                      const from = highlight.selectionStart ?? selectablePassageText.indexOf(highlight.text);
                      const to = highlight.selectionEnd ?? (from + highlight.text.length);
                      return from >= 0 && start >= from && start < to;
                    });
                    setActiveHighlightId(tapped?.id ?? null);
                    setHighlightActionsVisible(!!tapped);
                  } else {
                    setActiveHighlightId(null);
                    setHighlightActionsVisible(true);
                  }
                }}
                style={[styles.selectablePassage, {
                fontSize: scriptureFontSize,
                lineHeight: scriptureFontSize * 1.6 + scriptureLineSpacing,
                letterSpacing: scriptureLetterSpacing,
                textAlign: scriptureAlign,
                paddingLeft: scriptureIndent,
                fontFamily: getFontFamily(scriptureFont, scriptureBold ? 'bold' : 'regular'),
                }]}
              />
              {highlightActionsVisible && (selectedPassageText || selectedHighlight) ? (
                <View
                  style={[styles.highlightSelectionButton, { top: selectionActionTop }]}
                >
                      <Ionicons name="color-fill-outline" size={16} color={Colors.sage} />
                      {HIGHLIGHT_COLORS.map(color => (
                        <TouchableOpacity
                          key={color}
                          onPress={() => savePassageHighlight(color)}
                          style={[
                            styles.highlightColorButton,
                            { backgroundColor: color.replace(/0\.\d+\)/, '0.9)') },
                            selectedHighlight?.color === color && styles.highlightColorSelected,
                          ]}
                          accessibilityLabel="Apply highlight color"
                        />
                      ))}
                      {selectedHighlight ? <TouchableOpacity
                        onPress={() => confirmRemoveHighlight(selectedHighlight.id)}
                        style={styles.paletteRemoveButton} accessibilityRole="button" accessibilityLabel="Remove this highlight">
                        <Ionicons name="trash-outline" size={17} color={Colors.textGray} />
                      </TouchableOpacity> : null}
                      <TouchableOpacity onPress={dismissHighlightActions} style={styles.paletteRemoveButton}
                        accessibilityRole="button" accessibilityLabel="Dismiss highlight controls">
                        <Ionicons name="close" size={17} color={Colors.textGray} />
                      </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}
      </View>

      <View style={styles.spacer} />
    </View>
  );

  const renderObserve = () => {
    const highlight = highlights[observeHighlightIndex];

    if (!highlight) {
      return (
        <View style={styles.page}>
          <Eyebrow>Observe</Eyebrow>
          <PageTitle>What do you notice?</PageTitle>
          <PageLead>Look again at the passage. What do you see in the text?</PageLead>
          <TextInput
            multiline
            value={observationText}
            onChangeText={(text) => { setObservationText(text); scheduleDraftSave(); }}
            onBlur={saveDraft}
            placeholder="Start writing what you notice..."
            placeholderTextColor={Colors.placeholderText}
            style={styles.observationInputPlain}
          />
          <View style={styles.spacer} />
        </View>
      );
    }

    return (
      <View style={styles.page}>
        <Eyebrow>{`Observe · ${observeHighlightIndex + 1} of ${highlights.length}`}</Eyebrow>
        <PageTitle>What do you notice?</PageTitle>
        <PageLead>Stay with this highlight. What stands out in these words?</PageLead>

        <View style={styles.focusedHighlight}>
          <View style={[styles.focusedHighlightMarker, { backgroundColor: highlight.color ?? HIGHLIGHT_COLORS[0] }]} />
          <ThemedText style={styles.focusedHighlightText}>{highlight.text}</ThemedText>
        </View>

        <View style={styles.chips}>
          {OBSERVE_PROMPTS.map((prompt) => (
            <Chip
              key={prompt}
              label={prompt}
              on={(highlightPromptSelections[highlight.id] ?? []).includes(prompt)}
              onPress={() => toggleHighlightPrompt(highlight.id, prompt)}
            />
          ))}
        </View>

        {(highlightPromptSelections[highlight.id] ?? []).length > 0 ? (
          (highlightPromptSelections[highlight.id] ?? []).map(prompt => (
            <View
              key={prompt}
              style={styles.observationNoteType}
              onLayout={({ nativeEvent }) => {
                observationNoteLayouts.current[`${highlight.id}:${prompt}`] = nativeEvent.layout.y;
              }}
            >
              <ThemedText weight="semiBold" style={styles.observationNoteLabel}>{prompt}</ThemedText>
              <TextInput
                ref={input => { observationInputRefs.current[`${highlight.id}:${prompt}`] = input; }}
                multiline
                onFocus={() => {
                  const focusKey = `${highlight.id}:${prompt}`;
                  activeObservationFocus.current = focusKey;
                }}
                value={highlightPromptNotes[highlight.id]?.[prompt] ?? ''}
                onChangeText={(text) => {
                  setHighlightPromptNotes(current => ({
                    ...current,
                    [highlight.id]: {
                      ...(current[highlight.id] ?? {}),
                      [prompt]: text,
                    },
                  }));
                  scheduleDraftSave();
                }}
                onBlur={saveDraft}
                placeholder={OBSERVE_NOTE_PLACEHOLDERS[prompt] ?? 'Write what you notice...'}
                placeholderTextColor={Colors.placeholderText}
                style={[styles.observationInputPlain, styles.observationNoteInput]}
              />
            </View>
          ))
        ) : (
          <TextInput
            multiline
            value={highlightObservations[highlight.id] ?? ''}
            onChangeText={(text) => {
              setHighlightObservations(current => ({ ...current, [highlight.id]: text }));
              scheduleDraftSave();
            }}
            onBlur={saveDraft}
            placeholder="Write what you notice, or choose a note type above..."
            placeholderTextColor={Colors.placeholderText}
            style={styles.observationInputPlain}
          />
        )}

        <View style={styles.spacer} />
      </View>
    );
  };

  const renderUnderstand = () => {
    if (understandingPhase === 'main') {
      return (
        <View style={styles.page}>
          <Eyebrow>Understand</Eyebrow>
          <PageTitle>What is this passage teaching?</PageTitle>
          <PageLead>In your own words, what do you think the main truth or message is?</PageLead>
          <TextInput
            multiline
            autoFocus
            value={understandingText}
            onChangeText={(text) => { setUnderstandingText(text); scheduleDraftSave(); }}
            onBlur={saveDraft}
            placeholder="Write the main truth in your own words..."
            placeholderTextColor={Colors.placeholderText}
            style={styles.observationInputPlain}
          />
          <View style={styles.spacer} />
        </View>
      );
    }

    return (
      <View style={styles.page}>
        <Eyebrow>Go deeper</Eyebrow>
        <PageTitle>Would you like to go deeper?</PageTitle>
        <PageLead>Choose any questions you want to explore. You don’t need to answer them all.</PageLead>

        <View style={styles.chips}>
          {UNDERSTAND_PROMPTS.map((prompt) => (
            <Chip
              key={prompt}
              label={prompt}
              on={understandingPromptSelections.includes(prompt)}
              onPress={() => toggleUnderstandingPrompt(prompt)}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={() => advance('respond')}
          activeOpacity={0.7}
          style={styles.skipQuestionsButton}
          accessibilityRole="button"
          accessibilityLabel="Skip deeper questions"
        >
          <ThemedText weight="semiBold" style={styles.skipDeeperText}>Skip these questions</ThemedText>
        </TouchableOpacity>

        {understandingPromptSelections.length > 0 ? (
          <View style={styles.deeperNotes}>
            {understandingPromptSelections.map((prompt) => (
              <View key={prompt} style={styles.observationNoteType}>
                <ThemedText weight="semiBold" style={styles.observationNoteLabel}>{prompt}</ThemedText>
                <TextInput
                  ref={input => { understandingInputRefs.current[prompt] = input; }}
                  multiline
                  value={understandingPromptNotes[prompt] ?? ''}
                  onChangeText={(text) => {
                    setUnderstandingPromptNotes(current => ({ ...current, [prompt]: text }));
                    scheduleDraftSave();
                  }}
                  onBlur={saveDraft}
                  placeholder={UNDERSTAND_NOTE_PLACEHOLDERS[prompt] ?? 'Write what you are understanding...'}
                  placeholderTextColor={Colors.placeholderText}
                  style={[styles.observationInputPlain, styles.observationNoteInput]}
                />
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.spacer} />
      </View>
    );
  };

  const renderRespond = () => {
    const responseEntries = responsePromptSelections
      .map(prompt => ({ prompt, text: responsePromptNotes[prompt]?.trim() ?? '' }))
      .filter(entry => entry.text);

    if (responsePhase === 'prayer') {
      return (
        <View style={styles.page}>
          <Eyebrow>Pray</Eyebrow>
          <PageTitle>Turn your response into prayer.</PageTitle>
          <PageLead>You don’t need new words. Begin with what you just wrote.</PageLead>

          {responseEntries.length > 0 ? (
            <View style={styles.prayerResponseReminder}>
              <ThemedText weight="semiBold" style={styles.observationNoteLabel}>Your response</ThemedText>
              {responseEntries.map(entry => (
                <View key={entry.prompt} style={styles.prayerResponseItem}>
                  <ThemedText weight="semiBold" style={styles.prayerResponseType}>{entry.prompt}</ThemedText>
                  <ThemedText style={styles.prayerResponseText}>{entry.text}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          <TextInput
            multiline
            autoFocus
            value={prayerText}
            onChangeText={(text) => { setPrayerText(text); scheduleDraftSave(); }}
            onBlur={saveDraft}
            placeholder="Father..."
            placeholderTextColor={Colors.placeholderText}
            style={styles.observationInputPlain}
          />

          <View style={styles.spacer} />
        </View>
      );
    }

    return (
    <View style={styles.page}>
      <Eyebrow>Respond</Eyebrow>
      <PageTitle>How will you respond to what you've read?</PageTitle>
      <PageLead>Choose any responses that fit. You can journal each one in your own words.</PageLead>

      <View style={styles.chips}>
        {RESPONSE_PROMPTS.map((prompt) => (
          <Chip
            key={prompt}
            label={prompt}
            on={responsePromptSelections.includes(prompt)}
            onPress={() => toggleResponsePrompt(prompt)}
          />
        ))}
      </View>

      {responsePromptSelections.length > 0 ? (
        <View style={styles.responseNotes}>
          {responsePromptSelections.map((prompt, index) => (
            <View key={prompt} style={styles.observationNoteType}>
              <ThemedText weight="semiBold" style={styles.observationNoteLabel}>{prompt}</ThemedText>
              <TextInput
                multiline
                autoFocus={index === responsePromptSelections.length - 1}
                value={responsePromptNotes[prompt] ?? ''}
                onChangeText={(text) => {
                  setResponsePromptNotes(current => ({ ...current, [prompt]: text }));
                  scheduleDraftSave();
                }}
                onBlur={saveDraft}
                placeholder={RESPONSE_NOTE_PLACEHOLDERS[prompt] ?? 'Write your response...'}
                placeholderTextColor={Colors.placeholderText}
                style={[styles.observationInputPlain, styles.observationNoteInput]}
              />
            </View>
          ))}

        </View>
      ) : null}

      <View style={styles.spacer} />
    </View>
    );
  };

  const renderSaved = () => {
    if (!session) {return null;}
    const content = buildContent();
    const dateText = session.completed_at
      ? format(new Date(session.completed_at), 'MMMM d, yyyy')
      : format(new Date(session.selected_date), 'MMMM d, yyyy');

    return (
      <View style={[styles.page, styles.centered]}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={32} color={Colors.hopeWhite} />
        </View>
        <ThemedText weight="semiBold" style={styles.eyebrow}>Bible Study saved</ThemedText>
        <ThemedText weight="bold" style={styles.title}>{session.passage.reference}</ThemedText>
        <ThemedText style={styles.lead}>{dateText}</ThemedText>

        <Card soft style={{ width: '100%' }}>
          <View style={styles.summaryRow}>
            <Eyebrow>Highlights</Eyebrow>
            <ThemedText weight="semiBold" style={styles.summaryText}>
              {content.highlights.length}
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <Eyebrow>Observation</Eyebrow>
            <ThemedText weight="semiBold" style={styles.summaryText}>
              {content.observation.text.trim() ? 'Recorded' : 'No observations recorded'}
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <Eyebrow>Understanding</Eyebrow>
            <ThemedText weight="semiBold" style={styles.summaryText}>
              {content.understanding.text.trim() ? 'Recorded' : 'No understanding recorded'}
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <Eyebrow>Response</Eyebrow>
            <ThemedText weight="semiBold" style={styles.summaryText}>
              {content.response.text.trim() ? 'Recorded' : 'No response recorded'}
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <Eyebrow>Prayer</Eyebrow>
            <ThemedText weight="semiBold" style={styles.summaryText}>
              {content.prayer.saveToPrayerJournal ? 'Saved to Prayer Journal' : 'Not saved'}
            </ThemedText>
          </View>
        </Card>

        <PrimaryButton onPress={() => setStage('detail')}>View Bible Study</PrimaryButton>
        <SecondaryButton onPress={() => { if (navigation.canGoBack()) {navigation.goBack();} }}>Done</SecondaryButton>
      </View>
    );
  };


  const content = () => {
    switch (stage) {
      case 'home': return renderHome();
      case 'read': return renderRead();
      case 'observe': return renderObserve();
      case 'understand': return renderUnderstand();
      case 'respond': return renderRespond();
      case 'saved': return renderSaved();
      case 'detail': return null; // The saved view owns its own scrolling and action bar.
      default: return renderHome();
    }
  };

  const renderFooter = () => {
    switch (stage) {
      case 'read':
        return (
          <View style={styles.readFooterRow}>
            <TouchableOpacity
              style={[styles.readPassageButton, passageRead && styles.readPassageButtonActive]}
              onPress={() => { triggerLightHaptic(); setPassageRead(value => !value); }}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: passageRead }}
            >
              <Ionicons
                name={passageRead ? 'checkmark-circle' : 'book-outline'}
                size={16}
                color={passageRead ? Colors.hopeWhite : Colors.sage}
              />
              <ThemedText weight="medium" style={[styles.readPassageText, passageRead && styles.readPassageTextActive]}>
                {passageRead ? 'Passage read' : 'Read the passage'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => advance('observe')}
              activeOpacity={0.7}
              style={styles.nextButton}
              accessibilityRole="button"
              accessibilityLabel="Next"
            >
              <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </View>
        );
      case 'observe':
        return (
          <TouchableOpacity
            onPress={() => {
              if (highlights.length > 0 && observeHighlightIndex < highlights.length - 1) {
                triggerLightHaptic();
                setObserveHighlightIndex(index => index + 1);
              } else {
                advance('understand');
              }
            }}
            activeOpacity={0.7}
            style={styles.nextButton}
            accessibilityRole="button"
            accessibilityLabel={observeHighlightIndex < highlights.length - 1 ? 'Next highlight' : 'Continue'}
          >
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        );
      case 'understand':
        return understandingPhase === 'main' ? (
          <TouchableOpacity
            onPress={() => { triggerLightHaptic(); setUnderstandingPhase('deeper'); }}
            activeOpacity={0.7}
            style={styles.nextButton}
            accessibilityRole="button"
            accessibilityLabel="Go deeper"
          >
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => advance('respond')}
            activeOpacity={0.7}
            style={styles.nextButton}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        );
      case 'respond':
        if (responsePhase === 'journal' && responsePromptSelections.length === 0) {return null;}
        if (responsePhase === 'journal') {return (
          <TouchableOpacity
            onPress={() => { triggerLightHaptic(); setResponsePhase('prayer'); }}
            activeOpacity={0.7}
            style={styles.nextButton}
            accessibilityRole="button"
            accessibilityLabel="Turn response into prayer"
          >
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        );}
        return (
          <View style={styles.prayerFooterRow}>
            <View style={styles.prayerFooterChoices}>
              <TouchableOpacity
                style={[styles.prayerToggle, saveToPrayerJournal && styles.prayerToggleSelected]}
                activeOpacity={0.7}
                onPress={() => {
                  triggerLightHaptic();
                  setSaveToPrayerJournal(value => {
                    if (value) {setTrackAnsweredPrayer(false);}
                    return !value;
                  });
                  scheduleDraftSave();
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: saveToPrayerJournal }}
              >
                <View style={[styles.prayerToggleCircle, saveToPrayerJournal && styles.prayerToggleCircleSelected]}>
                  {saveToPrayerJournal ? <Ionicons name="checkmark" size={13} color={Colors.hopeWhite} /> : null}
                </View>
                <ThemedText weight="medium" style={[styles.prayerToggleText, saveToPrayerJournal && styles.prayerToggleTextSelected]}>Save to journal</ThemedText>
              </TouchableOpacity>
              {saveToPrayerJournal ? (
                <TouchableOpacity
                  style={[styles.prayerToggle, trackAnsweredPrayer && styles.prayerToggleSelected]}
                  activeOpacity={0.7}
                  onPress={() => { triggerLightHaptic(); setTrackAnsweredPrayer(value => !value); scheduleDraftSave(); }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: trackAnsweredPrayer }}
                >
                  <View style={[styles.prayerToggleCircle, trackAnsweredPrayer && styles.prayerToggleCircleSelected]}>
                    {trackAnsweredPrayer ? <Ionicons name="checkmark" size={13} color={Colors.hopeWhite} /> : null}
                  </View>
                  <ThemedText weight="medium" style={[styles.prayerToggleText, trackAnsweredPrayer && styles.prayerToggleTextSelected]}>Track if answered</ThemedText>
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => advance('saved')} activeOpacity={0.7} style={styles.nextButton} accessibilityRole="button" accessibilityLabel="Save Bible study">
              <Ionicons name="checkmark" size={24} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.sage} />
      </View>
    );
  }

  if (stage === 'detail' && (savedReflection || session)) {
    const selectedDate = savedReflection?.selected_date || session!.selected_date;
    const reflectionId = savedReflection?.id || session?.reflection_ref?.local_id;
    return <BibleStudyDetailView
      reference={savedReflection?.title || savedReflection?.metadata?.passage?.reference || session?.passage.reference || 'Bible Study'}
      selectedDate={selectedDate}
      translation={savedReflection?.metadata?.passage?.translation || session?.passage.translation || 'NASB'}
      content={buildContent()}
      onClose={() => { triggerLightHaptic(); navigation.goBack(); }}
      onEdit={async () => {
        if (!reflectionId) {throw new Error('Saved reflection is missing.');}
        const reflection = await getLocalReflection(reflectionId, 'scripture', selectedDate);
        const originalContent = reflection && parseSavedBibleStudy(reflection);
        const linkedId = reflection?.metadata?.bibleStudySessionId || session?.id;
        const originalSession = linkedId ? await getBibleStudySession(linkedId) : null;
        if (!originalSession || !originalContent) {throw new Error('Original study session is missing.');}
        applyContent(originalContent);
        // Aggregated previews must not override edits to the original structured notes.
        if (Object.keys(originalContent.observation.byHighlight ?? {}).length ||
            Object.keys(originalContent.observation.promptNotesByHighlight ?? {}).length) {
          setObservationText('');
        }
        if (originalContent.response.prompts?.length) {setResponseText('');}
        setSession(originalSession);
        setSavedReflection(null);
        setObserveHighlightIndex(0);
        setUnderstandingPhase('main');
        setResponsePhase('journal');
        setPassageRead(originalContent.passageRead === true);
        setEditingSavedStudy(true);
        await loadPassageText(originalSession.passage.reference, originalSession.passage.translation ?? 'NASB');
        setStage('read');
      }}
      onDelete={async () => {
        if (!reflectionId) {throw new Error('Saved reflection is missing.');}
        await deleteLocalReflection(reflectionId, 'scripture', selectedDate);
        const sessionId = savedReflection?.metadata?.bibleStudySessionId || session?.id;
        if (sessionId) {await deleteBibleStudySession(sessionId);}
        // The intentionally saved prayer is a separate canonical record.
        DeviceEventEmitter.emit('reflection_deleted', reflectionId);
        DeviceEventEmitter.emit('bible_study_saved', reflectionId);
        navigation.goBack();
      }}
    />;
  }

  return (
    <KeyboardAvoidingView
      onTouchEnd={() => { if (stage === 'read') {dismissHighlightActions();} }}
      style={[
        styles.container,
        stage === 'home' && styles.homeContainer,
        { paddingTop: stage === 'home' ? 0 : insets.top, paddingBottom: insets.bottom },
      ]}
      behavior={Platform.OS === 'ios' && stage !== 'observe' && stage !== 'understand' && stage !== 'respond' ? 'padding' : undefined}
    >
      {renderTop()}
      {renderProgress()}
      <ScrollView
        onScrollBeginDrag={() => { if (stage === 'read') {dismissHighlightActions();} }}
        ref={screenScrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          stage === 'observe' && keyboardHeight > 0 && { paddingBottom: keyboardHeight },
          stage === 'understand' && keyboardHeight > 0 && { paddingBottom: keyboardHeight },
          stage === 'respond' && keyboardHeight > 0 && { paddingBottom: keyboardHeight },
        ]}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        onContentSizeChange={() => {
          if (stage !== 'understand' || !pendingUnderstandingFocus || keyboardHeight <= 0) {return;}
          requestAnimationFrame(() => {
            screenScrollRef.current?.scrollToEnd({ animated: true });
            setPendingUnderstandingFocus(null);
          });
        }}
      >
        {content()}
      </ScrollView>
      {renderFooter() ? (
        <View style={[
          styles.footer,
          (stage === 'read' || stage === 'observe' || stage === 'understand' || stage === 'respond') && styles.floatingReadFooter,
          (stage === 'observe' || stage === 'understand' || stage === 'respond') && keyboardHeight > 0 && { bottom: keyboardHeight },
        ]}>
          {renderFooter()}
        </View>
      ) : null}
      <ScriptureReaderModal
        visible={scriptureReaderOpen}
        passages={session ? [{ reference: session.passage.reference }] : []}
        initialIndex={0}
        version={session?.passage.translation ?? 'NASB'}
        onClose={() => setScriptureReaderOpen(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
  },
  homeContainer: {
    backgroundColor: Colors.lightBackground,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  page: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  homePage: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  centered: {
    alignItems: 'center',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 50,
  },
  topIcon: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 42,
    zIndex: 100,
  },
  homeNavButton: {
    position: 'absolute',
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 999,
  },
  homeCloseButton: {
    right: 20,
  },
  homeBackButton: {
    left: 20,
  },
  homeLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 32,
    marginBottom: 8,
  },
  topTitle: {
    fontSize: 15,
    color: Colors.text,
    textAlign: 'center',
  },
  topTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topReaderIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  aaHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: Colors.sage,
  },
  aaHeaderButtonActive: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  aaHeaderButtonText: {
    fontSize: 16,
    color: Colors.sage,
  },
  aaHeaderButtonTextActive: {
    color: Colors.hopeWhite,
  },
  homeEyebrow: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.sageMuted,
  },
  homeTitle: {
    fontSize: 24,
    lineHeight: 32,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  homeLead: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 30,
  },
  progress: {
    width: 96,
    height: 4,
    alignSelf: 'center',
    backgroundColor: Colors.lightBorder,
    borderRadius: 999,
    marginTop: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.sage,
    borderRadius: 999,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    color: Colors.sage,
    marginBottom: 8,
  },
  title: {
    fontFamily: Fonts.lora.bold,
    fontSize: 30,
    lineHeight: 36,
    color: Colors.text,
    marginBottom: 10,
  },
  h2: {
    fontFamily: Fonts.lora.bold,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.text,
    marginBottom: 4,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textGray,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 19,
    marginBottom: 14,
  },
  cardSoft: {
    backgroundColor: Colors.anchorBlueLight,
    borderColor: Colors.anchorBlueLight,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: Colors.sage,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: 'transparent',
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 14,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: Colors.sage,
  },
  search: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 15,
    fontFamily: Fonts.regular,
    fontSize: 17,
    color: Colors.text,
  },
  passageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.mediumBorder,
    marginHorizontal: 8,
    marginBottom: 42,
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: Colors.sageMuted,
    textAlign: 'center',
    marginBottom: 18,
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  topicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(82, 106, 91, 0.2)',
  },
  topicButtonText: {
    fontSize: 15,
    color: Colors.text,
  },
  allTopicsButton: {
    alignSelf: 'center',
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.mediumBorder,
  },
  allTopicsText: {
    fontSize: 14,
    color: Colors.sage,
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.anchorBlueLight,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  resumeLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: Colors.sage,
    marginBottom: 4,
  },
  resumeReference: {
    fontSize: 16,
    color: Colors.text,
  },
  rowText: {
    flex: 1,
  },
  passageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightBorder,
    paddingVertical: 17,
  },
  passageReference: {
    fontSize: 17,
    color: Colors.text,
    marginBottom: 5,
  },
  passageContext: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textGray,
    paddingRight: 12,
  },
  curatedNote: {
    fontSize: 11,
    lineHeight: 17,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 22,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 16,
  },
  chip: {
    borderWidth: 0.5,
    borderColor: 'rgba(82, 106, 91, 0.2)',
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: Colors.sageMuted,
    borderColor: Colors.sage,
  },
  chipText: {
    fontSize: 15,
    color: Colors.text,
  },
  chipTextOn: {
    color: Colors.hopeWhite,
  },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 17,
    backgroundColor: Colors.cardBackground,
    padding: 15,
    fontSize: 16,
    color: Colors.text,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  observationInputPlain: {
    minHeight: 150,
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontFamily: Fonts.regular,
    fontSize: 17,
    lineHeight: 26,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  observationNoteType: {
    marginTop: 0,
    marginBottom: 6,
  },
  observationNoteLabel: {
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: Colors.sage,
  },
  observationNoteInput: {
    minHeight: 82,
    paddingTop: 6,
    paddingBottom: 6,
  },
  focusedHighlight: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 4,
    marginBottom: 24,
    paddingVertical: 4,
  },
  focusedHighlightMarker: {
    width: 5,
    borderRadius: 3,
    marginRight: 13,
  },
  focusedHighlightText: {
    flex: 1,
    fontFamily: Fonts.lora.regular,
    fontSize: 19,
    lineHeight: 29,
    color: Colors.text,
  },
  responseNotes: {
    marginTop: 20,
  },
  prayerResponseReminder: {
    marginBottom: 20,
  },
  prayerResponseItem: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.anchorBlueLight,
    paddingLeft: 12,
    marginTop: 12,
  },
  prayerResponseType: {
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: Colors.sage,
    marginBottom: 4,
  },
  prayerResponseText: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textGray,
  },
  prayerFooterRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  prayerFooterChoices: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prayerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(82,106,91,0.2)',
    backgroundColor: 'rgba(82,106,91,0.08)',
  },
  prayerToggleSelected: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  prayerToggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  prayerToggleCircleSelected: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: Colors.hopeWhite,
  },
  prayerToggleText: {
    fontSize: 11,
    color: Colors.sage,
  },
  prayerToggleTextSelected: {
    color: Colors.hopeWhite,
  },
  scripture: {
    paddingHorizontal: 2,
    paddingBottom: 16,
  },
  selectablePassage: {
    position: 'relative',
    width: '100%',
    minHeight: 160,
    paddingTop: 0,
    paddingBottom: 0,
    paddingRight: 0,
    color: 'transparent',
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
    zIndex: 1,
  },
  selectablePassageLayer: {
    position: 'relative',
    width: '100%',
  },
  highlightedPassageText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingRight: 0,
    color: Colors.scriptureText,
    zIndex: 2,
  },
  highlightSelectionButton: {
    position: 'absolute',
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 24,
    backgroundColor: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: 'rgba(82,106,91,0.2)',
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 120,
  },
  highlightColorButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(41,52,46,0.12)',
  },
  highlightColorSelected: {
    borderWidth: 2,
    borderColor: Colors.sage,
  },
  paletteRemoveButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82,106,91,0.08)',
  },
  tappedHighlightRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  tappedHighlightRemoveText: {
    fontSize: 12,
    color: Colors.text,
  },
  verseNum: {
    fontFamily: Fonts.lora.bold,
    fontSize: 20,
    lineHeight: 30,
    color: Colors.sage,
  },
  textSettings: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 22,
    backgroundColor: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: 'rgba(82,106,91,0.2)',
    gap: 12,
  },
  textSettingsLabel: {
    fontSize: 12,
    color: Colors.textGray,
  },
  textSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textSizeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82,106,91,0.1)',
  },
  textSizeButtonText: {
    fontSize: 17,
    color: Colors.sage,
  },
  textSizeValue: {
    width: 28,
    textAlign: 'center',
    fontSize: 13,
    color: Colors.sage,
  },
  readerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readerQuickControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readerSmallA: {
    fontSize: 12,
    color: Colors.textGray,
  },
  readerLargeA: {
    fontSize: 18,
    color: Colors.text,
  },
  readerBoldButton: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(82,106,91,0.2)',
    backgroundColor: 'rgba(82,106,91,0.06)',
  },
  readerBoldText: {
    fontSize: 12,
    color: Colors.text,
  },
  readerControlActive: {
    borderColor: Colors.sage,
    backgroundColor: Colors.sage,
  },
  readerControlTextActive: {
    color: Colors.hopeWhite,
  },
  readerResetButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82,106,91,0.06)',
  },
  readerOptionGroup: {
    padding: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(82,106,91,0.06)',
  },
  readerFontRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  readerFontChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82,106,91,0.1)',
  },
  readerFontChipText: {
    fontSize: 11,
    color: Colors.text,
  },
  readerDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
    backgroundColor: 'rgba(82,106,91,0.15)',
  },
  readerAlignRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  readerAlignButton: {
    flex: 1,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerAdvancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 5,
  },
  readerAdvancedText: {
    fontSize: 11,
    color: Colors.textGray,
  },
  readerAdvancedSettings: {
    paddingTop: 2,
    gap: 10,
  },
  readerSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 19,
    marginBottom: 14,
  },
  checkText: {
    fontSize: 16,
    color: Colors.text,
  },
  noticeCardText: {
    fontFamily: Fonts.lora.regular,
    fontStyle: 'italic' as const,
    fontSize: 18,
    lineHeight: 26,
    color: Colors.text,
    marginBottom: 10,
  },
  spacer: {
    height: 100,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.sage,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryRow: {
    marginBottom: 18,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text,
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.lightBackground,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  floatingReadFooter: {
    backgroundColor: 'transparent',
    paddingTop: 0,
  },
  readFooterRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  skipQuestionsButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipDeeperText: {
    fontSize: 14,
    color: Colors.textGray,
  },
  deeperNotes: {
    marginTop: 24,
  },
  readPassageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(82, 106, 91, 0.2)',
  },
  readPassageButtonActive: {
    backgroundColor: Colors.sageMuted,
    borderColor: Colors.sage,
  },
  readPassageText: {
    color: Colors.text,
    fontSize: 15,
  },
  readPassageTextActive: {
    color: Colors.hopeWhite,
  },
  nextButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.sage,
    borderRadius: 20,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignSelf: 'flex-end',
  },
});

export default BibleStudyScreen;

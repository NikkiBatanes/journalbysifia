/**
 * Journal by siFia first-launch setup and product walkthrough.
 * Local-first: signed-in users also receive a best-effort metadata sync.
 */

import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  PanResponder,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {BookHeart, BookOpen, Brain, Clock3, Compass, File, HandHeart, Heart, Pencil, RefreshCw, Sprout, SunMoon} from 'lucide-react-native';

import ThemedText from '../../components/common/ThemedText';
import {SavedReflectionBlocks} from '../../components/journal/SavedReflectionBlocks';
import {JournalAdvancedBlockEditor} from '../../components/journal/shared/JournalAdvancedBlockEditor';
import {JournalTableBlock} from '../../components/journal/shared/JournalTableBlock';
import {
  NOTE_BLOCK_CATEGORIES,
  NOTE_BLOCK_REGISTRY,
  type JournalBlock,
  type NoteBlockDefinition,
  type SelectableJournalBlockKind,
} from '../../components/journal/shared/journalBlocks';
import {useAuth} from '../../context/IndustryStandardAuthContext';
import type {RootStackParamList} from '../../navigation/types';
import {
  getJournalOnboardingSetup,
  JournalFaithGoal,
  JournalRhythmBarrier,
  JournalWeekStart,
  markJournalOnboardingComplete,
  saveJournalOnboardingSetup,
} from '../../services/journalOnboardingState';
import {Colors} from '../../theme/colors';
import {Fonts} from '../../theme/fonts';
import {triggerLightHaptic, triggerSuccessHaptic} from '../../utils/haptics';
import {prefetchDashboardScriptures} from '../../services/dashboardScripturePrefetchService';
import {
  noteBlockPreferences,
  useNoteBlockPreferences,
} from '../../services/noteBlockPreferences';

type JournalOnboardingRoute = RouteProp<RootStackParamList, 'JournalOnboarding'>;
type ChoiceIcon = string | React.ComponentType<{size?: number; color?: string; strokeWidth?: number}>;
type GuidePoint = {icon: ChoiceIcon; heading: string; detail: string};

const TOTAL_STEPS = 15;
const BIBLE_VERSIONS = [
  {key: 'NIV', name: 'New International Version'},
  {key: 'NLT', name: 'New Living Translation'},
  {key: 'ESV', name: 'English Standard Version'},
  {key: 'NKJV', name: 'New King James Version'},
  {key: 'KJV', name: 'King James Version'},
  {key: 'NASB', name: 'New American Standard Bible'},
  {key: 'CSB', name: 'Christian Standard Bible'},
  {key: 'AMP', name: 'Amplified Bible'},
  {key: 'MSG', name: 'The Message'},
] as const;

const DAILY_RHYTHM: GuidePoint[] = [
  {icon: 'sunny-outline', heading: 'Begin Today', detail: 'Check in, meet with Scripture, and name what matters today.'},
  {icon: Pencil, heading: 'Capture the moment', detail: 'Use the pencil whenever you want to write, pray, or remember.'},
  {icon: 'moon-outline', heading: 'Close the Day', detail: 'Return in the evening for gratitude, wisdom, and tomorrow.'},
];

const FAITH_GOALS: {key: JournalFaithGoal; icon: ChoiceIcon; label: string; result: string}[] = [
  {key: 'journal_and_plan', icon: Pencil, label: 'Journal and plan my days with God', result: 'build a rhythm for journaling and planning with God'},
  {key: 'process_life', icon: Brain, label: 'Care for my mental and emotional well-being', result: 'process thoughts and feelings with God'},
  {key: 'remember_growth', icon: Sprout, label: 'Remember prayers and growth', result: 'notice prayers and spiritual growth'},
  {key: 'closer_to_god', icon: Heart, label: 'Grow closer to God', result: 'make space to meet with God'},
  {key: 'consistent_scripture', icon: BookOpen, label: 'Be consistent with Scripture', result: 'return to Scripture consistently'},
];

const RHYTHM_BARRIERS: {key: JournalRhythmBarrier; icon: ChoiceIcon; label: string; response: string}[] = [
  {key: 'where_to_begin', icon: Compass, label: 'I don’t know where to begin', response: 'guided next steps'},
  {key: 'short_on_time', icon: Clock3, label: 'I’m short on time', response: 'a simple rhythm that fits real days'},
  {key: 'hard_to_stay_consistent', icon: RefreshCw, label: 'I start, then lose the rhythm', response: 'a clear place to return'},
  {key: 'blank_page', icon: File, label: 'Blank pages feel overwhelming', response: 'gentle prompts instead of a blank page'},
];

const PRIMARY_WEEK_DAYS: {key: JournalWeekStart; label: string; badge?: string}[] = [
  {key: 'sunday', label: 'Sunday'},
  {key: 'monday', label: 'Monday', badge: 'Common'},
  {key: 'saturday', label: 'Saturday'},
];
const OTHER_WEEK_DAYS: {key: JournalWeekStart; label: string}[] = [
  {key: 'tuesday', label: 'Tuesday'},
  {key: 'wednesday', label: 'Wednesday'},
  {key: 'thursday', label: 'Thursday'},
  {key: 'friday', label: 'Friday'},
];

const ONBOARDING_NOTE_BLOCKS = (Object.values(
  NOTE_BLOCK_REGISTRY,
) as NoteBlockDefinition[]).filter(definition => definition.selectable);

const onboardingPhotoUri = Image.resolveAssetSource(
  require('../../../assets/images/reviews/weekly-cover-looking-back-v2.png'),
).uri;

const NOTE_BLOCK_MOCKUPS: Record<SelectableJournalBlockKind, JournalBlock[]> = {
  section: [{id: 'mock-section', kind: 'section', text: 'What I’m learning'}],
  action: [
    {id: 'mock-action-1', kind: 'action', text: 'Pause before I respond', completed: true},
    {id: 'mock-action-2', kind: 'action', text: 'Pray for wisdom', completed: false},
    {id: 'mock-action-3', kind: 'action', text: 'Encourage someone today', completed: false},
  ],
  bullets: [{id: 'mock-bullets', kind: 'bullets', text: 'What stood out', points: ['Grace meets me here', 'God is present in the waiting', 'I can respond with trust']}],
  numbered: [{id: 'mock-numbered', kind: 'numbered', text: 'Practice this truth', points: ['Pause and listen', 'Write what comes to mind', 'Choose one faithful response']}],
  column: [
    {id: 'mock-column', kind: 'column', text: ''},
    {id: 'mock-column-left', kind: 'photo', text: 'A quiet reminder', uri: onboardingPhotoUri, parentColumnId: 'mock-column', columnSide: 'left'},
    {id: 'mock-column-right-bullets', kind: 'bullets', text: 'Ways to respond', points: ['Pause', 'Pray', 'Trust'], parentColumnId: 'mock-column', columnSide: 'right'},
    {id: 'mock-column-right-quote', kind: 'quote', text: 'Faith is to believe what you do not see; the reward of this faith is to see what you believe.', secondary: 'Augustine', parentColumnId: 'mock-column', columnSide: 'right'},
    {id: 'mock-column-right-voice', kind: 'voice', text: 'Prayer after today’s reading', uri: 'mock://column-voice-note', durationMillis: 18000, parentColumnId: 'mock-column', columnSide: 'right'},
  ],
  photo: [{id: 'mock-photo', kind: 'photo', text: 'A moment worth keeping', uri: onboardingPhotoUri}],
  voice: [{id: 'mock-voice', kind: 'voice', text: 'A thought I wanted to capture', uri: 'mock://voice-note', durationMillis: 24000}],
  scripture: [{id: 'mock-scripture', kind: 'scripture', text: 'Psalm 46:10', scriptureText: 'Be still, and know that I am God.', scriptureReference: 'Psalm 46:10', scriptureVersion: 'NIV'}],
  key: [{id: 'mock-key', kind: 'key', text: 'Grace changes how I respond.'}],
  quote: [{id: 'mock-quote', kind: 'quote', text: 'You have made us for yourself, O Lord, and our heart is restless until it rests in you.', secondary: 'Augustine, Confessions'}],
  song: [{id: 'mock-song', kind: 'song', text: 'Goodness of God', secondary: 'CeCe Winans'}],
  outline: [{id: 'mock-outline', kind: 'outline', text: 'Living with trust', outlineStyle: 'numbered', points: ['Remember who God is', 'Respond with faith']}],
  character: [{id: 'mock-character', kind: 'character', text: 'Ruth', note: 'Faithful in uncertainty and generous in love.', secondary: 'Ruth 1:16'}],
  language: [{id: 'mock-language', kind: 'language', text: 'חֶסֶד · hesed', languageKind: 'hebrew', languageDetails: ['meaning', 'transliteration', 'origin', 'scripture'], meaning: 'Steadfast, covenant love', secondary: 'HEH-sed', origin: 'A loyal love expressed through action', reference: 'Psalm 136:1'}],
  link: [{id: 'mock-link', kind: 'link', text: 'sifia.app/resource'}],
  table: [{id: 'mock-table', kind: 'table', text: '', tableRows: [['Notice', 'Respond'], ['God is near', 'Choose trust']], tableCellAlignments: [['left', 'left'], ['left', 'left']]}],
  history: [{id: 'mock-history', kind: 'history', text: '', historyTypes: ['era', 'culture'], secondary: 'First century', eraPeriod: 'AD', note: 'House churches lived out their faith within the Roman world.', reference: 'Romans 12:1–2'}],
  remember: [{id: 'mock-remember', kind: 'remember', text: 'God met me in an ordinary moment.'}],
  response: [{id: 'mock-response', kind: 'response', text: 'I want to walk this out with patience.'}],
  question: [{id: 'mock-question', kind: 'question', text: 'What is God inviting me to notice?'}],
  reflection_question: [{id: 'mock-reflection-question', kind: 'reflection_question', text: 'Where did I notice grace today?', note: 'In a conversation I almost rushed past.'}],
  revisit: [{id: 'mock-revisit', kind: 'revisit', text: 'Come back to this truth later this week.', secondary: 'Friday'}],
  prayer: [{id: 'mock-prayer', kind: 'prayer', text: 'God, help me carry this truth into today.'}],
  book: [{id: 'mock-book', kind: 'book', text: 'Mere Christianity', secondary: '— C. S. Lewis'}],
};

const OnboardingNoteBlockPreview = ({
  definition,
}: {
  definition: NoteBlockDefinition;
}) => {
  const kind = definition.kind as SelectableJournalBlockKind;
  const fallbackPreviewHeight = kind === 'outline'
    ? 220
    : kind === 'history'
    ? 220
    : kind === 'character'
    ? 180
    : kind === 'column'
    ? 250
    : kind === 'language' || kind === 'table'
    ? 190
    : 150;
  const [measuredPreviewHeight, setMeasuredPreviewHeight] = useState(0);
  const previewHeight = measuredPreviewHeight || fallbackPreviewHeight;
  const tableMockup = kind === 'table' ? NOTE_BLOCK_MOCKUPS.table[0] : null;
  const advancedMockup = kind === 'outline' || kind === 'history' || kind === 'character'
    ? NOTE_BLOCK_MOCKUPS[kind][0]
    : null;

  return (
    <View
      pointerEvents="none"
      style={[styles.noteBlockPreviewViewport, {height: previewHeight}]}
    >
      <View
        style={styles.noteBlockPreviewScale}
        onLayout={({nativeEvent}) => {
          const scaledContentHeight = Math.ceil(nativeEvent.layout.height * 0.6);
          const nextHeight = Math.max(72, scaledContentHeight + 24);
          setMeasuredPreviewHeight(current => current === nextHeight ? current : nextHeight);
        }}
      >
        {tableMockup ? (
          <JournalTableBlock
            rows={tableMockup.tableRows}
            cellAlignments={tableMockup.tableCellAlignments}
            editing
            onChangeRows={() => undefined}
            onChangeCellAlignments={() => undefined}
            onChangeEditing={() => undefined}
            onDelete={() => undefined}
            registerInput={() => undefined}
          />
        ) : advancedMockup ? (
          <JournalAdvancedBlockEditor
            block={advancedMockup}
            onChange={() => undefined}
            onDelete={() => undefined}
            onFocus={() => undefined}
            onCreateSection={advancedMockup.kind === 'outline' ? () => undefined : undefined}
            registerInput={() => undefined}
          />
        ) : (
          <SavedReflectionBlocks
            blocks={NOTE_BLOCK_MOCKUPS[kind]}
            compact
            embedded
          />
        )}
      </View>
    </View>
  );
};

const dateOnly = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateOnly = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {return null;}
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDefaultBirthDate = (): Date => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 25);
  return date;
};

const JournalOnboardingScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<JournalOnboardingRoute>();
  const insets = useSafeAreaInsets();
  const {profile, preferences, updateProfile, updatePreferences} = useAuth();
  const noteBlockPreferenceSnapshot = useNoteBlockPreferences();
  const hydrated = useRef(false);
  const noteBlockSelectionHydrated = useRef(false);
  const noteBlockSelectionChanged = useRef(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [weekStart, setWeekStart] = useState<JournalWeekStart>('monday');
  const [showOtherWeekDays, setShowOtherWeekDays] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [bibleVersion, setBibleVersion] = useState('NASB');
  const [faithGoal, setFaithGoal] = useState<JournalFaithGoal | null>(null);
  const [rhythmBarrier, setRhythmBarrier] = useState<JournalRhythmBarrier | null>(null);
  const [favoriteNoteBlocks, setFavoriteNoteBlocks] = useState<SelectableJournalBlockKind[]>(
    () => [...noteBlockPreferenceSnapshot.favoriteKinds],
  );
  const [validationMessage, setValidationMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);

  const isReplay = route.params?.mode === 'replay';
  const isLastStep = stepIndex === TOTAL_STEPS - 1;

  useEffect(() => {
    if (hydrated.current) {return;}
    hydrated.current = true;
    getJournalOnboardingSetup().then(saved => {
      setFirstName(String(profile?.first_name || profile?.firstName || saved.firstName || '').trim());
      setLastName(String(profile?.last_name || profile?.lastName || saved.lastName || '').trim());
      setBirthDate(parseDateOnly(String(profile?.birth_date || saved.birthDate || '')));
      const storedWeekStart = preferences?.weekStart || saved.weekStart || 'monday';
      setWeekStart(storedWeekStart as JournalWeekStart);
      setShowOtherWeekDays(OTHER_WEEK_DAYS.some(day => day.key === storedWeekStart));
      setBibleVersion(String(preferences?.content?.bibleVersion || saved.bibleVersion || 'NASB'));
      setFaithGoal(saved.faithGoal);
      setRhythmBarrier(saved.rhythmBarrier);
    });
  }, [preferences, profile]);

  useEffect(() => {
    if (
      !noteBlockPreferenceSnapshot.loaded
      || noteBlockSelectionHydrated.current
    ) {
      return;
    }
    noteBlockSelectionHydrated.current = true;
    if (!noteBlockSelectionChanged.current) {
      setFavoriteNoteBlocks([...noteBlockPreferenceSnapshot.favoriteKinds]);
    }
  }, [noteBlockPreferenceSnapshot.favoriteKinds, noteBlockPreferenceSnapshot.loaded]);

  const validateSetup = () => {
    if (!firstName.trim()) {
      setValidationMessage('Add your first name to continue.');
      return false;
    }
    if (!lastName.trim()) {
      setValidationMessage('Add your last name to continue.');
      return false;
    }
    if (!birthDate) {
      setValidationMessage('Choose your birth date to continue.');
      return false;
    }
    setValidationMessage('');
    return true;
  };

  const persistSetup = async () => {
    const setup = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate: dateOnly(birthDate as Date),
      weekStart,
      bibleVersion,
      faithGoal,
      rhythmBarrier,
    };
    // Preserve a local copy first so a network problem cannot block setup.
    await saveJournalOnboardingSetup(setup);
    await Promise.allSettled([
      updateProfile({
        first_name: setup.firstName,
        last_name: setup.lastName,
        display_name: `${setup.firstName} ${setup.lastName}`.trim(),
        birth_date: setup.birthDate,
      }),
      updatePreferences({
        ...preferences,
        weekStart: setup.weekStart,
        content: {...(preferences?.content || {}), bibleVersion: setup.bibleVersion},
      }),
    ]);
  };

  const enterJournal = async () => {
    if (isSaving) {return;}
    setIsSaving(true);
    try {
      await persistSetup();
      await markJournalOnboardingComplete();
      triggerSuccessHaptic();
      if (isReplay && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        (navigation as any).reset({index: 0, routes: [{name: 'MainTabs'}]});
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrimaryCta = async () => {
    triggerLightHaptic();
    if (stepIndex === 2 && !faithGoal) {
      setValidationMessage('Choose the hope that feels closest to you.');
      return;
    }
    if (stepIndex === 3 && !rhythmBarrier) {
      setValidationMessage('Choose what most often gets in the way.');
      return;
    }
    if (stepIndex === 9) {
      if (!validateSetup()) {return;}
      await persistSetup();
    }
    if (stepIndex === 12) {
      // The final summary gives this request time to finish before Today opens.
      prefetchDashboardScriptures(bibleVersion).catch(() => {});
    }
    if (stepIndex === 13) {
      if (!favoriteNoteBlocks.length) {
        setValidationMessage('Choose at least one favorite note block.');
        return;
      }
      await noteBlockPreferences.setFavoriteKinds(favoriteNoteBlocks);
    }
    if (isLastStep) {
      await enterJournal();
      return;
    }
    setValidationMessage('');
    setStepIndex(previous => previous + 1);
  };

  const handleBack = () => {
    triggerLightHaptic();
    setValidationMessage('');
    if (stepIndex > 0) {
      setStepIndex(previous => previous - 1);
    } else if (isReplay && navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const saveConfirmedBirthDate = (selectedDate: Date) => {
    saveJournalOnboardingSetup({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate: dateOnly(selectedDate),
      weekStart,
      bibleVersion,
      faithGoal,
      rhythmBarrier,
    }).catch(() => {});
  };

  const swipeResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => (
      Math.abs(gestureState.dx) > 18
      && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.4
    ),
    onPanResponderRelease: (_, gestureState) => {
      const isHorizontalSwipe = Math.abs(gestureState.dx) >= 70
        && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.25;
      if (!isHorizontalSwipe) {return;}
      if (gestureState.dx > 0) {
        handleBack();
      } else if (!isSaving) {
        handlePrimaryCta().catch(() => {});
      }
    },
    onPanResponderTerminationRequest: () => true,
  });

  const renderGuidePoints = (points: GuidePoint[]) => (
    <View style={styles.points}>
      {points.map((point, index) => {
        const LucidePointIcon = typeof point.icon === 'string' ? null : point.icon;
        return (
          <View key={point.heading} style={styles.pointRow}>
            <View style={styles.pointIcon}>
              {LucidePointIcon
                ? <LucidePointIcon size={20} color={Colors.sage} strokeWidth={1.9} />
                : <Ionicons name={point.icon as string} size={20} color={Colors.sage} />}
            </View>
            <View style={styles.pointCopy}>
              <View style={styles.pointHeadingRow}>
                <ThemedText style={styles.pointNumber}>0{index + 1}</ThemedText>
                <ThemedText weight="semiBold" style={styles.pointHeading}>{point.heading}</ThemedText>
              </View>
              <ThemedText style={styles.pointDetail}>{point.detail}</ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );

  const selectedGoal = FAITH_GOALS.find(option => option.key === faithGoal);
  const selectedBarrier = RHYTHM_BARRIERS.find(option => option.key === rhythmBarrier);

  const renderChoice = (
    key: string,
    icon: ChoiceIcon,
    label: string,
    selected: boolean,
    onPress: () => void,
  ) => {
    const LucideChoiceIcon = typeof icon === 'string' ? null : icon;
    const iconColor = selected ? Colors.hopeWhite : Colors.sage;
    return (
      <TouchableOpacity
      key={key}
      style={[styles.choiceCard, selected && styles.choiceCardSelected]}
      activeOpacity={0.8}
      onPress={() => {
        triggerLightHaptic();
        setValidationMessage('');
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{selected}}
      accessibilityLabel={label}
    >
        <View style={[styles.choiceIcon, selected && styles.choiceIconSelected]}>
          {LucideChoiceIcon
            ? <LucideChoiceIcon size={21} color={iconColor} strokeWidth={1.9} />
            : <Ionicons name={icon as string} size={21} color={iconColor} />}
        </View>
        <ThemedText weight="bold" style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</ThemedText>
        <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={selected ? Colors.sage : Colors.lightGray} />
      </TouchableOpacity>
    );
  };

  const renderResearchPage = (
    eyebrow: string,
    title: string,
    Icon: React.ComponentType<{size?: number; color?: string; strokeWidth?: number}>,
    metric: string,
    metricLabel: string,
    finding: string,
    source: string,
  ) => (
    <View>
      <ThemedText style={styles.eyebrow}>{eyebrow}</ThemedText>
      <ThemedText weight="bold" style={styles.title}>{title}</ThemedText>
      <View style={styles.researchHero}>
        <View style={styles.researchHeroIcon}>
          <Icon size={31} color={Colors.sage} strokeWidth={1.8} />
        </View>
        <ThemedText weight="bold" style={styles.researchMetric}>{metric}</ThemedText>
        <ThemedText weight="semiBold" style={styles.researchMetricLabel}>{metricLabel}</ThemedText>
      </View>
      <View style={styles.researchFindingCard}>
        <ThemedText style={styles.researchFinding}>{finding}</ThemedText>
      </View>
      <ThemedText style={styles.researchSource}>{source}</ThemedText>
    </View>
  );

  const renderStep = () => {
    switch (stepIndex) {
      case 0:
        return (
          <View style={styles.heroContent}>
            <Image
              source={require('../../../assets/images/journalbysifia-app-icon.png')}
              style={styles.heroLogo}
              resizeMode="cover"
              accessibilityLabel="Journal by siFia logo"
            />
            <ThemedText style={styles.eyebrow}>JOURNAL BY SIFIA</ThemedText>
            <ThemedText weight="bold" style={styles.heroTitle}>Begin and end your day with God.</ThemedText>
            <ThemedText style={styles.bodyText}>Build a personal rhythm: start your morning with God, carry what matters through the day, and return each evening to reflect, give thanks, and rest.</ThemedText>
            <View style={styles.heroVerseBlock}>
              <View style={styles.heroVerseAccent} />
              <Text style={styles.heroVerseText}>I will remember the works of the LORD…</Text>
              <ThemedText weight="semiBold" style={styles.heroVerseReference}>PSALM 77:11 KJV</ThemedText>
            </View>
          </View>
        );
      case 1:
        return (
          <View style={styles.insightContent}>
            <ThemedText style={styles.eyebrow}>YOU’RE NOT THE ONLY ONE</ThemedText>
            <ThemedText weight="bold" style={styles.title}>The desire is there. The rhythm is hard.</ThemedText>
            <View style={styles.statsPanel}>
              <View style={styles.statRow}>
                <ThemedText weight="bold" style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>51%</ThemedText>
                <ThemedText weight="bold" style={styles.statHeadline}>of U.S. adults said they wish they read the Bible more.</ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statRow}>
                <ThemedText weight="bold" style={styles.secondaryStatNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>80%</ThemedText>
                <ThemedText style={styles.secondaryStatCopy}>of the American Bible Society’s “Movable Middle” said the same. This group is open to the Bible as a source of spiritual wisdom.</ThemedText>
              </View>
            </View>
            <View style={styles.insightConclusion}>
              <ThemedText weight="semiBold" style={styles.insightConclusionLead}>You don’t need more pressure.</ThemedText>
              <ThemedText weight="bold" style={styles.insightConclusionMain}>You need a simple place{'\n'}to begin, and return.</ThemedText>
            </View>
            <TouchableOpacity
              style={styles.verifyToggle}
              onPress={() => {triggerLightHaptic(); setSourcesExpanded(value => !value);}}
              accessibilityRole="button"
              accessibilityState={{expanded: sourcesExpanded}}
            >
              <ThemedText weight="semiBold" style={styles.verifyToggleText}>Verify the sources</ThemedText>
              <Ionicons name={sourcesExpanded ? 'chevron-up' : 'chevron-down'} size={17} color={Colors.sage} />
            </TouchableOpacity>
            {sourcesExpanded ? (
              <View style={styles.sourceList}>
                <View style={styles.sourceItem}>
                  <ThemedText style={styles.sourceNumber}>1.</ThemedText>
                  <Text style={styles.sourceDescription}>
                    <Text style={styles.sourceLink} onPress={() => Linking.openURL('https://www.americanbible.org/news/press-releases/articles/sotb-2025-release/').catch(() => {})}>American Bible Society, State of the Bible 2025 release</Text>
                    {'. It found that 51% of all Americans and 80% of the “Movable Middle” wished they read the Bible more.'}
                  </Text>
                </View>
                <View style={styles.sourceItem}>
                  <ThemedText style={styles.sourceNumber}>2.</ThemedText>
                  <Text style={styles.sourceDescription}>
                    <Text style={styles.sourceLink} onPress={() => Linking.openURL('https://unitedbiblesocieties.org/landmark-gallup-survey-finds-faith-the-norm-globally/').catch(() => {})}>United Bible Societies / Patmos World Bible Attitudes Survey</Text>
                    {'. The survey included 91,000 respondents across 85 countries and territories. Fieldwork took place from 2023 to 2024.'}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        );
      case 2:
        return (
          <View>
            <ThemedText style={styles.eyebrow}>YOUR HOPE</ThemedText>
            <ThemedText weight="bold" style={styles.title}>What would you most like this journal to help with?</ThemedText>
            <ThemedText style={styles.bodyText}>Choose the one that feels most important in this season.</ThemedText>
            <View style={styles.choices}>{FAITH_GOALS.map(option => renderChoice(option.key, option.icon, option.label, faithGoal === option.key, () => setFaithGoal(option.key)))}</View>
            {validationMessage ? <ThemedText style={styles.choiceValidation}>{validationMessage}</ThemedText> : null}
          </View>
        );
      case 3:
        return (
          <View>
            <ThemedText style={styles.eyebrow}>BE HONEST. NO JUDGMENT.</ThemedText>
            <ThemedText weight="bold" style={styles.title}>What usually gets in the way?</ThemedText>
            <ThemedText style={styles.bodyText}>Your answer helps us shape a rhythm you can actually return to.</ThemedText>
            <View style={styles.choices}>{RHYTHM_BARRIERS.map(option => renderChoice(option.key, option.icon, option.label, rhythmBarrier === option.key, () => setRhythmBarrier(option.key)))}</View>
            {validationMessage ? <ThemedText style={styles.choiceValidation}>{validationMessage}</ThemedText> : null}
          </View>
        );
      case 4:
        return renderResearchPage(
          'WHY JOURNALING MATTERS',
          'Writing gives you somewhere to put what you’re carrying.',
          Pencil,
          '31',
          'RANDOMIZED STUDIES',
          'A meta-analysis found a small but significant overall reduction in depression, anxiety, and stress symptoms.',
          'Source: Guo (2023). Journaling is not a guaranteed treatment, and these findings do not mean journaling alone causes improvement.',
        );
      case 5:
        return renderResearchPage(
          'THE PRACTICE OF GRATITUDE',
          'Gratitude helps you notice what is still good.',
          HandHeart,
          '119',
          'PARTICIPANTS',
          'A two-week randomized gratitude study reported gains in well-being, optimism, and sleep quality.',
          'Source: Jackowska et al. (2016). The study describes an association within its specific participants and timeframe.',
        );
      case 6:
        return renderResearchPage(
          'A FAITHFUL RECORD',
          'Writing can help you notice spiritual growth over time.',
          BookHeart,
          '385',
          'PARTICIPANTS',
          'Frequent writers in one church study had higher spiritual-growth and psychological-well-being scores.',
          'Source: Kim et al. (2021). The findings do not establish that keeping a spiritual diary alone caused these outcomes.',
        );
      case 7:
        return (
          <View>
            <ThemedText style={styles.eyebrow}>WHY SCRIPTURE IS PART OF IT</ThemedText>
            <ThemedText weight="bold" style={styles.title}>Christian reflection is more than recording how you feel.</ThemedText>
            <ThemedText style={styles.bodyText}>Scripture gives your reflection an anchor. Your journal helps you carry that truth into prayer, response, and ordinary life.</ThemedText>
            <View style={styles.scripturePath}>
              {[
                {number: '01', title: 'Read', detail: 'Receive the passage.'},
                {number: '02', title: 'Reflect', detail: 'Notice what stands out.'},
                {number: '03', title: 'Respond', detail: 'Pray and write honestly.'},
                {number: '04', title: 'Remember', detail: 'Return to what God is growing.'},
              ].map(item => (
                <View key={item.title} style={styles.scripturePathItem}>
                  <ThemedText style={styles.scripturePathNumber}>{item.number}</ThemedText>
                  <ThemedText weight="semiBold" style={styles.scripturePathTitle}>{item.title}</ThemedText>
                  <ThemedText style={styles.scripturePathDetail}>{item.detail}</ThemedText>
                </View>
              ))}
            </View>
            <View style={styles.heroVerseBlock}>
              <View style={styles.heroVerseAccent} />
              <Text style={styles.heroVerseText}>Thy word is a lamp unto my feet, and a light unto my path.</Text>
              <ThemedText weight="semiBold" style={styles.heroVerseReference}>PSALM 119:105 KJV</ThemedText>
            </View>
          </View>
        );
      case 8:
        return (
          <View>
            <ThemedText style={styles.eyebrow}>A RHYTHM FOR YOU</ThemedText>
            <ThemedText weight="bold" style={styles.title}>Built to help you {selectedGoal?.result || 'grow in faith'}.</ThemedText>
            <ThemedText style={styles.bodyText}>You said you need {selectedBarrier?.response || 'a gentle place to return'}. So your journal always offers one clear next step.</ThemedText>
            {renderGuidePoints(DAILY_RHYTHM)}
          </View>
        );
      case 9:
        return (
          <View>
            <ThemedText style={styles.eyebrow}>LET’S MAKE IT YOURS</ThemedText>
            <ThemedText weight="bold" style={styles.title}>What should your journal call you?</ThemedText>
            <ThemedText style={styles.bodyText}>Add your name and birth date to complete your journal profile.</ThemedText>
            <View style={styles.form}>
              <View>
                <ThemedText weight="semiBold" style={styles.fieldLabel}>First name</ThemedText>
                <TextInput value={firstName} onChangeText={value => {setFirstName(value); setValidationMessage('');}} placeholder="First name" placeholderTextColor={Colors.placeholderText} autoCapitalize="words" autoComplete="given-name" returnKeyType="next" maxLength={40} style={styles.input} />
              </View>
              <View>
                <ThemedText weight="semiBold" style={styles.fieldLabel}>Last name</ThemedText>
                <TextInput value={lastName} onChangeText={value => {setLastName(value); setValidationMessage('');}} placeholder="Last name" placeholderTextColor={Colors.placeholderText} autoCapitalize="words" autoComplete="family-name" returnKeyType="done" maxLength={50} style={styles.input} />
              </View>
              <View>
                <ThemedText weight="semiBold" style={styles.fieldLabel}>Birth date</ThemedText>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => {
                    triggerLightHaptic();
                    Keyboard.dismiss();
                    setShowBirthDatePicker(value => !value);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={birthDate ? `Birth date ${birthDate.toLocaleDateString()}` : 'Choose birth date'}
                >
                  <ThemedText style={[styles.dateInputText, !birthDate && styles.dateInputPlaceholder]}>
                    {birthDate ? birthDate.toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'}) : 'Choose your birth date'}
                  </ThemedText>
                  <Ionicons name="calendar-outline" size={20} color={Colors.sage} />
                </TouchableOpacity>
                {showBirthDatePicker ? (
                  <View style={styles.datePickerWrap}>
                    <DateTimePicker
                      value={birthDate || getDefaultBirthDate()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      maximumDate={new Date()}
                      minimumDate={new Date(new Date().getFullYear() - 120, 0, 1)}
                      onChange={(event, selectedDate) => {
                        if (Platform.OS === 'android') {setShowBirthDatePicker(false);}
                        if (event.type !== 'dismissed' && selectedDate) {
                          setBirthDate(selectedDate);
                          setValidationMessage('');
                          if (Platform.OS === 'android') {saveConfirmedBirthDate(selectedDate);}
                        }
                      }}
                    />
                    {Platform.OS === 'ios' ? (
                      <TouchableOpacity style={styles.datePickerDone} onPress={() => {
                        const confirmedDate = birthDate || getDefaultBirthDate();
                        setBirthDate(confirmedDate);
                        setShowBirthDatePicker(false);
                        saveConfirmedBirthDate(confirmedDate);
                      }}>
                        <ThemedText weight="semiBold" style={styles.datePickerDoneText}>Done</ThemedText>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
              {validationMessage ? (
                <View style={styles.validationRow}>
                  <Ionicons name="information-circle-outline" size={17} color={Colors.error} />
                  <ThemedText style={styles.validationText}>{validationMessage}</ThemedText>
                </View>
              ) : null}
              <View style={styles.privacyNote}>
                <Ionicons name="lock-closed-outline" size={16} color={Colors.sageMuted} />
                <ThemedText style={styles.privacyText}>Your setup is saved with your journal and can be changed later in More.</ThemedText>
              </View>
            </View>
          </View>
        );
      case 10:
        return (
          <View>
            <ThemedText style={styles.eyebrow}>YOUR WEEK</ThemedText>
            <ThemedText weight="bold" style={styles.title}>When does your week begin?</ThemedText>
            <ThemedText style={styles.bodyText}>This sets the start of weekly reviews, priorities, and journal history.</ThemedText>
            <View style={styles.weekOptions}>
              {PRIMARY_WEEK_DAYS.map(day => {
                const selected = weekStart === day.key;
                return (
                  <TouchableOpacity key={day.key} style={[styles.weekOption, selected && styles.weekOptionSelected]} onPress={() => {triggerLightHaptic(); setWeekStart(day.key);}} accessibilityRole="radio" accessibilityState={{selected}}>
                    <View style={styles.weekOptionCopy}>
                      <ThemedText weight="semiBold" style={[styles.weekOptionLabel, selected && styles.weekOptionLabelSelected]}>{day.label}</ThemedText>
                      {day.badge ? <ThemedText weight="semiBold" style={styles.commonBadge}>{day.badge}</ThemedText> : null}
                    </View>
                    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={selected ? Colors.sage : Colors.lightGray} />
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.otherDaysToggle} onPress={() => {triggerLightHaptic(); setShowOtherWeekDays(value => !value);}} accessibilityRole="button" accessibilityState={{expanded: showOtherWeekDays}}>
                <ThemedText weight="semiBold" style={styles.otherDaysText}>{showOtherWeekDays ? 'Hide other days' : 'Choose another day'}</ThemedText>
                <Ionicons name={showOtherWeekDays ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.sage} />
              </TouchableOpacity>
              {showOtherWeekDays ? (
                <View style={styles.otherDaysGrid}>
                  {OTHER_WEEK_DAYS.map(day => {
                    const selected = weekStart === day.key;
                    return (
                      <TouchableOpacity key={day.key} style={[styles.otherDayChip, selected && styles.otherDayChipSelected]} onPress={() => {triggerLightHaptic(); setWeekStart(day.key);}} accessibilityRole="radio" accessibilityState={{selected}}>
                        <ThemedText weight="semiBold" style={[styles.otherDayText, selected && styles.otherDayTextSelected]}>{day.label}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>
        );
      case 11:
        return (
          <View>
            <ThemedText style={styles.eyebrow}>BIBLE SETTINGS</ThemedText>
            <ThemedText weight="bold" style={styles.title}>Choose the translation you read most naturally.</ThemedText>
            <ThemedText style={styles.bodyText}>Translations make different choices between closely mirroring Hebrew and Greek wording and expressing the meaning in natural contemporary English.</ThemedText>
            <View style={styles.translationGuide}>
              <View style={styles.translationGuideRow}><ThemedText weight="bold" style={styles.translationGuideKey}>KJV · NKJV</ThemedText><ThemedText style={styles.translationGuideText}>Traditional style, with NKJV using more modern English</ThemedText></View>
              <View style={styles.translationGuideRow}><ThemedText weight="bold" style={styles.translationGuideKey}>ESV · NASB</ThemedText><ThemedText style={styles.translationGuideText}>Closer to original wording and structure</ThemedText></View>
              <View style={styles.translationGuideRow}><ThemedText weight="bold" style={styles.translationGuideKey}>NIV</ThemedText><ThemedText style={styles.translationGuideText}>Balance of form and natural meaning</ThemedText></View>
              <View style={styles.translationGuideRow}><ThemedText weight="bold" style={styles.translationGuideKey}>NLT</ThemedText><ThemedText style={styles.translationGuideText}>Clear, flowing contemporary English</ThemedText></View>
              <View style={styles.translationGuideRow}><ThemedText weight="bold" style={styles.translationGuideKey}>AMP</ThemedText><ThemedText style={styles.translationGuideText}>Expanded wording that surfaces nuance</ThemedText></View>
            </View>
            <View style={styles.caveatCard}><Ionicons name="information-circle-outline" size={18} color={Colors.sage} /><ThemedText style={styles.caveatText}>No version is ranked as more spiritual. This simply chooses the default shown in your journal.</ThemedText></View>
          </View>
        );
      case 12:
        return (
          <View>
            <ThemedText style={styles.eyebrow}>BIBLE VERSION</ThemedText>
            <ThemedText weight="bold" style={styles.title}>Which version would you like to use?</ThemedText>
            <ThemedText style={styles.sectionHint}>You can change this anytime in More.</ThemedText>
            <View style={styles.versionGrid}>
              {BIBLE_VERSIONS.map(version => {
                const selected = bibleVersion === version.key;
                return (
                  <TouchableOpacity key={version.key} style={[styles.versionChip, selected && styles.versionChipSelected]} onPress={() => {
                    triggerLightHaptic();
                    setBibleVersion(version.key);
                    prefetchDashboardScriptures(version.key).catch(() => {});
                  }} accessibilityRole="radio" accessibilityState={{selected}} accessibilityLabel={`${version.key}, ${version.name}`}>
                    <ThemedText weight="semiBold" style={[styles.versionKey, selected && styles.versionKeySelected]}>{version.key}</ThemedText>
                    {selected ? <Ionicons name="checkmark-circle" size={17} color={Colors.hopeWhite} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.selectedTranslationCard}>
              <ThemedText style={styles.planEyebrow}>SELECTED TRANSLATION</ThemedText>
              <ThemedText weight="semiBold" style={styles.planTitle}>{BIBLE_VERSIONS.find(version => version.key === bibleVersion)?.name || bibleVersion}</ThemedText>
            </View>
          </View>
        );
      case 13:
        return (
          <View>
            <ThemedText style={styles.eyebrow}>YOUR NOTE BLOCKS</ThemedText>
            <ThemedText weight="bold" style={styles.title}>What will you use most when you journal?</ThemedText>
            <ThemedText style={styles.bodyText}>Each preview shows how a saved block will actually appear in your journal. Choose as many as you like and we’ll keep them quick to reach.</ThemedText>
            <View style={styles.noteBlockSelectionSummary}>
              <Ionicons name="star" size={18} color={Colors.faithGold} />
              <ThemedText weight="semiBold" style={styles.noteBlockSelectionSummaryText}>
                {favoriteNoteBlocks.length} {favoriteNoteBlocks.length === 1 ? 'favorite' : 'favorites'} selected
              </ThemedText>
            </View>
            {NOTE_BLOCK_CATEGORIES.map(category => {
              const enabledKinds = new Set(noteBlockPreferenceSnapshot.enabledKinds);
              const definitions = ONBOARDING_NOTE_BLOCKS.filter(
                definition => definition.category === category.id
                  && enabledKinds.has(definition.kind as SelectableJournalBlockKind),
              );
              if (!definitions.length) {return null;}
              return (
                <View key={category.id} style={styles.noteBlockCategory}>
                  <ThemedText weight="semiBold" style={styles.noteBlockCategoryLabel}>{category.label.toUpperCase()}</ThemedText>
                  <View style={styles.noteBlockGrid}>
                    {[0, 1].map(columnIndex => (
                      <View key={columnIndex} style={styles.noteBlockMasonryColumn}>
                        {definitions
                          .filter((_, index) => index % 2 === columnIndex)
                          .map(definition => {
                            const kind = definition.kind as SelectableJournalBlockKind;
                            const selected = favoriteNoteBlocks.includes(kind);
                            return (
                              <TouchableOpacity
                                key={kind}
                                style={[styles.noteBlockPreviewTile, selected && styles.noteBlockPreviewTileSelected]}
                                activeOpacity={0.8}
                                onPress={() => {
                                  triggerLightHaptic();
                                  noteBlockSelectionChanged.current = true;
                                  setValidationMessage('');
                                  setFavoriteNoteBlocks(current => current.includes(kind)
                                    ? current.filter(item => item !== kind)
                                    : [...current, kind]);
                                }}
                                accessibilityRole="checkbox"
                                accessibilityState={{checked: selected}}
                                accessibilityLabel={`${definition.pickerLabel}. ${definition.description}`}
                              >
                                <View style={styles.noteBlockTileHeading}>
                                  <ThemedText numberOfLines={1} weight="semiBold" style={[styles.noteBlockTileTitle, selected && styles.noteBlockTileTitleSelected]}>{definition.pickerLabel}</ThemedText>
                                  <Ionicons
                                    name={selected ? 'star' : 'star-outline'}
                                    size={17}
                                    color={selected ? Colors.faithGold : Colors.textGray}
                                  />
                                </View>
                                <OnboardingNoteBlockPreview definition={definition} />
                              </TouchableOpacity>
                            );
                          })}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
            {validationMessage ? <ThemedText style={styles.choiceValidation}>{validationMessage}</ThemedText> : null}
            <View style={styles.noteBlockChangeNote}>
              <Ionicons name="options-outline" size={18} color={Colors.sage} />
              <ThemedText style={styles.noteBlockChangeNoteText}>You can add, remove, or change favorites anytime in More → Note Blocks.</ThemedText>
            </View>
          </View>
        );
      default:
        return (
          <View style={styles.readyContent}>
            <View style={styles.readyIcon}><SunMoon size={33} color={Colors.hopeWhite} strokeWidth={1.9} /></View>
            <ThemedText style={styles.eyebrow}>YOUR RHYTHM IS READY</ThemedText>
            <ThemedText weight="bold" style={styles.title}>{firstName.trim()}, begin with what is here.</ThemedText>
            <ThemedText style={styles.bodyText}>Open Today for one clear next step. Write in the moment, return in the evening, and let your weeks tell the story of what God is doing.</ThemedText>
            <View style={styles.personalPlanCard}>
              <ThemedText style={styles.planEyebrow}>YOUR PERSONAL FOCUS</ThemedText>
              <ThemedText weight="semiBold" style={styles.planTitle}>{selectedGoal?.label || 'Grow closer to God'}</ThemedText>
              <ThemedText style={styles.planDetail}>Supported by {selectedBarrier?.response || 'a gentle daily rhythm'}.</ThemedText>
            </View>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}><Ionicons name="calendar-outline" size={19} color={Colors.sage} /><ThemedText style={styles.summaryLabel}>Week begins</ThemedText><ThemedText weight="semiBold" style={styles.summaryValue}>{weekStart.charAt(0).toUpperCase() + weekStart.slice(1)}</ThemedText></View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}><Ionicons name="book-outline" size={19} color={Colors.sage} /><ThemedText style={styles.summaryLabel}>Bible version</ThemedText><ThemedText weight="semiBold" style={styles.summaryValue}>{bibleVersion}</ThemedText></View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}><Ionicons name="star-outline" size={19} color={Colors.sage} /><ThemedText style={styles.summaryLabel}>Favorite note blocks</ThemedText><ThemedText weight="semiBold" style={styles.summaryValue}>{favoriteNoteBlocks.length}</ThemedText></View>
            </View>
          </View>
        );
    }
  };

  const ctaLabel = stepIndex === 0
    ? 'Begin'
    : stepIndex === 11
      ? 'Choose my version'
      : stepIndex === 12
        ? 'Use this version'
        : stepIndex === 13
          ? 'Add to favorites'
        : isLastStep
          ? 'Begin Today'
          : 'Continue';

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar translucent barStyle="dark-content" backgroundColor="transparent" />
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined} {...swipeResponder.panHandlers}>
        {stepIndex > 0 ? (
          <View pointerEvents="none" style={[styles.header, {top: insets.top}]}>
            <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{min: 1, max: TOTAL_STEPS - 1, now: stepIndex}}>
              <View style={[styles.progressFill, {width: `${(stepIndex / (TOTAL_STEPS - 1)) * 100}%`}]} />
            </View>
          </View>
        ) : null}
        <ScrollView
          key={stepIndex}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + (stepIndex > 0 ? 32 : 0),
              paddingBottom: footerHeight + 24,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
        >
          <View style={styles.stepContent}>{renderStep()}</View>
        </ScrollView>
        <View
          onLayout={({nativeEvent}) => setFooterHeight(nativeEvent.layout.height)}
          style={[styles.footer, {paddingBottom: Math.max(insets.bottom, 14)}]}
        >
          <TouchableOpacity style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]} activeOpacity={0.86} accessibilityRole="button" accessibilityLabel={ctaLabel} disabled={isSaving} onPress={handlePrimaryCta}>
            {isSaving ? <ActivityIndicator color={Colors.hopeWhite} /> : (
              <>
                <ThemedText weight="semiBold" style={styles.primaryButtonText}>{ctaLabel}</ThemedText>
              </>
            )}
          </TouchableOpacity>
          <ThemedText style={styles.changeLaterText}>You can change these choices anytime in the More tab.</ThemedText>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: Colors.lightBackground},
  keyboardView: {flex: 1},
  header: {position: 'absolute', left: 0, right: 0, zIndex: 10, paddingTop: 14, paddingBottom: 12, alignItems: 'center'},
  progressTrack: {height: 6, width: 120, borderRadius: 3, backgroundColor: Colors.lightGray, overflow: 'hidden'},
  progressFill: {height: '100%', borderRadius: 2, backgroundColor: Colors.sage},
  scrollView: {flex: 1},
  scrollContent: {flexGrow: 1},
  stepContent: {flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 24},
  heroContent: {alignItems: 'flex-start'},
  heroLogo: {width: 68, height: 68, borderRadius: 21, marginBottom: 28},
  eyebrow: {color: Colors.sageMuted, fontFamily: Fonts.semiBold, fontSize: 11, lineHeight: 15, letterSpacing: 1.8, marginBottom: 12},
  heroTitle: {color: Colors.text, fontFamily: Fonts.bold, fontSize: 31, lineHeight: 39, letterSpacing: -0.6, marginBottom: 18},
  title: {color: Colors.text, fontFamily: Fonts.bold, fontSize: 28, lineHeight: 35, letterSpacing: -0.5, marginBottom: 12},
  bodyText: {color: Colors.secondaryText, fontFamily: Fonts.regular, fontSize: 15, lineHeight: 23},
  heroVerseBlock: {alignSelf: 'stretch', marginTop: 22, paddingLeft: 16, position: 'relative'},
  heroVerseAccent: {position: 'absolute', left: 0, top: 2, bottom: 2, width: 3, borderRadius: 999, backgroundColor: Colors.sage},
  heroVerseText: {color: Colors.text, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontStyle: 'italic', fontSize: 15, lineHeight: 23},
  heroVerseReference: {color: Colors.textGray, fontSize: 12, lineHeight: 17, letterSpacing: 0.7, marginTop: 7},
  insightContent: {alignItems: 'stretch'},
  statsPanel: {
    marginTop: 17,
    borderRadius: 22,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  statRow: {
    paddingVertical: 18,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  statDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.cardBorder,
    marginHorizontal: 17,
  },
  statNumber: {
    width: 96,
    flexShrink: 0,
    color: Colors.sage,
    fontFamily: Fonts.bold,
    fontSize: 43,
    lineHeight: 49,
    letterSpacing: -1.5,
  },
  statHeadline: {flex: 1, color: Colors.text, fontSize: 13, lineHeight: 19},
  secondaryStatNumber: {
    width: 96,
    flexShrink: 0,
    color: Colors.sage,
    fontFamily: Fonts.bold,
    fontSize: 43,
    lineHeight: 49,
    letterSpacing: -1.5,
  },
  secondaryStatCopy: {flex: 1, color: Colors.secondaryText, fontSize: 11, lineHeight: 17},
  insightConclusion: {marginTop: 20, paddingHorizontal: 20, paddingVertical: 21, borderRadius: 21, backgroundColor: Colors.sage},
  insightConclusionLead: {color: Colors.hopeWhite, fontSize: 14, lineHeight: 20, opacity: 0.8, marginBottom: 8},
  insightConclusionMain: {color: Colors.hopeWhite, fontSize: 22, lineHeight: 29, letterSpacing: -0.35},
  verifyToggle: {marginTop: 14, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  verifyToggleText: {color: Colors.sage, fontSize: 11},
  sourceList: {marginTop: 11, gap: 10},
  sourceItem: {flexDirection: 'row', alignItems: 'flex-start', gap: 7},
  sourceNumber: {color: Colors.textGray, fontSize: 9, lineHeight: 14},
  sourceDescription: {flex: 1, color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 9, lineHeight: 14},
  sourceLink: {color: Colors.sage, fontFamily: Fonts.semiBold, textDecorationLine: 'underline'},
  choices: {marginTop: 23, gap: 10},
  choiceCard: {minHeight: 62, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: Colors.cardBackground, borderWidth: 1, borderColor: Colors.cardBorder, flexDirection: 'row', alignItems: 'center', gap: 11},
  choiceCardSelected: {borderColor: Colors.sage, backgroundColor: Colors.anchorBlueLight},
  choiceIcon: {width: 38, height: 38, borderRadius: 13, backgroundColor: Colors.anchorBlueLight, alignItems: 'center', justifyContent: 'center'},
  choiceIconSelected: {backgroundColor: Colors.sage},
  choiceLabel: {flex: 1, color: Colors.text, fontSize: 13, lineHeight: 19},
  choiceLabelSelected: {color: Colors.sage},
  choiceValidation: {color: Colors.error, fontSize: 11, lineHeight: 16, marginTop: 10},
  researchHero: {marginTop: 27, alignItems: 'center'},
  researchHeroIcon: {width: 70, height: 70, borderRadius: 23, backgroundColor: Colors.anchorBlueLight, alignItems: 'center', justifyContent: 'center'},
  researchMetric: {color: Colors.sage, fontSize: 60, lineHeight: 67, letterSpacing: -2, marginTop: 14},
  researchMetricLabel: {color: Colors.sageMuted, fontSize: 11, lineHeight: 16, letterSpacing: 1.15},
  researchFindingCard: {marginTop: 25, paddingHorizontal: 20, paddingVertical: 19, borderRadius: 20, backgroundColor: Colors.anchorBlueLight},
  researchFinding: {color: Colors.text, fontSize: 16, lineHeight: 25},
  researchSource: {color: Colors.textGray, fontSize: 11, lineHeight: 17, marginTop: 16},
  scripturePath: {marginTop: 23, flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  scripturePathItem: {width: '47%', minHeight: 98, padding: 13, borderRadius: 17, backgroundColor: Colors.anchorBlueLight},
  scripturePathNumber: {color: Colors.faithGold, fontFamily: Fonts.semiBold, fontSize: 9, letterSpacing: 0.7},
  scripturePathTitle: {color: Colors.text, fontSize: 14, lineHeight: 20, marginTop: 7},
  scripturePathDetail: {color: Colors.textGray, fontSize: 10, lineHeight: 15, marginTop: 2},
  form: {marginTop: 26, gap: 23},
  fieldLabel: {color: Colors.sageMuted, fontSize: 12, lineHeight: 17, marginBottom: 2},
  input: {height: 50, color: Colors.text, fontFamily: Fonts.regular, fontSize: 17, paddingHorizontal: 0, paddingVertical: 0},
  dateInput: {height: 50, paddingHorizontal: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  dateInputText: {color: Colors.text, fontSize: 17},
  dateInputPlaceholder: {color: Colors.placeholderText},
  datePickerWrap: {marginTop: 5},
  datePickerDone: {alignSelf: 'flex-end', paddingHorizontal: 18, paddingVertical: 11},
  datePickerDoneText: {color: Colors.sage, fontSize: 13},
  validationRow: {flexDirection: 'row', alignItems: 'center', gap: 7},
  validationText: {flex: 1, color: Colors.error, fontSize: 12, lineHeight: 17},
  privacyNote: {flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 13, borderRadius: 13, backgroundColor: Colors.anchorBlueLight},
  privacyText: {flex: 1, color: Colors.sageMuted, fontSize: 11, lineHeight: 16},
  preferenceSection: {marginTop: 25},
  sectionTitle: {color: Colors.text, fontSize: 15, lineHeight: 20, marginBottom: 7},
  sectionHint: {color: Colors.textGray, fontSize: 12, lineHeight: 17, marginBottom: 13},
  segmentedControl: {flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: Colors.anchorBlueLight, gap: 4},
  segment: {flex: 1, height: 45, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  segmentSelected: {backgroundColor: Colors.cardBackground, shadowColor: Colors.black, shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.08, shadowRadius: 5, elevation: 2},
  segmentText: {color: Colors.textGray, fontSize: 14},
  segmentTextSelected: {color: Colors.sage},
  weekOptions: {marginTop: 24, gap: 10},
  weekOption: {minHeight: 56, paddingHorizontal: 15, borderRadius: 17, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.cardBackground, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  weekOptionSelected: {borderColor: Colors.sage, backgroundColor: Colors.anchorBlueLight},
  weekOptionCopy: {flexDirection: 'row', alignItems: 'center', gap: 9},
  weekOptionLabel: {color: Colors.text, fontSize: 14},
  weekOptionLabelSelected: {color: Colors.sage},
  commonBadge: {color: Colors.faithGold, fontSize: 8, letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, backgroundColor: '#EEE9DD'},
  otherDaysToggle: {minHeight: 48, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  otherDaysText: {color: Colors.sage, fontSize: 12},
  otherDaysGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  otherDayChip: {width: '48%', minHeight: 42, paddingHorizontal: 10, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.cardBackground},
  otherDayChipSelected: {backgroundColor: Colors.sage, borderColor: Colors.sage},
  otherDayText: {color: Colors.text, fontSize: 11},
  otherDayTextSelected: {color: Colors.hopeWhite},
  translationGuide: {marginTop: 22, gap: 10},
  translationGuideRow: {padding: 14, borderRadius: 17, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.cardBackground},
  translationGuideKey: {color: Colors.sage, fontSize: 12, lineHeight: 17},
  translationGuideText: {color: Colors.textGray, fontSize: 11, lineHeight: 16, marginTop: 3},
  caveatCard: {marginTop: 13, padding: 13, borderRadius: 15, backgroundColor: Colors.anchorBlueLight, flexDirection: 'row', alignItems: 'flex-start', gap: 9},
  caveatText: {flex: 1, color: Colors.sageMuted, fontSize: 10, lineHeight: 15},
  versionGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 9},
  versionChip: {minWidth: '22%', height: 43, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: Colors.inputBorder, backgroundColor: Colors.cardBackground, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5},
  versionChipSelected: {backgroundColor: Colors.sage, borderColor: Colors.sage},
  versionKey: {color: Colors.text, fontSize: 13},
  versionKeySelected: {color: Colors.hopeWhite},
  selectedTranslationCard: {marginTop: 18, padding: 16, borderRadius: 17, backgroundColor: Colors.anchorBlueLight},
  noteBlockSelectionSummary: {marginTop: 18, paddingHorizontal: 14, minHeight: 46, borderRadius: 15, backgroundColor: Colors.anchorBlueLight, flexDirection: 'row', alignItems: 'center', gap: 9},
  noteBlockSelectionSummaryText: {color: Colors.sage, fontSize: 12, lineHeight: 17},
  noteBlockCategory: {marginTop: 22},
  noteBlockCategoryLabel: {color: Colors.sageMuted, fontSize: 10, lineHeight: 15, letterSpacing: 1.2, marginBottom: 8},
  noteBlockGrid: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  noteBlockMasonryColumn: {flex: 1, gap: 10},
  noteBlockPreviewTile: {width: '100%', padding: 9, borderRadius: 16, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.cardBackground},
  noteBlockPreviewTileSelected: {borderWidth: 2, borderColor: Colors.sage, backgroundColor: Colors.anchorBlueLight, padding: 8},
  noteBlockTileHeading: {height: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5},
  noteBlockTileTitle: {flex: 1, color: Colors.text, fontSize: 11, lineHeight: 15},
  noteBlockTileTitleSelected: {color: Colors.sage},
  noteBlockPreviewViewport: {borderRadius: 11, backgroundColor: Colors.lightBackground, overflow: 'hidden', padding: 6},
  noteBlockPreviewScale: {width: '166.6667%', transform: [{scale: 0.6}], transformOrigin: 'top left'},
  noteBlockChangeNote: {marginTop: 20, padding: 14, borderRadius: 15, backgroundColor: Colors.anchorBlueLight, flexDirection: 'row', alignItems: 'flex-start', gap: 9},
  noteBlockChangeNoteText: {flex: 1, color: Colors.sageMuted, fontSize: 11, lineHeight: 16},
  points: {marginTop: 26, gap: 14},
  pointRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 15, borderRadius: 18, backgroundColor: Colors.cardBackground, borderWidth: 1, borderColor: Colors.cardBorder},
  pointIcon: {width: 42, height: 42, borderRadius: 14, backgroundColor: Colors.anchorBlueLight, alignItems: 'center', justifyContent: 'center'},
  pointCopy: {flex: 1},
  pointHeadingRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3},
  pointNumber: {color: Colors.faithGold, fontFamily: Fonts.semiBold, fontSize: 10, letterSpacing: 0.5},
  pointHeading: {color: Colors.text, fontSize: 15, lineHeight: 20},
  pointDetail: {color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 12, lineHeight: 18},
  readyContent: {alignItems: 'flex-start'},
  readyIcon: {width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.sage, marginBottom: 27},
  personalPlanCard: {alignSelf: 'stretch', marginTop: 22, padding: 17, borderRadius: 18, backgroundColor: Colors.anchorBlueLight},
  planEyebrow: {color: Colors.sageMuted, fontFamily: Fonts.semiBold, fontSize: 9, lineHeight: 13, letterSpacing: 1.3, marginBottom: 6},
  planTitle: {color: Colors.text, fontSize: 15, lineHeight: 21},
  planDetail: {color: Colors.textGray, fontSize: 11, lineHeight: 16, marginTop: 3},
  summaryCard: {alignSelf: 'stretch', marginTop: 12, paddingHorizontal: 16, borderRadius: 18, backgroundColor: Colors.cardBackground, borderWidth: 1, borderColor: Colors.cardBorder},
  summaryRow: {minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10},
  summaryLabel: {flex: 1, color: Colors.textGray, fontSize: 13},
  summaryValue: {color: Colors.text, fontSize: 13},
  summaryDivider: {height: StyleSheet.hairlineWidth, backgroundColor: Colors.cardBorder, marginLeft: 29},
  footer: {position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, paddingTop: 10, paddingHorizontal: 26},
  primaryButton: {backgroundColor: Colors.sage, borderRadius: 28, height: 56, alignItems: 'center', justifyContent: 'center'},
  primaryButtonDisabled: {opacity: 0.65},
  primaryButtonText: {color: Colors.hopeWhite, fontSize: 16},
  changeLaterText: {color: Colors.textGray, fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 9},
});

export default JournalOnboardingScreen;

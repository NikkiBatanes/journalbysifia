import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  Easing,
  Keyboard,
  Linking,
  PanResponder,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import RNShare from 'react-native-share';
import { generatePDF } from 'react-native-html-to-pdf';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {BlurView} from '@react-native-community/blur';
import {Pencil, Sparkles} from 'lucide-react-native';

import {BibleCopyrightModal} from '../components/BibleCopyrightModal';
import ScriptureReaderModal from '../components/ScriptureReaderModal';
import ShareComposer from '../components/TruthToCarryShareComposer';
import ShareDropdownModal from '../components/ShareDropdownModal';
import ThemedText from '../components/common/ThemedText';
import {useScroll} from '../context/ScrollContext';
import {useAuth} from '../context/IndustryStandardAuthContext';
import {
  createLocalReflection,
  getLocalReflection,
  getLocalReflections,
  updateLocalReflection,
} from '../storage/reflectionStorage';
import {
  getScripturePassage,
  type ScriptureReaderResult,
} from '../services/scriptureReaderService';
import {useNetworkStore} from '../services/network/networkManager';
import {Colors} from '../theme/colors';
import {Fonts} from '../theme/fonts';
import {toLocalDateString} from '../utils/date';
import {formatBibleVerse} from '../utils/textFormatting';
import {triggerLightHaptic, triggerMediumHaptic} from '../utils/haptics';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

type BlockKind =
  | 'text'
  | 'section'
  | 'scripture'
  | 'key'
  | 'quote'
  | 'song'
  | 'outline'
  | 'character'
  | 'language'
  | 'link'
  | 'table'
  | 'history'
  | 'remember'
  | 'response'
  | 'question'
  | 'reflection_question'
  | 'revisit'
  | 'prayer'
  | 'book';
type OutlineStyle = 'numbered' | 'acronym' | 'simple';
type HistoryType = 'era' | 'place' | 'culture' | 'custom' | 'politics';
type LanguageKind = 'hebrew' | 'greek' | 'aramaic' | 'latin';
type LanguageDetail = 'meaning' | 'transliteration' | 'origin' | 'scripture';
type NoteBlock = {
  id: string;
  kind: BlockKind;
  text: string;
  secondary?: string;
  note?: string;
  reference?: string;
  scriptureText?: string;
  scriptureReference?: string;
  scriptureVersion?: string;
  outlineStyle?: OutlineStyle;
  points?: string[];
  historyTypes?: HistoryType[];
  eraPeriod?: 'BC' | 'AD';
  languageKind?: LanguageKind;
  languageDetails?: LanguageDetail[];
  meaning?: string;
  origin?: string;
  tableRows?: string[][];
  tableEditing?: boolean;
};

const REFERENCE_PATTERN =
  /^[1-3]?\s*[a-zA-Z]+\.?\s+\d{1,3}(:\d{1,3}([–—-]\d{1,3})?(,\s*\d{1,3}([–—-]\d{1,3})?)*)?$/;

export const BLOCKS: Record<
  Exclude<BlockKind, 'text' | 'section'>,
  {
    label: string;
    action: string;
    placeholder: string;
    icon: string;
    iconFamily?: 'Ionicons' | 'MaterialCommunityIcons';
  }
> = {
  scripture: {
    label: 'SCRIPTURE',
    action: '+ Scripture',
    placeholder: 'Romans 12:1–2',
    icon: 'book-outline',
  },
  key: {
    label: 'KEY POINT',
    action: '★ Key Point',
    placeholder: 'What is the main idea?',
    icon: 'star-outline',
  },
  quote: {
    label: 'QUOTE',
    action: '“ ” Quote',
    placeholder: 'Write the speaker’s words…',
    icon: 'chatbox-outline',
  },
  song: {
    label: 'WORSHIP SONG',
    action: '♪ Worship Song',
    placeholder: 'Song title',
    icon: 'musical-note-outline',
  },
  outline: {
    label: 'MESSAGE OUTLINE',
    action: '☷ Outline',
    placeholder: 'Outline Title',
    icon: 'list-outline',
  },
  character: {
    label: 'BIBLE CHARACTER',
    action: '♙ Bible Character',
    placeholder: 'Name',
    icon: 'person-circle-outline',
  },
  language: {
    label: 'LANGUAGE NOTE',
    action: 'א Language Note',
    placeholder: 'Original Word',
    icon: 'translate',
    iconFamily: 'MaterialCommunityIcons',
  },
  link: {
    label: 'LINK',
    action: 'Link',
    placeholder: 'Paste or type a link',
    icon: 'link-outline',
  },
  table: {
    label: 'TABLE',
    action: '▦ Table',
    placeholder: '',
    icon: 'grid-outline',
  },
  history: {
    label: 'HISTORICAL CONTEXT',
    action: 'Historical Context',
    placeholder: 'Why does this background matter?',
    icon: 'map-outline',
  },
  remember: {
    label: 'REMEMBER',
    action: '♡ Remember',
    placeholder: 'What do you not want to forget?',
    icon: 'heart-outline',
  },
  response: {
    label: 'RESPONSE',
    action: '→ Response',
    placeholder: 'What do you want to put into practice?',
    icon: 'arrow-forward-outline',
  },
  question: {
    label: 'QUESTION',
    action: '? Question',
    placeholder: 'What question came up as you listened?',
    icon: 'help-circle-outline',
  },
  reflection_question: {
    label: 'REFLECTION QUESTION',
    action: '◆ Reflection Question',
    placeholder: 'What is the reflection question?',
    icon: 'chatbubbles-outline',
  },
  revisit: {
    label: 'REVISIT',
    action: '↻ Revisit',
    placeholder: 'What do you want to come back to later?',
    icon: 'refresh-outline',
  },
  prayer: {
    label: 'PRAYER',
    action: 'Prayer',
    placeholder: 'Turn this moment into prayer…',
    icon: 'leaf-outline',
  },
  book: {
    label: 'BOOK TO READ',
    action: '📕 Book to read',
    placeholder: 'Book title',
    icon: 'book-outline',
  },
};

export const BlockIcon: React.FC<{
  config: (typeof BLOCKS)['language'];
  size?: number;
  color?: string;
}> = ({config, size = 14, color = Colors.sage}) => {
  if (config.iconFamily === 'MaterialCommunityIcons') {
    return (
      <MaterialCommunityIcons
        name={config.icon as any}
        size={size}
        color={color}
      />
    );
  }
  return <Ionicons name={config.icon as any} size={size} color={color} />;
};

const CAPTURE_KINDS = [
  'character',
  'history',
  'key',
  'language',
  'link',
  'outline',
  'prayer',
  'question',
  'quote',
  'reflection_question',
  'remember',
  'response',
  'revisit',
  'scripture',
  'song',
  'book',
  'table',
] as const;

const newBlock = (kind: BlockKind): NoteBlock => ({
  id: `${Date.now()}-${Math.random()}`,
  kind,
  text: '',
  ...(kind === 'outline'
    ? {outlineStyle: 'numbered' as const, points: ['', '', '']}
    : {}),
  ...(kind === 'history'
    ? {historyTypes: ['place'] as HistoryType[], eraPeriod: 'AD' as const}
    : {}),
  ...(kind === 'language'
    ? {
        languageKind: 'hebrew' as const,
        languageDetails: ['meaning'] as LanguageDetail[],
      }
    : {}),
  ...(kind === 'table'
    ? {tableRows: [['', ''], ['', '']], tableEditing: true}
    : {}),
  ...(kind === 'reflection_question' ? {note: ''} : {}),
});

const normalizeLink = (value: string): string | null => {
  const candidate = value.trim();
  if (!candidate) {
    return null;
  }
  const url = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;
  return /^https?:\/\/[^\s]+\.[^\s]+$/i.test(url) ? url : null;
};

type ScriptureLookupInputProps = {
  value: string;
  placeholder: string;
  version: string;
  style: any;
  multiline?: boolean;
  registerInput?: (input: TextInput | null) => void;
  onChange: (value: string) => void;
  onResolved: (result: ScriptureReaderResult | null) => void;
  onFocus?: () => void;
};

const ScriptureLookupInput = ({
  value,
  placeholder,
  version,
  style,
  multiline = false,
  registerInput,
  onChange,
  onResolved,
  onFocus,
}: ScriptureLookupInputProps) => {
  const [resolvedVerse, setResolvedVerse] = useState<ScriptureReaderResult | null>(
    null,
  );
  const [resolving, setResolving] = useState(false);
  const [showCopyright, setShowCopyright] = useState(false);
  const lookupVersionRef = useRef(0);
  const onResolvedRef = useRef(onResolved);

  useEffect(() => {
    onResolvedRef.current = onResolved;
  }, [onResolved]);

  useEffect(() => {
    const candidate = value.trim();
    const lookupId = ++lookupVersionRef.current;

    if (!REFERENCE_PATTERN.test(candidate)) {
      setResolvedVerse(null);
      setResolving(false);
      onResolvedRef.current(null);
      return;
    }

    setResolving(true);
    const timer = setTimeout(() => {
      getScripturePassage(candidate, version)
        .then(result => {
          if (lookupVersionRef.current === lookupId) {
            setResolvedVerse(result);
            onResolvedRef.current(result);
          }
        })
        .catch(() => {
          if (lookupVersionRef.current === lookupId) {
            setResolvedVerse(null);
            onResolvedRef.current(null);
          }
        })
        .finally(() => {
          if (lookupVersionRef.current === lookupId) {
            setResolving(false);
          }
        });
    }, 600);

    return () => clearTimeout(timer);
  }, [value, version]);

  return (
    <>
      <View style={styles.scriptureLookupRow}>
        <TextInput
          ref={registerInput}
          style={[style, styles.scriptureLookupInput]}
          multiline={multiline}
          placeholder={placeholder}
          placeholderTextColor={Colors.textGray}
          value={value}
          onChangeText={onChange}
          onFocus={onFocus}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {resolving && <ActivityIndicator size="small" color={Colors.sage} />}
      </View>
      {resolvedVerse && (
        <View style={styles.scripturePreview}>
          <ThemedText style={styles.scripturePreviewText}>
            {resolvedVerse.text}
          </ThemedText>
          <View style={styles.scripturePreviewReferenceRow}>
            <ThemedText weight="bold" style={styles.scripturePreviewReference}>
              {resolvedVerse.reference} · {resolvedVerse.version}
            </ThemedText>
            <TouchableOpacity
              onPress={() => {
                triggerLightHaptic();
                setShowCopyright(true);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Bible translation information">
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={Colors.sage}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
      <BibleCopyrightModal
        visible={showCopyright}
        onClose={() => setShowCopyright(false)}
        bibleVersion={resolvedVerse?.version || version}
      />
    </>
  );
};

const SermonNotesScreen = ({navigation, route}: any) => {
  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  const {user} = useAuth();
  const bibleVersion = useMemo(
    () =>
      (user as any)?.user_metadata?.preferences?.content?.bibleVersion ||
      'NASB',
    [user],
  );
  const isOnline = useNetworkStore(state => state.isOnline);
  const {
    setShowTabBar,
    collapsedTabBarCenterY,
    setCollapsedTabBarCenterY,
  } = useScroll();
  const insets = useSafeAreaInsets();
  const screenRef = useRef<View>(null);
  const [screenBottomY, setScreenBottomY] = useState<number | null>(null);
  const restingComposerBottom =
    collapsedTabBarCenterY !== null && screenBottomY !== null
      ? Math.max(0, screenBottomY - collapsedTabBarCenterY - 28)
      : Math.max(insets.bottom, 8);
  const scrollRef = useRef<ScrollView>(null);
  const inputLayouts = useRef<{
    [key: string]: {y: number; height: number; absolute?: boolean};
  }>({});
  const editorLayout = useRef<{y: number} | null>(null);
  const detailsLayout = useRef<{y: number} | null>(null);
  const blockInputRefs = useRef(new Map<string, TextInput>());
  const pendingFocusBlockIdRef = useRef<string | null>(null);
  const focusScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const keepAtEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepScrollAtEndRef = useRef(false);
  const keyboardVisibleRef = useRef(false);
  const startButtonBottom = useRef(
    new Animated.Value(insets.bottom + 20),
  ).current;
  const composerBottom = useRef(
    new Animated.Value(restingComposerBottom),
  ).current;
  const pillAnimations = useRef(
    CAPTURE_KINDS.map(() => new Animated.Value(0)),
  ).current;
  const plusRotation = useRef(new Animated.Value(0)).current;
  const pickerColorAnim = useRef(new Animated.Value(0)).current;
  const actionBarAnim = useRef(new Animated.Value(0)).current;
  const savedShareButtonAnim = useRef(new Animated.Value(0)).current;
  const savedStageAnim = useRef(new Animated.Value(0)).current;
  const savedCheckCircleAnim = useRef(new Animated.Value(0)).current;
  const actionButtonAnims = useRef(
    [0, 1, 2, 3].map(() => new Animated.Value(0)),
  ).current;
  const initialStage = [1, 2, 3, 4, 5].includes(Number(route?.params?.initialStage))
    ? (Number(route?.params?.initialStage) as 1 | 2 | 3 | 4 | 5)
    : 1;
  const initialReflectionStep =
    typeof route?.params?.initialReflectionStep === 'number'
      ? route.params.initialReflectionStep
      : 0;
  const [stage, setStage] = useState<1 | 2 | 3 | 4 | 5>(initialStage);
  const [showDetails, setShowDetails] = useState(false);
  const [showAllStats, setShowAllStats] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [inputLayoutVersion, setInputLayoutVersion] = useState(0);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedReflectionId, setSavedReflectionId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [mainScripture, setMainScripture] = useState('');
  const [mainScriptureInput, setMainScriptureInput] = useState('');
  const [series, setSeries] = useState('');
  const [part, setPart] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [church, setChurch] = useState('');
  const [blocks, setBlocks] = useState<NoteBlock[]>([]);
  const [notice, setNotice] = useState('');
  const [carry, setCarry] = useState('');
  const [prayer, setPrayer] = useState('');
  const [prayerAnswer, setPrayerAnswer] = useState('');
  const [reflectionStep, setReflectionStep] = useState(initialReflectionStep);
  const [mainScriptureTexts, setMainScriptureTexts] = useState<string[]>([]);
  const [scriptureLoading, setScriptureLoading] = useState(false);
  const [scriptureReaderOpen, setScriptureReaderOpen] = useState(false);
  const [scriptureReaderIndex, setScriptureReaderIndex] = useState(0);
  const [shareComposerOpen, setShareComposerOpen] = useState(false);
  const [shareDropdownOpen, setShareDropdownOpen] = useState(false);
  const [shareComposerText, setShareComposerText] = useState('');
  const [bibleCopyrightOpen, setBibleCopyrightOpen] = useState(false);
  const sermonDate = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    [],
  );
  const mainScriptureRefs = useMemo(
    () =>
      mainScripture
        .split(/[;\n]+/)
        .map(s => s.trim())
        .filter(Boolean),
    [mainScripture],
  );
  const hasAdditionalDetails = useMemo(
    () => series.trim().length > 0 || church.trim().length > 0,
    [series, church],
  );
  const handleShareScripture = useCallback(
    (index: number) => {
      const ref = mainScriptureRefs[index];
      const text = mainScriptureTexts[index];
      const message = text
        ? `${text}\n\n— ${ref.toUpperCase()} ${bibleVersion}`
        : `${ref.toUpperCase()} ${bibleVersion}`;
      triggerLightHaptic();
      setShareComposerText(message);
      setShareComposerOpen(true);
    },
    [bibleVersion, mainScriptureRefs, mainScriptureTexts],
  );
  const routeParams = route?.params ?? {};
  const selectedDate = useMemo(
    () =>
      routeParams?.selectedDate
        ? toLocalDateString(new Date(routeParams.selectedDate))
        : toLocalDateString(new Date()),
    [routeParams?.selectedDate],
  );
  const reflectionId = routeParams?.reflectionId ?? null;

  const coverDate = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const now = new Date();
    const includeYear = date.getFullYear() !== now.getFullYear();
    const weekdays = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    let formatted = `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
    if (includeYear) {
      formatted += `, ${date.getFullYear()}`;
    }
    return formatted;
  }, [selectedDate]);

  // Load an existing sermon note when opened from Moments, or the most recent
  // in-progress sermon note for today when starting fresh.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let entry: any = null;
        if (reflectionId) {
          entry = await getLocalReflection(reflectionId, 'sermon', selectedDate);
        }
        if (!entry) {
          const entries = await getLocalReflections('sermon', selectedDate);
          if (entries.length) {
            const latest = entries[entries.length - 1];
            const latestMetadata = latest.metadata || {};
            if (latestMetadata.is_complete === false) {
              entry = latest;
            }
          }
        }
        if (!entry || !mounted) {
          return;
        }
        const content = typeof entry.content === 'string'
          ? JSON.parse(entry.content)
          : entry.content;
        const metadata = entry.metadata || {};

        setSavedReflectionId(entry.id);
        setTitle(entry.title || '');
        setMainScripture(metadata.main_scripture || '');
        setSeries(metadata.series || '');
        setPart(metadata.part || '');
        setSpeaker(metadata.speaker || '');
        setChurch(metadata.church || '');
        setNotice(metadata.notice || '');
        setCarry(metadata.carry || '');
        setPrayer(metadata.prayer || '');
        setPrayerAnswer(metadata.prayer_answer || '');
        setBlocks(content?.blocks || []);
        setShowDetails(false);
        setSaved(false);
      } catch (error) {
        console.warn('Error loading local sermon notes:', error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedDate, reflectionId]);

  useFocusEffect(
    useCallback(() => {
      setShowTabBar(true);
      setCollapsedTabBarCenterY(null);
    }, [setShowTabBar, setCollapsedTabBarCenterY]),
  );

  useEffect(() => {
    if (stage !== 2) {
      actionBarAnim.setValue(0);
      actionButtonAnims.forEach(animation => animation.setValue(0));
      return;
    }

    actionBarAnim.setValue(0);
    actionButtonAnims.forEach(animation => animation.setValue(0));
    Animated.spring(actionBarAnim, {
      toValue: 1,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
    actionButtonAnims.forEach((animation, index) => {
      Animated.spring(animation, {
        toValue: 1,
        tension: 80,
        friction: 8,
        delay: (actionButtonAnims.length - 1 - index) * 50,
        useNativeDriver: true,
      }).start();
    });
  }, [actionBarAnim, actionButtonAnims, stage]);

  useEffect(() => {
    if (stage !== 2 || mainScriptureRefs.length === 0) {
      setMainScriptureTexts([]);
      setScriptureLoading(false);
      return;
    }
    if (!isOnline) {
      setMainScriptureTexts([]);
      setScriptureLoading(false);
      return;
    }
    let active = true;
    setScriptureLoading(true);
    setMainScriptureTexts([]);
    Promise.all(
      mainScriptureRefs.map(reference =>
        getScripturePassage(reference, bibleVersion)
          .then(result => formatBibleVerse(result.text))
          .catch(() => ''),
      ),
    )
      .then(texts => {
        if (active) {
          setMainScriptureTexts(texts);
        }
      })
      .finally(() => {
        if (active) {
          setScriptureLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [bibleVersion, isOnline, mainScriptureRefs, stage]);

  useEffect(() => {
    if (stage === 5) {
      savedStageAnim.setValue(0);
      savedShareButtonAnim.setValue(0);
      savedCheckCircleAnim.setValue(0);
      Animated.spring(savedStageAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();
      Animated.spring(savedShareButtonAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        delay: 350,
        useNativeDriver: true,
      }).start();
      Animated.spring(savedCheckCircleAnim, {
        toValue: 1,
        tension: 120,
        friction: 7,
        delay: 120,
        useNativeDriver: true,
      }).start();
      triggerMediumHaptic();
    } else {
      savedStageAnim.setValue(0);
      savedShareButtonAnim.setValue(0);
      savedCheckCircleAnim.setValue(0);
    }
  }, [savedCheckCircleAnim, savedShareButtonAnim, savedStageAnim, stage]);

  useEffect(() => {
    if (!keyboardVisibleRef.current) {
      composerBottom.setValue(restingComposerBottom);
    }
  }, [composerBottom, restingComposerBottom]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, event => {
      const height = event.endCoordinates.height;
      keyboardVisibleRef.current = true;
      if (Platform.OS === 'ios') {
        Keyboard.scheduleLayoutAnimation(event);
      }
      setKeyboardHeight(height);
      startButtonBottom.stopAnimation();
      Animated.spring(startButtonBottom, {
        toValue: insets.bottom + height * 0.93,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
      composerBottom.stopAnimation();
      Animated.spring(composerBottom, {
        toValue: height + 12,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });
    const hideSubscription = Keyboard.addListener(hideEvent, event => {
      keyboardVisibleRef.current = false;
      if (Platform.OS === 'ios') {
        Keyboard.scheduleLayoutAnimation(event);
      }
      setKeyboardHeight(0);
      startButtonBottom.stopAnimation();
      Animated.spring(startButtonBottom, {
        toValue: insets.bottom + 20,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
      composerBottom.stopAnimation();
      Animated.spring(composerBottom, {
        toValue: restingComposerBottom,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [composerBottom, restingComposerBottom]);

  useEffect(() => {
    if (!focusedInput || !scrollRef.current || keyboardHeight === 0) {
      return;
    }
    const layout = inputLayouts.current[focusedInput];
    if (!layout) {
      return;
    }
    const visibleHeight = screenHeight - keyboardHeight;
    const baseY = layout.absolute ? 0 : editorLayout.current?.y || 0;
    const targetY =
      baseY + layout.y + layout.height - visibleHeight + 80;
    if (targetY > 0) {
      scrollRef.current.scrollTo({y: targetY, animated: true});
    }
  }, [focusedInput, keyboardHeight, screenHeight, inputLayoutVersion]);

  useEffect(() => {
    const blockId = pendingFocusBlockIdRef.current;
    if (!blockId) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      blockInputRefs.current.get(blockId)?.focus();
      scrollRef.current?.scrollToEnd({animated: true});
      if (focusScrollTimerRef.current) {
        clearTimeout(focusScrollTimerRef.current);
      }
      focusScrollTimerRef.current = setTimeout(() => {
        scrollRef.current?.scrollToEnd({animated: true});
        focusScrollTimerRef.current = null;
      }, 320);
      pendingFocusBlockIdRef.current = null;
    });

    return () => cancelAnimationFrame(frame);
  }, [blocks]);

  useEffect(
    () => () => {
      if (focusScrollTimerRef.current) {
        clearTimeout(focusScrollTimerRef.current);
      }
      if (keepAtEndTimerRef.current) {
        clearTimeout(keepAtEndTimerRef.current);
      }
    },
    [],
  );

  const goTo = (next: 1 | 2 | 3 | 4 | 5) => {
    triggerLightHaptic();
    Keyboard.dismiss();
    setStage(next);
    scrollRef.current?.scrollTo({y: 0, animated: true});
  };

  const handleShareJournal = useCallback(async () => {
    triggerLightHaptic();
    try {
      await Share.share({
        message:
          'I’m using Journal by siFia to capture sermon notes, reflections, and prayer. Join me!',
        title: 'Share Journal by siFia with friends',
      });
    } catch {
      // cancelled
    }
  }, []);

  const handleExportPDF = useCallback(async () => {
    triggerLightHaptic();
    try {
      const blockHtml = blocks
        .filter(hasBlockContent)
        .map(block => {
          const safeText = block.text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
          return `<p style="margin:0 0 12px 0; font-size:14px; line-height:20px; color:#29342E;">${safeText}</p>`;
        })
        .join('');

      const html = `
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#29342E; padding:24px;">
            <h1 style="font-size:24px; margin-bottom:8px; color:#526A5B;">${(title.trim() || 'Sermon Notes').replace(/</g, '&lt;')}</h1>
            <p style="font-size:12px; color:#7A7A7A; margin-bottom:24px;">${coverDate}${speaker.trim() ? ` · ${speaker.trim()}` : ''}</p>
            ${mainScripture ? `<p style="font-size:14px; font-style:italic; margin-bottom:24px; color:#526A5B;">${mainScripture.replace(/</g, '&lt;')}</p>` : ''}
            ${blockHtml}
            ${notice.trim() ? `<p style="margin-top:24px; font-size:14px;"><strong>God:</strong> ${notice.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>` : ''}
            ${carry.trim() ? `<p style="font-size:14px;"><strong>Truth:</strong> ${carry.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>` : ''}
            ${prayer.trim() ? `<p style="font-size:14px;"><strong>Response:</strong> ${prayer.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>` : ''}
            ${prayerAnswer.trim() ? `<p style="font-size:14px;"><strong>Prayer:</strong> ${prayerAnswer.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>` : ''}
          </body>
        </html>
      `;

      const file = await generatePDF({
        html,
        fileName: `sermon-notes-${Date.now()}`,
        width: 595,
        height: 842,
        padding: 20,
        bgColor: '#FFFEFA',
        ...(Platform.OS === 'ios' ? {directory: 'Documents'} : {}),
      });

      const filePath = (file as any).filePath;
      const fileUri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;

      await RNShare.open({
        url: fileUri,
        type: 'application/pdf',
        title: 'Export Sermon Notes',
        filename: `${title.trim() || 'Sermon Notes'}.pdf`,
        failOnCancel: false,
      });
    } catch (error) {
      console.warn('Sermon PDF export failed:', error);
      Alert.alert('Could not export PDF', 'Please try again.');
    }
  }, [blocks, title, coverDate, speaker, mainScripture, notice, carry, prayer, prayerAnswer]);

  const stageRef = useRef(stage);
  const goToRef = useRef(goTo);
  const reflectionStepRef = useRef(reflectionStep);
  useEffect(() => {
    stageRef.current = stage;
    goToRef.current = goTo;
    reflectionStepRef.current = reflectionStep;
  }, [stage, goTo, reflectionStep]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dy) < Math.abs(g.dx),
      onPanResponderRelease: (_e, g) => {
        const threshold = 40;
        if (stageRef.current === 5) {
          return;
        }
        if (stageRef.current === 4) {
          if (g.dx < -threshold) {
            if (reflectionStepRef.current < 3) {
              triggerLightHaptic();
              setReflectionStep(reflectionStepRef.current + 1);
              scrollRef.current?.scrollTo({y: 0, animated: true});
            }
          } else if (g.dx > threshold) {
            if (reflectionStepRef.current > 0) {
              triggerLightHaptic();
              setReflectionStep(reflectionStepRef.current - 1);
              scrollRef.current?.scrollTo({y: 0, animated: true});
            } else {
              goToRef.current(3);
            }
          }
        } else if (g.dx < -threshold && stageRef.current < 4) {
          goToRef.current((stageRef.current + 1) as 1 | 2 | 3 | 4);
        } else if (g.dx > threshold && stageRef.current > 1) {
          goToRef.current((stageRef.current - 1) as 1 | 2 | 3 | 4);
        }
      },
    }),
  ).current;

  const openCapturePicker = (dismissKeyboard = true) => {
    if (dismissKeyboard) {
      Keyboard.dismiss();
    }
    pillAnimations.forEach(animation => {
      animation.stopAnimation();
      animation.setValue(0);
    });
    setShowMore(true);
    setTimeout(() => {
      plusRotation.stopAnimation();
      pickerColorAnim.stopAnimation();
      Animated.parallel([
        Animated.timing(pickerColorAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.spring(plusRotation, {
          toValue: 1,
          tension: 90,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.stagger(
          38,
          [...pillAnimations].reverse().map(animation =>
            Animated.spring(animation, {
              toValue: 1,
              tension: 90,
              friction: 12,
              useNativeDriver: true,
            }),
          ),
        ),
      ]).start();
    }, 80);
  };

  const closeCapturePicker = (onComplete?: () => void) => {
    pillAnimations.forEach(animation => animation.stopAnimation());
    plusRotation.stopAnimation();
    pickerColorAnim.stopAnimation();
    Animated.parallel([
      Animated.timing(pickerColorAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.spring(plusRotation, {
        toValue: 0,
        tension: 90,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.stagger(
        28,
        pillAnimations.map(animation =>
          Animated.timing(animation, {
            toValue: 0,
            duration: 130,
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start(() => {
      setShowMore(false);
      onComplete?.();
    });
  };

  const addBlock = (kind: BlockKind) => {
    triggerLightHaptic();
    keepScrollAtEndRef.current = true;
    if (keepAtEndTimerRef.current) {
      clearTimeout(keepAtEndTimerRef.current);
    }
    keepAtEndTimerRef.current = setTimeout(() => {
      keepScrollAtEndRef.current = false;
      keepAtEndTimerRef.current = null;
    }, 2500);
    const selectedBlock = newBlock(kind);
    pendingFocusBlockIdRef.current = selectedBlock.id;
    setBlocks(current => [...current, selectedBlock]);
  };

  const selectCaptureKind = (kind: (typeof CAPTURE_KINDS)[number]) => {
    triggerMediumHaptic();
    closeCapturePicker(() => addBlock(kind));
  };

  const runAfterClosingPicker = (action: () => void) => {
    if (showMore) {
      closeCapturePicker(action);
    } else {
      action();
    }
  };

  const removeBlock = (id: string, withHaptic = true) => {
    if (withHaptic) {
      triggerMediumHaptic();
    }
    const remainingBlocks = blocks.filter(item => item.id !== id);
    const remainingEditableBlock = [...remainingBlocks]
      .reverse()
      .find(item => item.kind !== 'section');
    const shouldKeepKeyboard =
      remainingBlocks.length > 0 && keyboardVisibleRef.current;
    setBlocks(remainingBlocks);
    if (shouldKeepKeyboard && remainingEditableBlock) {
      requestAnimationFrame(() => {
        blockInputRefs.current.get(remainingEditableBlock.id)?.focus();
      });
    }
  };

  const updateBlock = (
    id: string,
    field: 'text' | 'secondary' | 'note' | 'reference' | 'meaning' | 'origin',
    value: string,
  ) => {
    setBlocks(current =>
      current.map(block =>
        block.id === id ? {...block, [field]: value} : block,
      ),
    );
  };

  const updateOutline = (
    id: string,
    changes: Partial<Pick<NoteBlock, 'outlineStyle' | 'points'>>,
  ) => {
    setBlocks(current =>
      current.map(block => (block.id === id ? {...block, ...changes} : block)),
    );
  };

  const updateHistory = (
    id: string,
    changes: Partial<Pick<NoteBlock, 'historyTypes' | 'eraPeriod'>>,
  ) => {
    setBlocks(current =>
      current.map(block => (block.id === id ? {...block, ...changes} : block)),
    );
  };

  const updateLanguage = (
    id: string,
    changes: Partial<Pick<NoteBlock, 'languageKind' | 'languageDetails'>>,
  ) => {
    setBlocks(current =>
      current.map(block => (block.id === id ? {...block, ...changes} : block)),
    );
  };

  const updateTableRows = (id: string, tableRows: string[][]) => {
    setBlocks(current =>
      current.map(block => (block.id === id ? {...block, tableRows} : block)),
    );
  };

  const setTableEditing = (id: string, tableEditing: boolean) => {
    setBlocks(current =>
      current.map(block =>
        block.id === id ? {...block, tableEditing} : block,
      ),
    );
  };

  const updateBlockScripture = (
    id: string,
    result: ScriptureReaderResult | null,
  ) => {
    if (result) {
      keepScrollAtEndRef.current = true;
      if (keepAtEndTimerRef.current) {
        clearTimeout(keepAtEndTimerRef.current);
      }
      keepAtEndTimerRef.current = setTimeout(() => {
        keepScrollAtEndRef.current = false;
        keepAtEndTimerRef.current = null;
      }, 700);
    }
    setBlocks(current =>
      current.map(block =>
        block.id === id
          ? {
              ...block,
              scriptureText: result?.text,
              scriptureReference: result?.reference,
              scriptureVersion: result?.version,
            }
          : block,
      ),
    );
  };

  const startOutlineSection = (point: string) => {
    if (!point.trim()) {
      return;
    }
    triggerLightHaptic();
    setBlocks(current => [
      ...current,
      {...newBlock('section'), text: point.trim()},
    ]);
    setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 60);
  };

  const hasBlockContent = (block: NoteBlock) =>
    Boolean(
      block.text.trim() ||
        block.secondary?.trim() ||
        block.note?.trim() ||
        block.reference?.trim() ||
        block.meaning?.trim() ||
        block.origin?.trim() ||
        block.points?.some(point => point.trim()) ||
        block.tableRows?.some(row => row.some(cell => cell.trim())),
    );

  const summary = useMemo(
    () =>
      Object.entries(BLOCKS)
        .map(([kind, config]) => {
          const blockCount = blocks.filter(
            block => block.kind === kind && hasBlockContent(block),
          ).length;
          const mainCount =
            kind === 'scripture' ? mainScriptureRefs.length : 0;
          return {kind, label: config.label, count: blockCount + mainCount};
        })
        .filter(item => item.count > 0),
    [blocks, mainScriptureRefs],
  );

  const coverStatCount = (kind: BlockKind) => {
    const blockCount = blocks.filter(
      block => block.kind === kind && hasBlockContent(block),
    ).length;
    const mainCount = kind === 'scripture' ? mainScriptureRefs.length : 0;
    return blockCount + mainCount;
  };

  const coverFirstQuote = useMemo(
    () =>
      blocks.find(block => block.kind === 'quote' && block.text.trim())?.text,
    [blocks],
  );

  const saveSermon = async (markComplete = true): Promise<boolean> => {
    if (isSaving) {
      return false;
    }
    setIsSaving(true);
    const meaningfulBlocks = blocks.filter(hasBlockContent);
    if (!title.trim() && meaningfulBlocks.length === 0) {
      setIsSaving(false);
      Alert.alert('Nothing to save', 'Add a sermon title or a note first.');
      return false;
    }
    try {
      const pendingMainScriptureInput = mainScriptureInput.trim();
      const mainScriptureForSave = pendingMainScriptureInput
        ? (mainScripture ? mainScripture + '; ' : '') + pendingMainScriptureInput
        : mainScripture;
      setMainScripture(mainScriptureForSave);
      setMainScriptureInput('');
      const content = JSON.stringify({
        format: 'sermon_notes_v1',
        blocks: meaningfulBlocks,
      });
      const metadata = {
        main_scripture: mainScriptureForSave.trim(),
        series: series.trim(),
        part: part.trim(),
        speaker: speaker.trim(),
        church: church.trim(),
        notice: notice.trim(),
        carry: carry.trim(),
        prayer: prayer.trim(),
        prayer_answer: prayerAnswer.trim(),
        is_complete: markComplete,
      };

      if (savedReflectionId) {
        const existing = await getLocalReflection(savedReflectionId, 'sermon', selectedDate);
        if (existing) {
          const updated = await updateLocalReflection({
            ...existing,
            title: title.trim() || 'Sermon Notes',
            content,
            metadata,
          });
          setSavedReflectionId(updated.id);
        } else {
          const created = await createLocalReflection({
            title: title.trim() || 'Sermon Notes',
            content,
            type: 'sermon',
            source: 'sermon_notes',
            tags: ['sermon'],
            selected_date: selectedDate,
            metadata,
          });
          setSavedReflectionId(created.id);
        }
      } else {
        const created = await createLocalReflection({
          title: title.trim() || 'Sermon Notes',
          content,
          type: 'sermon',
          source: 'sermon_notes',
          tags: ['sermon'],
          selected_date: selectedDate,
          metadata,
        });
        setSavedReflectionId(created.id);
      }
      if (markComplete) {
        setSaved(true);
      }
      DeviceEventEmitter.emit('sermon_saved');
      setIsSaving(false);
      return true;
    } catch (error) {
      console.error('Error saving sermon notes locally:', error);
      setIsSaving(false);
      Alert.alert(
        'Could not save',
        'Your sermon notes could not be saved. Please try again.',
      );
      return false;
    }
  };

  const renderBlock = (block: NoteBlock) => {
    if (block.kind === 'text') {
      return (
        <TextInput
          key={block.id}
          ref={input => {
            if (input) {
              blockInputRefs.current.set(block.id, input);
            } else {
              blockInputRefs.current.delete(block.id);
            }
          }}
          style={styles.freeText}
          multiline
          placeholder="Write as you listen…"
          placeholderTextColor={Colors.textGray}
          value={block.text}
          onChangeText={value => {
            if (!value && block.text) {
              removeBlock(block.id, false);
            } else {
              updateBlock(block.id, 'text', value);
            }
          }}
          onBlur={() => {
            if (!block.text.trim()) {
              removeBlock(block.id, false);
            }
          }}
          onLayout={e => {
            const {y, height} = e.nativeEvent.layout;
            inputLayouts.current[block.id] = {y, height};
          }}
          onFocus={() => setFocusedInput(block.id)}
        />
      );
    }
    if (block.kind === 'section') {
      return (
        <View key={block.id} style={styles.sectionDivider}>
          <View style={styles.sectionLine} />
          <ThemedText weight="bold" style={styles.sectionDividerText}>
            {block.text}
          </ThemedText>
          <TouchableOpacity
            onPress={() => removeBlock(block.id)}>
            <Ionicons name="close" size={15} color={Colors.textGray} />
          </TouchableOpacity>
        </View>
      );
    }
    const config = BLOCKS[block.kind];
    const linkUrl = block.kind === 'link' ? normalizeLink(block.text) : null;
    const selectedHistoryTypes = block.historyTypes || [];
    const selectedLanguageDetails = block.languageDetails || [];
    const focusBlock = () => setFocusedInput(block.id);
    return (
      <View
        key={block.id}
        style={[
          styles.capture,
          styles[`${block.kind}Capture` as keyof typeof styles] as any,
        ]}
        onLayout={e => {
          const {y, height} = e.nativeEvent.layout;
          inputLayouts.current[block.id] = {y, height};
        }}>
        <View style={styles.captureHeader}>
          <View style={styles.captureLabelRow}>
            <BlockIcon config={config} size={14} color={Colors.sage} />
            <ThemedText weight="bold" style={styles.captureLabel}>
              {config.label}
            </ThemedText>
          </View>
          {(block.kind !== 'table' || block.tableEditing) && (
            <TouchableOpacity
              onPress={() => removeBlock(block.id)}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Ionicons name="close" size={17} color={Colors.textGray} />
            </TouchableOpacity>
          )}
        </View>
        {block.kind === 'scripture' ? (
          <ScriptureLookupInput
            value={block.text}
            placeholder={config.placeholder}
            version={bibleVersion}
            style={styles.captureInput}
            registerInput={input => {
              if (input) {
                blockInputRefs.current.set(block.id, input);
              } else {
                blockInputRefs.current.delete(block.id);
              }
            }}
            onChange={value => updateBlock(block.id, 'text', value)}
            onResolved={result => updateBlockScripture(block.id, result)}
            onFocus={focusBlock}
          />
        ) : block.kind !== 'history' &&
          block.kind !== 'table' ? (
          <TextInput
            ref={input => {
              if (input) {
                blockInputRefs.current.set(block.id, input);
              } else {
                blockInputRefs.current.delete(block.id);
              }
            }}
            style={[
              styles.captureInput,
              (block.kind === 'quote' || block.kind === 'prayer') &&
                styles.serifInput,
              block.kind === 'character' && styles.characterName,
              block.kind === 'outline' && styles.outlineTitleInput,
            ]}
            multiline={
              block.kind !== 'outline' &&
              block.kind !== 'link' &&
              block.kind !== 'character'
            }
            placeholder={config.placeholder}
            placeholderTextColor={Colors.textGray}
            value={block.text}
            onChangeText={value => updateBlock(block.id, 'text', value)}
            onFocus={focusBlock}
            keyboardType={block.kind === 'link' ? 'url' : 'default'}
            autoCapitalize={block.kind === 'link' ? 'none' : 'sentences'}
            autoCorrect={block.kind !== 'link'}
          />
        ) : null}
        {block.kind === 'reflection_question' && (
          <>
            <ThemedText
              weight="bold"
              style={[styles.detailLabel, {marginTop: 12}]}>
              ANSWER
            </ThemedText>
            <TextInput
              style={styles.captureInput}
              placeholder="Type your reflection..."
              placeholderTextColor={Colors.textGray}
              value={block.note || ''}
              onChangeText={value => updateBlock(block.id, 'note', value)}
              onFocus={focusBlock}
              multiline
              autoCapitalize="sentences"
              autoCorrect
            />
          </>
        )}
        {block.kind === 'link' && linkUrl && (
          <TouchableOpacity
            accessibilityRole="link"
            accessibilityLabel={`Open ${block.text.trim()}`}
            style={styles.openLink}
            onPress={() => {
              triggerLightHaptic();
              Linking.openURL(linkUrl).catch(() => {
                Alert.alert('Could not open link', 'Please check the address.');
              });
            }}>
            <Ionicons name="open-outline" size={15} color={Colors.sage} />
            <ThemedText weight="bold" style={styles.openLinkText}>
              Open link
            </ThemedText>
          </TouchableOpacity>
        )}
        {block.kind === 'outline' && (
          <>
            <View style={styles.outlineStyles}>
              {(['numbered', 'acronym', 'simple'] as const).map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.outlineStyle,
                    block.outlineStyle === option && styles.outlineStyleActive,
                  ]}
                  onPress={() =>
                    updateOutline(block.id, {outlineStyle: option})
                  }>
                  <ThemedText
                    weight="bold"
                    style={[
                      styles.outlineStyleText,
                      block.outlineStyle === option &&
                        styles.outlineStyleTextActive,
                    ]}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
            {(block.points || []).map((point, index) => (
              <View key={index} style={styles.outlinePointRow}>
                <ThemedText weight="bold" style={styles.outlineMarker}>
                  {block.outlineStyle === 'numbered'
                    ? `${index + 1}.`
                    : block.outlineStyle === 'acronym'
                    ? `${point.trim().charAt(0).toUpperCase() || '•'} —`
                    : '•'}
                </ThemedText>
                <TextInput
                  style={styles.outlinePointInput}
                  placeholder={`Outline point ${index + 1}`}
                  placeholderTextColor={Colors.textGray}
                  value={point}
                  onChangeText={value => {
                    const points = [...(block.points || [])];
                    points[index] = value;
                    updateOutline(block.id, {points});
                  }}
                  onFocus={focusBlock}
                />
                <TouchableOpacity
                  style={styles.startSection}
                  disabled={!point.trim()}
                  onPress={() => startOutlineSection(point)}>
                  <ThemedText weight="bold" style={styles.startSectionText}>
                    Start section
                  </ThemedText>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addPoint}
              onPress={() =>
                updateOutline(block.id, {points: [...(block.points || []), '']})
              }>
              <ThemedText weight="bold" style={styles.toggleText}>
                ＋ Add outline point
              </ThemedText>
            </TouchableOpacity>
          </>
        )}
        {(block.kind === 'quote' ||
          block.kind === 'song' ||
          block.kind === 'book') && (
          <TextInput
            style={styles.secondaryInput}
            placeholder={
              block.kind === 'song'
                ? '— Artist / Worship Team'
                : block.kind === 'book'
                ? '— Author'
                : '— Speaker / Author'
            }
            placeholderTextColor={Colors.textGray}
            value={block.secondary || ''}
            onChangeText={value =>
              updateBlock(
                block.id,
                'secondary',
                (block.kind === 'quote' ||
                  block.kind === 'book' ||
                  block.kind === 'song') &&
                  value &&
                  !value.startsWith('—')
                  ? `— ${value}`
                  : value,
              )
            }
            onFocus={focusBlock}
          />
        )}
        {block.kind === 'character' && (
          <TextInput
            style={[styles.captureInput, styles.characterReflection]}
            multiline
            placeholder="What stood out about this person?"
            placeholderTextColor={Colors.textGray}
            value={block.note || ''}
            onChangeText={value => updateBlock(block.id, 'note', value)}
            onFocus={focusBlock}
          />
        )}
        {block.kind === 'character' && (
          <ScriptureLookupInput
            value={block.secondary || ''}
            placeholder="Search related Scripture"
            version={bibleVersion}
            style={[styles.secondaryInput, styles.characterScripture]}
            onChange={value => updateBlock(block.id, 'secondary', value)}
            onResolved={result => updateBlockScripture(block.id, result)}
            onFocus={focusBlock}
          />
        )}
        {block.kind === 'language' && (
          <>
            <View style={styles.languageKindChoices}>
              {(['hebrew', 'greek', 'aramaic', 'latin'] as const).map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.languageKindChoice,
                    block.languageKind === option &&
                      styles.languageKindChoiceActive,
                  ]}
                  onPress={() => updateLanguage(block.id, {languageKind: option})}>
                  <ThemedText
                    weight="bold"
                    style={[
                      styles.languageKindText,
                      block.languageKind === option &&
                        styles.languageKindTextActive,
                    ]}>
                    {option === 'hebrew'
                      ? 'א Hebrew'
                      : option === 'greek'
                      ? 'α Greek'
                      : option === 'aramaic'
                      ? '𐡀 Aramaic'
                      : 'L Latin'}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.historyChoices}>
              {(
                ['meaning', 'transliteration', 'origin', 'scripture'] as const
              ).map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.historyChoice,
                    selectedLanguageDetails.includes(option) &&
                      styles.historyChoiceActive,
                  ]}
                  onPress={() =>
                    updateLanguage(block.id, {
                      languageDetails: selectedLanguageDetails.includes(option)
                        ? selectedLanguageDetails.filter(item => item !== option)
                        : [...selectedLanguageDetails, option],
                    })
                  }>
                  <ThemedText
                    weight="bold"
                    style={[
                      styles.historyChoiceText,
                      selectedLanguageDetails.includes(option) &&
                        styles.historyChoiceTextActive,
                    ]}>
                    {option === 'origin'
                      ? 'Word Origin'
                      : option[0].toUpperCase() + option.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
            {selectedLanguageDetails.includes('meaning') && (
              <TextInput
                style={[styles.captureInput, styles.characterNote]}
                multiline
                placeholder="What does this word mean here?"
                placeholderTextColor={Colors.textGray}
                value={block.meaning || ''}
                onChangeText={value => updateBlock(block.id, 'meaning', value)}
                onFocus={focusBlock}
              />
            )}
            {selectedLanguageDetails.includes('transliteration') && (
              <TextInput
                style={styles.secondaryInput}
                placeholder="Transliteration / pronunciation"
                placeholderTextColor={Colors.textGray}
                value={block.secondary || ''}
                onChangeText={value => updateBlock(block.id, 'secondary', value)}
                onFocus={focusBlock}
              />
            )}
            {selectedLanguageDetails.includes('origin') && (
              <TextInput
                style={[styles.captureInput, styles.characterNote]}
                multiline
                placeholder="Where does this word come from?"
                placeholderTextColor={Colors.textGray}
                value={block.origin || ''}
                onChangeText={value => updateBlock(block.id, 'origin', value)}
                onFocus={focusBlock}
              />
            )}
            {selectedLanguageDetails.includes('scripture') && (
              <ScriptureLookupInput
                value={block.reference || ''}
                placeholder="Search related Scripture"
                version={bibleVersion}
                style={styles.secondaryInput}
                onChange={value => updateBlock(block.id, 'reference', value)}
                onResolved={result => updateBlockScripture(block.id, result)}
                onFocus={focusBlock}
              />
            )}
          </>
        )}
        {block.kind === 'table' && (
          block.tableEditing ? (
            <>
              <ScrollView
                horizontal
                style={styles.editingTableHorizontalScroll}
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tableGrid}>
                <View>
                  {(block.tableRows || []).map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.tableRow}>
                      {row.map((cell, columnIndex) => (
                        <TextInput
                          key={columnIndex}
                          ref={input => {
                            if (rowIndex === 0 && columnIndex === 0 && input) {
                              blockInputRefs.current.set(block.id, input);
                            }
                          }}
                          style={[
                            styles.tableCell,
                            row.length === 2 && {
                              width: (screenWidth - 92) / 2,
                            },
                            rowIndex === 0 && styles.tableHeaderCell,
                          ]}
                          placeholder={rowIndex === 0 ? 'Heading' : ''}
                          placeholderTextColor={Colors.textGray}
                          value={cell}
                          multiline
                          onChangeText={value => {
                            const rows = (block.tableRows || []).map(item => [
                              ...item,
                            ]);
                            rows[rowIndex][columnIndex] = value;
                            updateTableRows(block.id, rows);
                          }}
                          onFocus={focusBlock}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.structureActions}>
                <TouchableOpacity
                    style={styles.structureAction}
                  onPress={() => {
                    const rows = block.tableRows || [['', '']];
                    updateTableRows(block.id, [
                      ...rows,
                      Array(rows[0]?.length || 2).fill(''),
                    ]);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Add row">
                  <MaterialCommunityIcons
                    name="table-row-plus-after"
                    size={18}
                    color={Colors.sage}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.structureAction}
                  onPress={() =>
                    updateTableRows(
                      block.id,
                      (block.tableRows || [[''], ['']]).map(row => [...row, '']),
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Add column">
                  <MaterialCommunityIcons
                    name="table-column-plus-after"
                    size={18}
                    color={Colors.sage}
                  />
                </TouchableOpacity>
                {(block.tableRows?.length || 0) > 2 && (
                  <TouchableOpacity
                    style={styles.structureAction}
                    onPress={() =>
                      updateTableRows(
                        block.id,
                        (block.tableRows || []).slice(0, -1),
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Remove last row">
                    <MaterialCommunityIcons
                      name="table-row-remove"
                      size={18}
                      color={Colors.alertCoral}
                    />
                  </TouchableOpacity>
                )}
                {(block.tableRows?.[0]?.length || 0) > 2 && (
                  <TouchableOpacity
                    style={styles.structureAction}
                    onPress={() =>
                      updateTableRows(
                        block.id,
                        (block.tableRows || []).map(row => row.slice(0, -1)),
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Remove last column">
                    <MaterialCommunityIcons
                      name="table-column-remove"
                      size={18}
                      color={Colors.alertCoral}
                    />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.saveTableButton}
                onPress={() => {
                  triggerLightHaptic();
                  Keyboard.dismiss();
                  setTableEditing(block.id, false);
                }}>
                <ThemedText weight="bold" style={styles.saveTableButtonText}>
                  Save table
                </ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Edit table"
              onPress={() => setTableEditing(block.id, true)}>
            <ScrollView
              horizontal
              style={styles.savedTableHorizontalScroll}
              scrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.savedTableGrid}>
              <View>
                {(block.tableRows || []).map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.savedTableRow}>
                    {row.map((cell, columnIndex) => (
                      <ThemedText
                        key={columnIndex}
                        weight={rowIndex === 0 ? 'bold' : 'regular'}
                        style={[
                          styles.savedTableCell,
                          row.length === 2 && {
                            width: (screenWidth - 92) / 2,
                          },
                          rowIndex === 0 && styles.savedTableHeaderCell,
                        ]}>
                        {cell}
                      </ThemedText>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
            </TouchableOpacity>
          )
        )}
        {block.kind === 'history' && (
          <>
            <View style={styles.historyChoices}>
              {(
                ['era', 'place', 'culture', 'custom', 'politics'] as const
              ).map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.historyChoice,
                    selectedHistoryTypes.includes(option) &&
                      styles.historyChoiceActive,
                  ]}
                  onPress={() =>
                    updateHistory(block.id, {
                      historyTypes: selectedHistoryTypes.includes(option)
                        ? selectedHistoryTypes.filter(item => item !== option)
                        : [...selectedHistoryTypes, option],
                    })
                  }>
                  <ThemedText
                    weight="bold"
                    style={[
                      styles.historyChoiceText,
                      selectedHistoryTypes.includes(option) &&
                        styles.historyChoiceTextActive,
                    ]}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
            {selectedHistoryTypes.includes('era') && (
              <View style={styles.historyDetailRow}>
                <TextInput
                  ref={input => {
                    if (input) {
                      blockInputRefs.current.set(block.id, input);
                    } else {
                      blockInputRefs.current.delete(block.id);
                    }
                  }}
                  style={[styles.secondaryInput, styles.historyDetailInput]}
                  placeholder="Year or period"
                  placeholderTextColor={Colors.textGray}
                  value={block.secondary || ''}
                  onChangeText={value =>
                    updateBlock(block.id, 'secondary', value)
                  }
                  onFocus={focusBlock}
                />
                {(['BC', 'AD'] as const).map(period => (
                  <TouchableOpacity
                    key={period}
                    style={[
                      styles.eraChoice,
                      block.eraPeriod === period && styles.eraChoiceActive,
                    ]}
                    onPress={() => updateHistory(block.id, {eraPeriod: period})}>
                    <ThemedText
                      weight="bold"
                      style={[
                        styles.eraChoiceText,
                        block.eraPeriod === period && styles.eraChoiceTextActive,
                      ]}>
                      {period}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {selectedHistoryTypes.includes('place') && (
              <View style={styles.historyDetailRow}>
                <Ionicons name="location-outline" size={17} color={Colors.sage} />
                <TextInput
                  ref={input => {
                    if (input) {
                      blockInputRefs.current.set(block.id, input);
                    } else {
                      blockInputRefs.current.delete(block.id);
                    }
                  }}
                  style={[styles.secondaryInput, styles.historyDetailInput]}
                  placeholder="Ephesus or modern-day Turkey"
                  placeholderTextColor={Colors.textGray}
                  value={block.secondary || ''}
                  onChangeText={value =>
                    updateBlock(block.id, 'secondary', value)
                  }
                  onFocus={focusBlock}
                />
              </View>
            )}
            <TextInput
              style={[styles.captureInput, styles.characterNote]}
              multiline
              placeholder={
                selectedHistoryTypes.length !== 1
                  ? 'What background helps explain this passage?'
                  : selectedHistoryTypes.includes('era')
                  ? 'What was happening during this period?'
                  : selectedHistoryTypes.includes('place')
                  ? 'Why does this location matter?'
                  : selectedHistoryTypes.includes('culture')
                  ? 'What cultural detail explains the message?'
                  : selectedHistoryTypes.includes('custom')
                  ? 'What ancient custom should you remember?'
                  : 'What political or social setting matters?'
              }
              placeholderTextColor={Colors.textGray}
              value={block.note || ''}
              onChangeText={value => updateBlock(block.id, 'note', value)}
              onFocus={focusBlock}
            />
            <ScriptureLookupInput
              value={block.reference || ''}
              placeholder="Search related Scripture"
              version={bibleVersion}
              style={styles.secondaryInput}
              onChange={value => updateBlock(block.id, 'reference', value)}
              onResolved={result => updateBlockScripture(block.id, result)}
              onFocus={focusBlock}
            />
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      ref={screenRef}
      style={styles.safeArea}
      edges={['left', 'right']}
      onLayout={() => {
        screenRef.current?.measureInWindow(
          (_x, y, _width, height) => setScreenBottomY(y + height),
        );
      }}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={Colors.lightBackground}
      />
      {stage <= 2 && (
        <View
          style={[styles.actionProgressBar, {top: insets.top + 25}]}
          pointerEvents="none">
          <View
            style={[
              styles.actionProgressFill,
              {width: `${(stage / 3) * 100}%`},
            ]}
          />
        </View>
      )}
      <TouchableOpacity
        style={[styles.closeButton, {top: insets.top + 8}]}
        onPress={() => {
          triggerLightHaptic();
          Keyboard.dismiss();
          navigation.popToTop();
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Close sermon notes">
        <Ionicons name="close" size={20} color={Colors.text} />
      </TouchableOpacity>
      {stage === 5 && (
        <Animated.View
          style={[
            styles.shareButton,
            {top: insets.top + 8},
            {
              opacity: savedShareButtonAnim,
              transform: [
                {
                  scale: savedShareButtonAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.4, 1],
                  }),
                },
              ],
            },
          ]}>
          <TouchableOpacity
            style={styles.shareButtonPressable}
            onPress={() => {
              triggerLightHaptic();
              setShareDropdownOpen(true);
            }}
            activeOpacity={0.7}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            accessibilityRole="button"
            accessibilityLabel="Share sermon notes">
            <Ionicons name="paper-plane-outline" size={17} color={Colors.text} />
          </TouchableOpacity>
        </Animated.View>
      )}
      <View style={{flex: 1}} {...panResponder.panHandlers}>
        <ScrollView
          ref={scrollRef}
          style={{flex: 1}}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: stage === 5 ? insets.top : insets.top + 36,
              paddingBottom:
                stage === 5
                  ? insets.bottom
                  : insets.bottom +
                    28 +
                    (stage === 1 && keyboardHeight > 0 ? keyboardHeight + 48 : 0),
            },
            stage === 2 && {
              paddingBottom: blocks.length
                ? (keyboardHeight > 0 ? keyboardHeight : restingComposerBottom) +
                  80
                : insets.bottom + 28,
            },
            stage === 4 && {
              paddingBottom:
                keyboardHeight > 0 ? keyboardHeight + 100 : insets.bottom + 80,
            },
            stage === 5 && {
              justifyContent: 'center' as const,
            },
          ]}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (keepScrollAtEndRef.current) {
            scrollRef.current?.scrollToEnd({animated: true});
          }
        }}>
        {stage === 3 && (
          <View style={styles.header}>
            <View style={styles.stepLabelRow}>
              <Ionicons name="book" size={18} color={Colors.sage} />
              <ThemedText weight="semiBold" style={styles.headerTitle}>
                Sermon Notes
              </ThemedText>
            </View>
          </View>
        )}
        {stage === 1 && (
          <>
            <View style={styles.heroHeader}>
              <View style={styles.heroTitleRow}>
                <Ionicons
                  name="book"
                  size={22}
                  color={Colors.sage}
                  style={styles.heroIcon}
                />
                <ThemedText weight="bold" style={styles.heroTitle}>
                  Sermon Notes
                </ThemedText>
              </View>
              <ThemedText style={styles.heroSubtitle}>
                Keep what you want to remember.
              </ThemedText>
            </View>

            <ThemedText weight="bold" style={styles.label}>
              Sermon title
            </ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Title of the message..."
              placeholderTextColor={Colors.placeholderText}
              value={title}
              onChangeText={setTitle}
              autoFocus
              onLayout={e => {
                const {y, height} = e.nativeEvent.layout;
                inputLayouts.current.title = {y, height, absolute: true};
              }}
              onFocus={() => setFocusedInput('title')}
            />

            <ThemedText weight="bold" style={styles.label}>
              Pastor / Speaker
            </ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Pastor name..."
              placeholderTextColor={Colors.placeholderText}
              value={speaker}
              onChangeText={setSpeaker}
              onLayout={e => {
                const {y, height} = e.nativeEvent.layout;
                inputLayouts.current.speaker = {y, height, absolute: true};
              }}
              onFocus={() => setFocusedInput('speaker')}
            />

            <TouchableOpacity
              style={styles.toggle}
              onPress={() => {
                triggerLightHaptic();
                setShowDetails(value => !value);
              }}
              activeOpacity={0.7}>
              <Ionicons
                name={showDetails ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.sage}
              />
              <ThemedText weight="bold" style={styles.toggleText}>
                Add more details
              </ThemedText>
            </TouchableOpacity>

            {showDetails && (
              <View
                onLayout={e => {
                  const base = e.nativeEvent.layout.y;
                  detailsLayout.current = {y: base};
                  (['series', 'mainScripture', 'church'] as const).forEach(
                    key => {
                      const layout = inputLayouts.current[key];
                      if (layout && !layout.absolute) {
                        layout.y += base;
                        layout.absolute = true;
                      }
                    },
                  );
                  setInputLayoutVersion(v => v + 1);
                }}>
                <ThemedText weight="bold" style={styles.label}>
                  Series
                </ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="The Book of Romans..."
                  placeholderTextColor={Colors.placeholderText}
                  value={series}
                  onChangeText={setSeries}
                  onLayout={e => {
                    const base = detailsLayout.current?.y || 0;
                    const {y, height} = e.nativeEvent.layout;
                    inputLayouts.current.series = {
                      y: base + y,
                      height,
                      absolute: base !== 0,
                    };
                  }}
                  onFocus={() => setFocusedInput('series')}
                />
                <ThemedText weight="bold" style={styles.label}>
                  Main Scripture
                </ThemedText>
                <View style={styles.scriptureInputRow}>
                  <TextInput
                    style={[styles.input, styles.scriptureInput]}
                    placeholder="Romans 12:1–2..."
                    placeholderTextColor={Colors.placeholderText}
                    value={mainScriptureInput}
                    onChangeText={setMainScriptureInput}
                    blurOnSubmit={false}
                    onSubmitEditing={() => {
                      const trimmed = mainScriptureInput.trim();
                      if (!trimmed) {return;}
                      setMainScripture(prev => (prev ? prev + '; ' : '') + trimmed);
                      setMainScriptureInput('');
                    }}
                    onLayout={e => {
                      const base = detailsLayout.current?.y || 0;
                      const {y, height} = e.nativeEvent.layout;
                      inputLayouts.current.mainScripture = {
                        y: base + y,
                        height,
                        absolute: base !== 0,
                      };
                    }}
                    onFocus={() => setFocusedInput('mainScripture')}
                  />
                  <TouchableOpacity
                    style={styles.addScriptureButton}
                    onPress={() => {
                      triggerLightHaptic();
                      const trimmed = mainScriptureInput.trim();
                      if (!trimmed) {return;}
                      setMainScripture(prev => (prev ? prev + '; ' : '') + trimmed);
                      setMainScriptureInput('');
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Add main scripture">
                    <Ionicons
                      name="add"
                      size={16}
                      color={Colors.hopeWhite}
                    />
                  </TouchableOpacity>
                </View>
                {mainScriptureRefs.length > 0 && (
                  <View style={styles.scriptureChips}>
                    {mainScriptureRefs.map((ref, index) => (
                      <View key={ref + index} style={styles.scriptureChip}>
                        <ThemedText
                          weight="semiBold"
                          style={styles.scriptureChipText}
                          numberOfLines={1}
                          ellipsizeMode="tail">
                          {ref}
                        </ThemedText>
                        <TouchableOpacity
                          onPress={() => {
                            triggerLightHaptic();
                            const refs = mainScriptureRefs.filter(
                              (_, i) => i !== index,
                            );
                            setMainScripture(refs.join('; '));
                          }}
                          style={styles.scriptureChipRemove}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel="Remove main scripture">
                          <Ionicons
                            name="close"
                            size={14}
                            color={Colors.sage}
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <ThemedText weight="bold" style={styles.label}>
                  Church / Event
                </ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Where you heard it..."
                  placeholderTextColor={Colors.placeholderText}
                  value={church}
                  onChangeText={setChurch}
                  onLayout={e => {
                    const base = detailsLayout.current?.y || 0;
                    const {y, height} = e.nativeEvent.layout;
                    inputLayouts.current.church = {
                      y: base + y,
                      height,
                      absolute: base !== 0,
                    };
                  }}
                  onFocus={() => setFocusedInput('church')}
                />
              </View>
            )}
          </>
        )}

        {stage === 2 && (
          <>
            {(title.trim() ||
              speaker.trim() ||
              series.trim() ||
              mainScriptureRefs.length > 0 ||
              church.trim()) && (
              <View style={styles.sermonDetails}>
                <ThemedText style={styles.sermonDate}>{sermonDate}</ThemedText>
                <ThemedText weight="bold" style={styles.sermonEyebrow}>
                  SERMON NOTES
                </ThemedText>
                {title.trim() && (
                  <ThemedText weight="bold" style={styles.sermonTitle}>
                    {title}
                  </ThemedText>
                )}
                {speaker.trim() && (
                  <ThemedText weight="bold" style={styles.sermonPastor}>
                    {speaker}
                  </ThemedText>
                )}
                {hasAdditionalDetails && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.detailGrid}>
                      {series.trim() && (
                        <View style={styles.detailItem}>
                          <ThemedText weight="bold" style={styles.detailLabel}>
                            SERIES
                          </ThemedText>
                          <ThemedText weight="bold" style={styles.detailValue}>
                            {series}
                          </ThemedText>
                        </View>
                      )}
                      {church.trim() && (
                        <View style={styles.detailItem}>
                          <ThemedText weight="bold" style={styles.detailLabel}>
                            CHURCH / EVENT
                          </ThemedText>
                          <ThemedText weight="bold" style={styles.detailValue}>
                            {church}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </>
                )}
                {mainScriptureRefs.length > 0 && (
                  <>
                    <ThemedText
                      weight="bold"
                      style={[styles.detailLabel, {marginTop: 8}]}>
                      {mainScriptureRefs.length > 1
                        ? 'MAIN SCRIPTURES'
                        : 'MAIN SCRIPTURE'}
                    </ThemedText>
                    {mainScriptureRefs.map((ref, index) => (
                      <View key={ref + index}>
                        {index > 0 && <View style={styles.divider} />}
                        <TouchableOpacity
                          style={[styles.sermonQuote, {marginTop: 12}]}
                          activeOpacity={0.9}
                          onPress={() => {
                            triggerLightHaptic();
                            setScriptureReaderIndex(index);
                            setScriptureReaderOpen(true);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Open scripture in reader">
                          <View style={styles.sermonQuoteLine} />
                          <View style={styles.sermonQuoteContent}>
                            <ThemedText style={styles.sermonQuoteText}>
                              {mainScriptureTexts[index]
                                ? mainScriptureTexts[index]
                                : scriptureLoading
                                ? 'Loading…'
                                : ref}
                            </ThemedText>
                            {mainScriptureTexts[index] && (
                              <View style={styles.sermonQuoteReferenceRow}>
                                <ThemedText
                                  weight="bold"
                                  style={styles.sermonQuoteReference}>
                                  {ref.toUpperCase()} {bibleVersion}
                                </ThemedText>
                                <TouchableOpacity
                                  style={styles.scriptureAction}
                                  onPress={() => {
                                    triggerLightHaptic();
                                    setScriptureReaderIndex(index);
                                    setScriptureReaderOpen(true);
                                  }}
                                  activeOpacity={0.7}
                                  accessibilityRole="button"
                                  accessibilityLabel="Open scripture reader">
                                  <MaterialCommunityIcons
                                    name="script-text"
                                    size={16}
                                    color={Colors.sage}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.scriptureAction,
                                    {marginLeft: 4},
                                  ]}
                                  onPress={() => handleShareScripture(index)}
                                  activeOpacity={0.7}
                                  accessibilityRole="button"
                                  accessibilityLabel="Share scripture">
                                  <Ionicons
                                    name="paper-plane-outline"
                                    size={16}
                                    color={Colors.sage}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.scriptureAction,
                                    {marginLeft: 4},
                                  ]}
                                  onPress={() => {
                                    triggerLightHaptic();
                                    setBibleCopyrightOpen(true);
                                  }}
                                  activeOpacity={0.7}
                                  accessibilityRole="button"
                                  accessibilityLabel="Bible translation information">
                                  <Ionicons
                                    name="information-circle-outline"
                                    size={16}
                                    color={Colors.sage}
                                  />
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}
                {(hasAdditionalDetails || mainScriptureRefs.length > 0) && (
                  <View style={styles.divider} />
                )}
                <ThemedText weight="bold" style={styles.sermonEyebrow}>
                  MY NOTES
                </ThemedText>
              </View>
            )}
            <View
              style={styles.editor}
              onLayout={e => {
                editorLayout.current = {y: e.nativeEvent.layout.y};
              }}>
              {blocks.map(renderBlock)}
            </View>
          </>
        )}

        {stage === 3 && (
          <>
            <ThemedText weight="bold" style={styles.eyebrow}>
              FROM YOUR NOTES
            </ThemedText>
            <ThemedText style={styles.coverDate}>{coverDate}</ThemedText>
            <ThemedText weight="bold" style={styles.coverWhatTitle}>
              What you captured
            </ThemedText>
            <ThemedText style={styles.coverSubtitle}>
              Your sermon notes are saved. Here’s what you captured from the
              message.
            </ThemedText>

            <View style={styles.coverCard}>
              <ThemedText weight="bold" style={styles.eyebrow}>
                SERMON REMEMBERED
              </ThemedText>
              <ThemedText weight="bold" style={styles.coverSermonTitle}>
                {title.trim() || 'This sermon'}
              </ThemedText>
              {series.trim() ? (
                <ThemedText style={styles.coverDetail}>{series}</ThemedText>
              ) : null}
              {(speaker.trim() || mainScriptureRefs[0]) ? (
                <ThemedText style={styles.coverDetail}>
                  {speaker.trim() || 'Sermon'}
                  {mainScriptureRefs[0] ? ` · ${mainScriptureRefs[0]}` : ''}
                </ThemedText>
              ) : null}

              <View style={styles.coverStats}>
                {[
                  {kind: 'scripture', label: 'Scriptures'},
                  {kind: 'key', label: 'Key Points'},
                  {kind: 'quote', label: 'Quotes'},
                  {kind: 'prayer', label: 'Prayer'},
                ].map(item => (
                  <View key={item.kind} style={styles.coverStatItem}>
                    <ThemedText weight="bold" style={styles.coverStatNumber}>
                      {coverStatCount(item.kind as BlockKind)}
                    </ThemedText>
                    <ThemedText style={styles.coverStatLabel}>
                      {item.label}
                    </ThemedText>
                  </View>
                ))}
              </View>

              {(() => {
                const mainKinds: BlockKind[] = ['scripture', 'key', 'quote', 'prayer'];
                const extra = summary.filter(s => !mainKinds.includes(s.kind as BlockKind));
                if (!extra.length) {return null;}
                return showAllStats ? (
                  <>
                    <View style={styles.coverStats}>
                      {extra.map(item => (
                        <View key={item.kind} style={styles.coverStatItem}>
                          <ThemedText weight="bold" style={styles.coverStatNumber}>
                            {item.count}
                          </ThemedText>
                          <ThemedText style={styles.coverStatLabel}>
                            {item.label}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={styles.coverShowMore}
                      onPress={() => setShowAllStats(false)}>
                      <ThemedText weight="semiBold" style={styles.coverShowMoreText}>
                        Show less
                      </ThemedText>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.coverShowMore}
                    onPress={() => setShowAllStats(true)}>
                    <ThemedText weight="semiBold" style={styles.coverShowMoreText}>
                      + {extra.length} more
                    </ThemedText>
                  </TouchableOpacity>
                );
              })()}
            </View>

            {coverFirstQuote ? (
              <>
                <ThemedText
                  weight="bold"
                  style={[styles.eyebrow, {marginTop: 28}]}>
                  A LINE YOU CAPTURED
                </ThemedText>
                <ThemedText weight="bold" style={styles.lineCaptured}>
                  “{coverFirstQuote}”
                </ThemedText>
              </>
            ) : null}

            <View style={styles.coverActions}>
              <TouchableOpacity
                style={styles.floatingBackButton}
                onPress={() => goTo(2)}>
                <Ionicons name="chevron-back" size={21} color={Colors.sage} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.startReflectingButton, {flex: 1}]}
                onPress={() => goTo(4)}>
                <ThemedText weight="bold" style={styles.startButtonText}>
                  Start reflecting
                </ThemedText>
              </TouchableOpacity>
            </View>

          </>
        )}

        {stage === 4 && (() => {
          const step = [
            {
              eyebrow: 'GOD',
              title: 'What does this show you about God?',
              subtitle:
                'Take a moment with what you heard and what Scripture revealed.',
              value: notice,
              onChange: setNotice,
            },
            {
              eyebrow: 'TRUTH',
              title: 'What truth from Scripture do you want to hold onto?',
              subtitle: mainScriptureRefs[0]
                ? `Hold onto a truth rooted in ${mainScriptureRefs[0]}.`
                : 'Take a moment with what you heard and what Scripture revealed.',
              value: carry,
              onChange: setCarry,
            },
            {
              eyebrow: 'RESPONSE',
              title: 'How will you respond?',
              subtitle:
                'Reflect on how this truth shapes your next step.',
              value: prayer,
              onChange: setPrayer,
            },
            {
              eyebrow: 'PRAYER',
              title: 'What do you want to bring to God in prayer?',
              subtitle:
                'Speak to God about what this sermon has stirred in you.',
              value: prayerAnswer,
              onChange: setPrayerAnswer,
            },
          ][reflectionStep];
          const isLastStep = reflectionStep === 3;

          return (
            <>
              <ThemedText style={styles.reflectionCounter}>
                {reflectionStep + 1} of 4
              </ThemedText>

              <View style={styles.reflectionProgress}>
                <View
                  style={[
                    styles.reflectionProgressFill,
                    {
                      width: `${((reflectionStep + 1) / 4) * 100}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.reflectionLabelRow}>
                {isLastStep ? (
                  <Ionicons name="leaf-outline" size={16} color={Colors.sage} />
                ) : (
                  <Sparkles size={16} color={Colors.sage} />
                )}
                <ThemedText weight="semiBold" style={styles.reflectionLabel}>
                  {isLastStep ? 'Prayer' : 'Reflection'}
                </ThemedText>
              </View>

              <ThemedText weight="bold" style={styles.reflectionQuestion}>
                {step.title}
              </ThemedText>

              <ThemedText style={styles.reflectionPrompt}>
                {step.subtitle}
              </ThemedText>

              <TextInput
                style={styles.reflectionInput}
                multiline
                autoFocus={stage === 4}
                placeholder="Start writing..."
                placeholderTextColor={Colors.textGray}
                value={step.value}
                onChangeText={step.onChange}
                textAlignVertical="top"
              />

              <View style={{height: 120}} />
            </>
          );
        })()}
        </ScrollView>
      </View>
      {showMore &&
        (Platform.OS === 'ios' ? (
          <BlurView
            style={[StyleSheet.absoluteFill, {zIndex: 25}]}
            pointerEvents="none"
            blurType="dark"
            blurAmount={10}
            reducedTransparencyFallbackColor="rgba(0,0,0,0.5)"
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.androidBlur,
              {zIndex: 25},
            ]}
            pointerEvents="none"
          />
        ))}
      {stage === 1 && (
        <AnimatedTouchableOpacity
          activeOpacity={0.7}
          style={[
            styles.startButton,
            styles.floatingStartButton,
            {bottom: startButtonBottom},
          ]}
          onPress={() => {
            const trimmed = mainScriptureInput.trim();
            if (trimmed) {
              setMainScripture(prev => (prev ? prev + '; ' : '') + trimmed);
              setMainScriptureInput('');
            }
            goTo(2);
          }}>
          <ThemedText weight="bold" style={styles.startButtonText}>
            Start taking notes
          </ThemedText>
        </AnimatedTouchableOpacity>
      )}
      {stage === 4 && (
        <AnimatedTouchableOpacity
          style={[styles.reflectionFab, {bottom: startButtonBottom}]}
          activeOpacity={0.7}
          onPress={() => {
            triggerLightHaptic();
            if (reflectionStep === 3) {
              Keyboard.dismiss();
              saveSermon(true).then(didSave => {
                if (didSave) {
                  goTo(5);
                }
              });
            } else {
              setReflectionStep(reflectionStep + 1);
              scrollRef.current?.scrollTo({y: 0, animated: true});
            }
          }}>
          <Ionicons
            name={reflectionStep === 3 ? 'checkmark' : 'chevron-forward'}
            size={24}
            color={Colors.hopeWhite}
          />
        </AnimatedTouchableOpacity>
      )}

      {stage === 5 && (
        <Animated.View
          style={[
            styles.savedStage,
            {minHeight: screenHeight - insets.top - insets.bottom},
            {
              opacity: savedStageAnim,
              transform: [
                {
                  translateY: savedStageAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
            },
          ]}>
          <Animated.View
            style={[
              styles.savedCheckCircle,
              {
                opacity: savedCheckCircleAnim,
                transform: [
                  {
                    scale: savedCheckCircleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, 1],
                    }),
                  },
                ],
              },
            ]}>
            <Ionicons name="checkmark" size={34} color={Colors.sage} />
          </Animated.View>

          <ThemedText weight="semiBold" style={styles.savedEyebrow}>
            REFLECTION SAVED
          </ThemedText>

          <ThemedText weight="bold" style={styles.savedTitle}>
            Sermon reflected
          </ThemedText>

          <ThemedText style={styles.savedSubtitle}>
            Your notes, reflection, and prayer are saved together so you can
            return to what you captured and how you responded.
          </ThemedText>

          <View style={styles.savedCard}>
            <ThemedText weight="semiBold" style={styles.savedCardEyebrow}>
              YOUR SERMON NOW INCLUDES
            </ThemedText>
            <ThemedText weight="bold" style={styles.savedCardTitle}>
              {title.trim() || 'This sermon'}
            </ThemedText>

            <View style={styles.savedIncludes}>
              {(() => {
                const noteCount = blocks.filter(hasBlockContent).length;
                const reflectionCount = [notice, carry].filter(
                  s => s.trim(),
                ).length;
                const prayerCount = [prayer, prayerAnswer].filter(
                  s => s.trim(),
                ).length;
                return (
                  <>
                    <View style={styles.savedIncludeItem}>
                      <ThemedText weight="bold" style={styles.savedIncludeCount}>
                        {noteCount}
                      </ThemedText>
                      <ThemedText style={styles.savedIncludeLabel}>
                        {noteCount === 1 ? 'Note' : 'Notes'}
                      </ThemedText>
                    </View>

                    <View style={styles.savedIncludeDivider} />

                    <View style={styles.savedIncludeItem}>
                      <ThemedText weight="bold" style={styles.savedIncludeCount}>
                        {reflectionCount}
                      </ThemedText>
                      <ThemedText style={styles.savedIncludeLabel}>
                        {reflectionCount === 1 ? 'Reflection' : 'Reflections'}
                      </ThemedText>
                    </View>

                    <View style={styles.savedIncludeDivider} />

                    <View style={styles.savedIncludeItem}>
                      <ThemedText weight="bold" style={styles.savedIncludeCount}>
                        {prayerCount}
                      </ThemedText>
                      <ThemedText style={styles.savedIncludeLabel}>
                        {prayerCount === 1 ? 'Prayer' : 'Prayers'}
                      </ThemedText>
                    </View>
                  </>
                );
              })()}
            </View>
          </View>

          <TouchableOpacity
            style={styles.savedPrimaryButton}
            activeOpacity={0.7}
            onPress={() => {
              triggerLightHaptic();
              navigation.goBack();
            }}>
            <ThemedText weight="bold" style={styles.savedPrimaryButtonText}>
              View sermon
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.savedSecondaryButton}
            activeOpacity={0.7}
            onPress={() => {
              triggerLightHaptic();
              navigation.popToTop();
            }}>
            <ThemedText weight="semiBold" style={styles.savedSecondaryButtonText}>
              Done
            </ThemedText>
          </TouchableOpacity>


        </Animated.View>
      )}

      {stage === 2 && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.floatingComposer, {bottom: composerBottom}]}>
          {showMore && (
            <View style={[styles.floatingTools, styles.floatingToolsContent]}>
              {CAPTURE_KINDS.map((kind, index) => (
                <Animated.View
                  key={kind}
                  style={[
                    {
                      opacity: pillAnimations[index],
                      transform: [
                        {
                          translateY: pillAnimations[index].interpolate({
                            inputRange: [0, 1],
                            outputRange: [12, 0],
                          }),
                        },
                        {
                          scale: pillAnimations[index].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.94, 1],
                          }),
                        },
                      ],
                    },
                  ]}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[
                      styles.floatingTool,
                      index === CAPTURE_KINDS.length - 1 &&
                        styles.floatingToolLast,
                    ]}
                    onPress={() => selectCaptureKind(kind)}>
                    <View style={styles.floatingToolIcon}>
                      <BlockIcon
                        config={BLOCKS[kind]}
                        size={13}
                        color={Colors.sage}
                      />
                    </View>
                    <ThemedText weight="bold" style={styles.floatingToolText}>
                      {BLOCKS[kind].label}
                    </ThemedText>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          )}
          <Animated.View
            style={[
              styles.floatingActions,
              {
                opacity: actionBarAnim,
                transform: [
                  {
                    translateX: actionBarAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}>
            <Animated.View
              style={[
                styles.floatingCircleAnimationWrapper,
                {
                  opacity: actionButtonAnims[0],
                  transform: [
                    {
                      scale: actionButtonAnims[0].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1],
                      }),
                    },
                  ],
                },
              ]}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Edit sermon details"
                style={styles.floatingBackButton}
                onPress={() => runAfterClosingPicker(() => goTo(1))}>
                <Ionicons name="chevron-back" size={21} color={Colors.sage} />
              </TouchableOpacity>
            </Animated.View>
            <Animated.View
              style={[
                styles.floatingWriteAnimationWrapper,
                {
                  opacity: actionButtonAnims[1],
                  transform: [
                    {
                      scale: actionButtonAnims[1].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1],
                      }),
                    },
                  ],
                },
              ]}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.journalButton}
                onPress={() => runAfterClosingPicker(() => addBlock('text'))}>
                <Pencil
                  size={16}
                  color={Colors.hopeWhite}
                  style={styles.writeButtonIcon}
                />
                <ThemedText weight="bold" style={styles.journalButtonText}>
                  Write
                </ThemedText>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View
              style={[
                styles.floatingCircleAnimationWrapper,
                {
                  opacity: actionButtonAnims[2],
                  transform: [
                    {
                      scale: actionButtonAnims[2].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1],
                      }),
                    },
                  ],
                },
              ]}>
              <AnimatedTouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                showMore ? 'Close note type picker' : 'Choose a note type'
              }
              style={[
                styles.capturePickerButton,
                {
                  backgroundColor: pickerColorAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [Colors.sage, Colors.text],
                  }),
                },
              ]}
              onPress={() => {
                triggerLightHaptic();
                if (showMore) {
                  closeCapturePicker();
                } else {
                  openCapturePicker();
                }
              }}>
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: plusRotation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '45deg'],
                      }),
                    },
                  ],
                }}>
                <Ionicons name="add" size={24} color={Colors.hopeWhite} />
              </Animated.View>
              </AnimatedTouchableOpacity>
            </Animated.View>
            <Animated.View
              style={[
                styles.floatingCircleAnimationWrapper,
                {
                  opacity: actionButtonAnims[3],
                  transform: [
                    {
                      scale: actionButtonAnims[3].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1],
                      }),
                    },
                  ],
                },
              ]}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Finished taking notes"
                style={styles.finishNotesButton}
                disabled={isSaving}
                onPress={() =>
                  runAfterClosingPicker(async () => {
                    if (await saveSermon(false)) {
                      goTo(3);
                    }
                  })
                }>
                <Ionicons
                  name="chevron-forward"
                  size={21}
                  color={Colors.hopeWhite}
                />
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

        </Animated.View>
      )}

      <ScriptureReaderModal
        visible={scriptureReaderOpen}
        passages={mainScriptureRefs.map(r => ({reference: r}))}
        initialIndex={scriptureReaderIndex}
        version={bibleVersion}
        onClose={() => setScriptureReaderOpen(false)}
      />

      <ShareDropdownModal
        visible={shareDropdownOpen}
        onClose={() => setShareDropdownOpen(false)}
        onExportPDF={handleExportPDF}
        shareText="I’m using Journal by siFia to capture sermon notes, reflections, and prayer."
        shareTitle="Share Journal by siFia with friends"
        exportSubject="sermon notes"
      />

      <ShareComposer
        visible={shareComposerOpen}
        text={shareComposerText}
        userId=""
        onClose={() => setShareComposerOpen(false)}
        onUpgrade={() => setShareComposerOpen(false)}
      />

      <BibleCopyrightModal
        visible={bibleCopyrightOpen}
        onClose={() => setBibleCopyrightOpen(false)}
        bibleVersion={bibleVersion}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: Colors.lightBackground},
  header: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  closeButton: {
    position: 'absolute',
    right: 18,
    zIndex: 21,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 21,
  },
  shareButton: {
    position: 'absolute',
    right: 70,
    zIndex: 21,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 999,
  },
  shareButtonPressable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepLabelRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  headerTitle: {
    fontSize: 16,
    letterSpacing: 1,
    color: Colors.text,
  },
  content: {paddingHorizontal: 22, paddingBottom: 0, flexGrow: 1},
  actionProgressBar: {
    position: 'absolute',
    left: '50%',
    zIndex: 20,
    height: 6,
    width: 120,
    marginLeft: -60,
    backgroundColor: Colors.cardBorder,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  actionProgressFill: {
    height: '100%',
    backgroundColor: Colors.sage,
    borderRadius: 2,
  },
  eyebrow: {fontSize: 10, letterSpacing: 1.5, color: Colors.sage},
  title: {
    fontFamily: Fonts.lora.bold,
    fontSize: 28,
    lineHeight: 34,
    color: Colors.text,
    marginTop: 7,
  },
  lead: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textGray,
    marginTop: 6,
    marginBottom: 20,
  },
  label: {fontSize: 13, color: Colors.text, marginTop: 22, marginBottom: 10},
  optional: {fontSize: 13, color: Colors.textGray},
  input: {
    height: 40,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 8,
    borderWidth: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.sage,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: 'transparent',
  },
  scriptureInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scriptureInput: {
    flex: 1,
    marginRight: 12,
  },
  addScriptureButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scriptureChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginBottom: 4,
  },
  scriptureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.anchorBlueLight,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    maxWidth: '100%',
  },
  scriptureChipText: {
    fontSize: 13,
    color: Colors.text,
    maxWidth: 160,
  },
  scriptureChipRemove: {
    marginLeft: 6,
    padding: 2,
  },
  heroHeader: {
    marginTop: 4,
    marginBottom: 24,
    gap: 4,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroIcon: {marginTop: 2},
  heroTitle: {
    fontSize: 22,
    color: Colors.text,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textGray,
  },
  textarea: {minHeight: 90, textAlignVertical: 'top'},
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 18,
    alignSelf: 'flex-start',
  },
  toggleText: {fontSize: 12, color: Colors.sage},
  grid: {flexDirection: 'row', gap: 10},
  flex: {flex: 1},
  primary: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 18,
  },
  primaryText: {fontSize: 13, color: Colors.hopeWhite},
  startButton: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: Colors.sage,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
    marginTop: 28,
  },
  startButtonText: {fontSize: 15, color: Colors.hopeWhite},
  floatingStartButton: {
    position: 'absolute',
    left: 22,
    right: 22,
    marginTop: 0,
    zIndex: 20,
  },
  quiet: {padding: 15, alignItems: 'center'},
  quietText: {fontSize: 12, color: Colors.textGray},
  toolbar: {flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10},
  tool: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  toolText: {fontSize: 11, color: Colors.sage},
  androidBlur: {backgroundColor: 'rgba(0, 0, 0, 0.5)'},
  floatingComposer: {
    position: 'absolute',
    left: 18,
    right: 18,
    zIndex: 30,
    alignItems: 'flex-end',
  },
  floatingTools: {
    width: '100%',
    marginBottom: 9,
  },
  floatingToolsContent: {
    alignItems: 'flex-end',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  floatingTool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 34,
    paddingLeft: 5,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: Colors.sage,
    borderRadius: 17,
    backgroundColor: Colors.cardBackground,
    shadowColor: Colors.text,
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: {width: 0, height: 2},
    elevation: 3,
  },
  floatingToolLast: {},
  floatingToolIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: Colors.anchorBlueLight,
  },
  floatingToolText: {
    fontSize: 10,
    letterSpacing: 0.7,
    color: Colors.text,
  },
  floatingActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatingCircleAnimationWrapper: {width: 48, height: 48},
  floatingWriteAnimationWrapper: {flex: 1, height: 48},
  floatingBackButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 24,
    backgroundColor: Colors.cardBackground,
    shadowColor: Colors.text,
    shadowOpacity: 0.1,
    shadowRadius: 9,
    shadowOffset: {width: 0, height: 4},
    elevation: 5,
  },
  journalButton: {
    width: '100%',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: Colors.sage,
    shadowColor: Colors.text,
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  journalButtonText: {fontSize: 13, color: Colors.hopeWhite},
  capturePickerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: Colors.sage,
    shadowColor: Colors.text,
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  capturePickerButtonOpen: {backgroundColor: Colors.text},
  finishNotesButton: {
    width: 48,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: Colors.sage,
    shadowColor: Colors.text,
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  keyboardHint: {
    marginTop: 5,
    marginRight: 4,
    fontSize: 9,
    color: Colors.textGray,
  },
  sermonDetails: {
    marginTop: 0,
    marginBottom: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sermonDate: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.textGray,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 16,
  },
  sermonEyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.sage,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sermonTitle: {
    fontFamily: Fonts.lora.bold,
    fontSize: 32,
    lineHeight: 38,
    color: Colors.text,
    marginBottom: 8,
  },
  sermonPastor: {
    fontFamily: Fonts.lora.bold,
    fontSize: 16,
    color: Colors.sage,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: 14,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailItem: {
    flex: 1,
    minWidth: '48%',
    marginBottom: 18,
  },
  detailLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.textGray,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  detailValue: {
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scriptureActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scriptureAction: {
    padding: 2,
    marginLeft: 0,
  },
  detailItemFull: {
    flex: 0,
    width: '100%',
    minWidth: '100%',
  },
  detailScripturesList: {
    width: '100%',
  },
  detailScriptureReference: {
    fontSize: 15,
    color: Colors.text,
    textAlign: 'left',
    marginRight: 8,
    maxWidth: '82%',
  },
  sermonQuote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sermonQuoteLine: {
    width: 2,
    alignSelf: 'stretch',
    minHeight: 22,
    backgroundColor: Colors.sage,
    borderRadius: 1,
    marginRight: 12,
  },
  sermonQuoteContent: {
    flex: 1,
  },
  sermonQuoteText: {
    fontFamily: Fonts.lora.regular,
    fontStyle: 'italic',
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  sermonQuoteReference: {
    fontSize: 12,
    color: Colors.sage,
    marginRight: 4,
  },
  sermonQuoteReferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  editor: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
    minHeight: 330,
  },
  freeText: {
    minHeight: 70,
    padding: 8,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 23,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  capture: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 12,
    marginBottom: 9,
  },
  keyCapture: {
    backgroundColor: '#EDF1EC',
    borderColor: '#D7DED7',
    borderLeftWidth: 3,
    borderLeftColor: Colors.sage,
  },
  quoteCapture: {backgroundColor: '#F4F3ED', borderColor: Colors.cardBorder},
  songCapture: {backgroundColor: '#F1F2ED', borderColor: '#DCE1DA'},
  bookCapture: {backgroundColor: '#F0F2ED', borderColor: '#D9E0D9'},
  outlineCapture: {backgroundColor: Colors.cardBackground},
  characterCapture: {backgroundColor: '#F2F1EB', borderColor: '#DEE1D9'},
  languageCapture: {backgroundColor: '#EAEFEA', borderColor: '#D5DED6'},
  linkCapture: {backgroundColor: Colors.cardBackground},
  tableCapture: {backgroundColor: Colors.cardBackground},
  historyCapture: {backgroundColor: '#EEF1EC', borderColor: '#DAE0D8'},
  rememberCapture: {
    backgroundColor: '#F1F2ED',
    borderColor: '#DCE1DA',
  },
  scriptureCapture: {
    backgroundColor: Colors.anchorBlueLight,
    borderColor: '#D4DDD4',
  },
  responseCapture: {backgroundColor: '#EDF1EC', borderColor: '#D7DED7'},
  questionCapture: {backgroundColor: Colors.cardBackground},
  reflection_questionCapture: {
    backgroundColor: '#E9F0EA',
    borderColor: '#D3DED4',
  },
  revisitCapture: {backgroundColor: '#F4F3ED', borderColor: Colors.cardBorder},
  prayerCapture: {
    backgroundColor: '#E9EEE9',
    borderColor: '#D4DDD5',
  },
  textCapture: {},
  captureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  captureLabelRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  captureLabel: {fontSize: 10, letterSpacing: 1.2, color: Colors.sage},
  captureInput: {
    minHeight: 54,
    paddingTop: 9,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  outlineTitleInput: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    lineHeight: 24,
  },
  scriptureLookupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scriptureLookupInput: {flex: 1, marginTop: 0, paddingHorizontal: 0},
  scripturePreview: {
    marginTop: 8,
    padding: 11,
    borderRadius: 12,
    backgroundColor: Colors.anchorBlueLight,
  },
  scripturePreviewText: {
    fontFamily: Fonts.lora.regular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.text,
  },
  scripturePreviewReferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 7,
  },
  scripturePreviewReference: {
    fontSize: 10,
    color: Colors.sage,
  },
  openLink: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 18,
    backgroundColor: Colors.anchorBlueLight,
  },
  openLinkText: {fontSize: 11, color: Colors.sage},
  tableGrid: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 14,
  },
  editingTableHorizontalScroll: {marginHorizontal: -12},
  savedTableHorizontalScroll: {marginHorizontal: -12},
  tableRow: {flexDirection: 'row'},
  tableCell: {
    width: 126,
    minHeight: 48,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.cardBorder,
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  tableHeaderCell: {
    minHeight: 40,
    backgroundColor: Colors.anchorBlueLight,
    fontFamily: Fonts.bold,
  },
  savedTableGrid: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 9,
    paddingBottom: 3,
  },
  savedTableRow: {
    flexDirection: 'row',
  },
  savedTableCell: {
    width: 126,
    minHeight: 34,
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.text,
  },
  savedTableHeaderCell: {
    backgroundColor: Colors.anchorBlueLight,
  },
  structureActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
    marginTop: 9,
  },
  structureAction: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 17,
    backgroundColor: Colors.cardBackground,
  },
  saveTableButton: {
    alignSelf: 'flex-end',
    marginTop: 11,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: Colors.sage,
  },
  saveTableButtonText: {fontSize: 11, color: Colors.hopeWhite},
  languageKindChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  languageKindChoice: {
    flexGrow: 1,
    flexBasis: '47%',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    backgroundColor: Colors.cardBackground,
  },
  languageKindChoiceActive: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  languageKindText: {fontSize: 10, color: Colors.textGray},
  languageKindTextActive: {color: Colors.hopeWhite},
  historyChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  historyChoice: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    backgroundColor: Colors.cardBackground,
  },
  historyChoiceActive: {backgroundColor: Colors.sage, borderColor: Colors.sage},
  historyChoiceText: {fontSize: 10, color: Colors.textGray},
  historyChoiceTextActive: {color: Colors.hopeWhite},
  historyDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    backgroundColor: Colors.cardBackground,
  },
  historyDetailInput: {flex: 1, minHeight: 42, paddingTop: 0},
  eraChoice: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.anchorBlueLight,
  },
  eraChoiceActive: {backgroundColor: Colors.sage},
  eraChoiceText: {fontSize: 9, color: Colors.sage},
  eraChoiceTextActive: {color: Colors.hopeWhite},
  characterName: {
    minHeight: 38,
    paddingTop: 7,
    fontSize: 16,
    lineHeight: 21,
  },
  characterReflection: {
    minHeight: 46,
    marginTop: 2,
    paddingTop: 5,
    fontSize: 13,
    lineHeight: 19,
  },
  characterScripture: {
    minHeight: 34,
    paddingTop: 4,
    paddingBottom: 2,
  },
  characterNote: {marginTop: 8},
  serifInput: {fontFamily: Fonts.lora.regular, fontSize: 16, lineHeight: 24},
  secondaryInput: {
    paddingTop: 7,
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textGray,
  },
  writeButtonIcon: {marginRight: 1},
  saveStatus: {
    fontSize: 11,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 9,
  },
  summary: {
    backgroundColor: Colors.anchorBlueLight,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontFamily: Fonts.lora.bold,
    fontSize: 20,
    color: Colors.text,
    marginTop: 6,
  },
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11},
  chip: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipText: {fontSize: 10, color: Colors.sage},
  review: {fontSize: 11, color: Colors.sage, marginTop: 15},
  expandableReflection: {
    marginBottom: 10,
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderWidth: 0,
    borderRadius: 16,
    backgroundColor: Colors.anchorBlueLight,
  },
  expandableReflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expandableReflectionInput: {
    minHeight: 88,
    marginTop: 10,
    paddingHorizontal: 0,
    paddingVertical: 4,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  reflectionStep: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    paddingVertical: 20,
  },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.anchorBlueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {fontSize: 11, color: Colors.sage},
  stepTitle: {
    fontFamily: Fonts.lora.bold,
    fontSize: 20,
    lineHeight: 26,
    color: Colors.text,
    marginTop: 5,
  },
  stepDetail: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textGray,
    marginTop: 4,
    marginBottom: 11,
  },
  choices: {flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10},
  choice: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  choiceActive: {backgroundColor: Colors.sage, borderColor: Colors.sage},
  choiceText: {fontSize: 11, color: Colors.textGray},
  choiceTextActive: {color: Colors.hopeWhite},
  finished: {
    backgroundColor: Colors.anchorBlueLight,
    borderRadius: 18,
    padding: 18,
    marginTop: 18,
  },
  finishedTitle: {
    fontFamily: Fonts.lora.bold,
    fontSize: 22,
    color: Colors.text,
    marginTop: 6,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 15,
  },
  sectionLine: {
    width: 4,
    height: 30,
    borderRadius: 2,
    backgroundColor: Colors.sage,
  },
  sectionDividerText: {
    flex: 1,
    fontFamily: Fonts.lora.bold,
    fontSize: 18,
    color: Colors.text,
  },
  outlineStyles: {flexDirection: 'row', gap: 6, marginVertical: 10},
  outlineStyle: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  outlineStyleActive: {backgroundColor: Colors.sage, borderColor: Colors.sage},
  outlineStyleText: {fontSize: 10, color: Colors.textGray},
  outlineStyleTextActive: {color: Colors.hopeWhite},
  outlinePointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    paddingVertical: 8,
  },
  outlineMarker: {
    width: 20,
    fontSize: 11,
    color: Colors.sage,
    textAlign: 'center',
  },
  outlinePointInput: {
    flex: 1,
    minHeight: 38,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.text,
  },
  startSection: {paddingHorizontal: 7, paddingVertical: 7},
  startSectionText: {fontSize: 9, color: Colors.sage},
  addPoint: {paddingTop: 9, alignSelf: 'flex-start'},
  coverHeader: {alignItems: 'center', marginTop: 10, marginBottom: 22},
  coverHeading: {fontSize: 16, color: Colors.text},
  coverWhatTitle: {
    fontFamily: Fonts.lora.bold,
    fontSize: 26,
    lineHeight: 32,
    color: Colors.text,
    marginTop: 6,
  },
  coverSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textGray,
    marginTop: 10,
    marginBottom: 24,
  },
  coverCard: {
    backgroundColor: Colors.anchorBlueLight,
    borderRadius: 22,
    padding: 20,
    marginBottom: 8,
  },
  coverSermonTitle: {
    fontFamily: Fonts.lora.bold,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.text,
    marginTop: 6,
  },
  coverDate: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textGray,
    marginTop: 0,
    marginBottom: 8,
  },
  coverDetail: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textGray,
    marginTop: 4,
  },
  coverStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  coverStatItem: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: Colors.hopeWhite,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  coverStatNumber: {
    fontSize: 22,
    color: Colors.text,
  },
  coverStatLabel: {
    fontSize: 10,
    color: Colors.textGray,
    marginTop: 4,
    textAlign: 'center',
  },
  coverShowMore: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  coverShowMoreText: {
    fontSize: 13,
    color: Colors.sage,
  },
  lineCaptured: {
    fontFamily: Fonts.lora.bold,
    fontSize: 18,
    lineHeight: 26,
    color: Colors.text,
    marginTop: 8,
  },
  coverActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 32,
  },
  startReflectingButton: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reflectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 8,
  },
  reflectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.sage,
    textTransform: 'uppercase',
  },
  reflectionCounter: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 32,
    marginBottom: 8,
    letterSpacing: 0.5,
    textAlign: 'center' as const,
  },
  reflectionProgress: {
    alignSelf: 'center',
    width: 120,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.cardBorder,
    overflow: 'hidden' as const,
    marginBottom: 28,
  },
  reflectionProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.sage,
  },
  reflectionQuestion: {
    fontFamily: Fonts.lora.bold,
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  reflectionPrompt: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: Colors.textGray,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  reflectionInput: {
    fontFamily: Fonts.regular,
    fontSize: 18,
    lineHeight: 26,
    color: Colors.text,
    paddingTop: 8,
    paddingBottom: 16,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  reflectionFab: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.sage,
    borderRadius: 20,
    shadowColor: '#29342E',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 30,
  },

  savedStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    minHeight: 420,
  },
  savedCheckCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  savedEyebrow: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: Colors.sage,
    textTransform: 'uppercase' as const,
    marginBottom: 12,
  },
  savedTitle: {
    fontFamily: Fonts.lora.bold,
    fontSize: 36,
    lineHeight: 44,
    textAlign: 'center' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  savedSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center' as const,
    color: Colors.textGray,
    marginBottom: 40,
    paddingHorizontal: 8,
  },
  savedCard: {
    width: '100%',
    backgroundColor: Colors.hopeWhite,
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
    shadowColor: '#29342E',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  savedCardEyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.sage,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  savedCardTitle: {
    fontFamily: Fonts.lora.bold,
    fontSize: 24,
    lineHeight: 30,
    color: Colors.text,
    marginBottom: 24,
  },
  savedIncludes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedIncludeItem: {
    flex: 1,
    alignItems: 'center',
  },
  savedIncludeCount: {
    fontSize: 22,
    color: Colors.text,
    marginBottom: 4,
  },
  savedIncludeLabel: {
    fontSize: 13,
    color: Colors.textGray,
  },
  savedIncludeDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.cardBorder,
  },
  savedPrimaryButton: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  savedPrimaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  savedSecondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  savedSecondaryButtonText: {
    fontSize: 15,
    color: Colors.textGray,
  },

});

export const SermonNotesStyles = styles;

export default SermonNotesScreen;

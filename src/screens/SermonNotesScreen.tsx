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
  Easing,
  Keyboard,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {Pencil} from 'lucide-react-native';

import {BibleCopyrightModal} from '../components/BibleCopyrightModal';
import ThemedText from '../components/common/ThemedText';
import {useAuth} from '../context/IndustryStandardAuthContext';
import {useScroll} from '../context/ScrollContext';
import {
  useCreateReflection,
  useUpdateReflection,
} from '../services/hooks/useReflectionData';
import {
  getScripturePassage,
  type ScriptureReaderResult,
} from '../services/scriptureReaderService';
import {Colors} from '../theme/colors';
import {Fonts} from '../theme/fonts';
import {toLocalDateString} from '../utils/date';
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
  | 'revisit'
  | 'prayer';
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

const BLOCKS: Record<
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
    label: 'SONG',
    action: '♪ Song',
    placeholder: 'Song title',
    icon: 'musical-note-outline',
  },
  outline: {
    label: 'MESSAGE OUTLINE',
    action: '☷ Outline',
    placeholder: 'Outline title',
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
};

const BlockIcon: React.FC<{
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
  'remember',
  'response',
  'revisit',
  'scripture',
  'song',
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

const SermonNotesScreen = ({navigation}: any) => {
  const {width: screenWidth} = useWindowDimensions();
  const {user} = useAuth();
  const bibleVersion =
    (user as any)?.user_metadata?.preferences?.content?.bibleVersion || 'NASB';
  const createReflection = useCreateReflection();
  const updateReflection = useUpdateReflection();
  const {
    setShowTabBar,
    setSuppressTabBar,
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
  const blockInputRefs = useRef(new Map<string, TextInput>());
  const pendingFocusBlockIdRef = useRef<string | null>(null);
  const focusScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const keepAtEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepScrollAtEndRef = useRef(false);
  const keyboardVisibleRef = useRef(false);
  const composerBottom = useRef(
    new Animated.Value(restingComposerBottom),
  ).current;
  const pillAnimations = useRef(
    CAPTURE_KINDS.map(() => new Animated.Value(0)),
  ).current;
  const plusRotation = useRef(new Animated.Value(0)).current;
  const pickerColorAnim = useRef(new Animated.Value(0)).current;
  const actionBarAnim = useRef(new Animated.Value(0)).current;
  const actionButtonAnims = useRef(
    [0, 1, 2, 3].map(() => new Animated.Value(0)),
  ).current;
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [showDetails, setShowDetails] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [saved, setSaved] = useState(false);
  const [savedReflectionId, setSavedReflectionId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [mainScripture, setMainScripture] = useState('');
  const [series, setSeries] = useState('');
  const [part, setPart] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [church, setChurch] = useState('');
  const [blocks, setBlocks] = useState<NoteBlock[]>([]);
  const [notice, setNotice] = useState('');
  const [carry, setCarry] = useState('');
  const [prayer, setPrayer] = useState('');
  const [expandedReflection, setExpandedReflection] = useState<
    'god' | 'truth' | 'response' | null
  >(null);

  useFocusEffect(
    useCallback(() => {
      setSuppressTabBar(true);
      setShowTabBar(true);
      setCollapsedTabBarCenterY(null);

      return () => {
        setSuppressTabBar(false);
      };
    }, [setShowTabBar, setSuppressTabBar, setCollapsedTabBarCenterY]),
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

  const goTo = (next: 1 | 2 | 3) => {
    triggerLightHaptic();
    setStage(next);
    scrollRef.current?.scrollTo({y: 0, animated: true});
  };

  const openCapturePicker = (dismissKeyboard = true) => {
    if (dismissKeyboard) {
      Keyboard.dismiss();
    }
    pillAnimations.forEach(animation => {
      animation.stopAnimation();
      animation.setValue(0);
    });
    setShowMore(true);
    requestAnimationFrame(() => {
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
    });
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

  const removeBlock = (
    id: string,
    withHaptic = true,
    reopenPicker = true,
  ) => {
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
    if (reopenPicker && remainingBlocks.length === 0) {
      requestAnimationFrame(() => {
        openCapturePicker();
      });
    } else if (shouldKeepKeyboard && remainingEditableBlock) {
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
        .map(([kind, config]) => ({
          kind,
          label: config.label,
          count: blocks.filter(
            block => block.kind === kind && hasBlockContent(block),
          ).length,
        }))
        .filter(item => item.count > 0),
    [blocks],
  );

  const saveSermon = async (markComplete = true): Promise<boolean> => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to save sermon notes.');
      return false;
    }
    const meaningfulBlocks = blocks.filter(hasBlockContent);
    if (!title.trim() && meaningfulBlocks.length === 0) {
      Alert.alert('Nothing to save', 'Add a sermon title or a note first.');
      return false;
    }
    try {
      const entry = {
        user_id: user.id,
        selected_date: toLocalDateString(new Date()),
        title: title.trim() || 'Sermon Notes',
        type: 'free',
        source: 'sermon_notes',
        tags: ['sermon'],
        content: JSON.stringify({
          format: 'sermon_notes_v1',
          mainScripture,
          series,
          part,
          speaker,
          church,
          blocks: meaningfulBlocks,
          reflection: {god: notice, truth: carry, response: prayer},
        }),
      };
      if (savedReflectionId) {
        await updateReflection.mutateAsync({
          id: savedReflectionId,
          updates: entry,
        });
      } else {
        const created = await createReflection.mutateAsync(entry);
        setSavedReflectionId(created.id);
      }
      if (markComplete) {
        setSaved(true);
      }
      return true;
    } catch {
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
    return (
      <View
        key={block.id}
        style={[
          styles.capture,
          styles[`${block.kind}Capture` as keyof typeof styles] as any,
        ]}>
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
            keyboardType={block.kind === 'link' ? 'url' : 'default'}
            autoCapitalize={block.kind === 'link' ? 'none' : 'sentences'}
            autoCorrect={block.kind !== 'link'}
          />
        ) : null}
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
        {(block.kind === 'quote' || block.kind === 'song') && (
          <TextInput
            style={styles.secondaryInput}
            placeholder={
              block.kind === 'song'
                ? 'Artist / Worship Team'
                : '— Speaker / Author'
            }
            placeholderTextColor={Colors.textGray}
            value={block.secondary || ''}
            onChangeText={value =>
              updateBlock(
                block.id,
                'secondary',
                block.kind === 'quote' && value && !value.startsWith('—')
                  ? `— ${value}`
                  : value,
              )
            }
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
              />
            )}
            {selectedLanguageDetails.includes('transliteration') && (
              <TextInput
                style={styles.secondaryInput}
                placeholder="Transliteration / pronunciation"
                placeholderTextColor={Colors.textGray}
                value={block.secondary || ''}
                onChangeText={value => updateBlock(block.id, 'secondary', value)}
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
            />
            <ScriptureLookupInput
              value={block.reference || ''}
              placeholder="Search related Scripture"
              version={bibleVersion}
              style={styles.secondaryInput}
              onChange={value => updateBlock(block.id, 'reference', value)}
              onResolved={result => updateBlockScripture(block.id, result)}
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
      <TouchableOpacity
        style={[styles.closeButton, {top: insets.top + 8}]}
        onPress={() => {
          triggerLightHaptic();
          navigation.goBack();
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Close sermon notes">
        <Ionicons name="close" size={20} color={Colors.text} />
      </TouchableOpacity>
      <ScrollView
        ref={scrollRef}
        style={{flex: 1}}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 72,
            paddingBottom: insets.bottom + 28,
          },
          stage === 2 && {
            paddingBottom: blocks.length
              ? 48 +
                (keyboardHeight > 0
                  ? keyboardHeight + 12
                  : restingComposerBottom) +
                8
              : insets.bottom + 28,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (keepScrollAtEndRef.current) {
            scrollRef.current?.scrollToEnd({animated: true});
          }
        }}>
        <View style={styles.header}>
          <View style={styles.stepLabelRow}>
            <Ionicons name="book" size={18} color={Colors.sage} />
            <ThemedText weight="semiBold" style={styles.headerTitle}>
              Sermon Notes
            </ThemedText>
          </View>
        </View>
        {stage === 1 && (
          <>
            <ThemedText weight="bold" style={styles.label}>
              Sermon title
            </ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Title of the message"
              placeholderTextColor={Colors.textGray}
              value={title}
              onChangeText={setTitle}
            />
            <TouchableOpacity
              style={styles.toggle}
              onPress={() => setShowDetails(value => !value)}>
              <ThemedText weight="bold" style={styles.toggleText}>
                {showDetails ? '− Hide details' : '＋ Add details'}
              </ThemedText>
            </TouchableOpacity>
            {showDetails && (
              <View>
                <ThemedText weight="bold" style={styles.label}>
                  Main Scripture
                </ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Romans 12:1–2"
                  placeholderTextColor={Colors.textGray}
                  value={mainScripture}
                  onChangeText={setMainScripture}
                />
                <ThemedText weight="bold" style={styles.label}>
                  Series{' '}
                  <ThemedText style={styles.optional}>Optional</ThemedText>
                </ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="The Book of Romans"
                  placeholderTextColor={Colors.textGray}
                  value={series}
                  onChangeText={setSeries}
                />
                <View style={styles.grid}>
                  <View style={styles.flex}>
                    <ThemedText weight="bold" style={styles.label}>
                      Part
                    </ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="Part 3"
                      placeholderTextColor={Colors.textGray}
                      value={part}
                      onChangeText={setPart}
                    />
                  </View>
                  <View style={styles.flex}>
                    <ThemedText weight="bold" style={styles.label}>
                      Pastor
                    </ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="Pastor name"
                      placeholderTextColor={Colors.textGray}
                      value={speaker}
                      onChangeText={setSpeaker}
                    />
                  </View>
                </View>
                <ThemedText weight="bold" style={styles.label}>
                  Church / Event
                </ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Where you heard it"
                  placeholderTextColor={Colors.textGray}
                  value={church}
                  onChangeText={setChurch}
                />
              </View>
            )}
            <TouchableOpacity
              style={styles.primary}
              onPress={() => {
                goTo(2);
                requestAnimationFrame(() => openCapturePicker());
              }}>
              <ThemedText weight="bold" style={styles.primaryText}>
                Start taking notes
              </ThemedText>
            </TouchableOpacity>
          </>
        )}

        {stage === 2 && (
          <>
            <View style={styles.editor}>
              {blocks.map(renderBlock)}
            </View>
          </>
        )}

        {stage === 3 && (
          <>
            <View style={styles.summary}>
              <ThemedText weight="bold" style={styles.eyebrow}>
                FROM YOUR NOTES
              </ThemedText>
              <ThemedText weight="bold" style={styles.summaryTitle}>
                What did you capture?
              </ThemedText>
              <View style={styles.chips}>
                {summary.length ? (
                  summary.map(item => (
                    <View key={item.kind} style={styles.chip}>
                      <ThemedText weight="bold" style={styles.chipText}>
                        {item.count} {item.label}
                      </ThemedText>
                    </View>
                  ))
                ) : (
                  <View style={styles.chip}>
                    <ThemedText weight="bold" style={styles.chipText}>
                      Your sermon notes
                    </ThemedText>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => goTo(2)}>
                <ThemedText weight="bold" style={styles.review}>
                  Review my notes →
                </ThemedText>
              </TouchableOpacity>
            </View>
            <ExpandableReflection
              eyebrow="GOD"
              title="What does this show you about God?"
              value={notice}
              onChange={setNotice}
              expanded={expandedReflection === 'god'}
              onExpand={() =>
                setExpandedReflection(current =>
                  current === 'god' ? null : 'god',
                )
              }
            />
            <ExpandableReflection
              eyebrow="TRUTH"
              title="What is He teaching you?"
              value={carry}
              onChange={setCarry}
              expanded={expandedReflection === 'truth'}
              onExpand={() =>
                setExpandedReflection(current =>
                  current === 'truth' ? null : 'truth',
                )
              }
            />
            <ExpandableReflection
              eyebrow="RESPONSE"
              title="How will you respond?"
              value={prayer}
              onChange={setPrayer}
              expanded={expandedReflection === 'response'}
              onExpand={() =>
                setExpandedReflection(current =>
                  current === 'response' ? null : 'response',
                )
              }
            />
            {!saved ? (
              <>
                <TouchableOpacity
                  style={styles.primary}
                  disabled={
                    createReflection.isPending || updateReflection.isPending
                  }
                  onPress={() => saveSermon()}>
                  <ThemedText weight="bold" style={styles.primaryText}>
                    {createReflection.isPending
                      ? 'Saving…'
                      : 'Remember this sermon'}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quiet}
                  onPress={() => saveSermon()}>
                  <ThemedText weight="bold" style={styles.quietText}>
                    Save notes without reflection
                  </ThemedText>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.finished}>
                <ThemedText weight="bold" style={styles.eyebrow}>
                  SERMON REMEMBERED
                </ThemedText>
                <ThemedText weight="bold" style={styles.finishedTitle}>
                  {title.trim() || 'This sermon'}
                </ThemedText>
                <ThemedText style={styles.stepDetail}>
                  Your notes, Scriptures, Bible characters, key points, quotes,
                  questions, revisits, responses, and prayers are saved together
                  in the order you captured them.
                </ThemedText>
                <TouchableOpacity
                  style={styles.primary}
                  onPress={() => navigation.goBack()}>
                  <ThemedText weight="bold" style={styles.primaryText}>
                    Done
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
                disabled={
                  createReflection.isPending || updateReflection.isPending
                }
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
    </SafeAreaView>
  );
};

const ExpandableReflection = ({
  eyebrow,
  title,
  value,
  onChange,
  expanded,
  onExpand,
}: any) => {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (expanded) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [expanded]);

  return (
    <View style={styles.expandableReflection}>
      <TouchableOpacity
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{expanded}}
        onPress={onExpand}
        style={styles.expandableReflectionHeader}>
        <View style={styles.flex}>
          <ThemedText weight="bold" style={styles.eyebrow}>
            {eyebrow}
          </ThemedText>
          <ThemedText weight="bold" style={styles.stepTitle}>
            {title}
          </ThemedText>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.sage}
        />
      </TouchableOpacity>
      {expanded && (
        <TextInput
          ref={inputRef}
          style={styles.expandableReflectionInput}
          multiline
          value={value}
          onChangeText={onChange}
        />
      )}
    </View>
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
  label: {fontSize: 12, color: Colors.text, marginTop: 14, marginBottom: 7},
  optional: {fontSize: 11, color: Colors.textGray},
  input: {
    minHeight: 46,
    borderWidth: 0,
    backgroundColor: Colors.cardBackground,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.text,
  },
  textarea: {minHeight: 90, textAlignVertical: 'top'},
  toggle: {paddingVertical: 15, alignSelf: 'flex-start'},
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
  floatingComposer: {
    position: 'absolute',
    left: 18,
    right: 18,
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
  editor: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 12,
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
});

export default SermonNotesScreen;

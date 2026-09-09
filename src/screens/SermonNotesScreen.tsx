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
  Keyboard,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {Pencil} from 'lucide-react-native';

import ThemedText from '../components/common/ThemedText';
import {useAuth} from '../context/IndustryStandardAuthContext';
import {useScroll} from '../context/ScrollContext';
import {PILL_HEIGHT} from '../navigation/BottomTabNavigator';
import {useCreateReflection} from '../services/hooks/useReflectionData';
import {
  getScripturePassage,
  type ScriptureReaderResult,
} from '../services/scriptureReaderService';
import {Colors} from '../theme/colors';
import {Fonts} from '../theme/fonts';
import {toLocalDateString} from '../utils/date';
import {triggerLightHaptic} from '../utils/haptics';

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
  | 'history'
  | 'remember'
  | 'response'
  | 'question'
  | 'revisit'
  | 'prayer';
type OutlineStyle = 'numbered' | 'acronym' | 'simple';
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
    placeholder: 'Outline title, 3 Calls to Courage',
    icon: 'list-outline',
  },
  character: {
    label: 'BIBLE CHARACTER',
    action: '♙ Bible Character',
    placeholder: 'Name, Joseph',
    icon: 'person-outline',
  },
  language: {
    label: 'LANGUAGE NOTE',
    action: 'א Language Note',
    placeholder: 'Original Hebrew or Greek word',
    icon: 'translate',
    iconFamily: 'MaterialCommunityIcons',
  },
  history: {
    label: 'HISTORICAL CONTEXT',
    action: '⌛ Historical Context',
    placeholder: 'Place, custom, event, or setting',
    icon: 'hourglass-outline',
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
    icon: 'help-outline',
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
  'outline',
  'prayer',
  'question',
  'quote',
  'remember',
  'response',
  'revisit',
  'scripture',
  'song',
] as const;

const newBlock = (kind: BlockKind): NoteBlock => ({
  id: `${Date.now()}-${Math.random()}`,
  kind,
  text: '',
  ...(kind === 'outline'
    ? {outlineStyle: 'numbered' as const, points: ['', '', '']}
    : {}),
});

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
          <ThemedText weight="bold" style={styles.scripturePreviewReference}>
            {resolvedVerse.reference} · {resolvedVerse.version}
          </ThemedText>
        </View>
      )}
    </>
  );
};

const SermonNotesScreen = ({navigation}: any) => {
  const {user} = useAuth();
  const bibleVersion =
    (user as any)?.user_metadata?.preferences?.content?.bibleVersion || 'NASB';
  const createReflection = useCreateReflection();
  const {showTabBar, setShowTabBar, collapsedTabBarCenterY, setCollapsedTabBarCenterY} =
    useScroll();
  const insets = useSafeAreaInsets();
  const screenRef = useRef<View>(null);
  const [screenBottomY, setScreenBottomY] = useState<number | null>(null);
  const restingComposerBottom =
    collapsedTabBarCenterY !== null && screenBottomY !== null
      ? Math.max(0, screenBottomY - collapsedTabBarCenterY - 28)
      : Math.max(insets.bottom, 8) + (showTabBar ? PILL_HEIGHT : 0);
  const scrollRef = useRef<ScrollView>(null);
  const blockInputRefs = useRef(new Map<string, TextInput>());
  const pendingFocusBlockIdRef = useRef<string | null>(null);
  const focusScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const keepAtEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepScrollAtEndRef = useRef(false);
  const composerBottom = useRef(
    new Animated.Value(restingComposerBottom),
  ).current;
  const pillAnimations = useRef(
    CAPTURE_KINDS.map(() => new Animated.Value(0)),
  ).current;
  const plusRotation = useRef(new Animated.Value(0)).current;
  const actionBarAnim = useRef(new Animated.Value(0)).current;
  const actionButtonAnims = useRef(
    [0, 1, 2, 3].map(() => new Animated.Value(0)),
  ).current;
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [composerHeight, setComposerHeight] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState('');
  const [mainScripture, setMainScripture] = useState('');
  const [series, setSeries] = useState('');
  const [part, setPart] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [church, setChurch] = useState('');
  const [blocks, setBlocks] = useState<NoteBlock[]>([]);
  const [notice, setNotice] = useState('');
  const [carryType, setCarryType] = useState('');
  const [carry, setCarry] = useState('');
  const [prayer, setPrayer] = useState('');

  useFocusEffect(
    useCallback(() => {
      setShowTabBar(true);
      setCollapsedTabBarCenterY(null);
    }, [setShowTabBar, setCollapsedTabBarCenterY]),
  );

  useEffect(() => {
    if (stage !== 2 || showTabBar) {
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
  }, [actionBarAnim, actionButtonAnims, showTabBar, stage]);

  useEffect(() => {
    if (keyboardHeight === 0) {
      Animated.timing(composerBottom, {
        toValue: restingComposerBottom,
        duration: 160,
        useNativeDriver: false,
      }).start();
    }
  }, [composerBottom, keyboardHeight, restingComposerBottom]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', event => {
      const height = event.endCoordinates.height;
      setKeyboardHeight(height);
      Animated.timing(composerBottom, {
        toValue: height + 12,
        duration: 180,
        useNativeDriver: false,
      }).start();
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      Animated.timing(composerBottom, {
        toValue: restingComposerBottom,
        duration: 180,
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

  const openCapturePicker = () => {
    pillAnimations.forEach(animation => {
      animation.stopAnimation();
      animation.setValue(0);
    });
    setShowMore(true);
    requestAnimationFrame(() => {
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
      ).start();
    });
  };

  const closeCapturePicker = (onComplete?: () => void) => {
    pillAnimations.forEach(animation => animation.stopAnimation());
    Animated.stagger(
      28,
      [...pillAnimations].reverse().map(animation =>
        Animated.timing(animation, {
          toValue: 0,
          duration: 130,
          useNativeDriver: true,
        }),
      ),
    ).start(() => {
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
    closeCapturePicker(() => addBlock(kind));
  };

  const updateBlock = (
    id: string,
    field: 'text' | 'secondary' | 'note' | 'reference',
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

  const summary = useMemo(
    () =>
      Object.entries(BLOCKS)
        .map(([kind, config]) => ({
          kind,
          label: config.label,
          count: blocks.filter(
            block => block.kind === kind && block.text.trim(),
          ).length,
        }))
        .filter(item => item.count > 0),
    [blocks],
  );

  const saveSermon = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to save sermon notes.');
      return;
    }
    const meaningfulBlocks = blocks.filter(
      block =>
        block.text.trim() ||
        block.secondary?.trim() ||
        block.note?.trim() ||
        block.reference?.trim() ||
        block.points?.some(point => point.trim()),
    );
    if (!title.trim() && meaningfulBlocks.length === 0) {
      Alert.alert('Nothing to save', 'Add a sermon title or a note first.');
      return;
    }
    try {
      await createReflection.mutateAsync({
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
          reflection: {notice, carryType, carry, prayer},
        }),
      });
      setSaved(true);
    } catch {
      Alert.alert(
        'Could not save',
        'Your sermon notes could not be saved. Please try again.',
      );
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
          onChangeText={value => updateBlock(block.id, 'text', value)}
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
            onPress={() =>
              setBlocks(current => current.filter(item => item.id !== block.id))
            }>
            <Ionicons name="close" size={15} color={Colors.textGray} />
          </TouchableOpacity>
        </View>
      );
    }
    const config = BLOCKS[block.kind];
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
          <TouchableOpacity
            onPress={() =>
              setBlocks(current => current.filter(item => item.id !== block.id))
            }
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Ionicons name="close" size={17} color={Colors.textGray} />
          </TouchableOpacity>
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
        ) : (
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
            ]}
            multiline={block.kind !== 'outline'}
            placeholder={config.placeholder}
            placeholderTextColor={Colors.textGray}
            value={block.text}
            onChangeText={value => updateBlock(block.id, 'text', value)}
          />
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
                    ? `${point.trim().charAt(0).toUpperCase() || '•'}.`
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
                ? 'Artist / worship team (optional)'
                : '— Speaker (optional)'
            }
            placeholderTextColor={Colors.textGray}
            value={block.secondary || ''}
            onChangeText={value => updateBlock(block.id, 'secondary', value)}
          />
        )}
        {block.kind === 'character' && (
          <ScriptureLookupInput
            value={block.secondary || ''}
            placeholder="Search related Scripture (optional)"
            version={bibleVersion}
            style={styles.secondaryInput}
            onChange={value => updateBlock(block.id, 'secondary', value)}
            onResolved={result => updateBlockScripture(block.id, result)}
          />
        )}
        {block.kind === 'character' && (
          <TextInput
            style={[styles.captureInput, styles.characterNote]}
            multiline
            placeholder="What stood out about this person?"
            placeholderTextColor={Colors.textGray}
            value={block.note || ''}
            onChangeText={value => updateBlock(block.id, 'note', value)}
          />
        )}
        {block.kind === 'language' && (
          <>
            <TextInput
              style={styles.secondaryInput}
              placeholder="Transliteration / pronunciation"
              placeholderTextColor={Colors.textGray}
              value={block.secondary || ''}
              onChangeText={value => updateBlock(block.id, 'secondary', value)}
            />
            <TextInput
              style={[styles.captureInput, styles.characterNote]}
              multiline
              placeholder="Meaning, word origin, and why it matters here"
              placeholderTextColor={Colors.textGray}
              value={block.note || ''}
              onChangeText={value => updateBlock(block.id, 'note', value)}
            />
            <ScriptureLookupInput
              value={block.reference || ''}
              placeholder="Search related Scripture (optional)"
              version={bibleVersion}
              style={styles.secondaryInput}
              onChange={value => updateBlock(block.id, 'reference', value)}
              onResolved={result => updateBlockScripture(block.id, result)}
            />
          </>
        )}
        {block.kind === 'history' && (
          <>
            <TextInput
              style={styles.secondaryInput}
              placeholder="Time / place (optional)"
              placeholderTextColor={Colors.textGray}
              value={block.secondary || ''}
              onChangeText={value => updateBlock(block.id, 'secondary', value)}
            />
            <TextInput
              style={[styles.captureInput, styles.characterNote]}
              multiline
              placeholder="Cultural background, geography, customs, or political setting"
              placeholderTextColor={Colors.textGray}
              value={block.note || ''}
              onChangeText={value => updateBlock(block.id, 'note', value)}
            />
            <ScriptureLookupInput
              value={block.reference || ''}
              placeholder="Search related Scripture (optional)"
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
      onLayout={() => {
        screenRef.current?.measureInWindow(
          (_x, y, _width, height) => setScreenBottomY(y + height),
        );
      }}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={Colors.lightBackground}
      />
      <View style={styles.header}>
        <View style={styles.actionProgressBar}>
          <View
            style={[
              styles.actionProgressFill,
              {width: `${(stage / 3) * 100}%`},
            ]}
          />
        </View>
        <View style={styles.stepLabelRow}>
          <Ionicons name="book" size={18} color={Colors.sage} />
          <ThemedText weight="semiBold" style={styles.headerTitle}>
            Sermon Notes
          </ThemedText>
        </View>
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
        contentContainerStyle={[
          styles.content,
          stage === 2 && {
            paddingBottom:
              composerHeight +
              (keyboardHeight > 0
                ? keyboardHeight + 12
                : restingComposerBottom) +
              8,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (keepScrollAtEndRef.current) {
            scrollRef.current?.scrollToEnd({animated: true});
          }
        }}>
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
                      Speaker
                    </ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="Pastor / speaker"
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
            <TouchableOpacity style={styles.primary} onPress={() => goTo(2)}>
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
            <ReflectionStep
              number="1"
              eyebrow="NOTICE"
              title="What stayed with you?"
              detail="Name the truth, Scripture, phrase, or conviction you don’t want to lose."
              value={notice}
              onChange={setNotice}
              placeholder="What stayed with me…"
            />
            <View style={styles.reflectionStep}>
              <View style={styles.number}>
                <ThemedText weight="bold" style={styles.numberText}>
                  2
                </ThemedText>
              </View>
              <View style={styles.flex}>
                <ThemedText weight="bold" style={styles.eyebrow}>
                  CARRY
                </ThemedText>
                <ThemedText weight="bold" style={styles.stepTitle}>
                  Is there something to carry forward?
                </ThemedText>
                <ThemedText style={styles.stepDetail}>
                  It can be an action, something to remember, a question, or
                  simply something to sit with.
                </ThemedText>
                <View style={styles.choices}>
                  {['Respond', 'Remember', 'Revisit', 'Sit with it'].map(
                    choice => (
                      <TouchableOpacity
                        key={choice}
                        style={[
                          styles.choice,
                          carryType === choice && styles.choiceActive,
                        ]}
                        onPress={() => setCarryType(choice)}>
                        <ThemedText
                          style={[
                            styles.choiceText,
                            carryType === choice && styles.choiceTextActive,
                          ]}>
                          {choice}
                        </ThemedText>
                      </TouchableOpacity>
                    ),
                  )}
                </View>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  multiline
                  placeholder="What I want to carry forward…"
                  placeholderTextColor={Colors.textGray}
                  value={carry}
                  onChangeText={setCarry}
                />
              </View>
            </View>
            <ReflectionStep
              number="3"
              eyebrow="PRAY"
              title="Bring what you heard to God."
              detail="Respond in your own words."
              value={prayer}
              onChange={setPrayer}
              placeholder="Lord…"
            />
            {!saved ? (
              <>
                <TouchableOpacity
                  style={styles.primary}
                  disabled={createReflection.isPending}
                  onPress={saveSermon}>
                  <ThemedText weight="bold" style={styles.primaryText}>
                    {createReflection.isPending
                      ? 'Saving…'
                      : 'Remember this sermon'}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quiet} onPress={saveSermon}>
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
          style={[styles.floatingComposer, {bottom: composerBottom}]}
          onLayout={event =>
            setComposerHeight(event.nativeEvent.layout.height)
          }>
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
                    <BlockIcon
                      config={BLOCKS[kind]}
                      size={14}
                      color={Colors.sage}
                    />
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
                onPress={() => goTo(1)}>
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
                onPress={() => addBlock('text')}>
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
              <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                showMore ? 'Close note type picker' : 'Choose a note type'
              }
              style={[
                styles.capturePickerButton,
                showMore && styles.capturePickerButtonOpen,
              ]}
              onPress={() => {
                triggerLightHaptic();
                Animated.timing(plusRotation, {
                  toValue: showMore ? 0 : 1,
                  duration: 180,
                  useNativeDriver: true,
                }).start();
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
              </TouchableOpacity>
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
                onPress={() => goTo(3)}>
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

const ReflectionStep = ({
  number,
  eyebrow,
  title,
  detail,
  value,
  onChange,
  placeholder,
}: any) => (
  <View style={styles.reflectionStep}>
    <View style={styles.number}>
      <ThemedText weight="bold" style={styles.numberText}>
        {number}
      </ThemedText>
    </View>
    <View style={styles.flex}>
      <ThemedText weight="bold" style={styles.eyebrow}>
        {eyebrow}
      </ThemedText>
      <ThemedText weight="bold" style={styles.stepTitle}>
        {title}
      </ThemedText>
      <ThemedText style={styles.stepDetail}>{detail}</ThemedText>
      <TextInput
        style={[styles.input, styles.textarea]}
        multiline
        placeholder={placeholder}
        placeholderTextColor={Colors.textGray}
        value={value}
        onChangeText={onChange}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: Colors.lightBackground},
  header: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 0,
    paddingHorizontal: 18,
  },
  closeButton: {
    position: 'absolute',
    right: 18,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 21,
  },
  stepLabelRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 48},
  headerTitle: {
    fontSize: 16,
    letterSpacing: 1,
    color: Colors.text,
  },
  content: {paddingHorizontal: 22, paddingBottom: 0},
  actionProgressBar: {
    height: 6,
    width: 120,
    backgroundColor: Colors.cardBorder,
    borderRadius: 3,
    marginBottom: 24,
    overflow: 'hidden' as const,
    alignSelf: 'center' as const,
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
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
    left: 80,
    right: 16,
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
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 17,
    backgroundColor: Colors.anchorBlueLight,
  },
  floatingToolLast: {},
  floatingToolText: {
    fontSize: 10,
    letterSpacing: 0.7,
    color: Colors.sage,
  },
  floatingActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatingCircleAnimationWrapper: {width: 56, height: 56},
  floatingWriteAnimationWrapper: {flex: 1, height: 56},
  floatingBackButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 28,
    backgroundColor: Colors.cardBackground,
    shadowColor: Colors.text,
    shadowOpacity: 0.1,
    shadowRadius: 9,
    shadowOffset: {width: 0, height: 4},
    elevation: 5,
  },
  journalButton: {
    width: '100%',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 28,
    backgroundColor: Colors.sage,
    shadowColor: Colors.text,
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  journalButtonText: {fontSize: 13, color: Colors.hopeWhite},
  capturePickerButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: Colors.sage,
    shadowColor: Colors.text,
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  capturePickerButtonOpen: {backgroundColor: Colors.text},
  finishNotesButton: {
    width: 56,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
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
  keyCapture: {borderLeftWidth: 3, borderLeftColor: Colors.sage},
  quoteCapture: {backgroundColor: Colors.lightBackground},
  songCapture: {backgroundColor: '#F7F3EB'},
  characterCapture: {backgroundColor: '#F4F2EA', borderColor: '#E3DED0'},
  rememberCapture: {
    backgroundColor: Colors.anchorBlueLight,
    borderColor: Colors.anchorBlueLight,
  },
  scriptureCapture: {
    backgroundColor: Colors.anchorBlueLight,
    borderColor: Colors.anchorBlueLight,
  },
  responseCapture: {backgroundColor: '#F7F3EB'},
  questionCapture: {backgroundColor: '#F4F5F1'},
  revisitCapture: {backgroundColor: Colors.lightBackground},
  prayerCapture: {
    backgroundColor: Colors.anchorBlueLight,
    borderColor: Colors.anchorBlueLight,
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
  scripturePreviewReference: {
    marginTop: 7,
    fontSize: 10,
    color: Colors.sage,
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

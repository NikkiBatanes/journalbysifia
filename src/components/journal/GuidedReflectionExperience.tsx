import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {BookHeart} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFloatingKeyboardButton} from '../../hooks/useFloatingKeyboardButton';
import ScriptureReaderModal from '../ScriptureReaderModal';
import ThemedText from '../common/ThemedText';
import {ReflectionQuestionCard} from './shared/ReflectionQuestionCard';
import {JournalComposerBar, JournalPickerMenu} from './shared/JournalComposer';
import {JournalInlineBlock} from './shared/JournalInlineBlock';
import {JOURNAL_BLOCKS, type JournalBlockConfig} from './shared/journalBlocks';
import {Colors} from '../../theme/colors';
import {Fonts} from '../../theme/fonts';
import {triggerLightHaptic, triggerMediumHaptic} from '../../utils/haptics';
import {
  GUIDED_REFLECTION_PATHS,
  getGuidedReflectionPath,
} from '../../data/guidedReflectionPaths';
import {
  GUIDED_QUESTION_TOPICS,
  questionsForTopic,
  type GuidedQuestionTopic,
} from '../../data/guidedReflectionQuestions';
import {
  clearGuidedReflectionDraft,
  loadGuidedReflectionDraft,
  saveGuidedReflectionDraft,
} from '../../storage/guidedReflectionDraftStorage';
import {
  GUIDED_NOTE_TYPES,
  GUIDED_REFLECTION_FORMAT,
  createGuidedNoteId,
  emptyGuidedAnswer,
  parseGuidedReflection,
  serializeGuidedReflection,
  type GuidedReflectionNote,
  type GuidedReflectionPayload,
  type GuidedReflectionStepDefinition,
  type GuidedStepAnswer,
} from '../../types/guidedReflection';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface Props {
  selectedDate: string;
  existingContent?: unknown;
  existingPathId?: string;
  isSaving?: boolean;
  onCancel: () => void;
  onCloseJourney?: () => void;
  onSelectQuestion: (prompt: string) => void;
  onSave: (entry: {
    title: string;
    content: string;
    type: 'guided';
    source: 'guided';
    prompt: string;
    guidedJourney: GuidedReflectionPayload;
  }) => Promise<boolean | void> | boolean | void;
}

const answerHasValue = (answer: GuidedStepAnswer) =>
  Boolean(
    answer.text?.trim() ||
      answer.optionalText?.trim() ||
      answer.selected?.length ||
      Object.values(answer.fields || {}).some(Boolean) ||
      answer.notes.length,
  );

const GuidedReflectionExperience: React.FC<Props> = ({
  selectedDate,
  existingContent,
  existingPathId,
  isSaving,
  onCancel,
  onCloseJourney,
  onSelectQuestion,
  onSave,
}) => {
  const insets = useSafeAreaInsets();
  const {bottom: composerBottom} = useFloatingKeyboardButton(insets.bottom);
  const restored = useMemo(
    () => parseGuidedReflection(existingContent),
    [existingContent],
  );
  const [pathId, setPathId] = useState(
    existingPathId || restored?.pathId || '',
  );
  const path = useMemo(() => getGuidedReflectionPath(pathId), [pathId]);
  const [payload, setPayload] = useState<GuidedReflectionPayload | null>(
    restored,
  );
  const [stepIndex, setStepIndex] = useState(() =>
    restored && path
      ? Math.max(
          0,
          path.steps.findIndex(step => step.id === restored.currentStepId),
        )
      : 0,
  );
  const [topic, setTopic] = useState<GuidedQuestionTopic>('With God');
  const [topicTransitioning, setTopicTransitioning] = useState(false);
  const [chooserSection, setChooserSection] = useState<'guided' | 'questions'>('guided');
  const [chooserTransitioning, setChooserTransitioning] = useState(false);
  const [journeyTransitioning, setJourneyTransitioning] = useState(false);
  const chooserPageAnim = useRef(new Animated.Value(0)).current;
  const guideRevealAnims = useRef(
    GUIDED_REFLECTION_PATHS.map(() => new Animated.Value(0)),
  ).current;
  const questionRevealAnims = useRef(
    Array.from(
      {length: 1 + Math.max(...GUIDED_QUESTION_TOPICS.map(item => questionsForTopic(item).length))},
      () => new Animated.Value(0),
    ),
  ).current;
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const notePickerAnimations = useRef(
    GUIDED_NOTE_TYPES.map(() => new Animated.Value(0)),
  ).current;
  const notePlusRotation = useRef(new Animated.Value(0)).current;
  const notePickerColorAnim = useRef(new Animated.Value(0)).current;
  const composerEntrance = useRef(new Animated.Value(0)).current;
  const journeyHeaderActionEntrance = useRef(new Animated.Value(0)).current;
  const journeyContentEntrance = useRef(new Animated.Value(0)).current;
  const composerActionAnimations = useRef(
    [0, 1, 2, 3].map(() => new Animated.Value(0)),
  ).current;
  const [noteKind, setNoteKind] = useState<
    (typeof GUIDED_NOTE_TYPES)[number]['kind'] | null
  >(null);
  const [noteText, setNoteText] = useState('');
  const [noteReference, setNoteReference] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [scriptureOpen, setScriptureOpen] = useState(false);
  const [showSavedView, setShowSavedView] = useState(Boolean(restored));
  const primaryInputRef = useRef<TextInput>(null);
  const journeyScrollRef = useRef<ScrollView>(null);
  const noteInputRefs = useRef(new Map<string, TextInput>());
  const noteFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteFocusRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteFocusFrameRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (noteFocusFrameRef.current !== null) cancelAnimationFrame(noteFocusFrameRef.current);
    if (noteFocusTimerRef.current) clearTimeout(noteFocusTimerRef.current);
    if (noteFocusRetryTimerRef.current) clearTimeout(noteFocusRetryTimerRef.current);
  }, []);
  const chooserAnimations = (section: 'guided' | 'questions') =>
    section === 'guided'
      ? guideRevealAnims
      : questionRevealAnims.slice(0, questionsForTopic(topic).length + 1);
  useEffect(() => {
    if (!path) {
      composerEntrance.setValue(0);
      composerActionAnimations.forEach(animation => animation.setValue(0));
      return;
    }
    composerEntrance.setValue(0);
    composerActionAnimations.forEach(animation => animation.setValue(0));
    Animated.spring(composerEntrance, {
      toValue: 1,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
    composerActionAnimations.forEach((animation, index) => {
      Animated.spring(animation, {
        toValue: 1,
        tension: 80,
        friction: 8,
        delay: (composerActionAnimations.length - 1 - index) * 50,
        useNativeDriver: true,
      }).start();
    });
  }, [composerActionAnimations, composerEntrance, path]);
  useEffect(() => {
    if (!path || !payload || payload.pathId !== path.id) {
      journeyHeaderActionEntrance.setValue(0);
      return;
    }
    journeyHeaderActionEntrance.stopAnimation();
    journeyHeaderActionEntrance.setValue(0);
    requestAnimationFrame(() => {
      Animated.spring(journeyHeaderActionEntrance, {
        toValue: 1,
        tension: 72,
        friction: 8,
        useNativeDriver: true,
      }).start();
    });
  }, [journeyHeaderActionEntrance, path, payload?.pathId]);
  useLayoutEffect(() => {
    if (!path || !payload || payload.pathId !== path.id) {
      journeyContentEntrance.setValue(0);
      return;
    }
    journeyContentEntrance.stopAnimation();
    journeyContentEntrance.setValue(0);
    requestAnimationFrame(() => {
      Animated.spring(journeyContentEntrance, {
        toValue: 1,
        tension: 68,
        friction: 8,
        useNativeDriver: true,
      }).start();
    });
  }, [journeyContentEntrance, path, payload?.pathId, stepIndex]);
  const journeyHeaderActionEntranceStyle = {
    opacity: journeyHeaderActionEntrance.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: journeyHeaderActionEntrance.interpolate({
          inputRange: [0, 1],
          outputRange: [0.88, 1],
        }),
      },
    ],
  };
  const journeyContentEntranceStyle = {
    opacity: journeyContentEntrance.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: journeyContentEntrance.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  };
  const revealChooserItems = (section: 'guided' | 'questions') => {
    const animations = chooserAnimations(section);
    animations.forEach(animation => {
      animation.stopAnimation();
      animation.setValue(0);
    });
    Animated.stagger(
      38,
      animations.map(animation =>
        Animated.spring(animation, {
          toValue: 1,
          tension: 90,
          friction: 12,
          useNativeDriver: true,
        }),
      ),
    ).start(() => {
      requestAnimationFrame(() => setChooserTransitioning(false));
    });
  };
  const chooserRevealStyle = (animation: Animated.Value) => ({
    opacity: animation,
    transform: [
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  });
  useEffect(() => {
    if (pathId) {return;}
    chooserPageAnim.stopAnimation();
    chooserPageAnim.setValue(0);
    guideRevealAnims.forEach(animation => {
      animation.stopAnimation();
      animation.setValue(0);
    });
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.spring(chooserPageAnim, {
          toValue: 1,
          tension: 90,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.stagger(
          38,
          guideRevealAnims.map(animation =>
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
  }, [chooserPageAnim, guideRevealAnims, pathId]);
  const changeQuestionTopic = (nextTopic: GuidedQuestionTopic) => {
    triggerLightHaptic();
    if (nextTopic === topic || topicTransitioning) {return;}
    setTopicTransitioning(true);
    const outgoing = questionRevealAnims.slice(1, questionsForTopic(topic).length + 1);
    outgoing.forEach(animation => animation.stopAnimation());
    Animated.stagger(
      28,
      [...outgoing].reverse().map(animation =>
        Animated.timing(animation, {
          toValue: 0,
          duration: 130,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ),
    ).start(() => {
      const incoming = questionRevealAnims.slice(1, questionsForTopic(nextTopic).length + 1);
      incoming.forEach(animation => {
        animation.stopAnimation();
        animation.setValue(0);
      });
      requestAnimationFrame(() => {
        setTopic(nextTopic);
        Animated.stagger(
          38,
          incoming.map(animation =>
            Animated.spring(animation, {
              toValue: 1,
              tension: 90,
              friction: 12,
              useNativeDriver: true,
            }),
          ),
        ).start(() => {
          requestAnimationFrame(() => setTopicTransitioning(false));
        });
      });
    });
  };
  const expandChooserSection = (section: 'guided' | 'questions') => {
    triggerLightHaptic();
    if (chooserSection === section || chooserTransitioning) {return;}
    setChooserTransitioning(true);
    const outgoing = chooserAnimations(chooserSection);
    outgoing.forEach(animation => animation.stopAnimation());
    Animated.stagger(
      28,
      [...outgoing].reverse().map(animation =>
        Animated.timing(animation, {
          toValue: 0,
          duration: 130,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ),
    ).start(() => {
      LayoutAnimation.configureNext({
        duration: 440,
        create: {
          type: LayoutAnimation.Types.spring,
          property: LayoutAnimation.Properties.opacity,
          springDamping: 0.78,
        },
        update: {
          type: LayoutAnimation.Types.spring,
          springDamping: 0.78,
        },
        delete: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
          duration: 180,
        },
      });
      requestAnimationFrame(() => {
        setChooserSection(section);
        revealChooserItems(section);
      });
    });
  };
  const closeJourney = () => {
    triggerLightHaptic();
    if (onCloseJourney) onCloseJourney();
    else setPathId('');
  };
  const goToJourneyStep = (nextIndex: number) => {
    if (journeyTransitioning || nextIndex === stepIndex) {return;}
    setJourneyTransitioning(true);
    journeyContentEntrance.stopAnimation();
    Animated.timing(journeyContentEntrance, {
      toValue: 0,
      duration: 120,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      requestAnimationFrame(() => {
        setStepIndex(nextIndex);
        setJourneyTransitioning(false);
      });
    });
  };

  useEffect(() => {
    if (!path || restored) {
      return;
    }
    let active = true;
    loadGuidedReflectionDraft(selectedDate, path.id).then(draft => {
      if (active && draft) {
        setPayload(draft);
        setStepIndex(
          Math.max(
            0,
            path.steps.findIndex(step => step.id === draft.currentStepId),
          ),
        );
      } else if (active) {
        setPayload({
          format: GUIDED_REFLECTION_FORMAT,
          pathId: path.id,
          pathTitle: path.title,
          currentStepId: path.steps[0].id,
          completed: false,
          answers: path.steps.map(step => emptyGuidedAnswer(step.id)),
        });
      }
    });
    return () => {
      active = false;
    };
  }, [path, restored, selectedDate]);

  useEffect(() => {
    if (!payload || payload.completed) {
      return;
    }
    void saveGuidedReflectionDraft(selectedDate, payload);
  }, [payload, selectedDate]);

  const step = path?.steps[stepIndex];
  const renderedStep = useMemo(() => {
    if (!step || step.id !== 'heaviest' || !payload) {
      return step;
    }
    const selectedSpace = payload.answers.find(
      item => item.stepId === 'space',
    )?.selected;
    return selectedSpace?.length ? {...step, options: selectedSpace} : step;
  }, [payload, step]);
  const answer =
    payload && step
      ? payload.answers.find(item => item.stepId === step.id) ||
        emptyGuidedAnswer(step.id)
      : null;
  useEffect(() => {
    if (payload && step && payload.currentStepId !== step.id) {
      setPayload({...payload, currentStepId: step.id});
    }
  }, [payload, step]);
  const updateAnswer = (changes: Partial<GuidedStepAnswer>) => {
    if (!payload || !step || !answer) {
      return;
    }
    const next = {...answer, ...changes};
    setPayload({
      ...payload,
      currentStepId: step.id,
      answers: payload.answers.map(item =>
        item.stepId === step.id ? next : item,
      ),
    });
  };
  const toggleSelection = (value: string, multiple: boolean) => {
    const selected = answer?.selected || [];
    updateAnswer({
      selected: multiple
        ? selected.includes(value)
          ? selected.filter(item => item !== value)
          : [...selected, value]
        : [value],
    });
  };
  const addNote = () => {
    if (!noteKind || !noteText.trim() || !answer) {
      return;
    }
    const note: GuidedReflectionNote = {
      id: editingNoteId || createGuidedNoteId(),
      kind: noteKind,
      text: noteText.trim(),
      ...(noteReference.trim() ? {reference: noteReference.trim()} : {}),
    };
    updateAnswer({
      notes: editingNoteId
        ? answer.notes.map(item => (item.id === editingNoteId ? note : item))
        : [...answer.notes, note],
    });
    setEditingNoteId(null);
    setNoteKind(null);
    setNoteText('');
    setNoteReference('');
    setNotePickerOpen(false);
  };
  const openNotePicker = () => {
    Keyboard.dismiss();
    notePickerAnimations.forEach(animation => {
      animation.stopAnimation();
      animation.setValue(0);
    });
    setNotePickerOpen(true);
    setTimeout(() => {
      notePlusRotation.stopAnimation();
      notePickerColorAnim.stopAnimation();
      Animated.parallel([
        Animated.timing(notePickerColorAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.spring(notePlusRotation, {
          toValue: 1,
          tension: 90,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.stagger(
          38,
          [...notePickerAnimations].reverse().map(animation =>
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
  const closeNotePicker = (onComplete?: () => void) => {
    notePickerAnimations.forEach(animation => animation.stopAnimation());
    notePlusRotation.stopAnimation();
    notePickerColorAnim.stopAnimation();
    Animated.parallel([
      Animated.timing(notePickerColorAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.spring(notePlusRotation, {
        toValue: 0,
        tension: 90,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.stagger(
        28,
        notePickerAnimations.map(animation =>
          Animated.timing(animation, {
            toValue: 0,
            duration: 130,
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start(() => {
      requestAnimationFrame(() => {
        setNotePickerOpen(false);
        onComplete?.();
      });
    });
  };
  const closeNoteEditor = () => {
    setEditingNoteId(null);
    setNoteKind(null);
    setNoteText('');
    setNoteReference('');
    setNotePickerOpen(false);
  };
  const appendInlineNote = (
    kind: (typeof GUIDED_NOTE_TYPES)[number]['kind'],
  ) => {
    if (!answer) {return;}
    const id = createGuidedNoteId();
    const note: GuidedReflectionNote = {
      id,
      kind,
      text: '',
    };
    updateAnswer({notes: [...answer.notes, note]});
    if (noteFocusFrameRef.current !== null) cancelAnimationFrame(noteFocusFrameRef.current);
    noteFocusFrameRef.current = requestAnimationFrame(() => {
      noteFocusFrameRef.current = null;
      noteInputRefs.current.get(id)?.focus();
      journeyScrollRef.current?.scrollToEnd({animated: true});
      if (noteFocusTimerRef.current) clearTimeout(noteFocusTimerRef.current);
      noteFocusTimerRef.current = setTimeout(() => {
        noteFocusTimerRef.current = null;
        noteInputRefs.current.get(id)?.focus();
      }, 80);
      if (noteFocusRetryTimerRef.current) clearTimeout(noteFocusRetryTimerRef.current);
      noteFocusRetryTimerRef.current = setTimeout(() => {
        noteFocusRetryTimerRef.current = null;
        noteInputRefs.current.get(id)?.focus();
        journeyScrollRef.current?.scrollToEnd({animated: true});
      }, 320);
    });
  };
  const beginNote = (kind: (typeof GUIDED_NOTE_TYPES)[number]['kind']) => {
    triggerMediumHaptic();
    closeNotePicker(() => appendInlineNote(kind));
  };
  const beginWrite = () => {
    triggerLightHaptic();
    if (notePickerOpen) closeNotePicker(() => appendInlineNote('text'));
    else appendInlineNote('text');
  };
  const saveJourney = async (completed: boolean) => {
    if (!payload || !path || !step) {
      return;
    }
    const finalPayload = {
      ...payload,
      currentStepId: step.id,
      stoppedAtStepId: completed ? undefined : step.id,
      completed,
    };
    try {
      const saved = await onSave({
        title: path.title,
        content: serializeGuidedReflection(finalPayload),
        type: 'guided',
        source: 'guided',
        prompt: path.title,
        guidedJourney: finalPayload,
      });
      if (saved !== false) {
        await clearGuidedReflectionDraft(selectedDate, path.id);
      }
    } catch {
      Alert.alert(
        'Could not save',
        'Your reflection is still saved as a draft. Please try again.',
      );
    }
  };

  const openGuidedPath = async (selectedPath: (typeof GUIDED_REFLECTION_PATHS)[number]) => {
    triggerLightHaptic();
    // Flashing-light regression note:
    // Do not set pathId before its payload is ready. When pathId was updated
    // first, the render guard below briefly returned the ivory `styles.screen`
    // while the draft loaded. That produced a full-screen light flash before
    // the green journey sheet appeared. Keep the chooser mounted, resolve the
    // payload, then commit payload + pathId together in the same React batch.
    const savedDraft = await loadGuidedReflectionDraft(
      selectedDate,
      selectedPath.id,
    ).catch(() => null);
    const nextPayload = savedDraft || {
      format: GUIDED_REFLECTION_FORMAT,
      pathId: selectedPath.id,
      pathTitle: selectedPath.title,
      currentStepId: selectedPath.steps[0].id,
      completed: false,
      answers: selectedPath.steps.map(item => emptyGuidedAnswer(item.id)),
    };
    setStepIndex(
      Math.max(
        0,
        selectedPath.steps.findIndex(item => item.id === nextPayload.currentStepId),
      ),
    );
    setPayload(nextPayload);
    setPathId(selectedPath.id);
  };

  if (!pathId) {
    return (
      <View style={[styles.screen, styles.heartJournalChooser]}>
        <View style={[styles.chooserHeader, {top: insets.top + 10}]}>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              onCancel();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close Guided Reflection"
            style={styles.chooserClose}>
            <Ionicons name="close" size={18} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </View>
        <Animated.ScrollView
          style={chooserRevealStyle(chooserPageAnim)}
          contentContainerStyle={styles.chooserContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.chooserBrand}>
            <BookHeart size={17} color="rgba(255, 255, 255, 0.7)" strokeWidth={1.8} />
            <ThemedText weight="semiBold" style={styles.chooserEyebrow}>
              HEART JOURNAL
            </ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.chooserTitle}>
            What would help you reflect today?
          </ThemedText>
          <View style={styles.chooserSectionSwitch}>
            <TouchableOpacity
              style={[
                styles.chooserSectionPill,
                chooserSection === 'guided' && styles.chooserSectionPillActive,
              ]}
              onPress={() => expandChooserSection('guided')}
              accessibilityRole="button"
              accessibilityState={{selected: chooserSection === 'guided'}}>
              <ThemedText
                weight="semiBold"
                style={[
                  styles.chooserSectionLabel,
                  chooserSection === 'guided' && styles.chooserSectionLabelActive,
                ]}>
                Guide me through it
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chooserSectionPill,
                chooserSection === 'questions' && styles.chooserSectionPillActive,
              ]}
              onPress={() => expandChooserSection('questions')}
              accessibilityRole="button"
              accessibilityState={{selected: chooserSection === 'questions'}}>
              <ThemedText
                weight="semiBold"
                style={[
                  styles.chooserSectionLabel,
                  chooserSection === 'questions' && styles.chooserSectionLabelActive,
                ]}>
                Choose a question
              </ThemedText>
            </TouchableOpacity>
          </View>
          {chooserSection === 'guided' && (
            <View>
              {GUIDED_REFLECTION_PATHS.map((item, index) => (
                <Animated.View key={item.id} style={chooserRevealStyle(guideRevealAnims[index])}>
                  <TouchableOpacity
                    style={styles.chooserPathCard}
                    onPress={() => openGuidedPath(item)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}>
                    <View style={{flex: 1}}>
                      <ThemedText weight="semiBold" style={styles.chooserPathTitle}>
                        {item.title}
                      </ThemedText>
                      <ThemedText style={styles.chooserSupport}>
                        {item.description}
                      </ThemedText>
                    </View>
                    <Ionicons name="arrow-forward" size={18} color={Colors.hopeWhite} />
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          )}
          {chooserSection === 'questions' && (
            <View>
              <Animated.View style={chooserRevealStyle(questionRevealAnims[0])}>
                <ThemedText style={styles.chooserQuestionHeading}>
                  What would you like to reflect on?
                </ThemedText>
                <ScrollView
                  horizontal
                  style={styles.topicScroller}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.topics}>
                  {GUIDED_QUESTION_TOPICS.map(item => (
                    <TouchableOpacity
                      key={item}
                      onPress={() => changeQuestionTopic(item)}
                      style={[styles.chooserTopic, topic === item && styles.chooserTopicSelected]}
                      accessibilityRole="button"
                      accessibilityState={{selected: topic === item}}>
                      <ThemedText
                        style={[
                          styles.chooserTopicText,
                          topic === item && styles.chooserTopicTextSelected,
                        ]}>
                        {item}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Animated.View>
              <View style={styles.questions}>
                {questionsForTopic(topic).map((question, index) => (
                  <Animated.View
                    key={question.id}
                    style={[styles.questionRevealItem, chooserRevealStyle(questionRevealAnims[index + 1])]}
                  >
                    <ReflectionQuestionCard
                      question={question.prompt}
                      onReflect={() => {
                        triggerLightHaptic();
                        onSelectQuestion(question.prompt);
                      }}
                      styles={styles}
                    />
                  </Animated.View>
                ))}
              </View>
            </View>
          )}
        </Animated.ScrollView>
      </View>
    );
  }

  if (!path || !payload || !step || !answer) {
    return <View style={styles.screen} />;
  }
  if (optionalOpen && step.optionalWrite) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              setOptionalOpen(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Back to reflection"
            style={styles.close}>
            <Ionicons name="chevron-back" size={20} color={Colors.sage} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>{path.title}</ThemedText>
          <TouchableOpacity
            onPress={closeJourney}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.close}>
            <Ionicons name="close" size={17} color={Colors.sage} />
          </TouchableOpacity>
        </View>
        <View style={styles.progress}>
          <View
            style={[
              styles.progressFill,
              {width: `${((stepIndex + 1) / path.steps.length) * 100}%`},
            ]}
          />
        </View>
        <View style={styles.focusedWriter}>
          <ThemedText style={styles.eyebrow}>
            {step.optionalWrite.prompt}
          </ThemedText>
          <TextInput
            ref={primaryInputRef}
            autoFocus
            multiline
            style={styles.focusedInput}
            value={answer.optionalText || ''}
            onChangeText={text => updateAnswer({optionalText: text})}
            placeholder="Write here..."
            placeholderTextColor={Colors.textGray}
          />
        </View>
        <View style={styles.focusedFooter}>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              setOptionalOpen(false);
            }}
            style={styles.doneButton}
            accessibilityRole="button">
            <ThemedText weight="semiBold" style={styles.continueText}>
              Done
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  if (noteKind) {
    const noteConfig = GUIDED_NOTE_TYPES.find(item => item.kind === noteKind);
    const placeholder =
      noteKind === 'quote'
        ? 'Write the words you want to remember…'
        : noteKind === 'key'
        ? 'What is the main point?'
        : noteKind === 'remember'
        ? 'What do you not want to forget?'
        : noteKind === 'question'
        ? 'What question do you want to hold?'
        : noteKind === 'response'
        ? 'What response or next step do you want to capture?'
        : noteKind === 'scripture'
        ? 'What stands out to you?'
        : 'Write your note…';
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              closeNoteEditor();
            }}
            accessibilityRole="button"
            accessibilityLabel="Back to reflection"
            style={styles.close}>
            <Ionicons name="chevron-back" size={20} color={Colors.sage} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>{path.title}</ThemedText>
          <TouchableOpacity
            onPress={closeJourney}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.close}>
            <Ionicons name="close" size={17} color={Colors.sage} />
          </TouchableOpacity>
        </View>
        <View style={styles.focusedWriter}>
          <View style={styles.semanticHeading}>
            <Ionicons
              name={noteConfig?.icon as any}
              size={18}
              color={Colors.sage}
            />
            <ThemedText style={styles.eyebrow}>
              {noteConfig?.label.toUpperCase()}
            </ThemedText>
          </View>
          {(noteKind === 'scripture' || noteKind === 'quote') && (
            <TextInput
              style={styles.referenceInput}
              value={noteReference}
              onChangeText={setNoteReference}
              placeholder={
                noteKind === 'scripture'
                  ? 'Scripture reference'
                  : 'Attribution (optional)'
              }
              placeholderTextColor={Colors.textGray}
            />
          )}
          <TextInput
            ref={primaryInputRef}
            autoFocus
            multiline
            style={styles.focusedInput}
            value={noteText}
            onChangeText={setNoteText}
            placeholder={placeholder}
            placeholderTextColor={Colors.textGray}
          />
        </View>
        <View style={styles.focusedFooter}>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              closeNoteEditor();
            }}
            style={styles.focusedBack}
            accessibilityRole="button">
            <Ionicons name="chevron-back" size={20} color={Colors.sage} />
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!noteText.trim()}
            onPress={() => {
              triggerLightHaptic();
              addNote();
            }}
            style={[styles.doneButton, !noteText.trim() && {opacity: 0.45}]}
            accessibilityRole="button">
            <ThemedText weight="semiBold" style={styles.continueText}>
              {editingNoteId ? 'Save note' : `Add ${noteConfig?.label}`}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  const journeyDate = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
    'en-US',
    {weekday: 'long', month: 'long', day: 'numeric'},
  );
  if (showSavedView) {
    return (
      <View style={styles.journeyScreen}>
        <View style={styles.journeyHeaderBackdrop} />
        <View style={styles.journeyHeader}>
          <ThemedText weight="bold" style={styles.journeyDate}>{journeyDate}</ThemedText>
          <View style={styles.journeyHeaderActions}>
          <TouchableOpacity
            onPress={closeJourney}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.journeyHeaderButton}>
            <Ionicons name="close" size={17} color={Colors.sage} />
          </TouchableOpacity>
          </View>
        </View>
        <View style={styles.journeySheet}>
        <ScrollView
          contentContainerStyle={styles.savedJourneyContent}
          showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.savedJourneyEyebrow}>GUIDED REFLECTION</ThemedText>
          <ThemedText weight="bold" style={styles.savedJourneyTitle}>
            {path.title}
          </ThemedText>
          {path.steps.map(savedStep => {
            const savedAnswer = payload.answers.find(
              item => item.stepId === savedStep.id,
            );
            if (!savedAnswer || !answerHasValue(savedAnswer)) {
              return null;
            }
            return (
              <View key={savedStep.id} style={styles.savedSection}>
                <ThemedText style={styles.savedJourneyLabel}>
                  {savedStep.eyebrow}
                </ThemedText>
                <ThemedText weight="semiBold" style={styles.savedJourneyPrompt}>
                  {savedStep.prompt}
                </ThemedText>
                {savedAnswer.selected?.length ? (
                  <View style={styles.savedSelections}>
                    {savedAnswer.selected.map(selection => (
                      <View key={selection} style={styles.savedSelectionPill}>
                        <ThemedText style={styles.savedJourneySelectionText}>{selection}</ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
                {savedAnswer.text?.trim() ? (
                  <ThemedText style={styles.savedJourneyQuote}>
                    {savedAnswer.text.trim()}
                  </ThemedText>
                ) : null}
                {Object.entries(savedAnswer.fields || {}).map(
                  ([fieldId, value]) =>
                    value?.trim() ? (
                      <View key={fieldId} style={styles.savedField}>
                        <ThemedText style={styles.savedJourneyFieldLabel}>
                          {savedStep.fields?.find(field => field.id === fieldId)
                            ?.label || fieldId}
                        </ThemedText>
                        <ThemedText style={styles.savedJourneyText}>
                          {value.trim()}
                        </ThemedText>
                      </View>
                    ) : null,
                )}
                {savedAnswer.optionalText?.trim() ? (
                  <ThemedText style={styles.savedJourneyQuote}>
                    {savedAnswer.optionalText.trim()}
                  </ThemedText>
                ) : null}
                {savedStep.scripture ? (
                  <View style={styles.savedScripture}>
                    <Ionicons
                      name="book-outline"
                      size={16}
                      color={Colors.hopeWhite}
                    />
                    <ThemedText style={styles.savedJourneyText}>
                      {savedStep.scripture.reference}
                    </ThemedText>
                  </View>
                ) : null}
                {savedAnswer.notes.filter(note => note.text.trim() || note.reference?.trim()).map(note => (
                  <View key={note.id} style={styles.savedJourneyNote}>
                    <View style={{flex: 1}}>
                      <ThemedText style={styles.savedJourneyNoteKind}>
                        {GUIDED_NOTE_TYPES.find(
                          item => item.kind === note.kind,
                        )?.label?.toUpperCase()}
                      </ThemedText>
                      <ThemedText style={styles.savedJourneyNoteText}>
                        {note.text}
                      </ThemedText>
                      {note.reference ? (
                        <ThemedText style={styles.savedJourneySupport}>
                          {note.reference}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
          {!payload.completed ? (
            <TouchableOpacity
              style={styles.continueReflection}
              onPress={() => {
                triggerLightHaptic();
                setShowSavedView(false);
              }}
              accessibilityRole="button">
              <ThemedText style={styles.continueText}>
                Continue reflection →
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
        </View>
      </View>
    );
  }
  const atLastStep = stepIndex === path.steps.length - 1;
  const canContinue = !step.required || answerHasValue(answer);
  const canWrite = true;
  const renderInlineNotes = () =>
    answer.notes
      .map(note => {
        const noteIndex = answer.notes.findIndex(item => item.id === note.id);
        const noteType = GUIDED_NOTE_TYPES.find(item => item.kind === note.kind);
        const config: JournalBlockConfig =
          note.kind === 'text'
            ? {
                label: 'NOTE',
                action: '+ Note',
                placeholder: 'Write a note…',
                icon: noteType?.icon || 'document-text-outline',
              }
            : JOURNAL_BLOCKS[note.kind];
        const updateNote = (changes: Partial<GuidedReflectionNote>) =>
          updateAnswer({
            notes: answer.notes.map(item =>
              item.id === note.id ? {...item, ...changes} : item,
            ),
          });
        return (
          <NoteEntrance key={note.id} delay={noteIndex * 55}>
          <JournalInlineBlock
            block={{id: note.id, kind: note.kind, text: note.text}}
            configOverride={note.kind === 'text' ? undefined : config}
            tone="onDark"
            textPlaceholder="Write here…"
            styles={styles}
            registerInput={input => {
              if (input) noteInputRefs.current.set(note.id, input);
              else noteInputRefs.current.delete(note.id);
            }}
            onChangeText={text => updateNote({text})}
            onDelete={keepKeyboard => {
              if (keepKeyboard !== false) triggerLightHaptic();
              updateAnswer({
                notes: answer.notes.filter(item => item.id !== note.id),
              });
            }}
            renderScripture={
              note.kind === 'scripture'
                ? () => (
                    <View>
                      <TextInput
                        ref={input => {
                          if (input) noteInputRefs.current.set(note.id, input);
                          else noteInputRefs.current.delete(note.id);
                        }}
                        style={[styles.captureInput, styles.scriptureReferenceInline]}
                        value={note.reference || ''}
                        onChangeText={reference => updateNote({reference})}
                        placeholder="Scripture reference"
                        placeholderTextColor="rgba(255,255,255,0.45)"
                      />
                      <TextInput
                        style={styles.captureInput}
                        value={note.text}
                        onChangeText={text => updateNote({text})}
                        placeholder={config.placeholder}
                        placeholderTextColor="rgba(255,255,255,0.45)"
                        multiline
                      />
                    </View>
                  )
                : undefined
            }
          />
          </NoteEntrance>
        );
      });
  return (
    <View style={styles.journeyScreen}>
      <View style={styles.journeyHeaderBackdrop} />
      <View style={styles.journeyHeader}>
        <ThemedText weight="bold" style={styles.journeyDate}>{journeyDate}</ThemedText>
        <Animated.View style={[styles.journeyHeaderActions, journeyHeaderActionEntranceStyle]}>
          <TouchableOpacity
            onPress={closeJourney}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.journeyHeaderButton}>
            <Ionicons name="close" size={17} color={Colors.sage} />
          </TouchableOpacity>
        </Animated.View>
      </View>
      <View style={styles.journeySheet}>
      <Animated.View style={[{flex: 1}, journeyContentEntranceStyle]}>
        <View style={styles.journeyContext}>
          <ThemedText weight="semiBold" style={styles.journeyPathTitle}>{path.title}</ThemedText>
          <ThemedText style={styles.journeyStepCount}>{stepIndex + 1} of {path.steps.length}</ThemedText>
        </View>
        <View style={styles.journeyProgress}>
          <View
            style={[
              styles.journeyProgressFill,
              {width: `${((stepIndex + 1) / path.steps.length) * 100}%`},
            ]}
          />
        </View>
        <ScrollView
          ref={journeyScrollRef}
          contentContainerStyle={[
            styles.stepContent,
            notePickerOpen && styles.stepContentWithNotePicker,
          ]}
          scrollIndicatorInsets={{bottom: notePickerOpen ? 300 : 120}}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.journeyEyebrow}>{step.eyebrow}</ThemedText>
        <ThemedText weight="bold" style={styles.journeyPrompt}>
          {step.prompt}
        </ThemedText>
        <StepInteraction
          key={step.id}
          step={renderedStep || step}
          answer={answer}
          onSelect={value =>
            toggleSelection(value, step.interactionType !== 'single_select')
          }
          onOpenScripture={() => setScriptureOpen(true)}
        />
        {step.optionalWrite && answer.optionalText?.trim() ? (
          <View style={styles.secondaryArea}>
            <View style={styles.optionalPreview}>
              <ThemedText style={styles.savedLabel}>
                {answer.selected?.join(' · ') || step.optionalWrite.label}
              </ThemedText>
              <ThemedText style={styles.savedQuote}>
                {answer.optionalText.trim()}
              </ThemedText>
              <TouchableOpacity
                onPress={() => {
                  triggerLightHaptic();
                  setOptionalOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Edit optional response">
                <ThemedText style={styles.textAction}>Edit</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        {renderInlineNotes()}
        </ScrollView>
      </Animated.View>
      </View>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.floatingComposer,
          {bottom: composerBottom},
        ]}>
        {notePickerOpen && (
          <JournalPickerMenu
            items={GUIDED_NOTE_TYPES.map(item => ({
              key: item.kind,
              label: item.label,
              icon: (
                <Ionicons
                  name={item.icon as any}
                  size={13}
                  color={Colors.sage}
                />
              ),
            }))}
            animations={notePickerAnimations}
            onSelect={beginNote}
          />
        )}
        <Animated.View
          style={{
            width: '100%',
            opacity: composerEntrance,
            transform: [
              {
                translateX: composerEntrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          }}>
          <JournalComposerBar
          onBack={() =>
            {
              stepIndex > 0 ? goToJourneyStep(stepIndex - 1) : setPathId('');
            }
          }
            onWrite={beginWrite}
            onAdd={() => {
              triggerLightHaptic();
              if (notePickerOpen) closeNotePicker();
              else openNotePicker();
            }}
            onNext={() => {
              triggerLightHaptic();
              atLastStep ? saveJourney(true) : goToJourneyStep(stepIndex + 1);
            }}
            addOpen={notePickerOpen}
            plusRotation={notePlusRotation}
            pickerColorAnim={notePickerColorAnim}
            actionAnimations={composerActionAnimations}
            nextIcon={atLastStep ? 'checkmark' : 'chevron-forward'}
            backLabel="Previous step"
            nextLabel={atLastStep ? 'Save reflection' : 'Next step'}
            nextDisabled={!canContinue || isSaving || journeyTransitioning}
            writeDisabled={!canWrite}
            tone="onDark"
          />
        </Animated.View>
      </Animated.View>
      {step.scripture && (
        <ScriptureReaderModal
          visible={scriptureOpen}
          passages={[{reference: step.scripture.reference}]}
          initialIndex={0}
          onClose={() => setScriptureOpen(false)}
        />
      )}
    </View>
  );
};

const StepInteraction = ({
  step,
  answer,
  onSelect,
  onOpenScripture,
}: {
  step: GuidedReflectionStepDefinition;
  answer: GuidedStepAnswer;
  onSelect: (value: string) => void;
  onOpenScripture: () => void;
}) => {
  const itemCount = Math.max(
    1,
    step.options?.length || 0,
    step.interactionType === 'scripture_reflection' ? 2 : 0,
  );
  const itemEntrances = useRef(
    Array.from({length: itemCount}, () => new Animated.Value(0)),
  ).current;
  useEffect(() => {
    itemEntrances.forEach(animation => {
      animation.stopAnimation();
      animation.setValue(0);
    });
    const frame = requestAnimationFrame(() => {
      Animated.stagger(
        55,
        itemEntrances.map(animation =>
          Animated.spring(animation, {
            toValue: 1,
            tension: 72,
            friction: 9,
            useNativeDriver: true,
          }),
        ),
      ).start();
    });
    return () => cancelAnimationFrame(frame);
  }, [itemEntrances]);
  const itemEntranceStyle = (index: number) => ({
    opacity: itemEntrances[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp' as const,
    }),
    transform: [
      {
        translateY: itemEntrances[index].interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  });
  if (step.interactionType === 'write') return null;
  if (
    step.interactionType === 'single_select' ||
    step.interactionType === 'multi_select'
  )
    return (
      <>
        <View style={styles.options}>
          {step.options?.map((option, index) => {
            const selected = answer.selected?.includes(option);
            return (
              <Animated.View key={option} style={itemEntranceStyle(index)}>
              <TouchableOpacity
                onPress={() => {
                  triggerLightHaptic();
                  onSelect(option);
                }}
                style={[styles.option, selected && styles.optionSelected]}
                accessibilityRole="button"
                accessibilityState={{selected}}
                accessibilityLabel={option}>
                <ThemedText
                  style={[
                    styles.optionText,
                    selected && styles.optionTextSelected,
                  ]}>
                  {option}
                </ThemedText>
                {selected && (
                  <Ionicons name="checkmark" size={16} color={Colors.hopeWhite} />
                )}
              </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </>
    );
  if (step.interactionType === 'scripture_reflection' && step.scripture)
    return (
      <>
        <Animated.View style={itemEntranceStyle(0)}>
        <TouchableOpacity
          style={styles.scripture}
          onPress={() => {
            triggerLightHaptic();
            onOpenScripture();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Read ${step.scripture.reference}`}>
          <Ionicons name="book-outline" size={20} color={Colors.sage} />
          <ThemedText weight="semiBold" style={styles.scriptureRef}>
            {step.scripture.reference}
          </ThemedText>
          <Ionicons name="arrow-forward" size={17} color={Colors.sage} />
        </TouchableOpacity>
        </Animated.View>
        <Animated.View style={itemEntranceStyle(1)}>
        <ThemedText style={styles.inputLabel}>
          {step.scripture.question.toUpperCase()}
        </ThemedText>
        </Animated.View>
      </>
    );
  return null;
};

const NoteEntrance = ({
  children,
  delay,
}: {
  children: React.ReactNode;
  delay: number;
}) => {
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    entrance.setValue(0);
    Animated.spring(entrance, {
      toValue: 1,
      tension: 76,
      friction: 9,
      delay,
      useNativeDriver: true,
    }).start();
  }, [delay, entrance]);
  return (
    <Animated.View
      style={{
        opacity: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        }),
        transform: [
          {translateY: entrance.interpolate({inputRange: [0, 1], outputRange: [14, 0]})},
        ],
      }}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: Colors.lightBackground},
  // Keep green as the first opaque paint so changing from the chooser to a
  // journey cannot expose a full-screen ivory frame. The separate backdrop
  // retains the original ivory header and rounded-corner reveal.
  journeyScreen: {flex: 1, backgroundColor: Colors.sage},
  journeyHeaderBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: Colors.lightBackground,
  },
  journeyHeader: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.lightBackground,
  },
  journeyDate: {color: Colors.sage, fontSize: 18},
  journeyHeaderActions: {flexDirection: 'row', alignItems: 'center', gap: 6},
  journeyHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeySheet: {
    flex: 1,
    backgroundColor: Colors.sage,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  journeyContext: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  journeyPathTitle: {color: Colors.hopeWhite, fontSize: 14},
  journeyStepCount: {color: 'rgba(255,255,255,0.62)', fontSize: 11},
  journeyProgress: {height: 2, backgroundColor: 'rgba(255,255,255,0.18)'},
  journeyProgressFill: {height: 2, backgroundColor: Colors.hopeWhite},
  journeyEyebrow: {
    color: 'rgba(255,255,255,0.68)',
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    letterSpacing: 2.2,
    marginBottom: 10,
  },
  journeyPrompt: {
    color: Colors.hopeWhite,
    fontSize: 25,
    lineHeight: 33,
    marginBottom: 24,
  },
  heartJournalChooser: {backgroundColor: Colors.sage},
  chooserHeader: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },
  chooserClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooserContent: {
    paddingHorizontal: 24,
    paddingTop: 96,
    paddingBottom: 60,
  },
  chooserEyebrow: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    letterSpacing: 2.4,
    textAlign: 'center',
  },
  chooserBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 12,
  },
  chooserTitle: {
    color: Colors.hopeWhite,
    fontSize: 30,
    lineHeight: 38,
    marginBottom: 32,
    textAlign: 'center',
  },
  chooserSectionLabel: {
    color: Colors.hopeWhite,
    fontSize: 12,
    textAlign: 'center',
  },
  chooserSectionLabelActive: {color: Colors.hopeWhite},
  chooserSectionSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  chooserSectionPill: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooserSectionPillActive: {
    backgroundColor: Colors.darkBackground,
    borderColor: Colors.sageMuted,
  },
  chooserPathCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    padding: 17,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chooserPathTitle: {color: Colors.hopeWhite, fontSize: 16},
  chooserSupport: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  chooserQuestionHeading: {
    color: Colors.hopeWhite,
    fontSize: 17,
    marginBottom: 12,
    textAlign: 'center',
  },
  chooserTopic: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chooserTopicSelected: {
    backgroundColor: Colors.darkBackground,
    borderColor: Colors.sageMuted,
  },
  chooserTopicText: {color: Colors.hopeWhite, fontSize: 12},
  chooserTopicTextSelected: {color: Colors.hopeWhite},
  promptCard: {
    width: '100%',
    minHeight: 160,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 30,
    padding: 18,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  promptTextContainer: {
    width: '100%',
    maxWidth: '100%',
    flexGrow: 1,
    flexShrink: 1,
    alignSelf: 'stretch',
  },
  promptCardText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'left',
    marginBottom: 16,
    fontWeight: '500',
    letterSpacing: 0.15,
    width: '100%',
    maxWidth: '100%',
    flexShrink: 1,
  },
  reflectLabel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 'auto',
  },
  buttonIcon: {marginRight: 8},
  reflectLabelText: {
    color: Colors.hopeWhite,
    fontSize: 15,
    letterSpacing: 0.5,
    textAlign: 'center',
    opacity: 0.9,
  },
  lockIconContainer: {},
  questionRevealItem: {
    width: '48%',
    maxWidth: '48%',
    minWidth: 0,
    flexGrow: 0,
    flexShrink: 1,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBackground,
  },
  headerTitle: {
    color: Colors.text,
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },
  homeContent: {padding: 24, paddingBottom: 60},
  savedContent: {padding: 24, paddingBottom: 60},
  savedJourneyContent: {padding: 24, paddingBottom: 80},
  savedJourneyEyebrow: {
    color: 'rgba(255,255,255,0.68)',
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    letterSpacing: 2.2,
    marginBottom: 10,
  },
  savedJourneyTitle: {
    color: Colors.hopeWhite,
    fontSize: 30,
    lineHeight: 38,
    marginBottom: 30,
  },
  savedJourneyLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  savedJourneyPrompt: {
    color: Colors.hopeWhite,
    fontSize: 18,
    lineHeight: 25,
    marginBottom: 12,
  },
  savedJourneyText: {color: Colors.hopeWhite, fontSize: 15, lineHeight: 23},
  savedJourneyQuote: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.lora.regular,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 25,
    marginTop: 7,
  },
  savedJourneyFieldLabel: {color: 'rgba(255,255,255,0.58)', fontSize: 11, marginBottom: 3},
  savedJourneySelectionText: {color: Colors.hopeWhite, fontSize: 12},
  savedJourneyNote: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  savedJourneyNoteKind: {color: 'rgba(255,255,255,0.65)', fontSize: 9, letterSpacing: 1.3},
  savedJourneyNoteText: {color: Colors.hopeWhite, fontSize: 14, lineHeight: 20, marginTop: 4},
  savedJourneySupport: {color: 'rgba(255,255,255,0.62)', fontSize: 12, lineHeight: 18, marginTop: 3},
  eyebrow: {
    color: Colors.sage,
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    letterSpacing: 2.2,
    marginBottom: 10,
  },
  homeTitle: {
    color: Colors.text,
    fontSize: 30,
    lineHeight: 38,
    marginBottom: 32,
  },
  savedSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 18,
  },
  savedLabel: {
    color: Colors.sage,
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  savedPrompt: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 25,
    marginBottom: 12,
  },
  savedSelections: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 10,
  },
  savedSelectionPill: {
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: Colors.darkBackground,
    borderWidth: 1,
    borderColor: Colors.sageMuted,
  },
  savedSelectionText: {color: Colors.sage, fontSize: 12},
  savedText: {color: Colors.text, fontSize: 15, lineHeight: 23},
  savedQuote: {
    color: Colors.text,
    fontFamily: Fonts.lora.regular,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 25,
    marginTop: 7,
  },
  savedField: {marginTop: 10},
  savedFieldLabel: {color: Colors.textGray, fontSize: 11, marginBottom: 3},
  savedScripture: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  continueReflection: {
    backgroundColor: Colors.sage,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  sectionLabel: {
    color: Colors.sage,
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    marginTop: 18,
    marginBottom: 12,
  },
  pathCard: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    padding: 17,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pathTitle: {color: Colors.text, fontSize: 16},
  support: {color: Colors.textGray, fontSize: 12, lineHeight: 18, marginTop: 3},
  questionHeading: {color: Colors.text, fontSize: 17, marginBottom: 12},
  topicScroller: {marginHorizontal: -24},
  topics: {
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  topic: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  topicSelected: {backgroundColor: Colors.sage, borderColor: Colors.sage},
  topicText: {color: Colors.sage, fontSize: 12},
  topicTextSelected: {color: Colors.hopeWhite},
  questions: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  questionCard: {
    width: '48%',
    minHeight: 190,
    backgroundColor: Colors.sage,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'space-between',
  },
  questionText: {color: Colors.hopeWhite, fontSize: 15, lineHeight: 22},
  reflectButton: {
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    borderRadius: 20,
    minHeight: 40,
    paddingHorizontal: 14,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reflectButtonText: {color: Colors.hopeWhite, fontSize: 12},
  progress: {height: 2, backgroundColor: Colors.cardBorder},
  progressFill: {height: 2, backgroundColor: Colors.sage},
  stepContent: {padding: 24, paddingBottom: 180},
  stepContentWithNotePicker: {paddingBottom: 410},
  stepPrompt: {
    color: Colors.text,
    fontSize: 25,
    lineHeight: 33,
    marginBottom: 24,
  },
  input: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 12,
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
    fontSize: 15,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  smallInput: {
    borderBottomWidth: 0,
    paddingVertical: 12,
    color: Colors.text,
    marginBottom: 12,
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    letterSpacing: 1.3,
    marginTop: 18,
    marginBottom: 8,
  },
  options: {flexDirection: 'row', flexWrap: 'wrap', gap: 9},
  option: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 22,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  optionSelected: {backgroundColor: Colors.darkBackground, borderColor: Colors.sageMuted},
  optionText: {color: Colors.hopeWhite, fontSize: 13},
  optionTextSelected: {color: Colors.hopeWhite},
  fields: {gap: 5},
  secondaryArea: {marginTop: 18},
  optionalPreview: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.sage,
    paddingLeft: 13,
  },
  textAction: {
    color: Colors.sage,
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    paddingVertical: 12,
  },
  capture: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 9,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  textCapture: {backgroundColor: 'rgba(255,255,255,0.1)'},
  keyCapture: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.hopeWhite,
  },
  quoteCapture: {backgroundColor: 'rgba(255,255,255,0.1)'},
  rememberCapture: {backgroundColor: 'rgba(255,255,255,0.12)'},
  scriptureCapture: {backgroundColor: 'rgba(255,255,255,0.12)'},
  responseCapture: {backgroundColor: 'rgba(255,255,255,0.14)'},
  questionCapture: {backgroundColor: 'rgba(255,255,255,0.08)'},
  captureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  captureLabelRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  captureLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.78)',
  },
  captureInput: {
    minHeight: 54,
    paddingTop: 9,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.hopeWhite,
    textAlignVertical: 'top',
  },
  serifInput: {fontFamily: Fonts.lora.regular, fontSize: 15},
  scriptureReferenceInline: {
    minHeight: 38,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.16)',
  },
  freeText: {
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 6,
    marginBottom: 6,
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  note: {
    marginTop: 10,
    borderLeftWidth: 2,
    borderLeftColor: Colors.sage,
    padding: 12,
    backgroundColor: Colors.cardBackground,
    flexDirection: 'row',
  },
  noteKind: {color: Colors.sage, fontSize: 9, letterSpacing: 1.3},
  noteText: {color: Colors.text, fontSize: 14, lineHeight: 20, marginTop: 4},
  scripture: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scriptureRef: {flex: 1, color: Colors.sage},
  floatingComposer: {
    position: 'absolute',
    left: 18,
    right: 18,
    zIndex: 30,
    elevation: 30,
    alignItems: 'flex-end',
  },
  continue: {
    backgroundColor: Colors.sage,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 13,
    alignSelf: 'flex-end',
  },
  continueText: {color: Colors.hopeWhite},
  focusedWriter: {flex: 1, padding: 24},
  focusedInput: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 18,
    lineHeight: 28,
    textAlignVertical: 'top',
    padding: 0,
  },
  focusedFooter: {
    padding: 20,
    paddingBottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  focusedBack: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  semanticHeading: {flexDirection: 'row', alignItems: 'center', gap: 8},
  referenceInput: {
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 16,
    paddingVertical: 14,
    marginBottom: 18,
  },
});

export default GuidedReflectionExperience;

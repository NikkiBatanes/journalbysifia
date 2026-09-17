import { exitEveningFlow } from '../../navigation/exitEveningFlow';
import ShareDropdownModal from '../../components/ShareDropdownModal';
import { LOOKING_FORWARD_EMOTIONS } from '../../data/lookingForwardEmotions';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import WisdomScripturePassage from '../../components/routine/WisdomScripturePassage';
import { getProverbReflection } from '../../data/getProverbReflection';
import RoutineStepShell from '../../components/routine/RoutineStepShell';
import { useFloatingKeyboardButton } from '../../hooks/useFloatingKeyboardButton';
import React, { useState } from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil } from 'lucide-react-native';

import ThemedText from '../../components/common/ThemedText';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { triggerLightHaptic } from '../../utils/haptics';
import { fromLocalDateString, toLocalDateString } from '../../utils/date';
import { useRoutine } from '../../context/RoutineContext';
import { useRoutineDraft } from '../../hooks/useRoutineDraft';
import {
  createLocalJournalEntry,
  getLocalJournalEntry,
  getLocalJournalSingleton,
  getLocalJournalEntries,
  updateLocalJournalEntry,
} from '../../storage/journalStorage';
import {
  createLocalReflection,
  getLocalReflection,
  getLocalReflections,
  updateLocalReflection,
} from '../../storage/reflectionStorage';

const EveningCloseButton = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  return (
    <TouchableOpacity
      style={{ position: 'absolute', top: insets.top + 8, right: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.cardBackground, alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onPress={() => { Keyboard.dismiss(); exitEveningFlow(navigation, 'Today'); }}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="close" size={17} color={Colors.sage} />
    </TouchableOpacity>
  );
};

const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;

const StepShell: React.FC<{
  eyebrow: string;
  title: string;
  iconName: any;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ eyebrow, title, iconName, children, footer }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
      <View style={styles.focusLabelContainer}>
        <Ionicons name={iconName} size={16} color={Colors.sage} style={styles.labelIcon} />
        <ThemedText weight="semiBold" style={styles.eyebrow}>{eyebrow}</ThemedText>
      </View>
      <ThemedText style={styles.title}>{title}</ThemedText>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {children}
      </KeyboardAvoidingView>
      {footer}
      <EveningCloseButton />
    </View>
  );
};

const NextButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const insets = useSafeAreaInsets();
  const { bottom: buttonPosition } = useFloatingKeyboardButton(insets.bottom);



  return (
    <Animated.View
      style={[styles.nextButtonFloat, { bottom: buttonPosition }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.nextButtonTouchable}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Next"
        onPress={() => {
          triggerLightHaptic();
          onPress();
        }}
      >
        <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const SageNextButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const insets = useSafeAreaInsets();
  const { bottom: buttonPosition } = useFloatingKeyboardButton(insets.bottom);



  return (
    <Animated.View
      style={[styles.sagePrimaryButton, { bottom: buttonPosition }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.nextButtonTouchable}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Next"
        onPress={() => {
          triggerLightHaptic();
          onPress();
        }}
      >
        <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const SageNoteInput: React.FC<{ value: string; onChangeText: (text: string) => void; placeholder: string }> = ({
  value,
  onChangeText,
  placeholder,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  return (
    <TextInput
      style={[styles.sageInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
      multiline
      placeholder={placeholder}
      placeholderTextColor={Colors.textGray}
      value={value}
      onChangeText={onChangeText}
      textAlignVertical="top"
      autoFocus
      keyboardAppearance="light"
    />
  );
};

const SageStepFooter: React.FC<{ hint: string }> = ({ hint }) => (
  <View style={styles.sageMetadataContainer}>
    <View style={styles.sageVerticalLine} />
    <View style={styles.sageMetadataContent}>
      <ThemedText style={styles.sageMetadataText}>{hint}</ThemedText>
    </View>
  </View>
);

const SageStepShell: React.FC<{
  eyebrow: string;
  title: string;
  Icon: any;
  iconName: any;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ eyebrow, title, Icon, iconName, children, footer }) => {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  React.useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <View style={styles.sageContainer}>
      <ScrollView
        style={styles.sageStepScroll}
        contentContainerStyle={[
          styles.sageStepContent,
          IS_IPAD && styles.sageStepContentPad,
          { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: keyboardVisible ? 320 : 30 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sageFocusLabelContainer}>
          <Icon name={iconName} size={16} color={Colors.sage} style={styles.sageLabelIcon} />
          <ThemedText weight="semiBold" style={styles.sageEyebrow}>{eyebrow}</ThemedText>
        </View>
        <View style={styles.sageTitleRow}>
          <ThemedText weight="semiBold" style={styles.sageStepTitle}>{title}</ThemedText>
        </View>
        {children}
      </ScrollView>
      {footer}
      <EveningCloseButton />
    </View>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _EveningGratitudeScreenOld: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params ?? {};
  const { currentFont } = useTheme();
  const fontRegular = getFontFamily(currentFont || 'lexend', 'regular');

  const selectedDate = params.selectedDate ? fromLocalDateString(params.selectedDate) : new Date();
  const dateStr = toLocalDateString(selectedDate);

  const [items, setItems] = useState<string[]>(['', '', '']);
  const [gratitudeId, setGratitudeId] = useState<string | null>(params.gratitudeId || null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const entries = await getLocalJournalEntries('gratitude', dateStr);
      const existing = entries.find(e => !e.metadata?.subtask_id) || entries[0];
      if (!existing || !mounted) {return;}
      try {
        const parsed = typeof existing.content === 'string'
          ? JSON.parse(existing.content)
          : existing.content;
        if (Array.isArray(parsed?.items)) {
          setItems(parsed.items);
          setGratitudeId(existing.id);
        }
      } catch (error) {
        console.warn('Error loading evening gratitude:', error);
      }
    })();
    return () => { mounted = false; };
  }, [dateStr]);

  const updateItem = (index: number, text: string) => {
    const next = [...items];
    next[index] = text;
    setItems(next);
  };

  const onNext = async () => {
    triggerLightHaptic();
    const filled = items.map((item) => item.trim()).filter(Boolean);
    const content = JSON.stringify({ items: filled });

    let id = gratitudeId;
    try {
      if (id) {
        const existing = await getLocalJournalEntry(id, 'gratitude', dateStr);
        if (existing) {
          const updated = await updateLocalJournalEntry({
            ...existing,
            content,
            metadata: { ...existing.metadata, source: 'evening' },
          });
          id = updated.id;
        } else {
          const created = await createLocalJournalEntry({
            content_type: 'gratitude',
            selected_date: dateStr,
            content,
            metadata: { source: 'evening' },
          });
          id = created.id;
        }
      } else {
        const created = await createLocalJournalEntry({
          content_type: 'gratitude',
          selected_date: dateStr,
          content,
          metadata: { source: 'evening' },
        });
        id = created.id;
      }
      setGratitudeId(id);
    } catch (error) {
      console.error('Error saving evening gratitude:', error);
    }

    navigation.navigate('Win', { ...params, selectedDate: dateStr, gratitude: filled.join('\n'), gratitudeItems: items, gratitudeId: id });
  };

  return (
    <StepShell
      eyebrow="EVENING"
      title="What are you grateful for today?"
      iconName="heart-outline"
      footer={<NextButton onPress={onNext} />}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.gratitudeContent, { paddingBottom: Math.max(insets.bottom, 16) + 80 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {items.map((item, index) => (
          <View key={`${index}`} style={styles.gratitudeRow}>
            <View style={styles.gratitudeNumber}>
              <ThemedText weight="bold" style={styles.gratitudeNumberText}>{index + 1}</ThemedText>
            </View>
            <TextInput
              style={[styles.gratitudeInput, { fontFamily: fontRegular }]}
              value={item}
              onChangeText={(text) => updateItem(index, text)}
              placeholder="I am grateful for..."
              placeholderTextColor={Colors.textGray}
              multiline
              textAlignVertical="center"
              returnKeyType={index < items.length - 1 ? 'next' : 'default'}
              blurOnSubmit={false}
            />
          </View>
        ))}
        <TouchableOpacity
          onPress={() => setItems([...items, ''])}
          activeOpacity={0.7}
          style={styles.addAnotherButton}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={18} color={Colors.sage} style={{ marginRight: 6 }} />
          <ThemedText weight="medium" style={styles.addAnotherText}>Add another</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </StepShell>
  );
};

// Evening Proverbs reader now lives in EveningProverbsScreen.tsx

export const EveningCarryWisdomScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { selectedDate, markStepCompleted } = useRoutine();
  const params = route.params ?? {};
  const { currentFont } = useTheme();
  const inputFont = getFontFamily(currentFont || 'lexend', 'regular');
  const [text, setText] = useState('');
  const [hasTappedChoice, setHasTappedChoice] = useState(false);
  const applicationInputRefs = React.useRef<Record<string, TextInput | null>>({});
  const wisdomScrollRef = React.useRef<ScrollView>(null);
  const [applications, setApplications] = useState<Record<string, string>>({});
  const [focusedInsightId, setFocusedInsightId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [customWisdom, setCustomWisdom] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const chapter = Number(params.proverbNumber || selectedDate.split('-')[2]);
  const reflection = getProverbReflection(chapter);
  const selectedInsights = selectedIds.flatMap(id => reflection?.insights.filter(insight => insight.id === id) || []);
  const customValue = showCustom ? customWisdom.trim() : '';
  const canContinue = !loading && !saving && (selectedInsights.length > 0 || customValue.length > 0);
  const clearDraft = useRoutineDraft(
    'evening', selectedDate, 'wisdom',
    { selectedIds, applications, showCustom, customWisdom, text },
    draft => {
      setSelectedIds(draft.selectedIds ?? []);
      setApplications(draft.applications ?? {});
      setShowCustom(Boolean(draft.showCustom));
      setCustomWisdom(draft.customWisdom ?? '');
      setText(draft.text ?? '');
    },
  );

  const scrollToApplication = React.useCallback(() => {
    if (!focusedInsightId) {return;}
    const input = applicationInputRefs.current[focusedInsightId];
    if (input?.isFocused()) {
      wisdomScrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(input, 24, true);
    }
  }, [focusedInsightId]);

  React.useEffect(() => {
    if (!focusedInsightId) {return;}
    const frame = requestAnimationFrame(() => applicationInputRefs.current[focusedInsightId]?.focus());
    // Scroll once after the keyboard settles, with a small clearance.
    const timeout = setTimeout(scrollToApplication, 350);
    return () => { cancelAnimationFrame(frame); clearTimeout(timeout); };
  }, [focusedInsightId, selectedIds, scrollToApplication]);

  const [proverbReflectionId, setProverbReflectionId] = useState<string | null>(params.proverbReflectionId || null);

  const dateStr = selectedDate;

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const entries = await getLocalReflections('scripture', dateStr);
      if (!mounted) {return;}
      const existing = entries.find(e => e.source === 'evening_proverbs' || e.metadata?.source === 'evening_proverbs');
      if (existing) {
        const metadata = existing.metadata || {};
        setSelectedIds(metadata.selectedWisdomIds || []);
        setCustomWisdom(metadata.customWisdom || '');
        setShowCustom(Boolean(metadata.customWisdom));
        // Preserve reflections written before selectable insights were introduced.
        setApplications(metadata.wisdomApplications || {});
        setText(metadata.wisdomApplication ?? (metadata.wisdomApplications ? '' : existing.content) ?? '');
        setProverbReflectionId(existing.id);
      }
      setLoading(false);
    })().catch(error => { console.error('Error loading wisdom reflection:', error); if (mounted) {setLoading(false);} });
    return () => { mounted = false; };
  }, [dateStr]);

  const onNext = async () => {
    if (!canContinue) {return;}
    setSaving(true);
    triggerLightHaptic();

    const title = params.proverbReference || `Proverbs ${chapter}`;
    const content = [...selectedInsights.map(insight => [ `${insight.label} (${insight.verses})`, (applications[insight.id] || '').trim() ].filter(Boolean).join('\n')), customValue, text.trim()].filter(Boolean).join('\n\n');
    const metadata = {
      source: 'evening_proverbs',
      proverbNumber: chapter,
      selectedWisdomIds: selectedInsights.map(insight => insight.id),
      selectedWisdom: selectedInsights,
      customWisdom: customValue,
      wisdomApplication: text.trim(),
      wisdomApplications: Object.fromEntries(selectedInsights.map(insight => [insight.id, (applications[insight.id] || '').trim()])),
      proverbReference: params.proverbReference,
    };

    let id = proverbReflectionId;
    try {
      if (id) {
        const existing = await getLocalReflection(id, 'scripture', dateStr);
        if (existing) {
          const updated = await updateLocalReflection({
            ...existing,
            title,
            content,
            metadata: { ...existing.metadata, ...metadata },
          });
          id = updated.id;
        } else {
          const created = await createLocalReflection({
            title,
            content,
            type: 'scripture',
            source: 'evening_proverbs',
            selected_date: dateStr,
            metadata,
          });
          id = created.id;
        }
      } else {
        const created = await createLocalReflection({
          title,
          content,
          type: 'scripture',
          source: 'evening_proverbs',
          selected_date: dateStr,
          metadata,
        });
        id = created.id;
      }
      setProverbReflectionId(id);
    } catch (error) {
      console.error('Error saving evening proverbs reflection:', error);
      setSaving(false);
      return;
    }

    if (!id) { setSaving(false); return; }

    try {
      await clearDraft();
      await markStepCompleted('wisdom', {
        domain: 'reflection',
        content_type: 'scripture',
        local_id: id,
      });

      DeviceEventEmitter.emit('reflection_saved', { type: 'evening_wisdom', date: dateStr });

      navigation.navigate('LookingForward', {
        ...params,
        selectedDate,
        wisdom: content,
        proverbReflectionId: id,
      });
    } catch (error) {
      console.error('Error completing wisdom step:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoutineStepShell
      scrollViewRef={wisdomScrollRef}
      manageStatusBar={false}
      step={4}
      totalSteps={6}
      eyebrow="WISDOM"
      eyebrowIcon={<Ionicons name="bulb-outline" size={16} color={Colors.sage} />}
      extraScrollBottomPadding={100}
      title="What wisdom stands out to you?"
      backgroundColor={Colors.lightBackground}
      onBack={() => { Keyboard.dismiss(); exitEveningFlow(navigation, 'Today'); }}
      footer={hasTappedChoice && (selectedInsights.length > 0 || customValue.length > 0) ? (
        <TouchableOpacity style={[styles.wisdomNext, !canContinue && { opacity: 0.35 }]} disabled={!canContinue} onPress={onNext} accessibilityRole="button" accessibilityLabel="Next" accessibilityState={{ disabled: !canContinue, busy: saving }} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
      ) : null}
    >
      <ThemedText style={styles.wisdomSubtitle}>Choose what stands out in Proverbs {chapter}.</ThemedText>
      <View style={styles.wisdomChoices}>
        {reflection?.insights.map(insight => {
          const selected = selectedIds.includes(insight.id);
          return (
            <TouchableOpacity
              key={insight.id}
              style={[styles.wisdomChoice, selected && styles.wisdomChoiceSelected]}
              onPress={() => { setHasTappedChoice(true); triggerLightHaptic(); setSelectedIds(ids => selected ? ids.filter(id => id !== insight.id) : [...ids, insight.id]); if (!selected) {setFocusedInsightId(insight.id);} else {setFocusedInsightId(null);} }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: loading || saving }}
              accessibilityLabel={`${insight.label}, ${insight.verses}`}
              disabled={loading || saving}
            >
              <ThemedText style={selected ? styles.wisdomSelectedText : styles.wisdomChoiceText}>{insight.label}</ThemedText>
              <ThemedText style={[styles.wisdomReference, selected && styles.wisdomSelectedText]}>{insight.verses}</ThemedText>
            </TouchableOpacity>
          );
        })}
        <View style={{ width: '100%', alignItems: 'center' }}>
        <TouchableOpacity
          style={[styles.wisdomChoice, showCustom && styles.wisdomChoiceSelected]}
          onPress={() => { setHasTappedChoice(true); setFocusedInsightId(null); setShowCustom(value => !value); }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: showCustom }}
          disabled={loading || saving}
        >
          <ThemedText style={showCustom ? styles.wisdomSelectedText : styles.wisdomChoiceText}>+ Something else</ThemedText>
        </TouchableOpacity>
        </View>
      </View>
      {showCustom && (
        <TextInput autoFocus={hasTappedChoice} style={[styles.sageInput, styles.wisdomNoteInput, { fontFamily: inputFont, marginTop: 16 }]} value={customWisdom} onChangeText={setCustomWisdom} placeholder="Another insight from this chapter…" placeholderTextColor={Colors.textGray} multiline editable={!loading && !saving} keyboardAppearance="light" />
      )}
      {hasTappedChoice && selectedInsights.map((insight, index) => (
        <View key={insight.id}>
          <WisdomScripturePassage first={index === 0} reference={insight.verses} version={params.proverbVersion || 'NASB'} />
          <ThemedText style={styles.wisdomApplicationLabel}>{insight.prompt}</ThemedText>
          <TextInput
            ref={input => { applicationInputRefs.current[insight.id] = input; }}
            style={[styles.sageInput, styles.wisdomNoteInput, { fontFamily: inputFont }]}
            value={applications[insight.id] || ''}
            onChangeText={value => setApplications(notes => ({ ...notes, [insight.id]: value }))}
            placeholder="A conversation, a choice, or a small step…"
            placeholderTextColor={Colors.textGray}
            accessibilityLabel={insight.prompt}
            multiline
            editable={!loading && !saving}
            keyboardAppearance="light"
          />
        </View>
      ))}
    </RoutineStepShell>
  );
};

export const EveningClosingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { completeRoutine, selectedDate, contentRefs, completed } = useRoutine();
  const params = route.params ?? {};
  const [showAllGratitude, setShowAllGratitude] = useState(false);
  const [showAllWisdom, setShowAllWisdom] = useState(false);
  const [shareDropdownOpen, setShareDropdownOpen] = useState(false);
  const moonMotion = React.useRef(new Animated.Value(0)).current;

  useFocusEffect(React.useCallback(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(moonMotion, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(moonMotion, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => { animation.stop(); moonMotion.setValue(0); };
  }, [moonMotion]));
  const [summary, setSummary] = useState({
    gratitude: params.gratitude || '',
    win: params.win || '',
    winContext: params.winContext || '',
    proverbNumber: params.proverbNumber,
    proverbReference: params.proverbReference || '',
    proverbRead: false,
    wisdom: params.wisdom || '',
    wisdomChoices: [] as { id: string; label: string; verses: string; note: string }[],
    customWisdom: '',
    wisdomApplication: '',
    lookingForward: params.lookingForward || '',
    lookingForwardContext: params.lookingForwardContext || '',
    lookingForwardIcon: params.lookingForwardIcon || '',
  });
  const gratitudeItems = summary.gratitude.split('\n').filter((item: string) => item.trim());
  const visibleGratitude = showAllGratitude ? gratitudeItems : gratitudeItems.slice(0, 3);
  const wisdomItems = [
    ...summary.wisdomChoices,
    ...(summary.customWisdom ? [{ id: 'custom', label: summary.customWisdom, verses: '', note: summary.wisdomApplication }] : []),
  ];
  const visibleWisdom = showAllWisdom ? wisdomItems : wisdomItems.slice(0, 1);
  const dateStr = selectedDate;

  React.useEffect(() => {
    let active = true;
    const latestRef = (key: string) => {
      const ref = contentRefs[key];
      return Array.isArray(ref) ? ref[ref.length - 1] : ref;
    };
    const parse = (content: any) => typeof content === 'string' ? JSON.parse(content) : content;
    (async () => {
      const patch: Partial<typeof summary> = {};
      for (const key of ['gratitude', 'win', 'looking_forward']) {
        const ref = latestRef(key);
        if (!ref) {continue;}
        const entry = key === 'gratitude'
          ? await getLocalJournalEntry(ref.local_id, 'gratitude', dateStr)
          : await getLocalJournalSingleton(key === 'win' ? 'today_win' : 'looking_forward', dateStr);
        if (!entry) {continue;}
        const content = parse(entry.content);
        if (key === 'gratitude') {patch.gratitude = (content.items || []).join('\n');}
        if (key === 'win') {
          patch.win = content.quietWin || content.winTypeName || '';
          patch.winContext = content.winTypeName || '';
        }
        if (key === 'looking_forward') {
          patch.lookingForward = content.entry?.text || '';
          patch.lookingForwardContext = content.emotionName || '';
          patch.lookingForwardIcon = content.emotionIcon || LOOKING_FORWARD_EMOTIONS.find(emotion => emotion.id === content.emotionId)?.icon || '';
        }
      }
      const scriptureRef = latestRef('wisdom') || latestRef('proverbs');
      if (scriptureRef) {
        const entry = await getLocalReflection(scriptureRef.local_id, 'scripture', dateStr);
        if (entry) {
          patch.proverbNumber = entry.metadata?.proverbNumber;
          patch.proverbReference = entry.metadata?.proverbReference || entry.title;
          patch.proverbRead = Boolean(entry.metadata?.proverbRead);
          patch.wisdom = entry.content || '';
          patch.wisdomChoices = (entry.metadata?.selectedWisdom || []).map((insight: any) => ({
            id: insight.id,
            label: insight.label,
            verses: insight.verses,
            note: entry.metadata?.wisdomApplications?.[insight.id] || '',
          }));
          patch.customWisdom = entry.metadata?.customWisdom || '';
          patch.wisdomApplication = entry.metadata?.wisdomApplication || '';
        }
      }
      if (active) {setSummary(current => ({ ...current, ...patch }));}
    })().catch(error => console.error('Error loading evening summary:', error));
    return () => { active = false; };
  }, [contentRefs, dateStr]);

  const onDone = async () => {
    triggerLightHaptic();

    if (completed) {
      exitEveningFlow(navigation, 'Today');
      return;
    }

    try {
      await completeRoutine();
    } catch (error) {
      console.error('Error saving evening routine state:', error);
      return;
    }

    DeviceEventEmitter.emit('reflection_saved', { type: 'evening_complete', date: dateStr });

    exitEveningFlow(navigation, 'Moments');
  };

  return (
    <View style={[styles.closingContainer, { paddingTop: insets.top }]}>
      <TouchableOpacity
        style={[styles.closingShareButton, { top: insets.top + 8 }]}
        onPress={() => { triggerLightHaptic(); setShareDropdownOpen(true); }}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Share evening routine"
      >
        <Ionicons name="paper-plane-outline" size={17} color={Colors.sage} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.closingEditButton, { top: insets.top + 8 }]}
        onPress={() => { triggerLightHaptic(); navigation.navigate('Gratitude'); }}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Edit evening routine"
      >
        <Pencil size={17} color={Colors.sage} strokeWidth={1.8} />
      </TouchableOpacity>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.closingScrollContent}
        bounces={false}
        overScrollMode="never"
      >
        <View style={styles.closingCompletionHeader}>
          <View style={styles.closingCheckCircle}>
            <Animated.View style={{ transform: [
              { rotate: moonMotion.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) },
              { translateY: moonMotion.interpolate({ inputRange: [0, 1], outputRange: [1, -2] }) },
            ] }}>
              <Ionicons name="moon-outline" size={26} color={Colors.hopeWhite} />
            </Animated.View>
          </View>
          <View style={styles.closingCompletionHeaderText}>
            <ThemedText style={styles.closingTitle}>Your evening is reflected.</ThemedText>
            <ThemedText style={styles.closingSubtitle}>Today is held in God’s hands.</ThemedText>
          </View>
        </View>

        <View style={styles.closingGlanceSection}>
          <ThemedText weight="semiBold" style={styles.closingSectionEyebrow}>TONIGHT AT A GLANCE</ThemedText>
          <View style={styles.closingGlanceGrid}>
            <TouchableOpacity
              style={[styles.closingGlanceColumn, styles.closingGlanceColumnBorder]}
              onPress={() => { triggerLightHaptic(); navigation.navigate('Gratitude'); }}
              accessibilityRole="button"
              accessibilityLabel="Edit gratitude"
              activeOpacity={0.75}
            >
              <ThemedText style={styles.closingGlanceLabel}>Gratitude</ThemedText>
              {gratitudeItems.length > 0 ? visibleGratitude.map((item: string, index: number) => (
                <View key={index} style={styles.closingGratitudeItem}>
                  <Ionicons name="heart" size={14} color={Colors.sage} style={{ marginTop: 3 }} />
                  <ThemedText style={styles.closingGratitudeText}>{item}</ThemedText>
                </View>
              )) : <ThemedText style={styles.closingGratitudeText}>—</ThemedText>}
              {gratitudeItems.length > 3 ? (
                <TouchableOpacity
                  onPress={(event) => {
                    event.stopPropagation();
                    triggerLightHaptic();
                    setShowAllGratitude(value => !value);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={showAllGratitude ? 'Show fewer gratitude entries' : `Show ${gratitudeItems.length - 3} more gratitude entries`}
                >
                  <ThemedText weight="semiBold" style={styles.closingGratitudeToggle}>
                    {showAllGratitude ? 'Show less' : `Show ${gratitudeItems.length - 3} more`}
                  </ThemedText>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
            <View style={styles.closingGlanceColumn}>
              <TouchableOpacity
                onPress={() => { triggerLightHaptic(); navigation.navigate('Win'); }}
                accessibilityRole="button"
                accessibilityLabel="Edit today's win"
                activeOpacity={0.75}
              >
              <ThemedText style={styles.closingGlanceLabel}>Win</ThemedText>
              <View style={styles.closingValueWithIcon}>
                <Ionicons name="trophy" size={18} color={Colors.sage} />
                <ThemedText weight="semiBold" style={styles.closingGlanceValue}>{summary.winContext || summary.win || '—'}</ThemedText>
              </View>
              {summary.win && summary.win !== summary.winContext ? <ThemedText style={styles.closingGlanceSubtext}>{summary.win}</ThemedText> : null}
              </TouchableOpacity>
          <TouchableOpacity
            style={{ marginTop: 14 }}
            onPress={() => { triggerLightHaptic(); navigation.navigate('LookingForward'); }}
            accessibilityRole="button"
            accessibilityLabel="Edit looking forward reflection"
            activeOpacity={0.75}
          >
            <ThemedText style={styles.closingGlanceLabel}>Looking forward</ThemedText>
            <ThemedText weight="semiBold" style={styles.closingGlanceValue}>{summary.lookingForward || 'Nothing added'}</ThemedText>
            {summary.lookingForwardContext ? (
              <View style={[styles.closingValueWithIcon, { marginTop: 5 }]}>
                {summary.lookingForwardIcon ? <MaterialCommunityIcons name={summary.lookingForwardIcon} size={18} color={Colors.sage} /> : null}
                <ThemedText style={[styles.closingGlanceSubtext, { marginTop: 0 }]}>{summary.lookingForwardContext}</ThemedText>
              </View>
            ) : null}
          </TouchableOpacity>
            </View>
          </View>

        </View>

        <View style={styles.closingScriptureCard}>
          <View style={styles.closingScriptureColumns}>
          <TouchableOpacity
            style={styles.closingScriptureLeftColumn}
            onPress={() => { triggerLightHaptic(); navigation.navigate('Proverbs'); }}
            accessibilityRole="button"
            accessibilityLabel="Edit evening Proverbs reflection"
            activeOpacity={0.75}
          >
          <View style={styles.closingScriptureHeader}>
            <ThemedText weight="semiBold" style={styles.closingSectionEyebrow}>EVENING PROVERBS</ThemedText>
            <ThemedText weight="bold" style={styles.closingScriptureTitle}>{summary.proverbNumber ? `Proverbs ${summary.proverbNumber}` : summary.proverbReference || 'Proverbs'}</ThemedText>
          </View>
          <View style={styles.closingReadStatus}>
            <View style={[styles.closingReadStatusIcon, !summary.proverbRead && styles.closingReadStatusIconInactive]}>
              {summary.proverbRead ? <Ionicons name="checkmark" size={14} color={Colors.hopeWhite} /> : <MaterialCommunityIcons name="progress-star" size={14} color={Colors.sage} />}
            </View>
            <ThemedText weight="semiBold" style={styles.closingReadStatusText}>{summary.proverbRead ? 'Full chapter read' : 'Reading in progress'}</ThemedText>
          </View>
          </TouchableOpacity>
          <View style={styles.closingScriptureRightColumn}>
          <ThemedText style={styles.closingScripturePrompt}>Wisdom you’re carrying into tomorrow</ThemedText>
          {wisdomItems.length > 0 ? (
            <View>
              {visibleWisdom.map((insight, index) => (
                <View key={insight.id} style={index > 0 ? { marginTop: 12 } : undefined}>
                  <ThemedText weight="bold" style={styles.closingScriptureAnswer}>{insight.label}</ThemedText>
                  {insight.verses ? <ThemedText style={styles.closingWisdomReference}>{insight.verses}</ThemedText> : null}
                  {insight.note ? <ThemedText style={styles.closingWisdomNote}>{insight.note}</ThemedText> : null}
                </View>
              ))}
              {!summary.customWisdom && summary.wisdomApplication ? <ThemedText style={styles.closingWisdomNote}>{summary.wisdomApplication}</ThemedText> : null}
              {wisdomItems.length > 1 ? (
                <TouchableOpacity
                  onPress={() => { triggerLightHaptic(); setShowAllWisdom(value => !value); }}
                  style={styles.closingViewAllButton}
                  accessibilityRole="button"
                  accessibilityLabel={showAllWisdom ? 'Show fewer wisdom reflections' : 'View all wisdom reflections'}
                  accessibilityState={{ expanded: showAllWisdom }}
                >
                  <ThemedText weight="medium" style={styles.closingViewAllText}>{showAllWisdom ? 'Show less' : `View all (${wisdomItems.length})`}</ThemedText>
                  <Ionicons name={showAllWisdom ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.sage} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : <ThemedText weight="bold" style={summary.wisdom ? styles.closingScriptureAnswer : styles.closingScriptureAnswerMuted}>{summary.wisdom || 'Nothing selected'}</ThemedText>}
          </View>
          </View>
        </View>

        <View style={styles.closingAsYouGo}>
          <ThemedText weight="semiBold" style={styles.closingSectionEyebrow}>AS YOU REST</ThemedText>
          <ThemedText weight="bold" style={styles.closingReminderText}>
            Release today into God’s hands.{'\n'}Rest well.
          </ThemedText>
        </View>
      </ScrollView>

      <View style={[styles.closingFooter, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity
          style={styles.closingDoneButton}
          activeOpacity={0.8}
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Save and finish"
        >
          <ThemedText weight="semiBold" style={styles.closingDoneButtonText}>{completed ? 'Done' : 'Save & Finish'}</ThemedText>
        </TouchableOpacity>
      </View>
      <ShareDropdownModal
        visible={shareDropdownOpen}
        onClose={() => setShareDropdownOpen(false)}
        onExportPDF={() => {}}
        hideExportPDF
        shareTitle="Share Journal by siFia with friends"
        shareText="I reflected on my day with God using Journal by siFia."
      />
    </View>
  );
};

const SummaryRow: React.FC<{ label: string; value: string; context?: string; last?: boolean }> = ({ label, value, context, last }) => (
  <View style={last ? styles.summaryRowLast : styles.summaryRow}>
    <ThemedText style={styles.summaryLabel}>{label}</ThemedText>
    <View style={styles.summaryRight}>
      <ThemedText weight="medium" style={styles.summaryValue}>{value}</ThemedText>
      {context ? <ThemedText style={styles.summaryContext}>{context}</ThemedText> : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  wisdomSubtitle: { fontSize: 14, color: Colors.textGray, textAlign: 'center', marginBottom: 24 },
  wisdomChoices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 12, rowGap: 8 },
  wisdomChoice: { borderRadius: 28, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: 'rgba(82, 106, 91, 0.08)', borderWidth: 0.5, borderColor: 'rgba(82, 106, 91, 0.2)' },
  wisdomChoiceSelected: { backgroundColor: Colors.sageMuted, borderColor: Colors.sage },
  wisdomChoiceText: { fontSize: 15, color: Colors.text, textAlign: 'center' },
  wisdomSelectedText: { fontSize: 15, color: Colors.hopeWhite, textAlign: 'center' },
  wisdomReference: { fontSize: 12, marginTop: 4, color: Colors.textGray, textAlign: 'center' },
  wisdomNoteInput: { minHeight: 56, paddingVertical: 6 },
  wisdomApplicationLabel: { marginTop: 12, fontSize: 18, color: Colors.text },
  wisdomNext: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.sage, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
    paddingHorizontal: 18,
  },
  focusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 32,
  },
  labelIcon: {
    marginTop: 1,
  },
  eyebrow: {
    color: Colors.sageMuted,
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.8,
  },
  title: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontWeight: '900',
    fontSize: 24,
    lineHeight: 30,
    marginTop: 8,
    marginBottom: 32,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 16,
    color: Colors.text,
    fontSize: 18,
    lineHeight: 26,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  metadataContainer: {
    marginTop: 32,
    marginBottom: 80,
    flexDirection: 'row',
  },
  verticalLine: {
    width: 1,
    backgroundColor: Colors.text,
    opacity: 0.3,
    marginRight: 12,
    borderRadius: 2,
    height: 75,
  },
  metadataContent: {
    flex: 1,
  },
  metadataText: {
    fontSize: 12,
    color: Colors.textGray,
    opacity: 0.6,
    lineHeight: 16,
  },
  nextButtonFloat: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  nextButtonTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
    overflow: 'hidden',
  },
  proverbScroll: {
    flex: 1,
  },
  proverbContent: {
    paddingBottom: 8,
  },
  loader: {
    marginTop: 20,
  },
  proverbText: {
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 25,
  },
  proverbReference: {
    color: Colors.sage,
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    marginTop: 20,
    letterSpacing: 0.4,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'flex-end',
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
    marginBottom: 16,
  },
  subtitle: {
    color: Colors.textGray,
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 24,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  summaryRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 8,
  },
  summaryLabel: {
    color: Colors.textGray,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
    flexShrink: 1,
  },
  summaryValueMuted: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 20,
  },
  summaryRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    flexShrink: 1,
    gap: 2,
  },
  summaryContext: {
    color: Colors.sage,
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
  },
  doneButton: {
    backgroundColor: Colors.sage,
    borderWidth: 1,
    borderColor: Colors.sage,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  doneButtonText: {
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  gratitudeContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  gratitudeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  gratitudeNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  gratitudeNumberText: {
    color: Colors.hopeWhite,
    fontSize: 13,
    lineHeight: 16,
  },
  gratitudeInput: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
    color: Colors.text,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    paddingVertical: 8,
    minHeight: 46,
  },
  addAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  addAnotherText: {
    color: Colors.sage,
    fontSize: 15,
  },
  sageContainer: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
  },
  sageStepScroll: {
    flex: 1,
  },
  sageStepContent: {
    paddingHorizontal: 24,
  },
  sageStepContentPad: {
    paddingHorizontal: 160,
  },
  sageFocusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 32,
  },
  sageLabelIcon: {
    marginTop: 1,
  },
  sageEyebrow: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.sage,
  },
  sageTitleRow: {
    marginBottom: 16,
  },
  sageStepTitle: {
    fontSize: 24,
    color: Colors.text,
    lineHeight: 32,
    textAlign: 'center',
  },
  sageInput: {
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontSize: 18,
    color: Colors.text,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  sageMetadataContainer: {
    marginTop: 48,
    marginBottom: 24,
    flexDirection: 'row',
  },
  sageVerticalLine: {
    width: 1,
    backgroundColor: Colors.text,
    opacity: 0.3,
    marginRight: 12,
    borderRadius: 2,
    alignSelf: 'stretch',
  },
  sageMetadataContent: {
    flex: 1,
  },
  sageMetadataText: {
    fontSize: 12,
    color: Colors.textGray,
    opacity: 0.8,
    lineHeight: 16,
  },
  sagePrimaryButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.sage,
    borderRadius: 999,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  sagePrimaryButtonPad: {
    right: 48,
  },
  closingGratitudeItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginBottom: 8 },
  closingGratitudeText: { color: Colors.text, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  closingGratitudeToggle: { color: Colors.sage, fontSize: 12, lineHeight: 17, marginTop: 2 },
  closingValueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  closingScriptureColumns: { flexDirection: 'row' },
  closingScriptureLeftColumn: { flex: 1, paddingRight: 14, borderRightWidth: 1, borderRightColor: Colors.cardBorder },
  closingScriptureRightColumn: { flex: 1, paddingLeft: 14 },
  closingScriptureCard: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  closingScriptureHeader: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 10,
  },
  closingScriptureTitle: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 22,
  },
  closingReadStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  closingReadStatusIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closingReadStatusIconInactive: {
    backgroundColor: 'rgba(82, 106, 91, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.22)',
  },
  closingReadStatusText: {
    color: Colors.sage,
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  closingViewAllButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, paddingVertical: 4 },
  closingViewAllText: { fontSize: 12, color: Colors.sage },
  closingWisdomReference: { color: Colors.sageMuted, fontSize: 11, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 },
  closingWisdomNote: { color: Colors.textGray, fontSize: 13, lineHeight: 18, marginTop: 6 },
  closingScripturePrompt: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  closingScriptureAnswer: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 23,
  },
  closingScriptureAnswerMuted: {
    color: Colors.textGray,
    fontSize: 15,
    lineHeight: 21,
  },
  closingShareButton: { position: 'absolute', right: 18, zIndex: 100, width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.cardBackground, alignItems: 'center', justifyContent: 'center' },
  closingEditButton: { position: 'absolute', right: 70, zIndex: 100, width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.cardBackground, alignItems: 'center', justifyContent: 'center' },
  closingContainer: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
  },
  closingScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
  },
  closingCompletionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 54,
    marginBottom: 24,
  },
  closingCompletionHeaderText: {
    flex: 1,
  },
  closingCheckCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
  },
  closingTitle: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontWeight: '900',
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.6,
  },
  closingSubtitle: {
    color: Colors.textGray,
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 4,
  },
  closingGlanceSection: {
    marginBottom: 22,
  },
  closingSectionEyebrow: {
    color: Colors.sageMuted,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.8,

  },
  closingAsYouGo: {
    alignItems: 'center',
    marginTop: 22,
    paddingBottom: 8,
  },
  closingReminderText: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 8,
  },
  closingFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 10,
  },
  closingDoneButton: {
    flex: 1,
    minHeight: 56,
    backgroundColor: Colors.sage,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  closingDoneButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    letterSpacing: 0.2,
  },
  closingGlanceGrid: {
    flexDirection: 'row',
    marginTop: 14,
  },
  closingGlanceColumn: {
    flex: 1,
    paddingVertical: 2,
    paddingLeft: 22,
  },
  closingGlanceColumnBorder: {
    paddingLeft: 0,
    paddingRight: 22,
    borderRightWidth: 1,
    borderRightColor: Colors.cardBorder,
  },
  closingGlanceItem: {
    marginBottom: 20,
  },
  closingGlanceLabel: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  closingGlanceValue: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  closingTonightSummary: {
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    marginTop: 20,
    paddingTop: 18,
  },
  closingTonightSummaryValue: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 24,
  },
  closingGlanceSubtext: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
});

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../../components/common/ThemedText';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { triggerLightHaptic } from '../../utils/haptics';
import { toLocalDateString } from '../../utils/date';
import { getScripturePassage } from '../../services/scriptureReaderService';
import { useRoutine } from '../../context/RoutineContext';
import {
  createLocalJournalEntry,
  getLocalJournalEntry,
  getLocalJournalEntries,
  updateLocalJournalEntry,
} from '../../storage/journalStorage';
import {
  createLocalReflection,
  getLocalReflection,
  getLocalReflections,
  updateLocalReflection,
} from '../../storage/reflectionStorage';

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
    </View>
  );
};

const NextButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const insets = useSafeAreaInsets();
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;

  React.useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + (e.endCoordinates?.height || 325) + 20,
        useNativeDriver: false,
        tension: 80,
        friction: 12,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 20,
        useNativeDriver: false,
        tension: 80,
        friction: 12,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom, buttonPosition]);

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
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;

  React.useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + (e.endCoordinates?.height || 325) + 20,
        useNativeDriver: false,
        tension: 80,
        friction: 12,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 20,
        useNativeDriver: false,
        tension: 80,
        friction: 12,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom, buttonPosition]);

  return (
    <Animated.View
      style={[styles.sagePrimaryButton, IS_IPAD && styles.sagePrimaryButtonPad, { bottom: buttonPosition }]}
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

  const selectedDate = params.selectedDate ? new Date(params.selectedDate) : new Date();
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

export const EveningProverbsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { selectedDate, markStepCompleted } = useRoutine();
  const params = route.params ?? {};

  const proverbNumber = useMemo(() => {
    const day = parseInt(selectedDate.split('-')[2] || '0', 10);
    return Math.min(Math.max(day, 1), 31);
  }, [selectedDate]);

  const [text, setText] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getScripturePassage(`Proverbs ${proverbNumber}`)
      .then((result) => {
        if (cancelled) {return;}
        setText(result.text);
        setReference(result.reference);
      })
      .catch((err) => {
        if (cancelled) {return;}
        setError(err?.message || 'Could not load Proverbs of the Day.');
      })
      .finally(() => {
        if (!cancelled) {setLoading(false);}
      });
    return () => { cancelled = true; };
  }, [proverbNumber]);

  const onNext = async () => {
    triggerLightHaptic();
    await markStepCompleted('proverbs');
    navigation.navigate('CarryWisdom', {
      ...params,
      selectedDate,
      proverbNumber,
      proverbReference: reference || `Proverbs ${proverbNumber}`,
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
      <View style={styles.focusLabelContainer}>
        <Ionicons name="book-outline" size={16} color={Colors.sage} style={styles.labelIcon} />
        <ThemedText weight="semiBold" style={styles.eyebrow}>EVENING</ThemedText>
      </View>
      <ThemedText style={styles.title}>Proverbs {proverbNumber}</ThemedText>

      <View style={styles.card}>
        <ScrollView style={styles.proverbScroll} contentContainerStyle={[styles.proverbContent, { paddingBottom: Math.max(insets.bottom, 16) + 80 }]} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator color={Colors.text} style={styles.loader} />
          ) : error ? (
            <ThemedText style={styles.proverbText}>{error}</ThemedText>
          ) : (
            <>
              <ThemedText style={styles.proverbText}>{text}</ThemedText>
              {reference && (
                <ThemedText weight="semiBold" style={styles.proverbReference}>{reference}</ThemedText>
              )}
            </>
          )}
        </ScrollView>
      </View>

      <NextButton onPress={onNext} />
    </View>
  );
};

export const EveningCarryWisdomScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { selectedDate, markStepCompleted } = useRoutine();
  const params = route.params ?? {};
  const [text, setText] = useState('');
  const [proverbReflectionId, setProverbReflectionId] = useState<string | null>(params.proverbReflectionId || null);

  const dateStr = toLocalDateString(new Date(selectedDate));

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const entries = await getLocalReflections('scripture', dateStr);
      if (!mounted) {return;}
      const existing = entries.find(e => e.source === 'evening_proverbs' || e.metadata?.source === 'evening_proverbs');
      if (existing && existing.content) {
        setText(existing.content);
        setProverbReflectionId(existing.id);
      }
    })();
    return () => { mounted = false; };
  }, [dateStr]);

  const onNext = async () => {
    triggerLightHaptic();

    const title = params.proverbReference || `Proverbs ${params.proverbNumber}`;
    const content = text.trim();
    const metadata = {
      source: 'evening_proverbs',
      proverbNumber: params.proverbNumber,
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
            metadata,
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
    }

    if (!id) { return; }

    await markStepCompleted('wisdom', {
      domain: 'reflection',
      content_type: 'scripture',
      local_id: id,
    });

    navigation.navigate('LookingForward', {
      ...params,
      selectedDate,
      wisdom: text,
      proverbReflectionId: id,
    });
  };

  return (
    <SageStepShell
      eyebrow="WISDOM"
      title="What wisdom do you want to carry into tomorrow?"
      Icon={Ionicons}
      iconName="bulb-outline"
      footer={<SageNextButton onPress={onNext} />}
    >
      <SageNoteInput value={text} onChangeText={setText} placeholder="A lesson, a truth, or a posture..." />
      <SageStepFooter hint="A small word can shape a whole day." />
    </SageStepShell>
  );
};

export const EveningClosingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { completeRoutine } = useRoutine();
  const params = route.params ?? {};

  const onDone = async () => {
    triggerLightHaptic();

    try {
      await completeRoutine();
    } catch (error) {
      console.error('Error saving evening routine state:', error);
    }

    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent.goBack();
    } else {
      navigation.navigate('MainTabs', { screen: 'Today' });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
      <View style={styles.checkCircle}>
        <Ionicons name="checkmark" size={28} color={Colors.hopeWhite} />
      </View>
      <ThemedText style={styles.title}>Your evening is reflected.</ThemedText>
      <ThemedText style={styles.subtitle}>One save for the whole flow.</ThemedText>

      <View style={styles.summaryCard}>
        <SummaryRow label="Gratitude" value={params.gratitude || '—'} />
        <SummaryRow label="Win" value={params.win || '—'} context={params.winContext} />
        <SummaryRow label="Proverbs" value={params.proverbReference || '—'} />
        <SummaryRow label="Wisdom" value={params.wisdom || '—'} />
        <SummaryRow
          label="Looking forward"
          value={params.lookingForward || 'Nothing added'}
          context={params.lookingForwardContext}
          last
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.doneButton} activeOpacity={0.8} onPress={onDone}>
          <ThemedText weight="medium" style={styles.doneButtonText}>Done</ThemedText>
        </TouchableOpacity>
      </View>
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
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: 18,
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
    height: 75,
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
});

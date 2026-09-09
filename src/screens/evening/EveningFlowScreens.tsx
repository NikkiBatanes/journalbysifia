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
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { triggerLightHaptic } from '../../utils/haptics';
import { toLocalDateString } from '../../utils/date';
import { getScripturePassage } from '../../services/scriptureReaderService';
import { useCreateJournalEntry } from '../../services/hooks/useJournalData';

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
        toValue: insets.bottom + ((e.endCoordinates?.height || 325) * 0.95),
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

const NoteInput: React.FC<{ value: string; onChangeText: (text: string) => void; placeholder: string }> = ({
  value,
  onChangeText,
  placeholder,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  return (
    <TextInput
      style={[styles.input, { fontFamily: getFontFamily(fontKey, 'regular') }]}
      multiline
      placeholder={placeholder}
      placeholderTextColor={Colors.textGray}
      value={value}
      onChangeText={onChangeText}
      textAlignVertical="top"
      autoFocus
    />
  );
};

const StepFooter: React.FC<{ hint: string }> = ({ hint }) => (
  <View style={styles.metadataContainer}>
    <View style={styles.verticalLine} />
    <View style={styles.metadataContent}>
      <ThemedText style={styles.metadataText}>{hint}</ThemedText>
    </View>
  </View>
);

export const EveningGratitudeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params ?? {};
  const { currentFont } = useTheme();
  const fontRegular = getFontFamily(currentFont || 'lexend', 'regular');

  const initialItems = Array.isArray(params.gratitudeItems) && params.gratitudeItems.length > 0
    ? params.gratitudeItems
    : ['', '', ''];
  const [items, setItems] = useState<string[]>(initialItems);

  const updateItem = (index: number, text: string) => {
    const next = [...items];
    next[index] = text;
    setItems(next);
  };

  const onNext = () => {
    triggerLightHaptic();
    const filled = items.map((item) => item.trim()).filter(Boolean);
    navigation.navigate('Win', { ...params, gratitude: filled.join('\n'), gratitudeItems: items });
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

export const EveningWinScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params ?? {};
  const [text, setText] = useState('');

  const onNext = () => {
    triggerLightHaptic();
    navigation.navigate('Proverbs', { ...params, win: text });
  };

  return (
    <StepShell
      eyebrow="EVENING"
      title="What was a win today?"
      iconName="trophy-outline"
      footer={<NextButton onPress={onNext} />}
    >
      <NoteInput value={text} onChangeText={setText} placeholder="A moment, a choice, or a step forward..." />
      <StepFooter hint="Wins are not always loud. Notice the quiet ones too." />
    </StepShell>
  );
};

export const EveningProverbsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params ?? {};

  const proverbNumber = useMemo(() => {
    const day = new Date().getDate();
    return Math.min(Math.max(day, 1), 31);
  }, []);

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
        if (cancelled) return;
        setText(result.text);
        setReference(result.reference);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Could not load Proverbs of the Day.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [proverbNumber]);

  const onNext = () => {
    triggerLightHaptic();
    navigation.navigate('CarryWisdom', { ...params, proverbNumber, proverbReference: reference || `Proverbs ${proverbNumber}` });
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
  const params = route.params ?? {};
  const [text, setText] = useState('');

  const onNext = () => {
    triggerLightHaptic();
    navigation.navigate('LookingForward', { ...params, wisdom: text });
  };

  return (
    <StepShell
      eyebrow="EVENING"
      title="What wisdom do you want to carry into tomorrow?"
      iconName="bulb-outline"
      footer={<NextButton onPress={onNext} />}
    >
      <NoteInput value={text} onChangeText={setText} placeholder="A lesson, a truth, or a posture..." />
      <StepFooter hint="A small word can shape a whole day." />
    </StepShell>
  );
};

export const EveningLookingForwardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params ?? {};
  const [text, setText] = useState('');

  const onNext = () => {
    triggerLightHaptic();
    navigation.navigate('EveningClosing', { ...params, lookingForward: text });
  };

  return (
    <StepShell
      eyebrow="EVENING"
      title="What are you looking forward to?"
      iconName="sunny-outline"
      footer={<NextButton onPress={onNext} />}
    >
      <NoteInput value={text} onChangeText={setText} placeholder="Something that gives you hope for tomorrow..." />
      <StepFooter hint="Hope looks ahead with gentle expectation." />
    </StepShell>
  );
};

export const EveningClosingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const createMutation = useCreateJournalEntry();
  const params = route.params ?? {};

  const selectedDate = params.selectedDate ? new Date(params.selectedDate) : new Date();
  const dateStr = toLocalDateString(selectedDate);

  const onDone = async () => {
    triggerLightHaptic();
    if (user) {
      try {
        const content = JSON.stringify({
          gratitude: params.gratitude,
          win: params.win,
          proverbNumber: params.proverbNumber,
          proverbReference: params.proverbReference,
          wisdom: params.wisdom,
          lookingForward: params.lookingForward,
        });
        await createMutation.mutateAsync({
          user_id: user.id,
          selected_date: dateStr,
          content_type: 'evening_flow',
          content,
        });
      } catch (error) {
        // Handled silently; continue to close the flow.
      }
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
        <SummaryRow label="Win" value={params.win || '—'} />
        <SummaryRow label="Proverbs" value={params.proverbReference || '—'} />
        <SummaryRow label="Wisdom" value={params.wisdom || '—'} />
        <View style={styles.summaryRowLast}>
          <ThemedText style={styles.summaryLabel}>Looking forward</ThemedText>
          <ThemedText weight="medium" style={params.lookingForward ? styles.summaryValue : styles.summaryValueMuted}>
            {params.lookingForward || 'Nothing added'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.doneButton} activeOpacity={0.8} onPress={onDone}>
          <ThemedText weight="medium" style={styles.doneButtonText}>Done</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.summaryRow}>
    <ThemedText style={styles.summaryLabel}>{label}</ThemedText>
    <ThemedText weight="medium" style={styles.summaryValue}>{value}</ThemedText>
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
});

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FileText, Leaf, Pencil, Sparkles, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScriptureReaderModal from '../ScriptureReaderModal';
import ThemedText from '../common/ThemedText';
import { BibleStudyContent } from '../../storage/bibleStudyStorage';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { triggerLightHaptic } from '../../utils/haptics';
import {getScripturePassage} from '../../services/scriptureReaderService';
import {
  formatScripturePassage,
  type FormattedScripturePassage,
} from '../../services/scripturePassageFormatting';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const DetailReveal = ({children, delay, reduceMotion, style}: {children: React.ReactNode; delay: number; reduceMotion: boolean; style?: any}) => {
  const value = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {value.setValue(1); return undefined;}
    value.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.spring(value, {toValue: 1, tension: 78, friction: 8, useNativeDriver: true}),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, reduceMotion, value]);
  return <Animated.View style={[style, {opacity: value, transform: [
    {translateY: value.interpolate({inputRange: [0, 1], outputRange: [16, 0]})},
    {scale: value.interpolate({inputRange: [0, 1], outputRange: [0.96, 1]})},
  ]}]}>{children}</Animated.View>;
};

interface Props {
  reference: string;
  selectedDate: string;
  translation?: string;
  content: BibleStudyContent;
  onEdit: () => Promise<void> | void;
  onClose: () => void;
}

export default function BibleStudyDetailView({ reference, selectedDate, translation = 'NASB', content, onEdit, onClose }: Props) {
  const [readerOpen, setReaderOpen] = useState(false);
  const [passageLayout, setPassageLayout] = useState<FormattedScripturePassage | null>(null);
  const insets = useSafeAreaInsets();
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const isCollapsedRef = useRef(false);
  const headerCollapse = useRef(new Animated.Value(0)).current;
  const [tab, setTab] = useState<'study' | 'response' | 'prayer'>('study');
  const [busy, setBusy] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {if (active) {setReduceMotion(value);}}).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {active = false; subscription.remove();};
  }, []);
  useEffect(() => {
    let active = true;
    setPassageLayout(null);
    getScripturePassage(reference, translation)
      .then(result => {
        if (active) {
          setPassageLayout(formatScripturePassage(
            result.verses,
            result.reference || reference,
            result.text,
          ));
        }
      })
      .catch(() => {});
    return () => {active = false;};
  }, [reference, translation]);
  const shown = content;
  const [year, month, day] = selectedDate.split('-').map(Number);
  const savedChoices = (choices: string[]) => choices.length ? (
    <View style={styles.savedChoices}>
      {[...new Set(choices)].map((choice, index) => <DetailReveal key={choice} delay={index * 38} reduceMotion={reduceMotion} style={styles.savedChoice}>
        <ThemedText weight="medium" style={styles.savedChoiceText}>{choice}</ThemedText>
      </DetailReveal>)}
    </View>
  ) : null;
  const close = () => {
    if (busy) {return;}
    triggerLightHaptic();
    onClose();
  };
  const edit = async () => {
    setBusy(true);
    try { await onEdit(); }
    catch { Alert.alert('Unable to edit', 'The original study session could not be loaded. Your saved study is unchanged.'); }
    finally {setBusy(false);}
  };
  const section = (label: string, key: 'observation' | 'understanding' | 'response' | 'prayer') => (
    <View style={styles.section}>
      <ThemedText weight="bold" style={styles.sectionLabel}>{label.toUpperCase()}</ThemedText>
      <ThemedText selectable style={styles.answer}>{shown[key].text.trim() || 'Nothing recorded yet.'}</ThemedText>
    </View>
  );
  const highlightPresentation = (highlight: BibleStudyContent['highlights'][number]) => {
    let selectionStart = -1;
    if (passageLayout) {
      const storedStart = highlight.selectionStart;
      const storedEnd = highlight.selectionEnd ?? (
        typeof storedStart === 'number' ? storedStart + highlight.text.length : undefined
      );
      if (
        typeof storedStart === 'number' &&
        typeof storedEnd === 'number' &&
        passageLayout.text.slice(storedStart, storedEnd).trim() === highlight.text
      ) {
        selectionStart = storedStart + passageLayout.text
          .slice(storedStart, storedEnd)
          .search(/\S|$/);
      } else {
        selectionStart = passageLayout.text.indexOf(highlight.text);
      }
    }

    let verseNumber = /^\d+(?:[-–]\d+)?$/.test(highlight.verseNumber)
      ? highlight.verseNumber.replace('-', '–')
      : '';
    if (passageLayout && selectionStart >= 0) {
      const selectionEnd = selectionStart + highlight.text.length;
      const startRange = [...passageLayout.verseNumberRanges]
        .reverse()
        .find(range => range.start <= selectionStart);
      const endRange = [...passageLayout.verseNumberRanges]
        .reverse()
        .find(range => range.start < Math.max(selectionStart + 1, selectionEnd));
      const startNumber = startRange
        ? passageLayout.text.slice(startRange.start, startRange.end)
        : '';
      const endNumber = endRange
        ? passageLayout.text.slice(endRange.start, endRange.end)
        : startNumber;
      verseNumber = startNumber && endNumber && startNumber !== endNumber
        ? `${startNumber}–${endNumber}`
        : startNumber || endNumber || verseNumber;
    }

    const leadingNumber = highlight.text.match(/^(\d{1,3})(?=\s)/)?.[1] ?? '';
    if (!verseNumber) {verseNumber = leadingNumber;}
    const numberAtStart = verseNumber.split('–')[0];
    const displayText = numberAtStart && highlight.text.startsWith(`${numberAtStart} `)
      ? highlight.text.slice(numberAtStart.length).trimStart()
      : highlight.text;
    return {displayText, verseNumber};
  };
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AnimatedScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event: any) => {
          const y = event.nativeEvent.contentOffset.y;
          if (isCollapsedRef.current && y <= 1) {
            isCollapsedRef.current = false;
            setHeaderCollapsed(false);
            Animated.timing(headerCollapse, { toValue: 0, duration: 280, useNativeDriver: true }).start();
          } else if (!isCollapsedRef.current && y > 32) {
            isCollapsedRef.current = true;
            setHeaderCollapsed(true);
            Animated.timing(headerCollapse, { toValue: 1, duration: 300, useNativeDriver: true }).start();
          }
        }}
        contentContainerStyle={{ paddingTop: insets.top + 90, paddingBottom: insets.bottom + 60 }}>
        <DetailReveal delay={20} reduceMotion={reduceMotion} style={styles.hero}>
          <ThemedText style={styles.date}>{format(new Date(year, month - 1, day), year === new Date().getFullYear() ? 'EEE, MMMM d' : 'EEE, MMMM d, yyyy').toUpperCase()}</ThemedText>
          <ThemedText weight="bold" style={styles.eyebrow}>BIBLE STUDY</ThemedText>
          <View style={styles.titleRow}>
            <ThemedText weight="bold" style={styles.title}>{reference}</ThemedText>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Read study passage" hitSlop={10}
              onPress={() => { triggerLightHaptic(); setReaderOpen(true); }} style={styles.readerButton}>
              <MaterialCommunityIcons name="book-outline" size={18} color={Colors.sage} />
            </TouchableOpacity>
          </View>
        </DetailReveal>
        <View style={styles.pills}>
          {(['study', 'response', 'prayer'] as const).map((key, index) => {
            const Icon = key === 'study' ? FileText : key === 'response' ? Sparkles : Leaf;
            return <DetailReveal key={key} delay={100 + index * 45} reduceMotion={reduceMotion} style={styles.pillSlot}><TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: tab === key }}
              activeOpacity={0.7} onPress={() => { triggerLightHaptic(); setTab(key); }} style={[styles.pill, tab === key && styles.pillActive]}>
              <Icon size={17} color={tab === key ? Colors.hopeWhite : Colors.text} />
              <ThemedText weight="medium" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
                style={[styles.pillText, tab === key && styles.pillTextActive]}>{key[0].toUpperCase() + key.slice(1)}</ThemedText>
            </TouchableOpacity></DetailReveal>;
          })}
        </View>
        <DetailReveal key={tab} delay={215} reduceMotion={reduceMotion} style={styles.body}>
          {tab === 'study' && <>
            {shown.highlights.length > 0 && <View style={styles.section}>
              <ThemedText weight="bold" style={styles.sectionLabel}>PASSAGES THAT STOOD OUT</ThemedText>
              {shown.highlights.map(highlight => {
                const presentation = highlightPresentation(highlight);
                const highlightColor = highlight.color || 'rgba(231,196,94,0.42)';
                return <View key={highlight.id} style={styles.highlight}>
                  <View style={[styles.highlightMarker, {backgroundColor: highlightColor}]} />
                  <View style={styles.highlightContent}>
                    <Text selectable style={styles.quote}>
                      <Text style={styles.highlightReference}>{reference} </Text>
                      {!!presentation.verseNumber && <Text style={styles.verse}>{presentation.verseNumber} </Text>}
                      <Text style={{backgroundColor: highlightColor}}>{presentation.displayText}</Text>
                    </Text>
                    {savedChoices(shown.observation.promptsByHighlight?.[highlight.id] ?? [])}
                  </View>
                </View>;
              })}
            </View>}
            {savedChoices(shown.observation.tags ?? [])}
            {section('What I noticed', 'observation')}
            {section('What the passage is teaching', 'understanding')}
            {(shown.understanding.prompts ?? Object.keys(shown.understanding.byPrompt ?? {})).map(prompt => {
              const answer = shown.understanding.byPrompt?.[prompt] ?? '';
              return <View key={prompt} style={styles.section}>
                {savedChoices([prompt])}
                {!!answer.trim() && <ThemedText selectable style={styles.answer}>{answer}</ThemedText>}
              </View>;
            })}
          </>}
          {tab === 'response' && <>
            {savedChoices(shown.response.prompts ?? Object.keys(shown.response.byPrompt ?? {}))}
            {section('My response', 'response')}
          </>}
          {tab === 'prayer' && <>{section('My prayer', 'prayer')}
            {shown.prayer.saveToPrayerJournal && !!shown.prayer.text.trim() && <ThemedText style={styles.status}>Saved to Prayer Journal{shown.prayer.trackAnswered ? ' · Tracking if answered' : ''}</ThemedText>}
          </>}
        </DetailReveal>
      </AnimatedScrollView>
      <Animated.View
        pointerEvents={headerCollapsed ? 'none' : 'auto'}
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 16,
            opacity: headerCollapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp' }),
            transform: [
              { translateY: headerCollapse.interpolate({ inputRange: [0, 1], outputRange: [0, -10], extrapolate: 'clamp' }) },
              { scale: headerCollapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94], extrapolate: 'clamp' }) },
            ],
          },
        ]}
      >
        <View />
        <View style={styles.actions}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit Bible Study" disabled={busy}
            activeOpacity={0.7} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            onPress={() => { triggerLightHaptic(); return edit(); }} style={styles.cornerActionButton}>
            <Pencil size={17} color={Colors.sage} strokeWidth={1.8} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close Bible Study" disabled={busy} onPress={close}
            activeOpacity={0.7} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}} style={styles.cornerActionButton}>
            <X size={17} color={Colors.sage} />
          </TouchableOpacity>
        </View>
      </Animated.View>
      <ScriptureReaderModal visible={readerOpen} passages={[{ reference }]} initialIndex={0} version={translation} onClose={() => setReaderOpen(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.lightBackground },
  hero: { paddingHorizontal: 22, marginBottom: 24 },
  date: { fontSize: 11, letterSpacing: 1.3, color: Colors.textGray, marginBottom: 12 },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, color: Colors.sage, marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { fontFamily: Fonts.lora.bold, fontSize: 38, lineHeight: 46, color: Colors.text, flexShrink: 1 },
  readerButton: { padding: 6 },
  subtitle: { fontSize: 14, color: Colors.textGray },
  topBar: { position: 'absolute', top: 0, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  cornerActionButton: { width: 42, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardBackground },
  pills: { flexDirection: 'row', gap: 8, marginHorizontal: 16, paddingVertical: 6 },
  pillSlot: { flex: 1 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 18, backgroundColor: 'rgba(82,106,91,0.08)', borderRadius: 28, borderWidth: 0.5, borderColor: 'rgba(82,106,91,0.2)' },
  pillActive: { backgroundColor: Colors.sageMuted, borderColor: Colors.sage },
  pillText: { fontSize: 15, color: Colors.text },
  pillTextActive: { color: Colors.hopeWhite },
  savedChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 12 },
  savedChoice: { backgroundColor: 'rgba(82,106,91,0.08)', borderColor: 'rgba(82,106,91,0.2)', borderWidth: 1, borderRadius: 22, paddingVertical: 8, paddingHorizontal: 14 },
  savedChoiceText: { fontSize: 13, color: Colors.sage },
  body: { paddingHorizontal: 22, paddingTop: 20 },
  section: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  sectionLabel: { fontSize: 11, letterSpacing: 1.3, color: Colors.sage, marginBottom: 14 },
  answer: { fontSize: 16, lineHeight: 27, color: Colors.text },
  input: { minHeight: 100, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 27, color: Colors.text, padding: 0, textAlignVertical: 'top' },
  highlight: { flexDirection: 'row', alignItems: 'stretch', marginVertical: 10 },
  highlightMarker: { width: 5, borderRadius: 3, marginRight: 13 },
  highlightContent: { flex: 1 },
  quote: { fontFamily: Fonts.lora.regular, fontSize: 19, lineHeight: 31, color: Colors.text },
  highlightReference: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textGray },
  verse: { fontFamily: Fonts.lora.regular, fontSize: 10, letterSpacing: 0.8, color: 'rgba(90, 98, 93, 0.62)' },
  status: { fontSize: 12, lineHeight: 20, color: Colors.sage, marginTop: 16 },
});

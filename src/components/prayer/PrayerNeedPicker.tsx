import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {Sparkle} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemedText from '../common/ThemedText';
import HeaderBackButton from '../common/HeaderBackButton';
import StepFadeIn from '../common/StepFadeIn';
import { Colors } from '../../theme/colors';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { useFloatingKeyboardButton } from '../../hooks/useFloatingKeyboardButton';
import { triggerLightHaptic } from '../../utils/haptics';
import { Pencil } from 'lucide-react-native';
import type { PrayerApiEntry } from '../../services/api/prayerApi';
import { getPrayerTypePresentation } from '../dashboard/prayerTypePresentation';
import { answerPrayer, prayerNeeds, trackingStatus, type PrayerUpdate } from '../../utils/prayerTracking';
import { format } from 'date-fns';
import type { PrayerChanges } from './PrayerDetails';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatPrayerDateContext } from '../../utils/date';

const TOPICS = [
  { label: 'Provision', icon: 'wallet-outline', needs: ['Rent', 'Bills', 'Credit card', 'Groceries', 'A home', 'Debt'] },
  { label: 'School', icon: 'school-outline', needs: ['School fees', 'Tuition', 'School supplies', 'Exams', 'A scholarship'] },
  { label: 'Relationships', icon: 'heart-outline', needs: ['Future wife', 'Future husband', 'A baby', 'Marriage', 'Family', 'Reconciliation'] },
  { label: 'Work & business', icon: 'briefcase-outline', needs: ['A job', 'Business', 'Customers', 'Income', 'A new opportunity'] },
  { label: 'Health', icon: 'leaf-outline', needs: ['Healing', 'Treatment', 'Medical bills', 'Strength', 'Rest'] },
  { label: 'Guidance', icon: 'compass-outline', needs: ['A decision', 'Wisdom', 'Direction', 'Peace', 'Patience'] },
] as const;
type Choice = { topic: string; text: string };

function SlideFromRight({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    const timer = setTimeout(() => Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, tension: 55, friction: 10, useNativeDriver: true }),
    ]).start(), delay);
    return () => clearTimeout(timer);
  }, [delay, opacity, translateX]);
  return <Animated.View style={{ opacity, transform: [{ translateX }] }}>{children}</Animated.View>;
}

const isPresetChoice = (choice: Choice) => TOPICS.some(topic => topic.label === choice.topic && (topic.needs as readonly string[]).includes(choice.text));
const choiceKey = (choice: Choice) => isPresetChoice(choice) ? `${choice.topic}:${choice.text}` : `${choice.topic}:other`;
const parseDate = (value?: string) => value ? new Date(`${value.slice(0, 10)}T12:00:00`) : new Date();
const formatDisplayDate = (value?: string) => { const date = parseDate(value); return format(date, date.getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy'); };

export default function PrayerNeedPicker({ prayer, selectedNeedId, onClose, onSave, onDelete, renderUpdate }: { prayer?: PrayerApiEntry; selectedNeedId?: string; onClose: () => void; onSave: (data: PrayerChanges) => Promise<void>; onDelete?: () => Promise<void>; renderUpdate?: (prayer: PrayerApiEntry, save: (data: PrayerChanges) => Promise<void>, close: () => void) => React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { currentFont } = useTheme();
  const { bottom } = useFloatingKeyboardButton(insets.bottom);
  const [current, setCurrent] = useState(prayer);
  const [editing, setEditing] = useState(!prayer);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showParentPrayer, setShowParentPrayer] = useState(false);
  const [step, setStep] = useState(0);
  const initialChoices = (entry?: PrayerApiEntry): Choice[] => entry ? prayerNeeds(entry).map(n => ({
    text: n.text, topic: (n as typeof n & { topic?: string }).topic || TOPICS.find(t => (t.needs as readonly string[]).includes(n.text))?.label || 'Other',
  })) : [];
  const savedChoices = initialChoices(prayer);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Choice[]>(savedChoices.filter(isPresetChoice));
  const [topicCustom, setTopicCustom] = useState<Record<string, string>>(() => Object.fromEntries(savedChoices.filter(choice => choice.topic !== 'Other' && !isPresetChoice(choice)).map(choice => [choice.topic, choice.text])));
  const [customTopicOpen, setCustomTopicOpen] = useState<string | null>(null);
  const [custom, setCustom] = useState(savedChoices.find(choice => choice.topic === 'Other')?.text || (prayer && !prayerNeeds(prayer).length ? prayer.content : ''));
  const [customInputOpen, setCustomInputOpen] = useState(!!custom.trim());
  const [notes, setNotes] = useState(prayer?.notes || '');
  const [prayingSince, setPrayingSince] = useState(prayer?.metadata?.praying_since || format(new Date(), 'yyyy-MM-dd'));
  const [expectedDates, setExpectedDates] = useState<Record<string, string>>(() => Object.fromEntries(savedChoices.map((choice, index) => [choiceKey(choice), (prayer ? prayerNeeds(prayer)[index]?.expectedDate : undefined) || ''])));
  const [dateTarget, setDateTarget] = useState<{ type: 'since' } | { type: 'expected'; key: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const busy = useRef(false);
  const completed = useRef(false);
  const topicCustomChoices = Object.entries(topicCustom).filter(([, text]) => text.trim()).map(([topic, text]) => ({ topic, text: text.trim() }));
  const choices = [...selected, ...topicCustomChoices, ...(custom.trim() ? [{ topic: 'Other', text: custom.trim() }] : [])];
  const ready = choices.length > 0;
  const showChoices = editing && step === 0;
  const showDetails = editing && step === 1;
  const showReview = editing && step === 2;
  const selectedNeed = current ? prayerNeeds(current).find(need => need.id === selectedNeedId) || prayerNeeds(current)[0] : undefined;
  const selectedNeedLastPrayed = selectedNeed && current?.metadata?.need_last_prayed?.[selectedNeed.id];
  const selectedNeedAnswer = selectedNeed?.answerHistory?.map(answer => answer.date).filter(Boolean).sort().at(-1) || selectedNeed?.answeredDate;
  const selectedNeedLetGo = selectedNeed?.lifecycleHistory?.filter(event => event.action === 'let-go').map(event => event.date).filter(Boolean).sort().at(-1);
  const selectedNeedDate = selectedNeed?.status === 'answered' ? selectedNeedAnswer : selectedNeed?.status === 'closed' ? selectedNeedLetGo : selectedNeedLastPrayed;
  const selectedNeedDateContext = formatPrayerDateContext(selectedNeedDate);
  const selectedNeedDateLabel = selectedNeedDateContext ? `${selectedNeed?.status === 'answered' ? 'Answer recorded' : selectedNeed?.status === 'closed' ? 'Let go' : 'Last prayed'} ${selectedNeedDateContext.combinedLabel}` : '';
  const needOrientation = current ? getPrayerTypePresentation(current, selectedNeed) : undefined;
  const title = editing ? step === 0 ? 'What are you waiting on\nGod for?' : step === 1 ? 'Add the details you want to remember' : 'Your prayer need' : needOrientation?.detailLabel || 'Prayer Need';
  const hint = editing ? step === 0 ? 'You can choose more than one.' : step === 1 ? 'Add dates, a prayer, or anything that will help you remember.' : 'Take a moment to review before saving.' : [needOrientation?.detailContext, needOrientation?.originLabel].filter(Boolean).join(' · ') || 'This need is part of your prayer.';
  const toggle = (topic: string, text: string) => {
    if (!editing) return;
    triggerLightHaptic();
    setSelected(prev => prev.some(n => n.topic === topic && n.text === text)
      ? prev.filter(n => n.topic !== topic || n.text !== text) : [...prev, { topic, text }]);
  };
  const removeChoice = (choice: Choice) => {
    triggerLightHaptic();
    if (isPresetChoice(choice)) setSelected(prev => prev.filter(item => item.topic !== choice.topic || item.text !== choice.text));
    else if (choice.topic === 'Other') setCustom('');
    else setTopicCustom(prev => ({ ...prev, [choice.topic]: '' }));
  };
  const cancelEditing = () => {
    if (!current) return;
    const saved = initialChoices(current);
    setSelected(saved.filter(isPresetChoice));
    setTopicCustom(Object.fromEntries(saved.filter(choice => choice.topic !== 'Other' && !isPresetChoice(choice)).map(choice => [choice.topic, choice.text])));
    setCustom(saved.find(choice => choice.topic === 'Other')?.text || (prayerNeeds(current).length ? '' : current.content));
    setNotes(current.notes || '');
    setPrayingSince(current.metadata?.praying_since || format(new Date(), 'yyyy-MM-dd'));
    setExpectedDates(Object.fromEntries(saved.map((choice, index) => [choiceKey(choice), prayerNeeds(current)[index]?.expectedDate || ''])));
    setStep(0);
    setEditing(false);
  };
  const save = async () => {
    if (!editing || !ready || busy.current || completed.current) return;
    triggerLightHaptic();
    busy.current = true;
    setSaving(true);
    try {
      const existing = current ? prayerNeeds(current) : [];
      const nextNeeds = choices.map((n, i) => {
        const old = existing.find(prev => prev.text === n.text && initialChoices(current).find(c => c.text === prev.text)?.topic === n.topic);
        return { ...old, ...n, id: old?.id || `need-${Date.now()}-${i}`, status: old?.status || 'pending' as const, expectedDate: expectedDates[choiceKey(n)] || undefined };
      });
      const state = trackingStatus({ ...current, metadata: { ...current?.metadata, prayer_needs: nextNeeds } } as PrayerApiEntry);
      const data: PrayerChanges = {
        content: choices.map(n => n.text).join('\n'), notes: notes.trim(), status: state === 'answered' ? 'answered' : 'pending',
        answered_date: state === 'answered' ? current?.answered_date || new Date().toISOString() : null,
        metadata: { ...current?.metadata, prayer_need: true, who: 'Me', track_answered: true, tracking_status: state, praying_since: prayingSince,
          topics: [...new Set(choices.map(n => n.topic))],
          prayer_needs: nextNeeds, prayer_updates: current?.metadata?.prayer_updates || [] },
      };
      await onSave(data);
      if (current) {
        setCurrent({ ...current, ...data });
        setSelected(choices.filter(isPresetChoice));
        setStep(0);
        setEditing(false);
      } else {
        completed.current = true;
        onClose();
      }
    } catch { Alert.alert('Could not save', 'Your selections are still here. Please try again.'); }
    finally { busy.current = false; setSaving(false); }
  };
  const persist = async (data: PrayerChanges) => {
    await onSave(data);
    setCurrent(prev => prev ? { ...prev, ...data, is_answered: data.status === 'answered' } : prev);
  };
  const removePrayer = () => onDelete && Alert.alert('Delete this prayer?', 'This will remove this prayer need and its saved updates.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { if (busy.current) return; triggerLightHaptic(); busy.current = true; setSaving(true); try { await onDelete(); onClose(); } catch { Alert.alert('Could not delete', 'Please try again.'); } finally { busy.current = false; setSaving(false); } } }]);
  const markAnswered = async (id: string) => {
    if (!current || busy.current) return;
    triggerLightHaptic(); busy.current = true; setSaving(true);
    try { await persist({ content: current.content, ...answerPrayer(current, id) }); }
    catch { Alert.alert('Could not update', 'Please try again.'); }
    finally { busy.current = false; setSaving(false); }
  };
  const history: PrayerUpdate[] = Array.isArray(current?.metadata?.prayer_updates) ? [...current!.metadata!.prayer_updates].reverse() : [];
  return <><Modal visible animationType="none" onRequestClose={() => !saving && onClose()}>
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}>
        <StepFadeIn key={`label-${step}`} delay={0}><View style={styles.focusLabelContainer}><Ionicons name="leaf-outline" size={16} color={Colors.sage} /><ThemedText weight="semiBold" style={styles.focusLabel}>MY PRAYER NEED</ThemedText></View></StepFadeIn>
        {current && editing && <TouchableOpacity disabled={saving} style={styles.edit} onPress={() => { triggerLightHaptic(); cancelEditing(); }}><ThemedText style={styles.pillText}>Cancel edit</ThemedText></TouchableOpacity>}
        <StepFadeIn key={`title-${step}`} delay={80}><ThemedText weight="bold" style={styles.title}>{title}</ThemedText></StepFadeIn>
        <StepFadeIn key={`hint-${step}`} delay={140}><ThemedText style={styles.hint}>{hint}</ThemedText></StepFadeIn>
        {showChoices && <View style={styles.mainChoices}>{(expanded || customInputOpen) && <SlideFromRight delay={80}><TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityLabel="Collapse choices" style={styles.collapsePill} onPress={() => { triggerLightHaptic(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded(null); setCustomInputOpen(false); setCustomTopicOpen(null); }}><Ionicons name="chevron-down" size={18} color={Colors.hopeWhite} /></TouchableOpacity></SlideFromRight>}{(customInputOpen ? [] : TOPICS.filter(topic => !expanded || topic.label === expanded)).map((topic, topicIndex) => {
          const open = expanded === topic.label;
          const count = choices.filter(choice => choice.topic === topic.label).length;
          return <StepFadeIn key={topic.label} delay={190 + topicIndex * 55}><TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityState={{ expanded: open }} style={[styles.choicePill, open && styles.choicePillActive]} onPress={() => { triggerLightHaptic(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCustomInputOpen(false); setExpanded(open ? null : topic.label); }}>
            <Ionicons name={topic.icon} size={18} color={open ? Colors.hopeWhite : Colors.sage} />
            <ThemedText weight="semiBold" style={[styles.choicePillText, open && styles.choicePillTextActive]}>{topic.label}</ThemedText>
            {count > 0 && <View style={[styles.choiceCount, open && styles.choiceCountActive]}><ThemedText style={[styles.choiceCountText, open && styles.choicePillTextActive]}>{count}</ThemedText></View>}
          </TouchableOpacity></StepFadeIn>;
        })}{!expanded && <StepFadeIn delay={190 + TOPICS.length * 55}><TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityState={{ expanded: customInputOpen }} style={[styles.choicePill, customInputOpen && styles.choicePillActive]} onPress={() => { triggerLightHaptic(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded(null); setCustomInputOpen(open => !open); }}>
          <Ionicons name="add-circle-outline" size={18} color={customInputOpen ? Colors.hopeWhite : Colors.sage} />
          <ThemedText weight="semiBold" style={[styles.choicePillText, customInputOpen && styles.choicePillTextActive]}>Something else</ThemedText>
          {!!custom.trim() && <View style={[styles.choiceCount, customInputOpen && styles.choiceCountActive]}><ThemedText style={[styles.choiceCountText, customInputOpen && styles.choicePillTextActive]}>1</ThemedText></View>}
        </TouchableOpacity></StepFadeIn>}</View>}

        {showChoices && expanded && (() => {
          const topic = TOPICS.find(item => item.label === expanded);
          if (!topic) return null;
          const otherOpen = customTopicOpen === topic.label;
          return <StepFadeIn key={`open-${topic.label}`} delay={0}><View style={styles.openChoices}><ThemedText weight="semiBold" style={styles.eyebrow}>{topic.label.toUpperCase()}</ThemedText><View style={styles.pills}>{topic.needs.map((text, pillIndex) => {
            const active = selected.some(item => item.topic === topic.label && item.text === text);
            return <StepFadeIn key={text} delay={pillIndex * 45}><TouchableOpacity disabled={saving} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => toggle(topic.label, text)} style={[styles.choicePill, active && styles.choicePillActive]}>
              {active && <Ionicons name="checkmark" size={14} color={Colors.hopeWhite} />}<ThemedText style={[styles.choicePillText, active && styles.choicePillTextActive]}>{text}</ThemedText>
            </TouchableOpacity></StepFadeIn>;
          })}<StepFadeIn delay={topic.needs.length * 45}><TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityState={{ expanded: otherOpen }} onPress={() => { triggerLightHaptic(); setCustomTopicOpen(otherOpen ? null : topic.label); }} style={[styles.choicePill, (!!topicCustom[topic.label]?.trim() || otherOpen) && styles.choicePillActive]}><ThemedText style={[styles.choicePillText, (!!topicCustom[topic.label]?.trim() || otherOpen) && styles.choicePillTextActive]}>Other</ThemedText></TouchableOpacity></StepFadeIn></View>
          {otherOpen && <TextInput value={topicCustom[topic.label] || ''} onChangeText={text => setTopicCustom(prev => ({ ...prev, [topic.label]: text }))} editable={!saving} multiline autoFocus placeholder={`What else are you waiting on God for in ${topic.label.toLowerCase()}?`} placeholderTextColor={Colors.placeholderText} style={[styles.input, { fontFamily: getFontFamily(currentFont || 'lexend', 'regular') }]} />}</View></StepFadeIn>;
        })()}
        {showChoices && customInputOpen && <StepFadeIn delay={0}><View style={styles.openChoices}><TextInput value={custom} onChangeText={setCustom} editable={!saving} multiline autoFocus placeholder="Another need on your heart…" placeholderTextColor={Colors.placeholderText} style={[styles.input, { fontFamily: getFontFamily(currentFont || 'lexend', 'regular') }]} /></View></StepFadeIn>}
        {showChoices && choices.length > 0 && <StepFadeIn delay={580}><View style={styles.summary}><ThemedText weight="semiBold" style={styles.eyebrow}>ON MY HEART · {choices.length}</ThemedText><View style={styles.pills}>{choices.map((choice, choiceIndex) => <StepFadeIn key={`${choice.topic}-${choice.text}`} delay={choiceIndex * 40}><TouchableOpacity disabled={saving} accessibilityLabel={`Remove ${choice.text}`} style={[styles.choicePill, styles.choicePillActive]} onPress={() => removeChoice(choice)}><ThemedText style={[styles.choicePillText, styles.choicePillTextActive]}>{choice.text}</ThemedText><Ionicons name="close" size={13} color={Colors.hopeWhite} /></TouchableOpacity></StepFadeIn>)}</View></View></StepFadeIn>}
        {showDetails && choices.length > 0 && <StepFadeIn delay={200}><View style={styles.dateSection}>
          <ThemedText weight="semiBold" style={styles.eyebrow}>DATES</ThemedText>
          <TouchableOpacity style={styles.dateRow} onPress={() => { triggerLightHaptic(); setDateTarget({ type: 'since' }); }}><View style={styles.dateText}><ThemedText style={styles.topicText}>Praying since</ThemedText><ThemedText style={styles.waiting}>{formatDisplayDate(prayingSince)}</ThemedText></View><Ionicons name="calendar-outline" size={18} color={Colors.sage} /></TouchableOpacity>
          {choices.map(choice => { const key = choiceKey(choice); const expected = expectedDates[key]; return <TouchableOpacity key={`date-${key}`} style={styles.dateRow} onPress={() => { triggerLightHaptic(); setDateTarget({ type: 'expected', key, label: choice.text }); }}><View style={styles.dateText}><ThemedText style={styles.topicText}>{choice.text}</ThemedText><ThemedText style={styles.waiting}>{expected ? `On or before ${formatDisplayDate(expected)}` : 'Add an on or before date (optional)'}</ThemedText></View><Ionicons name="calendar-outline" size={18} color={Colors.sage} /></TouchableOpacity>; })}
        </View></StepFadeIn>}
        {showDetails && <StepFadeIn delay={280}><View style={[styles.topicSection, styles.notesSection]}>
          <ThemedText weight="semiBold" style={styles.eyebrow}>NOTES, PRAYER, OR DESCRIPTION</ThemedText>
          <TextInput value={notes} onChangeText={setNotes} editable={editing && !saving} multiline placeholder="Write notes, a prayer, or a description…" placeholderTextColor={Colors.placeholderText} style={[styles.input, { fontFamily: getFontFamily(currentFont || 'lexend', 'regular') }]} />
        </View></StepFadeIn>}
        {showReview && <StepFadeIn delay={200}><View style={styles.reviewCard}><ThemedText weight="semiBold" style={styles.eyebrow}>ON MY HEART · {choices.length}</ThemedText>{choices.map(choice => { const expected = expectedDates[choiceKey(choice)]; return <View key={`review-${choiceKey(choice)}`} style={styles.reviewNeed}><Ionicons name="heart-outline" size={16} color={Colors.sage} /><View style={styles.dateText}><ThemedText weight="semiBold" style={styles.choiceTopic}>{choice.topic === 'Other' ? 'SOMETHING ELSE' : choice.topic.toUpperCase()}</ThemedText><ThemedText style={styles.topicText}>{choice.text}</ThemedText>{expected && <ThemedText style={styles.waiting}>On or before {formatDisplayDate(expected)}</ThemedText>}</View></View>; })}<View style={styles.reviewDivider} /><ThemedText style={styles.waiting}>Praying since {formatDisplayDate(prayingSince)}</ThemedText>{!!notes.trim() && <><ThemedText weight="semiBold" style={[styles.eyebrow, styles.reviewNotesLabel]}>NOTES, PRAYER, OR DESCRIPTION</ThemedText><ThemedText style={styles.reviewNotes}>{notes.trim()}</ThemedText></>}</View></StepFadeIn>}
        {current && !editing && <>
          {selectedNeed && <View style={styles.primaryNeed}><ThemedText style={styles.primaryNeedText}>{selectedNeed.text}</ThemedText><ThemedText style={styles.waiting}>{selectedNeed.status === 'answered' ? 'Answered' : selectedNeed.status === 'closed' ? 'Let go' : 'Still praying'}</ThemedText>{!!selectedNeedDateLabel && <ThemedText style={styles.waiting}>{selectedNeedDateLabel}</ThemedText>}</View>}
          <TouchableOpacity style={styles.parentPrayerToggle} onPress={() => setShowParentPrayer(value => !value)}><ThemedText weight="semiBold" style={styles.pillText}>{showParentPrayer ? 'Hide full prayer' : 'View full prayer'}</ThemedText><Ionicons name={showParentPrayer ? 'chevron-up' : 'chevron-down'} size={15} color={Colors.sage} /></TouchableOpacity>
          {showParentPrayer && <View style={styles.parentPrayer}><ThemedText weight="semiBold" style={styles.eyebrow}>PARENT PRAYER · {current.person_name ? `FOR ${current.person_name.toUpperCase()}` : 'FULL PRAYER'}</ThemedText><ThemedText style={styles.topicText}>{current.content}</ThemedText></View>}
          <ThemedText weight="semiBold" style={[styles.eyebrow, { marginTop: 24 }]}>OTHER NEEDS IN THIS PRAYER</ThemedText>
          <ThemedText style={styles.waiting}>Praying since {formatDisplayDate(current.metadata?.praying_since || current.selected_date)}</ThemedText>
          {prayerNeeds(current).map(need => <View key={need.id} style={styles.trackingRow}><View style={{ flex: 1 }}>{!!need.topic && <ThemedText weight="semiBold" style={styles.choiceTopic}>{need.topic === 'Other' ? 'SOMETHING ELSE' : need.topic.toUpperCase()}</ThemedText>}<ThemedText style={styles.topicText}>{need.text}</ThemedText><ThemedText style={styles.waiting}>{need.status === 'answered' ? 'Answered' : need.status === 'closed' ? 'Let go' : 'Still praying'}{need.expectedDate ? ` · On or before ${formatDisplayDate(need.expectedDate)}` : ''}</ThemedText></View><TouchableOpacity disabled={saving} style={styles.pill} onPress={() => { void markAnswered(need.id); }}><Sparkle size={16} color={Colors.sage} strokeWidth={1.8} /><ThemedText style={styles.pillText}>{need.status === 'answered' ? 'Answered' : 'Mark answered'}</ThemedText></TouchableOpacity></View>)}
          <View style={[styles.header, { marginTop: 24, marginBottom: 12 }]}><ThemedText weight="semiBold" style={styles.eyebrow}>UPDATES</ThemedText><TouchableOpacity disabled={saving} style={styles.pill} onPress={() => { triggerLightHaptic(); setShowUpdate(true); }}><Ionicons name="add" size={16} color={Colors.sage} /><ThemedText style={styles.pillText}>Add update</ThemedText></TouchableOpacity></View>
          {history.length ? history.map(update => <View key={update.id} style={styles.history}><ThemedText style={styles.eyebrow}>{formatPrayerDateContext(update.date)?.combinedLabel || formatDisplayDate(update.date)}{update.needId ? ' · ' + (prayerNeeds(current).find(n => n.id === update.needId)?.text || 'Prayer need') : ''}</ThemedText><ThemedText style={[styles.pillText, { marginTop: 6 }]}>{update.text}</ThemedText></View>) : <ThemedText style={styles.waiting}>Updates you add will appear here.</ThemedText>}
          {onDelete && <TouchableOpacity disabled={saving} style={styles.delete} onPress={removePrayer}><Ionicons name="trash-outline" size={22} color={Colors.error} /><ThemedText weight="semiBold" style={styles.deleteText}>Delete this prayer</ThemedText></TouchableOpacity>}
        </>}
        {current && editing && onDelete && <TouchableOpacity disabled={saving} style={styles.delete} onPress={removePrayer}><Ionicons name="trash-outline" size={22} color={Colors.error} /><ThemedText weight="semiBold" style={styles.deleteText}>Delete this prayer</ThemedText></TouchableOpacity>}
        {!current && <StepFadeIn key={`still-praying-${step}`} delay={showChoices ? 620 : 360}><ThemedText style={[styles.waiting, styles.stillPrayingNote]}>Kept in Still praying, until you mark it answered.</ThemedText></StepFadeIn>}
      </ScrollView>
      {editing && step > 0 && <HeaderBackButton disabled={saving} accessibilityLabel="Previous step" style={[styles.topBack, { top: insets.top + 8 }]} onPress={() => { triggerLightHaptic(); setStep(previous => previous - 1); }} />}
      {current && !editing && <View style={[styles.topEdit, { top: insets.top + 8 }]}><TouchableOpacity disabled={saving} accessibilityLabel="Edit prayer needs" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7} style={styles.closeTouch} onPress={() => { triggerLightHaptic(); setEditing(true); }}><Pencil size={16} color={Colors.sage} /></TouchableOpacity></View>}
      <View style={[styles.close, { top: insets.top + 8 }]}><TouchableOpacity disabled={saving} accessibilityLabel="Close" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7} style={styles.closeTouch} onPress={() => { triggerLightHaptic(); onClose(); }}><Ionicons name="close" size={17} color={Colors.sage} /></TouchableOpacity></View>
    </KeyboardAvoidingView>
    {editing && ready && <Animated.View style={[styles.floating, { bottom }]}><TouchableOpacity disabled={saving} accessibilityLabel={step < 2 ? 'Next step' : 'Save prayer needs'} style={styles.save} onPress={() => { if (step < 2) { triggerLightHaptic(); setStep(previous => previous + 1); scrollRef.current?.scrollTo({ y: 0, animated: true }); } else { void save(); } }}><Ionicons name={step < 2 ? 'chevron-forward' : 'checkmark'} size={22} color={Colors.hopeWhite} /></TouchableOpacity></Animated.View>}
    {dateTarget && <View style={styles.dateOverlay}><View style={styles.dateModal}><ThemedText weight="semiBold" style={styles.dateTitle}>{dateTarget.type === 'since' ? 'When did you start praying?' : `${dateTarget.label} · On or before`}</ThemedText><DateTimePicker value={parseDate(dateTarget.type === 'since' ? prayingSince : expectedDates[dateTarget.key])} mode="date" display="spinner" maximumDate={dateTarget.type === 'since' ? new Date() : undefined} onChange={(_, date) => { if (!date) return; const value = format(date, 'yyyy-MM-dd'); if (dateTarget.type === 'since') setPrayingSince(value); else setExpectedDates(prev => ({ ...prev, [dateTarget.key]: value })); }} />{dateTarget.type === 'expected' && <TouchableOpacity style={styles.clearDate} onPress={() => { setExpectedDates(prev => ({ ...prev, [dateTarget.key]: '' })); setDateTarget(null); }}><ThemedText style={styles.clearDateText}>No expected date</ThemedText></TouchableOpacity>}<TouchableOpacity style={styles.dateDone} onPress={() => { triggerLightHaptic(); setDateTarget(null); }}><ThemedText weight="semiBold" style={styles.dateDoneText}>Done</ThemedText></TouchableOpacity></View></View>}
  </Modal>
  {showUpdate && current && renderUpdate?.(current, persist, () => setShowUpdate(false))}</>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.lightBackground }, content: { paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  focusLabelContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8, marginTop: 32 },
  focusLabel: { fontSize: 11, letterSpacing: 1, color: Colors.sageMuted },
  eyebrow: { fontSize: 10, lineHeight: 15, letterSpacing: 1.5, color: Colors.sageMuted },
  close: { position: 'absolute', right: 20, width: 42, height: 42, borderRadius: 999, backgroundColor: Colors.cardBackground, zIndex: 100 },
  topEdit: { position: 'absolute', right: 70, width: 42, height: 42, borderRadius: 999, backgroundColor: Colors.cardBackground, zIndex: 100 },
  topBack: { position: 'absolute', left: 20, width: 42, height: 42, borderRadius: 999, backgroundColor: Colors.cardBackground, zIndex: 100 },
  closeTouch: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  edit: { alignSelf: 'flex-end', marginBottom: 12 },
  title: { fontSize: 25, lineHeight: 34, textAlign: 'center', color: Colors.text },
  hint: { fontSize: 13, lineHeight: 21, textAlign: 'center', color: Colors.textGray, marginTop: 12, marginBottom: 26 },
  topicSection: { marginBottom: 10 }, topic: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 13 },
  topicActive: { backgroundColor: Colors.actionBackground, borderColor: Colors.sageMuted }, topicText: { flex: 1, fontSize: 14, color: Colors.sage }, count: { color: Colors.sage, fontSize: 11 },
  mainChoices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 18 },
  openChoices: { marginTop: 4, marginBottom: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 12, marginBottom: 8 },
  choicePill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: 'rgba(82, 106, 91, 0.08)', borderWidth: 0.5, borderColor: 'rgba(82, 106, 91, 0.2)', borderRadius: 28, paddingHorizontal: 18, paddingVertical: 14 },
  choicePillActive: { backgroundColor: Colors.sageMuted, borderColor: Colors.sage }, choicePillText: { fontSize: 15, color: Colors.text }, choicePillTextActive: { color: Colors.hopeWhite },
  collapsePill: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', borderWidth: 0.5, borderColor: Colors.sage, borderRadius: 24, backgroundColor: Colors.sageMuted },
  choiceCount: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, backgroundColor: 'rgba(82, 106, 91, 0.12)' },
  choiceCountActive: { backgroundColor: 'rgba(255, 255, 255, 0.18)' }, choiceCountText: { fontSize: 10, color: Colors.sage },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9 },
  pillActive: { backgroundColor: Colors.actionBackground, borderColor: Colors.sageMuted }, pillText: { fontSize: 12, color: Colors.sage },
  trackingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  history: { borderLeftWidth: 2, borderLeftColor: Colors.cardBorder, paddingLeft: 12, marginBottom: 18 },
  summary: { marginTop: 18 }, notesSection: { marginTop: 14 }, input: { minHeight: 70, paddingHorizontal: 0, paddingVertical: 12, fontSize: 15, lineHeight: 24, color: Colors.text, textAlignVertical: 'top' },
  reviewCard: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 22, padding: 18 }, choiceTopic: { color: Colors.sageMuted, fontSize: 9, lineHeight: 14, letterSpacing: 1.2, marginBottom: 2 }, reviewNeed: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 }, reviewDivider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 12 }, reviewNotesLabel: { marginTop: 22, marginBottom: 8 }, reviewNotes: { color: Colors.text, fontSize: 14, lineHeight: 22 },
  dateSection: { marginTop: 20, marginBottom: 10 }, dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder, paddingVertical: 12 }, dateText: { flex: 1 },
  dateOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 300 }, dateModal: { backgroundColor: Colors.lightBackground, borderRadius: 24, padding: 20 }, dateTitle: { color: Colors.text, fontSize: 16, lineHeight: 23, textAlign: 'center', marginBottom: 8 }, dateDone: { alignItems: 'center', backgroundColor: Colors.sage, borderRadius: 20, paddingVertical: 12, marginTop: 8 }, dateDoneText: { color: Colors.hopeWhite, fontSize: 13 }, clearDate: { alignItems: 'center', paddingVertical: 8 }, clearDateText: { color: Colors.textGray, fontSize: 12 },
  primaryNeed: { width: '100%', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.hopeWhite, marginTop: 8 }, primaryNeedText: { color: Colors.text, fontSize: 16, lineHeight: 24 }, parentPrayerToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', padding: 12 }, parentPrayer: { padding: 14, backgroundColor: Colors.hopeWhite, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder },
  waiting: { fontSize: 11, lineHeight: 18, color: Colors.textGray, marginTop: 8 },
  stillPrayingNote: { alignSelf: 'stretch', textAlign: 'center', marginTop: 20 },
  delete: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 30, paddingVertical: 17, backgroundColor: 'rgba(217, 120, 114, 0.1)', borderRadius: 999 }, deleteText: { color: Colors.error, fontSize: 16 },
  floating: { position: 'absolute', right: 20 }, save: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.sage, alignItems: 'center', justifyContent: 'center' },
});

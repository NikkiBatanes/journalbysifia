import React, { useRef, useState } from 'react';
import { Alert, Animated, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { useFloatingKeyboardButton } from '../../hooks/useFloatingKeyboardButton';
import { triggerLightHaptic } from '../../utils/haptics';
import { Pencil } from 'lucide-react-native';
import type { PrayerApiEntry } from '../../services/api/prayerApi';
import { answerPrayer, prayerNeeds, trackingStatus, type PrayerUpdate } from '../../utils/prayerTracking';
import { format } from 'date-fns';
import type { PrayerChanges } from './PrayerDetails';
import DateTimePicker from '@react-native-community/datetimepicker';

const TOPICS = [
  { label: 'Provision', icon: 'wallet-outline', needs: ['Rent', 'Bills', 'Credit card', 'Groceries', 'A home', 'Debt'] },
  { label: 'School', icon: 'school-outline', needs: ['School fees', 'Tuition', 'School supplies', 'Exams', 'A scholarship'] },
  { label: 'Relationships', icon: 'heart-outline', needs: ['Future wife', 'Future husband', 'A baby', 'Marriage', 'Family', 'Reconciliation'] },
  { label: 'Work & business', icon: 'briefcase-outline', needs: ['A job', 'Business', 'Customers', 'Income', 'A new opportunity'] },
  { label: 'Health', icon: 'leaf-outline', needs: ['Healing', 'Treatment', 'Medical bills', 'Strength', 'Rest'] },
  { label: 'Guidance', icon: 'compass-outline', needs: ['A decision', 'Wisdom', 'Direction', 'Peace', 'Patience'] },
] as const;
type Choice = { topic: string; text: string };

const isPresetChoice = (choice: Choice) => TOPICS.some(topic => topic.label === choice.topic && (topic.needs as readonly string[]).includes(choice.text));
const choiceKey = (choice: Choice) => isPresetChoice(choice) ? `${choice.topic}:${choice.text}` : `${choice.topic}:other`;
const parseDate = (value?: string) => value ? new Date(`${value.slice(0, 10)}T12:00:00`) : new Date();
const formatDisplayDate = (value?: string) => { const date = parseDate(value); return format(date, date.getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy'); };

export default function PrayerNeedPicker({ prayer, onClose, onSave, onDelete, renderUpdate }: { prayer?: PrayerApiEntry; onClose: () => void; onSave: (data: PrayerChanges) => Promise<void>; onDelete?: () => Promise<void>; renderUpdate?: (prayer: PrayerApiEntry, save: (data: PrayerChanges) => Promise<void>, close: () => void) => React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { currentFont } = useTheme();
  const { bottom } = useFloatingKeyboardButton(insets.bottom);
  const [current, setCurrent] = useState(prayer);
  const [editing, setEditing] = useState(!prayer);
  const [showUpdate, setShowUpdate] = useState(false);
  const [step, setStep] = useState(0);
  const initialChoices = (entry?: PrayerApiEntry): Choice[] => entry ? prayerNeeds(entry).map(n => ({
    text: n.text, topic: (n as typeof n & { topic?: string }).topic || TOPICS.find(t => (t.needs as readonly string[]).includes(n.text))?.label || 'Other',
  })) : [];
  const savedChoices = initialChoices(prayer);
  const [expanded, setExpanded] = useState<string | null>('Provision');
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
  const title = editing ? step === 0 ? 'What are you waiting on God for?' : step === 1 ? 'Add the details you want to remember' : 'Your prayer need' : 'What are you waiting on God for?';
  const hint = editing ? step === 0 ? 'Choose the needs on your heart. You can choose more than one.' : step === 1 ? 'Add dates, a prayer, or anything that will help you remember.' : 'Take a moment to review before saving.' : 'The needs you’re bringing to God, one prayer at a time.';
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
  return <><Modal visible animationType="slide" onRequestClose={() => !saving && onClose()}>
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}>
        <View style={styles.focusLabelContainer}><Ionicons name="leaf-outline" size={16} color={Colors.sage} /><ThemedText weight="semiBold" style={styles.focusLabel}>MY PRAYER NEED</ThemedText></View>
        {current && editing && <TouchableOpacity disabled={saving} style={styles.edit} onPress={() => { triggerLightHaptic(); cancelEditing(); }}><ThemedText style={styles.pillText}>Cancel edit</ThemedText></TouchableOpacity>}
        <ThemedText weight="bold" style={styles.title}>{title}</ThemedText>
        <ThemedText style={styles.hint}>{hint}</ThemedText>
        {showChoices && TOPICS.filter(topic => editing || choices.some(choice => choice.topic === topic.label)).map(topic => {
          const open = expanded === topic.label;
          const otherOpen = customTopicOpen === topic.label;
          const count = choices.filter(choice => choice.topic === topic.label).length;
          return <View key={topic.label} style={styles.topicSection}>
            <TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityState={{ expanded: open }} style={[styles.topic, (open || count > 0) && styles.topicActive]} onPress={() => { triggerLightHaptic(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded(open ? null : topic.label); }}>
              <Ionicons name={topic.icon} size={19} color={Colors.sage} /><ThemedText weight="semiBold" style={styles.topicText}>{topic.label}</ThemedText>
              {count > 0 && <ThemedText style={styles.count}>{count}</ThemedText>}<Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.sage} />
            </TouchableOpacity>
            {open && <><View style={styles.pills}>{(topic.needs as readonly string[]).filter(text => editing || selected.some(n => n.topic === topic.label && n.text === text)).map(text => {
              const active = selected.some(n => n.topic === topic.label && n.text === text);
              return <TouchableOpacity key={text} disabled={saving || !editing} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => toggle(topic.label, text)} style={[styles.pill, active && styles.pillActive]}>
                {active && editing && <Ionicons name="checkmark" size={13} color={Colors.sage} />}<ThemedText style={styles.pillText}>{text}</ThemedText>
              </TouchableOpacity>;
            })}{editing && <TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityState={{ expanded: otherOpen }} onPress={() => { triggerLightHaptic(); setCustomTopicOpen(otherOpen ? null : topic.label); }} style={[styles.pill, (!!topicCustom[topic.label]?.trim() || otherOpen) && styles.pillActive]}><ThemedText style={styles.pillText}>Other</ThemedText></TouchableOpacity>}</View>
            {editing && otherOpen && <TextInput value={topicCustom[topic.label] || ''} onChangeText={text => setTopicCustom(prev => ({ ...prev, [topic.label]: text }))} editable={!saving} multiline autoFocus placeholder={`What else are you waiting on God for in ${topic.label.toLowerCase()}?`} placeholderTextColor={Colors.placeholderText} style={[styles.input, { fontFamily: getFontFamily(currentFont || 'lexend', 'regular') }]} />}</>}
          </View>;
        })}

        {showChoices && <View style={styles.topicSection}>
          <TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityState={{ expanded: customInputOpen }} style={[styles.topic, (customInputOpen || !!custom.trim()) && styles.topicActive]} onPress={() => { triggerLightHaptic(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCustomInputOpen(o => !o); }}>
            <Ionicons name="add-circle-outline" size={19} color={Colors.sage} />
            <ThemedText weight="semiBold" style={styles.topicText}>Something else</ThemedText>
            {!!custom.trim() && <ThemedText style={styles.count}>1</ThemedText>}
            <Ionicons name={customInputOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.sage} />
          </TouchableOpacity>
          {customInputOpen && <TextInput value={custom} onChangeText={setCustom} editable={editing && !saving} multiline autoFocus placeholder="Another need on your heart…" placeholderTextColor={Colors.placeholderText} style={[styles.input, { fontFamily: getFontFamily(currentFont || 'lexend', 'regular') }]} />}
        </View>}
        {showChoices && choices.length > 0 && <View style={styles.summary}><ThemedText weight="semiBold" style={styles.eyebrow}>ON MY HEART · {choices.length}</ThemedText><View style={styles.pills}>{choices.map(choice => <TouchableOpacity key={`${choice.topic}-${choice.text}`} disabled={saving} accessibilityLabel={`Remove ${choice.text}`} style={[styles.pill, styles.pillActive]} onPress={() => removeChoice(choice)}><ThemedText style={styles.pillText}>{choice.text}</ThemedText><Ionicons name="close" size={12} color={Colors.sage} /></TouchableOpacity>)}</View></View>}
        {showDetails && choices.length > 0 && <View style={styles.dateSection}>
          <ThemedText weight="semiBold" style={styles.eyebrow}>DATES</ThemedText>
          <TouchableOpacity style={styles.dateRow} onPress={() => { triggerLightHaptic(); setDateTarget({ type: 'since' }); }}><View style={styles.dateText}><ThemedText style={styles.topicText}>Praying since</ThemedText><ThemedText style={styles.waiting}>{formatDisplayDate(prayingSince)}</ThemedText></View><Ionicons name="calendar-outline" size={18} color={Colors.sage} /></TouchableOpacity>
          {choices.map(choice => { const key = choiceKey(choice); const expected = expectedDates[key]; return <TouchableOpacity key={`date-${key}`} style={styles.dateRow} onPress={() => { triggerLightHaptic(); setDateTarget({ type: 'expected', key, label: choice.text }); }}><View style={styles.dateText}><ThemedText style={styles.topicText}>{choice.text}</ThemedText><ThemedText style={styles.waiting}>{expected ? `On or before ${formatDisplayDate(expected)}` : 'Add an on or before date (optional)'}</ThemedText></View><Ionicons name="calendar-outline" size={18} color={Colors.sage} /></TouchableOpacity>; })}
        </View>}
        {showDetails && <View style={[styles.topicSection, styles.notesSection]}>
          <ThemedText weight="semiBold" style={styles.eyebrow}>NOTES, PRAYER, OR DESCRIPTION</ThemedText>
          <TextInput value={notes} onChangeText={setNotes} onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)} editable={editing && !saving} multiline placeholder="Write notes, a prayer, or a description…" placeholderTextColor={Colors.placeholderText} style={[styles.input, { fontFamily: getFontFamily(currentFont || 'lexend', 'regular') }]} />
        </View>}
        {showReview && <View style={styles.reviewCard}><ThemedText weight="semiBold" style={styles.eyebrow}>ON MY HEART · {choices.length}</ThemedText>{choices.map(choice => { const expected = expectedDates[choiceKey(choice)]; return <View key={`review-${choiceKey(choice)}`} style={styles.reviewNeed}><Ionicons name="heart-outline" size={16} color={Colors.sage} /><View style={styles.dateText}><ThemedText weight="semiBold" style={styles.choiceTopic}>{choice.topic === 'Other' ? 'SOMETHING ELSE' : choice.topic.toUpperCase()}</ThemedText><ThemedText style={styles.topicText}>{choice.text}</ThemedText>{expected && <ThemedText style={styles.waiting}>On or before {formatDisplayDate(expected)}</ThemedText>}</View></View>; })}<View style={styles.reviewDivider} /><ThemedText style={styles.waiting}>Praying since {formatDisplayDate(prayingSince)}</ThemedText>{!!notes.trim() && <><ThemedText weight="semiBold" style={[styles.eyebrow, styles.reviewNotesLabel]}>NOTES, PRAYER, OR DESCRIPTION</ThemedText><ThemedText style={styles.reviewNotes}>{notes.trim()}</ThemedText></>}</View>}
        {current && !editing && <>
          <ThemedText weight="semiBold" style={[styles.eyebrow, { marginTop: 24 }]}>MY NEEDS</ThemedText>
          <ThemedText style={styles.waiting}>Praying since {formatDisplayDate(current.metadata?.praying_since || current.selected_date)}</ThemedText>
          {prayerNeeds(current).map(need => <View key={need.id} style={styles.trackingRow}><View style={{ flex: 1 }}>{!!need.topic && <ThemedText weight="semiBold" style={styles.choiceTopic}>{need.topic === 'Other' ? 'SOMETHING ELSE' : need.topic.toUpperCase()}</ThemedText>}<ThemedText style={styles.topicText}>{need.text}</ThemedText><ThemedText style={styles.waiting}>{need.status === 'answered' ? 'Answered' : need.status === 'closed' ? 'Closed' : 'Still praying'}{need.expectedDate ? ` · On or before ${formatDisplayDate(need.expectedDate)}` : ''}</ThemedText></View><TouchableOpacity disabled={saving} style={styles.pill} onPress={() => { void markAnswered(need.id); }}><Ionicons name={need.status === 'answered' ? 'checkmark-circle' : 'checkmark-circle-outline'} size={16} color={Colors.sage} /><ThemedText style={styles.pillText}>{need.status === 'answered' ? 'Answered' : 'Mark answered'}</ThemedText></TouchableOpacity></View>)}
          <View style={[styles.header, { marginTop: 24, marginBottom: 12 }]}><ThemedText weight="semiBold" style={styles.eyebrow}>UPDATES</ThemedText><TouchableOpacity disabled={saving} style={styles.pill} onPress={() => { triggerLightHaptic(); setShowUpdate(true); }}><Ionicons name="add" size={16} color={Colors.sage} /><ThemedText style={styles.pillText}>Add update</ThemedText></TouchableOpacity></View>
          {history.length ? history.map(update => <View key={update.id} style={styles.history}><ThemedText style={styles.eyebrow}>{formatDisplayDate(update.date)}{update.needId ? ' · ' + (prayerNeeds(current).find(n => n.id === update.needId)?.text || 'Prayer need') : ''}</ThemedText><ThemedText style={[styles.pillText, { marginTop: 6 }]}>{update.text}</ThemedText></View>) : <ThemedText style={styles.waiting}>Updates you add will appear here.</ThemedText>}
          {onDelete && <TouchableOpacity disabled={saving} style={styles.delete} onPress={removePrayer}><Ionicons name="trash-outline" size={22} color={Colors.error} /><ThemedText weight="semiBold" style={styles.deleteText}>Delete this prayer</ThemedText></TouchableOpacity>}
        </>}
        {current && editing && onDelete && <TouchableOpacity disabled={saving} style={styles.delete} onPress={removePrayer}><Ionicons name="trash-outline" size={22} color={Colors.error} /><ThemedText weight="semiBold" style={styles.deleteText}>Delete this prayer</ThemedText></TouchableOpacity>}
        {!current && <ThemedText style={styles.waiting}>Kept in Still praying, until you mark it answered.</ThemedText>}
      </ScrollView>
      {editing && step > 0 && <View style={[styles.topBack, { top: insets.top + 8 }]}><TouchableOpacity disabled={saving} accessibilityLabel="Previous step" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7} style={styles.closeTouch} onPress={() => { triggerLightHaptic(); setStep(previous => previous - 1); }}><Ionicons name="chevron-back" size={20} color={Colors.sage} /></TouchableOpacity></View>}
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
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9 },
  pillActive: { backgroundColor: Colors.actionBackground, borderColor: Colors.sageMuted }, pillText: { fontSize: 12, color: Colors.sage },
  trackingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  history: { borderLeftWidth: 2, borderLeftColor: Colors.cardBorder, paddingLeft: 12, marginBottom: 18 },
  summary: { marginTop: 18 }, notesSection: { marginTop: 14 }, input: { minHeight: 70, paddingHorizontal: 0, paddingVertical: 12, fontSize: 15, lineHeight: 24, color: Colors.text, textAlignVertical: 'top' },
  reviewCard: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 22, padding: 18 }, choiceTopic: { color: Colors.sageMuted, fontSize: 9, lineHeight: 14, letterSpacing: 1.2, marginBottom: 2 }, reviewNeed: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 }, reviewDivider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 12 }, reviewNotesLabel: { marginTop: 22, marginBottom: 8 }, reviewNotes: { color: Colors.text, fontSize: 14, lineHeight: 22 },
  dateSection: { marginTop: 20, marginBottom: 10 }, dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder, paddingVertical: 12 }, dateText: { flex: 1 },
  dateOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 300 }, dateModal: { backgroundColor: Colors.lightBackground, borderRadius: 24, padding: 20 }, dateTitle: { color: Colors.text, fontSize: 16, lineHeight: 23, textAlign: 'center', marginBottom: 8 }, dateDone: { alignItems: 'center', backgroundColor: Colors.sage, borderRadius: 20, paddingVertical: 12, marginTop: 8 }, dateDoneText: { color: Colors.hopeWhite, fontSize: 13 }, clearDate: { alignItems: 'center', paddingVertical: 8 }, clearDateText: { color: Colors.textGray, fontSize: 12 },
  waiting: { fontSize: 11, lineHeight: 18, color: Colors.textGray, marginTop: 8 },
  delete: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 30, paddingVertical: 17, backgroundColor: 'rgba(217, 120, 114, 0.1)', borderRadius: 999 }, deleteText: { color: Colors.error, fontSize: 16 },
  floating: { position: 'absolute', right: 20 }, save: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.sage, alignItems: 'center', justifyContent: 'center' },
});

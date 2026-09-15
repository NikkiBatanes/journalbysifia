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

const TOPICS = [
  { label: 'Provision', icon: 'wallet-outline', needs: ['Rent', 'Bills', 'Credit card', 'Groceries', 'A home', 'Debt'] },
  { label: 'School', icon: 'school-outline', needs: ['School fees', 'Tuition', 'School supplies', 'Exams', 'A scholarship'] },
  { label: 'Relationships', icon: 'heart-outline', needs: ['Future wife', 'Future husband', 'A baby', 'Marriage', 'Family', 'Reconciliation'] },
  { label: 'Work & business', icon: 'briefcase-outline', needs: ['A job', 'Business', 'Customers', 'Income', 'A new opportunity'] },
  { label: 'Health', icon: 'leaf-outline', needs: ['Healing', 'Treatment', 'Medical bills', 'Strength', 'Rest'] },
  { label: 'Guidance', icon: 'compass-outline', needs: ['A decision', 'Wisdom', 'Direction', 'Peace', 'Patience'] },
] as const;
type Choice = { topic: string; text: string };

export default function PrayerNeedPicker({ prayer, onClose, onSave, renderUpdate }: { prayer?: PrayerApiEntry; onClose: () => void; onSave: (data: PrayerChanges) => Promise<void>; renderUpdate?: (prayer: PrayerApiEntry, save: (data: PrayerChanges) => Promise<void>, close: () => void) => React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { currentFont } = useTheme();
  const { bottom } = useFloatingKeyboardButton(insets.bottom);
  const [current, setCurrent] = useState(prayer);
  const [editing, setEditing] = useState(!prayer);
  const [showUpdate, setShowUpdate] = useState(false);
  const initialChoices = (entry?: PrayerApiEntry): Choice[] => entry ? prayerNeeds(entry).map(n => ({
    text: n.text, topic: (n as typeof n & { topic?: string }).topic || TOPICS.find(t => (t.needs as readonly string[]).includes(n.text))?.label || 'Other',
  })) : [];
  const [expanded, setExpanded] = useState<string | null>('Provision');
  const [selected, setSelected] = useState<Choice[]>(initialChoices(prayer));
  const [custom, setCustom] = useState(prayer && !prayerNeeds(prayer).length ? prayer.content : '');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const completed = useRef(false);
  const ready = selected.length > 0 || !!custom.trim();
  const toggle = (topic: string, text: string) => {
    if (!editing) return;
    triggerLightHaptic();
    setSelected(prev => prev.some(n => n.topic === topic && n.text === text)
      ? prev.filter(n => n.topic !== topic || n.text !== text) : [...prev, { topic, text }]);
  };
  const save = async () => {
    if (!editing || !ready || busy.current || completed.current) return;
    triggerLightHaptic();
    busy.current = true;
    setSaving(true);
    const choices = [...selected, ...(custom.trim() ? [{ topic: 'Other', text: custom.trim() }] : [])];
    try {
      const existing = current ? prayerNeeds(current) : [];
      const nextNeeds = choices.map((n, i) => {
        const old = existing.find(prev => prev.text === n.text && initialChoices(current).find(c => c.text === prev.text)?.topic === n.topic);
        return { ...old, ...n, id: old?.id || `need-${Date.now()}-${i}`, status: old?.status || 'pending' as const };
      });
      const state = trackingStatus({ ...current, metadata: { ...current?.metadata, prayer_needs: nextNeeds } } as PrayerApiEntry);
      const data: PrayerChanges = {
        content: choices.map(n => n.text).join('\n'), status: state === 'answered' ? 'answered' : 'pending',
        answered_date: state === 'answered' ? current?.answered_date || new Date().toISOString() : null,
        metadata: { ...current?.metadata, prayer_need: true, who: 'Me', track_answered: true, tracking_status: state,
          topics: [...new Set(choices.map(n => n.topic))],
          prayer_needs: nextNeeds, prayer_updates: current?.metadata?.prayer_updates || [] },
      };
      await onSave(data);
      if (current) {
        setCurrent({ ...current, ...data });
        setSelected(initialChoices({ ...current, ...data }));
        setCustom('');
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
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}>
        <View style={styles.header}><ThemedText weight="semiBold" style={styles.eyebrow}>PRAYER NEED · FOR ME</ThemedText>{current && !editing && <TouchableOpacity disabled={saving} style={styles.pill} accessibilityLabel="Edit prayer needs" onPress={() => { triggerLightHaptic(); setEditing(true); }}><Pencil size={16} color={Colors.sage} /><ThemedText style={styles.pillText}>Edit</ThemedText></TouchableOpacity>}<TouchableOpacity disabled={saving} style={styles.close} accessibilityLabel="Close" onPress={() => { triggerLightHaptic(); onClose(); }}><Ionicons name="close" size={20} color={Colors.sage} /></TouchableOpacity></View>
        {current && editing && <TouchableOpacity disabled={saving} style={{ alignSelf: 'flex-end', marginBottom: 12 }} onPress={() => { triggerLightHaptic(); setSelected(initialChoices(current)); setCustom(prayerNeeds(current).length ? '' : current.content); setEditing(false); }}><ThemedText style={styles.pillText}>Cancel edit</ThemedText></TouchableOpacity>}
        <Ionicons name="leaf-outline" size={32} color={Colors.sage} style={styles.heroIcon} />
        <ThemedText weight="bold" style={styles.title}>What are you waiting on God for?</ThemedText>
        <ThemedText style={styles.hint}>{editing ? 'Choose a topic, then tap the needs on your heart. You can choose more than one.' : 'The needs you’re bringing to God, one prayer at a time.'}</ThemedText>
        {TOPICS.filter(topic => editing || selected.some(n => n.topic === topic.label)).map(topic => {
          const open = expanded === topic.label;
          const count = selected.filter(n => n.topic === topic.label).length;
          return <View key={topic.label} style={styles.topicSection}>
            <TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityState={{ expanded: open }} style={[styles.topic, (open || count > 0) && styles.topicActive]} onPress={() => { triggerLightHaptic(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded(open ? null : topic.label); }}>
              <Ionicons name={topic.icon} size={19} color={Colors.sage} /><ThemedText weight="semiBold" style={styles.topicText}>{topic.label}</ThemedText>
              {count > 0 && <ThemedText style={styles.count}>{count}</ThemedText>}<Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.sage} />
            </TouchableOpacity>
            {open && <View style={styles.pills}>{(topic.needs as readonly string[]).filter(text => editing || selected.some(n => n.topic === topic.label && n.text === text)).map(text => {
              const active = selected.some(n => n.topic === topic.label && n.text === text);
              return <TouchableOpacity key={text} disabled={saving || !editing} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => toggle(topic.label, text)} style={[styles.pill, active && styles.pillActive]}>
                {active && editing && <Ionicons name="checkmark" size={13} color={Colors.sage} />}<ThemedText style={styles.pillText}>{text}</ThemedText>
              </TouchableOpacity>;
            })}</View>}
          </View>;
        })}
        {editing && selected.length > 0 && <View style={styles.summary}><ThemedText weight="semiBold" style={styles.eyebrow}>ON MY HEART · {selected.length}</ThemedText><View style={styles.pills}>{selected.map(n => <TouchableOpacity key={`${n.topic}-${n.text}`} disabled={saving} accessibilityLabel={`Remove ${n.text}`} style={[styles.pill, styles.pillActive]} onPress={() => toggle(n.topic, n.text)}><ThemedText style={styles.pillText}>{n.text}</ThemedText><Ionicons name="close" size={12} color={Colors.sage} /></TouchableOpacity>)}</View></View>}
        {editing && <><ThemedText weight="semiBold" style={[styles.eyebrow, { marginTop: 22 }]}>SOMETHING ELSE</ThemedText>
        <TextInput value={custom} onChangeText={setCustom} editable={editing && !saving} multiline placeholder="Another need on your heart…" placeholderTextColor={Colors.placeholderText} style={[styles.input, { fontFamily: getFontFamily(currentFont || 'lexend', 'regular') }]} /></>}
        {current && !editing && <>
          <ThemedText weight="semiBold" style={[styles.eyebrow, { marginTop: 24 }]}>MY NEEDS</ThemedText>
          {prayerNeeds(current).map(need => <View key={need.id} style={styles.trackingRow}><View style={{ flex: 1 }}><ThemedText style={styles.topicText}>{need.text}</ThemedText><ThemedText style={styles.waiting}>{need.status === 'answered' ? 'Answered' : need.status === 'closed' ? 'Closed' : 'Still praying'}</ThemedText></View><TouchableOpacity disabled={saving} style={styles.pill} onPress={() => { void markAnswered(need.id); }}><Ionicons name={need.status === 'answered' ? 'checkmark-circle' : 'checkmark-circle-outline'} size={16} color={Colors.sage} /><ThemedText style={styles.pillText}>{need.status === 'answered' ? 'Answered' : 'Mark answered'}</ThemedText></TouchableOpacity></View>)}
          <View style={[styles.header, { marginTop: 24, marginBottom: 12 }]}><ThemedText weight="semiBold" style={styles.eyebrow}>UPDATES</ThemedText><TouchableOpacity disabled={saving} style={styles.pill} onPress={() => { triggerLightHaptic(); setShowUpdate(true); }}><Ionicons name="add" size={16} color={Colors.sage} /><ThemedText style={styles.pillText}>Add update</ThemedText></TouchableOpacity></View>
          {history.length ? history.map(update => <View key={update.id} style={styles.history}><ThemedText style={styles.eyebrow}>{format(new Date(update.date), 'MMM d, yyyy')}{update.needId ? ' · ' + (prayerNeeds(current).find(n => n.id === update.needId)?.text || 'Prayer need') : ''}</ThemedText><ThemedText style={[styles.pillText, { marginTop: 6 }]}>{update.text}</ThemedText></View>) : <ThemedText style={styles.waiting}>Updates you add will appear here.</ThemedText>}
        </>}
        {!current && <ThemedText style={styles.waiting}>Kept in Still praying, until you mark it answered.</ThemedText>}
      </ScrollView>
    </KeyboardAvoidingView>
    {editing && <Animated.View style={[styles.floating, { bottom }]}><TouchableOpacity disabled={!ready || saving} accessibilityLabel="Save prayer needs" style={[styles.save, (!ready || saving) && { opacity: 0.5 }]} onPress={save}><Ionicons name="checkmark" size={24} color={Colors.hopeWhite} /></TouchableOpacity></Animated.View>}
  </Modal>{showUpdate && current && renderUpdate?.(current, persist, () => setShowUpdate(false))}</>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.lightBackground }, content: { paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  eyebrow: { fontSize: 10, lineHeight: 15, letterSpacing: 1.5, color: Colors.sageMuted },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.actionBackground, alignItems: 'center', justifyContent: 'center' },
  heroIcon: { alignSelf: 'center', marginBottom: 16 }, title: { fontSize: 25, lineHeight: 34, textAlign: 'center', color: Colors.text },
  hint: { fontSize: 13, lineHeight: 21, textAlign: 'center', color: Colors.textGray, marginTop: 12, marginBottom: 26 },
  topicSection: { marginBottom: 10 }, topic: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 13 },
  topicActive: { backgroundColor: Colors.actionBackground, borderColor: Colors.sageMuted }, topicText: { flex: 1, fontSize: 14, color: Colors.sage }, count: { color: Colors.sage, fontSize: 11 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9 },
  pillActive: { backgroundColor: Colors.actionBackground, borderColor: Colors.sageMuted }, pillText: { fontSize: 12, color: Colors.sage },
  trackingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  history: { borderLeftWidth: 2, borderLeftColor: Colors.cardBorder, paddingLeft: 12, marginBottom: 18 },
  summary: { marginTop: 18 }, input: { minHeight: 70, paddingHorizontal: 0, paddingVertical: 12, fontSize: 15, lineHeight: 24, color: Colors.text, textAlignVertical: 'top' },
  waiting: { fontSize: 11, lineHeight: 18, color: Colors.textGray, marginTop: 8 },
  floating: { position: 'absolute', right: 20 }, save: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.sage, alignItems: 'center', justifyContent: 'center' },
});

import { triggerLightHaptic } from '../../utils/haptics';
import React, { useRef, useState } from 'react';
import { Alert, Animated, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil, Sparkle } from 'lucide-react-native';
import { format } from 'date-fns';
import ThemedText from '../common/ThemedText';
import StepFadeIn from '../common/StepFadeIn';
import PrayerHandsIcon from '../common/PrayerHandsIcon';
import PrayerResponseSheet from './PrayerResponseSheet';
import PrayerWritingSheet from './PrayerWritingSheet';
import { Colors } from '../../theme/colors';
import type { PrayerApiEntry } from '../../services/api/prayerApi';
import { answerPrayer, releasePrayer, hasAnswerHistory, isPrayerActive, isPrayerLetGo, isTrackedPrayer, prayerNeeds, trackingStatus, type PrayerNeed, type PrayerUpdate } from '../../utils/prayerTracking';

export type PrayerChanges = { content: string; person_name?: string; notes?: string; status: 'pending' | 'answered'; answered_date: string | null; metadata: Record<string, any>; prayed?: boolean; prayer_count?: number; last_prayed_at?: string };
type Props = { prayer: PrayerApiEntry; onClose: () => void; onSave: (data: PrayerChanges) => Promise<void>; onDelete?: () => Promise<void>; renderUpdate: (prayer: PrayerApiEntry, save: (data: PrayerChanges) => Promise<void>, close: () => void) => React.ReactNode };
const dateLabel = (date?: string | null) => { try { if (!date) return ''; const value = new Date(date.length === 10 ? `${date}T12:00:00` : date); return format(value, value.getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy'); } catch { return ''; } };
export default function PrayerDetails({ prayer, onClose, onSave, onDelete, renderUpdate }: Props) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(prayer);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const closingRef = useRef(false);
  const pageExit = useRef(new Animated.Value(1)).current;
  const [editor, setEditor] = useState<'prayer' | 'need' | 'update' | 'response' | null>(null);
  const [draft, setDraft] = useState('');
  const [editingNeed, setEditingNeed] = useState<string | undefined>();
  const needs = prayerNeeds(current);
  const state = trackingStatus(current);
  const tracked = isTrackedPrayer(current);
  const history: PrayerUpdate[] = Array.isArray(current.metadata?.prayer_updates) ? [...(current.metadata?.prayer_updates || [])].reverse() : [];
  const base = (): PrayerChanges => ({ content: current.content, person_name: current.person_name, status: state === 'answered' ? 'answered' : 'pending', answered_date: current.answered_date || null, metadata: { ...current.metadata } });
  const persist = async (data: PrayerChanges) => {
    if (busy.current) return;
    busy.current = true; setSaving(true);
    try { await onSave(data); setCurrent(prev => ({ ...prev, ...data, answered_date: data.answered_date, is_answered: data.status === 'answered' })); }
    finally { busy.current = false; setSaving(false); }
  };
  const run = async (data: PrayerChanges) => { try { await persist(data); } catch { Alert.alert('Could not save', 'Please try again.'); } };
  const setNeeds = (next: PrayerNeed[]) => {
    const nextState = next.length ? trackingStatus({ ...current, metadata: { ...current.metadata, prayer_needs: next } }) : state;
    return { ...base(), status: nextState === 'answered' ? 'answered' as const : 'pending' as const, answered_date: nextState === 'answered' ? current.answered_date || new Date().toISOString() : null, metadata: { ...current.metadata, track_answered: true, tracking_status: nextState, prayer_needs: next } };
  };
  const markAnswer = (needId?: string) => Alert.alert('Record an answer', 'Would you like to continue praying about this?', [
    { text: 'Stop tracking', onPress: () => { triggerLightHaptic(); void run({ ...base(), ...answerPrayer(current, needId) }); } },
    { text: 'Continue praying', onPress: () => { triggerLightHaptic(); void run({ ...base(), ...answerPrayer(current, needId, new Date().toISOString(), undefined, true) }); } },
    { text: 'Cancel', style: 'cancel' },
  ]);
  const toggleNeedReleased = (needId: string) => { void run(setNeeds(needs.map(n => n.id === needId ? { ...n, status: n.status === 'closed' ? 'pending' as const : 'closed' as const, answeredDate: undefined } : n))); };
  const openNeed = (need?: PrayerNeed) => { setEditingNeed(need?.id); setDraft(need?.text || ''); setEditor('need'); };
  const toggleReleased = () => {
    if (isPrayerLetGo(current)) { void run({ ...base(), ...releasePrayer(current) }); return; }
    Alert.alert('Let go of this prayer?', 'Journal will stop bringing it into Still Praying and Today.\nIt will remain in your journal.', [
      { text: 'Keep praying', style: 'cancel' },
      { text: 'Let Go', style: 'destructive', onPress: () => { triggerLightHaptic(); void run({ ...base(), ...releasePrayer(current) }); } },
    ]);
  };
  const statusMenu = () => Alert.alert('Prayer status', undefined, [
    { text: tracked ? 'Just save this prayer' : 'Keep praying about this', onPress: () => { triggerLightHaptic(); void run({ ...base(), metadata: { ...current.metadata, track_answered: !tracked } }); } },
    { text: isPrayerLetGo(current) ? 'Return to prayer' : 'Let go of this prayer', onPress: () => { triggerLightHaptic(); toggleReleased(); } },
    { text: 'Cancel', style: 'cancel', onPress: triggerLightHaptic },
  ]);
  const needMenu = (need: PrayerNeed) => Alert.alert(need.text, undefined, [
    { text: 'Edit need', onPress: () => { triggerLightHaptic(); openNeed(need); } },
    { text: need.status === 'answered' ? 'Still praying' : 'Mark answered', onPress: () => { triggerLightHaptic(); markAnswer(need.id); } },
    { text: need.status === 'closed' ? 'Return to prayer' : 'Let go of this need', onPress: () => { triggerLightHaptic(); toggleNeedReleased(need.id); } },
    { text: 'Remove need', style: 'destructive', onPress: () => { triggerLightHaptic(); void run(setNeeds(needs.filter(n => n.id !== need.id))); } },
    { text: 'Cancel', style: 'cancel', onPress: triggerLightHaptic },
  ]);
  const remove = () => onDelete && Alert.alert('Delete this prayer?', 'This will remove this prayer and its saved needs and updates.', [{ text: 'Cancel', style: 'cancel', onPress: triggerLightHaptic }, { text: 'Delete', style: 'destructive', onPress: async () => { if (busy.current) return; triggerLightHaptic(); busy.current = true; setSaving(true); try { await onDelete(); onClose(); } catch { Alert.alert('Could not delete', 'Please try again.'); } finally { busy.current = false; setSaving(false); } } }]);
  const label = (text: string) => <ThemedText weight="semiBold" style={styles.label}>{text}</ThemedText>;
  const action = (text: string, icon: string, press: () => void, filled = false, delay = 0) => <StepFadeIn delay={delay}><TouchableOpacity disabled={saving} activeOpacity={0.75} onPress={() => { triggerLightHaptic(); return (press)(); }} style={[styles.action, filled && styles.filled]}><>{icon === 'prayer-hands' ? <PrayerHandsIcon size={16} color={filled ? Colors.hopeWhite : Colors.sage} /> : icon === 'pencil-outline' ? <Pencil size={16} color={filled ? Colors.hopeWhite : Colors.sage} /> : icon === 'sparkle' ? <Sparkle size={16} color={filled ? Colors.hopeWhite : Colors.sage} strokeWidth={1.8} /> : <Ionicons name={icon as any} size={16} color={filled ? Colors.hopeWhite : Colors.sage} />}</><ThemedText weight="semiBold" style={[styles.actionText, filled && { color: Colors.hopeWhite }]}>{text}</ThemedText></TouchableOpacity></StepFadeIn>;
  const closeDetails = () => {
    if (saving || closingRef.current) return;
    closingRef.current = true;
    Animated.timing(pageExit, { toValue: 0, duration: 190, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onClose();
      else closingRef.current = false;
    });
  };
  return <Modal visible transparent presentationStyle="overFullScreen" animationType="none" onRequestClose={closeDetails}>
    <Animated.View style={[styles.page, { opacity: pageExit, transform: [{ translateY: pageExit.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }, { scale: pageExit.interpolate({ inputRange: [0, 1], outputRange: [0.99, 1] }) }] }]}>
      <StepFadeIn delay={0} style={[styles.header, { paddingTop: insets.top + 12 }]}><ThemedText weight="bold" style={styles.title}>Your prayer</ThemedText><TouchableOpacity style={styles.close} disabled={saving} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => { triggerLightHaptic(); closeDetails(); }} accessibilityLabel="Close prayer details"><Ionicons name="close" size={17} color={Colors.textGray} /></TouchableOpacity></StepFadeIn>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }}>
        <StepFadeIn delay={70}><View style={styles.card}>
          <View style={styles.row}>{label('YOUR PRAYER')}<StepFadeIn delay={120}><TouchableOpacity style={styles.iconAction} disabled={saving} activeOpacity={0.75} onPress={() => { triggerLightHaptic(); setDraft(current.content); setEditor('prayer'); }} accessibilityLabel="Edit prayer"><Pencil size={17} color={Colors.sage} strokeWidth={1.8} /></TouchableOpacity></StepFadeIn></View>
          <ThemedText style={styles.prayerText}>{current.content}</ThemedText>
          {!!current.metadata?.prayer_request_display && <View style={styles.request}><View style={styles.requestContent}><Ionicons name="mail-unread-outline" size={12} color={Colors.alertCoral} /><ThemedText style={styles.hint}>Prayer request: {current.metadata.prayer_request_display}</ThemedText></View></View>}
          {!!current.notes && <View style={styles.row}>{label('NOTES')}</View>}
          {!!current.notes && <ThemedText style={styles.prayerText}>{current.notes}</ThemedText>}
          <View style={styles.divider} />{label('TOPICS')}
          <View style={styles.topics}>{['Provision', 'Health', 'Guidance', 'Relationships', 'Work', 'Other'].map((topic, index) => { const active = current.metadata?.topic === topic; return <StepFadeIn key={topic} delay={140 + index * 45}><TouchableOpacity disabled={saving} activeOpacity={0.75} onPress={() => { triggerLightHaptic(); return (() => { void run({ ...base(), metadata: { ...current.metadata, topic: active ? '' : topic } }); })(); }} style={[styles.topic, active && styles.topicActive]}><ThemedText weight="medium" style={[styles.topicText, active && styles.topicTextActive]}>{topic}</ThemedText></TouchableOpacity></StepFadeIn>; })}</View>
        </View></StepFadeIn>
        <StepFadeIn delay={140}><View style={styles.card}>
          <View style={styles.row}>{label('PRAYER STATUS')}<ThemedText style={styles.date}>Since {dateLabel(current.created_at)}</ThemedText></View>
          <TouchableOpacity disabled={saving} onPress={() => { triggerLightHaptic(); return (statusMenu)(); }} style={styles.status}><Ionicons name="ellipse" size={12} color={Colors.sage} /><ThemedText weight="bold" style={styles.statusText}>{!tracked ? 'Saved prayer' : current.is_prayer_request && !current.prayed && state === 'pending' ? 'Needs prayer' : isPrayerLetGo(current) ? 'Let go' : isPrayerActive(current) && hasAnswerHistory(current) ? 'Answered · Still praying' : hasAnswerHistory(current) ? 'Answered' : 'Still praying'}</ThemedText><Ionicons name="chevron-down" size={18} color={Colors.sage} /></TouchableOpacity>
          <View style={styles.actions}>{action(current.is_prayer_request ? 'Pray now' : 'Pray again', 'prayer-hands', () => { if (current.is_prayer_request) { setEditor('response'); return; } void run({ ...base(), prayed: true, prayer_count: (current.prayer_count ?? (current.prayed ? 1 : 0)) + 1, last_prayed_at: new Date().toISOString() }); }, false, 210)}{tracked && needs.length < 2 && action('Record an answer', 'sparkle', () => markAnswer(), false, 255)}</View>
          {needs.length > 1 && <ThemedText style={styles.hint}>Mark individual needs answered below.</ThemedText>}
        </View></StepFadeIn>
        <StepFadeIn delay={210}><View style={styles.card}>
          <View style={styles.row}>{label('TRACKED NEEDS')}{action('Add a need', 'add', () => openNeed(), false, 280)}</View><ThemedText style={styles.hint}>Add separate needs when one prayer holds several requests.</ThemedText>
          {needs.map(need => <View style={styles.need} key={need.id}><View style={styles.needIcon}><Ionicons name="leaf-outline" size={22} color={Colors.sage} /></View><View style={{ flex: 1 }}><ThemedText style={styles.needText}>{need.text}</ThemedText><ThemedText style={styles.hint}>{need.status === 'pending' ? 'Still praying' : need.status === 'answered' ? 'Answered' : 'Let go'}</ThemedText></View><TouchableOpacity disabled={saving} onPress={() => { triggerLightHaptic(); return (() => needMenu(need))(); }} accessibilityLabel={`Options for ${need.text}`}><Ionicons name="ellipsis-horizontal" size={20} color={Colors.sage} /></TouchableOpacity></View>)}
        </View></StepFadeIn>
        <StepFadeIn delay={280}><View style={styles.card}>
          <View style={styles.row}>{label('UPDATES')}{action('Add update', 'add', () => setEditor('update'), true, 350)}</View><ThemedText style={styles.hint}>Keep a record of what’s happening.</ThemedText>
          {[...history, { id: 'prayer-added', date: current.created_at, text: 'Prayer added' }].map((update, index, all) => <View key={update.id} style={styles.timelineRow}><View style={styles.timelineRail}><View style={styles.dot} />{index < all.length - 1 && <View style={styles.timelineLine} />}</View><View style={styles.timelineContent}><ThemedText style={styles.date}>{dateLabel(update.date)}</ThemedText><ThemedText style={styles.needText}>{update.text}</ThemedText></View></View>)}
        </View></StepFadeIn>
        {onDelete && <StepFadeIn delay={350}><TouchableOpacity disabled={saving} onPress={() => { triggerLightHaptic(); return (remove)(); }} style={[styles.delete, styles.deleteButton]}><Ionicons name="trash-outline" size={22} color={Colors.error} /><ThemedText weight="semiBold" style={styles.deleteText}>Delete this prayer</ThemedText></TouchableOpacity></StepFadeIn>}
      </ScrollView>
      {editor === 'response' && <PrayerResponseSheet request={current} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); closeDetails(); }} />}
      {editor === 'update' && renderUpdate(current, persist, () => setEditor(null))}
      {(editor === 'prayer' || editor === 'need') && <PrayerWritingSheet title={editor === 'prayer' ? 'Your prayer' : editingNeed ? 'Your prayer need' : 'A prayer need'} eyebrow={editor === 'prayer' ? 'EDIT PRAYER' : 'TRACKED NEED'} context={editor === 'need' ? current.content : ''} contextLabel="YOUR PRAYER" placeholder={editor === 'prayer' ? 'Continue your prayer…' : 'What are you bringing to God?'} value={draft} onChangeText={setDraft} onClose={() => setEditor(null)} saving={saving} saveLabel="Save" onSave={async () => { try { await persist(editor === 'prayer' ? { ...base(), content: draft.trim() } : setNeeds(editingNeed ? needs.map(n => n.id === editingNeed ? { ...n, text: draft.trim() } : n) : [...needs, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: draft.trim(), status: 'pending' }])); setEditor(null); } catch { Alert.alert('Could not save', 'Please try again.'); } }} />}
    </Animated.View>
  </Modal>;
}
const styles = StyleSheet.create({
  deleteButton: { width: '100%', gap: 10, marginTop: 12, paddingVertical: 17, backgroundColor: 'rgba(217, 120, 114, 0.1)', borderRadius: 999 },
  deleteText: { color: Colors.error, fontSize: 16 },
  page: { flex: 1, backgroundColor: Colors.lightBackground }, header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingBottom: 12 }, title: { flex: 1, fontSize: 25, color: Colors.text }, close: { width: 42, height: 42, borderRadius: 999, backgroundColor: Colors.cardBackground, alignItems: 'center', justifyContent: 'center' }, card: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 22, padding: 16, marginBottom: 12 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }, label: { color: Colors.sage, fontSize: 10, letterSpacing: 1.5 }, prayerText: { fontSize: 16, lineHeight: 25, color: Colors.text }, hint: { color: Colors.textGray, fontSize: 12, lineHeight: 19 }, date: { color: Colors.textGray, fontSize: 11, lineHeight: 18 }, action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 0.5, borderColor: 'rgba(82, 106, 91, 0.2)', borderRadius: 28, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: 'rgba(82, 106, 91, 0.08)' }, iconAction: { width: 42, height: 42, borderWidth: 0.5, borderColor: 'rgba(82, 106, 91, 0.2)', borderRadius: 21, backgroundColor: 'rgba(82, 106, 91, 0.08)', alignItems: 'center', justifyContent: 'center' }, actionText: { color: Colors.text, fontSize: 11 }, filled: { backgroundColor: Colors.sageMuted, borderColor: Colors.sage }, divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 16 }, topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }, topic: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 28, backgroundColor: 'rgba(82, 106, 91, 0.08)', borderWidth: 0.5, borderColor: 'rgba(82, 106, 91, 0.2)' }, topicActive: { backgroundColor: Colors.sageMuted, borderColor: Colors.sage }, topicText: { color: Colors.text, fontSize: 11 }, topicTextActive: { color: Colors.hopeWhite }, status: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.actionBackground, borderRadius: 18, padding: 14, marginBottom: 12 }, statusText: { flex: 1, color: Colors.text, fontSize: 16 }, actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, need: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 18, padding: 12, marginTop: 12 }, needIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.actionBackground, alignItems: 'center', justifyContent: 'center' }, needText: { color: Colors.text, fontSize: 14, lineHeight: 21 }, request: { marginTop: 12, borderWidth: 1, borderColor: 'rgba(217, 120, 114, 0.28)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }, requestContent: { flexDirection: 'row', alignItems: 'center', gap: 7 }, timelineRow: { flexDirection: 'row', marginTop: 14 }, timelineRail: { width: 24, alignItems: 'center' }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.sageMuted, marginTop: 6 }, timelineLine: { flex: 1, width: 1, backgroundColor: Colors.cardBorder, marginTop: 4, marginBottom: -14 }, timelineContent: { flex: 1, paddingLeft: 4, paddingBottom: 8 }, delete: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: 'rgba(217,120,114,0.1)', borderRadius: 24, padding: 16, marginTop: 4 },
});

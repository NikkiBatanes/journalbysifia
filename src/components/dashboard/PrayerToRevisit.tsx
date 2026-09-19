import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../common/ThemedText';
import PrayerHandsIcon from '../common/PrayerHandsIcon';
import PrayerTrackingModal from '../prayer/PrayerTrackingModal';
import type { PrayerChanges } from '../prayer/PrayerDetails';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useAllPrayerData } from '../../services/hooks/usePrayerData';
import { PrayerApi } from '../../services/api/prayerApi';
import { getPrayerIntelligenceCandidates, selectPrayerIntelligenceCandidate, type PrayerIntelligenceCandidate } from '../../services/prayerIntelligenceService';
import { dismissPrayerResurfacing, getPrayerResurfacingState, recordPrayerResurfaced } from '../../storage/prayerResurfacingStorage';
import { answerPrayer, continuePrayer, prayerNeeds, releasePrayer } from '../../utils/prayerTracking';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import { Colors } from '../../theme/colors';

const labels = { return: 'RETURN', check_in: 'CHECK IN', follow_up: 'FOLLOW UP', remember: 'REMEMBER', celebrate: 'CELEBRATE' } as const;
const headings = { return: 'A prayer to return to', check_in: 'How is this prayer now?', follow_up: 'A request to follow up', remember: 'Something you wrote', celebrate: 'A prayer you marked Answered' } as const;

export default function PrayerToRevisit() {
  const { user } = useAuth(); const userId = user?.id || 'local';
  const queryClient = useQueryClient(); const { data: prayers, refetch } = useAllPrayerData(userId);
  const [candidate, setCandidate] = useState<PrayerIntelligenceCandidate | null>(null);
  const [available, setAvailable] = useState<PrayerIntelligenceCandidate[]>([]);
  const [mode, setMode] = useState<'details' | 'update' | null>(null); const [saving, setSaving] = useState(false);
  const generation = useRef(0);
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  useEffect(() => {
    const saved = DeviceEventEmitter.addListener('prayerSaved', () => void refetch());
    const deleted = DeviceEventEmitter.addListener('prayer_deleted', () => void refetch());
    return () => { saved.remove(); deleted.remove(); };
  }, [refetch]);
  useEffect(() => {
    if (!prayers || mode) return; const version = ++generation.current;
    void getPrayerResurfacingState(userId).then(state => {
      const list = getPrayerIntelligenceCandidates(prayers, new Date(), state.items);
      const selected = selectPrayerIntelligenceCandidate(list, state.recentIds);
      if (version !== generation.current) return;
      setAvailable(list); setCandidate(selected);
      if (selected) void recordPrayerResurfaced(userId, selected);
    });
    return () => { generation.current++; };
  }, [prayers, userId, mode]);
  const prayer = prayers?.find(item => item.id === candidate?.prayerId);
  const need = prayer && candidate?.needId ? prayerNeeds(prayer).find(item => item.id === candidate.needId) : undefined;
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['prayers'] }); DeviceEventEmitter.emit('prayerSaved'); };
  const persist = async (data: PrayerChanges) => {
    if (!prayer) return; await PrayerApi.updatePrayer(prayer.id, data);
    const requestId = prayer.is_prayer_request ? prayer.id : prayer.metadata?.original_request_id;
    if (requestId) for (const linked of (prayers || []).filter(item => item.id !== prayer.id && (item.id === requestId || item.metadata?.original_request_id === requestId))) {
      await PrayerApi.updatePrayer(linked.id, { status: data.status, answered_date: data.answered_date, metadata: { ...linked.metadata, ...Object.fromEntries(['track_answered', 'is_active', 'tracking_status', 'answer_history', 'lifecycle_history', 'prayer_needs', 'prayer_updates'].filter(key => data.metadata[key] !== undefined).map(key => [key, data.metadata[key]])) } });
    }
    triggerSuccessHaptic(); await refresh();
  };
  const lifecycle = async (kind: 'pray' | 'continue' | 'answer' | 'release') => {
    if (!prayer || saving) return; setSaving(true); triggerLightHaptic();
    try {
      if (kind === 'pray') { const stamp = new Date().toISOString(); await PrayerApi.updatePrayer(prayer.id, { prayed: true, prayer_count: (prayer.prayer_count ?? (prayer.prayed ? 1 : 0)) + 1, last_prayed_at: stamp, metadata: { ...prayer.metadata, ...(candidate?.needId ? { need_last_prayed: { ...prayer.metadata?.need_last_prayed, [candidate.needId]: stamp } } : {}) } }); await refresh(); }
      else await persist({ content: prayer.content, ...(kind === 'continue' ? continuePrayer(prayer, candidate?.needId) : kind === 'answer' ? answerPrayer(prayer, candidate?.needId) : releasePrayer(prayer)) });
    } catch { Alert.alert('Could not update prayer', 'Please try again.'); } finally { setSaving(false); }
  };
  const showAnother = () => {
    if (!candidate) return; const next = selectPrayerIntelligenceCandidate(available.filter(item => item.id !== candidate.id));
    setCandidate(next); if (next) void recordPrayerResurfaced(userId, next);
  };
  const notNow = () => { if (!candidate) return; triggerLightHaptic(); void dismissPrayerResurfacing(userId, candidate).then(showAnother); };
  if (!candidate || !prayer) return null;
  const title = need?.text || prayer.person_name || prayer.content.split('\n')[0];
  const action = (text: string, onPress: () => void, icon?: boolean) => <TouchableOpacity disabled={saving} style={styles.button} onPress={onPress}>{icon && <PrayerHandsIcon size={13} color={Colors.sage} />}<ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.buttonText}>{text}</ThemedText></TouchableOpacity>;
  return <View style={styles.card}>
    <ThemedText weight="semiBold" style={styles.label}>{labels[candidate.purpose]}</ThemedText>
    <TouchableOpacity disabled={saving} accessibilityLabel={`View prayer: ${title}`} onPress={() => { triggerLightHaptic(); setMode('details'); }}>
      <View style={styles.row}><Ionicons name={candidate.purpose === 'celebrate' ? 'sparkles-outline' : 'leaf-outline'} size={24} color={Colors.sage} /><View style={{ flex: 1 }}><ThemedText weight="semiBold" style={styles.heading}>{headings[candidate.purpose]}</ThemedText><ThemedText numberOfLines={2} style={styles.title}>{title}</ThemedText><ThemedText style={styles.meta}>{candidate.displayContext}{candidate.prayerCount ? ` · Returned ${candidate.prayerCount} ${candidate.prayerCount === 1 ? 'time' : 'times'}` : ''}</ThemedText></View></View>
    </TouchableOpacity>
    <View style={styles.actions}>
      {(candidate.purpose === 'return' || candidate.purpose === 'follow_up') && action(prayer.prayed ? 'Pray again' : 'Pray now', () => void lifecycle('pray'), true)}
      {candidate.purpose === 'check_in' && action('Still praying', () => void lifecycle('continue'), true)}
      {candidate.purpose === 'remember' && action('Keep praying', () => void lifecycle('continue'), true)}
      {candidate.purpose !== 'celebrate' && action(candidate.purpose === 'follow_up' ? 'Add follow-up' : 'Add update', () => { triggerLightHaptic(); setMode('update'); })}
      {(candidate.purpose === 'return' || candidate.purpose === 'check_in' || candidate.purpose === 'follow_up') && action('Record answer', () => void lifecycle('answer'))}
      {candidate.purpose === 'celebrate' && action('Read', () => setMode('details'))}
    </View>
    <View style={styles.secondary}>{available.length > 1 && <TouchableOpacity onPress={showAnother}><ThemedText style={styles.meta}>Show another</ThemedText></TouchableOpacity>}<TouchableOpacity onPress={notNow}><ThemedText style={styles.meta}>Not now</ThemedText></TouchableOpacity></View>
    {mode && <PrayerTrackingModal key={prayer.id} prayer={prayer} mode={mode} initialNeedId={candidate.needId} onShowDetails={() => setMode('details')} onSave={persist} onClose={() => setMode(null)} />}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: Colors.hopeWhite, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, padding: 20, marginBottom: 16 }, label: { color: Colors.sage, fontSize: 10, letterSpacing: 1.5 }, row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  heading: { color: Colors.text, fontSize: 15, lineHeight: 22 }, title: { color: Colors.textGray, fontSize: 13, lineHeight: 20, marginTop: 2 }, meta: { color: Colors.textGray, fontSize: 11, lineHeight: 18 }, actions: { flexDirection: 'row', gap: 6, marginTop: 18 },
  button: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 4, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 6 }, buttonText: { color: Colors.sage, fontSize: 11 }, secondary: { flexDirection: 'row', justifyContent: 'center', gap: 26, marginTop: 14 },
});

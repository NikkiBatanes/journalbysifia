import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, formatDistanceToNowStrict, format } from 'date-fns';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {Sparkle} from 'lucide-react-native';
import ThemedText from '../common/ThemedText';
import PrayerTrackingModal from '../prayer/PrayerTrackingModal';
import type { PrayerChanges } from '../prayer/PrayerDetails';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useAllPrayerData } from '../../services/hooks/usePrayerData';
import { PrayerApi } from '../../services/api/prayerApi';
import { selectPrayerRevisit, revisitCandidates, type PrayerRevisit } from '../../services/prayerRevisitService';
import { answerPrayer, prayerNeeds } from '../../utils/prayerTracking';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import { Colors } from '../../theme/colors';

export default function PrayerToRevisit() {
  const { user } = useAuth();
  const userId = user?.id || 'local';
  const queryClient = useQueryClient();
  const { data: prayers, refetch } = useAllPrayerData(userId);
  const [today, setToday] = useState(() => new Date());
  const [selection, setSelection] = useState<PrayerRevisit | null>(null);
  const [mode, setMode] = useState<'details' | 'update' | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const generation = useRef(0);
  useFocusEffect(useCallback(() => {
    setToday(new Date()); void refetch();
    const timer = setInterval(() => setToday(new Date()), 60000);
    return () => clearInterval(timer);
  }, [refetch]));
  useEffect(() => {
    const saved = DeviceEventEmitter.addListener('prayerSaved', () => { void refetch(); });
    const deleted = DeviceEventEmitter.addListener('prayer_deleted', () => { void refetch(); });
    return () => { saved.remove(); deleted.remove(); };
  }, [refetch]);
  const day = format(today, 'yyyy-MM-dd');
  useEffect(() => {
    if (!prayers || mode) return;
    const version = ++generation.current;
    void selectPrayerRevisit(userId, prayers, today).then(item => {
      if (version === generation.current) setSelection(item);
    }).catch(() => { if (version === generation.current) setSelection(null); });
    return () => { generation.current++; };
  }, [prayers, userId, day, mode]);
  const candidateCount = useMemo(() => revisitCandidates(prayers || [], day).length, [prayers, day]);
  const prayer = prayers?.find(p => p.id === selection?.prayerId);
  const need = prayer && selection?.needId ? prayerNeeds(prayer).find(n => n.id === selection.needId) : undefined;
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['prayers'] }); DeviceEventEmitter.emit('prayerSaved'); };
  const persist = async (data: PrayerChanges) => {
    if (!prayer) return;
    await PrayerApi.updatePrayer(prayer.id, data);
    const requestId = prayer.metadata?.original_request_id;
    if (requestId) {
      const related = await PrayerApi.getAllPrayers(userId);
      for (const linked of related.filter(p => p.id !== prayer.id && (p.id === requestId || p.metadata?.original_request_id === requestId))) {
        await PrayerApi.updatePrayer(linked.id, { status: data.status, answered_date: data.answered_date, metadata: {
          ...linked.metadata, ...Object.fromEntries(['track_answered', 'tracking_status', 'prayer_needs', 'prayer_updates'].filter(key => data.metadata[key] !== undefined).map(key => [key, data.metadata[key]])),
        } });
      }
    }
    triggerSuccessHaptic(); await refresh();
  };
  const action = async (answered: boolean) => {
    if (!prayer || busy.current) return;
    triggerLightHaptic(); busy.current = true; setSaving(true);
    try {
      if (answered) await persist({ content: prayer.content, ...answerPrayer(prayer, selection?.needId) });
      else {
        const stamp = new Date().toISOString();
        await PrayerApi.updatePrayer(prayer.id, { prayed: true, prayer_count: (prayer.prayer_count ?? (prayer.prayed ? 1 : 0)) + 1, last_prayed_at: stamp,
          metadata: { ...prayer.metadata, ...(selection?.needId ? { need_last_prayed: { ...prayer.metadata?.need_last_prayed, [selection.needId]: stamp } } : {}) } });
        triggerSuccessHaptic(); await refresh();
      }
    } catch { Alert.alert('Could not update prayer', 'Please try again.'); }
    finally { busy.current = false; setSaving(false); }
  };
  if (!prayer || !selection) return null;
  const last = selection.needId ? prayer.metadata?.need_last_prayed?.[selection.needId] : prayer.last_prayed_at;
  const prayedToday = last && format(new Date(last), 'yyyy-MM-dd') === day;
  const elapsed = last ? Math.max(0, differenceInCalendarDays(today, new Date(last))) : null;
  const label = prayedToday ? 'Prayed today' : elapsed === null ? 'Still praying' : elapsed === 1 ? 'Last prayed yesterday' : `Last prayed ${elapsed} days ago`;
  const title = need?.text || prayer.person_name || (prayer.metadata?.prayer_style === 'cast' ? 'Your CAST supplication' : prayer.content.split('\n')[0]);
  return <View style={styles.card}>
    <View style={styles.header}>
      <ThemedText weight="semiBold" style={styles.label}>A PRAYER TO REVISIT</ThemedText>
      <ThemedText style={styles.savedDate}>{formatDistanceToNowStrict(new Date(prayer.created_at), { addSuffix: true })}</ThemedText>
    </View>
    <TouchableOpacity disabled={saving} accessibilityLabel={`View prayer: ${title}`} onPress={() => { triggerLightHaptic(); setMode('details'); }}>
      <View style={styles.row}><Ionicons name="leaf-outline" size={24} color={Colors.sage} /><View style={{ flex: 1 }}><ThemedText weight="semiBold" numberOfLines={2} style={styles.title}>{title}</ThemedText><ThemedText style={styles.meta}>{label}</ThemedText></View></View>
      {!need && <ThemedText numberOfLines={3} style={styles.preview}>{prayer.content}</ThemedText>}
    </TouchableOpacity>
    <View style={styles.actions}>
      <TouchableOpacity disabled={saving || !!prayedToday} style={styles.button} onPress={() => { void action(false); }}><ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.buttonText}>{prayedToday ? 'Prayed today' : 'Pray again'}</ThemedText></TouchableOpacity>
      <TouchableOpacity disabled={saving} style={styles.button} onPress={() => { triggerLightHaptic(); setMode('update'); }}><ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.buttonText}>Update</ThemedText></TouchableOpacity>
      <TouchableOpacity disabled={saving} style={styles.button} onPress={() => { void action(true); }}><Sparkle size={13} color={Colors.sage} strokeWidth={1.8} /><ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.buttonText}>Mark answered</ThemedText></TouchableOpacity>
    </View>
    {candidateCount > 1 && <TouchableOpacity disabled={saving} style={{ alignSelf: 'center', marginTop: 14 }} onPress={() => {
      triggerLightHaptic(); const version = ++generation.current;
      void selectPrayerRevisit(userId, prayers!, today, selection).then(item => { if (version === generation.current) setSelection(item); }).catch(() => Alert.alert('Could not load another prayer', 'Please try again.'));
    }}><ThemedText style={styles.meta}>Another prayer</ThemedText></TouchableOpacity>}
    {mode && <PrayerTrackingModal key={prayer.id} prayer={prayer} mode={mode} initialNeedId={selection.needId} onShowDetails={() => setMode('details')} onSave={persist} onClose={() => setMode(null)} />}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: Colors.hopeWhite, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, padding: 20, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, savedDate: { color: Colors.textGray, fontSize: 10, lineHeight: 15 },
  label: { color: Colors.sage, fontSize: 10, letterSpacing: 1.5 }, row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  title: { color: Colors.text, fontSize: 15, lineHeight: 22 }, meta: { color: Colors.textGray, fontSize: 11, lineHeight: 18 }, preview: { color: Colors.textGray, fontSize: 13, lineHeight: 21, marginTop: 12 },
  actions: { flexDirection: 'row', gap: 6, marginTop: 18 }, button: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 4, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 7 }, buttonText: { color: Colors.sage, fontSize: 11 },
});

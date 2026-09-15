import React, { useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import ThemedText from '../common/ThemedText';
import PrayerCard, { type PrayerHomeEntry } from '../journal/PrayerCard';
import PrayerTrackingModal from '../prayer/PrayerTrackingModal';
import PrayerResponseSheet from '../prayer/PrayerResponseSheet';
import type { PrayerChanges } from '../prayer/PrayerDetails';
import { PrayerApi } from '../../services/api/prayerApi';
import { answerPrayer } from '../../utils/prayerTracking';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import { openPrayerFlow } from '../../navigation/openPrayerFlow';
import { Colors } from '../../theme/colors';
import { prayerMomentType } from '../../utils/prayerMoments';

export default function PrayerMomentsCarousel({ prayers, navigation }: { prayers: PrayerHomeEntry[]; navigation?: any }) {
  const queryClient = useQueryClient();
  const [width, setWidth] = useState(0);
  const viewportWidth = width + 32;
  const cardWidth = Math.max(0, viewportWidth * 0.76);
  const sideInset = (viewportWidth - cardWidth) / 2;
  const slideSpacing = 12;
  const slideWidth = cardWidth + slideSpacing;
  const [selected, setSelected] = useState<PrayerHomeEntry | null>(null);
  const [mode, setMode] = useState<'update' | 'details'>('details');
  const [responding, setResponding] = useState<PrayerHomeEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const target = (p: PrayerHomeEntry) => p.groupedEntries?.find(e => e.journal_category === 'supplication') || p.groupedEntries?.[0] || p;
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['prayers'] });
    DeviceEventEmitter.emit('prayerSaved');
  };
  const persistPrayer = async (p: PrayerHomeEntry, data: PrayerChanges) => {
    const entry = target(p);
    await PrayerApi.updatePrayer(entry.id, data);
    const requestId = entry.is_prayer_request ? entry.id : entry.metadata?.original_request_id;
    if (requestId) {
      const all = await PrayerApi.getAllPrayers(entry.user_id || 'local');
      for (const linked of all.filter(p => p.id !== entry.id && (p.id === requestId || p.metadata?.original_request_id === requestId))) {
        await PrayerApi.updatePrayer(linked.id, { status: data.status, answered_date: data.answered_date, metadata: {
          ...linked.metadata, track_answered: data.metadata.track_answered, tracking_status: data.metadata.tracking_status,
          prayer_needs: data.metadata.prayer_needs, prayer_updates: data.metadata.prayer_updates,
        } });
      }
    }
    triggerSuccessHaptic();
    await refresh();
  };
  const save = async (data: PrayerChanges) => { if (selected) await persistPrayer(selected, data); };
  const manage = (p: PrayerHomeEntry, next: 'details' | 'update') => { triggerLightHaptic(); setMode(next); setSelected(p); };
  const edit = (p: PrayerHomeEntry) => {
    if (p.metadata?.prayer_need || !navigation) { manage(p, 'details'); return; }
    triggerLightHaptic();
    const entry = target(p);
    openPrayerFlow(navigation, p.prayer_type === 'people' ? 'PrayersForPeopleWalkthrough' : 'PrayerJournalWalkthrough', {
      selectedDate: entry.selected_date, editingPrayerId: entry.id, showDescription: false,
      initialPrayerType: p.is_prayer_request ? 'prayer-request' : p.prayer_type === 'people' ? 'pray-for-someone' : p.groupedEntries || p.metadata?.prayer_style === 'cast' ? 'acts' : 'open',
    });
  };
  const prayAgain = async (p: PrayerHomeEntry) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); triggerLightHaptic();
    try { await PrayerApi.markPrayerRequestPrayed(target(p).id); triggerSuccessHaptic(); await refresh(); }
    catch { Alert.alert('Could not save prayer', 'Please try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const answer = async (p: PrayerHomeEntry, needId?: string) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); triggerLightHaptic();
    try { await persistPrayer(p, { content: target(p).content, ...answerPrayer(target(p), needId) }); }
    catch { Alert.alert('Could not update prayer', 'Please try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View style={{ alignItems: 'center', marginBottom: 12 }}><ThemedText weight="semiBold" style={{ fontSize: 11, letterSpacing: 1.5, color: Colors.sage, textAlign: 'center' }}>{prayerMomentType(prayers[0]).toUpperCase()}</ThemedText></View>
    {width > 0 && <ScrollView style={{ marginHorizontal: -16, width: viewportWidth }} horizontal snapToOffsets={prayers.map((_, i) => i * slideWidth)} decelerationRate="fast" disableIntervalMomentum contentContainerStyle={{ paddingHorizontal: sideInset }} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
      {prayers.map((p, i) => <View key={p.id} style={{ width: cardWidth, marginRight: i < prayers.length - 1 ? slideSpacing : 0 }}><PrayerCard prayer={p} answering={busy} onEdit={edit} onManage={p => manage(p, 'update')} onManageAnswers={p => manage(p, 'details')} onAnswered={(p, id) => { void answer(p, id); }} onAddPrayer={p => { triggerLightHaptic(); setResponding(p); }} onPrayAgain={p => { void prayAgain(p); }} /></View>)}
    </ScrollView>}
    {selected && <PrayerTrackingModal prayer={target(selected)} mode={mode} onShowDetails={() => setMode('details')} onSave={save} onClose={() => setSelected(null)} />}
    {responding && <PrayerResponseSheet request={responding} onClose={() => setResponding(null)} onSaved={async () => { setResponding(null); await refresh(); }} />}
  </View>;
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../components/common/ThemedText';
import PrayerIntelligenceCardPresentation from '../components/dashboard/PrayerIntelligenceCardPresentation';
import PrayerTrackingModal from '../components/prayer/PrayerTrackingModal';
import PrayerCard, { type PrayerHomeEntry } from '../components/journal/PrayerCard';
import TodayPrayerTypeGallery from './TodayPrayerTypeGallery';
import type { PrayerChanges } from '../components/prayer/PrayerDetails';
import type { PrayerResponseOperations } from '../components/prayer/PrayerResponseSheet';
import PrayerResponseSheet from '../components/prayer/PrayerResponseSheet';
import { getPrayerIntelligenceCandidates, type PrayerIntelligencePurpose } from '../services/prayerIntelligenceService';
import type { PrayerApiEntry } from '../services/api/prayerApi';
import { prayerNeeds } from '../utils/prayerTracking';
import { Colors } from '../theme/colors';
import { getPrayerRequestJourneyPresentation } from '../components/dashboard/prayerTypePresentation';
import { getPrayerV2DemoReferenceDate } from './prayerV2DemoLoader';
import { PRAYER_V2_DEMO_PREFIX, type PrayerV2DemoScenario } from './prayerV2DemoFixtures';
import { createPrayerV2DemoRequestResponse, getPrayerV2DemoRecords, markPrayerV2DemoRequestPrayed, prayAgainPrayerV2Demo, reloadPrayerV2DemoScenario, updatePrayerV2DemoRecord } from './prayerV2DemoInteractions';

const purposes: PrayerIntelligencePurpose[] = ['return', 'check_in', 'follow_up', 'remember', 'celebrate'];
const fixtureSuffix: Record<PrayerIntelligencePurpose, string> = { return: 'return', check_in: 'check-in', follow_up: 'request-prayed-response', remember: 'remember', celebrate: 'one-answer' };
const scenario: Record<PrayerIntelligencePurpose, PrayerV2DemoScenario> = { return: 'return', check_in: 'check_in', follow_up: 'follow_up', remember: 'remember', celebrate: 'celebrate' };
type OpenState = { prayer: PrayerApiEntry; mode: 'details' | 'update'; needId?: string } | null;
type RequestJourney = { request: PrayerApiEntry; prayer: PrayerApiEntry } | null;

export default function TodayPrayerCardGalleryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [records, setRecords] = useState<PrayerApiEntry[]>([]);
  const [reference, setReference] = useState(new Date());
  const [open, setOpen] = useState<OpenState>(null);
  const [castOpen, setCastOpen] = useState(false);
  const [requestJourney, setRequestJourney] = useState<RequestJourney>(null);
  const [respondingTo, setRespondingTo] = useState<PrayerApiEntry | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const loadingShortcut = useRef(false);
  const refresh = useCallback(async () => {
    const [items, savedReference] = await Promise.all([getPrayerV2DemoRecords(), getPrayerV2DemoReferenceDate()]);
    setRecords(items);
    if (savedReference) setReference(new Date(savedReference));
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => { const listener = DeviceEventEmitter.addListener('prayerSaved', () => void refresh()); return () => listener.remove(); }, [refresh]);

  const cards = useMemo(() => {
    const candidates = getPrayerIntelligenceCandidates(records, reference);
    return purposes.map(purpose => {
      const prayer = records.find(item => item.id === `${PRAYER_V2_DEMO_PREFIX}${fixtureSuffix[purpose]}`);
      const candidate = prayer && candidates.find(item => item.prayerId === prayer.id && item.purpose === purpose);
      if (!prayer || !candidate) return { purpose, prayer, candidate: null, need: undefined, request: undefined };
      const need = candidate.needId ? prayerNeeds(prayer).find(item => item.id === candidate.needId) : undefined;
      const request = prayer.is_prayer_request ? prayer : prayer.metadata?.original_request_id ? records.find(item => item.id === prayer.metadata?.original_request_id && item.is_prayer_request) : undefined;
      return { purpose, prayer, candidate, need, request };
    });
  }, [records, reference]);
  const castEntries = useMemo(() => records.filter(item => item.metadata?.prayer_style === 'cast' && item.metadata?.prayer_session_id === `${PRAYER_V2_DEMO_PREFIX}cast-session`), [records]);
  const castRepresentative = castEntries.find(item => item.journal_category === 'supplication') || castEntries[0];

  const openById = useCallback((id: string, mode: 'details' | 'update' = 'details', needId?: string) => {
    const prayer = records.find(item => item.id === id);
    if (!prayer) { Alert.alert('Demo fixture not loaded', 'Load or reload this scenario first.'); return; }
    setOpen({ prayer, mode, needId });
  }, [records]);
  const openRequestJourney = useCallback((id: string) => {
    const request = records.find(item => item.id === id);
    if (!request) { Alert.alert('Demo fixture not loaded', 'Load or reload the Follow Up scenario first.'); return; }
    const linked = records.find(item => item.metadata?.original_request_id === id);
    if (linked) setRequestJourney({ request, prayer: linked });
    else openById(id);
  }, [openById, records]);
  useEffect(() => {
    const target = route.params?.openDemo as string | undefined;
    if (!target || !records.length) return;
    const ids: Record<string, string> = { mixed: `${PRAYER_V2_DEMO_PREFIX}mixed-needs`, cast: `${PRAYER_V2_DEMO_PREFIX}cast-supplication`, unprayed: `${PRAYER_V2_DEMO_PREFIX}request-unprayed`, prayed: `${PRAYER_V2_DEMO_PREFIX}request-prayed`, recent: `${PRAYER_V2_DEMO_PREFIX}request-recent` };
    const scenarios: Record<string, PrayerV2DemoScenario> = { mixed: 'mixed_needs', cast: 'cast', unprayed: 'follow_up', prayed: 'follow_up', recent: 'follow_up' };
    const targetId = ids[target];
    if (!targetId) { navigation.setParams({ openDemo: undefined }); return; }
    if (!records.some(item => item.id === targetId)) {
      if (!loadingShortcut.current) {
        loadingShortcut.current = true;
        void reloadPrayerV2DemoScenario(scenarios[target], reference).then(refresh).catch(error => Alert.alert('Unable to load DEV shortcut', error instanceof Error ? error.message : 'Unknown error')).finally(() => { loadingShortcut.current = false; });
      }
      return;
    }
    if (target === 'cast') setCastOpen(true);
    else if (target === 'prayed' || target === 'recent') openRequestJourney(targetId);
    else openById(targetId);
    navigation.setParams({ openDemo: undefined });
  }, [navigation, openById, openRequestJourney, records, castEntries, reference, refresh, route.params?.openDemo]);

  const save = async (prayer: PrayerApiEntry, changes: PrayerChanges) => {
    const updated = await updatePrayerV2DemoRecord(prayer.id, changes);
    setOpen(current => current ? { ...current, prayer: updated } : null);
    await refresh();
  };
  const responseOperations: PrayerResponseOperations = { create: createPrayerV2DemoRequestResponse, markPrayed: markPrayerV2DemoRequestPrayed, update: (request, updates) => updatePrayerV2DemoRecord(request.id, updates) };
  const reload = async (purpose: PrayerIntelligencePurpose) => {
    setBusy(purpose);
    try { await reloadPrayerV2DemoScenario(scenario[purpose], reference); await refresh(); }
    catch (error) { Alert.alert('Unable to reload scenario', error instanceof Error ? error.message : 'Unknown error'); }
    finally { setBusy(null); }
  };
  const primary = async (purpose: PrayerIntelligencePurpose, prayer: PrayerApiEntry, requestId?: string, needId?: string, request?: PrayerApiEntry) => {
    if (purpose === 'return') {
      setBusy(purpose);
      try { await prayAgainPrayerV2Demo(prayer, needId); await refresh(); Alert.alert('Prayed again', 'The existing DEV Prayer was updated.'); }
      catch (error) { Alert.alert('Unable to update demo Prayer', error instanceof Error ? error.message : 'Unknown error'); }
      finally { setBusy(null); }
      return;
    }
    if (purpose === 'check_in') { setOpen({ prayer, mode: 'update', needId }); return; }
    if (purpose === 'follow_up' && requestId) {
      const journey = getPrayerRequestJourneyPresentation(prayer, request, prayer.is_prayer_request ? undefined : prayer);
      if (journey.state === 'request' && request) setRespondingTo(request);
      else openRequestJourney(requestId);
      return;
    }
    setOpen({ prayer, mode: 'details', needId });
  };
  if (!__DEV__) return null;
  return <SafeAreaView style={styles.safe}><View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Close Today Prayer Card Gallery"><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity><ThemedText weight="bold" style={styles.headerTitle}>Today Prayer Card Gallery</ThemedText><View style={styles.spacer} /></View>
    <ScrollView contentContainerStyle={styles.content}><ThemedText style={styles.subtitle}>Production Today shows one Prayer intelligence card at a time.</ThemedText><ThemedText style={styles.note}>Development-only visual QA · Actions modify namespaced local DEV fixtures only.</ThemedText>
      <ThemedText weight="bold" style={styles.gallerySectionTitle}>INTELLIGENCE PURPOSES</ThemedText>
      {cards.map(({ purpose, prayer, candidate, need, request }) => <View key={purpose} style={styles.section}>{prayer && candidate ? <PrayerIntelligenceCardPresentation candidate={candidate} prayer={prayer} request={request} linkedPrayer={request && prayer.id !== request.id ? prayer : undefined} need={need} disabled={busy === purpose} onPrimary={() => void primary(purpose, prayer, candidate.requestId, candidate.needId, request)} onView={() => setOpen({ prayer, mode: 'details', needId: candidate.needId })} /> : <View style={styles.changed}><ThemedText weight="semiBold" style={styles.changedTitle}>{purpose.replace('_', ' ').toUpperCase()}</ThemedText><ThemedText style={styles.note}>Scenario changed through interaction or is not loaded.</ThemedText></View>}<TouchableOpacity disabled={!!busy} style={styles.reload} onPress={() => void reload(purpose)}><ThemedText weight="semiBold" style={styles.reloadText}>{busy === purpose ? 'Reloading…' : 'Reload scenario'}</ThemedText></TouchableOpacity></View>)}
      <TodayPrayerTypeGallery records={records} reference={reference} onOpen={(prayer, needId) => openById(prayer.id, 'details', needId)} onOpenJourney={openRequestJourney} onRespond={setRespondingTo} />
    </ScrollView>
    <Modal visible={castOpen} transparent animationType="fade" onRequestClose={() => setCastOpen(false)}><View style={styles.castBackdrop}><View style={styles.castSheet}><View style={styles.castHeader}><ThemedText weight="bold" style={styles.castTitle}>CAST Demo</ThemedText><TouchableOpacity accessibilityLabel="Close CAST Demo" onPress={() => setCastOpen(false)}><Ionicons name="close" size={22} color={Colors.text} /></TouchableOpacity></View>{castRepresentative && <PrayerCard prayer={{ ...castRepresentative, groupedEntries: castEntries } as PrayerHomeEntry} answering={!!busy} onPrayAgain={entry => { const target = entry.groupedEntries?.find(item => item.journal_category === 'supplication') || entry; setBusy('cast'); void prayAgainPrayerV2Demo(target).then(refresh).catch(error => Alert.alert('Unable to update demo Prayer', error instanceof Error ? error.message : 'Unknown error')).finally(() => setBusy(null)); }} onManage={entry => { const target = entry.groupedEntries?.find(item => item.journal_category === 'supplication') || entry; setCastOpen(false); setOpen({ prayer: target, mode: 'details' }); }} onEdit={entry => { const target = entry.groupedEntries?.find(item => item.journal_category === 'supplication') || entry; setCastOpen(false); setOpen({ prayer: target, mode: 'details' }); }} />}</View></View></Modal>
    <Modal visible={!!requestJourney} transparent animationType="fade" onRequestClose={() => setRequestJourney(null)}><View style={styles.castBackdrop}><View style={styles.castSheet}><View style={styles.castHeader}><ThemedText weight="bold" style={styles.castTitle}>Prayer Request Journey</ThemedText><TouchableOpacity accessibilityLabel="Close Request Journey" onPress={() => setRequestJourney(null)}><Ionicons name="close" size={22} color={Colors.text} /></TouchableOpacity></View>{requestJourney && <ScrollView><PrayerCard prayer={requestJourney.request} answering={!!busy} onPrayAgain={() => { setRequestJourney(null); setOpen({ prayer: requestJourney.prayer, mode: 'details' }); }} onManage={() => { setRequestJourney(null); setOpen({ prayer: requestJourney.prayer, mode: 'details' }); }} onEdit={() => { setRequestJourney(null); setOpen({ prayer: requestJourney.request, mode: 'details' }); }} /><PrayerCard prayer={requestJourney.prayer} answering={!!busy} onPrayAgain={entry => { setRequestJourney(null); void prayAgainPrayerV2Demo(entry).then(refresh).catch(error => Alert.alert('Unable to update demo Prayer', error instanceof Error ? error.message : 'Unknown error')); }} onManage={entry => { setRequestJourney(null); setOpen({ prayer: entry, mode: 'details' }); }} onEdit={entry => { setRequestJourney(null); setOpen({ prayer: entry, mode: 'details' }); }} /></ScrollView>}</View></View></Modal>
    {open && <PrayerTrackingModal key={`${open.prayer.id}-${open.mode}`} prayer={open.prayer} mode={open.mode} initialNeedId={open.needId} responseOperations={responseOperations} onShowDetails={() => setOpen(current => current ? { ...current, mode: 'details' } : null)} onSave={changes => save(open.prayer, changes)} onClose={() => { setOpen(null); void refresh(); }} />}
    {respondingTo && <PrayerResponseSheet request={respondingTo} operations={responseOperations} onClose={() => setRespondingTo(null)} onSaved={async () => { setRespondingTo(null); await refresh(); }} />}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.lightBackground }, header: { height: 56, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerTitle: { fontSize: 17, color: Colors.text }, spacer: { width: 24 }, content: { padding: 20, paddingBottom: 44 }, subtitle: { color: Colors.text, fontSize: 14, lineHeight: 21 }, note: { color: Colors.textGray, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 14 }, gallerySectionTitle: { color: Colors.sage, fontSize: 13, letterSpacing: 1.2, marginTop: 20, marginBottom: 12 }, section: { marginBottom: 16 }, changed: { padding: 20, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, backgroundColor: Colors.hopeWhite }, changedTitle: { color: Colors.sage, fontSize: 11, letterSpacing: 1.3 }, reload: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, marginTop: -10 }, reloadText: { color: Colors.sage, fontSize: 11 }, castBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)', padding: 18 }, castSheet: { maxHeight: '85%', backgroundColor: Colors.lightBackground, borderRadius: 24, padding: 16 }, castHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, castTitle: { color: Colors.text, fontSize: 18 } });

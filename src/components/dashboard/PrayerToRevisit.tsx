import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import PrayerTrackingModal from '../prayer/PrayerTrackingModal';
import PrayerIntelligenceCardPresentation from './PrayerIntelligenceCardPresentation';
import type { PrayerChanges } from '../prayer/PrayerDetails';
import type { PrayerApiEntry } from '../../services/api/prayerApi';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useAllPrayerData } from '../../services/hooks/usePrayerData';
import { PrayerApi } from '../../services/api/prayerApi';
import { prayAgainExistingPrayer } from '../../services/prayerActivityService';
import { getPrayerRequestJourneyPresentation } from './prayerTypePresentation';
import { getPrayerIntelligenceCandidates, selectPrayerIntelligenceCandidate, type PrayerIntelligenceCandidate } from '../../services/prayerIntelligenceService';
import { getPrayerResurfacingState, recordPrayerResurfaced } from '../../storage/prayerResurfacingStorage';
import { prayerNeeds } from '../../utils/prayerTracking';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import { openPrayerFlow } from '../../navigation/openPrayerFlow';

export default function PrayerToRevisit({ header }: { header?: React.ReactNode }) {
  const { user } = useAuth(); const userId = user?.id || 'local';
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient(); const { data: prayers, refetch } = useAllPrayerData(userId);
  const [candidate, setCandidate] = useState<PrayerIntelligenceCandidate | null>(null);
  const [mode, setMode] = useState<'details' | 'update' | null>(null); const [saving, setSaving] = useState(false);
  const generation = useRef(0);
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  useEffect(() => {
    const saved = DeviceEventEmitter.addListener('prayerSaved', () => void refetch());
    const deleted = DeviceEventEmitter.addListener('prayer_deleted', () => void refetch());
    return () => { saved.remove(); deleted.remove(); };
  }, [refetch]);
  useEffect(() => {
    if (!prayers) return; const version = ++generation.current;
    void getPrayerResurfacingState(userId).then(state => {
      const list = getPrayerIntelligenceCandidates(prayers, new Date(), state.items);
      const selected = selectPrayerIntelligenceCandidate(list, state.recentIds);
      if (version !== generation.current) return;
      setCandidate(selected);
      if (selected) void recordPrayerResurfaced(userId, selected);
    });
    return () => { generation.current++; };
  }, [prayers, userId]);
  const prayer = prayers?.find(item => item.id === candidate?.prayerId);
  const request = prayer?.is_prayer_request ? prayer : prayer?.metadata?.original_request_id ? prayers?.find(item => item.id === prayer.metadata?.original_request_id && item.is_prayer_request) : undefined;
  const linkedPrayer = request ? prayers?.find(item => item.id !== request.id && item.metadata?.original_request_id === request.id && item.prayed === true) : undefined;
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
  const prayAgain = async () => {
    if (!prayer || saving) return; setSaving(true); triggerLightHaptic();
    try {
      await prayAgainExistingPrayer(prayer, candidate?.needId);
      await refresh();
    } catch { Alert.alert('Could not update prayer', 'Please try again.'); } finally { setSaving(false); }
  };
  if (!candidate || !prayer) return null;
  const openDetails = () => { triggerLightHaptic(); setMode('details'); };
  const openUpdate = () => { triggerLightHaptic(); setMode('update'); };
  const navigateToPrayForSomeone = (target: PrayerApiEntry) => {
    openPrayerFlow(navigation, 'PrayersForPeopleWalkthrough', { initialPersonName: target.person_name || '', initialPrayerType: 'pray-for-someone', selectedDate: target.selected_date, originalRequestId: target.id, originalRequestText: target.content, originalRequestContext: target.metadata?.request_subject || target.metadata?.request_context });
  };
  const openPrayForSomeone = (target: PrayerApiEntry) => {
    setMode(null);
    // PrayerDetails is a native transparent Modal. Let it fully dismiss before
    // presenting the root-stack full-screen walkthrough above Today.
    setTimeout(() => navigateToPrayForSomeone(target), 300);
  };
  const requestJourney = prayer && candidate.sourceType === 'request' ? getPrayerRequestJourneyPresentation(prayer, request, linkedPrayer) : undefined;
  const primary = candidate.purpose === 'return' ? () => void prayAgain() : candidate.purpose === 'check_in' ? openUpdate : requestJourney?.state === 'request' && request ? () => navigateToPrayForSomeone(request) : openDetails;
  return <>
    {header}
    <PrayerIntelligenceCardPresentation candidate={candidate} prayer={prayer} request={request} linkedPrayer={linkedPrayer} need={need} disabled={saving} onPrimary={primary} onView={openDetails} />
    {mode && <PrayerTrackingModal key={prayer.id} prayer={prayer} mode={mode} initialNeedId={candidate.needId} onPrayNow={openPrayForSomeone} onShowDetails={() => setMode('details')} onSave={persist} onClose={() => setMode(null)} />}
  </>;
}

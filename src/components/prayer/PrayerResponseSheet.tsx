import React, { useEffect, useRef, useState } from 'react';
import { triggerSuccessHaptic } from '../../utils/haptics';
import { Alert, DeviceEventEmitter } from 'react-native';
import PrayerWritingSheet from './PrayerWritingSheet';
import { format } from 'date-fns';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useCreatePrayer, useMarkPrayerRequestPrayed, useUpdatePrayer } from '../../services/hooks/usePrayerData';
import type { PrayerApiEntry } from '../../services/api/prayerApi';
import { clearPrayerDraft, getPrayerDraft, getPrayerDraftKey, savePrayerDraft } from '../../storage/prayerDraftStorage';

export default function PrayerResponseSheet({ request, onClose, onSaved }: { request: Pick<PrayerApiEntry, 'content'> & Partial<PrayerApiEntry>; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const { user } = useAuth();
  const createPrayer = useCreatePrayer();
  const markPrayed = useMarkPrayerRequestPrayed();
  const updatePrayer = useUpdatePrayer();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const savingRef = useRef(false);
  const createdRef = useRef(false);
  const markedRef = useRef(false);
  const draftKey = getPrayerDraftKey('prayer-editor', request.selected_date || format(new Date(), 'yyyy-MM-dd'), request.id);
  useEffect(() => {
    let active = true;
    getPrayerDraft(draftKey).then(draft => { if (active) { setText(draft?.data.modalPrayerRequest || ''); setReady(true); } });
    return () => { active = false; };
  }, [draftKey]);
  useEffect(() => {
    if (!ready || !text.trim() || saving) return;
    const timer = setTimeout(() => { void savePrayerDraft({ key: draftKey, type: 'prayer-editor', selectedDate: request.selected_date || format(new Date(), 'yyyy-MM-dd'), data: { modalPrayerRequest: text, prayerRequest: request } }); }, 800);
    return () => clearTimeout(timer);
  }, [draftKey, ready, request, saving, text]);
  const save = async () => {
    if (!ready || !text.trim() || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (!createdRef.current) {
        await createPrayer.mutateAsync({ user_id: user?.id || 'local', prayer_type: 'people', person_name: request.person_name, content: text.trim(), selected_date: format(new Date(), 'yyyy-MM-dd'), prayed: true, prayer_count: 1, last_prayed_at: new Date().toISOString(), status: request.status || 'pending', answered_date: request.answered_date, metadata: { prayer_type: 'pray-for-someone', track_answered: request.metadata?.track_answered !== false, original_request_id: request.id, original_request_content: request.content, prayer_request_display: request.content, prayer_updates: request.metadata?.prayer_updates || [], ...(request.metadata?.prayer_needs ? { prayer_needs: request.metadata.prayer_needs } : {}), ...(request.metadata?.tracking_status ? { tracking_status: request.metadata.tracking_status } : {}) } });
        createdRef.current = true;
      }
      if (request.id && !request.id.startsWith('temp-')) {
        if (!markedRef.current) { await markPrayed.mutateAsync({ id: request.id, isPrayed: true, _userId: user?.id || '', _dateStr: request.selected_date || format(new Date(), 'yyyy-MM-dd') }); markedRef.current = true; }
        await updatePrayer.mutateAsync({ id: request.id, updates: { metadata: { track_answered: request.metadata?.track_answered !== false } }, _userId: user?.id || '', _dateStr: request.selected_date || format(new Date(), 'yyyy-MM-dd') });
      }
      await clearPrayerDraft(draftKey);
      triggerSuccessHaptic();
      DeviceEventEmitter.emit('prayerSaved');
      await onSaved();
    } catch { Alert.alert('Could not save prayer', 'Your prayer is still here. Please try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <PrayerWritingSheet title={request.person_name || 'Someone on your heart'} eyebrow="PRAY FOR" context={request.content} contextLabel="THEIR REQUEST" placeholder="God, I lift them up to You…" value={text} onChangeText={setText} onClose={onClose} onSave={save} saving={saving} ready={ready} editable={!createdRef.current} saveLabel="Save prayer" />;
}

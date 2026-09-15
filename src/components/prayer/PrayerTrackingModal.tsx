import { triggerLightHaptic } from '../../utils/haptics';
import React, { useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import PrayerDetails, { type PrayerChanges } from './PrayerDetails';
import PrayerWritingSheet from './PrayerWritingSheet';
import PrayerNeedPicker from './PrayerNeedPicker';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { PrayerApiEntry } from '../../services/api/prayerApi';

import { prayerNeeds, trackingStatus, type PrayerUpdateKind, describePrayerUpdate } from '../../utils/prayerTracking';
export default function PrayerTrackingModal({ prayer, onClose, onSave, mode = 'details', onShowDetails, onDelete }: { mode?: 'update' | 'details'; onShowDetails?: () => void; onDelete?: () => Promise<void>; prayer?: PrayerApiEntry; onClose: () => void; onSave: (data: PrayerChanges) => Promise<void> }) {
  const needs = prayer ? prayerNeeds(prayer) : [];
  const [note, setNote] = useState('');
  const [updateKind, setUpdateKind] = useState<PrayerUpdateKind>(prayer && trackingStatus(prayer) === 'answered' ? 'answered' : prayer && trackingStatus(prayer) === 'closed' ? 'situation-changed' : 'still-praying');
  const [updateNeedId, setUpdateNeedId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const pill = (label: string, active: boolean, action: () => void) => <TouchableOpacity key={label} disabled={saving} style={[styles.pill, active && styles.active]} onPress={() => { triggerLightHaptic(); return (action)(); }}><ThemedText weight="semiBold" style={{ color: active ? Colors.hopeWhite : Colors.sage, fontSize: 12 }}>{label}</ThemedText></TouchableOpacity>;
  const saveUpdate = async () => {
    if (!prayer || !note.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(describePrayerUpdate(prayer, note, updateKind, updateNeedId));
      onClose();
    } catch { Alert.alert('Could not save', 'Your note is still here. Please try again.'); }
    finally { setSaving(false); }
  };
  if (mode === 'details' && prayer?.metadata?.prayer_need) return <PrayerNeedPicker prayer={prayer} onClose={onClose} onSave={onSave} renderUpdate={(current, save, close) => <PrayerTrackingModal prayer={current} mode="update" onSave={save} onClose={close} />} />;
  if (mode === 'details' && prayer) return <PrayerDetails prayer={prayer} onClose={onClose} onSave={onSave} onDelete={onDelete} renderUpdate={(current, save, close) => <PrayerTrackingModal prayer={current} mode="update" onSave={save} onClose={close} />} />;
  if (mode === 'update' && prayer) return <PrayerWritingSheet title={prayer.person_name || (prayer.metadata?.prayer_style === 'cast' ? 'CAST Prayer' : prayer.metadata?.prayer_style === 'open' ? 'Open Prayer' : 'Your prayer')} eyebrow="ADD UPDATE" context={prayer.content} contextLabel="YOUR PRAYER" placeholder="What has changed since you prayed?" value={note} onChangeText={setNote} onClose={onClose} onSave={saveUpdate} saving={saving} saveLabel="Save update" keepAfterInputVisible onShowDetails={onShowDetails} maxLength={500} saveEnabled={updateKind !== 'answered' || needs.length < 2 || !!updateNeedId}
    beforeInput={<><ThemedText weight="semiBold" style={styles.updateHeading}>WHAT HAS CHANGED?</ThemedText><ThemedText style={styles.updateHint}>Write an update about what’s happened since you prayed.</ThemedText></>}
    afterInput={<>
      <ThemedText style={styles.updateCounter}>{note.length}/500</ThemedText>
      <ThemedText weight="semiBold" style={styles.updateHeading}>HOW WOULD YOU DESCRIBE IT?</ThemedText>
      <ThemedText style={styles.updateHint}>This helps you remember and track.</ThemedText>
      <View style={styles.updateChoices}>{([
        { kind: 'still-praying', label: 'Still praying', subtitle: 'Keep lifting this up', icon: 'heart-outline' },
        { kind: 'answered', label: 'God answered', subtitle: 'Thank God!', icon: 'sunny-outline' },
        { kind: 'situation-changed', label: 'Situation changed', subtitle: 'A new update', icon: 'sync-outline' },
      ] as const).map(choice => <TouchableOpacity key={choice.kind} disabled={saving} accessibilityRole="radio" accessibilityState={{ selected: updateKind === choice.kind }} style={[styles.updateChoice, { width: choice.kind === 'situation-changed' ? '38%' : '29%' }, updateKind === choice.kind && styles.updateChoiceActive]} onPress={() => { triggerLightHaptic(); return (() => setUpdateKind(choice.kind))(); }}><ThemedText weight="semiBold" style={styles.updateChoiceText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{choice.label}</ThemedText><ThemedText style={styles.updateChoiceSubtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{choice.subtitle}</ThemedText></TouchableOpacity>)}</View>
      {needs.length > 1 && <><ThemedText style={styles.updateHint}>{updateKind === 'answered' ? 'Which need did God answer?' : 'For a specific need? (Optional)'}</ThemedText><View style={styles.row}>{needs.map(need => pill(need.text, updateNeedId === need.id, () => setUpdateNeedId(updateNeedId === need.id ? undefined : need.id)))}</View></>}
    </>}
  />;
  return <PrayerNeedPicker onClose={onClose} onSave={onSave} />;
}
const styles = StyleSheet.create({
  updateHeading: { color: Colors.sage, fontSize: 10, lineHeight: 15, letterSpacing: 1.5, marginTop: 12, marginBottom: 6 },
  updateHint: { color: Colors.textGray, fontSize: 13, lineHeight: 20, marginBottom: 6 },
  updateCounter: { color: Colors.textGray, fontSize: 11, textAlign: 'right', marginBottom: 16 },
  updateChoices: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10 },
  updateChoice: { flexShrink: 1, minWidth: 0, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 18, paddingHorizontal: 4, paddingVertical: 9 },
  updateChoiceActive: { backgroundColor: Colors.actionBackground, borderColor: Colors.sageMuted },
  updateChoiceText: { flexShrink: 1, maxWidth: '100%', textAlign: 'center', color: Colors.sage, fontSize: 11, lineHeight: 17 },
  updateChoiceSubtitle: { flexShrink: 1, maxWidth: '100%', color: Colors.textGray, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 3 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  pill: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start' },
  active: { backgroundColor: Colors.sage, borderColor: Colors.sage },
});

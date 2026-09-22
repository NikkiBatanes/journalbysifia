import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../common/ThemedText';
import PrayerHandsIcon from '../common/PrayerHandsIcon';
import type { PrayerIntelligenceCandidate } from '../../services/prayerIntelligenceService';
import type { PrayerApiEntry } from '../../services/api/prayerApi';
import type { PrayerNeed } from '../../utils/prayerTracking';
import { getPrayerCandidateDateLabel, getPrayerRequestJourneyPresentation, getPrayerTypePresentation } from './prayerTypePresentation';
import { Colors } from '../../theme/colors';

const headings = { return: 'A prayer to revisit', check_in: 'How is this prayer now?', follow_up: 'A prayer request to follow up on', remember: 'From your prayer journal', celebrate: 'A prayer you marked Answered' } as const;
type Props = {
  candidate: PrayerIntelligenceCandidate;
  prayer: PrayerApiEntry;
  request?: PrayerApiEntry;
  linkedPrayer?: PrayerApiEntry;
  need?: PrayerNeed;
  disabled?: boolean;
  onPrimary: () => void;
  onView: () => void;
};

export default function PrayerIntelligenceCardPresentation({ candidate, prayer, request, linkedPrayer, need, disabled = false, onPrimary, onView }: Props) {
  const journey = candidate.sourceType === 'request' ? getPrayerRequestJourneyPresentation(prayer, request, linkedPrayer) : undefined;
  const type = journey?.isRequestJourney ? undefined : getPrayerTypePresentation(prayer, need);
  const requestUnprayed = journey?.state === 'request';
  const journeyHeading = journey?.state === 'answered' ? 'ANSWERED' : journey?.state === 'let_go' ? 'LET GO' : journey?.state === 'prayed_for' ? 'PRAYED FOR' : 'PRAYER REQUEST';
  const why = journey?.isRequestJourney ? requestUnprayed ? 'Prayer Request' : headings[candidate.purpose] : headings[candidate.purpose];
  const displayContext = getPrayerCandidateDateLabel(candidate, prayer, journey, need);
  const action = (text: string, onPress: () => void, icon?: boolean, secondary?: boolean) => (
    <TouchableOpacity disabled={disabled} style={[styles.button, secondary && styles.secondaryButton]} onPress={onPress}>
      {icon && <PrayerHandsIcon size={13} color={Colors.sage} />}
      <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.buttonText}>{text}</ThemedText>
    </TouchableOpacity>
  );
  const primary = requestUnprayed
    ? action('Pray now', onPrimary, true)
    : journey?.state === 'answered' || journey?.state === 'let_go'
      ? action('View journey', onPrimary)
      : journey?.state === 'prayed_for' && candidate.purpose === 'follow_up'
        ? action('Follow up', onPrimary)
        : candidate.purpose === 'return'
    ? action('I prayed for this today', onPrimary, true)
    : candidate.purpose === 'check_in'
      ? action('Update', onPrimary)
      : candidate.purpose === 'follow_up'
        ? action('Follow up', onPrimary)
        : action('Look back', onPrimary);
  const secondaryLabel = journey?.isRequestJourney && requestUnprayed ? 'Open request' : journey?.isRequestJourney ? 'Open prayer' : 'Open prayer';
  const redundantAction = candidate.purpose === 'remember' || candidate.purpose === 'celebrate';

  return <View style={styles.card}>
    <ThemedText weight="semiBold" style={styles.label}>{why}</ThemedText>
    <TouchableOpacity disabled={disabled} accessibilityLabel={`View prayer: ${journey?.isRequestJourney ? journeyHeading : type?.label}`} onPress={onView}>
      <View style={styles.row}>
        <Ionicons name={candidate.purpose === 'celebrate' ? 'sparkles-outline' : 'leaf-outline'} size={24} color={Colors.sage} />
        <View style={styles.body}>
          {journey?.isRequestJourney ? <>
            {!requestUnprayed && <ThemedText weight="semiBold" style={styles.type}>{journeyHeading}</ThemedText>}
            {!requestUnprayed && <ThemedText style={styles.origin}>Prayer Request</ThemedText>}
            {!requestUnprayed && !journey.hasLinkedPrayer && <ThemedText style={styles.origin}>Original request · linked Prayer unavailable</ThemedText>}
            {!!journey.subject && <ThemedText numberOfLines={1} style={styles.context}>{journey.subject}</ThemedText>}
            <ThemedText numberOfLines={3} style={styles.title}>{journey.content}</ThemedText>
          </> : <>
            <ThemedText weight="semiBold" style={styles.type}>{type?.label}</ThemedText>
            {!!type?.secondaryContext && <ThemedText numberOfLines={2} style={styles.context}>{type.secondaryContext}</ThemedText>}
            <ThemedText numberOfLines={3} style={styles.title}>{type?.content}</ThemedText>
          </>}
          {!!displayContext && <ThemedText style={styles.meta}>{displayContext}{candidate.prayerCount ? ` · Returned ${candidate.prayerCount} ${candidate.prayerCount === 1 ? 'time' : 'times'}` : ''}</ThemedText>}
        </View>
      </View>
    </TouchableOpacity>
    <View style={styles.actions}>{primary}{!redundantAction && action(secondaryLabel, onView, false, true)}</View>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.hopeWhite, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, padding: 20, marginBottom: 16 },
  label: { color: Colors.sage, fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  body: { flex: 1 },
  type: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  context: { color: Colors.textGray, fontSize: 12, lineHeight: 18, marginTop: 2 },
  origin: { color: Colors.textGray, fontSize: 10, lineHeight: 15, marginTop: 1 },
  title: { color: Colors.textGray, fontSize: 13, lineHeight: 20, marginTop: 4 },
  meta: { color: Colors.textGray, fontSize: 11, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 6, marginTop: 18 },
  button: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 4, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.sage, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 6, backgroundColor: Colors.actionBackground },
  secondaryButton: { backgroundColor: Colors.hopeWhite, borderColor: Colors.cardBorder },
  buttonText: { color: Colors.sage, fontSize: 11 },
});

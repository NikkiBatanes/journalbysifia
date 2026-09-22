import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import ThemedText from '../components/common/ThemedText';
import PrayerIntelligenceCardPresentation from '../components/dashboard/PrayerIntelligenceCardPresentation';
import type { PrayerIntelligenceCandidate, PrayerIntelligencePurpose, PrayerIntelligenceSource } from '../services/prayerIntelligenceService';
import { getPrayerIntelligenceCandidates } from '../services/prayerIntelligenceService';
import type { PrayerApiEntry } from '../services/api/prayerApi';
import { PRAYER_V2_DEMO_NEED_TOPICS } from './prayerV2DemoFixtures';
import { prayerNeeds, isPrayerLetGo, hasAnswerHistory } from '../utils/prayerTracking';
import { Colors } from '../theme/colors';

type Props = {
  records: PrayerApiEntry[];
  reference: Date;
  onOpen: (prayer: PrayerApiEntry, needId?: string) => void;
  onOpenJourney: (requestId: string) => void;
  onRespond: (request: PrayerApiEntry) => void;
};
type Preview = { qa: string; prayer: PrayerApiEntry; needId?: string; request?: PrayerApiEntry; linkedPrayer?: PrayerApiEntry; notTodayEligible?: boolean; section: string };

const makeCandidate = (preview: Preview, candidates: PrayerIntelligenceCandidate[]): PrayerIntelligenceCandidate => {
  const actual = candidates.find(candidate => candidate.prayerId === preview.prayer.id && candidate.needId === preview.needId);
  const purpose: PrayerIntelligencePurpose = actual?.purpose || (preview.request ? 'follow_up' : 'remember');
  const sourceType: PrayerIntelligenceSource = preview.request ? 'request'
    : preview.needId ? 'need'
      : preview.prayer.journal_category === 'thanksgiving' ? 'thanksgiving' : 'prayer';
  return actual || {
    id: `${preview.prayer.id}:${preview.needId || ''}:type-preview`, purpose, prayerId: preview.prayer.id,
    ...(preview.needId ? { needId: preview.needId } : {}), ...(preview.request ? { requestId: preview.request.id } : {}),
    sourceType, reason: 'dev-type-preview-only', createdAt: preview.prayer.created_at,
    lastPrayedAt: preview.prayer.last_prayed_at, prayerCount: preview.prayer.prayer_count,
    displayContext: 'DEV type preview', rank: 0,
  };
};

export default function TodayPrayerTypeGallery({ records, reference, onOpen, onOpenJourney, onRespond }: Props) {
  const previews = useMemo(() => {
    const candidates = getPrayerIntelligenceCandidates(records, reference);
    const bySuffix = (suffix: string) => records.find(record => record.id.endsWith(`-${suffix}`));
    const requestFor = (prayer: PrayerApiEntry) => prayer.is_prayer_request ? prayer : prayer.metadata?.original_request_id
      ? records.find(record => record.id === prayer.metadata?.original_request_id && record.is_prayer_request) : undefined;
    const make = (qa: string, suffix: string, section: string, needMatch?: (need: ReturnType<typeof prayerNeeds>[number]) => boolean): Preview | undefined => {
      const prayer = bySuffix(suffix);
      if (!prayer) return undefined;
      const need = needMatch ? prayerNeeds(prayer).find(needMatch) : undefined;
      const request = requestFor(prayer);
      const linkedPrayer = request && prayer.id !== request.id ? prayer : undefined;
      return { qa, prayer, section, ...(need ? { needId: need.id } : {}), ...(request ? { request } : {}), ...(linkedPrayer ? { linkedPrayer } : {}) };
    };

    const typeCards = [
      make('OPEN PRAYER', 'return', 'PRAYER TYPES'),
      make('CAST · SUPPLICATION', 'cast-supplication', 'PRAYER TYPES'),
      make('CAST · THANKSGIVING', 'cast-thanksgiving', 'PRAYER TYPES'),
      make('PRAYER FOR SOMEONE · GREG', 'person-greg', 'PRAYER TYPES'),
      make('PRAYER REQUEST · UNPRAYED', 'request-unprayed', 'PRAYER TYPES'),
      make('PRAYED FOR · PRAYER REQUEST', 'request-charles-response', 'PRAYER TYPES'),
      make('PRAYER NEED · HEALTH · ACTIVE', 'mixed-needs', 'PRAYER TYPES', need => need.topic === 'Health' && need.active === true),
      make('PRAYER NEED · HEALTH · ANSWERED', 'mixed-needs', 'PRAYER TYPES', need => need.topic === 'Health' && need.status === 'answered'),
      make('PRAYER NEED · HEALTH · LET GO', 'mixed-needs', 'PRAYER TYPES', need => need.topic === 'Health' && need.status === 'closed'),
      make('BIBLE STUDY · JAMES 1:2–8', 'bible-study', 'PRAYER TYPES'),
      make('PLAYBOOK PRAYER', 'playbook', 'PRAYER TYPES'),
      make('DEVOTIONAL PRAYER', 'devotional', 'PRAYER TYPES'),
      make('ANSWERED + STILL PRAYING · GREG', 'person-greg', 'PRAYER TYPES'),
      make('LET GO PRAYER', 'let-go', 'PRAYER TYPES'),
    ].filter((preview): preview is Preview => !!preview);

    const castCards = [
      make('CAST · CONFESSION', 'cast-confession', 'CAST'),
      make('CAST · ADORATION', 'cast-two-adoration', 'CAST'),
      make('CAST · SUPPLICATION', 'cast-supplication', 'CAST'),
      make('CAST · THANKSGIVING', 'cast-thanksgiving', 'CAST'),
    ].filter((preview): preview is Preview => !!preview).map(preview => ({
      ...preview,
      notTodayEligible: preview.prayer.journal_category === 'confession'
        || !candidates.some(candidate => candidate.prayerId === preview.prayer.id),
    }));

    const needs: Preview[] = PRAYER_V2_DEMO_NEED_TOPICS.flatMap(topic => {
      const prayer = records.find(record => prayerNeeds(record).some(need => need.topic === topic && need.active === true));
      const need = prayer && prayerNeeds(prayer).find(item => item.topic === topic && item.active === true);
      return prayer && need ? [{ qa: `PRAYER NEED · ${topic.toUpperCase()}`, prayer, needId: need.id, section: 'PRAYER NEED CATEGORIES' }] : [];
    });

    const sourceCards = [
      make('BIBLE STUDY PRAYER · JAMES 1:2–8', 'bible-study', 'SOURCE PRAYERS'),
      make('PLAYBOOK PRAYER', 'playbook', 'SOURCE PRAYERS'),
      make('DEVOTIONAL PRAYER', 'devotional', 'SOURCE PRAYERS'),
    ].filter((preview): preview is Preview => !!preview);

    const requestStates = [
      make('UNPRAYED', 'request-unprayed', 'PRAYER REQUEST STATES'),
      make('PRAYED FOR', 'request-charles-response', 'PRAYER REQUEST STATES'),
    ].filter((preview): preview is Preview => !!preview);
    const requestIds = new Set(requestStates.map(item => item.request?.id));
    const answeredRequest = records.find(record => record.metadata?.original_request_id && record.is_prayer_request !== true && hasAnswerHistory(record));
    const releasedRequest = records.find(record => record.metadata?.original_request_id && record.is_prayer_request !== true && isPrayerLetGo(record));
    if (answeredRequest && !requestIds.has(answeredRequest.metadata?.original_request_id)) {
      const request = records.find(record => record.id === answeredRequest.metadata?.original_request_id && record.is_prayer_request);
      if (request) requestStates.push({ qa: 'ANSWERED', prayer: answeredRequest, request, linkedPrayer: answeredRequest, section: 'PRAYER REQUEST STATES' });
    }
    if (releasedRequest && !requestIds.has(releasedRequest.metadata?.original_request_id)) {
      const request = records.find(record => record.id === releasedRequest.metadata?.original_request_id && record.is_prayer_request);
      if (request) requestStates.push({ qa: 'LET GO', prayer: releasedRequest, request, linkedPrayer: releasedRequest, section: 'PRAYER REQUEST STATES' });
    }

    return { typeCards, castCards, needs, sourceCards, requestStates, candidates };
  }, [records, reference]);

  const renderCard = (preview: Preview) => {
    const candidate = makeCandidate(preview, previews.candidates);
    const journey = preview.request && candidate.sourceType === 'request';
    const unprayed = journey && !preview.request?.prayed && !preview.linkedPrayer;
    return <View key={`${preview.qa}-${preview.prayer.id}-${preview.needId || ''}`} style={styles.preview}>
      <ThemedText weight="semiBold" style={styles.qa}>QA: {preview.qa}</ThemedText>
      {(preview.notTodayEligible || candidate.reason === 'dev-type-preview-only') && <ThemedText style={styles.eligibility}>DEV TYPE PREVIEW ONLY — NOT TODAY ELIGIBLE</ThemedText>}
      <PrayerIntelligenceCardPresentation
        candidate={candidate} prayer={preview.prayer} need={preview.needId ? prayerNeeds(preview.prayer).find(need => need.id === preview.needId) : undefined}
        request={preview.request} linkedPrayer={preview.linkedPrayer}
        onPrimary={() => {
          if (journey && unprayed && preview.request) onRespond(preview.request);
          else if (journey && preview.request && preview.request.id) onOpenJourney(preview.request.id);
          else onOpen(preview.prayer, preview.needId);
        }}
        onView={() => onOpen(preview.prayer, preview.needId)}
      />
    </View>;
  };

  const section = (title: string, list: Preview[]) => <View key={title}>
    <ThemedText weight="bold" style={styles.heading}>{title}</ThemedText>
    {list.length ? list.map(renderCard) : <ThemedText style={styles.empty}>No matching namespaced fixture is loaded.</ThemedText>}
  </View>;

  const missingRequestStates = ['ANSWERED', 'LET GO'].filter(state => !previews.requestStates.some(item => item.qa === state));
  const castSection = <View key="cast">
    <ThemedText weight="bold" style={styles.heading}>CAST</ThemedText>
    {previews.castCards.map(renderCard)}
  </View>;
  const requestsSection = <View key="request-states">
    <ThemedText weight="bold" style={styles.heading}>PRAYER REQUEST STATES</ThemedText>
    {previews.requestStates.map(renderCard)}
    {missingRequestStates.length > 0 && <ThemedText style={styles.empty}>Current realistic DEV data has no linked Request in {missingRequestStates.join(' or ')} state; no journey was fabricated.</ThemedText>}
  </View>;

  return <View>
    <ThemedText weight="bold" style={styles.heading}>PRAYER TYPES</ThemedText>
    {previews.typeCards.map(renderCard)}
    {castSection}
    {section('PRAYER NEED CATEGORIES', previews.needs)}
    {requestsSection}
    {section('SOURCE PRAYERS', previews.sourceCards)}
  </View>;
}

const styles = StyleSheet.create({
  heading: { color: Colors.sage, fontSize: 13, letterSpacing: 1.2, marginTop: 24, marginBottom: 12 },
  preview: { marginBottom: 8 },
  qa: { color: Colors.sage, fontSize: 10, letterSpacing: 1, marginBottom: 6 },
  eligibility: { color: Colors.warning, fontSize: 10, marginBottom: 5 },
  empty: { color: Colors.textGray, fontSize: 12, lineHeight: 18, marginVertical: 8 },
});

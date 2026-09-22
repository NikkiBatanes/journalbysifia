import type { PrayerApiEntry } from '../../services/api/prayerApi';
import type { PrayerIntelligenceCandidate } from '../../services/prayerIntelligenceService';
import { answerHistory, isPrayerLetGo, type PrayerNeed } from '../../utils/prayerTracking';
import { formatPrayerDateContext } from '../../utils/date';

export type PrayerTypePresentation = {
  label: string;
  detailLabel: string;
  detailContext?: string;
  originLabel?: string;
  requestContext?: string;
  requestState?: PrayerRequestJourneyPresentation['state'];
  secondaryContext?: string;
  content: string;
};

export type PrayerRequestJourneyPresentation = {
  isRequestJourney: boolean;
  state: 'request' | 'prayed_for' | 'answered' | 'let_go';
  origin: 'Prayer Request';
  subject?: string;
  content: string;
  requestContent?: string;
  hasLinkedPrayer: boolean;
};

/** Selects and formats the single event date that best explains a Today card. */
export function getPrayerCandidateDateLabel(
  candidate: PrayerIntelligenceCandidate,
  prayer: PrayerApiEntry,
  journey?: PrayerRequestJourneyPresentation,
  need?: PrayerNeed,
  referenceDate = new Date(),
): string {
  const lifecycle = Array.isArray(prayer.metadata?.lifecycle_history) ? prayer.metadata?.lifecycle_history || [] : [];
  const letGoEvents = [...(need?.lifecycleHistory || []), ...lifecycle].filter((event: any) => event.action === 'let-go' && event.date).map((event: any) => event.date).sort();
  const letGoDate = letGoEvents[letGoEvents.length - 1];
  const checkInDate = candidate.lastUpdatedAt && (!candidate.lastPrayedAt || new Date(candidate.lastUpdatedAt).getTime() > new Date(candidate.lastPrayedAt).getTime()) ? candidate.lastUpdatedAt : candidate.lastPrayedAt;
  const value = candidate.purpose === 'remember' ? candidate.createdAt
    : candidate.purpose === 'celebrate' ? candidate.answerDate
      : candidate.purpose === 'follow_up' ? journey?.state === 'request' ? candidate.createdAt : journey?.state === 'answered' ? candidate.answerDate : journey?.state === 'let_go' ? letGoDate : candidate.lastPrayedAt
        : candidate.purpose === 'check_in' ? checkInDate : candidate.lastPrayedAt;
  const date = formatPrayerDateContext(value, referenceDate);
  if (!date) return candidate.purpose === 'return' && !candidate.lastPrayedAt ? 'Ready to pray' : '';
  const verb = candidate.purpose === 'remember' ? 'Written'
    : candidate.purpose === 'celebrate' || journey?.state === 'answered' ? 'Answer recorded'
      : journey?.state === 'let_go' ? 'Let go'
        : journey?.state === 'request' ? 'Saved'
          : journey?.state === 'prayed_for' ? 'Prayed'
            : candidate.purpose === 'check_in' && checkInDate && checkInDate === candidate.lastUpdatedAt && checkInDate !== candidate.lastPrayedAt ? 'Updated'
              : 'Last prayed';
  return `${verb} ${date.combinedLabel}`;
}

const first = (...values: unknown[]): string | undefined => values.find(value => typeof value === 'string' && value.trim()) as string | undefined;
const cleanCategory = (value?: string) => value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : undefined;

/** Resolve type/origin exclusively from canonical fields and legacy metadata adapters. */
export function getPrayerTypePresentation(prayer: PrayerApiEntry, need?: PrayerNeed): PrayerTypePresentation {
  const metadata = prayer.metadata || {};
  const style = first(metadata.prayer_style, metadata.prayer_type);
  const request = prayer.is_prayer_request === true || !!metadata.original_request_id;
  const needTopic = first(need?.topic, metadata.need_topic, metadata.topic, Array.isArray(metadata.topics) ? metadata.topics[0] : undefined);
  const parentPerson = prayer.person_name;

  if (need) return {
    label: `Prayer Need${needTopic ? ` · ${needTopic}` : ''}`, detailLabel: `Prayer Need${needTopic ? ` · ${needTopic}` : ''}`,
    detailContext: parentPerson ? `For ${parentPerson}` : undefined,
    originLabel: parentPerson ? `From: Prayer for ${parentPerson}` : undefined,
    secondaryContext: parentPerson ? `From: Prayer for ${parentPerson}` : undefined, content: need.text,
  };
  if (request) {
    const requestJourney = getPrayerRequestJourneyPresentation(prayer);
    const isIncoming = requestJourney.state === 'request';
    if (prayer.is_prayer_request !== true && metadata.original_request_id) return {
      label: `Prayer for Someone${prayer.person_name ? ` · ${prayer.person_name}` : ''}`,
      detailLabel: 'Prayer for Someone',
      detailContext: [prayer.person_name, first(metadata.request_context, metadata.request_subject)].filter(Boolean).join(' · ') || undefined,
      originLabel: 'Prayer Request',
      requestContext: first(metadata.original_request_content, metadata.prayer_request_display),
      requestState: requestJourney.state,
      secondaryContext: 'Prayer Request',
      content: prayer.content,
    };
    return {
      label: `Prayer Request${prayer.person_name ? ` · ${prayer.person_name}` : ''}`,
      detailLabel: isIncoming ? 'Prayer Request' : requestJourney.state === 'answered' ? 'ANSWERED' : requestJourney.state === 'let_go' ? 'LET GO' : 'PRAYED FOR',
      detailContext: requestJourney.subject || prayer.person_name,
      originLabel: isIncoming ? undefined : 'Prayer Request',
      requestContext: first(metadata.original_request_content, metadata.prayer_request_display),
      requestState: requestJourney.state,
      secondaryContext: isIncoming ? undefined : 'Prayer Request',
      content: isIncoming ? first(prayer.content) || 'Prayer request' : first(prayer.is_prayer_request ? undefined : prayer.content) || 'Prayer request',
    };
  }
  if (style === 'cast' && prayer.journal_category) return { label: `CAST · ${cleanCategory(prayer.journal_category)}`, detailLabel: `CAST · ${cleanCategory(prayer.journal_category)}`, originLabel: 'From your CAST prayer', content: prayer.content };
  if (prayer.prayer_type === 'people' || style === 'pray-for-someone' || style === 'people') return {
    label: `Prayer for Someone${prayer.person_name ? ` · ${prayer.person_name}` : ''}`, detailLabel: 'Prayer for Someone', detailContext: prayer.person_name, content: prayer.content,
  };

  const source = first(metadata.source, metadata.origin);
  const biblePassage = first(metadata.passage, metadata.bible_passage, metadata.scripture_reference);
  if (source === 'bible_study' || source === 'bible-study' || metadata.bibleStudySessionId) return {
    label: `Bible Study Prayer${biblePassage ? ` · ${biblePassage}` : ''}`, detailLabel: 'Bible Study Prayer', detailContext: biblePassage, content: prayer.content,
  };
  if (source === 'playbook' || prayer.prayer_type === 'guided_playbook' || style === 'guided_playbook') return {
    label: `Playbook Prayer${first(metadata.playbook_title) ? ` · ${first(metadata.playbook_title)}` : ''}`, detailLabel: 'Playbook Prayer', detailContext: first(metadata.playbook_title), content: prayer.content,
  };
  if (source === 'devotional' || prayer.prayer_type === 'devotional') return {
    label: `Devotional Prayer${first(prayer.day_title, prayer.day_number ? `Day ${prayer.day_number}` : undefined, metadata.devotional_title) ? ` · ${first(prayer.day_title, prayer.day_number ? `Day ${prayer.day_number}` : undefined, metadata.devotional_title)}` : ''}`, detailLabel: 'Devotional Prayer', detailContext: first(prayer.day_title, prayer.day_number ? `Day ${prayer.day_number}` : undefined, metadata.devotional_title), content: prayer.content,
  };
  if (style === 'open' || prayer.journal_category === 'personal_prayer') return { label: 'Open Prayer', detailLabel: 'Open Prayer', content: prayer.content };
  if (prayer.journal_category && ['adoration', 'confession', 'thanksgiving', 'supplication'].includes(prayer.journal_category)) return {
    label: `${cleanCategory(prayer.journal_category)} Prayer`, detailLabel: `${cleanCategory(prayer.journal_category)} Prayer`, content: prayer.content,
  };
  if (style === 'guided' || metadata.guided_prayer === true) return { label: 'Guided Prayer', detailLabel: 'Guided Prayer', secondaryContext: first(metadata.guided_title), detailContext: first(metadata.guided_title), content: prayer.content };
  return { label: 'Prayer', detailLabel: 'Prayer', content: prayer.content };
}

/** Resolve current journey state from request flags, explicit links, and persisted lifecycle history. */
export function getPrayerRequestJourneyPresentation(
  prayer: PrayerApiEntry,
  request?: PrayerApiEntry,
  linkedPrayer?: PrayerApiEntry,
): PrayerRequestJourneyPresentation {
  const origin = request || (prayer.is_prayer_request ? prayer : undefined);
  const suppliedLinkedIsValid = !!origin && linkedPrayer?.metadata?.original_request_id === origin.id;
  const directLinkedIsValid = !!origin && !prayer.is_prayer_request && prayer.metadata?.original_request_id === origin.id;
  const linked = suppliedLinkedIsValid ? linkedPrayer : directLinkedIsValid ? prayer : undefined;
  const isRequestJourney = !!origin && (origin.is_prayer_request === true || prayer.is_prayer_request === true || !!prayer.metadata?.original_request_id);
  const metadata = linked?.metadata || prayer.metadata || origin?.metadata || {};
  const hasAnswer = answerHistory(linked || prayer).length > 0;
  const letGo = isPrayerLetGo(linked || prayer);
  const prayed = !!linked?.prayed || (linked?.prayer_count || 0) > 0 || origin?.prayed === true
    || (!origin && (prayer.prayed === true || (prayer.prayer_count || 0) > 0));
  const state = hasAnswer ? 'answered' : letGo ? 'let_go' : prayed ? 'prayed_for' : 'request';
  const subject = [origin?.person_name || (!origin ? prayer.person_name : undefined), first(origin?.metadata?.request_subject, origin?.metadata?.request_context, !origin ? prayer.metadata?.request_context : undefined)].filter(Boolean).join(' · ') || undefined;
  const content = state === 'prayed_for' || state === 'answered' || state === 'let_go'
    ? first(linked?.content, prayer.is_prayer_request ? undefined : prayer.content, origin?.content)
    : first(origin?.content, prayer.content);
  return { isRequestJourney, state, origin: 'Prayer Request', subject, content: content || 'Prayer request', requestContent: first(origin?.content, prayer.metadata?.original_request_content, prayer.metadata?.prayer_request_display), hasLinkedPrayer: !!linked };
}

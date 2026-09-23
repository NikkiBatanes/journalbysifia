import type {PrayerApiEntry} from './api/prayerApi';
import type {PrayerReviewItem} from './prayerReviewService';

const first = (...values: unknown[]): string | undefined => values.find(
  value => typeof value === 'string' && value.trim(),
) as string | undefined;

/** Keeps each Prayer card's canonical type visible instead of flattening every event to "Prayed for". */
export const getReviewPrayerTypeLabel = (
  prayer: PrayerApiEntry | undefined,
  event: Pick<PrayerReviewItem, 'eventType' | 'needId'>,
): string => {
  const metadata = prayer?.metadata || {};
  const style = first(metadata.prayer_style, metadata.prayer_type);
  const source = first(metadata.source, metadata.origin);
  const hasPrayerNeeds = !!event.needId
    || metadata.prayer_need === true
    || (Array.isArray(metadata.prayer_needs) && metadata.prayer_needs.length > 0);

  if (event.eventType === 'request_prayed_for') {return 'PRAYER REQUEST · PRAYED FOR';}
  if (event.eventType === 'request_received' || prayer?.is_prayer_request) {return 'PRAYER REQUEST';}
  if (hasPrayerNeeds) {return 'PRAYER NEED';}
  if (style === 'cast' || metadata.prayer_session_id) {return 'CAST PRAYER';}
  if (prayer?.prayer_type === 'people' || style === 'pray-for-someone' || style === 'people') {return 'PRAYED FOR';}
  if (source === 'bible_study' || source === 'bible-study' || metadata.bibleStudySessionId) {return 'BIBLE STUDY PRAYER';}
  if (source === 'playbook' || prayer?.prayer_type === 'guided_playbook' || style === 'guided_playbook') {return 'PLAYBOOK PRAYER';}
  if (source === 'devotional' || prayer?.prayer_type === 'devotional') {return 'DEVOTIONAL PRAYER';}
  if (style === 'open' || prayer?.journal_category === 'personal_prayer') {return 'OPEN PRAYER';}
  if (prayer?.journal_category && ['adoration', 'confession', 'thanksgiving', 'supplication'].includes(prayer.journal_category)) {
    return `${prayer.journal_category.toLocaleUpperCase()} PRAYER`;
  }
  if (style === 'guided' || metadata.guided_prayer === true) {return 'GUIDED PRAYER';}
  return 'PRAYER';
};

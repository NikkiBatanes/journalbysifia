import type {ReviewCaptureItem} from './reviewCaptureService';

const normalizedPersonName = (value?: string): string => value?.trim().toLocaleLowerCase() || '';

/** Builds the compact Prayer-group subtitle without counting several events from one prayer twice. */
export const getPrayerCaptureCountLabel = (items: ReviewCaptureItem[]): string => {
  const prayerRequestsPrayed = new Set(items
    .filter(item => item.prayerEventType === 'request_prayed_for')
    .map(item => item.requestId || item.prayerActivityId || item.prayerId || item.id),
  ).size;
  const prayersPrayed = new Set(items
    .filter(item => ['cast', 'open', 'need'].includes(item.prayerActivityType || ''))
    .map(item => item.prayerActivityId || item.prayerId || item.id),
  ).size;
  const peoplePrayedFor = new Set(items
    .filter(item => item.prayerActivityType !== 'request'
      || item.prayerEventType === 'request_prayed_for')
    .map(item => normalizedPersonName(item.personName))
    .filter(Boolean),
  ).size;

  return [
    prayerRequestsPrayed > 0
      ? `${prayerRequestsPrayed} prayer ${prayerRequestsPrayed === 1 ? 'request' : 'requests'} prayed`
      : '',
    prayersPrayed > 0 ? `${prayersPrayed} prayed` : '',
    peoplePrayedFor > 0
      ? `${peoplePrayedFor} ${peoplePrayedFor === 1 ? 'person' : 'people'} prayed for`
      : '',
  ].filter(Boolean).join(' · ');
};

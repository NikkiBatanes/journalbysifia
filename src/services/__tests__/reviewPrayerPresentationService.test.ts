import {getReviewPrayerTypeLabel} from '../reviewPrayerPresentationService';
import type {PrayerApiEntry} from '../api/prayerApi';
import type {PrayerReviewItem} from '../prayerReviewService';

const prayer = (overrides: Partial<PrayerApiEntry> = {}): PrayerApiEntry => ({
  id: 'prayer',
  prayer_type: 'journal',
  content: 'Prayer content',
  selected_date: '2026-09-17',
  created_at: '2026-09-17T08:00:00Z',
  updated_at: '2026-09-17T08:00:00Z',
  ...overrides,
});

const event = (overrides: Partial<PrayerReviewItem> = {}): PrayerReviewItem => ({
  id: 'event',
  prayerId: 'prayer',
  eventType: 'new_prayer',
  eventDate: '2026-09-17',
  title: 'Prayer',
  subtitle: 'New in prayer',
  ...overrides,
});

describe('Weekly Review Prayer card type labels', () => {
  it.each([
    [prayer({metadata: {prayer_style: 'cast', prayer_session_id: 'session'}}), event(), 'CAST PRAYER'],
    [prayer({journal_category: 'personal_prayer', metadata: {prayer_style: 'open'}}), event(), 'OPEN PRAYER'],
    [prayer({prayer_type: 'people', person_name: 'Mom', metadata: {prayer_need: true}}), event(), 'PRAYER NEED'],
    [prayer({prayer_type: 'people', person_name: 'Greg'}), event(), 'PRAYED FOR'],
    [prayer({prayer_type: 'devotional'}), event(), 'DEVOTIONAL PRAYER'],
    [prayer({prayer_type: 'guided_playbook'}), event(), 'PLAYBOOK PRAYER'],
    [prayer({journal_category: 'thanksgiving'}), event({eventType: 'thanksgiving'}), 'THANKSGIVING PRAYER'],
  ])('keeps the canonical prayer type', (entry, reviewEvent, expected) => {
    expect(getReviewPrayerTypeLabel(entry, reviewEvent)).toBe(expected);
  });

  it('distinguishes an incoming request from its prayed response', () => {
    const request = prayer({prayer_type: 'people', is_prayer_request: true, person_name: 'Maya'});
    expect(getReviewPrayerTypeLabel(request, event({eventType: 'request_received'}))).toBe('PRAYER REQUEST');
    expect(getReviewPrayerTypeLabel(prayer({prayer_type: 'people', person_name: 'Maya'}), event({eventType: 'request_prayed_for'}))).toBe('PRAYER REQUEST · PRAYED FOR');
  });
});

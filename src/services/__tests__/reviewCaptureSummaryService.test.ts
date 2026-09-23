import {getPrayerCaptureCountLabel} from '../reviewCaptureSummaryService';
import type {ReviewCaptureItem} from '../reviewCaptureService';

const prayer = (overrides: Partial<ReviewCaptureItem>): ReviewCaptureItem => ({
  id: 'prayer-event',
  kind: 'prayer',
  title: 'Prayer',
  presentation: 'prayer',
  selectedDate: '2026-09-17',
  ...overrides,
});

describe('Weekly Review Prayer count label', () => {
  it('summarizes prayed requests, prayer paths, and unique people', () => {
    const result = getPrayerCaptureCountLabel([
      prayer({id: 'request-event', prayerEventType: 'request_prayed_for', requestId: 'request-1', prayerId: 'response-1', prayerActivityType: 'request', prayerActivityId: 'request-1', personName: 'Maya'}),
      prayer({id: 'cast-created', prayerEventType: 'new_prayer', prayerId: 'cast-supplication', prayerActivityType: 'cast', prayerActivityId: 'cast-session'}),
      prayer({id: 'cast-thanks', prayerEventType: 'thanksgiving', prayerId: 'cast-thanksgiving', prayerActivityType: 'cast', prayerActivityId: 'cast-session'}),
      prayer({id: 'open-created', prayerEventType: 'new_prayer', prayerId: 'open-1', prayerActivityType: 'open', prayerActivityId: 'open-1'}),
      prayer({id: 'need-answer', prayerEventType: 'need_answer_recorded', prayerId: 'need-parent', needId: 'need-1', prayerActivityType: 'need', prayerActivityId: 'need-parent', personName: 'Mom'}),
      prayer({id: 'need-update', prayerEventType: 'update', prayerId: 'need-parent', needId: 'need-1', prayerActivityType: 'need', prayerActivityId: 'need-parent', personName: 'mom'}),
    ]);

    expect(result).toBe('1 prayer request prayed · 3 prayed · 2 people prayed for');
  });

  it('does not count a received request as someone prayed for', () => {
    expect(getPrayerCaptureCountLabel([
      prayer({prayerEventType: 'request_received', prayerId: 'request-1', prayerActivityType: 'request', prayerActivityId: 'request-1', personName: 'Maya'}),
      prayer({id: 'request-carry', prayerEventType: 'still_carrying', prayerId: 'request-1', prayerActivityType: 'request', prayerActivityId: 'request-1', personName: 'Maya'}),
    ])).toBe('');
  });

  it('uses singular labels and omits zero-value segments', () => {
    expect(getPrayerCaptureCountLabel([
      prayer({prayerEventType: 'new_prayer', prayerId: 'need-parent', prayerActivityType: 'need', prayerActivityId: 'need-parent', personName: 'Mom'}),
    ])).toBe('1 prayed · 1 person prayed for');
  });
});

import { derivePrayerReview } from '../prayerReviewService';
import type { PrayerApiEntry } from '../api/prayerApi';

const prayer = (overrides: Partial<PrayerApiEntry> = {}): PrayerApiEntry => ({
  id: 'p1', prayer_type: 'journal', journal_category: 'supplication', content: 'A long-held prayer',
  selected_date: '2026-01-10', created_at: '2026-01-10T10:00:00Z', updated_at: '2026-09-08T10:00:00Z',
  status: 'pending', metadata: { track_answered: true, is_active: true, tracking_status: 'pending' }, ...overrides,
});

describe('Prayer Review period derivation', () => {
  it('captures a cross-period answer using its event date', () => {
    const result = derivePrayerReview([prayer({ metadata: { track_answered: true, is_active: false, answer_history: [{ id: 'a1', date: '2026-09-08T10:00:00Z', note: 'A door opened' }] } })], '2026-09-01', '2026-09-30', 'monthly');
    expect(result.items.filter(i => i.eventType === 'answer_recorded')).toEqual([expect.objectContaining({ eventDate: '2026-09-08', subtitle: 'You recorded an answer' })]);
    expect(result.items.some(i => i.eventType === 'new_prayer')).toBe(false);
  });

  it('keeps multiple answers in their actual periods', () => {
    const p = prayer({ metadata: { track_answered: true, is_active: true, answer_history: [{ id: 'march', date: '2026-03-04' }, { id: 'sept', date: '2026-09-08' }] } });
    expect(derivePrayerReview([p], '2026-03-01', '2026-03-31', 'monthly').items.filter(i => i.eventType === 'answer_recorded')[0].id).toContain('march');
    expect(derivePrayerReview([p], '2026-09-01', '2026-09-30', 'monthly').items.filter(i => i.eventType === 'answer_recorded')[0].id).toContain('sept');
  });

  it('records an answered Need while the parent remains active', () => {
    const result = derivePrayerReview([prayer({ metadata: { track_answered: true, is_active: true, prayer_needs: [
      { id: 'clear-scan', text: 'Clear scan', status: 'answered', active: false, answerHistory: [{ id: 'need-a', date: '2026-09-09' }] },
      { id: 'strength', text: 'Strength during treatment', status: 'pending', active: true },
    ] } })], '2026-09-01', '2026-09-30', 'monthly');
    expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ eventType: 'need_answer_recorded', needId: 'clear-scan' }), expect.objectContaining({ eventType: 'still_carrying' })]));
    expect(result.items.some(i => i.eventType === 'answer_recorded')).toBe(false);
  });

  it('only assigns dated Let Go events to a period', () => {
    const dated = prayer({ id: 'dated', metadata: { track_answered: true, tracking_status: 'closed', lifecycle_history: [{ id: 'l1', action: 'let-go', date: '2026-09-12' }] } });
    const legacy = prayer({ id: 'legacy', metadata: { track_answered: true, tracking_status: 'closed' } });
    const result = derivePrayerReview([dated, legacy], '2026-09-01', '2026-09-30', 'monthly');
    expect(result.items.filter(i => i.eventType === 'let_go').map(i => i.prayerId)).toEqual(['dated']);
  });

  it('connects a request to its linked response', () => {
    const request = prayer({ id: 'request', prayer_type: 'people', is_prayer_request: true, content: 'Please pray', selected_date: '2026-08-02', created_at: '2026-08-02T10:00:00Z' });
    const response = prayer({ id: 'response', prayer_type: 'people', selected_date: '2026-09-03', created_at: '2026-09-03T10:00:00Z', last_prayed_at: '2026-09-03T10:00:00Z', metadata: { original_request_id: 'request', track_answered: true, is_active: true } });
    const result = derivePrayerReview([request, response], '2026-09-01', '2026-09-30', 'monthly');
    expect(result.items.filter(i => i.eventType === 'request_prayed_for')).toHaveLength(1);
    expect(result.items.some(i => i.eventType === 'new_prayer' && i.prayerId === 'response')).toBe(false);
  });

  it('deduplicates CAST creation and keeps Thanksgiving distinct', () => {
    const cast = ['adoration', 'confession', 'thanksgiving', 'supplication'].map((category, index) => prayer({ id: `cast-${index}`, journal_category: category as any, selected_date: '2026-09-05', metadata: { prayer_session_id: 'session-1', prayer_style: 'cast', track_answered: category === 'supplication', is_active: category === 'supplication' } }));
    const result = derivePrayerReview(cast, '2026-09-01', '2026-09-30', 'monthly');
    expect(result.items.filter(i => i.eventType === 'new_prayer')).toHaveLength(1);
    expect(result.items.filter(i => i.eventType === 'thanksgiving')).toHaveLength(1);
    expect(result.items.filter(i => i.eventType.includes('answer'))).toHaveLength(0);
  });
});

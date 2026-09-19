import { answeredPrayerCollection, getPrayerIntelligenceCandidates, selectPrayerIntelligenceCandidate } from '../prayerIntelligenceService';
import type { PrayerApiEntry } from '../api/prayerApi';

const now = new Date('2026-09-20T12:00:00.000Z');
const prayer = (id: string, extra: Partial<PrayerApiEntry> = {}): PrayerApiEntry => ({
  id, content: id, prayer_type: 'journal', journal_category: 'personal_prayer', selected_date: '2026-01-01', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', status: 'pending', metadata: { track_answered: true, is_active: true }, ...extra,
});
const purposes = (entries: PrayerApiEntry[]) => getPrayerIntelligenceCandidates(entries, now).map(item => [item.prayerId, item.needId, item.purpose]);

describe('prayer intelligence eligibility', () => {
  it('returns stale active prayers, lowers recent activity, and preserves answered + active', () => {
    const result = purposes([
      prayer('stale', { last_prayed_at: '2026-08-01T00:00:00.000Z' }),
      prayer('recent', { last_prayed_at: '2026-09-20T08:00:00.000Z' }),
      prayer('let-go', { metadata: { track_answered: true, tracking_status: 'closed', is_active: false } }),
      prayer('just-save', { metadata: { track_answered: false } }),
      prayer('answered-active', { status: 'answered', metadata: { track_answered: true, is_active: true, tracking_status: 'pending', answer_history: [{ id: 'a', date: '2026-01-02' }] } }),
    ]);
    expect(result.some(([id, , purpose]) => id === 'stale' && (purpose === 'return' || purpose === 'check_in'))).toBe(true);
    expect(purposes([prayer('stale-only', { last_prayed_at: '2026-08-01T00:00:00.000Z' })])).toContainEqual(['stale-only', undefined, 'return']);
    expect(result.some(([id]) => id === 'recent')).toBe(false);
    expect(result.some(([id, , purpose]) => id === 'let-go' && (purpose === 'return' || purpose === 'check_in'))).toBe(false);
    expect(result.some(([id, , purpose]) => id === 'just-save' && (purpose === 'return' || purpose === 'check_in'))).toBe(false);
    expect(result).toContainEqual(['answered-active', undefined, 'return']);
  });

  it('uses relative activity for check-ins and supports active Needs without reopening closed Needs', () => {
    const result = purposes([
      prayer('very-stale', { last_prayed_at: '2026-01-05' }),
      prayer('less-stale', { last_prayed_at: '2026-09-10' }),
      prayer('needs', { metadata: { track_answered: true, prayer_needs: [
        { id: 'open', text: 'Open', status: 'pending', active: true },
        { id: 'closed', text: 'Closed', status: 'closed', active: false },
      ], need_last_prayed: { open: '2026-08-01' } } }),
    ]);
    expect(result).toContainEqual(['less-stale', undefined, 'check_in']);
    expect(result).toContainEqual(['needs', 'open', 'return']);
    expect(result.some(([id, need]) => id === 'needs' && need === 'closed')).toBe(false);
  });

  it('follows requests as one linked journey and suppresses recent follow-up', () => {
    const request = prayer('request', { prayer_type: 'people', is_prayer_request: true, prayed: false });
    const linked = prayer('linked', { prayer_type: 'people', last_prayed_at: '2026-08-01', metadata: { track_answered: true, is_active: true, original_request_id: 'request' } });
    const result = getPrayerIntelligenceCandidates([request, linked], now);
    expect(result.filter(item => item.requestId === 'request')).toHaveLength(1);
    expect(result[0].purpose).toBe('follow_up');
    expect(purposes([{ ...linked, last_prayed_at: '2026-09-20', updated_at: '2026-09-20' }])).toHaveLength(0);
  });

  it('remembers Just Save and Let Go only after the fresh-item guardrail', () => {
    const result = purposes([
      prayer('saved-old', { metadata: { track_answered: false } }),
      prayer('saved-new', { created_at: '2026-09-20', updated_at: '2026-09-20', metadata: { track_answered: false } }),
      prayer('released', { metadata: { track_answered: true, tracking_status: 'closed', is_active: false } }),
    ]);
    expect(result).toContainEqual(['saved-old', undefined, 'remember']);
    expect(result).toContainEqual(['released', undefined, 'remember']);
    expect(result.some(([id]) => id === 'saved-new')).toBe(false);
  });

  it('celebrates one Prayer or Need answer without counting Thanksgiving as an answer', () => {
    const entries = [
      prayer('answered', { status: 'answered', metadata: { track_answered: true, is_active: false, answer_history: [{ id: 'a', date: '2026-09-01' }] } }),
      prayer('need-answer', { metadata: { track_answered: true, is_active: false, prayer_needs: [{ id: 'n', text: 'Need', status: 'answered', active: false, answeredDate: '2026-09-02', answerHistory: [{ id: 'na', date: '2026-09-02' }] }] } }),
      prayer('thanks', { journal_category: 'thanksgiving', metadata: { track_answered: false } }),
    ];
    expect(purposes(entries)).toEqual(expect.arrayContaining([['answered', undefined, 'celebrate'], ['need-answer', 'n', 'celebrate'], ['thanks', undefined, 'remember']]));
    expect(answeredPrayerCollection(entries, new Date('2026-09-01'), now).count).toBe(2);
  });

  it('honors local resurfacing and dismissal state and selects another concern', () => {
    const entries = [prayer('one', { last_prayed_at: '2026-01-01' }), prayer('two', { last_prayed_at: '2026-02-01' })];
    const candidates = getPrayerIntelligenceCandidates(entries, now, { 'one:': { lastResurfacedAt: '2026-09-19' } });
    expect(candidates.map(item => item.id)).toEqual(['two:']);
    expect(selectPrayerIntelligenceCandidate(getPrayerIntelligenceCandidates(entries, now), ['one:'])?.id).toBe('two:');
    expect(getPrayerIntelligenceCandidates(entries, now, { 'one:': { dismissedUntil: '2026-09-22' } }).some(item => item.id === 'one:')).toBe(false);
  });
});

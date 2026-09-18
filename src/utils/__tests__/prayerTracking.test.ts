import type { PrayerApiEntry } from '../../services/api/prayerApi';
import { answerPrayer, changeNeedLifecycle, continuePrayer, describePrayerUpdate, hasAnswerHistory, isPrayerActive, isPrayerLetGo, releasePrayer, setPrayerTracking } from '../prayerTracking';

const prayer = (overrides: Partial<PrayerApiEntry> = {}): PrayerApiEntry => ({
  id: 'prayer-1', prayer_type: 'journal', journal_category: 'supplication', content: 'Please help',
  selected_date: '2026-09-19', created_at: '2026-09-19T00:00:00.000Z', updated_at: '2026-09-19T00:00:00.000Z',
  status: 'pending', metadata: { track_answered: true }, ...overrides,
});

describe('prayer lifecycle', () => {
  it('keeps Just Save distinct from answered and Let Go', () => {
    const saved = prayer({ metadata: { track_answered: false } });
    expect(isPrayerActive(saved)).toBe(false);
    expect(hasAnswerHistory(saved)).toBe(false);
    expect(isPrayerLetGo(saved)).toBe(false);
    expect(isPrayerActive({ ...saved, metadata: { ...saved.metadata, track_answered: true } })).toBe(true);
  });

  it('records durable answer history and can continue praying', () => {
    const changes = answerPrayer(prayer(), undefined, '2026-09-19T12:00:00.000Z', 'A door opened', true);
    const answered = { ...prayer(), ...changes };
    expect(answered.answered_date).toBe('2026-09-19T12:00:00.000Z');
    expect(answered.metadata.answer_history[0].note).toBe('A door opened');
    expect(hasAnswerHistory(answered)).toBe(true);
    expect(isPrayerActive(answered)).toBe(true);
  });

  it('returning after an answer never clears its history or date', () => {
    const answered = { ...prayer(), ...answerPrayer(prayer(), undefined, '2026-09-19T12:00:00.000Z') };
    const letGo = { ...answered, ...releasePrayer(answered, '2026-09-20T00:00:00.000Z') };
    const returned = { ...letGo, ...releasePrayer(letGo, '2026-09-21T00:00:00.000Z') };
    expect(returned.id).toBe('prayer-1');
    expect(returned.answered_date).toBe('2026-09-19T12:00:00.000Z');
    expect(hasAnswerHistory(returned)).toBe(true);
    expect(isPrayerActive(returned)).toBe(true);
  });

  it('preserves answered needs during parent Let Go and Return', () => {
    const mixed = prayer({ metadata: { track_answered: true, prayer_needs: [
      { id: 'a', text: 'A', status: 'answered', answeredDate: '2026-09-18' },
      { id: 'b', text: 'B', status: 'pending' },
      { id: 'c', text: 'C', status: 'closed' },
    ] } });
    expect(isPrayerActive(mixed)).toBe(true);
    expect(hasAnswerHistory(mixed)).toBe(true);
    const letGo = { ...mixed, ...releasePrayer(mixed) };
    expect(letGo.metadata!.prayer_needs.find((n: any) => n.id === 'a')!.answeredDate).toBe('2026-09-18');
    const returned = { ...letGo, ...releasePrayer(letGo) };
    expect(returned.metadata!.prayer_needs.find((n: any) => n.id === 'a')!.status).toBe('answered');
    expect(returned.metadata!.prayer_needs.find((n: any) => n.id === 'b')!.status).toBe('pending');
  });

  it('general updates preserve lifecycle while still-praying updates activate it', () => {
    const inactive = { ...prayer(), ...answerPrayer(prayer()) };
    const note = { ...inactive, ...describePrayerUpdate(inactive, 'A note', 'situation-changed') };
    expect(isPrayerActive(note)).toBe(false);
    const active = { ...note, ...continuePrayer(note) };
    expect(isPrayerActive(active)).toBe(true);
    expect(hasAnswerHistory(active)).toBe(true);
  });

  it('keeps independently Let Go Needs closed after a parent Return', () => {
    const mixed = prayer({ metadata: { track_answered: true, prayer_needs: [
      { id: 'a', text: 'Answered', status: 'answered', answeredDate: '2026-09-18' },
      { id: 'b', text: 'Active', status: 'pending' },
      { id: 'c', text: 'Released', status: 'closed' },
    ] } });
    const letGo = { ...mixed, ...releasePrayer(mixed, '2026-09-20T00:00:00.000Z') };
    expect(letGo.metadata!.prayer_needs.find((n: any) => n.id === 'b')!.closedByParent).toBe(true);
    expect(letGo.metadata!.prayer_needs.find((n: any) => n.id === 'c')!.closedByParent).toBeUndefined();
    const returned = { ...letGo, ...releasePrayer(letGo, '2026-09-21T00:00:00.000Z') };
    expect(returned.metadata!.prayer_needs.find((n: any) => n.id === 'b')).toMatchObject({ status: 'pending', active: true });
    expect(returned.metadata!.prayer_needs.find((n: any) => n.id === 'c')).toMatchObject({ status: 'closed' });
  });

  it('uses canonical helpers for tracking toggles and Need-specific Let Go/Return', () => {
    const answered = { ...prayer(), ...answerPrayer(prayer()) };
    const active = { ...answered, ...setPrayerTracking(answered, true) };
    expect(isPrayerActive(active)).toBe(true);
    expect(hasAnswerHistory(active)).toBe(true);
    const withNeed = prayer({ metadata: { track_answered: true, prayer_needs: [{ id: 'need', text: 'Need', status: 'pending' }] } });
    const released = { ...withNeed, ...changeNeedLifecycle(withNeed, 'need', 'let-go') };
    const returned = { ...released, ...changeNeedLifecycle(released, 'need', 'return') };
    expect(released.metadata!.prayer_needs[0]).toMatchObject({ status: 'closed', active: false, closedByParent: false });
    expect(returned.metadata!.prayer_needs[0]).toMatchObject({ status: 'pending', active: true });
    expect(returned.metadata!.prayer_needs[0].lifecycleHistory).toHaveLength(2);
  });
});

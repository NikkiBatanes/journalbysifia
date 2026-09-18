import type { PrayerApiEntry } from '../../api/prayerApi';
import { persistPrayerUpdate } from '../../prayerUpdateBoundary';
import { answerPrayer, changeNeedLifecycle, continuePrayer, releasePrayer } from '../../../utils/prayerTracking';

const makePrayer = (): PrayerApiEntry => ({
  id: 'mixed-prayer', prayer_type: 'journal', journal_category: 'supplication', content: 'Please help',
  selected_date: '2026-09-19', created_at: '2026-09-19T00:00:00.000Z', updated_at: '2026-09-19T00:00:00.000Z',
  status: 'pending', metadata: { track_answered: true, prayer_needs: [
    { id: 'a', text: 'Answered', status: 'answered', answeredDate: '2026-09-18', answerHistory: [{ id: 'answer-a', date: '2026-09-18' }] },
    { id: 'b', text: 'Active', status: 'pending', active: true },
    { id: 'c', text: 'Released', status: 'closed', active: false, closedByParent: false },
  ] },
});

/** A tiny storage double makes each assertion cross the same update boundary then reload. */
const storage = (initial: PrayerApiEntry) => {
  let value = initial;
  const api = {
    updatePrayer: jest.fn(async (_id: string, updates: Partial<PrayerApiEntry>) => {
      value = { ...value, ...updates, metadata: updates.metadata ? { ...value.metadata, ...updates.metadata } : value.metadata };
      return value;
    }),
    markSupplicationAnswered: jest.fn<Promise<PrayerApiEntry>, [string, boolean]>(async () => { throw new Error('legacy conversion should not run'); }),
  };
  return { api, reload: () => value };
};

describe('Prayer update compatibility boundary', () => {
  it('persists mixed-Need parent Let Go and Return without legacy reinterpretation', async () => {
    const store = storage(makePrayer());
    await persistPrayerUpdate('mixed-prayer', releasePrayer(store.reload(), '2026-09-20T00:00:00.000Z'), store.api as any);
    await persistPrayerUpdate('mixed-prayer', releasePrayer(store.reload(), '2026-09-21T00:00:00.000Z'), store.api as any);
    const needs = store.reload().metadata!.prayer_needs;
    expect(store.api.markSupplicationAnswered).not.toHaveBeenCalled();
    expect(needs).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'a', status: 'answered' }),
      expect.objectContaining({ id: 'b', status: 'pending', active: true }),
      expect.objectContaining({ id: 'c', status: 'closed', active: false }),
    ]));
    expect(store.reload()).not.toHaveProperty('__canonicalPrayerLifecycle');
    expect(store.reload().metadata).not.toHaveProperty('__canonicalPrayerLifecycle');
  });

  it('persists Need Let Go, Return, Answer, and Continue without changing siblings', async () => {
    const store = storage(makePrayer());
    await persistPrayerUpdate('mixed-prayer', changeNeedLifecycle(store.reload(), 'b', 'let-go'), store.api as any);
    await persistPrayerUpdate('mixed-prayer', changeNeedLifecycle(store.reload(), 'b', 'return'), store.api as any);
    await persistPrayerUpdate('mixed-prayer', answerPrayer(store.reload(), 'b', '2026-09-22T00:00:00.000Z'), store.api as any);
    await persistPrayerUpdate('mixed-prayer', continuePrayer(store.reload(), 'b', '2026-09-23T00:00:00.000Z'), store.api as any);
    const needs = store.reload().metadata!.prayer_needs;
    expect(store.api.markSupplicationAnswered).not.toHaveBeenCalled();
    expect(needs.find((need: any) => need.id === 'a')).toMatchObject({ status: 'answered', answeredDate: '2026-09-18' });
    expect(needs.find((need: any) => need.id === 'b')).toMatchObject({ status: 'answered', active: true, answeredDate: '2026-09-22T00:00:00.000Z' });
    expect(needs.find((need: any) => need.id === 'b').answerHistory).toHaveLength(1);
    expect(needs.find((need: any) => need.id === 'c')).toMatchObject({ status: 'closed', active: false });
  });

  it('keeps genuine bare legacy status writes on the compatibility path', async () => {
    const store = storage({ ...makePrayer(), id: 'single', metadata: { track_answered: true, prayer_needs: [] } });
    store.api.markSupplicationAnswered.mockImplementation(async () => store.reload());
    await persistPrayerUpdate('single', { status: 'answered' }, store.api as any);
    expect(store.api.markSupplicationAnswered).toHaveBeenCalledWith('single', true);
    expect(store.api.updatePrayer).not.toHaveBeenCalled();
  });

  it('writes canonical whole-Prayer answers once and preserves multiple answer events', async () => {
    const store = storage({ ...makePrayer(), id: 'single', metadata: { track_answered: true, prayer_needs: [] } });
    await persistPrayerUpdate('single', answerPrayer(store.reload(), undefined, '2026-09-20T00:00:00.000Z'), store.api as any);
    await persistPrayerUpdate('single', continuePrayer(store.reload(), undefined, '2026-09-21T00:00:00.000Z'), store.api as any);
    await persistPrayerUpdate('single', answerPrayer(store.reload(), undefined, '2026-09-22T00:00:00.000Z'), store.api as any);
    expect(store.api.markSupplicationAnswered).not.toHaveBeenCalled();
    expect(store.reload().metadata!.answer_history).toHaveLength(2);
    expect(store.api.updatePrayer).toHaveBeenCalledTimes(3);
  });
});

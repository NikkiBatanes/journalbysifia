import AsyncStorage from '@react-native-async-storage/async-storage';
import { revisitCandidates, selectPrayerRevisit } from '../prayerRevisitService';
import type { PrayerApiEntry } from '../api/prayerApi';
const date = new Date(2026, 8, 16);
const prayer = (id: string, created: string, extra = {}): PrayerApiEntry => ({
  id, user_id: 'local', selected_date: created.slice(0, 10), created_at: created, updated_at: created,
  content: id, prayer_type: 'journal', journal_category: 'personal_prayer', status: 'pending', ...extra,
});
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => storage.get(key) || null);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => { storage.set(key, value); });
});
it('prioritizes very old unresolved prayers, even when recently prayed', () => {
  const entries = [
    prayer('recent', '2026-08-01'),
    prayer('old', '2020-01-01', { last_prayed_at: '2026-09-15' }),
    prayer('answered', '2019-01-01', { status: 'answered' }),
    prayer('closed', '2018-01-01', { metadata: { tracking_status: 'closed' } }),
    prayer('untracked', '2017-01-01', { metadata: { track_answered: false } }),
    prayer('request', '2016-01-01', { is_prayer_request: true }),
    prayer('future', '2027-01-01'),
  ];
  expect(revisitCandidates(entries, '2026-09-16').map(c => c.prayerId)).toEqual(['old', 'recent']);
});
it('keeps the daily choice steady, supports another, and replaces an answered choice', async () => {
  const entries = [prayer('old', '2020-01-01'), prayer('new', '2026-01-01')];
  const first = await selectPrayerRevisit('local', entries, date);
  expect(first?.prayerId).toBe('old');
  const another = await selectPrayerRevisit('local', entries, date, first!);
  expect(another?.prayerId).toBe('new');
  expect(await selectPrayerRevisit('local', entries, date)).toEqual(another);
  expect((await selectPrayerRevisit('local', [{ ...entries[1], status: 'answered' }, entries[0]], date))?.prayerId).toBe('old');
  expect((await selectPrayerRevisit('other-user', entries, date))?.prayerId).toBe('old');
});
it('features pending needs individually and keeps one CAST session as one candidate', () => {
  const entries = [
    prayer('need', '2020-01-01', { metadata: { prayer_need: true, prayer_needs: [
      { id: 'rent', text: 'Rent', status: 'answered' }, { id: 'fees', text: 'School fees', status: 'pending' },
    ] } }),
    ...['confession', 'adoration', 'supplication', 'thanksgiving'].map(journal_category =>
      prayer(journal_category, '2021-01-01', { journal_category, metadata: { prayer_style: 'cast', prayer_session_id: 'cast', track_answered: journal_category === 'supplication' } })),
  ];
  expect(revisitCandidates(entries, '2026-09-16')).toEqual([{ prayerId: 'need', needId: 'fees' }, { prayerId: 'supplication' }]);
});
it('hides when there are no eligible prayers and recovers from malformed preferences', async () => {
  expect(await selectPrayerRevisit('local', [], date)).toBeNull();
  await AsyncStorage.setItem('prayer-revisit:local', JSON.stringify({ day: '2026-09-16' }));
  expect((await selectPrayerRevisit('local', [prayer('old', '2020-01-01')], date))?.prayerId).toBe('old');
});

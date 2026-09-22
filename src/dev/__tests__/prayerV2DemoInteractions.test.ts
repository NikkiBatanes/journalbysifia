import AsyncStorage from '@react-native-async-storage/async-storage';
import { answerPrayer, continuePrayer, isPrayerActive, isPrayerLetGo, releasePrayer } from '../../utils/prayerTracking';
import { PrayerApi } from '../../services/api/prayerApi';
import { buildPrayerV2DemoFixtures, PRAYER_V2_DEMO_PREFIX } from '../prayerV2DemoFixtures';
import {
  assertPrayerV2DemoId,
  createPrayerV2DemoRequestResponse,
  getPrayerV2DemoRecords,
  isPrayerV2DemoNeedId,
  prayAgainPrayerV2Demo,
  reloadPrayerV2DemoScenario,
  updatePrayerV2DemoRecord,
} from '../prayerV2DemoInteractions';

describe('interactive Prayer V2 demo mutations', () => {
  const data = new Map<string, string>();
  const reference = new Date('2026-09-20T12:00:00.000Z');

  beforeEach(async () => {
    data.clear();
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => { data.set(key, value); });
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => data.get(key) ?? null);
    (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(async () => [...data.keys()]);
    (AsyncStorage.multiGet as jest.Mock).mockImplementation(async (keys: string[]) => keys.map(key => [key, data.get(key) ?? null]));
    (AsyncStorage.multiRemove as jest.Mock).mockImplementation(async (keys: string[]) => { keys.forEach(key => data.delete(key)); });
    await reloadPrayerV2DemoScenario('full', reference);
    const normal = { ...buildPrayerV2DemoFixtures(reference)[0], id: 'normal-prayer', selected_date: '2026-09-20' };
    await AsyncStorage.setItem(`prayer_local:${normal.selected_date}:${normal.id}`, JSON.stringify(normal));
    await AsyncStorage.setItem(`prayer_local_index:${normal.selected_date}`, JSON.stringify([...(JSON.parse(data.get(`prayer_local_index:${normal.selected_date}`) || '[]')), normal.id]));
  });

  it('Pray Again updates the same namespaced record once and rejects normal IDs', async () => {
    const before = (await getPrayerV2DemoRecords()).find(item => item.id === `${PRAYER_V2_DEMO_PREFIX}return`)!;
    const updated = await prayAgainPrayerV2Demo(before);
    expect(updated.id).toBe(before.id);
    expect(updated.prayer_count).toBe((before.prayer_count || 0) + 1);
    expect(updated.last_prayed_at).not.toBe(before.last_prayed_at);
    expect(updated.metadata?.answer_history).toEqual(before.metadata?.answer_history);
    expect((await getPrayerV2DemoRecords()).filter(item => item.id === before.id)).toHaveLength(1);
    expect(await AsyncStorage.getItem('prayer_local:2026-09-20:normal-prayer')).not.toBeNull();
    await expect(prayAgainPrayerV2Demo({ ...before, id: 'normal-prayer' })).rejects.toThrow('Refused non-demo Prayer mutation');
    expect(() => assertPrayerV2DemoId('normal-prayer')).toThrow('Refused non-demo Prayer mutation');
  });

  it('persists answer date and history, continues the same Prayer, and supports canonical Let Go', async () => {
    const candidate = (await getPrayerV2DemoRecords()).find(item => item.id === `${PRAYER_V2_DEMO_PREFIX}check-in`)!;
    const answerDate = '2026-09-12T12:00:00.000Z';
    const answered = await updatePrayerV2DemoRecord(candidate.id, answerPrayer(candidate, undefined, answerDate, 'The conversation was calmer than expected.', true));
    expect(answered.id).toBe(candidate.id);
    expect(answered.metadata?.answer_history?.[0]).toMatchObject({ date: answerDate, note: 'The conversation was calmer than expected.' });
    expect(isPrayerActive(answered)).toBe(true);
    expect(answered.status).toBe('answered');
    const continued = await updatePrayerV2DemoRecord(answered.id, continuePrayer(answered));
    expect(continued.id).toBe(candidate.id);
    expect(continued.metadata?.answer_history).toEqual(answered.metadata?.answer_history);
    expect(isPrayerActive(continued)).toBe(true);
    const released = await updatePrayerV2DemoRecord(continued.id, releasePrayer(continued));
    expect(released.id).toBe(candidate.id);
    expect(released.metadata?.answer_history).toEqual(answered.metadata?.answer_history);
    expect(isPrayerLetGo(released)).toBe(true);
    expect(released.metadata?.prayer_updates?.every((entry: any) => isPrayerV2DemoNeedId(entry.needId) || !entry.needId)).toBe(true);
    expect(released.metadata?.prayer_updates?.every((entry: any) => entry.id.startsWith(candidate.id))).toBe(true);
  });

  it('refuses any nested Prayer Need identity outside the demo namespace', async () => {
    const candidate = (await getPrayerV2DemoRecords()).find(item => item.id === `${PRAYER_V2_DEMO_PREFIX}mixed-needs`)!;
    await expect(updatePrayerV2DemoRecord(candidate.id, { metadata: { ...candidate.metadata, prayer_needs: [{ id: 'real-user-need', text: 'Do not touch', status: 'pending' }] } })).rejects.toThrow('Refused non-demo Prayer Need mutation');
    expect((await PrayerApi.getAllPrayers('local')).find(item => item.id === candidate.id)?.metadata?.prayer_needs).toEqual(candidate.metadata?.prayer_needs);
  });

  it('preserves the exact request journey when creating a namespaced response', async () => {
    const request = (await getPrayerV2DemoRecords()).find(item => item.id === `${PRAYER_V2_DEMO_PREFIX}request-leah`)!;
    const response = await createPrayerV2DemoRequestResponse(request, {
      prayer_type: 'people', person_name: request.person_name, content: 'Lord, give Leah peace as she moves.',
      selected_date: '2026-09-20', prayed: true, prayer_count: 1, status: 'pending',
      metadata: { prayer_type: 'pray-for-someone', original_request_id: request.id, original_request_content: request.content, prayer_request_display: request.content, track_answered: true },
    });
    expect(response.id.startsWith(PRAYER_V2_DEMO_PREFIX)).toBe(true);
    expect(response.metadata?.original_request_id).toBe(request.id);
    await PrayerApi.markPrayerRequestPrayed(request.id, true);
    const linked = (await getPrayerV2DemoRecords()).filter(item => item.metadata?.original_request_id === request.id);
    expect(linked).toHaveLength(1);
    expect(linked[0].id).toBe(response.id);
  });

  it('reloads only demo fixtures and preserves normal Prayer records', async () => {
    await reloadPrayerV2DemoScenario('remember', reference);
    expect(await AsyncStorage.getItem('prayer_local:2026-09-20:normal-prayer')).not.toBeNull();
    const records = await getPrayerV2DemoRecords();
    expect(records.some(item => item.id.endsWith('remember'))).toBe(true);
    expect(records.some(item => item.id.endsWith('return'))).toBe(true);
  });
});

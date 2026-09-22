import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { PrayerApi, type PrayerApiEntry } from '../services/api/prayerApi';
import { prayAgainExistingPrayer } from '../services/prayerActivityService';
import type { PrayerChanges } from '../components/prayer/PrayerDetails';
import { persistPrayerUpdate } from '../services/prayerUpdateBoundary';
import { fixturesForScenario, PRAYER_V2_DEMO_PREFIX, type PrayerV2DemoScenario } from './prayerV2DemoFixtures';

const prayerRecordPrefix = 'prayer_local:';
const prayerIndexPrefix = 'prayer_local_index:';
export const isPrayerV2DemoId = (value?: string | null): value is string => !!value?.startsWith(PRAYER_V2_DEMO_PREFIX);
export const isPrayerV2DemoNeedId = (value?: string | null): value is string => !!value?.startsWith('dev-need-v2-');

export function assertPrayerV2DemoId(value?: string | null): asserts value is string {
  if (!isPrayerV2DemoId(value)) throw new Error('Refused non-demo Prayer mutation.');
}

function namespaceNestedDemoState(id: string, changes: PrayerChanges | Partial<Omit<PrayerApiEntry, 'id'>>) {
  const metadata = changes.metadata;
  if (!metadata) return changes;
  const needs = Array.isArray(metadata.prayer_needs) ? metadata.prayer_needs : [];
  if (needs.some((need: any) => !isPrayerV2DemoNeedId(need.id))) throw new Error('Refused non-demo Prayer Need mutation.');
  const namespaceEntries = (key: string) => Array.isArray(metadata[key]) ? metadata[key].map((entry: any, index: number) => ({
    ...entry,
    id: isPrayerV2DemoId(entry.id) ? entry.id : `${id}-${key}-${index}-${String(entry.id || 'event').slice(-12)}`,
    ...(entry.needId ? { needId: (value => { if (!isPrayerV2DemoNeedId(value)) throw new Error('Refused non-demo Prayer Need reference.'); return value; })(entry.needId) } : {}),
  })) : metadata[key];
  return {
    ...changes,
    metadata: {
      ...metadata,
      ...(metadata.prayer_updates ? { prayer_updates: namespaceEntries('prayer_updates') } : {}),
      ...(metadata.answer_history ? { answer_history: namespaceEntries('answer_history') } : {}),
      ...(metadata.lifecycle_history ? { lifecycle_history: namespaceEntries('lifecycle_history') } : {}),
      ...(needs.length ? { prayer_needs: needs.map((need: any) => ({
        ...need,
        ...(need.answerHistory ? { answerHistory: need.answerHistory.map((event: any, index: number) => ({ ...event, id: isPrayerV2DemoId(event.id) ? event.id : `${need.id}-answer-${index}` })) } : {}),
        ...(need.lifecycleHistory ? { lifecycleHistory: need.lifecycleHistory.map((event: any, index: number) => ({ ...event, id: isPrayerV2DemoId(event.id) ? event.id : `${need.id}-lifecycle-${index}` })) } : {}),
      })) } : {}),
    },
  };
}

const notify = () => {
  DeviceEventEmitter.emit('prayerSaved');
  DeviceEventEmitter.emit('momentsRefresh');
};

export async function getPrayerV2DemoRecords() {
  return (await PrayerApi.getAllPrayers('local')).filter(item => isPrayerV2DemoId(item.id));
}

export async function updatePrayerV2DemoRecord(id: string, changes: PrayerChanges | Partial<Omit<PrayerApiEntry, 'id'>>) {
  assertPrayerV2DemoId(id);
  const namespaced = namespaceNestedDemoState(id, changes);
  await persistPrayerUpdate(id, namespaced as any);
  const updated = (await getPrayerV2DemoRecords()).find(item => item.id === id);
  if (!updated) throw new Error('Demo Prayer update could not be read back.');
  notify();
  return updated;
}

export async function prayAgainPrayerV2Demo(prayer: PrayerApiEntry, needId?: string) {
  assertPrayerV2DemoId(prayer.id);
  if (needId && !needId.startsWith('dev-need-v2-')) throw new Error('Refused non-demo Prayer Need mutation.');
  const updated = await prayAgainExistingPrayer(prayer, needId);
  notify();
  return updated;
}

export async function createPrayerV2DemoRequestResponse(request: PrayerApiEntry, data: Omit<PrayerApiEntry, 'id' | 'created_at' | 'updated_at'>) {
  assertPrayerV2DemoId(request.id);
  const existing = (await getPrayerV2DemoRecords()).filter(item => item.metadata?.original_request_id === request.id);
  if (existing.length) return existing[0];
  const stamp = new Date().toISOString();
  const response: PrayerApiEntry = { ...data, id: `${PRAYER_V2_DEMO_PREFIX}response-${request.id.slice(PRAYER_V2_DEMO_PREFIX.length)}`, created_at: stamp, updated_at: stamp, metadata: { ...data.metadata, original_request_id: request.id }, };
  assertPrayerV2DemoId(response.id);
  const key = `${prayerRecordPrefix}${response.selected_date}:${response.id}`;
  const indexKey = `${prayerIndexPrefix}${response.selected_date}`;
  const current = JSON.parse(await AsyncStorage.getItem(indexKey) || '[]') as string[];
  await AsyncStorage.setItem(key, JSON.stringify({ ...response, version: 1, sync_status: 'local', deleted: false }));
  await AsyncStorage.setItem(indexKey, JSON.stringify([...current.filter(id => id !== response.id), response.id]));
  notify();
  return response;
}

export async function markPrayerV2DemoRequestPrayed(request: PrayerApiEntry) {
  assertPrayerV2DemoId(request.id);
  const updated = await PrayerApi.markPrayerRequestPrayed(request.id, true);
  notify();
  return updated;
}

export async function reloadPrayerV2DemoScenario(scenario: PrayerV2DemoScenario, referenceDate = new Date()) {
  if (!__DEV__) throw new Error('Prayer V2 demo data is development-only.');
  const fixtures = fixturesForScenario(scenario, referenceDate);
  for (const fixture of fixtures) {
    assertPrayerV2DemoId(fixture.id);
    const { demoLabel: _label, expectedToday: _today, expectedReview: _review, ...canonical } = fixture;
    const indexKey = `${prayerIndexPrefix}${fixture.selected_date}`;
    const existingRecord = await AsyncStorage.getItem(`${prayerRecordPrefix}${fixture.selected_date}:${fixture.id}`);
    if (existingRecord) {
      const existing = JSON.parse(existingRecord) as PrayerApiEntry;
      if (!isPrayerV2DemoId(existing.id)) throw new Error('Refused to reload a non-demo Prayer record.');
    }
    const current = JSON.parse(await AsyncStorage.getItem(indexKey) || '[]') as string[];
    await AsyncStorage.setItem(`${prayerRecordPrefix}${fixture.selected_date}:${fixture.id}`, JSON.stringify(canonical));
    await AsyncStorage.setItem(indexKey, JSON.stringify([...current.filter(id => id !== fixture.id), fixture.id]));
  }
  notify();
  return fixtures.length;
}

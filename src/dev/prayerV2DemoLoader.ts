import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { fixturesForScenario, PRAYER_V2_DEMO_PREFIX, type PrayerV2DemoScenario } from './prayerV2DemoFixtures';

export const PRAYER_V2_DEMO_REFERENCE_KEY = 'dev-prayer-v2:reference-date';
const prayerIndexPrefix = 'prayer_local_index:';
const prayerRecordPrefix = 'prayer_local:';
const bibleSessionPrefix = 'bible_study_session:';

const parseList = (raw: string | null): string[] => {
  try { const value = JSON.parse(raw || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
};

export async function clearPrayerV2DemoData(): Promise<number> {
  if (!__DEV__) throw new Error('Prayer V2 demo data is development-only.');
  const keys = await AsyncStorage.getAllKeys();
  const prayerKeys = keys.filter(key => key.startsWith(prayerRecordPrefix) && key.split(':').pop()?.startsWith(PRAYER_V2_DEMO_PREFIX));
  const bibleKeys = keys.filter(key => key.startsWith(`${bibleSessionPrefix}${PRAYER_V2_DEMO_PREFIX}`));

  const indexKeys = keys.filter(key => key.startsWith(prayerIndexPrefix));
  for (const indexKey of indexKeys) {
    const ids = parseList(await AsyncStorage.getItem(indexKey));
    const kept = ids.filter(value => !value.startsWith(PRAYER_V2_DEMO_PREFIX));
    if (kept.length !== ids.length) await AsyncStorage.setItem(indexKey, JSON.stringify(kept));
  }

  // Resurfacing state is shared with real candidates, so remove only demo identities.
  for (const stateKey of keys.filter(key => key.startsWith('prayer-intelligence:'))) {
    try {
      const state = JSON.parse(await AsyncStorage.getItem(stateKey) || '{}');
      const items = Object.fromEntries(Object.entries(state.items || {}).filter(([candidateId]) => !candidateId.startsWith(PRAYER_V2_DEMO_PREFIX)));
      const recentIds = Array.isArray(state.recentIds) ? state.recentIds.filter((candidateId: unknown) => typeof candidateId !== 'string' || !candidateId.startsWith(PRAYER_V2_DEMO_PREFIX)) : [];
      await AsyncStorage.setItem(stateKey, JSON.stringify({ ...state, items, recentIds }));
    } catch { /* An invalid real-user state is left untouched. */ }
  }

  await AsyncStorage.multiRemove([...prayerKeys, ...bibleKeys, PRAYER_V2_DEMO_REFERENCE_KEY]);
  DeviceEventEmitter.emit('prayerSaved');
  DeviceEventEmitter.emit('momentsRefresh');
  return prayerKeys.length;
}

export async function loadPrayerV2DemoScenario(
  scenario: PrayerV2DemoScenario,
  referenceDate = new Date(),
) {
  if (!__DEV__) throw new Error('Prayer V2 demo data is development-only.');
  await clearPrayerV2DemoData();
  const fixtures = fixturesForScenario(scenario, referenceDate);
  const byDate = new Map<string, string[]>();
  for (const fixture of fixtures) {
    const { demoLabel: _label, expectedToday: _today, expectedReview: _review, ...canonical } = fixture;
    await AsyncStorage.setItem(`${prayerRecordPrefix}${fixture.selected_date}:${fixture.id}`, JSON.stringify(canonical));
    byDate.set(fixture.selected_date, [...(byDate.get(fixture.selected_date) || []), fixture.id]);
  }
  for (const [date, demoIds] of byDate) {
    const indexKey = `${prayerIndexPrefix}${date}`;
    const existing = parseList(await AsyncStorage.getItem(indexKey));
    await AsyncStorage.setItem(indexKey, JSON.stringify([...existing.filter(value => !value.startsWith(PRAYER_V2_DEMO_PREFIX)), ...demoIds]));
  }

  const biblePrayer = fixtures.find(item => item.id === `${PRAYER_V2_DEMO_PREFIX}bible-study`);
  if (biblePrayer) {
    const sessionId = `${PRAYER_V2_DEMO_PREFIX}bible-study-session`;
    await AsyncStorage.setItem(`${bibleSessionPrefix}${sessionId}`, JSON.stringify({
      id: sessionId, selected_date: biblePrayer.selected_date,
      passage: { reference: 'James 1:2–8', book: 'James', chapter: 1, verseStart: 2, verseEnd: 8 },
      current_stage: 'saved', current_step: 'respond', completed_steps: ['passage', 'read', 'observe', 'understand', 'respond'],
      prayer_ref: { domain: 'prayer', content_type: 'prayer', local_id: biblePrayer.id },
      completed: true, started_at: biblePrayer.created_at, updated_at: biblePrayer.updated_at,
      completed_at: biblePrayer.updated_at, version: 1,
    }));
  }

  await AsyncStorage.setItem(PRAYER_V2_DEMO_REFERENCE_KEY, referenceDate.toISOString());
  DeviceEventEmitter.emit('prayerSaved');
  DeviceEventEmitter.emit('momentsRefresh');
  return { scenario, referenceDate: referenceDate.toISOString(), prayerRecords: fixtures.length, logicalJourneys: new Set(fixtures.map(item => item.metadata?.prayer_session_id || item.metadata?.original_request_id || item.id)).size };
}

export async function getPrayerV2DemoReferenceDate() {
  return AsyncStorage.getItem(PRAYER_V2_DEMO_REFERENCE_KEY);
}

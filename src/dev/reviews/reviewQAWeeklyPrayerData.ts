import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  buildPrayerV2DemoFixtures,
  PRAYER_V2_DEMO_NEED_PREFIX,
  PRAYER_V2_DEMO_PREFIX,
  type PrayerV2DemoFixture,
} from '../prayerV2DemoFixtures';
import {REVIEW_QA_PREFIX} from './reviewQAFixtures';
import {reviewQAReferenceDate} from './reviewQAClock';
import type {ReviewQASeedManifest} from './reviewQAWeeklyMorningData';

const PRAYER_QA_PREFIX = `${REVIEW_QA_PREFIX}weekly:prayer-v2:`;
const PRAYER_QA_NEED_PREFIX = `${PRAYER_QA_PREFIX}need:`;
const WEEK_DATES = [
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
  '2026-09-18',
  '2026-09-19',
  '2026-09-20',
] as const;

const replaceDemoIdentity = (value: string): string => value
  .replaceAll(PRAYER_V2_DEMO_PREFIX, PRAYER_QA_PREFIX)
  .replaceAll(PRAYER_V2_DEMO_NEED_PREFIX, PRAYER_QA_NEED_PREFIX);

const redateAndNamespace = (value: unknown, date: string): unknown => {
  if (typeof value === 'string') {
    const dated = value.match(/^\d{4}-\d{2}-\d{2}(.*)$/);
    return replaceDemoIdentity(dated ? `${date}${dated[1]}` : value);
  }
  if (Array.isArray(value)) {
    return value.map(item => redateAndNamespace(item, date));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      replaceDemoIdentity(key),
      redateAndNamespace(item, date),
    ]));
  }
  return value;
};

/**
 * Reuses every Prayer V2 demo record while placing each logical journey on
 * September 14–20. September 21 remains the Review QA reference day.
 */
export const buildWeeklyReviewQAPrayerFixtures = (): PrayerV2DemoFixture[] => {
  const fixtures = buildPrayerV2DemoFixtures(reviewQAReferenceDate());
  const journeyDates = new Map<string, string>();

  return fixtures.map(fixture => {
    const journeyId = fixture.metadata?.prayer_session_id
      || fixture.metadata?.original_request_id
      || fixture.id;
    if (!journeyDates.has(journeyId)) {
      journeyDates.set(journeyId, WEEK_DATES[journeyDates.size % WEEK_DATES.length]);
    }
    return redateAndNamespace(fixture, journeyDates.get(journeyId)!) as PrayerV2DemoFixture;
  });
};

const addToIndex = async (key: string, id: string): Promise<void> => {
  let values: string[] = [];
  try {values = JSON.parse(await AsyncStorage.getItem(key) || '[]');} catch {}
  if (!values.includes(id)) {
    await AsyncStorage.setItem(key, JSON.stringify([...values, id]));
  }
};

/** Seeds the complete Prayer V2 demo library into the standard Weekly Review QA dataset. */
export const seedWeeklyPrayers = async (manifest: ReviewQASeedManifest): Promise<void> => {
  const fixtures = buildWeeklyReviewQAPrayerFixtures();
  for (const fixture of fixtures) {
    const {
      demoLabel: _label,
      expectedToday: _today,
      expectedReview: _review,
      ...canonical
    } = fixture;
    const key = `prayer_local:${fixture.selected_date}:${fixture.id}`;
    const indexKey = `prayer_local_index:${fixture.selected_date}`;
    if (!manifest.keys.includes(key)) {manifest.keys.push(key);}
    await AsyncStorage.setItem(key, JSON.stringify(canonical));
    await addToIndex(indexKey, fixture.id);
  }

  const biblePrayer = fixtures.find(item => item.id === `${PRAYER_QA_PREFIX}bible-study`);
  if (biblePrayer) {
    const sessionId = `${PRAYER_QA_PREFIX}bible-study-session`;
    const key = `bible_study_session:${sessionId}`;
    if (!manifest.keys.includes(key)) {manifest.keys.push(key);}
    await AsyncStorage.setItem(key, JSON.stringify({
      id: sessionId,
      selected_date: biblePrayer.selected_date,
      passage: {reference: 'James 1:2–8', book: 'James', chapter: 1, verseStart: 2, verseEnd: 8},
      current_stage: 'saved',
      current_step: 'respond',
      completed_steps: ['passage', 'read', 'observe', 'understand', 'respond'],
      prayer_ref: {domain: 'prayer', content_type: 'prayer', local_id: biblePrayer.id},
      completed: true,
      started_at: biblePrayer.created_at,
      updated_at: biblePrayer.updated_at,
      completed_at: biblePrayer.updated_at,
      version: 1,
    }));
  }
};

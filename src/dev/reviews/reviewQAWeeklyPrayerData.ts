import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  buildPrayerV2DemoFixtures,
  PRAYER_V2_DEMO_NEED_PREFIX,
  PRAYER_V2_DEMO_PREFIX,
  type PrayerV2DemoFixture,
} from '../prayerV2DemoFixtures';
import {REVIEW_QA_PREFIX} from './reviewQAFixtures';
import {reviewQAReferenceDate} from './reviewQAClock';
import type {
  ReviewQASeedManifest,
  ReviewQASeedScope,
} from './reviewQAWeeklyMorningData';

const WEEK_DATES = [
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
  '2026-09-18',
  '2026-09-19',
  '2026-09-20',
] as const;

const replaceDemoIdentity = (
  value: string,
  prayerPrefix: string,
  prayerNeedPrefix: string,
): string =>
  value
    .replaceAll(PRAYER_V2_DEMO_PREFIX, prayerPrefix)
    .replaceAll(PRAYER_V2_DEMO_NEED_PREFIX, prayerNeedPrefix);

const redateAndNamespace = (
  value: unknown,
  date: string,
  prayerPrefix: string,
  prayerNeedPrefix: string,
): unknown => {
  if (typeof value === 'string') {
    const dated = value.match(/^\d{4}-\d{2}-\d{2}(.*)$/);
    return replaceDemoIdentity(
      dated ? `${date}${dated[1]}` : value,
      prayerPrefix,
      prayerNeedPrefix,
    );
  }
  if (Array.isArray(value)) {
    return value.map(item =>
      redateAndNamespace(item, date, prayerPrefix, prayerNeedPrefix),
    );
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        replaceDemoIdentity(key, prayerPrefix, prayerNeedPrefix),
        redateAndNamespace(item, date, prayerPrefix, prayerNeedPrefix),
      ]),
    );
  }
  return value;
};

/**
 * Reuses every Prayer V2 demo record while placing each logical journey on
 * September 14–20. September 21 remains the Review QA reference day.
 */
export const buildWeeklyReviewQAPrayerFixtures = (
  scope: ReviewQASeedScope = {},
): PrayerV2DemoFixture[] => {
  const namespace = scope.namespace ?? 'weekly';
  const prayerPrefix = `${REVIEW_QA_PREFIX}${namespace}:prayer-v2:`;
  const prayerNeedPrefix = `${prayerPrefix}need:`;
  const dates = scope.dates ?? WEEK_DATES;
  const fixtures = buildPrayerV2DemoFixtures(reviewQAReferenceDate());
  const journeyDates = new Map<string, string>();

  return fixtures.map(fixture => {
    const journeyId =
      fixture.metadata?.prayer_session_id ||
      fixture.metadata?.original_request_id ||
      fixture.id;
    if (!journeyDates.has(journeyId)) {
      journeyDates.set(journeyId, dates[journeyDates.size % dates.length]);
    }
    return redateAndNamespace(
      fixture,
      journeyDates.get(journeyId)!,
      prayerPrefix,
      prayerNeedPrefix,
    ) as PrayerV2DemoFixture;
  });
};

const addToIndex = async (key: string, id: string): Promise<void> => {
  let values: string[] = [];
  try {
    values = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
  } catch {}
  if (!values.includes(id)) {
    await AsyncStorage.setItem(key, JSON.stringify([...values, id]));
  }
};

/** Seeds the complete Prayer V2 demo library into the standard Weekly Review QA dataset. */
export const seedWeeklyPrayers = async (
  manifest: ReviewQASeedManifest,
  scope: ReviewQASeedScope = {},
): Promise<void> => {
  const namespace = scope.namespace ?? 'weekly';
  const prayerPrefix = `${REVIEW_QA_PREFIX}${namespace}:prayer-v2:`;
  const fixtures = buildWeeklyReviewQAPrayerFixtures(scope);
  for (const fixture of fixtures) {
    const canonical: Partial<PrayerV2DemoFixture> = {...fixture};
    delete canonical.demoLabel;
    delete canonical.expectedToday;
    delete canonical.expectedReview;
    const key = `prayer_local:${fixture.selected_date}:${fixture.id}`;
    const indexKey = `prayer_local_index:${fixture.selected_date}`;
    if (!manifest.keys.includes(key)) {
      manifest.keys.push(key);
    }
    await AsyncStorage.setItem(key, JSON.stringify(canonical));
    await addToIndex(indexKey, fixture.id);
  }

  const biblePrayer = fixtures.find(
    item => item.id === `${prayerPrefix}bible-study`,
  );
  if (biblePrayer) {
    const sessionId = `${prayerPrefix}bible-study-session`;
    const key = `bible_study_session:${sessionId}`;
    if (!manifest.keys.includes(key)) {
      manifest.keys.push(key);
    }
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        id: sessionId,
        selected_date: biblePrayer.selected_date,
        passage: {
          reference: 'James 1:2–8',
          book: 'James',
          chapter: 1,
          verseStart: 2,
          verseEnd: 8,
        },
        current_stage: 'saved',
        current_step: 'respond',
        completed_steps: [
          'passage',
          'read',
          'observe',
          'understand',
          'respond',
        ],
        prayer_ref: {
          domain: 'prayer',
          content_type: 'prayer',
          local_id: biblePrayer.id,
        },
        completed: true,
        started_at: biblePrayer.created_at,
        updated_at: biblePrayer.updated_at,
        completed_at: biblePrayer.updated_at,
        version: 1,
      }),
    );
  }
};

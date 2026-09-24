import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getReviewCapture,
  type ReviewCapture,
} from '../../services/reviewCaptureService';
import {
  deleteLocalReview,
  getLocalReviewForPeriod,
  type LocalReviewEntry,
} from '../../storage/reviewStorage';
import {
  DEFAULT_REVIEW_SETTINGS,
  type ReviewSettings,
} from '../../storage/reviewSettingsStorage';
import type {ReviewEligibilityOptions} from '../../services/reviewEligibilityService';
import {
  REVIEW_QA_PREFIX,
  getReviewQAScenario,
  type ReviewQAScenario,
} from './reviewQAFixtures';
import {seedWeeklyMorningFlow} from './reviewQAWeeklyMorningData';
import {seedWeeklyEveningFlow} from './reviewQAWeeklyEveningData';
import {seedWeeklyHeartJournal} from './reviewQAWeeklyHeartJournalData';
import {seedWeeklyGuidedReflections} from './reviewQAWeeklyGuidedReflectionData';
import {seedWeeklyPrayers} from './reviewQAWeeklyPrayerData';
import {seedWeeklyScriptureNotes} from './reviewQAWeeklyScriptureNoteData';
import {
  MONTHLY_QA_WEEKLY_PERIODS,
  seedMonthlyReviewData,
} from './reviewQAMonthlyData';
import {DAILY_SCRIPTURE_SEQUENCE_OVERRIDE_KEY} from '../../services/dailyScriptureSequence';
import {
  REVIEW_QA_PREVIOUS_WEEK_DATES,
  reviewQAPreviousWeeklyPeriodEndDate,
} from './reviewQAClock';
import {seedReviewQASessionNotes} from './reviewQASessionNoteData';
import {seedReviewQABibleStudies} from './reviewQABibleStudyData';

const MANIFEST = `${REVIEW_QA_PREFIX}manifest`;
const REVIEW_PERIODS = `${REVIEW_QA_PREFIX}periods`;
const WEEKLY_DATASET_VERSION =
  'weekly-two-complete-weeks-prayer-v2-scripture-notes-v11';
const MONTHLY_DATASET_VERSION = 'monthly-full-august-v4-testimony';
const DATASET_VERSIONS: Record<ReviewQAScenario, string> = {
  weekly: WEEKLY_DATASET_VERSION,
  monthly: MONTHLY_DATASET_VERSION,
};

type Manifest = {
  keys: string[];
  protectedReviewIds: string[];
  periods: Array<{type: any; start: string; end: string}>;
  restores?: Array<{key: string; value: string | null}>;
  hiddenReviews?: LocalReviewEntry[];
  scenarioId?: ReviewQAScenario;
  referenceDate?: string;
  historyStart?: string;
  datasetVersion?: string;
};

export type ActiveReviewQAContext = {
  scenarioId: ReviewQAScenario;
  referenceDate: string;
  historyStart: string;
};

const addIndex = async (key: string, recordId: string) => {
  const raw = await AsyncStorage.getItem(key);
  let values: string[] = [];
  try {
    values = JSON.parse(raw || '[]');
  } catch {}
  if (!values.includes(recordId)) {
    await AsyncStorage.setItem(key, JSON.stringify([...values, recordId]));
  }
};

const removeQAFromIndexes = async () => {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    key =>
      key.startsWith('journal_local_index:') ||
      key.startsWith('reflection_local_index:') ||
      key.startsWith('prayer_local_index:') ||
      key.startsWith('review_local_index:'),
  );
  for (const key of keys) {
    try {
      const values = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
      if (Array.isArray(values)) {
        const kept = values.filter(
          value =>
            typeof value !== 'string' || !value.startsWith(REVIEW_QA_PREFIX),
        );
        if (kept.length !== values.length) {
          await AsyncStorage.setItem(key, JSON.stringify(kept));
        }
      }
    } catch {}
  }
};

const temporarilyHideReview = async (
  manifest: Manifest,
  review: LocalReviewEntry,
): Promise<void> => {
  manifest.hiddenReviews = manifest.hiddenReviews || [];
  manifest.hiddenReviews.push(review);
  await AsyncStorage.setItem(MANIFEST, JSON.stringify(manifest));
  await deleteLocalReview(review.type, review.id);
};

/** Removes only development Review QA records and restores any displaced real records. */
export const clearReviewQAData = async (): Promise<number> => {
  if (!__DEV__) {
    throw new Error('Review QA is development-only.');
  }
  const raw = await AsyncStorage.getItem(MANIFEST);
  let manifest: Manifest = {
    keys: [],
    protectedReviewIds: [],
    periods: [],
    restores: [],
    hiddenReviews: [],
  };
  try {
    manifest = JSON.parse(raw || '{}');
  } catch {}

  const discovered = (await AsyncStorage.getAllKeys()).filter(key =>
    key.includes(REVIEW_QA_PREFIX),
  );
  const qaKeys = [
    ...new Set([
      ...(manifest.keys || []),
      ...discovered,
      MANIFEST,
      REVIEW_PERIODS,
    ]),
  ];
  let removed = qaKeys.filter(
    key => key !== MANIFEST && key !== REVIEW_PERIODS,
  ).length;
  await AsyncStorage.multiRemove(qaKeys);

  for (const period of manifest.periods || []) {
    const review = await getLocalReviewForPeriod(
      period.type,
      period.start,
      period.end,
    );
    if (review && !manifest.protectedReviewIds.includes(review.id)) {
      await deleteLocalReview(review.type, review.id);
      removed += 1;
    }
  }
  for (const restore of manifest.restores || []) {
    if (restore.value === null) {
      await AsyncStorage.removeItem(restore.key);
    } else {
      await AsyncStorage.setItem(restore.key, restore.value);
    }
  }
  for (const hidden of manifest.hiddenReviews || []) {
    await AsyncStorage.setItem(
      `review_local:${hidden.type}:${hidden.id}`,
      JSON.stringify(hidden),
    );
    await addIndex(`review_local_index:${hidden.type}`, hidden.id);
  }
  await removeQAFromIndexes();
  return removed;
};

export const getActiveReviewQAContext =
  async (): Promise<ActiveReviewQAContext | null> => {
    if (!__DEV__) {
      return null;
    }
    try {
      const manifest = JSON.parse(
        (await AsyncStorage.getItem(MANIFEST)) || '{}',
      ) as Manifest;
      // Old manifests may still point at the removed seeded dataset. Purge them
      // automatically when Today next checks QA context.
      const expectedVersion = manifest.scenarioId
        ? DATASET_VERSIONS[manifest.scenarioId]
        : undefined;
      if (
        manifest.scenarioId &&
        (!expectedVersion || manifest.datasetVersion !== expectedVersion)
      ) {
        await clearReviewQAData();
        return null;
      }
      if (
        !manifest.scenarioId ||
        !manifest.referenceDate ||
        !manifest.historyStart
      ) {
        return null;
      }
      await AsyncStorage.setItem(
        DAILY_SCRIPTURE_SEQUENCE_OVERRIDE_KEY,
        manifest.historyStart,
      );
      return {
        scenarioId: manifest.scenarioId,
        referenceDate: manifest.referenceDate,
        historyStart: manifest.historyStart,
      };
    } catch {
      return null;
    }
  };

export const getReviewQAEligibilityOptions = (
  context: ActiveReviewQAContext,
): ReviewEligibilityOptions => {
  const settings: ReviewSettings = {
    ...DEFAULT_REVIEW_SETTINGS,
    weekEndsOn: 0,
    enabledCadences: {
      weekly: context.scenarioId === 'weekly',
      monthly: context.scenarioId === 'monthly',
      quarterly: false,
      year_end: false,
      begin_year: false,
    },
  };
  return {
    settingsOverride: settings,
    historyStartOverride: context.historyStart,
  };
};

/**
 * Builds an isolated Review QA period using the same storage read paths as production.
 */
export const loadReviewQAScenario = async (scenarioId: ReviewQAScenario) => {
  if (!__DEV__) {
    throw new Error('Review QA is development-only.');
  }
  await clearReviewQAData();
  const scenario = getReviewQAScenario(scenarioId);
  const existing = await getLocalReviewForPeriod(
    scenario.type,
    scenario.period.periodStart,
    scenario.period.periodEnd,
  );
  const historyStart =
    scenarioId === 'weekly'
      ? REVIEW_QA_PREVIOUS_WEEK_DATES[0]
      : scenario.period.periodStart;
  const manifest: Manifest = {
    keys: [],
    protectedReviewIds: [],
    periods: [],
    restores: [],
    hiddenReviews: [],
    scenarioId,
    referenceDate: scenario.referenceDate,
    historyStart,
    datasetVersion: DATASET_VERSIONS[scenarioId],
  };
  if (existing) {
    await temporarilyHideReview(manifest, existing);
  }
  manifest.restores = manifest.restores || [];
  const seedManifest = {
    keys: manifest.keys,
    restores: manifest.restores,
  };
  if (scenarioId === 'weekly') {
    const previousWeekScope = {
      dates: REVIEW_QA_PREVIOUS_WEEK_DATES,
      namespace: 'weekly-prior',
      referenceDate: reviewQAPreviousWeeklyPeriodEndDate(),
    };
    await seedWeeklyMorningFlow(seedManifest, previousWeekScope);
    await seedWeeklyEveningFlow(seedManifest, previousWeekScope);
    await seedWeeklyHeartJournal(seedManifest, previousWeekScope);
    await seedWeeklyGuidedReflections(seedManifest, previousWeekScope);
    await seedWeeklyPrayers(seedManifest, previousWeekScope);
    await seedWeeklyScriptureNotes(seedManifest, previousWeekScope);

    await seedWeeklyMorningFlow({
      keys: manifest.keys,
      restores: manifest.restores,
    });
    await seedWeeklyEveningFlow({
      keys: manifest.keys,
      restores: manifest.restores,
    });
    await seedWeeklyHeartJournal({
      keys: manifest.keys,
      restores: manifest.restores,
    });
    await seedWeeklyGuidedReflections({
      keys: manifest.keys,
      restores: manifest.restores,
    });
    await seedWeeklyPrayers({keys: manifest.keys, restores: manifest.restores});
    await seedWeeklyScriptureNotes({
      keys: manifest.keys,
      restores: manifest.restores,
    });
  } else {
    for (const period of MONTHLY_QA_WEEKLY_PERIODS) {
      const weeklyReview = await getLocalReviewForPeriod(
        'weekly',
        period.periodStart,
        period.periodEnd,
      );
      if (weeklyReview) {
        await temporarilyHideReview(manifest, weeklyReview);
      }
      manifest.periods.push({
        type: 'weekly',
        start: period.periodStart,
        end: period.periodEnd,
      });
    }
    await seedMonthlyReviewData({
      keys: manifest.keys,
      restores: manifest.restores,
    });
  }
  manifest.keys.push(DAILY_SCRIPTURE_SEQUENCE_OVERRIDE_KEY);
  await AsyncStorage.setItem(
    DAILY_SCRIPTURE_SEQUENCE_OVERRIDE_KEY,
    historyStart,
  );
  await AsyncStorage.setItem(MANIFEST, JSON.stringify(manifest));
  await AsyncStorage.setItem(REVIEW_PERIODS, JSON.stringify([]));

  const capture: ReviewCapture = await getReviewCapture(
    scenario.period.periodStart,
    scenario.period.periodEnd,
    scenario.type,
  );
  return {scenario, capture, review: null};
};

/**
 * Loads the normal rich scenario plus the optional Session Notes stress data.
 * Kept separate so the baseline Review QA scenarios remain stable.
 */
export const loadReviewQAScenarioWithSessionNotes = async (
  scenarioId: ReviewQAScenario,
) => {
  const result = await loadReviewQAScenario(scenarioId);
  const rawManifest = await AsyncStorage.getItem(MANIFEST);
  if (!rawManifest) {
    throw new Error('Review QA manifest was not created.');
  }
  const manifest = JSON.parse(rawManifest) as Manifest;
  manifest.restores = manifest.restores || [];
  const sessionNoteCount = await seedReviewQASessionNotes(
    {keys: manifest.keys, restores: manifest.restores},
    scenarioId,
  );
  await AsyncStorage.setItem(MANIFEST, JSON.stringify(manifest));

  const capture = await getReviewCapture(
    result.scenario.period.periodStart,
    result.scenario.period.periodEnd,
    result.scenario.type,
  );
  return {...result, capture, sessionNoteCount};
};

/** Loads the normal rich scenario plus complete Bible Studies for its full period. */
export const loadReviewQAScenarioWithBibleStudies = async (
  scenarioId: ReviewQAScenario,
) => {
  const result = await loadReviewQAScenario(scenarioId);
  const rawManifest = await AsyncStorage.getItem(MANIFEST);
  if (!rawManifest) {
    throw new Error('Review QA manifest was not created.');
  }
  const manifest = JSON.parse(rawManifest) as Manifest;
  manifest.restores = manifest.restores || [];
  const bibleStudyCount = await seedReviewQABibleStudies(
    {keys: manifest.keys, restores: manifest.restores},
    scenarioId,
  );
  await AsyncStorage.setItem(MANIFEST, JSON.stringify(manifest));

  const capture = await getReviewCapture(
    result.scenario.period.periodStart,
    result.scenario.period.periodEnd,
    result.scenario.type,
  );
  return {...result, capture, bibleStudyCount};
};

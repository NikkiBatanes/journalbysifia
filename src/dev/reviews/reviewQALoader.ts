import AsyncStorage from '@react-native-async-storage/async-storage';
import {getReviewCapture, type ReviewCapture} from '../../services/reviewCaptureService';
import {
  deleteLocalReview,
  getLocalReviewForPeriod,
  type LocalReviewEntry,
} from '../../storage/reviewStorage';
import {DEFAULT_REVIEW_SETTINGS, type ReviewSettings} from '../../storage/reviewSettingsStorage';
import type {ReviewEligibilityOptions} from '../../services/reviewEligibilityService';
import {REVIEW_QA_PREFIX, getReviewQAScenario, type ReviewQAScenario} from './reviewQAFixtures';
import {seedWeeklyMorningFlow} from './reviewQAWeeklyMorningData';
import {seedWeeklyEveningFlow} from './reviewQAWeeklyEveningData';
import {seedWeeklyHeartJournal} from './reviewQAWeeklyHeartJournalData';
import {seedWeeklyGuidedReflections} from './reviewQAWeeklyGuidedReflectionData';
import {DAILY_SCRIPTURE_SEQUENCE_OVERRIDE_KEY} from '../../services/dailyScriptureSequence';

const MANIFEST = `${REVIEW_QA_PREFIX}manifest`;
const REVIEW_PERIODS = `${REVIEW_QA_PREFIX}periods`;
const WEEKLY_DATASET_VERSION = 'weekly-routines-heart-journal-guided-v7';

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
  try {values = JSON.parse(raw || '[]');} catch {}
  if (!values.includes(recordId)) {
    await AsyncStorage.setItem(key, JSON.stringify([...values, recordId]));
  }
};

const removeQAFromIndexes = async () => {
  const keys = (await AsyncStorage.getAllKeys()).filter(key =>
    key.startsWith('journal_local_index:')
    || key.startsWith('reflection_local_index:')
    || key.startsWith('prayer_local_index:')
    || key.startsWith('review_local_index:'),
  );
  for (const key of keys) {
    try {
      const values = JSON.parse(await AsyncStorage.getItem(key) || '[]');
      if (Array.isArray(values)) {
        const kept = values.filter(value =>
          typeof value !== 'string' || !value.startsWith(REVIEW_QA_PREFIX),
        );
        if (kept.length !== values.length) {
          await AsyncStorage.setItem(key, JSON.stringify(kept));
        }
      }
    } catch {}
  }
};

const temporarilyHideReview = async (manifest: Manifest, review: LocalReviewEntry): Promise<void> => {
  manifest.hiddenReviews = manifest.hiddenReviews || [];
  manifest.hiddenReviews.push(review);
  await AsyncStorage.setItem(MANIFEST, JSON.stringify(manifest));
  await deleteLocalReview(review.type, review.id);
};

/** Removes only development Review QA records and restores any displaced real records. */
export const clearReviewQAData = async (): Promise<number> => {
  if (!__DEV__) {throw new Error('Review QA is development-only.');}
  const raw = await AsyncStorage.getItem(MANIFEST);
  let manifest: Manifest = {keys: [], protectedReviewIds: [], periods: [], restores: [], hiddenReviews: []};
  try {manifest = JSON.parse(raw || '{}');} catch {}

  const discovered = (await AsyncStorage.getAllKeys()).filter(key => key.includes(REVIEW_QA_PREFIX));
  const qaKeys = [...new Set([...(manifest.keys || []), ...discovered, MANIFEST, REVIEW_PERIODS])];
  let removed = qaKeys.filter(key => key !== MANIFEST && key !== REVIEW_PERIODS).length;
  await AsyncStorage.multiRemove(qaKeys);

  for (const period of manifest.periods || []) {
    const review = await getLocalReviewForPeriod(period.type, period.start, period.end);
    if (review && !manifest.protectedReviewIds.includes(review.id)) {
      await deleteLocalReview(review.type, review.id);
      removed += 1;
    }
  }
  for (const restore of manifest.restores || []) {
    if (restore.value === null) {await AsyncStorage.removeItem(restore.key);}
    else {await AsyncStorage.setItem(restore.key, restore.value);}
  }
  for (const hidden of manifest.hiddenReviews || []) {
    await AsyncStorage.setItem(`review_local:${hidden.type}:${hidden.id}`, JSON.stringify(hidden));
    await addIndex(`review_local_index:${hidden.type}`, hidden.id);
  }
  await removeQAFromIndexes();
  return removed;
};

export const getActiveReviewQAContext = async (): Promise<ActiveReviewQAContext | null> => {
  if (!__DEV__) {return null;}
  try {
    const manifest = JSON.parse(await AsyncStorage.getItem(MANIFEST) || '{}') as Manifest;
    // Old manifests may still point at the removed seeded dataset. Purge them
    // automatically when Today next checks QA context.
    if (manifest.scenarioId && (
      manifest.scenarioId !== 'weekly'
      || manifest.datasetVersion !== WEEKLY_DATASET_VERSION
    )) {
      await clearReviewQAData();
      return null;
    }
    if (!manifest.scenarioId || !manifest.referenceDate || !manifest.historyStart) {return null;}
    await AsyncStorage.setItem(DAILY_SCRIPTURE_SEQUENCE_OVERRIDE_KEY, manifest.historyStart);
    return {
      scenarioId: manifest.scenarioId,
      referenceDate: manifest.referenceDate,
      historyStart: manifest.historyStart,
    };
  } catch {
    return null;
  }
};

export const getReviewQAEligibilityOptions = (context: ActiveReviewQAContext): ReviewEligibilityOptions => {
  const settings: ReviewSettings = {
    ...DEFAULT_REVIEW_SETTINGS,
    weekEndsOn: 0,
    enabledCadences: {
      weekly: true,
      monthly: false,
      quarterly: false,
      year_end: false,
      begin_year: false,
    },
  };
  return {settingsOverride: settings, historyStartOverride: context.historyStart};
};

/**
 * Builds the single Monday-start Weekly QA period for September 14–20.
 */
export const loadReviewQAScenario = async (scenarioId: ReviewQAScenario) => {
  if (!__DEV__) {throw new Error('Review QA is development-only.');}
  await clearReviewQAData();
  const scenario = getReviewQAScenario(scenarioId);
  const existing = await getLocalReviewForPeriod(
    scenario.type,
    scenario.period.periodStart,
    scenario.period.periodEnd,
  );
  const manifest: Manifest = {
    keys: [],
    protectedReviewIds: [],
    periods: [],
    restores: [],
    hiddenReviews: [],
    scenarioId,
    referenceDate: scenario.referenceDate,
    historyStart: scenario.period.periodStart,
    datasetVersion: WEEKLY_DATASET_VERSION,
  };
  if (existing) {await temporarilyHideReview(manifest, existing);}
  manifest.restores = manifest.restores || [];
  await seedWeeklyMorningFlow({keys: manifest.keys, restores: manifest.restores});
  await seedWeeklyEveningFlow({keys: manifest.keys, restores: manifest.restores});
  await seedWeeklyHeartJournal({keys: manifest.keys, restores: manifest.restores});
  await seedWeeklyGuidedReflections({keys: manifest.keys, restores: manifest.restores});
  manifest.keys.push(DAILY_SCRIPTURE_SEQUENCE_OVERRIDE_KEY);
  await AsyncStorage.setItem(DAILY_SCRIPTURE_SEQUENCE_OVERRIDE_KEY, scenario.period.periodStart);
  await AsyncStorage.setItem(MANIFEST, JSON.stringify(manifest));
  await AsyncStorage.setItem(REVIEW_PERIODS, JSON.stringify([]));

  const capture: ReviewCapture = await getReviewCapture(
    scenario.period.periodStart,
    scenario.period.periodEnd,
    scenario.type,
  );
  return {scenario, capture, review: null};
};

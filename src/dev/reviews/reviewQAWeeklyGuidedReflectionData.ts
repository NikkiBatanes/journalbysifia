import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildGuidedReflectionDemoFixtures,
  GUIDED_REFLECTION_DEMO_PREFIX,
} from '../guidedReflectionDemoFixtures';
import {REVIEW_QA_PREFIX} from './reviewQAFixtures';
import type {
  ReviewQASeedManifest,
  ReviewQASeedScope,
} from './reviewQAWeeklyMorningData';

const addToIndex = async (key: string, id: string): Promise<void> => {
  let values: string[] = [];
  try {
    values = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
  } catch {}
  if (!values.includes(id)) {
    await AsyncStorage.setItem(key, JSON.stringify([...values, id]));
  }
};

/** Adds the full structured Guided Reflection set to the standard Weekly Review QA week. */
export const seedWeeklyGuidedReflections = async (
  manifest: ReviewQASeedManifest,
  scope: ReviewQASeedScope = {},
): Promise<void> => {
  const namespace = scope.namespace ?? 'weekly';
  for (const fixture of buildGuidedReflectionDemoFixtures(
    scope.referenceDate,
  )) {
    const suffix = fixture.id.slice(GUIDED_REFLECTION_DEMO_PREFIX.length);
    const id = `${REVIEW_QA_PREFIX}${namespace}:guided-reflection:${suffix}`;
    const key = `reflection_local:guided:${fixture.selected_date}:${id}`;
    const indexKey = `reflection_local_index:guided:${fixture.selected_date}`;
    const entry: Partial<typeof fixture> = {...fixture};
    delete entry.demoLabel;

    if (!manifest.keys.includes(key)) {
      manifest.keys.push(key);
    }
    await AsyncStorage.setItem(key, JSON.stringify({...entry, id}));
    await addToIndex(indexKey, id);
  }
};

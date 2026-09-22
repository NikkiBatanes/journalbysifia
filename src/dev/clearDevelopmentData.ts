import AsyncStorage from '@react-native-async-storage/async-storage';

const EMPTY_START_MARKER = 'journal:development-empty-start:v1';

// Local content only. Account, preferences, onboarding, and authentication
// storage intentionally remain untouched.
const CONTENT_PREFIXES = [
  'journal_local:',
  'journal_local_index:',
  'journal_local_singleton:',
  'reflection_local:',
  'reflection_local_index:',
  'prayer_local:',
  'prayer_local_index:',
  'prayer_draft:',
  'prayer-intelligence:',
  'routine_state:',
  'review_local:',
  'review_local_index:',
  'dev-prayer-v2:',
  'dev-review-v2:',
  'journal_preview_data:',
] as const;

const CONTENT_KEYS = new Set([
  'journal_preview_data:v1',
]);

const isContentKey = (key: string): boolean =>
  CONTENT_KEYS.has(key) || CONTENT_PREFIXES.some(prefix => key.startsWith(prefix));

/**
 * One-time development migration to remove every prior local demo/QA content
 * record. It runs once so content created after this blank start is retained.
 */
export const clearJournalDevelopmentDataOnce = async (): Promise<number> => {
  if (!__DEV__) {return 0;}
  if (await AsyncStorage.getItem(EMPTY_START_MARKER)) {return 0;}

  const keys = await AsyncStorage.getAllKeys();
  const contentKeys = keys.filter(isContentKey);
  if (contentKeys.length > 0) {
    await AsyncStorage.multiRemove(contentKeys);
  }
  await AsyncStorage.setItem(EMPTY_START_MARKER, new Date().toISOString());
  return contentKeys.length;
};


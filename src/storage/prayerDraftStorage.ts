import AsyncStorage from '@react-native-async-storage/async-storage';

import { safeJsonParse } from '../utils/safeJsonParse';

export type PrayerDraftType = 'acts' | 'open' | 'pray-for-someone' | 'prayer-request' | 'prayer-editor';

export interface PrayerDraft {
  key: string;
  type: PrayerDraftType;
  selectedDate: string;
  updatedAt: string;
  data: Record<string, any>;
}

const PREFIX = 'prayer_draft:';

export const getPrayerDraftKey = (type: PrayerDraftType, selectedDate: string, contextId?: string) =>
  `${PREFIX}${type}:${selectedDate}:${contextId || 'default'}`;

export const savePrayerDraft = async (draft: Omit<PrayerDraft, 'updatedAt'>) => {
  const value: PrayerDraft = { ...draft, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(draft.key, JSON.stringify(value));
  return value;
};

export const getPrayerDraft = async (key: string) => {
  const raw = await AsyncStorage.getItem(key);
  return safeJsonParse<PrayerDraft>(raw, { fallback: null });
};

export const clearPrayerDraft = async (key: string) => {
  await AsyncStorage.removeItem(key);
};

export const getLatestPrayerDraft = async () => {
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
  if (keys.length === 0) {return null;}
  const values = await AsyncStorage.multiGet(keys);
  const drafts = values
    .map(([, raw]) => safeJsonParse<PrayerDraft>(raw, { fallback: null }))
    .filter((draft): draft is PrayerDraft => !!draft);
  return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
};

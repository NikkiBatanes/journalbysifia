import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeJsonParse } from '../utils/safeJsonParse';
import { type ReviewType } from './reviewStorage';

const REVIEW_SETTINGS_KEY = 'review_settings_v1';

export interface ReviewSettings {
  weekEndsOn: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  reminderTime: string; // HH:MM
  enabledCadences: Record<ReviewType, boolean>;
}

export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = {
  weekEndsOn: 0, // Sunday
  reminderTime: '19:00',
  enabledCadences: {
    weekly: true,
    monthly: true,
    quarterly: true,
    year_end: true,
    begin_year: true,
  },
};

export const getReviewSettings = async (): Promise<ReviewSettings> => {
  const raw = await AsyncStorage.getItem(REVIEW_SETTINGS_KEY);
  if (!raw) {
    return DEFAULT_REVIEW_SETTINGS;
  }
  const parsed = safeJsonParse<Partial<ReviewSettings>>(raw, {fallback: {}});
  if (!parsed) {
    return DEFAULT_REVIEW_SETTINGS;
  }
  return {
    ...DEFAULT_REVIEW_SETTINGS,
    ...parsed,
    enabledCadences: {
      ...DEFAULT_REVIEW_SETTINGS.enabledCadences,
      ...parsed?.enabledCadences,
    },
  };
};

export const setReviewSettings = async (
  settings: ReviewSettings,
): Promise<void> => {
  await AsyncStorage.setItem(REVIEW_SETTINGS_KEY, JSON.stringify(settings));
};

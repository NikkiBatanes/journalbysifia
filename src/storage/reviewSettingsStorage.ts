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

export const weekEndFromWeekStart = (weekStart: string = 'monday'): number => {
  const index = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(weekStart);
  return ((index < 0 ? 1 : index) + 6) % 7;
};

export const getReviewSettings = async (weekStart?: string): Promise<ReviewSettings> => {
  const effectiveWeekStart = weekStart ?? await AsyncStorage.getItem('journal:review-week-start') ?? 'monday';
  const weekEndsOn = weekEndFromWeekStart(effectiveWeekStart);
  const raw = await AsyncStorage.getItem(REVIEW_SETTINGS_KEY);
  if (!raw) {
    return { ...DEFAULT_REVIEW_SETTINGS, weekEndsOn };
  }
  const parsed = safeJsonParse<Partial<ReviewSettings>>(raw, {fallback: {}});
  if (!parsed) {
    return { ...DEFAULT_REVIEW_SETTINGS, weekEndsOn };
  }
  return {
    ...DEFAULT_REVIEW_SETTINGS,
    ...parsed,
    weekEndsOn,
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

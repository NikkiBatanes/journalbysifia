import AsyncStorage from '@react-native-async-storage/async-storage';

// Journal by siFia first-launch state.
// Stored locally only — intentionally separate from the siFia
// onboardingService / onboarding_progress Supabase tables and
// independent of authentication.
export const JOURNAL_ONBOARDING_COMPLETED_KEY = 'journal:onboarding:completed:v1';
export const JOURNAL_ONBOARDING_SETUP_KEY = 'journal:onboarding:setup:v1';

export type JournalWeekStart =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';
export type JournalFaithGoal =
  | 'closer_to_god'
  | 'consistent_scripture'
  | 'journal_and_plan'
  | 'process_life'
  | 'remember_growth';
export type JournalRhythmBarrier =
  | 'where_to_begin'
  | 'short_on_time'
  | 'hard_to_stay_consistent'
  | 'blank_page';

export interface JournalOnboardingSetup {
  firstName: string;
  lastName: string;
  birthDate: string;
  weekStart: JournalWeekStart;
  bibleVersion: string;
  faithGoal: JournalFaithGoal | null;
  rhythmBarrier: JournalRhythmBarrier | null;
}

const DEFAULT_SETUP: JournalOnboardingSetup = {
  firstName: '',
  lastName: '',
  birthDate: '',
  weekStart: 'monday',
  bibleVersion: 'NASB',
  faithGoal: null,
  rhythmBarrier: null,
};

const FAITH_GOALS: JournalFaithGoal[] = [
  'closer_to_god',
  'consistent_scripture',
  'journal_and_plan',
  'process_life',
  'remember_growth',
];
const RHYTHM_BARRIERS: JournalRhythmBarrier[] = [
  'where_to_begin',
  'short_on_time',
  'hard_to_stay_consistent',
  'blank_page',
];
const WEEK_START_DAYS: JournalWeekStart[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export const isJournalOnboardingComplete = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(JOURNAL_ONBOARDING_COMPLETED_KEY)) === 'true';
  } catch {
    return false;
  }
};

export const markJournalOnboardingComplete = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(JOURNAL_ONBOARDING_COMPLETED_KEY, 'true');
  } catch {
    // Non-fatal: worst case the onboarding shows again next launch.
  }
};

export const getJournalOnboardingSetup = async (): Promise<JournalOnboardingSetup> => {
  try {
    const raw = await AsyncStorage.getItem(JOURNAL_ONBOARDING_SETUP_KEY);
    if (!raw) {
      return DEFAULT_SETUP;
    }

    const parsed = JSON.parse(raw) as Partial<JournalOnboardingSetup>;
    const birthDate = typeof parsed.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.birthDate)
      ? parsed.birthDate
      : '';

    return {
      firstName: typeof parsed.firstName === 'string' ? parsed.firstName.trim() : '',
      lastName: typeof parsed.lastName === 'string' ? parsed.lastName.trim() : '',
      birthDate,
      weekStart: WEEK_START_DAYS.includes(parsed.weekStart as JournalWeekStart)
        ? parsed.weekStart as JournalWeekStart
        : 'monday',
      bibleVersion: typeof parsed.bibleVersion === 'string' && parsed.bibleVersion.trim()
        ? parsed.bibleVersion.trim().toUpperCase()
        : DEFAULT_SETUP.bibleVersion,
      faithGoal: FAITH_GOALS.includes(parsed.faithGoal as JournalFaithGoal)
        ? parsed.faithGoal as JournalFaithGoal
        : null,
      rhythmBarrier: RHYTHM_BARRIERS.includes(parsed.rhythmBarrier as JournalRhythmBarrier)
        ? parsed.rhythmBarrier as JournalRhythmBarrier
        : null,
    };
  } catch {
    return DEFAULT_SETUP;
  }
};

export const saveJournalOnboardingSetup = async (
  setup: JournalOnboardingSetup,
): Promise<void> => {
  const normalized: JournalOnboardingSetup = {
    firstName: setup.firstName.trim(),
    lastName: setup.lastName.trim(),
    birthDate: setup.birthDate,
    weekStart: setup.weekStart,
    bibleVersion: setup.bibleVersion.trim().toUpperCase(),
    faithGoal: setup.faithGoal,
    rhythmBarrier: setup.rhythmBarrier,
  };

  await AsyncStorage.setItem(
    JOURNAL_ONBOARDING_SETUP_KEY,
    JSON.stringify(normalized),
  );
};

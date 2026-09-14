import AsyncStorage from '@react-native-async-storage/async-storage';

// Journal by siFia first-launch state.
// Stored locally only — intentionally separate from the siFia
// onboardingService / onboarding_progress Supabase tables and
// independent of authentication.
export const JOURNAL_ONBOARDING_COMPLETED_KEY = 'journal:onboarding:completed:v1';

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

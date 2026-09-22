import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getJournalOnboardingSetup,
  JOURNAL_ONBOARDING_SETUP_KEY,
  saveJournalOnboardingSetup,
} from '../journalOnboardingState';

describe('journal onboarding setup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns safe defaults when setup has not been saved', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    await expect(getJournalOnboardingSetup()).resolves.toEqual({
      firstName: '',
      lastName: '',
      birthDate: '',
      weekStart: 'monday',
      bibleVersion: 'NASB',
      faithGoal: null,
      rhythmBarrier: null,
    });
  });

  it('normalizes setup before writing it', async () => {
    await saveJournalOnboardingSetup({
      firstName: '  Nikki ',
      lastName: ' Batanes  ',
      birthDate: '1994-06-18',
      weekStart: 'wednesday',
      bibleVersion: 'niv',
      faithGoal: 'journal_and_plan',
      rhythmBarrier: 'short_on_time',
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      JOURNAL_ONBOARDING_SETUP_KEY,
      JSON.stringify({
        firstName: 'Nikki',
        lastName: 'Batanes',
        birthDate: '1994-06-18',
        weekStart: 'wednesday',
        bibleVersion: 'NIV',
        faithGoal: 'journal_and_plan',
        rhythmBarrier: 'short_on_time',
      }),
    );
  });

  it('falls back for malformed or out-of-range saved values', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({
      firstName: '  Grace  ',
      lastName: 42,
      birthDate: 'not-a-date',
      weekStart: 'noday',
      bibleVersion: '',
      faithGoal: 'not_real',
      rhythmBarrier: 'also_not_real',
    }));

    await expect(getJournalOnboardingSetup()).resolves.toEqual({
      firstName: 'Grace',
      lastName: '',
      birthDate: '',
      weekStart: 'monday',
      bibleVersion: 'NASB',
      faithGoal: null,
      rhythmBarrier: null,
    });
  });
});

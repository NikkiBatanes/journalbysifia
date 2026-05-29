import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import InAppReview from 'react-native-in-app-review';
import { openStoreReview, requestReview } from '../reviewPromptService';

jest.mock('react-native-in-app-review', () => ({
  __esModule: true,
  default: {
    isAvailable: jest.fn(),
    RequestInAppReview: jest.fn(),
  },
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockedInAppReview = InAppReview as jest.Mocked<typeof InAppReview>;

function setPlatform(os: 'ios' | 'android'): void {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => os,
  });
}

describe('reviewPromptService', () => {
  let openURLSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform('android');

    openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    mockedAsyncStorage.getItem.mockResolvedValue(null);
    mockedAsyncStorage.setItem.mockResolvedValue();
    mockedInAppReview.isAvailable.mockReturnValue(false);
    mockedInAppReview.RequestInAppReview.mockResolvedValue(true);
  });

  afterEach(() => {
    openURLSpy.mockRestore();
  });

  it('opens the Play Store review page with the native Android package id', async () => {
    await expect(openStoreReview({ triggerSource: 'manual_profile_button' })).resolves.toBe(true);

    expect(Linking.openURL).toHaveBeenCalledWith('market://details?id=app.sifia.com');
  });

  it('falls back to the Play Store web URL when the market URL fails', async () => {
    openURLSpy
      .mockRejectedValueOnce(new Error('No Play Store'))
      .mockResolvedValueOnce(undefined);

    await expect(openStoreReview({ triggerSource: 'manual_profile_button' })).resolves.toBe(true);

    expect(Linking.openURL).toHaveBeenNthCalledWith(1, 'market://details?id=app.sifia.com');
    expect(Linking.openURL).toHaveBeenNthCalledWith(
      2,
      'https://play.google.com/store/apps/details?id=app.sifia.com'
    );
  });

  it('opens the App Store write-review URL on iOS manual review taps', async () => {
    setPlatform('ios');

    await expect(openStoreReview({ triggerSource: 'manual_profile_button' })).resolves.toBe(true);

    expect(Linking.openURL).toHaveBeenCalledWith(
      'itms-apps://itunes.apple.com/app/id6751785713?action=write-review'
    );
  });

  it('uses the automatic in-app review path when available and gated in', async () => {
    mockedInAppReview.isAvailable.mockReturnValue(true);

    await expect(requestReview({ triggerSource: 'playbook_complete' })).resolves.toBe(true);

    expect(mockedInAppReview.RequestInAppReview).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('review:lastPromptAt', expect.any(String));
  });

  it('dedupes overlapping automatic review requests', async () => {
    mockedInAppReview.isAvailable.mockReturnValue(true);

    let finishReviewFlow: (value: boolean) => void = () => {};
    mockedInAppReview.RequestInAppReview.mockImplementation(
      () => new Promise<boolean>((resolve) => {
        finishReviewFlow = resolve;
      })
    );

    const firstRequest = requestReview({ triggerSource: 'devotional_complete' });
    const secondRequest = requestReview({ triggerSource: 'faith_points_devotional_full_completed' });

    await expect(secondRequest).resolves.toBe(false);
    await Promise.resolve();
    expect(mockedInAppReview.RequestInAppReview).toHaveBeenCalledTimes(1);

    finishReviewFlow(true);
    await expect(firstRequest).resolves.toBe(true);
  });

  it('skips automatic prompts when app-level review gating blocks them', async () => {
    mockedAsyncStorage.getItem.mockImplementation(async (key) => {
      if (key === 'review:lastPromptAt') {
        return String(Date.now());
      }
      return null;
    });
    mockedInAppReview.isAvailable.mockReturnValue(true);

    await expect(requestReview({ triggerSource: 'playbook_complete' })).resolves.toBe(false);

    expect(mockedInAppReview.RequestInAppReview).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('falls back to the store review page when in-app review is unavailable', async () => {
    mockedInAppReview.isAvailable.mockReturnValue(false);

    await expect(requestReview({ triggerSource: 'playbook_complete' })).resolves.toBe(true);

    expect(Linking.openURL).toHaveBeenCalledWith('market://details?id=app.sifia.com');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('review:lastPromptAt', expect.any(String));
  });
});

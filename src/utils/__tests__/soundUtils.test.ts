const mockSetCategory = jest.fn();
const mockSetVolume = jest.fn();
const mockRelease = jest.fn();
const mockPlay = jest.fn();
const mockSoundConstructor = jest.fn();
const mockLoadOnce = jest.fn().mockResolvedValue(undefined);
const mockIsSoundsEnabled = jest.fn(() => true);

jest.mock('react-native-sound', () => {
  const Sound = function (fileName: string, bundle: string, onLoad: (error?: Error) => void) {
    mockSoundConstructor(fileName, bundle);
    const instance = {
      setVolume: mockSetVolume,
      release: mockRelease,
      play: mockPlay,
    };
    Promise.resolve().then(() => onLoad());
    return instance;
  } as any;

  Sound.MAIN_BUNDLE = 'main-bundle';
  Sound.setCategory = mockSetCategory;
  return Sound;
});

jest.mock('../../services/experiencePreferences', () => ({
  experiencePreferences: { loadOnce: mockLoadOnce },
  isSoundsEnabled: mockIsSoundsEnabled,
}));

describe('playTodayOpeningSound', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockIsSoundsEnabled.mockReturnValue(true);
    mockLoadOnce.mockResolvedValue(undefined);
    mockPlay.mockImplementation((onComplete: (success: boolean) => void) => onComplete(true));
  });

  it('uses audible playback audio and plays only once per session', async () => {
    const { playTodayOpeningSound } = require('../soundUtils');
    const onPlaybackStart = jest.fn();

    await playTodayOpeningSound(onPlaybackStart);
    await Promise.resolve();
    await playTodayOpeningSound(onPlaybackStart);
    await Promise.resolve();

    expect(mockSetCategory).toHaveBeenCalledWith('Playback', true);
    expect(mockSoundConstructor).toHaveBeenCalledWith('today_opening.mp3', 'main-bundle');
    expect(mockSetVolume).toHaveBeenCalledWith(0.62);
    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(onPlaybackStart).toHaveBeenCalledTimes(1);
  });

  it('does not play when sounds are disabled in the app', async () => {
    mockIsSoundsEnabled.mockReturnValue(false);
    const { playTodayOpeningSound } = require('../soundUtils');

    await playTodayOpeningSound();
    await Promise.resolve();

    expect(mockSetCategory).not.toHaveBeenCalled();
    expect(mockSoundConstructor).not.toHaveBeenCalled();
  });

  it('allows a later retry when playback fails', async () => {
    mockPlay
      .mockImplementationOnce((onComplete: (success: boolean) => void) => onComplete(false))
      .mockImplementationOnce((onComplete: (success: boolean) => void) => onComplete(true));
    const { playTodayOpeningSound } = require('../soundUtils');

    await playTodayOpeningSound();
    await Promise.resolve();
    await playTodayOpeningSound();
    await Promise.resolve();

    expect(mockPlay).toHaveBeenCalledTimes(2);
  });
});

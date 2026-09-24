import Sound from 'react-native-sound';
import { Platform } from 'react-native';
import { experiencePreferences, isSoundsEnabled } from '../services/experiencePreferences';

// Sound file paths and loading logic
const loadSound = (): Sound | null => {
  let soundInstance: Sound | null = null;

  if (Platform.OS === 'android') {
    // First try loading from raw resources
    soundInstance = new Sound('bell', Sound.MAIN_BUNDLE, (error) => {
      if (error) {

        // If raw resource fails, try loading from assets
        soundInstance = new Sound('sounds/bell.mp3', Sound.MAIN_BUNDLE, (loadError) => {
          if (loadError) {

            soundInstance = null;
          }
        });
      }
    });
  } else {
    // iOS - load from main bundle
    soundInstance = new Sound('bell.mp3', Sound.MAIN_BUNDLE, (error) => {
      if (error) {

        soundInstance = null;
      }
    });
  }

  return soundInstance;
};

let sound: Sound | null = null;
let hasPlayedTodayOpening = false;

export const initSound = () => {
  if (!isSoundsEnabled()) { return null; }
  if (sound) {return sound;}

  // Enable audio in silent mode (iOS)
  Sound.setCategory('Playback');

  // Load sound using the appropriate method for the platform
  sound = loadSound();

  // Set volume if sound loaded successfully
  if (sound) {
    sound.setVolume(0.3);
  }

  return sound;
};

export const playSound = () => {
  if (!isSoundsEnabled()) {
    return;
  }
  if (!sound) {
    // Try to initialize sound if not already done
    sound = loadSound();
    if (!sound) {

      return;
    }
  }

  try {
    sound.setCurrentTime(0);
    sound.play((success) => {
      if (!success) {

      }
    });
  } catch (error) {

  }
};

export const releaseSound = () => {
  if (sound) {
    sound.release();
    sound = null;
  }
};

/**
 * Plays the short Today-screen welcome cue at most once per app session.
 * `onPlaybackStart` lets the Today header begin its opening animation on the
 * same frame that audio playback is requested.
 */
export const playTodayOpeningSound = async (onPlaybackStart?: () => void) => {
  if (hasPlayedTodayOpening) { return; }

  await experiencePreferences.loadOnce();
  if (!isSoundsEnabled() || hasPlayedTodayOpening) { return; }
  hasPlayedTodayOpening = true;

  // This is an explicit in-app sound (controlled by the Sounds preference), so
  // keep it audible when an iPhone's silent switch is on. Mixing avoids
  // needlessly interrupting audio the user already has playing.
  Sound.setCategory('Playback', true);
  const fileName = Platform.OS === 'android' ? 'today_opening' : 'today_opening.mp3';
  const openingSound = new Sound(fileName, Sound.MAIN_BUNDLE, (error) => {
    if (error) {
      // Permit another attempt if loading was interrupted during app startup.
      hasPlayedTodayOpening = false;
      openingSound.release();
      return;
    }

    openingSound.setVolume(0.62);
    onPlaybackStart?.();
    openingSound.play((success) => {
      if (!success) {
        // Do not consume the one-per-session cue when the audio session was not
        // ready yet; focusing Today again can retry it.
        hasPlayedTodayOpening = false;
      }
      openingSound.release();
    });
  });
};

/** Plays the brief welcome cue whenever the Gospel experience opens. */
export const playGospelOpeningSound = async () => {
  await experiencePreferences.loadOnce();
  if (!isSoundsEnabled()) { return; }

  Sound.setCategory('Ambient', true);
  const fileName = Platform.OS === 'android' ? 'gospel_opening' : 'gospel_opening.mp3';
  const openingSound = new Sound(fileName, Sound.MAIN_BUNDLE, (error) => {
    if (error) {
      openingSound.release();
      return;
    }

    openingSound.setVolume(0.68);
    openingSound.play(() => openingSound.release());
  });
};

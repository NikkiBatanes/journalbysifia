import Sound from 'react-native-sound';
import { Platform } from 'react-native';
import { isSoundsEnabled } from '../services/experiencePreferences';

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

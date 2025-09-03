import AsyncStorage from '@react-native-async-storage/async-storage';

// Centralized (in-memory + persisted) preferences controlling app haptics & sounds
// Defaults: enabled

const STORAGE_KEYS = {
  haptics: 'prefs:hapticsEnabled',
  sounds: 'prefs:soundsEnabled',
};

class ExperiencePreferences {
  private _hapticsEnabled = true;
  private _soundsEnabled = true;
  private _loaded = false;

  async loadOnce() {
    if (this._loaded) return;
    try {
      const [h, s] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.haptics),
        AsyncStorage.getItem(STORAGE_KEYS.sounds),
      ]);
      if (h !== null) this._hapticsEnabled = h === 'true';
      if (s !== null) this._soundsEnabled = s === 'true';
    } catch {
      // ignore; keep defaults
    } finally {
      this._loaded = true;
    }
  }

  isLoaded() {
    return this._loaded;
  }

  get hapticsEnabled() {
    return this._hapticsEnabled;
  }

  get soundsEnabled() {
    return this._soundsEnabled;
  }

  async setHapticsEnabled(value: boolean) {
    this._hapticsEnabled = !!value;
    try { await AsyncStorage.setItem(STORAGE_KEYS.haptics, String(this._hapticsEnabled)); } catch {}
  }

  async setSoundsEnabled(value: boolean) {
    this._soundsEnabled = !!value;
    try { await AsyncStorage.setItem(STORAGE_KEYS.sounds, String(this._soundsEnabled)); } catch {}
  }
}

export const experiencePreferences = new ExperiencePreferences();

// Convenience getters for synchronous checks in hot paths
export const isHapticsEnabled = () => experiencePreferences.hapticsEnabled;
export const isSoundsEnabled = () => experiencePreferences.soundsEnabled;

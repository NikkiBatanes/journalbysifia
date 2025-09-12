import AsyncStorage from '@react-native-async-storage/async-storage';

// Centralized (in-memory + persisted) preferences controlling app haptics & sounds
// Defaults: enabled

const STORAGE_KEYS = {
  haptics: 'prefs:hapticsEnabled',
  sounds: 'prefs:soundsEnabled',
  showTabLabels: 'prefs:showTabLabelsEnabled',
};

class ExperiencePreferences {
  private _hapticsEnabled = true;
  private _soundsEnabled = true;
  private _loaded = false;
  private _showTabLabelsEnabled = true;
  private _listeners = new Set<() => void>();

  async loadOnce() {
    if (this._loaded) return;
    try {
      const [h, s, l] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.haptics),
        AsyncStorage.getItem(STORAGE_KEYS.sounds),
        AsyncStorage.getItem(STORAGE_KEYS.showTabLabels),
      ]);
      if (h !== null) this._hapticsEnabled = h === 'true';
      if (s !== null) this._soundsEnabled = s === 'true';
      if (l !== null) this._showTabLabelsEnabled = l === 'true';
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

  get showTabLabelsEnabled() {
    return this._showTabLabelsEnabled;
  }

  async setHapticsEnabled(value: boolean) {
    this._hapticsEnabled = !!value;
    try { await AsyncStorage.setItem(STORAGE_KEYS.haptics, String(this._hapticsEnabled)); } catch {}
    this._notify();
  }

  async setSoundsEnabled(value: boolean) {
    this._soundsEnabled = !!value;
    try { await AsyncStorage.setItem(STORAGE_KEYS.sounds, String(this._soundsEnabled)); } catch {}
    this._notify();
  }

  async setShowTabLabelsEnabled(value: boolean) {
    this._showTabLabelsEnabled = !!value;
    try { await AsyncStorage.setItem(STORAGE_KEYS.showTabLabels, String(this._showTabLabelsEnabled)); } catch {}
    this._notify();
  }

  subscribe(listener: () => void) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notify() {
    this._listeners.forEach((fn) => {
      try { fn(); } catch {}
    });
  }
}

export const experiencePreferences = new ExperiencePreferences();

// Convenience getters for synchronous checks in hot paths
export const isHapticsEnabled = () => experiencePreferences.hapticsEnabled;
export const isSoundsEnabled = () => experiencePreferences.soundsEnabled;
export const isShowTabLabelsEnabled = () => experiencePreferences.showTabLabelsEnabled;

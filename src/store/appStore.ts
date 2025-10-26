import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Global app state store
 * Handles app-wide settings, preferences, and UI state
 */

interface AppState {
  // App settings
  isFirstLaunch: boolean;
  appVersion: string;
  lastSyncTime: string | null;

  // UI state
  isOffline: boolean;
  isRefreshing: boolean;
  activeTab: string;

  // User preferences
  theme: 'default';
  notifications: {
    enabled: boolean;
    dailyReminder: boolean;
    reminderTime: string;
    devotionalReminder: boolean;
    prayerReminder: boolean;
  };

  // Sync settings
  autoSync: boolean;
  syncOnWifi: boolean;
  backgroundSync: boolean;
}

interface AppActions {
  // App settings
  setFirstLaunch: (isFirst: boolean) => void;
  setAppVersion: (version: string) => void;
  setLastSyncTime: (time: string) => void;

  // UI state
  setOfflineStatus: (isOffline: boolean) => void;
  setRefreshing: (isRefreshing: boolean) => void;
  setActiveTab: (tab: string) => void;

  // User preferences
  setTheme: (theme: 'default') => void;
  updateNotificationSettings: (settings: Partial<AppState['notifications']>) => void;

  // Sync settings
  setSyncSettings: (settings: Partial<Pick<AppState, 'autoSync' | 'syncOnWifi' | 'backgroundSync'>>) => void;

  // Reset
  resetAppState: () => void;
}

type AppStore = AppState & AppActions;

const initialState: AppState = {
  // App settings
  isFirstLaunch: true,
  appVersion: '1.0.0',
  lastSyncTime: null,

  // UI state
  isOffline: false,
  isRefreshing: false,
  activeTab: 'journal',

  // User preferences
  theme: 'default',
  notifications: {
    enabled: true,
    dailyReminder: true,
    reminderTime: '09:00',
    devotionalReminder: true,
    prayerReminder: true,
  },

  // Sync settings
  autoSync: true,
  syncOnWifi: false,
  backgroundSync: true,
};

export const useAppStore = create<AppStore>()(
  persist(
    immer((set) => ({
      ...initialState,

      // App settings
      setFirstLaunch: (isFirst) => set((state) => {
        state.isFirstLaunch = isFirst;
      }),

      setAppVersion: (version) => set((state) => {
        state.appVersion = version;
      }),

      setLastSyncTime: (time) => set((state) => {
        state.lastSyncTime = time;
      }),

      // UI state
      setOfflineStatus: (isOffline) => set((state) => {
        state.isOffline = isOffline;
      }),

      setRefreshing: (isRefreshing) => set((state) => {
        state.isRefreshing = isRefreshing;
      }),

      setActiveTab: (tab) => set((state) => {
        state.activeTab = tab;
      }),

      // User preferences
      setTheme: () => set((state) => {
        // Only default theme supported
        state.theme = 'default';
      }),

      updateNotificationSettings: (settings) => set((state) => {
        Object.assign(state.notifications, settings);
      }),

      // Sync settings
      setSyncSettings: (settings) => set((state) => {
        Object.assign(state, settings);
      }),

      // Reset
      resetAppState: () => set(() => initialState),
    })),
    {
      name: 'app-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist certain fields
      partialize: (state) => ({
        isFirstLaunch: state.isFirstLaunch,
        appVersion: state.appVersion,
        lastSyncTime: state.lastSyncTime,
        theme: state.theme,
        notifications: state.notifications,
        autoSync: state.autoSync,
        syncOnWifi: state.syncOnWifi,
        backgroundSync: state.backgroundSync,
      }),
    }
  )
);

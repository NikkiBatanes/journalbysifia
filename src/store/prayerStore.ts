// src/store/prayerStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { immer } from 'zustand/middleware/immer';

interface PrayerState {
  // Prayer preferences and settings
  selectedDate: Date;
  defaultPrayerType: 'adoration' | 'confession' | 'thanksgiving' | 'supplication';
  autoSaveEnabled: boolean;
  notificationsEnabled: boolean;

  // UI state
  isDropdownOpen: boolean;
  activeTab: 'mine' | 'requests';

  // Cache for prayer statistics
  prayerStats: {
    totalPrayers: number;
    answeredPrayers: number;
    pendingPrayers: number;
    lastUpdated: string;
  } | null;
}

interface PrayerActions {
  // Date management
  setSelectedDate: (date: Date) => void;

  // Prayer preferences
  setDefaultPrayerType: (type: 'adoration' | 'confession' | 'thanksgiving' | 'supplication') => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;

  // UI state management
  setDropdownOpen: (open: boolean) => void;
  setActiveTab: (tab: 'mine' | 'requests') => void;

  // Statistics management
  updatePrayerStats: (stats: PrayerState['prayerStats']) => void;
  clearPrayerStats: () => void;

  // Utility actions
  resetToDefaults: () => void;
}

type PrayerStore = PrayerState & PrayerActions;

const initialState: PrayerState = {
  // Prayer preferences
  selectedDate: new Date(),
  defaultPrayerType: 'adoration',
  autoSaveEnabled: true,
  notificationsEnabled: false,

  // UI state
  isDropdownOpen: false,
  activeTab: 'mine',

  // Statistics
  prayerStats: null,
};

export const usePrayerStore = create<PrayerStore>()(
  persist(
    immer((set, _get) => ({
      ...initialState,

      // Date management
      setSelectedDate: (date: Date) => {
        set((state) => {
          state.selectedDate = date;
        });
      },

      // Prayer preferences
      setDefaultPrayerType: (type: 'adoration' | 'confession' | 'thanksgiving' | 'supplication') => {
        set((state) => {
          state.defaultPrayerType = type;
        });
      },

      setAutoSaveEnabled: (enabled: boolean) => {
        set((state) => {
          state.autoSaveEnabled = enabled;
        });
      },

      setNotificationsEnabled: (enabled: boolean) => {
        set((state) => {
          state.notificationsEnabled = enabled;
        });
      },

      // UI state management
      setDropdownOpen: (open: boolean) => {
        set((state) => {
          state.isDropdownOpen = open;
        });
      },

      setActiveTab: (tab: 'mine' | 'requests') => {
        set((state) => {
          state.activeTab = tab;
        });
      },

      // Statistics management
      updatePrayerStats: (stats: PrayerState['prayerStats']) => {
        set((state) => {
          state.prayerStats = stats;
        });
      },

      clearPrayerStats: () => {
        set((state) => {
          state.prayerStats = null;
        });
      },

      // Utility actions
      resetToDefaults: () => {
        set((state) => {
          state.selectedDate = new Date();
          state.defaultPrayerType = 'adoration';
          state.autoSaveEnabled = true;
          state.notificationsEnabled = false;
          state.isDropdownOpen = false;
          state.activeTab = 'mine';
          state.prayerStats = null;
        });
      },
    })),
    {
      name: 'prayer-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist certain parts of the state
      partialize: (state) => ({
        defaultPrayerType: state.defaultPrayerType,
        autoSaveEnabled: state.autoSaveEnabled,
        notificationsEnabled: state.notificationsEnabled,
        // Don't persist UI state or selected date
      }),
    }
  )
);

// Selectors for computed values
export const usePrayerSelectors = () => {
  const store = usePrayerStore();

  return {
    // Get prayer statistics
    prayerStatsWithAge: store.prayerStats ? {
      ...store.prayerStats,
      ageInMinutes: Math.floor((Date.now() - new Date(store.prayerStats.lastUpdated).getTime()) / (1000 * 60)),
      isStale: Date.now() - new Date(store.prayerStats.lastUpdated).getTime() > 5 * 60 * 1000, // 5 minutes
    } : null,

    // Check if user has prayer preferences set
    hasCustomPreferences:
      store.defaultPrayerType !== 'adoration' ||
      !store.autoSaveEnabled ||
      store.notificationsEnabled,
  };
};

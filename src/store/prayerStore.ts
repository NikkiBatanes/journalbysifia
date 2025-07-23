// src/store/prayerStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { immer } from 'zustand/middleware/immer';


// Legacy interface for backward compatibility with devotional system
export interface PrayedItem {
  id: string;
  text: string;
  date: Date;
  devotionalTitle: string;
  totalDays?: number;
  dayNumber?: number;
  dayTitle?: string;
}

interface PrayerState {
  // Legacy support for devotional system
  prayedItems: PrayedItem[];

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
  // Legacy support actions
  addPrayedItem: (text: string, metadata: Omit<PrayedItem, 'id' | 'text' | 'date'>) => void;
  clearPrayedItems: () => void;
  setPrayedItems: (items: PrayedItem[]) => void;

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
  // Legacy support
  prayedItems: [],

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

      // Legacy support actions
      addPrayedItem: (text: string, metadata: Omit<PrayedItem, 'id' | 'text' | 'date'>) => {
        set((state) => {
          const newItem: PrayedItem = {
            id: `prayed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            text,
            date: new Date(),
            ...metadata,
          };

          // Check for duplicates
          const isDuplicate = state.prayedItems.some(
            item => item.text === text &&
                   item.devotionalTitle === metadata.devotionalTitle &&
                   item.dayNumber === metadata.dayNumber
          );

          if (!isDuplicate) {
            state.prayedItems.unshift(newItem);
            console.log('✅ Added prayed item to store:', newItem);
          } else {
            console.log('⚠️ Duplicate prayed item detected, skipping:', text);
          }
        });
      },

      clearPrayedItems: () => {
        set((state) => {
          state.prayedItems = [];
          console.log('🗑️ Cleared all prayed items from store');
        });
      },

      setPrayedItems: (items: PrayedItem[]) => {
        set((state) => {
          state.prayedItems = items;
          console.log(`📚 Set ${items.length} prayed items in store`);
        });
      },

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
          // Reset all state except prayedItems (preserve devotional data)
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
        prayedItems: state.prayedItems.map(item => ({
          ...item,
          date: item.date.toISOString(), // Convert Date to string for persistence
        })),
        defaultPrayerType: state.defaultPrayerType,
        autoSaveEnabled: state.autoSaveEnabled,
        notificationsEnabled: state.notificationsEnabled,
        // Don't persist UI state or selected date
      }),
      // Handle Date conversion on hydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert date strings back to Date objects
          state.prayedItems = state.prayedItems.map((item: any) => ({
            ...item,
            date: new Date(item.date),
          }));
        }
      },
    }
  )
);

// Selectors for computed values
export const usePrayerSelectors = () => {
  const store = usePrayerStore();

  return {
    // Get prayed items count
    prayedItemsCount: store.prayedItems.length,

    // Get recent prayed items (last 10)
    recentPrayedItems: store.prayedItems.slice(0, 10),

    // Get prayed items by devotional
    getPrayedItemsByDevotional: (devotionalTitle: string) =>
      store.prayedItems.filter(item => item.devotionalTitle === devotionalTitle),

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

// Hook for legacy compatibility with PrayerContext
export const useLegacyPrayerSupport = () => {
  const {
    prayedItems,
    addPrayedItem,
    clearPrayedItems,
    setPrayedItems,
  } = usePrayerStore();

  return {
    prayedItems,
    addPrayedItem,
    clearPrayedItems,
    setPrayedItems,
  };
};

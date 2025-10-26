/**
 * Network State Management
 * Handles online/offline detection and network-dependent operations
 */

import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Network state interface
interface NetworkState {
  isOnline: boolean;
  isConnected: boolean;
  connectionType: string | null;
  isInternetReachable: boolean | null;
  lastOnlineTime: string | null;
  offlineActions: OfflineAction[];
}

interface OfflineAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'journal' | 'prayer' | 'reflection' | 'timeblock' | 'devotional' | 'playbook';
  data: any;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
}

interface NetworkActions {
  setNetworkState: (state: Partial<Omit<NetworkState, 'offlineActions'>>) => void;
  addOfflineAction: (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>) => void;
  removeOfflineAction: (actionId: string) => void;
  incrementRetryCount: (actionId: string) => void;
  clearOfflineActions: () => void;
  getFailedActions: () => OfflineAction[];
}

type NetworkStore = NetworkState & NetworkActions;

// Zustand store for network state
export const useNetworkStore = create<NetworkStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isOnline: true,
      isConnected: true,
      connectionType: null,
      isInternetReachable: null,
      lastOnlineTime: new Date().toISOString(),
      offlineActions: [],

      // Actions
      setNetworkState: (newState) =>
        set((state) => ({
          ...state,
          ...newState,
          lastOnlineTime: newState.isOnline ? new Date().toISOString() : state.lastOnlineTime,
        })),

      addOfflineAction: (action) =>
        set((state) => ({
          offlineActions: [
            ...state.offlineActions,
            {
              ...action,
              id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
              retryCount: 0,
            },
          ],
        })),

      removeOfflineAction: (actionId) =>
        set((state) => ({
          offlineActions: state.offlineActions.filter((action) => action.id !== actionId),
        })),

      incrementRetryCount: (actionId) =>
        set((state) => ({
          offlineActions: state.offlineActions.map((action) =>
            action.id === actionId
              ? { ...action, retryCount: action.retryCount + 1 }
              : action
          ),
        })),

      clearOfflineActions: () =>
        set({ offlineActions: [] }),

      getFailedActions: () => {
        const state = get();
        return state.offlineActions.filter((action) => action.retryCount >= action.maxRetries);
      },
    }),
    {
      name: 'network-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        offlineActions: state.offlineActions,
        lastOnlineTime: state.lastOnlineTime,
      }),
    }
  )
);

// Network Manager Class
class NetworkManager {
  private static instance: NetworkManager;
  private listeners: Set<(isOnline: boolean) => void> = new Set();
  private syncInProgress = false;

  private constructor() {
    this.initializeNetworkListener();
    this.setupReactQueryIntegration();
  }

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  /**
   * Initialize network state listener
   */
  private initializeNetworkListener() {
    let debounceTimer: NodeJS.Timeout | null = null;

    // Set up NetInfo listener with debouncing to prevent rapid state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable);

      // Clear previous debounce timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Debounce network state changes to prevent flickering during auth flows
      debounceTimer = setTimeout(() => {

        // Update network store
        useNetworkStore.getState().setNetworkState({
          isOnline,
          isConnected: Boolean(state.isConnected),
          connectionType: state.type,
          isInternetReachable: state.isInternetReachable,
        });

        // Notify listeners
        this.listeners.forEach((listener) => listener(isOnline));

        // Trigger sync when coming back online
        if (isOnline && !this.syncInProgress) {
          this.syncOfflineActions();
        }
      }, 500); // 500ms debounce to prevent rapid UI changes
    });

    // Store unsubscribe function for cleanup
    (global as any).networkUnsubscribe = unsubscribe;
  }

  /**
   * Set up React Query integration
   */
  private setupReactQueryIntegration() {
    onlineManager.setEventListener((setOnline) => {
      return NetInfo.addEventListener((state) => {
        setOnline(Boolean(state.isConnected && state.isInternetReachable));
      });
    });
  }

  /**
   * Add a network state listener
   */
  addListener(listener: (isOnline: boolean) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current network state
   */
  getNetworkState(): NetworkState {
    return useNetworkStore.getState();
  }

  /**
   * Check if device is online
   */
  isOnline(): boolean {
    return useNetworkStore.getState().isOnline;
  }

  /**
   * Add an action to be executed when back online
   */
  addOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>) {
    if (!this.isOnline()) {

      useNetworkStore.getState().addOfflineAction({
        ...action,
        maxRetries: action.maxRetries || 3,
      });
    }
  }

  /**
   * Sync all pending offline actions
   */
  async syncOfflineActions(): Promise<void> {
    if (this.syncInProgress || !this.isOnline()) {
      return;
    }

    this.syncInProgress = true;
    const { offlineActions, removeOfflineAction, incrementRetryCount } = useNetworkStore.getState();

    for (const action of offlineActions) {
      try {
        await this.executeOfflineAction(action);
        removeOfflineAction(action.id);

      } catch (error) {
        console.error('❌ Failed to sync offline action:', error);
        incrementRetryCount(action.id);

        // Remove action if max retries exceeded
        if (action.retryCount >= action.maxRetries) {
          console.warn('⚠️ Max retries exceeded for action:', action.id);
          removeOfflineAction(action.id);
        }
      }
    }

    this.syncInProgress = false;

  }

  /**
   * Execute a specific offline action
   */
  private async executeOfflineAction(action: OfflineAction): Promise<void> {
    // Import APIs dynamically to avoid circular dependencies
    const { JournalApi } = await import('../api/journalApi');
    const { PrayerApi } = await import('../api/prayerApi');
    const { ReflectionApi } = await import('../api/reflectionApi');
    const { TimeBlockApi } = await import('../api/timeBlockApi');

    switch (action.entity) {
      case 'journal':
        await this.executeJournalAction(action, JournalApi);
        break;
      case 'prayer':
        await this.executePrayerAction(action, PrayerApi);
        break;
      case 'reflection':
        await this.executeReflectionAction(action, ReflectionApi);
        break;
      case 'timeblock':
        await this.executeTimeBlockAction(action, TimeBlockApi);
        break;
      default:
        throw new Error(`Unknown entity type: ${action.entity}`);
    }
  }

  private async executeJournalAction(action: OfflineAction, JournalApi: any) {
    switch (action.type) {
      case 'create':
        await JournalApi.createEntry(action.data);
        break;
      case 'update':
        await JournalApi.updateEntry(action.data.id, action.data);
        break;
      case 'delete':
        await JournalApi.deleteEntry(action.data.id);
        break;
    }
  }

  private async executePrayerAction(action: OfflineAction, PrayerApi: any) {
    switch (action.type) {
      case 'create':
        await PrayerApi.createPrayer(action.data);
        break;
      case 'update':
        await PrayerApi.updatePrayer(action.data.id, action.data);
        break;
      case 'delete':
        await PrayerApi.deletePrayer(action.data.id);
        break;
    }
  }

  private async executeReflectionAction(action: OfflineAction, ReflectionApi: any) {
    switch (action.type) {
      case 'create':
        await ReflectionApi.createReflection(action.data);
        break;
      case 'update':
        await ReflectionApi.updateReflection(action.data.id, action.data);
        break;
      case 'delete':
        await ReflectionApi.deleteReflection(action.data.id);
        break;
    }
  }

  private async executeTimeBlockAction(action: OfflineAction, TimeBlockApi: any) {
    switch (action.type) {
      case 'create':
        await TimeBlockApi.createTimeBlock(action.data);
        break;
      case 'update':
        await TimeBlockApi.updateTimeBlock(action.data.id, action.data);
        break;
      case 'delete':
        await TimeBlockApi.deleteTimeBlock(action.data.id);
        break;
    }
  }

  /**
   * Force sync now (manual trigger)
   */
  async forceSyncNow(): Promise<void> {
    if (this.isOnline()) {
      await this.syncOfflineActions();
    } else {
      throw new Error('Cannot sync while offline');
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    const { offlineActions } = useNetworkStore.getState();
    return {
      pendingActions: offlineActions.length,
      syncInProgress: this.syncInProgress,
      isOnline: this.isOnline(),
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if ((global as any).networkUnsubscribe) {
      (global as any).networkUnsubscribe();
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const networkManager = NetworkManager.getInstance();

// Hook for using network state in components
export const useNetworkState = () => {
  const networkState = useNetworkStore();

  return {
    ...networkState,
    syncStatus: networkManager.getSyncStatus(),
    forceSyncNow: () => networkManager.forceSyncNow(),
  };
};

// Hook for offline-aware mutations
export const useOfflineAwareMutation = () => {
  const { isOnline, addOfflineAction } = useNetworkStore();

  const executeOrQueue = async (
    action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>,
    onlineExecutor: () => Promise<any>
  ) => {
    if (isOnline) {
      return await onlineExecutor();
    } else {
      addOfflineAction(action);
      return { offline: true, queued: true };
    }
  };

  return { executeOrQueue, isOnline };
};

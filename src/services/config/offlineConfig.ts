import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/query-persist-client-core';

// Configure online manager to use NetInfo
export function setupNetworkListener() {
  onlineManager.setEventListener(setOnline => {
    return NetInfo.addEventListener(state => {
      setOnline(!!state.isConnected);
    });
  });
}

// Create persister for offline storage
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 1000, // Throttle writes to storage
});

// Setup query client persistence
export async function setupQueryPersistence(queryClient: QueryClient) {
  try {
    await persistQueryClient({
      queryClient,
      persister: asyncStoragePersister,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      buster: '1.0', // Change this to invalidate all cached data
      dehydrateOptions: {
        // Only persist successful queries
        shouldDehydrateQuery: (query) => {
          return query.state.status === 'success';
        },
      },
    });
  } catch (error) {
    console.error('Failed to setup query persistence:', error);
  }
}

// Offline-first query options
export const offlineQueryOptions = {
  staleTime: 1000 * 60 * 5, // 5 minutes
  gcTime: 1000 * 60 * 60 * 24, // 24 hours
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  refetchOnMount: false,
  networkMode: 'offlineFirst' as const,
};

// Network-aware mutation options
export const offlineMutationOptions = {
  networkMode: 'offlineFirst' as const,
  retry: (failureCount: number, error: any) => {
    // Don't retry if we're offline
    if (!onlineManager.isOnline()) {
      return false;
    }

    // Don't retry client errors
    if (error?.status >= 400 && error?.status < 500) {
      return false;
    }

    // Retry server errors up to 3 times
    return failureCount < 3;
  },
};

// Clear persisted cache (useful for logout or data corruption)
export async function clearPersistedCache() {
  try {
    await asyncStoragePersister.removeClient();
    console.log('Persisted cache cleared successfully');
  } catch (error) {
    console.error('Failed to clear persisted cache:', error);
  }
}

// Get network status
export function getNetworkStatus() {
  return {
    isOnline: onlineManager.isOnline(),
    setOnline: onlineManager.setOnline,
  };
}

// Sync data when coming back online
export function setupOnlineSync(queryClient: QueryClient) {
  const unsubscribe = onlineManager.subscribe((isOnline) => {
    if (isOnline) {
      // Refetch all queries when coming back online
      queryClient.resumePausedMutations();
      queryClient.invalidateQueries();
    }
  });

  return unsubscribe;
}

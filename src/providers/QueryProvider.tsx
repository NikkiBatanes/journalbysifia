import { ReactNode, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createOptimizedQueryClient, backgroundSyncUtils } from '../config/queryClientConfigV2';
import { networkManager } from '../services/network/networkManager';

// Create optimized query client with performance monitoring
const queryClient = createOptimizedQueryClient();

interface QueryProviderProps {
  children: ReactNode;
}

export const QueryProvider = ({ children }: QueryProviderProps) => {
  useEffect(() => {
    // Setup background sync when provider mounts
    const backgroundSync = backgroundSyncUtils.setupBackgroundSync(queryClient);
    const networkRefetch = backgroundSyncUtils.setupNetworkRefetch(queryClient);

    // Add network state listener
    const removeListener = networkManager.addListener((isOnline) => {
      if (isOnline) {
        backgroundSync.onOnline();
        networkRefetch();
      } else {
        backgroundSync.onOffline();
      }
    });

    // Cleanup on unmount
    return () => {
      removeListener();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Note: ReactQueryDevtools is not compatible with React Native */}
      {/* For debugging, use React Query DevTools browser extension or Flipper */}
    </QueryClientProvider>
  );
};

// Export the query client for use in other parts of the app
export { queryClient };

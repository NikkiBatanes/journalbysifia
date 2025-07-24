import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createEnhancedQueryClient } from '../services/config/queryConfig';
import {
  setupNetworkListener,
  setupQueryPersistence,
  setupOnlineSync,
} from '../services/config/offlineConfig';
import { useQueryPerformance } from '../hooks/useQueryPerformance';

interface EnhancedQueryProviderProps {
  children: React.ReactNode;
}

// Create a single instance of the query client
let queryClientInstance: QueryClient | null = null;

function getQueryClient(): QueryClient {
  if (!queryClientInstance) {
    queryClientInstance = createEnhancedQueryClient();
  }
  return queryClientInstance;
}

// Performance monitoring component
function QueryPerformanceMonitor() {
  useQueryPerformance();
  return null;
}

export function EnhancedQueryProvider({ children }: EnhancedQueryProviderProps) {
  const [queryClient] = useState(() => getQueryClient());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function initializeQueryClient() {
      try {
        // Setup network listener
        setupNetworkListener();

        // Setup query persistence for offline support
        await setupQueryPersistence(queryClient);

        // Setup online sync
        cleanup = setupOnlineSync(queryClient);

        setIsInitialized(true);

        if (__DEV__) {
          console.log('Enhanced Query Client initialized with offline support');
        }
      } catch (error) {
        console.error('Failed to initialize Enhanced Query Client:', error);
        // Still allow the app to work without offline features
        setIsInitialized(true);
      }
    }

    initializeQueryClient();

    return () => {
      cleanup?.();
    };
  }, [queryClient]);

  // Show loading state while initializing
  if (!isInitialized) {
    return null; // Or a loading spinner
  }

  return (
    <QueryClientProvider client={queryClient}>
      {__DEV__ && <QueryPerformanceMonitor />}
      {children}
    </QueryClientProvider>
  );
}

// Hook to access the enhanced query client
export function useEnhancedQueryClient() {
  return getQueryClient();
}

// Utility to reset the query client (useful for logout)
export function resetQueryClient() {
  if (queryClientInstance) {
    queryClientInstance.clear();
    queryClientInstance = null;
  }
}

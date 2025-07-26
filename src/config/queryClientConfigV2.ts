/**
 * React Query v5 Compatible Configuration with Background Sync
 * Provides performance-tuned settings and network-aware operations
 */

import { QueryClient, DefaultOptions } from '@tanstack/react-query';
import { performanceMonitor } from '../utils/performanceMonitor';

// Performance-optimized default options for React Query v5
const defaultOptions: DefaultOptions = {
  queries: {
    // Cache settings
    staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 minutes after unused

    // Network settings
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }

      // Don't retry on client errors (4xx)
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }

      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff

    // Performance settings
    refetchOnWindowFocus: false, // Disable refetch on window focus for mobile
    refetchOnReconnect: true, // Refetch when network reconnects
    refetchOnMount: true, // Refetch when component mounts

    // Background updates
    refetchInterval: false, // Disable automatic background refetching
    refetchIntervalInBackground: false,

    // Error handling
    throwOnError: false, // Handle errors in components instead of throwing
  },

  mutations: {
    // Retry settings for mutations
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }

      // Don't retry on validation errors
      if (error?.status === 400 || error?.status === 422) {
        return false;
      }

      // Retry once for network errors
      return failureCount < 1;
    },
    retryDelay: 1000, // 1 second delay between retries

    // Error handling
    throwOnError: false,
  },
};

/**
 * Create optimized query client with background sync capabilities
 */
export const createOptimizedQueryClient = (): QueryClient => {
  const queryClient = new QueryClient({
    defaultOptions,
  });

  // Add global error handling
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'observerResultsUpdated' && event.query.state.error) {
      console.error('[QueryClient] Query error:', {
        queryKey: event.query.queryKey,
        error: event.query.state.error,
      });

      performanceMonitor.recordMetric({
        name: `query:${event.query.queryKey.join(':')}:error`,
        duration: 0,
        timestamp: Date.now(),
        type: 'query',
        metadata: {
          queryKey: event.query.queryKey,
          error: true,
          errorMessage: (event.query.state.error as any)?.message,
        },
      });
    }
  });

  // Add mutation error handling
  queryClient.getMutationCache().subscribe((event) => {
    if (event.type === 'updated' && event.mutation.state.error) {
      console.error('[QueryClient] Mutation error:', {
        mutationKey: event.mutation.options.mutationKey,
        error: event.mutation.state.error,
      });

      performanceMonitor.recordMetric({
        name: `mutation:${event.mutation.options.mutationKey?.join(':') || 'unknown'}:error`,
        duration: 0,
        timestamp: Date.now(),
        type: 'mutation',
        metadata: {
          mutationKey: event.mutation.options.mutationKey,
          error: true,
          errorMessage: (event.mutation.state.error as any)?.message,
        },
      });
    }
  });

  return queryClient;
};

// Specific configurations for different query types
export const queryConfigs = {
  // Fast queries (user preferences, settings)
  fast: {
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    retryDelay: 500,
  },

  // Standard queries (journal entries, prayers)
  standard: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  },

  // Slow queries (large datasets, reports)
  slow: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    retryDelay: (attemptIndex: number) => Math.min(2000 * 2 ** attemptIndex, 60000),
  },

  // Real-time queries (live data)
  realtime: {
    staleTime: 0, // Always stale
    gcTime: 1 * 60 * 1000, // 1 minute
    retry: 5,
    retryDelay: 1000,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  },
};

// Mutation configurations
export const mutationConfigs = {
  // Critical mutations (user data, payments)
  critical: {
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  },

  // Standard mutations (most operations)
  standard: {
    retry: 1,
    retryDelay: 1000,
  },

  // Fast mutations (UI updates, preferences)
  fast: {
    retry: 0,
    retryDelay: 0,
  },
};

// Optimization utilities
export const optimizationUtils = {
  /**
   * Create a performance-monitored query function
   */
  createMonitoredQuery: <T>(
    queryFn: () => Promise<T>,
    queryKey: string[],
    config: keyof typeof queryConfigs = 'standard'
  ) => {
    const configOptions = queryConfigs[config];

    return {
      queryFn: async () => {
        const timer = performanceMonitor.startTiming(
          `query:${queryKey.join(':')}`,
          'query',
          { queryKey, config }
        );

        try {
          const result = await queryFn();
          timer.end();
          return result;
        } catch (error) {
          timer.end();
          throw error;
        }
      },
      ...configOptions,
    };
  },

  /**
   * Create a performance-monitored mutation function
   */
  createMonitoredMutation: <T, V>(
    mutationFn: (variables: V) => Promise<T>,
    mutationName: string,
    config: keyof typeof mutationConfigs = 'standard'
  ) => {
    const configOptions = mutationConfigs[config];

    return {
      mutationFn: async (variables: V) => {
        const timer = performanceMonitor.startTiming(
          `mutation:${mutationName}`,
          'mutation',
          { mutationName, config }
        );

        try {
          const result = await mutationFn(variables);
          timer.end();
          return result;
        } catch (error) {
          timer.end();
          throw error;
        }
      },
      ...configOptions,
    };
  },

  /**
   * Prefetch critical data
   */
  prefetchCriticalData: async (queryClient: QueryClient, userId: string) => {
    const today = new Date().toISOString().split('T')[0];

    // Prefetch today's data
    const prefetchPromises = [
      queryClient.prefetchQuery({
        queryKey: ['journal', 'gratitude', userId, today],
        staleTime: queryConfigs.fast.staleTime,
      }),
      queryClient.prefetchQuery({
        queryKey: ['journal', 'todos', userId, today],
        staleTime: queryConfigs.fast.staleTime,
      }),
      queryClient.prefetchQuery({
        queryKey: ['prayers', 'entries', userId, today],
        staleTime: queryConfigs.fast.staleTime,
      }),
    ];

    await Promise.allSettled(prefetchPromises);
  },

  /**
   * Clean up stale cache entries
   */
  cleanupCache: (queryClient: QueryClient) => {
    // Remove queries that haven't been used in the last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    queryClient.getQueryCache().getAll().forEach((query) => {
      if (query.state.dataUpdatedAt < oneHourAgo && query.getObserversCount() === 0) {
        queryClient.removeQueries({ queryKey: query.queryKey });
      }
    });
  },

  /**
   * Get cache statistics
   */
  getCacheStats: (queryClient: QueryClient) => {
    const queries = queryClient.getQueryCache().getAll();
    const mutations = queryClient.getMutationCache().getAll();

    return {
      totalQueries: queries.length,
      activeQueries: queries.filter(q => q.getObserversCount() > 0).length,
      staleQueries: queries.filter(q => q.isStale()).length,
      totalMutations: mutations.length,
      pendingMutations: mutations.filter(m => m.state.status === 'pending').length,
      cacheSize: JSON.stringify(queries.map(q => q.state.data)).length,
    };
  },
};

// Background sync integration
export const backgroundSyncUtils = {
  /**
   * Setup automatic refetch on network reconnect
   */
  setupNetworkRefetch: (queryClient: QueryClient) => {
    // This will be called by the network manager when connection is restored
    return () => {
      console.log('🔄 Network reconnected, refetching stale queries...');
      queryClient.refetchQueries({
        type: 'active',
        stale: true,
      });
    };
  },

  /**
   * Setup background sync for mutations
   */
  setupBackgroundSync: (queryClient: QueryClient) => {
    // This integrates with the network manager for offline actions
    return {
      onOnline: () => {
        console.log('🌐 Coming online, triggering background sync...');
        // The network manager will handle offline action sync
        queryClient.resumePausedMutations();
      },
      onOffline: () => {
        console.log('📱 Going offline, pausing mutations...');
        // Mutations will be queued automatically
      },
    };
  },
};

// Development tools
if (__DEV__) {
  (global as any).queryOptimization = optimizationUtils;
  (global as any).backgroundSync = backgroundSyncUtils;
}

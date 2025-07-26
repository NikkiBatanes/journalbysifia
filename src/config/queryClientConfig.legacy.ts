/**
 * Optimized React Query Configuration
 * Provides performance-tuned settings for different query types
 */

import { QueryClient, DefaultOptions } from '@tanstack/react-query';
import { performanceMonitor, withQueryPerformance, withMutationPerformance } from '../utils/performanceMonitor';

// Performance-optimized default options
const defaultOptions: DefaultOptions = {
  queries: {
    // Cache settings
    staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 minutes after unused (renamed from cacheTime)

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
    useErrorBoundary: false, // Handle errors in components

    // Performance monitoring
    onError: (error: any, query) => {
      console.error('[QueryClient] Query error:', {
        queryKey: query.queryKey,
        error: error.message,
      });

      performanceMonitor.recordMetric({
        name: `query:${query.queryKey.join(':')}:error`,
        duration: 0,
        timestamp: Date.now(),
        type: 'query',
        metadata: {
          queryKey: query.queryKey,
          error: true,
          errorMessage: error.message,
        },
      });
    },

    onSuccess: (data, query) => {
      console.log('[QueryClient] Query success:', {
        queryKey: query.queryKey,
        dataSize: JSON.stringify(data).length,
      });
    },
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
    useErrorBoundary: false,

    // Performance monitoring
    onError: (error: any, variables, context, mutation) => {
      console.error('[QueryClient] Mutation error:', {
        mutationKey: mutation.options.mutationKey,
        error: error.message,
        variables,
      });

      performanceMonitor.recordMetric({
        name: `mutation:${mutation.options.mutationKey?.join(':') || 'unknown'}:error`,
        duration: 0,
        timestamp: Date.now(),
        type: 'mutation',
        metadata: {
          mutationKey: mutation.options.mutationKey,
          error: true,
          errorMessage: error.message,
          variables,
        },
      });
    },

    onSuccess: (data, variables, context, mutation) => {
      console.log('[QueryClient] Mutation success:', {
        mutationKey: mutation.options.mutationKey,
        dataSize: JSON.stringify(data).length,
      });
    },
  },
};

// Create optimized query client
export const createOptimizedQueryClient = (): QueryClient => {
  const queryClient = new QueryClient({
    defaultOptions,
    logger: {
      log: (message) => {
        if (__DEV__) {
          console.log('[QueryClient]', message);
        }
      },
      warn: (message) => {
        console.warn('[QueryClient]', message);
      },
      error: (message) => {
        console.error('[QueryClient]', message);
      },
    },
  });

  // Add performance monitoring to query cache
  const originalSetQueryData = queryClient.setQueryData;
  queryClient.setQueryData = function(queryKey, updater, options) {
    const timer = performanceMonitor.startTiming(
      `cache:setQueryData:${Array.isArray(queryKey) ? queryKey.join(':') : String(queryKey)}`,
      'query'
    );

    const result = originalSetQueryData.call(this, queryKey, updater, options);
    timer.end();

    return result;
  };

  // Add performance monitoring to query invalidation
  const originalInvalidateQueries = queryClient.invalidateQueries;
  queryClient.invalidateQueries = function(filters, options) {
    const timer = performanceMonitor.startTiming(
      'cache:invalidateQueries',
      'query',
      { filters }
    );

    const result = originalInvalidateQueries.call(this, filters, options);
    timer.end();

    return result;
  };

  return queryClient;
};

// Specific configurations for different query types
export const queryConfigs = {
  // Fast queries (user preferences, settings)
  fast: {
    staleTime: 1 * 60 * 1000, // 1 minute
    cacheTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  },

  // Standard queries (playbooks, prayers)
  standard: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
  },

  // Slow queries (large datasets, reports)
  slow: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  },

  // Real-time queries (notifications, live updates)
  realtime: {
    staleTime: 0, // Always stale
    cacheTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 30 * 1000, // 30 seconds
    retry: 1,
  },

  // Static queries (rarely changing data)
  static: {
    staleTime: 60 * 60 * 1000, // 1 hour
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours
    retry: 1,
  },
};

// Mutation configurations
export const mutationConfigs = {
  // Critical mutations (user data, important updates)
  critical: {
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000),
  },

  // Standard mutations (most operations)
  standard: {
    retry: 1,
    retryDelay: 1000,
  },

  // Fire-and-forget mutations (analytics, logging)
  fireAndForget: {
    retry: 0,
    retryDelay: 0,
  },
};

// Performance optimization utilities
export const optimizationUtils = {
  /**
   * Create a performance-monitored query function
   */
  createMonitoredQuery: <T>(
    queryFn: () => Promise<T>,
    queryKey: string[],
    config: keyof typeof queryConfigs = 'standard'
  ) => {
    const monitoredFn = withQueryPerformance(queryFn, queryKey);
    return {
      queryFn: monitoredFn,
      ...queryConfigs[config],
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
    const monitoredFn = withMutationPerformance(mutationFn, mutationName);
    return {
      mutationFn: monitoredFn,
      ...mutationConfigs[config],
    };
  },

  /**
   * Prefetch critical data
   */
  prefetchCriticalData: async (queryClient: QueryClient, userId: string) => {
    const timer = performanceMonitor.startTiming('prefetch:critical', 'query');

    try {
      // Prefetch user's playbooks
      await queryClient.prefetchQuery({
        queryKey: ['playbooks', userId],
        staleTime: queryConfigs.standard.staleTime,
      });

      // Prefetch user preferences
      await queryClient.prefetchQuery({
        queryKey: ['user', 'preferences', userId],
        staleTime: queryConfigs.fast.staleTime,
      });

      timer.end();
    } catch (error) {
      timer.end();
      console.warn('[QueryClient] Prefetch failed:', error);
    }
  },

  /**
   * Clean up stale cache entries
   */
  cleanupCache: (queryClient: QueryClient) => {
    const timer = performanceMonitor.startTiming('cache:cleanup', 'query');

    // Remove queries that haven't been used in the last hour
    queryClient.getQueryCache().findAll().forEach(query => {
      const lastUsed = query.state.dataUpdatedAt;
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      if (lastUsed < oneHourAgo) {
        queryClient.removeQueries({ queryKey: query.queryKey });
      }
    });

    timer.end();
  },

  /**
   * Get cache statistics
   */
  getCacheStats: (queryClient: QueryClient) => {
    const queries = queryClient.getQueryCache().findAll();
    const mutations = queryClient.getMutationCache().findAll();

    return {
      totalQueries: queries.length,
      totalMutations: mutations.length,
      cacheSize: queries.reduce((size, query) => {
        return size + JSON.stringify(query.state.data || {}).length;
      }, 0),
      staleCacheEntries: queries.filter(query => query.isStale()).length,
      erroredQueries: queries.filter(query => query.state.error).length,
    };
  },
};

// Development tools
if (__DEV__) {
  (global as any).queryOptimization = optimizationUtils;
}

export default createOptimizedQueryClient;

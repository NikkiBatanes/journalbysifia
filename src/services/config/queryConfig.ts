import { QueryClient } from '@tanstack/react-query';

// Enhanced retry logic with exponential backoff
export const retryConfig = {
  retry: (failureCount: number, error: any) => {
    // Don't retry on client errors (4xx)
    if (error?.status >= 400 && error?.status < 500) {
      return false;
    }

    // Don't retry on authentication errors
    if (error?.status === 401 || error?.status === 403) {
      return false;
    }

    // Retry up to 3 times for server errors and network issues
    return failureCount < 3;
  },

  retryDelay: (attemptIndex: number) => {
    // Exponential backoff: 1s, 2s, 4s, max 30s
    return Math.min(1000 * 2 ** attemptIndex, 30000);
  },
};

// Default query options following industry standards
export const defaultQueryOptions = {
  ...retryConfig,
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  refetchOnWindowFocus: false, // Disable for mobile
  refetchOnReconnect: true, // Refetch when network reconnects
  refetchOnMount: true, // Refetch on component mount
};

// Mutation options with retry logic
export const defaultMutationOptions = {
  retry: (failureCount: number, error: any) => {
    // Don't retry mutations on client errors
    if (error?.status >= 400 && error?.status < 500) {
      return false;
    }

    // Retry mutations only once for server errors
    return failureCount < 1;
  },

  retryDelay: 1000, // 1 second delay for mutation retries
};

// Create enhanced query client with monitoring
export function createEnhancedQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...defaultQueryOptions,
      },

      mutations: {
        ...defaultMutationOptions,
      },
    },
  });
}

// Query options for different data types
export const queryOptionsPresets = {
  // Fast-changing data (user interactions)
  realtime: {
    ...defaultQueryOptions,
    staleTime: 0,
    gcTime: 5 * 60 * 1000, // 5 minutes
  },

  // Slow-changing data (user preferences, settings)
  stable: {
    ...defaultQueryOptions,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  },

  // Critical data that should always be fresh
  critical: {
    ...defaultQueryOptions,
    staleTime: 0,
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  },

  // Background data that can be stale
  background: {
    ...defaultQueryOptions,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    refetchOnMount: false,
  },
};

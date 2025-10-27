import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { analytics } from '../utils/analytics';
import { Logger } from '../utils/ProductionLogger';

interface QueryPerformanceMetrics {
  queryKey: string;
  duration: number;
  status: 'success' | 'error' | 'loading';
  cacheHit: boolean;
  dataSize?: number;
}

export function useQueryPerformance() {
  const queryClient = useQueryClient();
  const metricsRef = useRef<Map<string, { startTime: number; queryKey: any }>>(new Map());

  useEffect(() => {
    const cache = queryClient.getQueryCache();

    // Track query start times
    const unsubscribeStart = cache.subscribe((event: any) => {
      if (event.type === 'queryAdded' || event.type === 'queryUpdated') {
        const query = event.query;
        const queryKeyString = JSON.stringify(query.queryKey);

        if (query.state.fetchStatus === 'fetching') {
          metricsRef.current.set(queryKeyString, {
            startTime: Date.now(),
            queryKey: query.queryKey,
          });
        }
      }
    });

    // Track query completion
    const unsubscribeEnd = cache.subscribe((event: any) => {
      if (event.type === 'queryUpdated') {
        const query = event.query;
        const queryKeyString = JSON.stringify(query.queryKey);
        const startData = metricsRef.current.get(queryKeyString);

        if (startData && query.state.fetchStatus === 'idle') {
          const duration = Date.now() - startData.startTime;
          const cacheHit = query.state.dataUpdatedAt < startData.startTime;

          const metrics: QueryPerformanceMetrics = {
            queryKey: queryKeyString,
            duration,
            status: query.state.status as 'success' | 'error' | 'loading',
            cacheHit,
            dataSize: query.state.data ? JSON.stringify(query.state.data).length : undefined,
          };

          // Log performance metrics
          trackQueryPerformance(metrics);

          // Clean up
          metricsRef.current.delete(queryKeyString);
        }
      }
    });

    return () => {
      unsubscribeStart();
      unsubscribeEnd();
    };
  }, [queryClient]);

  return {
    getMetrics: () => Array.from(metricsRef.current.values()),
    clearMetrics: () => metricsRef.current.clear(),
  };
}

function trackQueryPerformance(metrics: QueryPerformanceMetrics) {
  // Log to console in development
  if (__DEV__) {
    const logLevel = metrics.duration > 1000 ? 'warn' : 'log';
    console[logLevel]('Query Performance:', {
      query: metrics.queryKey,
      duration: `${metrics.duration}ms`,
      status: metrics.status,
      cacheHit: metrics.cacheHit,
      dataSize: metrics.dataSize ? `${(metrics.dataSize / 1024).toFixed(2)}KB` : 'N/A',
    });
  }

  // Track analytics
  analytics.track('query_performance', {
    queryKey: metrics.queryKey,
    duration: metrics.duration,
    status: metrics.status,
    cacheHit: metrics.cacheHit,
    dataSize: metrics.dataSize,
    isSlowQuery: metrics.duration > 1000,
  });

  // Alert for slow queries
  if (metrics.duration > 2000) {
    Logger.warn(`Slow query detected: ${metrics.queryKey} took ${metrics.duration}ms`, {
        component: 'useQueryPerformance',
      });

    analytics.track('slow_query_detected', {
      queryKey: metrics.queryKey,
      duration: metrics.duration,
    });
  }
}

// Hook for monitoring specific query performance
export function useQueryMetrics(queryKey: any) {
  const queryClient = useQueryClient();
  const query = queryClient.getQueryState(queryKey);

  return {
    isLoading: query?.fetchStatus === 'fetching',
    lastFetchTime: query?.dataUpdatedAt,
    errorCount: query?.errorUpdateCount || 0,
    successCount: query?.dataUpdateCount || 0,
    status: query?.status,
  };
}

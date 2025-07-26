/**
 * Playbook Performance Monitoring Hook
 * Tracks and optimizes performance metrics for the advanced playbook system
 */

import { useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface PerformanceMetrics {
  prefetchTime: number;
  cacheHitRate: number;
  navigationSpeed: number;
  syncLatency: number;
  memoryUsage: number;
}

interface PrefetchMetrics {
  playbookId: string;
  startTime: number;
  endTime?: number;
  success: boolean;
  cacheHit: boolean;
}

/**
 * Hook for monitoring and optimizing playbook system performance
 */
export const usePlaybookPerformanceMonitoring = () => {
  const queryClient = useQueryClient();
  const metricsRef = useRef<{
    prefetches: PrefetchMetrics[];
    cacheHits: number;
    cacheMisses: number;
    navigationTimes: number[];
    syncTimes: number[];
  }>({
    prefetches: [],
    cacheHits: 0,
    cacheMisses: 0,
    navigationTimes: [],
    syncTimes: [],
  });

  // Track prefetch performance
  const trackPrefetch = useCallback((playbookId: string, startTime: number, success: boolean, cacheHit: boolean) => {
    const endTime = Date.now();
    const metrics = metricsRef.current;
    
    metrics.prefetches.push({
      playbookId,
      startTime,
      endTime,
      success,
      cacheHit,
    });

    if (cacheHit) {
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
    }

    // Keep only last 100 prefetch records
    if (metrics.prefetches.length > 100) {
      metrics.prefetches = metrics.prefetches.slice(-100);
    }

    console.log('[PlaybookPerformance] Prefetch tracked:', {
      playbookId,
      duration: endTime - startTime,
      success,
      cacheHit,
      totalCacheHitRate: (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100).toFixed(1) + '%'
    });
  }, []);

  // Track navigation performance
  const trackNavigation = useCallback((startTime: number) => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const metrics = metricsRef.current;
    
    metrics.navigationTimes.push(duration);

    // Keep only last 50 navigation times
    if (metrics.navigationTimes.length > 50) {
      metrics.navigationTimes = metrics.navigationTimes.slice(-50);
    }

    console.log('[PlaybookPerformance] Navigation tracked:', {
      duration,
      averageNavTime: (metrics.navigationTimes.reduce((a, b) => a + b, 0) / metrics.navigationTimes.length).toFixed(1) + 'ms'
    });
  }, []);

  // Track sync performance
  const trackSync = useCallback((startTime: number, operation: string) => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const metrics = metricsRef.current;
    
    metrics.syncTimes.push(duration);

    // Keep only last 50 sync times
    if (metrics.syncTimes.length > 50) {
      metrics.syncTimes = metrics.syncTimes.slice(-50);
    }

    console.log('[PlaybookPerformance] Sync tracked:', {
      operation,
      duration,
      averageSyncTime: (metrics.syncTimes.reduce((a, b) => a + b, 0) / metrics.syncTimes.length).toFixed(1) + 'ms'
    });
  }, []);

  // Get current performance metrics
  const getPerformanceMetrics = useCallback((): PerformanceMetrics => {
    const metrics = metricsRef.current;
    
    const avgPrefetchTime = metrics.prefetches.length > 0
      ? metrics.prefetches.reduce((sum, p) => sum + ((p.endTime || Date.now()) - p.startTime), 0) / metrics.prefetches.length
      : 0;

    const cacheHitRate = (metrics.cacheHits + metrics.cacheMisses) > 0
      ? (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100
      : 0;

    const avgNavigationSpeed = metrics.navigationTimes.length > 0
      ? metrics.navigationTimes.reduce((a, b) => a + b, 0) / metrics.navigationTimes.length
      : 0;

    const avgSyncLatency = metrics.syncTimes.length > 0
      ? metrics.syncTimes.reduce((a, b) => a + b, 0) / metrics.syncTimes.length
      : 0;

    // Estimate memory usage based on query cache
    const queryCache = queryClient.getQueryCache();
    const memoryUsage = queryCache.getAll().length * 0.1; // Rough estimate in MB

    return {
      prefetchTime: avgPrefetchTime,
      cacheHitRate,
      navigationSpeed: avgNavigationSpeed,
      syncLatency: avgSyncLatency,
      memoryUsage,
    };
  }, [queryClient]);

  // Optimize cache based on performance metrics
  const optimizeCache = useCallback(() => {
    const metrics = getPerformanceMetrics();
    
    console.log('[PlaybookPerformance] Current metrics:', metrics);

    // If cache hit rate is low, increase stale time
    if (metrics.cacheHitRate < 70) {
      console.log('[PlaybookPerformance] Low cache hit rate detected, consider increasing stale time');
    }

    // If memory usage is high, clean up old queries
    if (metrics.memoryUsage > 10) { // 10MB threshold
      console.log('[PlaybookPerformance] High memory usage detected, cleaning up cache');
      queryClient.getQueryCache().clear();
    }

    // If navigation is slow, suggest prefetching improvements
    if (metrics.navigationSpeed > 500) { // 500ms threshold
      console.log('[PlaybookPerformance] Slow navigation detected, consider more aggressive prefetching');
    }

    return metrics;
  }, [getPerformanceMetrics, queryClient]);

  // Auto-optimization effect
  useEffect(() => {
    const interval = setInterval(() => {
      optimizeCache();
    }, 60000); // Run every minute

    return () => clearInterval(interval);
  }, [optimizeCache]);

  // Performance report for debugging
  const generatePerformanceReport = useCallback(() => {
    const metrics = getPerformanceMetrics();
    const currentMetrics = metricsRef.current;

    const report = {
      summary: metrics,
      details: {
        totalPrefetches: currentMetrics.prefetches.length,
        successfulPrefetches: currentMetrics.prefetches.filter(p => p.success).length,
        cacheHitPrefetches: currentMetrics.prefetches.filter(p => p.cacheHit).length,
        recentNavigationTimes: currentMetrics.navigationTimes.slice(-10),
        recentSyncTimes: currentMetrics.syncTimes.slice(-10),
        queryCount: queryClient.getQueryCache().getAll().length,
      },
      recommendations: [],
    };

    // Generate recommendations
    if (metrics.cacheHitRate < 70) {
      report.recommendations.push('Consider increasing stale time for better cache utilization');
    }
    
    if (metrics.navigationSpeed > 300) {
      report.recommendations.push('Consider implementing more aggressive prefetching');
    }
    
    if (metrics.syncLatency > 1000) {
      report.recommendations.push('Consider optimizing sync operations or using background sync');
    }
    
    if (metrics.memoryUsage > 15) {
      report.recommendations.push('Consider implementing cache size limits or more aggressive garbage collection');
    }

    console.log('[PlaybookPerformance] Performance Report:', report);
    return report;
  }, [getPerformanceMetrics, queryClient]);

  // Wrapper functions for easy integration
  const withPrefetchTracking = useCallback(<T extends any[]>(
    fn: (...args: T) => Promise<any>,
    playbookId: string
  ) => {
    return async (...args: T) => {
      const startTime = Date.now();
      let success = false;
      let cacheHit = false;

      try {
        // Check if data is already in cache
        const existingData = queryClient.getQueryData(['playbooks', 'detail', playbookId]);
        cacheHit = !!existingData;

        const result = await fn(...args);
        success = true;
        return result;
      } catch (error) {
        success = false;
        throw error;
      } finally {
        trackPrefetch(playbookId, startTime, success, cacheHit);
      }
    };
  }, [queryClient, trackPrefetch]);

  const withNavigationTracking = useCallback(<T extends any[]>(
    fn: (...args: T) => any
  ) => {
    return (...args: T) => {
      const startTime = Date.now();
      const result = fn(...args);
      
      // Track navigation after a short delay to capture full navigation time
      setTimeout(() => trackNavigation(startTime), 100);
      
      return result;
    };
  }, [trackNavigation]);

  const withSyncTracking = useCallback(<T extends any[]>(
    fn: (...args: T) => Promise<any>,
    operation: string
  ) => {
    return async (...args: T) => {
      const startTime = Date.now();
      try {
        const result = await fn(...args);
        trackSync(startTime, operation);
        return result;
      } catch (error) {
        trackSync(startTime, `${operation}_failed`);
        throw error;
      }
    };
  }, [trackSync]);

  return {
    // Tracking functions
    trackPrefetch,
    trackNavigation,
    trackSync,
    
    // Metrics and optimization
    getPerformanceMetrics,
    optimizeCache,
    generatePerformanceReport,
    
    // Wrapper functions for easy integration
    withPrefetchTracking,
    withNavigationTracking,
    withSyncTracking,
  };
};

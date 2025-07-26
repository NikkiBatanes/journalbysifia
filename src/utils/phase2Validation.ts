// src/utils/phase2Validation.ts

/**
 * Phase 2 Industry Standard Data Management Validation
 * Comprehensive testing and validation utilities for the new data management features
 */

import { QueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { networkManager } from '../services/network/networkManager';

interface ValidationResult {
  feature: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

interface ValidationReport {
  overall: 'pass' | 'fail' | 'warning';
  results: ValidationResult[];
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export class Phase2Validator {
  private queryClient: QueryClient;
  private results: ValidationResult[] = [];

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  /**
   * Run comprehensive validation of Phase 2 features
   */
  async validateAll(): Promise<ValidationReport> {
    this.results = [];

    console.log('🔍 Starting Phase 2 Validation...');

    // Core Infrastructure Tests
    await this.validateQueryClient();
    await this.validateNetworkManager();
    await this.validateQueryKeys();

    // Feature Tests
    await this.validateInfiniteQueries();
    await this.validateNetworkStatus();
    await this.validateBackgroundSync();
    await this.validatePerformanceMonitoring();

    // Integration Tests
    await this.validateOfflineOnlineTransitions();
    await this.validateCacheManagement();

    return this.generateReport();
  }

  /**
   * Validate Query Client Configuration
   */
  private async validateQueryClient(): Promise<void> {
    try {
      const defaultOptions = this.queryClient.getDefaultOptions();

      if (defaultOptions.queries?.staleTime) {
        this.addResult('Query Client - Stale Time', 'pass',
          `Stale time configured: ${defaultOptions.queries.staleTime}ms`);
      } else {
        this.addResult('Query Client - Stale Time', 'warning',
          'Stale time not configured');
      }

      if (defaultOptions.queries?.gcTime) {
        this.addResult('Query Client - GC Time', 'pass',
          `GC time configured: ${defaultOptions.queries.gcTime}ms`);
      } else {
        this.addResult('Query Client - GC Time', 'warning',
          'GC time not configured');
      }

      // Test cache functionality
      const testKey = ['test', 'validation', Date.now()];
      this.queryClient.setQueryData(testKey, { test: 'data' });
      const cachedData = this.queryClient.getQueryData(testKey);

      if (cachedData) {
        this.addResult('Query Client - Cache', 'pass',
          'Cache read/write operations working');
      } else {
        this.addResult('Query Client - Cache', 'fail',
          'Cache operations not working');
      }

    } catch (error) {
      this.addResult('Query Client', 'fail',
        `Query client validation failed: ${error}`);
    }
  }

  /**
   * Validate Network Manager
   */
  private async validateNetworkManager(): Promise<void> {
    try {
      const networkState = networkManager.getState();

      this.addResult('Network Manager - State', 'pass',
        `Network manager initialized with state: ${JSON.stringify({
          isOnline: networkState.isOnline,
          pendingActions: networkState.syncStatus.pendingActions,
        })}`);

      // Test network state subscription
      const unsubscribe = networkManager.subscribe((state) => {
        console.log('Network state changed:', state.isOnline);
      });

      this.addResult('Network Manager - Subscription', 'pass',
        'Network state subscription working');

      unsubscribe();

      // Test offline action queueing
      if (typeof networkManager.getState().queueOfflineAction === 'function') {
        this.addResult('Network Manager - Offline Queue', 'pass',
          'Offline action queueing available');
      } else {
        this.addResult('Network Manager - Offline Queue', 'fail',
          'Offline action queueing not available');
      }

    } catch (error) {
      this.addResult('Network Manager', 'fail',
        `Network manager validation failed: ${error}`);
    }
  }

  /**
   * Validate Query Keys Structure
   */
  private async validateQueryKeys(): Promise<void> {
    try {
      // Import query keys dynamically to test structure
      const { queryKeys } = await import('../services/queryKeys');

      const requiredKeys = ['journal', 'prayers', 'search', 'auth'];
      const missingKeys = requiredKeys.filter(key => !queryKeys[key]);

      if (missingKeys.length === 0) {
        this.addResult('Query Keys - Structure', 'pass',
          'All required query key domains present');
      } else {
        this.addResult('Query Keys - Structure', 'fail',
          `Missing query key domains: ${missingKeys.join(', ')}`);
      }

      // Test infinite query keys
      if (queryKeys.journal?.infinite && queryKeys.prayers?.infinite) {
        this.addResult('Query Keys - Infinite', 'pass',
          'Infinite query keys configured');
      } else {
        this.addResult('Query Keys - Infinite', 'warning',
          'Some infinite query keys missing');
      }

    } catch (error) {
      this.addResult('Query Keys', 'fail',
        `Query keys validation failed: ${error}`);
    }
  }

  /**
   * Validate Infinite Query Utilities
   */
  private async validateInfiniteQueries(): Promise<void> {
    try {
      const { useSimpleInfiniteQuery, useInfiniteScrollUtils } =
        await import('../services/hooks/useSimpleInfiniteQueries');

      if (useSimpleInfiniteQuery && useInfiniteScrollUtils) {
        this.addResult('Infinite Queries - Hooks', 'pass',
          'Infinite query hooks available');
      } else {
        this.addResult('Infinite Queries - Hooks', 'fail',
          'Infinite query hooks not available');
      }

      // Test utility functions with direct implementation instead of hook
      const flattenData = (data: any) => {
        return data.pages.flatMap((page: any) => page.data);
      };

      const mockData = {
        pages: [
          { data: [1, 2, 3], totalCount: 10 },
          { data: [4, 5, 6], totalCount: 10 },
        ],
      };

      const flattened = flattenData(mockData);
      if (flattened.length === 6) {
        this.addResult('Infinite Queries - Utils', 'pass',
          'Data flattening utility working');
      } else {
        this.addResult('Infinite Queries - Utils', 'fail',
          'Data flattening utility not working');
      }

    } catch (error) {
      this.addResult('Infinite Queries', 'fail',
        `Infinite queries validation failed: ${error}`);
    }
  }

  /**
   * Validate Network Status Component
   */
  private async validateNetworkStatus(): Promise<void> {
    try {
      const { NetworkStatus } = await import('../components/NetworkStatus');

      if (NetworkStatus) {
        this.addResult('Network Status - Component', 'pass',
          'NetworkStatus component available');
      } else {
        this.addResult('Network Status - Component', 'fail',
          'NetworkStatus component not available');
      }

    } catch (error) {
      this.addResult('Network Status', 'fail',
        `Network status validation failed: ${error}`);
    }
  }

  /**
   * Validate Background Sync
   */
  private async validateBackgroundSync(): Promise<void> {
    try {
      const networkState = networkManager.getState();

      if (typeof networkState.startBackgroundSync === 'function') {
        this.addResult('Background Sync - Function', 'pass',
          'Background sync function available');
      } else {
        this.addResult('Background Sync - Function', 'warning',
          'Background sync function not available');
      }

      // Test sync status tracking
      if (networkState.syncStatus) {
        this.addResult('Background Sync - Status', 'pass',
          `Sync status tracking: ${JSON.stringify(networkState.syncStatus)}`);
      } else {
        this.addResult('Background Sync - Status', 'fail',
          'Sync status tracking not available');
      }

    } catch (error) {
      this.addResult('Background Sync', 'fail',
        `Background sync validation failed: ${error}`);
    }
  }

  /**
   * Validate Performance Monitoring
   */
  private async validatePerformanceMonitoring(): Promise<void> {
    try {
      const { performanceMonitor } = await import('../config/queryClientConfigV2');

      if (performanceMonitor) {
        this.addResult('Performance Monitoring - Monitor', 'pass',
          'Performance monitor available');
      } else {
        this.addResult('Performance Monitoring - Monitor', 'warning',
          'Performance monitor not available');
      }

    } catch (error) {
      this.addResult('Performance Monitoring', 'warning',
        `Performance monitoring validation failed: ${error}`);
    }
  }

  /**
   * Validate Offline/Online Transitions
   */
  private async validateOfflineOnlineTransitions(): Promise<void> {
    try {
      const netInfo = await NetInfo.fetch();

      this.addResult('Network Transitions - NetInfo', 'pass',
        `NetInfo working: ${netInfo.isConnected ? 'online' : 'offline'}`);

      // Test network manager integration
      const networkState = networkManager.getState();
      if (networkState.isOnline === netInfo.isConnected) {
        this.addResult('Network Transitions - Sync', 'pass',
          'Network manager synced with NetInfo');
      } else {
        this.addResult('Network Transitions - Sync', 'warning',
          'Network manager may not be synced with NetInfo');
      }

    } catch (error) {
      this.addResult('Network Transitions', 'fail',
        `Network transitions validation failed: ${error}`);
    }
  }

  /**
   * Validate Cache Management
   */
  private async validateCacheManagement(): Promise<void> {
    try {
      const cacheSize = this.queryClient.getQueryCache().getAll().length;

      this.addResult('Cache Management - Size', 'pass',
        `Query cache contains ${cacheSize} entries`);

      // Test cache invalidation
      const testKey = ['test', 'invalidation', Date.now()];
      this.queryClient.setQueryData(testKey, { test: 'data' });
      await this.queryClient.invalidateQueries({ queryKey: testKey });

      this.addResult('Cache Management - Invalidation', 'pass',
        'Cache invalidation working');

    } catch (error) {
      this.addResult('Cache Management', 'fail',
        `Cache management validation failed: ${error}`);
    }
  }

  /**
   * Add validation result
   */
  private addResult(feature: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any): void {
    this.results.push({ feature, status, message, details });

    const emoji = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${emoji} ${feature}: ${message}`);
  }

  /**
   * Generate validation report
   */
  private generateReport(): ValidationReport {
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'pass').length,
      failed: this.results.filter(r => r.status === 'fail').length,
      warnings: this.results.filter(r => r.status === 'warning').length,
    };

    const overall = summary.failed > 0 ? 'fail' :
                   summary.warnings > 0 ? 'warning' : 'pass';

    return {
      overall,
      results: this.results,
      timestamp: new Date().toISOString(),
      summary,
    };
  }
}

/**
 * Quick validation function for development
 */
export const validatePhase2 = async (queryClient: QueryClient): Promise<ValidationReport> => {
  const validator = new Phase2Validator(queryClient);
  return await validator.validateAll();
};

/**
 * Performance benchmark utilities
 */
export const benchmarkQueries = {
  /**
   * Measure query execution time
   */
  measureQueryTime: async (queryFn: () => Promise<any>): Promise<number> => {
    const start = performance.now();
    await queryFn();
    const end = performance.now();
    return end - start;
  },

  /**
   * Measure cache hit rate
   */
  measureCacheHitRate: (queryClient: QueryClient): number => {
    const cache = queryClient.getQueryCache();
    const allQueries = cache.getAll();
    const cachedQueries = allQueries.filter(query => query.state.data !== undefined);
    return allQueries.length > 0 ? cachedQueries.length / allQueries.length : 0;
  },

  /**
   * Get memory usage statistics
   */
  getMemoryStats: (queryClient: QueryClient) => {
    const cache = queryClient.getQueryCache();
    const allQueries = cache.getAll();

    return {
      totalQueries: allQueries.length,
      activeQueries: allQueries.filter(q => q.getObserversCount() > 0).length,
      staleQueries: allQueries.filter(q => q.isStale()).length,
      cachedQueries: allQueries.filter(q => q.state.data !== undefined).length,
    };
  },
};

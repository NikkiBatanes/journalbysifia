/**
 * Performance Monitoring and Optimization Utilities
 * Tracks React Query performance, database queries, and component rendering
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Performance metrics interface
interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  type: 'query' | 'mutation' | 'render' | 'database';
  metadata?: Record<string, any>;
}

interface PerformanceStats {
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  totalCalls: number;
  errorRate: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 metrics
  private readonly storageKey = 'performance_metrics';

  constructor() {
    this.loadMetricsFromStorage();
  }

  /**
   * Start timing a performance metric
   */
  startTiming(name: string, type: PerformanceMetric['type'], metadata?: Record<string, any>) {
    const startTime = performance.now();

    return {
      end: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.recordMetric({
          name,
          duration,
          timestamp: Date.now(),
          type,
          metadata,
        });

        return duration;
      },
    };
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow operations with per-metric overrides (reduce noise for known heavy queries)
    let threshold = this.getSlowThreshold(metric.type);
    try {
      // Increase threshold specifically for playbooks queries (these aggregate multiple tables)
      if (metric.type === 'query' && typeof metric.name === 'string' && metric.name.startsWith('query:playbooks:')) {
        // Only warn if slower than 2s for playbooks
        threshold = Math.max(threshold, 2000);
      }
    } catch {}

    if (metric.duration > threshold) {
      console.warn(`[Performance] Slow ${metric.type}: ${metric.name} took ${metric.duration.toFixed(2)}ms`, metric.metadata);
    }

    // Persist to storage periodically
    if (this.metrics.length % 10 === 0) {
      this.saveMetricsToStorage();
    }
  }

  /**
   * Get performance statistics for a specific metric name
   */
  getStats(name: string): PerformanceStats | null {
    const filteredMetrics = this.metrics.filter(m => m.name === name);

    if (filteredMetrics.length === 0) {
      return null;
    }

    const durations = filteredMetrics.map(m => m.duration);
    const errors = filteredMetrics.filter(m => m.metadata?.error).length;

    return {
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalCalls: filteredMetrics.length,
      errorRate: errors / filteredMetrics.length,
    };
  }

  /**
   * Get all performance statistics grouped by metric name
   */
  getAllStats(): Record<string, PerformanceStats> {
    const stats: Record<string, PerformanceStats> = {};
    const uniqueNames = [...new Set(this.metrics.map(m => m.name))];

    uniqueNames.forEach(name => {
      const stat = this.getStats(name);
      if (stat) {
        stats[name] = stat;
      }
    });

    return stats;
  }

  /**
   * Get slow operations above threshold
   */
  getSlowOperations(limit = 10): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.duration > this.getSlowThreshold(m.type))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(minutes = 5): PerformanceMetric[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = [];
    this.saveMetricsToStorage();
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const stats = this.getAllStats();
    const slowOps = this.getSlowOperations();
    const recentMetrics = this.getRecentMetrics();

    let report = '📊 Performance Report\n';
    report += '===================\n\n';

    // Overall statistics
    report += `Total Metrics: ${this.metrics.length}\n`;
    report += `Recent Activity (5min): ${recentMetrics.length} operations\n\n`;

    // Top slow operations
    if (slowOps.length > 0) {
      report += '🐌 Slowest Operations:\n';
      slowOps.forEach((op, i) => {
        report += `${i + 1}. ${op.name} (${op.type}): ${op.duration.toFixed(2)}ms\n`;
      });
      report += '\n';
    }

    // Statistics by metric
    report += '📈 Performance Statistics:\n';
    Object.entries(stats).forEach(([name, stat]) => {
      report += `\n${name}:\n`;
      report += `  Average: ${stat.averageDuration.toFixed(2)}ms\n`;
      report += `  Min/Max: ${stat.minDuration.toFixed(2)}ms / ${stat.maxDuration.toFixed(2)}ms\n`;
      report += `  Total Calls: ${stat.totalCalls}\n`;
      report += `  Error Rate: ${(stat.errorRate * 100).toFixed(1)}%\n`;
    });

    return report;
  }

  /**
   * Get slow threshold for different operation types
   */
  private getSlowThreshold(type: PerformanceMetric['type']): number {
    switch (type) {
      case 'query':
        return 1000; // 1 second for queries
      case 'mutation':
        return 2000; // 2 seconds for mutations
      case 'render':
        return 100; // 100ms for renders
      case 'database':
        return 500; // 500ms for database operations
      default:
        return 1000;
    }
  }

  /**
   * Load metrics from AsyncStorage
   */
  private async loadMetricsFromStorage() {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        this.metrics = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[PerformanceMonitor] Failed to load metrics from storage:', error);
    }
  }

  /**
   * Save metrics to AsyncStorage
   */
  private async saveMetricsToStorage() {
    try {
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.metrics));
    } catch (error) {
      console.warn('[PerformanceMonitor] Failed to save metrics to storage:', error);
    }
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * React Query performance wrapper
 */
export const withQueryPerformance = <T>(
  queryFn: () => Promise<T>,
  queryKey: readonly string[]
) => {
  return async (): Promise<T> => {
    const timer = performanceMonitor.startTiming(
      `query:${queryKey.join(':')}`,
      'query',
      { queryKey: [...queryKey] }
    );

    try {
      const result = await queryFn();
      timer.end();
      return result;
    } catch (error: any) {
      const duration = timer.end();
      performanceMonitor.recordMetric({
        name: `query:${queryKey.join(':')}`,
        duration,
        timestamp: Date.now(),
        type: 'query',
        metadata: { queryKey: [...queryKey], error: true, errorMessage: error?.message || 'Unknown error' },
      });
      throw error;
    }
  };
};

/**
 * Mutation performance wrapper
 */
export const withMutationPerformance = <T, V>(
  mutationFn: (variables: V) => Promise<T>,
  mutationName: string
) => {
  return async (variables: V): Promise<T> => {
    const timer = performanceMonitor.startTiming(
      `mutation:${mutationName}`,
      'mutation',
      { variables }
    );

    try {
      const result = await mutationFn(variables);
      timer.end();
      return result;
    } catch (error: any) {
      const duration = timer.end();
      performanceMonitor.recordMetric({
        name: `mutation:${mutationName}`,
        duration,
        timestamp: Date.now(),
        type: 'mutation',
        metadata: { variables, error: true, errorMessage: error?.message || 'Unknown error' },
      });
      throw error;
    }
  };
};

/**
 * Component render performance HOC
 */
import React from 'react';

export const withRenderPerformance = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) => {
  return React.memo((props: P) => {
    const timer = performanceMonitor.startTiming(
      `render:${componentName}`,
      'render'
    );

    React.useEffect(() => {
      timer.end();
    });

    return React.createElement(Component, props);
  });
};

/**
 * Database operation performance wrapper
 */
export const withDatabasePerformance = <T>(
  dbFn: () => Promise<T>,
  operationName: string,
  metadata?: Record<string, any>
) => {
  return async (): Promise<T> => {
    const timer = performanceMonitor.startTiming(
      `db:${operationName}`,
      'database',
      metadata
    );

    try {
      const result = await dbFn();
      timer.end();
      return result;
    } catch (error: any) {
      const duration = timer.end();
      performanceMonitor.recordMetric({
        name: `db:${operationName}`,
        duration,
        timestamp: Date.now(),
        type: 'database',
        metadata: { ...metadata, error: true, errorMessage: error?.message || 'Unknown error' },
      });
      throw error;
    }
  };
};

/**
 * Performance debugging utilities
 */
export const PerformanceDebug = {
  /**
   * Log current performance stats to console
   */
  logStats: () => {
    console.log(performanceMonitor.generateReport());
  },

  /**
   * Get performance data for debugging
   */
  getDebugData: () => ({
    stats: performanceMonitor.getAllStats(),
    slowOps: performanceMonitor.getSlowOperations(),
    recentMetrics: performanceMonitor.getRecentMetrics(),
  }),

  /**
   * Monitor a specific function
   */
  monitor: <T extends (...args: any[]) => any>(
    fn: T,
    name: string,
    type: PerformanceMetric['type'] = 'query'
  ): T => {
    return ((...args: Parameters<T>) => {
      const timer = performanceMonitor.startTiming(name, type, { args });

      try {
        const result = fn(...args);

        // Handle both sync and async functions
        if (result instanceof Promise) {
          return result.finally(() => timer.end());
        } else {
          timer.end();
          return result;
        }
      } catch (error) {
        timer.end();
        throw error;
      }
    }) as T;
  },
};

/**
 * Onboarding-specific performance tracking
 */
export const OnboardingPerformance = {
  /**
   * Track onboarding step duration
   */
  trackStep: (stepName: string, startTime: number) => {
    const duration = performance.now() - startTime;
    performanceMonitor.recordMetric({
      name: `onboarding:step:${stepName}`,
      duration,
      timestamp: Date.now(),
      type: 'render',
      metadata: { step: stepName },
    });
    return duration;
  },

  /**
   * Track navigation timing
   */
  trackNavigation: (from: string, to: string, startTime: number) => {
    const duration = performance.now() - startTime;
    performanceMonitor.recordMetric({
      name: `onboarding:navigation:${from}->${to}`,
      duration,
      timestamp: Date.now(),
      type: 'render',
      metadata: { from, to },
    });
    return duration;
  },

  /**
   * Track playbook generation
   */
  trackGeneration: (generationType: string, startTime: number, success: boolean) => {
    const duration = performance.now() - startTime;
    performanceMonitor.recordMetric({
      name: `onboarding:generation:${generationType}`,
      duration,
      timestamp: Date.now(),
      type: 'mutation',
      metadata: { generationType, success },
    });
    return duration;
  },

  /**
   * Get onboarding performance summary
   */
  getSummary: () => {
    const allStats = performanceMonitor.getAllStats();
    const onboardingStats = Object.entries(allStats)
      .filter(([name]) => name.startsWith('onboarding:'))
      .reduce((acc, [name, stats]) => {
        acc[name] = stats;
        return acc;
      }, {} as Record<string, PerformanceStats>);

    return {
      stats: onboardingStats,
      totalSteps: Object.keys(onboardingStats).filter(k => k.includes(':step:')).length,
      averageStepDuration: Object.values(onboardingStats)
        .filter((_, i) => Object.keys(onboardingStats)[i].includes(':step:'))
        .reduce((sum, stat) => sum + stat.averageDuration, 0) / 
        Object.keys(onboardingStats).filter(k => k.includes(':step:')).length || 0,
    };
  },
};

// Export for global access in development
if (__DEV__) {
  (globalThis as any).PerformanceDebug = PerformanceDebug;
  (globalThis as any).performanceMonitor = performanceMonitor;
  (globalThis as any).OnboardingPerformance = OnboardingPerformance;
}

export default performanceMonitor;

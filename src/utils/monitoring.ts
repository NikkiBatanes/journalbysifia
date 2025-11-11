/**
 * Monitoring & Observability Utility
 * Tracks errors, performance, and user behavior
 * ZERO UI/UX IMPACT - All background operations
 */

import { Logger } from './ProductionLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// TYPES
// ============================================================================

export interface MetricEvent {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface ErrorReport {
  error: Error;
  context: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  userId?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// MONITORING SERVICE
// ============================================================================

class MonitoringService {
  private sessionId: string;
  private metricsBuffer: MetricEvent[] = [];
  private analyticsBuffer: AnalyticsEvent[] = [];
  private performanceBuffer: PerformanceMetric[] = [];
  private errorBuffer: ErrorReport[] = [];
  
  private readonly BUFFER_SIZE = 50; // Send after 50 events
  private readonly FLUSH_INTERVAL = 60000; // Or every 60 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startFlushTimer();
  }

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  // ==========================================================================
  // METRICS TRACKING
  // ==========================================================================

  /**
   * Track a numeric metric (e.g., API response time, generation count)
   */
  trackMetric(name: string, value: number, metadata?: Record<string, any>): void {
    const metric: MetricEvent = {
      name,
      value,
      timestamp: Date.now(),
      metadata,
    };

    this.metricsBuffer.push(metric);
    
    // Also log for immediate visibility
    Logger.info(`📊 Metric: ${name} = ${value}`, {
      component: 'monitoring',
      data: metadata,
    });

    this.checkBufferSize();
  }

  /**
   * Track API call performance
   */
  trackApiCall(
    endpoint: string,
    duration: number,
    success: boolean,
    statusCode?: number
  ): void {
    this.trackMetric('api_call_duration', duration, {
      endpoint,
      success,
      statusCode,
    });

    // Track success/failure rate
    this.trackMetric('api_call_success', success ? 1 : 0, {
      endpoint,
      statusCode,
    });
  }

  /**
   * Track generation metrics
   */
  trackGeneration(
    type: 'playbook' | 'devotional',
    duration: number,
    success: boolean,
    tier?: string
  ): void {
    this.trackMetric('generation_duration', duration, {
      type,
      success,
      tier,
    });

    this.trackMetric('generation_success', success ? 1 : 0, {
      type,
      tier,
    });
  }

  /**
   * Track rate limit hits
   */
  trackRateLimit(
    tier: string,
    limitType: 'cooldown' | 'minute' | 'hour' | 'day' | 'month',
    waitSeconds: number
  ): void {
    this.trackMetric('rate_limit_hit', 1, {
      tier,
      limitType,
      waitSeconds,
    });
  }

  // ==========================================================================
  // ANALYTICS TRACKING
  // ==========================================================================

  /**
   * Track user behavior events
   */
  trackEvent(
    event: string,
    properties?: Record<string, any>,
    userId?: string
  ): void {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      timestamp: Date.now(),
      userId,
      sessionId: this.sessionId,
    };

    this.analyticsBuffer.push(analyticsEvent);

    Logger.info(`📈 Event: ${event}`, {
      component: 'monitoring',
      data: properties,
    });

    this.checkBufferSize();
  }

  /**
   * Track screen views
   */
  trackScreenView(screenName: string, userId?: string): void {
    this.trackEvent('screen_view', { screenName }, userId);
  }

  /**
   * Track user actions
   */
  trackAction(
    action: string,
    category: string,
    label?: string,
    value?: number
  ): void {
    this.trackEvent('user_action', {
      action,
      category,
      label,
      value,
    });
  }

  // ==========================================================================
  // PERFORMANCE MONITORING
  // ==========================================================================

  /**
   * Start performance timer
   */
  startTimer(operation: string): (success?: boolean, metadata?: Record<string, any>) => void {
    const startTime = Date.now();

    return (success: boolean = true, metadata?: Record<string, any>) => {
      const duration = Date.now() - startTime;
      
      const perfMetric: PerformanceMetric = {
        operation,
        duration,
        timestamp: Date.now(),
        success,
        metadata,
      };

      this.performanceBuffer.push(perfMetric);

      Logger.info(`⏱️ Performance: ${operation} took ${duration}ms`, {
        component: 'monitoring',
        data: { success, ...metadata },
      });

      this.checkBufferSize();
    };
  }

  /**
   * Track component render time
   */
  trackRender(componentName: string, duration: number): void {
    this.trackMetric('component_render_time', duration, {
      componentName,
    });
  }

  // ==========================================================================
  // ERROR TRACKING
  // ==========================================================================

  /**
   * Track errors with context
   */
  trackError(
    error: Error,
    context: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    metadata?: Record<string, any>,
    userId?: string
  ): void {
    const errorReport: ErrorReport = {
      error,
      context,
      severity,
      timestamp: Date.now(),
      userId,
      metadata,
    };

    this.errorBuffer.push(errorReport);

    // Always log errors immediately
    Logger.error(`🚨 Error in ${context}`, error, {
      component: 'monitoring',
      data: { severity, ...metadata },
    });

    // Critical errors flush immediately
    if (severity === 'critical') {
      this.flush();
    } else {
      this.checkBufferSize();
    }
  }

  // ==========================================================================
  // BUFFER MANAGEMENT
  // ==========================================================================

  private checkBufferSize(): void {
    const totalBufferSize =
      this.metricsBuffer.length +
      this.analyticsBuffer.length +
      this.performanceBuffer.length +
      this.errorBuffer.length;

    if (totalBufferSize >= this.BUFFER_SIZE) {
      this.flush();
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Flush all buffers (send to backend/storage)
   */
  async flush(): Promise<void> {
    if (
      this.metricsBuffer.length === 0 &&
      this.analyticsBuffer.length === 0 &&
      this.performanceBuffer.length === 0 &&
      this.errorBuffer.length === 0
    ) {
      return;
    }

    const snapshot = {
      metrics: [...this.metricsBuffer],
      analytics: [...this.analyticsBuffer],
      performance: [...this.performanceBuffer],
      errors: [...this.errorBuffer],
      sessionId: this.sessionId,
      timestamp: Date.now(),
    };

    // Clear buffers
    this.metricsBuffer = [];
    this.analyticsBuffer = [];
    this.performanceBuffer = [];
    this.errorBuffer = [];

    // Store locally for now (can be sent to backend later)
    try {
      await this.storeLocally(snapshot);
      
      // TODO: Send to backend analytics service
      // await this.sendToBackend(snapshot);
    } catch (error) {
      Logger.error('Failed to flush monitoring data', error as Error, {
        component: 'monitoring',
      });
    }
  }

  private async storeLocally(snapshot: any): Promise<void> {
    try {
      const key = `@siFia:monitoring:${Date.now()}`;
      await AsyncStorage.setItem(key, JSON.stringify(snapshot));

      // Keep only last 10 snapshots to avoid storage bloat
      await this.cleanupOldSnapshots();
    } catch (error) {
      // Silent fail - monitoring shouldn't break the app
      console.warn('Failed to store monitoring snapshot:', error);
    }
  }

  private async cleanupOldSnapshots(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const monitoringKeys = allKeys
        .filter((key) => key.startsWith('@siFia:monitoring:'))
        .sort()
        .reverse();

      // Keep only last 10
      const keysToDelete = monitoringKeys.slice(10);
      if (keysToDelete.length > 0) {
        await AsyncStorage.multiRemove(keysToDelete);
      }
    } catch (error) {
      // Silent fail
    }
  }

  // ==========================================================================
  // STATISTICS & REPORTING
  // ==========================================================================

  /**
   * Get current session statistics
   */
  getSessionStats(): {
    sessionId: string;
    metricsCount: number;
    analyticsCount: number;
    performanceCount: number;
    errorCount: number;
  } {
    return {
      sessionId: this.sessionId,
      metricsCount: this.metricsBuffer.length,
      analyticsCount: this.analyticsBuffer.length,
      performanceCount: this.performanceBuffer.length,
      errorCount: this.errorBuffer.length,
    };
  }

  /**
   * Get stored monitoring data (for debugging)
   */
  async getStoredData(): Promise<any[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const monitoringKeys = allKeys
        .filter((key) => key.startsWith('@siFia:monitoring:'))
        .sort()
        .reverse()
        .slice(0, 10);

      const data = await AsyncStorage.multiGet(monitoringKeys);
      return data
        .map(([_, value]) => (value ? JSON.parse(value) : null))
        .filter(Boolean);
    } catch (error) {
      Logger.error('Failed to get stored monitoring data', error as Error, {
        component: 'monitoring',
      });
      return [];
    }
  }

  /**
   * Clear all monitoring data
   */
  async clearData(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const monitoringKeys = allKeys.filter((key) =>
        key.startsWith('@siFia:monitoring:')
      );
      await AsyncStorage.multiRemove(monitoringKeys);
      
      this.metricsBuffer = [];
      this.analyticsBuffer = [];
      this.performanceBuffer = [];
      this.errorBuffer = [];
      
      Logger.info('Monitoring data cleared', { component: 'monitoring' });
    } catch (error) {
      Logger.error('Failed to clear monitoring data', error as Error, {
        component: 'monitoring',
      });
    }
  }

  /**
   * Cleanup on app close
   */
  async cleanup(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const monitoring = new MonitoringService();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Track a metric
 */
export function trackMetric(
  name: string,
  value: number,
  metadata?: Record<string, any>
): void {
  monitoring.trackMetric(name, value, metadata);
}

/**
 * Track an event
 */
export function trackEvent(
  event: string,
  properties?: Record<string, any>,
  userId?: string
): void {
  monitoring.trackEvent(event, properties, userId);
}

/**
 * Track an error
 */
export function trackError(
  error: Error,
  context: string,
  severity?: 'low' | 'medium' | 'high' | 'critical',
  metadata?: Record<string, any>,
  userId?: string
): void {
  monitoring.trackError(error, context, severity, metadata, userId);
}

/**
 * Start a performance timer
 */
export function startTimer(operation: string): (success?: boolean, metadata?: Record<string, any>) => void {
  return monitoring.startTimer(operation);
}

/**
 * Track screen view
 */
export function trackScreenView(screenName: string, userId?: string): void {
  monitoring.trackScreenView(screenName, userId);
}

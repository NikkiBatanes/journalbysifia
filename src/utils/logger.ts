/**
 * Enterprise-Grade Logger Service
 * Provides structured logging with production-ready error tracking
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  metadata?: LogMetadata;
  component?: string;
  userId?: string;
}

interface LogMetadata {
  [key: string]: any;
}

class Logger {
  private static instance: Logger;
  private isProduction: boolean;
  private logBuffer: LogEntry[] = [];

  private constructor() {
    this.isProduction = !__DEV__;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Debug level - Development only
   */
  debug(message: string, meta?: LogMetadata): void {
    if (!this.isProduction) {
      console.log(`[DEBUG] ${message}`, meta || '');
    }
  }

  /**
   * Info level - General information
   */
  info(message: string, meta?: LogMetadata): void {
    if (!this.isProduction) {
      console.log(`[INFO] ${message}`, meta || '');
    } else {
      // Production: Send to analytics service
      this.sendToAnalytics('info', message, meta);
    }
  }

  /**
   * Warning level - Potential issues
   */
  warn(message: string, meta?: LogMetadata): void {
    console.warn(`[WARN] ${message}`, meta || '');

    if (this.isProduction) {
      this.sendToAnalytics('warn', message, meta);
    }
  }

  /**
   * Error level - Critical issues
   */
  error(message: string, error?: Error, meta?: LogMetadata): void {
    console.error(`[ERROR] ${message}`, error || '', meta || '');

    if (this.isProduction) {
      this.sendToErrorTracking(message, error, meta);
    }
  }

  /**
   * Send logs to analytics service (production)
   */
  private sendToAnalytics(level: LogLevel, message: string, meta?: LogMetadata): void {
    // TODO: Integrate with your analytics service
    // Example: analytics.track('app_log', { level, message, ...meta });
  }

  /**
   * Send errors to error tracking service (production)
   */
  private sendToErrorTracking(message: string, error?: Error, metadata?: LogMetadata): void {
    // TODO: Integrate with Sentry/Bugsnag
    // Example: Sentry.captureException(error, { tags: { message, ...metadata } });

    // For now, use global error tracker if available
    const globalObj = (typeof globalThis !== 'undefined' ? globalThis : {}) as any;
    if (globalObj.errorTracker) {
      globalObj.errorTracker.captureException(error || new Error(message), {
        message,
        ...metadata,
      });
    }
  }

  /**
   * Get recent log entries for debugging
   */
  getRecentLogs(count = 10): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Clear log buffer
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logBuffer.filter((entry: LogEntry) => entry.level === level);
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2);
  }

  /**
   * Onboarding-specific logging
   */
  onboarding = {
    navigation: (from: string, to: string, metadata?: LogMetadata) => {
      this.info(`Navigation: ${from} → ${to}`, { from, to, ...metadata });
    },

    stepCompleted: (step: string, duration?: number, metadata?: LogMetadata) => {
      this.info(`Step completed: ${step}`, { step, duration, ...metadata });
    },

    error: (step: string, error: Error, metadata?: LogMetadata) => {
      this.error(`Error in ${step}`, error, { step, ...metadata });
    },

    userAction: (action: string, metadata?: LogMetadata) => {
      this.info(`User action: ${action}`, { action, ...metadata });
    },

    performance: (operation: string, duration: number, metadata?: LogMetadata) => {
      this.info(`Performance: ${operation}`, { operation, duration, ...metadata });
    },
  };
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export for testing
export { Logger };

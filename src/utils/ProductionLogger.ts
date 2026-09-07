/**
 * Production-Ready Logger Service
 * Enterprise-grade logging with complete production stripping capability
 *
 * Features:
 * - Zero console output in production builds
 * - Structured logging with metadata
 * - Error tracking integration ready
 * - Performance monitoring
 * - User context tracking
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogMetadata {
  [key: string]: unknown;
  userId?: string;
  screen?: string;
  component?: string;
  action?: string;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
    name: string;
    code?: string;
    details?: string;
    hint?: string;
    status?: number;
  };
}

export interface LogEntry {
  level: LogLevel;
  levelName: string;
  message: string;
  timestamp: string;
  metadata?: LogMetadata;
}

interface ErrorTracker {
  captureException(error: Error, context?: Record<string, unknown>): void;
  captureMessage(message: string, level: string, context?: Record<string, unknown>): void;
}

class ProductionLogger {
  private isDevelopment: boolean;
  private minLevel: LogLevel;
  private errorTracker?: ErrorTracker;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 100;

  constructor() {
    this.isDevelopment = __DEV__;
    this.minLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  /**
   * Set error tracking service (Sentry, Bugsnag, etc.)
   */
  setErrorTracker(tracker: ErrorTracker): void {
    this.errorTracker = tracker;
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  private createLogEntry(level: LogLevel, message: string, metadata?: LogMetadata): LogEntry {
    return {
      level,
      levelName: LogLevel[level],
      message,
      timestamp: new Date().toISOString(),
      metadata,
    };
  }

  private formatForConsole(entry: LogEntry): string {
    const emoji = {
      [LogLevel.DEBUG]: '🔍',
      [LogLevel.INFO]: 'ℹ️',
      [LogLevel.WARN]: '⚠️',
      [LogLevel.ERROR]: '❌',
      [LogLevel.FATAL]: '💀',
    };

    const metaStr = entry.metadata ? ` | ${JSON.stringify(entry.metadata)}` : '';
    return `${emoji[entry.level]} [${entry.levelName}] ${entry.message}${metaStr}`;
  }

  private outputToConsole(entry: LogEntry): void {
    if (!this.isDevelopment) {
      // In production, only output FATAL errors
      if (entry.level === LogLevel.FATAL) {
        console.error(this.formatForConsole(entry));
      }
      return;
    }

    // Development: output to console with appropriate method (reduced verbosity)
    const formatted = this.formatForConsole(entry);

    // Filter out noisy components in development
    const noisyComponents = ['StoreKit', 'NotificationDeliveryService', 'DailyNotificationScheduler', 'PushNotification', 'notificationSetup', 'useNotificationBadge', 'faithPointsService', 'useCrossComponentSync', 'TierRestriction'];
    const noisyPatterns = ['🧹 Clearing old cached transaction', '🔄 Checking subscription status', 'Setting up real-time notification subscription', 'Badge count updated', 'Processing pending notifications', 'Transaction recorded', 'BEFORE milestone check', 'AFTER milestone check', 'BEFORE return statement', 'Events suppressed', 'Events disabled', 'Guard check', 'BEFORE Promise.all', 'AFTER Promise.all', 'hasTierAccess check'];
    const isNoisy = entry.metadata?.component && noisyComponents.some(noisy =>
      formatted.includes(`[${noisy}]`)
    ) || noisyPatterns.some(pattern => formatted.includes(pattern));

    // Only show WARN and ERROR in development, plus non-noisy INFO
    switch (entry.level) {
      case LogLevel.DEBUG:
        // Only show DEBUG in development if not from noisy components
        if (!isNoisy) {
          console.log(formatted);
        }
        break;
      case LogLevel.INFO:
        // Only show INFO in development if not from noisy components
        if (!isNoisy) {
          console.log(formatted);
        }
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
    }
  }

  private sendToErrorTracker(entry: LogEntry, error?: Error): void {
    if (!this.errorTracker) {
      return;
    }

    if (error) {
      this.errorTracker.captureException(error, {
        message: entry.message,
        level: entry.levelName,
        ...entry.metadata,
      });
    } else {
      this.errorTracker.captureMessage(
        entry.message,
        entry.levelName.toLowerCase(),
        entry.metadata
      );
    }
  }

  /**
   * Debug level - Development only, most verbose
   */
  debug(message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog(LogLevel.DEBUG)) {
      return;
    }

    const entry = this.createLogEntry(LogLevel.DEBUG, message, metadata);
    this.addToBuffer(entry);
    this.outputToConsole(entry);
  }

  /**
   * Info level - General information
   */
  info(message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog(LogLevel.INFO)) {
      return;
    }

    const entry = this.createLogEntry(LogLevel.INFO, message, metadata);
    this.addToBuffer(entry);
    this.outputToConsole(entry);
  }

  /**
   * Warning level - Potential issues that don't break functionality
   */
  warn(message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog(LogLevel.WARN)) {
      return;
    }

    const entry = this.createLogEntry(LogLevel.WARN, message, metadata);
    this.addToBuffer(entry);
    this.outputToConsole(entry);

    // Send warnings to error tracker in production
    if (!this.isDevelopment) {
      this.sendToErrorTracker(entry);
    }
  }

  /**
   * Error level - Errors that affect functionality but app continues
   */
  error(message: string, error?: Error | unknown, metadata?: LogMetadata): void {
    if (!this.shouldLog(LogLevel.ERROR)) {
      return;
    }

    const errorMeta: LogMetadata = {
      ...metadata,
    };

    if (error instanceof Error) {
      errorMeta.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    } else if (error && typeof error === 'object') {
      const value = error as Record<string, unknown>;
      errorMeta.error = {
        message: typeof value.message === 'string' ? value.message : JSON.stringify(value),
        name: typeof value.name === 'string' ? value.name : 'Unknown',
        code: typeof value.code === 'string' ? value.code : undefined,
        details: typeof value.details === 'string' ? value.details : undefined,
        hint: typeof value.hint === 'string' ? value.hint : undefined,
        status: typeof value.status === 'number' ? value.status : undefined,
      };
    } else if (error) {
      errorMeta.error = { message: String(error), name: 'Unknown' };
    }

    const entry = this.createLogEntry(LogLevel.ERROR, message, errorMeta);
    this.addToBuffer(entry);
    this.outputToConsole(entry);

    // Always send errors to error tracker
    this.sendToErrorTracker(entry, error instanceof Error ? error : undefined);
  }

  /**
   * Fatal level - Critical errors that may crash the app
   */
  fatal(message: string, error?: Error | unknown, metadata?: LogMetadata): void {
    const errorMeta: LogMetadata = {
      ...metadata,
    };

    if (error instanceof Error) {
      errorMeta.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    } else if (error) {
      errorMeta.error = { message: String(error), name: 'Unknown' };
    }

    const entry = this.createLogEntry(LogLevel.FATAL, message, errorMeta);
    this.addToBuffer(entry);
    this.outputToConsole(entry);

    // Always send fatal errors to error tracker
    this.sendToErrorTracker(entry, error instanceof Error ? error : undefined);
  }

  /**
   * Get recent logs for debugging
   */
  getRecentLogs(count = 50): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logBuffer.filter(entry => entry.level === level);
  }

  /**
   * Clear log buffer
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Export logs as JSON string
   */
  exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2);
  }

  // ==========================================
  // Convenience Methods for Common Patterns
  // ==========================================

  /**
   * Log screen navigation
   */
  navigation(from: string, to: string, metadata?: LogMetadata): void {
    this.info(`Navigation: ${from} → ${to}`, {
      ...metadata,
      from,
      to,
      action: 'navigation',
    });
  }

  /**
   * Log API calls
   */
  api(method: string, endpoint: string, status?: number, metadata?: LogMetadata): void {
    const isError = status && status >= 400;
    const message = `API ${method} ${endpoint}${status ? ` [${status}]` : ''}`;

    if (isError) {
      this.error(message, undefined, { ...metadata, method, endpoint, status });
    } else {
      this.debug(message, { ...metadata, method, endpoint, status });
    }
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, metadata?: LogMetadata): void {
    const isSlow = duration > 1000;
    const message = `${operation} took ${duration}ms`;

    if (isSlow) {
      this.warn(message, { ...metadata, operation, duration, slow: true });
    } else {
      this.debug(message, { ...metadata, operation, duration });
    }
  }

  /**
   * Log user actions
   */
  userAction(action: string, metadata?: LogMetadata): void {
    this.info(`User action: ${action}`, { ...metadata, action });
  }

  /**
   * Log authentication events
   */
  auth(event: string, success: boolean, metadata?: LogMetadata): void {
    const message = `Auth: ${event} ${success ? 'succeeded' : 'failed'}`;
    if (success) {
      this.info(message, { ...metadata, event, success });
    } else {
      this.error(message, undefined, { ...metadata, event, success });
    }
  }

  /**
   * Log database operations
   */
  database(operation: string, table: string, success: boolean, metadata?: LogMetadata): void {
    const message = `DB ${operation} on ${table} ${success ? 'succeeded' : 'failed'}`;
    if (success) {
      this.debug(message, { ...metadata, operation, table, success });
    } else {
      this.error(message, undefined, { ...metadata, operation, table, success });
    }
  }
}

// Export singleton instance
export const Logger = new ProductionLogger();

// Export convenience functions for easy migration
export const logDebug = (msg: string, meta?: LogMetadata) => Logger.debug(msg, meta);
export const logInfo = (msg: string, meta?: LogMetadata) => Logger.info(msg, meta);
export const logWarn = (msg: string, meta?: LogMetadata) => Logger.warn(msg, meta);
export const logError = (msg: string, err?: Error | unknown, meta?: LogMetadata) => Logger.error(msg, err, meta);
export const logFatal = (msg: string, err?: Error | unknown, meta?: LogMetadata) => Logger.fatal(msg, err, meta);

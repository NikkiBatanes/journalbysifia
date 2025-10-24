/**
 * Enterprise-Grade Logging Service
 * Replaces console.log statements with structured, level-based logging
 * Supports development and production environments with appropriate output
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

interface LogMetadata {
  [key: string]: unknown;
  timestamp?: string;
  userId?: string;
  screen?: string;
  component?: string;
  action?: string;
}

class EnterpriseLogger {
  private isDevelopment: boolean;
  private minLevel: LogLevel;

  constructor() {
    this.isDevelopment = __DEV__;
    this.minLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    const currentLevelIndex = levels.indexOf(this.minLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, metadata?: LogMetadata): string {
    const timestamp = new Date().toISOString();
    const metaString = metadata ? ` | ${JSON.stringify(metadata)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaString}`;
  }

  private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, metadata);

    // In development, use console methods for better DevTools integration
    if (this.isDevelopment) {
      switch (level) {
        case LogLevel.DEBUG:
          console.log(`🔍 ${formattedMessage}`);
          break;
        case LogLevel.INFO:
          console.info(`ℹ️ ${formattedMessage}`);
          break;
        case LogLevel.WARN:
          console.warn(`⚠️ ${formattedMessage}`);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(`❌ ${formattedMessage}`);
          break;
      }
    } else {
      // In production, send to logging service (e.g., Sentry, LogRocket)
      // For now, only log errors and fatal issues
      if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
        console.error(formattedMessage);
        // TODO: Send to remote logging service
      }
    }
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, error?: Error | unknown, metadata?: LogMetadata): void {
    const errorMeta: LogMetadata = {
      ...metadata,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };
    this.log(LogLevel.ERROR, message, errorMeta);
  }

  fatal(message: string, error?: Error | unknown, metadata?: LogMetadata): void {
    const errorMeta: LogMetadata = {
      ...metadata,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };
    this.log(LogLevel.FATAL, message, errorMeta);
  }

  // Convenience methods for common use cases
  screen(screenName: string, action: string, metadata?: LogMetadata): void {
    this.info(`Screen: ${screenName} - ${action}`, {
      ...metadata,
      screen: screenName,
      action,
    });
  }

  api(endpoint: string, method: string, status?: number, metadata?: LogMetadata): void {
    const level = status && status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, `API: ${method} ${endpoint}`, {
      ...metadata,
      endpoint,
      method,
      status,
    });
  }

  performance(operation: string, duration: number, metadata?: LogMetadata): void {
    const level = duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
    this.log(level, `Performance: ${operation} took ${duration}ms`, {
      ...metadata,
      operation,
      duration,
    });
  }
}

// Export singleton instance
export const logger = new EnterpriseLogger();

// Export convenience functions for easy migration from console.log
export const logDebug = (message: string, meta?: LogMetadata) => logger.debug(message, meta);
export const logInfo = (message: string, meta?: LogMetadata) => logger.info(message, meta);
export const logWarn = (message: string, meta?: LogMetadata) => logger.warn(message, meta);
export const logError = (message: string, error?: Error | unknown, meta?: LogMetadata) => logger.error(message, error, meta);
export const logFatal = (message: string, error?: Error | unknown, meta?: LogMetadata) => logger.fatal(message, error, meta);

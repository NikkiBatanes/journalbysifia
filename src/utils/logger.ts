/**
 * Enterprise-Grade Logger Service
 * Provides structured logging with production-ready error tracking
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMetadata {
  [key: string]: any;
}

class Logger {
  private static instance: Logger;
  private isProduction: boolean;

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
  private sendToErrorTracking(message: string, error?: Error, meta?: LogMetadata): void {
    // TODO: Integrate with Sentry/Bugsnag
    // Example: Sentry.captureException(error, { tags: { message, ...meta } });
  }

  /**
   * Onboarding-specific logging
   */
  onboarding = {
    navigation: (from: string, to: string, meta?: LogMetadata) => {
      this.info(`[Onboarding] Navigation: ${from} → ${to}`, meta);
    },
    
    stepCompleted: (step: string, duration?: number, meta?: LogMetadata) => {
      this.info(`[Onboarding] Step completed: ${step}`, { duration, ...meta });
    },
    
    error: (step: string, error: Error, meta?: LogMetadata) => {
      this.error(`[Onboarding] Error in ${step}`, error, meta);
    },
    
    userAction: (action: string, meta?: LogMetadata) => {
      this.info(`[Onboarding] User action: ${action}`, meta);
    },
  };
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export for testing
export { Logger };

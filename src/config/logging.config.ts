/**
 * Logging Configuration
 * Central configuration for logging behavior across environments
 */

import { LogLevel, Logger } from '../utils/ProductionLogger';

export interface LoggingConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableErrorTracking: boolean;
  enablePerformanceTracking: boolean;
  bufferSize: number;
}

/**
 * Development logging configuration
 */
export const developmentConfig: LoggingConfig = {
  minLevel: LogLevel.DEBUG,
  enableConsole: true,
  enableErrorTracking: false,
  enablePerformanceTracking: true,
  bufferSize: 100,
};

/**
 * Production logging configuration
 */
export const productionConfig: LoggingConfig = {
  minLevel: LogLevel.WARN,
  enableConsole: false, // No console output in production
  enableErrorTracking: true,
  enablePerformanceTracking: false,
  bufferSize: 50,
};

/**
 * Get current environment config
 */
export function getLoggingConfig(): LoggingConfig {
  return __DEV__ ? developmentConfig : productionConfig;
}

/**
 * Initialize logger with environment-specific configuration
 */
export function initializeLogger(): void {
  const config = getLoggingConfig();
  Logger.setMinLevel(config.minLevel);

  // TODO: Initialize error tracking service (Sentry, Bugsnag, etc.)
  // if (config.enableErrorTracking) {
  //   const errorTracker = initializeSentry();
  //   Logger.setErrorTracker(errorTracker);
  // }
}

/**
 * Categories for structured logging
 */
export const LogCategory = {
  AUTH: 'auth',
  API: 'api',
  DATABASE: 'database',
  NAVIGATION: 'navigation',
  ONBOARDING: 'onboarding',
  PAYMENT: 'payment',
  STORAGE: 'storage',
  UI: 'ui',
  PERFORMANCE: 'performance',
  ERROR: 'error',
} as const;

export type LogCategoryType = typeof LogCategory[keyof typeof LogCategory];

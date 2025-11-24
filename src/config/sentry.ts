/**
 * Sentry Configuration
 * Error tracking and performance monitoring
 */

import * as Sentry from '@sentry/react-native';
import { Logger } from '../utils/ProductionLogger';
import { ENV } from './environment';

// Check if Sentry is available and initialized
const isSentryAvailable = (): boolean => {
  try {
    return typeof Sentry !== 'undefined' && typeof Sentry.captureException === 'function';
  } catch {
    return false;
  }
};

// Initialize Sentry
export const initializeSentry = () => {
  // Skip if no Sentry DSN is configured
  if (!ENV.SENTRY_DSN || ENV.SENTRY_DSN.includes('your_')) {
    Logger.debug('[Sentry] No Sentry DSN configured - skipping initialization', { component: 'sentry' });
    return;
  }

  Sentry.init({
    // Use environment variable for DSN
    dsn: ENV.SENTRY_DSN,

    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // Adjust this value in production (0.1 = 10%)
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,

    // Enable automatic session tracking
    enableAutoSessionTracking: true,

    // Session timeout in milliseconds
    sessionTrackingIntervalMillis: 30000,

    // Enable native crash handling
    enableNative: true,

    // Environment
    environment: __DEV__ ? 'development' : 'production',

    // Release version
    release: 'siFia@1.2.0',

    // Distribution
    dist: '3',

    // Send PII for better debugging (disable in production if needed)
    sendDefaultPii: !__DEV__,

    // Enable Logs
    enableLogs: true,

    // Configure Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Integrations - using current Sentry SDK API
    integrations: [
      Sentry.mobileReplayIntegration(),
      Sentry.feedbackIntegration(),
    ],

    // Before send hook - filter sensitive data
    beforeSend(event, _hint) {
      // Filter out sensitive information
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }

      // Filter sensitive breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.filter(breadcrumb => {
          // Remove breadcrumbs with sensitive data
          return !breadcrumb.message?.includes('password') &&
                 !breadcrumb.message?.includes('token');
        });
      }

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Network errors
      'Network request failed',
      'Failed to fetch',

      // React Navigation errors
      'The action',

      // Common mobile errors
      'Aborted',
      'cancelled',

      // WebSocket/Supabase errors that cause NSInternalInconsistencyException
      'RCTCallableJSModules is not set',
      'websocketClosed',
      'WebSocket connection closed',
      'RCTWebSocketModule',
      'NSInternalInconsistencyException',

      // Supabase realtime errors
      'realtime subscription error',
      'subscription already closed',
      'channel already closed',
    ],
  });

  Logger.debug('[Sentry] Initialized successfully', { component: 'sentry' });
};

// Set user context
export const setSentryUser = (userId: string, email?: string) => {
  if (!isSentryAvailable()) {
    Logger.debug('[Sentry] Sentry not available - skipping user context', { component: 'sentry' });
    return;
  }

  Sentry.setUser({
    id: userId,
    // Don't include email in production for privacy
    ...(email && __DEV__ ? { email } : {}),
  });
};

// Clear user context (on logout)
export const clearSentryUser = () => {
  if (!isSentryAvailable()) {
    Logger.debug('[Sentry] Sentry not available - skipping user context clear', { component: 'sentry' });
    return;
  }

  Sentry.setUser(null);
};

// Add breadcrumb
export const addSentryBreadcrumb = (message: string, category: string, data?: Record<string, any>) => {
  if (!isSentryAvailable()) {
    Logger.debug('[Sentry] Sentry not available - skipping breadcrumb', { component: 'sentry' });
    return;
  }

  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
  });
};

// Capture exception manually
export const captureSentryException = (error: Error, context?: Record<string, any>) => {
  if (!isSentryAvailable()) {
    Logger.debug('[Sentry] Sentry not available - logging exception locally', { component: 'sentry' });
    Logger.error('Unhandled error (Sentry unavailable)', error, { component: 'sentry' });
    return;
  }

  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  });
};

// Capture message
export const captureSentryMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  if (!isSentryAvailable()) {
    Logger.debug('[Sentry] Sentry not available - logging message locally', { component: 'sentry' });
    Logger.info(`[Sentry Message] ${message}`, { component: 'sentry' });
    return;
  }

  Sentry.captureMessage(message, level);
};

// Start span for performance monitoring (replaces deprecated startTransaction)
export const startSentrySpan = (name: string, op: string, callback: () => void | Promise<void>) => {
  if (!isSentryAvailable()) {
    Logger.debug('[Sentry] Sentry not available - executing callback without span', { component: 'sentry' });
    return callback();
  }

  return Sentry.startSpan(
    {
      name,
      op,
    },
    callback
  );
};

export default Sentry;

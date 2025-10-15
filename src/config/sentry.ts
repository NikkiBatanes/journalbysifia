/**
 * Sentry Configuration
 * Error tracking and performance monitoring
 */

import * as Sentry from '@sentry/react-native';

// Initialize Sentry
export const initializeSentry = () => {
  if (__DEV__) {
    console.log('[Sentry] Skipping initialization in development mode');
    return;
  }

  Sentry.init({
    // TODO: Replace with your actual Sentry DSN
    // Get from: https://sentry.io/settings/YOUR_ORG/projects/YOUR_PROJECT/keys/
    dsn: 'https://YOUR_DSN@sentry.io/YOUR_PROJECT_ID',
    
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
    
    // Release version - TODO: Update with actual version from package.json
    release: 'siFia@1.0.0',
    
    // Distribution
    dist: '1',
    
    // Integrations - using current Sentry SDK API
    integrations: [
      // React Navigation integration for performance tracking
      // Uncomment and configure when you set up navigation instrumentation:
      // Sentry.reactNavigationIntegration(),
    ],
    
    // Before send hook - filter sensitive data
    beforeSend(event, hint) {
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
    ],
  });

  console.log('[Sentry] Initialized successfully');
};

// Set user context
export const setSentryUser = (userId: string, email?: string) => {
  Sentry.setUser({
    id: userId,
    // Don't include email in production for privacy
    ...(email && __DEV__ ? { email } : {}),
  });
};

// Clear user context (on logout)
export const clearSentryUser = () => {
  Sentry.setUser(null);
};

// Add breadcrumb
export const addSentryBreadcrumb = (message: string, category: string, data?: Record<string, any>) => {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
  });
};

// Capture exception manually
export const captureSentryException = (error: Error, context?: Record<string, any>) => {
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  });
};

// Capture message
export const captureSentryMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  Sentry.captureMessage(message, level);
};

// Start span for performance monitoring (replaces deprecated startTransaction)
export const startSentrySpan = (name: string, op: string, callback: () => void | Promise<void>) => {
  return Sentry.startSpan(
    {
      name,
      op,
    },
    callback
  );
};

export default Sentry;

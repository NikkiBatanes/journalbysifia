/**
 * Payment Failure Logger - Comprehensive Payment Error Tracking
 *
 * This utility provides detailed logging for payment failures to help with debugging
 * and monitoring of Apple Store Kit payment issues.
 */

import { Logger } from './ProductionLogger';

export interface PaymentFailureContext {
  userId: string;
  productId: string;
  screen: 'sales_offer' | 'trial_offer';
  action: 'purchase' | 'restore' | 'validate' | 'initialize';
  error: Error;
  timestamp: Date;
  deviceInfo?: {
    platform: string;
    version: string;
    isSandbox: boolean;
  };
  retryCount?: number;
  networkStatus?: {
    connected: boolean;
    type: string;
    strength?: string;
  };
  userJourney?: {
    source: string;
    previousScreen?: string;
    onboardingFlow: boolean;
  };
}

export interface PaymentFailureAnalysis {
  category: 'network' | 'product_config' | 'user_cancelled' | 'server_error' | 'validation' | 'timeout' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction: string;
  canRetry: boolean;
  userFriendlyMessage: string;
}

export class PaymentFailureLogger {

  /**
   * Log comprehensive payment failure with analysis
   */
  static logPaymentFailure(context: PaymentFailureContext): PaymentFailureAnalysis {
    const analysis = this.analyzePaymentFailure(context);

    // Log the failure with full context
    Logger.error('[PaymentLogger] 💳 Payment failure detected', context.error, {
      component: 'PaymentFailureLogger',
      userId: context.userId.substring(0, 10) + '...', // Privacy
      productId: context.productId,
      screen: context.screen,
      action: context.action,
      category: analysis.category,
      severity: analysis.severity,
      retryCount: context.retryCount || 0,
      canRetry: analysis.canRetry,
      timestamp: context.timestamp.toISOString(),
      deviceInfo: context.deviceInfo,
      networkStatus: context.networkStatus,
      userJourney: context.userJourney,
      errorMessage: context.error.message,
      errorStack: context.error.stack,
    });

    // Log user-friendly message separately for UX team
    Logger.info('[PaymentLogger] User-friendly message', {
      component: 'PaymentFailureLogger',
      message: analysis.userFriendlyMessage,
      suggestedAction: analysis.suggestedAction,
    });

    return analysis;
  }

  /**
   * Analyze payment failure and provide actionable insights
   */
  private static analyzePaymentFailure(context: PaymentFailureContext): PaymentFailureAnalysis {
    const errorMessage = context.error.message.toLowerCase();

    // Network-related failures
    if (this.containsAny(errorMessage, ['network', 'connection', 'timeout', 'unreachable', 'dns', 'socket'])) {
      return {
        category: 'network',
        severity: context.retryCount && context.retryCount > 2 ? 'high' : 'medium',
        suggestedAction: 'Check internet connection and retry',
        canRetry: true,
        userFriendlyMessage: 'Payment couldn\'t be processed due to network issues. Please check your connection and try again.',
      };
    }

    // User cancelled
    if (this.containsAny(errorMessage, ['cancelled', 'user cancel', 'payment cancelled', 'skerrordomain error 2'])) {
      return {
        category: 'user_cancelled',
        severity: 'low',
        suggestedAction: 'No action needed - user intentionally cancelled',
        canRetry: false,
        userFriendlyMessage: 'Payment was cancelled. You can try again anytime.',
      };
    }

    // Product configuration issues
    if (this.containsAny(errorMessage, ['product', 'sku', 'invalid product', 'not available', 'not found'])) {
      return {
        category: 'product_config',
        severity: 'critical',
        suggestedAction: 'Check App Store Connect product configuration',
        canRetry: false,
        userFriendlyMessage: 'This subscription option is currently unavailable. Please try a different plan or contact support.',
      };
    }

    // Server validation failures
    if (this.containsAny(errorMessage, ['server', 'validation', 'receipt', 'supabase'])) {
      return {
        category: 'server_error',
        severity: 'high',
        suggestedAction: 'Check server logs and Supabase Edge Function',
        canRetry: true,
        userFriendlyMessage: 'Payment verification failed. Please try again or contact support if the issue continues.',
      };
    }

    // Timeout issues
    if (this.containsAny(errorMessage, ['timeout', 'timed out', 'no response'])) {
      return {
        category: 'timeout',
        severity: context.retryCount && context.retryCount > 1 ? 'high' : 'medium',
        suggestedAction: 'Increase timeout or improve network resilience',
        canRetry: true,
        userFriendlyMessage: 'Payment is taking longer than expected. Please try again.',
      };
    }

    // Apple-specific errors
    if (this.containsAny(errorMessage, ['skerror', 'storekit', 'app store'])) {
      return {
        category: 'validation',
        severity: 'medium',
        suggestedAction: 'Check Apple Store configuration and sandbox setup',
        canRetry: true,
        userFriendlyMessage: 'App Store payment processing failed. Please try again.',
      };
    }

    // Unknown errors
    return {
      category: 'unknown',
      severity: 'medium',
      suggestedAction: 'Investigate error logs and stack trace',
      canRetry: true,
      userFriendlyMessage: 'An unexpected error occurred. Please try again or contact support.',
    };
  }

  /**
   * Check if message contains any of the search terms
   */
  private static containsAny(message: string, terms: string[]): boolean {
    return terms.some(term => message.includes(term));
  }

  /**
   * Log successful payment for comparison and analytics
   */
  static logPaymentSuccess(context: {
    userId: string;
    productId: string;
    screen: 'sales_offer' | 'trial_offer';
    transactionId: string;
    amount?: number;
    currency?: string;
    duration: number; // Time in ms from start to success
  }): void {
    Logger.info('[PaymentLogger] ✅ Payment successful', {
      component: 'PaymentFailureLogger',
      userId: context.userId.substring(0, 10) + '...', // Privacy
      productId: context.productId,
      screen: context.screen,
      transactionId: context.transactionId.substring(0, 10) + '...',
      amount: context.amount,
      currency: context.currency,
      duration: context.duration,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log retry attempt for monitoring
   */
  static logRetryAttempt(context: PaymentFailureContext, attemptNumber: number, maxAttempts: number): void {
    Logger.info('[PaymentLogger] 🔄 Payment retry attempt', {
      component: 'PaymentFailureLogger',
      userId: context.userId.substring(0, 10) + '...',
      productId: context.productId,
      attempt: `${attemptNumber}/${maxAttempts}`,
      originalError: context.error.message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get payment failure statistics (for monitoring dashboard)
   */
  static getFailureStats(): {
    totalFailures: number;
    failuresByCategory: Record<string, number>;
    failuresBySeverity: Record<string, number>;
    retrySuccessRate: number;
  } {
    // This would typically query a database or logging service
    // For now, return placeholder data
    return {
      totalFailures: 0,
      failuresByCategory: {},
      failuresBySeverity: {},
      retrySuccessRate: 0,
    };
  }
}

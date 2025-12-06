import { Alert } from 'react-native';
import { Logger } from '../utils/ProductionLogger';
import { supabase } from '../services/supabaseClient';

export interface AuthErrorHandlerOptions {
  showUserFeedback?: boolean;
  retryAttempts?: number;
  onAuthRequired?: () => void;
  operationName?: string;
}

export class AuthErrorHandler {
  private static instance: AuthErrorHandler;
  private retryQueue: Map<string, () => Promise<any>> = new Map();

  static getInstance(): AuthErrorHandler {
    if (!AuthErrorHandler.instance) {
      AuthErrorHandler.instance = new AuthErrorHandler();
    }
    return AuthErrorHandler.instance;
  }

  /**
   * Handle API errors with authentication recovery
   */
  async handleApiError(
    error: any,
    options: AuthErrorHandlerOptions = {}
  ): Promise<{ shouldRetry: boolean; handled: boolean }> {
    const {
      showUserFeedback = true,
      retryAttempts = 1,
      onAuthRequired,
      operationName = 'operation',
    } = options;

    // Check if it's an authentication error
    if (this.isAuthError(error)) {
      Logger.warn('🔐 Authentication error detected', {
      component: 'authErrorHandler',
      data: error,
    });

      // Try to refresh session first
      const refreshResult = await this.attemptSessionRefresh();

      if (refreshResult.success) {

        return { shouldRetry: true, handled: true };
      }

      // Session refresh failed - handle logout
      await this.handleAuthenticationRequired(operationName, onAuthRequired, showUserFeedback);
      return { shouldRetry: false, handled: true };
    }

    // Check if it's a network error
    if (this.isNetworkError(error)) {
      Logger.warn('🌐 Network error detected', {
      component: 'authErrorHandler',
      data: error,
    });

      if (showUserFeedback) {
        await this.showNetworkErrorDialog(operationName, retryAttempts);
      }

      return { shouldRetry: retryAttempts > 0, handled: true };
    }

    // Unknown error
    Logger.error('❌ Unhandled API error', error as Error, {
      component: 'authErrorHandler',
    });

    if (showUserFeedback) {
      await this.showGenericErrorDialog(operationName, error);
    }

    return { shouldRetry: false, handled: false };
  }

  /**
   * Check if error is authentication-related
   */
  private isAuthError(error: any): boolean {
    if (!error) {return false;}

    const authErrorCodes = [401, 403];
    const authErrorMessages = [
      'invalid_token',
      'token_expired',
      'unauthorized',
      'forbidden',
      'jwt expired',
      'invalid jwt',
      'authentication required',
      'no active session',
      'please sign in',
      'session expired',
      'invalid session',
      'authentication failed',
    ];

    // Check status code
    if (error.status && authErrorCodes.includes(error.status)) {
      return true;
    }

    // Check error message
    const errorMessage = (error.message || error.error_description || '').toLowerCase();
    const isAuthMessage = authErrorMessages.some(msg => errorMessage.includes(msg));

    if (isAuthMessage) {

      return true;
    }

    return false;
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: any): boolean {
    if (!error) {return false;}

    const networkErrorMessages = [
      'network request failed',
      'network error',
      'connection failed',
      'timeout',
      'no internet',
      'offline',
      'fetch failed',
      'connection timeout',
      'network is unreachable',
      'dns lookup failed',
      'connection refused',
      'socket timeout',
      'request timeout',
      'network timeout',
    ];

    const errorMessage = (error.message || '').toLowerCase();
    return networkErrorMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Attempt to refresh the session
   */
  private async attemptSessionRefresh(): Promise<{ success: boolean; error?: any }> {
    try {

      // First try to get the current session to see if it exists
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession) {
        Logger.warn('⚠️ No current session to refresh', {
      component: 'authErrorHandler',
    });
        return { success: false, error: 'No current session' };
      }

      const { data: { session }, error } = await supabase.auth.refreshSession();

      if (error) {
        Logger.error('❌ Session refresh failed', error as Error, {
      component: 'authErrorHandler',
    });
        return { success: false, error };
      }

      if (!session || !session.access_token) {
        Logger.warn('⚠️ No valid session after refresh', {
      component: 'authErrorHandler',
    });
        return { success: false, error: 'No valid session returned' };
      }

      return { success: true };
    } catch (error) {
      Logger.error('💥 Session refresh exception', error as Error, {
      component: 'authErrorHandler',
    });
      return { success: false, error };
    }
  }

  /**
   * Handle authentication required scenario
   */
  private async handleAuthenticationRequired(
    operationName: string,
    onAuthRequired?: () => void,
    showUserFeedback: boolean = true
  ): Promise<void> {
    if (showUserFeedback) {
      Alert.alert(
        '🔐 Authentication Required',
        `Your session has expired. Please log in again to continue with ${operationName}.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Log In',
            onPress: () => {
              if (onAuthRequired) {
                onAuthRequired();
              } else {
                // Default: sign out to trigger login flow
                supabase.auth.signOut();
              }
            },
            style: 'default',
          },
        ],
        { cancelable: false }
      );
    } else if (onAuthRequired) {
      onAuthRequired();
    }
  }

  /**
   * Show generic error dialog
   */
  private async showGenericErrorDialog(_operationName: string, error: any): Promise<void> {
    return new Promise((resolve) => {
      const rawMessage: string = error?.message || '';
      let userMessage = 'Something went wrong while completing this action. Please try again in a moment.';

      if (rawMessage.includes('Server error: 500')) {
        userMessage = 'We couldn\'t complete this action right now. Please try again in a moment.';
      } else if (rawMessage.includes('AI content policy prevented generation')) {
        userMessage = 'We weren\'t able to create this content. Please rephrase your request and try again.';
      } else if (rawMessage.toLowerCase().includes('network') || rawMessage.toLowerCase().includes('timeout')) {
        userMessage = 'It looks like there was a connection issue. Please check your internet and try again.';
      }

      Alert.alert(
        'Something went wrong',
        userMessage,
        [
          {
            text: 'OK',
            onPress: () => resolve(),
            style: 'default',
          },
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Show network error dialog
   */
  private async showNetworkErrorDialog(operationName: string, retryAttempts: number): Promise<void> {
    return new Promise((resolve) => {
      Alert.alert(
        '🌐 Connection Issue',
        `Unable to complete ${operationName} due to a network issue. Please check your internet connection.`,
        [
          {
            text: 'Cancel',
            onPress: () => resolve(),
            style: 'cancel' as const,
          },
          ...(retryAttempts > 0
            ? [
                {
                  text: 'Retry',
                  onPress: () => resolve(),
                  style: 'default' as const,
                },
              ]
            : []),
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Add operation to retry queue
   */
  addToRetryQueue(operationId: string, operation: () => Promise<any>): void {
    this.retryQueue.set(operationId, operation);
  }

  /**
   * Execute retry queue after successful authentication
   */
  async executeRetryQueue(): Promise<void> {

    for (const [operationId, operation] of this.retryQueue.entries()) {
      try {
        await operation();
        this.retryQueue.delete(operationId);
      } catch (error) {
        Logger.error(`❌ Retry failed for operation ${operationId}:`, {
        component: 'authErrorHandler',
        data: error,
      });
      }
    }
  }

  /**
   * Clear retry queue
   */
  clearRetryQueue(): void {
    this.retryQueue.clear();
  }
}

export const authErrorHandler = AuthErrorHandler.getInstance();

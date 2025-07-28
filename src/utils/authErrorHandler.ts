import { Alert } from 'react-native';
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

    console.log('🔍 Handling API error:', { error, operationName });

    // Check if it's an authentication error
    if (this.isAuthError(error)) {
      console.warn('🔐 Authentication error detected:', error);

      // Try to refresh session first
      const refreshResult = await this.attemptSessionRefresh();

      if (refreshResult.success) {
        console.log('✅ Session refreshed successfully');
        return { shouldRetry: true, handled: true };
      }

      // Session refresh failed - handle logout
      await this.handleAuthenticationRequired(operationName, onAuthRequired, showUserFeedback);
      return { shouldRetry: false, handled: true };
    }

    // Check if it's a network error
    if (this.isNetworkError(error)) {
      console.warn('🌐 Network error detected:', error);

      if (showUserFeedback) {
        await this.showNetworkErrorDialog(operationName, retryAttempts);
      }

      return { shouldRetry: retryAttempts > 0, handled: true };
    }

    // Unknown error
    console.error('❌ Unhandled API error:', error);

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
      console.log('🔍 Detected authentication error:', errorMessage);
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
    ];

    const errorMessage = (error.message || '').toLowerCase();
    return networkErrorMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Attempt to refresh the session
   */
  private async attemptSessionRefresh(): Promise<{ success: boolean; error?: any }> {
    try {
      console.log('🔄 Attempting session refresh...');

      // First try to get the current session to see if it exists
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession) {
        console.warn('⚠️ No current session to refresh');
        return { success: false, error: 'No current session' };
      }

      const { data: { session }, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('❌ Session refresh failed:', error);
        return { success: false, error };
      }

      if (!session || !session.access_token) {
        console.warn('⚠️ No valid session after refresh');
        return { success: false, error: 'No valid session returned' };
      }

      console.log('✅ Session refreshed successfully', {
        hasToken: !!session.access_token,
        expiresAt: session.expires_at,
      });
      return { success: true };
    } catch (error) {
      console.error('💥 Session refresh exception:', error);
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
   * Show network error dialog
   */
  private async showNetworkErrorDialog(
    operationName: string,
    retryAttempts: number
  ): Promise<void> {
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
          ...(retryAttempts > 0 ? [{
            text: 'Retry',
            onPress: () => resolve(),
            style: 'default' as const,
          }] : []),
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Show generic error dialog
   */
  private async showGenericErrorDialog(
    operationName: string,
    error: any
  ): Promise<void> {
    return new Promise((resolve) => {
      const errorMessage = error?.message || 'An unexpected error occurred';

      Alert.alert(
        '⚠️ Error',
        `Failed to complete ${operationName}: ${errorMessage}`,
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
   * Add operation to retry queue
   */
  addToRetryQueue(operationId: string, operation: () => Promise<any>): void {
    this.retryQueue.set(operationId, operation);
  }

  /**
   * Execute retry queue after successful authentication
   */
  async executeRetryQueue(): Promise<void> {
    console.log(`🔄 Executing ${this.retryQueue.size} queued operations...`);

    for (const [operationId, operation] of this.retryQueue.entries()) {
      try {
        await operation();
        this.retryQueue.delete(operationId);
      } catch (error) {
        console.error(`❌ Retry failed for operation ${operationId}:`, error);
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

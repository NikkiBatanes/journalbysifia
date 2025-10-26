import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { supabase } from '../services/supabaseClient';

// Utility functions for error detection
const isNetworkError = (error: any): boolean => {
  if (!error) {return false;}
  const errorMessage = (error.message || error.error_description || '').toLowerCase();
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
  ];
  return networkErrorMessages.some(msg => errorMessage.includes(msg));
};

const isAuthenticationError = (error: any): boolean => {
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
    'session expired',
  ];

  // Check status code
  if (error.status && authErrorCodes.includes(error.status)) {
    return true;
  }

  // Check error message
  const errorMessage = (error.message || error.error_description || '').toLowerCase();
  return authErrorMessages.some(msg => errorMessage.includes(msg));
};

interface AuthStateMonitorProps {
  children: React.ReactNode;
}

/**
 * Enterprise-grade authentication state monitor
 * Handles silent logouts, session expiry, and provides user feedback
 * Enhanced with protection against false positive logouts during legitimate operations
 */
export const AuthStateMonitor: React.FC<AuthStateMonitorProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [lastAuthCheck, setLastAuthCheck] = useState<Date | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [isInActiveOperation, setIsInActiveOperation] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const operationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle silent logout with user notification
  const handleSilentLogout = useCallback(async (message: string) => {
    setIsMonitoring(false); // Prevent multiple alerts

    Alert.alert(
      '🔐 Session Expired',
      message,
      [
        {
          text: 'Log In Again',
          onPress: () => {
            // The auth context will handle the navigation to login screen
            setIsMonitoring(true);
          },
          style: 'default',
        },
      ],
      {
        cancelable: false,
        onDismiss: () => setIsMonitoring(true),
      }
    );
  }, [setIsMonitoring]);

  // Handle session errors with user notification
  const handleSessionError = useCallback(async (message: string) => {
    Alert.alert(
      '⚠️ Authentication Issue',
      message,
      [
        {
          text: 'Retry',
          onPress: () => {},
          style: 'default',
        },
        {
          text: 'Log In Again',
          onPress: () => {
            // The auth context will handle the navigation to login screen
          },
          style: 'destructive',
        },
      ],
      { cancelable: false }
    );
  }, []);

  // Enhanced session validation with operation awareness
  const validateSessionOnAppForeground = useCallback(async () => {
    // Skip validation if user is in the middle of an active operation
    if (isInActiveOperation) {

      return;
    }

    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('❌ Session validation error:', error);
        // Be very tolerant of network errors during foreground validation
        if (isNetworkError(error)) {

          return;
        }
        // Only handle clear authentication errors
        if (isAuthenticationError(error)) {
          // Add additional delay for auth errors to prevent false positives
          await new Promise(resolve => setTimeout(resolve, 3000));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (!retrySession) {
            await handleSessionError('Session validation failed. Please log in again.');
          }
        }
        return;
      }

      if (!currentSession && isAuthenticated) {
        console.warn('⚠️ Potential silent logout detected on app foreground');
        // Enhanced retry logic with longer delays
        await new Promise(resolve => setTimeout(resolve, 5000));
        const { data: { session: retrySession } } = await supabase.auth.getSession();

        if (!retrySession) {
          // Final check - try session refresh before giving up
          try {
            const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
            if (refreshedSession) {

              setLastAuthCheck(new Date());
              return;
            }
          } catch (refreshError) {
            console.error('❌ Session refresh failed:', refreshError);
          }

          await handleSilentLogout('Your session has expired. Please log in again.');
        } else {

          setLastAuthCheck(new Date());
        }
      } else if (currentSession) {

        setLastAuthCheck(new Date());
      }
    } catch (error) {
      console.error('💥 Session validation failed:', error);
      // Never interrupt user for network errors during foreground validation
      if (!isNetworkError(error) && !isInActiveOperation) {
        await handleSessionError('Unable to verify your session. Please check your connection.');
      }
    }
  }, [isAuthenticated, isInActiveOperation, handleSilentLogout, handleSessionError, setLastAuthCheck]);

  // Enhanced periodic session validation with operation awareness
  const validateSessionPeriodically = useCallback(async () => {
    // Skip periodic validation if user is in active operation
    if (isInActiveOperation) {

      return;
    }

    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('❌ Periodic session check error:', error);
        // Be extremely tolerant during periodic checks - don't logout on any errors
        return;
      }

      if (!currentSession && isAuthenticated) {
        console.warn('⚠️ Potential silent logout detected during periodic check');
        // Enhanced retry logic for periodic checks
        try {
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshedSession && !refreshError) {

            setLastAuthCheck(new Date());
            return;
          }
        } catch (refreshError) {
          console.error('❌ Session refresh failed during periodic check:', refreshError);
        }

        // Only logout if we're absolutely sure the session is invalid
        // and it's been more than 30 minutes since last successful check (increased from 10)
        const timeSinceLastCheck = Date.now() - (lastAuthCheck?.getTime() || 0);
        if (timeSinceLastCheck > 30 * 60 * 1000) { // 30 minutes
          await handleSilentLogout('Your session has expired. Please log in again to continue.');
        } else {

        }
      } else if (currentSession) {
        setLastAuthCheck(new Date());
      }
    } catch (error) {
      console.error('💥 Periodic session check failed:', error);
      // Never interrupt user for network errors during periodic checks
    }
  }, [isAuthenticated, isInActiveOperation, handleSilentLogout, setLastAuthCheck, lastAuthCheck]);

  // Enhanced app state monitoring with operation protection
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {

      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // Add delay before validation to allow app to settle
        setTimeout(async () => {
          if (!isInActiveOperation) {

            await validateSessionOnAppForeground();
          } else {

          }
        }, 2000); // 2 second delay to allow app to settle
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [validateSessionOnAppForeground, isInActiveOperation]);

  // Enhanced periodic session validation with longer intervals
  useEffect(() => {
    if (isAuthenticated && isMonitoring) {
      sessionCheckIntervalRef.current = setInterval(async () => {
        await validateSessionPeriodically();
      }, 30 * 60 * 1000); // 30 minutes instead of 15 minutes
    }

    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
    };
  }, [isAuthenticated, isMonitoring, validateSessionPeriodically]);

  // Global operation state management
  useEffect(() => {
    // Listen for React Query operations that might trigger network activity
    const handleOperationStart = () => {
      setIsInActiveOperation(true);

      // Clear any existing timeout
      if (operationTimeoutRef.current) {
        clearTimeout(operationTimeoutRef.current);
      }

      // Set timeout to clear operation state after 30 seconds
      operationTimeoutRef.current = setTimeout(() => {
        setIsInActiveOperation(false);

      }, 30000);
    };

    const handleOperationEnd = () => {
      // Clear timeout and operation state after a brief delay
      setTimeout(() => {
        setIsInActiveOperation(false);

        if (operationTimeoutRef.current) {
          clearTimeout(operationTimeoutRef.current);
        }
      }, 3000); // 3 second grace period
    };

    // Expose global operation handlers
    (global as any).authMonitor = {
      startOperation: handleOperationStart,
      endOperation: handleOperationEnd,
    };

    return () => {
      if (operationTimeoutRef.current) {
        clearTimeout(operationTimeoutRef.current);
      }
      delete (global as any).authMonitor;
    };
  }, []);

  // Monitor authentication state changes
  useEffect(() => {
    if (!isAuthenticated && user) {
      // User was logged in but now isn't - potential silent logout
      console.warn('⚠️ Authentication state mismatch detected');
    }
  }, [isAuthenticated, user]);

  return <>{children}</>;
};

export default AuthStateMonitor;

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
 */
export const AuthStateMonitor: React.FC<AuthStateMonitorProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [lastAuthCheck, setLastAuthCheck] = useState<Date | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Validate session when app comes to foreground (with network error tolerance)
  const validateSessionOnAppForeground = useCallback(async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('❌ Session validation error:', error);
        // Don't immediately logout on network errors - be more tolerant
        if (isNetworkError(error)) {
          console.log('🌐 Network error during session validation, maintaining current state');
          return;
        }
        // Only handle auth errors, not network issues
        if (isAuthenticationError(error)) {
          await handleSessionError('Session validation failed. Please log in again.');
        }
        return;
      }

      if (!currentSession && isAuthenticated) {
        console.warn('⚠️ Silent logout detected on app foreground');
        // Add a small delay and retry once before logging out
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { data: { session: retrySession } } = await supabase.auth.getSession();

        if (!retrySession) {
          await handleSilentLogout('Your session has expired. Please log in again.');
        } else {
          console.log('✅ Session recovered on retry');
          setLastAuthCheck(new Date());
        }
      } else if (currentSession) {
        console.log('✅ Session valid on app foreground');
        setLastAuthCheck(new Date());
      }
    } catch (error) {
      console.error('💥 Session validation failed:', error);
      // Don't interrupt user for network errors during foreground validation
      if (!isNetworkError(error)) {
        await handleSessionError('Unable to verify your session. Please check your connection.');
      }
    }
  }, [isAuthenticated, handleSilentLogout, handleSessionError, setLastAuthCheck]);

  // Periodic session validation (more tolerant)
  const validateSessionPeriodically = useCallback(async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('❌ Periodic session check error:', error);
        // Be very tolerant during periodic checks - don't logout on any errors
        return;
      }

      if (!currentSession && isAuthenticated) {
        console.warn('⚠️ Potential silent logout detected during periodic check');
        // Don't immediately logout - try to refresh session first
        try {
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshedSession && !refreshError) {
            console.log('✅ Session refreshed successfully during periodic check');
            setLastAuthCheck(new Date());
            return;
          }
        } catch (refreshError) {
          console.error('❌ Session refresh failed during periodic check:', refreshError);
        }

        // Only logout if we're absolutely sure the session is invalid
        // and it's been more than 10 minutes since last successful check
        const timeSinceLastCheck = Date.now() - (lastAuthCheck?.getTime() || 0);
        if (timeSinceLastCheck > 10 * 60 * 1000) { // 10 minutes
          await handleSilentLogout('Your session has expired. Please log in again to continue.');
        }
      } else if (currentSession) {
        setLastAuthCheck(new Date());
      }
    } catch (error) {
      console.error('💥 Periodic session check failed:', error);
      // Never interrupt user for network errors during periodic checks
    }
  }, [isAuthenticated, handleSilentLogout, setLastAuthCheck, lastAuthCheck]);

  // Monitor app state changes for session validation
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log('📱 App state changed:', { from: appStateRef.current, to: nextAppState });

      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('🔍 App became active, validating session...');
        await validateSessionOnAppForeground();
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [validateSessionOnAppForeground]);

  // Periodic session validation (reduced frequency - every 15 minutes when app is active)
  useEffect(() => {
    if (isAuthenticated && isMonitoring) {
      sessionCheckIntervalRef.current = setInterval(async () => {
        await validateSessionPeriodically();
      }, 15 * 60 * 1000); // 15 minutes instead of 5 minutes
    }

    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
    };
  }, [isAuthenticated, isMonitoring, validateSessionPeriodically]);

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

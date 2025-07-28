import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { supabase } from '../services/supabaseClient';

interface AuthStateMonitorProps {
  children: React.ReactNode;
}

/**
 * Enterprise-grade authentication state monitor
 * Handles silent logouts, session expiry, and provides user feedback
 */
export const AuthStateMonitor: React.FC<AuthStateMonitorProps> = ({ children }) => {
  const { isAuthenticated, user, session } = useAuth();
  const [lastAuthCheck, setLastAuthCheck] = useState<Date>(new Date());
  const [isMonitoring, setIsMonitoring] = useState(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
  }, []);

  // Periodic session validation (every 5 minutes when app is active)
  useEffect(() => {
    if (isAuthenticated && isMonitoring) {
      sessionCheckIntervalRef.current = setInterval(async () => {
        await validateSessionPeriodically();
      }, 5 * 60 * 1000); // 5 minutes
    }

    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
    };
  }, [isAuthenticated, isMonitoring]);

  // Validate session when app comes to foreground
  const validateSessionOnAppForeground = async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('❌ Session validation error:', error);
        await handleSessionError('Session validation failed. Please log in again.');
        return;
      }

      if (!currentSession && isAuthenticated) {
        console.warn('⚠️ Silent logout detected on app foreground');
        await handleSilentLogout('Your session has expired. Please log in again.');
      } else if (currentSession) {
        console.log('✅ Session valid on app foreground');
        setLastAuthCheck(new Date());
      }
    } catch (error) {
      console.error('💥 Session validation failed:', error);
      await handleSessionError('Unable to verify your session. Please check your connection.');
    }
  };

  // Periodic session validation
  const validateSessionPeriodically = async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('❌ Periodic session check error:', error);
        return; // Don't interrupt user for periodic check errors
      }

      if (!currentSession && isAuthenticated) {
        console.warn('⚠️ Silent logout detected during periodic check');
        await handleSilentLogout('Your session has expired. Please log in again to continue.');
      } else if (currentSession) {
        setLastAuthCheck(new Date());
      }
    } catch (error) {
      console.error('💥 Periodic session check failed:', error);
      // Don't interrupt user for network errors during periodic checks
    }
  };

  // Handle silent logout with user notification
  const handleSilentLogout = async (message: string) => {
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
  };

  // Handle session errors with user notification
  const handleSessionError = async (message: string) => {
    Alert.alert(
      '⚠️ Authentication Issue',
      message,
      [
        {
          text: 'Retry',
          onPress: async () => {
            await validateSessionOnAppForeground();
          },
          style: 'default',
        },
        {
          text: 'Log In Again',
          onPress: () => {
            // Force logout to clear any corrupted state
            supabase.auth.signOut();
          },
          style: 'destructive',
        },
      ],
      { cancelable: false }
    );
  };

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

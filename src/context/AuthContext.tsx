import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Logger } from '../utils/ProductionLogger';
import { safeJsonParse } from '../utils/safeJsonParse';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';

// Types
interface User {
  id: string;
  email: string;
  // Add more user fields as needed
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
  retrying: boolean;
  refreshRetrying: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuthToken: () => Promise<boolean>;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryIntervalId, setRetryIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [refreshRetrying, setRefreshRetrying] = useState(false);
  const [refreshRetryIntervalId, setRefreshRetryIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [refreshRetryCount, setRefreshRetryCount] = useState(0);
  const MAX_REFRESH_RETRIES = 5;

  // Keys for AsyncStorage
  const ACCESS_TOKEN_KEY = 'ACCESS_TOKEN';
  const REFRESH_TOKEN_KEY = 'REFRESH_TOKEN';
  const USER_KEY = 'USER';

  // Robust session validation with retry logic
  const validateSession = useCallback(async (token: string | null) => {
    // For now, always succeed if there is a token (placeholder for real backend call)
    if (token) {
      setIsAuthenticated(true);
      setRetrying(false);
      setError(null);
      if (retryIntervalId) {
        clearInterval(retryIntervalId);
        setRetryIntervalId(null);
      }
    } else {
      setIsAuthenticated(false);
      setUser(null);
      setRetrying(false);
    }
    setLoading(false);
    return true;
  }, [retryIntervalId]);

  // Load persisted auth state on mount
  useEffect(() => {
    const loadAuth = async () => {
      setLoading(true);
      try {
        const [savedToken, savedRefresh, savedUser] = await Promise.all([
          AsyncStorage.getItem(ACCESS_TOKEN_KEY),
          AsyncStorage.getItem(REFRESH_TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (savedToken && savedRefresh && savedUser) {
          setAccessToken(savedToken);
          setRefreshToken(savedRefresh);
          const parsedUser = safeJsonParse<User>(savedUser, {
            fallback: null,
            context: 'AuthContext:loadAuth',
          });
          if (parsedUser) {
            setUser(parsedUser);
          }
          setIsAuthenticated(true);
          // After loading, validate session
          validateSession(savedToken);
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (e) {
        setError('Failed to load authentication state.');
      } finally {
        setLoading(false);
      }
    };
    loadAuth();
    // Cleanup retry interval on unmount
    return () => {
      if (retryIntervalId) {clearInterval(retryIntervalId);}
    };
  }, [retryIntervalId, validateSession]);

  // Login with Supabase authentication
  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {

      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      const result = { data, error: authError };

      // Check for error in the response
      if (result.error) {
        Logger.error('Login error from Supabase', result.error as Error, {
          component: 'AuthContext',
        });
        throw new Error(result.error.message || 'Login failed. Please check your credentials.');
      }

      // Check if we have valid data
      if (!result.data) {
        Logger.error('No data in sign in response', undefined, {
      component: 'AuthContext',
    });
        throw new Error('No response data received from server');
      }

      const { session, user: authUser } = result.data;

      // Validate the response data
      if (!session?.access_token) {
        Logger.error('No access token in response', undefined, {
      component: 'AuthContext',
    });
        throw new Error('Authentication failed: No access token received');
      }

      const { access_token, refresh_token } = session;

      if (!authUser?.id) {
        Logger.error('No user ID in response', undefined, {
      component: 'AuthContext',
    });
        throw new Error('Authentication failed: No user information received');
      }

      // Store all session data atomically
      await Promise.all([
        AsyncStorage.setItem(ACCESS_TOKEN_KEY, access_token),
        AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh_token || ''),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(authUser)),
      ]);

      // Update the auth state
      setAccessToken(access_token);
      setRefreshToken(refresh_token || '');
      setUser({
        id: authUser.id,
        email: authUser.email || email,
      });
      setIsAuthenticated(true);

      return true;
    } catch (e: any) {
      Logger.error('Login error', e as Error, { component: 'AuthContext' });
      const errorMessage = e.message || 'Login failed. Please check your credentials and try again.';
      setError(errorMessage);

      // Clear any partial auth state on failure
      await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      setIsAuthenticated(false);

      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get all keys and filter for todo-related ones
      const allKeys = await AsyncStorage.getAllKeys();
      const todoKeys = allKeys.filter(key =>
        key.includes('todos') ||
        key.includes('journal_entries')
      );

      // Remove auth data and todo data in parallel
      await Promise.all([
        AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]),
        ...(todoKeys.length > 0 ? [AsyncStorage.multiRemove(todoKeys)] : []),
      ]);

      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      setIsAuthenticated(false);
    } catch (e) {
      Logger.error('Logout error', e as Error, { component: 'AuthContext' });
      setError('Logout failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Token refresh logic (replace with real API call)
  const refreshAuthToken = useCallback(async () => {
    if (!refreshToken) {return false;}
    setLoading(true);
    setRefreshRetrying(false);
    setError(null);
    try {
      // Replace with real refresh API call
      // Simulate network error by throwing
      // throw new Error('Network error');
      // Simulated success:
      const newToken = 'fake_access_token_refreshed';
      await AsyncStorage.setItem(ACCESS_TOKEN_KEY, newToken);
      setAccessToken(newToken);
      setIsAuthenticated(true);
      setRefreshRetrying(false);
      setRefreshRetryCount(0);
      if (refreshRetryIntervalId) {
        clearInterval(refreshRetryIntervalId);
        setRefreshRetryIntervalId(null);
      }
      return true;
    } catch (e: any) {
      // If error is network-related, set refreshRetrying and retry with exponential backoff
      setError('Network error during token refresh. Retrying...');
      setRefreshRetrying(true);
      if (!refreshRetryIntervalId && refreshRetryCount < MAX_REFRESH_RETRIES) {
        const backoffDelay = 10000 * Math.pow(2, refreshRetryCount); // Exponential backoff: 10s, 20s, 40s, 80s, 160s
        const id = setInterval(() => {
          setRefreshRetryCount(prev => prev + 1);
          refreshAuthToken();
        }, backoffDelay);
        setRefreshRetryIntervalId(id);
      } else if (refreshRetryCount >= MAX_REFRESH_RETRIES) {
        // Stop retrying after max attempts
        setError('Max retry attempts reached. Please log in again.');
        setRefreshRetrying(false);
      }
      // Do NOT log out for transient errors
      return false;
    } finally {
      setLoading(false);
    }
  }, [refreshToken, refreshRetryIntervalId, refreshRetryCount]);

  // Check auth validity (replace with real API call or JWT check)
  const checkAuth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Replace with real validation logic
      // If network error, do NOT log out, just retry later
      if (accessToken) {
        setIsAuthenticated(true);
        return true;
      } else {
        setIsAuthenticated(false);
        setUser(null);
        return false;
      }
    } catch (e) {
      setError('Auth check failed.');
      // Do NOT log out for transient errors
      return false;
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        accessToken,
        refreshToken,
        loading,
        error,
        retrying,
        refreshRetrying,
        login,
        logout,
        refreshAuthToken,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {throw new Error('useAuth must be used within an AuthProvider');}
  return ctx;
};

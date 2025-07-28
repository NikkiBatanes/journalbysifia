import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  GoogleSignin,
  statusCodes as GoogleStatusCodes,
} from '@react-native-google-signin/google-signin';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import {
  User,
  AuthState,
  LoginCredentials,
  RegisterData,
  // SocialAuthProvider, // Unused for email-only auth
  AuthError,
  UserPreferences,
} from '../types/auth';
import { authApi } from '../services/authApi';
import { userApi } from '../services/userApi';

interface EnhancedAuthContextType extends AuthState {
  // Auth methods
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: AuthError }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: AuthError }>;
  logout: () => Promise<void>;

  // Social auth
  loginWithGoogle: () => Promise<{ success: boolean; error?: AuthError }>;
  loginWithApple: () => Promise<{ success: boolean; error?: AuthError }>;

  // Token management
  refreshAuthToken: () => Promise<boolean>;
  checkAuth: () => Promise<boolean>;

  // Password management
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: AuthError }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ success: boolean; error?: AuthError }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: AuthError }>;

  // Email verification
  sendEmailVerification: () => Promise<{ success: boolean; error?: AuthError }>;
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: AuthError }>;

  // Profile management
  updateProfile: (updates: Partial<User>) => Promise<{ success: boolean; error?: AuthError }>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<{ success: boolean; error?: AuthError }>;

  // Account management
  deleteAccount: () => Promise<{ success: boolean; error?: AuthError }>;

  // Utility
  clearError: () => void;
}

const EnhancedAuthContext = createContext<EnhancedAuthContextType | undefined>(undefined);

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: '@siFia:accessToken',
  REFRESH_TOKEN: '@siFia:refreshToken',
  USER: '@siFia:user',
  BIOMETRIC_ENABLED: '@siFia:biometricEnabled',
  REMEMBER_ME: '@siFia:rememberMe',
} as const;

// Default user preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  notifications: {
    dailyDevotional: true,
    prayerReminders: true,
    journalPrompts: true,
    playbookUpdates: true,
    achievements: true,
    weeklyReports: true,
    pushEnabled: true,
    emailEnabled: true,
    reminderTime: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  theme: 'system',
  fontSize: 'medium',
  colorScheme: 'default',
  privacy: {
    profileVisibility: 'friends',
    shareProgress: true,
    shareJournal: false,
    allowFriendRequests: true,
  },
  content: {
    language: 'en',
    bibleVersion: 'NIV',
    autoPlayAudio: false,
    downloadForOffline: true,
    showVerseOfDay: true,
  },
};

export const EnhancedAuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    refreshToken: null,
    loading: true,
    error: null,
    retrying: false,
    refreshRetrying: false,
  });

  // Initialize auth state from storage
  useEffect(() => {
    initializeAuth();
    // configureGoogleSignIn(); // Disabled for email-only auth
  }, [initializeAuth]);

  const initializeAuth = useCallback(async () => {
    try {
      const [accessToken, refreshToken, userJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER),
      ]);

      if (accessToken && refreshToken && userJson) {
        const user = JSON.parse(userJson);

        // Validate token with backend
        const isValid = await authApi.validateToken(accessToken);

        if (isValid) {
          setAuthState(prev => ({
            ...prev,
            isAuthenticated: true,
            user,
            accessToken,
            refreshToken,
            loading: false,
          }));
        } else {
          // Try to refresh token
          const refreshed = await refreshAuthToken();
          if (!refreshed) {
            await clearAuthData();
          }
        }
      } else {
        setAuthState(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setAuthState(prev => ({ ...prev, loading: false, error: 'Failed to initialize authentication' }));
    }
  }, []);

  const _configureGoogleSignIn = () => { // eslint-disable-line @typescript-eslint/no-unused-vars
    GoogleSignin.configure({
      webClientId: process.env.GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
      offlineAccess: true,
      hostedDomain: '',
      forceCodeForRefreshToken: true,
    });
  };

  const login = async (credentials: LoginCredentials): Promise<{ success: boolean; error?: AuthError }> => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));

      const response = await authApi.login(credentials);

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;

        // Store auth data
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
          AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
          AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user)),
        ]);

        setAuthState(prev => ({
          ...prev,
          isAuthenticated: true,
          user,
          accessToken,
          refreshToken,
          loading: false,
        }));

        return { success: true };
      } else {
        setAuthState(prev => ({ ...prev, loading: false, error: response.error?.message }));
        return { success: false, error: response.error };
      }
    } catch (error) {
      const authError: AuthError = {
        code: 'LOGIN_FAILED',
        message: 'Login failed. Please try again.',
      };
      setAuthState(prev => ({ ...prev, loading: false, error: authError.message }));
      return { success: false, error: authError };
    }
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: AuthError }> => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));

      // Validate passwords match
      if (data.password !== data.confirmPassword) {
        const error: AuthError = {
          code: 'PASSWORD_MISMATCH',
          message: 'Passwords do not match',
          field: 'confirmPassword',
        };
        setAuthState(prev => ({ ...prev, loading: false, error: error.message }));
        return { success: false, error };
      }

      const response = await authApi.register({
        ...data,
        preferences: DEFAULT_PREFERENCES,
      });

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;

        // Store auth data
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
          AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
          AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user)),
        ]);

        setAuthState(prev => ({
          ...prev,
          isAuthenticated: true,
          user,
          accessToken,
          refreshToken,
          loading: false,
        }));

        return { success: true };
      } else {
        setAuthState(prev => ({ ...prev, loading: false, error: response.error?.message }));
        return { success: false, error: response.error };
      }
    } catch (error) {
      const authError: AuthError = {
        code: 'REGISTRATION_FAILED',
        message: 'Registration failed. Please try again.',
      };
      setAuthState(prev => ({ ...prev, loading: false, error: authError.message }));
      return { success: false, error: authError };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: AuthError }> => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));

      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();

      const response = await authApi.socialLogin({
        provider: 'google',
        token: userInfo.idToken!,
        user: {
          id: userInfo.user.id,
          email: userInfo.user.email,
          firstName: userInfo.user.givenName || '',
          lastName: userInfo.user.familyName || '',
          avatar: userInfo.user.photo || undefined,
        },
      });

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;

        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
          AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
          AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user)),
        ]);

        setAuthState(prev => ({
          ...prev,
          isAuthenticated: true,
          user,
          accessToken,
          refreshToken,
          loading: false,
        }));

        return { success: true };
      } else {
        setAuthState(prev => ({ ...prev, loading: false, error: response.error?.message }));
        return { success: false, error: response.error };
      }
    } catch (error: any) {
      let authError: AuthError;

      if (error.code === GoogleStatusCodes.SIGN_IN_CANCELLED) {
        authError = { code: 'CANCELLED', message: 'Sign in was cancelled' };
      } else if (error.code === GoogleStatusCodes.IN_PROGRESS) {
        authError = { code: 'IN_PROGRESS', message: 'Sign in is in progress' };
      } else if (error.code === GoogleStatusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        authError = { code: 'PLAY_SERVICES_ERROR', message: 'Play services not available' };
      } else {
        authError = { code: 'GOOGLE_SIGNIN_FAILED', message: 'Google sign in failed' };
      }

      setAuthState(prev => ({ ...prev, loading: false, error: authError.message }));
      return { success: false, error: authError };
    }
  };

  const loginWithApple = async (): Promise<{ success: boolean; error?: AuthError }> => {
    if (Platform.OS !== 'ios') {
      const error: AuthError = {
        code: 'PLATFORM_NOT_SUPPORTED',
        message: 'Apple Sign In is only available on iOS',
      };
      return { success: false, error };
    }

    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));

      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      const { identityToken, fullName, email } = appleAuthRequestResponse;

      if (!identityToken) {
        throw new Error('Apple Sign In failed - no identity token');
      }

      const response = await authApi.socialLogin({
        provider: 'apple',
        token: identityToken,
        user: {
          id: appleAuthRequestResponse.user,
          email: email || '',
          firstName: fullName?.givenName || '',
          lastName: fullName?.familyName || '',
        },
      });

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;

        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
          AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
          AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user)),
        ]);

        setAuthState(prev => ({
          ...prev,
          isAuthenticated: true,
          user,
          accessToken,
          refreshToken,
          loading: false,
        }));

        return { success: true };
      } else {
        setAuthState(prev => ({ ...prev, loading: false, error: response.error?.message }));
        return { success: false, error: response.error };
      }
    } catch (error: any) {
      const authError: AuthError = {
        code: 'APPLE_SIGNIN_FAILED',
        message: error.message || 'Apple Sign In failed',
      };
      setAuthState(prev => ({ ...prev, loading: false, error: authError.message }));
      return { success: false, error: authError };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Sign out from social providers (only if Google Sign-In is configured)
      try {
        if (await GoogleSignin.isSignedIn()) {
          await GoogleSignin.signOut();
        }
      } catch (googleError) {
        // Google Sign-In not configured or available, skip
        console.log('Google Sign-In not available during logout');
      }

      // Clear auth data
      await clearAuthData();

      // Notify backend
      if (authState.accessToken) {
        await authApi.logout(authState.accessToken);
      }

      setAuthState({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null,
        loading: false,
        error: null,
        retrying: false,
        refreshRetrying: false,
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      await clearAuthData();
      setAuthState({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null,
        loading: false,
        error: null,
        retrying: false,
        refreshRetrying: false,
      });
    }
  };

  const refreshAuthToken = async (): Promise<boolean> => {
    try {
      setAuthState(prev => ({ ...prev, refreshRetrying: true }));

      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {return false;}

      const response = await authApi.refreshToken(refreshToken);

      if (response.success && response.data) {
        const { accessToken: newAccessToken, refreshToken: newRefreshToken, user } = response.data;

        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken),
          AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken),
          AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user)),
        ]);

        setAuthState(prev => ({
          ...prev,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          user,
          refreshRetrying: false,
        }));

        return true;
      } else {
        setAuthState(prev => ({ ...prev, refreshRetrying: false }));
        return false;
      }
    } catch (error) {
      setAuthState(prev => ({ ...prev, refreshRetrying: false }));
      return false;
    }
  };

  const checkAuth = async (): Promise<boolean> => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) {return false;}

    const isValid = await authApi.validateToken(token);
    if (!isValid) {
      return await refreshAuthToken();
    }

    return true;
  };

  const clearAuthData = async (): Promise<void> => {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.USER),
    ]);
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; error?: AuthError }> => {
    try {
      const response = await authApi.forgotPassword(email);
      return response;
    } catch (error) {
      return {
        success: false,
        error: { code: 'FORGOT_PASSWORD_FAILED', message: 'Failed to send reset email' },
      };
    }
  };

  const resetPassword = async (token: string, newPassword: string): Promise<{ success: boolean; error?: AuthError }> => {
    try {
      const response = await authApi.resetPassword(token, newPassword);
      return response;
    } catch (error) {
      return {
        success: false,
        error: { code: 'RESET_PASSWORD_FAILED', message: 'Failed to reset password' },
      };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: AuthError }> => {
    try {
      if (!authState.accessToken) {
        return { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } };
      }

      const response = await authApi.changePassword(authState.accessToken, currentPassword, newPassword);
      return response;
    } catch (error) {
      return {
        success: false,
        error: { code: 'CHANGE_PASSWORD_FAILED', message: 'Failed to change password' },
      };
    }
  };

  const sendEmailVerification = async (): Promise<{ success: boolean; error?: AuthError }> => {
    try {
      if (!authState.accessToken) {
        return { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } };
      }

      const response = await authApi.sendEmailVerification(authState.accessToken);
      return response;
    } catch (error) {
      return {
        success: false,
        error: { code: 'EMAIL_VERIFICATION_FAILED', message: 'Failed to send verification email' },
      };
    }
  };

  const verifyEmail = async (token: string): Promise<{ success: boolean; error?: AuthError }> => {
    try {
      const response = await authApi.verifyEmail(token);

      if (response.success && authState.user) {
        const updatedUser = { ...authState.user, emailVerified: true };
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        setAuthState(prev => ({ ...prev, user: updatedUser }));
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: { code: 'EMAIL_VERIFICATION_FAILED', message: 'Failed to verify email' },
      };
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<{ success: boolean; error?: AuthError }> => {
    try {
      if (!authState.accessToken || !authState.user) {
        return { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } };
      }

      const response = await userApi.updateProfile(authState.accessToken, updates);

      if (response.success && response.data) {
        const updatedUser = { ...authState.user, ...response.data };
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        setAuthState(prev => ({ ...prev, user: updatedUser }));
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: { code: 'UPDATE_PROFILE_FAILED', message: 'Failed to update profile' },
      };
    }
  };

  const updatePreferences = async (preferences: Partial<UserPreferences>): Promise<{ success: boolean; error?: AuthError }> => {
    try {
      if (!authState.accessToken || !authState.user) {
        return { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } };
      }

      const updatedPreferences = { ...authState.user.preferences, ...preferences };
      const response = await userApi.updatePreferences(authState.accessToken, updatedPreferences);

      if (response.success) {
        const updatedUser = { ...authState.user, preferences: updatedPreferences };
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        setAuthState(prev => ({ ...prev, user: updatedUser }));
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: { code: 'UPDATE_PREFERENCES_FAILED', message: 'Failed to update preferences' },
      };
    }
  };

  const deleteAccount = async (): Promise<{ success: boolean; error?: AuthError }> => {
    try {
      if (!authState.accessToken) {
        return { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } };
      }

      const response = await authApi.deleteAccount(authState.accessToken);

      if (response.success) {
        await logout();
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: { code: 'DELETE_ACCOUNT_FAILED', message: 'Failed to delete account' },
      };
    }
  };

  const clearError = () => {
    setAuthState(prev => ({ ...prev, error: null }));
  };

  const contextValue: EnhancedAuthContextType = {
    ...authState,
    login,
    register,
    logout,
    loginWithGoogle,
    loginWithApple,
    refreshAuthToken,
    checkAuth,
    forgotPassword,
    resetPassword,
    changePassword,
    sendEmailVerification,
    verifyEmail,
    updateProfile,
    updatePreferences,
    deleteAccount,
    clearError,
  };

  return (
    <EnhancedAuthContext.Provider value={contextValue}>
      {children}
    </EnhancedAuthContext.Provider>
  );
};

export const useEnhancedAuth = () => {
  const context = useContext(EnhancedAuthContext);
  if (context === undefined) {
    throw new Error('useEnhancedAuth must be used within an EnhancedAuthProvider');
  }
  return context;
};

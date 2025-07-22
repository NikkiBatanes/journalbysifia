import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Authentication state store
 * Handles user authentication, session management, and user profile
 */

interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  // Authentication state
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  session: any | null; // Supabase session type

  // Error state
  error: string | null;

  // Login state
  isLoggingIn: boolean;
  isLoggingOut: boolean;
  isSigningUp: boolean;
}

interface AuthActions {
  // Authentication actions
  setUser: (user: User | null) => void;
  setSession: (session: any | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setLoading: (isLoading: boolean) => void;

  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;

  // Login state
  setLoggingIn: (isLoggingIn: boolean) => void;
  setLoggingOut: (isLoggingOut: boolean) => void;
  setSigningUp: (isSigningUp: boolean) => void;

  // User profile
  updateUserProfile: (updates: Partial<User>) => void;

  // Reset
  resetAuthState: () => void;
  logout: () => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  // Authentication state
  isAuthenticated: false,
  isLoading: true,
  user: null,
  session: null,

  // Error state
  error: null,

  // Login state
  isLoggingIn: false,
  isLoggingOut: false,
  isSigningUp: false,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    immer((set) => ({
      ...initialState,

      // Authentication actions
      setUser: (user) => set((state) => {
        state.user = user;
        state.isAuthenticated = !!user;
      }),

      setSession: (session) => set((state) => {
        state.session = session;
        state.isAuthenticated = !!session;
      }),

      setAuthenticated: (isAuthenticated) => set((state) => {
        state.isAuthenticated = isAuthenticated;
      }),

      setLoading: (isLoading) => set((state) => {
        state.isLoading = isLoading;
      }),

      // Error handling
      setError: (error) => set((state) => {
        state.error = error;
      }),

      clearError: () => set((state) => {
        state.error = null;
      }),

      // Login state
      setLoggingIn: (isLoggingIn) => set((state) => {
        state.isLoggingIn = isLoggingIn;
      }),

      setLoggingOut: (isLoggingOut) => set((state) => {
        state.isLoggingOut = isLoggingOut;
      }),

      setSigningUp: (isSigningUp) => set((state) => {
        state.isSigningUp = isSigningUp;
      }),

      // User profile
      updateUserProfile: (updates) => set((state) => {
        if (state.user) {
          Object.assign(state.user, updates);
        }
      }),

      // Reset
      resetAuthState: () => set(() => initialState),

      logout: () => set((state) => {
        state.user = null;
        state.session = null;
        state.isAuthenticated = false;
        state.error = null;
        state.isLoggingOut = false;
      }),
    })),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist certain fields
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selectors for common auth state
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);

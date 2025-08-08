import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import SessionManager from '../utils/sessionManager';

// Industry-standard auth types
interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: SupabaseAuthError | null }>;
  signUp: (email: string, password: string, userData?: { firstName?: string; lastName?: string }) => Promise<{ error: SupabaseAuthError | null }>;
  signOut: () => Promise<{ error: SupabaseAuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: SupabaseAuthError | null }>;
  updateProfile: (profileData: { full_name?: string; bio?: string; location?: string; avatar_url?: string }) => Promise<{ success: boolean; error?: SupabaseAuthError | null }>;
  updatePreferences: (preferences: any) => Promise<{ success: boolean; error?: SupabaseAuthError | null }>;
  signInWithGoogle: () => Promise<{ error: SupabaseAuthError | null }>;
  signInWithApple: () => Promise<{ error: SupabaseAuthError | null }>;
  refreshSession: (retryCount?: number) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Global session refresh coordinator
let refreshPromise: Promise<any> | null = null;
const sessionManager = SessionManager.getInstance();

export const IndustryStandardAuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Get initial session with better error handling
    const getInitialSession = async () => {
      try {
        console.log('🔍 Getting initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Error getting initial session:', error);
          // Don't immediately set isAuthenticated to false on error
          // Let the auth state change listener handle it
          setAuthState(prev => ({ ...prev, loading: false }));
          return;
        }

        console.log('📋 Initial session result:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id,
          email: session?.user?.email,
        });

        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
          isAuthenticated: !!session?.user,
        });

        console.log('✅ Initial auth state set:', {
          isAuthenticated: !!session?.user,
          loading: false,
        });
      } catch (error) {
        console.error('💥 Failed to get initial session:', error);
        // Only set to unauthenticated if there's a real error
        setAuthState(prev => ({
          ...prev,
          loading: false,
          // Don't immediately clear authentication on network errors
        }));
      }
    };

    getInitialSession();

    // Helper function to create user profile for OAuth users
    const createUserProfileIfNeeded = async (user: any) => {
      try {
        console.log('🔍 Checking if user profile exists for:', user.id);

        // Check if user profile already exists
        const { data: existingProfile, error: fetchError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (existingProfile) {
          console.log('✅ User profile already exists');
          return;
        }

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
          console.error('❌ Error checking user profile:', fetchError);
          return;
        }

        console.log('📝 Creating new user profile for OAuth user');

        // Extract name from user metadata or email
        const userMetadata = user.user_metadata || {};
        const firstName = userMetadata.first_name || userMetadata.given_name || user.email?.split('@')[0] || '';
        const lastName = userMetadata.last_name || userMetadata.family_name || '';
        const fullName = userMetadata.full_name || userMetadata.name || `${firstName} ${lastName}`.trim();
        const displayName = fullName || firstName || user.email?.split('@')[0] || 'User';

        // Create user profile matching actual database schema
        const userProfile = {
          id: user.id,
          email: user.email,
          onboarding_completed: false,
        };

        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert([userProfile]);

        if (insertError) {
          console.error('❌ Error creating user profile:', insertError);
        } else {
          console.log('✅ User profile created successfully');
        }
      } catch (error) {
        console.error('💥 Unexpected error creating user profile:', error);
      }
    };

    // Initialize session manager
    sessionManager.initialize();

    // Listen for auth state changes (industry standard)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, {
          hasUser: !!session?.user,
          userId: session?.user?.id,
          email: session?.user?.email,
          hasSession: !!session,
          expiresAt: session?.expires_at,
        });

        // Don't immediately clear auth state on certain events
        if (event === 'SIGNED_OUT' && session === null) {
          console.log('⚠️ SIGNED_OUT event detected - checking if this was intentional');
          // Only clear state if this was an intentional logout
          // For now, let's be more conservative about clearing state
        }

        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
          isAuthenticated: !!session?.user,
        });

        console.log('✅ Auth state updated:', {
          isAuthenticated: !!session?.user,
          hasUser: !!session?.user,
          loading: false,
        });

        // Handle specific auth events with persistent session strategy
        switch (event) {
          case 'SIGNED_IN':
            console.log('User signed in:', session?.user?.email);
            // Create user profile for new OAuth users
            if (session?.user) {
              await createUserProfileIfNeeded(session.user);
            }
            break;
          case 'SIGNED_OUT':
            console.log('User signed out');
            // Only clear state on explicit logout, not on errors
            break;
          case 'TOKEN_REFRESHED':
            console.log('Token refreshed for user:', session?.user?.email);
            // Successful refresh - maintain session
            break;
          case 'USER_UPDATED':
            console.log('User updated:', session?.user?.email);
            break;
          default:
            // For any other events, maintain current session if possible
            console.log('Auth event:', event);
            break;
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Coordinated session refresh with retry logic (Facebook/Instagram style)
  const refreshSession = async (retryCount: number = 0): Promise<any> => {
    if (refreshPromise) {
      // If refresh is already in progress, wait for it
      return refreshPromise;
    }

    const maxRetries = 3;
    const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff

    refreshPromise = (async () => {
      try {
        console.log(`[Auth] Attempting session refresh (attempt ${retryCount + 1}/${maxRetries + 1})`);
        const result = await supabase.auth.refreshSession();

        if (result.error && retryCount < maxRetries) {
          console.log(`[Auth] Refresh failed, retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          refreshPromise = null;
          return refreshSession(retryCount + 1);
        }

        console.log('[Auth] Session refresh successful');
        return result;
      } catch (error) {
        if (retryCount < maxRetries) {
          console.log(`[Auth] Refresh error, retrying in ${retryDelay}ms...`, error);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          refreshPromise = null;
          return refreshSession(retryCount + 1);
        }
        console.error('[Auth] Session refresh failed after all retries:', error);
        throw error;
      }
    })();

    try {
      const result = await refreshPromise;
      refreshPromise = null;
      return result;
    } catch (error) {
      refreshPromise = null;
      throw error;
    }
  };

  // Industry-standard auth methods
  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔑 Starting sign in process...');
      setAuthState(prev => ({ ...prev, loading: true }));

      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        console.log('❌ Sign in failed:', error.message);
        setAuthState(prev => ({ ...prev, loading: false }));
        return { error };
      }

      console.log('✅ Sign in successful, waiting for auth state change...');
      // Don't immediately set loading to false - let the auth state change handler do it
      // This prevents a race condition where loading becomes false before isAuthenticated becomes true

      return { error: null };
    } catch (error) {
      console.error('💥 Sign in error:', error);
      setAuthState(prev => ({ ...prev, loading: false }));
      return {
        error: {
          message: 'An unexpected error occurred during sign in',
          status: 500,
        } as SupabaseAuthError,
      };
    }
  };

  const signUp = async (email: string, password: string, userData?: { firstName?: string; lastName?: string }) => {
    try {
      console.log('🔑 Starting real Supabase sign up process...', { email, hasUserData: !!userData });
      setAuthState(prev => ({ ...prev, loading: true }));

      // Prepare user metadata for Supabase
      const userMetadata: any = {};
      if (userData?.firstName && userData?.lastName) {
        userMetadata.full_name = `${userData.firstName.trim()} ${userData.lastName.trim()}`;
        userMetadata.first_name = userData.firstName.trim();
        userMetadata.last_name = userData.lastName.trim();
      }

      // Real Supabase registration
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: userMetadata,
        },
      });

      if (error) {
        console.error('❌ Sign up failed:', error);
        setAuthState(prev => ({ ...prev, loading: false }));
        return { error };
      }

      if (!data.user) {
        console.error('❌ No user returned from sign up');
        setAuthState(prev => ({ ...prev, loading: false }));
        return {
          error: {
            message: 'Registration failed - no user created',
            status: 500,
          } as SupabaseAuthError,
        };
      }

      console.log('✅ Supabase sign up successful!', {
        userId: data.user.id,
        email: data.user.email,
        confirmed: !!data.user.email_confirmed_at,
      });

      // Auth state will be updated by the onAuthStateChange listener
      // Profile creation will be handled by the auth state change handler
      // Don't set loading to false here - let the listener handle it

      return { error: null };
    } catch (error) {
      console.error('💥 Sign up unexpected error:', error);
      setAuthState(prev => ({ ...prev, loading: false }));
      return {
        error: {
          message: 'An unexpected error occurred during sign up',
          status: 500,
        } as SupabaseAuthError,
      };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      console.error('Sign out error:', error);
      return {
        error: {
          message: 'An unexpected error occurred during sign out',
          status: 500,
        } as SupabaseAuthError,
      };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        {
          redirectTo: 'sifia://reset-password',
        }
      );

      return { error };
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        error: {
          message: 'An unexpected error occurred during password reset',
          status: 500,
        } as SupabaseAuthError,
      };
    }
  };

  const updateProfile = async (profileData: { full_name?: string; bio?: string; location?: string; avatar_url?: string }) => {
    try {
      if (!authState.user) {
        return {
          success: false,
          error: {
            message: 'User not authenticated',
            status: 401,
          } as SupabaseAuthError,
        };
      }

      // Update user metadata in Supabase Auth
      const { error } = await supabase.auth.updateUser({
        data: {
          ...((authState.user as any).user_metadata || {}),
          ...profileData,
        },
      });

      if (error) {
        console.error('Update profile error:', error);
        return { success: false, error };
      }

      return { success: true };
    } catch (error) {
      console.error('Update profile error:', error);
      return {
        success: false,
        error: {
          message: 'An unexpected error occurred during profile update',
          status: 500,
        } as SupabaseAuthError,
      };
    }
  };

  const updatePreferences = async (preferences: any) => {
    try {
      if (!authState.user) {
        return {
          success: false,
          error: {
            message: 'User not authenticated',
            status: 401,
          } as SupabaseAuthError,
        };
      }

      // For now, store preferences in user metadata
      // In a full implementation, you might want a separate preferences table
      const { error } = await supabase.auth.updateUser({
        data: {
          ...((authState.user as any).user_metadata || {}),
          preferences,
        },
      });

      if (error) {
        console.error('Update preferences error:', error);
        return { success: false, error };
      }

      return { success: true };
    } catch (error) {
      console.error('Update preferences error:', error);
      return {
        success: false,
        error: {
          message: 'An unexpected error occurred during preferences update',
          status: 500,
        } as SupabaseAuthError,
      };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'sifia://auth/callback',
        },
      });

      return { error };
    } catch (error) {
      console.error('Google sign-in error:', error);
      return {
        error: {
          message: 'An unexpected error occurred during Google sign-in',
          status: 500,
        } as SupabaseAuthError,
      };
    }
  };

  const signInWithApple = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: 'sifia://auth/callback',
        },
      });

      return { error };
    } catch (error) {
      console.error('Apple sign-in error:', error);
      return {
        error: {
          message: 'An unexpected error occurred during Apple sign-in',
          status: 500,
        } as SupabaseAuthError,
      };
    }
  };

  const value: AuthContextType = {
    ...authState,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    updatePreferences,
    signInWithGoogle,
    signInWithApple,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Industry-standard hook with proper error handling
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an IndustryStandardAuthProvider');
  }

  return context;
};

// Utility hook for protected routes
export const useRequireAuth = () => {
  const { isAuthenticated, loading } = useAuth();

  return {
    isAuthenticated,
    loading,
    canAccess: isAuthenticated && !loading,
  };
};

export default IndustryStandardAuthProvider;

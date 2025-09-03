import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import SessionManager from '../utils/sessionManager';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';
import { Platform } from 'react-native';
import Config from 'react-native-config';
import NameCollectionModal from '../components/auth/NameCollectionModal';

// Industry-standard auth types
interface AuthState {
  user: User | null;
  session: Session | null;
  // loading: true only for active auth actions (signIn/signUp/etc.)
  loading: boolean;
  // bootstrapping: true only during initial session determination on app start
  bootstrapping: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  bootstrapping: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  updateProfile: (profileData: { full_name?: string; bio?: string; location?: string; avatar_url?: string }) => Promise<{ success: boolean; error?: SupabaseAuthError | null }>;
  updatePreferences: (preferences: any) => Promise<{ success: boolean; error?: SupabaseAuthError | null }>;
  signInWithGoogle: () => Promise<{ error: SupabaseAuthError | null }>;
  signInWithApple: () => Promise<{ error: SupabaseAuthError | null }>;
  refreshSession: (retryCount?: number) => Promise<any>;
  showNameCollection: boolean;
  nameCollectionData: { email: string } | null;
  completeNameCollection: (firstName: string, lastName: string) => Promise<void>;
  skipNameCollection: () => void;
  isLoggingOut: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Global session refresh coordinator
let refreshPromise: Promise<any> | null = null;
const sessionManager = SessionManager.getInstance();

export const IndustryStandardAuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: false,
    bootstrapping: true,
    isAuthenticated: false,
  });

  // Name collection state
  const [showNameCollection, setShowNameCollection] = useState(false);
  const [nameCollectionData, setNameCollectionData] = useState<{ email: string } | null>(null);
  
  // Logout state tracking
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Configure Google Sign-In
  useEffect(() => {
    const rawWebClientId = Config.GOOGLE_WEB_CLIENT_ID;
    const rawIosClientId = Config.GOOGLE_IOS_CLIENT_ID;
    
    // Clean up any duplicate prefixes from environment variables
    const webClientId = rawWebClientId?.replace('GOOGLE_WEB_CLIENT_ID=', '') || rawWebClientId;
    const iosClientId = rawIosClientId?.replace('GOOGLE_IOS_CLIENT_ID=', '') || rawIosClientId;
    
    console.log('🔧 Configuring Google Sign-In with:');
    console.log('📱 iOS Client ID (raw):', rawIosClientId || 'UNDEFINED');
    console.log('📱 iOS Client ID (cleaned):', iosClientId || 'UNDEFINED');
    console.log('🌐 Web Client ID (cleaned):', webClientId || 'UNDEFINED');
    
    if (!iosClientId || !webClientId) {
      console.error('❌ Missing Google OAuth client IDs in environment variables');
      console.error('Please check your .env file contains:');
      console.error('GOOGLE_IOS_CLIENT_ID=your-ios-client-id.googleusercontent.com');
      console.error('GOOGLE_WEB_CLIENT_ID=your-web-client-id.googleusercontent.com');
      return;
    }
    
    GoogleSignin.configure({
      webClientId: webClientId,
      iosClientId: iosClientId,
      offlineAccess: false, // Improves speed
    });
    
    console.log('✅ Google Sign-In configured successfully');
  }, []);

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
          setAuthState(prev => ({ ...prev, bootstrapping: false }));
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
          bootstrapping: false,
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
          bootstrapping: false,
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

        // Determine onboarding_completed from onboarding_progress if available
        let completed = false;
        try {
          const { data: progress, error: progressErr } = await supabase
            .from('onboarding_progress')
            .select('is_completed')
            .eq('user_id', user.id)
            .single();
          if (!progressErr && progress?.is_completed === true) {
            completed = true;
          }
        } catch (e) {
          // ignore; default remains false
        }

        // Create user profile matching actual database schema
        const userProfile = {
          id: user.id,
          email: user.email,
          onboarding_completed: completed,
        };

        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert([userProfile]);

        if (insertError) {
          console.error('❌ Error creating user profile:', insertError);
        } else {
          console.log('✅ User profile created successfully');
          
          // Create default Seeker subscription for new user
          try {
            const { error: subscriptionError } = await supabase
              .rpc('create_default_seeker_subscription', { 
                target_user_id: user.id 
              });
            
            if (subscriptionError) {
              console.error('❌ Error creating default subscription:', subscriptionError);
            } else {
              console.log('✅ Default Seeker subscription created');
            }
          } catch (e) {
            console.error('💥 Failed to create default subscription:', e);
          }
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

        // Handle logout state tracking
        if (event === 'SIGNED_OUT' && session === null) {
          console.log('⚠️ SIGNED_OUT event detected');
          // Clear logout flag after processing
          setIsLoggingOut(false);
        }

        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
          bootstrapping: false,
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
  // Name collection functions
  const completeNameCollection = async (firstName: string, lastName: string) => {
    if (!nameCollectionData) return;
    
    try {
      // Update user profile with collected name
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: `${firstName} ${lastName}`.trim(),
          first_name: firstName,
          last_name: lastName,
          needs_name_completion: false,
        }
      });
      
      if (error) {
        console.error('❌ Failed to update user name:', error);
      } else {
        console.log('✅ User name updated successfully');
      }
    } catch (error) {
      console.error('❌ Error updating user name:', error);
    } finally {
      setShowNameCollection(false);
      setNameCollectionData(null);
    }
  };

  const skipNameCollection = () => {
    setShowNameCollection(false);
    setNameCollectionData(null);
  };

  const refreshSession = async (retryCount = 0): Promise<any> => {
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
      setIsLoggingOut(true);
      console.log('🚪 Starting logout process...');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        setIsLoggingOut(false);
        console.error('❌ Logout error:', error);
        return;
      }
      
      console.log('✅ Logout successful');
      // isLoggingOut will be cleared by auth state change handler
    } catch (error) {
      setIsLoggingOut(false);
      console.error('❌ Logout failed:', error);
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

      // Locally update auth state so UI reflects changes immediately (e.g., avatar_url)
      try {
        setAuthState(prev => {
          if (!prev.user) {return prev;}
          const mergedMeta = {
            ...((prev.user as any).user_metadata || {}),
            ...profileData,
          };
          const updatedUser = { ...(prev.user as any), user_metadata: mergedMeta } as User;
          console.log('✅ Auth state user_metadata updated:', Object.keys(profileData));
          return { ...prev, user: updatedUser };
        });
      } catch (e) {
        console.warn('Could not update local auth state after profile update', e);
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
      // Optimistically update local auth state so UI reflects preference changes immediately
      try {
        setAuthState(prev => {
          if (!prev.user) {return prev;}
          const prevMeta = (prev.user as any).user_metadata || {};
          const mergedMeta = { ...prevMeta, preferences };
          const updatedUser = { ...(prev.user as any), user_metadata: mergedMeta } as User;
          return { ...prev, user: updatedUser };
        });
      } catch (e) {
        console.warn('Could not update local auth state after preferences update', e);
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
      console.log('🔄 Starting Google Sign-In...');
      setAuthState(prev => ({ ...prev, loading: true }));

      // Clear any existing sessions to prevent nonce conflicts
      try {
        await GoogleSignin.signOut();
        await supabase.auth.signOut();
        // Wait a moment for session cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('🧹 Cleared existing sessions');
      } catch (clearError) {
        console.log('⚠️ Session clear warning (safe to ignore):', clearError);
      }

      // Check if device supports Google Play services (Android only)
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      
      // Sign in with Google
      const userInfo = await GoogleSignin.signIn();
      console.log('✅ Google sign-in successful:', userInfo.data?.user.email);

      // Get the ID token
      const idToken = userInfo.data?.idToken;
      
      if (!idToken) {
        // User likely cancelled - don't show error, just return silently
        console.log('ℹ️ Google Sign-In cancelled by user');
        setAuthState(prev => ({ ...prev, loading: false }));
        return { error: null }; // Return success to avoid showing error UI
      }

      console.log('🔍 Signing in to Supabase with Google token (no nonce)');
      
      // Ensure we're starting with a completely clean session
      const { data: currentSession } = await supabase.auth.getSession();
      if (currentSession?.session) {
        console.log('🧹 Found existing session, clearing it first');
        await supabase.auth.signOut();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Try alternative approach: exchange Google token for Supabase session
      console.log('🔄 Attempting direct Google token exchange...');
      
      // First try the standard approach
      let authError = null;
      try {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });
        authError = error;
      } catch (err: any) {
        authError = err;
      }
      
      // If standard approach fails with nonce error, try manual user creation
      if (authError && authError.message?.includes('nonce')) {
        console.log('🔄 Nonce error detected, trying manual approach...');
        
        // Decode the Google ID token to get user info
        const base64Url = idToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const googleUser = JSON.parse(jsonPayload);
        console.log('📋 Google user info:', { email: googleUser.email, name: googleUser.name });
        
        // Check if we need to collect additional user info
        const needsNameCollection = !googleUser.name || googleUser.name.trim().length === 0;
        
        let userData = {
          full_name: googleUser.name || '',
          first_name: googleUser.given_name || '',
          last_name: googleUser.family_name || '',
          avatar_url: googleUser.picture,
          provider: 'google',
          google_id: googleUser.sub,
          needs_name_completion: needsNameCollection,
        };
        
        // If name is missing or incomplete, we'll handle it after auth
        if (needsNameCollection) {
          console.log('⚠️ Google user has incomplete name info, will prompt after auth');
          // Set up name collection after successful auth
          setNameCollectionData({ email: googleUser.email });
        }
        
        // Try to sign up/sign in with email and a temporary password
        const tempPassword = `google_${googleUser.sub}_${Date.now()}`;
        
        // First try sign in
        let { error: signInError } = await supabase.auth.signInWithPassword({
          email: googleUser.email,
          password: tempPassword,
        });
        
        if (signInError && signInError.message?.includes('Invalid login credentials')) {
          // User doesn't exist, create them
          const { error: signUpError } = await supabase.auth.signUp({
            email: googleUser.email,
            password: tempPassword,
            options: {
              data: userData
            }
          });
          
          if (signUpError) {
            console.error('❌ Manual Google signup failed:', signUpError);
            authError = signUpError;
          } else {
            console.log('✅ Manual Google signup successful');
            authError = null;
          }
        } else if (signInError) {
          console.error('❌ Manual Google signin failed:', signInError);
          authError = signInError;
        } else {
          console.log('✅ Manual Google signin successful');
          authError = null;
        }
      }
      
      if (authError) {
        console.error('❌ All Google auth methods failed:', authError);
        setAuthState(prev => ({ ...prev, loading: false }));
        return { error: authError };
      }

      setAuthState(prev => ({ ...prev, loading: false }));
      
      // Show name collection modal if needed (check nameCollectionData instead)
      if (nameCollectionData) {
        setShowNameCollection(true);
      }
      
      console.log('✅ Google authentication successful');
      return { error: null };
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, loading: false }));
      
      // Check if this is a user cancellation
      if (error.code === 'SIGN_IN_CANCELLED' || 
          error.code === '12501' || // Android cancellation
          error.message?.includes('cancelled') ||
          error.message?.includes('canceled') ||
          error.message?.includes('SIGN_IN_CANCELLED')) {
        console.log('ℹ️ Google Sign-In cancelled by user');
        return { error: null }; // Return success to avoid showing error UI
      }
      
      console.error('❌ Google sign-in error:', error);
      return {
        error: {
          message: error.message || 'Google sign-in failed',
          status: 500,
        } as SupabaseAuthError,
      };
    }
  };

  const signInWithApple = async () => {
    try {
      console.log('🔄 Starting Apple Sign-In...');
      setAuthState(prev => ({ ...prev, loading: true }));

      if (Platform.OS !== 'ios') {
        throw new Error('Apple Sign-In is only available on iOS');
      }

      // Check if Apple Sign-In is supported
      if (!appleAuth.isSupported) {
        throw new Error('Apple Sign-In is not supported on this device');
      }

      // Perform Apple Sign-In
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      const { identityToken, nonce } = appleAuthRequestResponse;
      
      if (!identityToken) {
        throw new Error('No identity token received from Apple');
      }

      console.log('✅ Apple sign-in successful');

      // Sign in to Supabase with the Apple identity token
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
        nonce,
      });

      setAuthState(prev => ({ ...prev, loading: false }));

      if (error) {
        console.error('❌ Supabase Apple auth error:', error);
        return { error };
      }

      console.log('✅ Apple authentication successful');
      return { error: null };
    } catch (error: any) {
      console.error('❌ Apple sign-in error:', error);
      setAuthState(prev => ({ ...prev, loading: false }));
      
      // Handle user cancellation gracefully
      if (error.code === '1000' || error.message?.includes('1000') || error.message?.includes('cancelled')) {
        return {
          error: {
            message: 'Sign in was cancelled',
            status: 400,
          } as SupabaseAuthError,
        };
      }
      
      return {
        error: {
          message: error.message || 'Apple sign-in failed',
          status: 500,
        } as SupabaseAuthError,
      };
    }
  };

  const value: AuthContextType = {
    user: authState.user,
    session: authState.session,
    loading: authState.loading,
    bootstrapping: authState.bootstrapping,
    isAuthenticated: authState.isAuthenticated,
    signOut,
    updateProfile,
    updatePreferences,
    signInWithGoogle,
    signInWithApple,
    refreshSession,
    showNameCollection,
    nameCollectionData,
    completeNameCollection,
    skipNameCollection,
    isLoggingOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <NameCollectionModal
        visible={showNameCollection}
        onComplete={completeNameCollection}
        onSkip={skipNameCollection}
        userEmail={nameCollectionData?.email || ''}
      />
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

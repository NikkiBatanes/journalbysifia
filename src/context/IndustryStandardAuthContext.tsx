import { safeJsonParse } from '../utils/safeJsonParse';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';
import { Platform } from 'react-native';
import Config from 'react-native-config';
import { Logger } from '../utils/ProductionLogger';

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
  signIn: (email: string, password: string) => Promise<{ error: SupabaseAuthError | null }>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, userData?: { firstName?: string; lastName?: string }) => Promise<{ error: SupabaseAuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: SupabaseAuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: SupabaseAuthError | null }>;
  updateProfile: (profileData: { full_name?: string; bio?: string; location?: string; avatar_url?: string }) => Promise<{ success: boolean; error?: SupabaseAuthError | null }>;
  updatePreferences: (preferences: any) => Promise<{ success: boolean; error?: SupabaseAuthError | null }>;
  signInWithGoogle: () => Promise<{ error: SupabaseAuthError | null }>;
  signInWithApple: () => Promise<{ error: SupabaseAuthError | null }>;
  refreshSession: (retryCount?: number) => Promise<any>;
  isLoggingOut: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Global session refresh coordinator
let refreshPromise: Promise<any> | null = null;

export const IndustryStandardAuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: false,
    bootstrapping: true,
    isAuthenticated: false,
  });

  // Logout state tracking
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Configure Google Sign-In
  useEffect(() => {
    const rawWebClientId = Config.GOOGLE_WEB_CLIENT_ID;
    const rawIosClientId = Config.GOOGLE_IOS_CLIENT_ID;

    // Clean up any duplicate prefixes from environment variables
    const webClientId = rawWebClientId?.replace('GOOGLE_WEB_CLIENT_ID=', '') || rawWebClientId;
    const iosClientId = rawIosClientId?.replace('GOOGLE_IOS_CLIENT_ID=', '') || rawIosClientId;

    if (!iosClientId || !webClientId) {
      Logger.warn('Missing Google OAuth client IDs in environment variables', {
        component: 'AuthContext',
        action: 'google_signin_config',
        hasIosClientId: !!iosClientId,
        hasWebClientId: !!webClientId,
      });
      return;
    }

    try {
      GoogleSignin.configure({
        webClientId: webClientId,
        iosClientId: iosClientId,
        offlineAccess: false, // Improves speed
      });

    } catch (error) {
      Logger.warn('Failed to configure Google Sign-In', {
        component: 'AuthContext',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  useEffect(() => {
    // Get initial session with better error handling
    const getInitialSession = async () => {
      try {

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          Logger.error('Error getting initial session', error as Error, {
            component: 'AuthContext',
            action: 'get_initial_session',
          });
          // Don't immediately set isAuthenticated to false on error
          // Let the auth state change listener handle it
          setAuthState(prev => ({ ...prev, bootstrapping: false }));
          return;
        }

        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
          bootstrapping: false,
          isAuthenticated: !!session?.user,
        });

      } catch (error) {
        Logger.fatal('Failed to get initial session', error as Error, {
          component: 'AuthContext',
          action: 'get_initial_session_catch',
        });
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

        // Check if user profile already exists
        const { data: existingProfile, error: fetchError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (existingProfile) {

          return;
        }

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
          Logger.error('Error checking user profile', fetchError as Error, {
            component: 'AuthContext',
            action: 'create_user_profile',
            userId: user.id,
          });
          return;
        }

        // Determine onboarding_completed from onboarding_progress if available
        let completed = false;
        try {
          const { data: progress, error: progressErr } = await supabase
            .from('onboarding_progress')
            .select('is_completed')
            .eq('user_id', user.id)
            .single();

          // Only set completed to true if:
          // 1. No error occurred
          // 2. Progress data exists
          // 3. is_completed is explicitly true (not just truthy)
          if (!progressErr && progress && progress.is_completed === true) {
            completed = true;

          } else {

          }
        } catch (e) {
          Logger.warn('Error checking onboarding progress, defaulting to false', {
            component: 'AuthContext',
            action: 'check_onboarding_progress',
            userId: user.id,
          });
          // Explicitly set to false on any error
          completed = false;
        }

        // SAFETY CHECK: For new users, ensure onboarding_completed is false
        // This prevents any edge cases where completed might be set incorrectly
        if (completed) {
          // Double-check that this user actually completed onboarding
          try {
            const { data: progressCheck } = await supabase
              .from('onboarding_progress')
              .select('is_completed, completed_at')
              .eq('user_id', user.id)
              .single();

            if (progressCheck && progressCheck.is_completed === true && progressCheck.completed_at) {

            } else {
              Logger.warn('Onboarding_completed was true but no completion record found - correcting to false', {
                component: 'AuthContext',
                action: 'verify_onboarding',
                userId: user.id,
              });
              completed = false;
            }
          } catch (e) {
            Logger.warn('Could not verify onboarding completion - defaulting to false', {
              component: 'AuthContext',
              action: 'verify_onboarding_catch',
              userId: user.id,
            });
            completed = false;
          }
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
          Logger.error('Error creating user profile', insertError as Error, {
            component: 'AuthContext',
            action: 'insert_user_profile',
            userId: user.id,
          });
        } else {

          // Create default Seeker subscription for new user
          try {
            const { error: subscriptionError } = await supabase
              .rpc('create_default_seeker_subscription', {
                target_user_id: user.id,
              });

            if (subscriptionError) {
              Logger.error('Error creating default subscription', subscriptionError as Error, {
                component: 'AuthContext',
                action: 'create_default_subscription',
                userId: user.id,
              });
            } else {
              Logger.info('Default subscription created successfully', {
                component: 'AuthContext',
                userId: user.id,
              });
            }
          } catch (e) {
            Logger.error('Failed to create default subscription', e as Error, {
              component: 'AuthContext',
              action: 'create_default_subscription_catch',
              userId: user.id,
            });
          }
        }
      } catch (error) {
        Logger.fatal('Unexpected error creating user profile', error as Error, {
          component: 'AuthContext',
          action: 'create_user_profile_outer_catch',
          userId: user?.id,
        });
      }
    };

    // Session manager initialization removed - not needed

    // Listen for auth state changes (industry standard)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {

        // Handle logout state tracking
        if (event === 'SIGNED_OUT' && session === null) {

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

        // Handle specific auth events with persistent session strategy
        switch (event) {
          case 'SIGNED_IN':

            // Create user profile for new OAuth users
            if (session?.user) {
              await createUserProfileIfNeeded(session.user);
            }
            // Check onboarding completion and navigate accordingly
            if (session?.user) {
              try {

                // Check if this is a social auth sign-in (Google/Apple)
                const isSocialAuth = session.user.app_metadata?.provider === 'google' ||
                                   session.user.app_metadata?.provider === 'apple' ||
                                   (session.user as any)?.identities?.some((identity: any) =>
                                     identity.provider === 'google' || identity.provider === 'apple');

                if (isSocialAuth) {
                  // Check if login flow flag is already set (from signInWithGoogle/signInWithApple)
                  const existingRedirectRaw = await AsyncStorage.getItem('post_auth_redirect');
                  const existingRedirect = safeJsonParse<{is_login_flow?: boolean}>(existingRedirectRaw, {
                    fallback: null,
                    context: 'IndustryStandardAuthContext:socialAuth',
                  });
                  const isLoginFlow = existingRedirect?.is_login_flow === true;

                  if (isLoginFlow) {
                    // This is a login flow - preserve the is_login_flow flag
                    // Don't overwrite the redirect that signInWithGoogle/signInWithApple already set
                    Logger.debug('[AuthContext] Social login flow detected, preserving redirect with is_login_flow flag');
                    // CRITICAL: Return early to prevent overwriting the redirect below
                    return;
                  }

                  // This is NOT a login flow (probably first-time social signup)
                  // For social auth, check if this user already had an account before this sign-in
                  // We can detect this by checking if user profile existed before this session
                  const { data: existingProfile, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('onboarding_completed, created_at')
                    .eq('id', session.user.id)
                    .single();

                  Logger.debug('[onAuthStateChange] SOCIAL AUTH CHECK', {
                    userId: session.user.id,
                    userIdType: typeof session.user.id,
                    userIdLength: session.user.id?.length,
                    isUuidFormat: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(session.user.id),
                    hasProfile: !!existingProfile,
                    onboardingCompleted: existingProfile?.onboarding_completed,
                    profileError: profileError?.message,
                    profileErrorCode: profileError?.code,
                    willRouteTo: existingProfile?.onboarding_completed ? 'MainTabs' : 'OnboardingPersonalization',
                  });

                  if (profileError && profileError.code !== 'PGRST116') {
                    Logger.error('Error checking existing profile', profileError as Error, {
                      component: 'AuthContext',
                      action: 'check_existing_profile',
                      userId: session.user.id,
                    });
                    throw profileError;
                  }

                  if (existingProfile) {
                    // User profile already exists - this means they had an account before

                    if (existingProfile.onboarding_completed) {
                      // User completed onboarding - go to main app

                      await AsyncStorage.setItem('force_navigate_to_main', 'true');
                      await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
                        target: 'MainTabs',
                        params: {},
                        is_login_flow: true, // Bypass onboarding checks for completed users
                      }));

                      Logger.debug('[AuthContext] SOCIAL AUTH - Updated redirect to MainTabs for completed user', {
                        userId: session.user.id,
                        target: 'MainTabs',
                        is_login_flow: true,
                      });
                    } else {
                      // User exists but didn't complete onboarding - send to personalization

                      await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
                        target: 'OnboardingPersonalization',
                        params: {
                          name: '',
                          registrationMethod: 'oauth',
                        },
                      }));
                    }
                  } else {
                    // No existing profile - this is a new social auth user

                    const hasCompletedOnboarding = false; // New user by definition

                    if (hasCompletedOnboarding) {
                      // User completed onboarding - force navigation to main app

                      await AsyncStorage.setItem('force_navigate_to_main', 'true');
                      await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
                        target: 'MainTabs',
                        params: {},
                        is_login_flow: true, // Bypass onboarding checks for completed users
                      }));
                    } else {
                      // User needs to complete onboarding - continue with personalization

                      // Pass registrationMethod to ensure OAuth users get proper name collection
                      const provider = session.user.app_metadata?.provider || session.user.identities?.[0]?.provider;
                      const isOAuth = provider === 'apple' || provider === 'google';

                      // For OAuth users, check if they already have a name in metadata
                      let userName = '';
                      if (isOAuth && session.user.user_metadata?.first_name) {
                        userName = session.user.user_metadata.first_name;
                      }

                      await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
                        target: 'OnboardingPersonalization',
                        params: {
                          name: userName, // Use existing name from metadata if available
                          registrationMethod: isOAuth ? 'oauth' : 'email',
                        },
                      }));
                    }
                  }
                } else {
                  // Regular email/password auth - check if login flow flag is already set
                  // If it is, don't overwrite it (signIn already set it with is_login_flow: true)
                  const existingRedirectRaw = await AsyncStorage.getItem('post_auth_redirect');
                  const existingRedirect = safeJsonParse<{is_login_flow?: boolean}>(existingRedirectRaw, {
                    fallback: null,
                    context: 'IndustryStandardAuthContext:emailAuth',
                  });
                  const isLoginFlow = existingRedirect?.is_login_flow === true;

                  if (isLoginFlow) {
                    // This is a login flow - preserve the is_login_flow flag
                    // Don't overwrite the redirect that signIn already set
                    Logger.debug('[AuthContext] Login flow detected, preserving redirect with is_login_flow flag');
                    // CRITICAL: Return early to prevent overwriting the redirect below
                    return;
                  }

                  // This is NOT a login flow (probably signup or session restoration)
                  // Use existing logic to determine redirect based on onboarding status
                  const { data: profile, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('onboarding_completed')
                    .eq('id', session.user.id)
                    .single();

                  Logger.debug('[onAuthStateChange] EMAIL AUTH CHECK', {
                    userId: session.user.id,
                    hasProfile: !!profile,
                    onboardingCompleted: profile?.onboarding_completed,
                    profileError: profileError?.message,
                    profileErrorCode: profileError?.code,
                    willRouteTo: profile?.onboarding_completed === true ? 'MainTabs' : 'OnboardingPersonalization',
                  });

                  if (profileError) {
                    Logger.error('Error fetching profile', profileError as Error, {
                      component: 'AuthContext',
                      action: 'fetch_profile',
                      userId: session.user.id,
                    });
                    throw profileError;
                  }

                  const hasCompletedOnboarding = profile?.onboarding_completed === true;

                  if (hasCompletedOnboarding) {
                    // User completed onboarding - force navigation to main app

                    await AsyncStorage.setItem('force_navigate_to_main', 'true');
                    await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
                      target: 'MainTabs',
                      params: {},
                      is_login_flow: true, // Bypass onboarding checks for completed users
                    }));
                  } else {
                    // User needs to complete onboarding - continue with personalization

                    await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
                      target: 'OnboardingPersonalization',
                      params: {
                        name: '',
                        registrationMethod: 'email',
                      },
                    }));
                  }
                }
              } catch (e) {
                Logger.fatal('CRITICAL: Failed to check onboarding status', e as Error, {
                  component: 'AuthContext',
                  action: 'check_onboarding_status',
                  userId: session?.user?.id,
                });
                // IMPORTANT: On error, check if profile exists at all
                try {
                  const { data: profileCheck } = await supabase
                    .from('user_profiles')
                    .select('id, onboarding_completed')
                    .eq('id', session.user.id)
                    .maybeSingle();

                  if (profileCheck) {

                    const target = profileCheck.onboarding_completed ? 'MainTabs' : 'OnboardingPersonalization';
                    // Pass registrationMethod for OAuth users
                    const provider = session.user.app_metadata?.provider || session.user.identities?.[0]?.provider;
                    const isOAuth = provider === 'apple' || provider === 'google';
                    await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
                      target,
                      params: target === 'OnboardingPersonalization' ? {
                        name: '',
                        registrationMethod: isOAuth ? 'oauth' : 'email',
                      } : {},
                      is_login_flow: target === 'MainTabs', // Add bypass flag for completed users
                    }));
                  } else {
                    Logger.warn('No profile found, defaulting to personalization', {
                      component: 'AuthContext',
                      action: 'profile_check_fallback',
                      userId: session?.user?.id,
                    });
                    // Pass registrationMethod to ensure OAuth users get proper name collection
                    const provider = session.user.app_metadata?.provider || session.user.identities?.[0]?.provider;
                    const isOAuth = provider === 'apple' || provider === 'google';
                    await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
                      target: 'OnboardingPersonalization',
                      params: {
                        name: '',
                        registrationMethod: isOAuth ? 'oauth' : 'email',
                      },
                    }));
                  }
                } catch (retryError) {
                  Logger.error('Retry failed, defaulting to personalization', retryError as Error, {
                    component: 'AuthContext',
                    action: 'profile_check_retry',
                    userId: session?.user?.id,
                  });
                  // Pass registrationMethod to ensure OAuth users get proper name collection
                  const provider = session.user.app_metadata?.provider || session.user.identities?.[0]?.provider;
                  const isOAuth = provider === 'apple' || provider === 'google';
                  await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
                    target: 'OnboardingPersonalization',
                    params: {
                      name: '',
                      registrationMethod: isOAuth ? 'oauth' : 'email',
                    },
                  }));
                }
              }
            }
            break;
          case 'SIGNED_OUT':

            // Only clear state on explicit logout, not on errors
            break;
          case 'TOKEN_REFRESHED':

            // Successful refresh - maintain session
            break;
          case 'USER_UPDATED':

            break;
          default:
            // For any other events, maintain current session if possible

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

  const refreshSession = async (retryCount = 0): Promise<any> => {
    if (refreshPromise) {
      // If refresh is already in progress, wait for it
      return refreshPromise;
    }

    const maxRetries = 3;
    const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff

    refreshPromise = (async () => {
      try {

        const result = await supabase.auth.refreshSession();

        if (result.error && retryCount < maxRetries) {

          await new Promise(resolve => setTimeout(resolve, retryDelay));
          refreshPromise = null;
          return refreshSession(retryCount + 1);
        }

        return result;
      } catch (error) {
        if (retryCount < maxRetries) {

          await new Promise(resolve => setTimeout(resolve, retryDelay));
          refreshPromise = null;
          return refreshSession(retryCount + 1);
        }
        Logger.error('Session refresh failed after all retries', error as Error, {
          component: 'AuthContext',
          action: 'refresh_session',
          retryCount,
        });
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

      setAuthState(prev => ({ ...prev, loading: true }));

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {

        setAuthState(prev => ({ ...prev, loading: false }));
        return { error };
      }

      // Don't immediately set loading to false - let the auth state change handler do it
      // This prevents a race condition where loading becomes false before isAuthenticated becomes true

      // ENTERPRISE-GRADE CHECK: Verify onboarding status before routing
      // This ensures unregistered users (who have auth but no profile/incomplete onboarding)
      // are routed to personalization, not dashboard
      try {
        const userId = data.user?.id;
        if (!userId) {
          Logger.error('No user ID after successful sign in', undefined, {
            component: 'AuthContext',
            action: 'sign_in_no_user_id',
          });
          throw new Error('No user ID returned');
        }

        // Check user profile and onboarding status
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('onboarding_completed')
          .eq('id', userId)
          .single();

        Logger.debug('[signIn] CHECKING ONBOARDING STATUS', {
          userId,
          userIdType: typeof userId,
          userIdLength: userId?.length,
          isUuidFormat: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId),
          hasProfile: !!profile,
          onboardingCompleted: profile?.onboarding_completed,
          profileError: profileError?.message,
          profileErrorCode: profileError?.code,
          willRouteTo: (profileError || !profile || profile?.onboarding_completed !== true) ? 'OnboardingPersonalization' : 'MainTabs',
        });

        // If profile doesn't exist or onboarding is not completed, route to personalization
        if (profileError || !profile || profile.onboarding_completed !== true) {
          Logger.debug('[signIn] User has not completed onboarding - routing to personalization', {
            hasProfile: !!profile,
            onboardingCompleted: profile?.onboarding_completed,
            profileError: profileError?.message,
          });

          // Route to personalization for unregistered/incomplete users
          await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
            target: 'OnboardingPersonalization',
            params: {
              name: '',
              registrationMethod: 'email',
            },
          }));
        } else {
          // User has completed onboarding - route to MainTabs with bypass flag
          Logger.debug('[signIn] User has completed onboarding - routing to MainTabs');

          await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
            target: 'MainTabs',
            params: {},
            is_login_flow: true, // Bypass onboarding checks for completed users
          }));
        }
      } catch (checkError) {
        Logger.error('Error checking onboarding status during sign in', checkError as Error, {
          component: 'AuthContext',
          action: 'sign_in_check_onboarding',
        });
        // On error, default to personalization for safety
        await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
          target: 'OnboardingPersonalization',
          params: {
            name: '',
            registrationMethod: 'email',
          },
        }));
      }

      return { error: null };
    } catch (error) {
      Logger.error('Sign in error', error as Error, {
        component: 'AuthContext',
        action: 'sign_in',
      });
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
        Logger.error('Sign up failed', error as Error, {
          component: 'AuthContext',
          action: 'sign_up',
        });
        setAuthState(prev => ({ ...prev, loading: false }));
        return { error };
      }

      if (!data.user) {
        Logger.error('No user returned from sign up', undefined, {
          component: 'AuthContext',
          action: 'sign_up',
        });
        setAuthState(prev => ({ ...prev, loading: false }));
        return {
          error: {
            message: 'Registration failed - no user created',
            status: 500,
          } as SupabaseAuthError,
        };
      }

      // Auth state will be updated by the onAuthStateChange listener
      // Profile creation will be handled by the auth state change handler
      // Don't set loading to false here - let the listener handle it

      return { error: null };
    } catch (error) {
      Logger.error('Sign up unexpected error', error as Error, {
        component: 'AuthContext',
        action: 'sign_up_catch',
      });
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
      Logger.debug('[AuthContext] Starting logout...');

      // Clear any persistent redirects to prevent stale routing
      try {
        await AsyncStorage.removeItem('post_auth_redirect');
        await AsyncStorage.removeItem('force_navigate_to_main');
        Logger.debug('[AuthContext] Cleared persistent redirects on logout');
      } catch (error) {
        Logger.warn('[AuthContext] Error clearing redirects on logout', {
          component: 'AuthContext',
          action: 'logout_cleanup',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }

      // Clear Google session
      try {
        await GoogleSignin.signOut();
        Logger.debug('[AuthContext] Google session cleared');
      } catch (error) {
        Logger.warn('[AuthContext] Error clearing Google session', {
          component: 'AuthContext',
          action: 'logout_google_cleanup',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }

      // Always attempt Supabase sign-out regardless of provider cleanup result
      let sbError: SupabaseAuthError | null = null;
      try {
        Logger.info('AuthContext: Calling Supabase signOut...');
        const { error } = await supabase.auth.signOut();
        if (error) {
          sbError = error as SupabaseAuthError;
          Logger.error('AuthContext: Supabase signOut error:', error);
        } else {
          Logger.info('AuthContext: Supabase signOut successful');
        }
      } catch (e: any) {
        sbError = e as SupabaseAuthError;
        Logger.error('AuthContext: Supabase signOut exception:', e);
      }

      if (sbError) {
        Logger.error('Supabase sign-out error', sbError as Error, {
          component: 'AuthContext',
          action: 'sign_out_supabase',
        });
      }

      // Clear auth state regardless to avoid stale UI; onAuthStateChange will confirm
      Logger.info('AuthContext: Clearing auth state...');
      setAuthState({
        user: null,
        session: null,
        loading: false,
        bootstrapping: false,
        isAuthenticated: false,
      });
      setIsLoggingOut(false);
      Logger.info('AuthContext: Logout complete');
    } catch (error) {
      Logger.error('AuthContext: Logout failed:', error);
      setIsLoggingOut(false);
      Logger.error('Logout failed', error as Error, {
        component: 'AuthContext',
        action: 'sign_out_catch',
      });
    }
  };

  const resetPassword = async (email: string) => {
    try {

      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
        redirectTo: 'https://sifia.app/reset-password.html',
      });

      if (error) {
        Logger.error('Password reset failed', error as Error, {
          component: 'AuthContext',
          action: 'reset_password',
        });
        return { error };
      }

      return { error: null };
    } catch (error) {
      Logger.error('Password reset error', error as Error, {
        component: 'AuthContext',
        action: 'reset_password_catch',
      });
      return {
        error: {
          message: 'An unexpected error occurred during password reset',
          status: 500,
        } as SupabaseAuthError,
      };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      // Regular password update for authenticated user
      if (!authState.user) {
        return {
          error: {
            message: 'User not authenticated',
            status: 401,
          } as SupabaseAuthError,
        };
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        Logger.error('Password update failed', error as Error, {
          component: 'AuthContext',
          action: 'update_password_authenticated',
        });
        return { error };
      }

      return { error: null };
    } catch (error) {
      Logger.error('Password update error', error as Error, {
        component: 'AuthContext',
        action: 'update_password_catch',
      });
      return {
        error: {
          message: 'An unexpected error occurred during password update',
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
        Logger.error('Update profile error', error as Error, {
          component: 'AuthContext',
          action: 'update_profile',
          userId: authState.user?.id,
        });
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


          return { ...prev, user: updatedUser };
        });
      } catch (e) {
        Logger.warn('Could not update local auth state after profile update', {
          component: 'AuthContext',
          action: 'update_profile_local_state',
          userId: authState.user?.id,
        });
      }

      return { success: true };
    } catch (error) {
      Logger.error('Update profile error', error as Error, {
        component: 'AuthContext',
        action: 'update_profile_catch',
        userId: authState.user?.id,
      });
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
        Logger.error('Update preferences error', error as Error, {
          component: 'AuthContext',
          action: 'update_preferences',
          userId: authState.user?.id,
        });
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
        Logger.warn('Could not update local auth state after preferences update', {
          component: 'AuthContext',
          action: 'update_preferences_local_state',
          userId: authState.user?.id,
        });
      }

      return { success: true };
    } catch (error) {
      Logger.error('Update preferences error', error as Error, {
        component: 'AuthContext',
        action: 'update_preferences_catch',
        userId: authState.user?.id,
      });
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
      // Check if Google Sign-In is configured
      const rawWebClientId = Config.GOOGLE_WEB_CLIENT_ID;
      const rawIosClientId = Config.GOOGLE_IOS_CLIENT_ID;
      const webClientId = rawWebClientId?.replace('GOOGLE_WEB_CLIENT_ID=', '') || rawWebClientId;
      const iosClientId = rawIosClientId?.replace('GOOGLE_IOS_CLIENT_ID=', '') || rawIosClientId;

      if (!iosClientId || !webClientId) {
        Logger.warn('Google Sign-In is not configured', {
          component: 'AuthContext',
          action: 'sign_in_with_google',
        });
        return {
          error: {
            message: 'Google Sign-In is not available. Please use email/password or Apple Sign-In.',
            status: 400,
            name: 'ConfigurationError',
          } as SupabaseAuthError,
        };
      }

      setAuthState(prev => ({ ...prev, loading: true }));

      // Clear any existing sessions to prevent nonce conflicts
      try {
        await GoogleSignin.signOut();
        await supabase.auth.signOut();
        // Wait a moment for session cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (clearError) {

      }

      // Check if device supports Google Play services (Android only)
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      // Sign in with Google
      const userInfo = await GoogleSignin.signIn();

      // Get the ID token
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        // User likely cancelled - don't show error, just return silently

        setAuthState(prev => ({ ...prev, loading: false }));
        return { error: null }; // Return success to avoid showing error UI
      }

      // Ensure we're starting with a completely clean session
      const { data: currentSession } = await supabase.auth.getSession();
      if (currentSession?.session) {

        await supabase.auth.signOut();
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Try alternative approach: exchange Google token for Supabase session

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

        // Decode the Google ID token to get user info
        const base64Url = idToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const googleUser = safeJsonParse<{name?: string; email?: string}>(jsonPayload, {
          fallback: {name: '', email: ''},
          context: 'IndustryStandardAuthContext:googleSignIn',
        });

        // Check if we need to collect additional user info
        const needsNameCollection = !googleUser?.name || googleUser.name.trim().length === 0;

        // userData object removed - was defined but never used
        // If name is missing or incomplete, we'll handle it after auth
        if (needsNameCollection) {

        }

        // For nonce errors, try to proceed with Google auth anyway
        // The original nonce error might be temporary or configuration-related

        // Try the standard Google auth flow one more time with a fresh session
        try {
          // Clear any stale sessions completely
          await supabase.auth.signOut();
          await new Promise(resolve => setTimeout(resolve, 500));

          // Retry the Google token exchange
          const { error: retryError } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
          });

          if (retryError) {
            Logger.error('Retry Google auth failed', retryError as Error, {
              component: 'AuthContext',
              action: 'google_auth_retry',
            });
            authError = retryError;
          } else {

            authError = null;
          }
        } catch (retryErr) {
          Logger.error('Google auth retry failed', retryErr as Error, {
            component: 'AuthContext',
            action: 'google_auth_retry_catch',
          });
          authError = retryErr as SupabaseAuthError;
        }
      }

      if (authError) {
        Logger.error('All Google auth methods failed', authError as Error, {
          component: 'AuthContext',
          action: 'sign_in_with_google',
        });
        setAuthState(prev => ({ ...prev, loading: false }));
        return { error: authError };
      }

      // Save Google-provided name and clear avatar URLs from user metadata
      try {
        const currentUser = await supabase.auth.getUser();

        if (!currentUser.data.user) {

          return { error: null };
        }

        // Decode the Google ID token to get the user's name
        const base64Url = idToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const googleUser = safeJsonParse<{name?: string; email?: string; given_name?: string; family_name?: string}>(jsonPayload, {
          fallback: {name: '', email: '', given_name: '', family_name: ''},
          context: 'IndustryStandardAuthContext:googleRegister',
        });

        // Logging to identify name parsing issues
        Logger.debug('Google OAuth user data', {
          component: 'AuthContext',
          action: 'google_name_parsing',
          googleName: googleUser?.name,
          givenName: googleUser?.given_name,
          familyName: googleUser?.family_name,
        });

        // Split full name into first and last name
        let firstName = '';
        let lastName = '';
        if (googleUser?.given_name && googleUser?.family_name) {
          // Google provides separate first and last names - use these directly
          firstName = googleUser.given_name.trim();
          lastName = googleUser.family_name.trim();
        } else if (googleUser?.name) {
          // Split the full name properly
          const nameParts = googleUser.name.trim().split(/\s+/);
          if (nameParts.length === 1) {
            // Single name only (e.g., "Madonna")
            firstName = nameParts[0];
            lastName = '';
          } else if (nameParts.length === 2) {
            // Standard first + last name (e.g., "John Smith")
            firstName = nameParts[0];
            lastName = nameParts[1];
          } else {
            // Multiple parts - first word is first name, rest is last name
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(' ');
          }
        }

        // Log the final parsed names for debugging
        Logger.debug('Parsed Google names', {
          component: 'AuthContext',
          action: 'google_name_parsed',
          firstName,
          lastName,
          fullName: googleUser?.name,
        });

        // Update user metadata with Google name and clear avatar URLs
        await supabase.auth.updateUser({
          data: {
            ...currentUser.data.user.user_metadata,
            first_name: firstName,
            last_name: lastName,
            full_name: googleUser?.name || '',
            // Clear avatar URLs to use our custom avatar system
            avatar_url: undefined,
            picture: undefined,
            photoURL: undefined,
          },
        });

      } catch (metadataError) {

      }

      setAuthState(prev => ({ ...prev, loading: false }));

      // ENTERPRISE-GRADE CHECK: Verify onboarding status before routing
      // This ensures unregistered Google users are routed to personalization, not dashboard
      try {
        const { data: currentUser } = await supabase.auth.getUser();
        const userId = currentUser.user?.id;

        if (!userId) {
          Logger.error('No user ID after successful Google sign in', undefined, {
            component: 'AuthContext',
            action: 'google_sign_in_no_user_id',
          });
          throw new Error('No user ID returned');
        }

        // Check user profile and onboarding status
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('onboarding_completed')
          .eq('id', userId)
          .single();

        // If profile doesn't exist or onboarding is not completed, route to personalization
        if (profileError || !profile || profile.onboarding_completed !== true) {
          Logger.debug('[Google signIn] User has not completed onboarding - routing to personalization', {
            hasProfile: !!profile,
            onboardingCompleted: profile?.onboarding_completed,
            profileError: profileError?.message,
          });

          // Route to personalization for unregistered/incomplete users
          await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
            target: 'OnboardingPersonalization',
            params: {
              name: '',
              registrationMethod: 'oauth',
            },
          }));
        } else {
          // User has completed onboarding - route to MainTabs with bypass flag
          Logger.debug('[Google signIn] User has completed onboarding - routing to MainTabs');

          await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
            target: 'MainTabs',
            params: {},
            is_login_flow: true, // Bypass onboarding checks for completed users
          }));
        }
      } catch (checkError) {
        Logger.error('Error checking onboarding status during Google sign in', checkError as Error, {
          component: 'AuthContext',
          action: 'google_sign_in_check_onboarding',
        });
        // On error, default to personalization for safety
        await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
          target: 'OnboardingPersonalization',
          params: {
            name: '',
            registrationMethod: 'oauth',
          },
        }));
      }

      return { error: null };
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, loading: false }));

      // Check if this is a user cancellation
      if (error.code === 'SIGN_IN_CANCELLED' ||
          error.code === '12501' || // Android cancellation
          error.message?.includes('cancelled') ||
          error.message?.includes('canceled') ||
          error.message?.includes('SIGN_IN_CANCELLED')) {

        return { error: null }; // Return success to avoid showing error UI
      }

      Logger.error('Google sign-in error', error as Error, {
        component: 'AuthContext',
        action: 'sign_in_with_google_catch',
      });
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

      const { identityToken, nonce, fullName } = appleAuthRequestResponse;

      // Log Apple-provided data for debugging

      if (!identityToken) {
        // Treat as user cancellation or benign failure: do not surface an error

        setAuthState(prev => ({ ...prev, loading: false }));
        return { error: null };
      }

      // Sign in to Supabase with the Apple identity token
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
        nonce,
      });

      // Store Apple name data for later use in onboarding
      if (fullName?.givenName && fullName.givenName.trim().length > 0) {

        // Store the Apple-provided name for use in onboarding
        await AsyncStorage.setItem('apple_signin_name', JSON.stringify({
          givenName: fullName.givenName,
          familyName: fullName.familyName,
          nickname: fullName.nickname,
        }));

      } else {

        // Clear any previously stored Apple name data if it exists
        await AsyncStorage.removeItem('apple_signin_name');
      }

      if (error) {
        Logger.error('Supabase Apple auth error', error as Error, {
          component: 'AuthContext',
          action: 'sign_in_with_apple',
        });
        setAuthState(prev => ({ ...prev, loading: false }));
        return { error: error as SupabaseAuthError };
      }

      // Clear any avatar URLs from user metadata to ensure consistency
      try {
        const currentUser = await supabase.auth.getUser();
        if (currentUser.data.user?.user_metadata?.avatar_url ||
            currentUser.data.user?.user_metadata?.picture) {

          await supabase.auth.updateUser({
            data: {
              ...currentUser.data.user.user_metadata,
              avatar_url: undefined,
              picture: undefined,
            },
          });
        }
      } catch (metadataError) {

      }

      setAuthState(prev => ({ ...prev, loading: false }));

      // ENTERPRISE-GRADE CHECK: Verify onboarding status before routing
      // This ensures unregistered Apple users are routed to personalization, not dashboard
      try {
        const { data: currentUser } = await supabase.auth.getUser();
        const userId = currentUser.user?.id;

        if (!userId) {
          Logger.error('No user ID after successful Apple sign in', undefined, {
            component: 'AuthContext',
            action: 'apple_sign_in_no_user_id',
          });
          throw new Error('No user ID returned');
        }

        // Check user profile and onboarding status
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('onboarding_completed')
          .eq('id', userId)
          .single();

        // If profile doesn't exist or onboarding is not completed, route to personalization
        if (profileError || !profile || profile.onboarding_completed !== true) {
          Logger.debug('[Apple signIn] User has not completed onboarding - routing to personalization', {
            hasProfile: !!profile,
            onboardingCompleted: profile?.onboarding_completed,
            profileError: profileError?.message,
          });

          // Route to personalization for unregistered/incomplete users
          await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
            target: 'OnboardingPersonalization',
            params: {
              name: '',
              registrationMethod: 'oauth',
            },
          }));
        } else {
          // User has completed onboarding - route to MainTabs with bypass flag
          Logger.debug('[Apple signIn] User has completed onboarding - routing to MainTabs');

          await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
            target: 'MainTabs',
            params: {},
            is_login_flow: true, // Bypass onboarding checks for completed users
          }));
        }
      } catch (checkError) {
        Logger.error('Error checking onboarding status during Apple sign in', checkError as Error, {
          component: 'AuthContext',
          action: 'apple_sign_in_check_onboarding',
        });
        // On error, default to personalization for safety
        await AsyncStorage.setItem('post_auth_redirect', JSON.stringify({
          target: 'OnboardingPersonalization',
          params: {
            name: '',
            registrationMethod: 'oauth',
          },
        }));
      }

      return { error: null };
    } catch (error: any) {
      Logger.error('Apple sign-in error', error as Error, {
        component: 'AuthContext',
        action: 'sign_in_with_apple_catch',
      });
      setAuthState(prev => ({ ...prev, loading: false }));

      // Handle user cancellation gracefully (suppress error like Google flow)
      if (
        error?.code === '1000' ||
        error?.code === (appleAuth?.Error?.CANCELED as any) ||
        error?.message?.toLowerCase?.().includes('1000') ||
        error?.message?.toLowerCase?.().includes('cancelled') ||
        error?.message?.toLowerCase?.().includes('canceled')
      ) {

        return { error: null };
      }

      return {
        error: {
          message: error?.message || 'Apple sign-in failed',
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
    signIn,
    signOut,
    signUp,
    resetPassword,
    updatePassword,
    updateProfile,
    updatePreferences,
    signInWithGoogle,
    signInWithApple,
    refreshSession,
    isLoggingOut,
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

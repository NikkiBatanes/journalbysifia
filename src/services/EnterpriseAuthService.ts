/**
 * Enterprise-Grade Authentication Service
 * Handles Apple Sign-In, Google Sign-In, and Supabase integration
 * Production-ready with comprehensive error handling and security
 */

import { Alert } from 'react-native';
import appleAuth, { 
  AppleRequestOperation, 
  AppleRequestScope,
  AppleCredentialState,
  AppleError 
} from '@invertase/react-native-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from './supabaseClient';
import { authConfig } from '../config/auth-config';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthResult {
  success: boolean;
  user?: User | null;
  session?: Session | null;
  error?: string;
}

export interface AuthError {
  code: string;
  message: string;
  provider: 'apple' | 'google' | 'supabase';
}

export class EnterpriseAuthService {
  
  /**
   * Initialize authentication service
   * Configure providers and validate setup
   */
  static async initialize(): Promise<void> {
    try {
      // Google Sign-In is configured in IndustryStandardAuthContext.tsx
      // Removing duplicate configuration to prevent conflicts
      console.log('🔧 EnterpriseAuthService initialized (Google config handled by AuthContext)');
      console.log('✅ EnterpriseAuthService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize EnterpriseAuthService:', error);
      throw error;
    }
  }

  /**
   * Apple Sign-In Implementation
   * Enterprise-grade with comprehensive error handling
   */
  static async signInWithApple(): Promise<AuthResult> {
    try {
      console.log('🍎 Starting Apple Sign-In...');

      // Check if Apple Sign-In is available
      if (!appleAuth.isSupported) {
        return {
          success: false,
          error: 'Apple Sign-In is not available on this device'
        };
      }

      // Request Apple authentication
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: AppleRequestOperation.LOGIN,
        requestedScopes: [AppleRequestScope.EMAIL, AppleRequestScope.FULL_NAME],
      });

      // Extract credentials
      const { identityToken, nonce, user: appleUserId } = appleAuthRequestResponse;

      if (!identityToken) {
        return {
          success: false,
          error: 'Apple Sign-In failed to return identity token'
        };
      }

      // Verify credential state
      const credentialState = await appleAuth.getCredentialStateForUser(appleUserId);
      
      if (credentialState !== AppleCredentialState.AUTHORIZED) {
        return {
          success: false,
          error: 'Apple Sign-In authorization was revoked'
        };
      }

      console.log('🍎 Apple authentication successful, signing in with Supabase...');

      // Sign in with Supabase using Apple identity token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
        nonce: nonce || undefined,
      });

      if (error) {
        console.error('❌ Supabase Apple Sign-In error:', error);
        return {
          success: false,
          error: `Authentication failed: ${error.message}`
        };
      }

      console.log('✅ Apple Sign-In completed successfully');
      
      return {
        success: true,
        user: data.user,
        session: data.session
      };

    } catch (error: any) {
      console.error('❌ Apple Sign-In error:', error);
      return {
        success: false,
        error: this.handleAppleError(error)
      };
    }
  }

  /**
   * Google Sign-In Implementation
   * Enterprise-grade with comprehensive error handling
   */
  static async signInWithGoogle(): Promise<AuthResult> {
    try {
      console.log('🔍 Starting Google Sign-In...');

      // Check if device supports Google Play Services
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      // Sign in with Google
      const userInfo = await GoogleSignin.signIn();

      if (!userInfo || !('data' in userInfo) || !userInfo.data?.idToken) {
        return {
          success: false,
          error: 'Google Sign-In failed to return ID token'
        };
      }

      console.log('🔍 Google authentication successful, signing in with Supabase...');

      // Sign in with Supabase using Google ID token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: userInfo.data.idToken,
      });

      if (error) {
        console.error('❌ Supabase Google Sign-In error:', error);
        return {
          success: false,
          error: `Authentication failed: ${error.message}`
        };
      }

      console.log('✅ Google Sign-In completed successfully');

      return {
        success: true,
        user: data.user,
        session: data.session
      };

    } catch (error: any) {
      console.error('❌ Google Sign-In error:', error);
      return {
        success: false,
        error: this.handleGoogleError(error)
      };
    }
  }

  /**
   * Sign out from all providers
   */
  static async signOut(): Promise<AuthResult> {
    try {
      console.log('🚪 Starting sign out...');

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Supabase sign out error:', error);
        return {
          success: false,
          error: `Sign out failed: ${error.message}`
        };
      }

      // Sign out from Google if signed in
      try {
        await GoogleSignin.signOut();
      } catch (googleError) {
        console.warn('⚠️ Google sign out warning:', googleError);
        // Continue with sign out even if Google fails
      }

      console.log('✅ Sign out completed successfully');

      return { success: true };

    } catch (error: any) {
      console.error('❌ Sign out error:', error);
      return {
        success: false,
        error: `Sign out failed: ${error.message}`
      };
    }
  }

  /**
   * Get current authentication session
   */
  static async getCurrentSession(): Promise<Session | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error('❌ Failed to get current session:', error);
      return null;
    }
  }

  /**
   * Refresh current session
   */
  static async refreshSession(): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        return {
          success: false,
          error: `Session refresh failed: ${error.message}`
        };
      }

      return {
        success: true,
        user: data.user,
        session: data.session
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Session refresh failed: ${error.message}`
      };
    }
  }

  /**
   * Apple-specific error handling
   */
  private static handleAppleError(error: any): string {
    if (error.code) {
      switch (error.code) {
        case AppleError.CANCELED:
          return 'Apple Sign-In was canceled';
        case AppleError.FAILED:
          return 'Apple Sign-In failed. Please try again.';
        case AppleError.INVALID_RESPONSE:
          return 'Invalid response from Apple. Please try again.';
        case AppleError.NOT_HANDLED:
          return 'Apple Sign-In is not available on this device';
        case AppleError.UNKNOWN:
          return 'An unknown error occurred with Apple Sign-In';
        default:
          return 'Apple Sign-In error. Please try again.';
      }
    }
    return error.message || 'Apple Sign-In failed. Please try again.';
  }

  /**
   * Google-specific error handling
   */
  private static handleGoogleError(error: any): string {
    if (error.code) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          return 'Google Sign-In was canceled';
        case statusCodes.IN_PROGRESS:
          return 'Google Sign-In is already in progress';
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          return 'Google Play Services is not available on this device';
        default:
          return 'Google Sign-In error. Please try again.';
      }
    }
    return error.message || 'Google Sign-In failed. Please try again.';
  }

  /**
   * Validate authentication state
   */
  static async validateAuthState(): Promise<boolean> {
    try {
      const session = await this.getCurrentSession();
      return session !== null && session.expires_at ? session.expires_at > Date.now() / 1000 : false;
    } catch {
      return false;
    }
  }
}

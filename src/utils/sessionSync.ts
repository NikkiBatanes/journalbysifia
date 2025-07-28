import { supabase } from '../services/supabaseClient';

/**
 * Session synchronization utilities
 * Ensures the supabase client and auth context are in sync
 */

export interface SessionSyncResult {
  isAuthenticated: boolean;
  hasValidSession: boolean;
  sessionMismatch: boolean;
  details: {
    contextAuth?: boolean;
    supabaseSession?: boolean;
    sessionExpired?: boolean;
    tokenPresent?: boolean;
  };
}

/**
 * Check if there's a session mismatch between auth context and supabase client
 */
export async function checkSessionSync(): Promise<SessionSyncResult> {
  try {
    console.log('🔄 Checking session synchronization...');
    
    // Get session from supabase client
    const { data: { session }, error } = await supabase.auth.getSession();
    
    const hasValidSession = !!(session && session.access_token && !error);
    const sessionExpired = session?.expires_at ? session.expires_at * 1000 < Date.now() : false;
    
    const result: SessionSyncResult = {
      isAuthenticated: hasValidSession && !sessionExpired,
      hasValidSession,
      sessionMismatch: false, // Will be determined by caller
      details: {
        supabaseSession: !!session,
        sessionExpired,
        tokenPresent: !!session?.access_token
      }
    };
    
    console.log('📊 Session sync check result:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Session sync check failed:', error);
    
    return {
      isAuthenticated: false,
      hasValidSession: false,
      sessionMismatch: true,
      details: {}
    };
  }
}

/**
 * Force session refresh and sync
 */
export async function forceSessionRefresh(): Promise<{ success: boolean; error?: any }> {
  try {
    console.log('🔄 Forcing session refresh...');
    
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('❌ Force refresh failed:', error);
      return { success: false, error };
    }
    
    if (!session || !session.access_token) {
      console.warn('⚠️ No valid session after force refresh');
      return { success: false, error: 'No valid session returned' };
    }
    
    console.log('✅ Session force refreshed successfully');
    return { success: true };
  } catch (error) {
    console.error('💥 Force refresh exception:', error);
    return { success: false, error };
  }
}

/**
 * Clear all session data and force logout
 */
export async function clearSessionData(): Promise<void> {
  try {
    console.log('🧹 Clearing all session data...');
    
    await supabase.auth.signOut();
    
    console.log('✅ Session data cleared');
  } catch (error) {
    console.error('❌ Failed to clear session data:', error);
  }
}

/**
 * Validate current session and provide detailed diagnostics
 */
export async function validateSession(): Promise<{
  isValid: boolean;
  diagnostics: {
    hasSession: boolean;
    hasToken: boolean;
    isExpired: boolean;
    expiresAt?: number;
    userId?: string;
    email?: string;
  };
}> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    const diagnostics = {
      hasSession: !!session,
      hasToken: !!session?.access_token,
      isExpired: session?.expires_at ? session.expires_at * 1000 < Date.now() : false,
      expiresAt: session?.expires_at,
      userId: session?.user?.id,
      email: session?.user?.email
    };
    
    const isValid = !error && 
                   diagnostics.hasSession && 
                   diagnostics.hasToken && 
                   !diagnostics.isExpired;
    
    console.log('🔍 Session validation result:', { isValid, diagnostics });
    
    return { isValid, diagnostics };
  } catch (error) {
    console.error('❌ Session validation failed:', error);
    
    return {
      isValid: false,
      diagnostics: {
        hasSession: false,
        hasToken: false,
        isExpired: true
      }
    };
  }
}

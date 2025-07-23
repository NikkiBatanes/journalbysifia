// Authentication Fix Helper
// This utility helps diagnose and fix authentication issues

import { supabase } from '../services/supabaseApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthDiagnostic {
  hasAsyncStorageSession: boolean;
  hasSupabaseSession: boolean;
  sessionsMatch: boolean;
  userIdFormat: 'valid-uuid' | 'invalid' | 'missing';
  accessTokenPresent: boolean;
  sessionExpired: boolean;
  recommendations: string[];
}

export const diagnoseAuth = async (): Promise<AuthDiagnostic> => {
  const recommendations: string[] = [];
  
  // Check AsyncStorage session
  const asyncStorageSession = await AsyncStorage.getItem('@supabase_session');
  const hasAsyncStorageSession = !!asyncStorageSession;
  
  // Check Supabase session
  const { data: { session }, error } = await supabase.auth.getSession();
  const hasSupabaseSession = !!session && !error;
  
  // Check if sessions match
  let sessionsMatch = false;
  let userIdFormat: 'valid-uuid' | 'invalid' | 'missing' = 'missing';
  let accessTokenPresent = false;
  let sessionExpired = false;
  
  if (hasSupabaseSession && session) {
    // Check user ID format (UUID validation)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (session.user?.id) {
      userIdFormat = uuidRegex.test(session.user.id) ? 'valid-uuid' : 'invalid';
    }
    
    // Check access token
    accessTokenPresent = !!session.access_token;
    
    // Check if session is expired
    if (session.expires_at) {
      sessionExpired = Date.now() / 1000 > session.expires_at;
    }
    
    // Compare with AsyncStorage
    if (hasAsyncStorageSession && asyncStorageSession) {
      try {
        const parsedAsyncSession = JSON.parse(asyncStorageSession);
        sessionsMatch = parsedAsyncSession.access_token === session.access_token;
      } catch (e) {
        sessionsMatch = false;
      }
    }
  }
  
  // Generate recommendations
  if (!hasSupabaseSession) {
    recommendations.push('User needs to sign in - no active Supabase session');
  }
  
  if (userIdFormat === 'invalid') {
    recommendations.push('User ID is not a valid UUID - authentication may be corrupted');
  }
  
  if (userIdFormat === 'missing') {
    recommendations.push('User ID is missing from session');
  }
  
  if (!accessTokenPresent) {
    recommendations.push('Access token is missing from session');
  }
  
  if (sessionExpired) {
    recommendations.push('Session has expired - user needs to refresh or re-authenticate');
  }
  
  if (hasAsyncStorageSession && hasSupabaseSession && !sessionsMatch) {
    recommendations.push('AsyncStorage and Supabase sessions are out of sync');
  }
  
  if (hasSupabaseSession && userIdFormat === 'valid-uuid' && accessTokenPresent && !sessionExpired) {
    recommendations.push('Authentication looks good - check RLS policies in database');
  }
  
  return {
    hasAsyncStorageSession,
    hasSupabaseSession,
    sessionsMatch,
    userIdFormat,
    accessTokenPresent,
    sessionExpired,
    recommendations,
  };
};

export const fixAuthSession = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // Try to refresh the session
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      return {
        success: false,
        message: `Failed to refresh session: ${error.message}`,
      };
    }
    
    if (data.session) {
      // Store the refreshed session
      await AsyncStorage.setItem('@supabase_session', JSON.stringify(data.session));
      return {
        success: true,
        message: 'Session refreshed successfully',
      };
    }
    
    return {
      success: false,
      message: 'No session returned from refresh',
    };
  } catch (error) {
    return {
      success: false,
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

export const clearAuthSession = async (): Promise<void> => {
  // Clear both Supabase and AsyncStorage sessions
  await supabase.auth.signOut();
  await AsyncStorage.multiRemove([
    '@supabase_session',
    'ACCESS_TOKEN',
    'REFRESH_TOKEN',
    'USER',
  ]);
};

export const testDatabaseWithCurrentAuth = async (): Promise<{ success: boolean; message: string; details?: any }> => {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return {
        success: false,
        message: 'No active session found',
        details: { sessionError: sessionError?.message },
      };
    }
    
    // Try to insert a test entry
    const testEntry = {
      user_id: session.user.id,
      content_type: 'gratitude' as const,
      content: 'Auth test - ' + new Date().toISOString(),
      selected_date: new Date().toISOString().split('T')[0],
    };
    
    const { data, error } = await supabase
      .from('journal_entries')
      .insert(testEntry)
      .select()
      .single();
    
    if (error) {
      return {
        success: false,
        message: `Database insert failed: ${error.message}`,
        details: {
          code: error.code,
          details: error.details,
          hint: error.hint,
          userId: session.user.id,
          userIdLength: session.user.id.length,
        },
      };
    }
    
    // Clean up test data
    await supabase
      .from('journal_entries')
      .delete()
      .eq('id', data.id);
    
    return {
      success: true,
      message: 'Database test successful - authentication is working',
      details: {
        testEntryId: data.id,
        userId: session.user.id,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

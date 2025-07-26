import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';

export const debugAuthState = async () => {
  console.log('=== AUTH DEBUG START ===');

  // Check AsyncStorage session
  try {
    const sessionStr = await AsyncStorage.getItem('@supabase_session');
    console.log('[Auth Debug] AsyncStorage session exists:', !!sessionStr);

    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      console.log('[Auth Debug] Session user ID:', session?.user?.id);
      console.log('[Auth Debug] Session access token exists:', !!session?.access_token);
      console.log('[Auth Debug] Session expires at:', session?.expires_at);
    }
  } catch (error) {
    console.error('[Auth Debug] Error reading AsyncStorage session:', error);
  }

  // Check Supabase session
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    console.log('[Auth Debug] Supabase session exists:', !!session);
    console.log('[Auth Debug] Supabase session error:', error);

    if (session) {
      console.log('[Auth Debug] Supabase user ID:', session.user?.id);
      console.log('[Auth Debug] Supabase user email:', session.user?.email);
    }
  } catch (error) {
    console.error('[Auth Debug] Error getting Supabase session:', error);
  }

  console.log('=== AUTH DEBUG END ===');
};

export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    // Try Supabase session first
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      console.log('[getCurrentUserId] Found user ID from Supabase:', session.user.id);
      return session.user.id;
    }

    // Fallback to AsyncStorage
    const sessionStr = await AsyncStorage.getItem('@supabase_session');
    if (sessionStr) {
      const storedSession = JSON.parse(sessionStr);
      const userId = storedSession?.user?.id || storedSession?.user_id;
      if (userId) {
        console.log('[getCurrentUserId] Found user ID from AsyncStorage:', userId);
        return userId;
      }
    }

    console.warn('[getCurrentUserId] No user ID found in any source');
    return null;
  } catch (error) {
    console.error('[getCurrentUserId] Error getting user ID:', error);
    return null;
  }
};

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';

export const debugAuthState = async () => {

  // Check AsyncStorage session
  try {
    const session = await AsyncStorage.getItem('USER_SESSION');
    
    if (!session) {
      return false;
    }

    // Validate session
    const { data } = await supabase.auth.getSession();
  } catch (error) {
    console.error('[Auth Debug] Error reading AsyncStorage session:', error);
  }

  // Check Supabase session
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {

    }
  } catch (error) {
    console.error('[Auth Debug] Error getting Supabase session:', error);
  }

};

export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    // Try Supabase session first
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {

      return session.user.id;
    }

    // Fallback to AsyncStorage
    const sessionStr = await AsyncStorage.getItem('@supabase_session');
    if (sessionStr) {
      const storedSession = JSON.parse(sessionStr);
      const userId = storedSession?.user?.id || storedSession?.user_id;
      if (userId) {

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

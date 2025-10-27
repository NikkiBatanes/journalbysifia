import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../utils/ProductionLogger';
import { supabase } from '../services/supabaseClient';

export const debugAuthState = async () => {

  // Check AsyncStorage session
  try {
    const session = await AsyncStorage.getItem('USER_SESSION');

    if (!session) {
      return false;
    }

    // Validate session
    await supabase.auth.getSession();
  } catch (error) {
    Logger.error('[Auth Debug] Error reading AsyncStorage session', error as Error, { component: 'authCheck' });
  }

  // Check Supabase session
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {

    }
  } catch (error) {
    Logger.error('[Auth Debug] Error getting Supabase session', error as Error, { component: 'authCheck' });
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

    Logger.warn('[getCurrentUserId] No user ID found in any source', { component: 'authCheck' });
    return null;
  } catch (error) {
    Logger.error('[getCurrentUserId] Error getting user ID', error as Error, { component: 'authCheck' });
    return null;
  }
};

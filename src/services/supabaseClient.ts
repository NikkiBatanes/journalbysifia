/**
 * Supabase client configuration for the siFia app
 * Handles authentication, session persistence, and database connections
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-get-random-values';

// Import environment variables
import { getEnvironmentConfig, validateEnvironment } from '../config/environment';

// Get environment configuration
const env = getEnvironmentConfig();
const supabaseUrl = env.SUPABASE_URL || 'https://aesmrjinczhknchlrsmt.supabase.co';
const supabaseAnonKey = env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NjYxOTMsImV4cCI6MjA2NDM0MjE5M30.x7XMjrm9WWlvEdc5eaK7Z5Fy-V_85qMJQ7pInsrKIyM';

// Validate environment on startup
if (!validateEnvironment()) {
  console.warn('⚠️ Some environment variables are missing. Please check your .env file.');
}

// Create Supabase client with proper session persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: async (key: string) => {
        // Map Supabase's internal keys to our storage keys
        let storageKey = key;
        if (key.includes('access-token')) {
          storageKey = 'ACCESS_TOKEN';
        }
        if (key.includes('refresh-token')) {
          storageKey = 'REFRESH_TOKEN';
        }
        if (key.includes('user')) {
          storageKey = 'USER';
        }

        // Disable storage logging to improve performance
        // if (__DEV__) {
        //   console.log('[SupabaseClient] Storage getItem:', { originalKey: key, mappedKey: storageKey });
        // }
        const value = await AsyncStorage.getItem(storageKey);
        // if (__DEV__) {
        //   console.log('[SupabaseClient] Retrieved from storage:', { key: storageKey, hasValue: !!value });
        // }
        return value;
      },
      setItem: async (key: string, value: string) => {
        // Map Supabase's internal keys to our storage keys
        let storageKey = key;
        if (key.includes('access-token')) {
          storageKey = 'ACCESS_TOKEN';
        }
        if (key.includes('refresh-token')) {
          storageKey = 'REFRESH_TOKEN';
        }
        if (key.includes('user')) {
          storageKey = 'USER';
        }

        // Disable storage logging to improve performance
        // if (__DEV__) {
        //   console.log('[SupabaseClient] Storage setItem:', { originalKey: key, mappedKey: storageKey });
        // }
        await AsyncStorage.setItem(storageKey, value);
      },
      removeItem: async (key: string) => {
        // Map Supabase's internal keys to our storage keys
        let storageKey = key;
        if (key.includes('access-token')) {
          storageKey = 'ACCESS_TOKEN';
        }
        if (key.includes('refresh-token')) {
          storageKey = 'REFRESH_TOKEN';
        }
        if (key.includes('user')) {
          storageKey = 'USER';
        }

        // Disable storage logging to improve performance
        // if (__DEV__) {
        //   console.log('[SupabaseClient] Storage removeItem:', { originalKey: key, mappedKey: storageKey });
        // }
        await AsyncStorage.removeItem(storageKey);
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for React Native
    storageKey: 'sb-auth-token',
  },
});

// Helper functions for session management
export const getSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[SupabaseClient] Error getting session:', error);
      return null;
    }
    return session;
  } catch (error) {
    console.error('[SupabaseClient] Unexpected error getting session:', error);
    return null;
  }
};

export const getUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('[SupabaseClient] Error getting user:', error);
      return null;
    }
    return user;
  } catch (error) {
    console.error('[SupabaseClient] Unexpected error getting user:', error);
    return null;
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[SupabaseClient] Error signing out:', error);
      throw error;
    }

    // Clear all auth-related storage
    await AsyncStorage.multiRemove(['ACCESS_TOKEN', 'REFRESH_TOKEN', 'USER']);
    console.log('[SupabaseClient] Successfully signed out');
  } catch (error) {
    console.error('[SupabaseClient] Unexpected error signing out:', error);
    throw error;
  }
};

// Auth state change listener
export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback);
};

// Database types (can be generated with Supabase CLI)
export type Database = {
  public: {
    Tables: {
      playbooks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          truth_in_love: any;
          bible_verse: any;
          direct_challenge: any;
          challenge_cta: string | null;
          status: 'ongoing' | 'completed' | 'paused';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          truth_in_love?: any;
          bible_verse?: any;
          direct_challenge?: any;
          challenge_cta?: string | null;
          status?: 'ongoing' | 'completed' | 'paused';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          truth_in_love?: any;
          bible_verse?: any;
          direct_challenge?: any;
          challenge_cta?: string | null;
          status?: 'ongoing' | 'completed' | 'paused';
          created_at?: string;
          updated_at?: string;
        };
      };
      playbook_action_steps: {
        Row: {
          id: string;
          playbook_id: string;
          text: string;
          completed: boolean;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          playbook_id: string;
          text: string;
          completed?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          playbook_id?: string;
          text?: string;
          completed?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      playbook_sub_tasks: {
        Row: {
          id: string;
          action_step_id: string;
          text: string;
          completed: boolean;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          action_step_id: string;
          text: string;
          completed?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          action_step_id?: string;
          text?: string;
          completed?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      playbook_affirmations: {
        Row: {
          id: string;
          playbook_id: string;
          text: string;
          completed: boolean;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          playbook_id: string;
          text: string;
          completed?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          playbook_id?: string;
          text?: string;
          completed?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      playbooks_with_progress: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          truth_in_love: any;
          bible_verse: any;
          direct_challenge: any;
          challenge_cta: string | null;
          status: 'ongoing' | 'completed' | 'paused';
          created_at: string;
          updated_at: string;
          completed_tasks: number;
          total_tasks: number;
          progress_percentage: number;
        };
      };
    };
    Functions: {
      calculate_playbook_progress: {
        Args: {
          playbook_uuid: string;
        };
        Returns: {
          completed_tasks: number;
          total_tasks: number;
          progress_percentage: number;
        }[];
      };
    };
  };
};

export default supabase;

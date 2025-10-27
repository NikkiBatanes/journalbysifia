import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { createClient } from '@supabase/supabase-js';
import { Playbook } from '../interfaces/playbook';

// Import environment variables
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

// Session key for AsyncStorage
import { SESSION_STORAGE_KEY } from '../constants/sessionConstants';

const SESSION_KEY = SESSION_STORAGE_KEY;

// Fallback values for development
const DEFAULT_SUPABASE_URL = 'https://aesmrjinczhknchlrsmt.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NjYxOTMsImV4cCI6MjA2NDM0MjE5M30.x7XMjrm9WWlvEdc5eaK7Z5Fy-V_85qMJQ7pInsrKIyM';

const supabaseUrl = SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

// Create Supabase client with proper session persistence
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: async (key: string) => {
        // Map Supabase's internal keys to our storage keys
        let storageKey = key;
        if (key.includes('access-token')) {storageKey = 'ACCESS_TOKEN';}
        if (key.includes('refresh-token')) {storageKey = 'REFRESH_TOKEN';}
        if (key.includes('user')) {storageKey = 'USER';}

        const value = await AsyncStorage.getItem(storageKey);

        return value;
      },
      setItem: async (key: string, value: string) => {
        // Map Supabase's internal keys to our storage keys
        let storageKey = key;
        if (key.includes('access-token')) {storageKey = 'ACCESS_TOKEN';}
        if (key.includes('refresh-token')) {storageKey = 'REFRESH_TOKEN';}
        if (key.includes('user')) {storageKey = 'USER';}

        await AsyncStorage.setItem(storageKey, value);
      },
      removeItem: async (key: string) => {
        // Map Supabase's internal keys to our storage keys
        let storageKey = key;
        if (key.includes('access-token')) {storageKey = 'ACCESS_TOKEN';}
        if (key.includes('refresh-token')) {storageKey = 'REFRESH_TOKEN';}
        if (key.includes('user')) {storageKey = 'USER';}

        await AsyncStorage.removeItem(storageKey);
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for React Native
    storageKey: 'sb-auth-token',
    debug: true, // Enable auth debug logging in development
  },
  global: {
    headers: {
      'X-Client-Info': 'siFia/1.0.0',
    },
  },
});

export { supabase };

// Use environment variables with fallbacks
const config = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
};

// Log configuration (remove in production)

// Legacy session management functions - DEPRECATED
// These functions are no longer used and will be removed in future versions
// Modern authentication uses direct Supabase session management

// DEPRECATED: Session storage is handled automatically by Supabase
export const storeSession = async (_sessionToStore: any) => {
  console.warn('DEPRECATED: storeSession() is no longer needed. Supabase handles session storage automatically.');
  return true;
};

// DEPRECATED: Use supabase.auth.getSession() instead
export const getSession = async () => {
  console.warn('DEPRECATED: getSession() from supabaseApi.ts is deprecated. Use supabase.auth.getSession() instead.');
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

// DEPRECATED: Use supabase.auth.getSession() instead
export const checkAuth = async () => {
  console.warn('DEPRECATED: checkAuth() from supabaseApi.ts is deprecated. Use supabase.auth.getSession() instead.');
  const { data: { session } } = await supabase.auth.getSession();
  return !!session?.access_token;
};

// DEPRECATED: Session clearing is handled by supabase.auth.signOut()
export const clearSession = async () => {
  console.warn('DEPRECATED: clearSession() is deprecated. Use supabase.auth.signOut() instead.');
  return true;
};

// Sign in with email and password

export async function signIn(email: string, password: string) {
  try {

    // Use Supabase's built-in authentication method
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Authentication failed:', error);
      return { data: null, error };
    }

    if (!data?.session) {
      const errorMsg = 'No session received from Supabase';
      console.error(errorMsg);
      return { data: null, error: { message: errorMsg } };
    }

    // The session is automatically stored by Supabase client
    // But we also store it in our custom format for compatibility
    const session = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
      user: data.user,
    };

    await storeSession(session);

    return { data: session, error: null };
  } catch (error) {
    console.error('Sign in error:', error);
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

// Sign up with email and password
export async function signUp(email: string, password: string) {
  try {
    const response = await fetch(`${config.url}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data };
    }

    await storeSession(data);
    return { data, error: null };
  } catch (error) {
    console.error('Sign up error:', error);
    return { data: null, error: { message: 'Network error' } };
  }
}

// Helper to get the REST endpoint
function getApiUrl(path: string): string {
  return `${config.url}/rest/v1${path}`;
}

// Helper to get default headers with authentication
async function getHeadersWithAuth(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'apikey': config.anonKey,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  try {
    const sessionStr = await AsyncStorage.getItem(SESSION_KEY);
    if (!sessionStr) {
      return headers; // Return minimal headers if no session
    }

    const session = JSON.parse(sessionStr) as {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
    };

    // Check if token is expired (with 1 minute buffer)
    const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    const isExpired = !expiresAt || now >= (expiresAt - 60000); // 1 minute before actual expiration

    if (isExpired && session.refresh_token) {

      try {
        const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.anonKey,
          },
          body: JSON.stringify({
            refresh_token: session.refresh_token,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to refresh token');
        }

        const newSession = await response.json() as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
        };

        // Update session with new tokens
        const updatedSession = {
          ...session,
          access_token: newSession.access_token,
          refresh_token: newSession.refresh_token || session.refresh_token,
          expires_at: Math.floor(now / 1000) + (newSession.expires_in || 3600),
        };

        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
        headers.Authorization = `Bearer ${updatedSession.access_token}`;
      } catch (error) {
        console.error('[Auth] Token refresh failed:', error);
        await AsyncStorage.removeItem(SESSION_KEY);
        throw new Error('Session expired. Please sign in again.');
      }
    } else if (session.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    return headers;
  } catch (error) {
    console.error('[Auth] Error in getHeadersWithAuth:', error);
    // Return minimal headers without auth if something goes wrong
    return {
      'apikey': config.anonKey,
      'Content-Type': 'application/json',
    };
  }
}

// Example: Fetch all rows from a table
export async function fetchTable(table: string) {
  const res = await fetch(getApiUrl(`/${table}`), {
    method: 'GET',
    headers: await getHeadersWithAuth(),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

// Example: Insert a row
export async function insertRow(table: string, data: Record<string, any>) {
  const res = await fetch(getApiUrl(`/${table}`), {
    method: 'POST',
    headers: await getHeadersWithAuth(),
    body: JSON.stringify([data]),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

// Example: Update a row by primary key (id)
export async function updateRow(table: string, id: string | number, data: Record<string, any>) {
  // Convert ID to string for the URL to ensure consistent comparison
  const idStr = String(id);
  const url = getApiUrl(`/${table}?id=eq.${idStr}`);
  const response = await fetch(url, {
    method: 'PATCH',
    headers: await getHeadersWithAuth(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

// Example: Delete a row by primary key (id)
export async function deleteRow(table: string, id: string | number) {
  // Convert ID to string for the URL to ensure consistent comparison
  const idStr = String(id);

  const url = getApiUrl(`/${table}?id=eq.${idStr}`);
  const response = await fetch(url, {
    method: 'DELETE',
    headers: await getHeadersWithAuth(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[deleteRow] Error deleting row:', errorText);
    throw new Error(errorText);
  }
  return response.json();
}

// --- HYBRID PLAYBOOK PERSISTENCE HELPERS ---
const PLAYBOOKS_KEY = 'playbooks';

/**
 * Save a playbook to both Supabase and AsyncStorage.
 * @param playbook - Playbook object (must include userId)
 * @param userId - User's unique ID
 */
/**
 * Update a playbook's action steps
 * @param playbookId - The ID of the playbook to update
 * @param actionSteps - The updated action steps
 * @returns Promise that resolves when the update is complete
 */
// Helper function to check if a string is a valid UUID
function isValidUUID(uuid: string | number | undefined): boolean {
  if (uuid === undefined || uuid === null) {
    return false;
  }
  // Convert to string if it's a number
  const uuidStr = String(uuid);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuidStr);
}

/**
 * Update a playbook's action steps in both Supabase (if valid UUID) and local storage
 * @param playbookId - The ID of the playbook to update (can be any string, but only UUIDs will update Supabase)
 * @param actionSteps - The updated action steps to save
 * @returns Promise that resolves with success status
 */
// Calculate completed/total tasks for action steps
export function calculateTaskStats(actionSteps: any[]) {
  let completed = 0;
  let total = 0;
  actionSteps?.forEach((step: any) => {
    total++;
    if (step.completed) {completed++;}
    if (Array.isArray(step.subtasks)) {
      step.subtasks.forEach((sub: any) => {
        total++;
        if (sub.completed) {completed++;}
      });
    }
  });
  return { completed, total };
}

// Update a playbook's action steps and completedAt
// Only include fields that we know exist in the Supabase schema
interface SupabasePlaybookUpdate {
  action_steps?: any[];
  progress?: number;
  total_tasks?: number;
  updated_at?: string;
  completed_at?: string | null;
}

export async function savePlaybook(playbook: Playbook, userId: string) {
  try {

    if (!playbook.id) {
      console.error('[savePlaybook] Cannot save playbook without ID');
      return null;
    }

    // Save to AsyncStorage
    const stored = await AsyncStorage.getItem(PLAYBOOKS_KEY);
    const playbooks = stored ? JSON.parse(stored) : [];
    const existingIndex = playbooks.findIndex((p: any) => p.id === playbook.id);

    if (existingIndex >= 0) {
      playbooks[existingIndex] = playbook;
    } else {
      playbooks.push(playbook);
    }

    await AsyncStorage.setItem(PLAYBOOKS_KEY, JSON.stringify(playbooks));

    // If online, save to Supabase
    if (isValidUUID(playbook.id)) {
      // Convert to snake_case for Supabase
      const { actionSteps, totalTasks, updatedAt, completedAt, ...rest } = playbook;
      const supabaseData = {
        ...rest,
        action_steps: actionSteps,
        total_tasks: totalTasks,
        updated_at: updatedAt,
        completed_at: completedAt,
        user_id: userId,
      };

      await updateRow('playbooks', playbook.id, supabaseData);
    }

    return playbook;
  } catch (error) {
    console.error('[savePlaybook] Error saving playbook:', error);
    return null;
  }
}

export async function updatePlaybookActionSteps(playbookId: string | undefined, actionSteps: any[]) {

  if (!playbookId) {

    return { success: false, error: 'No playbook ID provided' };
  }

  try {
    // Calculate progress and total tasks
    const { completed, total } = calculateTaskStats(actionSteps);
    const progress = total > 0 ? (completed / total) * 100 : 0; // Convert to percentage
    const allStepsCompleted = total > 0 && completed === total;
    const now = new Date().toISOString();

    // Prepare update data for Supabase and local storage
    // Only include the most essential fields that we know exist in Supabase
    const updateData: SupabasePlaybookUpdate = {
      action_steps: actionSteps,
      progress,
      total_tasks: total,
      updated_at: now,
      ...(allStepsCompleted && { completed_at: now }),
    };

    // Local data includes both snake_case and camelCase for compatibility
    const localUpdateData = {
      ...updateData,
      actionSteps,
      totalTasks: total,
      updatedAt: now,
      completedAt: allStepsCompleted ? now : null,
      status: allStepsCompleted ? 'completed' : 'inProgress',
    };

    // Only try to update in Supabase if we have a valid UUID
    const isUuid = isValidUUID(playbookId);
    if (isUuid) {
      try {
        // updateData already has the correct snake_case fields for Supabase

        await updateRow('playbooks', playbookId, updateData);

      } catch (error) {
        console.error('[updatePlaybookActionSteps] Supabase update failed:', error);
        // Continue to update local storage even if Supabase fails
      }
    }

    // Always update local storage as a fallback
    try {
      const stored = await AsyncStorage.getItem(PLAYBOOKS_KEY);
      const playbooks = stored ? JSON.parse(stored) : [];
      const updatedPlaybooks = playbooks.map((pb: any) => {
        if (pb.id !== playbookId) {return pb;}
        return {
          ...pb,
          ...localUpdateData,
          action_steps: actionSteps,
          total_tasks: total,
          updated_at: now,
          completed_at: allStepsCompleted ? now : null,
        };
      });
      await AsyncStorage.setItem(PLAYBOOKS_KEY, JSON.stringify(updatedPlaybooks));

      return { success: true };
    } catch (storageError) {
      console.error('[updatePlaybookActionSteps] Error updating local storage:', storageError);
      throw storageError;
    }
  } catch (error) {
    console.error('[updatePlaybookActionSteps] Unexpected error:', error);
    throw error;
  }
}

// ...

/**
 * Get playbooks for a user: tries to fetch from Supabase first, falls back to AsyncStorage if needed.
 * @param userId - User's unique ID
 * @returns Playbook array
 */
export async function getPlaybooks(userId: string) {

  let remotePlaybooks: any[] = [];
  let localPlaybooks: any[] = [];
  // mergedPlaybooks is intentionally left for future use

  // Helper to normalize playbook data structure
  const normalizePlaybook = (pb: any): any => {
    // If it's already in camelCase (from local storage or already normalized)
    if (pb.actionSteps || pb.action_steps) {
      return {
        ...pb,
        // Ensure we have both camelCase and snake_case versions of all fields
        id: pb.id,
        title: pb.title,
        userInput: pb.userInput || pb.user_input,
        user_input: pb.userInput || pb.user_input,
        truthInLove: pb.truthInLove || pb.truth_in_love || {},
        truth_in_love: pb.truthInLove || pb.truth_in_love || {},
        actionSteps: pb.actionSteps || pb.action_steps || [],
        action_steps: pb.actionSteps || pb.action_steps || [],
        affirmations: pb.affirmations || pb.daily_affirmations || [],
        daily_affirmations: pb.affirmations || pb.daily_affirmations || [],
        bibleVerse: pb.bibleVerse || pb.bible_verse || {},
        bible_verse: pb.bibleVerse || pb.bible_verse || {},
        directChallenge: pb.directChallenge || pb.direct_challenge,
        direct_challenge: pb.directChallenge || pb.direct_challenge,
        createdAt: pb.createdAt || pb.created_at || new Date().toISOString(),
        created_at: pb.createdAt || pb.created_at || new Date().toISOString(),
        updatedAt: pb.updatedAt || pb.updated_at || new Date().toISOString(),
        updated_at: pb.updatedAt || pb.updated_at || new Date().toISOString(),
        userId: pb.userId || pb.user_id || userId,
        user_id: pb.userId || pb.user_id || userId,
        progress: pb.progress || 0,
        totalTasks: pb.totalTasks || pb.total_tasks || 0,
        total_tasks: pb.totalTasks || pb.total_tasks || 0,
        challengeCTA: pb.challengeCTA || pb.challenge_cta,
        challenge_cta: pb.challengeCTA || pb.challenge_cta,
        profileImage: pb.profileImage || pb.profile_image,
        profile_image: pb.profileImage || pb.profile_image,
        completedAt: pb.completedAt || pb.completed_at || null,
        completed_at: pb.completedAt || pb.completed_at || null,
        status: pb.status || (pb.completedAt || pb.completed_at ? 'completed' : 'inProgress'),
      };
    }
    return pb; // Return as-is if no action steps
  };

  // 1. Try to fetch from Supabase first
  try {
    const headers = await getHeadersWithAuth();
    const response = await fetch(
      `${getApiUrl('/playbooks')}?user_id=eq.${userId}&order=created_at.desc`,
      {
        method: 'GET',
        headers: new Headers(headers),
      }
    );

    if (response.ok) {
      const remoteData = await response.json();
      remotePlaybooks = remoteData.map(normalizePlaybook);

    } else {
      throw new Error(await response.text());
    }
  } catch (error: unknown) {
    console.error('[getPlaybooks] Error fetching from Supabase:', error);
    // If there's an auth error, clear the session
    if (error instanceof Error && error.message && error.message.includes('JWT')) {

      await clearSession();
      // You might want to trigger a re-login flow here
    }
  }

  // 2. Always get local playbooks as fallback or for merging
  try {
    const stored = await AsyncStorage.getItem(PLAYBOOKS_KEY);
    localPlaybooks = stored ? JSON.parse(stored).map(normalizePlaybook) : [];

  } catch (error) {
    console.error('[getPlaybooks] AsyncStorage get error:', error);
    // If local storage fails but we have remote, return remote
    if (remotePlaybooks.length > 0) {
      return remotePlaybooks;
    }
    // If both fail, return empty array
    return [];
  }

  // Merge remote and local playbooks, preferring remote versions when IDs match
  const mergedPlaybooks = [...remotePlaybooks];

  // Add local playbooks that don't exist in remote
  localPlaybooks.forEach(localPb => {
    const exists = mergedPlaybooks.some(remotePb => String(remotePb.id) === String(localPb.id));
    if (!exists) {
      mergedPlaybooks.push(localPb);
    }
  });

  return mergedPlaybooks;
}

/**
 * Delete a playbook from both Supabase and AsyncStorage.
 * @param id - Playbook id (can be string or number)
 * @param _userId - User's unique ID (unused parameter)
 * @returns Promise that resolves when the deletion is complete
 */
export async function deletePlaybook(id: string | number, _userId: string): Promise<{ success: boolean; error?: string }> {
  if (!id) {
    console.error('[deletePlaybook] No playbook ID provided');
    return { success: false, error: 'No playbook ID provided' };
  }

  let supabaseSuccess = false;
  let localSuccess = false;

  // Convert ID to string for consistent comparison
  const idStr = String(id);

  // 1. Delete from Supabase if we have a valid UUID
  if (isValidUUID(idStr)) {
    try {

      await deleteRow('playbooks', idStr);
      supabaseSuccess = true;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[deletePlaybook] Error deleting from Supabase (${idStr}):`, errorMessage);
      // Continue with local deletion even if Supabase fails

    }
  } else {

  }

  // 2. Delete from AsyncStorage
  try {

    const stored = await AsyncStorage.getItem(PLAYBOOKS_KEY);
    let playbooks = stored ? JSON.parse(stored) : [];
    const initialLength = playbooks.length;
    playbooks = playbooks.filter((pb: any) => String(pb.id) !== idStr);

    if (playbooks.length < initialLength) {
      await AsyncStorage.setItem(PLAYBOOKS_KEY, JSON.stringify(playbooks));

      localSuccess = true;
    } else {

    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[deletePlaybook] Error deleting from AsyncStorage (${idStr}):`, errorMessage);
    return { success: false, error: `Local deletion failed: ${errorMessage}` };
  }

  // If we tried to delete from Supabase but failed, but local deletion succeeded
  if (!supabaseSuccess && id && isValidUUID(String(id))) {
    console.warn(`[deletePlaybook] Supabase deletion failed for ${idStr}, but local deletion succeeded`);
    // You might want to implement a retry mechanism or offline queue here
  }

  return { success: localSuccess || supabaseSuccess };
}
// --- END HYBRID HELPERS ---

// Generate Playbook via Supabase Edge Function
export async function generatePlaybook(userInput: string, userName: string) {
  const functionUrl = `${config.url}/functions/v1/generate-playbook`;

  try {
    // Get fresh session from Supabase (handles token refresh automatically)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('[generatePlaybook] Session error:', sessionError);
      throw new Error('Authentication required. Please log in again.');
    }

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userInput, userName }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to generate playbook');
    }
    return await response.json();
  } catch (err: any) {
    console.error('generatePlaybook error:', err);

    // Provide more specific error messages
    if (err.message?.includes('Invalid JWT') || err.message?.includes('401')) {
      throw new Error('Your session has expired. Please log out and log back in.');
    } else if (err.message?.includes('Authentication required')) {
      throw new Error('Authentication required. Please log in again.');
    } else if (err.message?.includes('Network request failed')) {
      throw new Error('Unable to connect to the AI service. Please check your internet connection and try again.');
    } else if (err.message?.includes('Failed to fetch')) {
      throw new Error('Connection timeout. Please try generating your playbook again.');
    } else {
      throw new Error('Failed to generate playbook. Please try again in a moment.');
    }
  }
}

// Generate Devotional via Supabase Edge Function with retry logic
export async function generateDevotional(duration: number, playbookId?: string, userInput?: string, maxRetries = 2) {
  const functionUrl = `${config.url}/functions/v1/generate-devotional`;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const session = await getSession();
      if (!session) {
        throw new Error('No active session. Please sign in.');
      }

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.anonKey,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          duration,
          playbookId,
          userInput: userInput || 'General spiritual growth',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Validate the response structure
      if (result && Array.isArray(result.days) && result.days.length > 0) {

        // Save the generated devotional to the database
        const { data: savedDevotional, error: saveError } = await supabase
          .from('devotionals')
          .insert({
            user_id: session.user.id,
            title: result.title || 'My Devotional',
            description: result.description || '',
            category: 'Growth', // Default category from valid list
            categories: ['Growth'], // Default categories array
            playbook_id: playbookId || null,
            playbook_title: null, // Will be populated if needed
            user_input: userInput || 'General spiritual growth',
            total_days: duration,
            current_day: 1,
            progress: 0,
            completed: false,
            days: result.days,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (saveError) {
          console.error('Error saving devotional to database:', saveError);
          throw new Error(`Failed to save devotional: ${saveError.message}`);
        }

        // Return the saved devotional with the database ID
        return {
          ...result,
          id: savedDevotional.id,
          user_id: savedDevotional.user_id,
          created_at: savedDevotional.created_at,
          updated_at: savedDevotional.updated_at,
        };
      } else {
        throw new Error('Invalid devotional format received from server');
      }
    } catch (err: unknown) {
      const error = err as Error;
      lastError = error;
      console.warn(`Attempt ${attempt + 1} failed:`, error);
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const delay = 1000 * Math.pow(2, attempt);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // If we get here, all retries failed
  const errorMessage = lastError?.message || 'Failed to generate devotional after multiple attempts';
  console.error('All devotional generation attempts failed:', errorMessage);
  throw new Error(errorMessage);
}


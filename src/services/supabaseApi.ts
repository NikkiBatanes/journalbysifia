import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase project details
const SUPABASE_URL = 'https://aesmrjinczhknchlrsmt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NjYxOTMsImV4cCI6MjA2NDM0MjE5M30.x7XMjrm9WWlvEdc5eaK7Z5Fy-V_85qMJQ7pInsrKIyM';
const SESSION_KEY = '@supabase_session';

// Session management
export const storeSession = async (session: any) => {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch (error) {
    console.error('Error storing session:', error);
    return false;
  }
};

export const getSession = async () => {
  try {
    const session = await AsyncStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

export const clearSession = async () => {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing session:', error);
    return false;
  }
};

// Check if user is authenticated
export const checkAuth = async () => {
  const session = await getSession();
  return !!session?.access_token;
};

// Sign in with email and password
export async function signIn(email: string, password: string) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password, client_id: SUPABASE_ANON_KEY, grant_type: 'password' })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { error: data };
    }

    await storeSession(data);
    return { data, error: null };
  } catch (error) {
    console.error('Sign in error:', error);
    return { data: null, error: { message: 'Network error' } };
  }
}

// Sign up with email and password
export async function signUp(email: string, password: string) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password })
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
function getApiUrl(table: string) {
  return `${SUPABASE_URL}/rest/v1/${table}`;
}

// Helper to get default headers with authentication
async function getHeadersWithAuth(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
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
      console.log('[Auth] Token expired, attempting to refresh...');
      try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
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
        headers['Authorization'] = `Bearer ${updatedSession.access_token}`;
      } catch (error) {
        console.error('[Auth] Token refresh failed:', error);
        await AsyncStorage.removeItem(SESSION_KEY);
        throw new Error('Session expired. Please sign in again.');
      }
    } else if (session.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    return headers;
  } catch (error) {
    console.error('[Auth] Error in getHeadersWithAuth:', error);
    // Return minimal headers without auth if something goes wrong
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    };
  }
}

// Example: Fetch all rows from a table
export async function fetchTable(table: string) {
  const res = await fetch(getApiUrl(table), {
    method: 'GET',
    headers: await getHeadersWithAuth(),
  });
  console.log('Supabase fetch response:', res);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

// Example: Insert a row
export async function insertRow(table: string, data: Record<string, any>) {
  const res = await fetch(getApiUrl(table), {
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
export async function updateRow(table: string, id: string, data: Record<string, any>) {
  const url = getApiUrl(table) + `?id=eq.${id}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: await getHeadersWithAuth(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

// Example: Delete a row by primary key (id)
export async function deleteRow(table: string, id: string) {
  console.log('[deleteRow] Deleting row:', { table, id });
  const url = getApiUrl(table) + `?id=eq.${id}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: await getHeadersWithAuth()
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
 * @param playbookId - ID of the playbook to update
 * @param actionSteps - Updated action steps
 * @param userId - User's unique ID
 */
// Helper function to validate UUID format
export async function updatePlaybookActionSteps(playbookId: string, actionSteps: any[]) {
  try {
    // First try to update in Supabase if we have a valid ID (UUID or numeric)
    if (playbookId) {
      try {
        await updateRow('playbooks', playbookId, {
          action_steps: actionSteps,
          updated_at: new Date().toISOString()
        });
      } catch (error) {
        console.warn('[updatePlaybookActionSteps] Error updating in Supabase, falling back to local storage:', error);
      }
    } else {
      console.warn('[updatePlaybookActionSteps] No playbookId provided, only saving to local storage');
    }
    
    // Update in AsyncStorage regardless of UUID validity
    const existing = await AsyncStorage.getItem(PLAYBOOKS_KEY);
    if (existing) {
      const playbooks = JSON.parse(existing);
      const updatedPlaybooks = playbooks.map((pb: any) => 
        pb.id === playbookId 
          ? { ...pb, actionSteps, updated_at: new Date().toISOString() } 
          : pb
      );
      await AsyncStorage.setItem(PLAYBOOKS_KEY, JSON.stringify(updatedPlaybooks));
    }
    
    return { success: true };
  } catch (error) {
    console.error('[updatePlaybookActionSteps] Error:', error);
    throw error;
  }
}

export async function savePlaybook(playbook: any, userId: string) {
  console.log('[savePlaybook] userId:', userId);
  console.log('[savePlaybook] playbook:', playbook);
  // 1. Save to Supabase
  let supabasePlaybook;
  try {
    // Map camelCase to snake_case and only send fields present in the DB schema
    // Ensure NOT NULL columns are always set with defaults
    const playbookForSupabase: Record<string, any> = {
      // Do NOT set id unless it is a valid UUID. Let Supabase generate it.
      // id: playbook.id,
      title: playbook.title,
      user_input: playbook.userInput,
      truth_in_love: playbook.truthInLove ?? {},
      action_steps: playbook.actionSteps ?? [],
      daily_affirmations: playbook.affirmations ?? [],
      bible_verse: playbook.bibleVerse ?? {},
      direct_challenge: playbook.directChallenge,
      created_at: playbook.createdAt,
      updated_at: playbook.updatedAt,
      user_id: userId,
      progress: playbook.progress,
      total_tasks: playbook.totalTasks,
      challenge_cta: playbook.challengeCTA,
      profile_image: playbook.profileImage,
    };
    // Remove undefined fields
    Object.keys(playbookForSupabase).forEach(
      (key) => playbookForSupabase[key] === undefined && delete playbookForSupabase[key]
    );
    const [inserted] = await insertRow('playbooks', playbookForSupabase);
    supabasePlaybook = inserted;
    console.log('[savePlaybook] Saved to Supabase:', inserted);
  } catch (error: unknown) {
    console.error('[savePlaybook] Supabase save error:', error);
  }
  // 2. Save to AsyncStorage (always)
  try {
    const existing = await AsyncStorage.getItem(PLAYBOOKS_KEY);
    let playbooks = existing ? JSON.parse(existing) : [];
    playbooks.unshift(supabasePlaybook || { ...playbook, user_id: userId });
    await AsyncStorage.setItem(PLAYBOOKS_KEY, JSON.stringify(playbooks));
    console.log('[savePlaybook] Saved to AsyncStorage. Total:', playbooks.length);
  } catch (error: unknown) {
    console.error('[savePlaybook] AsyncStorage save error:', error);
  }
}


/**
 * Get playbooks for a user: tries to fetch from Supabase first, falls back to AsyncStorage if needed.
 * @param userId - User's unique ID
 * @returns Playbook array
 */
export async function getPlaybooks(userId: string) {
  console.log('[getPlaybooks] userId:', userId);
  let playbooks = [];
  
  // 1. Try to fetch from Supabase first
  try {
    const headers = await getHeadersWithAuth();
    const response = await fetch(
      `${getApiUrl('playbooks')}?user_id=eq.${userId}&order=created_at.desc`,
      {
        method: 'GET',
        headers: new Headers(headers),
      }
    );

    if (response.ok) {
      playbooks = await response.json();
      // Update local storage with fresh data
      await AsyncStorage.setItem(PLAYBOOKS_KEY, JSON.stringify(playbooks));
      console.log('[getPlaybooks] Successfully fetched from Supabase. Count:', playbooks.length);
      return playbooks;
    }
    throw new Error(await response.text());
  } catch (error: unknown) {
    console.error('[getPlaybooks] Error fetching from Supabase:', error);
    // If there's an auth error, clear the session
    if (error instanceof Error && error.message && error.message.includes('JWT')) {
      console.log('[getPlaybooks] Auth error, clearing session');
      await clearSession();
      // You might want to trigger a re-login flow here
    }

    // 2. Fall back to local storage if Supabase fails
    try {
      const stored = await AsyncStorage.getItem(PLAYBOOKS_KEY);
      playbooks = stored ? JSON.parse(stored) : [];
      console.log('[getPlaybooks] Falling back to AsyncStorage. Count:', playbooks.length);
    } catch (storageError: unknown) {
      console.error('[getPlaybooks] AsyncStorage get error:', storageError);
    }
  }

  return playbooks;
}


/**
 * Delete a playbook from both Supabase and AsyncStorage.
 * @param id - Playbook id
 * @param _userId - User's unique ID (unused parameter)
 */
export async function deletePlaybook(id: string, _userId: string) {
  // 1. Delete from Supabase
  try {
    await deleteRow('playbooks', id);
  } catch (error: unknown) {
    console.error('[deletePlaybook] Supabase delete error:', error);
  }
  // 2. Delete from AsyncStorage
  try {
    const stored = await AsyncStorage.getItem(PLAYBOOKS_KEY);
    let playbooks = stored ? JSON.parse(stored) : [];
    playbooks = playbooks.filter((pb: any) => pb.id !== id);
    await AsyncStorage.setItem(PLAYBOOKS_KEY, JSON.stringify(playbooks));
  } catch (error: unknown) {
    console.error('[deletePlaybook] AsyncStorage delete error:', error);
  }
}
// --- END HYBRID HELPERS ---

// Generate Playbook via Supabase Edge Function
export async function generatePlaybook(userInput: string, userName: string) {
  const functionUrl = 'https://aesmrjinczhknchlrsmt.functions.supabase.co/generate-playbook';
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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
    throw err;
  }
}



const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8; // (r & 0x3) | 0x8 equivalent
    return v.toString(16);
  });
};

import { supabase } from '../services/supabaseApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Debug Utilities ---
export async function debugPrintSupabaseStorage() {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const supabaseKeys = allKeys.filter(k => k.includes('supabase') || k.includes('sb-') || k.includes('auth') || k.includes('token'));
    const keyValues: Record<string, string | null> = {};
    for (const key of supabaseKeys) {
      keyValues[key] = await AsyncStorage.getItem(key);
    }
    console.log('Supabase-related AsyncStorage:', keyValues);
  } catch (e) {
    console.error('Error printing Supabase AsyncStorage:', e);
  }
}

export async function debugPrintSession(label: string) {
  const { data: { session }, error } = await supabase.auth.getSession();
  console.log(`[${label}] Supabase session:`, session, error);
}


// Debug: Log when storage module loads
console.log('=== journalStorage.ts LOADED ===');

// Removed unused debug cache

// Debug: Log all AsyncStorage operations
const debugStorage = {
  setItem: async (key: string, value: string): Promise<void> => {
    console.log(`[AsyncStorage] SET ${key}`, value);
    return AsyncStorage.setItem(key, value);
  },
  getItem: async (key: string): Promise<string | null> => {
    const value = await AsyncStorage.getItem(key);
    console.log(`[AsyncStorage] GET ${key}`, value);
    return value;
  },
  removeItem: async (key: string): Promise<void> => {
    console.log(`[AsyncStorage] REMOVE ${key}`);
    return AsyncStorage.removeItem(key);
  },
};

// Use debug storage in development
const storage = __DEV__ ? debugStorage : AsyncStorage;

// Initialize AsyncStorage with a test value on first load
const initStorage = async (): Promise<void> => {
  try {
    const testKey = '@siFia_storage_test';
    await storage.setItem(testKey, 'test');
    await storage.removeItem(testKey);
    console.log('AsyncStorage initialized successfully');
  } catch (e) {
    console.error('Failed to initialize AsyncStorage', e);
  }
};

initStorage();

// Add debug logging for Supabase auth state
supabase.auth.onAuthStateChange((event: string, session: any): void => {
  console.log('Auth state changed:', event, session?.user?.id);
});

// Add a function to check the current session
export const checkSession = async (): Promise<{ session: any; error: any }> => {
  const { data: { session }, error } = await supabase.auth.getSession();
  console.log('Current session:', { session: session?.user?.id, error });
  return { session, error };
};

// --- Types ---

export interface TimeBlockEntry {
  id: string;
  user_id: string;
  selected_date: string; // e.g. '2025-07-10'
  start_time: string;    // e.g. '09:00'
  end_time: string;      // e.g. '10:00'
  all_day: boolean;
  title: string;
  location: string;
  category: string;
  repeat_status: string;
  notes: string;
  version: number;
  created_at?: string;
  updated_at?: string;
}

export interface JournalEntryBase {
  id: string;
  content_type: string;
  content: any;
  created_at: string;
  updated_at: string;
  selected_date?: string; // YYYY-MM-DD
  related_date?: string; // For People to Pray For
  user_id: string;
}

// --- AsyncStorage Key Helper ---
export const getJournalKey = (contentType: string, date: string, userId: string) => {
  // Ensure date is in YYYY-MM-DD format
  let formattedDate = date;
  try {
    // If date is a full ISO string, extract just the date part
    if (date.includes('T')) {
      formattedDate = date.split('T')[0];
    }
    // If it's a date object, format it
    else if (date.match(/^\d{4}-\d{2}-\d{2}$/) === null) {
      formattedDate = new Date(date).toISOString().split('T')[0];
    }
  } catch (e) {
    console.error('Error formatting date:', e);
  }
  
  const key = `journal_${contentType}_${formattedDate}_${userId}`;
  console.log('Generated key:', { contentType, date, formattedDate, userId, key });
  return key;
};

// --- AsyncStorage Operations ---

// Save all time blocks for a date to AsyncStorage (as a list)
export const saveLocalTimeBlocksForDate = async (
  userId: string,
  date: string,
  blocks: TimeBlockEntry[]
): Promise<TimeBlockEntry[]> => {
  const key = `time_blocks_${userId}_${date}`;
  // Optionally do version checking here per block (can be enhanced)
  await storage.setItem(key, JSON.stringify(blocks));
  return blocks;
};

// Retrieve all time blocks for a date from AsyncStorage
export const getLocalTimeBlocksForDate = async (
  userId: string,
  date: string
): Promise<TimeBlockEntry[]> => {
  const key = `time_blocks_${userId}_${date}`;
  const raw = await storage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TimeBlockEntry[];
  } catch {
    return [];
  }
};

// Save a time block entry to AsyncStorage with version checking
export const saveLocalTimeBlock = async (
  key: string,
  entry: TimeBlockEntry,
  userId: string
): Promise<TimeBlockEntry> => {
  const existing = await getLocalTimeBlock(key);
  if (existing && existing.version >= entry.version) {
    // Do not overwrite with older or same version
    return existing;
  }
  const now = new Date().toISOString();
  const entryToSave = {
    ...entry,
    user_id: userId,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  await storage.setItem(key, JSON.stringify(entryToSave));
  return entryToSave;
};

// Retrieve a time block entry from AsyncStorage
export const getLocalTimeBlock = async (key: string): Promise<TimeBlockEntry | null> => {
  const raw = await storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TimeBlockEntry;
  } catch {
    return null;
  }
};

export const saveLocalEntry = async (key: string, data: Omit<JournalEntryBase, 'id'|'created_at'|'updated_at'>, userId: string): Promise<JournalEntryBase> => {
  console.log('!!! saveLocalEntry called !!!', { key, userId, data });
  console.log(`saveLocalEntry - key: ${key}`);

  if (!userId) {
    throw new Error('User ID is required to save entry');
  }

  const now = new Date().toISOString();
  // Extract date from key if not provided in data
  const keyParts = key.split('_');
  const dateFromKey = keyParts.length >= 3 ? keyParts[keyParts.length - 2] : null;
  
  const newEntry: JournalEntryBase = {
    ...data,
    id: generateUUID(), // Always generate a new ID for new entries
    user_id: userId,
    created_at: now,
    updated_at: now,
    selected_date: data.selected_date || dateFromKey || new Date().toISOString().split('T')[0],
    content_type: data.content_type || 'unknown',
    content: data.content || {},
  };

  console.log('[JOURNAL STORAGE] Saving local entry:', {
    key,
    id: newEntry.id,
    type: newEntry.content_type,
    date: newEntry.selected_date,
    userId: newEntry.user_id,
    hasContent: !!newEntry.content,
    newEntry
  });

  try {
    await AsyncStorage.setItem(key, JSON.stringify(newEntry));
    const verify = await AsyncStorage.getItem(key);
    console.log('[JOURNAL STORAGE] After save, value in storage:', verify);
    console.log('Successfully saved local entry');
    return newEntry;
  } catch (error) {
    console.error('Error saving to AsyncStorage:', error);
    throw error;
  }
};

export const updateLocalEntry = async (key: string, updatedData: Partial<JournalEntryBase>): Promise<JournalEntryBase> => {
  console.log('!!! updateLocalEntry called !!!', { key, updatedData });
  console.log(`updateLocalEntry - key: ${key}`);

  const existingEntry = await getLocalEntry(key);
  if (!existingEntry) {
    console.error('Cannot update: Entry not found for key:', key);
    throw new Error('Entry not found');
  }

  const now = new Date().toISOString();
  const updatedEntry: JournalEntryBase = {
    ...existingEntry,
    ...updatedData,
    updated_at: now,
    // Ensure required fields are always set
    id: existingEntry.id,
    user_id: existingEntry.user_id,
    created_at: existingEntry.created_at || now,
    content_type: updatedData.content_type || existingEntry.content_type || 'unknown',
    selected_date: updatedData.selected_date || existingEntry.selected_date || new Date().toISOString().split('T')[0],
    content: updatedData.content !== undefined ? updatedData.content : existingEntry.content || {},
  };

  console.log('Updating local entry:', {
    id: updatedEntry.id,
    type: updatedEntry.content_type,
    date: updatedEntry.selected_date,
    userId: updatedEntry.user_id,
    updatedAt: updatedEntry.updated_at,
  });

  try {
    await AsyncStorage.setItem(key, JSON.stringify(updatedEntry));
    console.log('Successfully updated local entry');
    return updatedEntry;
  } catch (error) {
    console.error('Error updating AsyncStorage:', error);
    throw error;
  }
};

export const getLocalEntry = async (key: string): Promise<JournalEntryBase | null> => {
  console.log('[JOURNAL STORAGE] getLocalEntry called', { key });
  const value = await AsyncStorage.getItem(key);
  console.log('[JOURNAL STORAGE] getLocalEntry result', { key, value });
  return value ? JSON.parse(value) : null;
};

export const getLocalEntriesForDate = async (date: string, contentType: string, userId: string) => {
  console.log('!!! getLocalEntriesForDate called !!!', { date, contentType, userId });
  
  // Generate the key using the same format as getJournalKey
  const formatDateForKey = (dateStr: string) => {
    try {
      if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
      }
      if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(dateStr).toISOString().split('T')[0];
      }
      return dateStr;
    } catch (e) {
      console.error('Error formatting date for key:', e);
      return dateStr;
    }
  };
  
  const formattedDate = formatDateForKey(date);
  const key = getJournalKey(contentType, formattedDate, userId);
  
  console.log('Looking up entry with key:', key);
  const entry = await getLocalEntry(key);

  if (!entry) {
    console.log('No entry found for key:', key);
    return null;
  }

  // Ensure the entry has all required fields and matches the requested date
  const completeEntry: JournalEntryBase = {
    id: entry.id || generateUUID(),
    content_type: entry.content_type || contentType,
    content: entry.content || {},
    created_at: entry.created_at || new Date().toISOString(),
    updated_at: entry.updated_at || new Date().toISOString(),
    selected_date: entry.selected_date || formattedDate,
    user_id: entry.user_id || userId,
    ...(entry.related_date && { related_date: entry.related_date }),
  };

  // Format both dates consistently for comparison (YYYY-MM-DD)
  const formatDateForComparison = (dateStr: string) => {
    try {
      return new Date(dateStr).toISOString().split('T')[0];
    } catch (e) {
      console.error('Error formatting date for comparison:', e);
      return dateStr; // Fallback to original if parsing fails
    }
  };

  const formattedEntryDate = formatDateForComparison(completeEntry.selected_date || '');
  const formattedRequestDate = formatDateForComparison(formattedDate);

  // Verify the entry's selected_date matches the requested date
  if (formattedEntryDate !== formattedRequestDate) {
    console.log(`Entry date (${formattedEntryDate}) does not match requested date (${formattedRequestDate}), returning null`);
    return null;
  }

  console.log('getLocalEntriesForDate - returning entry:', {
    id: completeEntry.id,
    type: completeEntry.content_type,
    hasUserId: !!completeEntry.user_id,
    updatedAt: completeEntry.updated_at,
    selectedDate: completeEntry.selected_date,
    content: completeEntry.content ? 'has content' : 'no content'
  });

  return completeEntry;
};

export const deleteLocalEntry = async (key: string) => {
  console.log('!!! deleteLocalEntry called !!!', { key });
  await AsyncStorage.removeItem(key);
};

// --- Supabase Operations ---
// Supabase session handling

// Save all time blocks for a date to Supabase (as a list, with version checking)
export const saveCloudTimeBlocksForDate = async (
  userId: string,
  date: string,
  blocks: TimeBlockEntry[]
): Promise<TimeBlockEntry[]> => {
  // Fetch existing blocks for that date
  const { data: existingBlocks, error: fetchError } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('selected_date', date);
  if (fetchError) throw fetchError;
  // Upsert each block (respect version)
  const results: TimeBlockEntry[] = [];
  for (const block of blocks) {
    const existing = existingBlocks?.find((b: TimeBlockEntry) => b.start_time === block.start_time);
    if (existing && existing.version >= block.version) {
      results.push(existing);
      continue;
    }
    const now = new Date().toISOString();
    const entryToSave = {
      ...block,
      user_id: userId,
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from('time_blocks')
        .update(entryToSave)
        .eq('id', existing.id)
        .select()
        .single();
      if (updateError) throw updateError;
      results.push(updated);
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('time_blocks')
        .insert(entryToSave)
        .select()
        .single();
      if (insertError) throw insertError;
      results.push(inserted);
    }
  }
  return results;
};

// Retrieve all time blocks for a date from Supabase
export const getCloudTimeBlocksForDate = async (
  userId: string,
  date: string
): Promise<TimeBlockEntry[]> => {
  const { data, error } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('selected_date', date);
  if (error) throw error;
  return data || [];
};

// Save a time block entry to Supabase with version checking
export const saveCloudTimeBlock = async (
  userId: string,
  entry: TimeBlockEntry
): Promise<TimeBlockEntry> => {
  // Check for existing entry for this user/date/start_time
  const { data: existing, error: fetchError } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('selected_date', entry.selected_date)
    .eq('start_time', entry.start_time)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (existing && existing.version >= entry.version) {
    // Do not overwrite with older or same version
    return existing;
  }
  const now = new Date().toISOString();
  const entryToSave = {
    ...entry,
    user_id: userId,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  if (existing) {
    // Update existing
    const { data: updated, error: updateError } = await supabase
      .from('time_blocks')
      .update(entryToSave)
      .eq('id', existing.id)
      .select()
      .single();
    if (updateError) throw updateError;
    return updated;
  } else {
    // Insert new
    const { data: inserted, error: insertError } = await supabase
      .from('time_blocks')
      .insert(entryToSave)
      .select()
      .single();
    if (insertError) throw insertError;
    return inserted;
  }
};

// Retrieve a time block entry from Supabase
export const getCloudTimeBlock = async (
  userId: string,
  selected_date: string,
  start_time: string
): Promise<TimeBlockEntry | null> => {
  const { data, error } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('selected_date', selected_date)
    .eq('start_time', start_time)
    .maybeSingle();
  if (error) throw error;
  return data || null;
};


interface SupabaseSession {
  user: {
    id: string;
    email?: string;
  };
  expires_at?: number;
  access_token?: string;
  refresh_token?: string;
}

// Helper function to get and validate session
export const getValidSession = async (): Promise<SupabaseSession | null> => {
  console.log('\n=== Checking for valid session ===');
  try {
    // 1. First check if we have tokens in AsyncStorage
    const [accessToken, refreshToken, userStr] = await Promise.all([
      AsyncStorage.getItem('ACCESS_TOKEN'),
      AsyncStorage.getItem('REFRESH_TOKEN'),
      AsyncStorage.getItem('USER'),
    ]);

    console.log('Auth state from storage:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      hasUser: !!userStr,
    });

    if (!accessToken || !refreshToken) {
      console.log('No auth tokens found in storage');
      return null;
    }

    // 2. Set the session using the tokens we have
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      console.error('Error setting session:', sessionError);
      return null;
    }

    // 3. Now get the current session
    const { data: { session: currentSession }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Error getting session:', error);
      return null;
    }

    if (!currentSession?.user?.id) {
      console.log('No valid session found after setting tokens');
      return null;
    }

    console.log('✅ Valid session found');
    console.log('User ID:', currentSession.user.id);
    if (currentSession.user.email) {console.log('Email:', currentSession.user.email);}

    // 4. Check if session needs refresh
    const expiresAt = currentSession.expires_at || 0;
    const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
    console.log('Session expires in:', expiresIn, 'seconds');

    if (expiresIn > 300) { // More than 5 minutes left
      return currentSession;
    }

    // 5. Try to refresh the session if it's about to expire
    console.log('⚠️ Session expiring soon, refreshing...');
    try {
      const { data: { session: refreshedSession }, error: refreshError } =
        await supabase.auth.refreshSession();

      if (refreshError) {
        console.error('Refresh error:', refreshError);
        throw refreshError;
      }

      if (refreshedSession) {
        console.log('✅ Session refreshed successfully');
        // Update storage with new tokens
        await Promise.all([
          AsyncStorage.setItem('ACCESS_TOKEN', refreshedSession.access_token),
          AsyncStorage.setItem('REFRESH_TOKEN', refreshedSession.refresh_token || ''),
        ]);
        return refreshedSession;
      }
    } catch (refreshError) {
      console.error('Failed to refresh session:', refreshError);
      // Clear invalid session
      await Promise.all([
        AsyncStorage.removeItem('ACCESS_TOKEN'),
        AsyncStorage.removeItem('REFRESH_TOKEN'),
        AsyncStorage.removeItem('USER'),
      ]);
      return null;
    }

    // 2. No valid session, try to restore from storage
    console.log('No active session, attempting to restore from storage...');

    // List all storage keys for debugging
    const allKeys = await AsyncStorage.getAllKeys();
    console.log('All storage keys:', allKeys);

    // Look for the Supabase auth token in storage
    const storageKey = allKeys.find(key => key.includes('sb-') && key.includes('auth-token'));

    if (storageKey) {
      console.log('Found auth storage key:', storageKey);
      const storedSession = await AsyncStorage.getItem(storageKey);

      if (storedSession) {
        try {
          console.log('Attempting to restore session from storage...');
          const parsedSession = JSON.parse(storedSession);

          if (!parsedSession.access_token) {
            throw new Error('No access token in stored session');
          }

          const { data: { session: restoredSession }, error: restoreError } =
            await supabase.auth.setSession({
              access_token: parsedSession.access_token,
              refresh_token: parsedSession.refresh_token || '',
            });

          if (restoreError) {
            console.error('Error setting session:', restoreError);
            throw restoreError;
          }

          if (restoredSession?.user?.id) {
            console.log('✅ Session restored successfully');
            return restoredSession;
          } else {
            console.log('No user in restored session');
          }
        } catch (e) {
          console.error('Error restoring session:', e);
          // Clear invalid session
          await AsyncStorage.removeItem(storageKey);
        }
      }
    } else {
      console.log('No auth storage key found');
    }

    console.log('No valid session found');
    return null;

  } catch (error) {
    console.error('Error in getValidSession:', error);
    return null;
  }
};

// Helper function to validate UUID format
// This accepts any valid UUID format (v1-v5)
const isValidUUID = (uuid: string): boolean => {
  if (typeof uuid !== 'string') {return false;}
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const saveCloudEntry = async (userId: string, entry: JournalEntryBase): Promise<any> => {
  console.log('\n=== saveCloudEntry START ===');

  try {
    // 1. Get and validate session
    const session = await getValidSession();
    if (!session?.user?.id) {
      console.error('No valid session available. User must be logged in.');
      throw new Error('You must be logged in to save entries');
    }

    // 2. Use the session user ID
    if (session.user.id !== userId) {
      console.warn('User ID mismatch, using session user ID');
      userId = session.user.id;
    }

    // 3. Validate entry ID if present
    if (entry.id && !isValidUUID(entry.id)) {
      console.warn('Invalid entry ID format, generating new UUID');
      entry.id = generateUUID();
    }

    // 4. Prepare the entry with proper types and timestamps
    const now = new Date().toISOString();
    if (!entry.selected_date || typeof entry.selected_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.selected_date)) {
      console.error('Missing or invalid selected_date when saving entry:', entry.selected_date);
      throw new Error('selected_date is required and must be in YYYY-MM-DD format');
    }
    const selectedDate = entry.selected_date;
    const entryToSave = {
      ...entry,
      id: entry.id || generateUUID(),
      user_id: userId,
      content_type: entry.content_type || 'unknown',
      content: entry.content || {},
      selected_date: selectedDate,
      created_at: entry.created_at || now,
      updated_at: now,
    };

    console.log('Saving entry:', {
      id: entryToSave.id,
      user_id: entryToSave.user_id,
      content_type: entryToSave.content_type,
      selected_date: entryToSave.selected_date,
    });

    try {
      // 5. First try to update if an entry exists for this user, content type and date
      const { data: existingEntries, error: fetchError } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', entryToSave.user_id)
        .eq('content_type', entryToSave.content_type)
        .eq('selected_date', entryToSave.selected_date)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingEntries) {
        console.log('Found existing entry, updating instead of creating new one');
        const { data: updatedEntry, error: updateError } = await supabase
          .from('journal_entries')
          .update({
            content: entryToSave.content,
            updated_at: entryToSave.updated_at
          })
          .eq('id', existingEntries.id)
          .select()
          .single();

        if (updateError) throw updateError;
        console.log('✅ Existing entry updated successfully');
        return updatedEntry;
      }

      // 6. If no existing entry, create a new one
      const { data: newEntry, error: insertError } = await supabase
        .from('journal_entries')
        .insert(entryToSave)
        .select()
        .single();

      if (insertError) throw insertError;
      console.log('✅ New entry created successfully');
      return newEntry;

    } catch (error: any) {
      console.error('Error in saveCloudEntry:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    // Entry is now handled in the try-catch block above

  } catch (error: any) {
    console.error('\n!!! ERROR in saveCloudEntry !!!');

    // Format error message for logging
    const errorMessage = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          ...(error as any).code && { code: (error as any).code },
          ...(error as any).details && { details: (error as any).details },
          stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        }
      : { message: String(error) };

    console.error('Error details:', errorMessage);

    // Handle specific error cases
    if (error.message?.toLowerCase().includes('function upsert_journal_entry') ||
        error.message?.toLowerCase().includes('does not exist')) {
      const errorMsg = 'Database function not found. Please run the SQL migration to create the required function.';
      console.error('\n⚠️ ' + errorMsg);
      throw new Error(errorMsg);
    }

    // If it's an auth error, suggest logging in again
    if (error.message?.toLowerCase().includes('session') ||
        error.message?.toLowerCase().includes('auth') ||
        error.message?.toLowerCase().includes('jwt') ||
        error.message?.toLowerCase().includes('unauthorized')) {
      console.error('\n⚠️ Authentication issue detected. Please ensure you are logged in.');
      throw new Error('Your session has expired. Please log in again.');
    }

    throw error;
  } finally {
    console.log('=== saveCloudEntry COMPLETE ===\n');
  }
};

// ... (rest of the code remains the same)
export const updateCloudEntry = async (userId: string, entryId: string, updatedData: Partial<JournalEntryBase>): Promise<JournalEntryBase> => {
  console.log('\n=== updateCloudEntry START ===');
  console.log('Current time:', new Date().toISOString());

  try {
    // 1. Validate input parameters
    if (!userId || !entryId) {
      throw new Error('User ID and Entry ID are required');
    }

    // 2. Clean and validate entryId
    const cleanEntryId = entryId.trim();
    if (!cleanEntryId) {
      throw new Error('Entry ID cannot be empty');
    }
    // 3. Clean and validate userId
    const cleanUserId = userId.trim();
    if (!cleanUserId) {
      throw new Error('User ID cannot be empty');
    }

    // 4. Get and validate session
    const session = await getValidSession();
    if (!session?.user?.id) {
      console.error('No valid session available. User must be logged in.');
      throw new Error('You must be logged in to update entries');
    }
    // 5. Ensure we're using the session user ID
    if (session.user.id !== cleanUserId) {
      console.warn('User ID mismatch, using session user ID');
      userId = session.user.id;
    } else {
      userId = cleanUserId;
    }

    // 6. Prepare the update data
    const now = new Date().toISOString();
    if (!updatedData.selected_date || typeof updatedData.selected_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(updatedData.selected_date)) {
      console.error('Missing or invalid selected_date when updating entry:', updatedData.selected_date);
      throw new Error('selected_date is required and must be in YYYY-MM-DD format');
    }
    const updateData = {
      ...updatedData,
      updated_at: now,
    };

    console.log('Updating entry:', {
      entryId: cleanEntryId,
      userId,
      updateFields: Object.keys(updateData),
    });

    // 6. Make the API call with retry logic
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`\n--- Attempt ${attempt} of ${maxRetries} ---`);

        // Get fresh session for each attempt
        const { data: { session: currentSession }, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError || !currentSession) {
          throw new Error('Failed to validate session: ' + (sessionError?.message || 'No session'));
        }

        console.log('Current session user ID:', currentSession.user?.id);

        // First, fetch the existing entry for version check
        const { data: existing, error: fetchError } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('id', cleanEntryId)
          .eq('user_id', userId)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') { // Not found
            throw new Error('Entry not found or access denied');
          }
          throw fetchError;
        }

        // Check if the existing data is newer than our update
        const incomingUpdatedAt = updateData.updated_at || now;
        if (existing.updated_at > incomingUpdatedAt) {
          console.warn('Existing data is newer than the update');
          return existing;
        }

        // Perform the update
        const { data, error } = await supabase
          .from('journal_entries')
          .update(updateData)
          .eq('id', cleanEntryId)
          .eq('user_id', userId)
          .eq('selected_date', updateData.selected_date)
          .select()
          .single();

        if (error) {throw error;}

        console.log('\n✅ Entry updated successfully ===');
        return data;

      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error.message);

        // If this is an auth error, try to refresh the session
        if (error.message?.toLowerCase().includes('jwt') ||
            error.message?.toLowerCase().includes('auth') ||
            error.code === 'PGRST301') {
          console.log('Auth error detected, attempting to refresh session...');
          try {
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {throw refreshError;}
            console.log('Session refreshed, retrying...');
            continue;
          } catch (refreshError) {
            console.error('Failed to refresh session:', refreshError);
            await supabase.auth.signOut();
            throw new Error('Session expired. Please log in again.');
          }
        }

        // Add a small delay before retry
        if (attempt < maxRetries) {
          const delayMs = 1000 * attempt;
          console.log(`Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Failed to update entry after multiple attempts');

  } catch (error: any) {
    console.error('\n!!! ERROR in updateCloudEntry !!!');
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    // If it's an auth error, suggest logging in again
    if (error.message?.toLowerCase().includes('session') ||
        error.message?.toLowerCase().includes('auth') ||
        error.message?.toLowerCase().includes('jwt') ||
        error.message?.toLowerCase().includes('unauthorized')) {
      console.error('\n⚠️ Authentication issue detected. Please ensure you are logged in.');
      throw new Error('Your session has expired. Please log in again.');
    }

    throw error;
  } finally {
    console.log('=== updateCloudEntry End ===');
  }
};

export const getCloudEntry = async (userId: string, entryId: string, date: string): Promise<JournalEntryBase | null> => {
  console.log('\n=== getCloudEntry START ===');
  console.log('User ID:', userId);
  console.log('Entry ID:', entryId);

  try {
    // 1. Validate input parameters
    if (!entryId || !userId) {
      throw new Error('Both entryId and userId are required');
    }

    // 2. Clean and validate entryId
    const cleanEntryId = entryId.trim();
    if (!cleanEntryId) {
      throw new Error('Entry ID cannot be empty');
    }

    // 3. Clean and validate userId
    const cleanUserId = userId.trim();
    if (!cleanUserId) {
      throw new Error('User ID cannot be empty');
    }

    // 4. Get and validate session
    const session = await getValidSession();
    if (!session?.user?.id) {
      console.error('No valid session available. User must be logged in.');
      throw new Error('You must be logged in to access cloud entries');
    }

    // 5. Ensure we're using the session user ID
    if (session.user.id !== cleanUserId) {
      console.warn('User ID mismatch, using session user ID');
      userId = session.user.id;
    } else {
      userId = cleanUserId;
    }

    console.log('Fetching cloud entry...');
    console.log('Fetching entry with:', { cleanEntryId, userId, date });

    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('A valid date in YYYY-MM-DD format is required');
    }

    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', cleanEntryId)
      .eq('user_id', userId)
      .eq('selected_date', date)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - entry doesn't exist
        console.log(`No cloud entry found for id: ${entryId}`);
        return null;
      }

      // Log detailed error info
      console.error('Error fetching cloud entry:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      // If it's an auth error, try to refresh the session
      if (error.message?.toLowerCase().includes('jwt') ||
          error.message?.toLowerCase().includes('auth') ||
          error.code === 'PGRST301') {
        console.log('Auth error detected, attempting to refresh session...');
        try {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {throw refreshError;}

          // Retry the operation with the new session
          console.log('Session refreshed, retrying...');
          return getCloudEntry(userId, entryId, date);
        } catch (refreshError) {
          console.error('Failed to refresh session:', refreshError);
          await supabase.auth.signOut();
          throw new Error('Session expired. Please log in again.');
        }
      }

      throw error;
    }

    console.log('Successfully retrieved cloud entry:', {
      id: data.id,
      userId: data.user_id,
      updatedAt: data.updated_at,
      type: data.content_type,
    });

    return data as JournalEntryBase;
  } catch (error: any) {
    console.error('!!! ERROR in getCloudEntry !!!');

    // Format error message for logging
    const errorMessage = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        }
      : { message: String(error) };

    console.error('Error details:', errorMessage);

    // Re-throw the error to be handled by the caller
    throw error;
  } finally {
    console.log('=== getCloudEntry END ===');
  }
};

export const deleteCloudEntry = async (userId: string, entryId: string) => {
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);
  if (error) {throw error;}
};

// --- Sync Logic ---
export const syncToCloud = async (userId: string, date: string, contentType: string) => {
  console.log('!!! syncToCloud called !!!', { userId, date, contentType });
  console.log(`=== syncToCloud: ${contentType} for ${date} ===`);

  // Get the local entry
  const localEntry = await getLocalEntriesForDate(date, contentType, userId);
  if (!localEntry) {
    console.log('No local entry found, nothing to sync');
    return;
  }

  console.log('Local entry found:', {
    id: localEntry.id,
    updatedAt: localEntry.updated_at,
    hasUserId: !!localEntry.user_id,
    userId: localEntry.user_id,
    currentUserId: userId,
  });

  try {
    // First, check if an entry exists for this user, content type, and date
    console.log('Checking for existing cloud entry with same user, type and date...');
    const { data: existingEntries, error: fetchError } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('content_type', contentType)
      .eq('selected_date', date)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking for existing entries:', fetchError);
      throw fetchError;
    }

    if (existingEntries) {
      console.log('Found existing entry for this date and type, updating...', {
        existingId: existingEntries.id,
        localId: localEntry.id,
        updatedAt: existingEntries.updated_at,
        localUpdatedAt: localEntry.updated_at
      });
      
      // Always use the existing ID to update, even if local has a different ID
      // This handles the case where we might have duplicate entries with different IDs
      await updateCloudEntry(userId, existingEntries.id, {
        ...localEntry,
        id: existingEntries.id, // Ensure we use the existing ID
        updated_at: new Date().toISOString()
      });
      
      console.log('Successfully updated existing entry');
    } else {
      // No existing entry found, create a new one
      console.log('No existing entry found, creating new...');
      await saveCloudEntry(userId, localEntry);
    }

    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Error during syncToCloud:', error);
    throw error;
  }
};

export const syncFromCloud = async (userId: string, date: string, contentType: string) => {
  console.log(`\n=== syncFromCloud START (${contentType}) ===`);
  console.log('User ID:', userId);
  console.log('Date:', date);

  try {
    // 1. Validate input parameters
    if (!userId) {
      throw new Error('User ID is required');
    }

    // 2. Get and validate session first
    console.log('Validating session...');
    const session = await getValidSession();

    if (!session?.user?.id) {
      console.error('❌ No valid session available. User must be logged in.');

      // Check if we have any auth data in storage
      const [accessToken, refreshToken, user] = await Promise.all([
        AsyncStorage.getItem('ACCESS_TOKEN'),
        AsyncStorage.getItem('REFRESH_TOKEN'),
        AsyncStorage.getItem('USER'),
      ]);

      console.log('Auth state in storage:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        hasUser: !!user,
      });

      throw new Error('You must be logged in to sync from cloud');
    }

    console.log('✅ Valid session found for user:', session.user.id);

    // 3. Use the session's user ID to ensure consistency
    const sessionUserId = session.user.id;
    if (sessionUserId !== userId) {
      console.warn(`User ID mismatch: ${userId} (provided) vs ${sessionUserId} (session). Using session user ID.`);
      userId = sessionUserId;
    }

    // 4. Verify the user ID is a valid UUID
    if (!isValidUUID(userId)) {
      throw new Error(`Invalid user ID format: ${userId}. Must be a valid UUID.`);
    }

    // 4. Ensure we're using the session user ID
    if (session.user.id !== userId) {
      console.warn('User ID mismatch, using session user ID');
      userId = session.user.id;
    }

    const key = getJournalKey(contentType, date, userId);
    console.log('Storage key:', key);

    // Get the local entry first
    const localEntry = await getLocalEntry(key);
    console.log('Local entry:', localEntry ? 'exists' : 'not found');

    try {
      // If we have a local entry, try to get the specific cloud entry
      // Otherwise, try to find any cloud entry for this date and content type
      let cloudEntry;

      if (localEntry?.id) {
        console.log('Fetching specific cloud entry by ID:', localEntry.id);
        try {
          cloudEntry = await getCloudEntry(userId, localEntry.id, date);
        } catch (error) {
          console.warn('Error fetching cloud entry by ID, will try by date/type:', error);
        }
      }

      // If we don't have a cloud entry by ID, try to find one by date and content type
      if (!cloudEntry) {
        console.log('No cloud entry found by ID, searching by date and content type...');
        const { data: entries, error } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', userId)
          .eq('content_type', contentType)
          .eq('selected_date', date) // Ensure we only get entries for the exact date
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error querying cloud entries:', error);
          throw error;
        }

        // Only use the cloud entry if it matches the exact date
        cloudEntry = entries?.find(entry => entry.selected_date === date);
        console.log('Found cloud entries by date/type:', cloudEntry ? 1 : 0);
      }

      // If we have a local entry but no cloud entry, delete the local entry
      if (localEntry && !cloudEntry) {
        console.log('Local entry exists but no matching cloud entry, deleting local entry');
        await AsyncStorage.removeItem(key);
        return null;
      }

      // If we have a cloud entry, verify it matches the requested date
      if (cloudEntry) {
        // Ensure the cloud entry has the correct selected_date
        if (cloudEntry.selected_date !== date) {
          console.log('Cloud entry date does not match requested date, deleting local entry:', {
            entryDate: cloudEntry.selected_date,
            requestedDate: date,
          });
          await AsyncStorage.removeItem(key);
          return null;
        }

        console.log('Cloud entry found, comparing with local...', {
          cloudUpdated: cloudEntry.updated_at,
          localUpdated: localEntry?.updated_at,
          isNewer: !localEntry || new Date(cloudEntry.updated_at) > new Date(localEntry.updated_at || 0),
        });

        if (!localEntry || new Date(cloudEntry.updated_at) > new Date(localEntry.updated_at || 0)) {
          console.log('Cloud entry is newer or no local entry, saving to local storage...');
          // Ensure the entry has all required fields and the correct date
          const completeEntry: JournalEntryBase = {
            id: cloudEntry.id || generateUUID(),
            content_type: cloudEntry.content_type || contentType,
            content: cloudEntry.content || {},
            created_at: cloudEntry.created_at || new Date().toISOString(),
            updated_at: cloudEntry.updated_at || new Date().toISOString(),
            selected_date: date, // Always use the explicitly requested date
            user_id: cloudEntry.user_id || userId,
          };

          await AsyncStorage.setItem(key, JSON.stringify(completeEntry));
          console.log('Successfully synced cloud entry to local storage');
          return completeEntry;
        } else {
          console.log('Local entry is up to date or newer than cloud');
        }
      } else {
        console.log('No cloud entry found to sync');
      }

      return localEntry;
    } catch (error) {
      console.error('Error in syncFromCloud:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in syncFromCloud:', error);
    throw error;
  } finally {
    console.log('=== syncFromCloud END ===');
  }
};

// --- (Optional) Index Management for Efficient Listing ---
// You can implement journal_index_{date}_{userId} logic here if needed for bulk listing.

// --- Usage Example (see your plan for details) ---
// import { saveLocalEntry, updateLocalEntry, syncToCloud } from './journalStorage';
// import { saveCloudEntry, updateCloudEntry } from './journalStorage';
//
// const userId = 'user123';
// const date = '2025-07-10';
// const key = getJournalKey('todos', date, userId);
// const todoData = {
//   content_type: 'todos',
//   content: { items: [{ text: 'Buy groceries', checked: false, priority: true }] },
//   selected_date: date,
// };
//
// const newEntry = await saveLocalEntry(key, todoData, userId);
// await saveCloudEntry(userId, newEntry);
//
// const updatedTodo = {
//   content_type: 'todos',
//   content: { items: [{ text: 'Buy groceries', checked: true, priority: true }] },
//   selected_date: date,
// };
// const result = await updateLocalEntry(key, updatedTodo);
// if (result.updated_at === updatedTodo.updated_at) {
//   await updateCloudEntry(userId, newEntry.id, result);
// }

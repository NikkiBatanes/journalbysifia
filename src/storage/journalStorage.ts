
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8; // (r & 0x3) | 0x8 equivalent
    return v.toString(16);
  });
};

import { supabase } from '../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toLocalDateString } from '../utils/date';
import { Logger } from '../utils/ProductionLogger';
import { streakTrackingService } from '../services/streakTrackingService';

// --- Debug Utilities ---
export async function debugPrintSupabaseStorage() {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const supabaseKeys = allKeys.filter(k => k.includes('supabase') || k.includes('sb-') || k.includes('auth') || k.includes('token'));
    const keyValues: Record<string, string | null> = {};
    for (const key of supabaseKeys) {
      keyValues[key] = await AsyncStorage.getItem(key);
    }

  } catch (e) {
    Logger.error('Error printing Supabase AsyncStorage', e as Error, {
      component: 'journalStorage',
      action: 'debug_print_supabase_storage',
    });
  }
}

export async function debugPrintJournalEntries() {
  try {

    const { error } = await supabase
      .from('journal_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      Logger.error('Error fetching journal entries', error as Error, {
        component: 'journalStorage',
        action: 'debug_print_journal_entries',
      });
      return;
    }

    // Check specifically for today_win and looking_forward entries
    // Entry types tracked for debugging if needed

  } catch (error) {
    Logger.error('Error in debugPrintJournalEntries', error as Error, {
      component: 'journalStorage',
      action: 'debug_print_journal_entries_catch',
    });
  }
}

export async function debugPrintSession() {
  await supabase.auth.getSession();

}

// Debug: Log when storage module loads

// Removed unused debug cache

// Debug: Log all AsyncStorage operations
const debugStorage = {
  setItem: async (key: string, value: string): Promise<void> => {

    return AsyncStorage.setItem(key, value);
  },
  getItem: async (key: string): Promise<string | null> => {
    const value = await AsyncStorage.getItem(key);

    return value;
  },
  removeItem: async (key: string): Promise<void> => {

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

  } catch (e) {
    Logger.error('Failed to initialize AsyncStorage', e as Error, {
      component: 'journalStorage',
      action: 'init_storage',
    });
  }
};

initStorage();

// Add debug logging for Supabase auth state
supabase.auth.onAuthStateChange(() => {

});

// Add a function to check the current session
export const checkSession = async (): Promise<{ session: any; error: any }> => {
  const { data: { session }, error } = await supabase.auth.getSession();

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
export const getJournalKey = (userId: string, contentType: string, date: string | Date) => {
  // Ensure date is in YYYY-MM-DD format
  let formattedDate: string;

  try {
    // Handle different date input types
    if (!date) {
      // If no date provided, use current date
      formattedDate = new Date().toISOString().split('T')[0];
    } else if (typeof date === 'string') {
      // If date is a full ISO string, extract just the date part
      if (date.includes('T')) {
        formattedDate = date.split('T')[0];
      }
      // If it's already in YYYY-MM-DD format, use as is
      else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        formattedDate = date;
      }
      // Otherwise try to parse and format
      else {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
          Logger.error('Invalid date provided', undefined, {
            component: 'journalStorage',
            action: 'get_journal_key',
            dateInput: String(date),
          });
          formattedDate = new Date().toISOString().split('T')[0];
        } else {
          formattedDate = parsedDate.toISOString().split('T')[0];
        }
      }
    } else if (date instanceof Date) {
      // If it's a Date object
      if (isNaN(date.getTime())) {
        Logger.error('Invalid Date object provided', undefined, {
          component: 'journalStorage',
          action: 'get_journal_key',
          dateType: 'Date',
        });
        formattedDate = new Date().toISOString().split('T')[0];
      } else {
        formattedDate = date.toISOString().split('T')[0];
      }
    } else {
      Logger.error('Unsupported date type', undefined, {
        component: 'journalStorage',
        action: 'get_journal_key',
        dateType: typeof date,
        dateValue: String(date),
      });
      formattedDate = new Date().toISOString().split('T')[0];
    }
  } catch (e) {
    Logger.error('Error formatting date', e as Error, {
      component: 'journalStorage',
      action: 'get_journal_key',
      dateInput: String(date),
    });
    formattedDate = new Date().toISOString().split('T')[0];
  }

  const key = `journal_${contentType}_${formattedDate}_${userId}`;

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
  if (!raw) {return [];}
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
  if (!raw) {return null;}
  try {
    return JSON.parse(raw) as TimeBlockEntry;
  } catch {
    return null;
  }
};

export const saveLocalEntry = async (key: string, data: Omit<JournalEntryBase, 'id'|'created_at'|'updated_at'>, userId: string): Promise<JournalEntryBase> => {

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
    selected_date: typeof data.selected_date === 'string' ? data.selected_date : toLocalDateString(data.selected_date || (dateFromKey ? new Date(dateFromKey) : new Date())),
    content_type: data.content_type || 'unknown',
    content: data.content || {},
  };

  try {
    await AsyncStorage.setItem(key, JSON.stringify(newEntry));

    return newEntry;
  } catch (error) {
    Logger.error('Error saving to AsyncStorage', error as Error, {
      component: 'journalStorage',
      action: 'save_local_entry',
      key,
      userId,
    });
    throw error;
  }
};

export const updateLocalEntry = async (key: string, updatedData: Partial<JournalEntryBase>): Promise<JournalEntryBase> => {

  const existingEntry = await getLocalEntry(key);
  if (!existingEntry) {
    Logger.error('Cannot update: Entry not found', undefined, {
      component: 'journalStorage',
      action: 'update_local_entry',
      key,
    });
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

  try {
    await AsyncStorage.setItem(key, JSON.stringify(updatedEntry));

    return updatedEntry;
  } catch (error) {
    Logger.error('Error updating AsyncStorage', error as Error, {
      component: 'journalStorage',
      action: 'update_local_entry',
      key,
    });
    throw error;
  }
};

export const getLocalEntry = async (key: string): Promise<JournalEntryBase | null> => {

  const value = await AsyncStorage.getItem(key);

  return value ? JSON.parse(value) : null;
};

export const getLocalEntriesForDate = async (date: string, contentType: string, userId: string) => {

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
      Logger.error('Error formatting date for key', e as Error, {
        component: 'journalStorage',
        action: 'format_date_for_key',
        dateStr,
      });
      return dateStr;
    }
  };

  const formattedDate = formatDateForKey(date);
  const key = getJournalKey(userId, contentType, formattedDate);

  const entry = await getLocalEntry(key);

  if (!entry) {

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
      Logger.error('Error formatting date for comparison', e as Error, {
        component: 'journalStorage',
        action: 'format_date_for_comparison',
        dateStr,
      });
      return dateStr; // Fallback to original if parsing fails
    }
  };

  const formattedEntryDate = formatDateForComparison(completeEntry.selected_date || '');
  const formattedRequestDate = formatDateForComparison(formattedDate);

  // Verify the entry's selected_date matches the requested date
  if (formattedEntryDate !== formattedRequestDate) {

    return null;
  }

  return completeEntry;
};

export const deleteLocalEntry = async (key: string) => {

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
  if (fetchError) {throw fetchError;}
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
      if (updateError) {throw updateError;}
      results.push(updated);
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('time_blocks')
        .insert(entryToSave)
        .select()
        .single();
      if (insertError) {throw insertError;}
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
  if (error) {throw error;}
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
  if (fetchError) {throw fetchError;}
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
    if (updateError) {throw updateError;}
    return updated;
  } else {
    // Insert new
    const { data: inserted, error: insertError } = await supabase
      .from('time_blocks')
      .insert(entryToSave)
      .select()
      .single();
    if (insertError) {throw insertError;}
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
  if (error) {throw error;}
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

  try {
    // 1. First check if we have tokens in AsyncStorage
    const [accessToken, refreshToken] = await Promise.all([
      AsyncStorage.getItem('ACCESS_TOKEN'),
      AsyncStorage.getItem('REFRESH_TOKEN'),
    ]);

    if (!accessToken || !refreshToken) {

      return null;
    }

    // 2. Set the session using the tokens we have
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      Logger.error('Error setting session', sessionError as Error, {
        component: 'journalStorage',
        action: 'get_valid_session',
      });
      return null;
    }

    // 3. Now get the current session
    const { data: { session: currentSession }, error } = await supabase.auth.getSession();

    if (error) {
      Logger.error('Error getting session', error as Error, {
        component: 'journalStorage',
        action: 'get_valid_session',
      });
      return null;
    }

    if (!currentSession?.user?.id) {

      return null;
    }

    // 4. Check if session needs refresh
    const expiresAt = currentSession.expires_at || 0;
    const expiresIn = expiresAt - Math.floor(Date.now() / 1000);

    if (expiresIn > 300) { // More than 5 minutes left
      return currentSession;
    }

    // 5. Try to refresh the session if it's about to expire

    try {
      const { data: { session: refreshedSession }, error: refreshError } =
        await supabase.auth.refreshSession();

      if (refreshError) {
        Logger.error('Refresh error', refreshError as Error, {
          component: 'journalStorage',
          action: 'refresh_session',
        });
        throw refreshError;
      }

      if (refreshedSession) {

        // Update storage with new tokens
        await Promise.all([
          AsyncStorage.setItem('ACCESS_TOKEN', refreshedSession.access_token),
          AsyncStorage.setItem('REFRESH_TOKEN', refreshedSession.refresh_token || ''),
        ]);
        return refreshedSession;
      }
    } catch (refreshError) {
      Logger.error('Failed to refresh session', refreshError as Error, {
        component: 'journalStorage',
        action: 'refresh_session_catch',
      });
      // Clear invalid session
      await Promise.all([
        AsyncStorage.removeItem('ACCESS_TOKEN'),
        AsyncStorage.removeItem('REFRESH_TOKEN'),
        AsyncStorage.removeItem('USER'),
      ]);
      return null;
    }

    // 2. No valid session, try to restore from storage

    // List all storage keys for debugging
    const allKeys = await AsyncStorage.getAllKeys();

    // Look for the Supabase auth token in storage
    const storageKey = allKeys.find(key => key.includes('sb-') && key.includes('auth-token'));

    if (storageKey) {

      const storedSession = await AsyncStorage.getItem(storageKey);

      if (storedSession) {
        try {

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
            Logger.error('Error setting session', restoreError as Error, {
              component: 'journalStorage',
              action: 'restore_session',
            });
            throw restoreError;
          }

          if (restoredSession?.user?.id) {

            return restoredSession;
          } else {

          }
        } catch (e) {
          Logger.error('Error restoring session', e as Error, {
            component: 'journalStorage',
            action: 'restore_session_catch',
          });
          // Clear invalid session
          await AsyncStorage.removeItem(storageKey);
        }
      }
    } else {

    }

    return null;

  } catch (error) {
    Logger.error('Error in getValidSession', error as Error, {
      component: 'journalStorage',
      action: 'get_valid_session_outer',
    });
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

// Helper function to clean up duplicate entries
const cleanupDuplicateEntries = async (userId: string, contentType: string, selectedDate: string): Promise<void> => {
  try {

    const { data: duplicates, error } = await supabase
      .from('journal_entries')
      .select('id, updated_at')
      .eq('user_id', userId)
      .eq('content_type', contentType)
      .eq('selected_date', selectedDate)
      .order('updated_at', { ascending: false });

    if (error) {
      Logger.warn('Error checking for duplicates', {
        component: 'journalStorage',
        action: 'cleanup_duplicates',
        userId,
        contentType,
      });
      return;
    }

    if (duplicates && duplicates.length > 1) {

      // Keep the first (most recent) and delete the rest
      const toDelete = duplicates.slice(1).map(d => d.id);

      const { error: deleteError } = await supabase
        .from('journal_entries')
        .delete()
        .in('id', toDelete);

      if (deleteError) {
        Logger.warn('Error deleting duplicates', {
          component: 'journalStorage',
          action: 'cleanup_duplicates_delete',
          userId,
          contentType,
          deleteCount: toDelete.length,
        });
      } else {

      }
    }
  } catch (error) {
    Logger.warn('Error during duplicate cleanup', {
      component: 'journalStorage',
      action: 'cleanup_duplicates_catch',
      userId,
      contentType,
    });
  }
};

export const saveCloudEntry = async (userId: string, entry: JournalEntryBase): Promise<any> => {

  try {
    // 1. Get and validate session
    const session = await getValidSession();
    if (!session?.user?.id) {
      Logger.error('No valid session available for cloud save', undefined, {
        component: 'journalStorage',
        action: 'save_cloud_entry',
      });
      throw new Error('You must be logged in to save entries');
    }

    // 2. Use the session user ID
    if (session.user.id !== userId) {
      Logger.warn('User ID mismatch in saveCloudEntry, using session user ID', {
        component: 'journalStorage',
        action: 'save_cloud_entry',
        providedUserId: userId,
        sessionUserId: session.user.id,
      });
      userId = session.user.id;
    }

    // 3. Validate entry ID if present
    if (entry.id && !isValidUUID(entry.id)) {
      Logger.warn('Invalid entry ID format, generating new UUID', {
        component: 'journalStorage',
        action: 'save_cloud_entry',
        invalidId: entry.id,
      });
      entry.id = generateUUID();
    }

    // 4. Prepare the entry with proper types and timestamps
    const now = new Date().toISOString();
    if (!entry.selected_date || typeof entry.selected_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.selected_date)) {
      Logger.error('Missing or invalid selected_date when saving entry', undefined, {
        component: 'journalStorage',
        action: 'save_cloud_entry',
        selectedDate: entry.selected_date,
        userId,
      });
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

    try {
      // 5. Clean up any duplicate entries first
      await cleanupDuplicateEntries(userId, entryToSave.content_type, entryToSave.selected_date);

      // 6. First try to update if an entry exists for this user, content type and date
      // Handle potential duplicates by getting the most recent one
      const { data: existingEntries, error: fetchError } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', entryToSave.user_id)
        .eq('content_type', entryToSave.content_type)
        .eq('selected_date', entryToSave.selected_date)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {throw fetchError;}

      if (existingEntries) {

        const { data: updatedEntry, error: updateError } = await supabase
          .from('journal_entries')
          .update({
            content: entryToSave.content,
            updated_at: entryToSave.updated_at,
          })
          .eq('id', existingEntries.id)
          .select()
          .single();

        if (updateError) {throw updateError;}

        return updatedEntry;
      }

      // 7. If no existing entry, create a new one
      const { data: newEntry, error: insertError } = await supabase
        .from('journal_entries')
        .insert(entryToSave)
        .select()
        .single();

      if (insertError) {throw insertError;}

      // Update journal streak (non-blocking)
      streakTrackingService.updateStreak(userId, 'journal').catch((streakError) => {
        Logger.error('Failed to update journal streak', streakError as Error, {
          component: 'journalStorage',
        });
      });

      return newEntry;

    } catch (error: any) {
      Logger.error('Error in saveCloudEntry', error as Error, {
        component: 'journalStorage',
        action: 'save_cloud_entry',
        userId,
        contentType: entry.content_type,
        errorCode: error.code,
        errorDetails: error.details,
      });
      throw error;
    }

    // Entry is now handled in the try-catch block above

  } catch (error: any) {
    Logger.fatal('CRITICAL ERROR in saveCloudEntry', error as Error, {
      component: 'journalStorage',
      action: 'save_cloud_entry_outer',
      userId,
      entryId: entry.id,
      contentType: entry.content_type,
    });

    // Handle specific error cases
    if (error.message?.toLowerCase().includes('function upsert_journal_entry') ||
        error.message?.toLowerCase().includes('does not exist')) {
      const errorMsg = 'Database function not found. Please run the SQL migration to create the required function.';
      Logger.fatal('Database function missing', error as Error, {
        component: 'journalStorage',
        action: 'save_cloud_entry',
        errorType: 'missing_function',
      });
      throw new Error(errorMsg);
    }

    // If it's an auth error, suggest logging in again
    if (error.message?.toLowerCase().includes('session') ||
        error.message?.toLowerCase().includes('auth') ||
        error.message?.toLowerCase().includes('jwt') ||
        error.message?.toLowerCase().includes('unauthorized')) {
      Logger.error('Authentication issue detected', undefined, {
        component: 'journalStorage',
        action: 'auth_check',
      });
      throw new Error('Your session has expired. Please log in again.');
    }

    throw error;
  } finally {

  }
};

// ... (rest of the code remains the same)
export const updateCloudEntry = async (userId: string, entryId: string, updatedData: Partial<JournalEntryBase>): Promise<JournalEntryBase> => {

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
      Logger.error('No valid session available', undefined, {
        component: 'journalStorage',
        action: 'session_check',
      });
      throw new Error('You must be logged in to update entries');
    }
    // 5. Ensure we're using the session user ID
    if (session.user.id !== cleanUserId) {
      Logger.warn('User ID mismatch, using session user ID', {
        component: 'journalStorage',
        action: 'user_id_validation',
      });
      userId = session.user.id;
    } else {
      userId = cleanUserId;
    }

    // 6. Prepare the update data
    const now = new Date().toISOString();
    if (!updatedData.selected_date || typeof updatedData.selected_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(updatedData.selected_date)) {
      Logger.error('Missing or invalid selected_date when updating entry', undefined, {
        component: 'journalStorage',
        action: 'update_cloud_entry',
        selectedDate: updatedData.selected_date,
      });
      throw new Error('selected_date is required and must be in YYYY-MM-DD format');
    }
    const updateData = {
      ...updatedData,
      updated_at: now,
    };

    // 6. Make the API call with retry logic
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {

        // Get fresh session for each attempt
        const { data: { session: currentSession }, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError || !currentSession) {
          throw new Error('Failed to validate session: ' + (sessionError?.message || 'No session'));
        }

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
          Logger.warn('Existing data is newer than the update', {
        component: 'journalStorage',
        action: 'update_cloud_entry',
      });
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

        return data;

      } catch (error: any) {
        lastError = error;
        Logger.error(`Attempt ${attempt} failed`, error as Error, {
          component: 'journalStorage',
          action: 'update_cloud_entry_retry',
          attempt,
        });

        // If this is an auth error, try to refresh the session
        if (error.message?.toLowerCase().includes('jwt') ||
            error.message?.toLowerCase().includes('auth') ||
            error.code === 'PGRST301') {

          try {
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {throw refreshError;}

            continue;
          } catch (refreshError) {
            Logger.error('Failed to refresh session', refreshError as Error, {
            component: 'journalStorage',
            action: 'refresh_session',
          });
            throw new Error('Session expired. Please log in again.');
          }
        }

        // Add a small delay before retry
        if (attempt < maxRetries) {
          const delayMs = 1000 * attempt;

          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Failed to update entry after multiple attempts');

  } catch (error: any) {
    // Error logged below
    // Error details included in Logger call

    // If it's an auth error, suggest logging in again
    if (error.message?.toLowerCase().includes('session') ||
        error.message?.toLowerCase().includes('auth') ||
        error.message?.toLowerCase().includes('jwt') ||
        error.message?.toLowerCase().includes('unauthorized')) {
      Logger.error('Authentication issue detected', undefined, {
        component: 'journalStorage',
        action: 'auth_check',
      });
      throw new Error('Your session has expired. Please log in again.');
    }

    throw error;
  } finally {

  }
};

export const getCloudEntry = async (userId: string, entryId: string, date: string): Promise<JournalEntryBase | null> => {

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
      Logger.error('No valid session available', undefined, {
        component: 'journalStorage',
        action: 'session_check',
      });
      throw new Error('You must be logged in to access cloud entries');
    }

    // 5. Ensure we're using the session user ID
    if (session.user.id !== cleanUserId) {
      Logger.warn('User ID mismatch, using session user ID', {
        component: 'journalStorage',
        action: 'user_id_validation',
      });
      userId = session.user.id;
    } else {
      userId = cleanUserId;
    }

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

        return null;
      }

      // Log detailed error info
      Logger.error('Error fetching cloud entry', error as Error, {
        component: 'journalStorage',
        action: 'get_cloud_entry',
      });

      // If it's an auth error, try to refresh the session
      if (error.message?.toLowerCase().includes('jwt') ||
          error.message?.toLowerCase().includes('auth') ||
          error.code === 'PGRST301') {

        try {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {throw refreshError;}

          // Retry the operation with the new session

          return getCloudEntry(userId, entryId, date);
        } catch (refreshError) {
          Logger.error('Failed to refresh session', refreshError as Error, {
            component: 'journalStorage',
            action: 'refresh_session',
          });
          throw new Error('Session expired. Please log in again.');
        }
      }

      throw error;
    }

    return data as JournalEntryBase;
  } catch (error: any) {
    Logger.fatal('CRITICAL ERROR in getCloudEntry', error as Error, {
      component: 'journalStorage',
      action: 'get_cloud_entry',
    });

    // Error details included in Logger call above

    // Re-throw the error to be handled by the caller
    throw error;
  } finally {

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

  // Get the local entry
  const localEntry = await getLocalEntriesForDate(date, contentType, userId);
  if (!localEntry) {

    return;
  }

  try {
    // First, clean up any duplicates and check if an entry exists

    await cleanupDuplicateEntries(userId, contentType, date);

    const { data: existingEntries, error: fetchError } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('content_type', contentType)
      .eq('selected_date', date)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      Logger.error('Error checking for existing entries', fetchError as Error, {
        component: 'journalStorage',
        action: 'sync_to_cloud',
      });
      throw fetchError;
    }

    if (existingEntries) {

      // Always use the existing ID to update, even if local has a different ID
      // This handles the case where we might have duplicate entries with different IDs
      await updateCloudEntry(userId, existingEntries.id, {
        ...localEntry,
        id: existingEntries.id, // Ensure we use the existing ID
        updated_at: new Date().toISOString(),
      });

    } else {
      // No existing entry found, create a new one

      await saveCloudEntry(userId, localEntry);
    }

  } catch (error) {
    Logger.error('Error during syncToCloud', error as Error, {
      component: 'journalStorage',
      action: 'sync_to_cloud',
    });
    throw error;
  }
};

export const syncFromCloud = async (userId: string, date: string, contentType: string) => {

  try {
    // 1. Validate input parameters
    if (!userId) {
      throw new Error('User ID is required');
    }

    // 2. Get and validate session first

    const session = await getValidSession();

    if (!session?.user?.id) {
      Logger.error('No valid session available for sync', undefined, {
        component: 'journalStorage',
        action: 'sync_from_cloud',
      });

      // Check if we have any auth data in storage
      // User must be logged in to sync from cloud
      throw new Error('You must be logged in to sync from cloud');
    }

    // 3. Use the session's user ID to ensure consistency
    const sessionUserId = session.user.id;
    if (sessionUserId !== userId) {
      Logger.warn('User ID mismatch in syncFromCloud', {
        component: 'journalStorage',
        action: 'sync_from_cloud',
        providedUserId: userId,
        sessionUserId,
      });
      userId = sessionUserId;
    }

    // 4. Verify the user ID is a valid UUID
    if (!isValidUUID(userId)) {
      throw new Error(`Invalid user ID format: ${userId}. Must be a valid UUID.`);
    }

    // 4. Ensure we're using the session user ID
    if (session.user.id !== userId) {
      Logger.warn('User ID mismatch, using session user ID', {
        component: 'journalStorage',
        action: 'user_id_validation',
      });
      userId = session.user.id;
    }

    const key = getJournalKey(userId, contentType, date);

    // Get the local entry first
    const localEntry = await getLocalEntry(key);

    try {
      // If we have a local entry, try to get the specific cloud entry
      // Otherwise, try to find any cloud entry for this date and content type
      let cloudEntry;

      if (localEntry?.id) {

        try {
          cloudEntry = await getCloudEntry(userId, localEntry.id, date);
        } catch (error) {
          Logger.warn('Error fetching cloud entry by ID, trying by date/type', {
            component: 'journalStorage',
            action: 'sync_from_cloud',
          });
        }
      }

      // If we don't have a cloud entry by ID, try to find one by date and content type
      if (!cloudEntry) {

        const { data: entries, error } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', userId)
          .eq('content_type', contentType)
          .eq('selected_date', date) // Ensure we only get entries for the exact date
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) {
          Logger.error('Error querying cloud entries', error as Error, {
            component: 'journalStorage',
            action: 'sync_from_cloud',
          });
          throw error;
        }

        // Only use the cloud entry if it matches the exact date
        cloudEntry = entries?.find(entry => entry.selected_date === date);

      }

      // If we have a local entry but no cloud entry, delete the local entry
      if (localEntry && !cloudEntry) {

        await AsyncStorage.removeItem(key);
        return null;
      }

      // If we have a cloud entry, verify it matches the requested date
      if (cloudEntry) {
        // Ensure the cloud entry has the correct selected_date
        if (cloudEntry.selected_date !== date) {

          await AsyncStorage.removeItem(key);
          return null;
        }

        if (!localEntry || new Date(cloudEntry.updated_at) > new Date(localEntry.updated_at || 0)) {

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

          return completeEntry;
        } else {

        }
      } else {

      }

      return localEntry;
    } catch (error) {
      Logger.error('Error in syncFromCloud', error as Error, {
      component: 'journalStorage',
      action: 'sync_from_cloud',
    });
      throw error;
    }
  } catch (error) {
    Logger.error('Error in syncFromCloud', error as Error, {
      component: 'journalStorage',
      action: 'sync_from_cloud',
    });
    throw error;
  } finally {

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

// ===== TODAY'S WIN STORAGE FUNCTIONS =====

export interface TodayWinEntry {
  id: string;
  text: string;
  date: Date;
}

// Save today's win to local storage
export const saveLocalTodayWin = async (
  key: string,
  win: TodayWinEntry,
  userId: string
): Promise<void> => {
  const entryData = {
    content_type: 'today_win',
    content: { win },
    selected_date: toLocalDateString(win.date),
    user_id: userId,
  };
  await saveLocalEntry(key, entryData, userId);
};

// Get today's win from local storage
export const getLocalTodayWin = async (key: string): Promise<TodayWinEntry | null> => {
  const entry = await getLocalEntry(key);
  return entry?.content?.win || null;
};

// Save today's win to cloud storage
export const saveCloudTodayWin = async (
  userId: string,
  win: TodayWinEntry
): Promise<void> => {
  const entryData: Omit<JournalEntryBase, 'id' | 'created_at' | 'updated_at'> = {
    content_type: 'today_win',
    content: { win },
    selected_date: toLocalDateString(win.date),
    user_id: userId,
  };
  await saveCloudEntry(userId, entryData as JournalEntryBase);
};

// Get today's win from cloud storage
export const getCloudTodayWin = async (
  userId: string,
  date: string
): Promise<TodayWinEntry | null> => {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('content_type', 'today_win')
    .eq('selected_date', date)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {throw error;}
  return data?.content?.win || null;
};

// ===== LOOKING FORWARD STORAGE FUNCTIONS =====

export interface LookingForwardEntry {
  id: string;
  text: string;
  date: Date;
}

// Save looking forward entry to local storage
export const saveLocalLookingForward = async (
  key: string,
  entry: LookingForwardEntry,
  userId: string
): Promise<void> => {
  const entryData = {
    content_type: 'looking_forward',
    content: { entry },
    selected_date: toLocalDateString(entry.date),
    user_id: userId,
  };
  await saveLocalEntry(key, entryData, userId);
};

// Get looking forward entry from local storage
export const getLocalLookingForward = async (key: string): Promise<LookingForwardEntry | null> => {
  const entry = await getLocalEntry(key);
  return entry?.content?.entry || null;
};

// Save looking forward entry to cloud storage
export const saveCloudLookingForward = async (
  userId: string,
  entry: LookingForwardEntry
): Promise<void> => {
  const entryData: Omit<JournalEntryBase, 'id' | 'created_at' | 'updated_at'> = {
    content_type: 'looking_forward',
    content: { entry },
    selected_date: toLocalDateString(entry.date),
    user_id: userId,
  };
  await saveCloudEntry(userId, entryData as JournalEntryBase);
};

// Get looking forward entry from cloud storage
export const getCloudLookingForward = async (
  userId: string,
  date: string
): Promise<LookingForwardEntry | null> => {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('content_type', 'looking_forward')
    .eq('selected_date', date)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {throw error;}
  return data?.content?.entry || null;
};

// --- Cache Management Functions ---
export const clearJournalCache = async (userId: string, contentType?: string, date?: string): Promise<void> => {

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    let keysToDelete: string[] = [];

    if (contentType && date) {
      // Clear specific content type for specific date
      const dateStr = typeof date === 'string' ? date : toLocalDateString(date);
      const key = getJournalKey(userId, contentType, dateStr);
      keysToDelete = [key];
    } else if (contentType) {
      // Clear all entries for specific content type
      keysToDelete = allKeys.filter(key =>
        key.startsWith(`journal_${contentType}_${userId}_`)
      );
    } else {
      // Clear all journal entries for user
      keysToDelete = allKeys.filter(key =>
        key.includes(`_${userId}_`) && (
          key.startsWith('journal_') ||
          key.startsWith('timeblock_') ||
          key.startsWith('gratitude_') ||
          key.startsWith('todos_') ||
          key.startsWith('today_win_') ||
          key.startsWith('looking_forward_')
        )
      );
    }

    for (const key of keysToDelete) {
      await AsyncStorage.removeItem(key);
    }

  } catch (error) {
    Logger.error('Error in clearJournalCache', error as Error, {
      component: 'journalStorage',
      action: 'clear_cache',
    });
    throw error;
  }
};

export const forceRefreshJournalData = async (
  userId: string,
  date: string | Date,
  contentType: string
): Promise<void> => {

  try {
    const dateStr = typeof date === 'string' ? date : toLocalDateString(date);

    // Clear local cache first
    await clearJournalCache(userId, contentType, dateStr);

    // Force sync from cloud
    await syncFromCloud(userId, dateStr, contentType);

  } catch (error) {
    Logger.error('Error in forceRefreshJournalData', error as Error, {
      component: 'journalStorage',
      action: 'force_refresh',
    });
    throw error;
  }
};

export const forceRefreshAllJournalData = async (
  userId: string,
  date: string | Date
): Promise<void> => {

  try {
    const dateStr = typeof date === 'string' ? date : toLocalDateString(date);

    // Clear all local cache first
    await clearJournalCache(userId);

    // Force sync all content types from cloud
    const contentTypes = ['gratitude', 'todos', 'today_win', 'looking_forward'];

    for (const contentType of contentTypes) {
      try {
        await syncFromCloud(userId, dateStr, contentType);
      } catch (error) {
        Logger.error(`Error syncing ${contentType}`, error as Error, {
          component: 'journalStorage',
          action: 'force_refresh_all',
          contentType,
        });
        // Continue with other content types even if one fails
      }
    }

    // Also refresh time blocks
    try {
      const { forceRefreshTimeBlocks } = await import('./timeBlockStorage');
      await forceRefreshTimeBlocks(userId, dateStr);
    } catch (error) {
      Logger.error('Error syncing time blocks', error as Error, {
        component: 'journalStorage',
        action: 'force_refresh_all',
      });
    }

  } catch (error) {
    Logger.error('Error in forceRefreshAllJournalData', error as Error, {
      component: 'journalStorage',
      action: 'force_refresh_all',
    });
    throw error;
  }
};

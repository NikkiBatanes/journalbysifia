import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseApi';
import { checkSession } from './journalStorage';

// --- Types ---
export interface ReflectionLogEntry {
  id: string;
  title: string;
  content: string;
  date: Date;
  type: 'free-form' | 'guided';
  source?: 'devotional';
  prompt?: string;
  tags: string[];
  location?: string;
  // Devotional metadata
  devotionalTitle?: string;
  dayNumber?: number;
  dayTitle?: string;
  totalDays?: number;
  questionNumber?: number;
  // Database fields
  user_id: string;
  created_at: string;
  updated_at: string;
  selected_date: string; // YYYY-MM-DD format
}

export interface ReflectionEntryContent {
  entries: ReflectionLogEntry[];
}

export interface ReflectionStorageEntry {
  id: string;
  user_id: string;
  content_type: 'reflection_log';
  content: ReflectionEntryContent;
  selected_date: string;
  created_at: string;
  updated_at: string;
}

// --- Utility Functions ---
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
};

const toLocalDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const getReflectionKey = (userId: string, date: string | Date): string => {
  let formattedDate: string;

  try {
    if (!date) {
      formattedDate = new Date().toISOString().split('T')[0];
    } else if (typeof date === 'string') {
      if (date.includes('T')) {
        formattedDate = date.split('T')[0];
      } else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        formattedDate = date;
      } else {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
          console.error('Invalid date provided:', date);
          formattedDate = new Date().toISOString().split('T')[0];
        } else {
          formattedDate = parsedDate.toISOString().split('T')[0];
        }
      }
    } else if (date instanceof Date) {
      if (isNaN(date.getTime())) {
        console.error('Invalid Date object provided:', date);
        formattedDate = new Date().toISOString().split('T')[0];
      } else {
        formattedDate = date.toISOString().split('T')[0];
      }
    } else {
      console.error('Unsupported date type:', typeof date, date);
      formattedDate = new Date().toISOString().split('T')[0];
    }
  } catch (e) {
    console.error('Error formatting date:', e, 'Input:', date);
    formattedDate = new Date().toISOString().split('T')[0];
  }

  const key = `reflection_log_${formattedDate}_${userId}`;
  console.log('Generated reflection key:', { userId, date, formattedDate, key });
  return key;
};

// --- Local Storage Functions ---
export const getLocalReflectionEntry = async (key: string): Promise<ReflectionStorageEntry | null> => {
  try {
    const data = await AsyncStorage.getItem(key);
    if (!data) {return null;}

    const parsed = JSON.parse(data);
    // Convert date strings back to Date objects for entries
    if (parsed.content?.entries) {
      parsed.content.entries = parsed.content.entries.map((entry: any) => ({
        ...entry,
        date: new Date(entry.date),
      }));
    }

    return parsed;
  } catch (error) {
    console.error('Error getting local reflection entry:', error);
    return null;
  }
};

export const saveLocalReflectionEntry = async (
  key: string,
  entries: ReflectionLogEntry[],
  userId: string
): Promise<ReflectionStorageEntry> => {
  console.log('Saving local reflection entry:', { key, userId, entriesCount: entries.length });

  if (!userId) {
    throw new Error('User ID is required to save reflection entry');
  }

  const now = new Date().toISOString();
  const keyParts = key.split('_');
  const dateFromKey = keyParts.length >= 3 ? keyParts[2] : null;

  const storageEntry: ReflectionStorageEntry = {
    id: generateUUID(),
    user_id: userId,
    content_type: 'reflection_log',
    content: { entries },
    selected_date: dateFromKey || new Date().toISOString().split('T')[0],
    created_at: now,
    updated_at: now,
  };

  console.log('Saving reflection entry:', {
    key,
    id: storageEntry.id,
    date: storageEntry.selected_date,
    userId: storageEntry.user_id,
    entriesCount: entries.length,
  });

  try {
    await AsyncStorage.setItem(key, JSON.stringify(storageEntry));
    console.log('Successfully saved local reflection entry');
    return storageEntry;
  } catch (error) {
    console.error('Error saving reflection to AsyncStorage:', error);
    throw error;
  }
};

export const updateLocalReflectionEntry = async (
  key: string,
  updatedEntry: ReflectionStorageEntry
): Promise<void> => {
  try {
    const updated = {
      ...updatedEntry,
      updated_at: new Date().toISOString(),
    };

    await AsyncStorage.setItem(key, JSON.stringify(updated));
    console.log('Successfully updated local reflection entry');
  } catch (error) {
    console.error('Error updating local reflection entry:', error);
    throw error;
  }
};

export const deleteLocalReflectionEntry = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
    console.log('Successfully deleted local reflection entry');
  } catch (error) {
    console.error('Error deleting local reflection entry:', error);
    throw error;
  }
};

// --- Cloud Storage Functions ---
export const saveCloudReflectionEntry = async (
  userId: string,
  entry: ReflectionStorageEntry
): Promise<any> => {
  console.log('=== saveCloudReflectionEntry START ===');

  try {
    const { session } = await checkSession();
    if (!session?.user?.id) {
      console.error('No valid session available. User must be logged in.');
      throw new Error('You must be logged in to save reflection entries');
    }

    const entryToSave = {
      ...entry,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    console.log('Saving reflection entry to cloud:', {
      id: entryToSave.id,
      userId: entryToSave.user_id,
      date: entryToSave.selected_date,
      entriesCount: entryToSave.content.entries.length,
    });

    const { data, error } = await supabase
      .from('reflection_entries')
      .upsert(entryToSave, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving reflection entry to cloud:', error);
      throw error;
    }

    console.log('Successfully saved reflection entry to cloud:', data?.id);
    console.log('=== saveCloudReflectionEntry COMPLETE ===');
    return data;
  } catch (error) {
    console.error('Error in saveCloudReflectionEntry:', error);
    throw error;
  }
};

export const getCloudReflectionEntry = async (
  userId: string,
  date: string
): Promise<ReflectionStorageEntry | null> => {
  try {
    const { data, error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .eq('content_type', 'reflection_log')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching cloud reflection entry:', error);
      throw error;
    }

    if (data && data.content?.entries) {
      // Convert date strings back to Date objects
      data.content.entries = data.content.entries.map((entry: any) => ({
        ...entry,
        date: new Date(entry.date),
      }));
    }

    return data;
  } catch (error) {
    console.error('Error in getCloudReflectionEntry:', error);
    return null;
  }
};

export const syncReflectionFromCloud = async (
  userId: string,
  date: string
): Promise<void> => {
  console.log('=== syncReflectionFromCloud START ===', { userId, date });

  try {
    const cloudEntry = await getCloudReflectionEntry(userId, date);
    const key = getReflectionKey(userId, date);
    const localEntry = await getLocalReflectionEntry(key);

    if (!cloudEntry) {
      console.log('No cloud reflection entry found for date:', date);
      // If there's no cloud entry but we have local data, clear the local cache
      if (localEntry) {
        console.log('Clearing local cache since cloud entry was deleted');
        await deleteLocalReflectionEntry(key);
      }
      return;
    }

    // Compare timestamps to determine if we need to update local
    const cloudUpdated = new Date(cloudEntry.updated_at).getTime();
    const localUpdated = localEntry ? new Date(localEntry.updated_at).getTime() : 0;

    if (cloudUpdated > localUpdated) {
      console.log('Cloud entry is newer, updating local storage');
      await updateLocalReflectionEntry(key, cloudEntry);
    } else {
      console.log('Local entry is up to date');
    }

    console.log('=== syncReflectionFromCloud COMPLETE ===');
  } catch (error) {
    console.error('Error in syncReflectionFromCloud:', error);
    throw error;
  }
};

export const syncReflectionToCloud = async (
  userId: string,
  date: string
): Promise<void> => {
  console.log('=== syncReflectionToCloud START ===', { userId, date });

  try {
    const key = getReflectionKey(userId, date);
    const localEntry = await getLocalReflectionEntry(key);

    if (!localEntry) {
      console.log('No local reflection entry found, nothing to sync');
      return;
    }

    // Check if cloud entry exists
    const cloudEntry = await getCloudReflectionEntry(userId, date);

    if (cloudEntry) {
      console.log('Found existing cloud entry, updating...');
      const updatedEntry = {
        ...localEntry,
        id: cloudEntry.id, // Use existing cloud ID
        updated_at: new Date().toISOString(),
      };
      await saveCloudReflectionEntry(userId, updatedEntry);
    } else {
      console.log('No existing cloud entry, creating new...');
      await saveCloudReflectionEntry(userId, localEntry);
    }

    console.log('=== syncReflectionToCloud COMPLETE ===');
  } catch (error) {
    console.error('Error in syncReflectionToCloud:', error);
    throw error;
  }
};

export const deleteCloudReflectionEntry = async (
  userId: string,
  entryId: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('reflection_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting cloud reflection entry:', error);
      throw error;
    }

    console.log('Successfully deleted cloud reflection entry');
  } catch (error) {
    console.error('Error in deleteCloudReflectionEntry:', error);
    throw error;
  }
};

// --- High-level Functions ---
export const saveReflectionEntries = async (
  userId: string,
  date: string | Date,
  entries: ReflectionLogEntry[]
): Promise<void> => {
  console.log('=== saveReflectionEntries START ===');

  try {
    const dateStr = typeof date === 'string' ? date : toLocalDateString(date);
    const key = getReflectionKey(userId, dateStr);

    // Save to local storage
    await saveLocalReflectionEntry(key, entries, userId);

    // Sync to cloud in background
    syncReflectionToCloud(userId, dateStr)
      .then(() => {
        console.log('Background reflection sync completed successfully');
      })
      .catch(err => {
        console.error('Background reflection sync failed:', err);
      });

    console.log('=== saveReflectionEntries COMPLETE ===');
  } catch (error) {
    console.error('Error in saveReflectionEntries:', error);
    throw error;
  }
};

export const loadReflectionEntries = async (
  userId: string,
  date: string | Date
): Promise<ReflectionLogEntry[]> => {
  console.log('=== loadReflectionEntries START ===');

  try {
    const dateStr = typeof date === 'string' ? date : toLocalDateString(date);
    const key = getReflectionKey(userId, dateStr);

    // Sync from cloud (this will update local if cloud is newer)
    await syncReflectionFromCloud(userId, dateStr);

    // Reload from local storage after sync
    const syncedEntry = await getLocalReflectionEntry(key);

    const entries = syncedEntry?.content?.entries || [];

    console.log('=== loadReflectionEntries COMPLETE ===', {
      entriesCount: entries.length,
    });

    return entries;
  } catch (error) {
    console.error('Error in loadReflectionEntries:', error);
    return [];
  }
};

// --- Utility Functions ---
export const clearReflectionCache = async (userId: string, date?: string): Promise<void> => {
  console.log('=== clearReflectionCache START ===', { userId, date });

  try {
    if (date) {
      // Clear specific date
      const dateStr = typeof date === 'string' ? date : toLocalDateString(date);
      const key = getReflectionKey(userId, dateStr);
      await deleteLocalReflectionEntry(key);
      console.log('Cleared reflection cache for date:', dateStr);
    } else {
      // Clear all reflection entries for user
      const allKeys = await AsyncStorage.getAllKeys();
      const reflectionKeys = allKeys.filter(key => key.startsWith(`reflection_log_${userId}_`));

      for (const key of reflectionKeys) {
        await deleteLocalReflectionEntry(key);
      }
      console.log('Cleared all reflection cache for user:', userId);
    }

    console.log('=== clearReflectionCache COMPLETE ===');
  } catch (error) {
    console.error('Error in clearReflectionCache:', error);
    throw error;
  }
};

export const forceRefreshReflectionEntries = async (
  userId: string,
  date: string | Date
): Promise<ReflectionLogEntry[]> => {
  console.log('=== forceRefreshReflectionEntries START ===');

  try {
    const dateStr = typeof date === 'string' ? date : toLocalDateString(date);

    // Clear local cache first
    await clearReflectionCache(userId, dateStr);

    // Load fresh data from cloud
    const entries = await loadReflectionEntries(userId, dateStr);

    console.log('=== forceRefreshReflectionEntries COMPLETE ===', {
      entriesCount: entries.length,
    });

    return entries;
  } catch (error) {
    console.error('Error in forceRefreshReflectionEntries:', error);
    return [];
  }
};

// --- Debug Functions ---
export const debugReflectionEntries = async (userId: string): Promise<void> => {
  console.log('=== DEBUG REFLECTION ENTRIES ===');

  try {
    // Get all reflection keys from AsyncStorage
    const allKeys = await AsyncStorage.getAllKeys();
    const reflectionKeys = allKeys.filter(key => key.startsWith('reflection_log_'));

    console.log('Found reflection keys:', reflectionKeys);

    for (const key of reflectionKeys) {
      const entry = await getLocalReflectionEntry(key);
      console.log(`Key: ${key}`, {
        id: entry?.id,
        date: entry?.selected_date,
        entriesCount: entry?.content?.entries?.length || 0,
        entries: entry?.content?.entries?.map((e: ReflectionLogEntry) => ({
          id: e.id,
          title: e.title,
          type: e.type,
          date: e.date,
        })),
      });
    }

    // Also check cloud entries
    const { data: cloudEntries, error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .order('selected_date', { ascending: false });

    if (error) {
      console.error('Error fetching cloud reflection entries:', error);
    } else {
      console.log('Cloud reflection entries:', cloudEntries?.map(entry => ({
        id: entry.id,
        date: entry.selected_date,
        entriesCount: entry.content?.entries?.length || 0,
      })));
    }

  } catch (error) {
    console.error('Error in debugReflectionEntries:', error);
  }
};

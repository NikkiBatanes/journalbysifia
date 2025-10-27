import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../utils/ProductionLogger';
import { supabase } from '../services/supabaseClient';
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

import { toLocalDateString } from '../utils/date';

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
          Logger.error('Invalid date provided', new Error(String(date)), {
      component: 'reflectionStorage',
      action: 'error',
    });
          formattedDate = toLocalDateString(new Date());
        } else {
          formattedDate = toLocalDateString(parsedDate);
        }
      }
    } else if (date instanceof Date) {
      if (isNaN(date.getTime())) {
        Logger.error('Invalid Date object provided', new Error(date.toString()), {
      component: 'reflectionStorage',
      action: 'error',
    });
        formattedDate = new Date().toISOString().split('T')[0];
      } else {
        formattedDate = toLocalDateString(date);
      }
    } else {
      Logger.error('Unsupported date type', undefined, {
        component: 'reflectionStorage',
        type: typeof date,
        value: date,
      });
      formattedDate = new Date().toISOString().split('T')[0];
    }
  } catch (e) {
    Logger.error('Error formatting date: Input:', undefined, {
        component: 'reflectionStorage',
        data1: e,
        data2: date,
      });
    formattedDate = new Date().toISOString().split('T')[0];
  }

  const key = `reflection_log_${formattedDate}_${userId}`;

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
    Logger.error('Error getting local reflection entry', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
    return null;
  }
};

export const saveLocalReflectionEntry = async (
  key: string,
  entries: ReflectionLogEntry[],
  userId: string
): Promise<ReflectionStorageEntry> => {

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
    selected_date: dateFromKey || toLocalDateString(new Date()),
    created_at: now,
    updated_at: now,
  };

  try {
    await AsyncStorage.setItem(key, JSON.stringify(storageEntry));

    return storageEntry;
  } catch (error) {
    Logger.error('Error saving reflection to AsyncStorage', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
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

  } catch (error) {
    Logger.error('Error updating local reflection entry', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
    throw error;
  }
};

export const deleteLocalReflectionEntry = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);

  } catch (error) {
    Logger.error('Error deleting local reflection entry', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
    throw error;
  }
};

// --- Cloud Storage Functions ---
export const saveCloudReflectionEntry = async (
  userId: string,
  entry: ReflectionStorageEntry
): Promise<any> => {

  try {
    const { session } = await checkSession();
    if (!session?.user?.id) {
      Logger.error('No valid session available. User must be logged in.', undefined, {
      component: 'reflectionStorage',
      action: 'error',
    });
      throw new Error('You must be logged in to save reflection entries');
    }

    const entryToSave = {
      ...entry,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('reflection_entries')
      .upsert(entryToSave, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      Logger.error('Error saving reflection entry to cloud', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
      throw error;
    }

    return data;
  } catch (error) {
    Logger.error('Error in saveCloudReflectionEntry', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
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
      Logger.error('Error fetching cloud reflection entry', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
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
    Logger.error('Error in getCloudReflectionEntry', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
    return null;
  }
};

export const syncReflectionFromCloud = async (
  userId: string,
  date: string
): Promise<void> => {

  try {
    const cloudEntry = await getCloudReflectionEntry(userId, date);
    const key = getReflectionKey(userId, date);
    const localEntry = await getLocalReflectionEntry(key);

    if (!cloudEntry) {

      // If there's no cloud entry but we have local data, clear the local cache
      if (localEntry) {

        await deleteLocalReflectionEntry(key);
      }
      return;
    }

    // Compare timestamps to determine if we need to update local
    const cloudUpdated = new Date(cloudEntry.updated_at).getTime();
    const localUpdated = localEntry ? new Date(localEntry.updated_at).getTime() : 0;

    if (cloudUpdated > localUpdated) {

      await updateLocalReflectionEntry(key, cloudEntry);
    } else {

    }

  } catch (error) {
    Logger.error('Error in syncReflectionFromCloud', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
    throw error;
  }
};

export const syncReflectionToCloud = async (
  userId: string,
  date: string
): Promise<void> => {

  try {
    const key = getReflectionKey(userId, date);
    const localEntry = await getLocalReflectionEntry(key);

    if (!localEntry) {

      return;
    }

    // Check if cloud entry exists
    const cloudEntry = await getCloudReflectionEntry(userId, date);

    if (cloudEntry) {

      const updatedEntry = {
        ...localEntry,
        id: cloudEntry.id, // Use existing cloud ID
        updated_at: new Date().toISOString(),
      };
      await saveCloudReflectionEntry(userId, updatedEntry);
    } else {

      await saveCloudReflectionEntry(userId, localEntry);
    }

  } catch (error) {
    Logger.error('Error in syncReflectionToCloud', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
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
      Logger.error('Error deleting cloud reflection entry', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
      throw error;
    }

  } catch (error) {
    Logger.error('Error in deleteCloudReflectionEntry', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
    throw error;
  }
};

// --- High-level Functions ---
export const saveReflectionEntries = async (
  userId: string,
  date: string | Date,
  entries: ReflectionLogEntry[]
): Promise<void> => {

  try {
    const dateStr = typeof date === 'string' ? date : toLocalDateString(date);
    const key = getReflectionKey(userId, dateStr);

    // Save to local storage
    await saveLocalReflectionEntry(key, entries, userId);

    // Sync to cloud in background
    syncReflectionToCloud(userId, dateStr)
      .then(() => {

      })
      .catch(err => {
        Logger.error('Background reflection sync failed', err as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
      });

  } catch (error) {
    Logger.error('Error in saveReflectionEntries', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
    throw error;
  }
};

export const loadReflectionEntries = async (
  userId: string,
  date: string | Date
): Promise<ReflectionLogEntry[]> => {

  try {
    const dateStr = typeof date === 'string' ? date : toLocalDateString(date);
    const key = getReflectionKey(userId, dateStr);

    // Sync from cloud (this will update local if cloud is newer)
    await syncReflectionFromCloud(userId, dateStr);

    // Reload from local storage after sync
    const syncedEntry = await getLocalReflectionEntry(key);

    const entries = syncedEntry?.content?.entries || [];

    return entries;
  } catch (error) {
    Logger.error('Error in loadReflectionEntries', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
    return [];
  }
};

// --- Utility Functions ---
export const clearReflectionCache = async (userId: string, date?: string): Promise<void> => {

  try {
    if (date) {
      // Clear specific date
      const dateStr = typeof date === 'string' ? date : toLocalDateString(date);
      const key = getReflectionKey(userId, dateStr);
      await deleteLocalReflectionEntry(key);

    } else {
      // Clear all reflection entries for user
      const allKeys = await AsyncStorage.getAllKeys();
      const reflectionKeys = allKeys.filter(key => key.startsWith(`reflection_log_${userId}_`));

      for (const key of reflectionKeys) {
        await deleteLocalReflectionEntry(key);
      }

    }

  } catch (error) {
    Logger.error('Error in clearReflectionCache', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
    throw error;
  }
};

export const forceRefreshReflectionEntries = async (
  userId: string,
  date: string | Date
): Promise<ReflectionLogEntry[]> => {

  try {
    const dateStr = typeof date === 'string' ? date : toLocalDateString(date);

    // Clear local cache first
    await clearReflectionCache(userId, dateStr);

    // Load fresh data from cloud
    const entries = await loadReflectionEntries(userId, dateStr);

    return entries;
  } catch (error) {
    Logger.error('Error in forceRefreshReflectionEntries', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
    return [];
  }
};

// --- Debug Functions ---
export const debugReflectionEntries = async (userId: string): Promise<void> => {

  try {
    // Get all reflection keys from AsyncStorage
    await AsyncStorage.getAllKeys();
    // Reflection keys filtered for debugging if needed

    // Removed unused local entry iteration

    // Also check cloud entries
    const { error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .order('selected_date', { ascending: false });

    if (error) {
      Logger.error('Error fetching cloud reflection entries', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
    } else {

    }

  } catch (error) {
    Logger.error('Error in debugReflectionEntries', error as Error, {
      component: 'reflectionStorage',
      action: 'error',
    });
  }
};

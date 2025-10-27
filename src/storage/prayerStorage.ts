import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../utils/ProductionLogger';
import { supabase } from '../services/supabaseClient';
import { toLocalDateString } from '../utils/date';

// Prayer types
export type PrayerType = 'journal' | 'people' | 'devotional';
export type JournalCategory = 'adoration' | 'confession' | 'thanksgiving' | 'supplication';
export type PrayerStatus = 'pending' | 'answered';

// Base prayer entry interface
export interface PrayerEntry {
  id: string;
  user_id: string;
  title?: string;
  content: string;
  prayer_type: PrayerType;
  selected_date: string;
  created_at: string;
  updated_at: string;
  version: number;

  // Prayer Journal specific fields
  journal_category?: JournalCategory;
  status?: PrayerStatus;
  answered_date?: string;

  // People Prayer specific fields
  person_name?: string;
  is_prayer_request?: boolean;
  requested_by?: string;
  prayed?: boolean;
  notes?: string;

  // Devotional Prayer specific fields
  devotional_title?: string;
  day_number?: number;
  day_title?: string;
  total_days?: number;
  question_number?: number;
}

// Generate UUID function
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    // Use Math.floor for better readability
    const randomValue = Math.random() * 16;
    const r = Math.floor(randomValue);
    // For 'y' character, use 8, 9, a, or b (0x8 in hex)
    const v = c === 'x' ? r : (r % 4) + 8; // (r & 0x3 | 0x8) becomes (r % 4) + 8
    return v.toString(16);
  });
};

// Test database connection and table existence
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {

    // Test basic connection
    const { error } = await supabase
      .from('prayers')
      .select('count')
      .limit(1);

    if (error) {
      Logger.error('❌ Database connection test failed', undefined, {
      component: 'prayerStorage',
      action: 'error',
    });
      return false;
    }

    return true;
  } catch (error) {
    Logger.error('❌ Database connection test error', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    return false;
  }
};

// Local storage functions
const getPrayerStorageKey = (userId: string, date: string): string => {
  return `@prayers_${userId}_${date}`;
};

export const saveLocalPrayers = async (
  userId: string,
  date: string,
  prayers: PrayerEntry[]
): Promise<void> => {
  try {
    const key = getPrayerStorageKey(userId, date);
    await AsyncStorage.setItem(key, JSON.stringify(prayers));
  } catch (error) {
    Logger.error('Error saving prayers to local storage', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    throw error;
  }
};

export const getLocalPrayers = async (
  userId: string,
  date: string
): Promise<PrayerEntry[]> => {
  try {
    const key = getPrayerStorageKey(userId, date);
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    Logger.error('Error loading prayers from local storage', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    return [];
  }
};

export const clearLocalPrayers = async (userId: string, date: string): Promise<void> => {
  try {
    const key = getPrayerStorageKey(userId, date);
    await AsyncStorage.removeItem(key);
  } catch (error) {
    Logger.error('Error clearing local prayers', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    throw error;
  }
};

// Cloud storage functions
export const getCloudPrayers = async (
  userId: string,
  date: string
): Promise<PrayerEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .order('created_at', { ascending: false });

    if (error) {
      Logger.error('Error fetching prayers from cloud', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
      throw error;
    }

    return data || [];
  } catch (error) {
    Logger.error('Error in getCloudPrayers', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    throw error;
  }
};

export const syncPrayersFromCloud = async (
  userId: string,
  date: string
): Promise<PrayerEntry[]> => {
  try {
    const cloudPrayers = await getCloudPrayers(userId, date);
    await saveLocalPrayers(userId, date, cloudPrayers);
    return cloudPrayers;
  } catch (error) {
    Logger.error('Error syncing prayers from cloud', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    // Return local prayers as fallback
    return await getLocalPrayers(userId, date);
  }
};

// CRUD operations
export const savePrayerEntry = async (
  userId: string,
  date: string,
  prayer: Omit<PrayerEntry, 'id' | 'user_id' | 'version' | 'created_at' | 'updated_at'>
): Promise<PrayerEntry> => {
  try {
    const newPrayer: PrayerEntry = {
      ...prayer,
      id: generateUUID(),
      user_id: userId,
      selected_date: typeof date === 'string' ? date : toLocalDateString(date),
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Get existing prayers
    const existingPrayers = await getLocalPrayers(userId, date);

    // Add new prayer
    const updatedPrayers = [...existingPrayers, newPrayer];

    // Save to local storage
    await saveLocalPrayers(userId, date, updatedPrayers);

    // Insert to cloud storage
    try {

      const { error } = await supabase
        .from('prayers')
        .insert({
          id: newPrayer.id,
          user_id: newPrayer.user_id,
          title: newPrayer.title,
          content: newPrayer.content,
          prayer_type: newPrayer.prayer_type,
          selected_date: newPrayer.selected_date,
          journal_category: newPrayer.journal_category,
          status: newPrayer.status,
          answered_date: newPrayer.answered_date,
          person_name: newPrayer.person_name,
          is_prayer_request: newPrayer.is_prayer_request,
          requested_by: newPrayer.requested_by,
          prayed: newPrayer.prayed,
          notes: newPrayer.notes,
          devotional_title: newPrayer.devotional_title,
          day_number: newPrayer.day_number,
          day_title: newPrayer.day_title,
          total_days: newPrayer.total_days,
          question_number: newPrayer.question_number,
          version: newPrayer.version,
          created_at: newPrayer.created_at,
          updated_at: newPrayer.updated_at,
        })
        .select();

      if (error) {
        Logger.error('❌ Supabase error details', undefined, {
      component: 'prayerStorage',
      action: 'error',
    });
        throw error;
      }

    } catch (cloudError: any) {
      Logger.error('❌ Failed to save to cloud, but local save succeeded', undefined, {
      component: 'prayerStorage',
      action: 'error',
    });
      // Don't throw here - local save succeeded
    }

    return newPrayer;
  } catch (error) {
    Logger.error('Error saving prayer entry', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    throw error;
  }
};

export const updatePrayerEntry = async (
  userId: string,
  date: string,
  prayerId: string,
  updates: Partial<PrayerEntry>
): Promise<PrayerEntry> => {
  try {
    // Get existing prayers
    const existingPrayers = await getLocalPrayers(userId, date);

    // Find the prayer to update
    const existingPrayer = existingPrayers.find(prayer => prayer.id === prayerId);

    if (!existingPrayer) {
      throw new Error('Prayer not found');
    }

    // Create updated prayer
    const updatedPrayer = {
      ...existingPrayer,
      ...updates,
      version: existingPrayer.version + 1,
      updated_at: new Date().toISOString(),
    };

    // Update in local storage
    const updatedPrayers = existingPrayers.map(prayer =>
      prayer.id === prayerId ? updatedPrayer : prayer
    );
    await saveLocalPrayers(userId, date, updatedPrayers);

    // Update in cloud storage
    try {
      const { error } = await supabase
        .from('prayers')
        .update({
          title: updatedPrayer.title,
          content: updatedPrayer.content,
          prayer_type: updatedPrayer.prayer_type,
          journal_category: updatedPrayer.journal_category,
          status: updatedPrayer.status,
          answered_date: updatedPrayer.answered_date,
          person_name: updatedPrayer.person_name,
          is_prayer_request: updatedPrayer.is_prayer_request,
          requested_by: updatedPrayer.requested_by,
          prayed: updatedPrayer.prayed,
          notes: updatedPrayer.notes,
          devotional_title: updatedPrayer.devotional_title,
          day_number: updatedPrayer.day_number,
          day_title: updatedPrayer.day_title,
          total_days: updatedPrayer.total_days,
          question_number: updatedPrayer.question_number,
          version: updatedPrayer.version,
          updated_at: updatedPrayer.updated_at,
        })
        .eq('id', prayerId)
        .eq('user_id', userId);

      if (error) {
        Logger.error('Error updating prayer in cloud', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
        throw error;
      }

    } catch (cloudError) {
      Logger.error('Failed to update in cloud, but local save succeeded', cloudError as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
      // Don't throw here - local update succeeded
    }

    return updatedPrayer;
  } catch (error) {
    Logger.error('Error updating prayer entry', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    throw error;
  }
};

export const deletePrayerEntry = async (
  userId: string,
  date: string,
  prayerId: string
): Promise<void> => {
  try {
    // Get existing prayers
    const existingPrayers = await getLocalPrayers(userId, date);

    // Remove prayer from local storage
    const updatedPrayers = existingPrayers.filter(prayer => prayer.id !== prayerId);
    await saveLocalPrayers(userId, date, updatedPrayers);

    // Delete from cloud storage
    try {
      const { error } = await supabase
        .from('prayers')
        .delete()
        .eq('id', prayerId)
        .eq('user_id', userId);

      if (error) {
        Logger.error('Error deleting prayer from cloud', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
        throw error;
      }

    } catch (cloudError) {
      Logger.error('Failed to delete from cloud, but local delete succeeded', cloudError as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
      // Don't throw here - local delete succeeded
    }
  } catch (error) {
    Logger.error('Error deleting prayer entry', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    throw error;
  }
};

// Utility functions for specific prayer types
export const getPrayersByType = async (
  userId: string,
  date: string,
  prayerType: PrayerType
): Promise<PrayerEntry[]> => {
  try {
    const prayers = await getLocalPrayers(userId, date);
    return prayers.filter(prayer => prayer.prayer_type === prayerType);
  } catch (error) {
    Logger.error('Error getting prayers by type', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    return [];
  }
};

export const getJournalPrayersByCategory = async (
  userId: string,
  date: string,
  category: JournalCategory
): Promise<PrayerEntry[]> => {
  try {
    const prayers = await getPrayersByType(userId, date, 'journal');
    return prayers.filter(prayer => prayer.journal_category === category);
  } catch (error) {
    Logger.error('Error getting journal prayers by category', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    return [];
  }
};

export const getPeoplePrayers = async (
  userId: string,
  date: string,
  isRequest?: boolean
): Promise<PrayerEntry[]> => {
  try {
    const prayers = await getPrayersByType(userId, date, 'people');
    if (isRequest !== undefined) {
      return prayers.filter(prayer => prayer.is_prayer_request === isRequest);
    }
    return prayers;
  } catch (error) {
    Logger.error('Error getting people prayers', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    return [];
  }
};

export const getDevotionalPrayers = async (
  userId: string,
  date: string,
  devotionalTitle?: string
): Promise<PrayerEntry[]> => {
  try {
    const prayers = await getPrayersByType(userId, date, 'devotional');
    if (devotionalTitle) {
      return prayers.filter(prayer => prayer.devotional_title === devotionalTitle);
    }
    return prayers;
  } catch (error) {
    Logger.error('Error getting devotional prayers', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    return [];
  }
};

// Get all devotional prayers from cloud database regardless of date
export const getAllDevotionalPrayersFromCloud = async (
  userId: string
): Promise<PrayerEntry[]> => {
  try {

    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .eq('prayer_type', 'devotional')
      .order('created_at', { ascending: false });

    if (error) {
      Logger.error('❌ Error in getAllDevotionalPrayersFromCloud', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
      throw error;
    }

    return data || [];
  } catch (error) {
    Logger.error('❌ Error in getAllDevotionalPrayersFromCloud', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    throw error;
  }
};

// Get devotional prayers for a specific date (similar to getCloudPrayers)
export const getDevotionalPrayersByDate = async (userId: string, date: string): Promise<PrayerEntry[]> => {
  try {

    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .eq('prayer_type', 'devotional')
      .eq('selected_date', date)
      .order('created_at', { ascending: false });

    if (error) {
      Logger.error('❌ Error fetching devotional prayers by date from cloud', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
      throw error;
    }

    return data || [];
  } catch (error) {
    Logger.error('❌ Error in getDevotionalPrayersByDate', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    throw error;
  }
};

// Force refresh function (clears local cache and syncs from cloud)
export const forceRefreshPrayers = async (
  userId: string,
  date: string
): Promise<PrayerEntry[]> => {
  try {
    await clearLocalPrayers(userId, date);
    return await syncPrayersFromCloud(userId, date);
  } catch (error) {
    Logger.error('Error force refreshing prayers', error as Error, {
      component: 'prayerStorage',
      action: 'error',
    });
    return [];
  }
};

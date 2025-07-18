import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseApi';
import { toLocalDateString } from '../utils/date';

// Generate UUID function
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
};

// Types
export interface TimeBlockEntry {
  id: string;
  user_id: string;
  selected_date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  title: string;
  location?: string;
  category: string;
  repeat?: any; // JSON object for repeat rules
  repeat_until?: string;
  notes?: string;
  version: number;
  created_at?: string;
  updated_at?: string;
}

// Local storage key helper
const getTimeBlockKey = (userId: string, date: string): string => {
  const dateStr = typeof date === 'string' ? date : toLocalDateString(date);
  return `timeblock_${userId}_${dateStr}`;
};

// --- Local Storage Functions ---

export const saveLocalTimeBlocks = async (
  userId: string,
  date: string,
  timeBlocks: TimeBlockEntry[]
): Promise<void> => {
  try {
    const key = getTimeBlockKey(userId, date);
    await AsyncStorage.setItem(key, JSON.stringify(timeBlocks));
  } catch (error) {
    console.error('Error saving time blocks to local storage:', error);
    throw error;
  }
};

export const getLocalTimeBlocks = async (
  userId: string,
  date: string
): Promise<TimeBlockEntry[]> => {
  try {
    const key = getTimeBlockKey(userId, date);
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting time blocks from local storage:', error);
    return [];
  }
};

export const clearTimeBlockCache = async (userId: string, date?: string): Promise<void> => {
  try {
    if (date) {
      const key = getTimeBlockKey(userId, date);
      await AsyncStorage.removeItem(key);
    } else {
      // Clear all time block cache for user
      const allKeys = await AsyncStorage.getAllKeys();
      const timeBlockKeys = allKeys.filter(key => key.startsWith(`timeblock_${userId}_`));
      await AsyncStorage.multiRemove(timeBlockKeys);
    }
  } catch (error) {
    console.error('Error clearing time block cache:', error);
    throw error;
  }
};

// --- Cloud Storage Functions ---

export const saveCloudTimeBlocks = async (
  userId: string,
  date: string,
  timeBlocks: TimeBlockEntry[]
): Promise<void> => {
  try {
    const dateStr = typeof date === 'string' ? date : toLocalDateString(date);
    
    // First, delete existing time blocks for this date
    await supabase
      .from('time_blocks')
      .delete()
      .eq('user_id', userId)
      .eq('selected_date', dateStr);

    // Then insert new time blocks
    if (timeBlocks.length > 0) {
      const { error } = await supabase
        .from('time_blocks')
        .insert(timeBlocks.map(block => ({
          ...block,
          user_id: userId,
          selected_date: dateStr,
          updated_at: new Date().toISOString()
        })));

      if (error) {
        console.error('Error saving time blocks to cloud:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error in saveCloudTimeBlocks:', error);
    throw error;
  }
};

export const getCloudTimeBlocks = async (
  userId: string,
  date: string
): Promise<TimeBlockEntry[]> => {
  try {
    const dateStr = typeof date === 'string' ? date : toLocalDateString(date);
    
    const { data, error } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', dateStr)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error getting time blocks from cloud:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getCloudTimeBlocks:', error);
    return [];
  }
};

export const syncTimeBlocksFromCloud = async (
  userId: string,
  date: string
): Promise<TimeBlockEntry[]> => {
  try {
    const cloudTimeBlocks = await getCloudTimeBlocks(userId, date);
    await saveLocalTimeBlocks(userId, date, cloudTimeBlocks);
    return cloudTimeBlocks;
  } catch (error) {
    console.error('Error syncing time blocks from cloud:', error);
    // Return local data as fallback
    return await getLocalTimeBlocks(userId, date);
  }
};

export const forceRefreshTimeBlocks = async (
  userId: string,
  date: string
): Promise<TimeBlockEntry[]> => {
  try {
    // Clear local cache first
    await clearTimeBlockCache(userId, date);
    
    // Sync fresh data from cloud
    return await syncTimeBlocksFromCloud(userId, date);
  } catch (error) {
    console.error('Error in forceRefreshTimeBlocks:', error);
    throw error;
  }
};

// --- CRUD Operations ---

export const saveTimeBlockEntry = async (
  userId: string,
  date: string,
  timeBlock: Omit<TimeBlockEntry, 'id' | 'user_id' | 'version' | 'created_at' | 'updated_at'>
): Promise<TimeBlockEntry> => {
  try {
    const newTimeBlock: TimeBlockEntry = {
      ...timeBlock,
      id: generateUUID(),
      user_id: userId,
      selected_date: typeof date === 'string' ? date : toLocalDateString(date),
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Get existing time blocks
    const existingTimeBlocks = await getLocalTimeBlocks(userId, date);
    
    // Add new time block
    const updatedTimeBlocks = [...existingTimeBlocks, newTimeBlock];
    
    // Save to local storage
    await saveLocalTimeBlocks(userId, date, updatedTimeBlocks);
    
    // Insert directly to cloud storage
    try {
      const { error } = await supabase
        .from('time_blocks')
        .insert({
          id: newTimeBlock.id,
          user_id: newTimeBlock.user_id,
          selected_date: newTimeBlock.selected_date,
          start_time: newTimeBlock.start_time,
          end_time: newTimeBlock.end_time,
          all_day: newTimeBlock.all_day,
          title: newTimeBlock.title,
          location: newTimeBlock.location,
          category: newTimeBlock.category,
          repeat: newTimeBlock.repeat,
          repeat_until: newTimeBlock.repeat_until,
          notes: newTimeBlock.notes,
          version: newTimeBlock.version,
          created_at: newTimeBlock.created_at,
          updated_at: newTimeBlock.updated_at
        });

      if (error) {
        console.error('Error inserting time block to cloud:', error);
        throw error;
      }
      
      console.log('Successfully inserted time block to cloud:', newTimeBlock.id);
    } catch (cloudError) {
      console.error('Failed to save to cloud, but local save succeeded:', cloudError);
      // Don't throw here - local save succeeded
    }

    return newTimeBlock;
  } catch (error) {
    console.error('Error saving time block entry:', error);
    throw error;
  }
};

export const updateTimeBlockEntry = async (
  userId: string,
  date: string,
  timeBlockId: string,
  updates: Partial<TimeBlockEntry>
): Promise<TimeBlockEntry> => {
  try {
    // Get existing time blocks
    const existingTimeBlocks = await getLocalTimeBlocks(userId, date);
    
    // Find the time block to update
    const existingBlock = existingTimeBlocks.find(block => block.id === timeBlockId);
    
    if (!existingBlock) {
      throw new Error('Time block not found');
    }

    // Create updated time block
    const updatedTimeBlock = {
      ...existingBlock,
      ...updates,
      version: existingBlock.version + 1,
      updated_at: new Date().toISOString()
    };

    // Update in local storage
    const updatedTimeBlocks = existingTimeBlocks.map(block => 
      block.id === timeBlockId ? updatedTimeBlock : block
    );
    await saveLocalTimeBlocks(userId, date, updatedTimeBlocks);
    
    // Update directly in cloud storage
    try {
      const { error } = await supabase
        .from('time_blocks')
        .update({
          title: updatedTimeBlock.title,
          start_time: updatedTimeBlock.start_time,
          end_time: updatedTimeBlock.end_time,
          all_day: updatedTimeBlock.all_day,
          category: updatedTimeBlock.category,
          location: updatedTimeBlock.location,
          notes: updatedTimeBlock.notes,
          repeat: updatedTimeBlock.repeat,
          repeat_until: updatedTimeBlock.repeat_until,
          version: updatedTimeBlock.version,
          updated_at: updatedTimeBlock.updated_at
        })
        .eq('id', timeBlockId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating time block in cloud:', error);
        throw error;
      }
      
      console.log('Successfully updated time block in cloud:', timeBlockId);
    } catch (cloudError) {
      console.error('Failed to update in cloud, but local save succeeded:', cloudError);
      // Don't throw here - local update succeeded
    }

    return updatedTimeBlock;
  } catch (error) {
    console.error('Error updating time block entry:', error);
    throw error;
  }
};

export const deleteTimeBlockEntry = async (
  userId: string,
  date: string,
  timeBlockId: string
): Promise<void> => {
  try {
    // Get existing time blocks
    const existingTimeBlocks = await getLocalTimeBlocks(userId, date);
    
    // Remove the time block
    const updatedTimeBlocks = existingTimeBlocks.filter(block => block.id !== timeBlockId);

    // Save to local storage
    await saveLocalTimeBlocks(userId, date, updatedTimeBlocks);
    
    // Delete directly from cloud storage
    try {
      const { error } = await supabase
        .from('time_blocks')
        .delete()
        .eq('id', timeBlockId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting time block from cloud:', error);
        throw error;
      }
      
      console.log('Successfully deleted time block from cloud:', timeBlockId);
    } catch (cloudError) {
      console.error('Failed to delete from cloud, but local delete succeeded:', cloudError);
      // Don't throw here - local delete succeeded
    }
  } catch (error) {
    console.error('Error deleting time block entry:', error);
    throw error;
  }
};

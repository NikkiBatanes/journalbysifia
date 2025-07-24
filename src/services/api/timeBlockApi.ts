// src/services/api/timeBlockApi.ts
import { supabase } from '../supabaseApi';

export interface TimeBlockApiEntry {
  id: string;
  user_id: string;
  selected_date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  title: string;
  location?: string;
  category: string;
  repeat_rule?: any; // jsonb
  repeat_until?: string; // date
  timezone?: string;
  is_completed?: boolean;
  completed_at?: string;
  description?: string; // notes field in the UI
  version?: number;
  metadata?: any; // jsonb
  created_at: string;
  updated_at: string;
}

export class TimeBlockApi {
  // Get all time blocks for a user and date
  static async getTimeBlocks(userId: string, date: string): Promise<TimeBlockApiEntry[]> {
    const { data, error } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching time blocks:', error);
      throw new Error(`Failed to fetch time blocks: ${error.message}`);
    }

    return data || [];
  }

  // Create a new time block (with upsert to handle duplicates)
  static async createTimeBlock(timeBlock: Omit<TimeBlockApiEntry, 'id' | 'created_at' | 'updated_at'>): Promise<TimeBlockApiEntry> {
    const now = new Date().toISOString();
    const timeBlockWithTimestamps = {
      ...timeBlock,
      created_at: now,
      updated_at: now,
    };

    // Use upsert to handle duplicate start times gracefully
    const { data, error } = await supabase
      .from('time_blocks')
      .upsert(timeBlockWithTimestamps, {
        onConflict: 'user_id,selected_date,start_time',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating time block:', error);
      throw new Error(`Failed to create time block: ${error.message}`);
    }

    return data;
  }

  // Update a time block
  static async updateTimeBlock(
    id: string,
    updates: Partial<Omit<TimeBlockApiEntry, 'id' | 'user_id' | 'created_at'>>
  ): Promise<TimeBlockApiEntry> {
    const { data, error } = await supabase
      .from('time_blocks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating time block:', error);
      throw new Error(`Failed to update time block: ${error.message}`);
    }

    return data;
  }

  // Delete a time block
  static async deleteTimeBlock(id: string): Promise<void> {
    const { error } = await supabase
      .from('time_blocks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting time block:', error);
      throw new Error(`Failed to delete time block: ${error.message}`);
    }
  }

  // Get time blocks across multiple dates
  static async getTimeBlocksInDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<TimeBlockApiEntry[]> {
    const { data, error } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('user_id', userId)
      .gte('selected_date', startDate)
      .lte('selected_date', endDate)
      .order('selected_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching time blocks in date range:', error);
      throw new Error(`Failed to fetch time blocks: ${error.message}`);
    }

    return data || [];
  }

  // Bulk create time blocks
  static async createMultipleTimeBlocks(timeBlocks: Omit<TimeBlockApiEntry, 'id' | 'created_at' | 'updated_at'>[]): Promise<TimeBlockApiEntry[]> {
    const now = new Date().toISOString();
    const timeBlocksWithTimestamps = timeBlocks.map(block => ({
      ...block,
      created_at: now,
      updated_at: now,
    }));

    const { data, error } = await supabase
      .from('time_blocks')
      .upsert(timeBlocksWithTimestamps, {
        onConflict: 'user_id,selected_date,start_time',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('Error creating multiple time blocks:', error);
      throw new Error(`Failed to create time blocks: ${error.message}`);
    }

    return data || [];
  }

  // Check for time conflicts
  static async checkTimeConflicts(
    userId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Promise<TimeBlockApiEntry[]> {
    let query = supabase
      .from('time_blocks')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .or(`start_time.lte.${endTime},end_time.gte.${startTime}`);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error checking time conflicts:', error);
      throw new Error(`Failed to check time conflicts: ${error.message}`);
    }

    return data || [];
  }
}

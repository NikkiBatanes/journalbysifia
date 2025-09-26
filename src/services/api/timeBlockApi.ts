// src/services/api/timeBlockApi.ts
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

export class ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;

  constructor(message: string, statusCode: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

export const handleApiError = (error: unknown, context: string): never => {
  console.error(`[${context}] Error:`, error);

  if (error instanceof ApiError) {
    throw error; // Re-throw if it's already an ApiError
  }

  if (error instanceof Error) {
    // Handle Supabase errors
    if ('code' in error && 'details' in error && 'hint' in error) {
      const supabaseError = error as PostgrestError;
      throw new ApiError(
        `Database error: ${supabaseError.message}`,
        500,
        supabaseError.code,
        {
          details: supabaseError.details,
          hint: supabaseError.hint,
        }
      );
    }

    // Handle network errors
    if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      throw new ApiError('Network error. Please check your connection and try again.', 0, 'NETWORK_ERROR');
    }

    // Generic error
    throw new ApiError(error.message, 500, 'INTERNAL_ERROR');
  }

  // Fallback for non-Error throws
  throw new ApiError('An unknown error occurred', 500, 'UNKNOWN_ERROR');
};

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
  repeat_frequency?: string;
  repeat_end_date?: string;
  repeat_custom_frequency?: number;
  timezone?: string;
  is_completed?: boolean;
  completed_at?: string;
  description?: string; // notes field in the UI
  calendar_event_id?: string; // native calendar event linkage
  version?: number;
  metadata?: any; // jsonb
  created_at: string;
  updated_at: string;
}

export class TimeBlockApi {
  // Get all time blocks for a user and date
  static async getTimeBlocks(userId: string, date: string): Promise<TimeBlockApiEntry[]> {
    try {
      console.log('🔍 Fetching time blocks for user:', userId, 'date:', date);

      // Get both regular blocks for this date and repeating blocks that might appear on this date
      const { data: regularBlocks, error: regularError } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', userId)
        .eq('selected_date', date)
        .order('start_time');

      if (regularError) {
        console.error('❌ Error fetching regular blocks:', regularError);
        throw regularError;
      }

      console.log('📅 Regular blocks found:', regularBlocks?.length || 0);

      // Filter out regular blocks that have the target date in their exceptions
      const filteredBlocks = regularBlocks?.filter(block => {
        const metadata = block.metadata || {};
        const exceptions = metadata.exceptions || [];
        const isExcepted = exceptions.includes(date);

        if (isExcepted) {
          console.log('🚫 Filtering out block due to exception:', block.id, 'for date:', date);
        }

        return !isExcepted;
      }) || [];

      console.log('📅 Filtered regular blocks:', filteredBlocks.length);

      // Get exception records (hidden instances) for this date
      const { data: exceptions, error: exceptionsError } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', userId)
        .eq('selected_date', date)
        .eq('category', 'exception');

      if (exceptionsError) {
        console.error('❌ Error fetching exceptions:', exceptionsError);
        throw exceptionsError;
      }

      console.log('🚫 Exception records found:', exceptions?.length || 0);

      // Get repeating blocks that might appear on this date
      const { data: repeatingBlocks, error: repeatingError } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', userId)
        .not('repeat_rule', 'is', null)
        .neq('category', 'exception') // Exclude exception records
        .order('start_time');

      if (repeatingError) {
        console.error('❌ Error fetching repeating blocks:', repeatingError);
        throw repeatingError;
      }

      console.log('🔄 Repeating blocks found:', repeatingBlocks?.length || 0);

      // Expand repeating blocks for this specific date
      const expandedRepeatingBlocks = this.expandRepeatingBlocks(repeatingBlocks || [], date);

      // Filter out instances that have exceptions in their metadata
      const filteredExpandedBlocks = expandedRepeatingBlocks.filter(block => {
        // For virtual instances, find the original block to check exceptions
        const originalBlockId = block.id.includes('-') ? block.id.split('-').slice(0, 5).join('-') : block.id;
        const originalBlock = repeatingBlocks.find(rb => rb.id === originalBlockId);

        if (originalBlock) {
          const originalMetadata = originalBlock.metadata || {};
          const exceptions = originalMetadata.exceptions || [];
          const isHidden = exceptions.includes(block.selected_date);

          if (isHidden) {
            console.log('🚫 Filtering out hidden instance on', block.selected_date, 'due to exception in original block', originalBlockId);
          }
          return !isHidden;
        }

        // Fallback: check the block's own metadata
        const blockMetadata = block.metadata || {};
        const blockExceptions = blockMetadata.exceptions || [];
        const isHidden = blockExceptions.includes(block.selected_date);

        if (isHidden) {
          console.log('🚫 Filtering out hidden instance on', block.selected_date);
        }
        return !isHidden;
      });

      // Combine filtered regular blocks and filtered expanded repeating blocks (exclude exception records)
      const finalFilteredBlocks = filteredBlocks.filter(block => block.category !== 'exception');
      const allBlocks = [...finalFilteredBlocks, ...filteredExpandedBlocks];

      console.log('📊 Total blocks for', date, ':', allBlocks.length);
      return allBlocks;
    } catch (error) {
      console.error('❌ Error in getTimeBlocks:', error);
      throw error;
    }
  }

  // Helper method to expand repeating blocks for a specific date
  private static expandRepeatingBlocks(repeatingBlocks: TimeBlockApiEntry[], targetDate: string): TimeBlockApiEntry[] {
    const expandedBlocks: TimeBlockApiEntry[] = [];
    const targetDateObj = new Date(targetDate);

    console.log('🔍 Expanding blocks for target date:', targetDate);

    for (const block of repeatingBlocks) {
      console.log('🔍 Checking block:', block.id, 'repeat_rule:', block.repeat_rule);

      if (this.shouldBlockAppearOnDate(block, targetDate)) {
        console.log('✅ Block should appear on', targetDate);

        // Create a virtual instance for this date
        const virtualBlock: TimeBlockApiEntry = {
          ...block,
          id: `${block.id}-${targetDate}`, // Virtual ID for this instance
          selected_date: targetDate,
          // Update start_time and end_time to the target date
          start_time: this.adjustTimeToDate(block.start_time, targetDate),
          end_time: this.adjustTimeToDate(block.end_time, targetDate),
          // Virtual instances should reference the original's calendar event but with metadata
          calendar_event_id: block.calendar_event_id ? `${block.calendar_event_id}:${targetDate}` : undefined,
        };
        expandedBlocks.push(virtualBlock);
      } else {
        console.log('❌ Block should NOT appear on', targetDate);
      }
    }

    console.log('🔍 Total expanded blocks:', expandedBlocks.length);
    return expandedBlocks;
  }

  // Check if a repeating block should appear on a specific date
  private static shouldBlockAppearOnDate(block: TimeBlockApiEntry, targetDate: string): boolean {
    const originalDate = new Date(block.selected_date);
    const targetDateObj = new Date(targetDate);

    // Don't show on the original date (already handled by direct query)
    if (block.selected_date === targetDate) {
      return false;
    }

    // Check if target date is after original date
    if (targetDateObj <= originalDate) {
      return false;
    }

    // Extract repeat data from repeat_rule or direct fields
    const repeatRule = block.repeat_rule;
    const frequency = repeatRule?.frequency || block.repeat_frequency;
    const customFrequency = repeatRule?.customFrequency?.value || repeatRule?.customFrequency || block.repeat_custom_frequency || 1;

    if (!frequency || frequency === 'never') {
      return false;
    }

    // Check end date if specified (check repeat_until, repeat_end_date, and metadata.endDate)
    const endDateStr = block.repeat_until || block.repeat_end_date || (block.metadata && block.metadata.endDate);
    if (endDateStr) {
      const endDate = new Date(endDateStr);
      if (targetDateObj > endDate) {
        console.log('🚫 Filtering out recurring block due to end date:', block.id, 'target:', targetDate, 'end:', endDateStr);
        return false;
      }
    }

    const daysDiff = Math.floor((targetDateObj.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24));

    switch (frequency) {
      case 'daily':
        return daysDiff % customFrequency === 0;

      case 'weekly':
        return daysDiff % (7 * customFrequency) === 0;

      case 'monthly':
        // Same day of month
        return originalDate.getDate() === targetDateObj.getDate() &&
               this.isValidMonthlyRepeat(originalDate, targetDateObj, customFrequency);

      case 'yearly':
        // Same month and day
        return originalDate.getMonth() === targetDateObj.getMonth() &&
               originalDate.getDate() === targetDateObj.getDate() &&
               this.isValidYearlyRepeat(originalDate, targetDateObj, customFrequency);

      default:
        return false;
    }
  }

  // Helper to check valid monthly repeat
  private static isValidMonthlyRepeat(originalDate: Date, targetDate: Date, frequency: number): boolean {
    const monthsDiff = (targetDate.getFullYear() - originalDate.getFullYear()) * 12 +
                       (targetDate.getMonth() - originalDate.getMonth());
    return monthsDiff > 0 && monthsDiff % frequency === 0;
  }

  // Helper to check valid yearly repeat
  private static isValidYearlyRepeat(originalDate: Date, targetDate: Date, frequency: number): boolean {
    const yearsDiff = targetDate.getFullYear() - originalDate.getFullYear();
    return yearsDiff > 0 && yearsDiff % frequency === 0;
  }

  // Helper to adjust time to a specific date
  private static adjustTimeToDate(originalTime: string, targetDate: string): string {
    const originalDateTime = new Date(originalTime);
    const targetDateObj = new Date(targetDate);

    // Keep the same time but change the date
    const adjustedDateTime = new Date(
      targetDateObj.getFullYear(),
      targetDateObj.getMonth(),
      targetDateObj.getDate(),
      originalDateTime.getHours(),
      originalDateTime.getMinutes(),
      originalDateTime.getSeconds(),
      originalDateTime.getMilliseconds()
    );

    return adjustedDateTime.toISOString();
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
      .upsert({
        ...timeBlockWithTimestamps,
        description: timeBlockWithTimestamps.description,
      }, {
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

// src/services/api/journalApi.ts
import { supabase } from '../supabaseApi';

export interface JournalApiEntry {
  id: string;
  user_id: string;
  content_type: 'gratitude' | 'todo' | 'today_win' | 'looking_forward' | 'todays_focus';
  content: string;
  selected_date: string;
  created_at: string;
  updated_at: string;
  completed?: boolean;
  priority?: 'high' | 'medium' | 'low';
  metadata?: Record<string, any>;
}

export class JournalApi {
  // Get all journal entries for a user and date
  static async getJournalEntries(
    userId: string,
    date: string,
    contentType?: string
  ): Promise<JournalApiEntry[]> {
    let query = supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .order('created_at', { ascending: true });

    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching journal entries:', error);
      throw new Error(`Failed to fetch journal entries: ${error.message}`);
    }

    return data || [];
  }

  // Get gratitude entries
  static async getGratitudeEntries(userId: string, date: string): Promise<JournalApiEntry[]> {
    return this.getJournalEntries(userId, date, 'gratitude');
  }

  // Get todo entries
  static async getTodoEntries(userId: string, date: string): Promise<JournalApiEntry[]> {
    return this.getJournalEntries(userId, date, 'todo');
  }

  // Get today's focus entries
  static async getTodaysFocusEntries(userId: string, date: string): Promise<JournalApiEntry[]> {
    return this.getJournalEntries(userId, date, 'todays_focus');
  }

  // Get today's win entries
  static async getTodayWinEntries(userId: string, date: string): Promise<JournalApiEntry[]> {
    return this.getJournalEntries(userId, date, 'today_win');
  }

  // Get looking forward entries
  static async getLookingForwardEntries(userId: string, date: string): Promise<JournalApiEntry[]> {
    return this.getJournalEntries(userId, date, 'looking_forward');
  }

  // Create a new journal entry
  static async createJournalEntry(entry: Omit<JournalApiEntry, 'id' | 'created_at' | 'updated_at'>): Promise<JournalApiEntry> {
    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        ...entry,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating journal entry:', error);
      throw new Error(`Failed to create journal entry: ${error.message}`);
    }

    return data;
  }

  // Update a journal entry
  static async updateJournalEntry(
    id: string,
    updates: Partial<Omit<JournalApiEntry, 'id' | 'user_id' | 'created_at'>>
  ): Promise<JournalApiEntry> {


    // First check if there are duplicates and clean them up
    const { data: existingEntries } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', id)
      .order('created_at', { ascending: true });



    // Handle different scenarios
    if (!existingEntries || existingEntries.length === 0) {
      console.error('❌ No entries found with ID:', id);
      throw new Error(`No journal entry found with ID: ${id}`);
    }

    if (existingEntries.length > 1) {

      const [_keepEntry, ...duplicateEntries] = existingEntries;

      // Delete duplicates (but keep the first one)
      for (const duplicate of duplicateEntries) {
        const { error: deleteError } = await supabase
          .from('journal_entries')
          .delete()
          .eq('id', duplicate.id);

        if (deleteError) {
          console.error('❌ Error deleting duplicate:', deleteError);
        } else {

        }
      }

    } else {
    }

    // Verify the entry still exists before updating
    const { data: verifyEntries } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('id', id);



    if (!verifyEntries || verifyEntries.length === 0) {
      console.error('❌ No entry found to update after cleanup');
      throw new Error('Entry was deleted during cleanup process');
    }

    const { data, error } = await supabase
      .from('journal_entries')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating journal entry by ID:', error);
      console.error('❌ Update details:', { id, updates, verifyEntries });

      // Try fallback update using natural key if we have the necessary info
      if (existingEntries && existingEntries.length > 0) {
        const entry = existingEntries[0];


        const { data: fallbackData, error: fallbackError } = await supabase
          .from('journal_entries')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', entry.user_id)
          .eq('selected_date', entry.selected_date)
          .eq('content_type', entry.content_type)
          .select()
          .single();

        if (fallbackError) {
          console.error('❌ Fallback update also failed:', fallbackError);
          throw new Error(`Failed to update journal entry: ${error.message}`);
        }


        return fallbackData;
      }

      throw new Error(`Failed to update journal entry: ${error.message}`);
    }



    return data;
  }

  // Delete a journal entry
  static async deleteJournalEntry(id: string): Promise<void> {
    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting journal entry:', error);
      throw new Error(`Failed to delete journal entry: ${error.message}`);
    }
  }

  // Bulk operations for better performance
  static async createMultipleEntries(entries: Omit<JournalApiEntry, 'id' | 'created_at' | 'updated_at'>[]): Promise<JournalApiEntry[]> {
    const now = new Date().toISOString();
    const entriesWithTimestamps = entries.map(entry => ({
      ...entry,
      created_at: now,
      updated_at: now,
    }));

    const { data, error } = await supabase
      .from('journal_entries')
      .insert(entriesWithTimestamps)
      .select();

    if (error) {
      console.error('Error creating multiple journal entries:', error);
      throw new Error(`Failed to create journal entries: ${error.message}`);
    }

    return data || [];
  }

  // Get entries across multiple dates (for analytics/trends)
  static async getEntriesInDateRange(
    userId: string,
    startDate: string,
    endDate: string,
    contentType?: string
  ): Promise<JournalApiEntry[]> {
    let query = supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('selected_date', startDate)
      .lte('selected_date', endDate)
      .order('selected_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching journal entries in date range:', error);
      throw new Error(`Failed to fetch journal entries: ${error.message}`);
    }

    return data || [];
  }
}

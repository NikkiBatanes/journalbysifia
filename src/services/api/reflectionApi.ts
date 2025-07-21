// src/services/api/reflectionApi.ts
import { supabase } from '../supabaseApi';

export interface ReflectionApiEntry {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: 'free' | 'guided';
  selected_date: string;
  created_at: string;
  updated_at: string;
  source?: 'devotional';
  devotional_title?: string;
  day_number?: number;
  day_title?: string;
  total_days?: number;
  question_number?: number;
  question_text?: string;
}

export class ReflectionApi {
  // Get all reflection entries for a user and date
  static async getReflectionEntries(userId: string, date: string): Promise<ReflectionApiEntry[]> {
    const { data, error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reflection entries:', error);
      throw new Error(`Failed to fetch reflection entries: ${error.message}`);
    }

    return data || [];
  }

  // Get reflection entries by type
  static async getReflectionsByType(
    userId: string, 
    date: string, 
    type: 'free' | 'guided'
  ): Promise<ReflectionApiEntry[]> {
    const { data, error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reflection entries by type:', error);
      throw new Error(`Failed to fetch reflection entries: ${error.message}`);
    }

    return data || [];
  }

  // Get devotional reflections
  static async getDevotionalReflections(userId: string, date: string): Promise<ReflectionApiEntry[]> {
    const { data, error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .eq('source', 'devotional')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching devotional reflections:', error);
      throw new Error(`Failed to fetch devotional reflections: ${error.message}`);
    }

    return data || [];
  }

  // Create a new reflection entry
  static async createReflectionEntry(
    entry: Omit<ReflectionApiEntry, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ReflectionApiEntry> {
    const now = new Date().toISOString();
    const entryWithTimestamps = {
      ...entry,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('reflection_entries')
      .insert(entryWithTimestamps)
      .select()
      .single();

    if (error) {
      console.error('Error creating reflection entry:', error);
      throw new Error(`Failed to create reflection entry: ${error.message}`);
    }

    return data;
  }

  // Update a reflection entry
  static async updateReflectionEntry(
    id: string,
    updates: Partial<Omit<ReflectionApiEntry, 'id' | 'user_id' | 'created_at'>>
  ): Promise<ReflectionApiEntry> {
    const { data, error } = await supabase
      .from('reflection_entries')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating reflection entry:', error);
      throw new Error(`Failed to update reflection entry: ${error.message}`);
    }

    return data;
  }

  // Delete a reflection entry
  static async deleteReflectionEntry(id: string): Promise<void> {
    const { error } = await supabase
      .from('reflection_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting reflection entry:', error);
      throw new Error(`Failed to delete reflection entry: ${error.message}`);
    }
  }

  // Get reflections across multiple dates
  static async getReflectionsInDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<ReflectionApiEntry[]> {
    const { data, error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('selected_date', startDate)
      .lte('selected_date', endDate)
      .order('selected_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reflections in date range:', error);
      throw new Error(`Failed to fetch reflections: ${error.message}`);
    }

    return data || [];
  }

  // Search reflections by content
  static async searchReflections(
    userId: string,
    searchTerm: string,
    limit: number = 20
  ): Promise<ReflectionApiEntry[]> {
    const { data, error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error searching reflections:', error);
      throw new Error(`Failed to search reflections: ${error.message}`);
    }

    return data || [];
  }

  // Get reflection statistics
  static async getReflectionStats(userId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('reflection_entries')
      .select('type, source, created_at')
      .eq('user_id', userId)
      .gte('selected_date', startDate)
      .lte('selected_date', endDate);

    if (error) {
      console.error('Error fetching reflection stats:', error);
      throw new Error(`Failed to fetch reflection stats: ${error.message}`);
    }

    const stats = {
      total: data?.length || 0,
      free: data?.filter(r => r.type === 'free').length || 0,
      guided: data?.filter(r => r.type === 'guided').length || 0,
      devotional: data?.filter(r => r.source === 'devotional').length || 0,
    };

    return stats;
  }
}

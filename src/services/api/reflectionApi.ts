// src/services/api/reflectionApi.ts
import { supabase } from '../supabaseClient';

export interface ReflectionApiEntry {
  id: string;
  user_id: string;
  title?: string; // Optional in database
  content: string;
  type: string; // Can be 'free', 'guided', 'devotional', 'playbook', etc.
  selected_date: string; // timestamp with time zone as string
  created_at: string;
  updated_at: string;
  is_deleted?: boolean; // Optional with default false in database
  // Additional fields from migration
  prompt?: string;
  tags?: string[]; // ARRAY type in database
  source?: string;
  devotional_title?: string;
  day_number?: number;
  day_title?: string;
  total_days?: number;
  question_number?: number;
  // Playbook-specific fields
  playbook_title?: string;
  playbook_id?: string;
  subtask_id?: string;
}

export class ReflectionApi {
  // Get all reflection entries for a user and date
  static async getReflectionEntries(userId: string, date: string): Promise<ReflectionApiEntry[]> {
    console.log('🔍 ReflectionApi: getReflectionEntries called with userId:', userId, 'date:', date);
    const { data, error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .order('created_at', { ascending: false });

    console.log('🔍 ReflectionApi: getReflectionEntries response - data:', data?.length, 'entries');
    console.log('🔍 ReflectionApi: getReflectionEntries response - error:', error);
    console.log('🔍 ReflectionApi: getReflectionEntries response - full data:', data);

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

  // Get playbook reflections
  static async getPlaybookReflections(userId: string, date: string): Promise<ReflectionApiEntry[]> {
    const { data, error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .eq('type', 'playbook')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching playbook reflections:', error);
      throw new Error(`Failed to fetch playbook reflections: ${error.message}`);
    }

    return data || [];
  }

  // Get reflections by playbook ID
  static async getReflectionsByPlaybook(userId: string, playbookId: string): Promise<ReflectionApiEntry[]> {
    const { data, error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('playbook_id', playbookId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reflections by playbook:', error);
      throw new Error(`Failed to fetch reflections by playbook: ${error.message}`);
    }

    return data || [];
  }

  // Get reflection by subtask ID
  static async getReflectionBySubtask(userId: string, subtaskId: string): Promise<ReflectionApiEntry | null> {
    console.log('🔍 ReflectionApi: getReflectionBySubtask called with:', {
      userId,
      subtaskId,
      subtaskIdType: typeof subtaskId,
      subtaskIdLength: subtaskId?.length,
    });

    const { data, error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('subtask_id', subtaskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('🔍 ReflectionApi: getReflectionBySubtask response:', {
      data,
      error,
      hasData: !!data,
    });

    if (error) {
      // If no reflection found, return null instead of throwing error
      if (error.code === 'PGRST116') {
        console.log('🔍 ReflectionApi: No reflection found for subtask:', subtaskId);

        // Try fallback query by user_id and type to see if there are any playbook reflections
        console.log('🔍 ReflectionApi: Attempting fallback query for debugging...');
        try {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('reflection_entries')
            .select('*')
            .eq('user_id', userId)
            .eq('type', 'playbook')
            .order('created_at', { ascending: false })
            .limit(5);

          console.log('🔍 ReflectionApi: Fallback query results:', {
            count: fallbackData?.length || 0,
            reflections: fallbackData?.map(r => ({
              id: r.id,
              subtask_id: r.subtask_id,
              playbook_title: r.playbook_title,
              title: r.title,
            })) || [],
            error: fallbackError,
          });
        } catch (fallbackErr) {
          console.log('🔍 ReflectionApi: Fallback query failed:', fallbackErr);
        }

        return null;
      }
      console.error('Error fetching reflection by subtask:', error);
      throw new Error(`Failed to fetch reflection by subtask: ${error.message}`);
    }

    console.log('🔍 ReflectionApi: Found reflection for subtask:', {
      subtaskId,
      reflectionId: data?.id,
      reflectionTitle: data?.title,
      reflectionContent: data?.content?.substring(0, 50) + '...',
    });

    return data;
  }

  // Create a new reflection entry
  static async createReflectionEntry(
    entry: Omit<ReflectionApiEntry, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ReflectionApiEntry> {
    console.log('🔍 ReflectionApi: createReflectionEntry called with:', entry);
    const now = new Date().toISOString();
    const entryWithTimestamps = {
      ...entry,
      created_at: now,
      updated_at: now,
    };
    console.log('🔍 ReflectionApi: About to insert into database:', entryWithTimestamps);

    const { data, error } = await supabase
      .from('reflection_entries')
      .insert(entryWithTimestamps)
      .select()
      .single();

    console.log('🔍 ReflectionApi: Database response - data:', data);
    console.log('🔍 ReflectionApi: Database response - error:', error);

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
    console.log('🗑️ ReflectionApi: Starting delete for reflection:', id);

    try {
      const { error } = await supabase
        .from('reflection_entries')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ ReflectionApi: Error deleting reflection entry:', error);
        throw new Error(`Failed to delete reflection entry: ${error.message}`);
      }

      console.log('✅ ReflectionApi: Successfully deleted reflection:', id);
    } catch (err) {
      console.error('❌ ReflectionApi: Exception during delete:', err);
      throw err;
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

  // Get paginated reflections for infinite scrolling
  static async getPaginatedReflections(
    userId: string,
    page: number = 0,
    pageSize: number = 20
  ): Promise<ReflectionApiEntry[]> {
    const { data, error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .order('selected_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching paginated reflections:', error);
      throw new Error(`Failed to fetch reflections: ${error.message}`);
    }

    return data || [];
  }

  // Batch operations for offline sync
  static async batchCreateReflections(
    entries: Omit<ReflectionApiEntry, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<ReflectionApiEntry[]> {
    const now = new Date().toISOString();
    const entriesWithTimestamps = entries.map(entry => ({
      ...entry,
      created_at: now,
      updated_at: now,
    }));

    const { data, error } = await supabase
      .from('reflection_entries')
      .insert(entriesWithTimestamps)
      .select();

    if (error) {
      console.error('Error batch creating reflections:', error);
      throw new Error(`Failed to create reflections: ${error.message}`);
    }

    return data || [];
  }

  // Get reflections count for a user
  static async getReflectionsCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('reflection_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching reflections count:', error);
      throw new Error(`Failed to fetch reflections count: ${error.message}`);
    }

    return count || 0;
  }
}

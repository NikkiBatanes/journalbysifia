// src/services/api/reflectionApi.clean.ts
import { supabase } from '../supabaseClient';
import { Logger } from '../../utils/ProductionLogger';

export interface ReflectionApiEntry {
  id: string;
  user_id: string;
  title?: string;
  content: string;
  type: string;
  selected_date: string;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
  prompt?: string;
  tags?: string[];
  source?: string;
  devotional_title?: string;
  devotional_id?: string;
  day_number?: number;
  day_title?: string;
  total_days?: number;
  question_number?: number;
  question_text?: string;
  playbook_title?: string;
  playbook_id?: string;
  subtask_id?: string;
}

export interface SearchReflectionsOptions {
  searchTerm?: string;
  devotionalId?: string;
  dayNumber?: number;
  questionNumber?: number;
  limit?: number;
  userId: string;
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
      Logger.error('Error fetching reflection entries', error as Error, {
      component: 'reflectionApi',
    });
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
      Logger.error('Error fetching reflection entries by type', error as Error, {
      component: 'reflectionApi',
    });
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
      Logger.error('Error fetching devotional reflections', error as Error, {
      component: 'reflectionApi',
    });
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
      Logger.error('Error fetching playbook reflections', error as Error, {
      component: 'reflectionApi',
    });
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
      Logger.error('Error fetching reflections by playbook', error as Error, {
      component: 'reflectionApi',
    });
      throw new Error(`Failed to fetch reflections by playbook: ${error.message}`);
    }

    return data || [];
  }

  // Get reflection by subtask ID
  static async getReflectionBySubtask(userId: string, subtaskId: string): Promise<ReflectionApiEntry | null> {
    const { data, error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('subtask_id', subtaskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      Logger.error('Error fetching reflection by subtask', error as Error, {
      component: 'reflectionApi',
    });
      throw new Error(`Failed to fetch reflection by subtask: ${error.message}`);
    }

    return data;
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
      Logger.error('Error creating reflection entry', new Error(error.message || JSON.stringify(error)), {
      component: 'reflectionApi',
      errorDetails: error,
      entry: entryWithTimestamps,
    });
      throw new Error(`Failed to create reflection entry: ${error.message}`);
    }

    return data;
  }

  // Update an existing reflection entry (preserves original created_at)
  static async updateReflectionEntry(
    id: string,
    updates: Partial<Omit<ReflectionApiEntry, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<ReflectionApiEntry> {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('reflection_entries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      Logger.error('Error updating reflection entry', error as Error, {
      component: 'reflectionApi',
    });
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
      Logger.error('Error deleting reflection entry', error as Error, {
      component: 'reflectionApi',
    });
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
      Logger.error('Error fetching reflections in date range', error as Error, {
      component: 'reflectionApi',
    });
      throw new Error(`Failed to fetch reflections: ${error.message}`);
    }

    return data || [];
  }

  // Search reflections with various filters
  static async searchReflections(options: SearchReflectionsOptions): Promise<ReflectionApiEntry[]> {
    const { searchTerm, devotionalId, dayNumber, questionNumber, limit = 10, userId } = options;

    let query = supabase
      .from('reflection_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (searchTerm) {
      query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
    }

    if (devotionalId) {
      query = query.eq('devotional_id', devotionalId);
    }

    if (dayNumber !== undefined) {
      query = query.eq('day_number', dayNumber);
    }

    if (questionNumber !== undefined) {
      query = query.eq('question_number', questionNumber);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      Logger.error('Error searching reflections', error as Error, {
      component: 'reflectionApi',
    });
      throw new Error(`Failed to search reflections: ${error.message}`);
    }

    return data || [];
  }

  // Get reflection statistics
  static async getReflectionStats(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<{ total: number; free: number; guided: number; devotional: number }> {
    const { data, error } = await supabase
      .from('reflection_entries')
      .select('type, source, created_at')
      .eq('user_id', userId)
      .gte('selected_date', startDate)
      .lte('selected_date', endDate);

    if (error) {
      Logger.error('Error fetching reflection stats', error as Error, {
      component: 'reflectionApi',
    });
      throw new Error(`Failed to fetch reflection stats: ${error.message}`);
    }

    return {
      total: data?.length || 0,
      free: data?.filter(r => r.type === 'free').length || 0,
      guided: data?.filter(r => r.type === 'guided').length || 0,
      devotional: data?.filter(r => r.source === 'devotional').length || 0,
    };
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
      Logger.error('Error fetching paginated reflections', error as Error, {
      component: 'reflectionApi',
    });
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
      Logger.error('Error batch creating reflections', error as Error, {
      component: 'reflectionApi',
    });
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
      Logger.error('Error getting reflections count', error as Error, {
      component: 'reflectionApi',
    });
      throw new Error(`Failed to get reflections count: ${error.message}`);
    }

    return count || 0;
  }

  // Get reflection by ID
  static async getReflectionById(id: string): Promise<ReflectionApiEntry | null> {
    const { data, error } = await supabase
      .from('reflection_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      Logger.error('Error fetching reflection by ID', error as Error, {
      component: 'reflectionApi',
    });
      return null;
    }

    return data;
  }
}

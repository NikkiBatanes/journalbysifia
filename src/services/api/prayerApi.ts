// src/services/api/prayerApi.ts
import { supabase } from '../supabaseApi';

export interface PrayerApiEntry {
  id: string;
  user_id: string;
  type: 'adoration' | 'confession' | 'thanksgiving' | 'supplication' | 'people' | 'devotional';
  content: string;
  selected_date: string;
  created_at: string;
  updated_at: string;
  is_answered?: boolean;
  person_name?: string;
  is_request?: boolean;
  is_prayed?: boolean;
  devotional_title?: string;
  day_number?: number;
  day_title?: string;
  total_days?: number;
}

export class PrayerApi {
  // Get all prayers for a user and date
  static async getPrayers(userId: string, date: string): Promise<PrayerApiEntry[]> {
    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching prayers:', error);
      throw new Error(`Failed to fetch prayers: ${error.message}`);
    }

    return data || [];
  }

  // Get prayers by type
  static async getPrayersByType(
    userId: string,
    date: string,
    type: PrayerApiEntry['type']
  ): Promise<PrayerApiEntry[]> {
    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching prayers by type:', error);
      throw new Error(`Failed to fetch prayers: ${error.message}`);
    }

    return data || [];
  }

  // Get ACTS prayers (Adoration, Confession, Thanksgiving, Supplication)
  static async getACTSPrayers(userId: string, date: string): Promise<{
    adoration: PrayerApiEntry[];
    confession: PrayerApiEntry[];
    thanksgiving: PrayerApiEntry[];
    supplication: PrayerApiEntry[];
  }> {
    const prayers = await this.getPrayers(userId, date);
    
    return {
      adoration: prayers.filter(p => p.type === 'adoration'),
      confession: prayers.filter(p => p.type === 'confession'),
      thanksgiving: prayers.filter(p => p.type === 'thanksgiving'),
      supplication: prayers.filter(p => p.type === 'supplication'),
    };
  }

  // Get people prayers
  static async getPeoplePrayers(userId: string, date: string): Promise<PrayerApiEntry[]> {
    return this.getPrayersByType(userId, date, 'people');
  }

  // Get devotional prayers
  static async getDevotionalPrayers(userId: string, date: string): Promise<PrayerApiEntry[]> {
    return this.getPrayersByType(userId, date, 'devotional');
  }

  // Get all devotional prayers for a user (for prayedItems display)
  static async getAllDevotionalPrayers(userId: string): Promise<PrayerApiEntry[]> {
    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'devotional')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all devotional prayers:', error);
      throw new Error(`Failed to fetch devotional prayers: ${error.message}`);
    }

    return data || [];
  }

  // Create a new prayer
  static async createPrayer(
    prayer: Omit<PrayerApiEntry, 'id' | 'created_at' | 'updated_at'>
  ): Promise<PrayerApiEntry> {
    const now = new Date().toISOString();
    const prayerWithTimestamps = {
      ...prayer,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('prayers')
      .insert(prayerWithTimestamps)
      .select()
      .single();

    if (error) {
      console.error('Error creating prayer:', error);
      throw new Error(`Failed to create prayer: ${error.message}`);
    }

    return data;
  }

  // Update a prayer
  static async updatePrayer(
    id: string,
    updates: Partial<Omit<PrayerApiEntry, 'id' | 'user_id' | 'created_at'>>
  ): Promise<PrayerApiEntry> {
    const { data, error } = await supabase
      .from('prayers')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating prayer:', error);
      throw new Error(`Failed to update prayer: ${error.message}`);
    }

    return data;
  }

  // Delete a prayer
  static async deletePrayer(id: string): Promise<void> {
    const { error } = await supabase
      .from('prayers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting prayer:', error);
      throw new Error(`Failed to delete prayer: ${error.message}`);
    }
  }

  // Mark supplication as answered
  static async markSupplicationAnswered(id: string, isAnswered: boolean): Promise<PrayerApiEntry> {
    return this.updatePrayer(id, { is_answered: isAnswered });
  }

  // Mark prayer request as prayed
  static async markPrayerRequestPrayed(id: string, isPrayed: boolean): Promise<PrayerApiEntry> {
    return this.updatePrayer(id, { is_prayed: isPrayed });
  }

  // Get prayers across multiple dates
  static async getPrayersInDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<PrayerApiEntry[]> {
    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .gte('selected_date', startDate)
      .lte('selected_date', endDate)
      .order('selected_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching prayers in date range:', error);
      throw new Error(`Failed to fetch prayers: ${error.message}`);
    }

    return data || [];
  }

  // Search prayers by content
  static async searchPrayers(
    userId: string,
    searchTerm: string,
    limit: number = 20
  ): Promise<PrayerApiEntry[]> {
    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .ilike('content', `%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error searching prayers:', error);
      throw new Error(`Failed to search prayers: ${error.message}`);
    }

    return data || [];
  }

  // Get prayer statistics
  static async getPrayerStats(userId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('prayers')
      .select('type, is_answered, created_at')
      .eq('user_id', userId)
      .gte('selected_date', startDate)
      .lte('selected_date', endDate);

    if (error) {
      console.error('Error fetching prayer stats:', error);
      throw new Error(`Failed to fetch prayer stats: ${error.message}`);
    }

    const stats = {
      total: data?.length || 0,
      adoration: data?.filter(p => p.type === 'adoration').length || 0,
      confession: data?.filter(p => p.type === 'confession').length || 0,
      thanksgiving: data?.filter(p => p.type === 'thanksgiving').length || 0,
      supplication: data?.filter(p => p.type === 'supplication').length || 0,
      people: data?.filter(p => p.type === 'people').length || 0,
      devotional: data?.filter(p => p.type === 'devotional').length || 0,
      answered: data?.filter(p => p.is_answered === true).length || 0,
    };

    return stats;
  }
}

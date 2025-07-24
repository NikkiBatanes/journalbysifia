// src/services/api/prayerApi.ts
import { supabase } from '../supabaseApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PrayerApiEntry {
  id: string;
  user_id: string;
  prayer_type: 'journal' | 'people' | 'devotional';
  journal_category?: 'adoration' | 'confession' | 'thanksgiving' | 'supplication';
  content: string;
  selected_date: string;
  created_at: string;
  updated_at: string;
  status?: 'pending' | 'answered';
  answered_date?: string;
  person_name?: string;
  is_prayer_request?: boolean;
  requested_by?: string;
  prayed?: boolean;
  notes?: string;
  devotional_title?: string;
  day_number?: number;
  day_title?: string;
  total_days?: number;
  // Legacy compatibility - computed fields
  type?: 'adoration' | 'confession' | 'thanksgiving' | 'supplication' | 'people' | 'devotional';
  is_answered?: boolean;
  is_request?: boolean;
  is_prayed?: boolean;
}

// Helper function to ensure Supabase is authenticated
const ensureAuthenticated = async () => {
  try {
    const accessToken = await AsyncStorage.getItem('ACCESS_TOKEN');
    const user = await AsyncStorage.getItem('USER');

    if (accessToken && user) {
      const userData = JSON.parse(user);
      // Set the session in Supabase client
      const refreshToken = await AsyncStorage.getItem('REFRESH_TOKEN') || '';
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      console.log('Supabase session set for user:', userData.id);
    } else {
      console.warn('No authentication tokens found');
    }
  } catch (error) {
    console.error('Error setting Supabase session:', error);
  }
};

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
      .eq('prayer_type', type)
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
    // Ensure Supabase is authenticated
    await ensureAuthenticated();

    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .eq('prayer_type', 'journal')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching ACTS prayers:', error);
      throw new Error(`Failed to fetch ACTS prayers: ${error.message}`);
    }

    const prayers = (data || []).map(prayer => ({
      ...prayer,
      // Add legacy compatibility fields
      type: prayer.journal_category || (prayer.prayer_type === 'people' ? 'people' : 'devotional'),
      is_answered: prayer.status === 'answered',
      is_request: prayer.is_prayer_request,
      is_prayed: prayer.prayed,
    })) as PrayerApiEntry[];

    return {
      adoration: prayers.filter(p => p.journal_category === 'adoration'),
      confession: prayers.filter(p => p.journal_category === 'confession'),
      thanksgiving: prayers.filter(p => p.journal_category === 'thanksgiving'),
      supplication: prayers.filter(p => p.journal_category === 'supplication'),
    };
  }

  // Get people prayers
  static async getPeoplePrayers(userId: string, date: string): Promise<PrayerApiEntry[]> {
    await ensureAuthenticated();
    
    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .eq('prayer_type', 'people')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching people prayers:', error);
      throw new Error(`Failed to fetch people prayers: ${error.message}`);
    }

    return data || [];
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
    // Ensure Supabase is authenticated
    await ensureAuthenticated();

    const now = new Date().toISOString();

    // Transform legacy format to database format
    const dbPrayer: any = {
      user_id: prayer.user_id,
      content: prayer.content,
      selected_date: prayer.selected_date,
      prayer_type: prayer.prayer_type || (prayer.type === 'people' ? 'people' :
                   prayer.type === 'devotional' ? 'devotional' : 'journal'),
      journal_category: prayer.journal_category || (
        ['adoration', 'confession', 'thanksgiving', 'supplication'].includes(prayer.type || '')
          ? prayer.type as 'adoration' | 'confession' | 'thanksgiving' | 'supplication'
          : null
      ),
      status: prayer.status || (prayer.is_answered ? 'answered' : 'pending'),
      person_name: prayer.person_name || null,
      is_prayer_request: prayer.is_prayer_request || prayer.is_request || null,
      prayed: prayer.prayed || prayer.is_prayed || null,
      devotional_title: prayer.devotional_title || null,
      day_number: prayer.day_number || null,
      day_title: prayer.day_title || null,
      total_days: prayer.total_days || null,
      created_at: now,
      updated_at: now,
    };

    // Add optional fields if they exist in the prayer object
    if (prayer.requested_by !== undefined) {
      dbPrayer.requested_by = prayer.requested_by;
    }
    if (prayer.notes !== undefined) {
      dbPrayer.notes = prayer.notes;
    }

    const { data, error } = await supabase
      .from('prayers')
      .insert(dbPrayer)
      .select()
      .single();

    if (error) {
      console.error('Error creating prayer:', error);
      throw new Error(`Failed to create prayer: ${error.message}`);
    }

    // Transform back to API format
    return {
      ...data,
      type: data.journal_category || (data.prayer_type === 'people' ? 'people' : 'devotional'),
      is_answered: data.status === 'answered',
      is_request: data.is_prayer_request,
      is_prayed: data.prayed,
    } as PrayerApiEntry;
  }

  // Update a prayer
  static async updatePrayer(
    id: string,
    updates: Partial<Omit<PrayerApiEntry, 'id' | 'user_id' | 'created_at'>>
  ): Promise<PrayerApiEntry> {
    // Ensure Supabase is authenticated
    await ensureAuthenticated();

    // Transform API format to database format
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    };

    // Map API fields to database fields
    if (updates.content !== undefined) {dbUpdates.content = updates.content;}
    if (updates.selected_date !== undefined) {dbUpdates.selected_date = updates.selected_date;}
    if (updates.status !== undefined) {dbUpdates.status = updates.status;}
    if (updates.answered_date !== undefined) {dbUpdates.answered_date = updates.answered_date;}
    if (updates.person_name !== undefined) {dbUpdates.person_name = updates.person_name;}
    if (updates.is_prayer_request !== undefined) {dbUpdates.is_prayer_request = updates.is_prayer_request;}
    if (updates.prayed !== undefined) {dbUpdates.prayed = updates.prayed;}
    if (updates.devotional_title !== undefined) {dbUpdates.devotional_title = updates.devotional_title;}
    if (updates.day_number !== undefined) {dbUpdates.day_number = updates.day_number;}
    if (updates.day_title !== undefined) {dbUpdates.day_title = updates.day_title;}
    if (updates.total_days !== undefined) {dbUpdates.total_days = updates.total_days;}
    if (updates.journal_category !== undefined) {dbUpdates.journal_category = updates.journal_category;}
    if (updates.prayer_type !== undefined) {dbUpdates.prayer_type = updates.prayer_type;}

    const { data, error } = await supabase
      .from('prayers')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating prayer:', error);
      throw new Error(`Failed to update prayer: ${error.message}`);
    }

    // Transform back to API format
    return {
      ...data,
      type: data.journal_category || (data.prayer_type === 'people' ? 'people' : 'devotional'),
      is_answered: data.status === 'answered',
      is_request: data.is_prayer_request,
      is_prayed: data.prayed,
    } as PrayerApiEntry;
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
    return this.updatePrayer(id, {
      status: isAnswered ? 'answered' : 'pending',
      answered_date: isAnswered ? new Date().toISOString() : undefined,
      is_answered: isAnswered,
    });
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

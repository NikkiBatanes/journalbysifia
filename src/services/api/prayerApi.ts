// src/services/api/prayerApi.ts
import { supabase } from '../supabaseClient';
import { Logger } from '../../utils/ProductionLogger';
import { toLocalDateString } from '../../utils/date';

export interface PrayerApiEntry {
  id: string;
  user_id: string;
  prayer_type: 'journal' | 'people' | 'devotional' | 'guided_playbook';
  journal_category?: 'adoration' | 'confession' | 'thanksgiving' | 'supplication' | 'personal_prayer';
  content: string;
  metadata?: Record<string, any>;
  selected_date: string;
  created_at: string;
  updated_at: string;
  status?: 'pending' | 'answered';
  answered_date?: string | null;
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
  type?: 'adoration' | 'confession' | 'thanksgiving' | 'supplication' | 'people' | 'devotional' | 'freeform';
  is_answered?: boolean;
  is_request?: boolean;
  is_prayed?: boolean;
}

/**
 * Robust session retrieval with retry logic
 * Handles race conditions during operation protection periods
 */
async function getSessionWithRetry(retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        Logger.warn(`Prayer API session retrieval error (attempt ${i + 1}/${retries}):`, {
      component: 'prayerApi',
      error: sessionError,
    });
        if (i === retries - 1) {throw sessionError;}
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        continue;
      }

      if (!session) {
        Logger.warn(`Prayer API no session found (attempt ${i + 1}/${retries})`, {
      component: 'prayerApi',
    });
        if (i === retries - 1) {
          // Final attempt - try to refresh session
          try {
            const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
            if (refreshedSession) {

              return refreshedSession;
            }
          } catch (refreshError) {
            Logger.error('❌ Prayer API session refresh failed', refreshError as Error, {
      component: 'prayerApi',
      action: 'error',
    });
          }
          throw new Error('No active session. Please login.');
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }

      return session;
    } catch (error) {
      Logger.error(`Prayer API session retrieval failed (attempt ${i + 1}/${retries}):`, error as Error, {
      component: 'prayerApi',
      action: 'error',
    });
      if (i === retries - 1) {throw error;}
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  throw new Error('No active session. Please login.');
}

// Helper function to ensure Supabase is authenticated with robust session handling
const ensureAuthenticated = async () => {
  try {
    const session = await getSessionWithRetry();

    if (!session?.access_token) {
      throw new Error('Invalid authentication token. Please login again.');
    }

    return session;
  } catch (error) {
    Logger.error('Error setting Supabase session', error as Error, {
      component: 'prayerApi',
      action: 'error',
    });
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
      Logger.error('Error fetching prayers', error as Error, {
      component: 'prayerApi',
      action: 'error',
    });
      throw new Error(`Failed to fetch prayers: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all unprayed prayer requests for a user (no date restriction)
   * Criteria: is_prayer_request = true AND prayed != true
   */
  static async getUnprayedPrayerRequests(userId: string): Promise<PrayerApiEntry[]> {
    const session = await ensureAuthenticated();

    if (userId !== session.user.id) {
      Logger.warn('Prayer query user_id mismatch, correcting for RLS compliance', {
        component: 'prayerApi',
        provided: userId,
        authenticated: session.user.id,
      });
      userId = session.user.id;
    }

    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .eq('is_prayer_request', true)
      .or('prayed.is.null,prayed.eq.false')
      .order('created_at', { ascending: false });

    if (error) {
      Logger.error('Error fetching unprayed prayer requests', error as Error, {
      component: 'prayerApi',
      action: 'error',
    });
      throw new Error(`Failed to fetch unprayed prayer requests: ${error.message}`);
    }

    return (data || []).map((p) => ({
      ...p,
      type: p.journal_category || (p.prayer_type === 'people' ? 'people' : 'devotional'),
      is_answered: p.status === 'answered',
      is_request: p.is_prayer_request,
      is_prayed: p.prayed,
    })) as PrayerApiEntry[];
  }

  // Get prayers by type
  static async getPrayersByType(
    userId: string,
    date: string,
    type: PrayerApiEntry['type']
  ): Promise<PrayerApiEntry[]> {
    const session = await ensureAuthenticated();

    // Ensure userId matches authenticated user for RLS compliance
    if (userId !== session.user.id) {
      Logger.warn('Prayer query user_id mismatch, correcting for RLS compliance', {
        component: 'prayerApi',
        provided: userId,
        authenticated: session.user.id,
      });
      userId = session.user.id;
    }

    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .eq('prayer_type', type)
      .order('created_at', { ascending: false });

    if (error) {
      Logger.error('Error fetching prayers by type', error as Error, {
      component: 'prayerApi',
      action: 'error',
    });
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
    freeform: PrayerApiEntry[];
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
      Logger.error('Error fetching ACTS prayers', error as Error, {
      component: 'prayerApi',
      action: 'error',
    });
      throw new Error(`Failed to fetch ACTS prayers: ${error.message}`);
    }

    const prayers = (data || []).map(prayer => ({
      ...prayer,
      // Add legacy compatibility fields - check if it's a freeform prayer by looking at content pattern or use a custom field
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
      freeform: prayers.filter(p => p.journal_category === 'personal_prayer'),
    };
  }

  // Get people prayers
  static async getPeoplePrayers(userId: string, date: string): Promise<PrayerApiEntry[]> {
    const session = await ensureAuthenticated();

    // Ensure userId matches authenticated user for RLS compliance
    if (userId !== session.user.id) {
      Logger.warn('Prayer query user_id mismatch, correcting for RLS compliance', {
        component: 'prayerApi',
        provided: userId,
        authenticated: session.user.id,
      });
      userId = session.user.id;
    }

    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .eq('prayer_type', 'people')
      .order('created_at', { ascending: false });

    if (error) {
      Logger.error('Error fetching people prayers', error as Error, {
      component: 'prayerApi',
      action: 'error',
    });
      throw new Error(`Failed to fetch people prayers: ${error.message}`);
    }

    return data || [];
  }

  // Get devotional prayers
  static async getDevotionalPrayers(userId: string, date: string): Promise<PrayerApiEntry[]> {
    const session = await ensureAuthenticated();

    // Ensure userId matches authenticated user for RLS compliance
    if (userId !== session.user.id) {
      Logger.warn('Prayer query user_id mismatch, correcting for RLS compliance', {
        component: 'prayerApi',
        provided: userId,
        authenticated: session.user.id,
      });
      userId = session.user.id;
    }

    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .eq('selected_date', date)
      .in('prayer_type', ['devotional', 'guided_playbook'])
      .order('created_at', { ascending: false });

    if (error) {
      Logger.error('Error fetching devotional prayers', error as Error, {
        component: 'prayerApi',
        action: 'error',
      });
      throw new Error(`Failed to fetch devotional prayers: ${error.message}`);
    }

    return data || [];
  }

  // Get all devotional prayers for a user (for prayedItems display)
  static async getAllDevotionalPrayers(userId: string): Promise<PrayerApiEntry[]> {
    const session = await ensureAuthenticated();

    // Ensure userId matches authenticated user for RLS compliance
    if (userId !== session.user.id) {
      Logger.warn('Prayer query user_id mismatch, correcting for RLS compliance', {
        component: 'prayerApi',
        provided: userId,
        authenticated: session.user.id,
      });
      userId = session.user.id;
    }

    const { data, error } = await supabase
      .from('prayers')
      .select('*')
      .eq('user_id', userId)
      .in('prayer_type', ['devotional', 'guided_playbook'])
      .order('created_at', { ascending: false });

    if (error) {
      Logger.error('Error fetching all devotional prayers', error as Error, {
      component: 'prayerApi',
      action: 'error',
    });
      throw new Error(`Failed to fetch devotional prayers: ${error.message}`);
    }

    return data || [];
  }

  // Create a new prayer
  static async createPrayer(
    prayer: Omit<PrayerApiEntry, 'id' | 'created_at' | 'updated_at'>
  ): Promise<PrayerApiEntry> {
    // Ensure Supabase is authenticated with robust session handling
    const session = await ensureAuthenticated();

    // Ensure user_id matches the authenticated user for RLS compliance
    if (prayer.user_id !== session.user.id) {
      Logger.warn('Prayer user_id mismatch, correcting for RLS compliance', {
        component: 'prayerApi',
        provided: prayer.user_id,
        authenticated: session.user.id,
      });
      prayer.user_id = session.user.id;
    }

    const now = new Date().toISOString();

    // Transform legacy format to database format
    const dbPrayer: any = {
      user_id: prayer.user_id,
      content: prayer.content,
      metadata: prayer.metadata ?? null,
      selected_date: typeof prayer.selected_date === 'string' ? prayer.selected_date : toLocalDateString(prayer.selected_date),
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

    // If this is a devotional prayer, ensure idempotency: return an existing entry for the same
    // user/date/devotional identifiers instead of inserting a duplicate.
    if (
      dbPrayer.prayer_type === 'devotional' &&
      dbPrayer.user_id &&
      dbPrayer.selected_date &&
      (dbPrayer.day_number !== null || dbPrayer.day_title || dbPrayer.devotional_title)
    ) {
      const { data: existing, error: lookupError } = await supabase
        .from('prayers')
        .select('*')
        .eq('user_id', dbPrayer.user_id)
        .eq('prayer_type', 'devotional')
        .eq('selected_date', dbPrayer.selected_date)
        .eq('day_number', dbPrayer.day_number)
        .eq('devotional_title', dbPrayer.devotional_title)
        .limit(1)
        .maybeSingle();

      if (lookupError) {
        Logger.warn('[PrayerApi.createPrayer] Devotional lookup warning', {
      component: 'prayerApi',
      error: lookupError,
    });
      }

      if (existing) {
        // Return existing in API format
        return {
          ...existing,
          type: existing.journal_category || (existing.prayer_type === 'people' ? 'people' : 'devotional'),
          is_answered: existing.status === 'answered',
          is_request: existing.is_prayer_request,
          is_prayed: existing.prayed,
        } as PrayerApiEntry;
      }
    }

    // Use INSERT to avoid dependency on unique index being applied. Pre-lookup above provides idempotency.
    const { data, error } = await supabase
      .from('prayers')
      .insert(dbPrayer)
      .select()
      .single();

    if (error) {
      // If conflict arises (e.g., partial unique index), fetch the existing row and return it
      // Supabase/Postgrest error code for unique violation is typically '23505'
      // Fallback: try to read existing devotional row and return
      if (
        (error as any)?.code === '23505' &&
        dbPrayer.prayer_type === 'devotional'
      ) {
        const { data: existingAfterConflict } = await supabase
          .from('prayers')
          .select('*')
          .eq('user_id', dbPrayer.user_id)
          .eq('prayer_type', 'devotional')
          .eq('selected_date', dbPrayer.selected_date)
          .eq('day_number', dbPrayer.day_number)
          .eq('devotional_title', dbPrayer.devotional_title)
          .limit(1)
          .maybeSingle();
        if (existingAfterConflict) {
          return {
            ...existingAfterConflict,
            type: existingAfterConflict.journal_category || (existingAfterConflict.prayer_type === 'people' ? 'people' : 'devotional'),
            is_answered: existingAfterConflict.status === 'answered',
            is_request: existingAfterConflict.is_prayer_request,
            is_prayed: existingAfterConflict.prayed,
          } as PrayerApiEntry;
        }
      }
      Logger.error('Error creating prayer', error as Error, {
      component: 'prayerApi',
      action: 'error',
    });
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
    await ensureAuthenticated();

    // RLS will automatically ensure user can only update their own prayers

    // Transform API format to database format
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    };

    // Map API fields to database fields
    if (updates.content !== undefined) {dbUpdates.content = updates.content;}
    if (updates.metadata !== undefined) {dbUpdates.metadata = updates.metadata;}
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
      Logger.error('Error updating prayer', error as Error, {
      component: 'prayerApi',
      action: 'error',
    });
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
      Logger.error('Error deleting prayer', error as Error, {
      component: 'prayerApi',
      action: 'error',
    });
      throw new Error(`Failed to delete prayer: ${error.message}`);
    }

    // Cancel any pending prayer_answered_check notifications for this prayer so they
    // don't fire after deletion. Non-fatal if this fails.
    const { error: cancelError } = await supabase
      .from('notification_queue')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('status', 'pending')
      .eq('type', 'prayer_answered_check')
      .filter('data->>source_id', 'eq', id);

    if (cancelError) {
      Logger.warn('Failed to cancel prayer_answered_check queue items after prayer delete', {
        component: 'prayerApi',
        prayerId: id,
        error: cancelError,
      });
    }
  }

  // Mark supplication as answered
  static async markSupplicationAnswered(id: string, isAnswered: boolean): Promise<PrayerApiEntry> {
    const updates: Partial<PrayerApiEntry> = {
      status: isAnswered ? 'answered' : 'pending',
      is_answered: isAnswered,
    };

    // Only update the answered_date when marking as answered
    if (isAnswered) {
      updates.answered_date = new Date().toISOString();
    } else {
      // When marking as pending again, we could clear the answered_date
      // But this is optional depending on your requirements
      updates.answered_date = null;
    }

    return this.updatePrayer(id, updates);
  }

  // Mark prayer request as prayed
  static async markPrayerRequestPrayed(id: string, isPrayed: boolean): Promise<PrayerApiEntry> {
    return this.updatePrayer(id, { prayed: isPrayed });
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
      Logger.error('Error fetching prayers in date range', error as Error, {
      component: 'prayerApi',
      action: 'error',
    });
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
      Logger.error('Error searching prayers', error as Error, {
      component: 'prayerApi',
      action: 'error',
    });
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
      Logger.error('Error fetching prayer stats', error as Error, {
      component: 'prayerApi',
      action: 'error',
    });
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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey,
      serviceKeyPrefix: serviceRoleKey.substring(0, 20)
    });
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get pending notifications that are due to be sent
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .lt('attempts', 3) // Don't retry more than 3 times
      .order('priority', { ascending: false }) // Critical first
      .order('scheduled_for', { ascending: true }) // Oldest first
      .limit(50); // Process in batches

    console.log('Query result:', {
      count: pendingNotifications?.length ?? 0,
      error: fetchError?.message
    });

    if (fetchError) {
      throw new Error(`Failed to fetch notifications: ${fetchError.message}`);
    }

    const results = [];
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const usersProcessedInThisBatch = new Set<string>();

    // Process notifications with rate limiting
    for (const notification of pendingNotifications || []) {
      try {
        const userId = notification.user_id;
        console.log(`Processing notification ${notification.id} for user ${userId}, type: ${notification.type}`);
        const cancellationReason = await getCancellationReason(supabase, notification);
        console.log(`Cancellation reason for ${notification.id}: ${cancellationReason}`);
        if (cancellationReason) {
          console.log(`Cancelling notification ${notification.id}: ${cancellationReason}`);
          const { error } = await supabase
            .from('notification_queue')
            .update({
              status: 'cancelled',
              error_message: cancellationReason,
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification.id);
          if (error) {
            console.error(`Failed to update notification ${notification.id}:`, error);
          }

          results.push({
            id: notification.id,
            success: false,
            reason: cancellationReason,
          });
          continue;
        }
        
        // Skip rate limiting for test users
        const isTestUser = userId === '77f2cbe1-6c2e-48a9-9525-a32c96ece269' || userId === 'f8ebc21f-904a-4428-81ab-325c33e1019e' || userId === '9f85144e-f565-4121-811c-32c0df348e9b';
        
        // Check if we already sent a notification to this user in THIS batch
        if (!isTestUser && usersProcessedInThisBatch.has(userId)) {
          console.log(`Skipping notification ${notification.id} - user ${userId} already received one in this batch`);
          
          // Reschedule for later (30 minutes from now)
          await supabase
            .from('notification_queue')
            .update({
              status: 'pending',
              scheduled_for: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification.id);
          
          results.push({
            id: notification.id,
            success: false,
            reason: 'rate_limited_same_batch',
          });
          continue;
        }
        
        // Check if this user received a notification in the last 30 minutes from database
        const { data: recentNotif } = await supabase
          .from('notifications')
          .select('created_at')
          .eq('user_id', userId)
          .gte('created_at', thirtyMinutesAgo)
          .limit(1)
          .single();
        
        if (!isTestUser && recentNotif) {
          console.log(`Skipping notification ${notification.id} - user ${userId} received one recently`);
          
          // Reschedule for later (30 minutes from now)
          await supabase
            .from('notification_queue')
            .update({
              status: 'pending',
              scheduled_for: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification.id);
          
          results.push({
            id: notification.id,
            success: false,
            reason: 'rate_limited_recent',
          });
          continue;
        }
        
        // Mark as being processed
        await supabase
          .from('notification_queue')
          .update({
            attempts: notification.attempts + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        // Send the notification
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notification_id: notification.id,
            user_id: notification.user_id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            priority: notification.priority,
          }),
        });

        if (response.ok) {
          // Mark as sent
          await supabase
            .from('notification_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification.id);

          // Track this user to prevent sending more notifications in this batch
          usersProcessedInThisBatch.add(userId);
          
          results.push({
            id: notification.id,
            success: true,
          });
        } else {
          const errorText = await response.text();

          // Exponential backoff: retry after 1min, 5min, 15min
          const retryDelays = [1, 5, 15]; // minutes
          const currentAttempt = notification.attempts + 1;
          const maxAttempts = 3;

          // Mark as failed if max attempts reached, otherwise schedule retry
          const newStatus = currentAttempt >= maxAttempts ? 'failed' : 'pending';
          
          // Calculate next retry time with exponential backoff
          let nextRetry = new Date().toISOString();
          if (currentAttempt < maxAttempts && retryDelays[currentAttempt - 1]) {
            const delayMinutes = retryDelays[currentAttempt - 1];
            nextRetry = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
          }

          await supabase
            .from('notification_queue')
            .update({
              status: newStatus,
              error_message: errorText,
              scheduled_for: newStatus === 'pending' ? nextRetry : notification.scheduled_for,
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification.id);

          results.push({
            id: notification.id,
            success: false,
            error: errorText,
            next_retry: newStatus === 'pending' ? nextRetry : null,
          });
        }

      } catch (error) {
        console.error(`Failed to process notification ${notification.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Mark as failed if max attempts reached
        const newStatus = notification.attempts + 1 >= 3 ? 'failed' : 'pending';

        await supabase
          .from('notification_queue')
          .update({
            status: newStatus,
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        results.push({
          id: notification.id,
          success: false,
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Queue processing error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ─── Journal notification types that get cancelled at send time ───────────────
//
//  journal_todays_focus    → cancel if 'todays_focus'   entry exists + has content
//  journal_gratitude       → cancel if 'gratitude'       entry exists + has content
//  journal_todays_win      → cancel if 'today_win'       entry exists + has content
//  journal_looking_forward → cancel if 'looking_forward' entry exists + has content
//  journal_todo            → cancel if all todos are marked complete today
//  journal_inactivity      → cancel if ANY journal entry was created today
//  heart_journal_prompt    → always send (no check)
//
// ─────────────────────────────────────────────────────────────────────────────

const JOURNAL_TYPE_MAP: Record<string, string> = {
  journal_todays_focus:    'todays_focus',
  journal_gratitude:       'gratitude',
  journal_todays_win:      'today_win',
  journal_looking_forward: 'looking_forward',
};

async function getCancellationReason(supabase: any, notification: any): Promise<string | null> {
  const { type, user_id } = notification;

  // ── Prayer answered check ──────────────────────────────────────────────────
  if (type === 'prayer_answered_check') {
    return checkPrayerAnsweredCancellation(supabase, notification);
  }

  // ── Journal entries: cancel if already filled today ────────────────────────
  if (JOURNAL_TYPE_MAP[type]) {
    const journalType = JOURNAL_TYPE_MAP[type];
    const userTz = await getUserTimezone(supabase, user_id);
    const filled = await hasFilledJournalEntry(supabase, user_id, journalType, userTz);
    if (filled) {
      return `journal_already_filled:${journalType}`;
    }
    return null;
  }

  // ── Inactivity: cancel if ANY journal entry exists today ───────────────────
  if (type === 'journal_inactivity') {
    const userTz = await getUserTimezone(supabase, user_id);
    const hasAny = await hasAnyJournalEntryToday(supabase, user_id, userTz);
    if (hasAny) {
      return 'user_active_today';
    }
    return null;
  }

  // ── Todo: cancel if all todos for today are complete ──────────────────────
  if (type === 'journal_todo') {
    const userTz = await getUserTimezone(supabase, user_id);
    const allDone = await allTodosCompleteToday(supabase, user_id, userTz);
    if (allDone) {
      return 'todos_all_complete';
    }
    return null;
  }

  // ── Prayer request care: cancel if no more pending requests ───────────────
  if (type === 'prayer_request_care') {
    const hasPending = await hasPendingPrayerRequests(supabase, user_id);
    if (!hasPending) {
      return 'no_pending_prayer_requests';
    }
    return null;
  }

  // ── Prayer people nudge: cancel if user now has people prayers ────────────
  if (type === 'prayer_people_nudge') {
    const hasPeople = await hasPeoplePrayers(supabase, user_id);
    if (hasPeople) {
      return 'user_already_has_people_prayers';
    }
    return null;
  }

  // ── Create playbook: cancel if user now has an active playbook ────────────
  if (type === 'create_playbook') {
    const hasActive = await hasActivePlaybook(supabase, user_id);
    if (hasActive) {
      return 'user_has_active_playbook';
    }
    return null;
  }

  // ── Create devotional: cancel if user now has an active devotional ─────────
  if (type === 'create_devotional' || type === 'create_first_devotional' || type === 'playbook_to_devotional') {
    const hasActive = await hasActiveDevotional(supabase, user_id);
    if (hasActive) {
      return 'user_has_active_devotional';
    }
    return null;
  }

  return null;
}

// ─── Helper: get user timezone ─────────────────────────────────────────────

async function getUserTimezone(supabase: any, userId: string): Promise<string> {
  try {
    // 1. Check notification_preferences (set by device at opt-in time)
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('timezone')
      .eq('user_id', userId)
      .single();
    if (prefs?.timezone) return prefs.timezone;

    // 2. Fallback: user_profiles.timezone (set during onboarding)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('timezone')
      .eq('id', userId)
      .single();
    if (profile?.timezone) return profile.timezone;
  } catch {
    // ignore
  }

  // 3. Final fallback: UTC. Do NOT assume a country — subscribers are global.
  return 'UTC';
}

// ─── Helper: today's date range in user's timezone ─────────────────────────

function todayRangeInTz(timezone: string): { start: string; end: string } {
  const now = new Date();
  const utcStr   = now.toLocaleString('en-US', { timeZone: 'UTC' });
  const localStr = now.toLocaleString('en-US', { timeZone: timezone });
  const offsetMs = new Date(localStr).getTime() - new Date(utcStr).getTime();

  // "Local now" expressed in UTC coordinates
  const localNow = new Date(now.getTime() + offsetMs);
  const y = localNow.getUTCFullYear();
  const m = localNow.getUTCMonth();
  const d = localNow.getUTCDate();

  // Midnight in user's timezone → UTC
  const todayStartLocal = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  const todayEndLocal   = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
  const startUtc = new Date(todayStartLocal.getTime() - offsetMs);
  const endUtc   = new Date(todayEndLocal.getTime() - offsetMs);

  return { start: startUtc.toISOString(), end: endUtc.toISOString() };
}

// ─── Helper: check if a specific journal type has been filled today ─────────

async function hasFilledJournalEntry(
  supabase: any,
  userId: string,
  journalType: string,
  timezone: string
): Promise<boolean> {
  try {
    const { start, end } = todayRangeInTz(timezone);
    const { data } = await supabase
      .from('journal_entries')
      .select('id, content')
      .eq('user_id', userId)
      .eq('type', journalType)
      .gte('created_at', start)
      .lte('created_at', end)
      .limit(1);

    if (!data || data.length === 0) return false;

    // Only count it as "filled" if it has meaningful content
    const content = data[0]?.content;
    if (!content) return false;
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    return text.trim().length > 3; // more than a few characters
  } catch (err) {
    console.warn(`hasFilledJournalEntry check failed (${journalType}):`, err);
    return false; // On error, don't cancel — send the notification
  }
}

// ─── Helper: check if any journal entry was created today ──────────────────

async function hasAnyJournalEntryToday(
  supabase: any,
  userId: string,
  timezone: string
): Promise<boolean> {
  try {
    const { start, end } = todayRangeInTz(timezone);
    const { data } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lte('created_at', end)
      .limit(1);

    return !!(data && data.length > 0);
  } catch (err) {
    console.warn('hasAnyJournalEntryToday check failed:', err);
    return false;
  }
}

// ─── Helper: check if all todos are complete today ─────────────────────────

async function allTodosCompleteToday(
  supabase: any,
  userId: string,
  timezone: string
): Promise<boolean> {
  try {
    const { start, end } = todayRangeInTz(timezone);
    // Check if there are any incomplete todos for today
    const { data: incomplete } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'todo')
      .eq('completed', false)
      .gte('created_at', start)
      .lte('created_at', end)
      .limit(1);

    if (!incomplete || incomplete.length === 0) {
      // No incomplete todos — check if there are ANY todos (empty list = don't cancel)
      const { data: total } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'todo')
        .gte('created_at', start)
        .lte('created_at', end)
        .limit(1);

      // Only cancel if there are todos AND they're all done
      return !!(total && total.length > 0);
    }

    return false; // Has incomplete todos → send the reminder
  } catch (err) {
    console.warn('allTodosCompleteToday check failed:', err);
    return false;
  }
}

// ─── Helper: prayer request care — cancel if no pending requests ──────────

async function hasPendingPrayerRequests(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('prayers')
      .select('id')
      .eq('user_id', userId)
      .eq('is_prayer_request', true)
      .or('prayed.is.null,prayed.eq.false')
      .limit(1);
    return !!(data && data.length > 0);
  } catch {
    return true; // on error, don't cancel — send the notification
  }
}

// ─── Helper: people nudge — cancel if user already has people prayers ─────

async function hasPeoplePrayers(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('prayers')
      .select('id')
      .eq('user_id', userId)
      .or('prayer_type.eq.people,is_prayer_request.eq.true')
      .limit(1);
    return !!(data && data.length > 0);
  } catch {
    return true; // on error, assume they do — don't nudge unnecessarily
  }
}

// ─── Helper: create_playbook — cancel if user now has an active playbook ──

async function hasActivePlaybook(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('playbooks')
      .select('id')
      .eq('user_id', userId)
      .is('completed_at', null)
      .neq('status', 'completed')
      .limit(1);
    return !!(data && data.length > 0);
  } catch {
    return false;
  }
}

// ─── Helper: create_devotional — cancel if user now has an active devotional

async function hasActiveDevotional(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('user_devotionals')
      .select('id')
      .eq('user_id', userId)
      .eq('completed', false)
      .limit(1);
    return !!(data && data.length > 0);
  } catch {
    return false;
  }
}

// ─── Prayer answered check (extracted from original) ──────────────────────

async function checkPrayerAnsweredCancellation(supabase: any, notification: any): Promise<string | null> {
  const prayerId = notification.data?.source_id;
  if (typeof prayerId !== 'string' || prayerId.length === 0) {
    return null;
  }

  const { data: prayer, error } = await supabase
    .from('prayers')
    .select('id, status, prayed, is_prayer_request, metadata')
    .eq('id', prayerId)
    .eq('user_id', notification.user_id)
    .maybeSingle();

  if (error) {
    console.warn(`Unable to validate prayer ${prayerId} before notification delivery:`, error.message);
    return null;
  }

  if (!prayer) {
    return 'prayer_not_found';
  }

  if (prayer.status === 'answered') {
    return 'prayer_already_answered';
  }

  if (prayer.metadata?.track_answered !== true) {
    return 'answered_tracking_disabled';
  }

  if (prayer.is_prayer_request === true && prayer.prayed !== true) {
    return 'prayer_request_not_prayed';
  }

  return null;
}

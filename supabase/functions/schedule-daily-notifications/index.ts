import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Type definitions
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// Use type assertions to avoid interface conflicts

interface NotificationItem {
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  scheduled_for: string;
  priority: 'high' | 'normal' | 'low';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Schedule Daily Notifications for All Active Users
 * 
 * This function should be called via cron job multiple times per day:
 * - 6:00 AM UTC (morning notifications)
 * - 12:00 PM UTC (midday check-in)
 * - 6:00 PM UTC (evening reflection)
 * 
 * It schedules personalized notifications for each active user based on:
 * - Time of day
 * - User activity
 * - Incomplete tasks
 * - Prayer requests
 * - Streaks
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log('🔔 Starting daily notification scheduling...');

    // Get all active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: activeUsers, error: userError } = await supabase
      .from('user_profiles')
      .select('id, first_name, email')
      .gte('last_seen_at', thirtyDaysAgo)
      .eq('onboarding_completed', true);

    if (userError) {
      throw new Error(`Failed to fetch active users: ${userError.message}`);
    }

    if (!activeUsers || activeUsers.length === 0) {
      console.log('No active users found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active users to schedule for' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${activeUsers.length} active users`);

    const results = [];
    const currentHour = new Date().getUTCHours();

    // Determine which notifications to schedule based on time of day
    let notificationBatch = 'all';
    if (currentHour >= 5 && currentHour < 10) {
      notificationBatch = 'morning';
    } else if (currentHour >= 11 && currentHour < 14) {
      notificationBatch = 'midday';
    } else if (currentHour >= 17 && currentHour < 21) {
      notificationBatch = 'evening';
    }

    console.log(`Scheduling ${notificationBatch} notifications for ${activeUsers.length} users`);

    // Schedule notifications for each user
    for (const user of activeUsers) {
      try {
        await scheduleUserNotifications(supabase, user.id, user.first_name || 'Friend', notificationBatch);
        results.push({
          user_id: user.id,
          success: true,
          batch: notificationBatch,
        });
      } catch (error) {
        console.error(`Failed to schedule for user ${user.id}:`, error);
        results.push({
          user_id: user.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`✅ Scheduled notifications for ${successCount} users, ${failureCount} failures`);

    return new Response(
      JSON.stringify({
        success: true,
        batch: notificationBatch,
        total_users: activeUsers.length,
        successful: successCount,
        failed: failureCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Daily notification scheduling error:', error);
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

async function scheduleUserNotifications(
  supabase: SupabaseClient,
  userId: string,
  userName: string,
  batch: string
): Promise<void> {

  // Morning batch (6:00 AM - 10:00 AM UTC)
  if (batch === 'morning' || batch === 'all') {
    // Morning devotional (6:00 AM)
    await scheduleNotification(supabase, {
      user_id: userId,
      type: 'morning_devotional',
      title: `Good Morning, ${userName}! 🌅`,
      message: 'Start your day with God\'s Word. Your devotional is ready.',
      data: { deep_link: 'sifia://devotionals/today' },
      scheduled_for: await getScheduledTime(supabase, userId, 6, 0),
      priority: 'high',
    });

    // Daily scripture (6:05 AM)
    const scripture = await getTodaysScripture(supabase);
    await scheduleNotification(supabase, {
      user_id: userId,
      type: 'daily_scripture',
      title: 'Today\'s Scripture 📖',
      message: `${scripture.reference}: "${scripture.preview}"`,
      data: { 
        deep_link: 'sifia://dashboard/scripture',
        verse_reference: scripture.reference,
        verse_text: scripture.text,
      },
      scheduled_for: await getScheduledTime(supabase, userId, 6, 5),
      priority: 'high',
    });

    // Morning affirmation (9:00 AM)
    const affirmation = await getUserAffirmation(supabase, userId, userName);
    await scheduleNotification(supabase, {
      user_id: userId,
      type: 'affirmation_reminder',
      title: 'Speak Truth Over Your Life 💬',
      message: affirmation,
      data: { deep_link: 'sifia://dashboard/affirmations' },
      scheduled_for: await getScheduledTime(supabase, userId, 9, 0),
      priority: 'normal',
    });
  }

  // Midday batch (12:00 PM - 2:00 PM user time)
  if (batch === 'midday' || batch === 'all') {
    const hasIncompletePlaybook = await checkIncompletePlaybook(supabase, userId);
    const hasPendingPrayers = await checkPendingPrayers(supabase, userId);

    let title = `${userName}, Take a Moment with God 🙏🏼`;
    let message = 'How\'s your day going? Check in with your spiritual journey.';
    let deepLink = 'sifia://dashboard';

    if (hasIncompletePlaybook) {
      title = `${userName}, Continue Your Journey 🎯`;
      message = 'You have action steps waiting. Take the next step in faith.';
      deepLink = 'sifia://playbooks';
    } else if (hasPendingPrayers) {
      title = `${userName}, Lift Someone Up 🙏🏼`;
      message = 'Prayer requests are waiting. Take a moment to intercede.';
      deepLink = 'sifia://journal/prayer?tab=requests';
    }

    await scheduleNotification(supabase, {
      user_id: userId,
      type: 'midday_checkin',
      title,
      message,
      data: { deep_link: deepLink },
      scheduled_for: await getScheduledTime(supabase, userId, 12, 0),
      priority: 'normal',
    });
  }

  // Evening batch (6:00 PM - 9:00 PM user time)
  if (batch === 'evening' || batch === 'all') {
    // Evening reflection (6:00 PM)
    await scheduleNotification(supabase, {
      user_id: userId,
      type: 'evening_reflection',
      title: `${userName}, Reflect on Your Day ✨`,
      message: 'How did God show up today? Take a moment to journal.',
      data: { deep_link: 'sifia://journal' },
      scheduled_for: await getScheduledTime(supabase, userId, 18, 0),
      priority: 'normal',
    });

    // Gratitude reminder (8:00 PM)
    await scheduleNotification(supabase, {
      user_id: userId,
      type: 'gratitude_reminder',
      title: `${userName}, Count Your Blessings 🌟`,
      message: 'What are you grateful for today? End your day with thanksgiving.',
      data: { deep_link: 'sifia://journal/gratitude' },
      scheduled_for: await getScheduledTime(supabase, userId, 20, 0),
      priority: 'normal',
    });

    // Upgrade reminder for free tier users (7:00 PM, once per week)
    await scheduleUpgradeReminder(supabase, userId, userName);
  }
}

async function scheduleNotification(supabase: SupabaseClient, notification: NotificationItem): Promise<void> {
  try {
    // Check if notification already exists for this user/type/time
    const { data: existing } = await supabase
      .from('notification_queue')
      .select('id')
      .eq('user_id', notification.user_id)
      .eq('type', notification.type)
      .eq('scheduled_for', notification.scheduled_for)
      .eq('status', 'pending')
      .single();

    if (existing) {
      console.log(`Notification already scheduled: ${notification.type} for user ${notification.user_id}`);
      return;
    }

    const { error } = await supabase
      .from('notification_queue')
      .insert({
        ...notification,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error(`Failed to schedule notification: ${error.message}`);
      throw error;
    }
  } catch (error: unknown) {
    console.error(`Failed to schedule notification: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function getScheduledTime(supabase: SupabaseClient, userId: string, hour: number, minute: number): Promise<string> {
  try {
    // Get user's timezone preference
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('timezone')
      .eq('user_id', userId)
      .single();

    const userTimezone = preferences?.timezone || 'UTC';
    
    // Create time in user's timezone
    const now = new Date();
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
    
    // Set desired time in user's timezone
    userTime.setHours(hour, minute, 0, 0);
    
    // If that time has already passed today, schedule for tomorrow
    if (userTime < now) {
      userTime.setDate(userTime.getDate() + 1);
    }
    
    return userTime.toISOString();
  } catch (_error) {
    // Fallback to UTC if timezone lookup fails
    const scheduledFor = new Date();
    scheduledFor.setUTCHours(hour, minute, 0, 0);
    
    if (scheduledFor < new Date()) {
      scheduledFor.setDate(scheduledFor.getDate() + 1);
    }
    
    return scheduledFor.toISOString();
  }
}

async function getTodaysScripture(supabase: SupabaseClient): Promise<{ reference: string; text: string; preview: string }> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_scriptures')
    .select('reference, text')
    .eq('date', today)
    .single();

  if (error || !data) {
    return {
      reference: 'Philippians 4:13',
      text: 'I can do all things through Christ who strengthens me.',
      preview: 'I can do all things through Christ...',
    };
  }

  const text = data.text || 'I can do all things through Christ who strengthens me.';
  const reference = data.reference || 'Philippians 4:13';
  const preview = text.length > 60 ? text.substring(0, 57) + '...' : text;

  return { reference, text, preview };
}

async function getUserAffirmation(supabase: SupabaseClient, userId: string, userName: string): Promise<string> {
  const { data, error } = await supabase
    .from('playbooks')
    .select('affirmations')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!error && data?.affirmations && Array.isArray(data.affirmations) && data.affirmations.length > 0) {
    const randomIndex = Math.floor(Math.random() * data.affirmations.length);
    return data.affirmations[randomIndex];
  }

  const fallbackAffirmations = [
    `I am ${userName}, loved unconditionally by God.`,
    `I am ${userName}, and God gives me strength for each challenge.`,
    `I am ${userName}, and I can find peace in God's presence.`,
  ];

  const randomIndex = Math.floor(Math.random() * fallbackAffirmations.length);
  return fallbackAffirmations[randomIndex];
}

async function checkIncompletePlaybook(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('playbooks')
    .select('id')
    .eq('user_id', userId)
    .eq('completed', false)
    .limit(1);

  return !error && data && data.length > 0;
}

async function checkPendingPrayers(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('prayers')
    .select('id')
    .eq('user_id', userId)
    .eq('is_prayer_request', true)
    .eq('prayed', false)
    .limit(1);

  return !error && data && data.length > 0;
}

async function scheduleUpgradeReminder(supabase: SupabaseClient, userId: string, userName: string): Promise<void> {
  // Check if user is on free tier
  const isFreeTier = await isFreeTierUser(supabase, userId);
  if (!isFreeTier) {
    return; // Skip for premium users
  }

  // Check if upgrade notification was sent this week
  const wasSentThisWeek = await wasUpgradeNotificationSentThisWeek(supabase, userId);
  if (wasSentThisWeek) {
    return; // Skip if already sent this week
  }

  await scheduleNotification(supabase, {
    user_id: userId,
    type: 'upgrade_reminder',
    title: `${userName}, A Thought for Your Journey 🙏`,
    message: 'There\'s more to explore in your walk with God. Premium offers additional tools for your spiritual growth.',
    data: { 
      deep_link: 'sifia://subscription/upgrade',
      reminder_type: 'upgrade',
    },
    scheduled_for: await getScheduledTime(supabase, userId, 16, 0), // 4:00 PM
    priority: 'low',
  });
}

async function isFreeTierUser(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return true; // Default to free tier if can't determine
  }

  return data.subscription_tier === 'free' || !data.subscription_tier;
}

async function wasUpgradeNotificationSentThisWeek(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('notification_delivery_log')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'upgrade_reminder')
    .gte('created_at', oneWeekAgo.toISOString())
    .limit(1);

  if (error) {
    return false;
  }

  return data && data.length > 0;
}

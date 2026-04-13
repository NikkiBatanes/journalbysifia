import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface UserProfile {
  user_id: string;
  first_name?: string;
  timezone?: string;
  current_streak?: number;
}

interface AuthUser {
  id: string;
  last_sign_in_at?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// USER SEGMENTS
// active      → used app in last 3 days
// at_risk     → 4-7 days inactive
// lapsed      → 8-30 days inactive
// churned     → 30+ days inactive
// ─────────────────────────────────────────────────────────────────────────────
type UserSegment = 'active' | 'at_risk' | 'lapsed' | 'churned';

function getUserSegment(lastSignIn: string | null): UserSegment {
  if (!lastSignIn) return 'churned';
  const daysSince = (Date.now() - new Date(lastSignIn).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 3) return 'active';
  if (daysSince <= 7) return 'at_risk';
  if (daysSince <= 30) return 'lapsed';
  return 'churned';
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMEZONE-AWARE SCHEDULING
// Converts a desired local hour (e.g. 7 for 7 AM) into a UTC ISO string
// for the user's timezone. If the time has already passed today, schedules
// for tomorrow.
// ─────────────────────────────────────────────────────────────────────────────
function getScheduledTimeForUser(localHour: number, timezone: string): string {
  try {
    const now = new Date();

    // Get today's date string in user's timezone (YYYY-MM-DD)
    const localDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone });

    // Build a date at the desired local hour in UTC
    const localTimeString = `${localDateStr}T${String(localHour).padStart(2, '0')}:00:00`;
    const localDate = new Date(localTimeString);

    // Find the UTC offset for this timezone at this moment
    const utcString = localDate.toLocaleString('en-US', { timeZone: timezone });
    const utcDate = new Date(utcString);
    const offsetMs = localDate.getTime() - utcDate.getTime();
    const scheduledUTC = new Date(localDate.getTime() + offsetMs);

    // If already past, schedule for tomorrow
    if (scheduledUTC <= now) {
      scheduledUTC.setDate(scheduledUTC.getDate() + 1);
    }

    return scheduledUTC.toISOString();
  } catch {
    // Fallback: use UTC directly if timezone is invalid
    const fallback = new Date();
    fallback.setUTCHours(localHour, 0, 0, 0);
    if (fallback <= new Date()) fallback.setDate(fallback.getDate() + 1);
    return fallback.toISOString();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE BANKS — segmented by user engagement level
// ─────────────────────────────────────────────────────────────────────────────

const PRAYER_MESSAGES: Record<UserSegment, string[]> = {
  active: [
    `💙 {name}, your heart is ready for prayer. Take a moment with God today.`,
    `🙏 {name}, God is listening. Share what's on your heart today.`,
    `✨ Prayer time, {name}. Let's continue your beautiful journey with God.`,
    `🕊️ {name}, find peace in prayer today. Your spirit is calling.`,
  ],
  at_risk: [
    `🙏 {name}, it's been a few days. God hasn't moved — He's still right here waiting.`,
    `💙 {name}, even 2 minutes in prayer can shift your whole day. Come back.`,
    `✨ {name}, your prayer life matters. Don't let the week slip by without it.`,
  ],
  lapsed: [
    `💙 {name}, we've missed you. God has been waiting for this conversation.`,
    `🕊️ {name}, no matter how long it's been, prayer always brings you home.`,
    `🙏 {name}, it's never too late to reconnect. Start with just one prayer today.`,
  ],
  churned: [
    `💛 {name}, you started this journey for a reason. That reason hasn't changed.`,
    `🌅 {name}, a fresh start is always just one prayer away. Come back today.`,
    `💙 {name}, siFia has been waiting for you. Your spiritual journey continues whenever you're ready.`,
  ],
};

const JOURNAL_MESSAGES: Record<UserSegment, string[]> = {
  active: [
    `✍️ {name}, your journal is waiting. What's on your heart today?`,
    `📝 Evening reflection, {name}. Take a moment to capture today's journey.`,
    `🌙 {name}, end your day with gratitude. What are you thankful for?`,
    `💭 Time to reflect, {name}. What did God teach you today?`,
  ],
  at_risk: [
    `✍️ {name}, journaling just 3 lines a day changes everything. Try tonight?`,
    `📖 {name}, your story is worth writing down. Don't let today pass unrecorded.`,
    `🌙 {name}, reflection is how we grow. Come back to your journal tonight.`,
  ],
  lapsed: [
    `💭 {name}, you don't have to catch up. Just start fresh with today.`,
    `✍️ {name}, your journal misses you. Write one thing you're grateful for right now.`,
    `📝 {name}, even one sentence tonight is better than silence.`,
  ],
  churned: [
    `🌱 {name}, your story is still being written. Pick up where you left off.`,
    `💛 {name}, returning to journaling — even once — can reignite everything.`,
    `✍️ {name}, God is still doing things worth writing about. Come back and capture them.`,
  ],
};

const WINS_MESSAGES: Record<UserSegment, string[]> = {
  active: [
    `🏆 {name}, what victories — big or small — did you experience today?`,
    `🌟 Celebrate your wins, {name}! Every step forward matters.`,
    `💪 {name}, you showed up today. That's already a win!`,
    `✨ What are you grateful for today, {name}?`,
  ],
  at_risk: [
    `🌟 {name}, even in a tough week there are wins worth celebrating. Name one.`,
    `💪 {name}, showing up despite the struggle IS the win. Come back tonight.`,
    `✨ {name}, God is in the small victories too. Don't miss them today.`,
  ],
  lapsed: [
    `🏆 {name}, you haven't been around but God has still been moving. What has He done?`,
    `💛 {name}, coming back is a win in itself. We're glad you're here.`,
    `🌟 {name}, what's one thing that's gone right recently? Come share it.`,
  ],
  churned: [
    `💛 {name}, your comeback story starts today. What's one thing you're grateful for?`,
    `🌅 {name}, a fresh chapter begins whenever you're ready. We're here.`,
    `✨ {name}, God hasn't given up on your story. Neither have we.`,
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function personalise(template: string, name: string): string {
  return template.replace(/{name}/g, name);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { action, user_id, notification_type, data } = body;

    switch (action) {
      case 'generate_specific':
        return await generateSpecificNotification(supabase, user_id, notification_type, data);
      case 'daily_batch':
        return await generateDailyBatch(supabase);
      case 'check_triggers':
        return await checkTriggersAndGenerate(supabase);
      default:
        throw new Error('Invalid action specified');
    }

  } catch (error) {
    console.error('Notification generation error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DAILY BATCH
// Targets ALL users with active device tokens
// Sends timezone-aware, segment-personalised notifications
// ─────────────────────────────────────────────────────────────────────────────
async function generateDailyBatch(supabase: any) {
  // 1. Get all users with active device tokens
  const { data: tokenRows, error: tokenError } = await supabase
    .from('device_tokens')
    .select('user_id')
    .eq('is_active', true);

  if (tokenError || !tokenRows?.length) {
    console.error('Failed to get device tokens:', tokenError);
    return new Response(
      JSON.stringify({ success: false, error: 'No active device tokens found' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userIds = [...new Set(tokenRows.map((r: any) => r.user_id))] as string[];
  console.log(`[DailyBatch] Targeting ${userIds.length} users`);

  // 2. Get user profiles (name, timezone, streak)
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, first_name, timezone, current_streak')
    .in('user_id', userIds);

  const profileMap = new Map<string, UserProfile>((profiles || []).map((p: UserProfile) => [p.user_id, p]));

  // 3. Get last sign-in times to determine segments
  const { data: authUsers } = await supabase
    .from('users')
    .select('id, last_sign_in_at')
    .in('id', userIds)
    .schema('auth');

  const authMap = new Map<string, string | null>((authUsers || []).map((u: AuthUser) => [u.id, u.last_sign_in_at]));

  let generated = 0;
  const segmentCounts: Record<UserSegment, number> = {
    active: 0, at_risk: 0, lapsed: 0, churned: 0,
  };

  for (const userId of userIds) {
    const profile = profileMap.get(userId) || { user_id: userId, first_name: undefined, timezone: undefined, current_streak: undefined };
    const firstName = profile.first_name || 'Friend';
    const timezone = profile.timezone || 'Asia/Manila';
    const lastSignIn = authMap.get(userId) || null;
    const segment = getUserSegment(lastSignIn);

    segmentCounts[segment]++;

    // Schedule at user's local time
    const morningTime = getScheduledTimeForUser(7, timezone);   // 7 AM local
    const afternoonTime = getScheduledTimeForUser(12, timezone); // 12 PM local
    const eveningTime = getScheduledTimeForUser(20, timezone);   // 8 PM local

    const notifications = [
      {
        user_id: userId,
        type: 'prayer_reminder',
        title: 'Time to Connect with God 🙏🏼',
        message: personalise(pick(PRAYER_MESSAGES[segment]), firstName),
        data: { segment, streak: profile.current_streak || 0 },
        scheduled_for: morningTime,
        priority: 'normal',
        status: 'pending',
      },
      {
        user_id: userId,
        type: 'wins_reminder',
        title: "Celebrate Today's Wins! 🏆",
        message: personalise(pick(WINS_MESSAGES[segment]), firstName),
        data: { segment },
        scheduled_for: afternoonTime,
        priority: 'normal',
        status: 'pending',
      },
      {
        user_id: userId,
        type: 'journal_reminder',
        title: 'Time to Reflect ✍🏼',
        message: personalise(pick(JOURNAL_MESSAGES[segment]), firstName),
        data: { segment },
        scheduled_for: eveningTime,
        priority: 'normal',
        status: 'pending',
      },
    ];

    const { error: insertError } = await supabase
      .from('notification_queue')
      .insert(notifications);

    if (!insertError) {
      // Also write to notifications table for in-app bell icon
      await supabase
        .from('notifications')
        .insert(notifications.map((n: any) => ({
          user_id: n.user_id,
          title: n.title,
          message: n.message,
          notification_type: n.type,
          data: n.data,
          status: 'sent',
          is_read: false,
          scheduled_for: n.scheduled_for,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })));
      generated++;
    }
  }

  console.log(`[DailyBatch] ✅ Done. Generated for ${generated}/${userIds.length} users`);
  console.log(`[DailyBatch] Segments:`, segmentCounts);

  return new Response(
    JSON.stringify({
      success: true,
      users_targeted: userIds.length,
      users_notified: generated,
      notifications_per_user: 3,
      total_queued: generated * 3,
      segments: segmentCounts,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPECIFIC NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
async function generateSpecificNotification(
  supabase: any,
  userId: string,
  type: string,
  data: any
) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('first_name, timezone, current_streak')
    .eq('user_id', userId)
    .single();

  const firstName = profile?.first_name || 'Friend';
  const timezone = profile?.timezone || 'Asia/Manila';

  const titleMap: Record<string, string> = {
    prayer_reminder: 'Time for Prayer 💙',
    journal_reminder: 'Reflection Time ✍️',
    wins_reminder: "Celebrate Today's Wins! 🏆",
    streak_alert: 'Streak Alert! 🔥',
    devotional_reminder: 'Your Daily Devotional 🌅',
    playbook_step: 'Ready for Your Next Step? 🎯',
    prayer_request: 'Prayer Request 🙏',
  };

  const title = titleMap[type] || 'siFia Notification';
  const message = data?.message || `${firstName}, you have a new ${type.replace(/_/g, ' ')}.`;
  const scheduledFor = getScheduledTimeForUser(8, timezone);

  const { error } = await supabase
    .from('notification_queue')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      data: data || {},
      scheduled_for: scheduledFor,
      priority: data?.priority || 'normal',
      status: 'pending',
    });

  if (error) throw new Error(`Failed to queue notification: ${error.message}`);

  return new Response(
    JSON.stringify({ success: true, scheduled_for: scheduledFor }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER CHECKS
// Streak risk alerts and expiring challenges
// ─────────────────────────────────────────────────────────────────────────────
async function checkTriggersAndGenerate(supabase: any) {
  const triggers: string[] = [];

  // Streak risk: users with a streak who haven't been active in 20+ hours
  const { data: streakRisks } = await supabase
    .from('user_profiles')
    .select('user_id, first_name, current_streak, last_activity, timezone')
    .gt('current_streak', 0)
    .lt('last_activity', new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString());

  for (const user of streakRisks || []) {
    const hoursLeft = 24 - Math.floor(
      (Date.now() - new Date(user.last_activity).getTime()) / (1000 * 60 * 60)
    );

    if (hoursLeft <= 4) {
      const firstName = user.first_name || 'Friend';
      await supabase.from('notification_queue').insert({
        user_id: user.user_id,
        type: 'streak_alert',
        title: 'Streak Alert! 🔥',
        message: `🔥 ${firstName}, your ${user.current_streak}-day streak ends in ${hoursLeft} hours. Don't break it now!`,
        data: { streakDays: user.current_streak, hoursLeft },
        scheduled_for: new Date(Date.now() + 30000).toISOString(),
        priority: 'high',
        status: 'pending',
      });
      triggers.push(`streak_alert_${user.user_id}`);
    }
  }

  // Expiring playbook challenges
  const { data: challenges } = await supabase
    .from('playbook_challenges')
    .select('*, playbooks(title), playbook_sessions(user_id)')
    .lt('deadline', new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString())
    .eq('status', 'active');

  for (const challenge of challenges || []) {
    const userId = challenge.playbook_sessions?.user_id;
    if (!userId) continue;

    const timeLeft = Math.ceil(
      (new Date(challenge.deadline).getTime() - Date.now()) / (1000 * 60 * 60)
    );
    const timeLeftText = timeLeft > 24 ? `${Math.ceil(timeLeft / 24)} days` : `${timeLeft} hours`;

    await supabase.from('notification_queue').insert({
      user_id: userId,
      type: 'playbook_challenge',
      title: 'Challenge Alert! 🔥',
      message: `⚡ Don't miss it! '${challenge.title}' from '${challenge.playbooks?.title}' ends in ${timeLeftText}`,
      data: { challengeTitle: challenge.title, timeLeft: timeLeftText },
      scheduled_for: new Date(Date.now() + 30000).toISOString(),
      priority: 'high',
      status: 'pending',
    });
    triggers.push(`challenge_${challenge.id}`);
  }

  console.log(`[Triggers] Fired ${triggers.length} trigger notifications`);

  return new Response(
    JSON.stringify({ success: true, triggers_fired: triggers.length, triggers }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

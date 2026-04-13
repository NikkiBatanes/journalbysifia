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
  id: string;
  first_name?: string;
  last_name?: string;
  current_streak?: number;
  timezone?: string;
}

interface AuthUser {
  id: string;
  last_sign_in_at?: string | null;
}

interface NotificationData {
  playbook_title?: string;
  playbookTitle?: string;
  step_title?: string;
  stepTitle?: string;
  challenge_title?: string;
  challengeTitle?: string;
  devotional_title?: string;
  devotionalTitle?: string;
  prompt_preview?: string;
  promptPreview?: string;
  verse_reference?: string;
  verseReference?: string;
  verse_preview?: string;
  versePreview?: string;
  time_left?: string;
  timeLeft?: string;
  hoursLeft?: number;
  category?: string;
  requesterName?: string;
  prayerPreview?: string;
  streakDays?: number;
  deadline?: string;
  requester_name?: string;
  prayer_preview?: string;
  message?: string;
  priority?: string;
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
    const candidate = new Date();
    candidate.setUTCHours(0, 0, 0, 0);

    for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
      const date = new Date(candidate.getTime() + dayOffset * 24 * 60 * 60 * 1000);

      for (let utcHour = 0; utcHour < 24; utcHour++) {
        date.setUTCHours(utcHour, 0, 0, 0);

        const localHourActual = parseInt(
          date.toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false })
        );

        if (localHourActual === localHour && date > now) {
          return date.toISOString();
        }
      }
    }

    const fallback = new Date();
    fallback.setUTCHours(localHour, 0, 0, 0);
    if (fallback <= now) fallback.setDate(fallback.getDate() + 1);
    return fallback.toISOString();

  } catch {
    const fallback = new Date();
    fallback.setUTCHours(localHour, 0, 0, 0);
    if (fallback <= new Date()) fallback.setDate(fallback.getDate() + 1);
    return fallback.toISOString();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION TEMPLATES — used by generateSpecificNotification
// for rich content like playbook steps, verses, challenges, prayer requests
// ─────────────────────────────────────────────────────────────────────────────
interface NotificationTemplate {
  type: string;
  templates: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  timing: 'morning' | 'afternoon' | 'evening' | 'immediate';
}

const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    type: 'prayer_reminder',
    templates: [
      '💙 {firstName}, your heart is ready for prayer. Take a moment with God today.',
      '🙏 Time for prayer, {firstName}. Your {streakDays}-day streak is waiting!',
      '💝 {firstName}, God is listening. Share what\'s on your heart today.',
      '✨ Prayer time, {firstName}. Let\'s continue your beautiful journey with God.',
      '🕊️ {firstName}, find peace in prayer today. Your spirit is calling.',
    ],
    priority: 'high',
    timing: 'morning',
  },
  {
    type: 'playbook_step',
    templates: [
      '🎯 Ready for \'{playbookTitle}\'? Your next step: {stepTitle}',
      '✨ Continue \'{playbookTitle}\'? Time for: {stepTitle}',
      '🌟 Let\'s grow! \'{playbookTitle}\' awaits: {stepTitle}',
      '💪 {firstName}, ready to tackle \'{stepTitle}\' in your {playbookTitle} journey?',
      '🚀 Next adventure in \'{playbookTitle}\': {stepTitle}. You\'ve got this!',
    ],
    priority: 'high',
    timing: 'evening',
  },
  {
    type: 'playbook_verse',
    templates: [
      '📖 Today\'s verse for \'{playbookTitle}\': {verseReference} - {versePreview}...',
      '✝️ Your \'{playbookTitle}\' verse: {verseReference} - {versePreview}...',
      '🕊️ Verse for \'{playbookTitle}\': {verseReference} - {versePreview}...',
      '💫 {firstName}, meditate on {verseReference} for your \'{playbookTitle}\' journey.',
      '📚 Scripture for \'{playbookTitle}\': {verseReference} - {versePreview}...',
    ],
    priority: 'normal',
    timing: 'morning',
  },
  {
    type: 'playbook_challenge',
    templates: [
      '🔥 Challenge alert! \'{challengeTitle}\' from \'{playbookTitle}\' ends in {timeLeft}',
      '⚡ Don\'t miss it! \'{challengeTitle}\' from \'{playbookTitle}\' ends {timeLeft}',
      '🎯 Final call! \'{challengeTitle}\' from \'{playbookTitle}\' ends in {timeLeft}',
      '💪 {firstName}, \'{challengeTitle}\' challenge ends {timeLeft}. You can do this!',
      '🌟 Last chance! Complete \'{challengeTitle}\' in \'{playbookTitle}\' - {timeLeft} left!',
    ],
    priority: 'critical',
    timing: 'immediate',
  },
  {
    type: 'devotional_reminder',
    templates: [
      '🌅 Good morning {firstName}! Today\'s devotional: \'{devotionalTitle}\' is ready',
      '☀️ Start strong, {firstName}! Your devotional \'{devotionalTitle}\' awaits',
      '💫 Ready to grow, {firstName}? Today\'s focus: \'{devotionalTitle}\' is here',
      '🌱 {firstName}, nurture your soul with today\'s devotional: \'{devotionalTitle}\'',
      '✨ Morning blessing, {firstName}! \'{devotionalTitle}\' is waiting for you',
    ],
    priority: 'high',
    timing: 'morning',
  },
  {
    type: 'journal_prompt',
    templates: [
      '✍️ Reflection time, {firstName}. Today\'s prompt: \'{promptPreview}...\'',
      '📝 Evening reflection, {firstName}: \'{promptPreview}...\'',
      '💭 Time to journal, {firstName}: \'{promptPreview}...\'',
      '🌙 {firstName}, end your day with reflection: \'{promptPreview}...\'',
      '📖 Journaling moment, {firstName}. Consider: \'{promptPreview}...\'',
    ],
    priority: 'normal',
    timing: 'evening',
  },
  {
    type: 'streak_alert',
    templates: [
      '🔥 Amazing! {streakDays}-day {category} streak. Keep the momentum going!',
      '⭐ Incredible! {streakDays}-day streak in \'{category}\'. You\'re on fire!',
      '🎉 Wow! {streakDays}-day {category} streak. Your consistency is inspiring!',
      '💪 {firstName}, {streakDays} days strong in {category}! Don\'t break the chain!',
      '🌟 Streak alert! {streakDays} consecutive days of {category}. You\'re amazing!',
    ],
    priority: 'critical',
    timing: 'evening',
  },
  {
    type: 'prayer_request',
    templates: [
      '🙏 {requesterName} needs prayer: {prayerPreview}...',
      '💙 Prayer request from {requesterName}: {prayerPreview}...',
      '🤝 Join in prayer for {requesterName}: {prayerPreview}...',
      '✨ {firstName}, {requesterName} is asking for prayer: {prayerPreview}...',
      '💝 Community prayer needed for {requesterName}: {prayerPreview}...',
    ],
    priority: 'high',
    timing: 'immediate',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DAILY BATCH MESSAGE BANKS — segmented by user engagement level
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

function generatePersonalizedMessage(
  template: NotificationTemplate,
  user: UserProfile | null,
  data: NotificationData
): string {
  const templates = template.templates;
  const selectedTemplate = templates[Math.floor(Math.random() * templates.length)];
  let message = selectedTemplate;

  const replacements: Record<string, string> = {
    firstName: user?.first_name || 'Friend',
    lastName: user?.last_name || '',
    streakDays: String(user?.current_streak || 0),
    playbookTitle: data?.playbook_title || data?.playbookTitle || '',
    stepTitle: data?.step_title || data?.stepTitle || '',
    challengeTitle: data?.challenge_title || data?.challengeTitle || '',
    devotionalTitle: data?.devotional_title || data?.devotionalTitle || '',
    promptPreview: data?.prompt_preview || data?.promptPreview || '',
    verseReference: data?.verse_reference || data?.verseReference || '',
    versePreview: data?.verse_preview || data?.versePreview || '',
    timeLeft: data?.time_left || data?.timeLeft || '',
    category: data?.category || '',
    requesterName: data?.requester_name || data?.requesterName || 'Someone',
    prayerPreview: data?.prayer_preview || data?.prayerPreview || '',
  };

  for (const [key, value] of Object.entries(replacements)) {
    message = message.replace(new RegExp(`{${key}}`, 'g'), value);
  }

  return message;
}

function generateTitle(type: string, _data: NotificationData): string {
  const titles: Record<string, string> = {
    prayer_reminder: 'Time for Prayer 💙',
    playbook_step: 'Ready for Your Next Step? 🎯',
    playbook_verse: 'Today\'s Scripture 📖',
    playbook_challenge: 'Challenge Alert! 🔥',
    devotional_reminder: 'Your Daily Devotional 🌅',
    journal_prompt: 'Reflection Time ✍️',
    streak_alert: 'Streak Alert! 🔥',
    prayer_request: 'Prayer Request 🙏',
  };
  return titles[type] || 'siFia Notification';
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
// GENERATE SPECIFIC NOTIFICATION
// Used for rich content: playbook steps, verses, challenges, prayer requests
// Uses NOTIFICATION_TEMPLATES with full placeholder support
// ─────────────────────────────────────────────────────────────────────────────
async function generateSpecificNotification(
  supabase: any,
  userId: string,
  type: string,
  data: NotificationData
) {
  const { data: user, error: userError } = await supabase
    .from('user_profiles')
    .select('id, first_name, last_name, current_streak, timezone')
    .eq('id', userId)
    .single();

  if (userError) {
    console.warn('Could not fetch user profile:', userError.message);
  }

  const template = NOTIFICATION_TEMPLATES.find(t => t.type === type);
  if (!template) {
    throw new Error(`Unknown notification type: ${type}`);
  }

  const message = generatePersonalizedMessage(template, user, data);
  const title = generateTitle(type, data);
  const timezone = user?.timezone || 'Asia/Manila';

  // Use timing-aware scheduling based on template
  let scheduledFor: string;
  switch (template.timing) {
    case 'morning':
      scheduledFor = getScheduledTimeForUser(7, timezone);
      break;
    case 'afternoon':
      scheduledFor = getScheduledTimeForUser(12, timezone);
      break;
    case 'evening':
      scheduledFor = getScheduledTimeForUser(20, timezone);
      break;
    case 'immediate':
    default:
      scheduledFor = new Date(Date.now() + 30000).toISOString();
      break;
  }

  const { error: insertError } = await supabase
    .from('notification_queue')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      data,
      scheduled_for: scheduledFor,
      priority: template.priority,
      status: 'pending',
    });

  if (insertError) {
    throw new Error(`Failed to queue notification: ${insertError.message}`);
  }

  // Also write to notifications table for in-app bell icon
  await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type: 'REMINDER',
    notification_type: type,
    data,
    status: 'PENDING',
    is_read: false,
    scheduled_for: scheduledFor,
  });

  return new Response(
    JSON.stringify({ success: true, message, scheduled_for: scheduledFor }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY BATCH
// Targets ALL users with active device tokens
// Timezone-aware + segment-personalised messages
// Writes to both notification_queue (push) and notifications (in-app bell)
// ─────────────────────────────────────────────────────────────────────────────
async function generateDailyBatch(supabase: any) {
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

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, first_name, timezone, current_streak')
    .in('id', userIds);

  const profileMap = new Map<string, UserProfile>(
    (profiles || []).map((p: UserProfile) => [p.id, p])
  );

  const { data: authUsers } = await supabase
    .from('users')
    .select('id, last_sign_in_at')
    .in('id', userIds)
    .schema('auth');

  const authMap = new Map<string, string | null>(
    (authUsers || []).map((u: AuthUser) => [u.id, u.last_sign_in_at ?? null])
  );

  let generated = 0;
  const segmentCounts: Record<UserSegment, number> = {
    active: 0, at_risk: 0, lapsed: 0, churned: 0,
  };

  for (const userId of userIds) {
    const profile = profileMap.get(userId) || { id: userId };
    const firstName = profile.first_name || 'Friend';
    const timezone = profile.timezone || 'Asia/Manila';
    const lastSignIn = authMap.get(userId) || null;
    const segment = getUserSegment(lastSignIn);

    segmentCounts[segment]++;

    const morningTime = getScheduledTimeForUser(7, timezone);
    const afternoonTime = getScheduledTimeForUser(12, timezone);
    const eveningTime = getScheduledTimeForUser(20, timezone);

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
      await supabase.from('notifications').insert(
        notifications.map((n) => ({
          user_id: n.user_id,
          title: n.title,
          message: n.message,
          type: 'REMINDER',
          notification_type: n.type,
          data: n.data,
          status: 'PENDING',
          is_read: false,
          scheduled_for: n.scheduled_for,
        }))
      );
      generated++;
    } else {
      console.error(`[DailyBatch] Failed for user ${userId}:`, insertError.message);
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
// TRIGGER CHECKS
// Streak risk alerts and expiring playbook challenges
// ─────────────────────────────────────────────────────────────────────────────
async function checkTriggersAndGenerate(supabase: any) {
  const triggers: string[] = [];

  // Streak risk: users with a streak who haven't been active in 20+ hours
  const { data: streakRisks } = await supabase
    .from('user_profiles')
    .select('id, first_name, current_streak, last_activity_date, timezone')
    .gt('current_streak', 0)
    .lt('last_activity_date', new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString());

  for (const user of streakRisks || []) {
    const hoursLeft = 24 - Math.floor(
      (Date.now() - new Date(user.last_activity_date).getTime()) / (1000 * 60 * 60)
    );

    if (hoursLeft <= 4) {
      const firstName = user.first_name || 'Friend';
      const message = `🔥 ${firstName}, your ${user.current_streak}-day streak ends in ${hoursLeft} hours. Don't break it now!`;

      await supabase.from('notification_queue').insert({
        user_id: user.id,
        type: 'streak_alert',
        title: 'Streak Alert! 🔥',
        message,
        data: { streakDays: user.current_streak, hoursLeft },
        scheduled_for: new Date(Date.now() + 30000).toISOString(),
        priority: 'high',
        status: 'pending',
      });

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Streak Alert! 🔥',
        message,
        type: 'REMINDER',
        notification_type: 'streak_alert',
        data: { streakDays: user.current_streak, hoursLeft },
        status: 'PENDING',
        is_read: false,
      });

      triggers.push(`streak_alert_${user.id}`);
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
    const message = `⚡ Don't miss it! '${challenge.title}' from '${challenge.playbooks?.title}' ends in ${timeLeftText}`;

    await supabase.from('notification_queue').insert({
      user_id: userId,
      type: 'playbook_challenge',
      title: 'Challenge Alert! 🔥',
      message,
      data: { challengeTitle: challenge.title, timeLeft: timeLeftText },
      scheduled_for: new Date(Date.now() + 30000).toISOString(),
      priority: 'high',
      status: 'pending',
    });

    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Challenge Alert! 🔥',
      message,
      type: 'REMINDER',
      notification_type: 'playbook_challenge',
      data: { challengeTitle: challenge.title, timeLeft: timeLeftText },
      status: 'PENDING',
      is_read: false,
    });

    triggers.push(`challenge_${challenge.id}`);
  }

  console.log(`[Triggers] Fired ${triggers.length} trigger notifications`);

  return new Response(
    JSON.stringify({ success: true, triggers_fired: triggers.length, triggers }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
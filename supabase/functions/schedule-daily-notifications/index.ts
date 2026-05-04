import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Complete daily notification schedule (user local time) ───────────────────
//
//  All 30 notification types — each on its own time slot, at least 15 min apart.
//  Types marked "cancel-at-send" are always scheduled but cancelled in
//  process-notification-queue/getCancellationReason if condition no longer holds.
//  Types marked "skip-if" are only inserted when the condition is true at schedule time.
//
//  06:00  prayer_today                      always
//  06:30  devotional_day_ready              skip-if: no active devotional
//  07:30  journal_todays_focus              cancel-at-send: already filled
//  10:00  playbook_word_to_speak_morning    skip-if: no word_to_speak
//  10:30  playbook_verse_reflection_morning skip-if: no reflection lines
//  11:00  playbook_faithful_action          skip-if: no incomplete action steps
//  12:00  journal_todo                      cancel-at-send: todos complete
//  12:30  prayer_request_care              skip-if: no pending prayer requests
//  12:45  prayer_answered_check            skip-if: no unanswered prayers (7d+)
//  14:00  playbook_word_to_speak_afternoon  skip-if: no word_to_speak
//  14:15  playbook_verse_reflection_afternoon skip-if: no reflection lines
//  14:45  journal_inactivity               cancel-at-send: any journal entry today
//  15:00  prayer_people_nudge              skip-if: user has any people prayers
//  15:30  create_playbook                  skip-if: has ongoing playbook or no quota
//  15:45  create_first_devotional          skip-if: has devotionals or no eligible playbook
//  16:00  create_devotional               skip-if: has active devotional or no eligible playbook
//  16:15  playbook_to_devotional          skip-if: no completed playbook without devotional
//  16:30  devotional_prayer_prompt        skip-if: no active devotional with prayer
//  16:45  usage_room_devotional           skip-if: devotional quota not low (≤5)
//  17:00  usage_room_playbook             skip-if: playbook quota not low (≤5)
//  17:15  heart_journal_prompt            always
//  17:45  journal_gratitude               cancel-at-send: already filled
//  19:00  devotional_verse_revisit        skip-if: no active devotional with verse
//  19:15  playbook_verse_revisit          skip-if: no playbook with bible verse
//  19:30  devotional_completed_reflection skip-if: no completed devotionals
//  19:45  content_refresh_wait            skip-if: has any creation quota remaining
//  20:00  upgrade_room                    skip-if: already premium or has quota
//  20:15  journal_todays_win              cancel-at-send: already filled
//  20:45  playbook_word_to_speak_evening  skip-if: no word_to_speak
//  21:15  journal_looking_forward         cancel-at-send: already filled
//  21:30  devotional_reflection_prompt    skip-if: no active devotional with reflection question
//  21:45  playbook_prayer_revisit         skip-if: no active playbook with prayer
//
//  NOTE: playbook_actions_complete + playbook_actions_milestone are EVENT-DRIVEN —
//  they fire from the app the moment the user completes an action, not on a schedule.
//
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log('🔔 Starting daily notification scheduling...');

    // Fetch active users (logged in within last 30 days, onboarding done)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: activeUsers, error: userError } = await supabase
      .from('user_profiles')
      .select('id, first_name')
      .gte('last_seen_at', thirtyDaysAgo)
      .eq('onboarding_completed', true);

    if (userError) throw new Error(`Failed to fetch active users: ${userError.message}`);

    if (!activeUsers || activeUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active users to schedule for' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${activeUsers.length} active users`);

    const results = [];
    for (const user of activeUsers) {
      try {
        const scheduled = await scheduleForUser(supabase, user.id, user.first_name || 'Friend');
        results.push({ user_id: user.id, success: true, scheduled });
      } catch (err) {
        console.error(`Failed to schedule for user ${user.id}:`, err);
        results.push({
          user_id: user.id,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    console.log(`✅ Scheduled for ${successCount} users, ${failureCount} failures`);

    return new Response(
      JSON.stringify({ success: true, total_users: activeUsers.length, successful: successCount, failed: failureCount, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Daily notification scheduling error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ─── Notification candidate type ─────────────────────────────────────────────

interface Candidate {
  type: string;
  localHour: number;
  localMinute: number;
  title: string;
  message: string;
  data: Record<string, unknown>;
  priority: 'high' | 'normal' | 'low';
}

// ─── Core scheduler ───────────────────────────────────────────────────────────

async function scheduleForUser(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<number> {
  // Fetch everything in parallel — one round-trip per user
  const [
    timezone,
    devotionals,
    playbook,
    prayerRequests,
    unansweredPrayers,
    hasPeoplePrayers,
    subscription,
  ] = await Promise.all([
    getUserTimezone(supabase, userId),
    getDevotionals(supabase, userId),
    getActivePlaybook(supabase, userId),
    getPendingPrayerRequests(supabase, userId),
    getUnansweredPrayers(supabase, userId),
    checkHasPeoplePrayers(supabase, userId),
    getUserSubscription(supabase, userId),
  ]);

  // Derived state
  const activeDevotionals   = devotionals.filter(d => !d.completed);
  const completedDevotionals = devotionals.filter(d => d.completed);
  const hasActiveDevotional  = activeDevotionals.length > 0;
  const primaryDevotional    = activeDevotionals[0] ?? null;

  const hasWordToSpeak     = !!(playbook?.word_to_speak);
  const hasReflectionLines = !!(playbook?.bible_verse_reflection || playbook?.bible_verse?.reflection);
  const hasPlaybookPrayer  = !!(playbook?.prayer);
  const hasIncompleteAction = !!(playbook?.hasIncompleteAction);
  const hasActivePlaybook  = !!playbook;

  // Completed playbook that doesn't have a devotional yet
  const completedPlaybookWithoutDevotional = playbook?.isCompleted
    ? playbook : null;

  // Subscription usage
  const devotionalQuota  = subscription?.devotionals_remaining ?? null;
  const playbookQuota    = subscription?.playbooks_remaining ?? null;
  const noCreationRoom   = devotionalQuota === 0 && playbookQuota === 0;
  const lowDevotionals   = devotionalQuota !== null && devotionalQuota > 0 && devotionalQuota <= 5;
  const lowPlaybooks     = playbookQuota !== null && playbookQuota > 0 && playbookQuota <= 5;
  const isFreeTier       = subscription?.tier === 'seeker' || subscription?.tier === 'spark';

  const candidates: Candidate[] = [];

  // ── 06:00  prayer_today ──────────────────────────────────────────────────────
  candidates.push({
    type: 'prayer_today',
    localHour: 6, localMinute: 0,
    title: `Good morning, ${name} 🙏`,
    message: "Start your day with prayer — it's the most powerful thing you can do right now.",
    data: { deep_link: 'sifia://journal/prayer' },
    priority: 'high',
  });

  // ── 06:30  devotional_day_ready ─────────────────────────────────────────────
  if (hasActiveDevotional && primaryDevotional) {
    candidates.push({
      type: 'devotional_day_ready',
      localHour: 6, localMinute: 30,
      title: `Your devotional is ready, ${name} 📖`,
      message: `A fresh word for a fresh day. ${primaryDevotional.title ? `"${primaryDevotional.title}" is waiting.` : 'Open your devotional and let God speak.'}`,
      data: { deep_link: `sifia://devotionals/${primaryDevotional.id}`, devotional_id: primaryDevotional.id },
      priority: 'high',
    });
  }

  // ── 07:30  journal_todays_focus ─────────────────────────────────────────────
  // (cancel-at-send if already filled — handled in process-notification-queue)
  candidates.push({
    type: 'journal_todays_focus',
    localHour: 7, localMinute: 30,
    title: `What's your focus today, ${name}? 🎯`,
    message: 'Set your intention before the day runs away. One clear focus changes everything.',
    data: { deep_link: 'sifia://journal/focus', check_before_send: true },
    priority: 'normal',
  });

  // ── 10:00  playbook_word_to_speak (morning) ──────────────────────────────────
  if (hasWordToSpeak && playbook) {
    const word = truncate(playbook.word_to_speak, 90);
    candidates.push({
      type: 'playbook_word_to_speak_morning',
      localHour: 10, localMinute: 0,
      title: `Speak it out loud, ${name} 💬`,
      message: `"${word}"`,
      data: { deep_link: `sifia://playbooks/${playbook.id}/walkthrough/words`, playbook_id: playbook.id },
      priority: 'high',
    });
  }

  // ── 10:30  playbook_verse_reflection (morning) ──────────────────────────────
  if (hasReflectionLines && playbook) {
    const line = truncate(playbook.firstReflectionLine, 100);
    candidates.push({
      type: 'playbook_verse_reflection_morning',
      localHour: 10, localMinute: 30,
      title: `Meditate on this, ${name} 🕊️`,
      message: line || 'Your playbook has a verse reflection for you. Let it sink in.',
      data: { deep_link: `sifia://playbooks/${playbook.id}/walkthrough/verse`, playbook_id: playbook.id },
      priority: 'normal',
    });
  }

  // ── 11:00  playbook_faithful_action ─────────────────────────────────────────
  if (hasIncompleteAction && playbook) {
    const action = truncate(playbook.nextActionText, 85);
    candidates.push({
      type: 'playbook_faithful_action',
      localHour: 11, localMinute: 0,
      title: `Time for action, ${name} ✅`,
      message: action
        ? `Next step: "${action}". Small obedience moves mountains.`
        : 'Your action step is waiting. One faithful step at a time.',
      data: { deep_link: `sifia://playbooks/${playbook.id}/walkthrough/actions`, playbook_id: playbook.id },
      priority: 'normal',
    });
  }

  // ── 12:00  journal_todo ──────────────────────────────────────────────────────
  // (cancel-at-send if todos complete)
  candidates.push({
    type: 'journal_todo',
    localHour: 12, localMinute: 0,
    title: `Midday check-in, ${name} 📋`,
    message: 'Take 2 minutes to review your tasks. Staying on track is a form of stewardship.',
    data: { deep_link: 'sifia://journal/todos', check_before_send: true },
    priority: 'low',
  });

  // ── 12:30  prayer_request_care ──────────────────────────────────────────────
  if (prayerRequests.length > 0) {
    const firstName = prayerRequests[0]?.person_name?.split(' ')[0] || null;
    const count = prayerRequests.length;
    candidates.push({
      type: 'prayer_request_care',
      localHour: 12, localMinute: 30,
      title: count > 1 ? `${count} people are waiting for your prayer, ${name} 🙏` : `Lift up ${firstName || 'someone'} in prayer 🙏`,
      message: count > 1
        ? `You have ${count} prayer requests waiting. Take a moment to intercede.`
        : `${firstName || 'Someone'} shared a prayer request with you. Will you pray for them now?`,
      data: { deep_link: 'sifia://journal/prayer?tab=requests' },
      priority: 'normal',
    });
  }

  // ── 12:45  prayer_answered_check ────────────────────────────────────────────
  if (unansweredPrayers.length > 0) {
    const prayer = unansweredPrayers[0];
    const snippet = truncate(prayer.content, 70);
    candidates.push({
      type: 'prayer_answered_check',
      localHour: 12, localMinute: 45,
      title: `Has God answered this yet, ${name}? ✨`,
      message: snippet
        ? `You've been praying: "${snippet}" — has anything changed?`
        : 'You have an ongoing prayer from a while back. Has God answered it?',
      data: {
        deep_link: `sifia://journal/prayer?id=${prayer.id}`,
        source_id: prayer.id,
      },
      priority: 'normal',
    });
  }

  // ── 14:00  playbook_word_to_speak (afternoon) ────────────────────────────────
  if (hasWordToSpeak && playbook) {
    const word = truncate(playbook.word_to_speak, 90);
    candidates.push({
      type: 'playbook_word_to_speak_afternoon',
      localHour: 14, localMinute: 0,
      title: `Declare it again, ${name} 🗣️`,
      message: `"${word}" — speak it with boldness.`,
      data: { deep_link: `sifia://playbooks/${playbook.id}/walkthrough/words`, playbook_id: playbook.id },
      priority: 'high',
    });
  }

  // ── 14:15  playbook_verse_reflection (afternoon) ────────────────────────────
  if (hasReflectionLines && playbook) {
    const line = truncate(playbook.secondReflectionLine || playbook.firstReflectionLine, 100);
    candidates.push({
      type: 'playbook_verse_reflection_afternoon',
      localHour: 14, localMinute: 15,
      title: `Carry this with you, ${name} 📜`,
      message: line || 'Your scripture reflection is waiting — let it shape your afternoon.',
      data: { deep_link: `sifia://playbooks/${playbook.id}/walkthrough/verse`, playbook_id: playbook.id },
      priority: 'normal',
    });
  }

  // ── 14:45  journal_inactivity ────────────────────────────────────────────────
  // (cancel-at-send if any journal entry exists today)
  candidates.push({
    type: 'journal_inactivity',
    localHour: 14, localMinute: 45,
    title: `Still with you, ${name} 💛`,
    message: 'Even one line in your journal keeps the connection going. God is listening.',
    data: { deep_link: 'sifia://journal', check_before_send: true },
    priority: 'low',
  });

  // ── 15:00  prayer_people_nudge ──────────────────────────────────────────────
  if (!hasPeoplePrayers) {
    candidates.push({
      type: 'prayer_people_nudge',
      localHour: 15, localMinute: 0,
      title: `Who can you pray for today, ${name}? 💙`,
      message: 'Interceding for others is one of the most powerful gifts you can give. Add someone to your prayer list.',
      data: { deep_link: 'sifia://journal/prayer-people' },
      priority: 'low',
    });
  }

  // ── 15:30  create_playbook ──────────────────────────────────────────────────
  if (!hasActivePlaybook && playbookQuota !== 0) {
    candidates.push({
      type: 'create_playbook',
      localHour: 15, localMinute: 30,
      title: `Ready for your next step, ${name}? 🗺️`,
      message: 'Create a new playbook and turn a scripture into a personal plan of action.',
      data: { deep_link: 'sifia://userinput' },
      priority: 'low',
    });
  }

  // ── 15:45  create_first_devotional / create_devotional ──────────────────────
  if (!hasActiveDevotional && completedPlaybookWithoutDevotional && devotionalQuota !== 0) {
    const isFirst = devotionals.length === 0;
    candidates.push({
      type: isFirst ? 'create_first_devotional' : 'create_devotional',
      localHour: 15, localMinute: 45,
      title: isFirst
        ? `Take the next step, ${name} 📘`
        : `Go deeper, ${name} 📘`,
      message: isFirst
        ? 'Your playbook is complete — now turn it into a personalized devotional. It only takes a moment.'
        : 'Ready for something deeper? Create a devotional from your completed playbook.',
      data: {
        deep_link: `sifia://playbooks/${completedPlaybookWithoutDevotional.id}/walkthrough/completed`,
        playbook_id: completedPlaybookWithoutDevotional.id,
      },
      priority: 'low',
    });
  }

  // ── 16:00  playbook_to_devotional ───────────────────────────────────────────
  if (completedPlaybookWithoutDevotional && hasActiveDevotional) {
    // Only show if they already have a devotional (so they understand the concept)
    candidates.push({
      type: 'playbook_to_devotional',
      localHour: 16, localMinute: 0,
      title: `Your playbook is ready to become more, ${name} ✨`,
      message: 'You completed a playbook — you can turn it into a devotional to go even deeper.',
      data: {
        deep_link: `sifia://playbooks/${completedPlaybookWithoutDevotional.id}/walkthrough/completed`,
        playbook_id: completedPlaybookWithoutDevotional.id,
      },
      priority: 'low',
    });
  }

  // ── 16:30  devotional_prayer_prompt ─────────────────────────────────────────
  if (hasActiveDevotional && primaryDevotional?.hasPrayerToComplete) {
    candidates.push({
      type: 'devotional_prayer_prompt',
      localHour: 16, localMinute: 30,
      title: `Pause and pray, ${name} 🕊️`,
      message: 'Your devotional has a prayer for this moment. Take 2 minutes with God.',
      data: {
        deep_link: `sifia://devotionals/${primaryDevotional.id}`,
        devotional_id: primaryDevotional.id,
      },
      priority: 'normal',
    });
  }

  // ── 16:45  usage_room_devotional ────────────────────────────────────────────
  if (lowDevotionals) {
    candidates.push({
      type: 'usage_room_devotional',
      localHour: 16, localMinute: 45,
      title: `${devotionalQuota} devotional${devotionalQuota === 1 ? '' : 's'} left this cycle, ${name} ⏳`,
      message: 'Use them before they reset. Create a devotional while you still have room.',
      data: { deep_link: 'sifia://devotionals/new', remaining: devotionalQuota },
      priority: 'low',
    });
  }

  // ── 17:00  usage_room_playbook ──────────────────────────────────────────────
  if (lowPlaybooks) {
    candidates.push({
      type: 'usage_room_playbook',
      localHour: 17, localMinute: 0,
      title: `${playbookQuota} playbook${playbookQuota === 1 ? '' : 's'} left this cycle, ${name} ⏳`,
      message: 'Room is available — create your next playbook before the cycle resets.',
      data: { deep_link: 'sifia://playbooks/new', remaining: playbookQuota },
      priority: 'low',
    });
  }

  // ── 17:15  heart_journal_prompt ─────────────────────────────────────────────
  candidates.push({
    type: 'heart_journal_prompt',
    localHour: 17, localMinute: 15,
    title: `What's on your heart, ${name}? ❤️`,
    message: 'The heart journal is a safe space. Write freely — God sees and hears every word.',
    data: { deep_link: 'sifia://dashboard?openGuidedReflection=true' },
    priority: 'normal',
  });

  // ── 17:45  journal_gratitude ────────────────────────────────────────────────
  // (cancel-at-send if already filled)
  candidates.push({
    type: 'journal_gratitude',
    localHour: 17, localMinute: 45,
    title: `Grateful hearts attract blessings, ${name} 🌟`,
    message: "What's one thing God did for you today? Write it before the evening slips away.",
    data: { deep_link: 'sifia://journal/gratitude', check_before_send: true },
    priority: 'normal',
  });

  // ── 19:00  devotional_verse_revisit ─────────────────────────────────────────
  if (hasActiveDevotional && primaryDevotional?.verseReference) {
    candidates.push({
      type: 'devotional_verse_revisit',
      localHour: 19, localMinute: 0,
      title: `Carry this verse into the evening, ${name} 📖`,
      message: primaryDevotional.verseReference
        ? `${primaryDevotional.verseReference} — let it settle in your heart tonight.`
        : 'Revisit the scripture from your devotional. Let it close your evening.',
      data: {
        deep_link: `sifia://devotionals/${primaryDevotional.id}`,
        devotional_id: primaryDevotional.id,
      },
      priority: 'low',
    });
  }

  // ── 19:15  playbook_verse_revisit ───────────────────────────────────────────
  if (playbook?.bibleVerseReference) {
    candidates.push({
      type: 'playbook_verse_revisit',
      localHour: 19, localMinute: 15,
      title: `Meditate on this tonight, ${name} ✨`,
      message: `${playbook.bibleVerseReference} — your playbook verse is worth returning to.`,
      data: {
        deep_link: `sifia://playbooks/${playbook.id}/walkthrough/verse`,
        playbook_id: playbook.id,
      },
      priority: 'low',
    });
  }

  // ── 19:30  devotional_completed_reflection ───────────────────────────────────
  if (completedDevotionals.length > 0 && !hasActiveDevotional) {
    const latest = completedDevotionals[0];
    candidates.push({
      type: 'devotional_completed_reflection',
      localHour: 19, localMinute: 30,
      title: `You finished a devotional, ${name} 🎉`,
      message: `Look back on what God showed you in "${latest?.title || 'your devotional'}". Write a reflection to close it well.`,
      data: {
        deep_link: `sifia://devotionals/${latest?.id}`,
        devotional_id: latest?.id,
      },
      priority: 'low',
    });
  }

  // ── 19:45  content_refresh_wait ─────────────────────────────────────────────
  if (noCreationRoom) {
    candidates.push({
      type: 'content_refresh_wait',
      localHour: 19, localMinute: 45,
      title: `Creation room refreshes soon, ${name} 🔄`,
      message: 'Your playbook and devotional quota resets soon. Use your journal and prayer time while you wait.',
      data: { deep_link: 'sifia://journal' },
      priority: 'low',
    });
  }

  // ── 20:00  upgrade_room ─────────────────────────────────────────────────────
  if (noCreationRoom && isFreeTier) {
    candidates.push({
      type: 'upgrade_room',
      localHour: 20, localMinute: 0,
      title: `Want more room to grow, ${name}? 🌱`,
      message: 'Upgrade to unlock unlimited playbooks and devotionals — no waiting for resets.',
      data: { deep_link: 'sifia://subscription/upgrade' },
      priority: 'low',
    });
  }

  // ── 20:15  journal_todays_win ────────────────────────────────────────────────
  // (cancel-at-send if already filled)
  candidates.push({
    type: 'journal_todays_win',
    localHour: 20, localMinute: 15,
    title: `Celebrate your win, ${name} 🏆`,
    message: 'Every day holds a victory worth naming. What was yours today?',
    data: { deep_link: 'sifia://journal/win', check_before_send: true },
    priority: 'normal',
  });

  // ── 20:45  playbook_word_to_speak (evening) ──────────────────────────────────
  if (hasWordToSpeak && playbook) {
    const word = truncate(playbook.word_to_speak, 90);
    candidates.push({
      type: 'playbook_word_to_speak_evening',
      localHour: 20, localMinute: 45,
      title: `End today with the truth, ${name} 🌙`,
      message: `One more time before you rest: "${word}"`,
      data: { deep_link: `sifia://playbooks/${playbook.id}/walkthrough/words`, playbook_id: playbook.id },
      priority: 'high',
    });
  }

  // ── 21:15  journal_looking_forward ──────────────────────────────────────────
  // (cancel-at-send if already filled)
  candidates.push({
    type: 'journal_looking_forward',
    localHour: 21, localMinute: 15,
    title: `Looking forward, ${name} 🌙`,
    message: 'What are you trusting God for tomorrow? Write it and sleep in faith.',
    data: { deep_link: 'sifia://journal/looking-forward', check_before_send: true },
    priority: 'normal',
  });

  // ── 21:30  devotional_reflection_prompt ─────────────────────────────────────
  if (hasActiveDevotional && primaryDevotional?.hasReflectionQuestion) {
    candidates.push({
      type: 'devotional_reflection_prompt',
      localHour: 21, localMinute: 30,
      title: `Reflect before you rest, ${name} 🌿`,
      message: primaryDevotional.reflectionQuestion
        ? `Question to ponder: "${truncate(primaryDevotional.reflectionQuestion, 80)}"`
        : 'Close your devotional day with a written reflection. Let the Word take root.',
      data: {
        deep_link: `sifia://devotionals/${primaryDevotional.id}/reflect`,
        devotional_id: primaryDevotional.id,
      },
      priority: 'low',
    });
  }

  // ── 21:45  playbook_prayer_revisit ──────────────────────────────────────────
  if (hasPlaybookPrayer && playbook) {
    candidates.push({
      type: 'playbook_prayer_revisit',
      localHour: 21, localMinute: 45,
      title: `Pray over your playbook tonight, ${name} 🙏`,
      message: 'Your playbook has a prayer attached to it. End the day by bringing it before God.',
      data: {
        deep_link: `sifia://playbooks/${playbook.id}/walkthrough/prayer`,
        playbook_id: playbook.id,
      },
      priority: 'low',
    });
  }

  // ── Insert all candidates ────────────────────────────────────────────────────
  let scheduled = 0;
  for (const c of candidates) {
    const scheduledForTime = scheduledFor(c.localHour, c.localMinute, timezone);
    if (!scheduledForTime) continue; // time has already passed today — skip

    const alreadyExists = await notificationExists(supabase, userId, c.type);
    if (alreadyExists) {
      console.log(`⏭️  Already scheduled: ${c.type} for ${userId}`);
      continue;
    }

    const { error } = await supabase
      .from('notification_queue')
      .insert({
        user_id: userId,
        type: c.type,
        title: c.title,
        message: c.message,
        data: c.data,
        scheduled_for: scheduledForTime,
        priority: c.priority,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error(`Failed to insert ${c.type} for ${userId}:`, error.message);
    } else {
      scheduled++;
    }
  }

  console.log(`  → Scheduled ${scheduled} notifications for user ${userId} (tz: ${timezone})`);
  return scheduled;
}

// ─── Timezone helper ──────────────────────────────────────────────────────────

/**
 * Returns a UTC ISO string for today's `localHour:localMinute` in the given timezone.
 * Returns null if that time has already passed (skip scheduling).
 *
 * The trick: toLocaleString('en-US', {timeZone}) returns a locale string that,
 * when re-parsed via new Date(), represents the same "wall clock" value but in
 * the machine's local time. The difference between the UTC-zone and target-zone
 * results gives us the UTC offset in ms, which we use to shift between
 * coordinate systems.
 */
function scheduledFor(localHour: number, localMinute: number, timezone: string): string | null {
  const nowUtc = new Date();
  const utcStr   = nowUtc.toLocaleString('en-US', { timeZone: 'UTC' });
  const localStr = nowUtc.toLocaleString('en-US', { timeZone: timezone });
  const offsetMs = new Date(localStr).getTime() - new Date(utcStr).getTime();

  // Express "now" in the local timezone coordinate system
  const localNow = new Date(nowUtc.getTime() + offsetMs);
  const y = localNow.getUTCFullYear();
  const m = localNow.getUTCMonth();
  const d = localNow.getUTCDate();

  // Target: today at localHour:localMinute in the user's timezone → expressed in UTC
  const targetLocal = new Date(Date.UTC(y, m, d, localHour, localMinute, 0, 0));
  const targetUtc   = new Date(targetLocal.getTime() - offsetMs);

  // Skip if already passed (2-min grace window)
  if (targetUtc.getTime() < nowUtc.getTime() - 2 * 60 * 1000) {
    return null;
  }

  return targetUtc.toISOString();
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Returns true if a pending notification of this type was already created
 * in the last 20 hours for this user (prevents double-scheduling from two
 * cron runs in the same day).
 */
async function notificationExists(supabase: SupabaseClient, userId: string, type: string): Promise<boolean> {
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('notification_queue')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('status', 'pending')
    .gte('created_at', since)
    .limit(1);
  return !!(data && data.length > 0);
}

// ─── Database helpers ─────────────────────────────────────────────────────────

/**
 * Get the user's timezone from notification_preferences, then user_profiles.
 * Defaults to 'UTC' (not a specific country) since subscribers are global.
 */
async function getUserTimezone(supabase: SupabaseClient, userId: string): Promise<string> {
  try {
    // 1. Check notification_preferences first (set by the device at opt-in time)
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('timezone')
      .eq('user_id', userId)
      .single();
    if (prefs?.timezone) return prefs.timezone;

    // 2. Fallback: user_profiles.timezone (set during onboarding or profile setup)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('timezone')
      .eq('id', userId)
      .single();
    if (profile?.timezone) return profile.timezone;
  } catch {
    // ignore
  }

  // 3. Final fallback: UTC. Do NOT assume a country — users are global.
  return 'UTC';
}

interface DevotionalInfo {
  id: string;
  title?: string;
  completed: boolean;
  verseReference?: string;
  hasPrayerToComplete?: boolean;
  hasReflectionQuestion?: boolean;
  reflectionQuestion?: string;
}

async function getDevotionals(supabase: SupabaseClient, userId: string): Promise<DevotionalInfo[]> {
  try {
    const { data } = await supabase
      .from('user_devotionals')
      .select('id, title, completed, current_day, days')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!data) return [];

    return data.map((d: any) => {
      const days = Array.isArray(d.days) ? d.days : [];
      const currentDay = days.find((day: any) => !day.completed) || days[0] || null;
      const verse = currentDay?.scripture?.reference || currentDay?.verse_reference;
      const questions = currentDay?.reflectionQuestions || [];
      const firstQuestion = questions[0]?.text || null;
      const hasPrayer = !!(currentDay?.prayer && currentDay.prayer.trim().length > 0);

      return {
        id: d.id,
        title: d.title,
        completed: !!d.completed,
        verseReference: verse || null,
        hasPrayerToComplete: hasPrayer,
        hasReflectionQuestion: firstQuestion !== null,
        reflectionQuestion: firstQuestion,
      };
    });
  } catch {
    return [];
  }
}

interface PlaybookInfo {
  id: string;
  title?: string;
  word_to_speak?: string;
  firstReflectionLine?: string;
  secondReflectionLine?: string;
  bibleVerseReference?: string;
  prayer?: string;
  nextActionText?: string;
  hasIncompleteAction: boolean;
  isCompleted: boolean;
}

async function getActivePlaybook(supabase: SupabaseClient, userId: string): Promise<PlaybookInfo | null> {
  try {
    const { data } = await supabase
      .from('playbooks')
      .select(`
        id, title, status, completed_at,
        word_to_speak, direct_challenge, prayer,
        bible_verse, bible_verse_reflection,
        playbook_action_steps ( id, text, completed, order_index )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!data || data.length === 0) return null;

    // Prefer an in-progress playbook
    const ongoing = data.find((p: any) => !p.completed_at && p.status !== 'completed');
    const completed = data.find((p: any) => p.completed_at || p.status === 'completed');
    const pb = ongoing || completed;
    if (!pb) return null;

    // Word to speak (column or piggybacked in direct_challenge)
    let wordToSpeak = typeof pb.word_to_speak === 'string' ? pb.word_to_speak.trim() : '';
    if (!wordToSpeak) {
      try {
        const dc = typeof pb.direct_challenge === 'string'
          ? JSON.parse(pb.direct_challenge)
          : pb.direct_challenge;
        wordToSpeak = (dc?.wordToSpeak || '').toString().trim();
      } catch { /* ignore */ }
    }

    // Reflection lines (column or inside bible_verse JSONB)
    const rawReflection = pb.bible_verse_reflection || pb.bible_verse?.reflection || '';
    const reflectionLines = (typeof rawReflection === 'string' ? rawReflection : '')
      .split(/\n+/)
      .map((l: string) => l.trim())
      .filter(Boolean);

    // Bible verse reference
    const bibleVerseReference = pb.bible_verse?.reference || null;

    // Action steps
    const steps: any[] = pb.playbook_action_steps || [];
    steps.sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const incompleteStep = steps.find((s: any) => !s.completed);
    const hasIncompleteAction = !!incompleteStep;
    const nextActionText = incompleteStep?.text || null;

    const isCompleted = !!(pb.completed_at || pb.status === 'completed');

    return {
      id: pb.id,
      title: pb.title,
      word_to_speak: wordToSpeak || undefined,
      firstReflectionLine: reflectionLines[0],
      secondReflectionLine: reflectionLines[1],
      bibleVerseReference: bibleVerseReference || undefined,
      prayer: typeof pb.prayer === 'string' ? pb.prayer.trim() : undefined,
      nextActionText: nextActionText || undefined,
      hasIncompleteAction,
      isCompleted,
    };
  } catch {
    return null;
  }
}

interface PrayerRequest {
  id: string;
  person_name?: string;
}

async function getPendingPrayerRequests(supabase: SupabaseClient, userId: string): Promise<PrayerRequest[]> {
  try {
    const { data } = await supabase
      .from('prayers')
      .select('id, person_name')
      .eq('user_id', userId)
      .eq('is_prayer_request', true)
      .or('prayed.is.null,prayed.eq.false')
      .order('created_at', { ascending: true })
      .limit(10);
    return (data || []) as PrayerRequest[];
  } catch {
    return [];
  }
}

interface UnansweredPrayer {
  id: string;
  content?: string;
}

async function getUnansweredPrayers(supabase: SupabaseClient, userId: string): Promise<UnansweredPrayer[]> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('prayers')
      .select('id, content, metadata, is_prayer_request, prayer_type, journal_category')
      .eq('user_id', userId)
      .or('status.is.null,status.neq.answered')
      .lte('created_at', sevenDaysAgo)
      .limit(20);

    if (!data) return [];

    const filtered = data.filter((p: any) => {
      if (p.metadata?.track_answered !== true) return false;
      if (p.is_prayer_request === true) return false;
      if (
        p.prayer_type === 'journal' &&
        !['supplication', 'personal_prayer'].includes(p.journal_category)
      ) return false;
      return true;
    });

    return filtered.slice(0, 3) as UnansweredPrayer[];
  } catch {
    return [];
  }
}

async function checkHasPeoplePrayers(supabase: SupabaseClient, userId: string): Promise<boolean> {
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

interface SubscriptionInfo {
  tier: string;
  playbooks_remaining: number | null;
  devotionals_remaining: number | null;
}

async function getUserSubscription(supabase: SupabaseClient, userId: string): Promise<SubscriptionInfo | null> {
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('subscription_tier, playbooks_limit, playbooks_used, devotionals_limit, devotionals_used')
      .eq('id', userId)
      .single();

    if (!data) return null;

    const tier = data.subscription_tier || 'seeker';
    const pbLimit = data.playbooks_limit ?? null;
    const pbUsed  = data.playbooks_used ?? 0;
    const dvLimit = data.devotionals_limit ?? null;
    const dvUsed  = data.devotionals_used ?? 0;

    return {
      tier,
      playbooks_remaining:  pbLimit === null || pbLimit < 0 ? null : Math.max(0, pbLimit - pbUsed),
      devotionals_remaining: dvLimit === null || dvLimit < 0 ? null : Math.max(0, dvLimit - dvUsed),
    };
  } catch {
    return null;
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function truncate(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > maxLength ? clean.substring(0, maxLength - 1) + '…' : clean;
}

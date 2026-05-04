import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Daily notification schedule (user local time) ────────────────────────────
//
//  Copy matches notificationCopyBank.ts exactly.
//  Deep links match the confirmed link map.
//
//  06:00  prayer_today
//  06:30  devotional_day_ready              skip-if: no active devotional
//  07:30  journal_todays_focus              cancel-at-send: filled
//  10:00  playbook_word_to_speak_morning    skip-if: no word_to_speak
//  10:30  playbook_verse_reflection_morning skip-if: no reflection lines
//  11:00  playbook_faithful_action          skip-if: no incomplete action
//  12:00  journal_todo                      cancel-at-send: todos done
//  12:30  prayer_request_care              skip-if: no pending requests
//  12:45  prayer_answered_check            skip-if: no trackable unanswered prayers
//  14:00  playbook_word_to_speak_afternoon  skip-if: no word_to_speak
//  14:15  playbook_verse_reflection_afternoon skip-if: no reflection lines
//  14:45  journal_inactivity               cancel-at-send: any entry today
//  15:00  prayer_people_nudge              skip-if: already has people prayers
//  15:30  create_playbook                  skip-if: has ongoing playbook or no quota
//  15:45  create_first_devotional /        skip-if: conditions not met
//         create_devotional
//  16:00  playbook_to_devotional           skip-if: conditions not met
//  16:30  devotional_prayer_prompt         skip-if: no active devotional w/ prayer
//  16:45  usage_room_devotional            skip-if: quota not low
//  17:00  usage_room_playbook              skip-if: quota not low
//  17:15  heart_journal_prompt
//  17:45  journal_gratitude                cancel-at-send: filled
//  19:00  devotional_verse_revisit         skip-if: no active devotional w/ verse
//  19:15  playbook_verse_revisit           skip-if: no playbook w/ bible verse
//  19:30  devotional_completed_reflection  skip-if: no completed devotionals
//  19:45  content_refresh_wait             skip-if: has remaining quota
//  20:00  upgrade_room                     skip-if: already premium or has quota
//  20:15  journal_todays_win               cancel-at-send: filled
//  20:45  playbook_word_to_speak_evening   skip-if: no word_to_speak
//  21:15  journal_looking_forward          cancel-at-send: filled
//  21:30  devotional_reflection_prompt     skip-if: no active devotional w/ question
//  21:45  playbook_prayer_revisit          skip-if: no active playbook w/ prayer
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

// ─── Candidate shape ──────────────────────────────────────────────────────────

interface Candidate {
  type: string;
  localHour: number;
  localMinute: number;
  title: string;
  message: string;
  data: Record<string, unknown>;
  priority: 'high' | 'normal' | 'low';
}

// ─── Copy helpers (mirror notificationCopyBank.ts) ────────────────────────────

const compact = (str: string, max = 200): string => {
  if (!str) return '';
  str = str.replace(/\s+/g, ' ').trim();
  return str.length > max ? str.substring(0, max - 3) + '...' : str;
};

const getPrayerSnippet = (content: string, max = 60): string => {
  if (!content) return '';
  const commonOpenings = [
    'heavenly father',
    'dear god',
    'dear lord',
    'lord',
    'father god',
    'god',
    'dear jesus',
    'jesus',
    'almighty god',
    'gracious father',
  ];
  
  let text = content.replace(/\s+/g, ' ').trim();
  
  // Skip common opening phrases
  const lowerText = text.toLowerCase();
  for (const opening of commonOpenings) {
    if (lowerText.startsWith(opening)) {
      // Remove the opening and any following comma/period
      text = text.substring(opening.length).replace(/^[\s,.\-]+/, '').trim();
      break;
    }
  }
  
  // If still empty after removing openings, return the original truncated
  if (!text) {
    text = content.replace(/\s+/g, ' ').trim();
  }
  
  return text.length > max ? text.substring(0, max - 3) + '...' : text;
};

const plural = (n: number, s: string, p = `${s}s`): string => (n === 1 ? s : p);

// ─── Core scheduler ───────────────────────────────────────────────────────────

async function scheduleForUser(supabase: SupabaseClient, userId: string, name: string): Promise<number> {
  // Single round-trip: fetch all context in parallel
  const [timezone, devotionals, playbook, prayerRequests, unansweredPrayers, hasPeoplePrayers, subscription] =
    await Promise.all([
      getUserTimezone(supabase, userId),
      getDevotionals(supabase, userId),
      getActivePlaybook(supabase, userId),
      getPendingPrayerRequests(supabase, userId),
      getUnansweredPrayers(supabase, userId),
      checkHasPeoplePrayers(supabase, userId),
      getUserSubscription(supabase, userId),
    ]);

  const activeDevotionals    = devotionals.filter(d => !d.completed);
  const completedDevotionals = devotionals.filter(d => d.completed);
  const primaryDev           = activeDevotionals[0] ?? null;
  const hasActiveDevotional  = !!primaryDev;

  const hasWordToSpeak      = !!(playbook?.word_to_speak);
  const hasReflectionLines  = (playbook?.reflectionLines?.length ?? 0) > 0;
  const hasPlaybookPrayer   = !!(playbook?.prayer);
  const hasIncompleteAction = !!(playbook?.hasIncompleteAction);
  const hasActivePlaybook   = !!playbook && !playbook.isCompleted;

  // A completed playbook that hasn't been turned into a devotional yet
  const completedPBNoDevotional = (playbook?.isCompleted && !playbook.hasDevotional) ? playbook : null;

  const dvRemaining = subscription?.devotionals_remaining ?? null;
  const pbRemaining = subscription?.playbooks_remaining   ?? null;
  const noQuota     = dvRemaining === 0 && pbRemaining === 0;
  const lowDv       = dvRemaining !== null && dvRemaining > 0 && dvRemaining <= 5;
  const lowPb       = pbRemaining !== null && pbRemaining > 0 && pbRemaining <= 5;
  const isFreeTier  = subscription?.tier === 'seeker' || subscription?.tier === 'spark';

  // Day-of-week used for copy rotation (matches notificationCopyBank.ts)
  const dow = new Date().getDay();

  const candidates: Candidate[] = [];
  const add = (c: Candidate) => candidates.push(c);

  // ── 06:00  prayer_today ───────────────────────────────────────────────────
  add({
    type: 'prayer_today',
    localHour: 6, localMinute: 0,
    title: `Good morning, ${name} 🙏🏼`,
    message: 'Begin the day in prayer. Bring what\'s on your heart before God.',
    data: { deep_link: 'sifia://journal/prayer' },
    priority: 'high',
  });

  // ── 06:30  devotional_day_ready ──────────────────────────────────────────
  if (primaryDev) {
    const isSingleDay = (primaryDev.totalDays ?? 0) === 1;
    let dayLabel: string;

    if (isSingleDay) {
      dayLabel = `Your devotional "${primaryDev.title || 'Your devotional'}"`;
    } else {
      dayLabel = primaryDev.currentDayNumber
        ? (primaryDev.currentDayTitle
          ? `Day ${primaryDev.currentDayNumber}: ${primaryDev.currentDayTitle}`
          : `Day ${primaryDev.currentDayNumber}`)
        : 'Your devotional';
    }

    add({
      type: 'devotional_day_ready',
      localHour: 6, localMinute: 30,
      title: `Good morning, ${name}! 🌅`,
      message: compact(`${dayLabel} is ready when you are.`),
      data: {
        deep_link: `sifia://devotionals/${primaryDev.id}/day/${primaryDev.currentDayNumber ?? 1}`,
        devotional_id: primaryDev.id,
        day_number: primaryDev.currentDayNumber,
      },
      priority: 'normal',
    });
  }

  // ── 07:30  journal_todays_focus ──────────────────────────────────────────
  add({
    type: 'journal_todays_focus',
    localHour: 7, localMinute: 30,
    title: `What's your focus today, ${name}? 🎯`,
    message: 'Set your intention before the day runs away. One clear focus changes everything.',
    data: { deep_link: 'sifia://journal/focus', check_before_send: true },
    priority: 'normal',
  });

  // ── 10:00  playbook_word_to_speak (morning) ──────────────────────────────
  if (hasWordToSpeak && playbook) {
    add({
      type: 'playbook_word_to_speak_morning',
      localHour: 10, localMinute: 0,
      title: `Speak it out loud, ${name} 💬`,
      message: compact((playbook.word_to_speak || '').split('\n')[0] || 'One word from your playbook is ready to speak over yourself.'),
      data: {
        deep_link: `sifia://playbooks/${playbook.id}/walkthrough/speak`,
        playbook_id: playbook.id,
      },
      priority: 'high',
    });
  }

  // ── 10:30  playbook_verse_reflection (morning) ───────────────────────────
  if (hasReflectionLines && playbook) {
    add({
      type: 'playbook_verse_reflection_morning',
      localHour: 10, localMinute: 30,
      title: `Meditate on this, ${name} 💎`,
      message: compact(playbook.reflectionLines[0] || 'Revisit the reflection from your Scripture anchor today.'),
      data: {
        deep_link: `sifia://playbooks/${playbook.id}/walkthrough/verse`,
        playbook_id: playbook.id,
      },
      priority: 'normal',
    });
  }

  // ── 11:00  playbook_faithful_action ─────────────────────────────────────
  if (hasIncompleteAction && playbook) {
    const faithfulTitles = [
      'Take one faithful step 🩵',
      'Return to your next step 🩵',
      'Come back to the step in front of you 🩵',
    ];
    add({
      type: 'playbook_faithful_action',
      localHour: 11, localMinute: 0,
      title: faithfulTitles[dow % faithfulTitles.length],
      message: compact(playbook.nextActionText || 'One action from your playbook is ready for today.'),
      data: {
        deep_link: `sifia://playbooks/${playbook.id}/walkthrough/actions/${playbook.nextActionIndex ?? 0}`,
        playbook_id: playbook.id,
      },
      priority: 'normal',
    });
  }

  // ── 12:00  journal_todo ──────────────────────────────────────────────────
  add({
    type: 'journal_todo',
    localHour: 12, localMinute: 0,
    title: `Midday check-in, ${name} 📋`,
    message: 'Take a moment to review what needs your attention today.',
    data: { deep_link: 'sifia://journal/todos', check_before_send: true },
    priority: 'low',
  });

  // ── 12:30  prayer_request_care ───────────────────────────────────────────
  if (prayerRequests.length > 0) {
    const count = prayerRequests.length;
    const firstNames = prayerRequests
      .map(r => (r.person_name || '').split(' ')[0])
      .filter(Boolean);
    const firstName = firstNames[0] ?? null;
    const firstRequest = prayerRequests[0];

    const title = count >= 2
      ? `${count} people are waiting for prayer, ${name} 🙏🏼`
      : firstName
        ? `Lift up ${firstName} in prayer 🙏🏼`
        : `Lift someone up in prayer, ${name} 🙏🏼`;
    const message = count >= 2
      ? `You have ${count} prayer requests waiting. Take a moment to pray.`
      : firstName
        ? `${firstName} shared a prayer request with you. Bring this request before God today.`
        : 'Someone shared a prayer request with you. Bring this request before God today.';

    add({
      type: 'prayer_request_care',
      localHour: 12, localMinute: 30,
      title: compact(title, 58),
      message: compact(message),
      data: { deep_link: firstRequest?.id ? `sifia://prayer/${firstRequest.id}` : 'sifia://journal/prayer?tab=requests' },
      priority: 'normal',
    });
  }

  // ── 12:45  prayer_answered_check ─────────────────────────────────────────
  if (unansweredPrayers.length > 0) {
    const prayer     = unansweredPrayers[0];
    const personName = (prayer.person_name || '').split(' ')[0].trim(); // first name only
    const prayerSnippet = getPrayerSnippet(prayer.content || '', 60);
    const dateParam  = prayer.selected_date
      ? `&selectedDate=${encodeURIComponent(prayer.selected_date)}`
      : '';

    const dueCheckPoint = prayer.due_check_point || prayer.days_since_creation || 0;

    // Build message with person name or prayer snippet
    const message = personName
      ? `You've been praying for ${personName}. Would you like to mark this prayer as answered?`
      : prayerSnippet
        ? `You prayed: "${prayerSnippet}". Would you like to mark this prayer as answered?`
        : 'Would you like to mark this prayer as answered?';

    add({
      type: 'prayer_answered_check',
      localHour: 12, localMinute: 45,
      title: `Has God moved in this, ${name}? ✨`,
      message,
      data: {
        deep_link: `sifia://prayer/${prayer.id}?mode=people${dateParam ? `&${dateParam.slice(1)}` : ''}`,
        source_id: prayer.id,
        check_point: dueCheckPoint,
      },
      priority: 'normal',
    });

    // Update prayer metadata to mark this check point as notified
    await supabase
      .from('prayers')
      .update({
        metadata: {
          ...(prayer.metadata || {}),
          last_check_point: dueCheckPoint,
        },
      })
      .eq('id', prayer.id);
  }

  // ── 14:00  playbook_word_to_speak (afternoon) ────────────────────────────
  if (hasWordToSpeak && playbook) {
    add({
      type: 'playbook_word_to_speak_afternoon',
      localHour: 14, localMinute: 0,
      title: `Declare it again, ${name} 🗣️`,
      message: compact((playbook.word_to_speak || '').split('\n')[0] || 'One word from your playbook is ready to speak over yourself.'),
      data: {
        deep_link: `sifia://playbooks/${playbook.id}/walkthrough/speak`,
        playbook_id: playbook.id,
      },
      priority: 'high',
    });
  }

  // ── 14:15  playbook_verse_reflection (afternoon) ─────────────────────────
  if (hasReflectionLines && playbook) {
    const line = playbook.reflectionLines[1] ?? playbook.reflectionLines[0];
    add({
      type: 'playbook_verse_reflection_afternoon',
      localHour: 14, localMinute: 15,
      title: `Carry this with you, ${name} 📜`,
      message: compact(line || 'Revisit the reflection from your Scripture anchor today.'),
      data: {
        deep_link: `sifia://playbooks/${playbook.id}/walkthrough/verse`,
        playbook_id: playbook.id,
      },
      priority: 'normal',
    });
  }

  // ── 14:45  journal_inactivity ────────────────────────────────────────────
  add({
    type: 'journal_inactivity',
    localHour: 14, localMinute: 45,
    title: `Still here when you're ready, ${name} 💛`,
    message: 'Even a few honest words can help you return and reflect.',
    data: { deep_link: 'sifia://journal', check_before_send: true },
    priority: 'low',
  });

  // ── 15:00  prayer_people_nudge ───────────────────────────────────────────
  if (!hasPeoplePrayers) {
    add({
      type: 'prayer_people_nudge',
      localHour: 15, localMinute: 0,
      title: `Who can you pray for today, ${name}? 💙`,
      message: 'Take a moment to lift someone before God today.',
      data: { deep_link: 'sifia://journal/prayer-people' },
      priority: 'low',
    });
  }

  // ── 15:30  create_playbook ───────────────────────────────────────────────
  if (!hasActivePlaybook && pbRemaining !== 0) {
    add({
      type: 'create_playbook',
      localHour: 15, localMinute: 30,
      title: `Need to process something, ${name}? 🗺️`,
      message: "Create a new playbook for the moment you're carrying.",
      data: { deep_link: 'sifia://userinput' },
      priority: 'low',
    });
  }

  // ── 15:45  create_first_devotional / create_devotional ──────────────────
  if (!hasActiveDevotional && completedPBNoDevotional && dvRemaining !== 0) {
    const isFirst = devotionals.length === 0;
    add({
      type: isFirst ? 'create_first_devotional' : 'create_devotional',
      localHour: 15, localMinute: 45,
      title: `Take the next step, ${name} 📘`,
      message: 'Your playbook is complete. Turn it into a personalized devotional.',
      data: {
        deep_link: `sifia://playbooks/${completedPBNoDevotional.id}/walkthrough/completed`,
        playbook_id: completedPBNoDevotional.id,
      },
      priority: isFirst ? 'normal' : 'low',
    });
  }

  // ── 16:00  playbook_to_devotional ────────────────────────────────────────
  // Only show if they already have devotionals (they understand the concept)
  if (completedPBNoDevotional && hasActiveDevotional) {
    add({
      type: 'playbook_to_devotional',
      localHour: 16, localMinute: 0,
      title: 'Turn this into a devotional',
      message: 'Your playbook can become a devotional for the season you are walking through.',
      data: {
        deep_link: `sifia://playbooks/${completedPBNoDevotional.id}/walkthrough/completed`,
        playbook_id: completedPBNoDevotional.id,
      },
      priority: 'low',
    });
  }

  // ── 16:30  devotional_prayer_prompt ─────────────────────────────────────
  if (primaryDev?.hasPrayerToComplete && !primaryDev.prayerPrayed) {
    add({
      type: 'devotional_prayer_prompt',
      localHour: 16, localMinute: 30,
      title: `Pause and pray, ${name} 🙏🏼`,
      message: 'Your devotional has a prayer for this moment. Take a few minutes with God.',
      data: {
        deep_link: `sifia://devotionals/${primaryDev.id}/day/${primaryDev.currentDayNumber ?? 1}?scrollToPrayer=true`,
        devotional_id: primaryDev.id,
        day_number: primaryDev.currentDayNumber,
      },
      priority: 'normal',
    });
  }

  // ── 16:45  usage_room_devotional ─────────────────────────────────────────
  if (lowDv && dvRemaining !== null) {
    // Check if all playbooks have been turned into devotionals
    const { data: allPlaybooks } = await supabase
      .from('playbooks')
      .select('id')
      .eq('user_id', userId);
    
    const allPlaybookIds = allPlaybooks?.map((p: { id: string }) => p.id) || [];
    const { data: allDevotionals } = await supabase
      .from('devotionals')
      .select('playbook_id')
      .eq('user_id', userId)
      .in('playbook_id', allPlaybookIds);
    
    const devotionalPlaybookIds = new Set(allDevotionals?.map((d: { playbook_id: string }) => d.playbook_id) || []);
    const allPlaybooksHaveDevotional = allPlaybookIds.length > 0 && 
      allPlaybookIds.every((id: string) => devotionalPlaybookIds.has(id));
    
    if (allPlaybooksHaveDevotional && dvRemaining > 0) {
      // All playbooks are devotionals but still have quota - encourage creating new playbook
      add({
        type: 'usage_room_devotional',
        localHour: 16, localMinute: 45,
        title: 'Bring a moment here *️⃣',
        message: 'Create a new playbook for the moment you\'re carrying, then turn it into a devotional if you want to go deeper.',
        data: { deep_link: 'sifia://userinput', remaining: dvRemaining },
        priority: 'low',
      });
    } else if (allPlaybooksHaveDevotional && dvRemaining === 0) {
      // All playbooks are devotionals and no quota - send to playbook list
      add({
        type: 'usage_room_devotional',
        localHour: 16, localMinute: 45,
        title: 'There is room for more �',
        message: `You still have room for ${dvRemaining} more ${plural(dvRemaining, 'devotional')} this month.`,
        data: { deep_link: 'sifia://playbooks', remaining: dvRemaining },
        priority: 'low',
      });
    } else if (playbook) {
      // Has playbook without devotional - go to completed screen
      add({
        type: 'usage_room_devotional',
        localHour: 16, localMinute: 45,
        title: 'There is room for more �',
        message: `You still have room for ${dvRemaining} more ${plural(dvRemaining, 'devotional')} this month.`,
        data: { deep_link: `sifia://playbooks/${playbook.id}/walkthrough/completed`, remaining: dvRemaining },
        priority: 'low',
      });
    }
  }

  // ── 17:00  usage_room_playbook ───────────────────────────────────────────
  if (lowPb && pbRemaining !== null) {
    add({
      type: 'usage_room_playbook',
      localHour: 17, localMinute: 0,
      title: 'There is room for more �',
      message: `You still have room for ${pbRemaining} more ${plural(pbRemaining, 'playbook')} this month.`,
      data: { deep_link: 'sifia://userinput', remaining: pbRemaining },
      priority: 'low',
    });
  }

  // ── 17:15  heart_journal_prompt ─────────────────────────────────────────
  // Both Seeker and Paid go to guided reflection - fetch a question dynamically
  const heartJournalQuestion = 'What is one area of your life where you need to trust God more today?'; // Fallback question
  const encodedQuestion = encodeURIComponent(heartJournalQuestion);
  add({
    type: 'heart_journal_prompt',
    localHour: 17, localMinute: 15,
    title: `What's on your heart, ${name}? ❤️`,
    message: 'Take a quiet moment to reflect on a guided question.',
    data: { deep_link: `sifia://dashboard?openGuidedReflection=true&question=${encodedQuestion}` },
    priority: 'normal',
  });

  // ── 17:45  journal_gratitude ─────────────────────────────────────────────
  add({
    type: 'journal_gratitude',
    localHour: 17, localMinute: 45,
    title: `Notice God's gifts today, ${name} 🌟`,
    message: 'Name three things you want to thank God for today.',
    data: { deep_link: 'sifia://journal/gratitude', check_before_send: true },
    priority: 'normal',
  });

  // ── 19:00  devotional_verse_revisit ─────────────────────────────────────
  if (primaryDev?.verseReference) {
    const verseMsg = primaryDev.verseText
      ? `${primaryDev.verseReference} — ${primaryDev.verseText}`
      : 'A verse from your devotional is worth revisiting today.';
    add({
      type: 'devotional_verse_revisit',
      localHour: 19, localMinute: 0,
      title: `Return to this verse tonight, ${name} 📖`,
      message: compact(primaryDev.verseReference
        ? `${primaryDev.verseReference} — revisit the Scripture from your devotional and let it stay with you.`
        : 'Revisit the Scripture from your devotional and let it stay with you.'),
      data: {
        deep_link: `sifia://devotionals/${primaryDev.id}/day/${primaryDev.currentDayNumber ?? 1}`,
        devotional_id: primaryDev.id,
        day_number: primaryDev.currentDayNumber,
      },
      priority: 'low',
    });
  }

  // ── 19:15  playbook_verse_revisit ────────────────────────────────────────
  if (playbook?.bibleVerseReference) {
    const pbVerseMsg = playbook.bibleVerseText
      ? `${playbook.bibleVerseReference} — ${playbook.bibleVerseText}`
      : 'The verse from your playbook is worth carrying today.';
    add({
      type: 'playbook_verse_revisit',
      localHour: 19, localMinute: 15,
      title: `Return to this verse, ${name} ✨`,
      message: compact(pbVerseMsg),
      data: {
        deep_link: `sifia://playbooks/${playbook.id}/walkthrough/verse`,
        playbook_id: playbook.id,
      },
      priority: 'low',
    });
  }

  // ── 19:30  devotional_completed_reflection ───────────────────────────────
  if (completedDevotionals.length > 0 && !hasActiveDevotional) {
    const latest = completedDevotionals[0];
    add({
      type: 'devotional_completed_reflection',
      localHour: 19, localMinute: 30,
      title: "Reflect on today's devotional",
      message: "You finished today's devotional. What is staying with you?",
      data: {
        deep_link: `sifia://devotionals/${latest.id}`,
        devotional_id: latest.id,
      },
      priority: 'low',
    });
  }

  // ── 19:45  content_refresh_wait ──────────────────────────────────────────
  if (noQuota) {
    const refreshMsg = subscription?.nextResetDate
      ? `New creation room returns on ${subscription.nextResetDate}. Pray or revisit today's focus.`
      : "Pray, journal, or revisit a verse while you wait for more creation room.";
    add({
      type: 'content_refresh_wait',
      localHour: 19, localMinute: 45,
      title: 'Keep today simple',
      message: compact(refreshMsg),
      data: { deep_link: 'sifia://journal/focus' },
      priority: 'low',
    });
  }

  // ── 20:00  upgrade_room ──────────────────────────────────────────────────
  if (noQuota && isFreeTier) {
    add({
      type: 'upgrade_room',
      localHour: 20, localMinute: 0,
      title: 'Need more room?',
      message: 'Upgrade for more room to keep going with new playbooks and devotionals.',
      data: { deep_link: 'sifia://subscription/upgrade' },
      priority: 'low',
    });
  }

  // ── 20:15  journal_todays_win ────────────────────────────────────────────
  add({
    type: 'journal_todays_win',
    localHour: 20, localMinute: 15,
    title: `Celebrate your win, ${name} 🏆`,
    message: 'Before the day closes, name where you saw grace.',
    data: { deep_link: 'sifia://journal/win', check_before_send: true },
    priority: 'normal',
  });

  // ── 20:45  playbook_word_to_speak (evening) ──────────────────────────────
  if (hasWordToSpeak && playbook) {
    add({
      type: 'playbook_word_to_speak_evening',
      localHour: 20, localMinute: 45,
      title: `End today with this truth, ${name} 🌙`,
      message: compact((playbook.word_to_speak || '').split('\n')[0] ? `One more time before you rest: "${(playbook.word_to_speak || '').split('\n')[0]}"` : 'One more time before you rest.'),
      data: {
        deep_link: `sifia://playbooks/${playbook.id}/walkthrough/speak`,
        playbook_id: playbook.id,
      },
      priority: 'high',
    });
  }

  // ── 21:15  journal_looking_forward ──────────────────────────────────────
  add({
    type: 'journal_looking_forward',
    localHour: 21, localMinute: 15,
    title: `Looking ahead, ${name} 🌙`,
    message: 'What are you looking ahead to tomorrow? Place it before God tonight.',
    data: { deep_link: 'sifia://journal/looking-forward', check_before_send: true },
    priority: 'normal',
  });

  // ── 21:30  devotional_reflection_prompt ─────────────────────────────────
  if (primaryDev?.hasReflectionQuestion) {
    const hasReflection = await hasDevotionalReflection(supabase, userId, primaryDev.id, primaryDev.currentDayNumber ?? 1);
    if (!hasReflection) {
      const questionText = primaryDev.reflectionQuestion || '';
      const encodedQuestion = encodeURIComponent(questionText);
      add({
        type: 'devotional_reflection_prompt',
        localHour: 21, localMinute: 30,
        title: `Reflect before you rest, ${name} 🌿`,
        message: compact(primaryDev.reflectionQuestion || "Take a moment to reflect on today's question."),
        data: {
          deep_link: `sifia://devotionals/${primaryDev.id}/day/${primaryDev.currentDayNumber ?? 1}?openReflection=true&question=${encodedQuestion}&questionNumber=1`,
          devotional_id: primaryDev.id,
          day_number: primaryDev.currentDayNumber,
        },
        priority: 'normal',
      });
    }
  }

  // ── 21:45  playbook_prayer_revisit ───────────────────────────────────────
  if (hasPlaybookPrayer && playbook && !playbook.prayerPrayed) {
    add({
      type: 'playbook_prayer_revisit',
      localHour: 21, localMinute: 45,
      title: `Pause with this prayer tonight, ${name} 🙏🏼`,
      message: 'Return to the prayer from your playbook and bring it before God before you rest.',
      data: {
        deep_link: `sifia://playbooks/${playbook.id}/walkthrough/prayer`,
        playbook_id: playbook.id,
      },
      priority: 'low',
    });
  }

  // ── Insert all candidates ────────────────────────────────────────────────
  let scheduled = 0;
  for (const c of candidates) {
    const scheduledForTime = scheduledFor(c.localHour, c.localMinute, timezone);
    if (!scheduledForTime) continue; // time already passed today

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
 * Returns a UTC ISO string for today's `localHour:localMinute` in the given
 * timezone, or null if that time has already passed (skip scheduling).
 */
function scheduledFor(localHour: number, localMinute: number, timezone: string): string | null {
  const nowUtc   = new Date();
  const utcStr   = nowUtc.toLocaleString('en-US', { timeZone: 'UTC' });
  const localStr = nowUtc.toLocaleString('en-US', { timeZone: timezone });
  const offsetMs = new Date(localStr).getTime() - new Date(utcStr).getTime();

  const localNow = new Date(nowUtc.getTime() + offsetMs);
  const y = localNow.getUTCFullYear();
  const m = localNow.getUTCMonth();
  const d = localNow.getUTCDate();

  const targetLocal = new Date(Date.UTC(y, m, d, localHour, localMinute, 0, 0));
  const targetUtc   = new Date(targetLocal.getTime() - offsetMs);

  if (targetUtc.getTime() < nowUtc.getTime() - 2 * 60 * 1000) return null;
  return targetUtc.toISOString();
}

// ─── Deduplication ────────────────────────────────────────────────────────────

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

// ─── Timezone lookup ──────────────────────────────────────────────────────────

async function getUserTimezone(supabase: SupabaseClient, userId: string): Promise<string> {
  try {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('timezone')
      .eq('user_id', userId)
      .single();
    if (prefs?.timezone && prefs.timezone !== 'UTC') return prefs.timezone;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('timezone')
      .eq('id', userId)
      .single();
    if (profile?.timezone && profile.timezone !== 'UTC') return profile.timezone;
  } catch { /* ignore */ }
  return 'UTC';
}

// ─── Data interfaces ──────────────────────────────────────────────────────────

interface DevotionalInfo {
  id: string;
  title?: string;
  completed: boolean;
  totalDays?: number;
  currentDayNumber?: number;
  currentDayTitle?: string;
  verseReference?: string;
  verseText?: string;
  hasPrayerToComplete: boolean;
  hasReflectionQuestion: boolean;
  reflectionQuestion?: string;
  prayerPrayed?: boolean;
}

interface PlaybookInfo {
  id: string;
  title?: string;
  isCompleted: boolean;
  hasDevotional: boolean;
  word_to_speak?: string;
  reflectionLines: string[];
  bibleVerseReference?: string;
  bibleVerseText?: string;
  prayer?: string;
  prayerPrayed?: boolean;
  nextActionText?: string;
  nextActionIndex?: number;
  hasIncompleteAction: boolean;
}

interface PrayerRequest { id: string; person_name?: string; }

interface UnansweredPrayer {
  id: string;
  content?: string;
  person_name?: string;
  selected_date?: string;
  prayer_type?: string;
  journal_category?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
  due_check_point?: number;
  days_since_creation?: number;
}

interface SubscriptionInfo {
  tier: string;
  playbooks_remaining: number | null;
  devotionals_remaining: number | null;
  nextResetDate?: string;
}

// ─── Database helpers ─────────────────────────────────────────────────────────

async function getDevotionals(supabase: SupabaseClient, userId: string): Promise<DevotionalInfo[]> {
  try {
    const { data } = await supabase
      .from('devotionals')
      .select('id, title, completed, total_days, days, prayer_prayed')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!data) return [];

    return data.map((d: any) => {
      const days: any[] = Array.isArray(d.days) ? d.days : [];
      const currentDay  = days.find((day: any) => !day.completed) ?? days[0] ?? null;
      const dayNumber   = currentDay?.dayNumber
        ?? (currentDay ? days.indexOf(currentDay) + 1 : 1);

      const verseRef  = currentDay?.scripture?.reference ?? currentDay?.verse_reference ?? undefined;
      const verseText = currentDay?.scripture?.text       ?? currentDay?.verse_text      ?? undefined;
      const questions: any[] = currentDay?.reflectionQuestions ?? [];
      const firstQ    = questions[0]?.text ?? null;
      const hasPrayer = typeof currentDay?.prayer === 'string' && currentDay?.prayer.trim().length > 0;

      return {
        id: d.id,
        title: d.title,
        completed: !!d.completed,
        totalDays: d.total_days ?? days.length,
        currentDayNumber: dayNumber,
        currentDayTitle: currentDay?.title ?? undefined,
        verseReference: verseRef,
        verseText,
        hasPrayerToComplete: hasPrayer,
        hasReflectionQuestion: !!firstQ,
        reflectionQuestion: firstQ,
        prayerPrayed: !!d.prayer_prayed,
      };
    });
  } catch {
    return [];
  }
}

async function hasDevotionalReflection(supabase: SupabaseClient, userId: string, devotionalId: string, dayNumber: number): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('reflection_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('devotional_id', devotionalId)
      .eq('day_number', dayNumber)
      .limit(1);
    return !!(data && data.length > 0);
  } catch {
    return false;
  }
}

async function getActivePlaybook(supabase: SupabaseClient, userId: string): Promise<PlaybookInfo | null> {
  try {
    const { data } = await supabase
      .from('playbooks')
      .select(`
        id, title, status, completed_at,
        word_to_speak, direct_challenge, prayer, prayer_prayed,
        bible_verse, bible_verse_reflection,
        playbook_action_steps ( id, text, completed, order_index )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!data || data.length === 0) return null;

    // Randomly select a playbook instead of always using the newest
    const randomIndex = Math.floor(Math.random() * data.length);
    const pb = data[randomIndex];
    if (!pb) return null;

    // word_to_speak: column OR piggybacked in direct_challenge JSONB
    let wordToSpeak = typeof pb.word_to_speak === 'string' ? pb.word_to_speak.trim() : '';
    if (!wordToSpeak) {
      try {
        const dc = typeof pb.direct_challenge === 'string'
          ? JSON.parse(pb.direct_challenge) : pb.direct_challenge;
        wordToSpeak = String(dc?.wordToSpeak ?? '').trim();
      } catch { /* ignore */ }
    }

    // Reflection lines: column OR inside bible_verse JSONB
    const rawReflection: string = pb.bible_verse_reflection ?? pb.bible_verse?.reflection ?? '';
    const reflectionLines: string[] = (typeof rawReflection === 'string' ? rawReflection : '')
      .split(/\n+/)
      .map((l: string) => l.trim())
      .filter(Boolean);

    const bibleVerseReference: string | undefined = pb.bible_verse?.reference ?? undefined;
    const bibleVerseText: string | undefined       = pb.bible_verse?.text      ?? undefined;

    // Action steps
    const steps: any[] = (pb.playbook_action_steps ?? [])
      .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
    // Skip the first step (order_index 0) and find the next incomplete step
    const stepsAfterFirst = steps.filter((s: any) => (s.order_index ?? 0) > 0);
    const incompleteStep      = stepsAfterFirst.find((s: any) => !s.completed);
    const incompleteStepIndex = incompleteStep ? steps.indexOf(incompleteStep) : undefined;

    const isCompleted = !!(pb.completed_at || pb.status === 'completed');

    // For completed playbooks, check if a devotional was created from it
    let hasDevotional = false;
    if (isCompleted) {
      try {
        const { data: dvCheck } = await supabase
          .from('devotionals')
          .select('id')
          .eq('user_id', userId)
          .eq('playbook_id', pb.id)
          .limit(1);
        hasDevotional = !!(dvCheck && dvCheck.length > 0);
      } catch { /* ignore */ }
    }

    return {
      id: pb.id,
      title: pb.title,
      isCompleted,
      hasDevotional,
      word_to_speak: wordToSpeak || undefined,
      reflectionLines,
      bibleVerseReference,
      bibleVerseText,
      prayer: typeof pb.prayer === 'string' && pb.prayer.trim() ? pb.prayer.trim() : undefined,
      prayerPrayed: !!pb.prayer_prayed,
      nextActionText: incompleteStep?.text ?? undefined,
      nextActionIndex: incompleteStepIndex,
      hasIncompleteAction: !!incompleteStep,
    };
  } catch {
    return null;
  }
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
    return (data ?? []) as PrayerRequest[];
  } catch { return []; }
}

async function getUnansweredPrayers(supabase: SupabaseClient, userId: string): Promise<UnansweredPrayer[]> {
  try {
    const { data } = await supabase
      .from('prayers')
      .select('id, content, metadata, person_name, is_prayer_request, prayer_type, journal_category, selected_date, created_at')
      .eq('user_id', userId)
      .or('status.is.null,status.neq.answered')
      .limit(50);

    if (!data) return [];

    const now = new Date();
    const checkSchedule = [3, 7, 14, 21, 30, 60, 90, 120, 150, 180, 270, 360, 450, 540]; // days to check

    const filtered = (data as any[])
      .map((prayer: any) => {
      const createdAt = new Date(prayer.created_at);
      const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const dueCheckPoint = [...checkSchedule].reverse().find(checkPoint => checkPoint <= daysSinceCreation) || 0;
      const lastCheckPoint = prayer.metadata?.last_check_point || 0;
      const tracksAnswered = prayer.metadata?.track_answered === true;
      const isPrayedForEntry = prayer.is_prayer_request !== true;

      if (!isPrayedForEntry || !tracksAnswered || dueCheckPoint <= 0 || lastCheckPoint >= dueCheckPoint) {
        return null;
      }

      return {
        ...prayer,
        due_check_point: dueCheckPoint,
        days_since_creation: daysSinceCreation,
      };
    })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const aIsJournal = a.prayer_type === 'journal';
        const bIsJournal = b.prayer_type === 'journal';
        if (aIsJournal !== bIsJournal) return aIsJournal ? -1 : 1;
        if ((a.due_check_point || 0) !== (b.due_check_point || 0)) {
          return (b.due_check_point || 0) - (a.due_check_point || 0);
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    return filtered as UnansweredPrayer[];
  } catch { return []; }
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
  } catch { return true; } // on error assume yes — don't nudge unnecessarily
}

async function getUserSubscription(supabase: SupabaseClient, userId: string): Promise<SubscriptionInfo | null> {
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('subscription_tier, playbooks_limit, playbooks_used, devotionals_limit, devotionals_used, subscription_start_date, created_at')
      .eq('id', userId)
      .single();

    if (!data) return null;

    const tier    = data.subscription_tier || 'seeker';
    const pbLimit = data.playbooks_limit    ?? null;
    const pbUsed  = data.playbooks_used     ?? 0;
    const dvLimit = data.devotionals_limit  ?? null;
    const dvUsed  = data.devotionals_used   ?? 0;

    // Compute next monthly reset date
    let nextResetDate: string | undefined;
    try {
      const anchor = new Date(data.subscription_start_date || data.created_at);
      if (!Number.isNaN(anchor.getTime())) {
        const now = new Date();
        let reset = new Date(anchor);
        reset.setHours(9, 0, 0, 0);
        while (reset <= now) reset.setMonth(reset.getMonth() + 1);
        nextResetDate = reset.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
    } catch { /* ignore */ }

    return {
      tier,
      playbooks_remaining:   pbLimit === null || pbLimit < 0 ? null : Math.max(0, pbLimit - pbUsed),
      devotionals_remaining: dvLimit === null || dvLimit < 0 ? null : Math.max(0, dvLimit - dvUsed),
      nextResetDate,
    };
  } catch { return null; }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function formatNameList(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

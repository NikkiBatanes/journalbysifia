/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RefineRequest {
  playbookId: string;
  userId: string;
  userName: string;
  correctionType: string;
  clarification: string;
  bibleVersion?: string;
  dateOfBirth?: string;
}

function refinementLimitForTier(tier?: string | null): number {
  const base = String(tier || 'seeker').replace('_annual', '');
  return base === 'seeker' || base === 'free_trial' ? 1 : 2;
}

function cleanText(value: unknown, max = 800): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function buildRefinementInput(args: {
  originalInput: string;
  title: string;
  truthSummary: string;
  truthInLove: string;
  correctionType: string;
  clarification: string;
  memories: Array<{ topic: string; memory_text: string; confidence: number }>;
}): string {
  const memoryLines = args.memories
    .filter(m => Number(m.confidence) >= 0.65)
    .slice(0, 5)
    .map(m => `- ${m.memory_text}`)
    .join('\n');

  return [
    'REFINEMENT REQUEST: Revise the same playbook because the previous output missed or misunderstood part of the user\'s moment.',
    '',
    '=== PRIMARY CONTEXT (ORIGINAL MOMENT) ===',
    'PRIOR USER INPUT:',
    cleanText(args.originalInput, 1600),
    '',
    '=== ADDITIONAL CLARIFICATION ===',
    `CORRECTION TYPE: ${cleanText(args.correctionType, 120)}`,
    `USER CLARIFICATION: ${cleanText(args.clarification, 1600)}`,
    '',
    'PREVIOUS PLAYBOOK CONTEXT:',
    `Title: ${cleanText(args.title, 180)}`,
    `Truth summary: ${cleanText(args.truthSummary, 700)}`,
    `Truth in love excerpt: ${cleanText(args.truthInLove, 1400)}`,
    '',
    memoryLines ? `RELEVANT REMEMBERED CONTEXT:\n${memoryLines}\n` : '',
    '=== CRITICAL REVISION RULES ===',
    '- The PRIOR USER INPUT above is the PRIMARY CONTEXT - this is the original moment the user shared. ALL content must address this original moment first.',
    '- The USER CLARIFICATION is secondary - use it only to add missing details or correct misunderstandings about the ORIGINAL moment.',
    '- Do NOT shift focus to the clarification. The clarification is a tool to better understand the original moment, not a new moment itself.',
    '- EVERY faithful_action, prayer, and words_to_speak line MUST be grounded in the original moment. If an action/prayer/declaration could have been written without reading the PRIOR USER INPUT, it is WRONG.',
    '- The original gist, tone, and heart of the moment must be preserved. Do not lose the essence of what the user originally shared.',
    '- The truth_in_love diagnosis must be grounded in the original moment, using the clarification only to sharpen accuracy where the previous playbook missed something.',
    '- When in doubt, ALWAYS prioritize the original prompt over the clarification. The original moment is what the user is actually living through.',
    '- Do not mention that this is a revision.',
    '- Do not apologize for the previous playbook.',
    '- Generate a complete replacement playbook for the same moment.',
    '- Preserve the app format exactly.',
  ].filter(Boolean).join('\n');
}

function detectMemoryTopic(text: string): { topic: string; memoryText: string } | null {
  const lower = text.toLowerCase();
  const checks: Array<{ topic: string; patterns: RegExp[]; memoryText: string }> = [
    {
      topic: 'sisters',
      patterns: [/\bsister\b/, /\bsisters\b/, /\bsibling\b/, /\bsiblings\b/],
      memoryText: 'User has repeatedly brought up pain or conflict involving sisters or siblings.',
    },
    {
      topic: 'family_conflict',
      patterns: [/\bfamily\b/, /\bmother\b/, /\bfather\b/, /\bparent\b/, /\bparents\b/],
      memoryText: 'User often needs family dynamics considered when interpreting relational pain.',
    },
    {
      topic: 'marriage',
      patterns: [/\bmarriage\b/, /\bhusband\b/, /\bwife\b/, /\bspouse\b/],
      memoryText: 'User has recurring concerns connected to marriage or spouse dynamics.',
    },
    {
      topic: 'work_stress',
      patterns: [/\bwork\b/, /\bjob\b/, /\bcareer\b/, /\bboss\b/, /\bcoworker\b/],
      memoryText: 'User has recurring concerns connected to work, career, or workplace stress.',
    },
  ];

  return checks.find(check => check.patterns.some(pattern => pattern.test(lower))) || null;
}

async function updateMemoryItem(supabase: any, userId: string, text: string) {
  const detected = detectMemoryTopic(text);
  if (!detected) return;

  const { data: existing } = await supabase
    .from('user_memory_items')
    .select('id, confidence, source_count')
    .eq('user_id', userId)
    .eq('memory_type', 'recurring_theme')
    .eq('topic', detected.topic)
    .maybeSingle();

  if (existing?.id) {
    const nextCount = Number(existing.source_count || 1) + 1;
    const nextConfidence = Math.min(0.9, Number(existing.confidence || 0.5) + 0.12);
    await supabase
      .from('user_memory_items')
      .update({
        source_count: nextCount,
        confidence: nextConfidence,
        memory_text: detected.memoryText,
        status: 'active',
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return;
  }

  await supabase
    .from('user_memory_items')
    .insert({
      user_id: userId,
      memory_type: 'recurring_theme',
      topic: detected.topic,
      memory_text: detected.memoryText,
      confidence: 0.55,
      source_count: 1,
      status: 'active',
      metadata: { source: 'playbook_refinement' },
    });
}

function directChallengeToSave(result: any): Record<string, unknown> {
  const raw = result.directChallenge;
  const base: Record<string, unknown> =
    raw && typeof raw === 'object'
      ? { ...raw }
      : { text: typeof raw === 'string' ? raw : '', summary: '' };

  if (result.prayer) base.prayer = result.prayer;
  if (result.wordToSpeak) base.wordToSpeak = result.wordToSpeak;
  if (result.faithfulActionsIntro) base.faithfulActionsIntro = result.faithfulActionsIntro;
  return base;
}

function actionRows(result: any, playbookId: string) {
  const actions = Array.isArray(result.actionSteps) ? result.actionSteps : [];
  return actions.map((step: any, index: number) => {
    const meta: Record<string, unknown> = { __meta: true };
    if (step.actionType) meta.actionType = step.actionType;
    if (step.primaryButton) meta.primaryButton = step.primaryButton;
    if (step.secondaryButton) meta.secondaryButton = step.secondaryButton;
    if (step.description) meta.description = step.description;
    if (step.examples) meta.examples = Array.isArray(step.examples) ? step.examples.join('; ') : step.examples;

    return {
      id: step.id || crypto.randomUUID(),
      playbook_id: playbookId,
      text: step.title || `Faithful Action ${index + 1}`,
      examples: JSON.stringify(meta),
      completed: false,
      order_index: index,
      example_interactive: Boolean(step.example_interactive),
    };
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Invalid request method' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json() as RefineRequest;
    const playbookId = cleanText(body.playbookId, 80);
    const userId = cleanText(body.userId, 80);
    const userName = cleanText(body.userName, 120) || 'Friend';
    const correctionType = cleanText(body.correctionType, 120) || 'missing_detail';
    const clarification = cleanText(body.clarification, 2000);

    if (!playbookId || !userId || clarification.length < 8) {
      return new Response(
        JSON.stringify({ error: 'INVALID_REFINEMENT', message: 'Please share what siFia missed before refining.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: subscription } = await supabase
      .from('user_subscriptions_new')
      .select('tier')
      .eq('user_id', userId)
      .maybeSingle();
    const tier = subscription?.tier || 'seeker';
    const refinementLimit = refinementLimitForTier(tier);

    const { data: playbook, error: playbookError } = await supabase
      .from('playbooks')
      .select('*')
      .eq('id', playbookId)
      .eq('user_id', userId)
      .single();

    if (playbookError || !playbook) {
      return new Response(JSON.stringify({ error: 'PLAYBOOK_NOT_FOUND', message: 'Playbook not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const used = Number(playbook.refinement_count || 0);
    if (used >= refinementLimit) {
      return new Response(
        JSON.stringify({
          error: 'REFINEMENT_LIMIT_REACHED',
          message: refinementLimit === 1
            ? 'You have used the refinement for this playbook.'
            : 'You have used both refinements for this playbook.',
          refinementCount: used,
          refinementLimit,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: oldActions } = await supabase
      .from('playbook_action_steps')
      .select('*, playbook_sub_tasks(*)')
      .eq('playbook_id', playbookId)
      .order('order_index', { ascending: true });

    const { data: oldAffirmations } = await supabase
      .from('playbook_affirmations')
      .select('*')
      .eq('playbook_id', playbookId)
      .order('order_index', { ascending: true });

    const currentVersion = Number(playbook.active_version || 1);
    await supabase
      .from('playbook_versions')
      .upsert({
        playbook_id: playbookId,
        user_id: userId,
        version_number: currentVersion,
        snapshot: {
          playbook,
          action_steps: oldActions || [],
          affirmations: oldAffirmations || [],
        },
        refinement_type: correctionType,
        refinement_note: clarification,
      }, { onConflict: 'playbook_id,version_number', ignoreDuplicates: true });

    const truth = playbook.truth_in_love && typeof playbook.truth_in_love === 'object'
      ? playbook.truth_in_love
      : { text: String(playbook.truth_in_love || ''), summary: '' };

    const { data: memories } = await supabase
      .from('user_memory_items')
      .select('topic, memory_text, confidence')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('confidence', { ascending: false })
      .limit(5);

    const refinementInput = buildRefinementInput({
      originalInput: playbook.user_input || '',
      title: playbook.title || '',
      truthSummary: truth.summary || '',
      truthInLove: truth.text || '',
      correctionType,
      clarification,
      memories: memories || [],
    });

    const authHeader = req.headers.get('authorization') || `Bearer ${anonKey}`;
    const generationResponse = await fetch(`${supabaseUrl}/functions/v1/generate-guided-playbook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        userInput: refinementInput,
        userName,
        userId,
        bibleVersion: body.bibleVersion || 'NASB',
        userTier: tier,
        isOnboarding: false,
        dateOfBirth: body.dateOfBirth,
      }),
    });

    const generationText = await generationResponse.text();
    if (!generationResponse.ok) {
      return new Response(generationText, {
        status: generationResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const generated = JSON.parse(generationText);
    const newActionRows = actionRows(generated, playbookId);
    if (newActionRows.length === 0) {
      throw new Error('Generated playbook did not include action steps');
    }

    const oldActionIds = (oldActions || []).map((action: any) => action.id).filter(Boolean);

    // Delete old actions first to avoid duplicate key conflicts
    if (oldActionIds.length > 0) {
      const { error: deleteSubTasksError } = await supabase
        .from('playbook_sub_tasks')
        .delete()
        .in('action_step_id', oldActionIds);

      if (deleteSubTasksError) {
        throw deleteSubTasksError;
      }

      const { error: deleteActionsError } = await supabase
        .from('playbook_action_steps')
        .delete()
        .in('id', oldActionIds);

      if (deleteActionsError) {
        throw deleteActionsError;
      }
    }

    // Now insert new actions with no conflict
    const { error: insertActionsError } = await supabase
      .from('playbook_action_steps')
      .insert(newActionRows);

    if (insertActionsError) {
      throw insertActionsError;
    }

    // Clean up stale affirmations so refined content doesn't accumulate orphaned rows
    await supabase
      .from('playbook_affirmations')
      .delete()
      .eq('playbook_id', playbookId);

    const bibleVerseToSave = {
      ...(generated.bibleVerse || {}),
      ...(generated.bibleVerseReflection ? { reflection: generated.bibleVerseReflection } : {}),
    };

    const nextVersion = currentVersion + 1;
    const refinedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('playbooks')
      .update({
        title: generated.title,
        category: generated.category || playbook.category || null,
        truth_in_love: generated.truthInLove,
        bible_verse: bibleVerseToSave,
        direct_challenge: directChallengeToSave(generated),
        challenge_cta: generated.challengeCTA || '',
        transition_line: generated.transitionLine || '',
        refinement_count: used + 1,
        last_refined_at: refinedAt,
        active_version: nextVersion,
        latest_refinement_note: clarification,
        updated_at: refinedAt,
      })
      .eq('id', playbookId)
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    await supabase
      .from('playbook_refinement_feedback')
      .insert({
        playbook_id: playbookId,
        user_id: userId,
        from_version: currentVersion,
        to_version: nextVersion,
        correction_type: correctionType,
        clarification,
      });

    await updateMemoryItem(supabase, userId, `${playbook.user_input || ''}\n${clarification}`);

    const { data: updatedPlaybook } = await supabase
      .from('playbooks')
      .select('*')
      .eq('id', playbookId)
      .eq('user_id', userId)
      .single();

    return new Response(JSON.stringify({
      success: true,
      playbook: {
        ...generated,
        id: playbookId,
        user_id: userId,
        userInput: playbook.user_input || '',
        createdAt: playbook.created_at,
        updatedAt: updatedPlaybook?.updated_at || refinedAt,
        status: updatedPlaybook?.status || playbook.status,
        refinementCount: used + 1,
        refinementLimit,
        lastRefinedAt: refinedAt,
        activeVersion: nextVersion,
      },
      refinementCount: used + 1,
      refinementLimit,
      remainingRefinements: Math.max(0, refinementLimit - (used + 1)),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Refine-Guided-Playbook] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'REFINEMENT_FAILED',
        message: 'siFia could not revise this playbook right now. Your current playbook is still here. Please try again in a moment.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

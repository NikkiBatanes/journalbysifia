/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WisdomRequest {
  playbookId: string;
  userId: string;
  userName: string;
  actionId: string;
  actionTitle: string;
  actionBody: string;
  userQuestion: string;
  truthSummary: string;
  truthInLove: string;
}

function cleanText(value: unknown, max = 800): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanOutputText(value: unknown, max = 800): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\*\*/g, '')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function parseWisdomJson(content: string): { intro: string; steps: string[] } {
  try {
    const parsed = JSON.parse(content);
    const intro = cleanOutputText(parsed?.intro, 500);
    const steps = Array.isArray(parsed?.steps)
      ? parsed.steps.map((step: unknown) => cleanOutputText(step, 300)).filter(Boolean).slice(0, 5)
      : [];

    if (intro || steps.length > 0) {
      return { intro, steps };
    }
  } catch {
    // Fall through to plain-text normalization for older/non-compliant model output.
  }

  const lines = content
    .split(/\n+/)
    .map(line => cleanOutputText(line, 500))
    .filter(Boolean);
  const listStartIndex = lines.findIndex(line => /^(?:\d+(?:\.\d+)?[\.)]|[-*•])\s+/.test(line));

  if (listStartIndex === -1) {
    return { intro: cleanOutputText(content, 700), steps: [] };
  }

  return {
    intro: cleanOutputText(lines.slice(0, listStartIndex).join('\n\n'), 700),
    steps: lines
      .slice(listStartIndex)
      .filter(line => /^(?:\d+(?:\.\d+)?[\.)]|[-*•])\s+/.test(line))
      .map(line => cleanOutputText(line.replace(/^(?:\d+(?:\.\d+)?[\.)]|[-*•])\s+/, ''), 300))
      .filter(Boolean)
      .slice(0, 5),
  };
}

function formatWisdomText(wisdom: { intro: string; steps: string[] }): string {
  return [
    wisdom.intro,
    ...wisdom.steps.map((step, index) => `${index + 1}. ${step}`),
  ].filter(Boolean).join('\n\n');
}

function buildWisdomPrompt(args: {
  playbookTitle: string;
  truthSummary: string;
  truthInLove: string;
  actionTitle: string;
  actionBody: string;
  userQuestion: string;
  userName: string;
}): string {
  return [
    'WISDOM REQUEST: Provide specific, actionable wisdom for a faithful action based on the user\'s question.',
    '',
    '=== PLAYBOOK CONTEXT ===',
    `Title: ${cleanText(args.playbookTitle, 180)}`,
    `Truth summary: ${cleanText(args.truthSummary, 700)}`,
    `Truth in love excerpt: ${cleanText(args.truthInLove, 200)}`,
    '',
    '=== TARGET FAITHFUL ACTION ===',
    `Action: ${cleanText(args.actionTitle, 180)}`,
    `Description: ${cleanText(args.actionBody, 500)}`,
    '',
    '=== USER\'S QUESTION ===',
    `User asks: ${cleanText(args.userQuestion, 500)}`,
    '',
    '=== TASK ===',
    'Provide specific, actionable wisdom for this faithful action based on:',
    '1. The overall playbook context and truth diagnosis',
    '2. The specific action the user is asking about',
    '3. The user\'s specific question or concern',
    '',
    'Guidelines:',
    '- Give 2-3 concrete examples if applicable',
    '- Keep the response under 200 words',
    '- Be encouraging and practical',
    '- Address the user\'s specific concern',
    '- Use the user\'s name if natural in the response',
    '- Do not use markdown formatting, bold markers, headings, or asterisks',
    '- Put any lead-in sentence in intro, not inside steps',
    '',
    'Return ONLY valid JSON in this exact shape:',
    '{"intro":"one short encouraging lead-in sentence","steps":["actionable step one","actionable step two","actionable step three"]}',
    'Do not include any text before or after the JSON.',
  ].filter(Boolean).join('\n');
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
    const body = await req.json() as WisdomRequest;
    const playbookId = cleanText(body.playbookId, 80);
    const userId = cleanText(body.userId, 80);
    const userName = cleanText(body.userName, 120) || 'Friend';
    const actionId = cleanText(body.actionId, 80);
    const actionTitle = cleanText(body.actionTitle, 180);
    const actionBody = cleanText(body.actionBody, 500);
    const userQuestion = cleanText(body.userQuestion, 500);
    const truthSummary = cleanText(body.truthSummary, 700);
    const truthInLove = cleanText(body.truthInLove, 200);

    if (!playbookId || !userId || !actionId || userQuestion.length < 5) {
      return new Response(
        JSON.stringify({ error: 'INVALID_REQUEST', message: 'Please provide a valid question.' }),
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

    // Get playbook data
    const { data: playbook, error: playbookError } = await supabase
      .from('playbooks')
      .select('title, user_input')
      .eq('id', playbookId)
      .eq('user_id', userId)
      .single();

    if (playbookError || !playbook) {
      return new Response(JSON.stringify({ error: 'PLAYBOOK_NOT_FOUND', message: 'Playbook not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the prompt
    const prompt = buildWisdomPrompt({
      playbookTitle: playbook.title || '',
      truthSummary,
      truthInLove,
      actionTitle,
      actionBody,
      userQuestion,
      userName,
    });

    // Call OpenAI
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIKey) {
      throw new Error('Missing OpenAI API key');
    }

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAIKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are siFia, a compassionate Christian AI assistant providing practical wisdom for faithful actions. Return only valid JSON. Do not use markdown.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('[Get-Action-Guidance] OpenAI error:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI_ERROR', message: 'Could not generate wisdom right now. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const openAIdata = await openAIResponse.json();
    const rawWisdom = openAIdata.choices?.[0]?.message?.content || '';
    const parsedWisdom = parseWisdomJson(rawWisdom);
    const wisdom = formatWisdomText(parsedWisdom);

    if (!wisdom) {
      throw new Error('No wisdom generated from OpenAI');
    }

    const { data: existingStep, error: fetchStepError } = await supabase
      .from('playbook_action_steps')
      .select('wisdom_text')
      .eq('id', actionId)
      .eq('playbook_id', playbookId)
      .maybeSingle();

    if (fetchStepError) {
      console.error('[Get-Action-Guidance] Fetch existing wisdom error:', fetchStepError);
    }

    const existingWisdom = typeof existingStep?.wisdom_text === 'string' ? existingStep.wisdom_text.trim() : '';
    const updatedWisdom = existingWisdom ? `${existingWisdom}\n\n${wisdom}` : wisdom;

    // Update action step with wisdom
    const { error: updateError } = await supabase
      .from('playbook_action_steps')
      .update({
        wisdom_text: updatedWisdom,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .eq('playbook_id', playbookId);

    if (updateError) {
      console.error('[Get-Action-Guidance] Update error:', updateError);
      // Don't fail the request if update fails, just log it
    }

    return new Response(JSON.stringify({
      success: true,
      wisdom: updatedWisdom,
      actionId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Get-Action-Guidance] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'WISDOM_FAILED',
        message: 'siFia could not provide wisdom right now. Please try again in a moment.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

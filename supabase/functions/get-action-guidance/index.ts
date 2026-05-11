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
  previousWisdom?: string;
}

interface WisdomThreadEntry {
  question: string;
  wisdom: string;
}

function cleanText(value: unknown, max = 800): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanActionBody(value: unknown, max = 1500): string {
  if (typeof value !== 'string') return '';
  return value
    // Remove sub-step labels like "2.1", "2.2", "1.1", "3.4" etc.
    .replace(/\b\d+\.\d+\s*/g, '')
    // Remove standalone step numbers like "1." "2." "3." at start of a word boundary
    .replace(/\b(\d+)\.\s+/g, '')
    // Remove "WISDOM FOR THIS ACTION" header that sometimes appears inside the body
    .replace(/WISDOM FOR THIS ACTION\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
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

function parseWisdomThread(value = ''): WisdomThreadEntry[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  const matches = [...trimmed.matchAll(/User:\s*([\s\S]*?)\nsiFia:\s*([\s\S]*?)(?=\n\nUser:|$)/g)];

  return matches
    .map(match => ({
      question: cleanOutputText(match[1], 1000),
      wisdom: match[2].trim(),
    }))
    .filter(entry => entry.question && entry.wisdom);
}

function getExistingWisdomThread(persistedWisdom = '', requestWisdom = ''): WisdomThreadEntry[] {
  const persistedThread = parseWisdomThread(persistedWisdom);
  if (persistedThread.length > 0) {
    return persistedThread;
  }

  const requestThread = parseWisdomThread(requestWisdom);
  if (requestThread.length > 0) {
    return requestThread;
  }

  const legacyWisdom = cleanOutputText(persistedWisdom || requestWisdom, 2400);
  return legacyWisdom
    ? [{ question: 'Earlier wisdom', wisdom: legacyWisdom }]
    : [];
}

function serializeWisdomThread(thread: WisdomThreadEntry[]): string {
  return thread
    .map(entry => `User: ${entry.question}\nsiFia: ${entry.wisdom.trim()}`)
    .join('\n\n');
}

function isWeakWisdomAnswer(wisdom: { intro: string; steps: string[] }, userQuestion: string, actionContext = ''): boolean {
  const combined = `${wisdom.intro} ${wisdom.steps.join(' ')}`.toLowerCase();
  const question = userQuestion.toLowerCase();
  const context = actionContext.toLowerCase();

  if (wisdom.intro.length < 35 || wisdom.steps.length < 2) {
    return true;
  }

  // Check for acknowledgment phrases that don't answer the question
  const acknowledgmentPhrases = [
    'i understand that you',
    'i understand you',
    'i hear that you',
    'i see that you',
    'i recognize that you',
    'i appreciate that you',
  ];

  const hasAcknowledgmentWithoutAnswer = acknowledgmentPhrases.some(phrase => combined.includes(phrase))
    && !/\b(is|are|means|refers to|involves|focuses on|centers on|relies on|depends on|based on|differs from|distinguishes|separates|contrasts with)\b/.test(combined);

  if (hasAcknowledgmentWithoutAnswer) {
    return true;
  }

  // Check for "differentiate" or "difference" questions that aren't answered
  if (/\b(differentiate|difference|differences|what's the difference|what is the difference|how are they different)\b/.test(question)
    && !/\b(different|differs|distinguishes|separates|distinct|contrast|unlike|versus|while|whereas)\b/.test(combined)) {
    return true;
  }

  // Check for "explain" questions that aren't answered
  if (/\b(explain|what is|what does|how does|why is)\b/.test(question)
    && !/\b(is|means|refers to|involves|because|reason|causes|leads to|results in)\b/.test(combined)) {
    return true;
  }

  const vaguePhrases = [
    'pray about it',
    'reflect on',
    'seek guidance',
    'trust god',
    'lean into',
    'embrace',
  ];

  const hasOnlyVagueGuidance = vaguePhrases.some(phrase => combined.includes(phrase))
    && !/\b(say|tell|ask|write|call|text|apologize|confess|choose|stop|start|set|schedule|read)\b/.test(combined);

  if (hasOnlyVagueGuidance) {
    return true;
  }

  if (/\b(what should i say|what do i say|how do i say)\b/.test(question) && !/\b(say|tell|ask)\b/.test(combined)) {
    return true;
  }

  if (/\b(greeting|greet|opening|open with|start.*conversation|start.*talking)\b/.test(question)
    && /\b(christian|jesus|god|faith|pray|prayer|church|gospel|evangel|witness|share)\b/.test(`${question} ${context}`)
    && !/\b(jesus|god|faith|prayer|church|bless|christ)\b/.test(combined)) {
    return true;
  }

  if (/\b(what should i do|what do i do|how should i handle)\b/.test(question) && !/\b(do|choose|start|stop|ask|tell|write|call|text|set)\b/.test(combined)) {
    return true;
  }

  if (/\b(example|examples)\b/.test(question) && !/\b(for example|example|you could say|try this)\b/.test(combined)) {
    return true;
  }

  if (/\b(scripture|bible|verse|verses)\b/.test(question) && !/\b(?:[1-3]\s*)?[a-z]+\s+\d+:\d+\b/i.test(combined)) {
    return true;
  }

  if (/\b(gospel|jesus|faith|share.*faith|share.*jesus|evangel|sin|salvation)\b/.test(question)
    && !/\b(sin|separation|separated|forgive|forgiveness|cross|died|rose|resurrection|repent|trust in jesus|believe in jesus)\b/.test(combined)) {
    return true;
  }

  return false;
}

function textTokens(value: string): Set<string> {
  const stopWords = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'you', 'your', 'are', 'can', 'say', 'then', 'they',
    'them', 'what', 'when', 'from', 'into', 'have', 'will', 'about', 'would', 'could', 'should',
    'here', 'there', 'their', 'faith', 'action', 'step',
  ]);

  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 3 && !stopWords.has(token))
  );
}

function isTooSimilarToPrevious(wisdom: { intro: string; steps: string[] }, previousWisdom: string): boolean {
  if (!previousWisdom.trim()) {
    return false;
  }

  const currentTokens = textTokens(`${wisdom.intro} ${wisdom.steps.join(' ')}`);
  const previousTokens = textTokens(previousWisdom);

  if (currentTokens.size < 8 || previousTokens.size < 8) {
    return false;
  }

  let overlap = 0;
  currentTokens.forEach(token => {
    if (previousTokens.has(token)) {
      overlap += 1;
    }
  });

  return overlap / Math.min(currentTokens.size, previousTokens.size) > 0.55;
}

function buildWisdomPrompt(args: {
  playbookTitle: string;
  truthSummary: string;
  truthInLove: string;
  actionTitle: string;
  actionBody: string;
  userQuestion: string;
  userName: string;
  previousWisdom?: string;
}): string {
  return [
    'ACTION EXECUTION HELPER: Help the user carry out ONE specific faithful action. This is not general coaching.',
    '',
    '=== CONTEXT ===',
    `Playbook: ${cleanText(args.playbookTitle, 180)}`,
    `Truth: ${cleanText(args.truthSummary, 500)}`,
    '',
    '=== THE ONE ACTION THE USER NEEDS TO DO ===',
    `Action: ${cleanText(args.actionTitle, 180)}`,
    `Description: ${cleanActionBody(args.actionBody, 1500)}`,
    '',
    '=== USER\'S QUESTION ABOUT THIS ACTION ===',
    `User asks: ${cleanText(args.userQuestion, 500)}`,
    '',
    args.previousWisdom?.trim() ? '=== ALREADY TOLD THE USER ===' : '',
    args.previousWisdom?.trim() ? cleanText(args.previousWisdom, 800) : '',
    args.previousWisdom?.trim() ? 'Do not repeat this. Build on it or go deeper into the same action.' : '',
    '=== YOUR ROLE ===',
    'You are an execution helper, not a general spiritual coach.',
    'Your only job is to help the user actually DO this one specific action.',
    'The user is stuck or unclear about HOW to do this action. Help them do it.',
    '',
    '=== STRICT RULES ===',
    'DO NOT suggest other actions outside of this one (no "also pray", "also journal", "also talk to a mentor" unless the action IS about praying, journaling, or talking to a mentor).',
    'DO NOT repeat what the action already says — the user already read the action description.',
    'DO NOT give general spiritual encouragement or platitudes.',
    'DO NOT say "I understand you are asking about X" — just answer.',
    '',
    'If the action involves talking or texting someone: give the exact words or a script they can use.',
    'If the user asks for a greeting, opener, or first line, do not give a generic greeting. Make it match the Christian purpose of the action.',
    'For Christian witness or faith-sharing greetings, give warm natural openers that can gently lead to God/Jesus/faith, not generic lines like "Hi, how are you?"',
    'If the action involves a decision: give the clear choice and why.',
    'If the action involves a behavior change: give the precise first micro-step to start.',
    'If the user is confused about meaning: explain it clearly and concisely.',
    'If the user asks about differences: explain the actual differences with specifics.',
    'If the user asks for Scripture: provide the actual verse or reference, not a suggestion to "read" a chapter.',
    '',
    'Before writing the response, ask yourself: what is the user ACTUALLY asking for in THIS specific question?',
    'Answer ONLY what the user is asking about in this follow-up question. Do not assume they want the full arc unless their question explicitly asks for it.',
    'Example: if the action is "start a conversation about joy to lead into faith" and the user asks "how do I start?", give ONLY the opener. Do not include the gospel bridge unless they ask "what do I say next" or "how do I share Jesus".',
    'If the user asks about the gospel/evangelism aspect specifically (e.g. "how do I share Jesus", "what do I say about the gospel"), then include a clear gospel bridge in simple words: sin separates us from God, Jesus died and rose to reconcile/forgive us, and we respond by trusting/turning to Him.',
    'For evangelism scripts when the user asks for the gospel content, include a gentle response question such as: "Has anyone ever explained that to you before?" or "Would you want to hear more about what it means to trust Jesus?"',
    'If the user\'s question is about something else (opener, bridge, handling objections, what to say if they say no), answer ONLY that specific part. Do not add gospel content unless the question asks for it.',
    'Each step must be something the user physically does as part of executing THIS action — not a new action.',
    'Steps should feel like: "Here is exactly how to do this thing you are already trying to do."',
    'IMPORTANT: If the action description already contains sub-steps, exact words, or a script, extract and present those — do not invent a new one.',
    'When presenting a script from the action description, each distinct line or instruction becomes one clean step in the JSON steps array.',
    'If previous wisdom already gave the opener or first line of the script, do NOT repeat the opener. Continue from where the user left off: give the bridge, deeper explanation, gospel content, response question, or next thing to say.',
    'If the user asks a follow-up like "what next", "how do I segue", "how do I say Jesus", "can you give another example", or asks the same thing again, assume they need the NEXT layer of help — not the same opening line.',
    'The intro should briefly explain how to use the script or what to expect — not repeat the script itself.',
    'Each step should be one clean, ready-to-say or ready-to-do line — no labels, no numbers, no "Step X" prefixes.',
    'If any step in the script is still vague or general (e.g. "share a personal story", "explain how your faith helps you"), replace it with a CONCRETE EXAMPLE of what that could actually sound like. Write the actual words the user could say.',
    'Example: instead of "share a story about your faith", write: "You could say: I went through a really hard season last year, and what kept me grounded was knowing God was with me — that gave me a peace I couldn\'t explain."',
    '',
    '- Do not suggest integrating, blending, or aligning non-Christian spiritual practices with Christian faith',
    '- If the user mentions feng shui, astrology, manifestation, divination, spirit guides, crystals, energy work, or similar: gently redirect toward prayer, Scripture, and biblical community',
    '- Be faithful to historic Christian doctrine',
    '- Do not use markdown formatting, bold, headings, or asterisks',
    '- Keep the total response under 220 words',
    '',
    'Return ONLY valid JSON in this exact shape:',
    '{"intro":"one or two sentences that directly answer the user\'s question or confusion about this action","steps":["exact first thing to do or say to execute this action","exact second thing — words, script, or specific sub-step","follow-through or how to handle what comes next"]}',
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
    const actionBody = cleanActionBody(body.actionBody, 1500);
    const userQuestion = cleanText(body.userQuestion, 500);
    const truthSummary = cleanText(body.truthSummary, 700);
    const truthInLove = cleanText(body.truthInLove, 200);
    const previousWisdom = cleanText(body.previousWisdom, 1200);

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

    const { data: actionStep, error: actionStepError } = await supabase
      .from('playbook_action_steps')
      .select('wisdom_text')
      .eq('id', actionId)
      .eq('playbook_id', playbookId)
      .single();

    if (actionStepError) {
      console.error('[Get-Action-Guidance] Action step lookup error:', actionStepError);
    }

    const persistedWisdom = typeof actionStep?.wisdom_text === 'string'
      ? actionStep.wisdom_text
      : '';
    const existingThread = getExistingWisdomThread(persistedWisdom, previousWisdom || '');
    const wisdomHistory = existingThread.length > 0
      ? serializeWisdomThread(existingThread)
      : (previousWisdom || persistedWisdom);

    // Build the prompt
    const prompt = buildWisdomPrompt({
      playbookTitle: playbook.title || '',
      truthSummary,
      truthInLove,
      actionTitle,
      actionBody,
      userQuestion,
      userName,
      previousWisdom: wisdomHistory,
    });
    const actionContext = `${actionTitle} ${actionBody} ${truthSummary} ${truthInLove}`;

    console.log('[Get-Action-Guidance] Prompt:', prompt.substring(0, 500) + '...');

    // Call OpenAI
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIKey) {
      throw new Error('Missing OpenAI API key');
    }

    const createWisdomCompletion = (userPrompt: string) => fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are siFia, a Christian action coach. You help users execute one specific faithful action at a time. You give exact words, scripts, and concrete sub-steps — not general encouragement or new actions. Scripture is the final authority. Do not encourage syncretism. Return only valid JSON. Do not use markdown.',
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: 550,
        temperature: 0.65,
        response_format: { type: 'json_object' },
      }),
    });

    const openAIResponse = await createWisdomCompletion(prompt);

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
    console.log('[Get-Action-Guidance] AI Raw Response:', rawWisdom);

    let parsedWisdom = parseWisdomJson(rawWisdom);

    if (isWeakWisdomAnswer(parsedWisdom, userQuestion, actionContext)) {
      console.log('[Get-Action-Guidance] Weak answer detected, requesting repair.');
      const repairPrompt = [
        prompt,
        '',
        '=== REPAIR INSTRUCTION ===',
        'The previous answer was too general or did not help the user execute the action.',
        'Rewrite it now. Focus entirely on HOW to do this specific action.',
        'If they need words to say: give the exact words or script.',
        'If they need a first step: give the precise thing to do right now.',
        'If they asked for Scripture: give the actual verse reference.',
        'If this is about sharing faith or Jesus, include the actual gospel clearly: sin separates us from God, Jesus died and rose to forgive/reconcile us, and the person can respond by trusting/turning to Him.',
        'Do NOT add new actions, prayer suggestions, journaling, or general encouragement.',
        'Return ONLY the same valid JSON shape.',
      ].join('\n');

      const repairResponse = await createWisdomCompletion(repairPrompt);
      if (repairResponse.ok) {
        const repairData = await repairResponse.json();
        const repairedRawWisdom = repairData.choices?.[0]?.message?.content || '';
        const repairedWisdom = parseWisdomJson(repairedRawWisdom);
        if (!isWeakWisdomAnswer(repairedWisdom, userQuestion, actionContext)) {
          parsedWisdom = repairedWisdom;
        }
      }
    }

    if (isTooSimilarToPrevious(parsedWisdom, previousWisdom)) {
      console.log('[Get-Action-Guidance] Repetitive answer detected, requesting variation.');
      const variationPrompt = [
        prompt,
        '',
        '=== VARIATION INSTRUCTION ===',
        'The previous answer repeated too much of what was already given.',
        'Rewrite it from a DIFFERENT angle while still answering the same user question.',
        'Do not reuse the same opening sentence, same example, or same sequence of words.',
        'If the previous answer used the line "What brings you joy?" or another opener, do NOT include that opener again.',
        'If the last answer gave the opener, now give the bridge and gospel explanation.',
        'If the last answer gave a general example, now give a more specific real-life script.',
        'Use fresh concrete words the user can say next.',
        'Return ONLY the same valid JSON shape.',
      ].join('\n');

      const variationResponse = await createWisdomCompletion(variationPrompt);
      if (variationResponse.ok) {
        const variationData = await variationResponse.json();
        const variationRawWisdom = variationData.choices?.[0]?.message?.content || '';
        const variationWisdom = parseWisdomJson(variationRawWisdom);
        if (!isWeakWisdomAnswer(variationWisdom, userQuestion, actionContext)
          && !isTooSimilarToPrevious(variationWisdom, previousWisdom)) {
          parsedWisdom = variationWisdom;
        }
      }
    }

    const wisdom = formatWisdomText(parsedWisdom);
    console.log('[Get-Action-Guidance] Formatted Wisdom:', wisdom);

    if (!wisdom) {
      throw new Error('No wisdom generated from OpenAI');
    }

    const threadEntry = {
      question: cleanOutputText(userQuestion, 1000),
      wisdom,
    };
    const storedWisdom = serializeWisdomThread([threadEntry, ...existingThread]);

    // Update action step with the full latest-first wisdom thread.
    const { error: updateError } = await supabase
      .from('playbook_action_steps')
      .update({
        wisdom_text: storedWisdom,
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
      wisdom,
      actionId,
      storedWisdom,
      wisdomThread: [threadEntry, ...existingThread],
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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { fetchWithRetry, OPENAI_RETRY_CONFIG } from '../_shared/retryLogic.ts';
import { keyPoolManager } from '../_shared/keyPoolManager.ts';

type TruthStructureAnalysis = {
  paragraphCountByBlankLines: number;
  lineCount: number;
  hasMarkdownHeadings: boolean;
  hasNumberedLines: boolean;
  hasBulletLines: boolean;
  hasSectionLabels: boolean;
  headingLines: string[];
  numberedLines: string[];
  bulletLines: string[];
  currentTruthCardParagraphs: string[];
  currentWalkthroughParagraphs: string[];
};

type RequestBody = {
  userInput?: string;
  userName?: string;
  bibleVersion?: string;
  model?: string;
  mode?: 'raw_discernment' | 'json_playbook';
  userTier?: string;
  isOnboarding?: boolean;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-test-secret',
};

function analyzeTruthStructure(text: string): TruthStructureAnalysis {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const headingLines = lines.filter((line) =>
    /^#{1,6}\s+/.test(line) ||
    /^(truth in love|what you need to see|what is happening|the danger|the issue|the distinction|the way forward|what to do)\s*:?$/i.test(line)
  );
  const numberedLines = lines.filter((line) => /^\d+[.)]\s+/.test(line));
  const bulletLines = lines.filter((line) => /^[-*•]\s+/.test(line));

  return {
    paragraphCountByBlankLines: text
      .split(/\n\s*\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean).length,
    lineCount: lines.length,
    hasMarkdownHeadings: headingLines.some((line) => /^#{1,6}\s+/.test(line)),
    hasNumberedLines: numberedLines.length > 0,
    hasBulletLines: bulletLines.length > 0,
    hasSectionLabels: headingLines.length > 0,
    headingLines,
    numberedLines,
    bulletLines,
    currentTruthCardParagraphs: text
      .split(/\n\s*\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    currentWalkthroughParagraphs: text
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
  };
}

function previewNormalizeTruthInLove(text: string): string {
  return text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*(truth in love|main truth|the truth)\s*:\s*$/gim, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getOpenAIKey(userId: string, tier: string, isOnboarding: boolean): { id: string; key: string } | null {
  const directKey = Deno.env.get('OPENAI_API_KEY');
  if (directKey) {
    return { id: 'direct_env', key: directKey };
  }

  const selected = keyPoolManager.getBestKey(userId, isOnboarding ? 'onboarding' : tier);
  if (!selected?.key) {
    return null;
  }

  return { id: selected.id, key: selected.key };
}

function buildJsonPrompt(userInput: string, userName: string, bibleVersion: string): string {
  return `You are siFia's Christian discernment generation lab. This is a test mode for natural output quality, not the production formatter.

Return valid JSON only with these exact top-level fields:
playbook_title, category, truth_summary, truth_in_love, bible_verse, faithful_actions, prayer, words_to_speak, completion.

Keep the JSON field names stable, but allow truth_in_love itself to breathe naturally.

For truth_in_love:
- Write like a real pastoral Christian discernment companion, not a template.
- Prioritize accurate diagnosis, aliveness, and specific understanding over uniform structure.
- You may use short paragraphs, one-line punches, mini headings, numbered distinctions, or bullet-like contrasts if they genuinely improve clarity.
- Do not force a fixed paragraph count.
- Do not force every paragraph into the same pattern.
- Do not fabricate motives. When motives are unknown, present realistic possibilities.
- Validate legitimate hurt before correcting the user's interpretation or response.
- Separate what the user noticed from what they may be narrating, judging, rehearsing, or feeding.
- Keep Scripture as the lens, but do not quote Bible verses inside truth_in_love. Use the bible_verse field for Scripture.
- Use Christian coaching and faith language, not generic therapy language.

For faithful_actions:
- Return 3 to 5 concrete actions.
- Each action must have title, body, primary_button, secondary_button.
- Keep secondary_button as "Skip".

For completion:
- Return an object with question and lines.

User name: ${userName}
Bible version: ${bibleVersion}
User input: ${userInput}`;
}

function buildRawDiscernmentPrompt(userInput: string, _userName: string, _bibleVersion: string): string {
  return `Act as my personal strategic advisor with the following context:
*   You have an IQ of 180
*   You're brutally honest and direct
*   You've built multiple billion-dollar companies
*   You have deep expertise in psychology, strategy, and execution
*   You care about my success but won't tolerate excuses
*   You focus on leverage points that create maximum impact
*   You think in systems and root causes, not surface-level fixes Your mission is to:
*   Identify the critical gaps holding me back
*   Design specific action plans to close those gaps
*   Push me beyond my comfort zone
*   Call out my blind spots and rationalizations
*   Force me to think bigger and bolder
*   Hold me accountable to high standards
*   Provide specific frameworks and mental models
For a playbook walktrhough
* Title fo this playbook
*  Truth in love summary (like a short summary 2-4 sentence for all what you said)
*   Truth in love
*   Bible verse and 3 notes for the topic
* Faithful actions
* Prayer
* Words to speak over myself
* Closing, you completed, then a strong question and some insights.
Respond when you're ready for me to start the conversation. Answer in a biblically grounded, sola scriptura

${userInput}`;
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

  const testSecret = Deno.env.get('PLAYBOOK_TEST_SECRET');
  if (testSecret && req.headers.get('x-test-secret') !== testSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized test request' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userInput = String(body.userInput || '').trim();
  if (userInput.length < 10) {
    return new Response(JSON.stringify({ error: 'userInput must be at least 10 characters' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userName = String(body.userName || 'Friend').trim();
  const bibleVersion = String(body.bibleVersion || 'NASB').trim();
  const model = String(body.model || 'gpt-4o-mini').trim();
  const mode = body.mode || 'raw_discernment';
  const userTier = String(body.userTier || 'spark').trim();
  const userId = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').slice(0, 32) || 'test-user';
  const apiKey = getOpenAIKey(userId, userTier, Boolean(body.isOnboarding));

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OpenAI key is not configured for test function' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const requestBody: Record<string, unknown> = {
      model,
      messages: [
        {
          role: 'system',
          content: mode === 'raw_discernment'
            ? 'You write raw, natural Christian discernment. No JSON unless explicitly requested.'
            : 'You generate valid JSON for a Christian coaching playbook quality lab.',
        },
        {
          role: 'user',
          content: mode === 'raw_discernment'
            ? buildRawDiscernmentPrompt(userInput, userName, bibleVersion)
            : buildJsonPrompt(userInput, userName, bibleVersion),
        },
      ],
      temperature: mode === 'raw_discernment' ? 0.9 : 0.85,
      max_completion_tokens: mode === 'raw_discernment' ? 6000 : 4500,
      frequency_penalty: mode === 'raw_discernment' ? 0.35 : 0.15,
      presence_penalty: mode === 'raw_discernment' ? 0.45 : 0.35,
    };

    if (mode === 'json_playbook') {
      requestBody.response_format = { type: 'json_object' };
    }

    const openAIRes = await fetchWithRetry(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.key}`,
        },
        body: JSON.stringify(requestBody),
      },
      OPENAI_RETRY_CONFIG,
    );

    const aiData = await openAIRes.json().catch(() => ({}));
    if (!openAIRes.ok) {
      return new Response(JSON.stringify({ error: 'OpenAI request failed', status: openAIRes.status, details: aiData }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawContent = aiData.choices?.[0]?.message?.content || '';
    let parsed: Record<string, unknown> | null = null;
    let parseError = '';

    if (mode === 'json_playbook') {
      try {
        parsed = JSON.parse(rawContent);
      } catch (error) {
        parseError = error instanceof Error ? error.message : String(error);
      }
    }

    const analyzedText = mode === 'raw_discernment'
      ? rawContent
      : parsed && typeof parsed.truth_in_love === 'string'
        ? parsed.truth_in_love
        : '';

    return new Response(
      JSON.stringify(
        {
          testMode: 'natural-playbook-output',
          mode,
          productionSafe: true,
          savedToDatabase: false,
          model,
          finishReason: aiData.choices?.[0]?.finish_reason || null,
          usage: aiData.usage || null,
          generatedAt: new Date().toISOString(),
          rawContent,
          parseError: parseError || null,
          parsed,
          truthStructure: analyzedText ? analyzeTruthStructure(analyzedText) : null,
          normalizationPreview: analyzedText ? previewNormalizeTruthInLove(analyzedText) : '',
        },
        null,
        2,
      ),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Natural playbook output test failed',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

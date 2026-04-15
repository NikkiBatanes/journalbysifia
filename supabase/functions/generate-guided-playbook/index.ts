/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { discernmentCompanionPersona, applyPersonaContext, enforcePersona } from './persona.config.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { fetchWithRetry, OPENAI_RETRY_CONFIG } from '../_shared/retryLogic.ts';
import { SimpleRateLimiter, RATE_LIMIT_CONFIGS, createRateLimitError } from '../_shared/simpleRateLimiter.ts';
import { CircuitBreaker, CIRCUIT_KEYS } from '../_shared/circuitBreaker.ts';
import { bibleVerseService } from '../_shared/bibleVerseService.ts';
import { analyzeContent, paraphraseVictimExperience } from '../_shared/contentSafety.ts';
import { keyPoolManager } from '../_shared/keyPoolManager.ts';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
}

interface SubTask {
  id: string;
  text: string;
  completed: boolean;
  is_example?: boolean;
  example_interactive?: boolean;
  orderIndex?: number;
}

interface ActionStep {
  id: string;
  title: string;
  description?: string;
  subTasks: SubTask[];
  examples: string[];
  example_interactive?: boolean;
  completed: boolean;
  orderIndex?: number;
  actionType?: 'done_skip' | 'commit' | 'choose' | 'text_input';
  primaryButton?: string;
  secondaryButton?: string;
}

interface Playbook {
  id: string;
  title: string;
  subtitle: string;
  truthInLove: {
    summary: string;
    text: string;
  };
  actionSteps: ActionStep[];
  // affirmations removed — replaced by wordsToSpeak
  wordsToSpeak: string[];
  bibleVerse: { text: string; reference: string; version?: string };
  directChallenge: string;
  prayer?: string;
  wordToSpeak?: string;          // single string kept for legacy compat
  bibleVerseReflection?: string;
  faithfulActionsIntro?: string;
  createdAt: string;
  updatedAt: string;
  userInput: string;
  progress: number;
  totalTasks: number;
  persona?: string;
  profileImage?: string;
}

interface OpenAIData {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function sanitizeText(text: string): string {
  return text.replace(/\byoga\b/gi, 'gentle stretching');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*|__|\*/g, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
}

function cleanVerseContentFallback(content: string, verseRef: string): string {
  let cleaned = content;
  if (verseRef) cleaned = cleaned.replace(new RegExp(escapeRegExp(verseRef), 'i'), '');
  cleaned = cleaned.replace(/"""+/g, '"').replace(/""/g, '"').replace(/^"\s*|\s*"$/g, '').trim();
  if (!cleaned) cleaned = content.replace(/"""+/g, '"').replace(/""/g, '"').replace(/^"\s*|\s*"$/g, '').trim();
  return cleaned;
}

// ─── bible verse enforcement ─────────────────────────────────────────────────

async function enforcePlaybookBibleVerse(playbook: Playbook, version: string): Promise<void> {
  if (!playbook.bibleVerse?.reference) return;

  try {
    const exactVerse = await bibleVerseService.fetchVerse(playbook.bibleVerse.reference, version);
    playbook.bibleVerse.text = exactVerse.text;
    playbook.bibleVerse.reference = exactVerse.reference;
    playbook.bibleVerse.version = version;
  } catch (error) {
    console.error('[Playbook Scripture] Enforcement failed, keeping AI text:', error);
  }
}

// ─── sanitize ────────────────────────────────────────────────────────────────

function sanitizePlaybook(playbook: Playbook) {
  playbook.title = sanitizeText(playbook.title);
  playbook.subtitle = sanitizeText(playbook.subtitle);
  playbook.truthInLove = {
    summary: sanitizeText(playbook.truthInLove.summary),
    text: sanitizeText(playbook.truthInLove.text),
  };
  playbook.actionSteps = playbook.actionSteps.map(step => ({
    ...step,
    title: sanitizeText(step.title),
    subTasks: step.subTasks.map(st => ({ ...st, text: sanitizeText(st.text) })),
    examples: step.examples.map(e => sanitizeText(e)),
  }));
  playbook.directChallenge = sanitizeText(playbook.directChallenge);
  if (playbook.prayer) playbook.prayer = sanitizeText(playbook.prayer);
  if (playbook.wordToSpeak) playbook.wordToSpeak = sanitizeText(playbook.wordToSpeak);
  if (playbook.bibleVerseReflection) playbook.bibleVerseReflection = sanitizeText(playbook.bibleVerseReflection);
  playbook.wordsToSpeak = playbook.wordsToSpeak.map(w => sanitizeText(w));
}

// ─── section extractor helper ────────────────────────────────────────────────

/**
 * Extract a section from AI content.
 * Tries bold (**HEADER:**), hash (### HEADER:), and plain (HEADER:) variants.
 * stopPatterns: array of section header keywords that end this section.
 */
function extractSection(content: string, header: string, stopHeaders: string[]): string | null {
  const stopPattern = stopHeaders
    .map(h => `(?:\\*\\*${h}:\\*\\*|###\\s*${h}:|${h}:)`)
    .join('|');

  const patterns = [
    new RegExp(`\\*\\*${header}:\\*\\*\\s*([\\s\\S]*?)(?=${stopPattern}|$)`, 'i'),
    new RegExp(`###\\s*${header}:\\s*([\\s\\S]*?)(?=${stopPattern}|$)`, 'i'),
    new RegExp(`${header}:\\s*([\\s\\S]*?)(?=${stopPattern}|$)`, 'i'),
  ];

  for (const p of patterns) {
    const m = content.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

// ─── main parser ─────────────────────────────────────────────────────────────

function parseOpenAIResponse(
  aiData: OpenAIData,
  userName: string,
  userInput: string,
  bibleVersion?: string
): Playbook {
  const rawContent = aiData.choices[0]?.message?.content || '';

  // Strip leading markdown headers from section label lines
  const content = rawContent
    .split('\n')
    .map((line: string) => line.replace(/^#{1,4}\s+/, '').replace(/\s*#{1,4}\s*$/, ''))
    .join('\n');

  const playbook: Playbook = {
    id: generateUUID(),
    title: '',
    subtitle: '',
    truthInLove: { summary: '', text: '' },
    actionSteps: [],
    wordsToSpeak: [],
    bibleVerse: { text: '', reference: '' },
    directChallenge: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userInput,
    progress: 0,
    totalTasks: 0,
  };

  // ── TITLE ──────────────────────────────────────────────────────────────────
  const titleRaw = extractSection(content, 'PLAYBOOK TITLE', [
    'TRUTH SUMMARY', 'TRUTH IN LOVE', 'ACTION STEPS', 'AFFIRMATIONS',
    'BIBLE VERSE', 'COMPLETION', 'PRAYER', 'WORDS TO SPEAK',
  ]);
  if (titleRaw) {
    const titleLines = titleRaw.split('\n').map(l => cleanMarkdown(l)).filter(Boolean);
    playbook.title = titleLines[0] || '';
    playbook.subtitle = titleLines[1] || '';
  }

  // ── TRUTH SUMMARY ──────────────────────────────────────────────────────────
  const summaryRaw = extractSection(content, 'TRUTH SUMMARY', [
    'TRUTH IN LOVE', 'FAITHFUL ACTIONS INTRO', 'ACTION STEPS',
    'BIBLE VERSE', 'COMPLETION', 'PRAYER', 'WORDS TO SPEAK',
  ]);
  if (summaryRaw) playbook.truthInLove.summary = summaryRaw;

  // ── TRUTH IN LOVE ──────────────────────────────────────────────────────────
  const truthRaw = extractSection(content, 'TRUTH IN LOVE', [
    'FAITHFUL ACTIONS INTRO', 'ACTION STEPS', 'AFFIRMATIONS',
    'BIBLE VERSE', 'COMPLETION', 'PRAYER', 'WORDS TO SPEAK',
  ]);
  if (truthRaw) playbook.truthInLove.text = truthRaw;

  // ── FAITHFUL ACTIONS INTRO ─────────────────────────────────────────────────
  const introRaw = extractSection(content, 'FAITHFUL ACTIONS INTRO', ['ACTION STEPS']);
  if (introRaw) {
    const firstLine = introRaw.split('\n')[0].trim();
    if (firstLine) playbook.faithfulActionsIntro = firstLine;
  }

  // ── ACTION STEPS ───────────────────────────────────────────────────────────
  const stepsRaw = extractSection(content, 'ACTION STEPS', [
    'AFFIRMATIONS', 'BIBLE VERSE', 'SCRIPTURE NOTE', 'COMPLETION',
    'PRAYER', 'WORDS TO SPEAK',
  ]);
  if (stepsRaw) {
    const stepBlocks = stepsRaw
      .split(/\n(?=\d+\.\s)/)
      .filter((block: string) => block.match(/^\d+\./));

    playbook.actionSteps = stepBlocks.map((block: string, idx: number) => {
      const lines = block.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const titleLine = lines[0].replace(/^\d+\.\s*/, '');
      const subTasks: SubTask[] = [];
      const examples: string[] = [];
      let actionType: 'done_skip' | 'commit' | 'choose' | 'text_input' | undefined;
      let primaryButton: string | undefined;
      let secondaryButton: string | undefined;
      const bodyLines: string[] = [];

      lines.slice(1).forEach((line: string) => {
        const t = line.trim();
        if (/^\s*-\s*Type:/i.test(t)) {
          const v = t.replace(/^\s*-\s*Type:\s*/i, '').trim().toLowerCase();
          if (['done_skip', 'commit', 'choose', 'text_input'].includes(v)) {
            actionType = v as typeof actionType;
          }
        } else if (/^\s*-\s*Primary:/i.test(t)) {
          primaryButton = t.replace(/^\s*-\s*Primary:\s*/i, '').trim();
        } else if (/^\s*-\s*Secondary:/i.test(t)) {
          secondaryButton = t.replace(/^\s*-\s*Secondary:\s*/i, '').trim();
        } else if (/^\s*-\s*Sub-task:/i.test(t)) {
          const text = t.replace(/^\s*-\s*Sub-task:\s*/i, '').trim();
          if (text) subTasks.push({ id: generateUUID(), text, completed: false, orderIndex: subTasks.length });
        } else if (/^\s*-\s*Example:/i.test(t)) {
          const exText = t.replace(/^\s*-\s*Example:\s*/i, '').trim();
          const interactiveMatch = exText.match(/(.+?)\s*\|\s*Interactive:\s*(true|false)/i);
          if (interactiveMatch) examples.push(interactiveMatch[1].trim());
          else if (exText) examples.push(exText);
        } else if (!t.startsWith('- ')) {
          bodyLines.push(t);
        }
      });

      return {
        id: generateUUID(),
        title: titleLine,
        description: bodyLines.length > 0 ? bodyLines.join('\n') : undefined,
        subTasks,
        examples,
        example_interactive: false,
        completed: false,
        orderIndex: idx,
        actionType: actionType ?? 'done_skip',
        primaryButton,
        secondaryButton,
      };
    });

    playbook.totalTasks = playbook.actionSteps.length;
  }

  // ── BIBLE VERSE ────────────────────────────────────────────────────────────
  const verseRaw = extractSection(content, 'BIBLE VERSE', [
    'SCRIPTURE NOTE', 'SCRIPTURE REFLECTION', 'COMPLETION',
    'PRAYER', 'WORDS TO SPEAK',
  ]);
  if (verseRaw) {
    const scripturePatterns = [
      { pattern: /['"]([^'"\n]+)['"]\s*\(\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*\)/i, refFirst: false },
      { pattern: /([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*:\s*['"]([^'"\n]+)['"]/i, refFirst: true },
      { pattern: /['"]([^'"\n]+)['"]\s*[-—]\s*([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)/i, refFirst: false },
      { pattern: /([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*[-—]\s*['"]([^'"\n]+)['"]/i, refFirst: true },
      { pattern: /([A-Za-z0-9 ]+\s*\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s+([^\n]+)/i, refFirst: true },
    ];

    let verseText = '';
    let verseRef = '';

    for (const { pattern, refFirst } of scripturePatterns) {
      const m = verseRaw.match(pattern);
      if (m) {
        if (refFirst) { verseRef = m[1]?.trim() || ''; verseText = m[2]?.trim() || ''; }
        else { verseText = m[1]?.trim() || ''; verseRef = m[2]?.trim() || ''; }
        if (verseText && verseRef) break;
      }
    }

    // Fallback ref scan
    if (!verseRef) {
      const m = verseRaw.match(/([A-Za-z0-9]+\s+\d+:\d+(?:-\d+)?)/);
      if (m) verseRef = m[1].trim();
    }

    verseText = verseText.trim().replace(/\s*\(\s*[A-Z]{2,5}\s*\)\s*$/i, '').trim();
    if (verseRef && verseText.toLowerCase().startsWith(verseRef.toLowerCase())) {
      verseText = verseText.substring(verseRef.length).trim();
    }
    verseText = verseText.replace(/^[""'"]+\s*/, '').trim();
    verseRef = verseRef.trim().replace(/\s*\(\s*[A-Z]{2,5}\s*\)\s*$/i, '').trim();

    playbook.bibleVerse.text = verseText || cleanVerseContentFallback(verseRaw, verseRef);
    playbook.bibleVerse.reference = verseRef;
    playbook.bibleVerse.version = bibleVersion || 'NASB';
  }

  // ── SCRIPTURE NOTE ─────────────────────────────────────────────────────────
  const noteRaw = extractSection(content, 'SCRIPTURE NOTE', ['COMPLETION', 'PRAYER', 'WORDS TO SPEAK']);
  const reflRaw = noteRaw ?? extractSection(content, 'SCRIPTURE REFLECTION', ['COMPLETION', 'PRAYER', 'WORDS TO SPEAK']);
  if (reflRaw) {
    const lines = reflRaw.split('\n').map((l: string) => l.trim()).filter(Boolean);
    if (lines.length === 1 && lines[0].length > 60) {
      const sentences = lines[0].split(/(?<=[.!?])\s+/);
      playbook.bibleVerseReflection = sentences.slice(0, 4).join('\n');
    } else {
      playbook.bibleVerseReflection = lines.slice(0, 4).join('\n');
    }
  }

  // ── COMPLETION ─────────────────────────────────────────────────────────────
  const completionRaw = extractSection(content, 'COMPLETION', ['PRAYER', 'WORDS TO SPEAK']);
  if (completionRaw) playbook.directChallenge = completionRaw;

  // ── PRAYER ─────────────────────────────────────────────────────────────────
  const prayerRaw = extractSection(content, 'PRAYER', ['WORDS TO SPEAK', 'WORD TO SPEAK']);
  if (prayerRaw) {
    playbook.prayer = prayerRaw.replace(/PRAYER RULES[\s\S]*/i, '').trim();
  }

  // ── WORDS TO SPEAK ─────────────────────────────────────────────────────────
  // Parse as multiple declaration lines — shown one per line in the walkthrough
  const wordsRaw =
    extractSection(content, 'WORDS TO SPEAK', []) ??
    extractSection(content, 'WORD TO SPEAK', []);

  if (wordsRaw) {
    let cleaned = wordsRaw
      .replace(/WORDS? TO SPEAK RULES[\s\S]*/i, '')
      .replace(/GOOD EXAMPLES[\s\S]*/i, '')
      .replace(/BAD EXAMPLES[\s\S]*/i, '')
      .replace(/\*\*/g, '')
      .replace(/[""]/g, '')
      .replace(/^[•\-\*\d\.]+\s*/gm, '')
      .trim();

    const lines = cleaned
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 4);

    playbook.wordsToSpeak = lines; // array of declaration lines
    playbook.wordToSpeak = lines.join('\n'); // legacy single-string compat
  }

  // ── FALLBACK CHALLENGE ─────────────────────────────────────────────────────
  if (!playbook.directChallenge || playbook.directChallenge.trim().length === 0) {
    playbook.directChallenge = [
      `${userName}, complete this two-part challenge:`,
      '',
      'SPIRITUAL: Within 24 hours, block 20 minutes to pray Psalm 139:23-24. Ask God to reveal truth. Journal what the Holy Spirit shows you.',
      '',
      'TACTICAL: Within 72 hours, schedule a 30-minute check-in with a trusted pastor, mentor, or accountability partner.',
    ].join('\n');
  }

  sanitizePlaybook(playbook);
  return playbook;
}

// ─── request body ─────────────────────────────────────────────────────────────

interface RequestBody {
  userInput: string;
  userName: string;
  userId?: string;
  dateOfBirth?: string;
  ageGroup?: string;
  bibleVersion?: string;
  location?: string;
  userTier?: string;
  isOnboarding?: boolean;
}

// ─── serve ────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Invalid request method' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let requestBody: RequestBody;
  try {
    requestBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "We couldn't process your request. Please try again." }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { userInput, userName, userId, dateOfBirth, ageGroup, bibleVersion, userTier, isOnboarding } = requestBody;

  const authHeader = req.headers.get('authorization');
  const rateLimitUserId = authHeader ? authHeader.split(' ')[1] : userId || 'anonymous';
  const rateLimitResult = SimpleRateLimiter.checkLimit(rateLimitUserId, RATE_LIMIT_CONFIGS.playbook);
  if (!rateLimitResult.allowed) {
    return createRateLimitError(
      rateLimitResult,
      `You've created ${RATE_LIMIT_CONFIGS.playbook.maxRequests} playbooks in the last hour. Please wait before creating another.` 
    );
  }

  // Age detection
  let isTeenUser = false;
  if (dateOfBirth) {
    try {
      const birth = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      isTeenUser = age >= 0 && age <= 16;
    } catch { /* non-blocking */ }
  } else if (typeof ageGroup === 'string') {
    isTeenUser = ['teen', 'teens', 'child', 'children', 'kid', 'youth', 'preteen'].includes(ageGroup.toLowerCase());
  }

  // Content safety check
  const contentAnalysis = analyzeContent(userInput);
  if (contentAnalysis.shouldBlock) {
    return new Response(
      JSON.stringify({
        error: 'CONTENT_BLOCKED',
        message: contentAnalysis.christianMessage,
        alternatives: contentAnalysis.constructiveAlternatives,
        category: contentAnalysis.category,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Fetch recent titles for uniqueness
    let recentTitles: string[] = [];
    if (userId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data } = await supabase
            .from('playbooks')
            .select('title')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(3);
          if (data) recentTitles = data.map((p: { title: string }) => p.title).filter(Boolean);
        }
      } catch { /* non-blocking */ }
    }

    let effectiveUserInput = userInput;
    const preferredBibleVersion = bibleVersion || 'NASB';
    const generationTimestamp = new Date().toISOString();

    const buildContextualPrompt = (input: string): string => {
      let prompt = applyPersonaContext(discernmentCompanionPersona, input, bibleVersion);

      prompt += `\n\nUser Name: ${userName}
User Request: ${input}
Generation ID: ${generationTimestamp}

IMPORTANT: Use ONLY "${userName}" as the user's name. Do not use any other name or variation.`;

      if (recentTitles.length > 0) {
        prompt += `\n\nTITLE UNIQUENESS: The user already has these playbook titles:\n${recentTitles.map(t => `- "${t}"`).join('\n')}\nYou MUST create a completely different title.`;
      }

      if (isTeenUser) {
        prompt += '\n\nLANGUAGE: This user is a teenager (13-16). Use simple, clear language. Avoid complex theological terms.';
      }

      prompt += `\n\nBIBLE VERSION: Use ${preferredBibleVersion} for all scripture. Quote EXACTLY as it appears — all brackets, parentheses, punctuation intact. Do not truncate.`;

      prompt += `\n\nSUPPORT SERVICES: When suggesting professional help, use general language only ("a trusted counselor", "your local support services"). Do not provide specific phone numbers.`;

      if (prompt.length > 6000) prompt = prompt.substring(0, 6000) + '\n\n[Truncated]';
      return prompt;
    };

    let contextualPrompt = buildContextualPrompt(effectiveUserInput);

    // OpenAI call helper
    async function callOpenAI(model: string): Promise<Response> {
      const tierForKey = isOnboarding ? 'onboarding' : (userTier || 'spark');
      const apiKey = keyPoolManager.getBestKey(userId || 'anonymous', tierForKey);
      if (!apiKey) throw new Error('Service temporarily unavailable. Please try again.');

      try {
        const response = await CircuitBreaker.execute(
          CIRCUIT_KEYS.OPENAI_PLAYBOOK,
          async () => await fetchWithRetry(
            'https://api.openai.com/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey.key}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: 'system', content: discernmentCompanionPersona.systemPrompt },
                  { role: 'user', content: contextualPrompt },
                ],
                temperature: 0.7,
                max_tokens: 6000,
                frequency_penalty: 0.1,
                presence_penalty: 0.1,
              }),
            },
            OPENAI_RETRY_CONFIG
          )
        );
        keyPoolManager.setKeyHealth(apiKey.id, true);
        return response;
      } catch (error) {
        keyPoolManager.setKeyHealth(apiKey.id, false);
        throw error;
      }
    }

    const refusalPatterns = [
      /i'm sorry, but i can't assist/i,
      /i'm sorry, but i cannot assist/i,
      /i'm unable to assist/i,
      /i cannot assist with this request/i,
      /i'm unable to help with this/i,
      /i cannot fulfill this request/i,
      /i'?m\s+(really\s+)?sorry\s+to\s+hear\s+that\s+you'?re\s+feeling\s+this\s+way/i,
      /please\s+(reach\s+out|talk)\s+to\s+(a\s+)?(mental\s+health|counselor|professional)/i,
    ];

    let openAIRes = await callOpenAI('gpt-4o');
    let aiData: OpenAIData = await openAIRes.json();
    let rawContent: string = aiData.choices?.[0]?.message?.content || '';

    // Retry with paraphrasing if refused
    if (refusalPatterns.some(p => p.test(rawContent))) {
      console.log('[Generate-Playbook] AI refused, attempting paraphrase retry...');

      effectiveUserInput = contentAnalysis.isVictimExperience
        ? paraphraseVictimExperience(userInput)
        : userInput
            .replace(/\b(i want to|i need to|i will)\s+(commit\s+)?suicide\b/gi, 'I am struggling with thoughts of ending my life')
            .replace(/\b(i want to|i need to|i will)\s+kill\s+myself\b/gi, 'I am having thoughts of self-harm')
            .replace(/\b(i want|i need|i will)\b/gi, 'I am thinking about')
            .replace(/\s+/g, ' ')
            .trim();

      contextualPrompt = buildContextualPrompt(effectiveUserInput);

      let paraphrasedSuccess = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        openAIRes = await callOpenAI('gpt-4o');
        aiData = await openAIRes.json();
        rawContent = aiData.choices?.[0]?.message?.content || '';
        if (!refusalPatterns.some(p => p.test(rawContent))) {
          paraphrasedSuccess = true;
          break;
        }
        await new Promise(r => setTimeout(r, 800));
      }

      if (!paraphrasedSuccess) {
        const isShSensitive = contentAnalysis.category === 'self_harm';
        return new Response(
          JSON.stringify({
            error: 'CONTENT_BLOCKED',
            message: isShSensitive
              ? 'If you are in crisis, please reach out for immediate support. You are deeply loved by God, and your life has immeasurable value in Christ. Please contact a crisis helpline or a trusted Christian counselor.'
              : 'This topic could not be processed. For personalized guidance on sensitive matters, we recommend speaking with a Christian counselor or pastor.',
            alternatives: contentAnalysis.constructiveAlternatives,
            category: contentAnalysis.category,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Log raw output
    console.log('[Generate-Playbook] ===== RAW AI OUTPUT START =====');
    console.log(rawContent);
    console.log('[Generate-Playbook] ===== RAW AI OUTPUT END =====');

    if (!rawContent || rawContent.trim().length === 0) {
      throw new Error('AI returned empty response');
    }

    // Final refusal check after paraphrase attempt
    if (refusalPatterns.some(p => p.test(rawContent))) {
      const finalAnalysis = analyzeContent(userInput);
      return new Response(
        JSON.stringify({
          error: 'CONTENT_BLOCKED',
          message: finalAnalysis.christianMessage || 'This request could not be processed. Please try rephrasing.',
          alternatives: finalAnalysis.constructiveAlternatives,
          category: finalAnalysis.category,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse playbook (store original userInput, not paraphrased)
    let playbook = parseOpenAIResponse(aiData, userName, userInput, preferredBibleVersion);

    if (!playbook.title || playbook.title.trim().length < 3) {
      throw new Error('AI failed to generate a valid playbook title');
    }
    if (!Array.isArray(playbook.actionSteps) || playbook.actionSteps.length === 0) {
      throw new Error('AI failed to generate action steps');
    }

    // Enforce persona rules
    const enforcedContent = enforcePersona(rawContent, discernmentCompanionPersona);
    if (enforcedContent !== rawContent) {
      playbook = parseOpenAIResponse(
        { choices: [{ message: { content: enforcedContent } }] },
        userName,
        userInput,
        preferredBibleVersion
      );
    }

    // Enforce exact bible verse text
    await enforcePlaybookBibleVerse(playbook, preferredBibleVersion);

    playbook.totalTasks = playbook.actionSteps.length;
    playbook.progress = 0;
    playbook.persona = discernmentCompanionPersona.role;

    return new Response(JSON.stringify(playbook, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    console.error('Error generating playbook:', error);
    return new Response(
      JSON.stringify({
        error: "We couldn't create your playbook right now",
        message: 'Something went wrong. Please try again in a moment.',
        retryable: true,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

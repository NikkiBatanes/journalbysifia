/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { bibleVerseService } from '../_shared/bibleVerseService.ts';

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
  dateOfBirth?: string;
  preferredBibleTranslation?: string;
  isOnboarding?: boolean;
}

interface WisdomThreadEntry {
  question: string;
  wisdom: string;
}

function wisdomLimitForTier(tier?: string | null, trialChosenTier?: string | null): number {
  const base = String(tier || 'seeker').replace('_annual', '');
  const trialBase = String(trialChosenTier || 'growth').replace('_annual', '');

  if (base === 'free_trial') {
    if (trialBase === 'spark') return 2;
    if (trialBase === 'transformation') return 10;
    return 6;
  }

  if (base === 'spark') return 5;
  if (base === 'growth') return 12;
  if (base === 'transformation') return 25;
  return 2;
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

function stripModelJsonGarbage(value: string): string {
  return String(value || '')
    .replace(/\s*\]\s*\}\s*This keeps[\s\S]*$/i, '')
    .replace(/\s*This keeps the conversation[\s\S]*$/i, '')
    .replace(/\s*(?:\]\s*\}\s*){2,}[\s\S]*$/g, '')
    .replace(/\s*(?:\}\s*){4,}[\s\S]*$/g, '')
    .trim();
}

function cleanLongOutputText(value: unknown, max = 6000): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\*\*/g, '')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanWisdomStep(value: unknown, max = 600): string {
  if (typeof value === 'string') {
    return cleanOutputText(stripModelJsonGarbage(value), max);
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const line = cleanOutputText(record.Line ?? record.line ?? record.Phrase ?? record.phrase ?? record.Verse ?? record.verse, 240);
    const meaning = cleanOutputText(record.Meaning ?? record.meaning ?? record.Explanation ?? record.explanation, max);
    if (line && meaning) {
      return `Line: "${line}" Meaning: ${meaning}`;
    }

    const title = cleanOutputText(record.title ?? record.label ?? record.heading, 120);
    const text = cleanOutputText(record.text ?? record.body ?? record.content ?? record.description, max);
    if (title && text) {
      return `${title}: ${text}`;
    }
    if (text) {
      return text;
    }
  }

  return '';
}

function splitWisdomStepFragments(step: string): string[] {
  const normalized = cleanOutputText(stripModelJsonGarbage(step), 1800)
    .replace(/([.!?]["'”’])\s*,\s*["'“‘]\s*(?=(?:If|When|After|Then)\b)/gi, '$1\n')
    .replace(/(["”’])\s*,\s*["'“‘]\s*(?=(?:If|When|After|Then)\b)/gi, '$1\n')
    .replace(/'\s*,\s*'(?=(?:Ask|Follow|Listen|Share|Agree|Say|Tell|If|When|After|Then|Write|Call|Text|Send|Set)\b)/gi, "'\n")
    .replace(/"\s*,\s*"(?=(?:Ask|Follow|Listen|Share|Agree|Say|Tell|If|When|After|Then|Write|Call|Text|Send|Set)\b)/gi, '"\n')
    .replace(/\s+(?=(?:If they|When they|After they|Then ask|Then say)\b)/gi, '\n');

  return normalized
    .split(/\n+/)
    .map(part => cleanOutputText(stripModelJsonGarbage(part).replace(/^\s*[,;]+/, ''), 700))
    .filter(Boolean);
}

function parseWisdomJson(content: string): { intro: string; steps: string[] } {
  try {
    const parsed = JSON.parse(content);
    const intro = cleanOutputText(parsed?.intro, 500);
    const steps = Array.isArray(parsed?.steps)
      ? parsed.steps
          .flatMap((step: unknown) => splitWisdomStepFragments(cleanWisdomStep(step, 700)))
          .filter(Boolean)
          .slice(0, 14)
      : [];

    if (intro || steps.length > 0) {
      return { intro, steps };
    }
  } catch {
    // Fall through to plain-text normalization for older/non-compliant model output.
  }

  const normalizedContent = stripModelJsonGarbage(content);
  const lines = normalizedContent
    .split(/\n+/)
    .map(line => cleanOutputText(line, 500))
    .filter(Boolean);
  const listStartIndex = lines.findIndex(line => /^(?:\d+(?:\.\d+)?[\.)]|[-*•])\s+/.test(line));

  if (listStartIndex === -1) {
    return { intro: cleanOutputText(normalizedContent, 700), steps: [] };
  }

  return {
    intro: cleanOutputText(lines.slice(0, listStartIndex).join('\n\n'), 700),
    steps: lines
      .slice(listStartIndex)
      .filter(line => /^(?:\d+(?:\.\d+)?[\.)]|[-*•])\s+/.test(line))
      .map(line => cleanOutputText(line.replace(/^(?:\d+(?:\.\d+)?[\.)]|[-*•])\s+/, ''), 600))
      .filter(Boolean)
      .slice(0, 8),
  };
}

function formatWisdomText(wisdom: { intro: string; steps: string[] }): string {
  return [
    wisdom.intro,
    ...wisdom.steps.map((step, index) => `${index + 1}. ${step}`),
  ].filter(Boolean).join('\n\n');
}

function needsTwoColumnWisdom(actionBody: string, userQuestion: string): boolean {
  const actionText = String(actionBody || '').toLowerCase();
  const questionText = String(userQuestion || '').toLowerCase();
  const actionHasColumns = /\b(?:two|2)\s+columns?\b/.test(actionText)
    || /\bside[-\s]?by[-\s]?side\b/.test(actionText)
    || /\bone\s+listing\b[\s\S]*\banother\s+listing\b/i.test(actionText);
  const questionAsksColumns = /\b(?:two|2)\s+columns?\b/.test(questionText)
    || /\bside[-\s]?by[-\s]?side\b/.test(questionText)
    || /\b(?:make|show|turn|put|format)\b[\s\S]*\bcolumns?\b/.test(questionText);
  const broadExecutionQuestion = /\b(?:help|how|start|begin|what\s+(?:do|should)\s+i\s+(?:write|put|do)|i\s+don'?t\s+know)\b/.test(questionText);

  return questionAsksColumns || (actionHasColumns && broadExecutionQuestion);
}

function titleFromColumnPhrase(phrase: string, fallback: string): string {
  const cleaned = cleanOutputText(phrase, 120).replace(/[.!?]+$/g, '').trim();
  const lower = cleaned.toLowerCase();

  if (/\b(?:speak|talk|say|voice)\b/.test(lower) && !/\b(?:silence|silent|quiet)\b/.test(lower)) {
    return 'Speak because';
  }
  if (/\b(?:silence|silent|quiet|hold back|stay silent)\b/.test(lower)) {
    return 'Stay silent because';
  }

  const title = cleaned
    .replace(/^(?:reasons?\s+(?:you\s+)?(?:feel\s+)?(?:compelled\s+to\s+)?|things?\s+that\s+|why\s+|for\s+)/i, '')
    .trim();
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : fallback;
}

function inferTwoColumnTitles(actionBody: string): [string, string] {
  const body = cleanActionBody(actionBody, 1500);
  const naturalColumns = body.match(/(?:write|make|create|draw|fill(?:\s+out)?)\s+(?:two|2)\s+columns?\s*:\s*(?:one|first)\s+(?:column\s+)?(?:listing|for|called|with)?\s*(.+?)\s*;\s*(?:another|second)\s+(?:column\s+)?(?:listing|for|called|with)?\s*(.+?)(?:[.!?]|$)/i);
  if (naturalColumns) {
    return [
      titleFromColumnPhrase(naturalColumns[1], 'Column 1'),
      titleFromColumnPhrase(naturalColumns[2], 'Column 2'),
    ];
  }

  if (/\b(?:speak|talk|voice)\b/i.test(body) && /\b(?:silent|silence|quiet)\b/i.test(body)) {
    return ['Speak because', 'Stay silent because'];
  }

  return ['Column 1', 'Column 2'];
}

function exampleItemsForColumn(title: string): string[] {
  const lower = title.toLowerCase();
  if (/\b(?:speak|talk|voice)\b/.test(lower)) {
    return [
      'I want peace restored',
      'I need to correct a misunderstanding',
      'I want truth to be clear without attacking',
    ];
  }
  if (/\b(?:silent|silence|quiet)\b/.test(lower)) {
    return [
      'I am afraid of rejection',
      'I am avoiding discomfort',
      'Waiting may help me speak calmly later',
    ];
  }
  return [
    'Write one specific reason',
    'Add one honest motive',
    'Mark whether it is love, fear, pride, or control',
  ];
}

function ensureTwoColumnWisdom(
  wisdom: { intro: string; steps: string[] },
  actionBody: string,
  userQuestion: string,
): { intro: string; steps: string[] } {
  if (!needsTwoColumnWisdom(actionBody, userQuestion)) {
    return wisdom;
  }

  const hasColumnSteps = wisdom.steps.some(step => /^Under\s+["'“‘]?[^"'”’]+["'”’]?,?\s+list\s+/i.test(step));
  if (hasColumnSteps) {
    return wisdom;
  }

  const [leftTitle, rightTitle] = inferTwoColumnTitles(actionBody);
  const makeColumnStep = (title: string) => {
    const items = exampleItemsForColumn(title)
      .map((item, index) => `${index + 1}) ${item}`)
      .join('; ');
    return `Under "${title}," list these points: ${items}.`;
  };

  return {
    intro: wisdom.intro || 'Use the two columns to separate what is pulling you toward one response from what is pulling you toward the other.',
    steps: [
      makeColumnStep(leftTitle),
      makeColumnStep(rightTitle),
      'After both columns are written, circle the reasons that are honest before God and rooted in love, then choose the next obedient step from those motives.',
    ],
  };
}

function titleCaseScriptureReference(reference: string): string {
  return String(reference || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b([a-z])/g, char => char.toUpperCase());
}

function formatScriptureDisplayReference(reference: string, version: string): string {
  const cleanReference = titleCaseScriptureReference(reference);
  const cleanVersion = String(version || 'NASB').trim().toUpperCase();
  return cleanVersion ? `${cleanReference} (${cleanVersion})` : cleanReference;
}

function formatScriptureCardReference(reference: string, version: string): string {
  const displayReference = formatScriptureDisplayReference(reference, version);
  return displayReference.replace(
    /^(.+\s\d+):(\d+(?:-\d+)?)(\s+\([^)]+\))?$/i,
    (_match, bookChapter: string, versePart: string, versionPart = '') => {
      const verseLabel = String(versePart).includes('-') ? 'verses' : 'verse';
      return `${bookChapter} ${verseLabel} ${versePart}${versionPart}`;
    },
  );
}

function formatScriptureCardStep(reference: string, version: string, scriptureText: string): string {
  const displayReference = formatScriptureCardReference(reference, version);
  const text = cleanLongOutputText(scriptureText);
  return `Scripture ${displayReference}: ${text}`;
}

function extractScriptureLineSegments(scriptureText: string, maxSegments = 6): string[] {
  const normalized = cleanLongOutputText(scriptureText, 3000)
    .replace(/\s*\*\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return [];
  }

  const verseLikeSegments = normalized
    .split(/\s+(?=\d{1,3}\s+[A-Z"“])/)
    .map(segment => segment.replace(/^\d{1,3}\s+/, '').trim())
    .filter(segment => segment.length > 20);

  const sourceSegments = verseLikeSegments.length >= 2
    ? verseLikeSegments
    : normalized.split(/(?<=[.!?])\s+(?=[A-Z"“])/).filter(segment => segment.length > 20);

  return sourceSegments
    .map(segment => segment.length > 180 ? `${segment.slice(0, 177).trim()}...` : segment)
    .slice(0, maxSegments);
}

function fallbackScriptureExplanationSteps(scriptureText: string, isLineByLineRequest: boolean): string[] {
  const segments = extractScriptureLineSegments(scriptureText, isLineByLineRequest ? 6 : 3);

  if (isLineByLineRequest && segments.length > 0) {
    return segments.map(segment => (
      `Line: "${segment}" Meaning: Pause over this part of the passage and ask what it reveals about Jesus, human need, and the response God is calling for.`
    ));
  }

  return [
    'Read the passage slowly once without stopping, then read it again and mark repeated ideas or questions.',
    'Ask what this passage shows about Jesus, what it exposes about the human heart, and what response of faith or obedience it calls for.',
    'Write one sentence that begins with: This passage shows me that Jesus...',
  ];
}

function normalizeScriptureQuestionIntent(question: string): string {
  return String(question || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isScriptureExplanationRequest(question: string): boolean {
  const normalized = normalizeScriptureQuestionIntent(question);
  const compact = normalized.replace(/\s+/g, '');

  return /\b(explain|explanation|meaning|commentary|interpret|break down|breakdown|what does|what is|why does|how does)\b/i.test(normalized)
    || /explanati[oa]n/.test(compact)
    || /explain/.test(compact)
    || /linebyline/.test(compact)
    || /versebyverse/.test(compact);
}

function isScriptureLineByLineRequest(question: string): boolean {
  const normalized = normalizeScriptureQuestionIntent(question);
  const compact = normalized.replace(/\s+/g, '');

  return /\b(line by line|line-by-line|verse by verse|verse-by-verse|break down|breakdown)\b/i.test(normalized)
    || /linebyline/.test(compact)
    || /versebyverse/.test(compact);
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

function calculateAgeFromDate(dateOfBirth?: string): number | null {
  if (!dateOfBirth || typeof dateOfBirth !== 'string') {
    return null;
  }

  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  if (age < 0 || age > 120) {
    return null;
  }
  return age;
}

type ScriptureDetectionResult = {
  isScripture: boolean;
  reference?: string;
  references?: string[];
  requestedCount?: number | null;
  isFullChapter: boolean;
};

const BIBLE_REFERENCE_REGEX = /\b(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|1\s*samuel|2\s*samuel|1\s*kings|2\s*kings|1\s*chronicles|2\s*chronicles|ezra|nehemiah|esther|job|psalm|proverbs|ecclesiastes|song\s*of\s*solomon|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|1\s*corinthians|2\s*corinthians|galatians|ephesians|philippians|colossians|1\s*thessalonians|2\s*thessalonians|1\s*timothy|2\s*timothy|titus|philemon|hebrews|james|1\s*peter|2\s*peter|1\s*john|2\s*john|3\s*john|jude|revelation)\s+\d+(?::\d+(?:-\d+)?)?/gi;

const SCRIPTURE_COUNT_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
};

function normalizeReferenceKey(reference: string): string {
  return String(reference || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function requestedScriptureCount(question: string, actionContext = ''): number | null {
  const q = String(question || '').toLowerCase();
  const context = String(actionContext || '').toLowerCase();
  const countPattern = /\b(\d+|one|two|three|four|five|six|seven|eight)\s+(?:scriptures?|verses?|passages?|references?)\b/i;
  const questionMatch = q.match(countPattern);
  const contextMatch = context.match(countPattern);
  const match = questionMatch || (/\b(?:verses|scriptures|passages|references|all|these|those)\b/i.test(q) ? contextMatch : null);
  const rawCount = match?.[1];

  if (!rawCount) {
    return null;
  }

  const parsed = /^\d+$/.test(rawCount)
    ? Number(rawCount)
    : SCRIPTURE_COUNT_WORDS[rawCount];

  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 6)) : null;
}

function appendUniqueReferences(base: string[], additions: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const reference of [...base, ...additions]) {
    const cleaned = String(reference || '').replace(/\s+/g, ' ').trim();
    const key = normalizeReferenceKey(cleaned);
    if (!cleaned || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(cleaned);
    if (out.length >= limit) {
      break;
    }
  }

  return out;
}

function extractScriptureReferences(value: string): string[] {
  const seen = new Set<string>();
  const references: string[] = [];

  for (const match of String(value || '').matchAll(BIBLE_REFERENCE_REGEX)) {
    const reference = match[0].replace(/\s+/g, ' ').trim();
    const key = reference.toLowerCase();
    if (reference && !seen.has(key)) {
      seen.add(key);
      references.push(reference);
    }
  }

  return references;
}

function normalizeSuggestedScriptureReference(value: unknown): string {
  const [reference] = extractScriptureReferences(String(value || ''));
  return reference || '';
}

function detectScriptureRequest(question: string, actionContext?: string): ScriptureDetectionResult {
  const q = question.toLowerCase();
  const context = actionContext?.toLowerCase() || '';
  
  console.log('[Get-Action-Guidance] Detecting scripture request in:', q);
  console.log('[Get-Action-Guidance] Action context:', context);
  
  // Exclude context/explanation requests - these should be handled by AI wisdom, not verse fetching
  const isContextRequest = /\b(context|background|meaning|explain|explanation|interpret|commentary|what does.*mean|why|how.*understand)\b/i.test(q);
  if (isContextRequest) {
    console.log('[Get-Action-Guidance] Context/explanation request detected, skipping verse fetch');
    return { isScripture: false, isFullChapter: false };
  }
  
  // Detect if asking for scripture - more flexible keywords
  const scriptureKeywords = /\b(scripture|bible|verse|verses|chapter|passage|read|text|full|entire|whole|complete|show|give|what|what's|whats)\b/i.test(q);
  
  const questionReferences = extractScriptureReferences(q);
  const contextReferences = extractScriptureReferences(context);
  const requestedCount = requestedScriptureCount(q, context);
  const asksForScriptureReference = /\b(?:scripture|scriptures|bible|verse|verses|passage|passages|reference|references)\b/i.test(q);
  const wantsMultipleReferences = (requestedCount || 0) > 1 || /\b(?:verses|scriptures|passages|references|all|both|these|those)\b/i.test(q);
  const canSelectContextualReferences = asksForScriptureReference && context.trim().length > 0;
  const hasScriptureSource = questionReferences.length > 0 || contextReferences.length > 0 || canSelectContextualReferences;
  
  console.log('[Get-Action-Guidance] scriptureKeywords:', scriptureKeywords, 'hasScriptureSource:', hasScriptureSource, 'requestedCount:', requestedCount);
  
  if (!scriptureKeywords || !hasScriptureSource) {
    return { isScripture: false, isFullChapter: false };
  }

  const references = questionReferences.length > 0
    ? (wantsMultipleReferences ? questionReferences : [questionReferences[0]])
    : contextReferences.length > 0
      ? (wantsMultipleReferences ? contextReferences.slice(0, requestedCount || 4) : [contextReferences[0]])
      : [];

  const reference = references[0];
  console.log('[Get-Action-Guidance] References extracted:', references);
  
  // Keep bare chapter references intact so the Bible provider can return the full chapter.
  references.forEach(ref => {
    if (!/:/.test(ref)) {
      console.log('[Get-Action-Guidance] Reference has no verses, keeping as full chapter reference:', ref);
    }
  });

  const explicitFullChapterRequest = /\b(full|entire|whole|complete)\b.*chapter/i.test(q) ||
                                    /\bchapter.*\b(full|entire|whole|complete)\b/i.test(q);
  const explicitVerseRangeRequest = /\b\d+:\d+-\d+\b/.test(q) ||
                                    /\b\d+:\d+-\d+\b/.test(context) ||
                                    references.some(ref => /\b\d+:\d+-\d+\b/.test(ref));
  const bareChapterRequest = references.some(ref => !/:/.test(ref)) && /\bchapter\b/i.test(q);
  
  // Detect if asking for full chapter
  const isFullChapter = explicitFullChapterRequest || explicitVerseRangeRequest || bareChapterRequest;

  console.log('[Get-Action-Guidance] isFullChapter:', isFullChapter);
  return { isScripture: true, reference, references, requestedCount, isFullChapter };
}

async function fetchScriptureText(reference: string, preferredTranslation?: string): Promise<{ text: string; reference: string; version: string }> {
  try {
    // Use user's preferred translation if provided, otherwise default to NASB
    const version = preferredTranslation || 'NASB';
    console.log('[Get-Action-Guidance] Fetching scripture with version:', version);
    const verse = await bibleVerseService.fetchVerse(reference, version);
    return {
      text: verse.text,
      reference: verse.reference || reference,
      version: verse.version || version,
    };
  } catch (error) {
    console.error('[Get-Action-Guidance] Failed to fetch scripture:', error);
    throw error;
  }
}

async function suggestScriptureReferencesWithAI(args: {
  playbookTitle: string;
  truthSummary: string;
  truthInLove: string;
  actionTitle: string;
  actionBody: string;
  userQuestion: string;
  existingReferences: string[];
  requestedCount: number;
}): Promise<string[]> {
  const openAIKey = Deno.env.get('OPENAI_API_KEY');
  const targetCount = Math.max(1, Math.min(args.requestedCount || 3, 6));
  const candidateLimit = Math.min(targetCount + 2, 8);

  if (!openAIKey) {
    console.warn('[Get-Action-Guidance] Missing OpenAI API key for scripture reference selection.');
    return appendUniqueReferences([], args.existingReferences, candidateLimit);
  }

  const prompt = [
    'Choose Bible references for this one faithful action.',
    '',
    `Need: ${targetCount} ${targetCount === 1 ? 'reference' : 'references'}.`,
    args.existingReferences.length
      ? `Existing starter references to preserve if relevant: ${args.existingReferences.join(', ')}`
      : 'There are no starter references.',
    '',
    'Rules:',
    '- Return references only, never verse text.',
    '- Match the current action topic, not a generic fixed theme.',
    '- Prefer individual verses. Use a 2-verse range only if both verses are needed.',
    '- Do not use chapter-length ranges unless the user explicitly asked for a chapter.',
    '- Use the Protestant Bible canon.',
    '- Return a few extra candidates if helpful so the app can still fetch enough exact text.',
    '',
    'Context:',
    `Playbook: ${cleanText(args.playbookTitle, 180)}`,
    `Truth: ${cleanText(args.truthSummary, 500)}`,
    args.truthInLove ? `Truth in Love: ${cleanText(args.truthInLove, 500)}` : '',
    `Action: ${cleanText(args.actionTitle, 180)}`,
    `Action description: ${cleanActionBody(args.actionBody, 1500)}`,
    `User asks: ${cleanText(args.userQuestion, 500)}`,
    '',
    'Return ONLY valid JSON in this exact shape:',
    '{"references":["Book chapter:verse","Book chapter:verse"]}',
  ].filter(Boolean).join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAIKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: 'You select Bible references for a Christian app. Return only valid JSON and do not provide verse text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.20,
        top_p: 1,
        max_completion_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Get-Action-Guidance] Scripture reference selection OpenAI error:', errorText);
      return appendUniqueReferences([], args.existingReferences, candidateLimit);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    console.log('[Get-Action-Guidance] Scripture reference selection raw response:', raw);

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error('[Get-Action-Guidance] Scripture reference selection JSON parse failed:', error);
      return appendUniqueReferences([], args.existingReferences, candidateLimit);
    }

    const normalizedReferences = Array.isArray(parsed.references)
      ? parsed.references
        .map(normalizeSuggestedScriptureReference)
        .filter(Boolean)
      : [];
    const references = appendUniqueReferences(args.existingReferences, normalizedReferences, candidateLimit);
    console.log('[Get-Action-Guidance] Contextual scripture references selected:', references);
    return references;
  } catch (error) {
    console.error('[Get-Action-Guidance] Scripture reference selection failed:', error);
    return appendUniqueReferences([], args.existingReferences, candidateLimit);
  }
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
  dateOfBirth?: string;
}): string {
  const calculatedAge = calculateAgeFromDate(args.dateOfBirth);
  const audienceContext = calculatedAge !== null
    ? `\n\n## AUDIENCE CONTEXT\nUser is exactly ${calculatedAge} years old, calculated from their birthday. Use language that is appropriate for this age level - simpler vocabulary and sentence structure for younger users, more nuanced language for adults. Do not generalize beyond the exact age, and do not mention the age unless it directly matters.`
    : '\n\n## AUDIENCE CONTEXT\nAge is unknown because no birthday is available. Do not assume school, parents, marriage, parenting, career stage, or retirement unless the user clearly says it.';

  return [
    'ACTION EXECUTION HELPER: Help the user carry out ONE specific faithful action. This is not general coaching.',
    '',
    '=== CONTEXT ===',
    `Playbook: ${cleanText(args.playbookTitle, 180)}`,
    `Truth: ${cleanText(args.truthSummary, 500)}`,
    args.truthInLove?.trim() ? `Truth in Love direction: ${cleanText(args.truthInLove, 500)}` : '',
    audienceContext,
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
    'If the action involves journaling, writing reflection, tracking thoughts, listing blessings, or recording progress, gently suggest using the in-app journal or reflection space. Do not tell the user to open a separate notes app unless they specifically ask for outside-app options.',
    'For in-app journal suggestions, be non-pushy and awareness-based. Prefer wording like: "You can use the journal space in the app for this if that feels helpful," or "When you notice it, capture it in your journal here."',
    'If the user is confused about meaning: explain it clearly and concisely.',
    'If the user asks about differences: explain the actual differences with specifics.',
    'If the user asks for a short Scripture verse and the text is available in the action context, quote it exactly. If the user asks for a full chapter or long passage, do not invent or paraphrase the full text. Give the reference, explain that the user should open it in their Bible or the app Scripture screen, then give specific study steps for that passage.',
    'Do not claim "Here is the full text" unless the full Bible text is actually included in the response.',
    '',
    'Before writing the response, ask yourself: what is the user ACTUALLY asking for in THIS specific question?',
    'Answer ONLY what the user is asking about in this follow-up question. Do not assume they want the full arc unless their question explicitly asks for it.',
    'CRITICAL: If the user expresses an emotional state (fear, anxiety, hesitation, doubt, worry, scared, nervous, afraid, etc.), ADDRESS THAT EMOTION FIRST before giving practical steps.',
    'Example: if user says "but I\'m scared" or "I\'m afraid", acknowledge their fear and provide comfort/encouragement before giving the script. Do not ignore their emotional concern.',
    'If the user is expressing fear about doing the action, help them work through the fear with gentle encouragement and small steps, not just a cold script.',
    'Example: if action is "seek forgiveness" and user says "but I\'m scared", respond with comfort first: "It\'s completely normal to feel scared about apologizing. That shows you care. Here\'s a gentle way to start..." then give the script.',
    'If the user asks about the gospel/evangelism aspect specifically (e.g. "how do I share Jesus", "what do I say about the gospel"), then include a clear gospel bridge in simple words: sin separates us from God, Jesus died and rose to reconcile/forgive us, and we respond by trusting/turning to Him.',
    'For evangelism scripts when the user asks for the gospel content, include a gentle response question such as: "Has anyone ever explained that to you before?" or "Would you want to hear more about what it means to trust Jesus?"',
    'If the user\'s question is about something else (opener, bridge, handling objections, what to say if they say no), answer ONLY that specific part. Do not add gospel content unless the question asks for it.',
    'Each step must be something the user physically does as part of executing THIS action — not a new action.',
    'Steps should feel like: "Here is exactly how to do this thing you are already trying to do."',
    'IMPORTANT: If the action description already contains sub-steps, exact words, or a script, extract and present those — do not invent a new one.',
    'When presenting a script from the action description, each distinct line or instruction becomes one clean step in the JSON steps array.',
    'Do not combine a message/script and a follow-up instruction in the same steps item. Example: one step is "Send this message: ..."; the next separate step is "If they respond positively, ask: ...".',
    'Never put comma-joined quoted scripts like "\'message\',\'If they respond..." inside one step.',
    'If the action description or user question asks for a two-column list, comparison table, or side-by-side columns, preserve that format even if the user only says "help me." Put each column in its own step using this exact shape: "Under \"Column A,\" list these points: 1) point one; 2) point two; 3) point three." and "Under \"Column B,\" list these points: 1) point one; 2) point two; 3) point three."',
    'For two-column answers, do not flatten both columns into ordinary numbered steps only. The app renders "Under ..." column steps as a side-by-side table.',
    'If the user asks for a list of resources, materials, books, curricula, or studies, put the whole resource list in ONE step using this exact shape: "Make a list including these materials: item one, item two, item three, item four, item five."',
    'For resource/material lists, do not put all resources in the intro and do not split one resource list across separate unrelated prose steps.',
    'If the user asks to explain Scripture line by line, each step must use this exact shape: "Line: \\"the verse phrase\\" Meaning: concise explanation."',
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

  let refundReservedWisdomCharge: (() => Promise<void>) | null = null;

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
    const truthInLove = cleanText(body.truthInLove, 700);
    const previousWisdom = cleanText(body.previousWisdom, 1200);
    const preferredBibleTranslation = cleanText(body.preferredBibleTranslation, 20);
    const isOnboarding = body.isOnboarding === true;

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
    let wisdomLimit = 0;
    let usedWisdom = 0;

    // Get playbook data
    const { data: playbook, error: playbookError } = await supabase
      .from('playbooks')
      .select('title, user_input')
      .eq('id', playbookId)
      .eq('user_id', userId)
      .single();

    const dateOfBirth = cleanText(body.dateOfBirth, 50);

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

    const { data: subscription, error: subscriptionError } = await supabase
      .from('user_subscriptions_new')
      .select('tier, trial_chosen_tier, wisdom_count')
      .eq('user_id', userId)
      .maybeSingle();

    if (subscriptionError) {
      throw subscriptionError;
    }

    wisdomLimit = isOnboarding ? 1 : wisdomLimitForTier(subscription?.tier, subscription?.trial_chosen_tier);
    usedWisdom = Number(subscription?.wisdom_count || 0);

    if (wisdomLimit !== -1 && usedWisdom >= wisdomLimit) {
      const normalizedTier = String(subscription?.tier || 'seeker').replace('_annual', '');
      return new Response(
        JSON.stringify({
          error: 'WISDOM_LIMIT_REACHED',
          message: isOnboarding
            ? 'You have used your onboarding How To request. You will get your normal How To requests after onboarding.'
            : normalizedTier === 'transformation'
            ? `You've used all ${wisdomLimit} wisdom requests this month. Your wisdom requests will refresh next month.`
            : `You've used all ${wisdomLimit} wisdom requests this month. Upgrade for more!`,
          wisdomCount: usedWisdom,
          wisdomLimit,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: reservedWisdom, error: reserveError } = await supabase
      .from('user_subscriptions_new')
      .update({
        wisdom_count: usedWisdom + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('wisdom_count', usedWisdom)
      .select('wisdom_count')
      .maybeSingle();

    if (reserveError) {
      throw reserveError;
    }

    if (!reservedWisdom) {
      return new Response(
        JSON.stringify({
          error: 'WISDOM_LIMIT_REACHED',
          message: 'Your wisdom usage changed while siFia was preparing this request. Please try again.',
          wisdomCount: usedWisdom,
          wisdomLimit,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    refundReservedWisdomCharge = async () => {
      const { error: refundError } = await supabase
        .from('user_subscriptions_new')
        .update({
          wisdom_count: usedWisdom,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('wisdom_count', usedWisdom + 1);

      if (refundError) {
        console.warn('[Get-Action-Guidance] Failed to refund reserved wisdom usage after generation failure', refundError);
      }
    };

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
      dateOfBirth,
    });
    const actionContext = `${actionTitle} ${actionBody} ${truthSummary} ${truthInLove}`;

    // Check if user is asking for scripture text before charging wisdom
    const scriptureRequest = detectScriptureRequest(userQuestion, actionContext);
    let scriptureText = '';
    const scriptureResults: Array<{ text: string; reference: string; version: string }> = [];
    let isPureScriptureRequest = false;

    if (scriptureRequest.isScripture) {
      const startingReferences = scriptureRequest.references?.length
        ? scriptureRequest.references
        : (scriptureRequest.reference ? [scriptureRequest.reference] : []);
      const pluralReferenceRequest = /\b(?:verses|scriptures|passages|references)\b/i.test(userQuestion);
      const targetReferenceCount = scriptureRequest.requestedCount
        || (startingReferences.length > 1 ? startingReferences.length : (pluralReferenceRequest ? 3 : 1));
      const candidateReferenceLimit = Math.min(targetReferenceCount + 2, 8);
      let requestedReferences = appendUniqueReferences([], startingReferences, candidateReferenceLimit);

      if (requestedReferences.length < targetReferenceCount) {
        requestedReferences = await suggestScriptureReferencesWithAI({
          playbookTitle: playbook.title || '',
          truthSummary,
          truthInLove,
          actionTitle,
          actionBody,
          userQuestion,
          existingReferences: requestedReferences,
          requestedCount: targetReferenceCount,
        });
      }

      console.log('[Get-Action-Guidance] Scripture request detected:', requestedReferences);

      // Check if it's a pure scripture request (no explanation asked)
      isPureScriptureRequest = !isScriptureExplanationRequest(userQuestion);

      for (const requestedReference of requestedReferences) {
        if (scriptureResults.length >= targetReferenceCount) {
          break;
        }

        try {
          const scriptureResult = await fetchScriptureText(requestedReference, preferredBibleTranslation);
          scriptureResults.push(scriptureResult);
          console.log('[Get-Action-Guidance] Scripture fetched successfully', {
            reference: scriptureResult.reference,
            length: scriptureResult.text.length,
          });
        } catch (error) {
          console.error('[Get-Action-Guidance] Failed to fetch scripture reference:', requestedReference, error);
        }
      }

      if (scriptureResults.length > 0) {
        scriptureText = scriptureResults.map(result => result.text).join('\n\n');
      }
    }

    // If scripture was fetched, return it in the same thread format as normal wisdom.
    if (scriptureResults.length > 0) {
      console.log('[Get-Action-Guidance] Scripture fetched, returning formatted scripture wisdom');
      const displayReference = scriptureResults
        .map(result => formatScriptureDisplayReference(result.reference, result.version))
        .join('; ');
      const scriptureCardSteps = scriptureResults.map(result =>
        formatScriptureCardStep(result.reference, result.version, result.text)
      );
      const scriptureTextForExplanation = scriptureResults
        .map(result => [
          formatScriptureDisplayReference(result.reference, result.version),
          result.text,
        ].join('\n'))
        .join('\n\n');
      let wisdom = formatWisdomText({
        intro: '',
        steps: scriptureCardSteps,
      });

      // If explanation is requested, get it from OpenAI and append
      if (!isPureScriptureRequest) {
        console.log('[Get-Action-Guidance] Explanation requested, getting from OpenAI');
        const isLineByLineRequest = isScriptureLineByLineRequest(userQuestion);
        const explanationPrompt = [
          `Here is the full text of ${displayReference}:`,
          '',
          scriptureTextForExplanation,
          '',
          `User asks: ${userQuestion}`,
          '',
          'Return ONLY valid JSON in this exact shape:',
          '{"intro":"one sentence that introduces the explanation","steps":["one clear explanation step","another clear explanation step"]}',
          isLineByLineRequest
            ? 'Because the user asked for line-by-line explanation, every step must use this exact shape: Line: "short phrase from the passage" Meaning: concise explanation.'
            : 'Explain clearly and faithfully. Keep each step concise and easy to render on mobile.',
        ].join('\n');

        let parsedExplanation: { intro: string; steps: string[] } | null = null;
        const explanationKey = Deno.env.get('OPENAI_API_KEY');

        if (explanationKey) {
          try {
            const explanationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${explanationKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4.1-mini',
                messages: [
                  {
                    role: 'system',
                    content: 'You are a helpful Bible teacher. Explain Scripture clearly and faithfully. Return only valid JSON.',
                  },
                  {
                    role: 'user',
                    content: explanationPrompt,
                  },
                ],
                temperature: 0.30,
                max_completion_tokens: 1200,
                response_format: { type: 'json_object' },
              }),
            });

            if (explanationResponse.ok) {
              const explanationData = await explanationResponse.json();
              const explanationRaw = explanationData.choices?.[0]?.message?.content || '';
              console.log('[Get-Action-Guidance] Explanation AI Raw Response:', explanationRaw);
              const candidateExplanation = parseWisdomJson(explanationRaw);
              if (candidateExplanation.steps.length > 0) {
                parsedExplanation = candidateExplanation;
              } else {
                console.warn('[Get-Action-Guidance] Explanation response had no usable steps.');
              }
            } else {
              const explanationError = await explanationResponse.text();
              console.error('[Get-Action-Guidance] Explanation OpenAI error:', explanationError);
            }
          } catch (error) {
            console.error('[Get-Action-Guidance] Explanation OpenAI request failed:', error);
          }
        } else {
          console.error('[Get-Action-Guidance] Missing OpenAI API key for scripture explanation.');
        }

        const explanationSteps = parsedExplanation?.steps.length
          ? parsedExplanation.steps
          : fallbackScriptureExplanationSteps(scriptureText, isLineByLineRequest);

        wisdom = formatWisdomText({
          intro: parsedExplanation?.intro || (isLineByLineRequest ? 'Here is a line-by-line explanation.' : 'Here is a clear explanation.'),
          steps: [...scriptureCardSteps, ...explanationSteps],
        });
      }

      const threadEntry = {
        question: cleanOutputText(userQuestion, 1000),
        wisdom,
      };
      const storedWisdom = serializeWisdomThread([threadEntry, ...existingThread]);

      // Save to wisdom thread
      const { error: saveError } = await supabase
        .from('playbook_action_steps')
        .update({
          wisdom_text: storedWisdom,
          updated_at: new Date().toISOString(),
        })
        .eq('id', actionId)
        .eq('playbook_id', playbookId);

      if (saveError) {
        console.error('[Get-Action-Guidance] Failed to save scripture to wisdom thread:', saveError);
      }

      return new Response(JSON.stringify({
        success: true,
        wisdom,
        actionId,
        storedWisdom,
        wisdomThread: [threadEntry, ...existingThread],
        wisdomCount: usedWisdom + 1,
        wisdomLimit,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
        model: 'gpt-4.1-mini',
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
        temperature: 0.30,
        top_p: 1,
        max_completion_tokens: 1000, // Increase for line-by-line explanations
        frequency_penalty: 0.20,
        presence_penalty: 0,
        response_format: { type: 'json_object' },
      }),
    });

    const openAIResponse = await createWisdomCompletion(prompt);

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('[Get-Action-Guidance] OpenAI error:', errorText);
      await refundReservedWisdomCharge?.();
      refundReservedWisdomCharge = null;
      return new Response(
        JSON.stringify({ error: 'AI_ERROR', message: 'Could not generate wisdom right now. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const openAIdata = await openAIResponse.json();
    const rawWisdom = openAIdata.choices?.[0]?.message?.content || '';
    console.log('[Get-Action-Guidance] AI Raw Response:', rawWisdom);

    // Log token usage
    const usage = openAIdata.usage;
    if (usage) {
      console.log('[Get-Action-Guidance] ===== TOKEN USAGE =====');
      console.log('[Get-Action-Guidance] Model:', openAIdata.model);
      console.log('[Get-Action-Guidance] Prompt Tokens (Input):', usage.prompt_tokens);
      console.log('[Get-Action-Guidance] Completion Tokens (Output):', usage.completion_tokens);
      console.log('[Get-Action-Guidance] Total Tokens:', usage.total_tokens);
      console.log('[Get-Action-Guidance] - Input Cost ($0.40/M):', (usage.prompt_tokens * 0.00040 / 1000).toFixed(6), 'USD');
      console.log('[Get-Action-Guidance] - Output Cost ($1.60/M):', (usage.completion_tokens * 0.00160 / 1000).toFixed(6), 'USD');
      console.log('[Get-Action-Guidance] - Total Cost:', ((usage.prompt_tokens * 0.00040 + usage.completion_tokens * 0.00160) / 1000).toFixed(6), 'USD');
    }

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
        'Each script line or question must be a separate string in the steps array.',
        'Do not comma-join quoted scripts inside one step.',
        'Do not add prose after the JSON object.',
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
        'Each script line or question must be a separate string in the steps array.',
        'Do not add prose after the JSON object.',
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

    parsedWisdom = ensureTwoColumnWisdom(parsedWisdom, actionBody, userQuestion);

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
      wisdomCount: usedWisdom + 1,
      wisdomLimit,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    await refundReservedWisdomCharge?.();
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

/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { buildGuidedPlaybookPrompt, detectChurchOrder } from './persona.config.ts';
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
  category?: string;
  truthInLove: {
    summary: string;
    text: string;
  };
  actionSteps: ActionStep[];
  wordsToSpeak: string[];
  wordToSpeak?: string; // legacy compatibility
  bibleVerse: {
    text: string;
    reference: string;
    version?: string;
  };
  directChallenge?: string;
  challengeCTA?: string;
  prayer?: string;
  bibleVerseReflection?: string;
  faithfulActionsIntro?: string;
  transitionLine?: string;
  profileImage?: string;
  progress: number;
  totalTasks: number;
  user_id?: string;
  userInput?: string;
  createdAt?: string;
  updatedAt?: string;
  persona?: string;
  bibleVersion?: string;
  location?: string;
  userTier?: string;
  isOnboarding?: string;
}

// ─── JSON Schema for Structured Outputs ─────────────────────────────────────
// completion is now a structured object {question, lines} — not a flat string.
// This forces the model to separate the reflective question from the imperative lines,
// giving the UI clean data without regex parsing.

const PLAYBOOK_JSON_SCHEMA = {
  name: 'sifiaPlaybook',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      playbook_title: { type: 'string' },
      category: {
        type: 'string',
        enum: [
          'Relationships',
          'Family',
          'Marriage',
          'Singleness',
          'Friendship',
          'Work & Career',
          'Calling & Purpose',
          'Finance & Stewardship',
          'Decision-Making',
          'Conflict & Boundaries',
          'Hurt & Forgiveness',
          'Faith & Obedience',
          'Church & Ministry',
          'Parenting',
          'Emotions & Inner Life',
          'Health & Wellness',
          'Anxiety & Peace',
          'Fear & Trust',
          'Waiting & Uncertainty',
          'Grief & Loss',
          'Shame & Guilt',
        ],
      },
      truth_summary: { type: 'string' },
      truth_in_love: { type: 'string' },
      transition_line: { type: 'string' },
      bible_verse: {
        type: 'object',
        properties: {
          reference: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['reference', 'text'],
        additionalProperties: false,
      },
      // Exactly 3 lines — enforced in validation + prompt
      scripture_note_lines: {
        type: 'array',
        items: { type: 'string' },
      },
      // 5–7 core steps, plus one optional counselor/pastor support bonus
      faithful_actions: {
        type: 'array',
        minItems: 5,
        maxItems: 8,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 3 },
            description: { type: 'string' },
            body: { type: 'string', minLength: 10 },
            primary_button: { type: 'string', minLength: 2 },
            secondary_button: { type: 'string', minLength: 2 },
          },
          required: ['title', 'description', 'body', 'primary_button', 'secondary_button'],
          additionalProperties: false,
        },
      },
      prayer: { type: 'string', minLength: 50 },
      // 4–5 lines — enforced in validation + prompt
      words_to_speak: {
        type: 'array',
        minItems: 4,
        items: { type: 'string', minLength: 5 },
      },
      // Pastoral closing affirmation shown on the completion screen before "Before you close:"
      closing: { type: 'string', minLength: 20 },
      // Structured object: separates reflective question from closing imperatives
      completion: {
        type: 'object',
        properties: {
          question: { type: 'string', minLength: 10 },
          lines: {
            type: 'array',
            minItems: 2,
            items: { type: 'string', minLength: 3 },
          },
        },
        required: ['question', 'lines'],
        additionalProperties: false,
      },
    },
    required: [
      'playbook_title',
      'category',
      'truth_summary',
      'truth_in_love',
      'transition_line',
      'bible_verse',
      'scripture_note_lines',
      'faithful_actions',
      'prayer',
      'words_to_speak',
      'closing',
      'completion',
    ],
    additionalProperties: false,
  },
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function removeOverusedNavigationLanguage(text: string): string {
  return text
    .replace(/\b[Nn]avigating\s+through\b/g, (match) => match[0] === 'N' ? 'Walking through' : 'walking through')
    .replace(/\b[Nn]avigate\s+through\b/g, (match) => match[0] === 'N' ? 'Walk through' : 'walk through')
    .replace(/\b[Nn]avigates\s+through\b/g, (match) => match[0] === 'N' ? 'Walks through' : 'walks through')
    .replace(/\b[Nn]avigated\s+through\b/g, (match) => match[0] === 'N' ? 'Walked through' : 'walked through')
    .replace(/\b[Nn]avigating\b/g, (match) => match[0] === 'N' ? 'Facing' : 'facing')
    .replace(/\b[Nn]avigate\b/g, (match) => match[0] === 'N' ? 'Face' : 'face')
    .replace(/\b[Nn]avigates\b/g, (match) => match[0] === 'N' ? 'Faces' : 'faces')
    .replace(/\b[Nn]avigated\b/g, (match) => match[0] === 'N' ? 'Faced' : 'faced')
    .replace(/\b[Nn]avigation\b/g, (match) => match[0] === 'N' ? 'Discernment' : 'discernment')
    .replace(/\b[Nn]avigational\b/g, (match) => match[0] === 'N' ? 'Directional' : 'directional')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeAwkwardActionPhrases(text: string): string {
  return String(text || '')
    .replace(/\b[Bb]e brutally honest\b/g, (match) =>
      match[0] === 'B' ? 'Be honest before God' : 'be honest before God')
    .replace(/\b[Aa] brutally honest\b/g, (match) =>
      match[0] === 'A' ? 'An honest-before-God' : 'an honest-before-God')
    .replace(/\bbrutally honest\b/gi, 'honest before God')
    .replace(/\b[Bb]rutal honesty\b/g, (match) =>
      match[0] === 'B' ? 'Honesty before God' : 'honesty before God')
    .replace(/\b[Ss]top walking outside while praying\b/g, (match) =>
      match[0] === 'S' ? 'Step outside and pray' : 'step outside and pray')
    .replace(/\b[Ss]top walking outside and pray\b/g, (match) =>
      match[0] === 'S' ? 'Step outside and pray' : 'step outside and pray')
    .replace(/\b[Ss]top walking outside to pray\b/g, (match) =>
      match[0] === 'S' ? 'Step outside to pray' : 'step outside to pray')
    .replace(/\bprayer walk-ups\b/gi, 'prayer pauses')
    .replace(/\bprayer walk-up\b/gi, 'prayer pause');
}

function sanitizeText(text: string): string {
  return normalizeAwkwardActionPhrases(
    removeOverusedNavigationLanguage(text.replace(/\byoga\b/gi, 'gentle stretching'))
  );
}

function stripLeadingStrayPunctuation(text: string): string {
  return String(text || '').replace(/^\s*[.,;:!?]+\s*(?=[A-Za-z])/g, '').trim();
}

function stripBalancedWrappingQuotes(text: string): string {
  let out = String(text || '').trim();
  const quotePairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
    ['“', '”'],
    ['‘', '’'],
  ];

  let changed = true;
  while (changed && out.length >= 2) {
    changed = false;
    for (const [open, close] of quotePairs) {
      if (out.startsWith(open) && out.endsWith(close)) {
        out = out.slice(open.length, out.length - close.length).trim();
        changed = true;
        break;
      }
    }
  }

  return out;
}

function isActionApostrophe(text: string, index: number): boolean {
  const char = text[index];
  if (char !== "'" && char !== '‘' && char !== '’') return false;
  return /[A-Za-z0-9]/.test(text[index - 1] || '') && /[A-Za-z0-9]/.test(text[index + 1] || '');
}

function matchingCloseQuote(open: string): string {
  if (open === '“') return '”';
  if (open === '‘') return '’';
  return open;
}

function matchingOpenQuote(close: string): string {
  if (close === '”') return '“';
  if (close === '’') return '‘';
  return close;
}

function hasClosingQuoteAfter(text: string, open: string): boolean {
  const close = matchingCloseQuote(open);
  for (let i = 1; i < text.length; i++) {
    if (text[i] === close && !isActionApostrophe(text, i)) return true;
  }
  return false;
}

function hasOpeningQuoteBefore(text: string, close: string): boolean {
  const open = matchingOpenQuote(close);
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === open && !isActionApostrophe(text, i)) return true;
  }
  return false;
}

function stripDanglingBoundaryQuotes(text: string): string {
  let out = String(text || '').trim();
  const firstQuote = out.match(/^["'`“”‘’]/)?.[0] || '';
  const lastQuote = out.match(/["'`“”‘’]$/)?.[0] || '';

  if (firstQuote && !hasClosingQuoteAfter(out, firstQuote)) {
    out = out.replace(/^["'`“”‘’]\s*/, '').trim();
  }
  if (lastQuote && !hasOpeningQuoteBefore(out, lastQuote)) {
    out = out.replace(/\s*["'`“”‘’]$/, '').trim();
  }

  return out;
}

function normalizeGeneratedMarkup(text: string): string {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<p\s*>/gi, '')
    .replace(/<\/?[^>]+>/g, '');
}

function closeUnmatchedDoubleQuote(text: string): string {
  let straightCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"' && text[i - 1] !== '\\') straightCount++;
  }

  if (straightCount % 2 === 1) {
    return `${text}"`;
  }

  const openCurly = (text.match(/“/g) || []).length;
  const closeCurly = (text.match(/”/g) || []).length;
  return openCurly > closeCurly ? `${text}”` : text;
}

function removeDecorativeSingleQuotes(text: string): string {
  let out = '';
  const source = String(text || '');

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if ((char === "'" || char === '‘' || char === '’') && !isActionApostrophe(source, i)) {
      continue;
    }
    out += char;
  }

  return out;
}

function normalizeActionBulletMarkers(text: string): string {
  return String(text || '')
    .replace(/(^|\n)([^*\n]{1,90}:\s*)\*\s+/g, (_match, prefix, label) => `${prefix}${String(label).trimEnd()}\n* `)
    .replace(/([^\n])\s+\*\s+(?=\S)/g, '$1\n* ')
    .split('\n')
    .map(line => line.replace(/^(\s*)[-•]\s+/, '$1* '))
    .join('\n');
}

function normalizeActionInlineStructure(text: string): string {
  return String(text || '')
    .replace(/\s+(?=(?:Trigger|Lie|Temptation|Replacement response|Replacement|Practice):\s*)/gi, '\n')
    .replace(/(^|\n)\s*Replacement:\s*/gi, '$1Replacement response: ')
    .replace(/\s+(?=(?:Stop doing|Start doing)\b)/gi, '\n')
    .replace(/(^|\n)\s*Stop doing\s+/gi, '$1Stop: ')
    .replace(/(^|\n)\s*Start doing\s+/gi, '$1Start: ');
}

function normalizePracticeLoopText(text: string): string {
  const source = String(text || '')
    .replace(/^Trigger\s*(?:→|->|>)\s*temptation\s*(?:→|->|>)\s*replacement response\s*practice:\s*/i, '')
    .trim();

  const match = source.match(/^(.+?)\s*(?:→|->|>)\s*temptation\s+is\s+(.+?)\s*(?:→|->|>)\s*replacement response\s+is\s+(.+?)(?:\s+Practice\s+(.+))?$/i);
  if (!match) {
    return text;
  }

  const trigger = match[1].trim();
  const temptation = match[2].trim();
  const response = match[3].trim();
  const practice = (match[4] || '').trim();
  const lines = [
    `Trigger: ${trigger}`,
    `Temptation: ${temptation}`,
    `Replacement response: ${response}`,
  ];

  if (practice) {
    lines.push(`Practice: Do this ${practice.replace(/^this\s+/i, '')}`);
  }

  return lines.join('\n');
}

function stripMarkdownMarkers(text: string): string {
  return normalizeGeneratedMarkup(text)
    .replace(/\*\*|__/g, '')                // strip bold markers
    .replace(/(?<!\n)\*(?!\s)/g, '')        // strip inline italic * not followed by space (e.g. *word*)
    .replace(/ +([,.;:!?])/g, '$1')
    .trim();
}

function cleanMarkdown(text: string): string {
  if (!text) {
    return '';
  }
  return stripBalancedWrappingQuotes(stripMarkdownMarkers(text));
}

function capitalizeFirstLetter(text: string): string {
  return text.replace(/^(\s*)([a-z])/, (_match, space, letter) => `${space}${letter.toUpperCase()}`);
}

// Replace ALL occurrences of the user's name with "you" / "your".
// Used for fields where the name must never appear (truth_in_love, prayer, etc.)
function stripAllName(text: string, name: string): string {
  if (!text) {
    return '';
  }
  let processed = text.replace(/\[(?:User's Name|First Name|Last Name)\](?:'s|’s)?/gi, (match) => {
    return match.endsWith("'s") || match.endsWith('’s') ? 'your' : 'you';
  });
  const cleanName = (name || '').trim();
  if (!cleanName || cleanName.length < 2) {
    return capitalizeFirstLetter(processed.replace(/^you,\s+/i, '').replace(/^you\b/i, 'you'));
  }
  const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  processed = processed.replace(new RegExp(`\\b${escaped},\\s+you\\b`, 'gi'), 'you');
  processed = processed.replace(new RegExp(`\\b${escaped}('s|’s)?\\b`, 'gi'), (match) => {
    return match.endsWith("'s") || match.endsWith('’s') ? 'your' : 'you';
  });
  return capitalizeFirstLetter(processed.replace(/^you,\s+/i, '').replace(/^you\b/i, 'you'));
}

// Keep the opening name in truth_summary only, replace all subsequent names with "you"/"your".
function stripRepeatedName(text: string, name: string): string {
  if (!text) {
    return '';
  }
  let processed = text;
  const cleanName = (name || '').trim();
  processed = processed.replace(/\[(?:User's Name|First Name|Last Name)\](?:'s|’s)?/gi, (match, offset) => {
    if (cleanName.length >= 2 && offset <= 2) {
      return match.endsWith("'s") || match.endsWith('’s') ? `${cleanName}'s` : cleanName;
    }
    return match.endsWith("'s") || match.endsWith('’s') ? 'your' : 'you';
  });
  if (!cleanName || cleanName.length < 2) {
    return processed;
  }
  const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let firstFound = false;
  return processed.replace(new RegExp(`\\b${escaped}('s|’s)?\\b`, 'gi'), (match, _possessive, offset) => {
    if (!firstFound && offset <= 2) {
      firstFound = true;
      return match;
    }
    return match.endsWith("'s") || match.endsWith('’s') ? 'your' : 'you';
  });
}

interface AudienceContext {
  calculatedAge: number | null;
  ageSource: 'dateOfBirth' | 'unknown';
  isTeenUser: boolean;
  isYoungUser: boolean;
  isAdultUser: boolean;
  promptLine: string;
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

function buildAudienceContext(dateOfBirth?: string): AudienceContext {
  const calculatedAge = calculateAgeFromDate(dateOfBirth);

  if (calculatedAge !== null) {
    const isAdult = calculatedAge >= 25;
    const promptLine = isAdult
      ? ''
      : `AUDIENCE CONTEXT: User is exactly ${calculatedAge} years old, calculated from their birthday. Tailor examples, guidance depth, and application to this exact age. Use language that is appropriate for this age level - simpler vocabulary and sentence structure for younger users, more nuanced language for adults. Do not generalize beyond the exact age, and do not mention the age unless it directly matters.`;

    return {
      calculatedAge,
      ageSource: 'dateOfBirth',
      isTeenUser: calculatedAge <= 17,
      isYoungUser: calculatedAge <= 24,
      isAdultUser: isAdult,
      promptLine,
    };
  }

  return {
    calculatedAge: null,
    ageSource: 'unknown',
    isTeenUser: false,
    isYoungUser: false,
    isAdultUser: false,
    promptLine: 'AUDIENCE CONTEXT: Age is unknown because no birthday is available. Do not assume school, parents, marriage, parenting, career stage, or retirement unless the user clearly says it.',
  };
}

function serializePersonalizationData(personalizationData?: Record<string, unknown>): string {
  if (!personalizationData || typeof personalizationData !== 'object') {
    return '';
  }

  const contextKeys = [
    'spiritualContext',
    'learningPreferences',
    'successPatterns',
    'communicationStyle',
    'currentFocus',
  ];

  return contextKeys
    .map((key) => {
      const value = personalizationData[key];
      if (typeof value !== 'string' || !value.trim()) {
        return '';
      }
      return `${key}: ${value.trim().slice(0, 400)}`;
    })
    .filter(Boolean)
    .join('\n');
}

// ─── Structural quality helpers ──────────────────────────────────────────────

// Count non-empty paragraphs (blocks separated by \n\n or \n)
function countParagraphs(text: string): number {
  return text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0).length;
}

function countWords(text: string): number {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

// Phrases that indicate the output is drifting toward polished spiritual generalism
const DRIFT_PHRASES = [
  'god can hold both',
  'that pain is real',
  'spiritual authenticity',
  'authentic self',
  'your persona',
  'appearance vs reality',
  'appearance versus reality',
  'who you truly are',
  'true to yourself',
  'be honest with yourself',
  'be brutally honest',
  'brutally honest',
  'brutal honesty',
  'honor your feelings',
  'sit with the discomfort',
  'lean into',
  'this is a season',
  'god is writing your story',
];

const OVERUSED_NAVIGATION_REGEX = /\bnavigat(?:e|es|ed|ing|ion|ional)\b/i;
const TRUTH_IN_LOVE_MIN_CHARS = 320;
const TRUTH_IN_LOVE_LONG_OPENING_WORDS = 55;
const CORE_FAITHFUL_ACTION_MIN = 5;
const CORE_FAITHFUL_ACTION_MAX = 7;
const FAITHFUL_ACTION_MAX_WITH_BONUS = 8;
const ENABLE_PAID_MODEL_RETRIES = false;
const ENABLE_PROVIDER_CONTENT_FILTER_RETRY = true;
const ENABLE_PAID_ARCHITECTURAL_RETRY = false;
const MARRIAGE_EXPLICIT_REGEX = /\b(husband|wife|spouse|marriage|married|divorce|marital)\b/i;
const AMBIGUOUS_RELATIONSHIP_REGEX = /\b(relationship|partner|dating|boyfriend|girlfriend|fiance|fiancee)\b/i;
const NEGATED_MARRIAGE_REGEX = /\b(?:not|never|no longer|isn't|is not|wasn't|was not|aren't|are not)\s+(?:married|in a marriage|my husband|my wife|my spouse)\b|\bnot\s+(?:my\s+)?(?:husband|wife|spouse)\b|\bnot\s+about\s+(?:marriage|my marriage)\b/i;
const CHILD_EARLY_RELATIONSHIP_FAMILY_OPPOSES_REGEX = /\b(?:child|daughter|son|kid|teen)\b[\s\S]{0,160}\b(?:relationship|boyfriend|girlfriend|dating)\b[\s\S]{0,200}\b(?:sisters?|family|parents?|relatives?)\b[\s\S]{0,160}\b(?:against|oppose|opposing|not agree|disagree|concerned)\b[\s\S]{0,160}\b(?:open(?:s|ing)?\s+doors?|doorway|temptation|sin|spiritual attack|enemy)\b/i;
const CHURCH_ORDER_OUTPUT_VIOLATION_REGEX = /\b(?:gender bias contradicts|gender bias.*contradicts|distorted view.*because you are a woman|regardless of gender|because of my gender|because you are a woman|beyond gender|beyond gender roles|transcends (?:cultural assumptions about )?gender roles|supporting women.?s roles in ministry|defend(?:ing)? (?:my|your) calling to (?:pastor|pastoring)|(?:my|your) role as pastor|pastoral calling beyond gender|defining pastoral calling beyond gender|called to (?:serve as )?(?:a )?pastor|calling to (?:serve as )?(?:a )?pastor|women(?:'s)? (?:pastoral|pastor|elder|overseer) (?:calling|office|authority|role)|women (?:may|can|should) (?:serve as )?(?:pastors|elders|overseers)|opposition rooted in gender bias|God'?s call transcends cultural assumptions about gender roles)\b/i;
const ACTION_EXAMPLE_MARKER_REGEX = /Example(?:\s+(?:prayer|message|text|words|script|sentence|phrase|loop|action|question|questions))?\s*[:：]\s*/i;
const INDIRECT_TRUTH_OPENERS = [
  /^it (?:is|can be|may be)\b/i,
  /^sometimes\b/i,
  /^there (?:is|are)\b/i,
  /^when you\b/i,
  /^what you(?:'re| are) feeling\b/i,
  /^your (?:pain|concern|hurt|confusion|fear|frustration)\b/i,
  /^you(?:'re| are) not wrong\b/i,
  /^you(?:'re| are) not alone\b/i,
  /^this (?:is|can be|may be) (?:a|an)\b/i,
];
// Weak action verbs — if the majority of action titles use these, the sequence is too soft
const SOFT_ACTION_VERBS = ['reflect', 'consider', 'practice', 'remember', 'think', 'meditate', 'embrace', 'allow', 'accept'];
const SHARP_ACTION_VERBS = ['name', 'separate', 'stop', 'write', 'ask', 'say', 'face', 'choose', 'refuse', 'tell', 'confront', 'cut', 'bring', 'identify', 'commit'];
const COUNSELOR_SUPPORT_PERSON_REGEX = /\b(?:trusted\s+)?(?:(?:christian|biblical)\s+)?couns(?:el|ell)(?:or|ors|ing|ling)\b|\b(?:pastors?|elders?|church leaders?|discipleship leaders?|small group leaders?|biblical community|christian mentors?|mature believers?)\b/i;
const COUNSELOR_SUPPORT_ACTION_REGEX = /\b(?:ask|tell|message|text|call|meet|meeting|bring|involve|share|speak|talk|contact|schedule|sit with|reach out)\b/i;

function faithfulActionText(action: any): string {
  return [
    action?.title,
    action?.description,
    action?.body,
  ].map(value => String(value || '')).join(' ');
}

function isCounselorSupportBonusAction(action: any): boolean {
  const text = faithfulActionText(action);
  return COUNSELOR_SUPPORT_PERSON_REGEX.test(text) && COUNSELOR_SUPPORT_ACTION_REGEX.test(text);
}

function buildCoreFaithfulActionFallback(index: number) {
  const fallbacks = [
    {
      title: 'Write the facts',
      description: 'Put the facts, fear, and obedience in front of you.',
      body: [
        'Write three lines before asking anyone else what to do.',
        'Fact: What is actually happening?',
        'Fear: What are you tempted to believe?',
        'Obedience: What is one step you can take today?',
        'Example: Fact: This is harder than I expected.\nFear: I am tempted to call delay failure.\nObedience: I will face the next concrete step without rushing or hiding.',
      ].join('\n'),
      primary_button: 'I wrote it',
      secondary_button: 'Not yet',
    },
    {
      title: 'Choose one step',
      description: 'Turn conviction into one concrete act of obedience.',
      body: [
        'Choose one action you can complete today. Keep it small enough to obey and specific enough to measure.',
        'Step: Write the action.',
        'Time: Choose when you will do it.',
        'Limit: Name what you will not do today.',
        'Example: Step: Review the facts honestly.\nTime: Tonight after dinner.\nLimit: I will not make a fear-driven decision today.',
      ].join('\n'),
      primary_button: 'I chose',
      secondary_button: 'Not yet',
    },
  ];

  return fallbacks[index % fallbacks.length];
}

function splitFaithfulActions(actions: any[]): { core: any[]; support: any[] } {
  return actions.reduce((acc, action) => {
    if (isCounselorSupportBonusAction(action)) {
      acc.support.push(action);
    } else {
      acc.core.push(action);
    }
    return acc;
  }, { core: [] as any[], support: [] as any[] });
}

function normalizeFaithfulActions(actions: any[], options: { addCoreFallbacks?: boolean } = {}): any[] {
  const nonEmptyActions = actions.filter((action: any) => {
    const title = String(action?.title || '').trim();
    const body = String(action?.body || action?.description || '').trim();
    return title.length > 0 || body.length > 0;
  });
  const { core, support } = splitFaithfulActions(nonEmptyActions);
  const normalizedCore = core.slice(0, CORE_FAITHFUL_ACTION_MAX);

  if (options.addCoreFallbacks && support.length > 0) {
    while (
      normalizedCore.length < CORE_FAITHFUL_ACTION_MIN &&
      normalizedCore.length + 1 < FAITHFUL_ACTION_MAX_WITH_BONUS
    ) {
      normalizedCore.push(buildCoreFaithfulActionFallback(normalizedCore.length));
    }
  }

  if (support.length > 0 && normalizedCore.length >= CORE_FAITHFUL_ACTION_MIN) {
    return [...normalizedCore, support[0]];
  }

  return normalizedCore.slice(0, CORE_FAITHFUL_ACTION_MAX);
}

function detectFaithfulActionBodyFormat(body: string): string {
  const normalized = String(body || '').trim();
  const lower = normalized.toLowerCase();

  if (!normalized) return 'empty';
  if (/(?:^|\n)\s*(?:\*|-|•)\s+/.test(normalized)) return 'bullet checklist';
  if (/(?:^|\|)\s*[A-Za-z][A-Za-z ]{1,24}:\s*_{2,}/.test(normalized)) return 'audit table';
  if (/(?:trigger|craving|temptation)\b/i.test(normalized) && /(?:→|->)/.test(normalized)) return 'practice loop';
  if (/\bstop\b[\s\S]{0,160}\bstart\b/i.test(normalized)) return 'stop/start';
  if (
    /\b(?:today|tomorrow|within|until|date|deadline|limit|day|days|week|weeks|minutes|hours)\b/i.test(lower) &&
    /\b(?:plan|pick|choose|reduce|schedule|limit|finish|stage|next)\b/i.test(lower)
  ) {
    return 'timeline or limit';
  }

  const questionCount = (normalized.match(/\?/g) || []).length;
  if (
    questionCount >= 2 ||
    (questionCount >= 1 && /\b(?:ask|questions?|filter|separate|decide whether|test whether)\b/i.test(normalized))
  ) {
    return 'decision filter';
  }

  if (
    /\b(?:say|text|message|tell|ask)\s+(?:this|them|him|her|yourself|god|the person|your pastor|your spouse|your friend)\b/i.test(lower) ||
    /["“][^"”]{12,}["”]/.test(normalized)
  ) {
    return 'script';
  }

  return 'prose instruction';
}

function requiredFaithfulActionFormatCount(actionCount: number): number {
  if (actionCount >= 5) return 4;
  if (actionCount === 4) return 3;
  if (actionCount === 3) return 2;
  return 0;
}

function hasActionExampleMarker(value: string): boolean {
  return ACTION_EXAMPLE_MARKER_REGEX.test(String(value || ''));
}

function stripLeakedActionFieldFragments(value: string): string {
  let out = String(value || '');
  const leakedFieldIndex = out.search(/(?:^|[\s,}"'`])\\?["']?\s*(?:primary_button|secondary_button|primaryButton|secondaryButton)\s*\\?["']?\s*:/i);
  if (leakedFieldIndex >= 0) {
    out = out.slice(0, leakedFieldIndex);
  }

  return out
    .replace(/(?:\\?["']?\s*,\s*)+$/g, '')
    .replace(/(?:\\?["'`“”‘’]){2,}\s*$/g, '')
    .trim();
}

function cleanActionTextSegment(value: string): string {
  const normalized = normalizeActionBulletMarkers(stripMarkdownMarkers(stripLeakedActionFieldFragments(value)))
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");

  const withoutDecorativeQuotes = normalizeActionInlineStructure(removeDecorativeSingleQuotes(normalized));
  const cleaned = closeUnmatchedDoubleQuote(stripDanglingBoundaryQuotes(stripBalancedWrappingQuotes(withoutDecorativeQuotes))).trim();
  return normalizePracticeLoopText(cleaned);
}

function splitActionExample(value: string): { main: string; example: string | null } {
  const parts = String(value || '').split(ACTION_EXAMPLE_MARKER_REGEX);
  const main = cleanActionTextSegment(parts[0] || '');
  if (parts.length < 2) return { main, example: null };

  const exampleSegments = parts
    .slice(1)
    .map(part => cleanActionTextSegment(part))
    .filter(Boolean);
  const example = exampleSegments.find(part => /^["“]/.test(part.trim())) || exampleSegments[0] || '';
  return { main, example: example || null };
}

function extractActionExample(value: string): string | null {
  const { example } = splitActionExample(value);
  return example ? `Example: ${example}` : null;
}

function buildFallbackActionExample(description: string): string {
  const { main: descriptionMain } = splitActionExample(description);
  if (descriptionMain && descriptionMain.length <= 180) {
    return descriptionMain;
  }

  return 'Write one concrete version of this step and do it today.';
}

function toInstructionPointOfView(text: string): string {
  return String(text || '')
    .replace(/\bmyself\b/gi, 'yourself')
    .replace(/\bmy\b/gi, 'your')
    .replace(/\bmine\b/gi, 'yours')
    .replace(/\bme\b/gi, 'you')
    .replace(/\bI\s+will\b/gi, 'you will')
    .replace(/\bI\s+would\b/gi, 'you would')
    .replace(/\bI\s+can\b/gi, 'you can')
    .replace(/\bI\s+need\b/gi, 'you need')
    .replace(/\bI\s+am\b/gi, 'you are')
    .replace(/\bI'm\b/gi, "you're")
    .replace(/\bI\s+(leave|call|ask|stop|remove|write|tell|send|go|pack|bring|keep|contact|message|text|document|share)\b/gi, 'you $1')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalizeInstruction(text: string): string {
  const trimmed = String(text || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : '';
}

function normalizeActionExampleText(example: string): string {
  let value = String(example || '').trim();
  const bareYesNoAnswers = value.replace(/[.!?]+$/g, '').match(/^(yes|no)(?:\s*,\s*(yes|no))+$/i);
  if (bareYesNoAnswers) {
    const answers = value
      .replace(/[.!?]+$/g, '')
      .split(/\s*,\s*/)
      .map(answer => answer.charAt(0).toUpperCase() + answer.slice(1).toLowerCase());
    return answers
      .map((answer, index) => `Question ${index + 1}: ${answer}`)
      .join('\n');
  }

  const quotedItems = [...value.matchAll(/["“]([^"”]+)["”]/g)].map(match => match[1].trim()).filter(Boolean);
  const quotedRemainder = value.replace(/["“][^"”]+["”]/g, '').replace(/[,\s]+/g, '');
  if (quotedItems.length >= 2 && !quotedRemainder) {
    return quotedItems.join('\n');
  }

  if (!value || /^["“]/.test(value)) {
    return value;
  }

  value = value.replace(/^(?:Today,\s+|Today\s+)I\s+/i, 'I ');

  const messageSent = value.match(/^Message sent to\s+(.+?)\.?$/i);
  if (messageSent) {
    return `Send this message to ${messageSent[1].trim()}.`;
  }

  const textedAsking = value.match(/^(?:I\s+)?Texted\s+(.+?)\s+asking\s+(.+?)\.?$/i);
  if (textedAsking) {
    return `Text ${textedAsking[1].trim()} asking ${textedAsking[2].trim()}.`;
  }

  if (/^(?:loop\s+written\s+out\s+clearly|practice\s+loop\s+written\s+out\s+clearly)\.?$/i.test(value)) {
    return 'Fill in each loop line with your real trigger, temptation, and replacement response.';
  }

  const catchThought = value.match(/^Catch\s+(?:the\s+)?thought\s+(.+?\?)\s+then\s+(.+)$/i);
  if (catchThought) {
    return `Catch the thought "${catchThought[1].trim()}" then ${catchThought[2].trim()}`;
  }

  const sharedAndAsked = value.match(/^I\s+shared\s+with\s+(.+?)\s+who\s+agreed\s+to\s+(.+?)\.?$/i);
  if (sharedAndAsked) {
    return capitalizeInstruction(toInstructionPointOfView(`Share with ${sharedAndAsked[1].trim()} and ask them to ${sharedAndAsked[2].trim()}.`));
  }

  const instructionRules: Array<[RegExp, string]> = [
    [/^I\s+will\s+(.+)$/i, '$1'],
    [/^I\s+messaged\s+(.+)$/i, 'Message $1'],
    [/^I\s+sent\s+(.+)$/i, 'Send $1'],
    [/^I\s+texted\s+(.+)$/i, 'Text $1'],
    [/^I\s+called\s+(.+)$/i, 'Call $1'],
    [/^I\s+contacted\s+(.+)$/i, 'Contact $1'],
    [/^I\s+asked\s+(.+)$/i, 'Ask $1'],
    [/^I\s+told\s+(.+)$/i, 'Tell $1'],
    [/^I\s+shared\s+with\s+(.+)$/i, 'Share with $1'],
    [/^I\s+wrote\s+down\s+(.+)$/i, 'Write down $1'],
    [/^I\s+wrote\s+(.+)$/i, 'Write $1'],
    [/^I\s+listed\s+(.+)$/i, 'List $1'],
    [/^I\s+documented\s+(.+)$/i, 'Document $1'],
    [/^I\s+packed\s+(.+)$/i, 'Pack $1'],
    [/^I\s+removed\s+(.+)$/i, 'Remove $1'],
    [/^I\s+threw\s+(?:away|out)\s+(.+)$/i, 'Throw away $1'],
    [/^I\s+hid\s+(.+)$/i, 'Secure $1'],
    [/^I\s+secured\s+(.+)$/i, 'Secure $1'],
    [/^I\s+put\s+(.+)$/i, 'Put $1'],
    [/^I\s+placed\s+(.+)$/i, 'Place $1'],
    [/^I\s+set\s+(.+)$/i, 'Set $1'],
    [/^I\s+chose\s+(.+)$/i, 'Choose $1'],
    [/^I\s+planned\s+(.+)$/i, 'Plan $1'],
    [/^I\s+prayed\s+(.+)$/i, 'Pray $1'],
    [/^I\s+read\s+(.+)$/i, 'Read $1'],
    [/^I\s+confessed\s+(.+)$/i, 'Confess $1'],
    [/^I\s+apologized\s+(.+)$/i, 'Apologize $1'],
    [/^I\s+deleted\s+(.+)$/i, 'Delete $1'],
    [/^I\s+blocked\s+(.+)$/i, 'Block $1'],
    [/^I\s+avoided\s+(.+)$/i, 'Avoid $1'],
    [/^I\s+stopped\s+(.+)$/i, 'Stop $1'],
    [/^I\s+started\s+(.+)$/i, 'Start $1'],
    [/^I\s+created\s+(.+)$/i, 'Create $1'],
    [/^I\s+made\s+(.+)$/i, 'Make $1'],
    [/^I\s+brought\s+(.+)$/i, 'Bring $1'],
    [/^I\s+kept\s+(.+)$/i, 'Keep $1'],
  ];

  for (const [pattern, replacement] of instructionRules) {
    if (pattern.test(value)) {
      return capitalizeInstruction(toInstructionPointOfView(value.replace(pattern, replacement)));
    }
  }

  return value;
}

function buildRenderedActionDescription(body: string, description = ''): string {
  const bodyParts = splitActionExample(body);
  const descriptionParts = splitActionExample(description);
  const main = bodyParts.main || descriptionParts.main;
  const rawExample = bodyParts.example || descriptionParts.example || buildFallbackActionExample(description);
  const example = normalizeActionExampleText(rawExample);

  if (!main) return example ? `Example: ${example}` : '';

  return example ? `${main}\n\nExample: ${example}` : main;
}

function getOpeningParagraph(text: string): string {
  return String(text || '').split(/\n{2,}|\n/).map(p => p.trim()).find(Boolean) || '';
}

function getOpeningSentence(text: string): string {
  const openingParagraph = getOpeningParagraph(text);
  const match = openingParagraph.match(/^.+?[.!?](?:\s|$)/);
  return (match?.[0] || openingParagraph).trim();
}

// ─── Validate JSON playbook response ─────────────────────────────────────────
// Returns two categories: hardIssues (must retry/fail) and softIssues (warn only).

interface ValidationResult {
  hardIssues: string[];   // Missing fields, generation failures — block or retry
  softIssues: string[];   // Structural drift — warn by default, optional paid retry
}

function validatePlaybook(json: Record<string, any>, originalInput = ''): ValidationResult {
  const hardIssues: string[] = [];
  const softIssues: string[] = [];

  // ── Hard checks: field presence and minimum length ───────────────────────

  if (!json.playbook_title || String(json.playbook_title).trim().length < 5) {
    hardIssues.push('playbook_title is missing or too short');
  }
  if (!json.truth_summary || countWords(String(json.truth_summary || '')) < 8) {
    softIssues.push(`truth_summary is too short (${countWords(String(json.truth_summary || ''))} words, min 8) — will auto-repair`);
  }
  if (!json.truth_in_love || String(json.truth_in_love).length < TRUTH_IN_LOVE_MIN_CHARS) {
    hardIssues.push(`truth_in_love is too short (${String(json.truth_in_love || '').length} chars, min ${TRUTH_IN_LOVE_MIN_CHARS} — must be direct but substantive)`);
  }
  if (!json.transition_line || String(json.transition_line).trim().length < 5) {
    hardIssues.push('transition_line is missing');
  }
  if (!json.bible_verse?.reference || !json.bible_verse?.text) {
    hardIssues.push('bible_verse missing reference or text');
  }

  const noteCount = Array.isArray(json.scripture_note_lines) ? json.scripture_note_lines.length : 0;
  if (noteCount < 3) {
    hardIssues.push(`scripture_note_lines has ${noteCount} items (need exactly 3)`);
  }

  const actions = Array.isArray(json.faithful_actions) ? json.faithful_actions : [];
  const actionCount = actions.length;
  const { core: coreActions, support: supportActions } = splitFaithfulActions(actions);
  const hasSupportBonus = supportActions.length > 0;

  if (actionCount < CORE_FAITHFUL_ACTION_MIN) {
    hardIssues.push(`faithful_actions has ${actionCount} items (need at least ${CORE_FAITHFUL_ACTION_MIN}) — generation failure`);
  }
  if (hasSupportBonus && coreActions.length < CORE_FAITHFUL_ACTION_MIN && actionCount >= CORE_FAITHFUL_ACTION_MIN) {
    softIssues.push(`faithful_actions counted counselor/pastor support as a core action (${coreActions.length}/${CORE_FAITHFUL_ACTION_MIN} core) — will add core fallback action(s) and move support to bonus`);
  }
  if (!hasSupportBonus && actionCount > CORE_FAITHFUL_ACTION_MAX) {
    softIssues.push(`faithful_actions has ${actionCount} core items (max ${CORE_FAITHFUL_ACTION_MAX}) — will trim`);
  }
  if (hasSupportBonus && actionCount > FAITHFUL_ACTION_MAX_WITH_BONUS) {
    softIssues.push(`faithful_actions has ${actionCount} items (max ${FAITHFUL_ACTION_MAX_WITH_BONUS} with counselor/pastor bonus) — will trim`);
  }

  if (!json.prayer || String(json.prayer).length < 50) {
    hardIssues.push(`prayer is too short (${String(json.prayer || '').length} chars, min 50)`);
  }

  const wordCount = Array.isArray(json.words_to_speak) ? json.words_to_speak.length : 0;
  if (wordCount < 4) {
    hardIssues.push(`words_to_speak has ${wordCount} items (need at least 4)`);
  }

  if (!json.closing || String(json.closing).trim().length < 5) {
    hardIssues.push('closing is missing or too short');
  }

  if (!json.completion?.question || String(json.completion.question).trim().length < 10) {
    hardIssues.push('completion.question is missing or too short');
  }
  const completionLineCount = Array.isArray(json.completion?.lines) ? json.completion.lines.length : 0;
  if (completionLineCount < 2) {
    hardIssues.push(`completion.lines has ${completionLineCount} items (need at least 2)`);
  }

  // Em dash — auto-repaired, not a hard failure
  if (/\u2014/.test(JSON.stringify(json))) {
    softIssues.push('Contains em dashes (—) — will auto-repair');
  }

  // ── Soft checks: structural architecture ─────────────────────────────────

  // truth_summary: concise generate-playbook-style
  if (json.truth_summary) {
    const summaryText = String(json.truth_summary);
    const wordCount = countWords(summaryText);
    if (wordCount > 22) {
      softIssues.push(`truth_summary is too long (${wordCount} words — expected a concise summary)`);
    }
  }

  if (json.truth_in_love) {
    const truthText = String(json.truth_in_love).trim();
    const openingParagraph = getOpeningParagraph(truthText);
    const openingSentence = getOpeningSentence(truthText);
    const openingWordCount = openingParagraph.split(/\s+/).filter(Boolean).length;

    if (openingWordCount > TRUTH_IN_LOVE_LONG_OPENING_WORDS) {
      softIssues.push(`Truth in Love opening is too long (${openingWordCount} words). Start with the diagnosis in 1-2 direct sentences.`);
    }
    if (INDIRECT_TRUTH_OPENERS.some(regex => regex.test(openingSentence))) {
      softIssues.push(`Truth in Love opening is indirect ("${openingSentence.slice(0, 90)}"). Start with the diagnosis, correction, cost, or decision.`);
    }
  }

  // Abstraction drift — flag forbidden phrases
  const allText = JSON.stringify(json).toLowerCase();
  if (CHURCH_ORDER_OUTPUT_VIOLATION_REGEX.test(allText)) {
    hardIssues.push('church order violation: output affirmed or defended a woman holding the pastor/elder/overseer office');
  }
  const driftFound = DRIFT_PHRASES.filter(p => allText.includes(p));
  if (driftFound.length > 0) {
    softIssues.push(`Abstraction drift detected — forbidden phrases: ${driftFound.join(', ')}`);
  }
  if (OVERUSED_NAVIGATION_REGEX.test(allText)) {
    softIssues.push('Overused navigation language detected — replace every form of "navigate" with a more specific verb');
  }

  // Action sequence quality — check verb sharpness across first 3 actions
  const qualityActions = Array.isArray(json.faithful_actions)
    ? normalizeFaithfulActions(json.faithful_actions)
    : [];
  if (qualityActions.length >= 3) {
    const firstThreeTitles = qualityActions.slice(0, 3).map((a: any) => String(a.title || '').toLowerCase());
    const softCount = firstThreeTitles.filter(t => SOFT_ACTION_VERBS.some(v => t.startsWith(v))).length;
    const sharpCount = firstThreeTitles.filter(t => SHARP_ACTION_VERBS.some(v => t.startsWith(v))).length;
    if (softCount >= 2 && sharpCount === 0) {
      softIssues.push(`Action sequence drift — first 3 actions start with soft verbs (${firstThreeTitles.join(' | ')}). Expected sharp diagnostic verbs.`);
    }

    const coreQualityActions = qualityActions.slice(0, CORE_FAITHFUL_ACTION_MAX);
    const bodyFormats = coreQualityActions
      .map((action: any) => detectFaithfulActionBodyFormat(String(action?.body || action?.description || '')));
    const distinctBodyFormats = new Set(bodyFormats.filter(format => format !== 'empty'));
    const requiredFormatCount = requiredFaithfulActionFormatCount(coreQualityActions.length);
    if (requiredFormatCount > 0 && distinctBodyFormats.size < requiredFormatCount) {
      softIssues.push(`Faithful action body format variation missing — detected ${distinctBodyFormats.size}/${requiredFormatCount} formats (${bodyFormats.join(', ')}). Vary faithful_actions.body, because that is the walkthrough text.`);
    }

    const missingExampleIndexes = coreQualityActions
      .map((action: any, idx: number) => (
        hasActionExampleMarker(String(action?.body || '')) || hasActionExampleMarker(String(action?.description || ''))
          ? -1
          : idx + 1
      ))
      .filter((idx: number) => idx > 0);
    if (missingExampleIndexes.length > 0) {
      softIssues.push(`Faithful action example bubble missing — action bodies need Example: markers for steps ${missingExampleIndexes.join(', ')}.`);
    }

    const paragraphExampleCount = coreQualityActions
      .filter((action: any) => {
        const body = String(action?.body || action?.description || '').trim();
        return body.length > 0 && !/\n/.test(body) && ACTION_EXAMPLE_MARKER_REGEX.test(body);
      }).length;
    if (paragraphExampleCount >= coreQualityActions.length) {
      softIssues.push('Faithful action body format variation missing — every action body is a single paragraph followed by Example.');
    }
  }

  return { hardIssues, softIssues };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter(item => typeof item === 'string' && item.trim().length > 0)
        .map(item => cleanMarkdown(String(item)))
        .filter(Boolean)
    : [];
}

function appendUnique(existing: string[], fallback: string[], maxItems: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of [...existing, ...fallback]) {
    const cleaned = cleanMarkdown(item);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= maxItems) break;
  }

  return out;
}

function injectLocalRequiredFieldFallbacks(target: Record<string, any>): void {
  const title = cleanMarkdown(String(target.playbook_title || 'this moment'));
  const summary = cleanMarkdown(String(target.truth_summary || 'God is calling you to honest obedience right now.'));

  if (!target.truth_in_love || String(target.truth_in_love).trim().length < TRUTH_IN_LOVE_MIN_CHARS) {
    target.truth_in_love = [
      summary,
      `The issue in ${title.toLowerCase()} needs a direct response, not delay. Name what is wrong, bring it into the light before God, and refuse the easier path of avoidance.`,
      `Count the cost of staying passive. What feels easier today can harden into a pattern that weakens repentance, trust, and faithful action.`,
      `Take the next clear step with humility and courage. Obedience does not require perfect feelings first; it requires a willing yes to what God has already made clear.`,
    ].filter(Boolean).join('\n\n');
  }

  if (!target.transition_line || String(target.transition_line).trim().length < 5) {
    target.transition_line = 'Take the next step with clear obedience.';
  }

  if (!target.bible_verse || typeof target.bible_verse !== 'object') {
    target.bible_verse = {};
  }
  if (!target.bible_verse.reference) {
    target.bible_verse.reference = 'James 1:22';
  }
  if (!target.bible_verse.text) {
    target.bible_verse.text = 'But prove yourselves doers of the word, and not merely hearers who delude themselves.';
  }

  const noteFallbacks = [
    'God calls for obedience that moves beyond hearing.',
    'Faith responds to truth with concrete action.',
    'Delay can become self-deception when God has already made the next step clear.',
  ];
  target.scripture_note_lines = appendUnique(stringArray(target.scripture_note_lines), noteFallbacks, 4);

  if (!target.prayer || String(target.prayer).trim().length < 50) {
    target.prayer = [
      'Father, give me humility to receive Your correction and courage to obey what You have made clear.',
      'Help me stop delaying, face this honestly, and take the next faithful step with a clean heart before You.',
    ].join('\n\n');
  }

  const wordFallbacks = [
    'I will obey the truth God has shown me.',
    'I will take one faithful step today.',
    'I will not hide behind delay or discouragement.',
    'God gives grace for honest repentance and action.',
  ];
  target.words_to_speak = appendUnique(stringArray(target.words_to_speak), wordFallbacks, 5);

  if (!target.closing || String(target.closing).trim().length < 5) {
    target.closing = 'God is faithful to meet you as you take the next obedient step.';
  }

  if (!target.completion || typeof target.completion !== 'object') {
    target.completion = {};
  }
  if (!target.completion.question || String(target.completion.question).trim().length < 10) {
    target.completion.question = 'What specific step will I take today to obey what God has shown me?';
  }
  target.completion.lines = appendUnique(
    stringArray(target.completion.lines),
    ['Name the truth plainly.', 'Choose one obedient action.', 'Do it today.'],
    4
  );
}

// ─── Repair JSON playbook response ───────────────────────────────────────────

function repairPlaybook(json: Record<string, any>): Record<string, any> {
  // Deep-replace em dashes and stray markdown in all string values
  const fix = (val: any): any => {
    if (typeof val === 'string') {
      return val
        .replace(/\u2014/g, ', ')   // em dash → comma
        .replace(/\*\*|__/g, '')    // strip bold/underline markdown
        .trim();
    }
    if (Array.isArray(val)) return val.map(fix);
    if (val && typeof val === 'object') {
      const out: Record<string, any> = {};
      for (const k of Object.keys(val)) out[k] = fix(val[k]);
      return out;
    }
    return val;
  };

  const repaired = fix(json);

  if (!repaired.truth_summary || countWords(String(repaired.truth_summary)) < 8) {
    const truthOpening = getOpeningSentence(String(repaired.truth_in_love || ''));
    const title = cleanMarkdown(String(repaired.playbook_title || 'this moment')).toLowerCase();
    const fallbackCore = countWords(truthOpening) >= 8
      ? truthOpening
      : `this moment needs honest diagnosis, biblical clarity, and concrete obedience instead of delay.`;
    const normalizedCore = fallbackCore
      .replace(/^\s*(?:\[User's Name\]|[^,]{2,40}),\s*/i, '')
      .replace(/^you\b/i, 'you')
      .trim();

    repaired.truth_summary = `[User's Name], ${normalizedCore || `the issue in ${title} needs honest obedience now.`}`;
  }

  // Ensure prayer doesn't contain the closing — added by the UI
  if (repaired.prayer) {
    repaired.prayer = repaired.prayer
      .replace(/\n*In Jesus'? [Nn]ame,?\s*[Aa]men\.?/gi, '')
      .replace(/\n*[Aa]men\.?$/gi, '')
      .trimEnd();
  }

  // Ensure completion.question ends with ?
  if (repaired.closing) {
    repaired.closing = stripLeadingStrayPunctuation(String(repaired.closing));
  }
  if (repaired.completion?.question) {
    repaired.completion.question = stripLeadingStrayPunctuation(String(repaired.completion.question));
  }
  if (Array.isArray(repaired.completion?.lines)) {
    repaired.completion.lines = repaired.completion.lines.map((line: any) =>
      typeof line === 'string' ? stripLeadingStrayPunctuation(line) : line
    );
  }

  // Ensure completion.question ends with ?
  if (repaired.completion?.question && !String(repaired.completion.question).trim().endsWith('?')) {
    repaired.completion.question = String(repaired.completion.question).trim() + '?';
  }

  if (Array.isArray(repaired.faithful_actions)) {
    repaired.faithful_actions = normalizeFaithfulActions(repaired.faithful_actions, { addCoreFallbacks: true });
  }

  return repaired;
}

// ─── Parse JSON response into Playbook interface ──────────────────────────────

function parseJsonPlaybook(
  json: Record<string, any>,
  userName: string,
  userInput: string,
  bibleVersion?: string
): Playbook {
  const rawTruthInLove = cleanMarkdown(json.truth_in_love || '');
  const truthInLoveText = rawTruthInLove;

  const playbook: Playbook = {
    id: generateUUID(),
    title: cleanMarkdown(json.playbook_title || ''),
    subtitle: '',
    category: json.category || 'Growth',
    truthInLove: {
      summary: stripRepeatedName(cleanMarkdown(json.truth_summary || ''), userName),
      text: stripAllName(truthInLoveText, userName),
    },
    actionSteps: [],
    wordsToSpeak: [],
    bibleVerse: {
      text: json.bible_verse?.text || '',
      reference: json.bible_verse?.reference || '',
      version: bibleVersion || 'NASB',
    },
    bibleVerseReflection: Array.isArray(json.scripture_note_lines)
      ? json.scripture_note_lines
          .filter((l: any) => typeof l === 'string' && l.trim().length > 0)
          .slice(0, 4)
          .join('\n')
      : '',
    // completion is now a structured object — serialize into the "Before you close:" format
    // that CompletionStep.parseCompletionText already understands
    directChallenge: (() => {
      const c = json.completion;
      if (c && typeof c === 'object') {
        const question = stripLeadingStrayPunctuation(String(c.question || ''));
        const lines = Array.isArray(c.lines)
          ? c.lines.filter((l: any) => typeof l === 'string' && l.trim().length > 0)
              .map((l: string) => stripLeadingStrayPunctuation(l))
              .filter((l: string) => l.length > 0)
          : [];
        const q = question.length >= 10 ? question : 'What specific step will you take this week to act on what you have learned?';
        const ls = lines.length >= 2 ? lines : ['Take one step forward today.', 'Trust God with the outcome.'];
        return `Before you close:\n${q}\n\n${ls.join('\n')}`;
      }
      // fallback for unexpected string (schema change race condition)
      return String(c || '');
    })(),
    challengeCTA: json.closing && String(json.closing).trim().length >= 5
      ? stripLeadingStrayPunctuation(stripAllName(cleanMarkdown(String(json.closing)), userName))
      : 'God is faithful to complete the work He began in you.',
    // ^ fallback for when the model leaves closing empty
    prayer: stripAllName(cleanMarkdown(json.prayer || ''), userName),
    transitionLine: json.transition_line || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userInput,
    progress: 0,
    totalTasks: 0,
  };

  // Map faithful_actions → ActionStep[]
  // Filter out empty entries (model sometimes emits trailing blank objects)
  const actions = Array.isArray(json.faithful_actions) ? json.faithful_actions : [];
  playbook.actionSteps = actions
    .filter((action: any) => {
      const title = String(action?.title || '').trim();
      const body = String(action?.body || '').trim();
      return title.length > 0 && body.length > 0;
    })
    .map((action: any, idx: number) => {
      const title = cleanMarkdown(String(action.title || ''));
      const body = String(action.body || '');
      const description = action.description ? String(action.description) : undefined;
      return {
        id: generateUUID(),
        title,
        // The prompt varies faithful_actions.body; the app renders ActionStep.description.
        // Preserve an Example: marker so the walkthrough renders the speech-bubble block.
        description: buildRenderedActionDescription(body, description),
        primaryButton: action.primary_button ? cleanMarkdown(String(action.primary_button)) : undefined,
        secondaryButton: 'Not yet',
        subTasks: [],
        examples: [],
        example_interactive: false,
        completed: false,
        orderIndex: idx,
        actionType: 'done_skip' as const,
      };
    });
  playbook.totalTasks = playbook.actionSteps.length;

  // Map words_to_speak → string[]
  const words = Array.isArray(json.words_to_speak) ? json.words_to_speak : [];
  playbook.wordsToSpeak = words
    .filter((w: any) => typeof w === 'string' && w.trim().length > 0)
    .map((w: string) => cleanMarkdown(w));
  playbook.wordToSpeak = playbook.wordsToSpeak.join('\n');

  // Sanitize yoga → gentle stretching (brand safety)
  sanitizePlaybook(playbook);

  return playbook;
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
    description: step.description ? sanitizeText(step.description) : undefined,
    subTasks: step.subTasks.map(st => ({ ...st, text: sanitizeText(st.text) })),
    examples: step.examples.map(e => sanitizeText(e)),
  }));
  if (playbook.directChallenge) playbook.directChallenge = sanitizeText(playbook.directChallenge);
  if (playbook.challengeCTA) playbook.challengeCTA = stripLeadingStrayPunctuation(sanitizeText(playbook.challengeCTA));
  if (playbook.prayer) playbook.prayer = sanitizeText(playbook.prayer);
  if (playbook.wordToSpeak) playbook.wordToSpeak = sanitizeText(playbook.wordToSpeak);
  if (playbook.bibleVerseReflection) playbook.bibleVerseReflection = sanitizeText(playbook.bibleVerseReflection);
  if (playbook.transitionLine) playbook.transitionLine = sanitizeText(playbook.transitionLine);
  if (playbook.wordsToSpeak && Array.isArray(playbook.wordsToSpeak)) {
    playbook.wordsToSpeak = playbook.wordsToSpeak.map(w => sanitizeText(w));
  }
}

// ─── Bible verse enforcement ──────────────────────────────────────────────────

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

// ─── request body ─────────────────────────────────────────────────────────────

interface RequestBody {
  userInput: string;
  userName: string;
  userId?: string;
  dateOfBirth?: string;
  personalizationData?: Record<string, unknown>;
  intelligenceLevel?: string;
  bibleVersion?: string;
  location?: string;
  userTier?: string;
  isOnboarding?: boolean;
  promptDetectionInput?: string;
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

  const {
    userInput,
    userName,
    userId,
    dateOfBirth,
    personalizationData,
    bibleVersion,
    userTier,
    isOnboarding,
    promptDetectionInput,
  } = requestBody;

  const authHeader = req.headers.get('authorization');
  const rateLimitUserId = authHeader ? authHeader.split(' ')[1] : userId || 'anonymous';
  const rateLimitResult = SimpleRateLimiter.checkLimit(rateLimitUserId, RATE_LIMIT_CONFIGS.playbook);
  if (!rateLimitResult.allowed) {
    return createRateLimitError(
      rateLimitResult,
      `You've created ${RATE_LIMIT_CONFIGS.playbook.maxRequests} playbooks in the last hour. Please wait before creating another.`
    );
  }

  const audienceContext = buildAudienceContext(dateOfBirth);
  const isTeenUser = audienceContext.isTeenUser;
  const personalizationContext = serializePersonalizationData(personalizationData);
  console.log('[Generate-Guided-Playbook] ===== AGE CONTEXT =====');
  console.log('[Generate-Guided-Playbook] dateOfBirth received:', dateOfBirth ?? 'MISSING — age will be unknown');
  console.log('[Generate-Guided-Playbook] calculatedAge:', audienceContext.calculatedAge ?? 'null (could not calculate)');
  console.log('[Generate-Guided-Playbook] isTeenUser:', isTeenUser);
  console.log('[Generate-Guided-Playbook] promptLine injected:', audienceContext.promptLine);
  console.log('[Generate-Guided-Playbook] ===== END AGE CONTEXT =====');

  const detectionInput = typeof promptDetectionInput === 'string' && promptDetectionInput.trim()
    ? promptDetectionInput.trim()
    : userInput;

  // Content safety check
  const contentAnalysis = analyzeContent(detectionInput);
  const providerFilterShouldBlockUser = contentAnalysis.shouldBlock || [
    'self_harm',
    'violence',
    'sexual_assault',
    'harassment',
    'hate_speech',
  ].includes(contentAnalysis.category || '');
  const selfHarmSafetyMessage =
    "Your life matters deeply to God. If you might hurt yourself, don't stay alone: tell a trusted person now and contact local emergency services, the nearest emergency room, or a suicide crisis line. If you're in the U.S., call or text 988.";

  const providerContentFilterResponse = () => {
    if (providerFilterShouldBlockUser) {
      return new Response(
        JSON.stringify({
          error: 'CONTENT_BLOCKED',
          message: contentAnalysis.category === 'self_harm'
            ? selfHarmSafetyMessage
            : contentAnalysis.christianMessage || 'This topic could not be processed. For personalized guidance on sensitive matters, we recommend speaking with a Christian counselor or pastor.',
          alternatives: contentAnalysis.constructiveAlternatives,
          category: contentAnalysis.category,
          retryable: false,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'GENERATION_INTERRUPTED',
        message: 'I started creating your playbook, but the AI response stopped before it finished. Your topic was not blocked. Please try again.',
        retryable: false,
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  };

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
      } catch (error) {
        // non-blocking
        console.log('[Generate-Guided-Playbook] Failed to fetch recent titles:', error);
      }
    }

    let effectiveUserInput = userInput;
    let effectivePromptDetectionInput = detectionInput;
    const preferredBibleVersion = bibleVersion || 'NASB';
    const hasNegatedMarriageContext = NEGATED_MARRIAGE_REGEX.test(effectivePromptDetectionInput);
    const hasExplicitMarriageContext = MARRIAGE_EXPLICIT_REGEX.test(effectivePromptDetectionInput) && !hasNegatedMarriageContext;
    const hasAmbiguousRelationshipContext = (AMBIGUOUS_RELATIONSHIP_REGEX.test(effectivePromptDetectionInput) || hasNegatedMarriageContext) && !hasExplicitMarriageContext;
    const hasChildEarlyRelationshipFamilyOpposesContext = CHILD_EARLY_RELATIONSHIP_FAMILY_OPPOSES_REGEX.test(effectivePromptDetectionInput);
    const doctrinalVerdictRequired = /\b(iglesia ni cristo|inc|jehovah'?s witnesses|mormon|lds|unitarian)\b/i.test(effectivePromptDetectionInput)
      || (/\b(jesus|christ)\b/i.test(effectivePromptDetectionInput) && /\b(not god|isn'?t god|not divine|created being|only man|not acknowledge.*god|dont acknowledge.*god|don't acknowledge.*god)\b/i.test(effectivePromptDetectionInput));

    // Build a clean structured context payload for the user turn.
    // Keep this slim: name, Bible version, user moment, and per-request overrides only.
    // All behavioral rules belong in DEVELOPER_PROMPT, not here.
    const buildPlaybookUserContext = (input: string): string => {
      const isMSG = preferredBibleVersion.toUpperCase() === 'MSG';
      const bibleNote = isMSG
        ? `BIBLE VERSION: ${preferredBibleVersion} — provide the verse reference only; final text is supplied by the Bible service.`
        : `BIBLE VERSION: ${preferredBibleVersion} — provide a faithful draft verse text; the Bible service will verify and may replace it.`;

      let ctx = `${bibleNote}\n`;
      ctx += `USER NAME: ${userName} — use this name only. Do not invent or substitute.\n`;
      ctx += 'NAME PLACEMENT: truth_summary may begin with [User\'s Name] once. Do not write the user name or [User\'s Name] anywhere in truth_in_love or any later field.\n';
      ctx += `USER INPUT: ${input}\n`;
      ctx += `${audienceContext.promptLine}\n`;
      if (hasAmbiguousRelationshipContext) {
        ctx += 'RELATIONSHIP STATUS: The user mentioned a relationship but did not say husband, wife, spouse, married, marriage, divorce, or marital. Do not assume marriage. Use neutral relationship and safety language unless the user explicitly states marriage in this request. Current input overrides profile context for relationship status.\n';
      }
      if (hasChildEarlyRelationshipFamilyOpposesContext) {
        ctx += 'PARENTING FACT CLARIFICATION: The user describes a child having an early relationship and says sisters/family are against it because it opens doors. Interpret sisters/family as against the early child relationship, not against the user\'s protective boundaries, unless the user explicitly says they oppose the boundaries. Do not frame the playbook around family pressure to loosen boundaries. Focus on the user\'s guilt from her own childhood boyfriend experience and on communicating wise boundaries to the child.\n';
      }

      if (recentTitles.length > 0) {
        ctx += `\nTITLE UNIQUENESS: User already has: ${recentTitles.map(t => `"${t}"`).join(', ')}. Create a completely different title.\n`;
      }
      if (personalizationContext) {
        ctx += `\nUSER PROFILE CONTEXT: Use this lightly to shape complexity, tone, and practical fit. Do not quote or reveal this data.\n${personalizationContext}\n`;
      }
      if (audienceContext.isYoungUser) {
        ctx += `\nLANGUAGE FIT: User is ${audienceContext.calculatedAge} years old and under 25. Use clear, direct, everyday language. Avoid highfalutin strategy, psychology, or theology words unless necessary. Keep sentences readable and concrete. Prefer everyday wording: say "what is really going on" instead of "governing issue," "what this is costing you" instead of "tradeoff," and "what to do next" instead of "strategic response." Do not sound childish, academic, corporate, or overly intense.\n`;
      }
      if (audienceContext.isTeenUser) {
        ctx += `\nTEEN LANGUAGE FIT: User is ${audienceContext.calculatedAge} years old and under 18. Use simple, concrete words and shorter sentences. Explain any theological or strategic word in plain language. Action steps must be realistic for a teenager and must not assume marriage, parenting, full-time work, business ownership, or adult independence unless the user said so.\n`;
      }
      if (doctrinalVerdictRequired) {
        ctx += `\nDOCTRINAL VERDICT OVERRIDE: This request involves core Christian doctrine. Do not write a generic doubt, opinions, or personal-journey response. In truth_summary, state plainly that denying Jesus is God contradicts Scripture and is not biblical Christianity. In the first paragraph of truth_in_love, directly answer the user's question before any comfort. If Iglesia ni Cristo is mentioned, specifically say Iglesia ni Cristo denies the biblical doctrine of Jesus' divinity. Use Scripture as the authority, not external voices or personal conviction. Do not tell the user they can remain in or hold to a belief system that denies Jesus is God. Do not say faith is mainly about relationship if the user's understanding of Jesus is not the biblical Jesus. faithful_actions must include comparing Iglesia ni Cristo's teaching with John 1:1, John 20:28, Colossians 2:9, Hebrews 1:8, and asking a biblically grounded pastor for help leaving false teaching if needed. The correct theological direction is: Jesus is God according to Scripture, and any teaching that denies this must be rejected.\n`;
      }
      if (detectChurchOrder(effectivePromptDetectionInput)) {
        ctx += `\nCHURCH ORDER REQUEST CLARIFICATION: Address the actual leadership-design question. Do not frame biblical concern about women holding the pastor/elder/overseer office as gender bias. Clearly distinguish women serving and leading ministries from a woman holding governing pastoral authority over the whole church. If a husband and wife serve together, do not present the wife as the sole pastor or final church authority. Describe biblically permitted ministry partnership under qualified elder/pastor oversight.\n`;
      }
      ctx += `\nSUPPORT GUIDANCE: Use Christ-centered language only ("a pastor", "a biblical counselor", "a Christian counselor", "biblical community"). No phone numbers.\n`;

      return ctx;
    };

    // Build the full user message: context payload only (no few-shot examples).
    const buildUserMessage = (input: string, promptInput: string = effectivePromptDetectionInput): { message: string; developerPrompt: string } => {
      const context = buildPlaybookUserContext(input);
      const separator = '\n---\n\nNow generate a playbook:\n\n';
      const message = separator + context;
      console.log('[Generate-Playbook] User message length:', message.length, 'chars');
      const developerPrompt = buildGuidedPlaybookPrompt(promptInput);
      console.log('[Generate-Playbook] Developer prompt length:', developerPrompt.length, 'chars');
      console.log('[Generate-Playbook] JSON schema size:', JSON.stringify(PLAYBOOK_JSON_SCHEMA).length, 'chars');
      return { message, developerPrompt };
    };

    let { message: userMessage, developerPrompt } = buildUserMessage(effectiveUserInput, effectivePromptDetectionInput);

    // OpenAI call helper — accepts optional message override for explicit retry paths.
    async function callOpenAI(model: string, messageOverride?: string): Promise<Response> {
      const tierForKey = isOnboarding ? 'onboarding' : (userTier || 'spark');
      const apiKey = keyPoolManager.getBestKey(userId || 'anonymous', tierForKey);
      if (!apiKey) throw new Error('Service temporarily unavailable. Please try again.');
      const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            // 'developer' role is supported by GPT-4.1 family models
            { role: 'developer', content: developerPrompt },
            { role: 'user', content: messageOverride ?? userMessage },
          ],
          temperature: 0.5,
          top_p: 1,
          max_completion_tokens: 3000,
          frequency_penalty: 0.5,
          presence_penalty: 0.3,
          response_format: {
            type: 'json_schema',
            json_schema: PLAYBOOK_JSON_SCHEMA,
          },
        }),
      };

      try {
        const response = await CircuitBreaker.execute(
          CIRCUIT_KEYS.OPENAI_PLAYBOOK,
          async () => ENABLE_PAID_MODEL_RETRIES
            ? await fetchWithRetry(
              'https://api.openai.com/v1/chat/completions',
              requestOptions,
              OPENAI_RETRY_CONFIG
            )
            : await fetch('https://api.openai.com/v1/chat/completions', requestOptions)
        );
        keyPoolManager.setKeyHealth(apiKey.id, response.ok);
        return response;
      } catch (error) {
        keyPoolManager.setKeyHealth(apiKey.id, false);
        throw error;
      }
    }

    // Detect if the model refused or returned minimal content in JSON mode
    const isRefusal = (json: Record<string, any>): boolean => {
      const title = String(json.playbook_title || '').toLowerCase();
      const truth = String(json.truth_in_love || '').toLowerCase();
      const refusalPhrases = [
        'i cannot assist',
        "i'm sorry",
        'i am unable',
        'i cannot help',
        'cannot fulfill',
      ];
      return refusalPhrases.some(p => title.includes(p) || truth.includes(p));
    };

    let openAIRes = await callOpenAI('gpt-4.1-mini');

    if (!openAIRes.ok) {
      const errData = await openAIRes.json().catch(() => ({}));
      console.error('[Generate-Playbook] OpenAI HTTP error:', openAIRes.status, errData);
      throw new Error(errData?.error?.message || `OpenAI returned ${openAIRes.status}`);
    }

    let aiData = await openAIRes.json();
    let rawContent: string = aiData.choices?.[0]?.message?.content || '';

    // Log token usage
    const usage = aiData.usage;
    if (usage) {
      console.log('[Generate-Playbook] ===== TOKEN USAGE =====');
      console.log('[Generate-Playbook] Model:', aiData.model);
      console.log('[Generate-Playbook] Prompt Tokens (Input):', usage.prompt_tokens);
      console.log('[Generate-Playbook] Completion Tokens (Output):', usage.completion_tokens);
      console.log('[Generate-Playbook] Total Tokens:', usage.total_tokens);
      console.log('[Generate-Playbook] Cost Calculation (gpt-4.1-mini):');
      console.log('[Generate-Playbook] - Input Cost ($0.40/M):', (usage.prompt_tokens * 0.00040 / 1000).toFixed(6), 'USD');
      console.log('[Generate-Playbook] - Output Cost ($1.60/M):', (usage.completion_tokens * 0.00160 / 1000).toFixed(6), 'USD');
      console.log('[Generate-Playbook] - Total Cost:', ((usage.prompt_tokens * 0.00040 + usage.completion_tokens * 0.00160) / 1000).toFixed(6), 'USD');
      console.log('[Generate-Playbook] =============================');
    }

    const finishReason = aiData.choices?.[0]?.finish_reason;
    console.log('[Generate-Playbook] finish_reason:', finishReason);
    console.log('[Generate-Playbook] raw length:', rawContent.length, 'chars');
    console.log('[Generate-Playbook] ===== RAW JSON OUTPUT START =====');
    console.log(rawContent);
    console.log('[Generate-Playbook] ===== RAW JSON OUTPUT END =====');

    // Content filter: OpenAI truncates the JSON mid-generation.
    // Retry once with softened phrasing before giving up.
    if (finishReason === 'content_filter') {
      if (providerFilterShouldBlockUser) {
        console.warn('[Generate-Playbook] Provider content filter triggered for sensitive category', {
          category: contentAnalysis.category,
          appBlocked: contentAnalysis.shouldBlock,
        });
        return providerContentFilterResponse();
      }

      if (!ENABLE_PROVIDER_CONTENT_FILTER_RETRY) {
        console.warn('[Generate-Playbook] Provider content filter triggered; provider retry disabled', {
          category: contentAnalysis.category,
          appBlocked: contentAnalysis.shouldBlock,
        });
        return providerContentFilterResponse();
      }

      console.warn('[Generate-Playbook] Provider content filter false positive suspected — retrying once', {
        category: contentAnalysis.category,
      });
      const softenedInput = effectiveUserInput
        .replace(/\b(lying|lie|lied|liar|lies)\b/gi, 'struggling with honesty')
        .replace(/\b(stealing|steal|stole|theft)\b/gi, 'struggling with taking what is not mine')
        .replace(/\b(cheating|cheat|cheated)\b/gi, 'struggling with faithfulness')
        .replace(/\b(hurting|hitting|hit)\s+(him|her|them|my|someone)\b/gi, 'struggling in this relationship')
        .trim();
      const softenedPromptDetectionInput = effectivePromptDetectionInput
        .replace(/\b(lying|lie|lied|liar|lies)\b/gi, 'struggling with honesty')
        .replace(/\b(stealing|steal|stole|theft)\b/gi, 'struggling with taking what is not mine')
        .replace(/\b(cheating|cheat|cheated)\b/gi, 'struggling with faithfulness')
        .replace(/\b(hurting|hitting|hit)\s+(him|her|them|my|someone)\b/gi, 'struggling in this relationship')
        .trim();
      const softenedPrompt = buildUserMessage(softenedInput, softenedPromptDetectionInput);
      userMessage = softenedPrompt.message;
      developerPrompt = softenedPrompt.developerPrompt;
      const filterRetryRes = await callOpenAI('gpt-4.1-mini');
      if (!filterRetryRes.ok) {
        throw new Error(`OpenAI returned ${filterRetryRes.status} on content filter retry`);
      }
      aiData = await filterRetryRes.json();
      rawContent = aiData.choices?.[0]?.message?.content || '';
      const retryUsage = aiData.usage;
      if (retryUsage) {
        console.log('[Generate-Playbook] Provider Filter Retry Model:', aiData.model);
        console.log('[Generate-Playbook] Provider Filter Retry Prompt Tokens (Input):', retryUsage.prompt_tokens);
        console.log('[Generate-Playbook] Provider Filter Retry Completion Tokens (Output):', retryUsage.completion_tokens);
        console.log('[Generate-Playbook] Provider Filter Retry Total Tokens:', retryUsage.total_tokens);
        console.log('[Generate-Playbook] Provider Filter Retry Cost Calculation (gpt-4.1-mini):');
        console.log('[Generate-Playbook] - Provider Filter Retry Input Cost ($0.40/M):', (retryUsage.prompt_tokens * 0.00040 / 1000).toFixed(6), 'USD');
        console.log('[Generate-Playbook] - Provider Filter Retry Output Cost ($1.60/M):', (retryUsage.completion_tokens * 0.00160 / 1000).toFixed(6), 'USD');
        console.log('[Generate-Playbook] - Provider Filter Retry Total Cost:', ((retryUsage.prompt_tokens * 0.00040 + retryUsage.completion_tokens * 0.00160) / 1000).toFixed(6), 'USD');
      }
      const retryFinishReason = aiData.choices?.[0]?.finish_reason;
      console.log('[Generate-Playbook] Content filter retry finish_reason:', retryFinishReason);
      if (retryFinishReason === 'content_filter') {
        return providerContentFilterResponse();
      }
    }

    // Strip any garbage tokens that appear after the JSON object closes.
    // Non-standard model names can produce training artifact tokens after the closing brace.
    const extractJsonObject = (raw: string): string => {
      const start = raw.indexOf('{');
      if (start === -1) return raw;
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let i = start; i < raw.length; i++) {
        const ch = raw[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) return raw.slice(start, i + 1); }
      }
      return raw.slice(start);
    };

    rawContent = extractJsonObject(rawContent);

    // Parse JSON from structured output
    let parsedJson: Record<string, any>;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch (parseErr) {
      console.error('[Generate-Playbook] JSON parse failed:', parseErr, 'raw:', rawContent.substring(0, 500));
      throw new Error('AI returned malformed JSON. Please try again.');
    }

    // Defensive cleanup: strip leading/trailing single-quote wrapping from string fields
    // The model occasionally outputs "'Heavenly Father,...'" or "'What am I...?'"
    const stripWrappingQuotes = (s: unknown): string => {
      if (typeof s !== 'string') return s as string;
      const t = s.trim();
      if (t.startsWith("'") && t.endsWith("'") && t.length > 2) return t.slice(1, -1).trim();
      if (t.startsWith("'")) return t.slice(1).trim();
      return s;
    };
    if (typeof parsedJson.prayer === 'string') parsedJson.prayer = stripWrappingQuotes(parsedJson.prayer);
    if (parsedJson.completion && typeof parsedJson.completion.question === 'string') {
      parsedJson.completion.question = stripWrappingQuotes(parsedJson.completion.question);
    }

    // Refusal detection (rare with structured outputs but possible)
    if (isRefusal(parsedJson)) {
      if (!ENABLE_PAID_MODEL_RETRIES) {
        console.warn('[Generate-Playbook] AI refusal detected; paid paraphrase retry disabled');
        const isShSensitive = contentAnalysis.category === 'self_harm';
        return new Response(
          JSON.stringify({
            error: 'CONTENT_BLOCKED',
            message: isShSensitive
              ? selfHarmSafetyMessage
              : 'This topic could not be processed. For personalized guidance on sensitive matters, we recommend speaking with a Christian counselor or pastor.',
            alternatives: contentAnalysis.constructiveAlternatives,
            category: contentAnalysis.category,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[Generate-Playbook] AI refused, attempting paraphrase retry...');

      effectiveUserInput = contentAnalysis.isVictimExperience
        ? paraphraseVictimExperience(userInput)
        : userInput
            .replace(/\b(i want to|i need to|i will)\s+(commit\s+)?suicide\b/gi, 'I am struggling with thoughts of ending my life')
            .replace(/\b(i want to|i need to|i will)\s+kill\s+myself\b/gi, 'I am having thoughts of self-harm')
            .replace(/\b(i want|i need|i will)\b/gi, 'I am thinking about')
            .replace(/\s+/g, ' ')
            .trim();
      effectivePromptDetectionInput = contentAnalysis.isVictimExperience
        ? paraphraseVictimExperience(detectionInput)
        : detectionInput
            .replace(/\b(i want to|i need to|i will)\s+(commit\s+)?suicide\b/gi, 'I am struggling with thoughts of ending my life')
            .replace(/\b(i want to|i need to|i will)\s+kill\s+myself\b/gi, 'I am having thoughts of self-harm')
            .replace(/\b(i want|i need|i will)\b/gi, 'I am thinking about')
            .replace(/\s+/g, ' ')
            .trim();

      const paraphrasedPrompt = buildUserMessage(effectiveUserInput, effectivePromptDetectionInput);
      userMessage = paraphrasedPrompt.message;
      developerPrompt = paraphrasedPrompt.developerPrompt;

      let paraphrasedSuccess = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        openAIRes = await callOpenAI('gpt-4.1-mini');
        if (!openAIRes.ok) break;
        aiData = await openAIRes.json();
        rawContent = aiData.choices?.[0]?.message?.content || '';
        try {
          parsedJson = JSON.parse(rawContent);
          if (!isRefusal(parsedJson)) {
            paraphrasedSuccess = true;
            break;
          }
        } catch { /* continue */ }
        await new Promise(r => setTimeout(r, 800));
      }

      if (!paraphrasedSuccess) {
        const isShSensitive = contentAnalysis.category === 'self_harm';
        return new Response(
          JSON.stringify({
            error: 'CONTENT_BLOCKED',
            message: isShSensitive
              ? selfHarmSafetyMessage
              : 'This topic could not be processed. For personalized guidance on sensitive matters, we recommend speaking with a Christian counselor or pastor.',
            alternatives: contentAnalysis.constructiveAlternatives,
            category: contentAnalysis.category,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate the JSON output — two-tier: hard failures + structural soft issues
    const validationInput = [effectiveUserInput, effectivePromptDetectionInput].filter(Boolean).join('\n');
    let { hardIssues, softIssues } = validatePlaybook(parsedJson!, validationInput);

    if (hardIssues.length > 0) {
      const churchOrderFails = hardIssues.filter(i => i.includes('church order violation'));
      if (churchOrderFails.length > 0) {
        console.warn('[Generate-Playbook] Church-order violation detected — retrying with church-order module forced:', churchOrderFails);

        const previousDeveloperPrompt = developerPrompt;
        const forcedChurchOrderPromptInput = [
          effectivePromptDetectionInput,
          'church order women pastor female pastor woman elder female elder women overseer pastor elder overseer 1 Timothy 2 1 Timothy 3 Titus 1',
        ].filter(Boolean).join('\n');
        const forcedChurchOrder = buildUserMessage(effectiveUserInput, forcedChurchOrderPromptInput);
        developerPrompt = forcedChurchOrder.developerPrompt;

        try {
          const churchOrderRetryRes = await callOpenAI('gpt-4.1-mini', forcedChurchOrder.message);
          if (churchOrderRetryRes.ok) {
            const retryData = await churchOrderRetryRes.json();
            const retryContent: string = retryData.choices?.[0]?.message?.content || '';
            const retryJson = JSON.parse(retryContent);
            if (!isRefusal(retryJson)) {
              const retryValidationInput = [effectiveUserInput, forcedChurchOrderPromptInput].filter(Boolean).join('\n');
              const retryValidation = validatePlaybook(retryJson, retryValidationInput);
              if (retryValidation.hardIssues.filter(i => i.includes('generation failure') || i.includes('church order violation')).length === 0) {
                console.log('[Generate-Playbook] Church-order retry succeeded');
                parsedJson = retryJson;
                hardIssues = retryValidation.hardIssues;
                softIssues = retryValidation.softIssues;
              } else {
                console.warn('[Generate-Playbook] Church-order retry still failed:', retryValidation.hardIssues);
              }
            }
          } else {
            console.warn('[Generate-Playbook] Church-order retry request failed:', churchOrderRetryRes.status);
          }
        } catch (retryError) {
          console.warn('[Generate-Playbook] Church-order retry failed:', retryError);
        } finally {
          developerPrompt = previousDeveloperPrompt;
        }
      }
    }

    if (hardIssues.length > 0) {
      console.error('[Generate-Playbook] Hard validation failures:', hardIssues);
      const criticalFails = hardIssues.filter(i =>
        i.includes('playbook_title') || i.includes('generation failure') || i.includes('church order violation')
      );
      if (criticalFails.length > 0) {
        throw new Error(`AI failed validation: ${criticalFails.join(', ')}`);
      }

      // Content-completeness retry: missing prayer / words_to_speak / completion / closing
      // The model sometimes "gives up" on trailing fields. Issue a single retry with an
      // explicit fill-in-the-gaps directive before saving an incomplete playbook.
      const missingContentIssues = hardIssues.filter(i =>
        i.startsWith('prayer is too short') ||
        i.startsWith('words_to_speak has') ||
        i.startsWith('closing is') ||
        i.startsWith('completion.question is missing') ||
        i.startsWith('completion.lines has') ||
        i.startsWith('truth_in_love is too short') ||
        i.startsWith('transition_line is missing') ||
        i.startsWith('scripture_note_lines has') ||
        i.startsWith('bible_verse missing')
      );

      if (missingContentIssues.length > 0) {
        if (!ENABLE_PAID_MODEL_RETRIES) {
          console.warn('[Generate-Playbook] Missing content detected; paid retry disabled, injecting local fallbacks:', missingContentIssues);
          injectLocalRequiredFieldFallbacks(parsedJson!);

          const { hardIssues: fallbackHard } = validatePlaybook(parsedJson!, validationInput);
          const unresolvedFallbackIssues = fallbackHard.filter(i =>
            i.includes('playbook_title') ||
            i.includes('generation failure') ||
            i.includes('church order violation')
          );
          if (unresolvedFallbackIssues.length > 0) {
            throw new Error(`AI failed validation after local fallbacks: ${unresolvedFallbackIssues.join(', ')}`);
          }
        } else {
          console.log('[Generate-Playbook] Missing content detected — retrying with completion directive:', missingContentIssues);

          const completionNote = [
            '',
            'CRITICAL FIX — your previous response left these required fields empty or too short:',
            ...missingContentIssues.map(i => `  - ${i}`),
            'You MUST fill EVERY required field with substantive content. Do not return empty strings or empty arrays for any required field.',
            'Specifically:',
            '  - prayer: write a complete prayer (at least 50 characters, in second person to God).',
            '  - words_to_speak: provide 4-5 declaration lines the user can speak aloud.',
            '  - completion.question: one reflective question (10+ chars) ending with "?".',
            '  - completion.lines: 2-4 short imperative lines for closing.',
            '  - closing: one pastoral closing affirmation sentence.',
            'Return the FULL JSON, complete in every section.',
          ].join('\n');

        const correctedMessage = userMessage + completionNote;
        const completionRetryRes = await callOpenAI('gpt-4.1-mini', correctedMessage);

        if (!completionRetryRes.ok) {
          throw new Error(`OpenAI returned ${completionRetryRes.status} on content-completeness retry`);
        }

        let retry1Json: any = null;
        try {
          const completionRetryData = await completionRetryRes.json();
          const completionRetryContent: string = completionRetryData.choices?.[0]?.message?.content || '';
          retry1Json = JSON.parse(completionRetryContent);
        } catch {
          throw new Error('AI returned invalid JSON on content-completeness retry');
        }

        if (isRefusal(retry1Json)) {
          throw new Error('AI returned a refusal on content-completeness retry');
        }

        // Merge any good fields from retry1 into parsedJson before checking gaps
        // (model may have fixed prayer/words_to_speak but still left closing/completion empty)
        const mergedJson = { ...parsedJson, ...retry1Json };
        // Preserve best-of for prayer and words_to_speak
        if (String(retry1Json?.prayer || '').trim().length > String(parsedJson?.prayer || '').trim().length) {
          mergedJson.prayer = retry1Json.prayer;
        }
        if (Array.isArray(retry1Json?.words_to_speak) && retry1Json.words_to_speak.length > (parsedJson?.words_to_speak?.length ?? 0)) {
          mergedJson.words_to_speak = retry1Json.words_to_speak;
        }

        const { hardIssues: retryHard } = validatePlaybook(mergedJson, validationInput);
        const stillMissingContent = retryHard.filter(i =>
          i.startsWith('prayer is too short') ||
          i.startsWith('words_to_speak has') ||
          i.startsWith('completion.question is missing') ||
          i.startsWith('completion.lines has') ||
          i.startsWith('closing is')
        );

        if (stillMissingContent.length === 0) {
          console.log('[Generate-Playbook] Content-completeness retry succeeded');
          parsedJson = mergedJson;
        } else {
          // Only closing/completion still missing — do a targeted second retry
          const onlyClosingCompletion = stillMissingContent.every(i =>
            i.startsWith('completion.question is missing') ||
            i.startsWith('completion.lines has') ||
            i.startsWith('closing is')
          );

          if (onlyClosingCompletion) {
            console.log('[Generate-Playbook] Targeted patch retry for closing/completion:', stillMissingContent);

            // Injects safe fallbacks into a json object for closing/completion fields
            const injectClosingFallbacks = (target: Record<string, any>): void => {
              if (!String(target.closing || '').trim()) {
                target.closing = 'God is faithful to complete the work He began in you.';
              }
              if (!String(target.completion?.question || '').trim()) {
                target.completion = target.completion || {};
                target.completion.question = 'What specific step will you take this week to act on what you have learned?';
              }
              if (!Array.isArray(target.completion?.lines) || target.completion.lines.length < 2) {
                target.completion = target.completion || {};
                target.completion.lines = ['Take one step forward today.', 'Trust God with the outcome.'];
              }
            };

            const patchNote = [
              '',
              'FINAL PATCH — only these two fields are incomplete. Fill them in now:',
              '  - closing: write one warm pastoral affirmation sentence (e.g., "God is faithful to complete the work He began in you.").',
              '  - completion.question: write one reflective question ending with "?" (e.g., "What specific action will you take this week?").',
              '  - completion.lines: write 2-4 short imperative encouragement lines (e.g., "Take one step.", "Trust His timing.").',
              'Return the FULL JSON with all fields populated.',
            ].join('\n');

            const patchMessage = userMessage + patchNote;
            const patchRes = await callOpenAI('gpt-4.1-mini', patchMessage);

            if (patchRes.ok) {
              try {
                const patchData = await patchRes.json();
                const patchContent: string = patchData.choices?.[0]?.message?.content || '';
                const patchJson = JSON.parse(patchContent);
                if (!isRefusal(patchJson)) {
                  // Merge patch fields into mergedJson
                  const finalJson = { ...mergedJson };
                  if (String(patchJson?.closing || '').trim().length > 0) {
                    finalJson.closing = patchJson.closing;
                  }
                  if (patchJson?.completion?.question && String(patchJson.completion.question).trim().length >= 10) {
                    finalJson.completion = { ...finalJson.completion, question: patchJson.completion.question };
                  }
                  if (Array.isArray(patchJson?.completion?.lines) && patchJson.completion.lines.length >= 2) {
                    finalJson.completion = { ...finalJson.completion, lines: patchJson.completion.lines };
                  }

                  const { hardIssues: patchHard } = validatePlaybook(finalJson, validationInput);
                  const patchStillMissing = patchHard.filter(i =>
                    i.startsWith('completion.question is missing') ||
                    i.startsWith('completion.lines has') ||
                    i.startsWith('closing is')
                  );

                  if (patchStillMissing.length === 0) {
                    console.log('[Generate-Playbook] Targeted patch retry succeeded');
                  } else {
                    console.warn('[Generate-Playbook] Patch retry still incomplete — injecting safe fallbacks:', patchStillMissing);
                    injectClosingFallbacks(finalJson);
                  }
                  parsedJson = finalJson;
                }
              } catch (patchErr) {
                if (patchErr instanceof SyntaxError) {
                  console.warn('[Generate-Playbook] Patch retry returned invalid JSON — injecting fallbacks');
                  const finalJson = { ...mergedJson };
                  injectClosingFallbacks(finalJson);
                  parsedJson = finalJson;
                } else {
                  throw patchErr;
                }
              }
            } else {
              console.warn('[Generate-Playbook] Patch call failed — injecting fallbacks for closing/completion');
              const finalJson = { ...mergedJson };
              injectClosingFallbacks(finalJson);
              parsedJson = finalJson;
            }
          } else {
            // Core content (prayer/words_to_speak) still missing after retry — hard fail
            console.warn('[Generate-Playbook] Content-completeness retry still has core gaps:', stillMissingContent);
            throw new Error(`AI failed to generate complete playbook content: ${stillMissingContent.join(', ')}`);
          }
        }
        }
      } else {
        // Remaining non-critical hard issues (e.g., minor length warnings on optional shapes)
        console.warn('[Generate-Playbook] Non-critical hard issues (continuing):', hardIssues);
      }
    }

    if (softIssues.length > 0) {
      const softIssueLabel = ENABLE_PAID_MODEL_RETRIES && ENABLE_PAID_ARCHITECTURAL_RETRY
        ? '[Generate-Playbook] Structural soft issues:'
        : '[Generate-Playbook] Structural soft issues (warn-only; no paid architectural retry):';
      console.warn(softIssueLabel, softIssues);
    }

    // Architectural/style checks should not spend a second OpenAI call by default.
    // The prompt and local repair handle formatting; retries stay reserved for missing core content.
    const architecturalIssues = ENABLE_PAID_MODEL_RETRIES && ENABLE_PAID_ARCHITECTURAL_RETRY
      ? softIssues.filter(i =>
        i.includes('Action sequence drift') ||
        i.includes('Abstraction drift') ||
        i.includes('Overused navigation language') ||
        i.includes('Truth in Love opening') ||
        i.includes('Faithful action body format variation') ||
        i.includes('Faithful action example bubble missing')
      )
      : [];

    if (architecturalIssues.length > 0) {
      console.log('[Generate-Playbook] Architectural drift detected — retrying with correction:', architecturalIssues);

      const correctionNote = [
        '\nARCHITECTURAL CORRECTION — the previous attempt failed these checks:',
        ...architecturalIssues.map(i => `  - ${i}`),
        'Fix these structural issues:',
        '  truth_in_love must start directly with the diagnosis, correction, cost, or decision. No emotional setup, throat-clearing, or long pastoral intro.',
        '  truth_in_love first paragraph must be 1-2 direct sentences, then continue only as needed.',
        '  faithful_actions must be 5-7 specific, concrete core steps, plus one optional counselor/pastor support bonus when needed.',
        '  Counselor, pastor, or biblical community support must not replace one of the 5-7 core faithful actions. Put it last as the bonus action.',
        '  faithful_actions.body is the rendered walkthrough text. Vary the body field itself, not only description.',
        '  Every faithful_actions.body must include one Example: marker after the main assignment so the UI renders a speech-bubble example.',
        '  Example text must be pre-action guidance: a sample action, exact wording, or filled-in field. It is not completion proof.',
        '  Do not write past-tense completion reports like "Message sent...", "I texted...", "I wrote...", "I hid...", or "I shared...". Only primary_button should sound completed.',
        '  Use the required format mix in body: bullets with \\n* lines, decision filter, script, stop/start, timeline, practice loop, audit fields, or concise prose.',
        '  Bullet checklists must put each bullet on its own line. Use "Do this:\\n* First step\\n* Second step", never "Do this: * First step * Second step".',
        '  Labeled formats must put each label on its own line. Use "Trigger: ...\\nLie: ...\\nReplacement response: ...", never one inline label chain.',
        '  Script/message formats must put the quoted message on its own line and follow-up instruction on a separate line after the quote.',
        '  Never write meta examples like "Example loop written out clearly"; write the actual filled-in example.',
        '  Practice loops must use clear grammar. Use "Pause, step outside, and pray one honest sentence" instead of "Stop walking outside..." Never use "prayer walk-up".',
        '  Do not make every body a single paragraph followed by Example. Vary the main assignment before Example:',
        '  Do not use: ' + DRIFT_PHRASES.slice(0, 5).join(', ') + '.',
        '  Do not use any form of "navigate" or "navigation"; choose a concrete verb like face, discern, obey, endure, confront, or rebuild.',
      ].join('\n');

      const correctedMessage = userMessage + correctionNote;

      console.log('[Generate-Playbook] ===== ARCHITECTURAL RETRY START =====');
      const retryRes = await callOpenAI('gpt-4.1-mini', correctedMessage);
      if (retryRes.ok) {
        const retryData = await retryRes.json();
        const retryContent: string = retryData.choices?.[0]?.message?.content || '';

        // Log retry token usage and cost
        const retryUsage = retryData.usage;
        if (retryUsage) {
          console.log('[Generate-Playbook] Retry Model:', retryData.model);
          console.log('[Generate-Playbook] Retry Prompt Tokens (Input):', retryUsage.prompt_tokens);
          console.log('[Generate-Playbook] Retry Completion Tokens (Output):', retryUsage.completion_tokens);
          console.log('[Generate-Playbook] Retry Total Tokens:', retryUsage.total_tokens);
          console.log('[Generate-Playbook] Retry Cost Calculation (gpt-4.1-mini):');
          console.log('[Generate-Playbook] - Retry Input Cost ($0.40/M):', (retryUsage.prompt_tokens * 0.00040 / 1000).toFixed(6), 'USD');
          console.log('[Generate-Playbook] - Retry Output Cost ($1.60/M):', (retryUsage.completion_tokens * 0.00160 / 1000).toFixed(6), 'USD');
          console.log('[Generate-Playbook] - Retry Total Cost:', ((retryUsage.prompt_tokens * 0.00040 + retryUsage.completion_tokens * 0.00160) / 1000).toFixed(6), 'USD');
        }

        try {
          const retryJson = JSON.parse(retryContent);
          if (!isRefusal(retryJson)) {
            const { hardIssues: retryHard } = validatePlaybook(retryJson, validationInput);
            if (retryHard.filter(i => i.includes('generation failure') || i.includes('church order violation')).length === 0) {
              console.log('[Generate-Playbook] Architectural retry succeeded');
              parsedJson = retryJson;
            } else {
              console.warn('[Generate-Playbook] Architectural retry also has issues — using original');
            }
          }
        } catch {
          console.warn('[Generate-Playbook] Architectural retry parse failed — using original');
        }
      } else {
        console.warn('[Generate-Playbook] Architectural retry request failed — using original');
      }
      console.log('[Generate-Playbook] ===== ARCHITECTURAL RETRY END =====');
    }

    // Repair (em dash removal, completion prefix, prayer closing strip)
    const repairedJson = repairPlaybook(parsedJson!);

    // Build Playbook object from JSON (store original userInput, not paraphrased)
    let playbook = parseJsonPlaybook(repairedJson, userName, userInput, preferredBibleVersion);

    // Final safety check
    if (!playbook.title || playbook.title.trim().length < 3) {
      throw new Error('AI failed to generate a valid playbook title');
    }
    if (!Array.isArray(playbook.actionSteps) || playbook.actionSteps.length === 0) {
      throw new Error('AI failed to generate action steps');
    }

    // Enforce exact bible verse text from our verse database
    await enforcePlaybookBibleVerse(playbook, preferredBibleVersion);

    playbook.totalTasks = playbook.actionSteps.length;
    playbook.progress = 0;

    return new Response(JSON.stringify(playbook, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        ...corsHeaders,
      },
    });

  } catch (error: unknown) {
    console.error('Error generating playbook:', error);

    if ((error as any).contentBlocked) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        error: "We couldn't create your playbook right now",
        message: 'Something went wrong. Please try again in a moment.',
        retryable: false,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { DEVELOPER_PROMPT } from './persona.config.ts';
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
  truthBlocks?: TruthBlock[];
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

interface TruthBlock {
  type: 'opening' | 'distinction' | 'exposure' | 'reframe' | 'cost' | 'direction' | 'challenge' | 'pause';
  text: string;
}

type TruthBlockCandidate = {
  type?: unknown;
  text?: unknown;
};

type TruthBlockInput = {
  type?: unknown;
  text: string;
};

const TRUTH_BLOCK_TYPES = new Set<TruthBlock['type']>([
  'opening',
  'distinction',
  'exposure',
  'reframe',
  'cost',
  'direction',
  'challenge',
  'pause',
]);

function isTruthBlockPayload(block: unknown): block is TruthBlockInput {
  if (!block || typeof block !== 'object') {
    return false;
  }

  const candidate = block as TruthBlockCandidate;
  return typeof candidate.text === 'string';
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
      truth_blocks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['opening', 'distinction', 'exposure', 'reframe', 'cost', 'direction', 'challenge', 'pause'],
            },
            text: { type: 'string' },
          },
          required: ['type', 'text'],
          additionalProperties: false,
        },
      },
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
      // 3–7 steps — enforced in validation + prompt
      faithful_actions: {
        type: 'array',
        minItems: 3,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 3 },
            body: { type: 'string', minLength: 10 },
            primary_button: { type: 'string', minLength: 2 },
            secondary_button: { type: 'string', minLength: 2 },
          },
          required: ['title', 'body', 'primary_button', 'secondary_button'],
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
      'truth_blocks',
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

function sanitizeText(text: string): string {
  return removeOverusedNavigationLanguage(text.replace(/\byoga\b/gi, 'gentle stretching'));
}

function cleanMarkdown(text: string): string {
  if (!text) {
    return '';
  }
  return text
    .replace(/\*\*|__/g, '')                // strip bold markers
    .replace(/(?<!\n)\*(?!\s)/g, '')        // strip inline italic * not followed by space (e.g. *word*)
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/ +([,.;:!?])/g, '$1')
    .trim();
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
  promptLine: string;
  languageHint?: string;
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
    const promptLine = `AUDIENCE CONTEXT: User is ${calculatedAge}. Match tone, examples, and maturity to this exact age without drawing attention to the number unless it directly matters. Keep the language grounded and concrete—no lofty vocabulary.`;
    const languageHint = calculatedAge <= 18
      ? `LANGUAGE FIT: Because the user is ${calculatedAge} and under 19, use shorter sentences, simple words, and explain any theological concepts plainly.`
      : 'LANGUAGE FIT: Use crisp, concrete language and avoid highfalutin or academic jargon.';

    return {
      calculatedAge,
      ageSource: 'dateOfBirth',
      promptLine,
      languageHint,
    };
  }

  return {
    calculatedAge: null,
    ageSource: 'unknown',
    promptLine: 'AUDIENCE CONTEXT: Age is unknown. Offer guidance that works across ages, avoid assumptions about stage of life, and keep vocabulary plain and relatable.',
    languageHint: 'LANGUAGE FIT: Use clear, everyday wording so it serves readers of any age.',
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
  'honor your feelings',
  'sit with the discomfort',
  'lean into',
  'this is a season',
  'god is writing your story',
];

// Weak action verbs — if the majority of action titles use these, the sequence is too soft
const SOFT_ACTION_VERBS = ['reflect', 'consider', 'practice', 'remember', 'think', 'meditate', 'embrace', 'allow', 'accept'];
const SHARP_ACTION_VERBS = ['name', 'separate', 'stop', 'write', 'ask', 'say', 'face', 'choose', 'refuse', 'tell', 'confront', 'cut', 'bring', 'identify', 'commit'];

// ─── Validate JSON playbook response ─────────────────────────────────────────
// Returns two categories: hardIssues (must retry/fail) and softIssues (warn only).

interface ValidationResult {
  hardIssues: string[];   // Missing fields, generation failures — block or retry
  softIssues: string[];   // Structural drift — log, trigger architectural retry
}

function validatePlaybook(json: Record<string, any>, originalInput = ''): ValidationResult {
  const hardIssues: string[] = [];
  const softIssues: string[] = [];

  // ── Hard checks: field presence and minimum length ───────────────────────

  if (!json.playbook_title || String(json.playbook_title).trim().length < 5) {
    hardIssues.push('playbook_title is missing or too short');
  }
  if (!json.truth_summary || String(json.truth_summary).trim().split(/\s+/).filter(Boolean).length < 8) {
    hardIssues.push(`truth_summary is too short (${String(json.truth_summary || '').trim().split(/\s+/).filter(Boolean).length} words, min 8)`);
  }
  if (json.truth_summary && String(json.truth_summary).trim().split(/\s+/).filter(Boolean).length > 50) {
    softIssues.push(`truth_summary is too long (${String(json.truth_summary).trim().split(/\s+/).filter(Boolean).length} words — expected a concise summary)`);
  }
  if (!json.truth_in_love || String(json.truth_in_love).length < 500) {
    hardIssues.push(`truth_in_love is too short (${String(json.truth_in_love || '').length} chars, min 500 — must be at least 4 full paragraphs)`);
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

  const actionCount = Array.isArray(json.faithful_actions) ? json.faithful_actions.length : 0;
  if (actionCount < 3) {
    hardIssues.push(`faithful_actions has ${actionCount} items (need at least 3) — generation failure`);
  }
  if (actionCount > 7) {
    softIssues.push(`faithful_actions has ${actionCount} items (max 7) — will trim`);
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
    const wordCount = summaryText.split(/\s+/).filter(Boolean).length;
    if (wordCount > 22) {
      softIssues.push(`truth_summary is too long (${wordCount} words — expected a concise summary)`);
    }
  }

  // truth_blocks: 4-7 supporting beats for UI rhythm
  if (Array.isArray(json.truth_blocks)) {
    const truthBlocks = json.truth_blocks.filter(isTruthBlockPayload).filter((block) => block.text.trim().length > 0);
    if (truthBlocks.length < 4) {
      softIssues.push(`truth_blocks has ${truthBlocks.length} items (expected 4-7)`);
    } else if (truthBlocks.length > 7) {
      softIssues.push(`truth_blocks has ${truthBlocks.length} items (max 7)`);
    }
  } else {
    softIssues.push('truth_blocks is missing');
  }

  // Abstraction drift — flag forbidden phrases
  const allText = JSON.stringify(json).toLowerCase();
  const driftFound = DRIFT_PHRASES.filter(p => allText.includes(p));
  if (driftFound.length > 0) {
    softIssues.push(`Abstraction drift detected — forbidden phrases: ${driftFound.join(', ')}`);
  }

  // Action sequence quality — check verb sharpness across first 3 actions
  if (Array.isArray(json.faithful_actions) && json.faithful_actions.length >= 3) {
    const firstThreeTitles = json.faithful_actions.slice(0, 3).map((a: any) => String(a.title || '').toLowerCase());
    const softCount = firstThreeTitles.filter(t => SOFT_ACTION_VERBS.some(v => t.startsWith(v))).length;
    const sharpCount = firstThreeTitles.filter(t => SHARP_ACTION_VERBS.some(v => t.startsWith(v))).length;
    if (softCount >= 2 && sharpCount === 0) {
      softIssues.push(`Action sequence drift — first 3 actions start with soft verbs (${firstThreeTitles.join(' | ')}). Expected sharp diagnostic verbs.`);
    }
  }

  return { hardIssues, softIssues };
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

  // Ensure prayer doesn't contain the closing — added by the UI
  if (repaired.prayer) {
    repaired.prayer = repaired.prayer
      .replace(/\n*In Jesus'? [Nn]ame,?\s*[Aa]men\.?/gi, '')
      .replace(/\n*[Aa]men\.?$/gi, '')
      .trimEnd();
  }

  // Ensure completion.question ends with ?
  if (repaired.completion?.question && !String(repaired.completion.question).trim().endsWith('?')) {
    repaired.completion.question = String(repaired.completion.question).trim() + '?';
  }

  // Trim faithful_actions to max 7
  if (Array.isArray(repaired.faithful_actions) && repaired.faithful_actions.length > 7) {
    repaired.faithful_actions = repaired.faithful_actions.slice(0, 7);
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
  const truthBlocks: TruthBlock[] = Array.isArray(json.truth_blocks)
    ? json.truth_blocks
        .filter(isTruthBlockPayload)
        .filter((block) => block.text.trim().length > 0)
        .slice(0, 7)
        .map((block) => ({
          type: TRUTH_BLOCK_TYPES.has(String(block.type) as TruthBlock['type'])
            ? (String(block.type) as TruthBlock['type'])
            : 'pause',
          text: cleanMarkdown(String(block.text || '')),
        }))
    : [];

  const rawTruthInLove = cleanMarkdown(json.truth_in_love || '');
  const blockRenderedTruth = truthBlocks.map(block => block.text).filter(Boolean).join('\n\n');
  const rawHasEnoughShape = rawTruthInLove.trim().length >= 200 && countParagraphs(rawTruthInLove) >= 4;
  const truthInLoveText = rawHasEnoughShape ? rawTruthInLove : (blockRenderedTruth || rawTruthInLove);

  const playbook: Playbook = {
    id: generateUUID(),
    title: cleanMarkdown(json.playbook_title || ''),
    subtitle: '',
    category: json.category || 'Growth',
    truthInLove: {
      summary: stripRepeatedName(cleanMarkdown(json.truth_summary || ''), userName),
      text: stripAllName(truthInLoveText, userName),
    },
    truthBlocks,
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
        const question = String(c.question || '').trim();
        const lines = Array.isArray(c.lines)
          ? c.lines.filter((l: any) => typeof l === 'string' && l.trim().length > 0)
          : [];
        const q = question.length >= 10 ? question : 'What specific step will you take this week to act on what you have learned?';
        const ls = lines.length >= 2 ? lines : ['Take one step forward today.', 'Trust God with the outcome.'];
        return `Before you close:\n${q}\n\n${ls.join('\n')}`;
      }
      // fallback for unexpected string (schema change race condition)
      return String(c || '');
    })(),
    challengeCTA: json.closing && String(json.closing).trim().length >= 5
      ? stripAllName(cleanMarkdown(String(json.closing)), userName)
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
      const body = cleanMarkdown(String(action.body || ''));
      return {
        id: generateUUID(),
        title,
        description: body,
        primaryButton: action.primary_button ? cleanMarkdown(String(action.primary_button)) : undefined,
        secondaryButton: action.secondary_button ? cleanMarkdown(String(action.secondary_button)) : undefined,
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
}

// ─── serve ────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const generationStartTime = Date.now();
  console.log('[Generate-Playbook] Generation started at', new Date().toISOString());

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
  const personalizationContext = serializePersonalizationData(personalizationData);
  console.log('[Generate-Guided-Playbook] ===== AGE CONTEXT =====');
  console.log('[Generate-Guided-Playbook] dateOfBirth received:', dateOfBirth ?? 'MISSING — age will be unknown');
  console.log('[Generate-Guided-Playbook] calculatedAge:', audienceContext.calculatedAge ?? 'null (could not calculate)');
  console.log('[Generate-Guided-Playbook] age prompt applied');
  if (audienceContext.languageHint) {
    console.log('[Generate-Guided-Playbook] language hint active');
  }
  console.log('[Generate-Guided-Playbook] ===== END AGE CONTEXT =====');

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
    const doctrinalVerdictRequired = /\b(iglesia ni cristo|inc|jehovah'?s witnesses|mormon|lds|unitarian)\b/i.test(effectiveUserInput)
      || (/\b(jesus|christ)\b/i.test(effectiveUserInput) && /\b(not god|isn'?t god|not divine|created being|only man|not acknowledge.*god|dont acknowledge.*god|don't acknowledge.*god)\b/i.test(effectiveUserInput));

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
      if (audienceContext.languageHint) {
        ctx += `${audienceContext.languageHint}\n`;
      }

      if (recentTitles.length > 0) {
        ctx += `\nTITLE UNIQUENESS: User already has: ${recentTitles.map(t => `"${t}"`).join(', ')}. Create a completely different title.\n`;
      }
      if (personalizationContext) {
        ctx += `\nUSER PROFILE CONTEXT: Use this lightly to shape complexity, tone, and practical fit. Do not quote or reveal this data.\n${personalizationContext}\n`;
      }
      if (doctrinalVerdictRequired) {
        ctx += `\nDOCTRINAL VERDICT OVERRIDE: This request involves core Christian doctrine. Do not write a generic doubt, opinions, or personal-journey response. In truth_summary, state plainly that denying Jesus is God contradicts Scripture and is not biblical Christianity. In the first paragraph of truth_in_love, directly answer the user's question before any comfort. If Iglesia ni Cristo is mentioned, specifically say Iglesia ni Cristo denies the biblical doctrine of Jesus' divinity. Use Scripture as the authority, not external voices or personal conviction. Do not tell the user they can remain in or hold to a belief system that denies Jesus is God. Do not say faith is mainly about relationship if the user's understanding of Jesus is not the biblical Jesus. faithful_actions must include comparing Iglesia ni Cristo's teaching with John 1:1, John 20:28, Colossians 2:9, Hebrews 1:8, and asking a biblically grounded pastor for help leaving false teaching if needed. The correct theological direction is: Jesus is God according to Scripture, and any teaching that denies this must be rejected.\n`;
      }
      ctx += `\nSUPPORT GUIDANCE: Use Christ-centered language only ("a pastor", "a biblical counselor", "a Christian counselor", "biblical community"). No phone numbers.\n`;

      return ctx;
    };

    // Build the full user message: context payload only (no few-shot examples).
    const buildUserMessage = (input: string): string => {
      const context = buildPlaybookUserContext(input);
      const separator = '\n---\n\nNow generate a playbook:\n\n';
      return separator + context;
    };

    let userMessage = buildUserMessage(effectiveUserInput);

    // OpenAI call helper — accepts optional message override for architectural retry
    async function callOpenAI(model: string, messageOverride?: string): Promise<Response> {
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
                  // 'developer' role is supported by GPT-4o family models
                  { role: 'developer', content: DEVELOPER_PROMPT },
                  { role: 'user', content: messageOverride ?? userMessage },
                ],
                ...(model === 'gpt-5-mini' ? {} : {
                  temperature: 0.5,
                  frequency_penalty: 0.5,
                  presence_penalty: 0.2,
                }),
                max_completion_tokens: 6000,
                response_format: {
                  type: 'json_schema',
                  json_schema: PLAYBOOK_JSON_SCHEMA,
                },
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

    let openAIRes = await callOpenAI('gpt-5-mini');

    if (!openAIRes.ok) {
      const errData = await openAIRes.json().catch(() => ({}));
      console.error('[Generate-Playbook] OpenAI HTTP error:', openAIRes.status, errData);
      throw new Error(errData?.error?.message || `OpenAI returned ${openAIRes.status}`);
    }

    let aiData = await openAIRes.json();
    let rawContent: string = aiData.choices?.[0]?.message?.content || '';

    const finishReason = aiData.choices?.[0]?.finish_reason;
    console.log('[Generate-Playbook] finish_reason:', finishReason);
    console.log('[Generate-Playbook] raw length:', rawContent.length, 'chars');
    console.log('[Generate-Playbook] ===== RAW JSON OUTPUT START =====');
    console.log(rawContent);
    console.log('[Generate-Playbook] ===== RAW JSON OUTPUT END =====');

    // Content filter: OpenAI truncates the JSON mid-generation.
    // Return error immediately instead of retrying to avoid long delays.
    if (finishReason === 'content_filter') {
      console.warn('[Generate-Playbook] Content filter triggered - returning error');
      return new Response(
        JSON.stringify({
          error: 'CONTENT_BLOCKED',
          message: 'This topic could not be processed. For personalized guidance on sensitive matters, we recommend speaking with a Christian counselor or pastor.',
          retryable: false,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      console.log('[Generate-Playbook] AI refused, attempting paraphrase retry...');

      effectiveUserInput = contentAnalysis.isVictimExperience
        ? paraphraseVictimExperience(userInput)
        : userInput
            .replace(/\b(i want to|i need to|i will)\s+(commit\s+)?suicide\b/gi, 'I am struggling with thoughts of ending my life')
            .replace(/\b(i want to|i need to|i will)\s+kill\s+myself\b/gi, 'I am having thoughts of self-harm')
            .replace(/\b(i want|i need|i will)\b/gi, 'I am thinking about')
            .replace(/\s+/g, ' ')
            .trim();

      userMessage = buildUserMessage(effectiveUserInput);

      let paraphrasedSuccess = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        openAIRes = await callOpenAI('gpt-5-mini');
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
              ? 'If you are in crisis, please reach out for immediate support. You are deeply loved by God, and your life has immeasurable value in Christ. Please contact a crisis helpline or a trusted Christian counselor.'
              : 'This topic could not be processed. For personalized guidance on sensitive matters, we recommend speaking with a Christian counselor or pastor.',
            alternatives: contentAnalysis.constructiveAlternatives,
            category: contentAnalysis.category,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate the JSON output — two-tier: hard failures + structural soft issues
    const { hardIssues, softIssues } = validatePlaybook(parsedJson!, effectiveUserInput);

    if (hardIssues.length > 0) {
      console.error('[Generate-Playbook] Hard validation failures:', hardIssues);
      const criticalFails = hardIssues.filter(i =>
        i.includes('playbook_title') || i.includes('generation failure')
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
        i.startsWith('truth_summary is too short') ||
        i.startsWith('transition_line is missing') ||
        i.startsWith('scripture_note_lines has') ||
        i.startsWith('bible_verse missing')
      );

      if (missingContentIssues.length > 0) {
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
        const completionRetryRes = await callOpenAI('gpt-5-mini', correctedMessage);

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

        const { hardIssues: retryHard } = validatePlaybook(mergedJson, effectiveUserInput);
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
            const patchRes = await callOpenAI('gpt-5-mini', patchMessage);

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

                  const { hardIssues: patchHard } = validatePlaybook(finalJson, effectiveUserInput);
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
      } else {
        // Remaining non-critical hard issues (e.g., minor length warnings on optional shapes)
        console.warn('[Generate-Playbook] Non-critical hard issues (continuing):', hardIssues);
      }
    }

    if (softIssues.length > 0) {
      console.warn('[Generate-Playbook] Structural soft issues:', softIssues);
    }

    // Retry-on-weak-structure: if structural issues detected, retry once with an explicit
    // architectural correction injected into the user message.
    const architecturalIssues = softIssues.filter(i =>
      i.includes('Action sequence drift') ||
      i.includes('Abstraction drift')
    );

    if (architecturalIssues.length > 0) {
      console.log('[Generate-Playbook] Architectural drift detected — retrying with correction:', architecturalIssues);

      const correctionNote = [
        '\nARCHITECTURAL CORRECTION — the previous attempt failed these checks:',
        ...architecturalIssues.map(i => `  - ${i}`),
        'Fix these structural issues:',
        '  faithful_actions must be 3-7 specific, concrete steps — not a list of tips.',
        '  Do not use: ' + DRIFT_PHRASES.slice(0, 5).join(', ') + '.',
      ].join('\n');

      const correctedMessage = userMessage + correctionNote;

      const retryRes = await callOpenAI('gpt-5-mini', correctedMessage);
      if (retryRes.ok) {
        const retryData = await retryRes.json();
        const retryContent: string = retryData.choices?.[0]?.message?.content || '';
        try {
          const retryJson = JSON.parse(retryContent);
          if (!isRefusal(retryJson)) {
            const { hardIssues: retryHard } = validatePlaybook(retryJson, effectiveUserInput);
            if (retryHard.filter(i => i.includes('generation failure')).length === 0) {
              console.log('[Generate-Playbook] Architectural retry succeeded');
              parsedJson = retryJson;
            } else {
              console.warn('[Generate-Playbook] Architectural retry also has issues — using original');
            }
          }
        } catch {
          console.warn('[Generate-Playbook] Architectural retry parse failed — using original');
        }
      }
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

    // Enforce exact bible verse text from our verse database (non-blocking)
    // Don't await this - let it complete in background to avoid slowing down response
    enforcePlaybookBibleVerse(playbook, preferredBibleVersion).catch(error => {
      console.error('[Playbook] Bible verse enforcement failed in background:', error);
    });

    playbook.totalTasks = playbook.actionSteps.length;
    playbook.progress = 0;

    const generationDuration = Date.now() - generationStartTime;
    console.log(`[Generate-Playbook] Generation completed in ${generationDuration}ms (${(generationDuration / 1000).toFixed(2)}s)`);

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
        retryable: true,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

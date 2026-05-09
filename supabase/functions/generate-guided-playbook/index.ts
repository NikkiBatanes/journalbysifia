/** @deno-types="https://deno.land/x/types/http/server.d.ts" */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { DEVELOPER_PROMPT, FEW_SHOT_EXAMPLES } from './persona.config.ts';
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
      // 3–7 steps — enforced in validation + prompt
      faithful_actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            body: { type: 'string' },
            primary_button: { type: 'string' },
            secondary_button: { type: 'string' },
          },
          required: ['title', 'body', 'primary_button', 'secondary_button'],
          additionalProperties: false,
        },
      },
      prayer: { type: 'string' },
      // 4–5 lines — enforced in validation + prompt
      words_to_speak: {
        type: 'array',
        items: { type: 'string' },
      },
      // Structured object: separates reflective question from closing imperatives
      completion: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          lines: {
            type: 'array',
            items: { type: 'string' },
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
    .replace(/\*\*|__|\*/g, '')
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
  isTeenUser: boolean;
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
    return {
      calculatedAge,
      ageSource: 'dateOfBirth',
      isTeenUser: calculatedAge <= 17,
      promptLine: `AUDIENCE CONTEXT: User is exactly ${calculatedAge} years old, calculated from their birthday. Tailor examples, tone, and action scale to this exact age. Do not generalize beyond the exact age, and do not mention the age unless it directly matters.`,
    };
  }

  return {
    calculatedAge: null,
    ageSource: 'unknown',
    isTeenUser: false,
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

// Count sentences in a string (splits on . ? ! followed by space or end)
function countSentences(text: string): number {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  const matches = cleaned.match(/[^.!?]*[.!?](\s|$)/g);
  return matches ? matches.filter(s => s.trim().length > 2).length : 0;
}

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

const OVERUSED_NAVIGATION_REGEX = /\bnavigat(?:e|es|ed|ing|ion|ional)\b/i;

// Weak action verbs — if the majority of action titles use these, the sequence is too soft
const SOFT_ACTION_VERBS = ['reflect', 'consider', 'practice', 'remember', 'think', 'meditate', 'embrace', 'allow', 'accept'];
const SHARP_ACTION_VERBS = ['name', 'separate', 'stop', 'write', 'ask', 'say', 'face', 'choose', 'refuse', 'tell', 'confront', 'cut', 'bring', 'identify', 'commit'];
const RELATIONAL_WOUND_REGEX = /\b(sister|sisters|sibling|family|mother'?s day|birthday|overlooked|ignored|left out|not speaking|not in speaking terms|reaches out|hurt by|feel.*hurt|felt.*hurt)\b/i;
const HEART_DIAGNOSIS_REGEX = /\b(worth|value|valued|seen|noticed|chosen|belong|approval|idol|idolatry|demand|prove|punish|punishment|retaliat|bitterness|bitter|scorekeeping|score[- ]keeping|self-protection|self protection|pride|envy|motherhood|children|overlooked)\b/i;
const UNIVERSAL_HEART_DIAGNOSIS_REGEX = /\b(heart|worth|value|identity|fear|afraid|control|approval|idol|idolatry|worship|trust|unbelief|self-protection|self protection|pride|envy|bitterness|bitter|shame|despair|avoidance|avoid|withdraw|demand|prove|protect|retaliat|repent|repentance|forgiveness|stewardship|misplaced|false conclusion|lie|distortion|desire|too weighty|verdict|security|belong|approval|fear of man|people-pleasing|self-reliance)\b/i;

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
  if (!json.truth_summary || String(json.truth_summary).length < 80) {
    hardIssues.push(`truth_summary is too short (${String(json.truth_summary || '').length} chars, min 80)`);
  }
  if (!json.truth_in_love || String(json.truth_in_love).length < 200) {
    hardIssues.push(`truth_in_love is too short (${String(json.truth_in_love || '').length} chars, min 200)`);
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

  // truth_summary must be exactly 4 sentences
  if (json.truth_summary) {
    const sentenceCount = countSentences(String(json.truth_summary));
    if (sentenceCount < 3 || sentenceCount > 5) {
      softIssues.push(`truth_summary has ${sentenceCount} sentences (expected exactly 4: ache, burden, correction, stabilizing truth)`);
    }
  }

  // truth_in_love must be exactly 4 paragraphs (5 allowed with hard landing)
  if (json.truth_in_love) {
    const truthText = String(json.truth_in_love);
    const paraCount = countParagraphs(String(json.truth_in_love));
    if (paraCount < 3) {
      softIssues.push(`truth_in_love has ${paraCount} paragraphs (expected 4: diagnosis, distinction, correction, direction)`);
    } else if (paraCount > 5) {
      softIssues.push(`truth_in_love has ${paraCount} paragraphs (max 5 — model may have drifted into essay mode)`);
    }
    if (truthText.length < 650) {
      softIssues.push(`truth_in_love lacks depth (${truthText.length} chars, expected at least 650 for pastoral diagnosis)`);
    }
    if (!UNIVERSAL_HEART_DIAGNOSIS_REGEX.test(truthText)) {
      softIssues.push('truth_in_love lacks explicit heart-condition diagnosis — name what is being loved, feared, protected, demanded, trusted, avoided, or used for worth');
    }
    if (RELATIONAL_WOUND_REGEX.test(originalInput) && !HEART_DIAGNOSIS_REGEX.test(truthText)) {
      softIssues.push('Relational wound lacks heart-level diagnosis — name worth, being seen, approval, bitterness, retaliation, idolatry, or self-protection where appropriate');
    }
  }

  // Abstraction drift — flag forbidden phrases
  const allText = JSON.stringify(json).toLowerCase();
  const driftFound = DRIFT_PHRASES.filter(p => allText.includes(p));
  if (driftFound.length > 0) {
    softIssues.push(`Abstraction drift detected — forbidden phrases: ${driftFound.join(', ')}`);
  }
  if (OVERUSED_NAVIGATION_REGEX.test(allText)) {
    softIssues.push('Overused navigation language detected — replace every form of "navigate" with a more specific verb');
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
  const playbook: Playbook = {
    id: generateUUID(),
    title: cleanMarkdown(json.playbook_title || ''),
    subtitle: '',
    category: json.category || 'Growth',
    truthInLove: {
      summary: stripRepeatedName(cleanMarkdown(json.truth_summary || ''), userName),
      text: stripAllName(cleanMarkdown(json.truth_in_love || ''), userName),
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
        const question = String(c.question || '').trim();
        const lines = Array.isArray(c.lines)
          ? c.lines.filter((l: any) => typeof l === 'string' && l.trim().length > 0)
          : [];
        return `Before you close:\n${question}${lines.length > 0 ? '\n\n' + lines.join('\n') : ''}`;
      }
      // fallback for unexpected string (schema change race condition)
      return String(c || '');
    })(),
    prayer: stripAllName(cleanMarkdown(json.prayer || ''), userName),
    transitionLine: json.transition_line || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userInput,
    progress: 0,
    totalTasks: 0,
  };

  // Map faithful_actions → ActionStep[]
  const actions = Array.isArray(json.faithful_actions) ? json.faithful_actions : [];
  playbook.actionSteps = actions.map((action: any, idx: number) => {
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
  const isTeenUser = audienceContext.isTeenUser;
  const personalizationContext = serializePersonalizationData(personalizationData);
  console.log('[Generate-Guided-Playbook] ===== AGE CONTEXT =====');
  console.log('[Generate-Guided-Playbook] dateOfBirth received:', dateOfBirth ?? 'MISSING — age will be unknown');
  console.log('[Generate-Guided-Playbook] calculatedAge:', audienceContext.calculatedAge ?? 'null (could not calculate)');
  console.log('[Generate-Guided-Playbook] isTeenUser:', isTeenUser);
  console.log('[Generate-Guided-Playbook] promptLine injected:', audienceContext.promptLine);
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

      if (recentTitles.length > 0) {
        ctx += `\nTITLE UNIQUENESS: User already has: ${recentTitles.map(t => `"${t}"`).join(', ')}. Create a completely different title.\n`;
      }
      if (personalizationContext) {
        ctx += `\nUSER PROFILE CONTEXT: Use this lightly to shape complexity, tone, and practical fit. Do not quote or reveal this data.\n${personalizationContext}\n`;
      }
      if (isTeenUser) {
        ctx += `\nLANGUAGE FIT: User is exactly ${audienceContext.calculatedAge} and under 18. Use simple clear language, shorter sentences, and age-appropriate action steps. Avoid complex theological terms unless briefly explained.\n`;
      }
      if (doctrinalVerdictRequired) {
        ctx += `\nDOCTRINAL VERDICT OVERRIDE: This request involves core Christian doctrine. Do not write a generic doubt, opinions, or personal-journey response. In truth_summary, state plainly that denying Jesus is God contradicts Scripture and is not biblical Christianity. In the first paragraph of truth_in_love, directly answer the user's question before any comfort. If Iglesia ni Cristo is mentioned, specifically say Iglesia ni Cristo denies the biblical doctrine of Jesus' divinity. Use Scripture as the authority, not external voices or personal conviction. Do not tell the user they can remain in or hold to a belief system that denies Jesus is God. Do not say faith is mainly about relationship if the user's understanding of Jesus is not the biblical Jesus. faithful_actions must include comparing Iglesia ni Cristo's teaching with John 1:1, John 20:28, Colossians 2:9, Hebrews 1:8, and asking a biblically grounded pastor for help leaving false teaching if needed. The correct theological direction is: Jesus is God according to Scripture, and any teaching that denies this must be rejected.\n`;
      }
      ctx += `\nSUPPORT GUIDANCE: Use Christ-centered language only ("a pastor", "a biblical counselor", "a Christian counselor", "biblical community"). No phone numbers.\n`;

      return ctx;
    };

    // Build the full user message: examples first, then the context payload.
    // Do NOT blindly truncate the assembled message — trim examples first if needed.
    const buildUserMessage = (input: string): string => {
      const context = buildPlaybookUserContext(input);
      const separator = '\n---\n\nNow generate a playbook:\n\n';

      // If examples + context would exceed a safe token budget, drop to 2 examples
      const fullMsg = FEW_SHOT_EXAMPLES + separator + context;
      if (fullMsg.length <= 14000) return fullMsg;

      // Trim: take only the first two examples (up to the third "---" separator)
      const parts = FEW_SHOT_EXAMPLES.split('\n---\n');
      const trimmedExamples = parts.slice(0, 3).join('\n---\n'); // intro + ex1 + ex2
      return trimmedExamples + separator + context;
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
                temperature: 0.3,
                max_tokens: 6000,
                frequency_penalty: 0.1,
                presence_penalty: 0.1,
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

    let openAIRes = await callOpenAI('gpt-4o-mini');

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
    // Retry once with softened phrasing before giving up.
    if (finishReason === 'content_filter') {
      console.warn('[Generate-Playbook] Content filter triggered — retrying with neutral phrasing');
      const softenedInput = effectiveUserInput
        .replace(/\b(lying|lie|lied|liar|lies)\b/gi, 'struggling with honesty')
        .replace(/\b(stealing|steal|stole|theft)\b/gi, 'struggling with taking what is not mine')
        .replace(/\b(cheating|cheat|cheated)\b/gi, 'struggling with faithfulness')
        .replace(/\b(hurting|hitting|hit)\s+(him|her|them|my|someone)\b/gi, 'struggling in this relationship')
        .trim();
      userMessage = buildUserMessage(softenedInput);
      const filterRetryRes = await callOpenAI('gpt-4o-mini');
      if (!filterRetryRes.ok) {
        throw new Error(`OpenAI returned ${filterRetryRes.status} on content filter retry`);
      }
      aiData = await filterRetryRes.json();
      rawContent = aiData.choices?.[0]?.message?.content || '';
      const retryFinishReason = aiData.choices?.[0]?.finish_reason;
      console.log('[Generate-Playbook] Content filter retry finish_reason:', retryFinishReason);
      if (retryFinishReason === 'content_filter') {
        return new Response(
          JSON.stringify({
            error: 'CONTENT_BLOCKED',
            message: 'This topic could not be processed. For personalized guidance on sensitive matters, we recommend speaking with a Christian counselor or pastor.',
            retryable: false,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Parse JSON from structured output
    let parsedJson: Record<string, any>;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch (parseErr) {
      console.error('[Generate-Playbook] JSON parse failed:', parseErr, 'raw:', rawContent.substring(0, 500));
      throw new Error('AI returned malformed JSON. Please try again.');
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
        openAIRes = await callOpenAI('gpt-4o-mini');
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
      // Non-critical hard issues: log but continue (length issues, missing minor fields)
      console.warn('[Generate-Playbook] Non-critical hard issues (continuing):', hardIssues);
    }

    if (softIssues.length > 0) {
      console.warn('[Generate-Playbook] Structural soft issues:', softIssues);
    }

    // Retry-on-weak-structure: if structural issues detected, retry once with an explicit
    // architectural correction injected into the user message.
    const architecturalIssues = softIssues.filter(i =>
      i.includes('sentences') ||
      i.includes('paragraphs') ||
      i.includes('lacks depth') ||
      i.includes('heart-condition diagnosis') ||
      i.includes('heart-level diagnosis') ||
      i.includes('Action sequence drift') ||
      i.includes('Abstraction drift') ||
      i.includes('Overused navigation language')
    );

    if (architecturalIssues.length > 0) {
      console.log('[Generate-Playbook] Architectural drift detected — retrying with correction:', architecturalIssues);

      const correctionNote = [
        '\nARCHITECTURAL CORRECTION — the previous attempt failed these checks:',
        ...architecturalIssues.map(i => `  - ${i}`),
        'Follow the DISCERNMENT PATTERN structure exactly:',
        '  truth_summary must be exactly 4 sentences (S1 ache, S2 burden, S3 correction, S4 stabilizing truth).',
        '  truth_in_love must be exactly 4 paragraphs (P1 diagnosis, P2 distinction, P3 correction, P4 direction).',
        '  Every truth_in_love must include a heart-condition diagnosis: what is being loved, feared, protected, demanded, avoided, trusted, or used for worth? Use biblical categories such as idolatry, fear of man, control, unbelief, misplaced identity, bitterness, pride, shame, repentance, trust, endurance, stewardship, forgiveness, or love.',
        '  If this is a family or relational wound, truth_in_love must diagnose the heart-level issue beneath the conflict, such as worth anchored in being noticed, family approval, retaliation, bitterness, self-protection, or idolatry of being seen. Do not stop at "reach out with grace."',
        '  faithful_actions must follow the A1→A2→A3→A4+→Final sequence — not a list of tips.',
        '  Do not use: ' + DRIFT_PHRASES.slice(0, 5).join(', ') + '.',
        '  Do not use any form of "navigate" or "navigation"; choose a concrete verb like face, discern, obey, endure, confront, or rebuild.',
      ].join('\n');

      const correctedMessage = userMessage + correctionNote;

      const retryRes = await callOpenAI('gpt-4o-mini', correctedMessage);
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
        retryable: true,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

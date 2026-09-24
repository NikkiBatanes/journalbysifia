import {
  getGenericInlineBlockDefinitions,
  getNoteBlockDefinitionsForContext,
  type JournalBlockKindForContext,
} from '../components/journal/shared/noteBlockRegistry';
import type {JournalBlock} from '../components/journal/shared/journalBlocks';

export const GUIDED_REFLECTION_FORMAT = 'guided_reflection_v1' as const;

export type GuidedInteractionType = 'write' | 'single_select' | 'multi_select' | 'paired_write' | 'options' | 'scripture_reflection';
export type GuidedNoteKind = JournalBlockKindForContext<'reflection'>;

export interface GuidedReflectionNote extends Omit<JournalBlock, 'kind'> {
  kind: GuidedNoteKind;
  anchorId?: string;
}

export interface GuidedReflectionStepDefinition {
  id: string;
  eyebrow: string;
  prompt: string;
  interactionType: GuidedInteractionType;
  options?: readonly string[];
  scripture?: { reference: string; question: string };
  fields?: ReadonlyArray<{ id: string; label: string; prompt?: string }>;
  optionalWrite?: { label: string; prompt: string };
  allowNotes?: boolean;
  required?: boolean;
}

export interface GuidedReflectionPath {
  id: string;
  title: string;
  description: string;
  steps: readonly GuidedReflectionStepDefinition[];
}

export interface GuidedStepAnswer {
  stepId: string;
  selected?: string[];
  text?: string;
  optionalText?: string;
  fields?: Record<string, string>;
  notes: GuidedReflectionNote[];
}

export interface GuidedReflectionPayload {
  format: typeof GUIDED_REFLECTION_FORMAT;
  pathId: string;
  pathTitle: string;
  /** Optional journal-facing title; pathTitle always retains the authored path name. */
  entryTitle?: string;
  currentStepId: string;
  stoppedAtStepId?: string;
  completed: boolean;
  answers: GuidedStepAnswer[];
}

export const GUIDED_NOTE_TYPES: ReadonlyArray<{
  kind: Exclude<GuidedNoteKind, 'text'>;
  label: string;
  icon: string;
}> = getGenericInlineBlockDefinitions().map(definition => ({
  kind: definition.kind as Exclude<GuidedNoteKind, 'text'>,
  label: definition.pickerLabel,
  icon: definition.icon,
}));

export const REFLECTION_NOTE_TYPES: ReadonlyArray<{
  kind: GuidedNoteKind;
  label: string;
  icon: string;
  iconFamily?: 'Ionicons' | 'MaterialCommunityIcons';
}> = getNoteBlockDefinitionsForContext('reflection').map(definition => ({
  kind: definition.kind as Exclude<GuidedNoteKind, 'text'>,
  label: definition.pickerLabel,
  icon: definition.icon,
  ...(definition.iconFamily ? {iconFamily: definition.iconFamily} : {}),
}));

export const createGuidedNoteId = (): string => `guided-note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const emptyGuidedAnswer = (stepId: string): GuidedStepAnswer => ({ stepId, notes: [] });

export const serializeGuidedReflection = (payload: GuidedReflectionPayload): string => JSON.stringify(payload);

export const parseGuidedReflection = (content: unknown): GuidedReflectionPayload | null => {
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return parsed && parsed.format === GUIDED_REFLECTION_FORMAT && Array.isArray(parsed.answers) ? parsed as GuidedReflectionPayload : null;
  } catch {
    return null;
  }
};

/**
 * Builds the compact written-response preview used by Moments. Note-block text
 * is intentionally excluded because those blocks are rendered separately.
 */
export const guidedReflectionAnswerPreview = (content: unknown): string => {
  const journey = parseGuidedReflection(content);
  if (!journey) {
    return typeof content === 'string' ? content.trim() : '';
  }

  return journey.answers
    .flatMap(answer => [
      answer.text,
      answer.optionalText,
      ...Object.values(answer.fields || {}),
    ])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(value => value.trim())
    .join(' · ');
};

export type GuidedEntryKind = 'prompt' | 'reflection';

type GuidedEntryIdentity = {
  type?: unknown;
  source?: unknown;
  content?: unknown;
  prompt?: unknown;
  question_topic?: unknown;
  guided_journey?: unknown;
  metadata?: Record<string, unknown>;
};

/**
 * Guided Prompts and Guided Reflections share the historical `guided` type.
 * Their source is the canonical discriminator. Prompt/topic fields recover
 * question-based entries that older editor flows incorrectly saved with the
 * generic `guided` source. A missing source with plain content is treated as
 * a Guided Prompt for records saved by the legacy prompt modal.
 */
export const guidedEntryKind = (
  entry: GuidedEntryIdentity | null | undefined,
): GuidedEntryKind | null => {
  if (!entry) {return null;}
  const source = typeof entry.source === 'string' ? entry.source : '';
  const metadata = entry.metadata || {};
  const structuredJourney = entry.guided_journey
    || metadata.guidedJourney
    || metadata.guided_journey
    || parseGuidedReflection(entry.content);
  const hasPromptIdentity = Boolean(
    entry.prompt
      || entry.question_topic
      || metadata.prompt
      || metadata.questionTopic
      || metadata.question_topic,
  );

  if (structuredJourney) {return 'reflection';}
  if (source === 'guided_prompt') {return 'prompt';}
  if (source === 'guided' && hasPromptIdentity) {return 'prompt';}
  if (source === 'guided') {return 'reflection';}
  return entry.type === 'guided' ? 'prompt' : null;
};

export const guidedEntrySource = (
  entry: GuidedEntryIdentity | null | undefined,
): 'guided_prompt' | 'guided' | undefined => {
  const kind = guidedEntryKind(entry);
  return kind === 'prompt'
    ? 'guided_prompt'
    : kind === 'reflection'
      ? 'guided'
      : undefined;
};

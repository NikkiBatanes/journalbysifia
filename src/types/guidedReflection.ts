export const GUIDED_REFLECTION_FORMAT = 'guided_reflection_v1' as const;

export type GuidedInteractionType = 'write' | 'single_select' | 'multi_select' | 'paired_write' | 'options' | 'scripture_reflection';
export type GuidedNoteKind = 'text' | 'scripture' | 'quote' | 'key' | 'remember' | 'question' | 'response';

export interface GuidedReflectionNote {
  id: string;
  kind: GuidedNoteKind;
  text: string;
  reference?: string;
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
  currentStepId: string;
  stoppedAtStepId?: string;
  completed: boolean;
  answers: GuidedStepAnswer[];
}

export const GUIDED_NOTE_TYPES: ReadonlyArray<{ kind: GuidedNoteKind; label: string; icon: string }> = [
  { kind: 'text', label: 'Note', icon: 'document-text-outline' },
  { kind: 'scripture', label: 'Scripture', icon: 'book-outline' },
  { kind: 'quote', label: 'Quote', icon: 'chatbox-outline' },
  { kind: 'key', label: 'Key Point', icon: 'star-outline' },
  { kind: 'remember', label: 'Remember', icon: 'heart-outline' },
  { kind: 'question', label: 'Question', icon: 'help-circle-outline' },
  { kind: 'response', label: 'Response', icon: 'arrow-forward-outline' },
];

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

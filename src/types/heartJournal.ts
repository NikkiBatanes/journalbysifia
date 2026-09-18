export const HEART_JOURNAL_CLASSIFICATIONS = [
  { value: 'thoughts', label: 'Thoughts', description: 'On my mind' },
  { value: 'notes', label: 'Notes', description: 'Keep something' },
  { value: 'reflection', label: 'Reflection', description: 'Process it' },
  { value: 'brain_dump', label: 'Brain Dump', description: 'Clear my head' },
  { value: 'lesson', label: 'Lesson', description: "I'm learning" },
  { value: 'idea', label: 'Idea', description: 'Explore this' },
  { value: 'letter', label: 'Letter', description: 'Something I want to say' },
  { value: 'other', label: 'Other', description: 'Name your own' },
] as const;

type BuiltInHeartJournalClassification = typeof HEART_JOURNAL_CLASSIFICATIONS[number]['value'];
export type HeartJournalClassification = BuiltInHeartJournalClassification | `other:${string}`;

export const heartJournalClassificationLabel = (value: unknown): string | null => {
  if (typeof value === 'string' && value.startsWith('other:')) {
    return value.slice('other:'.length).trim() || 'Other';
  }
  return HEART_JOURNAL_CLASSIFICATIONS.find(item => item.value === value)?.label ?? null;
};

export const HEART_JOURNAL_WRITING_COPY: Record<BuiltInHeartJournalClassification, { title: string; body: string }> = {
  thoughts: { title: 'Name this thought...', body: "What's on your mind?" },
  notes: { title: 'Add a title...', body: 'What do you want to keep?' },
  reflection: { title: 'Name your reflection...', body: 'Take your time. What are you processing?' },
  brain_dump: { title: "What's filling your head?", body: "Get it all out. It doesn't have to be organized." },
  lesson: { title: 'What are you learning?', body: "Write down what you're beginning to see..." },
  idea: { title: 'Name your idea...', body: 'Explore it here...' },
  letter: { title: 'Who or what is this for?', body: 'Write what you want to say...' },
  other: { title: 'Name this entry...', body: "What's on your heart?" },
};

export const heartJournalWritingCopy = (value: HeartJournalClassification) =>
  value.startsWith('other:')
    ? HEART_JOURNAL_WRITING_COPY.other
    : HEART_JOURNAL_WRITING_COPY[value as BuiltInHeartJournalClassification];

export const HEART_JOURNAL_CLASSIFICATIONS = [
  { value: 'thoughts', label: 'Thoughts', description: 'On my mind' },
  { value: 'notes', label: 'Notes', description: 'Keep something' },
  { value: 'reflection', label: 'Reflection', description: 'Process it' },
  { value: 'brain_dump', label: 'Brain Dump', description: 'Clear my head' },
  { value: 'lesson', label: 'Lesson', description: "I'm learning" },
  { value: 'idea', label: 'Idea', description: 'Explore this' },
  { value: 'letter', label: 'Letter', description: 'Something I want to say' },
] as const;

export type HeartJournalClassification = typeof HEART_JOURNAL_CLASSIFICATIONS[number]['value'];

export const heartJournalClassificationLabel = (value: unknown): string | null =>
  HEART_JOURNAL_CLASSIFICATIONS.find(item => item.value === value)?.label ?? null;

export const HEART_JOURNAL_WRITING_COPY: Record<HeartJournalClassification, { title: string; body: string }> = {
  thoughts: { title: 'Name this thought...', body: "What's on your mind?" },
  notes: { title: 'Add a title...', body: 'What do you want to keep?' },
  reflection: { title: 'Name your reflection...', body: 'Take your time. What are you processing?' },
  brain_dump: { title: "What's filling your head?", body: "Get it all out. It doesn't have to be organized." },
  lesson: { title: 'What are you learning?', body: "Write down what you're beginning to see..." },
  idea: { title: 'Name your idea...', body: 'Explore it here...' },
  letter: { title: 'Who or what is this for?', body: 'Write what you want to say...' },
};

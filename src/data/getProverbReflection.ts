import reflections from './proverbReflections.json';

export interface ProverbInsight {
  id: string;
  label: string;
  verses: string;
  prompt: string;
}

// Labels summarize the cited passages; they are not Bible quotations.
// Wisdom sayings describe wise living, not unconditional promises of outcomes.
export const getProverbReflection = (chapter: number) =>
  reflections.find(reflection => reflection.chapter === chapter);

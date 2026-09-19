import {CURATED_GUIDED_QUESTIONS} from '../components/journal/reflectionConstants';

export const GUIDED_QUESTION_TOPICS = [
  'With God', 'My Heart', 'Relationships', 'Decisions', 'Growth', 'Work & Gifts',
  'Finances', 'Business', 'Home', 'Family', 'Health', 'Rest & Rhythms',
] as const;
export type GuidedQuestionTopic = typeof GUIDED_QUESTION_TOPICS[number];

export const GUIDED_QUESTION_LIBRARY = CURATED_GUIDED_QUESTIONS.map((question, index) => ({
  id: `curated-question-${index + 1}`,
  prompt: question.prompt,
  topic: question.topic as GuidedQuestionTopic,
}));

export const questionsForTopic = (topic: GuidedQuestionTopic) => GUIDED_QUESTION_LIBRARY.filter(question => question.topic === topic);

import { GUIDED_PROMPTS } from '../components/journal/reflectionConstants';

export const GUIDED_QUESTION_TOPICS = ['With God', 'My Heart', 'Relationships', 'Decisions', 'Growth', 'Work & Gifts'] as const;
export type GuidedQuestionTopic = typeof GUIDED_QUESTION_TOPICS[number];

const topics: GuidedQuestionTopic[] = ['Decisions', 'Relationships', 'My Heart', 'With God', 'Work & Gifts', 'Growth', 'Relationships', 'With God', 'Work & Gifts', 'My Heart', 'Growth', 'Work & Gifts', 'Work & Gifts', 'Relationships', 'Growth', 'My Heart'];

export const GUIDED_QUESTION_LIBRARY = GUIDED_PROMPTS.map((prompt, index) => ({ id: `legacy-question-${index + 1}`, prompt, topic: topics[index] }));

export const questionsForTopic = (topic: GuidedQuestionTopic) => GUIDED_QUESTION_LIBRARY.filter(question => question.topic === topic);

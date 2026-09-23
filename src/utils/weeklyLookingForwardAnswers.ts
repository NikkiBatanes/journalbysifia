import {LOOKING_FORWARD_EMOTIONS} from '../data/lookingForwardEmotions';

export const WEEKLY_LOOKING_FORWARD_TITLE = 'Looking forward to this week';

export const isWeeklyLookingForwardAnswerKey = (key: string): boolean =>
  ['week_looking_forward', 'week_looking_forward_emotion', 'week_looking_forward_other'].includes(key);

export const getWeeklyLookingForwardEmotion = (answers: Record<string, string>) =>
  LOOKING_FORWARD_EMOTIONS.find(emotion => emotion.id === answers.week_looking_forward_emotion) ?? null;

export const getWeeklyLookingForwardContent = (answers: Record<string, string>) => {
  const emotion = getWeeklyLookingForwardEmotion(answers);
  const customEmotion = emotion?.id === 'other' ? answers.week_looking_forward_other?.trim() ?? '' : '';
  return {
    title: WEEKLY_LOOKING_FORWARD_TITLE,
    entry: {text: answers.week_looking_forward?.trim() ?? ''},
    emotionId: emotion?.id ?? '',
    emotionIcon: emotion?.icon ?? '',
    emotionName: emotion?.id === 'other' ? customEmotion : emotion?.name ?? '',
    customEmotion,
  };
};

export const formatWeeklyLookingForwardAnswer = (answers: Record<string, string>): string => {
  const content = getWeeklyLookingForwardContent(answers);
  return [content.entry.text, content.emotionName ? `How you’re holding it: ${content.emotionName}` : '']
    .filter(Boolean).join('\n\n');
};

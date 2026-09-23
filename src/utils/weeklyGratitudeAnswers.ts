const EXTRA_ANSWER_PREFIX = 'weekly_gratitude_';

export const weeklyGratitudeAnswerKey = (index: number): string =>
  index === 0 ? 'notice' : `${EXTRA_ANSWER_PREFIX}${index + 1}`;

export const isWeeklyGratitudeAnswerKey = (key: string): boolean =>
  key === 'notice' || new RegExp(`^${EXTRA_ANSWER_PREFIX}\\d+$`).test(key);

export const getWeeklyGratitudeInputCount = (
  answers: Record<string, string>,
): number => {
  const highestSavedIndex = Object.keys(answers).reduce((highest, key) => {
    if (!answers[key]?.trim()) {return highest;}
    if (key === 'notice') {return Math.max(highest, 1);}
    const match = key.match(new RegExp(`^${EXTRA_ANSWER_PREFIX}(\\d+)$`));
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return Math.max(1, highestSavedIndex);
};

export const getWeeklyGratitudeItems = (
  answers: Record<string, string>,
): string[] => Array.from(
  {length: getWeeklyGratitudeInputCount(answers)},
  (_, index) => answers[weeklyGratitudeAnswerKey(index)]?.trim() || '',
).filter(Boolean);

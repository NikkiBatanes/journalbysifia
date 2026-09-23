import {WEEKLY_CHALLENGE_OPTIONS, WEEKLY_CHALLENGE_SUGGESTED_KEYS, type WeeklyChallengeKey} from '../data/weeklyChallengeOptions';

export const getWeeklyChallengeChoices = (answers: Record<string, string>) => {
  const selected = new Set((answers.week_challenge_choices ?? '').split('|'));
  if (answers.week_challenge_choices === undefined && answers.watch_for?.trim()) {
    selected.add('other');
  }
  return WEEKLY_CHALLENGE_OPTIONS.filter(option => selected.has(option.key));
};

export const getWeeklyChallengeOptions = (answers: Record<string, string>) => {
  const selected = new Set(getWeeklyChallengeChoices(answers).map(option => option.key));
  return WEEKLY_CHALLENGE_OPTIONS.filter(option =>
    WEEKLY_CHALLENGE_SUGGESTED_KEYS.includes(option.key) || selected.has(option.key),
  );
};

export const toggleWeeklyChallengeChoice = (
  answers: Record<string, string>,
  key: WeeklyChallengeKey,
): string => {
  const selected = new Set(getWeeklyChallengeChoices(answers).map(option => option.key));
  if (selected.has(key)) {selected.delete(key);} else {selected.add(key);}
  return WEEKLY_CHALLENGE_OPTIONS.filter(option => selected.has(option.key))
    .map(option => option.key).join('|');
};

export const formatWeeklyChallengeAnswer = (answers: Record<string, string>): string =>
  getWeeklyChallengeChoices(answers).map(option => {
    const text = option.key === 'other' ? answers.watch_for?.trim() : '';
    return `• ${text || option.label}`;
  }).join('\n');

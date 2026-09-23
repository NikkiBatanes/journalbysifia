import {WEEKLY_SUPPORT_OPTIONS} from '../data/weeklySupportOptions';
import {formatWeeklyCareAnswer} from './weeklyLifeAreaAnswers';
import {formatWeeklyChallengeAnswer} from './weeklyChallengeAnswers';
import {formatWeeklyLookingForwardAnswer, WEEKLY_LOOKING_FORWARD_TITLE} from './weeklyLookingForwardAnswers';

export const getWeeklySupportChoices = (answers: Record<string, string>) => {
  const selected = new Set((answers.week_support_choices ?? '').split('|'));
  return WEEKLY_SUPPORT_OPTIONS.filter(option => selected.has(option.key));
};

export const formatWeeklySupportAnswer = (answers: Record<string, string>): string => {
  const note = answers.prayer_ahead?.trim();
  const choices = getWeeklySupportChoices(answers)
    .filter(option => option.key !== 'other' || !note)
    .map(option => `• ${option.label}`).join('\n');
  return [choices, note].filter(Boolean).join('\n\n');
};

export const getWeeklyLookingAheadSummary = (answers: Record<string, string>) => [
  {
    key: 'priority', stageKey: 'priority', title: 'What matters most',
    value: ['priority_1', 'priority_2', 'priority_3'].map(key => answers[key]?.trim())
      .filter(Boolean).map(value => `• ${value}`).join('\n'),
  },
  {key: 'dont_forget', stageKey: 'dont_forget', title: 'What needs care', value: formatWeeklyCareAnswer(answers)},
  {key: 'watch_for', stageKey: 'watch_for', title: 'What to be mindful of', value: formatWeeklyChallengeAnswer(answers)},
  {key: 'looking_forward', stageKey: 'looking_forward_feeling', title: WEEKLY_LOOKING_FORWARD_TITLE, value: formatWeeklyLookingForwardAnswer(answers)},
  {key: 'prayer_ahead', stageKey: 'prayer_ahead', title: 'Your prayer for the week', value: formatWeeklySupportAnswer(answers)},
].filter(section => section.value);

// Removed questions remain readable in older reviews; their answers are never rewritten.
export const getLegacyWeeklyLookingAheadSections = (answers: Record<string, string>) => [
  {key: 'people', title: 'Who do you want to make room for in the week ahead?'},
  {key: 'rest', title: 'Where will you make room to rest?'},
  {key: 'faithful_step', title: 'What is one faithful step you want to take in the week ahead?'},
].flatMap(section => {
  const value = answers[section.key]?.trim();
  return value ? [{...section, value}] : [];
});

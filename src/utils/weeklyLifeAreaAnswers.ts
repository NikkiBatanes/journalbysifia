import {WEEKLY_CARE_AREAS, WEEKLY_LIFE_AREAS} from '../data/weeklyLifeAreas';

export const getWeeklyCareAreas = (answers: Record<string, string>) => {
  const selected = new Set((answers.week_care_areas ?? '').split('|'));
  return WEEKLY_CARE_AREAS.filter(area => selected.has(area.key));
};

export const formatWeeklyCareAnswer = (answers: Record<string, string>): string => [
  getWeeklyCareAreas(answers).map(area => {
    const otherText = area.key === 'other' ? answers.week_care_other?.trim() : '';
    return `• ${area.label}${otherText ? `: ${otherText}` : ''}`;
  }).join('\n'),
  answers.dont_forget?.trim(),
].filter(Boolean).join('\n\n');

export const formatWeeklyLifeCheckIn = (answers: Record<string, string>): string => {
  const ratings: Record<string, string> = {struggling: 'Struggling', okay: 'Okay', well: 'Well'};
  return WEEKLY_LIFE_AREAS.flatMap(area => {
    const value = answers[area.answerKey]?.trim();
    return value ? [`${area.label}: ${ratings[value] ?? value}`] : [];
  }).join('\n');
};

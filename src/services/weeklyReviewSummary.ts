import type {LocalReviewEntry} from '../storage/reviewStorage';
import type {ReviewCapture, ReviewCaptureItem} from './reviewCaptureService';
import {rememberedReferenceMatchesMoment} from './reviewMemoryService';
import {WEEKLY_LIFE_AREAS} from '../data/weeklyLifeAreas';
import {fromLocalDateString, toLocalDateString} from '../utils/date';

export const REVIEW_ACTIVITY_GROUPS = [
  {key: 'journal', label: 'Journaling', icon: 'book-outline', color: '#698674', presentations: ['heart_journal', 'guided_reflection', 'devotional_reflection', 'playbook_reflection', 'session_note']},
  {key: 'prayer', label: 'Prayer', icon: 'sparkles-outline', color: '#B8997C', presentations: ['prayer']},
  {key: 'scripture', label: 'Scripture', icon: 'reader-outline', color: '#829AA4', presentations: ['morning_psalm', 'evening_proverb', 'bible_study', 'scripture_reflection']},
  {key: 'gratitude', label: 'Gratitude & wins', icon: 'sunny-outline', color: '#C6A36D', presentations: ['gratitude_list', 'today_win']},
  {key: 'everyday', label: 'Everyday life', icon: 'leaf-outline', color: '#A4AA92', presentations: ['morning_check_in', 'focus', 'todo', 'looking_forward']},
] as const;

export const LIFE_RATINGS: Record<string, {label: string; color: string; background: string}> = {
  well: {label: 'Well', color: '#44634F', background: '#E6EEE4'},
  okay: {label: 'Okay', color: '#766A53', background: '#F2EDE2'},
  struggling: {label: 'Needs care', color: '#985D54', background: '#F5E5E0'},
};

export const buildWeeklyReviewSummary = (
  review: Pick<LocalReviewEntry, 'periodStart' | 'periodEnd' | 'answers' | 'memorableItems'>,
  capture: ReviewCapture | null,
) => {
  const seen = new Set<string>();
  const moments = (capture?.items ?? []).filter(item => {
    const key = `${item.presentation}:${item.id}:${item.selectedDate}`;
    if (item.selectedDate < review.periodStart || item.selectedDate > review.periodEnd || seen.has(key)) {return false;}
    seen.add(key);
    return true;
  });
  const days: Array<{date: string; label: string; day: number; count: number; moments: ReviewCaptureItem[]}> = [];
  const cursor = fromLocalDateString(review.periodStart);
  const end = fromLocalDateString(review.periodEnd);
  cursor.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  while (Number.isFinite(cursor.getTime()) && cursor <= end && days.length < 31) {
    const date = toLocalDateString(cursor);
    const entries = moments.filter(item => item.selectedDate === date);
    days.push({date, label: cursor.toLocaleDateString('en', {weekday: 'short'}), day: cursor.getDate(), count: entries.length, moments: entries});
    cursor.setDate(cursor.getDate() + 1);
  }
  const referenceKeys = new Set<string>();
  const references = review.memorableItems.filter(item => {
    const key = `${item.id}:${item.selectedDate}`;
    if (referenceKeys.has(key)) {return false;}
    referenceKeys.add(key);
    return true;
  });
  const resolved = new Set<string>();
  let unavailableRemembered = 0;
  const remembered = references.flatMap(reference => {
    const match = moments.find(item => item.id === reference.id && item.selectedDate === reference.selectedDate)
      ?? moments.find(item => rememberedReferenceMatchesMoment(reference, item));
    if (!match) {unavailableRemembered += 1; return [];}
    const key = `${match.id}:${match.selectedDate}`;
    if (resolved.has(key)) {return [];}
    resolved.add(key);
    return [match];
  });
  const feelings = [...new Set([
    ...(review.answers.week_feelings ?? '').split('|').map(value => value.trim()).filter(value => value && value.toLowerCase() !== 'other'),
    review.answers.week_feeling_other?.trim(),
  ].filter((value): value is string => Boolean(value)))];
  const lifeAreas = WEEKLY_LIFE_AREAS.map(area => ({...area, value: review.answers[area.answerKey]?.trim() ?? ''}));
  return {
    moments, days, feelings, remembered, unavailableRemembered,
    activeDays: days.filter(day => day.count > 0).length,
    rememberedCount: references.length,
    categories: REVIEW_ACTIVITY_GROUPS.map(group => ({
      ...group, count: moments.filter(item => (group.presentations as readonly string[]).includes(item.presentation)).length,
    })).filter(group => group.count > 0),
    lifeAreas,
    lifeCounts: ['well', 'okay', 'struggling'].map(value => ({value, count: lifeAreas.filter(area => area.value === value).length})),
    answeredAreas: lifeAreas.filter(area => area.value).length,
  };
};

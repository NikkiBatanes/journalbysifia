import {buildWeeklyReviewSummary} from '../weeklyReviewSummary';
import type {LocalReviewEntry} from '../../storage/reviewStorage';
import type {ReviewCapture, ReviewCaptureItem} from '../reviewCaptureService';

const review: LocalReviewEntry = {
  id: 'weekly', type: 'weekly', periodStart: '2026-09-28', periodEnd: '2026-10-04',
  status: 'completed', createdAt: '', updatedAt: '', answers: {}, memorableItems: [],
};
const item = (id: string, selectedDate: string, extra: Partial<ReviewCaptureItem> = {}): ReviewCaptureItem => ({
  id, selectedDate, kind: 'journal', presentation: 'heart_journal', title: id, ...extra,
});
const capture = (items: ReviewCaptureItem[]) => ({items} as ReviewCapture);

it('uses calendar dates across month boundaries and counts only unique moments inside the reviewed week', () => {
  const result = buildWeeklyReviewSummary(review, capture([
    item('one', '2026-09-28'), item('one', '2026-09-28'), item('two', '2026-09-28'),
    item('three', '2026-10-01', {presentation: 'prayer', kind: 'prayer'}),
    item('outside', '2026-10-05'), item('before', '2026-09-27'),
  ]));
  expect(result.days.map(day => day.date)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  expect(result.days.map(day => day.count)).toEqual([2, 0, 0, 1, 0, 0, 0]);
  expect(result.activeDays).toBe(2);
  expect(result.moments).toHaveLength(3);
  expect(result.categories.map(group => [group.label, group.count])).toEqual([['Journaling', 2], ['Prayer', 1]]);
});

it('keeps all eight life areas, skips unselected ratings, and preserves custom feeling words', () => {
  const result = buildWeeklyReviewSummary({...review, answers: {
    week_feelings: 'Hopeful|Other|Faithful', week_feeling_other: 'Quietly growing',
    week_check_in_finances: 'struggling', week_check_in_mind: 'well', week_check_in_with_god: 'okay',
  }}, capture([]));
  expect(result.feelings).toEqual(['Hopeful', 'Faithful', 'Quietly growing']);
  expect(result.lifeAreas).toHaveLength(8);
  expect(result.answeredAreas).toBe(3);
  expect(result.lifeCounts).toEqual([{value: 'well', count: 1}, {value: 'okay', count: 1}, {value: 'struggling', count: 1}]);
  expect(result.lifeAreas.find(area => area.key === 'body')?.value).toBe('');
});

it('resolves older canonical prayer bookmarks and reports unavailable content without losing references', () => {
  const data = {...review, memorableItems: [
    {id: 'prayer-review:prayed:prayer-1:old', kind: 'prayer' as const, selectedDate: '2026-09-28'},
    {id: 'deleted', kind: 'journal' as const, selectedDate: '2026-09-29'},
  ]};
  const result = buildWeeklyReviewSummary(data, capture([item('current-event', '2026-09-28', {prayerId: 'prayer-1', kind: 'prayer', presentation: 'prayer'})]));
  expect(result.rememberedCount).toBe(2);
  expect(result.remembered.map(moment => moment.id)).toEqual(['current-event']);
  expect(result.unavailableRemembered).toBe(1);
  expect(data.memorableItems).toHaveLength(2);
});

it('handles an empty week without fabricating activity or life-area ratings', () => {
  const result = buildWeeklyReviewSummary(review, capture([]));
  expect(result.activeDays).toBe(0);
  expect(result.categories).toEqual([]);
  expect(result.answeredAreas).toBe(0);
  expect(result.days).toHaveLength(7);
});

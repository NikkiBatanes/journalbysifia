import {getReviewCoverSummary} from '../reviewCoverSummaryService';
import type {ReviewCapture, ReviewCaptureItem} from '../reviewCaptureService';

const item = (overrides: Partial<ReviewCaptureItem>): ReviewCaptureItem => ({
  id: 'entry',
  kind: 'journal',
  title: 'Entry',
  presentation: 'heart_journal',
  selectedDate: '2026-09-17',
  ...overrides,
});

const capture = (items: ReviewCaptureItem[]): ReviewCapture => ({
  periodStart: '2026-09-14',
  periodEnd: '2026-09-20',
  items,
  summary: {sermon: 0, prayer: 0, reflection: 0, scripture: 0, journal: 0, gratitude: 0, win: 0, morning: 0, evening: 0},
  prayerStats: {total: 0, answered: 0, pending: 0},
});

describe('Review cover summary', () => {
  it('summarizes completed work, unique people, and Heart Journal entry types', () => {
    const result = getReviewCoverSummary(capture([
      item({id: 'todo-1', presentation: 'todo', completed: true}),
      item({id: 'todo-2', presentation: 'todo', completed: true}),
      item({id: 'todo-3', presentation: 'todo', completed: false}),
      item({id: 'focus', presentation: 'focus', completedPriorityCount: 3}),
      item({id: 'psalm-read', presentation: 'morning_psalm', passageRead: true}),
      item({id: 'psalm-in-progress', presentation: 'morning_psalm', passageRead: false}),
      item({id: 'proverb-read', presentation: 'evening_proverb', passageRead: true}),
      item({id: 'person-1-a', presentation: 'prayer', personName: 'Maya'}),
      item({id: 'person-1-b', presentation: 'prayer', personName: 'maya'}),
      item({id: 'person-2', presentation: 'prayer', personName: 'Bonnet'}),
      item({id: 'thought-1', presentation: 'heart_journal', subtitle: 'Thoughts'}),
      item({id: 'thought-2', presentation: 'heart_journal', subtitle: 'Thoughts'}),
      item({id: 'brain-dump', presentation: 'heart_journal', subtitle: 'Brain Dump'}),
    ]), {morning: 6, evening: 4});

    expect(result).toEqual(expect.arrayContaining([
      {key: 'morning-check-ins', count: 6, label: 'morning check-ins completed'},
      {key: 'evening-check-ins', count: 4, label: 'evening check-ins completed'},
      {key: 'psalms-read', count: 1, label: 'Psalm read'},
      {key: 'proverbs-read', count: 1, label: 'Proverb read'},
      {key: 'completed-todos', count: 2, label: 'to-dos completed'},
      {key: 'completed-priorities', count: 3, label: 'priorities done'},
      {key: 'people-prayed-for', count: 2, label: 'people prayed for'},
      {key: 'heart-journal:Thoughts', count: 2, label: 'thoughts'},
      {key: 'heart-journal:Brain Dump', count: 1, label: 'brain dump'},
    ]));
    expect(result.slice(0, 6).map(summary => summary.key)).toEqual([
      'morning-check-ins', 'psalms-read', 'evening-check-ins', 'proverbs-read',
      'completed-priorities', 'completed-todos',
    ]);
  });

  it('omits zero-value categories and counts individual gratitude lines', () => {
    const result = getReviewCoverSummary(capture([
      item({id: 'gratitude', presentation: 'gratitude_list', lines: ['Grace', 'Rest', 'Help']}),
    ]));
    expect(result).toEqual([{key: 'gratitudes', count: 3, label: 'gratitudes'}]);
  });

  it('can derive completed priorities from priority to-dos when Focus has no completion state', () => {
    const result = getReviewCoverSummary(capture([
      item({id: 'priority', presentation: 'todo', completed: true, priority: true}),
      item({id: 'ordinary', presentation: 'todo', completed: true, priority: false}),
    ]));
    expect(result).toEqual(expect.arrayContaining([
      {key: 'completed-priorities', count: 1, label: 'priority done'},
    ]));
  });

  it('omits a routine completion count when it is zero', () => {
    expect(getReviewCoverSummary(capture([]), {morning: 7, evening: 0})).toEqual([
      {key: 'morning-check-ins', count: 7, label: 'morning check-ins completed'},
    ]);
  });
});

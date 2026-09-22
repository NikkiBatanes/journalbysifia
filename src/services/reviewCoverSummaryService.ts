import type {ReviewCapture, ReviewCaptureItem} from './reviewCaptureService';

export type ReviewCoverSummaryMetric = {
  key: string;
  count: number;
  label: string;
};

export type ReviewCoverRoutineCounts = {
  morning: number;
  evening: number;
};

const metric = (
  key: string,
  count: number,
  singular: string,
  plural: string,
): ReviewCoverSummaryMetric | null => count > 0
  ? {key, count, label: count === 1 ? singular : plural}
  : null;

const heartJournalLabels: Record<string, [string, string]> = {
  Thoughts: ['thought', 'thoughts'],
  Notes: ['note', 'notes'],
  Reflection: ['reflection', 'reflections'],
  'Brain Dump': ['brain dump', 'brain dumps'],
  Lesson: ['lesson', 'lessons'],
  Idea: ['idea', 'ideas'],
  Letter: ['letter', 'letters'],
  Other: ['other entry', 'other entries'],
};

const countItems = (
  items: ReviewCaptureItem[],
  presentation: ReviewCaptureItem['presentation'],
): number => items.filter(item => item.presentation === presentation).length;

/** Builds the compact, non-zero-only summary shown on a Review cover. */
export const getReviewCoverSummary = (
  capture: ReviewCapture,
  routineCounts?: ReviewCoverRoutineCounts,
): ReviewCoverSummaryMetric[] => {
  const {items} = capture;
  const metrics: Array<ReviewCoverSummaryMetric | null> = [];

  if (routineCounts) {
    metrics.push(metric(
      'morning-check-ins',
      routineCounts.morning,
      'morning check-in completed',
      'morning check-ins completed',
    ));
  }
  metrics.push(metric(
    'psalms-read',
    items.filter(item => item.presentation === 'morning_psalm' && item.passageRead).length,
    'Psalm read',
    'Psalms read',
  ));
  if (routineCounts) {
    metrics.push(metric(
      'evening-check-ins',
      routineCounts.evening,
      'evening check-in completed',
      'evening check-ins completed',
    ));
  }
  metrics.push(metric(
    'proverbs-read',
    items.filter(item => item.presentation === 'evening_proverb' && item.passageRead).length,
    'Proverb read',
    'Proverbs read',
  ));

  const completedFocusPriorities = items.reduce(
    (total, item) => total + (item.completedPriorityCount || 0),
    0,
  );
  const completedPriorityTodos = items.filter(
    item => item.presentation === 'todo' && item.completed && item.priority,
  ).length;
  metrics.push(metric(
    'completed-priorities',
    Math.max(completedFocusPriorities, completedPriorityTodos),
    'priority done',
    'priorities done',
  ));
  metrics.push(metric(
    'completed-todos',
    items.filter(item => item.presentation === 'todo' && item.completed).length,
    'to-do completed',
    'to-dos completed',
  ));

  const peoplePrayedFor = new Set(
    items
      .filter(item => item.presentation === 'prayer' && item.personName?.trim())
      .map(item => item.personName!.trim().toLocaleLowerCase()),
  ).size;
  metrics.push(metric('people-prayed-for', peoplePrayedFor, 'person prayed for', 'people prayed for'));

  const heartJournalCounts = new Map<string, number>();
  items.filter(item => item.presentation === 'heart_journal').forEach(item => {
    const label = item.subtitle?.trim() || 'Thoughts';
    heartJournalCounts.set(label, (heartJournalCounts.get(label) || 0) + 1);
  });
  metrics.push(metric('gratitudes', items
    .filter(item => item.presentation === 'gratitude_list')
    .reduce((total, item) => total + Math.max(item.lines?.length || 0, 1), 0), 'gratitude', 'gratitudes'));
  metrics.push(metric('wins', countItems(items, 'today_win'), 'win', 'wins'));

  const orderedHeartJournalLabels = [
    ...Object.keys(heartJournalLabels),
    ...[...heartJournalCounts.keys()]
      .filter(label => !heartJournalLabels[label])
      .sort((left, right) => left.localeCompare(right)),
  ];
  for (const label of orderedHeartJournalLabels) {
    const count = heartJournalCounts.get(label) || 0;
    const words = heartJournalLabels[label]
      || [label.toLocaleLowerCase(), `${label.toLocaleLowerCase()} entries`];
    metrics.push(metric(`heart-journal:${label}`, count, words[0], words[1]));
  }

  metrics.push(metric('guided-reflections', countItems(items, 'guided_reflection'), 'guided reflection', 'guided reflections'));
  metrics.push(metric('devotional-reflections', countItems(items, 'devotional_reflection'), 'devotional reflection', 'devotional reflections'));
  metrics.push(metric('playbook-reflections', countItems(items, 'playbook_reflection'), 'playbook reflection', 'playbook reflections'));
  metrics.push(metric('bible-studies', countItems(items, 'bible_study'), 'Bible study', 'Bible studies'));
  metrics.push(metric('scripture-notes', countItems(items, 'scripture_reflection'), 'Scripture note', 'Scripture notes'));
  metrics.push(metric('session-notes', countItems(items, 'session_note'), 'session note', 'session notes'));

  metrics.push(metric('looking-forward', countItems(items, 'looking_forward'), 'looking-forward reflection', 'looking-forward reflections'));

  if (peoplePrayedFor === 0) {
    metrics.push(metric('prayer-moments', countItems(items, 'prayer'), 'prayer moment', 'prayer moments'));
  }

  return metrics.filter(
    (item): item is ReviewCoverSummaryMetric => item !== null && item.count > 0,
  );
};

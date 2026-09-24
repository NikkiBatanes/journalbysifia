import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';

import {MonthlyReviewSummary} from '../MonthlyReviewSummary';
import type {LocalReviewEntry} from '../../../storage/reviewStorage';
import type {ReviewCapture} from '../../../services/reviewCaptureService';

jest.mock('../../common/ThemedText', () => require('react-native').Text);
jest.mock('../../../utils/haptics', () => ({triggerLightHaptic: jest.fn()}));

const review: LocalReviewEntry = {
  id: 'month',
  type: 'monthly',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  status: 'draft',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  memorableItems: [
    {id: 'conversation', kind: 'journal', selectedDate: '2026-08-11'},
  ],
  answers: {
    month_feelings: 'Hopeful|Tired',
    month_feeling_other: 'Held',
    remember_month: 'The quiet dinner after a difficult week.',
    notice_month: 'I hurry when I feel uncertain.',
    month_life_giving: 'Time with God|Meaningful conversations|Other',
    month_life_giving_other: 'Making music',
    month_draining: 'Carrying too much|Mental noise',
    month_more_room: 'Rest|Time with God|Other',
    month_more_room_other: 'Unhurried dinners',
    month_more_room_rest: 'Better sleep|Sabbath',
    month_more_room_with_god: 'Prayer|Scripture reading|Worship',
    month_care_areas: 'mind|rest',
    month_leave_behind:
      'Carrying too much|Comparison|Striving and self-reliance',
    month_leave_behind_carrying_too_much:
      'Too many responsibilities|Doing everything alone',
    month_leave_behind_comparison:
      'Comparing timelines|Social media comparison',
    month_leave_behind_self_reliance:
      'Carrying what belongs to God|Performing instead of abiding',
    month_prayer_ids: 'still-carrying-family',
    god_month: 'God kept meeting me through people.',
    formation_month: 'A steadier kind of patience.',
    prayer_month: 'Two answers, and one prayer I am still carrying.',
    release_month: 'The need to resolve everything immediately.',
    next_month_priority_1: 'Be present at home',
    next_month_priority_2: 'Finish what is already open',
    attention: 'A conversation with my manager.',
    continue: 'A quiet morning rhythm.',
    simplify_or_stop: 'Overcommitting weekends.',
    intentional_with: 'My sister.',
    rhythm: 'An unhurried Sabbath.',
    prayer_for_month: 'God, teach me to move at the pace of grace.',
  },
};

const capture = {
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  summary: {
    journal: 1,
    prayer: 1,
    gratitude: 1,
    reflection: 0,
    morning: 0,
    evening: 0,
    win: 0,
    scripture: 0,
    sermon: 0,
  },
  prayerStats: {total: 1, answered: 0, pending: 1},
  items: [
    {
      id: 'conversation',
      kind: 'journal',
      presentation: 'heart_journal',
      title: 'A conversation worth remembering',
      text: 'We listened without trying to fix each other.',
      selectedDate: '2026-08-11',
    },
    {
      id: 'gratitude',
      kind: 'gratitude',
      presentation: 'gratitude_list',
      title: 'Small graces',
      lines: ['Home', 'A slow morning'],
      selectedDate: '2026-08-24',
    },
  ],
  monthlyPrayerReflection: {
    answered: [],
    waiting: [
      {
        id: 'still-carrying-family',
        prayerId: 'family-prayer',
        eventType: 'still_carrying' as const,
        eventDate: '2026-08-31',
        title: 'Healing and peace for my family',
        subtitle: 'Still carrying',
      },
    ],
  },
} as ReviewCapture;

it('presents a month-scale Looking Back and Looking Ahead recap', () => {
  const edit = jest.fn();
  const finish = jest.fn();
  const screen = render(
    <MonthlyReviewSummary
      review={review}
      capture={capture}
      patternSummary="Hopeful appeared most often in your mornings (8 days)."
      onEdit={edit}
      onFinish={finish}
    />,
  );

  expect(screen.getAllByText('August')).toHaveLength(2);
  expect(
    screen.getByRole('tab', {name: 'Looking Back', selected: true}),
  ).toBeTruthy();
  expect(screen.getByText('How the month felt')).toBeTruthy();
  expect(screen.getByText('Hopeful')).toBeTruthy();
  expect(screen.getByText('Held')).toBeTruthy();
  expect(screen.getByText('Patterns you noticed')).toBeTruthy();
  expect(screen.getByText('WHAT YOUR CHECK-INS SHOW')).toBeTruthy();
  expect(
    screen.getByText('Hopeful appeared most often in your mornings (8 days).'),
  ).toBeTruthy();
  expect(screen.getByText('WHAT YOU NOTICED')).toBeTruthy();
  expect(screen.getByText('I hurry when I feel uncertain.')).toBeTruthy();
  expect(screen.getByText('What gave you life')).toBeTruthy();
  expect(screen.getByText('Time with God')).toBeTruthy();
  expect(screen.getByText('Making music')).toBeTruthy();
  expect(screen.getByText('What drained you')).toBeTruthy();
  expect(screen.getByText('Mental noise')).toBeTruthy();
  expect(screen.getByText('What you released')).toBeTruthy();
  expect(
    screen.getByText('The need to resolve everything immediately.'),
  ).toBeTruthy();
  expect(
    screen.queryByRole('button', {name: 'Edit what you released'}),
  ).toBeNull();
  expect(screen.getByText('A conversation worth remembering')).toBeTruthy();
  expect(
    screen.getByText('The quiet dinner after a difficult week.'),
  ).toBeTruthy();
  expect(screen.queryByText('What you want to remember')).toBeNull();

  fireEvent.press(
    screen.getByRole('button', {name: 'Edit what shaped the month'}),
  );
  expect(edit).toHaveBeenCalledWith('captured');

  fireEvent.press(
    screen.getByRole('button', {name: 'Edit patterns you noticed'}),
  );
  expect(edit).toHaveBeenCalledWith('notice');
  fireEvent.press(
    screen.getByRole('button', {name: 'Edit how the month felt'}),
  );
  expect(edit).toHaveBeenLastCalledWith('monthly_feelings');

  fireEvent.press(screen.getByRole('tab', {name: 'Looking Ahead'}));
  expect(screen.getAllByText('September')).toHaveLength(2);
  expect(screen.getByText('More room for')).toBeTruthy();
  expect(screen.getByText('Unhurried dinners')).toBeTruthy();
  expect(screen.getByText('Better sleep · Sabbath')).toBeTruthy();
  expect(
    screen.getByText('Prayer · Scripture reading · Worship'),
  ).toBeTruthy();
  expect(screen.getByText('What needs care')).toBeTruthy();
  expect(screen.getByText('Mind')).toBeTruthy();
  expect(screen.getByText('What you’re leaving behind')).toBeTruthy();
  expect(screen.getByText('Comparison')).toBeTruthy();
  expect(
    screen.getByText('Too many responsibilities · Doing everything alone'),
  ).toBeTruthy();
  expect(
    screen.getByText('Comparing timelines · Social media comparison'),
  ).toBeTruthy();
  expect(screen.getByText('Striving and self-reliance')).toBeTruthy();
  expect(
    screen.getByText(
      'Carrying what belongs to God · Performing instead of abiding',
    ),
  ).toBeTruthy();
  expect(screen.getByText('Be present at home')).toBeTruthy();
  expect(screen.queryByText('An unhurried Sabbath.')).toBeNull();
  expect(screen.getByText('Healing and peace for my family')).toBeTruthy();
  expect(
    screen.getByText('God, teach me to move at the pace of grace.'),
  ).toBeTruthy();
  expect(screen.getByText('Your prayer for the month')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', {name: 'Finish monthly review'}));
  expect(finish).toHaveBeenCalledTimes(1);
});

it('keeps retired Looking Ahead answers readable in completed reviews', () => {
  const screen = render(
    <MonthlyReviewSummary
      review={{
        ...review,
        status: 'completed',
        completedAt: '2026-09-01T09:00:00.000Z',
      }}
      capture={capture}
    />,
  );

  expect(screen.getByText('A month remembered')).toBeTruthy();
  expect(screen.getByText('Completed Sep 1, 2026')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', {name: 'Looking Ahead'}));
  expect(screen.getByText('A month remembered')).toBeTruthy();
  expect(screen.getByText('A conversation with my manager.')).toBeTruthy();
  expect(screen.getByText('A quiet morning rhythm.')).toBeTruthy();
  expect(screen.getByText('Overcommitting weekends.')).toBeTruthy();
  expect(screen.getByText('My sister.')).toBeTruthy();
  expect(screen.getByText('An unhurried Sabbath.')).toBeTruthy();
});

it('keeps the completed review tabs aligned and interactive after the header collapses', () => {
  const screen = render(
    <MonthlyReviewSummary
      review={{
        ...review,
        status: 'completed',
        completedAt: '2026-09-01T09:00:00.000Z',
      }}
      capture={capture}
      topInset={54}
      onBack={jest.fn()}
    />,
  );

  fireEvent(screen.getByTestId('monthly-review-hero'), 'layout', {
    nativeEvent: {layout: {x: 0, y: 106, width: 390, height: 216}},
  });
  fireEvent.scroll(screen.getByTestId('monthly-review-scroll'), {
    nativeEvent: {contentOffset: {x: 0, y: 500}},
  });

  expect(screen.getByTestId('monthly-review-moving-tabs')).toHaveStyle({
    transform: [{translateY: -52}],
    paddingTop: 6,
    paddingBottom: 6,
  });
  expect(screen.getByTestId('monthly-review-tab-list')).toHaveStyle({
    marginHorizontal: 64,
    padding: 2,
  });

  fireEvent.press(screen.getByRole('tab', {name: 'Looking Ahead'}));

  expect(
    screen.getByRole('tab', {name: 'Looking Ahead', selected: true}),
  ).toBeTruthy();
  expect(screen.getByText('More room for')).toBeTruthy();
  expect(screen.getByTestId('monthly-review-moving-tabs')).toHaveStyle({
    transform: [{translateY: -52}],
  });
});

it('positions the expanded tabs between the hero and recap content', () => {
  const screen = render(
    <MonthlyReviewSummary
      review={review}
      capture={capture}
      topInset={54}
      onBack={jest.fn()}
    />,
  );

  fireEvent(screen.getByTestId('monthly-review-hero'), 'layout', {
    nativeEvent: {layout: {x: 0, y: 106, width: 390, height: 216}},
  });

  expect(
    screen.getByTestId('monthly-review-scroll').props.contentContainerStyle,
  ).toEqual(expect.objectContaining({paddingTop: 106}));
  expect(screen.getByTestId('monthly-review-hero')).toHaveStyle({
    paddingTop: 18,
  });
  expect(screen.getByTestId('monthly-review-moving-tabs')).toHaveStyle({
    top: 106,
    transform: [{translateY: 216}],
  });
});

it('remembers a testimony written during the reviewed month', () => {
  const testimonyCapture: ReviewCapture = {
    ...capture,
    items: [
      ...capture.items,
      {
        id: 'for-me-day-testimony',
        kind: 'reflection',
        presentation: 'testimony',
        title: 'My testimony',
        subtitle: 'My New Life Day',
        text: 'Jesus met me with grace and gave me a new beginning.',
        detail: 'Written Aug 18, 2026 · 7:42 PM',
        selectedDate: '2026-08-18',
      },
    ],
  };
  const screen = render(
    <MonthlyReviewSummary review={review} capture={testimonyCapture} />,
  );

  expect(screen.getByText('You wrote your testimony')).toBeTruthy();
  expect(
    screen.getByText(
      'This month, you made space to remember God’s faithfulness in your story.',
    ),
  ).toBeTruthy();
  expect(screen.getByText('Written Aug 18, 2026 · 7:42 PM')).toBeTruthy();
  expect(
    screen.getByText('Jesus met me with grace and gave me a new beginning.'),
  ).toBeTruthy();
});

it('keeps written reflections visible when captured moments cannot load', () => {
  const screen = render(
    <MonthlyReviewSummary review={review} capture={null} />,
  );

  expect(
    screen.getByText(
      'Your saved moments could not be loaded. Your written reflections are below.',
    ),
  ).toBeTruthy();
  expect(screen.getByText('I hurry when I feel uncertain.')).toBeTruthy();
  expect(
    screen.queryByRole('button', {name: 'Finish monthly review'}),
  ).toBeNull();
});

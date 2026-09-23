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
} as ReviewCapture;

it('presents a month-scale Looking Back and Looking Ahead recap', () => {
  const edit = jest.fn();
  const finish = jest.fn();
  const screen = render(
    <MonthlyReviewSummary
      review={review}
      capture={capture}
      onEdit={edit}
      onFinish={finish}
    />,
  );

  expect(screen.getAllByText('August 2026')).toHaveLength(2);
  expect(
    screen.getByRole('tab', {name: 'Looking Back', selected: true}),
  ).toBeTruthy();
  expect(screen.getByText('How the month felt')).toBeTruthy();
  expect(screen.getByText('Hopeful')).toBeTruthy();
  expect(screen.getByText('Held')).toBeTruthy();
  expect(screen.getByText('Patterns you noticed')).toBeTruthy();
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
  expect(screen.getAllByText('September 2026')).toHaveLength(2);
  expect(screen.getByText('Be present at home')).toBeTruthy();
  expect(screen.getByText('An unhurried Sabbath.')).toBeTruthy();
  expect(
    screen.getByText('God, teach me to move at the pace of grace.'),
  ).toBeTruthy();

  fireEvent.press(screen.getByRole('button', {name: 'Finish monthly review'}));
  expect(finish).toHaveBeenCalledTimes(1);
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

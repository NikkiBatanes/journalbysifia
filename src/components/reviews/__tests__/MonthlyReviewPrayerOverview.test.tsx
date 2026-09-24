import React from 'react';
import {render} from '@testing-library/react-native';

import {MonthlyReviewPrayerOverview} from '../MonthlyReviewPrayerOverview';

jest.mock('../../common/ThemedText', () => require('react-native').Text);

it('shows every answered and waiting prayer with clear empty-request guidance', () => {
  const screen = render(
    <MonthlyReviewPrayerOverview
      reflection={{
        answered: [
          {
            id: 'answer-1',
            prayerId: 'prayer-1',
            eventType: 'answer_recorded',
            eventDate: '2026-08-18',
            title: 'A new opportunity',
            subtitle: 'You recorded an answer',
            text: 'The right door opened.',
          },
        ],
        waiting: [
          {
            id: 'waiting-1',
            prayerId: 'prayer-2',
            eventType: 'still_carrying',
            eventDate: '2026-08-31',
            title: 'Healing for Mum',
            subtitle: 'Still waiting',
          },
          {
            id: 'waiting-2',
            prayerId: 'prayer-3',
            requestId: 'request-3',
            eventType: 'still_carrying',
            eventDate: '2026-08-31',
            title: 'Wisdom for Ben',
            subtitle: 'Prayer Request · Still waiting',
          },
        ],
      }}
    />,
  );

  expect(
    screen.getByRole('header', {name: 'Answered this month'}),
  ).toBeTruthy();
  expect(screen.getByText('A new opportunity')).toBeTruthy();
  expect(screen.getByText('God answered')).toBeTruthy();
  expect(screen.getByText('1 prayer answered')).toBeTruthy();
  expect(screen.getByRole('header', {name: 'Still waiting'})).toBeTruthy();
  expect(screen.getByText('Healing for Mum')).toBeTruthy();
  expect(screen.getByText('Wisdom for Ben')).toBeTruthy();
  expect(screen.getAllByText('Carry in prayer')).toHaveLength(2);
  expect(screen.getByText('2 prayers still waiting')).toBeTruthy();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(
    screen.getByText(
      'Prayer requests you have not prayed for yet are not included.',
    ),
  ).toBeTruthy();
});

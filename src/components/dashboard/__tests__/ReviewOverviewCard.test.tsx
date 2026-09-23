import React from 'react';
import {render} from '@testing-library/react-native';

import ReviewOverviewCard from '../ReviewOverviewCard';
import {useMonthlyReviewStats} from '../../../hooks/useMonthlyReviewStats';

jest.mock('lucide-react-native', () => ({
  ArrowRight: 'Icon',
  Bookmark: 'Icon',
  BookOpen: 'Icon',
  CircleCheck: 'Icon',
  Heart: 'Icon',
  Moon: 'Icon',
  Share2: 'Icon',
  Sparkles: 'Icon',
  Sun: 'Icon',
  Target: 'Icon',
}));
jest.mock('../../common/ThemedText', () => require('react-native').Text);
jest.mock('../../../utils/haptics', () => ({triggerLightHaptic: jest.fn()}));
jest.mock('../../../hooks/useMonthlyReviewStats', () => ({useMonthlyReviewStats: jest.fn(() => null)}));

beforeEach(() => {
  jest.mocked(useMonthlyReviewStats).mockReturnValue(null);
});

it('uses the shared review-card date treatment for a monthly review', () => {
  const screen = render(
    <ReviewOverviewCard
      review={null}
      reviewType="monthly"
      periodStart="2025-08-01"
      periodEnd="2025-08-31"
      onBegin={jest.fn()}
    />,
  );

  expect(screen.getByText('Aug 1–31')).toBeTruthy();
  expect(screen.getByText('Remember what this month held.')).toBeTruthy();
  expect(screen.getByText('Your monthly review is ready.')).toBeTruthy();
  expect(screen.getByText('Explore your month')).toBeTruthy();
});

it('uses continuation copy for a monthly review draft', () => {
  const screen = render(
    <ReviewOverviewCard
      review={{
        id: 'monthly-draft',
        type: 'monthly',
        periodStart: '2025-08-01',
        periodEnd: '2025-08-31',
        status: 'draft',
        memorableItems: [],
        answers: {},
        createdAt: '2025-08-31T08:00:00.000Z',
        updatedAt: '2025-08-31T08:00:00.000Z',
      }}
      reviewType="monthly"
      periodStart="2025-08-01"
      periodEnd="2025-08-31"
      onBegin={jest.fn()}
    />,
  );

  expect(screen.getByText('Your monthly review is in progress.')).toBeTruthy();
  expect(screen.getByText('Continue your month')).toBeTruthy();
});

it('shows monthly rhythm counts and only non-zero monthly highlights', () => {
  jest.mocked(useMonthlyReviewStats).mockReturnValue({
    activeDays: 18,
    morning: 12,
    evening: 9,
    prayers: 14,
    journal: 11,
    answeredPrayers: 2,
    rememberedFromWeeks: 3,
    gospelShares: 1,
  });
  const screen = render(
    <ReviewOverviewCard
      review={null}
      reviewType="monthly"
      periodStart="2025-08-01"
      periodEnd="2025-08-31"
      onBegin={jest.fn()}
    />,
  );

  for (const count of ['18', '12', '9', '14', '11', '2', '3', '1']) {
    expect(screen.getByText(count)).toBeTruthy();
  }
  expect(screen.getByText('Answered prayers')).toBeTruthy();
  expect(screen.getByText('Remembered')).toBeTruthy();
  expect(screen.getByText('Gospel shared')).toBeTruthy();
});

it('keeps the year visible for year review cards', () => {
  const screen = render(
    <ReviewOverviewCard
      review={null}
      reviewType="year_end"
      periodStart="2025-01-01"
      periodEnd="2025-12-31"
      onBegin={jest.fn()}
    />,
  );

  expect(screen.getByText('Jan 1–Dec 31, 2025')).toBeTruthy();
});

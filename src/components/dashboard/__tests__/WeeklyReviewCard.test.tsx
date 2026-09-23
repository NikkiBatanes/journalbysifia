import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import WeeklyReviewCard from '../WeeklyReviewCard';
import { getWeeklyRhythm, type WeeklyRhythm } from '../../../services/weeklyRhythmService';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('lucide-react-native', () => ({ ArrowRight: 'Icon', BookOpen: 'Icon', Heart: 'Icon', Moon: 'Icon', Sun: 'Icon' }));
jest.mock('../../common/ThemedText', () => require('react-native').Text);
jest.mock('../../../utils/haptics', () => ({ triggerLightHaptic: jest.fn() }));
jest.mock('../../../services/weeklyRhythmService', () => ({ getWeeklyRhythm: jest.fn() }));

it('opens the review before slow statistics finish and updates the counts in place', async () => {
  let finish!: (value: WeeklyRhythm) => void;
  (getWeeklyRhythm as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const onBegin = jest.fn();
  const screen = render(<WeeklyReviewCard
    periodStart="2026-09-14" periodEnd="2026-09-20" referenceDate="2026-09-22" onBegin={onBegin}
  />);
  expect(screen.getByText('Your weekly review is ready.')).toBeTruthy();
  expect(screen.getByText('Sep 14–20')).toBeTruthy();
  fireEvent.press(screen.getByText('Explore your week'));
  expect(onBegin).toHaveBeenCalledTimes(1);
  expect(getWeeklyRhythm).toHaveBeenCalledWith('2026-09-14', '2026-09-20', '2026-09-22');

  await act(async () => {
    finish({ activeDays: 5, morning: 3, evening: 2, prayers: 8, journal: 4, answeredPrayers: 1, days: [] });
  });
  expect(screen.getByText('5')).toBeTruthy();
  expect(screen.getByText('8')).toBeTruthy();
  expect(screen.getByText('Explore your week')).toBeTruthy();
  expect(getWeeklyRhythm).toHaveBeenCalledTimes(1);
});

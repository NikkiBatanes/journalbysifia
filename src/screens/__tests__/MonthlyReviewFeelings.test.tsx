import React from 'react';
import {AccessibilityInfo, StyleSheet} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';

import ReviewScreen from '../ReviewScreen';
import {getReviewCapture} from '../../services/reviewCaptureService';
import {
  getMonthlyCheckInFeelings,
  getMonthlyWeeklyReviewFeelings,
} from '../../services/weeklyFeelingService';
import {getLocalReviewForPeriod} from '../../storage/reviewStorage';

const mockNavigation = {goBack: jest.fn(), navigate: jest.fn()};
const mockRouteParams = {
  type: 'monthly',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({params: mockRouteParams}),
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
}));
jest.mock('../../context/IndustryStandardAuthContext', () => ({
  useAuth: () => ({preferences: {weekStart: 'monday'}}),
}));
jest.mock(
  '../../components/common/ThemedText',
  () => require('react-native').Text,
);
jest.mock(
  '../../components/common/HeaderBackButton',
  () => require('react-native').Pressable,
);
jest.mock(
  '../../components/journal/SavedReflectionBlocks',
  () => 'ReflectionBlocks',
);
jest.mock('../../components/journal/GratitudeVerse', () => 'GratitudeVerse');
jest.mock('../../components/journal/GratitudeListReactQuery', () => ({
  GratitudeListReactQuery: () => null,
}));
jest.mock(
  '../../components/scripture/ProverbVerseExcerpt',
  () => 'ProverbVerseExcerpt',
);
jest.mock('../../components/common/PrayerHandsIcon', () => 'PrayerHandsIcon');
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-vector-icons/FontAwesome6', () => 'Icon');
jest.mock('react-native-vector-icons/Entypo', () => 'Icon');
jest.mock('lucide-react-native', () => ({BookHeart: 'Icon', Pencil: 'Icon'}));
jest.mock('../../hooks/useFloatingKeyboardButton', () => ({
  useFloatingKeyboardButton: () => ({
    bottom: 20,
    keyboardVisible: false,
    keyboardHeight: 0,
  }),
}));
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({currentFont: 'lexend'}),
}));
jest.mock('../../utils/haptics', () => ({triggerLightHaptic: jest.fn()}));
jest.mock('../../services/reviewCaptureService', () => ({
  getReviewCapture: jest.fn(),
}));
jest.mock('../../services/weeklyRhythmService', () => ({
  getWeeklyRhythm: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../services/weeklyFeelingService', () => ({
  getWeeklyCheckInFeelings: jest.fn().mockResolvedValue([]),
  getMonthlyCheckInFeelings: jest.fn(),
  getMonthlyWeeklyReviewFeelings: jest.fn(),
}));
jest.mock('../../services/faithfulRhythmService', () => ({
  claimFaithfulRhythmCelebration: jest.fn(),
}));
jest.mock('../../services/weeklyGratitudeService', () => ({
  saveWeeklyGratitudeMoment: jest.fn().mockResolvedValue(null),
}));

beforeEach(() => {
  jest.clearAllMocks();
  const store = new Map<string, string>();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    async key => store.get(key) ?? null,
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => {
    store.set(key, value);
  });
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  (getReviewCapture as jest.Mock).mockResolvedValue({
    items: [],
    summary: {},
    counts: {},
    prayerStats: {total: 0, answered: 0, pending: 0},
  });
  (getMonthlyCheckInFeelings as jest.Mock).mockResolvedValue([
    {
      name: 'Hopeful',
      count: 2,
      dates: ['2026-08-02', '2026-08-25'],
      entries: [
        {date: '2026-08-02', underneathIt: 'A fresh start'},
        {date: '2026-08-25', underneathIt: 'Clarity is returning'},
      ],
    },
    {
      name: 'Tired',
      count: 1,
      dates: ['2026-08-14'],
      entries: [{date: '2026-08-14', underneathIt: 'A long week'}],
    },
  ]);
  (getMonthlyWeeklyReviewFeelings as jest.Mock).mockResolvedValue({
    reviewCount: 2,
    feelings: [
      {name: 'Peaceful', count: 2, dates: ['2026-08-09', '2026-08-16']},
      {name: 'Wrestling', count: 1, dates: ['2026-08-16']},
    ],
  });
});

afterEach(() => jest.restoreAllMocks());

it('collates every Morning Check-in before asking the user to name the month', async () => {
  const screen = render(<ReviewScreen />);
  await waitFor(() =>
    expect(getMonthlyCheckInFeelings).toHaveBeenCalledWith(
      '2026-08-01',
      '2026-08-31',
    ),
  );

  await act(async () => {
    fireEvent.press(screen.getByLabelText('Begin monthly review'));
  });

  expect(screen.getByText('How did this month feel?')).toBeTruthy();
  expect(screen.getByText('3 mornings recorded · 2 feelings')).toBeTruthy();
  expect(
    screen.getByRole('button', {name: 'Hopeful, 2 mornings'}),
  ).toBeTruthy();
  expect(screen.getByRole('button', {name: 'Tired, 1 morning'})).toBeTruthy();
  expect(screen.getByText('LOOKING AT THE WHOLE MONTH')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', {name: 'Hopeful, 2 mornings'}));
  expect(screen.getByText('A fresh start')).toBeTruthy();
  expect(screen.getByText('Clarity is returning')).toBeTruthy();
  expect(screen.queryByText('A long week')).toBeNull();
});

it('uses the complete weekly moments card experience for the monthly period', async () => {
  (getReviewCapture as jest.Mock).mockResolvedValue({
    items: [
      {
        id: 'morning-1',
        selectedDate: '2026-08-04',
        kind: 'morning',
        presentation: 'morning_check_in',
        title: 'Hopeful',
        text: 'A new opportunity opened up.',
        detail: 'Psalm 27:1',
        scriptureText: 'The Lord is my light and my salvation.',
        feelingIcon: 'sunny-outline',
        feelingIconType: 'ionicons',
        carriedForwardFrom: ['weekly'],
      },
      {
        id: 'gratitude-1',
        selectedDate: '2026-08-05',
        kind: 'gratitude',
        presentation: 'gratitude_list',
        title: 'Gratitude',
        lines: ['A quiet morning', 'Time with family'],
      },
    ],
    summary: {morning: 1, gratitude: 1},
    counts: {},
    prayerStats: {total: 0, answered: 0, pending: 0},
  });

  const screen = render(<ReviewScreen />);
  await waitFor(() => expect(getReviewCapture).toHaveBeenCalled());
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Begin monthly review'));
  });
  await waitFor(async () =>
    expect(
      await getLocalReviewForPeriod('monthly', '2026-08-01', '2026-08-31'),
    ).toMatchObject({
      monthlyWeeklyBookmarksInitialized: true,
      memorableItems: [
        expect.objectContaining({id: 'morning-1', selectedDate: '2026-08-04'}),
      ],
    }),
  );
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Next'));
  });

  expect(screen.getByText('What shaped this month?')).toBeTruthy();
  expect(screen.getByText('Morning check-ins')).toBeTruthy();
  expect(
    screen.getByRole('tab', {name: 'Weekly bookmarks, 1', selected: true}),
  ).toBeTruthy();
  expect(
    screen.getByText(/These were bookmarked in your weekly reviews/),
  ).toBeTruthy();
  expect(screen.queryByText('Gratitudes')).toBeNull();

  const weeklyBookmark = screen.getByRole('checkbox', {
    name: /Remove from remembered.*Hopeful.*A new opportunity opened up/,
  });
  expect(weeklyBookmark.props.accessibilityState.checked).toBe(true);

  fireEvent.press(screen.getByRole('tab', {name: 'More moments, 1'}));

  expect(screen.getByText('Gratitudes')).toBeTruthy();
  expect(screen.queryByText('Hopeful')).toBeNull();
  expect(screen.getByText('GRATITUDE LIST')).toBeTruthy();
  expect(screen.getByText('A quiet morning')).toBeTruthy();

  const gratitudeCard = screen.getByRole('checkbox', {
    name: /Remember this.*Gratitude/,
  });
  fireEvent.press(gratitudeCard);
  await waitFor(() =>
    expect(
      screen.getByRole('checkbox', {
        name: /Remove from remembered.*Gratitude/,
      }).props.accessibilityState.checked,
    ).toBe(true),
  );

  await act(async () => {
    fireEvent.press(screen.getByLabelText('Next'));
  });
  expect(screen.getByText('What patterns do you notice?')).toBeTruthy();
  expect(
    screen.getByText(
      'Here’s what showed up across your 3 morning check-ins and 2 weekly reviews.',
    ),
  ).toBeTruthy();
  expect(screen.getByText('FROM YOUR MORNINGS')).toBeTruthy();
  expect(screen.getByText('Hopeful')).toBeTruthy();
  expect(screen.getByText('2 days')).toBeTruthy();
  expect(screen.getByText('Tired')).toBeTruthy();
  expect(screen.getByText('1 day')).toBeTruthy();
  expect(screen.getByText('FROM YOUR WEEKLY REVIEWS')).toBeTruthy();
  expect(screen.getByText('Peaceful')).toBeTruthy();
  expect(screen.getByText('2 weeks')).toBeTruthy();
  expect(screen.getByText('Wrestling')).toBeTruthy();
  expect(screen.getByText('1 week')).toBeTruthy();
  expect(
    StyleSheet.flatten(
      screen.getByTestId('monthly-pattern-bar-morning-hopeful').props.style,
    ).width,
  ).toBe('100%');
  expect(
    StyleSheet.flatten(
      screen.getByTestId('monthly-pattern-bar-morning-tired').props.style,
    ).width,
  ).toBe('50%');
  expect(
    StyleSheet.flatten(
      screen.getByTestId('monthly-pattern-bar-weekly-peaceful').props.style,
    ).width,
  ).toBe('100%');

  fireEvent.changeText(
    screen.getByLabelText('What do you notice?'),
    'Rest helped hope return.',
  );
  await waitFor(async () =>
    expect(
      await getLocalReviewForPeriod('monthly', '2026-08-01', '2026-08-31'),
    ).toMatchObject({
      answers: {notice_month: 'Rest helped hope return.'},
    }),
  );
});

it('shows all monthly moments automatically when no weekly bookmarks exist', async () => {
  (getReviewCapture as jest.Mock).mockResolvedValue({
    items: [
      {
        id: 'unbookmarked-1',
        selectedDate: '2026-08-18',
        kind: 'win',
        presentation: 'today_win',
        title: 'I followed through',
        text: 'I completed the next faithful step.',
      },
    ],
    summary: {win: 1},
    counts: {},
    prayerStats: {total: 0, answered: 0, pending: 0},
  });

  const screen = render(<ReviewScreen />);
  await waitFor(() => expect(getReviewCapture).toHaveBeenCalled());
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Begin monthly review'));
  });
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Next'));
  });

  expect(
    screen.getByText('No weekly bookmarks yet, so all moments are shown.'),
  ).toBeTruthy();
  expect(screen.getByText('I completed the next faithful step.')).toBeTruthy();
  expect(screen.queryByRole('tab', {name: /Weekly bookmarks/})).toBeNull();

  await act(async () => {
    fireEvent.press(screen.getByLabelText('Next'));
  });
  expect(screen.getByText('What patterns do you notice?')).toBeTruthy();
});

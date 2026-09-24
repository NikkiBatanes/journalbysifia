import React from 'react';
import {
  AccessibilityInfo,
  FlatList,
  StyleSheet,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';

import ReviewScreen from '../ReviewScreen';
import {getReviewCapture} from '../../services/reviewCaptureService';
import {
  getMonthlyCheckInFeelings,
  getMonthlyLifeCheckInSummary,
  getMonthlyLookingForwardFeelings,
  getMonthlyWeeklyReviewFeelings,
} from '../../services/weeklyFeelingService';
import {
  createLocalReview,
  getLocalReviewForPeriod,
} from '../../storage/reviewStorage';
import {saveMonthlyReviewPrayer} from '../../services/monthlyReviewPrayerService';

const mockNavigation = {goBack: jest.fn(), navigate: jest.fn()};
const mockRouteParams: {
  type: string;
  periodStart: string;
  periodEnd: string;
  reviewId?: string;
  resumeLastStage?: boolean;
} = {
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
  getMonthlyLifeCheckInSummary: jest.fn(),
  getMonthlyLookingForwardFeelings: jest.fn(),
  getMonthlyWeeklyReviewFeelings: jest.fn(),
}));
jest.mock('../../services/faithfulRhythmService', () => ({
  claimFaithfulRhythmCelebration: jest.fn(),
}));
jest.mock('../../services/weeklyGratitudeService', () => ({
  saveWeeklyGratitudeMoment: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../services/monthlyReviewPrayerService', () => ({
  saveMonthlyReviewPrayer: jest.fn().mockResolvedValue(null),
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
  (getMonthlyLookingForwardFeelings as jest.Mock).mockResolvedValue([
    {
      name: 'Hopeful',
      count: 2,
      dates: ['2026-08-03', '2026-08-17'],
    },
    {name: 'Trusting', count: 1, dates: ['2026-08-11']},
  ]);
  (getMonthlyLifeCheckInSummary as jest.Mock).mockResolvedValue({
    reviewCount: 2,
    insight:
      'Relationships were the most supported. Rest needed the most care.',
    areas: [
      {
        key: 'relationships',
        label: 'Relationships',
        icon: 'heart-multiple-outline',
        values: ['well', 'well'],
        counts: {struggling: 0, okay: 0, well: 2},
        answeredWeeks: 2,
        interpretation: 'Consistently well',
        trend: 'steady',
        trendLabel: 'Stayed steady',
        score: 2,
      },
      {
        key: 'rest',
        label: 'Rest',
        icon: 'bed-outline',
        values: ['struggling', 'okay'],
        counts: {struggling: 1, okay: 1, well: 0},
        answeredWeeks: 2,
        interpretation: 'Mixed through the month',
        trend: 'improving',
        trendLabel: 'Improved by month’s end',
        score: 0.5,
      },
    ],
  });
  delete mockRouteParams.reviewId;
  delete mockRouteParams.resumeLastStage;
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

  const monthHeading = screen.getByText('August');
  expect(StyleSheet.flatten(monthHeading.props.style)).toMatchObject({
    fontSize: 35,
    lineHeight: 43,
  });
  expect(screen.getByText('Now, let’s look back.')).toBeTruthy();

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

it('continues a monthly review at the last visited page', async () => {
  const firstVisit = render(<ReviewScreen />);
  await waitFor(() => expect(getReviewCapture).toHaveBeenCalled());
  await act(async () => {
    fireEvent.press(firstVisit.getByLabelText('Begin monthly review'));
  });
  await act(async () => {
    fireEvent.press(firstVisit.getByLabelText('Next'));
  });
  expect(firstVisit.getByText('What shaped this month?')).toBeTruthy();
  await waitFor(async () =>
    expect(
      (
        await getLocalReviewForPeriod(
          'monthly',
          '2026-08-01',
          '2026-08-31',
        )
      )?.lastStageKey,
    ).toBe('captured'),
  );
  firstVisit.unmount();

  const resumedVisit = render(<ReviewScreen />);
  await waitFor(() =>
    expect(
      resumedVisit.getByLabelText('Continue monthly review'),
    ).toBeTruthy(),
  );
  await act(async () => {
    fireEvent.press(
      resumedVisit.getByLabelText('Continue monthly review'),
    );
  });
  expect(resumedVisit.getByText('What shaped this month?')).toBeTruthy();
});

it('reminds the user of recorded wins without asking for another response', async () => {
  (getReviewCapture as jest.Mock).mockResolvedValue({
    items: [
      {
        id: 'win-1',
        selectedDate: '2026-08-18',
        kind: 'win',
        presentation: 'today_win',
        title: 'I followed through',
        text: 'I completed the next faithful step.',
        detail: 'Progress',
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
  for (let step = 0; step < 4; step += 1) {
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Next'));
    });
  }

  expect(screen.getByText('You had wins worth remembering.')).toBeTruthy();
  expect(screen.getByText('I completed the next faithful step.')).toBeTruthy();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.UNSAFE_queryByType(TextInput)).toBeNull();
  expect(screen.UNSAFE_queryByType(FlatList)).toBeNull();
});

it('uses a focused monthly prayer and saves it to Moments on completion', async () => {
  const draft = await createLocalReview({
    type: 'monthly',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    lastStageKey: 'prayer_for_month',
    memorableItems: [],
    answers: {},
  });
  mockRouteParams.reviewId = draft.id;
  mockRouteParams.resumeLastStage = true;

  const screen = render(<ReviewScreen />);
  await waitFor(() =>
    expect(screen.getByText('Pray over your month')).toBeTruthy(),
  );
  expect(screen.getByText('Bring the month ahead to God.')).toBeTruthy();
  expect(screen.queryByText('Add a new prayer')).toBeNull();
  expect(screen.queryByRole('checkbox')).toBeNull();

  fireEvent.changeText(
    screen.getByLabelText('Your words to God for the month (optional)'),
    'God, lead me through this month with wisdom.',
  );
  await waitFor(async () =>
    expect(
      (
        await getLocalReviewForPeriod(
          'monthly',
          '2026-08-01',
          '2026-08-31',
        )
      )?.answers.prayer_for_month,
    ).toBe('God, lead me through this month with wisdom.'),
  );

  await act(async () => {
    fireEvent.press(screen.getByLabelText('Next'));
  });
  fireEvent.press(screen.getByRole('tab', {name: 'Looking Ahead'}));
  expect(screen.getByText('Your prayer for the month')).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Finish monthly review'));
  });
  await waitFor(() =>
    expect(saveMonthlyReviewPrayer).toHaveBeenCalledWith({
      text: 'God, lead me through this month with wisdom.',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      reviewId: draft.id,
    }),
  );
  await waitFor(async () =>
    expect(
      (
        await getLocalReviewForPeriod(
          'monthly',
          '2026-08-01',
          '2026-08-31',
        )
      )?.answers.month_pattern_summary,
    ).toBe(
      'Hopeful appeared most often in your mornings (2 days). Across your weekly check-ins, Peaceful showed up most often (2×). Looking toward the next day, Hopeful appeared most often (2 days).',
    ),
  );
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
    name: /Remove heart.*Hopeful.*A new opportunity opened up/,
  });
  expect(weeklyBookmark.props.accessibilityState.checked).toBe(true);
  expect(within(weeklyBookmark).UNSAFE_getByProps({name: 'heart'})).toBeTruthy();

  fireEvent.press(screen.getByRole('tab', {name: 'More moments, 1'}));

  expect(screen.getByText('Gratitudes')).toBeTruthy();
  expect(screen.queryByText('Hopeful')).toBeNull();
  expect(screen.getByText('GRATITUDE LIST')).toBeTruthy();
  expect(screen.getByText('A quiet morning')).toBeTruthy();

  const gratitudeCard = screen.getByRole('checkbox', {
    name: /Heart this moment.*Gratitude/,
  });
  fireEvent.press(gratitudeCard);
  await waitFor(() =>
    expect(
      screen.getByRole('checkbox', {
        name: /Remove heart.*Gratitude/,
      }).props.accessibilityState.checked,
    ).toBe(true),
  );

  await act(async () => {
    fireEvent.press(screen.getByLabelText('Next'));
  });
  expect(screen.getByText('What patterns do you notice?')).toBeTruthy();
  expect(
    screen.getByText('Here’s what showed up across the month.'),
  ).toBeTruthy();
  expect(screen.getByText('WHAT YOUR CHECK-INS SHOW')).toBeTruthy();
  expect(
    screen.getByText(
      'Hopeful appeared most often in your mornings (2 days). Across your weekly check-ins, Peaceful showed up most often (2×). Looking toward the next day, Hopeful appeared most often (2 days).',
    ),
  ).toBeTruthy();
  expect(
    screen.getByRole('tab', {name: 'Morning check-ins, 3', selected: true}),
  ).toBeTruthy();
  expect(
    screen.getByRole('tab', {name: 'Weekly check-ins, 2', selected: false}),
  ).toBeTruthy();
  expect(
    screen.getByRole('tab', {
      name: 'Looking Forward reflections, 3',
      selected: false,
    }),
  ).toBeTruthy();
  expect(screen.getByText('MORNING CHECK-INS')).toBeTruthy();
  expect(screen.getByText('Hopeful')).toBeTruthy();
  expect(screen.getByText('2 days')).toBeTruthy();
  expect(screen.getByText('Tired')).toBeTruthy();
  expect(screen.getByText('1 day')).toBeTruthy();
  expect(
    StyleSheet.flatten(
      screen.getByTestId('monthly-pattern-bar-morning-hopeful').props.style,
    ).width,
  ).toBe('100%');
  expect(
    StyleSheet.flatten(
      screen.getByTestId('monthly-pattern-bar-morning-hopeful').props.style,
    ).backgroundColor,
  ).toBe('#718476');
  expect(
    StyleSheet.flatten(
      screen.getByTestId('monthly-pattern-bar-morning-tired').props.style,
    ).width,
  ).toBe('50%');
  expect(
    StyleSheet.flatten(
      screen.getByTestId('monthly-pattern-bar-morning-tired').props.style,
    ).backgroundColor,
  ).toBe('#D97872');
  fireEvent.press(screen.getByRole('tab', {name: 'Weekly check-ins, 2'}));
  expect(screen.getByText('WEEKLY CHECK-INS')).toBeTruthy();
  expect(screen.getByText('Peaceful')).toBeTruthy();
  expect(screen.getByText('2×')).toBeTruthy();
  expect(screen.getByText('Wrestling')).toBeTruthy();
  expect(screen.getByText('1×')).toBeTruthy();
  expect(
    StyleSheet.flatten(
      screen.getByTestId('monthly-pattern-bar-weekly-peaceful').props.style,
    ).width,
  ).toBe('100%');
  expect(
    StyleSheet.flatten(
      screen.getByTestId('monthly-pattern-bar-weekly-peaceful').props.style,
    ).backgroundColor,
  ).toBe('#718476');
  expect(
    StyleSheet.flatten(
      screen.getByTestId('monthly-pattern-bar-weekly-wrestling').props.style,
    ).backgroundColor,
  ).toBe('#D97872');

  fireEvent.press(
    screen.getByRole('tab', {name: 'Looking Forward reflections, 3'}),
  );
  expect(
    screen.getByText('LOOKING FORWARD TO THE NEXT DAY, YOU FELT…'),
  ).toBeTruthy();
  expect(screen.getByText('Trusting')).toBeTruthy();
  expect(
    StyleSheet.flatten(
      screen.getByTestId('monthly-pattern-bar-looking-forward-hopeful').props
        .style,
    ).width,
  ).toBe('100%');
  expect(
    StyleSheet.flatten(
      screen.getByTestId('monthly-pattern-bar-looking-forward-hopeful').props
        .style,
    ).backgroundColor,
  ).toBe('#718476');

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

  await act(async () => {
    fireEvent.press(screen.getByLabelText('Next'));
  });
  expect(screen.getByText('How were you this month?')).toBeTruthy();
  expect(
    screen.getByText('A synthesis of 2 weekly Whole-life check-ins.'),
  ).toBeTruthy();
  expect(
    screen.getByText(
      'Relationships were the most supported. Rest needed the most care.',
    ),
  ).toBeTruthy();
  expect(screen.getByText('Consistently well')).toBeTruthy();
  expect(screen.getByText('Improved by month’s end')).toBeTruthy();
  expect(screen.getByLabelText('Week 1: Needs care')).toBeTruthy();

  await act(async () => {
    fireEvent.press(screen.getByLabelText('Next'));
  });
  expect(screen.getByText('What gave you life this month?')).toBeTruthy();
  expect(screen.getByLabelText('Time with God')).toBeTruthy();
  expect(screen.getByLabelText('Time with family')).toBeTruthy();
  expect(screen.getByLabelText('Walking or movement')).toBeTruthy();
  expect(screen.getByLabelText('A simpler pace')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Time with God'));
  fireEvent.press(screen.getByLabelText('Meaningful conversations'));
  fireEvent.press(screen.getByLabelText('Other'));
  fireEvent.changeText(
    screen.getByLabelText('What gave you life this month? Other'),
    'Making music',
  );
  expect(
    screen.getByLabelText('Creative work').props.accessibilityState.disabled,
  ).toBe(true);
  await waitFor(async () =>
    expect(
      await getLocalReviewForPeriod('monthly', '2026-08-01', '2026-08-31'),
    ).toMatchObject({
      answers: {
        month_life_giving: 'Time with God|Meaningful conversations|Other',
        month_life_giving_other: 'Making music',
      },
    }),
  );

  await act(async () => {
    fireEvent.press(screen.getByLabelText('Next'));
  });
  expect(screen.getByText('What drained you this month?')).toBeTruthy();
  expect(screen.getByLabelText('Carrying too much')).toBeTruthy();
  expect(screen.getByLabelText('Comparison')).toBeTruthy();
  expect(screen.getByLabelText('Unhealthy rhythms')).toBeTruthy();
  expect(screen.getByLabelText('Feeling spiritually dry')).toBeTruthy();
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

it('expands every selected More room area into optional specifics', async () => {
  const screen = render(<ReviewScreen />);
  await waitFor(() => expect(getReviewCapture).toHaveBeenCalled());

  await act(async () => {
    fireEvent.press(screen.getByLabelText('Begin monthly review'));
  });
  for (let index = 0; index < 9; index += 1) {
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Next'));
    });
  }

  expect(screen.getByText('Now, let’s look ahead.')).toBeTruthy();
  fireEvent.press(
    screen.getByLabelText('Continue to monthly looking ahead'),
  );
  expect(
    screen.getByText('What do you want to make more room for?'),
  ).toBeTruthy();

  fireEvent.press(screen.getByRole('button', {name: 'Rest'}));
  expect(screen.getByText('Make it more specific')).toBeTruthy();
  const betterSleep = screen.getByRole('button', {
    name: 'Rest: Better sleep',
  });
  fireEvent.press(betterSleep);

  fireEvent.press(screen.getByRole('button', {name: 'Time with God'}));
  const scriptureReading = screen.getByRole('button', {
    name: 'Time with God: Scripture reading',
  });
  const discipleship = screen.getByRole('button', {
    name: 'Time with God: Discipleship',
  });
  fireEvent.press(scriptureReading);
  fireEvent.press(discipleship);

  await waitFor(async () =>
    expect(
      await getLocalReviewForPeriod('monthly', '2026-08-01', '2026-08-31'),
    ).toMatchObject({
      answers: expect.objectContaining({
        month_more_room: 'Rest|Time with God',
        month_more_room_rest: 'Better sleep',
        month_more_room_with_god: 'Scripture reading|Discipleship',
      }),
    }),
  );

  fireEvent.press(screen.getByLabelText('Next'));
  expect(screen.getByText('What needs care next month?')).toBeTruthy();
  expect(screen.getByText('Needs attention')).toBeTruthy();
  expect(screen.getByText('· Appeared in 1 weekly check-in')).toBeTruthy();
  expect(screen.queryByText('1×')).toBeNull();

  fireEvent.press(screen.getByLabelText('Next'));
  expect(screen.getByText('What do you want to leave behind?')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', {name: 'Comparison'}));
  const comparingTimelines = screen.getByRole('button', {
    name: 'Comparison: Comparing timelines',
  });
  const socialComparison = screen.getByRole('button', {
    name: 'Comparison: Social media comparison',
  });
  fireEvent.press(comparingTimelines);
  fireEvent.press(socialComparison);
  fireEvent.press(
    screen.getByRole('button', {name: 'Striving and self-reliance'}),
  );
  const carryingWhatBelongsToGod = screen.getByRole('button', {
    name: 'Striving and self-reliance: Carrying what belongs to God',
  });
  fireEvent.press(carryingWhatBelongsToGod);

  await waitFor(async () =>
    expect(
      await getLocalReviewForPeriod('monthly', '2026-08-01', '2026-08-31'),
    ).toMatchObject({
      answers: expect.objectContaining({
        month_leave_behind: 'Comparison|Striving and self-reliance',
        month_leave_behind_comparison:
          'Comparing timelines|Social media comparison',
        month_leave_behind_self_reliance: 'Carrying what belongs to God',
      }),
    }),
  );
});

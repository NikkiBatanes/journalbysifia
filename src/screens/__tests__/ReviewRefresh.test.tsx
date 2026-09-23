import React from 'react';
import {AccessibilityInfo} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import ReviewScreen from '../ReviewScreen';
import {createLocalReview, getLocalReviewForPeriod} from '../../storage/reviewStorage';
import {getReviewCapture, type ReviewCapture} from '../../services/reviewCaptureService';

let mockFocused = true;
const mockNavigation = {goBack: jest.fn()};
const mockRouteParams = {type: 'weekly', periodStart: '2026-09-14', periodEnd: '2026-09-20'};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({params: mockRouteParams}),
  useFocusEffect: (effect: () => void) => {
    require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]);
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
}));
jest.mock('../../context/IndustryStandardAuthContext', () => ({useAuth: () => ({preferences: {weekStart: 'monday'}})}));
jest.mock('../../components/common/ThemedText', () => require('react-native').Text);
jest.mock('../../components/common/HeaderBackButton', () => require('react-native').Pressable);
jest.mock('../../components/journal/SavedReflectionBlocks', () => 'ReflectionBlocks');
jest.mock('../../components/journal/FocusPriorityInputs', () => 'FocusPriorityInputs');
jest.mock('../../components/journal/GratitudeListReactQuery', () => ({GratitudeListReactQuery: () => null}));
jest.mock('../../components/scripture/ProverbVerseExcerpt', () => 'ProverbVerseExcerpt');
jest.mock('../../components/common/PrayerHandsIcon', () => 'PrayerHandsIcon');
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-vector-icons/FontAwesome6', () => 'Icon');
jest.mock('react-native-vector-icons/Entypo', () => 'Icon');
jest.mock('lucide-react-native', () => ({BookHeart: 'Icon', Pencil: 'Icon'}));
jest.mock('../../hooks/useFloatingKeyboardButton', () => ({useFloatingKeyboardButton: () => ({bottom: 20, keyboardVisible: false})}));
jest.mock('../../utils/haptics', () => ({triggerLightHaptic: jest.fn()}));
jest.mock('../../services/reviewCaptureService', () => ({getReviewCapture: jest.fn()}));
jest.mock('../../services/weeklyRhythmService', () => ({getWeeklyRhythm: jest.fn().mockResolvedValue({activeDays: 7, days: [], morning: 7, evening: 7})}));
jest.mock('../../services/weeklyFeelingService', () => ({getWeeklyCheckInFeelings: jest.fn().mockResolvedValue([])}));
jest.mock('../../services/faithfulRhythmService', () => ({claimFaithfulRhythmCelebration: jest.fn()}));
jest.mock('../../services/weeklyGratitudeService', () => ({saveWeeklyGratitudeMoment: jest.fn().mockResolvedValue(null)}));

const emptyCapture: ReviewCapture = {
  periodStart: mockRouteParams.periodStart,
  periodEnd: mockRouteParams.periodEnd,
  items: [],
  summary: {sermon: 0, prayer: 0, reflection: 0, scripture: 0, journal: 0, gratitude: 0, win: 0, morning: 0, evening: 0},
  prayerStats: {total: 0, answered: 0, pending: 0},
};
const filledCapture: ReviewCapture = {
  ...emptyCapture,
  items: [{id: 'new-moment', selectedDate: '2026-09-20', kind: 'journal', presentation: 'heart_journal', title: 'A moment saved this week'}],
  summary: {...emptyCapture.summary, journal: 1},
};

type Screen = ReturnType<typeof render>;
const changeFocus = (screen: Screen, focused: boolean) => {
  mockFocused = focused;
  screen.rerender(<ReviewScreen/>);
};
const openMoments = async (screen: Screen) => {
  await waitFor(() => expect(screen.getByLabelText(/(?:Begin|Continue) weekly review/)).toBeTruthy());
  await act(async () => {fireEvent.press(screen.getByLabelText(/(?:Begin|Continue) weekly review/));});
  await act(async () => {fireEvent.press(screen.getByLabelText('Next'));});
  await act(async () => {fireEvent.press(screen.getByLabelText('Next'));});
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
  const store = new Map<string, string>();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async key => store.get(key) ?? null);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => {store.set(key, value);});
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  (getReviewCapture as jest.Mock).mockResolvedValue(emptyCapture);
});
afterEach(() => jest.restoreAllMocks());

it('shows a loading state until the week is available instead of showing an empty review', async () => {
  let finish!: (capture: ReviewCapture) => void;
  (getReviewCapture as jest.Mock).mockReturnValueOnce(new Promise(resolve => {finish = resolve;}));
  const screen = render(<ReviewScreen/>);
  await waitFor(() => expect(getReviewCapture).toHaveBeenCalled());
  expect(screen.getByText('Loading your review…')).toBeTruthy();
  expect(screen.queryByText('0 days this week')).toBeNull();
  expect(screen.queryByLabelText('Begin weekly review')).toBeNull();
  await act(async () => {finish(filledCapture);});
  expect(screen.getByText('7 days this week')).toBeTruthy();
  expect(screen.getByText('thought')).toBeTruthy();
  await openMoments(screen);
  expect(screen.getByText('A moment saved this week')).toBeTruthy();
});

it('refreshes a mounted review after filling the week and returning from Today, preserving draft progress', async () => {
  await createLocalReview({
    type: 'weekly', periodStart: mockRouteParams.periodStart, periodEnd: mockRouteParams.periodEnd,
    memorableItems: [], answers: {week_feelings: 'Tired'},
  });
  const screen = render(<ReviewScreen/>);
  await openMoments(screen);
  expect(screen.getByText('No journal moments were captured this week.')).toBeTruthy();

  changeFocus(screen, false);
  (getReviewCapture as jest.Mock).mockResolvedValue(filledCapture);
  changeFocus(screen, true);
  await waitFor(() => expect(screen.getByText('A moment saved this week')).toBeTruthy());
  expect(getReviewCapture).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('No journal moments were captured this week.')).toBeNull();
  await act(async () => {fireEvent.press(screen.getByRole('checkbox'));});
  const saved = await getLocalReviewForPeriod('weekly', mockRouteParams.periodStart, mockRouteParams.periodEnd);
  expect(saved?.answers.week_feelings).toBe('Tired');
  expect(saved?.memorableItems).toEqual([expect.objectContaining({id: 'new-moment'})]);
});

it('ignores an older visit that finishes loading after the refreshed week', async () => {
  let finishOld!: (capture: ReviewCapture) => void;
  (getReviewCapture as jest.Mock).mockReturnValueOnce(new Promise(resolve => {finishOld = resolve;}));
  const screen = render(<ReviewScreen/>);
  await waitFor(() => expect(getReviewCapture).toHaveBeenCalledTimes(1));
  changeFocus(screen, false);
  (getReviewCapture as jest.Mock).mockResolvedValue(filledCapture);
  changeFocus(screen, true);
  await waitFor(() => expect(screen.getByText('thought')).toBeTruthy());
  await act(async () => {finishOld(emptyCapture);});
  expect(screen.getByText('thought')).toBeTruthy();
  await openMoments(screen);
  expect(screen.getByText('A moment saved this week')).toBeTruthy();
});

it('lets a failed load recover without restarting the app', async () => {
  (getReviewCapture as jest.Mock).mockRejectedValueOnce(new Error('Temporary storage failure'));
  const screen = render(<ReviewScreen/>);
  await waitFor(() => expect(screen.getByText('We couldn’t load your review.')).toBeTruthy());
  expect(screen.queryByLabelText('Begin weekly review')).toBeNull();
  (getReviewCapture as jest.Mock).mockResolvedValue(filledCapture);
  fireEvent.press(screen.getByText('Try again'));
  await waitFor(() => expect(screen.getByText('thought')).toBeTruthy());
  expect(screen.queryByText('We couldn’t load your review.')).toBeNull();
});

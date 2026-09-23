import React from 'react';
import {AccessibilityInfo, FlatList, ScrollView, StyleSheet, TextInput} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import ReviewScreen from '../ReviewScreen';
import ReviewReaderScreen from '../ReviewReaderScreen';
import {createLocalReview, getLocalReviewForPeriod} from '../../storage/reviewStorage';
import {getReviewCapture} from '../../services/reviewCaptureService';
import {saveWeeklyReviewPrayer} from '../../services/weeklyReviewPrayerService';

const mockRouteParams: Record<string, string> = {
  type: 'weekly', periodStart: '2026-09-14', periodEnd: '2026-09-20',
};
const mockKeyboardState = {bottom: 20, keyboardVisible: false, keyboardHeight: 0};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
  useRoute: () => ({params: mockRouteParams}),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
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
jest.mock('../../components/journal/GratitudeVerse', () => 'GratitudeVerse');
jest.mock('../../components/journal/GratitudeListReactQuery', () => ({GratitudeListReactQuery: () => null}));
jest.mock('../../components/scripture/ProverbVerseExcerpt', () => 'ProverbVerseExcerpt');
jest.mock('../../components/common/PrayerHandsIcon', () => 'PrayerHandsIcon');
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-vector-icons/FontAwesome6', () => 'Icon');
jest.mock('react-native-vector-icons/Entypo', () => 'Icon');
jest.mock('lucide-react-native', () => ({BookHeart: 'Icon', Pencil: 'Icon'}));
jest.mock('../../hooks/useFloatingKeyboardButton', () => ({useFloatingKeyboardButton: () => mockKeyboardState}));
jest.mock('../../utils/haptics', () => ({triggerLightHaptic: jest.fn()}));
jest.mock('../../services/reviewCaptureService', () => ({getReviewCapture: jest.fn()}));
jest.mock('../../services/weeklyRhythmService', () => ({getWeeklyRhythm: jest.fn().mockResolvedValue(null)}));
jest.mock('../../services/weeklyFeelingService', () => ({getWeeklyCheckInFeelings: jest.fn().mockResolvedValue([])}));
jest.mock('../../services/faithfulRhythmService', () => ({claimFaithfulRhythmCelebration: jest.fn()}));
jest.mock('../../services/weeklyGratitudeService', () => ({saveWeeklyGratitudeMoment: jest.fn().mockResolvedValue(null)}));
jest.mock('../../services/weeklyReviewPrayerService', () => ({saveWeeklyReviewPrayer: jest.fn().mockResolvedValue(null)}));
jest.mock('../PastReviewsScreen', () => ({formatReviewPeriod: () => 'September 14–20, 2026'}));

const savedReview = () => getLocalReviewForPeriod('weekly', mockRouteParams.periodStart, mockRouteParams.periodEnd);
type Screen = ReturnType<typeof render>;
const next = async (screen: Screen) => {
  await act(async () => {fireEvent.press(screen.getByLabelText('Next'));});
};
const begin = async (screen: Screen) => {
  await waitFor(() => expect(getReviewCapture).toHaveBeenCalled());
  await act(async () => {
    fireEvent.press(screen.getByLabelText(/(?:Begin|Continue) weekly review/));
  });
};
const openGodFaithfulness = async (screen: Screen) => {
  await begin(screen);
  for (let step = 0; step < 6; step += 1) {await next(screen);}
  expect(screen.getByText('How did God meet you this week?')).toBeTruthy();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockKeyboardState.keyboardVisible = false;
  mockKeyboardState.keyboardHeight = 0;
  const store = new Map<string, string>();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async key => store.get(key) ?? null);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => {store.set(key, value);});
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  (getReviewCapture as jest.Mock).mockResolvedValue({items: [], counts: {}, prayerStats: {}});
  delete mockRouteParams.reviewId;
});

afterEach(() => jest.restoreAllMocks());

it('starts review progress after the weekly cover', async () => {
  const screen = render(<ReviewScreen/>);
  await waitFor(() => expect(screen.getByLabelText('Begin weekly review')).toBeTruthy());
  expect(screen.queryByTestId('review-progress-bar')).toBeNull();
  await begin(screen);
  expect(screen.getByText('How did this week feel?')).toBeTruthy();
  expect(screen.getByTestId('review-progress-bar')).toBeTruthy();
  expect(StyleSheet.flatten(screen.getByTestId('review-progress-fill').props.style).width).toBe('6.666666666666667%');
});

it.each([false, true])('reveals Other after layout and keyboard resize (expanded choices: %s)', async expanded => {
  let focused = false;
  const focus = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {focused = true;});
  jest.spyOn(TextInput.prototype, 'isFocused').mockImplementation(() => focused);
  const reveal = jest.spyOn(ScrollView.prototype, 'scrollResponderScrollNativeHandleToKeyboard');
  const screen = render(<ReviewScreen/>);
  await begin(screen);
  if (expanded) {
    await act(async () => {fireEvent.press(screen.getByText('Show more'));});
  }
  await act(async () => {fireEvent.press(screen.getByText('Other'));});
  const input = screen.getByLabelText('Write it in your own words');
  const layout = {nativeEvent: {layout: {x: 0, y: 0, width: 350, height: 52}}};
  expect(focus).not.toHaveBeenCalled();
  fireEvent(input, 'layout', layout);
  expect(focus).toHaveBeenCalledTimes(1);
  expect(reveal).toHaveBeenCalledWith(screen.UNSAFE_getByType(TextInput).instance, 80, true);

  mockKeyboardState.keyboardVisible = true;
  mockKeyboardState.keyboardHeight = 380;
  screen.rerender(<ReviewScreen/>);
  const scrollView = screen.UNSAFE_getByType(ScrollView);
  expect(StyleSheet.flatten(scrollView.props.contentContainerStyle).paddingBottom).toBeGreaterThan(380 + 60);
  reveal.mockClear();
  fireEvent(scrollView, 'contentSizeChange', 390, 1200);
  expect(reveal).toHaveBeenCalled();
  fireEvent(input, 'layout', layout);
  expect(focus).toHaveBeenCalledTimes(1);

  fireEvent.changeText(input, 'Restless');
  await waitFor(async () => expect((await savedReview())?.answers.week_feeling_other).toBe('Restless'));
  focused = false;
  reveal.mockClear();
  fireEvent(scrollView, 'contentSizeChange', 390, 1250);
  expect(reveal).not.toHaveBeenCalled();
});

it('does not focus or scroll a saved Other feeling until the user edits it', async () => {
  await createLocalReview({
    type: 'weekly', periodStart: mockRouteParams.periodStart, periodEnd: mockRouteParams.periodEnd,
    memorableItems: [], answers: {week_feeling_other: 'Restless'},
  });
  const focus = jest.spyOn(TextInput.prototype, 'focus');
  jest.spyOn(TextInput.prototype, 'isFocused').mockReturnValue(false);
  const reveal = jest.spyOn(ScrollView.prototype, 'scrollResponderScrollNativeHandleToKeyboard');
  const screen = render(<ReviewScreen/>);
  await begin(screen);
  fireEvent(screen.getByLabelText('Write it in your own words'), 'layout', {
    nativeEvent: {layout: {x: 0, y: 0, width: 350, height: 52}},
  });
  fireEvent(screen.UNSAFE_getByType(ScrollView), 'contentSizeChange', 390, 900);
  expect(focus).not.toHaveBeenCalled();
  expect(reveal).not.toHaveBeenCalled();
});

it.each([false, true])('reveals Write my own for God’s faithfulness (keyboard already open: %s)', async keyboardAlreadyOpen => {
  const screen = render(<ReviewScreen/>);
  await openGodFaithfulness(screen);
  let focused = false;
  const focus = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {focused = true;});
  jest.spyOn(TextInput.prototype, 'isFocused').mockImplementation(() => focused);
  const reveal = jest.spyOn(ScrollView.prototype, 'scrollResponderScrollNativeHandleToKeyboard');
  mockKeyboardState.keyboardVisible = keyboardAlreadyOpen;
  mockKeyboardState.keyboardHeight = keyboardAlreadyOpen ? 380 : 0;
  screen.rerender(<ReviewScreen/>);
  await act(async () => {fireEvent.press(screen.getByText('Provided for me'));});
  await act(async () => {fireEvent.press(screen.getByText('Write my own'));});

  const input = screen.getByLabelText('Write how God met you this week');
  expect(focus).not.toHaveBeenCalled();
  fireEvent(input, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 340, height: 112}}});
  expect(focus).toHaveBeenCalledTimes(1);
  expect(reveal).toHaveBeenCalledWith(screen.UNSAFE_getByType(TextInput).instance, 80, true);

  mockKeyboardState.keyboardVisible = true;
  mockKeyboardState.keyboardHeight = 380;
  screen.rerender(<ReviewScreen/>);
  const scrollView = screen.UNSAFE_getByType(ScrollView);
  expect(StyleSheet.flatten(scrollView.props.contentContainerStyle).paddingBottom).toBeGreaterThan(380 + 60);
  reveal.mockClear();
  fireEvent(scrollView, 'contentSizeChange', 390, 1400);
  expect(reveal).toHaveBeenCalled();

  fireEvent.changeText(input, 'Through a timely conversation.');
  await waitFor(async () => expect((await savedReview())?.answers).toMatchObject({
    god: 'Provided for me', god_faithfulness_other: 'Through a timely conversation.',
  }));
  reveal.mockClear();
  fireEvent(input, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 340, height: 184}}});
  expect(focus).toHaveBeenCalledTimes(1);
  expect(reveal).toHaveBeenCalled();

  focused = false;
  reveal.mockClear();
  fireEvent(scrollView, 'contentSizeChange', 390, 1472);
  expect(reveal).not.toHaveBeenCalled();
});

it('keeps a saved God’s faithfulness response visible without automatically focusing it', async () => {
  await createLocalReview({
    type: 'weekly', periodStart: mockRouteParams.periodStart, periodEnd: mockRouteParams.periodEnd,
    memorableItems: [], answers: {god_faithfulness_other: 'Through a timely conversation.'},
  });
  const screen = render(<ReviewScreen/>);
  await openGodFaithfulness(screen);
  const focus = jest.spyOn(TextInput.prototype, 'focus');
  jest.spyOn(TextInput.prototype, 'isFocused').mockReturnValue(false);
  const reveal = jest.spyOn(ScrollView.prototype, 'scrollResponderScrollNativeHandleToKeyboard');
  const input = screen.getByLabelText('Write how God met you this week');
  expect(input.props.value).toBe('Through a timely conversation.');
  fireEvent(input, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 340, height: 112}}});
  fireEvent(screen.UNSAFE_getByType(ScrollView), 'contentSizeChange', 390, 1100);
  expect(focus).not.toHaveBeenCalled();
  expect(reveal).not.toHaveBeenCalled();
});

it('keeps the bookmark page separate and saves unlogged memories and reflections without replacing an older prayer', async () => {
  const oldPrayer = 'God, please help my family.';
  await createLocalReview({
    type: 'weekly', periodStart: mockRouteParams.periodStart, periodEnd: mockRouteParams.periodEnd,
    memorableItems: [], answers: {prayer: oldPrayer},
  });
  (getReviewCapture as jest.Mock).mockResolvedValue({
    items: [{id: 'moment-1', selectedDate: '2026-09-17', kind: 'journal', presentation: 'heart_journal', title: 'A quiet conversation', text: 'We finally had time to talk.'}],
    counts: {}, prayerStats: {},
  });

  const screen = render(<ReviewScreen/>);
  await begin(screen);
  fireEvent.press(screen.getByText('Tired'));
  await waitFor(async () => expect((await savedReview())?.answers.week_feelings).toBe('Tired'));
  await next(screen);
  expect(screen.getByText('How did these areas of life feel this week?')).toBeTruthy();
  await next(screen);
  expect(screen.getByText('Moments from this week')).toBeTruthy();
  expect(screen.queryByText('What you want to remember')).toBeNull();
  fireEvent.press(screen.getByRole('checkbox'));
  await waitFor(async () => expect((await savedReview())?.memorableItems).toHaveLength(1));
  await next(screen);
  expect(screen.getByText('What you want to remember')).toBeTruthy();
  expect(screen.getByRole('checkbox', {checked: true})).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText('Anything else you want to remember?'), 'A walk with my sister.');
  await waitFor(async () => expect((await savedReview())?.answers.week_memory_other).toBe('A walk with my sister.'));
  await next(screen);
  fireEvent.changeText(screen.getByLabelText('What felt difficult this week?'), 'A difficult conversation at work.');
  await waitFor(async () => expect((await savedReview())?.answers.week_difficulty).toBe('A difficult conversation at work.'));
  await next(screen);
  expect(screen.getByText('Looking back on this week, what do you want to thank God for?')).toBeTruthy();
  await next(screen);
  expect(screen.getByText('I’m still looking')).toBeTruthy();
  await next(screen);
  expect(screen.getByText(oldPrayer)).toBeTruthy();
  expect(screen.getByLabelText('What are you learning through this week?').props.value).toBe('');
  fireEvent.changeText(screen.getByLabelText('What are you learning through this week?'), 'I need time to listen.');
  await waitFor(async () => expect((await savedReview())?.answers.week_learning).toBe('I need time to listen.'));
  await next(screen);
  expect(screen.getByText('Now, let’s look ahead.')).toBeTruthy();
  expect((await savedReview())?.answers.prayer).toBe(oldPrayer);
  screen.unmount();
  expect(saveWeeklyReviewPrayer).not.toHaveBeenCalled();

  // Read the persisted answers after the editor has unmounted.
  mockRouteParams.reviewId = (await savedReview())!.id;
  const reader = render(<ReviewReaderScreen/>);
  await waitFor(() => expect(reader.getByText('I need time to listen.')).toBeTruthy());
  expect(reader.getByText('A walk with my sister.')).toBeTruthy();
  expect(reader.getByText('A difficult conversation at work.')).toBeTruthy();
  expect(reader.getByText(oldPrayer)).toBeTruthy();
  expect(reader.getByText('What are you still bringing to God?')).toBeTruthy();
});

it('allows a week with no logged moments to keep a memory and skip difficult or unresolved reflections', async () => {
  const screen = render(<ReviewScreen/>);
  await begin(screen);
  await next(screen);
  await next(screen);
  expect(screen.getByText('No journal moments were captured this week.')).toBeTruthy();
  await next(screen);
  expect(screen.getByText('You didn’t bookmark any moments from this week.')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Anything else you want to remember?'), 'Dinner with a friend.');
  await waitFor(async () => expect((await savedReview())?.answers.week_memory_other).toBe('Dinner with a friend.'));
  await next(screen);
  await next(screen);
  await next(screen);
  await next(screen);
  await next(screen);
  expect(screen.getByText('Now, let’s look ahead.')).toBeTruthy();
  expect((await savedReview())?.answers).toEqual({week_memory_other: 'Dinner with a friend.'});
  expect(saveWeeklyReviewPrayer).not.toHaveBeenCalled();
});

it('scrolls the additional memory field into view on focus without helper text', async () => {
  const scrollToInput = jest.fn();
  jest.spyOn(require('react-native'), 'findNodeHandle').mockReturnValue(42);
  jest.spyOn(FlatList.prototype, 'getScrollResponder').mockReturnValue({
    scrollResponderScrollNativeHandleToKeyboard: scrollToInput,
  } as any);
  const screen = render(<ReviewScreen/>);
  await begin(screen);
  await next(screen);
  await next(screen);
  await next(screen);

  expect(screen.getByText('Anything else you want to remember?')).toBeTruthy();
  expect(screen.queryByText(/A moment that mattered/)).toBeNull();
  fireEvent(screen.getByLabelText('Anything else you want to remember?'), 'focus');
  await waitFor(() => expect(scrollToInput).toHaveBeenCalledWith(expect.any(Number), 96, true));
});

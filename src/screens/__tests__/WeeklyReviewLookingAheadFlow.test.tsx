import React from 'react';
import {AccessibilityInfo, ScrollView, StyleSheet, TextInput} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import ReviewScreen from '../ReviewScreen';
import ReviewReaderScreen from '../ReviewReaderScreen';
import {createLocalReview, getLocalReviewForPeriod} from '../../storage/reviewStorage';
import {getReviewCapture} from '../../services/reviewCaptureService';
import * as reviewStorage from '../../storage/reviewStorage';
import {getLocalJournalSingleton} from '../../storage/journalStorage';
import {saveWeeklyReviewPrayer} from '../../services/weeklyReviewPrayerService';

const mockNavigation = {goBack: jest.fn(), navigate: jest.fn()};
const mockKeyboardState = {bottom: 20, keyboardVisible: false, keyboardHeight: 0};

const mockRouteParams: Record<string, string> = {
  type: 'weekly', periodStart: '2026-09-14', periodEnd: '2026-09-20',
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
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
jest.mock('../../hooks/useTheme', () => ({useTheme: () => ({currentFont: 'lexend'})}));
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

const openLookingAhead = async (screen: Screen) => {
  await begin(screen);
  for (let index = 0; index < 8; index += 1) {await next(screen);}
  expect(screen.getByText('Now, let’s look ahead.')).toBeTruthy();
  expect(screen.getByText('Sep 21–27, 2026')).toBeTruthy();
  await act(async () => {fireEvent.press(screen.getByLabelText('Continue to weekly priorities'));});
};

it.each([false, true])('scrolls the Needs Care Other field after layout (keyboard already open: %s)', async keyboardAlreadyOpen => {
  const screen = render(<ReviewScreen/>);
  await openLookingAhead(screen);
  await next(screen);
  expect(screen.getByText('What needs care this week?')).toBeTruthy();

  let focusedInput: TextInput | null = null;
  const focus = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(function (this: TextInput) {
    focusedInput = this;
  });
  jest.spyOn(TextInput.prototype, 'isFocused').mockImplementation(function (this: TextInput) {
    return focusedInput === this;
  });
  const reveal = jest.spyOn(ScrollView.prototype, 'scrollResponderScrollNativeHandleToKeyboard');
  mockKeyboardState.keyboardVisible = keyboardAlreadyOpen;
  mockKeyboardState.keyboardHeight = keyboardAlreadyOpen ? 380 : 0;
  screen.rerender(<ReviewScreen/>);
  await act(async () => {fireEvent.press(screen.getByLabelText('Other'));});

  const input = screen.getByLabelText('Other area that needs care this week');
  const inputInstance = screen.UNSAFE_getAllByType(TextInput)
    .find(node => node.props.accessibilityLabel === 'Other area that needs care this week')!.instance;
  const layout = {nativeEvent: {layout: {x: 0, y: 0, width: 350, height: 56}}};
  expect(focus).not.toHaveBeenCalled();
  fireEvent(input, 'layout', layout);
  expect(focus).toHaveBeenCalledTimes(1);
  expect(reveal).toHaveBeenCalledWith(inputInstance, 80, true);

  mockKeyboardState.keyboardVisible = true;
  mockKeyboardState.keyboardHeight = 380;
  screen.rerender(<ReviewScreen/>);
  const scrollView = screen.UNSAFE_getByType(ScrollView);
  expect(StyleSheet.flatten(scrollView.props.contentContainerStyle).paddingBottom).toBeGreaterThan(380 + 60);
  reveal.mockClear();
  fireEvent(scrollView, 'contentSizeChange', 390, 1400);
  expect(reveal).toHaveBeenCalledWith(inputInstance, 80, true);
  fireEvent(input, 'layout', layout);
  expect(focus).toHaveBeenCalledTimes(1);
  fireEvent.changeText(input, 'Preparing for a move');
  await waitFor(async () => expect((await savedReview())?.answers).toMatchObject({
    week_care_areas: 'other', week_care_other: 'Preparing for a move',
  }));

  const noteInstance = screen.UNSAFE_getAllByType(TextInput)
    .find(node => node.props.accessibilityLabel === 'A note about what needs care this week')!.instance;
  focusedInput = noteInstance;
  reveal.mockClear();
  fireEvent(scrollView, 'contentSizeChange', 390, 1450);
  expect(reveal).toHaveBeenCalledWith(noteInstance, 80, true);
  focusedInput = null;
  reveal.mockClear();
  fireEvent(scrollView, 'contentSizeChange', 390, 1500);
  expect(reveal).not.toHaveBeenCalled();
});

it('restores a saved Other care area without automatically focusing it', async () => {
  await createLocalReview({
    type: 'weekly', periodStart: mockRouteParams.periodStart, periodEnd: mockRouteParams.periodEnd,
    memorableItems: [], answers: {week_care_areas: 'other', week_care_other: 'Preparing for a move'},
  });
  const screen = render(<ReviewScreen/>);
  await openLookingAhead(screen);
  await next(screen);
  const focus = jest.spyOn(TextInput.prototype, 'focus');
  jest.spyOn(TextInput.prototype, 'isFocused').mockReturnValue(false);
  const reveal = jest.spyOn(ScrollView.prototype, 'scrollResponderScrollNativeHandleToKeyboard');
  const input = screen.getByLabelText('Other area that needs care this week');
  expect(input.props.value).toBe('Preparing for a move');
  fireEvent(input, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 350, height: 56}}});
  fireEvent(screen.UNSAFE_getByType(ScrollView), 'contentSizeChange', 390, 1000);
  expect(focus).not.toHaveBeenCalled();
  expect(reveal).not.toHaveBeenCalled();
});

it('saves the weekly walkthrough and a separate prayer, shows their text in the recap, allows edits, and finishes only on request', async () => {
  const screen = render(<ReviewScreen/>);
  await openLookingAhead(screen);
  expect(screen.queryByLabelText('Priority 2')).toBeNull();
  expect(screen.queryByText('+ Add another priority')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Priority 1'), 'Time with family');
  await waitFor(async () => expect((await savedReview())?.answers.priority_1).toBe('Time with family'));
  fireEvent.press(screen.getByLabelText('Add another priority'));
  fireEvent.changeText(screen.getByLabelText('Priority 2'), 'Finish my project');
  await waitFor(async () => expect((await savedReview())?.answers.priority_2).toBe('Finish my project'));
  fireEvent.press(screen.getByLabelText('Add another priority'));
  expect(screen.getByLabelText('Priority 3')).toBeTruthy();
  expect(screen.queryByLabelText('Add another priority')).toBeNull();
  await next(screen);
  fireEvent.press(screen.getByLabelText('Finances'));
  await waitFor(async () => expect((await savedReview())?.answers.week_care_areas).toBe('finances'));
  fireEvent.changeText(screen.getByLabelText('A note about what needs care this week'), 'Leave room for rest.');
  await next(screen);
  fireEvent.press(screen.getByLabelText('Anxiety'));
  await waitFor(async () => expect((await savedReview())?.answers.week_challenge_choices).toBe('anxiety'));
  await next(screen);
  expect(screen.getByText('How does this week feel right now?')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Hopeful'));
  await next(screen);
  expect(screen.getByText('What are you looking forward to this week?')).toBeTruthy();
  expect(screen.queryByLabelText('Your words to God (optional)')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('What are you looking forward to this week?'), 'Dinner with my sister.');
  await waitFor(async () => expect((await savedReview())?.answers.week_looking_forward).toBe('Dinner with my sister.'));
  await next(screen);
  expect(screen.getByText('Pray over your week')).toBeTruthy();
  expect(screen.queryByLabelText('What are you looking forward to this week?')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Your words to God (optional)'), 'Help me listen well.');
  await waitFor(async () => expect((await savedReview())?.answers.prayer_ahead).toBe('Help me listen well.'));
  await next(screen);
  expect(screen.getByRole('tab', {name: 'Looking Back', selected: true})).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Edit the hard parts'));
  fireEvent.changeText(screen.getByLabelText('What felt difficult this week?'), 'Taking on too much.');
  await next(screen);
  expect(screen.getByRole('tab', {name: 'Looking Back', selected: true})).toBeTruthy();
  expect(screen.getByText('Taking on too much.')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', {name: 'Looking Ahead'}));
  expect(screen.getByText('YOUR WEEK AHEAD')).toBeTruthy();
  expect(screen.getByText('Time with family')).toBeTruthy();
  expect(screen.getByText('Finish my project')).toBeTruthy();
  expect(screen.getByText('Finances')).toBeTruthy();
  expect(screen.getByText('Leave room for rest.')).toBeTruthy();
  expect(screen.getByText('Anxiety')).toBeTruthy();
  expect(screen.getByText('Dinner with my sister.')).toBeTruthy();
  expect(screen.getByText('Hopeful')).toBeTruthy();
  expect(screen.getByText('Help me listen well.')).toBeTruthy();
  expect((await savedReview())?.status).toBe('draft');
  expect(mockNavigation.goBack).not.toHaveBeenCalled();

  fireEvent.press(screen.getByLabelText('Edit what matters most'));
  expect(screen.getByLabelText('Priority 2').props.value).toBe('Finish my project');
  fireEvent.changeText(screen.getByLabelText('Priority 2'), '');
  expect(screen.getByLabelText('Priority 2').props.value).toBe('');
  fireEvent.changeText(screen.getByLabelText('Priority 2'), 'Finish my project');
  fireEvent.changeText(screen.getByLabelText('Priority 1'), 'A quiet dinner with family');
  await waitFor(async () => expect((await savedReview())?.answers.priority_1).toBe('A quiet dinner with family'));
  await next(screen);
  expect(screen.getByText('YOUR WEEK AHEAD')).toBeTruthy();
  expect(screen.getByText('A quiet dinner with family')).toBeTruthy();
  expect(screen.getByText('Finish my project')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Edit looking forward to this week'));
  expect(screen.getByLabelText('Hopeful').props.accessibilityState.selected).toBe(true);
  await next(screen);
  expect(screen.getByLabelText('What are you looking forward to this week?').props.value).toBe('Dinner with my sister.');
  expect(screen.queryByText('YOUR WEEK AHEAD')).toBeNull();
  await next(screen);
  expect(screen.getByText('YOUR WEEK AHEAD')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Edit your prayer for the week'));
  expect(screen.getByLabelText('Your words to God (optional)').props.value).toBe('Help me listen well.');
  expect(screen.queryByLabelText('What are you looking forward to this week?')).toBeNull();
  await next(screen);
  expect(screen.getByText('Help me listen well.')).toBeTruthy();
  await act(async () => {fireEvent.press(screen.getByLabelText('Finish weekly review'));});
  await waitFor(async () => expect((await savedReview())?.status).toBe('completed'));
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  expect(saveWeeklyReviewPrayer).not.toHaveBeenCalled();
  const weekly = await getLocalJournalSingleton('weekly_looking_forward', mockRouteParams.periodEnd);
  expect(JSON.parse(weekly!.content)).toMatchObject({title: 'Looking forward to this week', entry: {text: 'Dinner with my sister.'}, emotionName: 'Hopeful'});
  expect(await getLocalJournalSingleton('looking_forward', mockRouteParams.periodEnd)).toBeNull();
  screen.unmount();

  mockRouteParams.reviewId = (await savedReview())!.id;
  const reader = render(<ReviewReaderScreen/>);
  await waitFor(() => expect(reader.getByRole('tab', {name: 'Looking Ahead'})).toBeTruthy());
  fireEvent.press(reader.getByRole('tab', {name: 'Looking Ahead'}));
  expect(reader.getByText('Help me listen well.')).toBeTruthy();
  expect(reader.getByText('Dinner with my sister.')).toBeTruthy();
  expect(reader.getByText('Hopeful')).toBeTruthy();
  expect(reader.getByText('Looking forward to this week')).toBeTruthy();
});

it('preserves older prayer and removed-question answers when reopening and finishing a review', async () => {
  const oldAnswers = {week_support_choices: 'wisdom', prayer_ahead: 'Help me trust You.', people: 'My sister', rest: 'Sunday afternoon', faithful_step: 'Listen first'};
  await createLocalReview({type: 'weekly', periodStart: mockRouteParams.periodStart, periodEnd: mockRouteParams.periodEnd, memorableItems: [], answers: oldAnswers});
  const screen = render(<ReviewScreen/>);
  await openLookingAhead(screen);
  await next(screen);
  await next(screen);
  await next(screen);
  await next(screen);
  await next(screen);
  expect(screen.getByLabelText('Your words to God (optional)').props.value).toBe(oldAnswers.prayer_ahead);
  expect(screen.getByText('Wisdom')).toBeTruthy();
  await next(screen);
  fireEvent.press(screen.getByRole('tab', {name: 'Looking Ahead'}));
  expect(screen.getByText(oldAnswers.people)).toBeTruthy();
  expect(screen.getByText(oldAnswers.rest)).toBeTruthy();
  expect(screen.getByText(oldAnswers.faithful_step)).toBeTruthy();
  await act(async () => {fireEvent.press(screen.getByLabelText('Finish weekly review'));});
  expect((await savedReview())?.answers).toMatchObject(oldAnswers);
  screen.unmount();
  mockRouteParams.reviewId = (await savedReview())!.id;
  const reader = render(<ReviewReaderScreen/>);
  await waitFor(() => expect(reader.getByRole('tab', {name: 'Looking Ahead'})).toBeTruthy());
  fireEvent.press(reader.getByRole('tab', {name: 'Looking Ahead'}));
  expect(reader.getByText(oldAnswers.people)).toBeTruthy();
  expect(reader.getByText(oldAnswers.rest)).toBeTruthy();
  expect(reader.getByText(oldAnswers.faithful_step)).toBeTruthy();
  expect(reader.getByText('• Wisdom\n\nHelp me trust You.')).toBeTruthy();
});

it('allows every question to be skipped and keeps the recap open for retry if finishing fails', async () => {
  const screen = render(<ReviewScreen/>);
  await openLookingAhead(screen);
  for (let index = 0; index < 6; index += 1) {await next(screen);}
  expect(screen.getByRole('tab', {name: 'Looking Back', selected: true})).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', {name: 'Looking Ahead'}));
  expect(screen.getByText('You haven’t named a priority. One is enough.')).toBeTruthy();
  expect((await savedReview())?.status).toBe('draft');
  const save = jest.spyOn(reviewStorage, 'updateLocalReview').mockRejectedValueOnce(new Error('Storage unavailable'));
  await act(async () => {fireEvent.press(screen.getByLabelText('Finish weekly review'));});
  expect(screen.getByText('Couldn’t finish saving your review. Please try again.')).toBeTruthy();
  expect((await savedReview())?.status).toBe('draft');
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  save.mockRestore();
  await act(async () => {fireEvent.press(screen.getByLabelText('Finish weekly review'));});
  expect((await savedReview())?.status).toBe('completed');
  expect((await savedReview())?.answers).toEqual({});
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
});

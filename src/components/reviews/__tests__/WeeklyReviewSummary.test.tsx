import React from 'react';
import {fireEvent, render, within} from '@testing-library/react-native';
import {WeeklyReviewSummary} from '../WeeklyReviewSummary';
import type {LocalReviewEntry} from '../../../storage/reviewStorage';
import type {ReviewCapture} from '../../../services/reviewCaptureService';
import {triggerLightHaptic} from '../../../utils/haptics';

jest.mock('../../common/ThemedText', () => require('react-native').Text);
jest.mock('../../../utils/haptics', () => ({triggerLightHaptic: jest.fn()}));

const review: LocalReviewEntry = {
  id: 'week', type: 'weekly', periodStart: '2026-09-14', periodEnd: '2026-09-20',
  status: 'draft', createdAt: '2026-09-20', updatedAt: '2026-09-20',
  memorableItems: [{id: 'walk', kind: 'journal', selectedDate: '2026-09-17'}],
  answers: {
    week_feelings: 'Hopeful|Faithful|Wrestling', week_check_in_mind: 'well', week_check_in_body: 'okay',
    week_check_in_relationships: 'well', week_check_in_work: 'okay', week_check_in_finances: 'struggling',
    week_check_in_responsibilities: 'okay', week_check_in_rest: 'struggling', week_check_in_with_god: 'well',
    week_memory_other: 'Dinner around the table.', week_difficulty: 'Too much on my plate.',
    notice: 'Thank You for a friend who listened.', god: 'Through someone|Gave me peace', week_learning: 'Make room to listen.',
    priority_1: 'Be present with my family', priority_2: 'Finish the things already started',
    week_care_areas: 'finances|rest|other', week_care_other: 'The move', dont_forget: 'Leave space between commitments.',
    week_challenge_choices: 'anxiety|other', watch_for: 'A busy Thursday.', week_looking_forward: 'A slow Saturday with family.',
    week_looking_forward_emotion: 'hopeful', prayer_ahead: 'God, help me move through this week with patience.',
    people: 'Call my sister.',
  },
};
const capture = {items: [
  {id: 'walk', kind: 'journal', presentation: 'heart_journal', title: 'A walk and a good conversation', text: 'We finally had time to listen.', selectedDate: '2026-09-17'},
  {id: 'thanks', kind: 'gratitude', presentation: 'gratitude_list', title: 'Small things I am thankful for', lines: ['Home', 'Family'], selectedDate: '2026-09-14'},
  {id: 'prayer', kind: 'prayer', presentation: 'prayer', title: 'Praying for a friend', selectedDate: '2026-09-17'},
]} as ReviewCapture;

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.useRealTimers());

it('shows actual days, all life areas, and bookmarks; day and breakdown controls respond to taps', () => {
  const screen = render(<WeeklyReviewSummary review={review} capture={capture}/>);
  expect(screen.getByRole('tab', {name: 'Looking Back', selected: true})).toBeTruthy();
  expect(screen.getByText('Finances')).toBeTruthy();
  expect(screen.getByText('Life with God')).toBeTruthy();
  expect(screen.getByText('A prayer of thanks')).toBeTruthy();
  expect(screen.getByTestId('weekly-review-notice-icon')).toHaveStyle({backgroundColor: '#F3DED2'});
  expect(screen.getAllByText('Needs care')).toHaveLength(2);
  fireEvent.press(screen.getByRole('button', {name: '2026-09-14: 1 saved moment'}));
  expect(screen.getByText('Small things I am thankful for')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', {name: '2026-09-15: 0 saved moments'}));
  expect(screen.getByText('No moments were saved for this day.')).toBeTruthy();
  expect(screen.queryByText('Small things I am thankful for')).toBeNull();
  fireEvent.press(screen.getByText('See activity breakdown'));
  expect(screen.getByText('Journaling')).toBeTruthy();
  expect(screen.getByText('Prayer')).toBeTruthy();
  expect(triggerLightHaptic).toHaveBeenCalledTimes(3);
});

it('switches tabs without losing answers and exposes the correct edit destinations', () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 23, 12));
  const edit = jest.fn();
  const finish = jest.fn();
  const screen = render(<WeeklyReviewSummary review={review} capture={capture} onEdit={edit} onFinish={finish}/>);
  expect(screen.getByText('September 14–20')).toBeTruthy();
  expect(screen.getByText('Looking back with God at what you felt, noticed, and chose to remember.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', {name: 'Edit how the week felt'}));
  expect(edit).toHaveBeenCalledWith('feelings');
  fireEvent.press(screen.getByRole('tab', {name: 'Looking Ahead'}));
  expect(screen.queryByText('September 14–20')).toBeNull();
  expect(screen.getByText('September 21–27')).toBeTruthy();
  expect(screen.getByText('Entrust the week ahead to God.')).toBeTruthy();
  expect(screen.getByText('With God, consider what to carry, care for, and pray over.')).toBeTruthy();
  expect(screen.getByText('Sep 21–27')).toBeTruthy();
  expect(screen.getByText('Be present with my family')).toBeTruthy();
  expect(screen.getByText('The move')).toBeTruthy();
  expect(within(screen.getByTestId('weekly-review-care-finances')).UNSAFE_getByProps({name: 'wallet-outline'})).toBeTruthy();
  expect(within(screen.getByTestId('weekly-review-care-rest')).UNSAFE_getByProps({name: 'bed-outline'})).toBeTruthy();
  expect(within(screen.getByTestId('weekly-review-care-other')).UNSAFE_getByProps({name: 'dots-horizontal'})).toBeTruthy();
  expect(screen.getByText('Call my sister.')).toBeTruthy();
  expect(screen.getByText('A slow Saturday with family.')).toBeTruthy();
  expect(screen.getByTestId('weekly-review-looking_forward_feeling-icon')).toHaveStyle({backgroundColor: '#F3DED2'});
  fireEvent.press(screen.getByRole('button', {name: 'Edit looking forward to this week'}));
  expect(edit).toHaveBeenLastCalledWith('looking_forward_feeling');
  expect(finish).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('tab', {name: 'Looking Back'}));
  expect(screen.getByText('September 14–20')).toBeTruthy();
  expect(screen.getByText('Make room to listen.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', {name: 'Finish weekly review'}));
  expect(finish).toHaveBeenCalledTimes(1);
});

it('keeps written answers available when moments cannot load, without showing false zero analytics', () => {
  const screen = render(<WeeklyReviewSummary review={review} capture={null}/>);
  expect(screen.getByText('Your saved moments could not be loaded. Your written reflections are below.')).toBeTruthy();
  expect(screen.getByText('Thank You for a friend who listened.')).toBeTruthy();
  expect(screen.queryByText('saved moments')).toBeNull();
  expect(screen.queryByRole('button', {name: 'Finish weekly review'})).toBeNull();
});

it('shows grouped saved prayer moments in Looking Back even when original moments cannot load', () => {
  const screen = render(<WeeklyReviewSummary review={{...review, status: 'completed', prayerSnapshot: [{
    id: 'answer', prayerId: 'prayer', eventType: 'answer_recorded', eventDate: '2026-09-17',
    title: 'A friend’s recovery', subtitle: 'You recorded an answer', text: 'She is home and resting.',
  }]}} capture={null}/>);
  expect(screen.getByRole('header', {name: 'What happened in prayer'})).toBeTruthy();
  expect(screen.getByText('Answers & changes')).toBeTruthy();
  expect(screen.getByText('She is home and resting.')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', {name: 'Looking Ahead'}));
  expect(screen.queryByText('What happened in prayer')).toBeNull();
});

it('prevents duplicate completion and edits while saving', () => {
  const edit = jest.fn(); const finish = jest.fn();
  const screen = render(<WeeklyReviewSummary review={review} capture={capture} saving onFinish={finish} onEdit={edit}/>);
  fireEvent.press(screen.getByRole('button', {name: 'Finish weekly review'}));
  fireEvent.press(screen.getByRole('button', {name: 'Edit how the week felt'}));
  expect(finish).not.toHaveBeenCalled();
  expect(edit).not.toHaveBeenCalled();
});

it('moves transparent tabs into the plain navigation surface and expands them on return', () => {
  const back = jest.fn();
  const close = jest.fn();
  const screen = render(<WeeklyReviewSummary review={review} capture={capture} topInset={54} onBack={back} onClose={close}/>);
  fireEvent(screen.getByTestId('weekly-review-hero'), 'layout', {
    nativeEvent: {layout: {x: 0, y: 106, width: 390, height: 216}},
  });
  const scrollTo = (y: number) => fireEvent.scroll(screen.getByTestId('weekly-review-scroll'), {
    nativeEvent: {contentOffset: {x: 0, y}},
  });

  expect(screen.queryByTestId('weekly-review-glass')).toBeNull();
  expect(screen.getByTestId('weekly-review-navigation-surface')).toHaveStyle({backgroundColor: '#F6F5EF'});
  expect(screen.getByTestId('weekly-review-close-button')).toHaveStyle({width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFEFA'});
  expect(screen.getByTestId('weekly-review-moving-tabs')).toHaveStyle({top: 106, transform: [{translateY: 216}]});
  expect(screen.getByTestId('weekly-review-tab-list')).toHaveStyle({marginHorizontal: 20, padding: 5, backgroundColor: 'transparent'});
  expect(screen.getByTestId('weekly-review-tab-slot-back')).toHaveStyle({minHeight: 46});
  expect(screen.getByTestId('weekly-review-tab-track')).toHaveStyle({backgroundColor: '#E8EEE3', opacity: 1});
  expect(screen.getByRole('tab', {name: 'Looking Back', selected: true})).toHaveStyle({backgroundColor: '#526F5D'});
  scrollTo(-24);
  expect(screen.queryByTestId('weekly-review-glass')).toBeNull();
  scrollTo(1);
  expect(screen.queryByTestId('weekly-review-glass')).toBeNull();
  expect(screen.getByTestId('weekly-review-tab-list')).toHaveStyle({backgroundColor: 'transparent'});
  scrollTo(200);
  expect(screen.getByTestId('weekly-review-moving-tabs')).toHaveStyle({backgroundColor: 'transparent', transform: [{translateY: 16}]});
  expect(screen.getByTestId('weekly-review-tab-track')).toHaveStyle({opacity: 0});
  expect(screen.queryByTestId('weekly-review-glass')).toBeNull();
  expect(screen.getByTestId('weekly-review-tab-list')).toHaveStyle({backgroundColor: 'transparent'});
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  scrollTo(267);
  expect(screen.queryByTestId('weekly-review-glass')).toBeNull();
  scrollTo(268);
  expect(screen.queryByTestId('weekly-review-glass')).toBeNull();
  expect(screen.getByTestId('weekly-review-tab-track')).toHaveStyle({opacity: 1});
  expect(screen.getByTestId('weekly-review-moving-tabs')).toHaveStyle({top: 106, transform: [{translateY: -52}], paddingTop: 6, paddingBottom: 6});
  expect(screen.getByTestId('weekly-review-tab-list')).toHaveStyle({marginHorizontal: 64, padding: 2, backgroundColor: 'transparent'});
  expect(screen.getByTestId('weekly-review-tab-slot-back')).toHaveStyle({minHeight: 36});
  expect(screen.getByTestId('weekly-review-navigation-title', {includeHiddenElements: true})).toHaveStyle({opacity: 0});
  fireEvent.press(screen.getByRole('button', {name: 'Go back'}));
  expect(back).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', {name: 'Close review'}));
  expect(close).toHaveBeenCalledTimes(1);

  scrollTo(120);
  expect(screen.queryByTestId('weekly-review-glass')).toBeNull();
  expect(screen.getByTestId('weekly-review-tab-track')).toHaveStyle({opacity: 0});
  expect(screen.getByTestId('weekly-review-tab-list')).toHaveStyle({backgroundColor: 'transparent'});
  scrollTo(0);
  expect(screen.queryByTestId('weekly-review-glass')).toBeNull();
  expect(screen.getByTestId('weekly-review-tab-track')).toHaveStyle({opacity: 1});
  expect(screen.getByTestId('weekly-review-tab-list')).toHaveStyle({backgroundColor: 'transparent'});
  expect(screen.getByTestId('weekly-review-moving-tabs')).toHaveStyle({transform: [{translateY: 216}]});
  expect(screen.getByText('Your weekly review')).toBeTruthy();
  scrollTo(500);
  expect(screen.queryByTestId('weekly-review-glass')).toBeNull();
  fireEvent.press(screen.getByRole('tab', {name: 'Looking Ahead'}));
  expect(screen.getByRole('tab', {name: 'Looking Ahead', selected: true})).toBeTruthy();
  expect(screen.getByRole('tab', {name: 'Looking Ahead', selected: true})).toHaveStyle({backgroundColor: '#526F5D'});
  expect(screen.getByTestId('weekly-review-tab-track')).toHaveStyle({opacity: 1});
  expect(screen.queryByTestId('weekly-review-glass')).toBeNull();
  expect(screen.getByTestId('weekly-review-tab-list')).toHaveStyle({backgroundColor: 'transparent'});
  expect(screen.getByTestId('weekly-review-moving-tabs')).toHaveStyle({transform: [{translateY: -52}], paddingTop: 6, paddingBottom: 6});
  expect(screen.getByTestId('weekly-review-tab-slot-ahead')).toHaveStyle({minHeight: 36});
  expect(screen.getByTestId('weekly-review-navigation-title', {includeHiddenElements: true})).toHaveStyle({opacity: 0});
});

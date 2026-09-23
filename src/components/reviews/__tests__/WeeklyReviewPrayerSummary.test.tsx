import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {WeeklyReviewPrayerSummary} from '../WeeklyReviewPrayerSummary';
import type {ReviewPrayerSnapshotItem} from '../../../storage/reviewStorage';
import {triggerLightHaptic} from '../../../utils/haptics';

jest.mock('../../common/ThemedText', () => require('react-native').Text);
jest.mock('../../../utils/haptics', () => ({triggerLightHaptic: jest.fn()}));

const moment = (id: string, overrides: Partial<ReviewPrayerSnapshotItem> = {}): ReviewPrayerSnapshotItem => ({
  id, prayerId: 'same-prayer', eventType: 'new_prayer', eventDate: '2026-09-17',
  title: `Prayer ${id}`, subtitle: 'New in prayer', ...overrides,
});

beforeEach(() => jest.clearAllMocks());

it('keeps all prayer events reachable, including separate answers to the same prayer and unknown saved events', () => {
  const types = ['new_prayer', 'request_received', 'request_prayed_for', 'thanksgiving',
    'answer_recorded', 'need_answer_recorded', 'update', 'let_go', 'return_to_prayer', 'still_carrying', 'legacy_event'];
  const items = types.map(type => moment(type, {eventType: type, title: `Saved ${type}`, subtitle: type === 'legacy_event' ? 'A saved reflection' : type}));
  const screen = render(<WeeklyReviewPrayerSummary items={items}/>);

  expect(screen.getByRole('header', {name: 'Answers & changes'})).toBeTruthy();
  expect(screen.getByRole('header', {name: 'Brought to God'})).toBeTruthy();
  expect(screen.getByRole('header', {name: 'Still carrying'})).toBeTruthy();
  expect(screen.getByText('A saved reflection')).toBeTruthy();
  expect(screen.getByText('As of Sep 17')).toBeTruthy();
  expect(screen.queryByText('Prayer update')).toBeNull();
  fireEvent.press(screen.getByRole('button', {name: 'Show all 5 answers & changes prayer moments'}));
  fireEvent.press(screen.getByRole('button', {name: 'Show all 4 brought to god prayer moments'}));
  for (const type of types) {expect(screen.getByText(`Saved ${type}`)).toBeTruthy();}
  expect(screen.getByText('Prayer need answered')).toBeTruthy();
  expect(screen.getByText('Let go')).toBeTruthy();
  expect(screen.getByText('Prayed for a request')).toBeTruthy();
  expect(screen.queryByText('New prayer')).toBeNull();
  expect(triggerLightHaptic).toHaveBeenCalledTimes(2);
});

it('shows the canonical prayer type instead of calling every item a new prayer', () => {
  const screen = render(<WeeklyReviewPrayerSummary items={[
    moment('open', {prayerTypeLabel: 'OPEN PRAYER', eventDate: '2026-09-20'}),
    moment('cast', {prayerTypeLabel: 'CAST PRAYER', eventDate: '2026-09-19'}),
    moment('person', {prayerTypeLabel: 'PRAYED FOR', eventDate: '2026-09-18'}),
    moment('legacy', {eventDate: '2026-09-17'}),
    moment('thanks', {eventType: 'thanksgiving', prayerTypeLabel: 'THANKSGIVING PRAYER', eventDate: '2026-09-16'}),
  ]}/>);
  fireEvent.press(screen.getByRole('button', {name: 'Show all 5 brought to god prayer moments'}));
  expect(screen.getByText('Open Prayer')).toBeTruthy();
  expect(screen.getByText('CAST Prayer')).toBeTruthy();
  expect(screen.getByText('Prayer for Someone')).toBeTruthy();
  expect(screen.getByText('A prayer of thanks')).toBeTruthy();
  expect(screen.getByText('Prayer')).toBeTruthy();
  expect(screen.queryByText('New prayer')).toBeNull();
});

it('previews the two newest events in each group without reordering saved data; show less restores the preview', () => {
  const items = [
    moment('old', {eventDate: '2026-09-14'}),
    moment('middle', {eventDate: '2026-09-15'}),
    moment('new', {eventDate: '2026-09-20'}),
  ];
  const original = JSON.stringify(items);
  const screen = render(<WeeklyReviewPrayerSummary items={items}/>);
  expect(screen.getByText('Prayer new')).toBeTruthy();
  expect(screen.getByText('Prayer middle')).toBeTruthy();
  expect(screen.queryByText('Prayer old')).toBeNull();
  expect(screen.queryByText('Answers & changes')).toBeNull();
  fireEvent.press(screen.getByRole('button', {name: 'Show all 3 brought to god prayer moments'}));
  expect(screen.getByText('Prayer old')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', {name: 'Show fewer brought to god prayer moments'}));
  expect(screen.queryByText('Prayer old')).toBeNull();
  expect(JSON.stringify(items)).toBe(original);
  expect(triggerLightHaptic).toHaveBeenCalledTimes(2);
});

it('expands full answer notes with haptics without expanding the other events', () => {
  const text = 'We received the news we had been waiting for. '.repeat(8);
  const screen = render(<WeeklyReviewPrayerSummary items={[
    moment('answer', {eventType: 'answer_recorded', title: 'Mum’s recovery', text}),
    moment('other', {title: 'My sister', text: 'Help her feel at home. '.repeat(10)}),
  ]}/>);
  expect(screen.queryByText(text.trim())).toBeNull();
  const button = screen.getByRole('button', {name: 'Read full prayer moment for Mum’s recovery, Sep 17'});
  expect(button.props.accessibilityState.expanded).toBe(false);
  fireEvent.press(button);
  expect(screen.getByText(text.trim())).toBeTruthy();
  expect(screen.getByRole('button', {name: 'Read full prayer moment for My sister, Sep 17'}).props.accessibilityState.expanded).toBe(false);
  fireEvent.press(screen.getByRole('button', {name: 'Read less of Mum’s recovery, Sep 17'}));
  expect(screen.queryByText(text.trim())).toBeNull();
  expect(triggerLightHaptic).toHaveBeenCalledTimes(2);
});

it('avoids repeated prayer titles while keeping the full text of generated titles available', () => {
  const text = 'God, help me to trust You with the conversations I need to have this week.';
  const title = `${text.slice(0, 60).trim()}…`;
  const screen = render(<WeeklyReviewPrayerSummary items={[
    moment('identical', {title: 'Be near to my family.', text: 'Be near to my family.'}),
    moment('truncated', {title, text}),
  ]}/>);
  expect(screen.getAllByText('Be near to my family.')).toHaveLength(1);
  expect(screen.queryByText(text)).toBeNull();
  fireEvent.press(screen.getByRole('button', {name: `Read full prayer moment for ${title}, Sep 17`}));
  expect(screen.getByText(text)).toBeTruthy();
});

it('keeps long saved titles readable in full even when no separate note exists', () => {
  const title = 'A prayer for all the things on my heart. '.repeat(6).trim();
  const screen = render(<WeeklyReviewPrayerSummary items={[moment('long', {title, text: title})]}/>);
  expect(screen.queryByText(title)).toBeNull();
  fireEvent.press(screen.getByRole('button', {name: `Read full prayer moment for ${title}, Sep 17`}));
  expect(screen.getAllByText(title)).toHaveLength(1);
});

it('does not show an empty prayer section', () => {
  const screen = render(<WeeklyReviewPrayerSummary items={[]}/>);
  expect(screen.toJSON()).toBeNull();
});

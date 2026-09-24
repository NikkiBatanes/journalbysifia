import React from 'react';
import { SectionList, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { EnhancedMomentsRenderer } from '../EnhancedMomentsRenderer';
import { getCanonicalMomentTimeline } from '../../../../services/momentTimelineService';
import { JournalPlugin } from '../../types';
import { PluginRenderer } from '../../PluginRenderer';

jest.mock('react-native-reanimated', () => {
  const animation = { delay: () => animation, springify: () => animation, damping: () => animation, stiffness: () => animation };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInUp: animation };
});
jest.mock('../../../../context/IndustryStandardAuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../../../hooks/useTheme', () => ({ useTheme: () => ({ currentFont: 'lexend' }) }));
jest.mock('../../../../utils/haptics', () => ({ triggerLightHaptic: jest.fn() }));
jest.mock('../../../../services/supabaseClient', () => ({ supabase: {} }));
jest.mock('../../../../services/momentTimelineService', () => ({ getCanonicalMomentTimeline: jest.fn() }));
jest.mock('../../../../components/SkeletonLoader/MomentsSkeleton', () => () => null);
jest.mock('../../../../components/moments/RoutineMomentSummary', () => ({ RoutineMomentSummary: () => null }));
jest.mock('../../../../components/moments/PrayerMomentsCarousel', () => () => null);
jest.mock('../../../../components/moments/ForMeDayMomentCard', () => ({
  ForMeDayMomentCard: ({timelineItem}: any) => require('react').createElement(
    require('react-native').View,
    {testID: `new-life-day-${timelineItem.reflection.id}`},
  ),
  isForMeDayTimelineItem: (item: any) => item?.reflection?.type === 'gospel_anniversary' && item?.reflection?.source === 'for_me_day',
}));

const loadTimeline = getCanonicalMomentTimeline as jest.Mock;
const date = '2026-09-17';
const reflection = (id: string, title = 'Same title', content = 'Same body') => ({
  key: `reflection:journal:${id}`, kind: 'reflection', selectedDate: date, canonicalSource: 'reflection', canonicalIds: [id], savedAt: `2026-09-17T08:${id === 'a' ? '30' : id === 'b' ? '29' : '27'}:00.000Z`, searchText: title.toLowerCase(), preview: { title, lines: [content] }, reflection: { id, title, content, type: 'free', source: 'freeform', selected_date: date }, metadata: {},
});
const plugins: JournalPlugin[] = [{ id: 'reflection', category: 'reflect', title: 'Heart Journal', priority: 1, viewModes: ['inline', 'moments'], component: ({ reflectionIds = [] }: any) => <View testID="approved-heart-section"><View testID="approved-heart-heading">HEART JOURNAL</View>{reflectionIds.map((id: string) => <View key={id} testID={`reflection-${id}`} />)}</View> }];
const render = () => <EnhancedMomentsRenderer plugins={plugins} refreshKey={0} groupBy="date" sortBy="newest" searchQuery="" dateRange={{ startDate: new Date(2026, 8, 17), endDate: new Date(2026, 8, 17), label: 'Day' }} />;

beforeEach(() => { jest.useFakeTimers(); loadTimeline.mockReset(); });
afterEach(() => { jest.useRealTimers(); jest.clearAllTimers(); });

it('groups three exact Heart Journal identities under one heading without content deduplication', async () => {
  loadTimeline.mockResolvedValue([reflection('a'), reflection('b'), reflection('c', 'Other', 'Other body')]);
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(render()); });
  const heartRenderer = renderer.root.findAllByType(PluginRenderer);
  expect(heartRenderer).toHaveLength(1);
  expect(heartRenderer[0].props.reflectionIds).toEqual(['a', 'b', 'c']);
  await act(async () => renderer.unmount());
});

it('removes only duplicate canonical timeline identity', async () => {
  loadTimeline.mockResolvedValue([reflection('a'), reflection('a'), reflection('b')]);
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(render()); });
  expect(renderer.root.findAllByType(PluginRenderer)).toHaveLength(1);
  expect(renderer.root.findByType(PluginRenderer).props.reflectionIds).toEqual(['a', 'b']);
  await act(async () => renderer.unmount());
});

it('renders testimony and yearly reflection as New Life Day cards instead of Heart Journal thoughts', async () => {
  const testimony = {
    ...reflection('testimony', 'My testimony', 'Jesus gave me a new beginning.'),
    reflection: {
      ...reflection('testimony').reflection,
      type: 'gospel_anniversary',
      source: 'for_me_day',
      metadata: {forMeDayEntry: 'testimony'},
    },
  };
  const annual = {
    ...reflection('annual', 'My 12th New Life Day', 'God was faithful this year.'),
    reflection: {
      ...reflection('annual').reflection,
      type: 'gospel_anniversary',
      source: 'for_me_day',
      metadata: {forMeDayEntry: 'annual_reflection'},
    },
  };
  loadTimeline.mockResolvedValue([testimony, annual, reflection('a')]);

  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(render()); });

  expect(renderer.root.findAll(node => node.type === View && node.props.testID === 'new-life-day-testimony')).toHaveLength(1);
  expect(renderer.root.findAll(node => node.type === View && node.props.testID === 'new-life-day-annual')).toHaveLength(1);
  expect(renderer.root.findAllByType(PluginRenderer)).toHaveLength(1);
  expect(renderer.root.findByType(PluginRenderer).props.reflectionIds).toEqual(['a']);
  await act(async () => renderer.unmount());
});

it('keeps the list and existing date cards mounted when refresh discovers another date', async () => {
  loadTimeline.mockResolvedValue([reflection('a')]);
  const renderRange = (refreshKey: number) => <EnhancedMomentsRenderer plugins={plugins} refreshKey={refreshKey}
    groupBy="date" sortBy="newest" searchQuery=""
    dateRange={{ startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 30), label: 'September' }} />;
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(renderRange(0)); });
  const list = renderer.root.findByType(SectionList).instance;
  const card = renderer.root.findByType(PluginRenderer);
  const scrollToLocation = jest.spyOn(list, 'scrollToLocation');
  await act(async () => { jest.runOnlyPendingTimers(); });
  scrollToLocation.mockClear();

  loadTimeline.mockResolvedValue([reflection('a'), { ...reflection('b'), selectedDate: '2026-09-16' }]);
  await act(async () => { renderer.update(renderRange(1)); });
  await act(async () => { jest.runOnlyPendingTimers(); });

  expect(renderer.root.findByType(SectionList).instance === list).toBe(true);
  expect(renderer.root.findAllByType(PluginRenderer).find(node => node.props.reflectionIds.includes('a')) === card).toBe(true);
  expect(scrollToLocation).not.toHaveBeenCalled();
  expect(renderer.root.findAllByType(PluginRenderer)).toHaveLength(2);
  await act(async () => renderer.unmount());
});

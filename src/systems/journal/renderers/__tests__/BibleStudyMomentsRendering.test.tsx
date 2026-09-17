import React from 'react';
import { View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { EnhancedMomentsRenderer } from '../EnhancedMomentsRenderer';
import { getCanonicalMomentTimeline } from '../../../../services/momentTimelineService';
import { JournalPlugin } from '../../types';
import { PluginRenderer } from '../../PluginRenderer';

jest.mock('../../../../context/IndustryStandardAuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../../../hooks/useTheme', () => ({ useTheme: () => ({ currentFont: 'lexend' }) }));
jest.mock('../../../../utils/haptics', () => ({ triggerLightHaptic: jest.fn() }));
jest.mock('../../../../services/supabaseClient', () => ({ supabase: {} }));
jest.mock('../../../../services/momentTimelineService', () => ({ getCanonicalMomentTimeline: jest.fn() }));
jest.mock('../../../../components/SkeletonLoader/MomentsSkeleton', () => () => null);
jest.mock('../../../../components/moments/RoutineMomentSummary', () => ({ RoutineMomentSummary: () => null }));
jest.mock('../../../../components/moments/PrayerMomentsCarousel', () => () => null);
jest.mock('../../../../services/api/prayerApi', () => ({ PrayerApi: { getAllPrayers: jest.fn(async () => []) } }));

const loadTimeline = getCanonicalMomentTimeline as jest.Mock;
beforeEach(() => {
  jest.useFakeTimers();
  loadTimeline.mockReset();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});
const plugins: JournalPlugin[] = [{
  id: 'biblestudy', category: 'reflect', title: 'Bible Study', priority: 6,
  subtitle: 'Saved studies', viewModes: ['inline', 'moments'],
  component: ({ reflectionId }: any) => <View testID={`study-${reflectionId}`} />,
}];
const study = (id: string, savedAt = '2026-09-15T01:00:00Z') => ({
  key: `reflection:bible-study:${id}`, kind: 'bible_study', selectedDate: '2026-09-15', canonicalSource: 'reflection',
  canonicalIds: [id], savedAt, searchText: 'psalm 23 partial saved study', preview: { title: 'Psalm 23', lines: ['A partial saved study'] },
  reflection: { id }, metadata: {},
});
const render = (refreshKey: number) => (
  <EnhancedMomentsRenderer plugins={plugins} refreshKey={refreshKey} groupBy="date" sortBy="newest" searchQuery=""
    dateRange={{ startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 30), label: 'September' }} />
);

it('renders both saved studies for one date and forwards their exact reflection IDs', async () => {
  loadTimeline.mockResolvedValue([study('first'), study('second')]);
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(render(0)); });
  expect(renderer.root.findAllByProps({ testID: 'study-first' }).length).toBeGreaterThan(0);
  expect(renderer.root.findAllByProps({ testID: 'study-second' }).length).toBeGreaterThan(0);
  await act(async () => renderer.unmount());
});

it('places the latest saved Bible Study first within the date and type group', async () => {
  loadTimeline.mockResolvedValue([study('older', '2026-09-15T01:00:00Z'), study('newer', '2026-09-15T03:00:00Z')]);
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(render(0)); });
  expect(renderer.root.findAllByType(PluginRenderer).map(node => node.props.reflectionId)).toEqual(['newer', 'older']);
  await act(async () => renderer.unmount());
});

it('does not let an older fetch erase a newly saved Bible Study', async () => {
  let resolveOld!: (entries: any[]) => void;
  loadTimeline.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(render(0)); });
  loadTimeline.mockResolvedValue([study('new')]);
  await act(async () => { renderer.update(render(1)); });
  await act(async () => { resolveOld([]); });
  expect(renderer.root.findAllByProps({ testID: 'study-new' }).length).toBeGreaterThan(0);
  await act(async () => renderer.unmount());
});

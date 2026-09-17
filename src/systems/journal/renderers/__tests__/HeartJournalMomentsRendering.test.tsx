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

import React from 'react';
import { View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { EnhancedMomentsRenderer } from '../EnhancedMomentsRenderer';
import { getSavedBibleStudyReflections } from '../../../../storage/bibleStudyMomentsStorage';
import { JournalPlugin } from '../../types';
import { PluginRenderer } from '../../PluginRenderer';

jest.mock('../../../../context/IndustryStandardAuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../../../hooks/useTheme', () => ({ useTheme: () => ({ currentFont: 'lexend' }) }));
jest.mock('../../../../utils/haptics', () => ({ triggerLightHaptic: jest.fn() }));
jest.mock('../../../../services/supabaseClient', () => ({ supabase: {} }));
jest.mock('../../../../storage/reflectionStorage', () => ({ getAllLocalReflectionsByType: jest.fn(async () => []) }));
jest.mock('../../../../storage/bibleStudyMomentsStorage', () => ({
  ...jest.requireActual('../../../../storage/bibleStudyMomentsStorage'),
  getSavedBibleStudyReflections: jest.fn(),
}));
jest.mock('../../../../storage/bibleStudyStorage', () => ({ getBibleStudySession: jest.fn() }));
jest.mock('../../../../components/SkeletonLoader/MomentsSkeleton', () => () => null);

const loadSaved = getSavedBibleStudyReflections as jest.Mock;
beforeEach(() => {
  jest.useFakeTimers();
  loadSaved.mockReset();
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
const reflection = (id: string) => ({
  id, title: 'Psalm 23', selected_date: '2026-09-15',
  content: JSON.stringify({ format: 'bible_study_v1', observation: { text: 'A partial saved study' } }),
});
const render = (refreshKey: number) => (
  <EnhancedMomentsRenderer plugins={plugins} refreshKey={refreshKey} groupBy="date" sortBy="newest" searchQuery=""
    dateRange={{ startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 30), label: 'September' }} />
);

it('renders both saved studies for one date and forwards their exact reflection IDs', async () => {
  loadSaved.mockResolvedValue([reflection('first'), reflection('second')]);
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(render(0)); });
  expect(renderer.root.findAllByProps({ testID: 'study-first' }).length).toBeGreaterThan(0);
  expect(renderer.root.findAllByProps({ testID: 'study-second' }).length).toBeGreaterThan(0);
  await act(async () => renderer.unmount());
});

it('places the latest saved Bible Study first within the date and type group', async () => {
  loadSaved.mockResolvedValue([
    { ...reflection('older'), updated_at: '2026-09-15T01:00:00Z' },
    { ...reflection('newer'), updated_at: '2026-09-15T03:00:00Z' },
  ]);
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(render(0)); });
  expect(renderer.root.findAllByType(PluginRenderer).map(node => node.props.reflectionId)).toEqual(['newer', 'older']);
  await act(async () => renderer.unmount());
});

it('does not let an older fetch erase a newly saved Bible Study', async () => {
  let resolveOld!: (entries: any[]) => void;
  loadSaved.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(render(0)); });
  loadSaved.mockResolvedValue([reflection('new')]);
  await act(async () => { renderer.update(render(1)); });
  await act(async () => { resolveOld([]); });
  expect(renderer.root.findAllByProps({ testID: 'study-new' }).length).toBeGreaterThan(0);
  await act(async () => renderer.unmount());
});

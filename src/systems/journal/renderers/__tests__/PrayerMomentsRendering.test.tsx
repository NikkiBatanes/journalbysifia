import React from 'react';
import { View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { EnhancedMomentsRenderer } from '../EnhancedMomentsRenderer';
import { getSavedBibleStudyReflections } from '../../../../storage/bibleStudyMomentsStorage';
import { JournalPlugin } from '../../types';
import PrayerMomentsCarousel from '../../../../components/moments/PrayerMomentsCarousel';
import { PrayerApi } from '../../../../services/api/prayerApi';

jest.mock('react-native-reanimated', () => {
  const animation = { delay: () => animation, springify: () => animation, damping: () => animation, stiffness: () => animation };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInUp: animation };
});
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
jest.mock('../../../../components/journal/SavedMorningMoment', () => ({ SavedMorningMoment: () => null }));
jest.mock('../../../../components/SkeletonLoader/MomentsSkeleton', () => () => null);
jest.mock('../../../../components/moments/RoutineMomentSummary', () => ({ RoutineMomentSummary: () => null }));


jest.mock('../../../../services/api/prayerApi', () => ({ PrayerApi: { getAllPrayers: jest.fn() } }));
jest.mock('../../../../components/moments/PrayerMomentsCarousel', () => () => null);
const loadPrayers = PrayerApi.getAllPrayers as jest.Mock;
const plugins: JournalPlugin[] = ['prayerjournal', 'peopleprayers'].map(id => ({
  id, category: 'pray', title: id, priority: 5, viewModes: ['inline', 'moments'], component: () => null,
}));
const prayer = (id: string, extra: any = {}) => ({
  id, user_id: 'local', selected_date: '2026-09-15', created_at: '2026-09-15T01:00:00Z',
  updated_at: '2026-09-15T01:00:00Z', prayer_type: 'journal', content: id, ...extra,
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
beforeEach(() => {
  jest.useFakeTimers();
  (getSavedBibleStudyReflections as jest.Mock).mockResolvedValue([]);
  loadPrayers.mockResolvedValue([
    ...['confession', 'adoration', 'supplication', 'thanksgiving'].map(journal_category => prayer(journal_category, {
      journal_category, metadata: { prayer_style: 'cast', prayer_session_id: 'session' },
    })),
    prayer('open1', { journal_category: 'personal_prayer', metadata: { prayer_style: 'open' } }),
    prayer('open2', { journal_category: 'personal_prayer', metadata: { prayer_style: 'open' } }),
    prayer('need', { journal_category: 'supplication', metadata: { prayer_need: true } }),
    prayer('request', { prayer_type: 'people', is_prayer_request: true }),
    prayer('person', { prayer_type: 'people' }),
    prayer('fulfilled-request', { prayer_type: 'people', is_prayer_request: true, prayed: true }),
  ]);
});
it.each(['date', 'none'] as const)('collates all five prayer types into separate %s carousels', async groupBy => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(
    <EnhancedMomentsRenderer plugins={plugins} refreshKey={0} groupBy={groupBy} sortBy="newest" searchQuery=""
      dateRange={{ startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 30), label: 'September' }} />
  ); });
  const carousels = renderer.root.findAllByType(PrayerMomentsCarousel);
  expect(carousels).toHaveLength(5);
  const slides = carousels.map(node => node.props.prayers);
  expect(slides.flat()).toHaveLength(6);
  expect(slides.find(entries => entries[0].id === 'cast-session')[0].groupedEntries).toHaveLength(4);
  expect(slides.find(entries => entries.some((p: any) => p.id === 'open1'))).toHaveLength(2);
  await act(async () => renderer.unmount());
});

it('keeps answered filtering specific to each saved prayer', async () => {
  loadPrayers.mockResolvedValue([
    prayer('answered', { journal_category: 'personal_prayer', status: 'answered', metadata: { prayer_style: 'open' } }),
    prayer('waiting', { journal_category: 'personal_prayer', status: 'pending', metadata: { prayer_style: 'open' } }),
  ]);
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(
    <EnhancedMomentsRenderer plugins={plugins} groupBy="date" sortBy="newest" searchQuery="" prayerAnswerFilter="answered"
      dateRange={{ startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 30), label: 'September' }} />
  ); });
  expect(renderer.root.findAllByType(PrayerMomentsCarousel).flatMap(node => node.props.prayers.map((p: any) => p.id))).toEqual(['answered']);
  await act(async () => renderer.unmount());
});

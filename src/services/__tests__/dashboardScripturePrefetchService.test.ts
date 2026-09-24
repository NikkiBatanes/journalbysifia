import {getDashboardHeaderScripture} from '../../data/dashboardHeaderScriptures';
import {
  getDashboardScripturePrefetchReferences,
  hydrateDashboardScriptures,
  prefetchDashboardScriptures,
} from '../dashboardScripturePrefetchService';
import {
  hydrateStoredScripturePassages,
  preloadScripturePassages,
} from '../scriptureReaderService';

jest.mock('../scriptureReaderService', () => ({
  hydrateStoredScripturePassages: jest.fn().mockResolvedValue(undefined),
  preloadScripturePassages: jest.fn().mockResolvedValue(undefined),
}));

const date = new Date(2026, 8, 23, 9);
const tomorrow = new Date(2026, 8, 24, 9);
const references = [
  getDashboardHeaderScripture(date, false).passageReference,
  getDashboardHeaderScripture(date, true).passageReference,
  getDashboardHeaderScripture(tomorrow, false).passageReference,
  getDashboardHeaderScripture(tomorrow, true).passageReference,
];

beforeEach(() => jest.clearAllMocks());

it('selects both periods for today and tomorrow', () => {
  expect(getDashboardScripturePrefetchReferences(date)).toEqual([...new Set(references)]);
});

it('prefetches all dashboard passages in the selected translation', async () => {
  await prefetchDashboardScriptures('AMP', date);
  expect(preloadScripturePassages).toHaveBeenCalledWith([...new Set(references)], 'AMP');
});

it('hydrates persisted passages without asking the network preloader', async () => {
  await hydrateDashboardScriptures('NIV', date);
  expect(hydrateStoredScripturePassages).toHaveBeenCalledWith([...new Set(references)], 'NIV');
  expect(preloadScripturePassages).not.toHaveBeenCalled();
});

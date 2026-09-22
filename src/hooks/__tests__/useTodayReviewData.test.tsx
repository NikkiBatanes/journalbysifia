import { act, renderHook } from '@testing-library/react-native';
import { useTodayReviewData } from '../useTodayReviewData';
import { getReviewEligibility } from '../../services/reviewEligibilityService';
import { getLocalReviewsByType } from '../../storage/reviewStorage';

jest.mock('../../services/reviewEligibilityService', () => ({ getReviewEligibility: jest.fn() }));
jest.mock('../../storage/reviewStorage', () => ({ getLocalReviewsByType: jest.fn() }));
jest.mock('../../dev/reviews/reviewQALoader', () => ({
  getActiveReviewQAContext: jest.fn().mockResolvedValue(null),
  getReviewQAEligibilityOptions: jest.fn(),
}));

const available = { main: { type: 'weekly' }, allActive: [{ type: 'weekly' }], alsoReady: [] };
const completed = { main: null, allActive: [], alsoReady: [] };

beforeEach(() => {
  jest.clearAllMocks();
  (getReviewEligibility as jest.Mock).mockResolvedValue(available);
  (getLocalReviewsByType as jest.Mock).mockReturnValue(new Promise(() => {}));
});

it('publishes review availability even while completed-review history is still loading', async () => {
  const { result } = renderHook(() => useTodayReviewData('2026-09-22', 'monday', 0));
  await act(async () => {});
  expect(result.current.eligibility).toEqual(available);
  expect(result.current.weeklyReviews).toEqual([]);
});

it('keeps a visible review during refresh, then removes it when completed', async () => {
  const { result, rerender } = renderHook(
    ({ refresh }: { refresh: number }) => useTodayReviewData('2026-09-22', 'monday', refresh),
    { initialProps: { refresh: 0 } },
  );
  await act(async () => {});
  let finish!: (value: typeof completed) => void;
  (getReviewEligibility as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  rerender({ refresh: 1 });
  await act(async () => {});
  expect(result.current.eligibility).toEqual(available);
  await act(async () => { finish(completed); });
  expect(result.current.eligibility).toEqual(completed);
});

it('does not let an older refresh restore a review that has been completed', async () => {
  let finishOld!: (value: typeof available) => void;
  (getReviewEligibility as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }));
  const { result, rerender } = renderHook(
    ({ refresh }: { refresh: number }) => useTodayReviewData('2026-09-22', 'monday', refresh),
    { initialProps: { refresh: 0 } },
  );
  await act(async () => {});
  (getReviewEligibility as jest.Mock).mockResolvedValue(completed);
  rerender({ refresh: 1 });
  await act(async () => {});
  await act(async () => { finishOld(available); });
  expect(result.current.eligibility).toEqual(completed);
});

it('still offers a review when loading completed-review history fails', async () => {
  (getLocalReviewsByType as jest.Mock).mockRejectedValue(new Error('History unavailable'));
  const { result } = renderHook(() => useTodayReviewData('2026-09-22', 'monday', 0));
  await act(async () => {});
  expect(result.current.eligibility).toEqual(available);
});

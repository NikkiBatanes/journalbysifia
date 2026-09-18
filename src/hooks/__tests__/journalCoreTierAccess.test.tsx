import { renderHook } from '@testing-library/react-native';
import { usePlanningGating } from '../usePlanningGating';
import { useSmartJournalingGating } from '../useSmartJournalingGating';
import { useCalendarGating } from '../useCalendarGating';
import { useSubscription } from '../useSubscription';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useQuery } from '@tanstack/react-query';

jest.mock('../useSubscription', () => ({ useSubscription: jest.fn() }));
jest.mock('../../context/IndustryStandardAuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('../../services/NewSubscriptionService', () => ({
  __esModule: true,
  default: { getUserSubscription: jest.fn() },
}));

const mockedUseSubscription = useSubscription as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const mockedUseQuery = useQuery as jest.Mock;
const LEGACY_TIERS = ['seeker', 'spark', 'growth', 'transformation', 'free_trial'] as const;

describe('Journal core tier access', () => {
  beforeEach(() => {
    mockedUseSubscription.mockReturnValue({ subscription: { tier: 'seeker' } });
    mockedUseAuth.mockReturnValue({ user: null });
    mockedUseQuery.mockReturnValue({ data: undefined });
  });

  it.each(LEGACY_TIERS)('allows future planning for %s metadata', tier => {
    mockedUseSubscription.mockReturnValue({ subscription: { tier } });
    const onUpgradeRequired = jest.fn();
    const { result } = renderHook(() => usePlanningGating(
      new Date('2026-09-19T12:00:00'),
      'inApp',
      onUpgradeRequired,
    ));

    expect(result.current).toMatchObject({
      isLocked: false,
      canAccess: true,
      upgradeRequired: false,
      lockIconVisible: false,
    });
    result.current.handleLockedAction();
    expect(onUpgradeRequired).not.toHaveBeenCalled();
  });

  it.each(LEGACY_TIERS)('allows smart journaling for %s metadata', tier => {
    mockedUseSubscription.mockReturnValue({ subscription: { tier } });
    const { result } = renderHook(() => useSmartJournalingGating({ feature: 'prayer' }));

    expect(result.current).toMatchObject({
      isLocked: false,
      canUseFeature: true,
      upgradeMessage: '',
      feature: 'prayer',
    });
  });

  it.each([...LEGACY_TIERS, null])('allows all time-block capabilities for %s metadata', tier => {
    mockedUseQuery.mockReturnValue({ data: tier ? { tier } : undefined });
    const { result } = renderHook(() => useCalendarGating());

    expect(result.current).toMatchObject({
      canSyncToCalendar: true,
      canUseRepeat: true,
      canUseLocationServices: true,
      canDeleteSeries: true,
      showCalendarLock: false,
      showRepeatLock: false,
    });
  });
});

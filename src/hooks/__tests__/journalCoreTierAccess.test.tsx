import { renderHook } from '@testing-library/react-native';
import { usePlanningGating } from '../usePlanningGating';
import { useSmartJournalingGating } from '../useSmartJournalingGating';
import { useSubscription } from '../useSubscription';

jest.mock('../useSubscription', () => ({ useSubscription: jest.fn() }));

const mockedUseSubscription = useSubscription as jest.Mock;

describe('Journal core tier access', () => {
  beforeEach(() => {
    mockedUseSubscription.mockReturnValue({ subscription: { tier: 'seeker' } });
  });

  it('allows future planning for legacy seeker accounts', () => {
    const { result } = renderHook(() => usePlanningGating(new Date('2026-09-19T12:00:00')));

    expect(result.current).toMatchObject({
      isLocked: false,
      canAccess: true,
      upgradeRequired: false,
      lockIconVisible: false,
    });
  });

  it('allows smart journaling for legacy seeker accounts', () => {
    const { result } = renderHook(() => useSmartJournalingGating({ feature: 'prayer' }));

    expect(result.current).toMatchObject({
      isLocked: false,
      canUseFeature: true,
      upgradeMessage: '',
      feature: 'prayer',
    });
  });
});

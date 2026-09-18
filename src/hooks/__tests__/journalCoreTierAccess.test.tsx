import { renderHook } from '@testing-library/react-native';
import { useCalendarGating } from '../useCalendarGating';

describe('Journal core tier access', () => {
  it('allows all time-block capabilities without subscription state', () => {
    const { result } = renderHook(() => useCalendarGating());

    expect(result.current).toMatchObject({
      canSyncToCalendar: true,
      canUseRepeat: true,
      canUseLocationServices: true,
      canDeleteSeries: true,
      showCalendarLock: false,
      showRepeatLock: false,
      currentTier: 'included',
      isSeeker: false,
    });
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReviewSettings, weekEndFromWeekStart } from '../../storage/reviewSettingsStorage';
import { getWeeklyPeriodFor } from '../reviewPeriodService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

describe('review week follows Profile Week Start', () => {
  beforeEach(() => jest.resetAllMocks());

  it.each([
    ['monday', 0, '2026-09-07', '2026-09-13'],
    ['sunday', 6, '2026-09-06', '2026-09-12'],
    ['wednesday', 2, '2026-09-09', '2026-09-15'],
  ])('uses %s for the review boundary', (start, end, from, until) => {
    expect(weekEndFromWeekStart(start)).toBe(end);
    expect(getWeeklyPeriodFor(end, '2026-09-16')).toMatchObject({ periodStart: from, periodEnd: until });
  });

  it('overrides the legacy review day while preserving other settings', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ weekEndsOn: 3, reminderTime: '20:00', enabledCadences: { monthly: false } }));
    expect(await getReviewSettings('sunday')).toMatchObject({ weekEndsOn: 6, reminderTime: '20:00', enabledCadences: { monthly: false, weekly: true } });
  });

  it('uses the synced Profile preference outside React', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async key => key === 'journal:review-week-start' ? 'thursday' : null);
    expect((await getReviewSettings()).weekEndsOn).toBe(3);
  });

  it('defaults invalid or missing preferences to Monday', () => {
    expect(weekEndFromWeekStart()).toBe(0);
    expect(weekEndFromWeekStart('bad')).toBe(0);
  });
});

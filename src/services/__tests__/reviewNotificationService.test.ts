import {getNextReviewNotificationDate} from '../reviewNotificationService';
import {DEFAULT_REVIEW_SETTINGS} from '../../storage/reviewSettingsStorage';

jest.mock('../pushNotificationService', () => ({
  pushNotificationService: {},
}));

describe('Year End review notification', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires when the final seven-day Year End window opens', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 26, 12));

    const notification = getNextReviewNotificationDate('year_end', {
      ...DEFAULT_REVIEW_SETTINGS,
      reminderTime: '19:00',
    });

    expect(notification).toEqual(new Date(2026, 11, 25, 19));
  });
});

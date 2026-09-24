jest.mock('../pushNotificationService', () => ({
  pushNotificationService: {
    scheduleLocalNotification: jest.fn(),
    cancelLocalNotification: jest.fn(),
  },
}));

jest.mock('../journalImpactAnalyticsService', () => ({
  queueGospelImpactForShare: jest.fn(),
  queueGospelImpactRetraction: jest.fn(),
}));

import {
  getForMeDayYears,
  getNextForMeDay,
  isForMeDay,
  scheduleForMeDayReminder,
} from '../forMeDayService';
import {pushNotificationService} from '../pushNotificationService';

const settings = {
  spiritualBirthday: '2018-09-18',
  originalStory: '',
  reminderEnabled: true,
  reminderTime: '09:00',
  showInMoments: true,
  includeYearWhenSharing: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('For Me Day date behavior', () => {
  it('matches the anniversary by local month and day', () => {
    expect(isForMeDay('2018-09-18', new Date(2026, 8, 18, 7))).toBe(true);
    expect(isForMeDay('2018-09-18', new Date(2026, 8, 19, 7))).toBe(false);
  });

  it('calculates the anniversary count', () => {
    expect(getForMeDayYears('2018-09-18', new Date(2026, 8, 18))).toBe(8);
    expect(getForMeDayYears('not-a-date', new Date())).toBeNull();
  });

  it('schedules this year when still upcoming and next year after it passes', () => {
    expect(getNextForMeDay(settings, new Date(2026, 7, 1)).getFullYear()).toBe(
      2026,
    );
    expect(getNextForMeDay(settings, new Date(2026, 9, 1)).getFullYear()).toBe(
      2027,
    );
  });

  it('cancels the pending anniversary when reminders are disabled', async () => {
    await scheduleForMeDayReminder({...settings, reminderEnabled: false});
    expect(
      pushNotificationService.cancelLocalNotification,
    ).toHaveBeenCalledTimes(2);
    expect(
      pushNotificationService.scheduleLocalNotification,
    ).not.toHaveBeenCalled();
  });

  it('uses New Life Day in the annual reminder', async () => {
    await scheduleForMeDayReminder(settings);

    expect(
      pushNotificationService.scheduleLocalNotification,
    ).toHaveBeenCalledWith(
      expect.objectContaining({title: 'Today is your New Life Day ✦'}),
      expect.any(Date),
    );
  });
});

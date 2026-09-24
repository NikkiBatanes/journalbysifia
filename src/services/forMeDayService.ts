import {format} from 'date-fns';
import {gospelStorage, type ForMeDaySettings} from '../storage/gospelStorage';
import {pushNotificationService} from './pushNotificationService';

export const isForMeDay = (birthday: string, date = new Date()): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!match) {
    return false;
  }
  return (
    Number(match[2]) === date.getMonth() + 1 &&
    Number(match[3]) === date.getDate()
  );
};

export const getForMeDayYears = (
  birthday: string,
  date = new Date(),
): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!match) {
    return null;
  }
  const years = date.getFullYear() - Number(match[1]);
  return years >= 0 ? years : null;
};

export const getNextForMeDay = (
  settings: ForMeDaySettings,
  from = new Date(),
): Date => {
  const [, , monthText, dayText] =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(settings.spiritualBirthday) || [];
  const [hourText, minuteText] = settings.reminderTime.split(':');
  const month = Math.max(0, Number(monthText || 1) - 1);
  const day = Number(dayText || 1);
  const candidate = new Date(
    from.getFullYear(),
    month,
    day,
    Number(hourText || 9),
    Number(minuteText || 0),
    0,
    0,
  );
  if (candidate.getTime() <= from.getTime()) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  return candidate;
};

export const scheduleForMeDayReminder = async (
  settings?: ForMeDaySettings | null,
): Promise<void> => {
  const resolved = settings ?? (await gospelStorage.getForMeDaySettings());
  if (!resolved) {
    return;
  }
  if (!resolved.reminderEnabled) {
    const year = new Date().getFullYear();
    await Promise.all([
      pushNotificationService.cancelLocalNotification(`for-me-day-${year}`),
      pushNotificationService.cancelLocalNotification(`for-me-day-${year + 1}`),
    ]);
    return;
  }
  const next = getNextForMeDay(resolved);
  await pushNotificationService.scheduleLocalNotification(
    {
      id: `for-me-day-${format(next, 'yyyy')}`,
      title: 'Today is your New Life Day ✦',
      message:
        'Celebrate the day you accepted Jesus as your Lord and Savior and began following Him.',
      priority: 'high',
      data: {type: 'for_me_day', deep_link: 'sifia://for-me-day'},
    },
    next,
  );
};

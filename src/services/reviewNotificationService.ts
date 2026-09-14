import {
  addDays,
  addMonths,
  addQuarters,
  addYears,
  endOfMonth,
  endOfQuarter,
  isPast,
  setHours,
  setMinutes,
  setYear,
  startOfDay,
  subDays,
} from 'date-fns';

import { pushNotificationService } from './pushNotificationService';
import { getReviewSettings, type ReviewSettings } from '../storage/reviewSettingsStorage';
import { type ReviewType } from '../storage/reviewStorage';

const parseTime = (time: string): { hours: number; minutes: number } => {
  const parts = time.split(':');
  const hours = Number(parts[0] ?? 0);
  const minutes = Number(parts[1] ?? 0);
  return { hours, minutes };
};

const applyTime = (date: Date, time: string): Date => {
  const { hours, minutes } = parseTime(time);
  return setHours(setMinutes(startOfDay(date), minutes), hours);
};

const nextWeeklyDate = (weekEndsOn: number, time: string): Date => {
  const now = new Date();
  const dayDiff = (weekEndsOn - now.getDay() + 7) % 7;
  const nextEnd = startOfDay(addDays(now, dayDiff));
  let target = applyTime(nextEnd, time);
  if (isPast(target)) {
    target = addDays(target, 7);
  }
  return target;
};

const nextMonthlyDate = (time: string): Date => {
  const now = new Date();
  let candidate = applyTime(subDays(endOfMonth(now), 2), time);
  if (isPast(candidate)) {
    const nextMonth = addMonths(now, 1);
    candidate = applyTime(subDays(endOfMonth(nextMonth), 2), time);
  }
  return candidate;
};

const nextQuarterlyDate = (time: string): Date => {
  const now = new Date();
  let candidate = applyTime(subDays(endOfQuarter(now), 6), time);
  if (isPast(candidate)) {
    const nextQuarter = addQuarters(now, 1);
    candidate = applyTime(subDays(endOfQuarter(nextQuarter), 6), time);
  }
  return candidate;
};

const nextYearEndDate = (time: string): Date => {
  const now = new Date();
  const year = now.getFullYear();
  const candidate = applyTime(new Date(year, 11, 15), time);
  if (isPast(candidate)) {
    return applyTime(new Date(year + 1, 11, 15), time);
  }
  return candidate;
};

const nextBeginYearDate = (time: string): Date => {
  const now = new Date();
  const year = now.getFullYear();
  const candidate = applyTime(new Date(year, 0, 1), time);
  if (isPast(candidate)) {
    return applyTime(new Date(year + 1, 0, 1), time);
  }
  return candidate;
};

export const getNextReviewNotificationDate = (
  type: ReviewType,
  settings: ReviewSettings,
): Date | null => {
  if (!settings.enabledCadences[type]) {
    return null;
  }
  const { reminderTime } = settings;
  switch (type) {
    case 'weekly':
      return nextWeeklyDate(settings.weekEndsOn, reminderTime);
    case 'monthly':
      return nextMonthlyDate(reminderTime);
    case 'quarterly':
      return nextQuarterlyDate(reminderTime);
    case 'year_end':
      return nextYearEndDate(reminderTime);
    case 'begin_year':
      return nextBeginYearDate(reminderTime);
    default:
      return null;
  }
};

const REVIEW_NOTIFICATION_TITLES: Record<ReviewType, string> = {
  weekly: 'Time to look back on your week',
  monthly: 'Time to review this month',
  quarterly: 'Time to review this season',
  year_end: 'Close the year with God',
  begin_year: 'Begin the year well',
};

const REVIEW_NOTIFICATION_BODIES: Record<ReviewType, string> = {
  weekly: 'A few minutes with God can prepare your heart for the week ahead.',
  monthly: 'Your monthly review is ready. What is God showing you?',
  quarterly: 'Take a moment to notice the season you just walked through.',
  year_end: 'Pause and close this year with gratitude and honesty.',
  begin_year: 'Start the year with what matters most.',
};

export const scheduleReviewNotification = async (
  type: ReviewType,
  settings: ReviewSettings,
): Promise<void> => {
  const date = getNextReviewNotificationDate(type, settings);
  if (!date) {return;}

  await pushNotificationService.scheduleLocalNotification(
    {
      id: `review-${type}`,
      title: REVIEW_NOTIFICATION_TITLES[type],
      message: REVIEW_NOTIFICATION_BODIES[type],
      data: {
        type: 'review',
        reviewType: type,
        reviewNotification: true,
      },
    },
    date,
  );
};

export const rescheduleReviewNotifications = async (): Promise<void> => {
  const granted = await pushNotificationService.requestPermissions();
  if (!granted) {return;}

  const settings = await getReviewSettings();
  const types: ReviewType[] = ['weekly', 'monthly', 'quarterly', 'year_end', 'begin_year'];

  await Promise.all(
    types.map(type => scheduleReviewNotification(type, settings)),
  );
};

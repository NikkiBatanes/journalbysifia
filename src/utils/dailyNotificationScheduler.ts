import { smartNotificationEngine } from '../services/notifications/smartNotificationEngine';
import { streakTrackingService } from '../services/streakTrackingService';
import { Logger } from './ProductionLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SCHEDULED_KEY = 'notifications:lastScheduled';
const SCHEDULE_INTERVAL_HOURS = 6; // Re-schedule every 6 hours to ensure notifications are sent

/**
 * Daily Notification Scheduler
 * Handles scheduling of all daily notifications
 * Call this on app launch or via background task
 */
export class DailyNotificationScheduler {
  /**
   * Check if notifications need to be scheduled
   * Now allows scheduling multiple times per day (every 6 hours)
   */
  static async shouldScheduleToday(): Promise<boolean> {
    try {
      const lastScheduled = await AsyncStorage.getItem(LAST_SCHEDULED_KEY);

      if (!lastScheduled) {
        return true;
      }

      const lastDate = new Date(lastScheduled);
      const now = new Date();

      // Check if it's been more than SCHEDULE_INTERVAL_HOURS since last schedule
      const hoursSinceLastSchedule = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

      return hoursSinceLastSchedule >= SCHEDULE_INTERVAL_HOURS;
    } catch (error) {
      Logger.error('Failed to check if should schedule', error as Error, {
        component: 'DailyNotificationScheduler',
      });
      return true; // Default to scheduling if check fails
    }
  }

  /**
   * Schedule all daily notifications for a user
   */
  static async scheduleForUser(userId: string): Promise<boolean> {
    try {
      // Check if already scheduled today
      const shouldSchedule = await this.shouldScheduleToday();

      if (!shouldSchedule) {
        Logger.info('Notifications already scheduled today', {
          component: 'DailyNotificationScheduler',
          userId,
        });
        return false;
      }

      Logger.info('Scheduling state-based daily notifications', {
        component: 'DailyNotificationScheduler',
        userId,
      });

      // Replace broad fixed reminders with the state-based notification engine.
      await smartNotificationEngine.scheduleForUser(userId);

      // Check and schedule streak alerts
      await streakTrackingService.checkAllStreaksForUser(userId);

      // Mark as scheduled for today
      await AsyncStorage.setItem(LAST_SCHEDULED_KEY, new Date().toISOString());

      Logger.info('Daily notifications scheduled successfully', {
        component: 'DailyNotificationScheduler',
        userId,
      });

      return true;
    } catch (error) {
      Logger.error('Failed to schedule daily notifications', error as Error, {
        component: 'DailyNotificationScheduler',
        userId,
      });
      return false;
    }
  }

  /**
   * Force reschedule (useful for testing or manual trigger)
   */
  static async forceReschedule(userId: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(LAST_SCHEDULED_KEY);
      return await this.scheduleForUser(userId);
    } catch (error) {
      Logger.error('Failed to force reschedule', error as Error, {
        component: 'DailyNotificationScheduler',
        userId,
      });
      return false;
    }
  }

  /**
   * Get last scheduled date
   */
  static async getLastScheduledDate(): Promise<Date | null> {
    try {
      const lastScheduled = await AsyncStorage.getItem(LAST_SCHEDULED_KEY);
      return lastScheduled ? new Date(lastScheduled) : null;
    } catch (error) {
      Logger.error('Failed to get last scheduled date', error as Error, {
        component: 'DailyNotificationScheduler',
      });
      return null;
    }
  }
}

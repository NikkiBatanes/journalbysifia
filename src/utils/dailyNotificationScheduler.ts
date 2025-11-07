import { contextualNotificationService } from '../services/contextualNotificationService';
import { streakTrackingService } from '../services/streakTrackingService';
import { Logger } from './ProductionLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SCHEDULED_KEY = 'notifications:lastScheduled';

/**
 * Daily Notification Scheduler
 * Handles scheduling of all daily notifications
 * Call this on app launch or via background task
 */
export class DailyNotificationScheduler {
  /**
   * Check if notifications need to be scheduled today
   */
  static async shouldScheduleToday(): Promise<boolean> {
    try {
      const lastScheduled = await AsyncStorage.getItem(LAST_SCHEDULED_KEY);
      
      if (!lastScheduled) {
        return true;
      }

      const lastDate = new Date(lastScheduled);
      const today = new Date();
      
      // Check if it's a new day
      return (
        lastDate.getDate() !== today.getDate() ||
        lastDate.getMonth() !== today.getMonth() ||
        lastDate.getFullYear() !== today.getFullYear()
      );
    } catch (error) {
      Logger.error('Failed to check if should schedule today', error as Error, {
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

      Logger.info('Scheduling daily notifications', {
        component: 'DailyNotificationScheduler',
        userId,
      });

      // Schedule all contextual notifications
      await contextualNotificationService.scheduleAllDailyNotifications(userId);

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

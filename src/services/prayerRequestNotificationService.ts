import { notificationSchedulerService } from '../services/notificationSchedulerService';
import { Logger } from '../utils/ProductionLogger';
import { buildSmartNotificationCopy } from './notifications/notificationCopyBank';

/**
 * Prayer Request Notification Service
 * Automatically sends notifications when prayer requests are created
 */

class PrayerRequestNotificationService {
  static instance: PrayerRequestNotificationService;

  static getInstance(): PrayerRequestNotificationService {
    if (!PrayerRequestNotificationService.instance) {
      PrayerRequestNotificationService.instance = new PrayerRequestNotificationService();
    }
    return PrayerRequestNotificationService.instance;
  }

  /**
   * Send notification when someone creates a prayer request for another person
   */
  async sendPrayerRequestNotification(
    prayerRequestData: {
      prayerForPerson?: string;
      prayerRequest?: string;
      userId: string;
      prayerId?: string;
    }
  ): Promise<void> {
    try {
      const { prayerForPerson, prayerRequest, userId, prayerId } = prayerRequestData;

      // Only send notification if praying for someone specific
      if (!prayerForPerson || prayerForPerson.trim().length === 0) {
        Logger.info('No specific person to pray for - skipping notification', {
          component: 'PrayerRequestNotificationService',
          userId,
        });
        return;
      }

      Logger.info('Sending prayer request notification', {
        component: 'PrayerRequestNotificationService',
        userId,
        prayerForPerson,
        prayerRequest: prayerRequest?.substring(0, 50) + '...',
      });

      // Schedule reminder for next day at 9 AM (or user's preferred prayer time)
      const scheduledFor = new Date();
      scheduledFor.setDate(scheduledFor.getDate() + 1); // Next day
      scheduledFor.setHours(9, 0, 0, 0); // 9:00 AM

      // If it's already past 9 AM today, schedule for tomorrow at 9 AM
      // Otherwise schedule for today at 9 AM
      const now = new Date();
      if (scheduledFor <= now) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }

      const copy = buildSmartNotificationCopy('prayer_request_care', {
        personName: prayerForPerson.trim(),
      });
      const success = await notificationSchedulerService.scheduleNotification({
        user_id: userId,
        type: 'prayer_request_care',
        title: copy.title,
        message: copy.message,
        scheduled_for: scheduledFor.toISOString(),
        priority: 'normal', // Normal priority for scheduled reminders
        data: {
          deep_link: prayerId ? `sifia://prayer/${prayerId}` : 'sifia://journal/prayer?tab=requests',
          type: 'prayer_request_care',
          dedupe_key: `prayer_request_care:${prayerId || 'new'}`,
          privacy_level: 'sensitive',
          prayerForPerson,
          prayerRequest,
          prayerId,
        },
      }, {
        priority: 'normal',
        batchWithOthers: true, // Allow batching with other prayer reminders
      });

      if (success) {
        Logger.info('Prayer request notification scheduled successfully', {
          component: 'PrayerRequestNotificationService',
          userId,
          prayerForPerson,
          scheduledFor: scheduledFor.toISOString(),
        });
      } else {
        Logger.error('Failed to schedule prayer request notification', new Error('Schedule returned false'), {
          component: 'PrayerRequestNotificationService',
          userId,
          prayerForPerson,
        });
      }

    } catch (error) {
      Logger.error('Error sending prayer request notification', error as Error, {
        component: 'PrayerRequestNotificationService',
        userId: prayerRequestData.userId,
        prayerForPerson: prayerRequestData.prayerForPerson,
      });
    }
  }

}

export const prayerRequestNotificationService = PrayerRequestNotificationService.getInstance();

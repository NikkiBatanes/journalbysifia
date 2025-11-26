import { notificationSchedulerService } from '../services/notificationSchedulerService';
import { supabase } from '../services/supabaseClient';
import { Logger } from '../utils/ProductionLogger';

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

      const success = await notificationSchedulerService.scheduleNotification({
        user_id: userId,
        type: 'prayer_request_reminder',
        title: `🙏🏼 Remember to Pray for ${prayerForPerson}`,
        message: prayerRequest || `Don't forget to pray for ${prayerForPerson}`,
        scheduled_for: scheduledFor.toISOString(),
        priority: 'normal', // Normal priority for scheduled reminders
        data: {
          deep_link: `sifia://prayer/${prayerId || 'new'}`,
          type: 'prayer_request_reminder',
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

  /**
   * Send notifications to community members when someone needs prayer
   * This would be used for community prayer features
   */
  async sendCommunityPrayerAlert(
    prayerRequestData: {
      userName: string;
      prayerRequest: string;
      userId: string;
      prayerId: string;
    }
  ): Promise<void> {
    try {
      const { userName, prayerRequest, userId, prayerId } = prayerRequestData;

      // Get community members who have opted in to prayer alerts
      const { data: communityMembers, error } = await supabase
        .from('notification_preferences')
        .select('user_id')
        .eq('prayer_request_alerts', true)
        .neq('user_id', userId); // Don't send to the person who created it

      if (error) {
        Logger.error('Error fetching community members for prayer alerts', error as Error, {
          component: 'PrayerRequestNotificationService',
          userId,
        });
        return;
      }

      if (!communityMembers || communityMembers.length === 0) {
        Logger.info('No community members opted in for prayer alerts', {
          component: 'PrayerRequestNotificationService',
          userId,
        });
        return;
      }

      // Schedule notifications for each community member
      const scheduledFor = new Date(Date.now() + 10000); // 10 seconds from now

      for (const member of communityMembers) {
        await notificationSchedulerService.scheduleNotification({
          user_id: member.user_id,
          type: 'community_prayer_alert',
          title: `🙏🏼 Prayer Request: ${userName}`,
          message: prayerRequest,
          scheduled_for: scheduledFor.toISOString(),
          priority: 'normal',
          data: {
            deep_link: `sifia://prayer/${prayerId}`,
            type: 'community_prayer_alert',
            requestingUserId: userId,
            userName,
            prayerRequest,
            prayerId,
          },
        });
      }

      Logger.info(`Scheduled community prayer alerts for ${communityMembers.length} members`, {
        component: 'PrayerRequestNotificationService',
        userId,
        userName,
        communityMemberCount: communityMembers.length,
      });

    } catch (error) {
      Logger.error('Error sending community prayer alerts', error as Error, {
        component: 'PrayerRequestNotificationService',
        userId: prayerRequestData.userId,
        userName: prayerRequestData.userName,
      });
    }
  }
}

export const prayerRequestNotificationService = PrayerRequestNotificationService.getInstance();
